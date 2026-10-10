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
console.log('Scout live trade server guards, 7M calculation, deduplication and CAPI reconciliation passed');

const exact={...source,systemAddress:'123456789',timestamp:'2026-10-08T03:55:00Z'};
const ordinalRows=[rows({...exact,saleOrdinal:1})[0],rows({...exact,saleOrdinal:2})[0]];
assert.equal(ordinalRows.length,2);
assert.equal(rows({...exact,saleOrdinal:0}).length,0,'Do not allow invalid sale occurrence');
assert.equal(rows({...exact,saleOrdinal:129}).length,0,'Do not allow unbounded sale occurrence');
assert.equal(rows({...exact,saleOrdinal:'bad'}).length,0);
const raw=[
  {timestamp:'2026-10-08T03:50:00Z',event:'Docked',StarSystem:'Diaba',
    SystemAddress:123456789,StationName:'Niijima Station',StationType:'Orbis',
    StationFaction:{Name:'Regiment of Imperial Mongrels'}},
  {timestamp:'2026-10-08T03:51:00Z',event:'MarketBuy',Type:'$Gold_Name;',
    Count:400,BuyPrice:125000,TotalCost:50000000},
  ...[1,2].map(()=>({timestamp:'2026-10-08T03:55:00Z',event:'MarketSell',
    Type:'$Gold_Name;',Type_Localised:'Gold',Count:200,
    TotalSale:32000000,SellPrice:160000,AvgPricePaid:125000})),
];
const frontierRows=parseJournal(raw.map(row=>JSON.stringify(row)).join('\n'),['Diaba']).events;
assert.equal(frontierRows.length,2,'Frontier must preserve two identical same-second journal sale lines');
assert.deepEqual(frontierRows.map(row=>row.saleOrdinal),[1,2]);
assert.deepEqual(frontierRows.map(row=>row.profit),[7000000,7000000]);

const ledger=new Map();
const makeEnv=()=>({DAILY_ORDERS:{
  async get(key,{type}={}){const raw=ledger.get(key);return raw===undefined?null:(type==='json'?JSON.parse(raw):raw);},
  async put(key,value){ledger.set(key,String(value));},
}});
const e=makeEnv();
const liveFirst=await mergeEventsWithResult(e,'wolf-chunks',ordinalRows);
assert.equal(liveFirst.added,2,'Two real chunks must each receive one credit');
assert.equal(summarizeEvents(liveFirst.events).tradeEligibleProfit,14000000);
const confirmed=await mergeEventsWithResult(e,'wolf-chunks',frontierRows);
assert.equal(confirmed.added,0,'Frontier must replace Scout rows rather than duplicate sales');
assert.equal(confirmed.events.length,2,'Scout and Frontier represent the same two sales');
assert.equal(confirmed.events.every(row=>row.provisional!==true),true);
assert.equal(summarizeEvents(confirmed.events).tradeEligibleProfit,14000000);
assert.equal((await mergeEventsWithResult(e,'wolf-chunks',frontierRows)).changed,false,'Re-sync cannot increase trade credit');
assert.equal((await mergeEventsWithResult(e,'wolf-chunks',ordinalRows)).changed,false,'Scout retry cannot overwrite confirmed Frontier');
const distinct=rows({...exact,count:199,total:31840000,saleOrdinal:1})[0];
assert.equal((await mergeEventsWithResult(e,'wolf-chunks',[distinct])).added,1,'Distinct sale volume is a distinct credit');

// Legacy Scout and CAPI records may differ solely by the timestamp format
// or the numeric vs string SystemAddress. Re-key and reconcile them in-place.
const legacy=[
  {...ordinalRows[0],saleOrdinal:undefined,systemAddress:'123456789',timestamp:'2026-10-08T03:55:00.000Z'},
  {...frontierRows[0],saleOrdinal:undefined,timestamp:'2026-10-08T03:55:00Z'},
];
ledger.set('frontier-bgs-events:wolf-legacy',JSON.stringify({events:legacy,version:3}));
const repaired=await mergeEventsWithResult(e,'wolf-legacy',[frontierRows[0]]);
assert.equal(repaired.events.length,1,'Legacy Scout/CAPI duplicate must collapse');
assert.equal(repaired.events[0].provisional!==true,true);
assert.equal(summarizeEvents(repaired.events).tradeProfit,7000000);

// If a Frontier journal has insufficient old purchase history, later
// verified Scout evidence can qualify the exact sale without adding one.
const incomplete={...frontierRows[0],tradeSource:'unknown',
  tradeSourceVerified:false,bgsTradeEligible:false,tradeEligibilityReason:'purchase_provenance_unverified'};
