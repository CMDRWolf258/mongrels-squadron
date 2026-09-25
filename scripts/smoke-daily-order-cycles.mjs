import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildOrderRewardPolicies, DEFAULT_REWARD_SETTINGS } from '../lib/reward-rules.js';
import {
  DAILY_ORDER_TICK_TIMEZONE,
  decorateDailyOrdersForTiming,
  resolveOrderWorkCycle,
  workCycleForTimestamp,
} from '../lib/daily-order-cycle.js';
import { archivedRemovedOrders } from '../lib/order-history.js';
import { buildRewardDryRun } from '../lib/reward-dry-run.js';
import {
  aggregateVerifiedOrderTotals,
  matchVerifiedActivity,
  matchVerifiedActivityHistory,
} from '../lib/order-activity.js';

const control={
  defaults:{defaultTick:'19:00',transitionMinutes:90,lateGraceHours:3,rolloverPolicy:'safety'},
  systemSettings:{'Test System':{customTick:'22:15',rolloverPolicy:'strict'}},
};

const baseOrder={
  id:'order-1',
  logicalKey:'manual|test system|test faction|inf|test',
  system:'Test System',
  faction:'Test Faction',
  priority:'high',
  task:'Complete 25 INF for Test Faction',
  reporting:{type:'inf',target:25,blitz:false},
  status:'active',
  createdAt:'2026-09-18T00:00:00.000Z',
  revision:1,
};

assert.equal(DAILY_ORDER_TICK_TIMEZONE,'America/Chicago');

const defaultOrder={...baseOrder,system:'Default System'};
const userScenario=resolveOrderWorkCycle(defaultOrder,{
  defaults:control.defaults,
  systemSettings:{},
},{now:new Date('2026-09-22T02:11:00.000Z')});
assert.equal(userScenario.tickConfiguredTime,'19:00');
assert.equal(userScenario.tickTimezone,'America/Chicago');
assert.equal(userScenario.estimatedTickAt,'2026-09-23T00:00:00.000Z');
const hoursUntil=(Date.parse(userScenario.estimatedTickAt)-Date.parse('2026-09-22T02:11:00.000Z'))/3_600_000;
assert.ok(hoursUntil>21.7&&hoursUntil<21.9,'9:11 PM CDT should be about 22 hours before the next 7:00 PM CT tick');
console.log('✓ 19:00 default tick is interpreted as 7:00 PM Central, not 19:00 UTC');

const pre=resolveOrderWorkCycle(baseOrder,control,{now:new Date('2026-09-22T02:00:00.000Z')});
assert.equal(pre.tickConfiguredTime,'22:15');
assert.equal(pre.tickUtc,'03:15');
assert.equal(pre.phase,'pre_tick');
assert.equal(pre.estimatedTickAt,'2026-09-22T03:15:00.000Z');
assert.equal(pre.cycleEndsAt,'2026-09-22T04:45:00.000Z');

const transition=resolveOrderWorkCycle(baseOrder,control,{now:new Date('2026-09-22T03:45:00.000Z')});
assert.equal(transition.phase,'transition');
assert.equal(transition.cycleEndsAt,'2026-09-22T04:45:00.000Z');

const next=resolveOrderWorkCycle(baseOrder,control,{now:new Date('2026-09-22T05:00:00.000Z')});
assert.equal(next.phase,'pre_tick');
assert.equal(next.cycleStartedAt,'2026-09-22T04:45:00.000Z');
assert.equal(next.estimatedTickAt,'2026-09-23T03:15:00.000Z');
assert.notEqual(next.cycleId,transition.cycleId);
console.log('✓ Per-system CT custom tick uses PRE-TICK → TRANSITION → fresh work cycle');

const fakeEnv={
  DAILY_ORDERS:{
    async get(key,{type}={}){
      if(key==='wolf-bgs-control-v1')return type==='json'?control:JSON.stringify(control);
      return null;
    },
  },
};
const document=await decorateDailyOrdersForTiming(fakeEnv,{
  configured:true,
  cycleId:'publication-cycle',
  cycleStartedAt:'2026-09-18T00:00:00.000Z',
  orders:[baseOrder],
},{now:new Date('2026-09-22T05:00:00.000Z'),historyDepth:2});
const order=document.orders[0];
assert.equal(document.timingDefaults.timezone,'America/Chicago');
assert.equal(document.timingDefaults.timezoneLabel,'CT');
assert.equal(order.workCycleHistory.length,2);
assert.equal(workCycleForTimestamp(order,'2026-09-22T03:30:00.000Z')?.cycleId,order.workCycleHistory[0].cycleId);
console.log('✓ Recent work-cycle history can classify old reports without carrying them into current progress');

