import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  archiveColonizationJobDiscord,
  buildColonizationJobDiscordPayload,
  syncColonizationJobDiscord,
} from '../lib/colonization-discord.js';

class MemoryKv {
  constructor(){this.map=new Map();}
  async get(key,{type}={}){
    const value=this.map.get(key);
    if(value===undefined)return null;
    return type==='json'?(typeof value==='string'?JSON.parse(value):value):value;
  }
  async put(key,value){this.map.set(key,String(value));}
  async list(){return{keys:[],list_complete:true};}
}

const env={
  DAILY_ORDERS:new MemoryKv(),
  DISCORD_OPERATIONS_WEBHOOK_URL:'https://discord.com/api/webhooks/'+'1234567890/'+'colonization_unit_test',
};
const base={
  id:'job-1',
  title:'Finish Eleven\'s Lighthouse',
  system:'NGC 2546 Sector UZ-G d10-16',
  scope:'market',
  marketId:'12345',
  buildName:'Eleven\'s Lighthouse',
  commodity:'',
  targetTons:10000,
  rewardBlockTons:500,
  rewardBlockMillions:10,
  personalCapMillions:null,
  status:'active',
  startsAt:'2026-09-22T12:00:00.000Z',
  updatedAt:'2026-09-22T13:00:00.000Z',
  revision:1,
  notes:'Finish the remaining construction materials.',
};
const view={
  ...base,
  squadTons:2548,
  contributorCount:1,
  ambiguousEvents:0,
  lastContributionAt:'2026-09-22T14:00:00.000Z',
  members:[
    {commander:'DarthDivider',tons:1872,lastContributionAt:'2026-09-22T14:00:00.000Z'},
  ],
};

const payload=buildColonizationJobDiscordPayload(view,{controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs'});
assert.match(payload.embeds[0].title,/Eleven's Lighthouse/);
assert.equal(payload.embeds[0].fields.find(row=>row.name==='Status')?.value,'ACTIVE');
assert.match(payload.embeds[0].fields.find(row=>row.name==='Progress')?.value,/2,548 t \/ 10,000 t/);
assert.match(payload.embeds[0].fields.find(row=>row.name==='Progress')?.value,/7,452 t remaining/);
assert.match(payload.embeds[0].fields.find(row=>row.name==='Verified Contributors')?.value,/DarthDivider — 1,872 t/);
assert.equal(payload.embeds[0].timestamp,'2026-09-22T14:00:00.000Z');

const originalFetch=globalThis.fetch;
const requests=[];
let messageId='555555';
globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  requests.push({url:String(url),method:options.method,body});
  if(options.method==='POST')return Response.json({id:messageId},{status:200});
  if(options.method==='PATCH'){
    const id=String(url).match(/\/messages\/(\d+)/)?.[1]||messageId;
    return Response.json({id},{status:200});
  }
  return new Response(null,{status:204});
};

try{
  const first=await syncColonizationJobDiscord(env,{job:base,view,createMissing:true});
  assert.equal(first.mode,'created');
  assert.equal(requests.length,1);
  assert.equal(requests[0].method,'POST');
  assert.deepEqual(requests[0].body.allowed_mentions,{parse:[]});

  const unchanged=await syncColonizationJobDiscord(env,{job:base,view,createMissing:false});
  assert.equal(unchanged.mode,'unchanged');
  assert.equal(requests.length,1,'An unchanged Frontier sync must not call Discord');

  const progressedView={
    ...view,
    squadTons:3200,
    contributorCount:2,
    lastContributionAt:'2026-09-22T15:00:00.000Z',
    members:[
      ...view.members,
      {commander:'SecondScout',tons:652,lastContributionAt:'2026-09-22T15:00:00.000Z'},
    ],
  };
  const progressed=await syncColonizationJobDiscord(env,{job:base,view:progressedView,createMissing:false});
  assert.equal(progressed.mode,'edited');
  assert.equal(requests[1].method,'PATCH');
  assert.match(requests[1].url,/\/messages\/555555/);
  assert.match(requests[1].body.embeds[0].fields.find(row=>row.name==='Progress')?.value,/3,200 t/);

  const completedJob={...base,status:'completed',endsAt:'2026-09-22T16:00:00.000Z',updatedAt:'2026-09-22T16:00:00.000Z',revision:2};
  const completed=await syncColonizationJobDiscord(env,{
    job:completedJob,
    view:{...progressedView,...completedJob},
    createMissing:false,
  });
  assert.equal(completed.mode,'edited');
  assert.equal(requests[2].method,'PATCH');
  assert.match(requests[2].body.embeds[0].title,/^✓ /);
  assert.equal(requests[2].body.embeds[0].fields.find(row=>row.name==='Status')?.value,'COMPLETED');

  const removed=await archiveColonizationJobDiscord(env,{job:completedJob,actor:'Wolf'});
  assert.equal(removed.mode,'removed');
  assert.equal(requests[3].method,'PATCH');
  assert.match(requests[3].body.embeds[0].title,/Colonization Job Removed/);

  env.DISCORD_OPERATIONS_WEBHOOK_URL='https://discord.com/api/webhooks/'+'9876543210/'+'new_channel_unit_test';
  const untrackedDestination=await syncColonizationJobDiscord(env,{job:base,view,createMissing:false});
  assert.equal(untrackedDestination.mode,'not_tracked');
  assert.equal(requests.length,4,'Changing webhook destination must not silently create legacy job messages during Frontier sync');

  messageId='666666';
  const manualSeed=await syncColonizationJobDiscord(env,{job:base,view,createMissing:true});
  assert.equal(manualSeed.mode,'created');
  assert.equal(requests[4].method,'POST');
}finally{
  globalThis.fetch=originalFetch;
}

const state=JSON.parse(env.DAILY_ORDERS.map.get('discord-colonization-jobs-v1'));
assert.equal(state.jobs['job-1'].messageId,'666666');

const mutationApi=readFileSync('functions/api/operations/colonization-jobs.js','utf8');
for(const pattern of [
  /syncColonizationJobDiscord/,
  /archiveColonizationJobDiscord/,
  /createMissing:action==='create'/,
  /discord,/,
])assert.match(mutationApi,pattern);

const frontierSync=readFileSync('functions/api/frontier/sync.js','utf8');
for(const pattern of [
  /syncAllColonizationJobsDiscord/,
  /hasNewColonizationActivity/,
  /colonizationDiscordRefreshTriggered/,
  /createMissing:false/,
])assert.match(frontierSync,pattern);

const manualApi=readFileSync('functions/api/operations/discord-colonization-jobs.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /X-Mongrels-Request/,
  /wolf-bgs-control/,
  /syncAllColonizationJobsDiscord/,
  /createMissing:true/,
])assert.match(manualApi,pattern);

const discordClient=readFileSync('js/wolf-bgs-discord.js','utf8');
for(const pattern of [
  /data-discord-sync-colonization/,
  /discord-colonization-jobs/,
  /Syncing current Colonization Jobs/,
])assert.match(discordClient,pattern);

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/data-discord-sync-colonization/);
assert.match(page,/id="colonization-jobs"/);
assert.match(page,/wolf-bgs-discord\.js\?v=3/);
assert.match(page,/wolf-bgs-colonization\.js\?v=11/);

console.log('✓ Colonization Jobs post once, update progress/status in place, skip unchanged syncs, and archive the same Discord message');
