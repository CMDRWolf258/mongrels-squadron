import { discordRequest, onboardingConfig } from './discord-onboarding.js';

const DEFAULT_RECRUITMENT_CHANNEL_ID = '1426641891381739612';
const ALERT_STATE_PREFIX = 'discord-recruitment-alert-v1:';
const ACCEPTANCE_DM_STATE_PREFIX = 'discord-recruitment-acceptance-dm-v1:';
const DECLINE_DM_STATE_PREFIX = 'discord-recruitment-decline-dm-v1:';
const REAPPLICATION_DM_STATE_PREFIX = 'discord-recruitment-reapplication-dm-v1:';
const ALERT_PENDING_MS = 2 * 60 * 1000;
const ALERT_RETRY_MS = 5 * 60 * 1000;
const ACCEPTANCE_DM_PENDING_MS = 2 * 60 * 1000;
const ACCEPTANCE_DM_RETRY_MS = 24 * 60 * 60 * 1000;
const DECLINE_DM_PENDING_MS = 2 * 60 * 1000;
const DECLINE_DM_RETRY_MS = 24 * 60 * 60 * 1000;

export function recruitmentConfig(env) {
  return { recruitmentChannelId: env.RECRUITMENT_CHANNEL_ID || DEFAULT_RECRUITMENT_CHANNEL_ID };
}

export async function sendRecruitmentSubmissionAlert(env, application, origin) {
  if (!application?.id) return { status: 'invalid_application' };
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') return { status: 'storage_unavailable' };
  const key = `${ALERT_STATE_PREFIX}${application.id}`;
  const now = Date.now();
  const existing = await readJson(env.PROJECTS, key);
  if (existing?.status === 'sent') return { status: 'already_sent', sentAt: existing.sentAt || null, messageId: existing.messageId || null };
  if (existing?.status === 'pending' && Number(existing.pendingUntil || 0) > now) return { status: 'pending' };
  if (existing?.status === 'failed' && Number(existing.retryAfter || 0) > now) return { status: 'cooldown', retryAfter: existing.retryAfter };

  const attemptId = crypto.randomUUID();
  await env.PROJECTS.put(key, JSON.stringify({ status:'pending', attemptId, pendingAt:new Date(now).toISOString(), pendingUntil:now + ALERT_PENDING_MS }));
  const claimed = await readJson(env.PROJECTS, key);
  if (claimed?.attemptId !== attemptId) return { status: 'pending' };

  const channelId = recruitmentConfig(env).recruitmentChannelId;
  const reviewUrl = `${origin.replace(/\/$/, '')}/applications/`;
  const commanderName = clean(application?.answers?.commanderName, 'Unknown Commander', 80);
  const discordName = clean(application.discordUsername, application.ownerName || 'Discord User', 80);
  const userMention = application.ownerId ? `<@${application.ownerId}>` : discordName;
  const submittedAt = application.submittedAt || application.updatedAt || new Date(now).toISOString();
  const unix = Math.floor(new Date(submittedAt).getTime() / 1000);
  const submittedDisplay = Number.isFinite(unix) ? `<t:${unix}:F>` : submittedAt;
  const inGameReported = application?.answers?.inGameApplicationSubmitted ? 'Applicant reports **submitted**' : 'Not recorded';

  try {
    const message = await discordRequest(env, `/channels/${encodeURIComponent(channelId)}/messages`, {
      method:'POST',
      body:JSON.stringify({
        embeds:[{
          title:'New Mongrel Application',
          description:'A new squad application has been submitted and is ready for leadership review.',
          fields:[
            { name:'Commander', value:`**CMDR ${commanderName.replace(/^CMDR\s+/i, '')}**`, inline:true },
            { name:'Discord', value:`${userMention}\n${discordName}`, inline:true },
            { name:'Status', value:'**Submitted**', inline:true },
            { name:'In-Game Squadron App', value:inGameReported, inline:true },
            { name:'Submitted', value:submittedDisplay, inline:false },
          ],
          footer:{ text:'Regiment of Imperial Mongrels • Recruitment' },
        }],
        components:[{ type:1, components:[{ type:2, style:5, label:'Review Application', url:reviewUrl, emoji:{ name:'📋' } }] }],
        allowed_mentions:{ parse:[] },
      }),
    });
    const sentAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({ status:'sent', sentAt, messageId:message?.id || null, channelId }));
    return { status:'sent', sentAt, messageId:message?.id || null, channelId };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const retryAfter = now + ALERT_RETRY_MS;
    await env.PROJECTS.put(key, JSON.stringify({ status:'failed', failedAt, retryAfter, error:String(error?.message || error).slice(0,500) }));
    return { status:'failed', failedAt, retryAfter, error:String(error?.message || error).slice(0,500) };
  }
}

