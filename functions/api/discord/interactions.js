import {
  applyOnboardingChoice,
  editDeferredInteraction,
  isEstablishedMember,
  sendApplicantWelcomeOnce,
  verifyDiscordInteraction,
} from '../../../lib/discord-onboarding.js';

const APPLICANT_CUSTOM_ID = 'mongrels_onboarding_applicant';
const GUEST_CUSTOM_ID = 'mongrels_onboarding_guest';
const EPHEMERAL = 1 << 6;

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody = await request.text();
  const valid = await verifyDiscordInteraction(request, rawBody, env);
  if (!valid) return new Response('invalid request signature', { status: 401 });

  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  // Discord endpoint verification ping.
  if (interaction.type === 1) {
    return response({ type: 1 });
  }

  if (interaction.type !== 3) {
    return response({
      type: 4,
      data: { content: 'This interaction is not supported.', flags: EPHEMERAL },
    });
  }

  const customId = interaction?.data?.custom_id;
  const choice = customId === APPLICANT_CUSTOM_ID
    ? 'applicant'
    : customId === GUEST_CUSTOM_ID
      ? 'guest'
      : null;

  if (!choice) {
    return response({
      type: 4,
      data: { content: 'This onboarding button is no longer recognized.', flags: EPHEMERAL },
    });
  }

  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  const guildId = interaction?.guild_id || '';
  if (!userId || !guildId) {
    return response({
      type: 4,
      data: { content: 'This button can only be used inside the Mongrels Discord server.', flags: EPHEMERAL },
    });
  }

  if (env.GUILD_ID && guildId !== env.GUILD_ID) {
    return response({
      type: 4,
      data: { content: 'This onboarding button is not configured for this server.', flags: EPHEMERAL },
    });
  }

  if (isEstablishedMember(interaction, env)) {
    return response({
      type: 4,
      data: {
        content: 'You are already recognized as a Mongrel member, so no Applicant or Guest role was changed.',
        flags: EPHEMERAL,
      },
    });
  }

  const origin = new URL(request.url).origin;
  const work = handleChoice({ interaction, env, guildId, userId, choice, origin });
  if (typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;

  return response({ type: 5, data: { flags: EPHEMERAL } });
}

export function onRequestGet() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

async function handleChoice({ interaction, env, guildId, userId, choice, origin }) {
  try {
    await applyOnboardingChoice(env, guildId, userId, choice);

    if (choice === 'guest') {
      await editDeferredInteraction(interaction, {
        content: '🤝 **Guest selected.** Your Guest access is ready, and the Applicant role has been removed if you had it.',
        components: [],
      });
      return;
    }

    const dm = await sendApplicantWelcomeOnce(env, userId, origin);
    let dmNote;
    switch (dm.status) {
      case 'sent':
        dmNote = 'I also sent you a private welcome message with the application link and next steps.';
        break;
      case 'already_sent':
        dmNote = 'Your Applicant welcome message was already sent previously, so I did not send another one.';
        break;
      case 'pending':
        dmNote = 'Your Applicant welcome message is already being processed.';
        break;
      case 'cooldown':
        dmNote = 'A recent DM attempt could not be delivered, so I did not retry it yet. You can continue with the button below.';
        break;
      case 'failed':
        dmNote = 'I could not deliver the private welcome message. You can still continue normally with the button below.';
        break;
      default:
        dmNote = 'The private welcome message is temporarily unavailable, but you can continue normally with the button below.';
    }

    await editDeferredInteraction(interaction, {
      content: `🐺 **Applicant selected.** Your Applicant role is ready. ${dmNote}`,
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
    });
  } catch (error) {
    try {
      await editDeferredInteraction(interaction, {
        content: `I couldn't update your onboarding role. Please contact a Mongrel officer.\n\nTechnical detail: ${safeError(error)}`,
        components: [],
      });
    } catch {
      // Discord may have expired the interaction token; nothing more can be surfaced here.
    }
  }
}

function safeError(error) {
  return String(error?.message || error || 'Unknown error').replace(/`/g, "'").slice(0, 350);
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
