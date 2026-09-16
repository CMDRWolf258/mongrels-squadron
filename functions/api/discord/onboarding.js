import { json, readSession } from '../../../lib/auth.js';
import { onboardingConfig, publishOnboardingBundle } from '../../../lib/discord-onboarding.js';
import { recruitmentConfig, sendAcceptanceTestDm, sendRecruitmentTestAlert } from '../../../lib/discord-recruitment.js';

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return reply({ ok: false, error: 'authentication_required' }, 401);
  if (session.access !== 'site_admin') return reply({ ok: false, error: 'site_admin_required' }, 403);

  const config = onboardingConfig(env);
  const recruitment = recruitmentConfig(env);
  return reply({
    ok: true,
    botTokenConfigured: Boolean(env.DISCORD_BOT_TOKEN),
    guildConfigured: Boolean(env.GUILD_ID),
    welcomeChannelId: config.welcomeChannelId,
    applicantRoleId: config.applicantRoleId,
    guestRoleId: config.guestRoleId,
    recruitmentChannelId: recruitment.recruitmentChannelId,
    interactionEndpoint: `${new URL(request.url).origin}/api/discord/interactions`,
  });
}

export async function onRequestPost({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return reply({ ok: false, error: 'authentication_required' }, 401);
  if (session.access !== 'site_admin') return reply({ ok: false, error: 'site_admin_required' }, 403);

  const origin = request.headers.get('Origin');
  const expectedOrigin = new URL(request.url).origin;
  if (origin !== expectedOrigin || request.headers.get('X-Mongrels-Request') !== 'discord-onboarding-admin') {
    return reply({ ok: false, error: 'request_validation_failed' }, 403);
  }

  if (!env.DISCORD_BOT_TOKEN) return reply({ ok: false, error: 'discord_bot_token_not_configured' }, 503);
  if (!env.GUILD_ID) return reply({ ok: false, error: 'guild_id_not_configured' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    if (body?.action === 'publish') {
      const result = await publishOnboardingBundle(env, expectedOrigin);
      return reply({ ok: true, ...result });
    }
    if (body?.action === 'test_recruitment_alert') {
      const result = await sendRecruitmentTestAlert(
        env,
        expectedOrigin,
        session.displayName || session.username || 'Site Admin',
      );
      return reply({ ok: true, ...result });
    }
    if (body?.action === 'test_acceptance_dm') {
      const result = await sendAcceptanceTestDm(
        env,
        session.sub,
        expectedOrigin,
        'Wolf258',
      );
      return reply({ ok: true, ...result });
    }
    return reply({ ok: false, error: 'unsupported_action' }, 400);
  } catch (error) {
    const errorCode = body?.action === 'test_recruitment_alert'
      ? 'recruitment_alert_test_failed'
      : body?.action === 'test_acceptance_dm'
        ? 'acceptance_dm_test_failed'
        : 'discord_publish_failed';
    return reply({
      ok: false,
      error: errorCode,
      detail: String(error?.message || error).slice(0, 700),
    }, 502);
  }
}

function reply(data, status = 200) {
  return json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Vary: 'Cookie',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
