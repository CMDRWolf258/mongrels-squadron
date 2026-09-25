import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSpanshSearchBody,
  extractSpanshCommodityNames,
  normalizeMarketSearch,
  searchTradeMarkets,
} from '../lib/trade-market.js';
import { defaultTradeControl } from '../lib/trade-intelligence.js';

class FakeKV {
  constructor(){this.map=new Map();}
  async get(key,options={}){
    if(!this.map.has(key))return null;
    const value=this.map.get(key);
    return options?.type==='json'?JSON.parse(value):value;
  }
  async put(key,value){this.map.set(key,String(value));}
  async delete(key){this.map.delete(key);}
  async list({prefix=''}){return{keys:[...this.map.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};}
}

const control=defaultTradeControl();
const normalized=normalizeMarketSearch({
  commodity:'Soontil Relics',
  direction:'sell',
  referenceSystem:'Diaba',
  radiusLy:999,
  priority:'critical',
},control);
assert.equal(normalized.commodity,'Soontil Relics');
assert.equal(normalized.commodityKey,'soontilrelics');
assert.equal(normalized.radiusLy,500);
assert.equal(normalized.maxAgeMinutes,90,'blank max age should inherit Critical aging cutoff');

const fixedNow=new Date('2026-09-25T17:30:00.000Z');
const body=buildSpanshSearchBody(normalized,fixedNow);
assert.equal(body.reference_system,'Diaba');
assert.equal(body.filters.distance.max,'500');
assert.ok(body.filters.type.value.includes('Orbis Starport'));
assert.ok(!body.filters.type.value.includes('Drake-Class Carrier'));
assert.ok(body.filters.marketplace[0].commodity.includes('Soontil Relics'));
assert.deepEqual(body.filters.marketplace[0].demand.value,[1,2147483647]);
assert.deepEqual(body.filters.marketplace[0].sell_price.value,[1,2147483647]);
assert.equal(body.filters.market_updated_at.comparison,'<=>');
assert.equal(body.filters.market_updated_at.value[1],fixedNow.toISOString());

const catalogNames=extractSpanshCommodityNames({
  marketplace:{
    commodity:['Gold','Platinum','Lavian Brandy','Soontil Relics','Eden Apples of Aerial'],
  },
});
assert.deepEqual(catalogNames,['Eden Apples of Aerial','Gold','Lavian Brandy','Platinum','Soontil Relics']);

const now=Date.now();
const rows=[
  {
    id:'1001',
    market_id:'1001',
    name:'Fresh Large Port',
    type:'Coriolis Starport',
    distance_to_arrival:400,
    large_pads:4,medium_pads:6,small_pads:8,
    system_id64:'123',
    system_name:'Alpha',
    system_x:1,system_y:2,system_z:3,
    carrier_docking_access:null,
    market_updated_at:new Date(now-25*60*1000).toISOString(),
    distance:12,
    market:[{commodity:'Gold',buy_price:42000,sell_price:70000,supply:5000,demand:25000}],
  },
  {
    id:'1002',
    market_id:'1002',
    name:'Too Old Port',
    type:'Orbis Starport',
    distance_to_arrival:1200,
    large_pads:2,medium_pads:4,small_pads:6,
    system_id64:'124',
    system_name:'Beta',
    system_x:4,system_y:5,system_z:6,
    carrier_docking_access:null,
    market_updated_at:new Date(now-120*60*1000).toISOString(),
    distance:20,
    market:[{commodity:'Gold',buy_price:41000,sell_price:75000,supply:9000,demand:50000}],
  },
  {
    id:'1003',
    market_id:'1003',
    name:'Medium Port',
    type:'Outpost',
    distance_to_arrival:300,
    large_pads:0,medium_pads:1,small_pads:2,
    system_id64:'125',
    system_name:'Gamma',
    system_x:7,system_y:8,system_z:9,
    carrier_docking_access:null,
    market_updated_at:new Date(now-10*60*1000).toISOString(),
    distance:8,
    market:[{commodity:'Gold',buy_price:40000,sell_price:80000,supply:12000,demand:60000}],
  },
];

let requestedUrl='';
let requestedOptions=null;
const fetchImpl=async (input,options={})=>{
  requestedUrl=String(input);
  requestedOptions=options;
  return new Response(JSON.stringify({count:3,results:rows}),{status:200,headers:{'Content-Type':'application/json'}});
};

const env={TRADES:new FakeKV()};
const sell=await searchTradeMarkets(env,{
  commodity:'Gold',
  direction:'sell',
  referenceSystem:'Diaba',
  radiusLy:100,
  minVolume:10000,
  price:65000,
  minPad:3,
  carrierMode:'exclude',
  maxAgeMinutes:90,
  priority:'critical',
  sort:'price',
  limit:50,
},{fetchImpl});

assert.equal(requestedUrl,'https://spansh.co.uk/api/stations/search');
assert.equal(requestedOptions.method,'POST');
const sent=JSON.parse(requestedOptions.body);
assert.equal(sent.reference_system,'Diaba');
assert.equal(sent.filters.distance.max,'100');
assert.deepEqual(sent.filters.marketplace[0].demand.value,[10000,2147483647]);
assert.deepEqual(sent.filters.marketplace[0].sell_price.value,[65000,2147483647]);
assert.equal(sell.source,'Spansh');
assert.equal(sell.sourceResultCount,3);
assert.equal(sell.results.length,1);
assert.equal(sell.results[0].stationName,'Fresh Large Port');
assert.equal(sell.results[0].freshness,'fresh');
assert.equal(sell.results[0].sellPrice,70000);

const cache=await env.TRADES.get('trade-market-observations-v1:gold',{type:'json'});
assert.equal(cache.items.length,3,'all source observations should be retained in the commodity cache');
const health=await env.TRADES.get('trade-market-health-v1',{type:'json'});
assert.equal(health.lastReturnedCount,1);
assert.equal(health.lastStoredCount,3);
assert.equal(health.source,'Spansh');

const buy=await searchTradeMarkets(env,{
  commodity:'Gold',
  direction:'buy',
  referenceSystem:'Diaba',
  radiusLy:100,
  minVolume:4000,
  price:43000,
  minPad:2,
  carrierMode:'include',
  maxAgeMinutes:180,
  priority:'standard',
  sort:'price',
},{fetchImpl});
const buyBody=JSON.parse(requestedOptions.body);
assert.ok(buyBody.filters.type.value.includes('Drake-Class Carrier'));
assert.deepEqual(buyBody.filters.marketplace[0].supply.value,[4000,2147483647]);
assert.deepEqual(buyBody.filters.marketplace[0].buy_price.value,[1,43000]);
assert.equal(buy.results[0].stationName,'Medium Port','buy results should sort by lowest commander buy price');

let timeoutCalls=0;
const timeoutFetch=async ()=>{
  timeoutCalls+=1;
  const error=new Error('aborted');
  error.name='AbortError';
  throw error;
};
const cached=await searchTradeMarkets(env,{
  commodity:'Gold',
  direction:'sell',
  referenceSystem:'Diaba',
  radiusLy:100,
  minVolume:10000,
  price:65000,
  minPad:3,
  carrierMode:'exclude',
  maxAgeMinutes:90,
  priority:'critical',
  sort:'price',
},{fetchImpl:timeoutFetch});
assert.equal(timeoutCalls,1);
assert.equal(cached.cached,true);
assert.equal(cached.source,'Mongrel Market Cache');
assert.match(cached.warning,/Mongrel market cache/);
assert.equal(cached.results[0].stationName,'Fresh Large Port');

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/Live Market Intelligence/);
assert.match(html,/data-trade-market-form/);
assert.match(html,/role="combobox"/);
assert.match(html,/data-market-commodity-menu/);
assert.match(html,/Standard and rare commodities use the same searchable list/);
assert.match(html,/Spansh Adapter Ready/);
assert.match(html,/Spansh → normalized Mongrel market cache/);
assert.match(html,/data-market-result-tools/);
assert.match(html,/Sort displayed results/);
assert.match(html,/Shortest arrival/);
assert.match(html,/data-market-pagination/);
assert.match(html,/trade-market\.css\?v=5/);
assert.match(html,/trade-market\.js\?v=7/);
assert.match(html,/trading\.js\?v=76/);

const client=readFileSync(new URL('../js/trade-market.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-market\/search/);
assert.match(client,/mongrels-trade-market-search-v1/);
assert.match(client,/MongrelTradeMarket/);
assert.match(client,/function commodityMatches\(term\)/);
assert.match(client,/function validateCommoditySelection\(\)/);
assert.match(client,/ArrowDown/);
assert.match(client,/includesRares/);
assert.match(client,/const PAGE_SIZE=10/);
assert.match(client,/limit:100/);
assert.match(client,/function sortedResults\(\)/);
assert.match(client,/arrival:\(a,b\)=>arrivalOf\(a\)-arrivalOf\(b\)/);
assert.match(client,/Showing '\+first\+'–'\+last\+' of /);

const tradeClient=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(tradeClient,/Spansh Adapter Ready/);
assert.match(tradeClient,/health\.source/);

const searchApi=readFileSync(new URL('../functions/api/trade-market/search.js',import.meta.url),'utf8');
assert.match(searchApi,/member','officer','site_admin/);
assert.match(searchApi,/searchTradeMarkets/);

console.log('Trade market search smoke checks passed.');
