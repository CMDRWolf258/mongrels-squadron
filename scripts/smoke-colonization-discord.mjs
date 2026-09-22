import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildColonizationJobDiscordPayload,
  buildColonizationSummaryDiscordPayload,
  syncAllColonizationJobsDiscord,
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
  async delete(key){this.map.delete(key);}
  async list({prefix=''}={}){
    return{
      keys:[...this.map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),
      list_complete:true,
    };
  }
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

const pausedView={
  ...base,
  id:'job-2',
  title:'Paused Build',
  system:'Diaba',
  status:'paused',
  targetTons:0,
  squadTons:900,
  contributorCount:1,
  members:[],
};
const historicalCompleted={...base,id:'job-old',title:'Old Completed Job',status:'completed'};
const summaryPayload=buildColonizationSummaryDiscordPayload([view,pausedView,historicalCompleted],{
  controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
});
assert.equal(summaryPayload.embeds[0].title,'Colonization Operations');
assert.match(summaryPayload.embeds[0].fields[0].value,/1 active · 1 paused · 3,448 t verified hauling/);
const summaryJobs=summaryPayload.embeds[0].fields.filter(row=>/Active \/ Paused Jobs/.test(row.name)).map(row=>row.value).join('\n');
assert.match(summaryJobs,/Eleven/);
assert.match(summaryJobs,/Paused Build/);
assert.doesNotMatch(summaryJobs,/Old Completed Job/,'Completed jobs must not appear in the operational summary');

const originalFetch=globalThis.fetch;
const requests=[];
let nextId=555555;
globalThis.fetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;
  requests.push({url:String(url),method:options.method,body});
  if(options.method==='POST')return Response.json({id:String(nextId++)},{status:200});
  if(options.method==='PATCH'){
    const id=String(url).match(/\/messages\/(\d+)/)?.[1]||String(nextId);
    return Response.json({id},{status:200});
  }
  if(options.method==='DELETE')return new Response(null,{status:204});
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

  const completedJob={...base,status:'completed',endsAt:'2026-09-22T16:00:00.000Z',updatedAt:'2026-09-22T16:00:00.000Z',revision:2};
  const completed=await syncColonizationJobDiscord(env,{
    job:completedJob,
    view:{...progressedView,...completedJob},
    createMissing:false,
  });
  assert.equal(completed.mode,'edited');
  assert.equal(completed.status,'completed');
  assert.equal(requests[2].method,'PATCH');
  assert.match(requests[2].body.embeds[0].title,/^✓ /);
  assert.match(requests[2].body.embeds[0].description,/leave the operations channel on the next Colonization sync/);

  const newActive={
    ...base,
    id:'job-2',
    title:'Rival Monkeys Foundry',
    system:'NGC 2546 Sector UZ-G d10-16',
    marketId:'67890',
    status:'active',
    targetTons:20000,
    updatedAt:'2026-09-22T16:30:00.000Z',
  };
  const oldCompleted={
    ...base,
    id:'job-old',
    title:'Already Finished Before Discord',
    status:'completed',
    updatedAt:'2026-09-20T12:00:00.000Z',
  };
  env.DAILY_ORDERS.map.set('colonization-jobs-v1',JSON.stringify({
    version:1,
    jobs:[completedJob,newActive,oldCompleted],
    updatedAt:'2026-09-22T16:30:00.000Z',
    updatedBy:'Wolf',
  }));

  const beforeManual=requests.length;
  const manual=await syncAllColonizationJobsDiscord(env,{
    actor:'Wolf',
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
    createMissing:true,
  });
  const manualRequests=requests.slice(beforeManual);
  assert.equal(manual.summary?.mode,'created','The persistent Colonization summary should be seeded once');
  assert.equal(manual.deleted,1,'The previously shown completed card should be removed on the next sync');
  assert.equal(manual.created,1,'Only the active untracked job should receive a new individual card');
  assert.equal(manualRequests.filter(row=>row.method==='DELETE').length,1);
  assert.match(manualRequests.find(row=>row.method==='DELETE')?.url||'',/\/messages\/555555/);
  assert.equal(
    manualRequests.filter(row=>row.method==='POST').length,
    2,
    'Manual migration should post one summary plus one untracked active job, never the historical completed job',
  );
  assert.ok(!manual.results.some(row=>row.jobId==='job-old'),'Historical completed jobs must remain website-only');

  const stateAfterManual=JSON.parse(env.DAILY_ORDERS.map.get('discord-colonization-jobs-v1'));
  assert.ok(stateAfterManual.summary?.messageId,'Persistent Colonization summary message ID was not stored');
  assert.equal(stateAfterManual.jobs['job-1'],undefined,'Completed job tracking should be removed after Discord cleanup');
  assert.ok(stateAfterManual.jobs['job-2']?.messageId,'Active job should remain tracked');

  const beforeNoop=requests.length;
  const noop=await syncAllColonizationJobsDiscord(env,{
    actor:'Wolf',
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
    createMissing:true,
  });
  assert.equal(noop.summary?.mode,'unchanged');
  assert.equal(noop.unchanged,1);
  assert.equal(requests.length,beforeNoop,'A fully unchanged Colonization sync should make zero Discord requests');

  env.DISCORD_OPERATIONS_WEBHOOK_URL='https://discord.com/api/webhooks/'+'9876543210/'+'new_channel_unit_test';
  const completedInNewDestination=await syncColonizationJobDiscord(env,{job:oldCompleted,view:oldCompleted,createMissing:true});
  assert.equal(completedInNewDestination.mode,'completed_untracked','Completed historical jobs must not seed into a new webhook destination');
  assert.equal(requests.length,beforeNoop);
}finally{
  globalThis.fetch=originalFetch;
}

const mutationApi=readFileSync('functions/api/operations/colonization-jobs.js','utf8');
for(const pattern of [
  /syncColonizationMutationDiscord/,
  /action,/,
  /removedJob,/,
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
  /completed\/removed card/,
  /operations summary/,
])assert.match(discordClient,pattern);

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/data-discord-sync-colonization/);
assert.match(page,/id="colonization-jobs"/);

console.log('✓ Colonization Discord keeps active cards, shows completion once, cleans completed cards on the next sync, and maintains one persistent operations summary');
