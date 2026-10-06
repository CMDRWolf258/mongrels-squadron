import assert from 'node:assert/strict';
import { buildHudChangeManifest } from '../functions/api/hud/manifest.js';
import { HUD_SIGNAL_MISSION_PROGRESS, signalKey, touchHudSignal } from '../lib/hud-change-signals.js';

function makeStore(entries={}){
  const records=new Map(Object.entries(entries));
  const counts={get:0,put:0,delete:0,list:0};
  return{
    counts,
    records,
    async get(key){counts.get++;return structuredClone(records.get(key)??null);},
    async put(key,value){counts.put++;records.set(key,JSON.parse(value));},
    async delete(key){counts.delete++;records.delete(key);},
    async list(){counts.list++;return{keys:[],list_complete:true};},
  };
}

const current={
  title:'Daily Orders',
  configured:true,
  cycleId:'fixture-cycle',
  updatedAt:'2026-10-05T20:00:00Z',
  orders:[{
    id:'order-1',
    system:'Diaba',
    faction:'Regiment of Imperial Mongrels',
    task:'Win CZs',
    status:'active',
    createdAt:'2026-10-05T18:00:00Z',
    reporting:{type:'cz',target:20},
  }],
};
const control={
  defaults:{defaultTick:'19:00',transitionMinutes:90,lateGraceHours:3,rolloverPolicy:'safety'},
  systemSettings:{},
  alertEpisodes:{},
};
const daily=makeStore({
  current,
  'bgs-strategy-v1':{version:3,updatedAt:'2026-10-05T19:00:00Z',systems:[]},
  'wolf-bgs-control-v1':control,
  'wolf-bgs-scout-snapshots-v1':{version:1,systems:{Diaba:{system:'Diaba',updatedAt:'2026-10-05T19:30:00Z'}}},
  'scout-jobs-settings-v1':{version:1,systems:{}},
  'scout-jobs-state-v1':{version:1,cycles:{}},
});
const trades=makeStore({
  'trade-board-v1':[{id:'trade-1',status:'active',updatedAt:'2026-10-05T19:00:00Z'}],
});
const carriers=makeStore({
  'registry-v1':[{id:'carrier-1',callsign:'ABC-123',updatedAt:'2026-10-05T19:00:00Z'}],
  'carrier-dialogue-v1':{version:1,updatedAt:'2026-10-05T19:00:00Z',profiles:{}},
});
const env={DAILY_ORDERS:daily,TRADES:trades,CARRIERS:carriers};
let liveStamp='2026-10-05T19:45:00Z';
const realFetch=globalThis.fetch;
globalThis.fetch=async()=>Response.json({generatedAt:liveStamp,vaultPresenceRows:12});

const request=new Request('https://example.invalid/api/hud/manifest');
const before=await buildHudChangeManifest(request,env,{now:new Date('2026-10-05T23:30:00Z')});
assert.equal(before.ok,true);
assert.equal(before.version,1);
assert.deepEqual(Object.keys(before.channels).sort(),['alerts','bgs','carriers','dialogue','missionOrders','missionProgress','scout','trades']);
assert.equal(daily.counts.get,7,'shared manifest should use seven DAILY_ORDERS reads');
assert.equal(trades.counts.get,1,'shared manifest should use one TRADES read');
assert.equal(carriers.counts.get,2,'shared manifest should use two CARRIERS reads');

trades.records.set('trade-board-v1',[{id:'trade-1',status:'active',updatedAt:'2026-10-05T20:00:00Z',estimatedLoopProfit:123}]);
const tradeChanged=await buildHudChangeManifest(request,env,{now:new Date('2026-10-05T23:30:00Z')});
assert.notEqual(tradeChanged.channels.trades,before.channels.trades);
assert.notEqual(tradeChanged.channels.alerts,before.channels.alerts);
for(const key of ['missionOrders','missionProgress','bgs','scout','carriers','dialogue']){
  assert.equal(tradeChanged.channels[key],before.channels[key],key+' should not move for a trade-only change');
}

await touchHudSignal(env,HUD_SIGNAL_MISSION_PROGRESS,{at:new Date('2026-10-05T23:31:00Z')});
assert.ok(daily.records.has(signalKey(HUD_SIGNAL_MISSION_PROGRESS)));
const progressChanged=await buildHudChangeManifest(request,env,{now:new Date('2026-10-05T23:31:00Z')});
assert.notEqual(progressChanged.channels.missionProgress,tradeChanged.channels.missionProgress);
assert.equal(progressChanged.channels.missionOrders,tradeChanged.channels.missionOrders);

const currentEdited=structuredClone(current);
currentEdited.orders[0].task='Win 3 CZs';
currentEdited.updatedAt='2026-10-05T23:32:00Z';
daily.records.set('current',currentEdited);
const orderChanged=await buildHudChangeManifest(request,env,{now:new Date('2026-10-05T23:32:00Z')});
assert.notEqual(orderChanged.channels.missionOrders,progressChanged.channels.missionOrders);
assert.equal(orderChanged.channels.missionProgress,progressChanged.channels.missionProgress,'editing order text alone should not masquerade as contribution progress');

const beforeTick=await buildHudChangeManifest(request,env,{now:new Date('2026-10-05T23:59:59Z')});
const afterTick=await buildHudChangeManifest(request,env,{now:new Date('2026-10-06T00:00:01Z')});
assert.notEqual(afterTick.channels.missionProgress,beforeTick.channels.missionProgress,'work-cycle rollover must refresh Mission Control progress');
assert.equal(afterTick.channels.missionOrders,beforeTick.channels.missionOrders,'tick rollover does not edit the orders themselves');

const priorBgs=afterTick.channels.bgs;
const priorScout=afterTick.channels.scout;
liveStamp='2026-10-06T00:15:00Z';
const liveChanged=await buildHudChangeManifest(request,env,{now:new Date('2026-10-06T00:15:01Z')});
assert.notEqual(liveChanged.channels.bgs,priorBgs);
assert.notEqual(liveChanged.channels.scout,priorScout);

carriers.records.set('carrier-dialogue-v1',{version:1,updatedAt:'2026-10-06T00:16:00Z',profiles:{'carrier-1':{lines:[{id:'l1',text:'Welcome aboard'}]}}});
const dialogueChanged=await buildHudChangeManifest(request,env,{now:new Date('2026-10-06T00:16:01Z')});
assert.notEqual(dialogueChanged.channels.dialogue,liveChanged.channels.dialogue);
assert.equal(dialogueChanged.channels.carriers,liveChanged.channels.carriers);

globalThis.fetch=realFetch;
console.log('✓ HUD manifest isolates section changes, tracks contribution/tick progress, and keeps shared reads bounded');
