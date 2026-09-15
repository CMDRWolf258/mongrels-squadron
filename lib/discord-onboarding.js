const DISCORD_API = 'https://discord.com/api/v10';

const DEFAULT_PUBLIC_KEY = '4d86ba25b2e8457730d568864182cbdf9b7057bd174b6201698f650ac5206064';
const DEFAULT_APPLICANT_ROLE_ID = '1012130660187656233';
const DEFAULT_GUEST_ROLE_ID = '1017264444553838622';
const DEFAULT_WELCOME_CHANNEL_ID = '1012755466700460163';
const WELCOME_STATE_PREFIX = 'discord-applicant-welcome-v1:';
const ONBOARDING_BUNDLE_KEY = 'discord-onboarding-bundle-v1';
const DM_RETRY_MS = 24 * 60 * 60 * 1000;

export function onboardingConfig(env) {
  return {
    publicKey: env.DISCORD_PUBLIC_KEY || DEFAULT_PUBLIC_KEY,
    applicantRoleId: env.APPLICANT_ROLE_ID || DEFAULT_APPLICANT_ROLE_ID,
    guestRoleId: env.GUEST_ROLE_ID || DEFAULT_GUEST_ROLE_ID,
    welcomeChannelId: env.WELCOME_CHANNEL_ID || DEFAULT_WELCOME_CHANNEL_ID,
  };
}

export async function verifyDiscordInteraction(request, rawBody, env) {
  const signatureHex = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signatureHex || !timestamp) return false;

  try {
    const { publicKey } = onboardingConfig(env);
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const message = new TextEncoder().encode(`${timestamp}${rawBody}`);
    return crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      hexToBytes(signatureHex),
      message,
    );
  } catch {
    return false;
  }
}

