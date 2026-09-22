import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildScoutSummaryDiscordPayload,
  selectScoutDiscordBoard,
  syncScoutDiscordBoard,
} from '../lib/scout-discord.js';

function fakeKv(seed={}){
  const map=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  return{
    map,
    async get(key,{type}={}){
      const value=map.get(key);
      if(value===undefined)return null;
      return type==='json'?JSON.parse(value):value;
    },
    async put(key,value){map.set(key,String(value));},
    async delete(key){map.delete(key);},
    async list({prefix=''}={}){return{keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};},
  };
}

const reward=(bonus=0,reason='')=>({
  baseMillions:5,
  bonusMillions:bonus,
  totalMillions:5+bonus,
  bonusReason:reason,
  bonusOnce:true,
});
const ordinary=Array.from({length:20},(_,index)=>{
  const n=index+1;
  return{
    system:'Ordinary '+String(n).padStart(2,'0'),
    status:'available',
    dataFresh:false,
    enabled:true,
    coords:{x:n,y:0,z:0},
    reward:reward(),
    latestScoutAt:null,
  };
});
const priorityA={
  system:'Priority Alpha',
  status:'available',
  dataFresh:false,
  enabled:true,
  coords:{x:30,y:0,z:0},
  reward:reward(20,'Expansion watch'),
  latestScoutAt:'2026-09-21T18:00:00.000Z',
  claim:null,
};
const priorityB={
  system:'Priority Bravo',
  status:'available',
  dataFresh:false,
  enabled:true,
  coords:{x:40,y:0,z:0},
  reward:reward(10,'Conflict watch'),
  latestScoutAt:'2026-09-21T17:00:00.000Z',
  claim:null,
};
const diaba={
  system:'Diaba',
  status:'fresh',
  dataFresh:true,
  enabled:true,
  coords:{x:0,y:0,z:0},
  reward:reward(),
  latestScoutAt:'2026-09-22T20:00:00.000Z',
};
const board={
  jobs:[diaba,priorityB,...ordinary.slice().reverse(),priorityA],
  summary:{available:22,claimed:0,fresh:1,priority:2,coordinates:23},
};

const selection=selectScoutDiscordBoard(board,{originSystem:'Diaba',ordinaryLimit:15});
assert.equal(selection.priority.length,2,'All current priority Scout Jobs should be retained');
assert.equal(selection.ordinary.length,15,'Ordinary Discord scouting list must be capped at 15');
assert.deepEqual(
  selection.ordinary.map(job=>job.system),
  ordinary.slice(0,15).map(job=>job.system),
  'Ordinary needs-scouting systems must be chosen by distance from Diaba',
);
assert.equal(selection.ordinary[0].distanceFromOrigin,1);
assert.equal(selection.ordinary[14].distanceFromOrigin,15);

const summaryPayload=buildScoutSummaryDiscordPayload(selection,{
  scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
  setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
});
const summaryText=JSON.stringify(summaryPayload);
assert.match(summaryText,/LIVE SCOUT REQUIRED/);
assert.match(summaryText,/Setup directions/);
assert.match(summaryText,/Priority Alpha/);
assert.match(summaryText,/Priority Bravo/);
assert.match(summaryText,/Ordinary 01/);
assert.match(summaryText,/Ordinary 15/);
assert.doesNotMatch(summaryText,/Ordinary 16/);
assert.match(summaryText,/Diaba/);

