import assert from 'node:assert/strict';
import { normalizeScoutActivityBatch } from '../lib/scout-activity.js';
import { mergeEventsWithResult } from '../lib/frontier.js';

const now=Date.parse('2026-10-08T04:00:00Z');
const source={
  event:'MarketSell',timestamp:'2026-10-08T03:55:00Z',
  system:'Diaba',systemAddress:'560820275507',
  station:'Niijima Station',stationType:'Orbis',stationFaction:'Regiment of Imperial Mongrels',
  commodity:'Gold',count:200,total:32000000,sellPrice:160000,avgPricePaid:125000,
  tradeSource:'station_market',tradeSourceVerified:true,blackMarket:false,stolenGoods:false,
};
const auth={scope:'trusted',allowedSystems:[]};
const rows=(sale,token=auth)=>normalizeScoutActivityBatch({kind:'activity_batch',events:[sale]},token,{now}).events;
const good=rows(source);
assert.equal(good.length,1);
assert.equal(good[0].profit,7000000,'7M profit = total sale minus 200 times 125K cost');
assert.equal(good[0].bgsTradeEligible,true);
assert.equal(good[0].provisional,true);
assert.equal(good[0].stationFaction,source.stationFaction);
assert.equal(good[0].sourceEvent,'MarketSell');
const bad=[
  {tradeSource:'carrier_market'}, {tradeSource:'mined'}, {tradeSource:'mixed'},
  {tradeSourceVerified:false}, {stationType:'FleetCarrier'}, {blackMarket:true},
  {stolenGoods:true}, {stationFaction:''}, {avgPricePaid:0}, {avgPricePaid:undefined},
  {total:20000000}, {count:0}, {commodity:''},
];
for(const change of bad)assert.equal(rows({...source,...change}).length,0,'Must reject '+JSON.stringify(change));
assert.equal(rows(source,{scope:'restricted',allowedSystems:['Miwae']}).length,0);
assert.equal(rows({...source,profit:1_000_000_000})[0].profit,7000000,'Client-supplied profit is untrusted');
assert.equal(rows({...source,bgsTradeEligible:true,tradeSource:'mined'}).length,0,'Client eligibility cannot override mined cargo');
assert.equal(rows({...source,tradeSourceVerified:'true'}).length,0,'Proof must be explicit boolean');

const store=new Map();let puts=0;
const env={DAILY_ORDERS:{
  async get(key,{type}={}){const raw=store.get(key);return raw===undefined?null:(type==='json'?JSON.parse(raw):raw);},
  async put(key,value){puts++;store.set(key,String(value));},
}};
const first=await mergeEventsWithResult(env,'wolf',[good[0]],[],{lastScoutActivityAt:good[0].timestamp});
assert.equal(first.added,1);
assert.ok(puts>=2,'One event and one HUD change signal should be written');
const before=puts;
const duplicate=await mergeEventsWithResult(env,'wolf',[good[0]],[],{lastScoutActivityAt:good[0].timestamp});
assert.equal(duplicate.changed,false);
assert.equal(puts,before,'Duplicate sale cannot add KV writes');
const sync={...good[0]};delete sync.provisional;delete sync.ingestSource;
const reconciled=await mergeEventsWithResult(env,'wolf',[sync]);
assert.equal(reconciled.updated,1,'Frontier confirmation replaces provisional event');
assert.equal(reconciled.events.length,1);
assert.equal(reconciled.events[0].provisional,undefined);
assert.equal(reconciled.events[0].profitKnown,true);
assert.equal(reconciled.events[0].tradeSourceVerified,true);
assert.equal(reconciled.events[0].bgsTradeEligible,true);
console.log('Scout live trade server guards, 7M calculation, deduplication and CAPI reconciliation passed');
