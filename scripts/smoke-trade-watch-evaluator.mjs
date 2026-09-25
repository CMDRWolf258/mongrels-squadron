import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  detectTradeWatchTransition,
  evaluateTradeWatches,
  tradeWatchIsDue,
  watchDueAt,
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

let rows=[{
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
  market_updated_at:new Date(baseNow-60000).toISOString(),
  distance:12,
  market:[{commodity:'Gold',buy_price:42000,sell_price:70000,supply:5000,demand:25000}],
}];

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
assert.equal(first.results[0].matchCount,1);

let stored=(await readTradeWatches(env))[0];
assert.equal(stored.evaluation.state,'healthy');
assert.equal(stored.evaluation.matchCount,1);
assert.equal(stored.evaluation.currentBest.marketId,'1001');
assert.equal(stored.evaluation.currentBest.price,70000);
assert.equal(stored.evaluation.currentBest.volume,25000);
assert.equal(stored.evaluation.lastTransition.type,'baseline');
assert.equal(Date.parse(stored.evaluation.nextEvaluationAt),baseNow+5*60*1000);

const control=defaultTradeControl();
assert.equal(tradeWatchIsDue(stored,control,baseNow+4*60*1000),false);
assert.equal(tradeWatchIsDue(stored,control,baseNow+5*60*1000),true);
assert.equal(watchDueAt(stored,control),baseNow+5*60*1000);

const early=await evaluateTradeWatches(env,{
  now:baseNow+4*60*1000,
  fetchImpl,
});
assert.equal(early.attempted,0,'Critical watch must not rerun before its 5-minute cadence');

rows=[];
const cleared=await evaluateTradeWatches(env,{
  now:baseNow+5*60*1000,
  fetchImpl,
  concurrency:1,
});
assert.equal(cleared.attempted,1);
assert.equal(cleared.results[0].transition,'condition_cleared');
stored=(await readTradeWatches(env))[0];
assert.equal(stored.evaluation.matchCount,0);
assert.equal(stored.evaluation.currentBest,null);
assert.equal(stored.evaluation.lastTransition.type,'condition_cleared');

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
assert.match(client,/\/api\/trade-watches\/evaluate/);
assert.match(client,/Current Best/);
assert.match(client,/condition_met/);
assert.match(client,/setInterval\(\(\)=>\{if\(manager\(\)&&!document\.hidden\)loadTradeWatches\(\);\},60000\)/);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/evaluated automatically on their assigned priority cadence/);
assert.match(html,/five-minute floor/);
assert.match(html,/trade-control\.css\?v=6/);
assert.match(html,/trade-market\.js\?v=7/);
assert.match(html,/trading\.js\?v=76/);

console.log('Trade Watch evaluator smoke checks passed.');
