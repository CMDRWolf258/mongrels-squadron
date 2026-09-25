import {
  applyOnboardingChoice,
  editDeferredInteraction,
  isEstablishedMember,
  sendApplicantWelcomeOnce,
  verifyDiscordInteraction,
} from '../../../lib/discord-onboarding.js';
import {
  applyEventRsvp,
  isSquadEventInteractionMember,
  parseEventRsvpCustomId,
} from '../../../lib/squad-events.js';
import { getMemberPursuitIds, setMemberPursuits } from '../../../lib/mongrel-pursuits.js';
import {
  PURSUITS_MANAGE_CUSTOM_ID,
  PURSUITS_SELECT_CUSTOM_ID,
  buildMemberPursuitSelector,
  syncMemberPursuitRoles,
} from '../../../lib/mongrel-pursuits-discord.js';
import {
  readEscortRequests,
  setEscortResponse,
  writeEscortRequests,
} from '../../../lib/combat-escort.js';
import {
  parseEscortInteractionCustomId,
  syncCombatEscortDiscord,
} from '../../../lib/combat-escort-discord.js';
import {
  hasTradeAlertSubscription,
  isTradeRouteActive,
  readTradeRoutes,
  toggleTradeAlertSubscription,
  writeTradeRoutes,
} from '../../../lib/trade-intelligence.js';
import {
  applyTradeDiscordState,
  parseTradeAlertCustomId,
  syncTradeDiscord,
  tradeAlertActionCustomId,
} from '../../../lib/trade-discord.js';

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
  const eventRsvp = parseEventRsvpCustomId(customId);
  if (eventRsvp) {
    return handleEventRsvpInteraction(context, interaction, eventRsvp);
  }

  const tradeAlert = parseTradeAlertCustomId(customId);
  if (tradeAlert) {
    return handleTradeAlertInteraction(context, interaction, tradeAlert);
  }

  if (customId === PURSUITS_MANAGE_CUSTOM_ID) {
    return handlePursuitsManager(context, interaction);
  }
  if (customId === PURSUITS_SELECT_CUSTOM_ID) {
    return handlePursuitsInteraction(context, interaction);
  }

  const escortAction = parseEscortInteractionCustomId(customId);
  if (escortAction) {
    return handleEscortInteraction(context, interaction, escortAction);
  }

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

