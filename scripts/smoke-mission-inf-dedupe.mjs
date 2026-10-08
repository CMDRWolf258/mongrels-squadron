import assert from 'node:assert/strict';
import {parseJournal,mergeEventsWithResult,getEvents} from '../lib/frontier.js';
import {normalizeScoutActivityBatch} from '../lib/scout-activity.js';
import {matchVerifiedActivity} from '../lib/order-activity.js';
import {signalKey,HUD_SIGNAL_MISSION_PROGRESS} from '../lib/hud-change-signals.js';

// Reproduces the reported Consortium scenario: 22 real INF, doubled to 44
// after Scout's .000Z timestamps and Frontier's Z timestamps are merged.
const system='NGC 2546 Sector UZ-G d10-16';
const station='Saturn Ascending';
const faction='The Consortium';
const systemAddress=560820275507;
const missions=[
  ['2026-10-08T05:42:40Z',4,87000],
  ['2026-10-08T05:42:52Z',4,87001],
  ['2026-10-08T05:43:00Z',5,87002],
  ['2026-10-08T05:43:07Z',5,87003],
  ['2026-10-08T05:43:13Z',4,87004],
];
const effect=units=>[{Faction:faction,Reputation:'+',Influence:[{SystemAddress:systemAddress,Influence:'+'.repeat(units)}]}];
const journal=[
  {timestamp:'2026-10-08T05:42:35Z',event:'Location',StarSystem:system,SystemAddress:systemAddress,Docked:true,StationName:station,StationType:'Orbis'},
  ...missions.map(([timestamp,units,id])=>({
    timestamp,event:'MissionCompleted',MissionID:id,Faction:faction,FactionEffects:effect(units),
  })),
].map(value=>JSON.stringify(value)).join('\n');
const capi=parseJournal(journal,[system]);
assert.equal(capi.events.length,5,'All five real mission completions must parse');
assert.ok(capi.events.every(row=>row.type==='mission_inf'&&row.provisional!==true));

const scout=normalizeScoutActivityBatch({
  kind:'activity_batch',
  events:missions.map(([timestamp,units,id])=>({
    event:'MissionCompleted',timestamp,system,systemAddress:String(systemAddress),
    station,missionId:id,faction,missionOrigin:{
      missionId:String(id),originSystem:system,originSystemAddress:String(systemAddress),
      originStation:station,sourceFaction:faction,
    },
    factionEffects:effect(units),
  })),
},{scope:'trusted',allowedSystems:[]},{now:Date.parse('2026-10-08T16:00:00Z')});
assert.equal(scout.events.length,5);
assert.ok(scout.events.every(row=>row.provisional===true));
assert.notEqual(scout.events[0].timestamp,capi.events[0].timestamp,'Reproduces real timestamp serialization difference');

const totals=events=>events.reduce((acc,row)=>acc+(row.effects||[])
  .filter(item=>item.system===system&&item.faction===faction)
  .reduce((n,item)=>n+(Number(item.infUnits)||0),0),0);
assert.equal(totals(scout.events),22);
assert.equal(totals(capi.events),22);
const store=new Map();let writes=0;
const env={DAILY_ORDERS:{
  async get(key,{type}={}){const v=store.get(key);return v===undefined?null:(type==='json'?JSON.parse(v):v);},
  async put(key,value){writes++;store.set(key,String(value));},
}};
const storageKey='frontier-bgs-events:wolf-test';
const verifiedCycle={orders:[{
  id:'consortium-order',task:'Complete about 25 INF for The Consortium',
  system,faction,status:'active',createdAt:'2026-10-07T18:00:00Z',
  reporting:{type:'inf',target:25},
  workCycle:{cycleId:'2026-10-08-test',cycleStartedAt:'2026-10-07T23:00:00Z',cycleEndsAt:'2026-10-08T23:00:00Z'},
}]};
const matchedINF=events=>matchVerifiedActivity(events,verifiedCycle).orderTotals
  .reduce((acc,row)=>acc+row.contribution,0);

