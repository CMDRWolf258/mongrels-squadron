import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  detectTradeWatchTransition,
  evaluateTradeWatches,
  tradeWatchIsDue,
  watchDueAt,
  RARE_SOURCE_WATCH_TIME_ZONE,
  RARE_SOURCE_WATCH_START_HOUR,
  RARE_SOURCE_WATCH_END_HOUR,
} from '../lib/trade-watch-evaluator.js';
import {
  normalizeTradeWatch,
  readTradeWatches,
  writeTradeWatches,
} from '../lib/trade-watches.js';
import { defaultTradeControl } from '../lib/trade-intelligence.js';

class FakeKV {
  constructor(){this.map=new Map();}
  async get(key,options={}){
    if(!this.map.has(key))return null;
    const value=this.map.get(key);
    return options?.type==='json'?JSON.parse(value):value;
  }
  async put(key,value){this.map.set(key,String(value));}
}

const baseNow=Date.now();
const env={TRADES:new FakeKV()};
const watch=normalizeTradeWatch({
  id:'12345678-abcd-4321-abcd-123456789012',
  name:'Gold CG supply',
  status:'active',
  query:{
    commodity:'Gold',
    direction:'sell',
    referenceSystem:'Diaba',
    radiusLy:100,
    minVolume:1,
    price:65000,
    minPad:0,
    carrierMode:'exclude',
    maxAgeMinutes:90,
    priority:'critical',
    sort:'price',
    limit:100,
  },
  createdById:'111111111111111111',
  createdByName:'CMDR Wolf258',
  createdAt:new Date(baseNow-60000).toISOString(),
  updatedAt:new Date(baseNow-60000).toISOString(),
  evaluation:{state:'pending_scheduler'},
  discord:{publish:true},
});
await writeTradeWatches(env,[watch]);

let rows=[
  {
    id:'1001',
    market_id:'1001',
    name:'Best Gold Port',
    type:'Coriolis Starport',
    distance_to_arrival:400,
    large_pads:4,medium_pads:4,small_pads:4,
    system_id64:'123',
    system_name:'Alpha',
    system_x:1,system_y:2,system_z:3,
    carrier_docking_access:null,
    controlling_minor_faction:'Alpha Trade Cooperative',
    controlling_minor_faction_state:'Boom',
    primary_economy:'Industrial',
    secondary_economy:'Refinery',
    updated_at:new Date(baseNow-30*60*1000).toISOString(),
    market_updated_at:new Date(baseNow-60000).toISOString(),
    distance:12,
    market:[{commodity:'Gold',category:'Metals',buy_price:42000,sell_price:70000,supply:5000,demand:25000}],
  },
  {
    id:'1002',
    market_id:'1002',
    name:'Second Gold Port',
    type:'Orbis Starport',
    distance_to_arrival:600,
    large_pads:4,medium_pads:4,small_pads:4,
    system_id64:'124',
    system_name:'Beta',
    system_x:4,system_y:5,system_z:6,
    carrier_docking_access:null,
    market_updated_at:new Date(baseNow-90000).toISOString(),
    distance:18,
    market:[{commodity:'Gold',buy_price:41000,sell_price:68000,supply:4000,demand:20000}],
  },
  {
    id:'1003',
    market_id:'1003',
    name:'Third Gold Port',
    type:'Coriolis Starport',
    distance_to_arrival:800,
    large_pads:4,medium_pads:4,small_pads:4,
    system_id64:'125',
    system_name:'Gamma',
    system_x:7,system_y:8,system_z:9,
    carrier_docking_access:null,
    market_updated_at:new Date(baseNow-120000).toISOString(),
    distance:24,
    market:[{commodity:'Gold',buy_price:40000,sell_price:66000,supply:3000,demand:15000}],
  },
];

const fetchImpl=async ()=>new Response(JSON.stringify({count:rows.length,results:rows}),{
  status:200,
  headers:{'Content-Type':'application/json'},
});

const first=await evaluateTradeWatches(env,{
  now:baseNow,
  fetchImpl,
  maxWatches:6,
  concurrency:1,
});
assert.equal(first.attempted,1);
assert.equal(first.succeeded,1);
assert.equal(first.failed,0);
assert.equal(first.results[0].transition,'baseline');
assert.equal(first.results[0].matchCount,3);

let stored=(await readTradeWatches(env))[0];
assert.equal(stored.evaluation.state,'healthy');
assert.equal(stored.evaluation.matchCount,3);
assert.equal(stored.evaluation.currentBest.marketId,'1001');
assert.equal(stored.evaluation.currentBest.price,70000);
assert.equal(stored.evaluation.currentBest.volume,25000);
assert.equal(stored.evaluation.currentBest.bgs.controllingFaction,'Alpha Trade Cooperative');
assert.equal(stored.evaluation.currentBest.bgs.factionState,'Boom');
assert.equal(stored.evaluation.currentBest.bgs.metalCommodity,true);
assert.equal(stored.evaluation.rankedMarkets.length,3);
assert.deepEqual(stored.evaluation.rankedMarkets.map(item=>item.marketId),['1001','1002','1003']);
assert.equal(stored.evaluation.rankedMarkets[1].rank,2);
assert.equal(stored.evaluation.lastTransition.type,'baseline');
assert.equal(Date.parse(stored.evaluation.nextEvaluationAt),baseNow+5*60*1000);