const events=[
  {
    id:'old-inf',
    type:'mission_inf',
    timestamp:'2026-09-22T03:30:00.000Z',
    effects:[{infUnits:5,faction:'Test Faction',system:'Test System'}],
  },
  {
    id:'new-inf',
    type:'mission_inf',
    timestamp:'2026-09-22T05:15:00.000Z',
    effects:[{infUnits:3,faction:'Test Faction',system:'Test System'}],
  },
];
const current=matchVerifiedActivity(events,document);
assert.equal(current.orderTotals.length,1);
assert.equal(current.orderTotals[0].contribution,3,'Old 5 INF must not carry into the new tick cycle');
assert.deepEqual(current.orderTotals[0].sourceEventIds,['new-inf']);

const latePublishedDocument=await decorateDailyOrdersForTiming(fakeEnv,{
  configured:true,
  cycleId:'late-publication',
  cycleStartedAt:'2026-09-18T00:00:00.000Z',
  orders:[{
    ...baseOrder,
    id:'late-order',
    system:'Default System',
    faction:'Late Faction',
    task:'Complete 25 INF for Late Faction',
    logicalKey:'manual|default system|late faction|inf|late',
    createdAt:'2026-09-22T06:00:00.000Z',
  }],
},{now:new Date('2026-09-22T06:30:00.000Z')});
const sameCycleBeforePublish={
  id:'same-cycle-before-publish',
  type:'mission_inf',
  timestamp:'2026-09-22T05:30:00.000Z',
  effects:[{infUnits:5,faction:'Late Faction',system:'Default System'}],
};
const lateMatched=matchVerifiedActivity([sameCycleBeforePublish],latePublishedDocument);
assert.equal(lateMatched.orderTotals.length,1);
assert.equal(lateMatched.orderTotals[0].contribution,5,'Verified work from the same BGS cycle must count even if the order was published later');
const previousCycleBeforePublish={
  ...sameCycleBeforePublish,
  id:'previous-cycle-before-publish',
  timestamp:'2026-09-21T23:00:00.000Z',
};
assert.equal(matchVerifiedActivity([previousCycleBeforePublish],latePublishedDocument).orderTotals.length,0,'Earlier BGS-cycle work must still remain excluded');
console.log('✓ Late-published orders recover exact Scout work from the same BGS cycle without carrying older-cycle work forward');
const historical=matchVerifiedActivityHistory(events,document,{depth:2});
assert.equal(historical.orderTotals.length,2);
assert.equal(historical.orderTotals.reduce((sum,row)=>sum+row.contribution,0),8);
assert.equal(new Set(historical.orderTotals.map(row=>row.sourceCycleId)).size,2);
console.log('✓ Current Mission Control progress resets while Reward Engine can still see recent prior-cycle evidence');

