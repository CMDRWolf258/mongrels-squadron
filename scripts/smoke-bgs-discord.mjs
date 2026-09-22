import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBgsDiscordView, buildBgsSummaryDiscordPayload } from '../lib/bgs-discord.js';

const faction=(active=[],pending=[])=>({name:'Regiment of Imperial Mongrels',activeStates:active,pendingStates:pending,state:active[0]||'None',updatedAt:'2026-09-22T20:00:00Z'});
const live={systems:[
 {name:'Retreat System',present:true,activeStates:['Retreat'],pendingStates:[],sourceUpdated:'2026-09-22T20:00:00Z'},
 {name:'War System',present:true,activeStates:['War'],pendingStates:[],sourceUpdated:'2026-09-22T20:00:00Z'},
 {name:'Market System',present:true,activeStates:['Boom','Civil Liberty'],pendingStates:['Pirate Attack'],sourceUpdated:'2026-09-22T20:00:00Z'},
]};
const boards={systems:[
 {name:'Retreat System',factions:[faction(['Retreat'])]},
 {name:'War System',factions:[faction(['War'])],conflict:{opponentFaction:'Test Opposition',factionWonDays:2,opponentWonDays:1,type:'War',status:'Active',updatedAt:'2026-09-22T20:00:00Z'}},
 {name:'Market System',factions:[faction(['Boom','Civil Liberty'],['Pirate Attack'])]},
]};
const view=buildBgsDiscordView({live,boards,scouts:{systems:{}}});
assert.equal(view.actions.length,2);
assert.ok(view.actions.some(x=>x.family==='retreat'&&x.phase==='active'));
assert.ok(view.actions.some(x=>x.family==='conflict'&&x.detail==='War'));
assert.equal(view.opportunities.length,1);
assert.deepEqual(view.opportunities[0].states.map(x=>x.state),['Pirate Attack','Boom','Civil Liberty']);
const payload=buildBgsSummaryDiscordPayload(view,{missionControlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#faction-alerts'});
const text=JSON.stringify(payload);
for(const pattern of [/BGS Alerts & Opportunities/,/Retreat System/,/War System/,/Boom/,/Civil Liberty/,/Pirate Attack/])assert.match(text,pattern);

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