const control=defaultTradeControl();
assert.equal(tradeWatchIsDue(stored,control,baseNow+4*60*1000),false);
assert.equal(tradeWatchIsDue(stored,control,baseNow+5*60*1000),true);
assert.equal(watchDueAt(stored,control),baseNow+5*60*1000);

assert.equal(RARE_SOURCE_WATCH_TIME_ZONE,'America/Chicago');
assert.equal(RARE_SOURCE_WATCH_START_HOUR,13);
assert.equal(RARE_SOURCE_WATCH_END_HOUR,20);
const rareScheduleWatch=normalizeTradeWatch({
  id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  name:'Rare source timer',
  status:'active',
  query:{
    commodity:'Soontill Relics',
    direction:'buy',
    referenceSystem:'Diaba',
    radiusLy:200,
    minVolume:1,
    minPad:0,
    carrierMode:'exclude',
    maxAgeMinutes:2880,
    priority:'critical',
    sort:'price',
    limit:100,
  },
  createdById:'111111111111111111',
  createdByName:'CMDR Wolf258',
  createdAt:'2026-09-26T17:00:00.000Z',
  updatedAt:'2026-09-26T17:00:00.000Z',
  evaluation:{lastAttemptAt:'2026-09-26T18:02:00.000Z'},
  discord:{publish:true},
});
assert.equal(tradeWatchIsDue(rareScheduleWatch,control,Date.parse('2026-09-26T18:55:00.000Z')),false,'rare Watch should run only once in the 1 PM Central hour');
assert.equal(watchDueAt(rareScheduleWatch,control,Date.parse('2026-09-26T18:55:00.000Z')),Date.parse('2026-09-26T19:00:00.000Z'),'next rare slot should be 2 PM Central');
assert.equal(tradeWatchIsDue(rareScheduleWatch,control,Date.parse('2026-09-26T19:02:00.000Z')),true,'rare Watch should become due in the next hourly slot');

const rareAfterWindow=normalizeTradeWatch({
  ...rareScheduleWatch,
  evaluation:{lastAttemptAt:'2026-09-27T01:02:00.000Z'},
});
assert.equal(tradeWatchIsDue(rareAfterWindow,control,Date.parse('2026-09-27T02:02:00.000Z')),false,'rare Watch should sleep after the 8 PM Central slot');
assert.equal(watchDueAt(rareAfterWindow,control,Date.parse('2026-09-27T02:02:00.000Z')),Date.parse('2026-09-27T18:00:00.000Z'),'rare Watch should resume at 1 PM Central next day');

const rareCst=normalizeTradeWatch({
  ...rareScheduleWatch,
  evaluation:{lastAttemptAt:'2026-11-01T20:02:00.000Z'},
});
assert.equal(watchDueAt(rareCst,control,Date.parse('2026-11-02T18:55:00.000Z')),Date.parse('2026-11-02T19:00:00.000Z'),'rare timer should follow Central DST/CST automatically');

const early=await evaluateTradeWatches(env,{
  now:baseNow+4*60*1000,
  fetchImpl,
});
assert.equal(early.attempted,0,'Critical watch must not rerun before its 5-minute cadence');

rows=rows.slice(1);
const promoted=await evaluateTradeWatches(env,{
  now:baseNow+5*60*1000,
  fetchImpl,
  concurrency:1,
});
assert.equal(promoted.attempted,1);
assert.equal(promoted.results[0].transition,'best_market_changed');
stored=(await readTradeWatches(env))[0];
assert.equal(stored.evaluation.currentBest.marketId,'1002','next ranked market should automatically promote when #1 disappears');
assert.deepEqual(stored.evaluation.rankedMarkets.map(item=>item.marketId),['1002','1003']);
assert.equal(stored.evaluation.lastTransition.type,'best_market_changed');

rows=[];
const cleared=await evaluateTradeWatches(env,{
  now:baseNow+10*60*1000,
  fetchImpl,
  concurrency:1,
});
assert.equal(cleared.attempted,1);
assert.equal(cleared.results[0].transition,'condition_cleared');
stored=(await readTradeWatches(env))[0];
assert.equal(stored.evaluation.matchCount,0);
assert.equal(stored.evaluation.currentBest,null);
assert.deepEqual(stored.evaluation.rankedMarkets,[]);
assert.equal(stored.evaluation.lastTransition.type,'condition_cleared');

