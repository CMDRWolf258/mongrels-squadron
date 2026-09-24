import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createEscortRequest,
  escortResponseSummary,
  setEscortResponse,
  setEscortStatus,
  updateEscortRequest,
} from '../lib/combat-escort.js';
import {
  buildCombatEscortDiscordPayload,
  buildCombatEscortLauncherPayload,
  escortInteractionCustomId,
  parseEscortInteractionCustomId,
} from '../lib/combat-escort-discord.js';
import { MONGREL_PURSUITS, pursuitIdsFromLabels, pursuitLabels } from '../lib/mongrel-pursuits.js';

const cz=MONGREL_PURSUITS.find(item=>item.id==='combat-zones');
assert.ok(cz);
assert.equal(cz.label,'Conflict Zones');
assert.ok(cz.aliases.includes('Combat Zones'));
assert.deepEqual(pursuitIdsFromLabels(['Combat Zones','Conflict Zones','CZ']),['combat-zones']);
assert.deepEqual(pursuitLabels(['combat-zones']),['Conflict Zones']);

const request=createEscortRequest({
  title:'Protect the hauler',
  system:'Diaba',
  destination:'King\'s Mountain View',
  objective:'Escort a cargo run through hostile traffic.',
  timing:'Now',
  urgency:'priority',
  notes:'Wing beacon on after launch.',
},{ownerId:'owner-1',ownerName:'CMDR Wolf258'});

assert.equal(request.status,'open');
assert.equal(request.system,'Diaba');
assert.equal(request.urgency,'priority');
assert.equal(request.ownerId,'owner-1');

let updated=setEscortResponse(request,{userId:'escort-1',displayName:'CMDR Lenny',state:'available'});
assert.equal(escortResponseSummary(updated,'escort-1').current,'available');
assert.equal(escortResponseSummary(updated).available[0],'CMDR Lenny');

updated=setEscortResponse(updated,{userId:'escort-1',displayName:'CMDR Lenny',state:'on_my_way'});
assert.equal(escortResponseSummary(updated,'escort-1').current,'on_my_way');
assert.equal(escortResponseSummary(updated).onMyWay[0],'CMDR Lenny');

updated=setEscortResponse(updated,{userId:'escort-1',displayName:'CMDR Lenny',state:'withdraw'});
assert.equal(escortResponseSummary(updated).total,0);

assert.throws(
  ()=>setEscortResponse(request,{userId:'owner-1',displayName:'Wolf',state:'available'}),
  /requester_cannot_respond/
);

const edited=updateEscortRequest(request,{timing:'15 minutes',urgency:'immediate'});
assert.equal(edited.timing,'15 minutes');
assert.equal(edited.urgency,'immediate');

const completed=setEscortStatus(edited,'complete',{actorName:'Wolf'});
assert.equal(completed.status,'complete');
assert.ok(completed.closedAt);
assert.throws(()=>setEscortResponse(completed,{userId:'escort-2',displayName:'CMDR Two',state:'available'}),/escort_request_closed/);

const custom=escortInteractionCustomId(request.id,'on_my_way');
assert.deepEqual(parseEscortInteractionCustomId(custom),{id:request.id,action:'on_my_way'});

const payload=buildCombatEscortDiscordPayload({
  ...request,
  responses:{
    'escort-1':{state:'on_my_way',displayName:'CMDR Lenny',updatedAt:new Date().toISOString()},
    'escort-2':{state:'available',displayName:'CMDR Two',updatedAt:new Date().toISOString()},
  },
},{origin:'https://mongrels-squadron.pages.dev'});
assert.equal(payload.embeds.length,1);
assert.match(payload.embeds[0].title,/Protect the hauler/);
assert.match(payload.embeds[0].description,/OPEN/);
assert.equal(payload.components[0].components.length,5);
assert.match(payload.components[0].components[0].custom_id,/mongrels_escort:/);
assert.equal(payload.components[0].components[3].label,'New Escort Request');
assert.match(payload.components[0].components[3].url,/\/escort\/#request-form$/);
assert.equal(payload.components[0].components[4].label,'Open Escort Network');
assert.match(payload.components[0].components[4].url,/\/escort\/$/);
assert.match(payload.embeds[0].fields.find(field=>field.name==='Responders').value,/CMDR Lenny/);
assert.match(payload.embeds[0].fields.find(field=>field.name==='Responders').value,/CMDR Two/);

const closedPayload=buildCombatEscortDiscordPayload(completed,{origin:'https://mongrels-squadron.pages.dev'});
assert.equal(closedPayload.components.length,1);
assert.equal(closedPayload.components[0].components.length,2);
assert.equal(closedPayload.components[0].components[0].label,'New Escort Request');
assert.equal(closedPayload.components[0].components[1].label,'Open Escort Network');
assert.match(closedPayload.embeds[0].description,/COMPLETE/);

const launcher=buildCombatEscortLauncherPayload({origin:'https://mongrels-squadron.pages.dev'});
assert.match(launcher.embeds[0].title,/Combat Escort Network/);
assert.equal(launcher.components[0].components[0].label,'New Escort Request');
assert.match(launcher.components[0].components[0].url,/\/escort\/#request-form$/);
assert.equal(launcher.components[0].components[1].label,'Open Escort Network');

const api=readFileSync('functions/api/combat-escort/index.js','utf8');
for(const pattern of [
  /mongrels-combat-escort/,
  /createEscortRequest/,
  /setEscortResponse/,
  /setEscortStatus/,
  /syncCombatEscortDiscord/,
  /escort_request_manage_required/,
])assert.match(api,pattern);

const interactions=readFileSync('functions/api/discord/interactions.js','utf8');
for(const pattern of [
  /parseEscortInteractionCustomId/,
  /handleEscortInteraction/,
  /handleEscortResponse/,
  /syncCombatEscortDiscord/,
])assert.match(interactions,pattern);

const discord=readFileSync('lib/combat-escort-discord.js','utf8');
for(const pattern of [
  /combat-escort-requests/,
  /I Can Help/,
  /On My Way/,
  /Stand Down/,
  /New Escort Request/,
  /Open Escort Network/,
  /combat-escort-discord-launcher-v1/,
  /\/pins\//,
  /Pin Messages permission/,
  /allowed_mentions/,
])assert.match(discord,pattern);

const client=readFileSync('js/combat-escort.js','utf8');
new Function(client);
for(const pattern of [
  /\/api\/combat-escort/,
  /Post Escort Request|Posting escort request/,
  /data-escort-action/,
  /on_my_way/,
  /complete/,
  /cancel/,
  /#request-form/,
  /scrollIntoView/,
  /launcherWarning/,
  /pinWarning/,
])assert.match(client,pattern);

const page=readFileSync('escort/index.html','utf8');
for(const pattern of [
  /Combat Escort Network/,
  /data-escort-form/,
  /data-escort-board/,
  /id="request-form"/,
  /return=%2Fescort%2F%23request-form/,
  /combat-escort\.js\?v=2/,
  /combat-escort\.css\?v=2/,
])assert.match(page,pattern);

const portal=readFileSync('member/index.html','utf8');
assert.match(portal,/id="combat-escort-network"/);
assert.match(portal,/href="\.\.\/escort\/"/);
assert.equal((portal.match(/id="mongrel-pursuits"/g)||[]).length,1);

const pursuitsDiscord=readFileSync('lib/mongrel-pursuits-discord.js','utf8');
assert.match(pursuitsDiscord,/legacyNames/);
assert.match(pursuitsDiscord,/method:'PATCH'/);

console.log('✓ Combat Escort Network and Conflict Zones Pursuit migration are structurally sound');
