import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DAILY_ORDER_TICK_TIMEZONE,
  decorateDailyOrdersForTiming,
  resolveOrderWorkCycle,
  workCycleForTimestamp,
} from '../lib/daily-order-cycle.js';
import {
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
const historical=matchVerifiedActivityHistory(events,document,{depth:2});
assert.equal(historical.orderTotals.length,2);
assert.equal(historical.orderTotals.reduce((sum,row)=>sum+row.contribution,0),8);
assert.equal(new Set(historical.orderTotals.map(row=>row.sourceCycleId)).size,2);
console.log('✓ Current Mission Control progress resets while Reward Engine can still see recent prior-cycle evidence');

const reports=readFileSync('functions/api/operations/order-reports.js','utf8');
for(const pattern of [/workCycleId/,/recordBelongsToCurrentWorkCycle/,/workCycleForTimestamp/,/historyDepth:14/])assert.match(reports,pattern);

const rewards=readFileSync('lib/reward-dry-run.js','utf8');
for(const pattern of [/preview\.sourceCycleId/,/wantedCycle/,/sourceCycleId/])assert.match(rewards,pattern);
const runtime=readFileSync('lib/reward-engine-runtime.js','utf8');
assert.match(runtime,/matchVerifiedActivityHistory/);
assert.match(runtime,/historyDepth:7/);

const client=readFileSync('js/daily-orders-v2.js','utf8');
for(const pattern of [/PER-SYSTEM DAILY CYCLES/,/EST TICK/,/TRANSITION/,/UTC/,/localStamp/,/data-cycle-target/,/TICK IN/,/MANUAL REPORTING/,/Backup entry if Scout misses activity/,/OPEN IF NEEDED/])assert.match(client,pattern);
new Function(client);

const wolfPage=readFileSync('wolf-bgs/index.html','utf8');
assert.match(wolfPage,/Default system tick \(CT\)/);
const wolfUi=readFileSync('js/wolf-bgs.js','utf8');
assert.match(wolfUi,/Custom tick \(CT\)/);
assert.match(wolfUi,/\$\{html\(tick\)\} CT/);

const page=readFileSync('operations/index.html','utf8');
assert.match(page,/mission-control-orders-v2\.css\?v=17/);
assert.match(page,/daily-orders-v2\.js\?v=16/);
const css=readFileSync('css/mission-control-orders-v2.css','utf8');
assert.match(css,/\.mc-manual-report/);
assert.match(css,/font-size:1\.42rem/);
assert.match(css,/\.mc-order-reset-pill\{[^}]*font-size:\.68rem!important/);

console.log('✓ Mission Control shows UTC + browser-local tick clocks from a Central-time admin schedule');
console.log('\nAll per-system Daily Order cycle smoke checks passed.');