const archivedOrder={
  ...baseOrder,
  id:'removed-order',
  logicalKey:'manual|default system|archived faction|inf|removed',
  system:'Default System',
  faction:'Archived Faction',
  task:'Complete 25 INF for Archived Faction',
  createdAt:'2026-09-21T02:00:00.000Z',
  revisedAt:'2026-09-21T02:00:00.000Z',
};
const publishedArchiveRecord={
  state:'applied',
  action:'reconcile',
  cycleId:'publication-cycle',
  previousCycleId:'publication-cycle',
  publicationId:'publish-removed-order',
  preparedAt:'2026-09-21T02:00:00.000Z',
  appliedAt:'2026-09-21T02:00:01.000Z',
  afterHash:'archive-publish-hash',
  before:{cycleId:'publication-cycle',orders:[]},
  after:{cycleId:'publication-cycle',orders:[archivedOrder]},
};
const removalArchiveRecord={
  state:'applied',
  action:'reconcile',
  cycleId:'publication-cycle',
  previousCycleId:'publication-cycle',
  publicationId:'remove-removed-order',
  preparedAt:'2026-09-23T02:00:00.000Z',
  appliedAt:'2026-09-23T02:00:01.000Z',
  afterHash:'archive-remove-hash',
  before:{cycleId:'publication-cycle',orders:[archivedOrder]},
  after:{cycleId:'publication-cycle',orders:[]},
};
const replacementOrder={
  ...archivedOrder,
  id:'replacement-order',
  logicalKey:'manual|default system|archived faction|inf|replacement',
  createdAt:'2026-09-24T03:00:00.000Z',
  revisedAt:'2026-09-24T03:00:00.000Z',
};
const recoveredArchivedOrders=archivedRemovedOrders(
  [publishedArchiveRecord,removalArchiveRecord],
  [replacementOrder],
);
assert.equal(recoveredArchivedOrders.length,1);
assert.equal(recoveredArchivedOrders[0].id,'removed-order');
assert.equal(recoveredArchivedOrders[0].rewardHistoryRemovedAt,'2026-09-23T02:00:00.000Z');

const lateSyncDocument=await decorateDailyOrdersForTiming(fakeEnv,{
  configured:true,
  cycleId:'publication-cycle',
  cycleStartedAt:'2026-09-21T02:00:00.000Z',
  orders:[replacementOrder,...recoveredArchivedOrders],
},{now:new Date('2026-09-24T06:00:00.000Z'),historyDepth:3});
const cycleOneLateEvent={
  id:'cycle-one-late-sync',
  type:'mission_inf',
  timestamp:'2026-09-22T10:00:00.000Z',
  effects:[{infUnits:5,faction:'Archived Faction',system:'Default System'}],
};
const afterRemovalEvent={
  id:'after-removal',
  type:'mission_inf',
  timestamp:'2026-09-23T03:00:00.000Z',
  effects:[{infUnits:4,faction:'Archived Faction',system:'Default System'}],
};
const recoveredLate=matchVerifiedActivityHistory([cycleOneLateEvent],lateSyncDocument,{depth:3});
assert.equal(recoveredLate.orderTotals.length,1,'Archived order should recover work from its original prior cycle');
assert.equal(recoveredLate.orderTotals[0].orderId,'removed-order','A newly published replacement must not steal older-cycle work');
assert.equal(recoveredLate.orderTotals[0].contribution,5);
assert.equal(matchVerifiedActivityHistory([afterRemovalEvent],lateSyncDocument,{depth:3}).orderTotals.length,0,'Removed orders must not absorb work performed after removal');

const recoveredReward=await buildRewardDryRun({
  current:lateSyncDocument,
  accounts:[{userId:'wolf',account:{commander:'Wolf258'},matched:recoveredLate}],
  rewardSettings:DEFAULT_REWARD_SETTINGS,
  historyRecords:[publishedArchiveRecord,removalArchiveRecord],
  ledgerEntries:[],
});
assert.equal(recoveredReward.summary.readyObligations,1,'Late-synced archived work should become a live reward obligation');
assert.equal(recoveredReward.summary.wouldCreateCredits,5_000_000);
assert.equal(recoveredReward.members[0].obligations[0].sourceCycleId,recoveredLate.orderTotals[0].sourceCycleId);
assert.deepEqual(recoveredReward.members[0].obligations[0].blockers,[]);
console.log('✓ Cycle 1 work can be recovered and rewarded after its order is removed before a later Elite sync');

const squadVerified=aggregateVerifiedOrderTotals([
  {userId:'wolf',matched:{orderTotals:[{orderId:'trade-order',sourceCycleId:'cycle-a',type:'trade',target:20,contribution:9.2,unit:'M Cr',eventCount:1,sourceEventIds:['trade-1']}]}},
  {userId:'wingmate',matched:{orderTotals:[{orderId:'trade-order',sourceCycleId:'cycle-a',type:'trade',target:20,contribution:4.8,unit:'M Cr',eventCount:1,sourceEventIds:['trade-2']}]}},
]);
assert.equal(squadVerified['trade-order'].contribution,14);
assert.equal(squadVerified['trade-order'].commanderCount,2);
assert.equal(squadVerified['trade-order'].sourceEventCount,2);
console.log('✓ Squad Scout contributions aggregate across linked CMDRs for Daily Order progress');

