import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeTradeWatch,
  readTradeWatches,
  watchQuerySummary,
  writeTradeWatches,
} from '../lib/trade-watches.js';

class FakeKV {
  constructor(){this.map=new Map();}
  async get(key,options={}){
    if(!this.map.has(key))return null;
    const value=this.map.get(key);
    return options?.type==='json'?JSON.parse(value):value;
  }
  async put(key,value){this.map.set(key,String(value));}
}

const query={
  commodity:'Soontil Relics',
  direction:'sell',
  referenceSystem:'Diaba',
  radiusLy:100,
  minVolume:400,
  price:0,
  minPad:0,
  carrierMode:'exclude',
  maxAgeMinutes:90,
  priority:'critical',
  sort:'price',
  limit:100,
};

const watch=normalizeTradeWatch({
  id:'12345678-abcd-4321-abcd-123456789012',
  name:'Soontil Powerplay Trigger',
  query,
  status:'active',
  createdById:'111111111111111111',
  createdByName:'CMDR Wolf258',
  createdAt:'2026-09-25T18:00:00.000Z',
  updatedAt:'2026-09-25T18:00:00.000Z',
  evaluation:{state:'pending_scheduler'},
  discord:{publish:true},
});
assert.ok(watch);
assert.equal(watch.status,'active');
assert.equal(watch.query.priority,'critical');
assert.equal(watch.evaluation.state,'pending_scheduler');
assert.equal(watch.discord.publish,true);
assert.match(watchQuerySummary(watch),/Soontil Relics/);
assert.match(watchQuerySummary(watch),/400 t demand/);

const rareBuyWatch=normalizeTradeWatch({
  ...watch,
  id:'87654321-abcd-4321-abcd-210987654321',
  query:{...query,direction:'buy',radiusLy:5,minVolume:1},
});
assert.match(watchQuerySummary(rareBuyWatch),/all distances/,'rare buy Watch summary must not imply a limiting radius');

const env={TRADES:new FakeKV()};
await writeTradeWatches(env,[watch]);
const stored=await readTradeWatches(env);
assert.equal(stored.length,1);
assert.equal(stored[0].name,'Soontil Powerplay Trigger');
assert.equal(stored[0].query.minVolume,400);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/Save as Watch/);
assert.match(html,/data-trade-watch-form/);
assert.match(html,/data-trade-watch-commodity/);
assert.match(html,/data-trade-watch-price/);
assert.match(html,/data-trade-watch-volume/);
assert.match(html,/inputmode="numeric"[^>]*data-trade-watch-price/);
assert.match(html,/inputmode="numeric"[^>]*data-trade-watch-volume/);
assert.match(html,/data-trade-watch-radius/);
assert.match(html,/data-trade-watch-age/);
assert.match(html,/data-trade-watch-carriers/);
assert.match(html,/data-trade-watch-sort/);
assert.match(html,/evaluated automatically on their assigned priority cadence/);
assert.match(html,/data-trade-watch-list/);
assert.match(html,/trade-market\.css\?v=7/);
assert.match(html,/trade-control\.css\?v=9/);
assert.match(html,/trade-market\.js\?v=10/);
assert.match(html,/trading\.js\?v=82/);

const marketClient=readFileSync(new URL('../js/trade-market.js',import.meta.url),'utf8');
assert.match(marketClient,/data-trade-watch-editor/);
assert.match(marketClient,/\/api\/trade-watches/);
assert.match(marketClient,/mongrels:trade-watch-saved/);
assert.match(marketClient,/officer','site_admin/);
assert.match(marketClient,/loadQuery/);
assert.match(marketClient,/editWatch/);
assert.match(marketClient,/watchQueryFromEditor/);
assert.match(marketClient,/action:'edit'/);
assert.match(marketClient,/Updating watch/);
assert.match(marketClient,/if\(summaryRow\)summaryRow\.hidden=false/,'Save as Watch must work even when result count is zero');

const tradingClient=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(tradingClient,/loadTradeWatches/);
assert.match(tradingClient,/const fmtLy = value =>/);
assert.match(tradingClient,/Pending Scheduler/);
assert.match(tradingClient,/Run Now/);
assert.match(tradingClient,/data-watch-edit/);
assert.match(tradingClient,/editWatch\(watch\)/);
assert.match(tradingClient,/Load Search/);
assert.match(tradingClient,/Pause/);
assert.match(tradingClient,/Resume/);
assert.match(tradingClient,/Remove/);

const api=readFileSync(new URL('../functions/api/trade-watches/index.js',import.meta.url),'utf8');
assert.match(api,/const MANAGER_ACCESS=new Set\(\['officer','site_admin'\]\)/);
assert.match(api,/officer_access_required/);
assert.match(api,/X-Mongrels-Request/);
assert.match(api,/pending_scheduler/);
assert.match(api,/action==='edit'/);
assert.match(api,/current\.query=queryResult\.query/);
assert.match(api,/currentBest:null/,'editing criteria must reset prior evaluation state');
assert.doesNotMatch(api,/member','officer','site_admin/,'regular Members must not be authorized to manage watches');

console.log('Trade watch smoke checks passed.');