// New Scout-first and Frontier-first uploads must never inflate totals.
const realtime=await mergeEventsWithResult(env,'wolf-test',scout.events,[],{lastScoutActivityAt:scout.lastActivityAt});
assert.equal(realtime.added,5);
assert.equal(matchedINF(realtime.events),22);
const confirmed=await mergeEventsWithResult(env,'wolf-test',capi.events);
assert.equal(confirmed.added,0,'Frontier must replace, not duplicate, Scout mission records');
assert.equal(confirmed.updated,5);
assert.equal(confirmed.events.length,5);
assert.equal(matchedINF(confirmed.events),22);
assert.ok(confirmed.events.every(row=>row.provisional!==true));
const writesAfterConfirmation=writes;
const retried=await mergeEventsWithResult(env,'wolf-test',scout.events);
assert.equal(retried.eventChanged,false,'Retrying Scout must not downgrade Frontier-confirmed work');
assert.equal(writes,writesAfterConfirmation,'Identical mission retries should not cause more KV writes');

const capiFirst=await mergeEventsWithResult(env,'other-user',capi.events);
const scoutAfter=await mergeEventsWithResult(env,'other-user',scout.events);
assert.equal(scoutAfter.added,0);
assert.equal(scoutAfter.updated,0);
assert.equal(totals(scoutAfter.events),22);
assert.ok(scoutAfter.events.every(row=>row.provisional!==true),'CAPI is authoritative regardless of arrival order');

// Historical data may already contain both formats with different old hashes.
// Next Frontier sync must canonicalize and repair the stored records even if
// the new journal contains *zero* mission events.
const alreadyDuplicated=[
  ...scout.events.map((row,i)=>({...row,id:'legacy-scout-'+i})),
  ...capi.events.map((row,i)=>({...row,id:'legacy-frontier-'+i})),
];
assert.equal(totals(alreadyDuplicated),44);
store.set(storageKey,JSON.stringify({version:3,events:alreadyDuplicated}));
const repaired=await mergeEventsWithResult(env,'wolf-test',[]);
assert.equal(repaired.changed,true);
assert.equal(repaired.events.length,5);
assert.equal(repaired.removed,5,'Remove the five obsolete duplicate records');
assert.equal(totals(repaired.events),22);
assert.equal(matchedINF(repaired.events),22);
assert.equal((await getEvents(env,'wolf-test')).length,5,'Repair must persist to the authoritative KV event store');
assert.ok(repaired.events.every(row=>row.provisional!==true),'Prefer authoritative Frontier over Scout when repairing legacy duplicates');
assert.ok(store.has(signalKey(HUD_SIGNAL_MISSION_PROGRESS)),'Repair must invalidate cached Mission Control/HUD progress');
const noMoreWork=await mergeEventsWithResult(env,'wolf-test',[]);
assert.equal(noMoreWork.changed,false,'Reconciliation must be idempotent');

// Reversed legacy record order still prefers Frontier, not whichever event
// came last in KV, and the same-second hand-ins for distinct missions remain.
store.set(storageKey,JSON.stringify({version:3,events:[...capi.events,...scout.events]}));
const repairedReverse=await mergeEventsWithResult(env,'wolf-test',[]);
assert.equal(repairedReverse.events.length,5);
assert.ok(repairedReverse.events.every(row=>row.provisional!==true));
assert.equal(totals(repairedReverse.events),22);
const twoSameSecond=[
  {...capi.events[0],missionId:951000,timestamp:'2026-10-08T05:43:13Z'},
  {...capi.events[1],missionId:951001,timestamp:'2026-10-08T05:43:13Z'},
];
const coincident=await mergeEventsWithResult(env,'coincident',twoSameSecond);
assert.equal(coincident.events.length,2,'Distinct mission IDs completed in one second must never be collapsed');

// Activity types other than mission_inf retain the old identity contract.
const unrelated={
  type:'bounties_redeemed',sourceEvent:'RedeemVoucher',
  timestamp:'2026-10-08T05:45:00Z',system,systemAddress,station,amount:8_000_000,
};
const bounties=await mergeEventsWithResult(env,'other-activity',[unrelated]);
assert.equal(bounties.added,1);
const bountyRetry=await mergeEventsWithResult(env,'other-activity',[unrelated]);
assert.equal(bountyRetry.changed,false);

console.log('✓ Scout/CAPI mission INF: 22 not 44, stable MissionID, legacy repair, Frontier priority, distinct same-second missions, existing activity preserved');