const f=makeEnv();
const unfounded=await mergeEventsWithResult(f,'wolf-proof',[incomplete]);
assert.equal(unfounded.added,1);
const proof=await mergeEventsWithResult(f,'wolf-proof',[ordinalRows[0]]);
assert.equal(proof.events.length,1);
assert.equal(proof.events[0].bgsTradeEligible,true);
assert.equal(proof.events[0].provisional,undefined);
assert.equal((await mergeEventsWithResult(f,'wolf-proof',[incomplete])).events[0].bgsTradeEligible,true);
console.log('Trade split-chunk ordinals, normalized Scout/CAPI IDs, legacy repair, and idempotent sync passed');

const explorationStamp='2026-10-10T02:15:00Z';
const exploration={event:'MultiSellExplorationData',timestamp:explorationStamp,system:'Diaba',
  systemAddress:'123456789',station:'Niijima Station',stationType:'Orbis',
  stationFaction:'Regiment of Imperial Mongrels',amount:5500000,saleOrdinal:1};
const exploreRows=(sale,token=auth)=>normalizeScoutActivityBatch({kind:'activity_batch',events:[sale]},token,
  {now:Date.parse('2026-10-10T03:00:00Z')}).events;
const liveExploration=exploreRows(exploration)[0];
assert.equal(liveExploration.type,'exploration_sale');
assert.equal(liveExploration.amount,5500000);
assert.equal(liveExploration.provisional,true);
assert.equal(liveExploration.stationFaction,exploration.stationFaction);
for(const invalid of [{amount:0},{amount:-1},{amount:'invalid'},{amount:1.5},
  {saleOrdinal:0},{saleOrdinal:129},{station:''},{stationFaction:''},
  {stationType:''},{stationType:'FleetCarrier'},{systemAddress:''},{event:'SellOrganicData'}]){
  assert.equal(exploreRows({...exploration,...invalid}).length,0,'Invalid Cartographics sale '+JSON.stringify(invalid));
}
assert.equal(exploreRows(exploration,{scope:'restricted',allowedSystems:['Miwae']}).length,0);
assert.equal(exploreRows({...exploration,event:'SellExplorationData'}).length,1);
const cartographicsDock={timestamp:'2026-10-10T02:00:00Z',event:'Docked',StarSystem:'Diaba',
  SystemAddress:123456789,StationName:'Niijima Station',StationType:'Orbis',
  StationFaction:{Name:'Regiment of Imperial Mongrels'}};
const cartographicsSale={timestamp:explorationStamp,event:'MultiSellExplorationData',
  TotalEarnings:5500000,BaseValue:5000000,Bonus:500000,
  Discovered:[{SystemName:'Other Sector',NumBodies:12}]};
const cartographicsJournal=[cartographicsDock,cartographicsSale,{...cartographicsSale},
  {timestamp:'2026-10-10T02:15:01Z',event:'SellExplorationData',TotalEarnings:3000000,
   BaseValue:2900000,Bonus:100000}];
const cartographics=parseJournal(cartographicsJournal.map(JSON.stringify).join('\n'),['Diaba']);
assert.equal(cartographics.events.length,3);
assert.deepEqual(cartographics.events.map(e=>e.saleOrdinal),[1,2,1]);
const archive=makeEnv();
const liveTwo=[exploreRows({...exploration,saleOrdinal:1})[0],
  exploreRows({...exploration,saleOrdinal:2})[0]];
const uploaded=await mergeEventsWithResult(archive,'cartographics',liveTwo);
assert.equal(uploaded.added,2);
assert.equal(summarizeEvents(uploaded.events).explorationSales,11000000);
const settled=await mergeEventsWithResult(archive,'cartographics',cartographics.events);
assert.equal(settled.added,1,'One new sale, two Scout confirmations');
assert.equal(settled.events.length,3);
assert.equal(settled.events.every(e=>e.provisional!==true),true);
assert.equal(summarizeEvents(settled.events).explorationSales,14000000);
assert.equal((await mergeEventsWithResult(archive,'cartographics',cartographics.events)).changed,false);
assert.equal((await mergeEventsWithResult(archive,'cartographics',liveTwo)).changed,false);
const legacyStore=makeEnv();
await mergeEventsWithResult(legacyStore,'test-legacy-exploration',[
  {...liveExploration,saleOrdinal:undefined},
  {...cartographics.events[0],saleOrdinal:undefined},
]);
const legacyRepaired=await mergeEventsWithResult(legacyStore,'test-legacy-exploration',[cartographics.events[0]]);
assert.equal(legacyRepaired.events.length,1);
const carrierCartographics=parseJournal([JSON.stringify({...cartographicsDock,StationType:'FleetCarrier'}),
  JSON.stringify(cartographicsSale)].join('\n'),['Diaba']);
assert.equal(carrierCartographics.events.length,0);
assert.equal(carrierCartographics.excluded.length,1);
console.log('Cartographics realtime/Frontier reconciliation, exact-page sale identity and carrier exclusion passed');
