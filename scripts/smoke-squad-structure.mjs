import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  defaultSquadStructureState,
  normalizeSquadStructureUpdate,
  squadStructureView,
} from '../lib/squad-structure.js';
import {
  buildSquadStructureDiscordPayload,
  squadStructureDiscordConfig,
} from '../lib/squad-structure-discord.js';

const initial=defaultSquadStructureState();
const view=squadStructureView(initial);
assert.equal(view.command.find(x=>x.id==='admiral')?.holder,'CMDR Wolf258');
assert.equal(view.command.find(x=>x.id==='vice-admiral')?.holder,'CMDR D1scoT1ts');
assert.equal(view.captains.find(x=>x.id==='anti-xeno')?.holder,'CMDR Lennyshow');
assert.equal(view.captains.find(x=>x.id==='combat')?.holder,'');
assert.equal(view.fieldLeadership.find(x=>x.id==='second-lieutenant')?.assignments.length,2);
assert.equal(view.specialists.find(x=>x.id==='specialist-1')?.holder,'CMDR Daisy Huck');
assert.equal(view.pilotRanks.find(x=>x.id==='pilot')?.count,15);

const updated=normalizeSquadStructureUpdate({
  command:{admiral:'CMDR Test'},
  captains:{combat:'CMDR Fighter'},
  fieldLeadership:{lieutenant:[{name:'CMDR Lead',focus:'Testing'}]},
  specialists:{'specialist-1':{holder:'CMDR Specialist',focus:'Combat'}},
  rankCounts:{pilot:9999,recruit:-5},
},initial);
const updatedView=squadStructureView(updated);
assert.equal(updatedView.command.find(x=>x.id==='admiral')?.holder,'CMDR Test');
assert.equal(updatedView.captains.find(x=>x.id==='combat')?.holder,'CMDR Fighter');
assert.equal(updatedView.command.find(x=>x.id==='admiral')?.description,view.command.find(x=>x.id==='admiral')?.description);
assert.equal(updatedView.pilotRanks.find(x=>x.id==='pilot')?.count,999);
assert.equal(updatedView.pilotRanks.find(x=>x.id==='recruit')?.count,0);

assert.equal(squadStructureDiscordConfig({DISCORD_BOT_TOKEN:'x',GUILD_ID:'guild'}).configured,true);
assert.equal(squadStructureDiscordConfig({DISCORD_BOT_TOKEN:'x'}).configured,false);

const payload=buildSquadStructureDiscordPayload(initial,{origin:'https://mongrels-squadron.pages.dev'});
assert.equal(payload.embeds.length,4);
assert.match(payload.embeds[0].title,/Regiment Command/);
assert.match(payload.embeds[1].title,/Captain Corps/);
assert.match(payload.embeds[2].title,/Specialist Corps/);
assert.match(payload.embeds[3].title,/Pilot Rank Progression/);
assert.equal(payload.components[0].components[0].url,'https://mongrels-squadron.pages.dev/about/#structure');
assert.deepEqual(payload.allowed_mentions,{parse:[]});
assert.ok(payload.embeds.every(embed=>(embed.fields||[]).length<=25));

const embedChars=payload.embeds.reduce((total,embed)=>{
  total+=String(embed.title||'').length+String(embed.description||'').length+String(embed.footer?.text||'').length;
  for(const field of embed.fields||[])total+=String(field.name||'').length+String(field.value||'').length;
  return total;
},0);
assert.ok(embedChars<6000,'Squad Structure Discord embeds must stay under 6000 total characters');

const api=readFileSync('functions/api/squad-structure/index.js','utf8');
for(const pattern of [
  /site_admin_access_required/,
  /squad-structure-editor/,
  /normalizeSquadStructureUpdate/,
  /syncSquadStructureDiscord/,
  /writeSquadStructure/,
])assert.match(api,pattern);

const discord=readFileSync('lib/squad-structure-discord.js','utf8');
for(const pattern of [
  /🏛️〡squad-structure/,
  /squadStructureChannelName/,
  /plain squad-structure is also accepted/,
  /DISCORD_SQUAD_STRUCTURE_CHANNEL_ID/,
  /View Full Squad Structure/,
  /Regiment Command/,
  /Captain Corps/,
  /Pilot Rank Progression/,
  /method:'PATCH'/,
])assert.match(discord,pattern);

const client=readFileSync('js/squad-structure.js','utf8');
for(const pattern of [
  /data-squad-structure/,
  /data-structure-form/,
  /Save & Sync Discord/,
  /Sync Discord Only/,
  /api\/squad-structure/,
  /location\.hash===\'#ranks\'/,
  /Target channel: 🏛️〡squad-structure/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('about/index.html','utf8');
assert.match(page,/data-squad-structure/);
assert.match(page,/data-squad-structure-admin/);
assert.match(page,/squad-structure\.js\?v=3/);
assert.match(page,/squad-structure-admin\.css\?v=1/);
assert.doesNotMatch(page,/CMDR Lennyshow/);

const assistant=readFileSync('lib/assistant-context.js','utf8');
assert.match(assistant,/readSquadStructure/);
assert.match(assistant,/squadStructureView/);
assert.match(assistant,/id:'squad-structure'/);
assert.doesNotMatch(assistant,/\{ rank: 'Captain', commander: 'CMDR Lennyshow'/);

console.log('✓ Squad Structure uses one website source and a persistent four-embed Discord presentation');
