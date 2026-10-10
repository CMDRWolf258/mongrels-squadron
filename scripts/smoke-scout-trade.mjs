import assert from 'node:assert/strict';
import { normalizeScoutActivityBatch } from '../lib/scout-activity.js';
import { mergeEventsWithResult, parseJournal, summarizeEvents } from '../lib/frontier.js';

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
// The loaded Panther Mk II sold a single commodity in 300t chunks.
// Several consecutive transactions can have identical prices, count and
// journal timestamps (Frontier logs only whole seconds). They are not retries.
const sameSecond='2026-10-08T03:56:10Z';
const buyAndSell=[
  {timestamp:'2026-10-08T03:40:00Z',event:'Location',StarSystem:'Diaba',
    SystemAddress:560820275507,Docked:true,StationName:'Niijima Station',
    StationType:'Orbis',StationFaction:{Name:'Regiment of Imperial Mongrels'}},
  {timestamp:'2026-10-08T03:41:00Z',event:'MarketBuy',Type:'$Gold_Name;',Count:1234,
    BuyPrice:125000,TotalCost:154250000},
  ...[300,300,300,334].map((count,i)=>({
    timestamp:i<3?sameSecond:'2026-10-08T03:56:12Z',
    event:'MarketSell',Type:'$Gold_Name;',Type_Localised:'Gold',Count:count,
    SellPrice:150000,TotalSale:count*150000,AvgPricePaid:125000,
  })),
];
const journal=parseJournal(buyAndSell.map(x=>JSON.stringify(x)).join('\n'),['Diaba']);
const capiSales=journal.events.filter(x=>x.type==='market_sell');
assert.equal(capiSales.length,4);
assert.deepEqual(capiSales.map(x=>x.saleOccurrence),[1,2,3,1]);
assert.ok(capiSales.every(x=>x.bgsTradeEligible===true));
const scoutSales=[300,300,300,334].map((count,i)=>({
  ...source,timestamp:i<3?sameSecond:'2026-10-08T03:56:12Z',
  count,total:count*150000,sellPrice:150000,saleOccurrence:i<3?i+1:1,
}));
const normalized=normalizeScoutActivityBatch({kind:'activity_batch',events:scoutSales},
  auth,{now:Date.parse('2026-10-08T04:00:00Z')}).events;
assert.equal(normalized.length,4);
assert.deepEqual(normalized.map(x=>x.saleOccurrence),[1,2,3,1]);
const lotStore=new Map();
const lotEnv={DAILY_ORDERS:{
  async get(k,{type}={}){const raw=lotStore.get(k);return raw===undefined?null:(type==='json'?JSON.parse(raw):raw);},
  async put(k,v){lotStore.set(k,String(v));},
}};
const saved=await mergeEventsWithResult(lotEnv,'panther',[...normalized]);
assert.equal(saved.added,4,'Same-second 300t sales must all receive unique identity');
assert.equal(summarizeEvents(saved.events).tradeEligibleProfit,30850000);
const confirmed=await mergeEventsWithResult(lotEnv,'panther',capiSales);
assert.equal(confirmed.added,0,'CAPI sync must not double count provisional trade');
assert.equal(confirmed.events.length,4);
assert.ok(confirmed.events.every(x=>x.provisional!==true));
assert.equal(summarizeEvents(confirmed.events).tradeEligibleProfit,30850000);
const afterRetry=await mergeEventsWithResult(lotEnv,'panther',normalized);
assert.equal(afterRetry.changed,false,'Late Scout retries must not overwrite confirmed CAPI sales');
assert.equal(afterRetry.events.length,4);
assert.equal(rows({...source,saleOccurrence:0}).length,0,'Reject invalid sale ordinal');
assert.equal(rows({...source,saleOccurrence:129}).length,0,'Reject excessive sale ordinal');
console.log('Scout trade duplicate 300t chunks, 30.85M profit and CAPI reconciliation passed');