const rareEnv={TRADES:new FakeKV()};
const rareWatch=normalizeTradeWatch({
  id:'87654321-abcd-4321-abcd-210987654321',
  name:'Soontill Relics stock',
  status:'active',
  query:{
    commodity:'Soontill Relics',
    direction:'buy',
    referenceSystem:'Diaba',
    radiusLy:200,
    minVolume:1,
    price:0,
    minPad:0,
    carrierMode:'exclude',
    maxAgeMinutes:2880,
    priority:'critical',
    sort:'price',
    limit:100,
  },
  createdById:'111111111111111111',
  createdByName:'CMDR Wolf258',
  createdAt:new Date(baseNow-20*60*1000).toISOString(),
  updatedAt:new Date(baseNow-20*60*1000).toISOString(),
  evaluation:{
    state:'healthy',
    lastEvaluatedAt:new Date(baseNow-10*60*1000).toISOString(),
    lastSuccessfulAt:new Date(baseNow-10*60*1000).toISOString(),
    matchCount:1,
    currentBest:{marketId:'rare-555',stationName:'Cheranovsky City',systemName:'Ngurii'},
  },
  discord:{publish:true},
});
await writeTradeWatches(rareEnv,[rareWatch]);
const rareZeroRow=[{
  id:'rare-555',
  market_id:'rare-555',
  name:'Cheranovsky City',
  type:'Coriolis Starport',
  distance_to_arrival:500,
  large_pads:4,medium_pads:4,small_pads:4,
  system_id64:'987',
  system_name:'Ngurii',
  system_x:10,system_y:20,system_z:30,
  market_updated_at:new Date(baseNow-60000).toISOString(),
  distance:250,
  market:[{commodity:'Soontill Relics',category:'Consumer Items',buy_price:19700,sell_price:0,supply:0,demand:0}],
}];
const rareCleared=await evaluateTradeWatches(rareEnv,{
  now:baseNow,
  force:true,
  concurrency:1,
  fetchImpl:async ()=>new Response(JSON.stringify({count:1,results:rareZeroRow}),{status:200,headers:{'Content-Type':'application/json'}}),
});
assert.equal(rareCleared.results[0].transition,'condition_cleared');
assert.equal(rareCleared.results[0].matchCount,0,'visible known source must not count as qualifying stock');
const rareStored=(await readTradeWatches(rareEnv))[0];
assert.equal(rareStored.evaluation.currentBest,null);
assert.equal(rareStored.evaluation.knownRareSource.stationName,'Cheranovsky City');
assert.equal(rareStored.evaluation.knownRareSource.volume,0);
assert.equal(rareStored.evaluation.knownRareSource.rareSourceStatus,'no_observed_stock');

const transition=detectTradeWatchTransition({
  matchCount:1,
  currentBest:{marketId:'1001'},
  lastSuccessfulAt:new Date(baseNow).toISOString(),
},{
  matchCount:1,
  currentBest:{marketId:'2002'},
  at:new Date(baseNow+10*60*1000).toISOString(),
});
assert.equal(transition.type,'best_market_changed');

const workflow=readFileSync(new URL('../.github/workflows/evaluate-trade-watches.yml',import.meta.url),'utf8');
assert.match(workflow,/2-57\/5 \* \* \* \*/);
assert.match(workflow,/TRADE_WATCH_CRON_TOKEN/);
assert.match(workflow,/SCOUT_DISCORD_CRON_TOKEN/);
assert.match(workflow,/api\/internal\/trade-watch-evaluate/);
const internalApi=readFileSync(new URL('../functions/api/internal/trade-watch-evaluate.js',import.meta.url),'utf8');
assert.match(internalApi,/evaluateTradeWatches/);
assert.match(internalApi,/TRADE_WATCH_CRON_TOKEN/);
assert.match(internalApi,/invalid_cron_token/);

const manualApi=readFileSync(new URL('../functions/api/trade-watches/evaluate.js',import.meta.url),'utf8');
assert.match(manualApi,/officer','site_admin/);
assert.match(manualApi,/trade-watch-evaluate/);
assert.match(manualApi,/force:true/);
assert.match(manualApi,/watchIds:\[id\]/);

const client=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(client,/Run Now/);
assert.match(client,/Hourly · 1–8 PM CT/,'Trader UI should expose the rare-source cadence');
assert.match(client,/\/api\/trade-watches\/evaluate/);
assert.match(client,/Current Best/);
assert.match(client,/Fallback Markets/);
assert.match(client,/Known Rare Source/);
assert.match(client,/rankedMarkets/);
assert.match(client,/Infrastructure Failure metal source/);
assert.match(client,/Ownership needs confirmation/);
assert.match(client,/condition_met/);
assert.match(client,/setInterval\(\(\)=>\{if\(manager\(\)&&!document\.hidden\)loadTradeWatches\(\);\},60000\)/);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/evaluated automatically on their assigned priority cadence/);
assert.match(html,/five-minute floor/);
assert.match(html,/trade-control\.css\?v=10/);
assert.match(html,/trade-market\.js\?v=14/);
assert.match(html,/trading\.js\?v=86/);

console.log('Trade Watch evaluator smoke checks passed.');
