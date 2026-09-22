import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildScoutJobBoard,
  claimScoutJob,
  listScoutRewardWinners,
  readScoutJobSettings,
  recordScoutObservation,
  writeScoutJobSettings,
} from '../lib/scout-jobs.js';
import { buildScoutRewardDryRun } from '../lib/scout-reward-dry-run.js';
import { resolveSystemWorkCycle } from '../lib/daily-order-cycle.js';

function fakeKv(seed={}){
  const map=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  return {
    map,
    async get(key,{type}={}){
      const value=map.get(key);
      if(value===undefined)return null;
      return type==='json'?JSON.parse(value):value;
    },
    async put(key,value){map.set(key,String(value));},
    async delete(key){map.delete(key);},
    async list({prefix=''}) {
      return {keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};
    },
  };
}

const control={
  defaults:{defaultTick:'19:00',transitionMinutes:90,lateGraceHours:3,rolloverPolicy:'safety'},
  systemSettings:{},
};
const env={DAILY_ORDERS:fakeKv({
  'wolf-bgs-control-v1':control,
  'wolf-bgs-scout-tokens-v1':{
    version:2,
    tokens:{
      a:{id:'a',label:'Scout A',hash:'x',scope:'trusted',ownerId:'A',ownerCommander:'CMDR A'},
      b:{id:'b',label:'Scout B',hash:'y',scope:'trusted',ownerId:'B',ownerCommander:'CMDR B'},
    },
  },
})};

await writeScoutJobSettings(env,{
  defaultRewardMillions:5,
  systems:{
    'Test System':{enabled:true,bonusMillions:10,reason:'Urgent board',bonusOnce:true},
  },
},{actor:'Wolf'});

const at1300=new Date('2026-09-22T18:00:00.000Z'); // 13:00 CDT
const cycle=resolveSystemWorkCycle('Test System',control,{now:at1300});
assert.equal(cycle.tickConfiguredTime,'19:00');
assert.equal(cycle.cycleEndsAt,'2026-09-23T01:30:00.000Z','transition offset must be part of the scouting cycle boundary');

const claim=await claimScoutJob(env,{
  system:'Test System',
  ownerId:'B',
  commander:'CMDR B',
  now:new Date('2026-09-22T17:30:00.000Z'), // 12:30 CDT
});
assert.equal(claim.claim.ownerId,'B');
assert.equal(claim.claim.expiresAt,'2026-09-22T18:30:00.000Z');

const aRunner=await recordScoutObservation(env,{
  system:'Test System',
  systemAddress:123,
  ownerId:'A',
  commander:'CMDR A',
  tokenId:'a',
  tokenLabel:'Scout A',
  observedAt:'2026-09-22T18:00:00.000Z',
  receivedAt:'2026-09-22T18:00:05.000Z',
});
assert.equal(aRunner.status,'runner_up');
assert.equal(aRunner.winner,null);

let winners=await listScoutRewardWinners(env,{now:new Date('2026-09-22T18:29:00.000Z')});
assert.equal(winners.length,0,'runner-up must remain protected behind an active claim');

winners=await listScoutRewardWinners(env,{now:new Date('2026-09-22T18:31:00.000Z')});
assert.equal(winners.length,1,'earliest valid runner-up must promote after claim expiry');
assert.equal(winners[0].winner.ownerId,'A');
assert.equal(winners[0].winner.mode,'runner_up_promotion');
assert.equal(winners[0].winner.amountCredits,15_000_000);

const postBonus=await readScoutJobSettings(env);
assert.equal(postBonus.systems['Test System'].bonusMillions,0,'one-shot priority bonus must clear after the rewarded scout');

const duplicate=await recordScoutObservation(env,{
  system:'Test System',
  systemAddress:123,
  ownerId:'A',
  commander:'CMDR A',
  tokenId:'a',
  tokenLabel:'Scout A',
  observedAt:'2026-09-22T18:00:00.000Z',
  receivedAt:'2026-09-22T18:40:00.000Z',
});
assert.equal(duplicate.duplicate,true,'the same Scout board must not create a second observation');

const next=await recordScoutObservation(env,{
  system:'Test System',
  systemAddress:123,
  ownerId:'A',
  commander:'CMDR A',
  tokenId:'a',
  tokenLabel:'Scout A',
  observedAt:'2026-09-23T02:00:00.000Z', // 21:00 CDT, after 19:00 + 90m transition
  receivedAt:'2026-09-23T02:00:05.000Z',
});
assert.equal(next.status,'winner','an unclaimed valid upload should win immediately');
assert.equal(next.winner.amountCredits,5_000_000,'next cycle should use the base reward after the one-shot bonus clears');