export async function provisionAcceptedApplicant(env, application, origin) {
  const guildId = String(env.GUILD_ID || '').trim();
  const memberRoleId = String(env.MEMBER_ROLE_ID || '').trim();
  const userId = String(application?.ownerId || '').trim();
  if (!guildId) throw new Error('GUILD_ID is not configured');
  if (!memberRoleId) throw new Error('MEMBER_ROLE_ID is not configured');
  if (!userId) throw new Error('Application has no Discord owner ID');

  await discordRequest(env, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(memberRoleId)}`, { method:'PUT' });

  const cleanupWarnings = [];
  const config = onboardingConfig(env);
  for (const roleId of [config.applicantRoleId, config.guestRoleId]) {
    if (!roleId || roleId === memberRoleId) continue;
    try {
      await discordRequest(env, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, { method:'DELETE' });
    } catch (error) {
      cleanupWarnings.push(String(error?.message || error).slice(0,300));
    }
  }

  let dm;
  try { dm = await sendAcceptanceWelcomeOnce(env, application, origin); }
  catch (error) { dm = { status:'failed', error:String(error?.message || error).slice(0,500) }; }

  return { status:'provisioned', memberRoleId, cleanupWarnings, dmStatus:dm.status, dmSentAt:dm.sentAt || null };
}

export async function sendAcceptanceWelcomeOnce(env, application, origin) {
  const userId = String(application?.ownerId || '').trim();
  if (!userId) return { status:'invalid_user' };
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') return { status:'storage_unavailable' };
  const key = `${ACCEPTANCE_DM_STATE_PREFIX}${userId}`;
  const now = Date.now();
  const existing = await readJson(env.PROJECTS, key);
  if (existing?.status === 'sent') return { status:'already_sent', sentAt:existing.sentAt || null };
  if (existing?.status === 'pending' && Number(existing.pendingUntil || 0) > now) return { status:'pending' };
  if (existing?.status === 'failed' && Number(existing.retryAfter || 0) > now) return { status:'cooldown', retryAfter:existing.retryAfter };

  await env.PROJECTS.put(key, JSON.stringify({ status:'pending', pendingAt:new Date(now).toISOString(), pendingUntil:now + ACCEPTANCE_DM_PENDING_MS }));
  const commanderName = clean(application?.answers?.commanderName, 'Commander', 80).replace(/^CMDR\s+/i, '');
  try {
    await sendAcceptanceDm(env, userId, origin, commanderName);
    const sentAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({ status:'sent', sentAt, applicationId:application?.id || null }));
    return { status:'sent', sentAt };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const retryAfter = now + ACCEPTANCE_DM_RETRY_MS;
    await env.PROJECTS.put(key, JSON.stringify({ status:'failed', failedAt, retryAfter, applicationId:application?.id || null, error:String(error?.message || error).slice(0,500) }));
    return { status:'failed', failedAt, retryAfter, error:String(error?.message || error).slice(0,500) };
  }
}

export async function sendAcceptanceTestDm(env, userId, origin, commanderName = 'Wolf258') {
  const target = String(userId || '').trim();
  if (!target) throw new Error('Site Admin Discord user ID is unavailable');
  const message = await sendAcceptanceDm(env, target, origin, clean(commanderName, 'Wolf258', 80).replace(/^CMDR\s+/i, ''), true);
  return { status:'sent', messageId:message?.id || null, testOnly:true };
}

async function sendAcceptanceDm(env, userId, origin, commanderName, testOnly = false) {
  const base = origin.replace(/\/$/, '');
  const activateUrl = `${base}/api/auth/login?return=%2Fmember%2F`;
  const memberUrl = `${base}/member/`;
  const dm = await discordRequest(env, '/users/@me/channels', { method:'POST', body:JSON.stringify({ recipient_id:userId }) });
  return discordRequest(env, `/channels/${encodeURIComponent(dm.id)}/messages`, {
    method:'POST',
    body:JSON.stringify({
      content:testOnly ? '🧪 **SITE ADMIN TEST** — no application, role, or one-time DM state was changed.' : undefined,
      embeds:[{
        title:'Welcome to the Regiment of Imperial Mongrels',
        description:`Your Mongrels **website application has been accepted**, CMDR ${commanderName}, and your Discord Member role has been granted.`,
        fields:[
          { name:'Activate Website Member Access', value:'Use the button below once to sign in again with Discord. This refreshes your website session so the Member Portal and private squad tools recognize your new role.' },
          { name:'Final In-Game Step — Confirm Your Acceptance', value:'Elite\'s updated Squadron join flow is two-stage. After Mongrel leadership approves your in-game Squadron application, **you must return to the Squadrons panel and confirm the acceptance / choose Join Squadron** before you are actually added to the in-game squad. Watch your in-game Comms Inbox for the approval notice, then open **Right-hand Panel → Squadrons** to finish joining.' },
          { name:'Welcome Aboard', value:'You now have access to the Mongrels member network, current tasking, projects, coordination tools, and member resources.' },
        ],
        footer:{ text:'Regiment of Imperial Mongrels • o7' },
      }],
      components:[{ type:1, components:[
        { type:2, style:5, label:'Activate Member Access', url:activateUrl, emoji:{ name:'🐺' } },
        { type:2, style:5, label:'Member Portal', url:memberUrl },
      ] }],
    }),
  });
}

export async function sendRecruitmentDeclineNotice(env, application, origin) {
  const userId = String(application?.ownerId || '').trim();
  const applicationId = String(application?.id || '').trim();
  if (!userId || !applicationId) return { status:'invalid_application' };
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') return { status:'storage_unavailable' };
  const key = `${DECLINE_DM_STATE_PREFIX}${applicationId}`;
  const now = Date.now();
  const existing = await readJson(env.PROJECTS, key);
  if (existing?.status === 'sent') return { status:'already_sent', sentAt:existing.sentAt || null };
  if (existing?.status === 'pending' && Number(existing.pendingUntil || 0) > now) return { status:'pending' };
  if (existing?.status === 'failed' && Number(existing.retryAfter || 0) > now) return { status:'cooldown', retryAfter:existing.retryAfter };
  await env.PROJECTS.put(key, JSON.stringify({ status:'pending', pendingAt:new Date(now).toISOString(), pendingUntil:now + DECLINE_DM_PENDING_MS }));

  const base = origin.replace(/\/$/, '');
  const statusUrl = `${base}/apply/`;
  const commanderName = clean(application?.answers?.commanderName, 'Commander', 80).replace(/^CMDR\s+/i, '');
  const leadershipMessage = clean(application?.applicantMessage, 'Thank you for taking the time to apply. Your application was not accepted at this time. If leadership invited you to reapply later or you would like clarification, please contact us in Discord.', 1000);
  try {
    const dm = await discordRequest(env, '/users/@me/channels', { method:'POST', body:JSON.stringify({ recipient_id:userId }) });
    const message = await discordRequest(env, `/channels/${encodeURIComponent(dm.id)}/messages`, {
      method:'POST',
      body:JSON.stringify({
        embeds:[{
          title:'Update on Your Mongrels Application',
          description:`CMDR ${commanderName}, Mongrel leadership has completed its review of your application.`,
          fields:[
            { name:'Decision', value:'Your application was **not accepted at this time**.' },
            { name:'Message from Leadership', value:leadershipMessage },
            { name:'Reapplication', value:'If leadership later reopens your application, the website will return it to Draft so you can update your answers and submit a new application cycle.' },
          ],
          footer:{ text:'Regiment of Imperial Mongrels • Recruitment' },
        }],
        components:[{ type:1, components:[{ type:2, style:5, label:'View Application Status', url:statusUrl, emoji:{ name:'📋' } }] }],
      }),
    });
    const sentAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({ status:'sent', sentAt, messageId:message?.id || null }));
    return { status:'sent', sentAt, messageId:message?.id || null };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const retryAfter = now + DECLINE_DM_RETRY_MS;
    await env.PROJECTS.put(key, JSON.stringify({ status:'failed', failedAt, retryAfter, error:String(error?.message || error).slice(0,500) }));
    return { status:'failed', failedAt, retryAfter, error:String(error?.message || error).slice(0,500) };
  }
}

export async function sendReapplicationOpenedNotice(env, application, origin) {
  const userId = String(application?.ownerId || '').trim();
  const applicationId = String(application?.id || '').trim();
  if (!userId || !applicationId) return { status:'invalid_application' };
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') return { status:'storage_unavailable' };
  const key = `${REAPPLICATION_DM_STATE_PREFIX}${applicationId}`;
  const existing = await readJson(env.PROJECTS, key);
  if (existing?.status === 'sent') return { status:'already_sent', sentAt:existing.sentAt || null };

  const continueUrl = `${origin.replace(/\/$/, '')}/apply/`;
  const commanderName = clean(application?.answers?.commanderName, 'Commander', 80).replace(/^CMDR\s+/i, '');
  try {
    const dm = await discordRequest(env, '/users/@me/channels', { method:'POST', body:JSON.stringify({ recipient_id:userId }) });
    const message = await discordRequest(env, `/channels/${encodeURIComponent(dm.id)}/messages`, {
      method:'POST',
      body:JSON.stringify({
        embeds:[{
          title:'Your Mongrels Application Has Been Reopened',
          description:`CMDR ${commanderName}, Mongrel leadership has opened a new application cycle for you.`,
          fields:[
            { name:'What to Do', value:'Your previous answers are prefilled as a new **Draft**. Review anything you want to change, complete the required in-game Squadron application step, and submit when you are ready.' },
            { name:'Previous Decision', value:'The previous application remains preserved in leadership history; opening a reapplication does not erase the earlier review.' },
          ],
          footer:{ text:'Regiment of Imperial Mongrels • Recruitment' },
        }],
        components:[{ type:1, components:[{ type:2, style:5, label:'Continue Application', url:continueUrl, emoji:{ name:'▶️' } }] }],
      }),
    });
    const sentAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({ status:'sent', sentAt, messageId:message?.id || null }));
    return { status:'sent', sentAt, messageId:message?.id || null };
  } catch (error) {
    const failedAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({ status:'failed', failedAt, error:String(error?.message || error).slice(0,500) }));
    return { status:'failed', failedAt, error:String(error?.message || error).slice(0,500) };
  }
}

export async function sendRecruitmentTestAlert(env, origin, requestedBy = 'Site Admin') {
  const channelId = recruitmentConfig(env).recruitmentChannelId;
  const reviewUrl = `${origin.replace(/\/$/, '')}/applications/`;
  const message = await discordRequest(env, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method:'POST',
    body:JSON.stringify({
      embeds:[{
        title:'Recruitment Alert Test',
        description:'The Mongrels website can post application notifications to **The High Council**. No application was created by this test.',
        fields:[
          { name:'Requested By', value:clean(requestedBy, 'Site Admin', 80), inline:true },
          { name:'Integration', value:'Discord recruitment alerts', inline:true },
          { name:'Result', value:'**Connection successful**', inline:false },
        ],
        footer:{ text:'Regiment of Imperial Mongrels • Recruitment' },
      }],
      components:[{ type:1, components:[{ type:2, style:5, label:'Open Recruitment Applications', url:reviewUrl, emoji:{ name:'📋' } }] }],
    }),
  });
  return { status:'sent', messageId:message?.id || null, channelId };
}

async function readJson(namespace, key) {
  try { const value = await namespace.get(key, { type:'json' }); return value && typeof value === 'object' ? value : null; }
  catch { return null; }
}
function clean(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const out = value.trim();
  return out ? out.slice(0,max) : fallback;
}
