import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
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

const pre=resolveOrderWorkCycle(baseOrder,control,{now:new Date('2026-09-21T21:00:00.000Z')});
assert.equal(pre.tickUtc,'22:15');
assert.equal(pre.phase,'pre_tick');
assert.equal(pre.estimatedTickAt,'2026-09-21T22:15:00.000Z');
assert.equal(pre.cycleEndsAt,'2026-09-21T23:45:00.000Z');

const transition=resolveOrderWorkCycle(baseOrder,control,{now:new Date('2026-09-21T22:45:00.000Z')});
assert.equal(transition.phase,'transition');
assert.equal(transition.cycleEndsAt,'2026-09-21T23:45:00.000Z');

const next=resolveOrderWorkCycle(baseOrder,control,{now:new Date('2026-09-22T00:00:00.000Z')});
assert.equal(next.phase,'pre_tick');
assert.equal(next.cycleStartedAt,'2026-09-21T23:45:00.000Z');
assert.notEqual(next.cycleId,transition.cycleId);
console.log('✓ Per-system custom tick uses PRE-TICK → TRANSITION → fresh work cycle');

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
},{now:new Date('2026-09-22T00:00:00.000Z'),historyDepth:2});
const order=document.orders[0];
assert.equal(order.workCycleHistory.length,2);
assert.equal(workCycleForTimestamp(order,'2026-09-21T22:30:00.000Z')?.cycleId,order.workCycleHistory[0].cycleId);
console.log('✓ Recent work-cycle history can classify old reports without carrying them into current progress');

const events=[
  {
    id:'old-inf',
    type:'mission_inf',
    timestamp:'2026-09-21T22:30:00.000Z',
    effects:[{infUnits:5,faction:'Test Faction',system:'Test System'}],
  },
  {
    id:'new-inf',
    type:'mission_inf',
    timestamp:'2026-09-22T00:15:00.000Z',
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
for(const pattern of [/PER-SYSTEM DAILY CYCLES/,/EST TICK/,/TRANSITION/,/UTC/,/localStamp/,/data-cycle-target/,/TICK IN/])assert.match(client,pattern);
new Function(client);

const page=readFileSync('operations/index.html','utf8');
assert.match(page,/mission-control-orders-v2\.css\?v=16/);
assert.match(page,/daily-orders-v2\.js\?v=15/);

console.log('✓ Mission Control shows UTC + browser-local tick clocks and live task countdowns');
console.log('\nAll per-system Daily Order cycle smoke checks passed.');
