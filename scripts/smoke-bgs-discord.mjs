import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBgsActionDiscordPayload, buildBgsDiscordView, buildBgsSummaryDiscordPayload } from '../lib/bgs-discord.js';

const faction=(active=[],pending=[],updatedAt='2026-09-22T20:00:00Z')=>({name:'Regiment of Imperial Mongrels',activeStates:active,pendingStates:pending,state:active[0]||'None',updatedAt});
const live={systems:[
 {name:'Retreat System',present:true,activeStates:['Retreat'],pendingStates:[],sourceUpdated:'2026-09-22T20:00:00Z'},
 {name:'War System',present:true,activeStates:['War'],pendingStates:[],sourceUpdated:'2026-09-22T20:00:00Z'},
 {name:'Market System',present:true,activeStates:['Boom','Civil Liberty'],pendingStates:['Pirate Attack'],sourceUpdated:'2026-09-22T20:00:00Z'},
]};
const boards={systems:{
 'Retreat System':{name:'Retreat System',factions:[faction(['Retreat'])]},
 'War System':{name:'War System',factions:[faction(['War'],[],'2026-09-20T20:00:00Z')],conflict:{opponentFaction:'Test Opposition',factionWonDays:2,opponentWonDays:1,type:'War',status:'Active',updatedAt:'2026-09-20T20:00:00Z'}},
 'Market System':{name:'Market System',factions:[faction(['Boom','Civil Liberty'],['Pirate Attack'])]},
}};
const view=buildBgsDiscordView({live,boards,scouts:{systems:{}},now:new Date('2026-09-23T00:10:00Z')});
assert.equal(view.actions.length,2);
assert.ok(view.actions.some(x=>x.family==='retreat'&&x.phase==='active'));
assert.ok(view.actions.some(x=>x.family==='conflict'&&x.detail==='War'));
assert.equal(view.actions.find(x=>x.system==='War System')?.opponent,'Test Opposition','Object-shaped full board must supply conflict opponent');
assert.equal(view.actions.find(x=>x.system==='War System')?.score?.ours,2,'Object-shaped full board must supply conflict score');
assert.equal(view.actions.find(x=>x.system==='War System')?.dataFresh,false,'Old conflict state must be marked stale against the current tick-aware cycle');
assert.equal(view.actions.find(x=>x.system==='Retreat System')?.dataFresh,true,'Same-cycle state should remain current');
const staleActionPayload=buildBgsActionDiscordPayload(view.actions.find(x=>x.system==='War System'),{missionControlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#faction-alerts'});
const staleActionText=JSON.stringify(staleActionPayload);
for(const pattern of [/STALE STATE DATA/,/STALE DATA · SCOUTING NEEDED/,/Live Scout/,/Last state observation/])assert.match(staleActionText,pattern);

assert.equal(view.opportunities.length,1);
assert.deepEqual(view.opportunities[0].states.map(x=>x.state),['Pirate Attack','Boom','Civil Liberty']);
const payload=buildBgsSummaryDiscordPayload(view,{missionControlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#faction-alerts'});
const text=JSON.stringify(payload);
for(const pattern of [/BGS Alerts & Opportunities/,/Retreat System/,/War System/,/Boom/,/Civil Liberty/,/Pirate Attack/])assert.match(text,pattern);
assert.match(text,/STALE · SCOUT NEEDED/,'Persistent BGS summary must flag stale operational state data');

const ingest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
assert.match(ingest,/syncBgsDiscordBoard/);
const scheduled=readFileSync('functions/api/internal/scout-discord-refresh.js','utf8');
assert.match(scheduled,/bgsDiscord/);
const manual=readFileSync('functions/api/operations/discord-bgs-alerts.js','utf8');
assert.match(manual,/createMissing:true/);
const ui=readFileSync('js/wolf-bgs-discord.js','utf8');
assert.match(ui,/data-discord-sync-bgs/);
const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/Sync BGS Alerts/);
assert.match(page,/wolf-bgs-discord\.js\?v=7/);
const bgsApi=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
assert.match(bgsApi,/activeDetail = find\(active, value => value === 'retreat'\)/);

console.log('✓ BGS Discord separates Retreat/conflict action cards from silent trade/combat opportunity states');
console.log('✓ BGS Discord uses tick-aware freshness and warns when stale state data needs Live Scout verification');