const env={
  DAILY_ORDERS:fakeKv(),
  DISCORD_OPERATIONS_WEBHOOK_URL:'https://discord.com/api/webhooks/'+'1234567890/'+'scout_discord_unit_test',
};
const requests=[];
let nextId=700001;
const originalFetch=globalThis.fetch;
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
  const first=await syncScoutDiscordBoard(env,{
    board,
    scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
    setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
    createMissing:true,
    originSystem:'Diaba',
    ordinaryLimit:15,
  });
  assert.equal(first.summary.mode,'created');
  assert.equal(first.created,2,'Only priority Scout Jobs should receive individual cards');
  assert.equal(first.displayedPriority,2);
  assert.equal(first.displayedOrdinary,15);
  assert.equal(requests.filter(row=>row.method==='POST').length,3,'Expected one summary plus two priority cards');
  assert.ok(
    requests.filter(row=>row.method==='POST').every(row=>row.body.allowed_mentions?.parse?.length===0),
    'Scout Discord messages must suppress mentions',
  );

  const requestCountAfterFirst=requests.length;
  const unchanged=await syncScoutDiscordBoard(env,{
    board,
    scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
    setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
    createMissing:true,
  });
  assert.equal(unchanged.summary.mode,'unchanged');
  assert.equal(unchanged.unchanged,2);
  assert.equal(requests.length,requestCountAfterFirst,'Unchanged Scout board must make zero Discord requests');

  const claimedBoard={
    ...board,
    jobs:board.jobs.map(job=>job.system==='Priority Alpha'?{
      ...job,
      status:'claimed',
      claim:{commander:'CMDR ScoutOne',expiresAt:'2026-09-22T23:30:00.000Z'},
    }:job),
  };
  const beforeClaim=requests.length;
  const claimed=await syncScoutDiscordBoard(env,{
    board:claimedBoard,
    scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
    setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
    createMissing:false,
  });
  assert.equal(claimed.summary.mode,'edited');
  assert.equal(claimed.edited,1,'Claim should edit the matching priority card');
  assert.equal(requests.length-beforeClaim,2,'Claim should PATCH the summary and matching priority card only');
  assert.equal(requests.slice(beforeClaim).filter(row=>row.method==='PATCH').length,2);
  assert.match(JSON.stringify(requests.slice(beforeClaim).map(row=>row.body)),/CMDR ScoutOne/);

  const completedBoard={
    ...claimedBoard,
    jobs:claimedBoard.jobs.map(job=>job.system==='Priority Alpha'?{
      ...job,
      status:'fresh',
      dataFresh:true,
      reward:reward(),
      claim:null,
      latestScoutAt:'2026-09-22T23:05:00.000Z',
    }:job),
  };
  const beforeCompletion=requests.length;
  const completion=await syncScoutDiscordBoard(env,{
    board:completedBoard,
    scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
    setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
    createMissing:false,
  });
  assert.equal(completion.summary.mode,'edited');
  assert.equal(completion.completionShown,1,'A completed priority job should show completion once');
  assert.equal(requests.length-beforeCompletion,2,'Completion should update summary and the completed priority card');
  assert.match(JSON.stringify(requests.slice(beforeCompletion).map(row=>row.body)),/SCOUTED/);
  assert.match(JSON.stringify(requests.slice(beforeCompletion).map(row=>row.body)),/leave the operations channel on the next Scout sync/);

  const beforeCleanup=requests.length;
  const cleanup=await syncScoutDiscordBoard(env,{
    board:completedBoard,
    scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
    setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
    createMissing:false,
  });
  assert.equal(cleanup.summary.mode,'unchanged');
  assert.equal(cleanup.deleted,1);
  assert.equal(requests.length-beforeCleanup,1);
  assert.equal(requests.at(-1).method,'DELETE','Completed priority card should be deleted on the next Scout sync');

  const state=JSON.parse(env.DAILY_ORDERS.map.get('discord-scout-jobs-v1'));
  assert.ok(state.summary?.messageId,'Persistent Scout Operations summary should be tracked');
  assert.equal(state.priorityCards['priority alpha'],undefined,'Completed priority card should leave tracked operations state');
  assert.ok(state.priorityCards['priority bravo']?.messageId,'Still-active priority card should remain tracked');

  const nextCycleBoard={
    ...completedBoard,
    jobs:completedBoard.jobs.map(job=>job.system==='Priority Alpha'?{
      ...priorityA,
      latestScoutAt:'2026-09-22T23:05:00.000Z',
    }:job),
  };
  const beforeReopen=requests.length;
  const reopened=await syncScoutDiscordBoard(env,{
    board:nextCycleBoard,
    scoutBoardUrl:'https://mongrels-squadron.pages.dev/scout-jobs/',
    setupUrl:'https://mongrels-squadron.pages.dev/member/?section=live-scout-setup#live-scout-setup',
    createMissing:false,
  });
  assert.equal(reopened.created,1,'A recurring priority job should automatically regain its card after the Scout board has been seeded');
  assert.equal(requests.length-beforeReopen,2,'Recurring priority return should update summary and create the returning priority card');
  assert.equal(requests.slice(beforeReopen).filter(row=>row.method==='POST').length,1);
}finally{
  globalThis.fetch=originalFetch;
}

const scheduledEndpoint=readFileSync('functions/api/internal/scout-discord-refresh.js','utf8');
for(const pattern of [
  /SCOUT_DISCORD_CRON_TOKEN/,
  /Authorization/,
  /Bearer\\s\+/,
  /secureEqual/,
  /buildScoutJobBoard/,
  /syncScoutDiscordBoard/,
  /createMissing:false/,
  /originSystem:'Diaba'/,
  /ordinaryLimit:15/,
])assert.match(scheduledEndpoint,pattern);

const scheduledWorkflow=readFileSync('.github/workflows/refresh-scout-discord.yml','utf8');
for(const pattern of [
  /cron: '7,37 \* \* \* \*'/,
  /SCOUT_DISCORD_CRON_TOKEN: \$\{\{ secrets\.SCOUT_DISCORD_CRON_TOKEN \}\}/,
  /mongrels-squadron\.pages\.dev\/api\/internal\/scout-discord-refresh/,
  /Authorization: Bearer \$SCOUT_DISCORD_CRON_TOKEN/,
  /scheduled Scout Discord refresh is safely skipped/,
])assert.match(scheduledWorkflow,pattern);

const manualEndpoint=readFileSync('functions/api/operations/discord-scout-jobs.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /wolf-bgs-control/,
  /buildScoutJobBoard/,
  /syncScoutDiscordBoard/,
  /originSystem:'Diaba'/,
  /ordinaryLimit:15/,
  /createMissing:true/,
])assert.match(manualEndpoint,pattern);

const scoutApi=readFileSync('functions/api/operations/scout-jobs.js','utf8');
for(const pattern of [
  /loadActiveMongrelSystems/,
  /syncScoutDiscordAfterAction/,
  /syncScoutDiscordBoard/,
  /createMissing:true/,
])assert.match(scoutApi,pattern);

const ingest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
for(const pattern of [
  /buildScoutJobBoard/,
  /syncScoutDiscordBoard/,
  /loadActiveMongrelSystems/,
  /ordinaryLimit:15/,
])assert.match(ingest,pattern);

const discordClient=readFileSync('js/wolf-bgs-discord.js','utf8');
for(const pattern of [
  /data-discord-sync-scout/,
  /discord-scout-jobs/,
  /Syncing Scout Operations/,
])assert.match(discordClient,pattern);

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/data-discord-sync-scout/);
assert.match(page,/15 ordinary systems needing scouting/);
assert.match(page,/wolf-bgs-discord\.js\?v=6/);

console.log('✓ Scout Discord shows every priority job, the 15 nearest ordinary needs-scouting systems from Diaba, and keeps individual cards priority-only');
console.log('✓ Scout Discord claim/completion lifecycle edits in place and cleans completed priority cards on the next sync');
