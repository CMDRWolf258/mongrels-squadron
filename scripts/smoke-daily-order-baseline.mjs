import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ensureOrderHistoryBaseline } from '../lib/order-history.js';
import { buildRewardDryRun, findPublicationProvenance } from '../lib/reward-dry-run.js';
import { DEFAULT_REWARD_SETTINGS } from '../lib/reward-rules.js';

function fakeKv(){
  const map=new Map();
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
      return {
        keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),
        list_complete:true,
      };
    },
  };
}

const order={
  id:'order-a',
  logicalKey:'test-system|test-faction|inf|test-order',
  revision:1,
  system:'Test System',
  faction:'Test Faction',
  kind:'support',
  source:'preview',
  priority:'normal',
  task:'Complete 25 INF for Test Faction',
  detail:'',
  status:'active',
  reporting:{type:'inf',target:25,blitz:false},
  createdAt:'2026-09-21T10:00:00.000Z',
  revisedAt:'2026-09-21T10:00:00.000Z',
};
const current={
  configured:true,
  title:'Squadron Daily Orders',
  briefing:'',
  updatedAt:'2026-09-21T10:00:00.000Z',
  updatedBy:'Wolf',
  cycleId:'cycle-legacy-test',
  cycleStartedAt:'2026-09-21T10:00:00.000Z',
  officerNote:null,
  orders:[order],
};

const env={DAILY_ORDERS:fakeKv()};
const baseline=await ensureOrderHistoryBaseline(env,current,[],'Smoke migration');
assert.ok(baseline,'Legacy current orders should receive a baseline');
assert.equal(baseline.state,'applied');
assert.equal(baseline.action,'baseline');
assert.equal(baseline.legacyBaseline,true);
assert.equal(baseline.after.orders[0].revision,1);
assert.equal((await ensureOrderHistoryBaseline(env,current,[baseline],'Smoke migration')),null,'Existing archive should make baseline initialization idempotent');
console.log('✓ Current legacy Daily Orders receive one durable APPLIED baseline');

const baselineMs=Date.parse(baseline.appliedAt);
const oldTime=new Date(baselineMs-60_000).toISOString();
const newTime=new Date(baselineMs+60_000).toISOString();
const matched={
  cycleId:current.cycleId,
  cycleStartedAt:current.cycleStartedAt,
  orderTotals:[{
    orderId:order.id,
    logicalKey:order.logicalKey,
    revision:1,
    task:order.task,
    type:'inf',
    system:order.system,
    faction:order.faction,
    target:25,
    contribution:10,
    unit:'INF',
    eventCount:2,
    sourceEventIds:['old-event','new-event'],
  }],
  events:[
    {
      id:'old-event',
      timestamp:oldTime,
      orderMatches:[{
        eventId:'old-event',
        orderId:order.id,
        logicalKey:order.logicalKey,
        revision:1,
        type:'inf',
        contribution:5,
        unit:'INF',
        timestamp:oldTime,
      }],
    },
    {
      id:'new-event',
      timestamp:newTime,
      orderMatches:[{
        eventId:'new-event',
        orderId:order.id,
        logicalKey:order.logicalKey,
        revision:1,
        type:'inf',
        contribution:5,
        unit:'INF',
        timestamp:newTime,
      }],
    },
  ],
};

const dry=await buildRewardDryRun({
  current,
  accounts:[{userId:'wolf',account:{commander:'Wolf258'},matched}],
  rewardSettings:DEFAULT_REWARD_SETTINGS,
  historyRecords:[baseline],
  ledgerEntries:[],
});
assert.equal(dry.summary.readyObligations,1,'Post-baseline work should become READY');
assert.equal(dry.summary.blockedObligations,1,'Pre-baseline work should remain BLOCKED');
assert.equal(dry.summary.wouldCreateCredits,5_000_000,'Only post-baseline 5 INF should be live-ready');
assert.equal(dry.summary.blockedDeltaCredits,5_000_000,'Pre-baseline 5 INF should remain visible as blocked value');
const rows=dry.members[0].obligations;
const blocked=rows.find(row=>row.blockers.includes('order_legacy_history_gap'));
const ready=rows.find(row=>row.readyForLive);
assert.ok(blocked);
assert.equal(blocked.contribution,5);
assert.equal(blocked.plannedEntry,null,'Legacy evidence must never produce a planned ledger entry');
assert.ok(ready);
assert.equal(ready.contribution,5);
assert.deepEqual(ready.sourceEventIds,['new-event']);
assert.equal(ready.provenance.legacyBaseline,true,'Post-baseline evidence may safely use the baseline definition');
console.log('✓ Reward Engine splits pre-baseline Daily Order evidence from new READY work');

const laterRecord={
  ...baseline,
  publicationId:'later-unchanged-publication',
  action:'reconcile',
  legacyBaseline:false,
  preparedAt:new Date(baselineMs+120_000).toISOString(),
  appliedAt:new Date(baselineMs+121_000).toISOString(),
  before:baseline.after,
  after:baseline.after,
};
const provenance=findPublicationProvenance([laterRecord,baseline],{
  orderId:order.id,
  logicalKey:order.logicalKey,
  revision:1,
  cycleId:current.cycleId,
});
assert.equal(provenance.publicationId,baseline.publicationId,'Revision provenance must stay anchored to the revision origin, not a later unchanged snapshot');
assert.equal(provenance.legacyBaseline,true);
console.log('✓ Later unchanged publications cannot erase the legacy provenance boundary');

const orderApi=readFileSync('functions/api/operations/orders.js','utf8');
assert.match(orderApi,/ensureOrderHistoryBaseline/,'Daily Order mutation API must baseline legacy orders before changing them');
const dryApi=readFileSync('functions/api/rewards/dry-run.js','utf8');
assert.match(dryApi,/Reward Engine migration/,'Reward DRY RUN must initialize the current legacy cycle baseline');
const historyUi=readFileSync('js/wolf-bgs-history.js','utf8');
assert.match(historyUi,/LEGACY BASELINE/,'Daily Order History must explain the legacy baseline');
const rewardUi=readFileSync('js/wolf-bgs-rewards.js','utf8');
assert.match(rewardUi,/order_legacy_history_gap/,'Reward UI must explain pre-baseline Daily Order blocking');

console.log('\nAll Daily Order legacy-baseline smoke checks passed.');
