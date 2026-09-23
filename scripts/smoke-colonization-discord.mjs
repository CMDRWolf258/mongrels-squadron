import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildColonizationArchiveDiscordPayload,
  buildColonizationJobDiscordPayload,
  buildColonizationSummaryDiscordPayload,
  syncAllColonizationJobsDiscord,
  syncAllCompletedColonizationArchiveDiscord,
  syncColonizationArchiveJobDiscord,
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
  DISCORD_OPERATIONS_WEBHOOK_URL:'https://discord.com/api/webhooks/'+'1234567890/'+'system_testing_unit_test',
  DISCORD_COLONIZATION_JOBS_WEBHOOK_URL:'https://discord.com/api/webhooks/'+'3141592653/'+'colonization_jobs_unit_test',
  DISCORD_COLONIZATION_ARCHIVE_WEBHOOK_URL:'https://discord.com/api/webhooks/'+'2468135790/'+'colonization_archive_unit_test',
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
assert.equal(summaryPayload.embeds[0].title,'Colonization Jobs');
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
  assert.match(requests[0].url,/\/api\/webhooks\/3141592653\//,'Live Colonization cards must use the dedicated Colonization Jobs webhook');
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
  const archivePayload=buildColonizationArchiveDiscordPayload({...progressedView,...completedJob},{
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
  });
  assert.match(archivePayload.embeds[0].title,/^✓ COLONIZATION COMPLETE ·/);
  assert.equal(archivePayload.embeds[0].fields.find(row=>row.name==='Final Status')?.value,'COMPLETED');
  assert.match(archivePayload.embeds[0].fields.find(row=>row.name==='Verified Hauling')?.value,/3,200 t \/ 10,000 t/);
  assert.match(archivePayload.embeds[0].fields.find(row=>row.name==='Verified Contributors')?.value,/DarthDivider/);
  assert.match(archivePayload.embeds[0].footer.text,/Colonization Archive/);

  const completed=await syncColonizationJobDiscord(env,{
    job:completedJob,
    view:{...progressedView,...completedJob},
    createMissing:false,
  });
  assert.equal(completed.mode,'edited');
  assert.equal(completed.status,'completed');
  assert.equal(requests[2].method,'PATCH');
  assert.match(requests[2].body.embeds[0].title,/^✓ /);
  assert.match(requests[2].body.embeds[0].description,/leave this channel on the next Colonization sync/);

  const beforeArchive=requests.length;
  const archived=await syncColonizationArchiveJobDiscord(env,{
    job:completedJob,
    view:{...progressedView,...completedJob},
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
  });
  assert.equal(archived.mode,'archived');
  assert.equal(requests.length,beforeArchive+1);
  assert.equal(requests.at(-1).method,'POST');
  assert.match(requests.at(-1).url,/\/api\/webhooks\/2468135790\//,'Archive post must use the separate archive webhook');
  assert.match(requests.at(-1).body.embeds[0].title,/COLONIZATION COMPLETE/);
  assert.deepEqual(requests.at(-1).body.allowed_mentions,{parse:[]});

  const beforeArchiveNoop=requests.length;
  const archivedAgain=await syncColonizationArchiveJobDiscord(env,{
    job:completedJob,
    view:{...progressedView,...completedJob},
  });
  assert.equal(archivedAgain.mode,'already_archived');
  assert.equal(requests.length,beforeArchiveNoop,'Completed job must never duplicate its permanent archive post');


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

  env.DAILY_ORDERS.map.set('discord-colonization-jobs-v1',JSON.stringify({
    version:2,
    summary:{
      messageId:'600001',
      webhookId:'1234567890',
      fingerprint:'legacy-summary',
      lastSyncedAt:'2026-09-22T16:00:00.000Z',
      lastMode:'edited',
    },
    jobs:{
      'job-1':{
        messageId:'600002',
        webhookId:'1234567890',
        fingerprint:'legacy-completed',
        status:'completed',
        title:completedJob.title,
        system:completedJob.system,
        lastSyncedAt:'2026-09-22T16:00:00.000Z',
        lastMode:'edited',
        removed:false,
      },
    },
  }));

  const beforeManual=requests.length;
  const manual=await syncAllColonizationJobsDiscord(env,{
    actor:'Wolf',
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
    createMissing:true,
  });
  const manualRequests=requests.slice(beforeManual);
  assert.equal(manual.summary?.mode,'created','The persistent Colonization Jobs summary should be seeded once');
  assert.equal(manual.deleted,0,'Legacy tracked cards are removed during migration before normal live-card cleanup begins');
  assert.equal(manual.created,1,'Only the active untracked job should receive a new individual card');
  const legacyDeletes=manualRequests.filter(row=>row.method==='DELETE');
  assert.equal(legacyDeletes.length,2,'Legacy System Testing summary/card must be removed before Colonization Jobs seeds');
  assert.ok(legacyDeletes.every(row=>row.url.includes('/api/webhooks/1234567890/')),'Legacy Colonization cleanup must use the System Testing webhook');
  const dedicatedPosts=manualRequests.filter(row=>row.method==='POST');
  assert.equal(
    dedicatedPosts.length,
    2,
    'Manual migration should post one summary plus one untracked active job, never the historical completed job',
  );
  assert.ok(dedicatedPosts.every(row=>row.url.includes('/api/webhooks/3141592653/')),'All live Colonization posts must use the dedicated Colonization Jobs webhook');
  assert.ok(!manual.results.some(row=>row.jobId==='job-old'),'Historical completed jobs must remain website-only');

  const beforeArchiveBackfill=requests.length;
  const archiveBackfill=await syncAllCompletedColonizationArchiveDiscord(env,{
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
  });
  assert.equal(archiveBackfill.completedJobs,2);
  assert.equal(archiveBackfill.archived,1,'Historical completed job should be backfilled exactly once');
  assert.equal(archiveBackfill.alreadyArchived,1,'Already archived completion must remain deduplicated');
  assert.equal(requests.length,beforeArchiveBackfill+1);
  assert.match(requests.at(-1).body.embeds[0].title,/Already Finished Before Discord/);

  const beforeArchiveBackfillNoop=requests.length;
  const archiveBackfillNoop=await syncAllCompletedColonizationArchiveDiscord(env,{
    controlUrl:'https://mongrels-squadron.pages.dev/wolf-bgs/#colonization-jobs',
  });
  assert.equal(archiveBackfillNoop.archived,0);
  assert.equal(archiveBackfillNoop.alreadyArchived,2);
  assert.equal(requests.length,beforeArchiveBackfillNoop,'Repeated archive backfill must make zero Discord requests');

  const archiveState=JSON.parse(env.DAILY_ORDERS.map.get('discord-colonization-archive-v1'));
  assert.ok(archiveState.jobs['job-1']?.messageId);
  assert.ok(archiveState.jobs['job-old']?.messageId);

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

  env.DISCORD_COLONIZATION_ARCHIVE_WEBHOOK_URL='https://discord.com/api/webhooks/'+'1357924680/'+'new_archive_channel_unit_test';
  const beforeArchiveWebhookChange=requests.length;
  const archivedAfterWebhookChange=await syncColonizationArchiveJobDiscord(env,{job:completedJob,view:{...progressedView,...completedJob}});
  assert.equal(archivedAfterWebhookChange.mode,'already_archived','Changing archive destination must not duplicate permanent history');
  assert.equal(requests.length,beforeArchiveWebhookChange);

  env.DISCORD_COLONIZATION_JOBS_WEBHOOK_URL='https://discord.com/api/webhooks/'+'9876543210/'+'new_colonization_jobs_channel_unit_test';
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

const archiveApi=readFileSync('functions/api/operations/discord-colonization-archive.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /discordColonizationArchiveConfigured/,
  /syncAllCompletedColonizationArchiveDiscord/,
  /wolf-bgs-control/,
])assert.match(archiveApi,pattern);

const manualApi=readFileSync('functions/api/operations/discord-colonization-jobs.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /X-Mongrels-Request/,
  /wolf-bgs-control/,
  /syncAllColonizationJobsDiscord/,
  /createMissing:true/,
  /discordColonizationJobsConfigured/,
])assert.match(manualApi,pattern);

const discordClient=readFileSync('js/wolf-bgs-discord.js','utf8');
for(const pattern of [
  /data-discord-sync-colonization/,
  /data-discord-sync-colonization-archive/,
  /discord-colonization-jobs/,
  /discord-colonization-archive/,
  /completed\/removed card/,
  /Colonization summary/,
])assert.match(discordClient,pattern);

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/data-discord-sync-colonization/);
assert.match(page,/data-discord-sync-colonization-archive/);
assert.match(page,/id="colonization-jobs"/);

console.log('✓ Colonization Jobs keeps active cards, shows completion once, cleans completed cards on the next sync, and maintains one persistent live summary');
console.log('✓ Colonization Jobs migrates tracked System Testing messages into its dedicated webhook without duplicates');
console.log('✓ Colonization Archive posts completed jobs once to a separate webhook, backfills safely, and suppresses duplicates across retries or webhook changes');
