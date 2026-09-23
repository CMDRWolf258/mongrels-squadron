import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildSquadEventDiscordPayload,
  eventRsvpCustomId,
  eventRsvpView,
  parseEventRsvpCustomId,
  squadEventsConfig,
} from '../lib/squad-events.js';

const id='12345678-1234-1234-1234-123456789abc';
assert.deepEqual(parseEventRsvpCustomId(eventRsvpCustomId(id,'going')),{eventId:id,status:'going'});
assert.equal(parseEventRsvpCustomId('mongrels_onboarding_guest'),null);
assert.equal(squadEventsConfig({DISCORD_BOT_TOKEN:'x',DISCORD_SQUAD_EVENTS_CHANNEL_ID:'123'}).configured,true);
assert.equal(squadEventsConfig({DISCORD_BOT_TOKEN:'x'}).configured,false);

const event={
  id,
  kind:'event',
  status:'active',
  title:'Mongrel Training Night',
  description:'Bring a rebuy-safe ship.',
  deadline:'2026-09-26',
  eventTime:'20:00',
  eventType:'Training',
  system:'Diaba',
  ownerName:'CMDR Wolf258',
  rsvps:{
    '1':{status:'going',displayName:'Wolf',updatedAt:'2026-09-23T10:00:00Z'},
    '2':{status:'maybe',displayName:'Lucky',updatedAt:'2026-09-23T10:01:00Z'},
  },
};
const view=eventRsvpView(event,'1');
assert.equal(view.current,'going');
assert.equal(view.counts.going,1);
assert.equal(view.counts.maybe,1);

const payload=buildSquadEventDiscordPayload(event,{origin:'https://mongrels-squadron.pages.dev'});
assert.match(payload.embeds[0].title,/Mongrel Training Night/);
assert.equal(payload.embeds[0].fields.find(x=>x.name==='📍 System / Location')?.inline,false);
assert.equal(payload.embeds[0].fields.find(x=>x.name==='🎯 Event Type')?.inline,true);
assert.equal(payload.embeds[0].fields.find(x=>x.name==='👤 Organizer')?.inline,true);
assert.match(payload.embeds[0].fields.find(x=>x.name==='🐺 RSVP').value,/Going\*\* — 1|Going\*\* — 1/);
assert.match(payload.embeds[0].fields.find(x=>x.name==='🐺 RSVP').value,/Maybe\*\* — 1/);
assert.equal(payload.components[0].components.length,4);
assert.match(payload.components[0].components[0].custom_id,/mongrels_event_rsvp/);
assert.equal(payload.components[0].components[0].disabled,false);

const closed=buildSquadEventDiscordPayload({...event,status:'cancelled'},{origin:'https://mongrels-squadron.pages.dev'});
assert.equal(closed.components[0].components[0].disabled,true);
assert.match(closed.embeds[0].title,/CANCELLED/);

const interaction=readFileSync('functions/api/discord/interactions.js','utf8');
for(const pattern of [
  /parseEventRsvpCustomId/,
  /applyEventRsvp/,
  /isSquadEventInteractionMember/,
  /project event|event RSVP|RSVP/i,
])assert.match(interaction,pattern);

const eventCore=readFileSync('lib/squad-events.js','utf8');
assert.match(eventCore,/cacheTtl\s*:\s*30/);

const projectApi=readFileSync('functions/api/projects/index.js','utf8');
for(const pattern of [
  /normalizeEventRsvps/,
  /syncSquadEventDiscord/,
  /discordEventMessageId/,
  /cancelled/,
])assert.match(projectApi,pattern);

const client=readFileSync('js/projects.js','utf8');
for(const pattern of [
  /api\/projects\/rsvp/,
  /project-event-rsvp/,
  /project-rsvp/,
  /Can.t Make It/,
  /BACKGROUND_REFRESH_MS\s*=\s*5000/,
  /refreshBoardQuietly/,
])assert.match(client,pattern);
new Function(client);

console.log('✓ Squad Events reuse Projects board state and support website + Discord RSVP interactions');
