import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildBgsActionDiscordPayload,
  buildBgsDiscordView,
  buildBgsSummaryDiscordPayload,
  syncBgsDiscordBoard,
} from '../lib/bgs-discord.js';

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
for(const pattern of [/Faction Alerts & Opportunities/,/Retreat System/,/War System/,/Boom/,/Civil Liberty/,/Pirate Attack/])assert.match(text,pattern);
assert.match(text,/STALE · SCOUT NEEDED/,'Persistent BGS summary must flag stale operational state data');

class MemoryKv{
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));}
  async get(key,{type}={}){const value=this.map.get(key);if(value===undefined)return null;return type==='json'?JSON.parse(value):value;}
  async put(key,value){this.map.set(key,String(value));}
}
const operationsWebhook='https://discord.com/api/webhooks/1234567890/operations_unit_test';
const factionWebhook='https://discord.com/api/webhooks/2468135790/faction_alerts_unit_test';
const env={
  DAILY_ORDERS:new MemoryKv({
    'discord-bgs-alerts-v1':{
      version:1,
      summary:{messageId:'700001',webhookId:'1234567890',fingerprint:'old-summary'},
      actionCards:{
        'retreat system::retreat':{system:'Retreat System',family:'retreat',detail:'Retreat',messageId:'700002',webhookId:'1234567890',fingerprint:'old-retreat',phase:'operational'},
      },
    },
  }),
  DISCORD_OPERATIONS_WEBHOOK_URL:operationsWebhook,
  DISCORD_FACTION_ALERTS_WEBHOOK_URL:factionWebhook,
};
const originalFetch=globalThis.fetch;
const requests=[];
let nextId=800001;
globalThis.fetch=async(url,options)=>{
  requests.push({url:String(url),method:options.method,body:options.body?JSON.parse(options.body):null});
  if(options.method==='DELETE')return new Response(null,{status:204});
  if(options.method==='POST')return Response.json({id:String(nextId++)},{status:200});
  if(options.method==='PATCH'){
    const id=String(url).match(/\/messages\/(\d+)/)?.[1]||String(nextId);
    return Response.json({id},{status:200});
  }
  return new Response(null,{status:204});
};
try{
  const migrated=await syncBgsDiscordBoard(env,{
    view,
    missionControlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#faction-alerts',
    createMissing:true,
  });
  assert.equal(migrated.summary.mode,'created');
  assert.equal(migrated.created,2,'Both live Retreat and conflict cards should seed into Faction Alerts');
  const deletes=requests.filter(row=>row.method==='DELETE');
  assert.equal(deletes.length,2,'Legacy Operations summary/card must be removed before Faction Alerts seeds');
  assert.ok(deletes.every(row=>row.url.includes('/api/webhooks/1234567890/')),'Legacy cleanup must use the Operations webhook');
  const posts=requests.filter(row=>row.method==='POST');
  assert.equal(posts.length,3,'Dedicated channel should receive one summary plus two action cards');
  assert.ok(posts.every(row=>row.url.includes('/api/webhooks/2468135790/')),'All new Faction Alerts posts must use the dedicated webhook');
  assert.match(JSON.stringify(posts[0].body),/Faction Alerts & Opportunities/);

  const state=JSON.parse(env.DAILY_ORDERS.map.get('discord-bgs-alerts-v1'));
  assert.equal(state.summary.webhookId,'2468135790');
  assert.ok(Object.values(state.actionCards).every(row=>row.webhookId==='2468135790'));

  const beforeNoop=requests.length;
  const noop=await syncBgsDiscordBoard(env,{
    view,
    missionControlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#faction-alerts',
    createMissing:false,
  });
  assert.equal(noop.summary.mode,'unchanged');
  assert.equal(noop.unchanged,2);
  assert.equal(requests.length,beforeNoop,'Unchanged dedicated Faction Alerts refresh must make zero Discord requests');
}finally{
  globalThis.fetch=originalFetch;
}


const ingest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
assert.match(ingest,/syncBgsDiscordBoard/);
const scheduled=readFileSync('functions/api/internal/scout-discord-refresh.js','utf8');
assert.match(scheduled,/bgsDiscord/);
const manual=readFileSync('functions/api/operations/discord-bgs-alerts.js','utf8');
assert.match(manual,/createMissing:true/);
assert.match(manual,/discordFactionAlertsConfigured/);
const ui=readFileSync('js/wolf-bgs-discord.js','utf8');
assert.match(ui,/data-discord-sync-bgs/);
const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/Sync Faction Alerts/);
assert.match(page,/wolf-bgs-discord\.js\?v=12/);
const bgsApi=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
assert.match(bgsApi,/activeDetail = find\(active, value => value === 'retreat'\)/);

console.log('✓ BGS Discord separates Retreat/conflict action cards from silent trade/combat opportunity states');
console.log('✓ BGS Discord uses tick-aware freshness and warns when stale state data needs Live Scout verification');
console.log('✓ Faction Alerts migrates tracked Operations messages into its dedicated webhook without duplicates');