export function isEstablishedMember(interaction, env) {
  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  if (userId && userId === env.ADMIN_USER_ID) return false;

  const roles = Array.isArray(interaction?.member?.roles) ? interaction.member.roles : [];
  if (env.MEMBER_ROLE_ID && roles.includes(env.MEMBER_ROLE_ID)) return true;

  const officerRoleIds = String(env.OFFICER_ROLE_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return officerRoleIds.some(roleId => roles.includes(roleId));
}

export async function applyOnboardingChoice(env, guildId, userId, choice) {
  const config = onboardingConfig(env);
  const selectedRoleId = choice === 'applicant' ? config.applicantRoleId : config.guestRoleId;
  const oppositeRoleId = choice === 'applicant' ? config.guestRoleId : config.applicantRoleId;

  await discordRequest(env, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(selectedRoleId)}`, {
    method: 'PUT',
  });

  try {
    await discordRequest(env, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(oppositeRoleId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    // The selected role is already safely assigned. Surface only non-404 errors.
    if (!String(error?.message || '').includes('(404)')) throw error;
  }
}

export async function sendApplicantWelcomeOnce(env, userId, origin) {
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') {
    return { status: 'storage_unavailable' };
  }

  const key = `${WELCOME_STATE_PREFIX}${userId}`;
  const now = Date.now();
  const existing = await readJson(env.PROJECTS, key);

  if (existing?.status === 'sent') {
    return { status: 'already_sent', sentAt: existing.sentAt || null };
  }
  if (existing?.status === 'pending' && Number(existing.pendingUntil || 0) > now) {
    return { status: 'pending' };
  }
  if (existing?.status === 'failed' && Number(existing.retryAfter || 0) > now) {
    return { status: 'cooldown', retryAfter: existing.retryAfter };
  }

  await env.PROJECTS.put(key, JSON.stringify({
    status: 'pending',
    pendingAt: new Date(now).toISOString(),
    pendingUntil: now + 60_000,
  }));

  const applicationUrl = `${origin.replace(/\/$/, '')}/apply/`;
  const rulesUrl = `${origin.replace(/\/$/, '')}/about/#squad-rules`;

  try {
    const dm = await discordRequest(env, '/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: userId }),
    });

    await discordRequest(env, `/channels/${encodeURIComponent(dm.id)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        embeds: [{
          title: 'Welcome, Commander — Applicant Path',
          description: 'You selected **🐺 Applicant** for the Regiment of Imperial Mongrels. Here is everything you need to continue.',
          fields: [
            {
              name: 'Next Step',
              value: 'Complete the squad application on our website. There is no time limit, and you can save a draft and return later.',
            },
            {
              name: 'Core Expectations',
              value: '• Mongrels primarily operate in **Open Play**\n• Squad BGS activity must be performed in **Open**\n• Teamwork and respectful conduct are expected\n• Combat logging is prohibited',
            },
            {
              name: 'After You Submit',
              value: 'Leadership will review your application, and you can return to the website to check its status.',
            },
          ],
          footer: { text: 'Regiment of Imperial Mongrels • o7' },
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 5, label: 'Begin Application', url: applicationUrl, emoji: { name: '▶️' } },
            { type: 2, style: 5, label: 'View Squad Rules', url: rulesUrl },
          ],
        }],
      }),
    });

    const sentAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify({ status: 'sent', sentAt }));
    return { status: 'sent', sentAt };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const retryAfter = now + DM_RETRY_MS;
    await env.PROJECTS.put(key, JSON.stringify({
      status: 'failed',
      failedAt,
      retryAfter,
      error: String(error?.message || error).slice(0, 300),
    }));
    return { status: 'failed', failedAt, retryAfter };
  }
}

export async function editDeferredInteraction(interaction, data) {
  const url = `${DISCORD_API}/webhooks/${encodeURIComponent(interaction.application_id)}/${encodeURIComponent(interaction.token)}/messages/@original`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord interaction update failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return response.json();
}

export async function publishOnboardingBundle(env, origin) {
  const config = onboardingConfig(env);
  const channelId = config.welcomeChannelId;

  const selector = await discordRequest(env, `/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      embeds: [{
        title: 'Applicant or Guest?',
        description: 'Choose your path below to continue.',
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 3, custom_id: 'mongrels_onboarding_applicant', label: 'Applicant', emoji: { name: '🐺' } },
          { type: 2, style: 1, custom_id: 'mongrels_onboarding_guest', label: 'Guest', emoji: { name: '🤝' } },
        ],
      }],
    }),
  });

  let ready;
  try {
    ready = await discordRequest(env, `/channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        embeds: [{
          title: 'Ready to Apply?',
          description: 'Selected Applicant? Continue to the squad website to complete your application.',
        }],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: 'Begin Application',
            url: `${origin.replace(/\/$/, '')}/apply/`,
            emoji: { name: '▶️' },
          }],
        }],
      }),
    });
  } catch (error) {
    await deleteDiscordMessage(env, channelId, selector.id).catch(() => {});
    throw error;
  }

  if (env.PROJECTS && typeof env.PROJECTS.get === 'function' && typeof env.PROJECTS.put === 'function') {
    const previous = await readJson(env.PROJECTS, ONBOARDING_BUNDLE_KEY);
    await env.PROJECTS.put(ONBOARDING_BUNDLE_KEY, JSON.stringify({
      selectorMessageId: selector.id,
      readyMessageId: ready.id,
      publishedAt: new Date().toISOString(),
    }));

    if (previous?.selectorMessageId) {
      await deleteDiscordMessage(env, channelId, previous.selectorMessageId).catch(() => {});
    }
    if (previous?.readyMessageId) {
      await deleteDiscordMessage(env, channelId, previous.readyMessageId).catch(() => {});
    }
  }

  return {
    selectorMessageId: selector.id,
    readyMessageId: ready.id,
    channelId,
  };
}

export async function discordRequest(env, path, init = {}) {
  if (!env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not configured');

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bot ${env.DISCORD_BOT_TOKEN}`);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${DISCORD_API}${path}`, { ...init, headers });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord API failed (${response.status}): ${text.slice(0, 700)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function deleteDiscordMessage(env, channelId, messageId) {
  const response = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (response.status === 204 || response.status === 404) return;
  const text = await response.text();
  throw new Error(`Discord message delete failed (${response.status}): ${text.slice(0, 500)}`);
}

async function readJson(namespace, key) {
  try {
    const value = await namespace.get(key, { type: 'json' });
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function hexToBytes(value) {
  if (typeof value !== 'string' || value.length % 2 !== 0) throw new Error('Invalid hex value');
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    const parsed = Number.parseInt(value.slice(i, i + 2), 16);
    if (!Number.isFinite(parsed)) throw new Error('Invalid hex value');
    bytes[i / 2] = parsed;
  }
  return bytes;
}
