import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildSquadEventDiscordPayload,
  eventRsvpCustomId,
  eventRsvpView,
  parseEventRsvpCustomId,
  squadEventsConfig,
} from '../lib/squad-events.js';
import { eventImageExtension, isManagedEventImageKey } from '../lib/event-images.js';

const id='12345678-1234-1234-1234-123456789abc';
assert.equal(eventImageExtension('image/png'),'png');
assert.equal(eventImageExtension('image/jpeg'),'jpg');
assert.equal(eventImageExtension('image/webp'),'webp');
assert.equal(eventImageExtension('image/gif'),'');
assert.equal(isManagedEventImageKey('events/1727112345678-12345678-1234-1234-1234-123456789abc.png'),true);
assert.equal(isManagedEventImageKey('../secrets.png'),false);
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
  eventImageUrl:'https://mongrels-squadron.pages.dev/assets/images/events/mongrel-event.jpg',
  updatedAt:'2026-09-23T16:00:00Z',
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
assert.equal(payload.embeds[0].fields.filter(x=>x.name==='\u200b'&&x.value==='\u200b').length,0);
assert.match(payload.embeds[0].image?.url||'',/^https:\/\/mongrels-squadron\.pages\.dev\/assets\/images\/events\/mongrel-event\.jpg\?v=\d+$/);
assert.match(payload.embeds[0].fields.find(x=>x.name==='🐺 RSVP').value,/✅ \*\*Going\*\* — 1/);
assert.match(payload.embeds[0].fields.find(x=>x.name==='🐺 RSVP').value,/🤔 \*\*Maybe\*\* — 1/);
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
assert.match(eventCore,/embed\.image=\{url:eventImageUrl\}/);
assert.match(eventCore,/discordEmbedImageUrl/);
assert.match(eventCore,/searchParams\.set\('v'/);
assert.doesNotMatch(eventCore,/discordSpacerField/);
assert.match(eventCore,/📅〡squad-events/);
assert.match(eventCore,/squadEventsChannelName/);
assert.match(eventCore,/endsWith\('〡squad-events'\)/);
assert.match(eventCore,/plain squad-events is also accepted/);

const projectApi=readFileSync('functions/api/projects/index.js','utf8');
for(const pattern of [
  /normalizeEventRsvps/,
  /syncSquadEventDiscord/,
  /discordEventMessageId/,
  /eventImageUrl/,
  /eventImageKey/,
  /normalizeEventImageUrl/,
  /normalizeEventImageKey/,
  /deleteManagedEventImage/,
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
  /data-project-image-url/,
  /data-project-image-key/,
  /data-project-image-drop/,
  /project-event-image/,
  /FormData/,
  /EVENT_IMAGE_MAX_BYTES/,
  /prepareEventImage/,
  /deleteTemporaryEventImage/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('projects/index.html','utf8');
assert.match(page,/data-project-image-wrap/);
assert.match(page,/data-project-image-url/);
assert.match(page,/data-project-image-file/);
assert.match(page,/data-project-image-drop/);
assert.match(page,/data-project-image-key/);
assert.match(page,/projects\.js\?v=73/);
assert.match(page,/projects-events-v2\.css\?v=3/);

const imageUpload=readFileSync('functions/api/projects/event-image.js','utf8');
for(const pattern of [
  /EVENT_IMAGES/,
  /request\.formData\(\)/,
  /EVENT_IMAGE_MAX_BYTES/,
  /event_manager_access_required/,
  /project-event-image/,
])assert.match(imageUpload,pattern);

const imageMedia=readFileSync('functions/media/events/[file].js','utf8');
for(const pattern of [
  /EVENT_IMAGES\.get/,
  /Cache-Control/,
  /immutable/,
  /X-Content-Type-Options/,
])assert.match(imageMedia,pattern);

console.log('✓ Squad Events reuse Projects board state and support website + Discord RSVP + R2 image uploads');