async function handleTradeAlertInteraction(context, interaction, tradeAlert) {
  const { request, env } = context;
  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  const guildId = interaction?.guild_id || '';

  if (!userId || !guildId) {
    return response({ type:4, data:{ content:'Trade alerts can only be changed inside the Mongrels Discord server.', flags:EPHEMERAL } });
  }
  if (env.GUILD_ID && guildId !== env.GUILD_ID) {
    return response({ type:4, data:{ content:'This Trade Alert control is not configured for this server.', flags:EPHEMERAL } });
  }
  if (!isSquadEventInteractionMember(interaction, env)) {
    return response({ type:4, data:{ content:'Trader’s Outpost alerts are available to recognized Mongrel members.', flags:EPHEMERAL } });
  }

  const user = interaction?.member?.user || interaction?.user || {};
  const displayName = interaction?.member?.nick || user.global_name || user.username || 'Commander';
  const origin = new URL(request.url).origin;
  const work = handleTradeAlertSettings({
    interaction,
    env,
    routeId:tradeAlert.routeId,
    action:tradeAlert.action||'settings',
    userId,
    displayName,
    origin,
  });
  if (typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;
  return response({ type:5, data:{ flags:EPHEMERAL } });
}

async function handleTradeAlertSettings({ interaction, env, routeId, action='settings', userId, displayName, origin }) {
  try {
    const items = await readTradeRoutes(env);
    const index = items.findIndex(item => String(item?.id) === String(routeId));
    if (index < 0) {
      await editDeferredInteraction(interaction, { content:'That Trader’s Outpost post could not be found.', components:[] });
      return;
    }

    const route = items[index];
    if (!isTradeRouteActive(route)) {
      await editDeferredInteraction(interaction, { content:'That trade post is no longer active, so its alert subscription is closed.', components:[] });
      return;
    }

    let subscribed=await hasTradeAlertSubscription(env,{routeId,userId});
    const wantsEnabled=action==='enable'?true:action==='disable'?false:null;
    let changed=false;

    if(wantsEnabled!==null&&wantsEnabled!==subscribed){
      const result=await toggleTradeAlertSubscription(env,{routeId,userId,displayName});
      subscribed=result.subscribed;
      changed=true;
    }

    let note='';
    if(changed){
      const discord=await syncTradeDiscord(env,{route,origin});
      applyTradeDiscordState(route,discord);
      items[index]=route;
      await writeTradeRoutes(env,items);
      if(!discord.ok){
        note='\n\nYour alert setting was saved, but the shared Discord card could not refresh its watcher count right now.';
      }
    }

    await editDeferredInteraction(interaction,{
      content:subscribed
        ?'🔔 **Alerts Enabled ✓**\nYou are watching this specific trade post and will receive its configured trigger alerts.'+note
        :'🔕 **Alerts Disabled**\nYou are not currently subscribed to alerts for this trade post.'+note,
      components:[{
        type:1,
        components:[{
          type:2,
          style:subscribed?4:3,
          custom_id:tradeAlertActionCustomId(routeId,subscribed?'disable':'enable'),
          label:subscribed?'Disable Alerts':'Enable Alerts',
          emoji:{name:subscribed?'🔕':'🔔'},
        }],
      }],
    });
  } catch (error) {
    await editDeferredInteraction(interaction,{
      content:`I couldn't open those trade alert settings. Please try again.\n\nTechnical detail: ${safeError(error)}`,
      components:[],
    }).catch(()=>{});
  }
}

async function handlePursuitsManager(context, interaction) {
  const { env } = context;
  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  const guildId = interaction?.guild_id || '';

  if (!userId || !guildId) {
    return response({ type: 4, data: { content: 'Mongrel Pursuits can only be changed inside the Mongrels Discord server.', flags: EPHEMERAL } });
  }
  if (env.GUILD_ID && guildId !== env.GUILD_ID) {
    return response({ type: 4, data: { content: 'This Pursuits control is not configured for this server.', flags: EPHEMERAL } });
  }
  if (!isSquadEventInteractionMember(interaction, env)) {
    return response({ type: 4, data: { content: 'Mongrel Pursuits are available to recognized squadron members.', flags: EPHEMERAL } });
  }

  try {
    const selected = await getMemberPursuitIds(env, userId, { profileFallback:true });
    return response({
      type: 4,
      data: {
        ...buildMemberPursuitSelector(selected),
        flags: EPHEMERAL,
      },
    });
  } catch (error) {
    return response({
      type: 4,
      data: {
        content: `I couldn't open your Mongrel Pursuits selector. Please try again or use the website.\n\nTechnical detail: ${safeError(error)}`,
        flags: EPHEMERAL,
      },
    });
  }
}

async function handlePursuitsInteraction(context, interaction) {
  const { env } = context;
  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  const guildId = interaction?.guild_id || '';

  if (!userId || !guildId) {
    return response({ type: 4, data: { content: 'Mongrel Pursuits can only be changed inside the Mongrels Discord server.', flags: EPHEMERAL } });
  }
  if (env.GUILD_ID && guildId !== env.GUILD_ID) {
    return response({ type: 4, data: { content: 'This Pursuits selector is not configured for this server.', flags: EPHEMERAL } });
  }
  if (!isSquadEventInteractionMember(interaction, env)) {
    return response({ type: 4, data: { content: 'Mongrel Pursuits are available to recognized squadron members.', flags: EPHEMERAL } });
  }

  const values = Array.isArray(interaction?.data?.values) ? interaction.data.values : [];
  const user = interaction?.member?.user || interaction?.user || {};
  const displayName = interaction?.member?.nick || user.global_name || user.username || 'Commander';
  const work = handlePursuitsSelection({ interaction, env, userId, displayName, pursuits: values });
  if (typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;
  return response({ type: 5, data: { flags: EPHEMERAL } });
}

async function handlePursuitsSelection({ interaction, env, userId, displayName, pursuits }) {
  try {
    const saved = await setMemberPursuits(env, { ownerId:userId, displayName, pursuits, source:'discord' });
    const roleSync = await syncMemberPursuitRoles(env, {
      userId,
      pursuits:saved.member.pursuits,
      state:saved.state,
      currentRoleIds:Array.isArray(interaction?.member?.roles)?interaction.member.roles:null,
    });
    const count = saved.member.pursuits.length;
    const note = roleSync.ok
      ? ''
      : '\n\nYour interests were saved, but Discord role synchronization needs attention. The website record is still correct.';
    await editDeferredInteraction(interaction, {
      content: `🐺 **Mongrel Pursuits updated.** ${count ? `${count} pursuit${count===1?'':'s'} selected` : 'No pursuits selected'}.${note}`,
      components: [],
    });
  } catch (error) {
    await editDeferredInteraction(interaction, {
      content: `I couldn't update your Mongrel Pursuits. Please try again or use the website.\n\nTechnical detail: ${safeError(error)}`,
      components: [],
    }).catch(() => {});
  }
}

async function handleEscortInteraction(context, interaction, escortAction) {
  const { request, env } = context;
  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  const guildId = interaction?.guild_id || '';

  if (!userId || !guildId) {
    return response({ type: 4, data: { content: 'Combat Escort responses can only be changed inside the Mongrels Discord server.', flags: EPHEMERAL } });
  }
  if (env.GUILD_ID && guildId !== env.GUILD_ID) {
    return response({ type: 4, data: { content: 'This Combat Escort control is not configured for this server.', flags: EPHEMERAL } });
  }
  if (!isSquadEventInteractionMember(interaction, env)) {
    return response({ type: 4, data: { content: 'Combat Escort responses are available to recognized squadron members.', flags: EPHEMERAL } });
  }

  const user = interaction?.member?.user || interaction?.user || {};
  const displayName = interaction?.member?.nick || user.global_name || user.username || 'Commander';
  const origin = new URL(request.url).origin;
  const work = handleEscortResponse({
    interaction,
    env,
    id:escortAction.id,
    state:escortAction.action,
    userId,
    displayName,
    origin,
  });
  if (typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;
  return response({ type: 5, data: { flags: EPHEMERAL } });
}

async function handleEscortResponse({ interaction, env, id, state, userId, displayName, origin }) {
  try {
    const items = await readEscortRequests(env);
    const index = items.findIndex(item => item.id === id);
    if (index < 0) {
      await editDeferredInteraction(interaction, { content:'That Combat Escort request could not be found.', components:[] });
      return;
    }

    let item;
    try {
      item = setEscortResponse(items[index], { userId, displayName, state });
    } catch (error) {
      const code = String(error?.message || '');
      const message = code === 'escort_request_closed'
        ? 'That Combat Escort request is already closed.'
        : code === 'requester_cannot_respond'
          ? 'You created this request, so you do not need to volunteer as your own escort.'
          : 'Your Combat Escort response could not be recorded.';
      await editDeferredInteraction(interaction, { content:message, components:[] });
      return;
    }

    items[index] = item;
    await writeEscortRequests(env, items);
    const discord = await syncCombatEscortDiscord(env, { request:item, origin });
    item.discord = {
      ...item.discord,
      messageId:discord.messageId || item.discord?.messageId || '',
      channelId:discord.channelId || item.discord?.channelId || '',
      lastSyncedAt:discord.lastSyncedAt || item.discord?.lastSyncedAt || '',
      lastError:discord.ok ? '' : (discord.error || ''),
    };
    items[index] = item;
    await writeEscortRequests(env, items);

    const labels = {
      available:'🛡️ I Can Help',
      on_my_way:'🚀 On My Way',
      withdraw:'↩️ Stood Down',
    };
    const note = discord.ok === false
      ? '\n\nYour response was saved, but the public Escort card could not refresh right now.'
      : '';
    await editDeferredInteraction(interaction, {
      content:'Combat Escort response updated: **'+(labels[state]||state)+'**.'+note,
      components:[],
    });
  } catch (error) {
    await editDeferredInteraction(interaction, {
      content:`I couldn't update that Combat Escort request. Please try again or use the website.\n\nTechnical detail: ${safeError(error)}`,
      components:[],
    }).catch(()=>{});
  }
}

async function handleEventRsvpInteraction(context, interaction, eventRsvp) {
  const { request, env } = context;
  const userId = interaction?.member?.user?.id || interaction?.user?.id || '';
  const guildId = interaction?.guild_id || '';

  if (!userId || !guildId) {
    return response({
      type: 4,
      data: { content: 'This RSVP button can only be used inside the Mongrels Discord server.', flags: EPHEMERAL },
    });
  }

  if (env.GUILD_ID && guildId !== env.GUILD_ID) {
    return response({
      type: 4,
      data: { content: 'This event button is not configured for this server.', flags: EPHEMERAL },
    });
  }

  if (!isSquadEventInteractionMember(interaction, env)) {
    return response({
      type: 4,
      data: { content: 'Squad Event RSVPs are available to recognized Mongrel members.', flags: EPHEMERAL },
    });
  }

  const user = interaction?.member?.user || interaction?.user || {};
  const displayName = interaction?.member?.nick || user.global_name || user.username || 'Commander';
  const origin = new URL(request.url).origin;
  const work = handleEventRsvp({
    interaction,
    env,
    eventId: eventRsvp.eventId,
    status: eventRsvp.status,
    userId,
    displayName,
    origin,
  });
  if (typeof context.waitUntil === 'function') context.waitUntil(work);
  else await work;

  return response({ type: 5, data: { flags: EPHEMERAL } });
}

async function handleEventRsvp({ interaction, env, eventId, status, userId, displayName, origin }) {
  try {
    const result = await applyEventRsvp(env, {
      eventId,
      status,
      userId,
      displayName,
      origin,
    });

    if (!result.ok) {
      const message = result.mode === 'event_rsvp_closed'
        ? 'This event is no longer accepting RSVPs.'
        : result.mode === 'event_not_found'
          ? 'That Squad Event could not be found.'
          : 'Your RSVP could not be recorded.';
      await editDeferredInteraction(interaction, { content: message, components: [] });
      return;
    }

    const labels = {
      going: '✅ Going',
      maybe: '🤔 Maybe',
      cant: '❌ Can’t Make It',
    };
    const discordNote = result.discord?.ok === false
      ? '\n\nYour RSVP was saved, but the event card could not refresh right now.'
      : '';
    await editDeferredInteraction(interaction, {
      content: `RSVP updated: **${labels[status] || status}**.${discordNote}`,
      components: [],
    });
  } catch (error) {
    await editDeferredInteraction(interaction, {
      content: `I couldn't update your event RSVP. Please try again or use the website.\n\nTechnical detail: ${safeError(error)}`,
      components: [],
    }).catch(() => {});
  }
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
