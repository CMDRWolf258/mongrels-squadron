import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLine, normalizeProfile, normalizeLibrary, publicDialogueProfile, rarityWeight } from '../lib/carrier-dialogue.js';

assert.equal(rarityWeight('common'),6);
assert.equal(rarityWeight('uncommon'),3);
assert.equal(rarityWeight('rare'),1);

const line=normalizeLine({
  id:'line-1',category:'ambient.concourse',audience:'squadmate',rarity:'rare',enabled:true,
  text:'  Welcome   aboard,   Mongrel.  '
});
assert.deepEqual(line,{
  id:'line-1',category:'ambient.concourse',audience:'squadmate',rarity:'rare',enabled:true,
  text:'Welcome aboard, Mongrel.'
});
assert.equal(normalizeLine({category:'invalid',audience:'all',rarity:'common',text:'Nope'}),null);
assert.equal(normalizeLine({category:'ambient.hangar',audience:'invalid',rarity:'common',text:'Nope'}),null);

const profile=normalizeProfile({
  carrierId:'carrier-1',
  settings:{ambientEnabled:true,hangarMinSeconds:30,hangarMaxSeconds:99999,concourseMinSeconds:120,concourseMaxSeconds:240},
  lines:[line],
},'carrier-1');
assert.equal(profile.settings.hangarMinSeconds,45);
assert.equal(profile.settings.hangarMaxSeconds,2400);
assert.equal(profile.lines.length,1);

const library=normalizeLibrary({profiles:{'carrier-1':profile,'carrier-empty':{carrierId:'carrier-empty',lines:[]}}});
assert.ok(library.profiles['carrier-empty'],'Empty initialized profiles must remain present so deleted starter pools are not silently re-seeded');

const publicProfile=publicDialogueProfile(profile);
assert.equal(publicProfile.lines[0].weight,1);

const manager=readFileSync('carriers/index.html','utf8');
const registryApi=readFileSync('functions/api/carriers/index.js','utf8');
const dialogueApi=readFileSync('functions/api/carriers/dialogue.js','utf8');
const profileApi=readFileSync('functions/api/profiles/index.js','utf8');
const profilesJs=readFileSync('js/profiles.js','utf8');
const manifest=readFileSync('functions/api/hud/manifest.js','utf8');
for(const token of ['Dialogue Manager','data-dialogue-category','ambient.hangar','ambient.concourse','bulletin.concourse','advertisement.concourse','Common · 6×','Rare · 1×','Official Squadron Asset','data-squad-carrier-grid','Member Carrier Directory'])assert.ok(manager.includes(token));
for(const token of ["SQUAD_CARRIER_CALLSIGN = 'R1MM'","SQUAD_CARRIER_NAME = 'Canine Catalyst'","ownershipType:'squad'","squad_carrier_protected","validPersonalCallsign","(carrier.ownershipType||'personal')!=='squad'"])assert.ok(registryApi.includes(token));

const managerJs=readFileSync('js/carriers.js','utf8');
for(const token of ['/api/carriers/dialogue','carrier-dialogue','upsert_line','delete_line','saveDialogueSettings','renderSquadCarrier','OFFICIAL SQUAD CARRIER',"c.ownershipType!=='squad'"])assert.ok(managerJs.includes(token));

const feed=readFileSync('functions/api/hud/feed.js','utf8');
assert.ok(feed.includes('carrierDialogue'));
assert.ok(feed.includes('readCarrierDialogue'));
for(const token of ['ownerSpokenName','spokenName:auth.ownerSpokenName','ownershipType','custodianName'])assert.ok(feed.includes(token),token);
for(const token of ['CANINE_CATALYST_CALLSIGN','CANINE_STARTER_SEED_VERSION','Squad command recognized','Welcome aboard Canine Catalyst','ambient.concourse'])assert.ok(dialogueApi.includes(token),token);
for(const token of ['spokenName','syncSpokenNameToScoutTokens','ownerSpokenName'])assert.ok(profileApi.includes(token),token);
assert.ok(profilesJs.includes('Carrier Spoken Name')&&profilesJs.includes("spokenName:fd.get('spokenName')"));
assert.ok(manifest.includes('spokenName:auth.ownerSpokenName'),'Preferred name must ride the existing HUD viewer manifest token');

const hud=readFileSync('downloads/mongrel-hud/mongrel_hud.py','utf8');
for(const token of ['_shared_dialogue_choice','_ambient_voice_loop','ambient.hangar','bulletin.concourse','advertisement.concourse','concourseVoices','/api/voice-test-concourse','_registered_squad_carrier_match','preferred_name','spokenName'])assert.ok(hud.includes(token));

console.log('✓ Carrier dialogue manager, weighted shared library and HUD ambience wiring are present');