winners=await listScoutRewardWinners(env,{now:new Date('2026-09-23T02:01:00.000Z')});
assert.equal(winners.length,2);
assert.notEqual(winners[0].cycleId,winners[1].cycleId,'one system may earn again after its next tick-aware cycle begins');

const dry=await buildScoutRewardDryRun({winners,ledgerEntries:[]});
assert.equal(dry.summary.readyObligations,2);
assert.equal(dry.summary.wouldCreateCredits,20_000_000);
assert.ok(dry.obligations.every(row=>row.source==='scouting'&&row.readyForLive));
assert.ok(dry.obligations.every(row=>row.plannedEntry?.kind==='scouting_job'));
console.log('✓ Scout Jobs arbitrate claims, runner-ups, cycle resets, bonuses, and reward obligations');

const board=await buildScoutJobBoard(env,{
  systems:[{name:'Test System'}],
  viewer:{userId:'A',displayName:'A',commander:'CMDR A'},
  now:new Date('2026-09-23T02:05:00.000Z'),
});
assert.equal(board.jobs[0].status,'fresh');
assert.equal(board.jobs[0].winner.mine,true);
assert.equal(board.viewer.scoutBound,true);
console.log('✓ Scout Board reports current-cycle freshness and bound Scout identity');

const ingest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
for(const pattern of [/recordScoutObservation/,/hasActiveScoutClaim/,/ownerId:auth\.ownerId/,/scoutJob/])assert.match(ingest,pattern);
const tokenApi=readFileSync('functions/api/operations/scout-tokens.js','utf8');
for(const pattern of [/listFrontierAccounts/,/ownerId/,/ownerCommander/,/scout_owner_not_found/])assert.match(tokenApi,pattern);
const page=readFileSync('operations/index.html','utf8');
assert.match(page,/id="scout-jobs"/);
assert.match(page,/data-scout-jobs-summary-only/);
assert.match(page,/href="\.\.\/scout-jobs\//);
assert.match(page,/scout-jobs\.js\?v=3/);
const scoutPage=readFileSync('scout-jobs/index.html','utf8');
assert.match(scoutPage,/data-scout-jobs-board/);
assert.match(scoutPage,/Current Scout Board/);
assert.match(scoutPage,/scout-jobs\.js\?v=3/);
assert.match(scoutPage,/api\/auth\/login\?return=%2Fscout-jobs%2F/);
assert.match(scoutPage,/scout-setup-panel/);
assert.match(scoutPage,/\/api\/frontier\/login/);
assert.match(scoutPage,/\/api\/downloads\/mongrel-scout/);
assert.match(scoutPage,/downloads\/mongrel-scout\/README\.md/);
assert.match(scoutPage,/Install EDMC and download Live Scout/);
assert.ok(scoutPage.includes('../member/?section=live-scout-setup#live-scout-setup'));
assert.match(scoutPage,/LIVE SCOUT REQUIRED/);
assert.match(scoutPage,/needed to update system data and receive Scout Job rewards/);
const scoutUi=readFileSync('js/scout-jobs.js','utf8');
assert.match(scoutUi,/if\(!payload\)return/,'summary mode must render without a full job-list element');
assert.match(scoutUi,/data-scout-copy-system/);
assert.match(scoutUi,/navigator\.clipboard\.writeText\(system\)/);
const memberUi=readFileSync('js/member-dashboard.js','utf8');
assert.match(memberUi,/honorMemberDeepLink/);
assert.match(memberUi,/addEventListener\('pageshow',restoreMemberDeepLink\)/);
assert.match(memberUi,/addEventListener\('hashchange',restoreMemberDeepLink\)/);
assert.match(memberUi,/URLSearchParams\(location\.search\)/);
assert.match(memberUi,/setTimeout\(honorMemberDeepLink,260\)/);
assert.match(memberUi,/scrollIntoView/);
assert.match(memberUi,/live-scout-setup/);
const memberPage=readFileSync('member/index.html','utf8');
assert.match(memberPage,/member-dashboard\.js\?v=90/);
const adminPage=readFileSync('wolf-bgs/index.html','utf8');
assert.match(adminPage,/data-scout-job-admin/);
assert.match(adminPage,/wolf-bgs-scout-jobs\.js\?v=2/);
assert.match(adminPage,/data-reset-scout-job-default/);
assert.match(adminPage,/data-scout-job-admin-search/);
assert.match(adminPage,/data-scout-job-admin-prev/);
assert.match(adminPage,/data-scout-job-admin-next/);
const adminUi=readFileSync('js/wolf-bgs-scout-jobs.js','utf8');
assert.match(adminUi,/PAGE_SIZE=10/);
assert.match(adminUi,/saveGlobal\(0,'Resetting'\)/);
console.log('✓ Scout Job member/admin surfaces and Live Scout ownership wiring are present');

console.log('\nAll Scout Job smoke checks passed.');