const rewardPolicies=buildOrderRewardPolicies([
  {...baseOrder,id:'inf-reward',reporting:{type:'inf',target:25}},
  {...baseOrder,id:'trade-reward',reporting:{type:'trade',target:20}},
  {...baseOrder,id:'bounty-reward',reporting:{type:'bounties',target:20}},
  {...baseOrder,id:'exploration-no-reward',reporting:{type:'exploration',target:20}},
]);
assert.equal(rewardPolicies['inf-reward'].goalRewardMillions,25);
assert.equal(rewardPolicies['inf-reward'].capMillions,30);
assert.equal(rewardPolicies['trade-reward'].goalRewardMillions,20);
assert.equal(rewardPolicies['trade-reward'].rewardPerBlockMillions,10);
assert.equal(rewardPolicies['bounty-reward'].goalRewardMillions,20);
assert.equal(rewardPolicies['bounty-reward'].rewardPerRedeemedMillion,1);
assert.equal(rewardPolicies['exploration-no-reward'].eligible,false);
console.log('✓ Daily Order reward policies expose exact configured rates, target payout, and personal cap');

const reports=readFileSync('functions/api/operations/order-reports.js','utf8');
for(const pattern of [/workCycleId/,/recordBelongsToCurrentWorkCycle/,/workCycleForTimestamp/,/historyDepth:14/,/verifiedSummaries/,/listFrontierAccounts/,/getEvents/,/aggregateVerifiedOrderTotals/])assert.match(reports,pattern);

const rewards=readFileSync('lib/reward-dry-run.js','utf8');
for(const pattern of [/preview\.sourceCycleId/,/wantedCycle/,/sourceCycleId/])assert.match(rewards,pattern);
const runtime=readFileSync('lib/reward-engine-runtime.js','utf8');
assert.match(runtime,/matchVerifiedActivityHistory/);
assert.match(runtime,/historyDepth:7/);
assert.match(runtime,/archivedRemovedOrders/);
assert.match(runtime,/listOrderPublications\(env,\{limit:250\}\)/);
assert.match(runtime,/rewardCurrent/);

const client=readFileSync('js/daily-orders-v2.js','utf8');
for(const pattern of [/PER-SYSTEM DAILY CYCLES/,/EST TICK/,/TRANSITION/,/UTC/,/localStamp/,/data-cycle-target/,/TICK IN/,/MANUAL REPORTING/,/Only report work Scout did not capture/,/OPEN IF NEEDED/,/MISSION REWARD POINTS · \+\+\+\+\+ = 5 INF/,/TRACKED /,/Scout verified squad/,/YOUR SCOUT VERIFIED/])assert.match(client,pattern);
new Function(client);

const wolfPage=readFileSync('wolf-bgs/index.html','utf8');
assert.match(wolfPage,/Default system tick \(CT\)/);
const wolfUi=readFileSync('js/wolf-bgs.js','utf8');
assert.match(wolfUi,/Custom tick \(CT\)/);
assert.match(wolfUi,/\$\{html\(tick\)\} CT/);

const page=readFileSync('operations/index.html','utf8');
assert.match(page,/mission-control-orders-v2\.css\?v=20/);
assert.match(page,/daily-orders-v2\.js\?v=19/);
const css=readFileSync('css/mission-control-orders-v2.css','utf8');
assert.match(css,/\.mc-manual-report/);
assert.match(css,/font-size:1\.42rem/);
assert.match(css,/\.mc-order-reset-pill\{[^}]*font-size:\.68rem!important/);
assert.match(css,/\.mc-order-target h3\{[^}]*color:#ffc76d/);
assert.match(css,/\.mc-progress-track\{height:10px/);
assert.match(css,/\.mc-order-copy p\{[^}]*font-size:\.98rem/);
assert.match(css,/\.private-orders-section \.member-orders-panel/);

console.log('✓ Mission Control shows UTC + browser-local tick clocks from a Central-time admin schedule');
console.log('\nAll per-system Daily Order cycle smoke checks passed.');
