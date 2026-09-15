import { discordRequest } from './discord-onboarding.js';

const DEFAULT_RECRUITMENT_CHANNEL_ID = '1426641891381739612';
const ALERT_STATE_PREFIX = 'discord-recruitment-alert-v1:';
const ALERT_PENDING_MS = 2 * 60 * 1000;
const ALERT_RETRY_MS = 5 * 60 * 1000;

export function recruitmentConfig(env) {
  return {
    recruitmentChannelId: env.RECRUITMENT_CHANNEL_ID || DEFAULT_RECRUITMENT_CHANNEL_ID,
  };
}

export async function sendRecruitmentSubmissionAlert(env, application, origin) {
  if (!application?.id) return { status: 'invalid_application' };
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') {
    return { status: 'storage_unavailable' };
  }

  const key = `${ALERT_STATE_PREFIX}${application.id}`;
  const now = Date.now();
  const existing = await readJson(env.PROJECTS, key);

  if (existing?.status === 'sent') {
    return { status: 'already_sent', sentAt: existing.sentAt || null, messageId: existing.messageId || null };
  }
  if (existing?.status === 'pending' && Number(existing.pendingUntil || 0) > now) {
    return { status: 'pending' };
  }
  if (existing?.status === 'failed' && Number(existing.retryAfter || 0) > now) {
    return { status: 'cooldown', retryAfter: existing.retryAfter };
  }

  // A short ownership token reduces duplicate sends if two submission requests race.
  const attemptId = crypto.randomUUID();
  await env.PROJECTS.put(key, JSON.stringify({
    status: 'pending',
    attemptId,
    pendingAt: new Date(now).toISOString(),
    pendingUntil: now + ALERT_PENDING_MS,
  }));
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

  try {
    const message = await discordRequest(env, `/channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        embeds: [{
          title: 'New Mongrel Application',
          description: 'A new squad application has been submitted and is ready for leadership review.',
          fields: [
            { name: 'Commander', value: `**CMDR ${commanderName.replace(/^CMDR\s+/i, '')}**`, inline: true },
            { name: 'Discord', value: `${userMention}\n${discordName}`, inline: true },
            { name: 'Status', value: '**Submitted**', inline: true },
            { name: 'Submitted', value: submittedDisplay, inline: false },
          ],
          footer: { text: 'Regiment of Imperial Mongrels • Recruitment' },
        }],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: 'Review Application',
            url: reviewUrl,
            emoji: { name: '📋' },
          }],
        }],
        allowed_mentions: { parse: [] },
      }),
    });

    const sentAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({
      status: 'sent',
      sentAt,
      messageId: message?.id || null,
      channelId,
    }));
    return { status: 'sent', sentAt, messageId: message?.id || null, channelId };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const retryAfter = now + ALERT_RETRY_MS;
    await env.PROJECTS.put(key, JSON.stringify({
      status: 'failed',
      failedAt,
      retryAfter,
      error: String(error?.message || error).slice(0, 500),
    }));
    return { status: 'failed', failedAt, retryAfter, error: String(error?.message || error).slice(0, 500) };
  }
}

export async function sendRecruitmentTestAlert(env, origin, requestedBy = 'Site Admin') {
  const channelId = recruitmentConfig(env).recruitmentChannelId;
  const reviewUrl = `${origin.replace(/\/$/, '')}/applications/`;
  const message = await discordRequest(env, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: 'Recruitment Alert Test',
        description: 'The Mongrels website can post application notifications to **The High Council**. No application was created by this test.',
        fields: [
          { name: 'Requested By', value: clean(requestedBy, 'Site Admin', 80), inline: true },
          { name: 'Integration', value: 'Discord recruitment alerts', inline: true },
          { name: 'Result', value: '**Connection successful**', inline: false },
        ],
        footer: { text: 'Regiment of Imperial Mongrels • Recruitment' },
      }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: 'Open Recruitment Applications', url: reviewUrl, emoji: { name: '📋' } }],
      }],
    }),
  });
  return { status: 'sent', messageId: message?.id || null, channelId };
}

async function readJson(namespace, key) {
  try {
    const value = await namespace.get(key, { type: 'json' });
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function clean(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const out = value.trim();
  return out ? out.slice(0, max) : fallback;
}
