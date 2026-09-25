import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildEdDataSearchUrl,
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
assert.equal(normalized.commodity,'soontilrelics');
assert.equal(normalized.radiusLy,500);
assert.equal(normalized.maxAgeMinutes,90,'blank max age should inherit Critical aging cutoff');

const url=buildEdDataSearchUrl(normalized);
assert.match(url,/soontilrelics\/nearby\/imports/);
assert.match(url,/maxDistance=500/);
assert.match(url,/maxDaysAgo=1/);
assert.match(url,/fleetCarriers=false/);

const now=Date.now();
const rows=[
  {
    commodityName:'gold',
    marketId:1001,
    stationName:'Fresh Large Port',
    stationType:'Coriolis',
    distanceToArrival:400,
    maxLandingPadSize:3,
    systemAddress:'123',
    systemName:'Alpha',
    systemX:1,systemY:2,systemZ:3,
    carrierDockingAccess:'',
    buyPrice:42000,
    demand:25000,
    sellPrice:70000,
    stock:5000,
    updatedAt:new Date(now-25*60*1000).toISOString(),
    distance:12,
  },
  {
    commodityName:'gold',
    marketId:1002,
    stationName:'Too Old Port',
    stationType:'Orbis',
    distanceToArrival:1200,
    maxLandingPadSize:3,
    systemAddress:'124',
    systemName:'Beta',
    systemX:4,systemY:5,systemZ:6,
    carrierDockingAccess:'',
    buyPrice:41000,
    demand:50000,
    sellPrice:75000,
    stock:9000,
    updatedAt:new Date(now-120*60*1000).toISOString(),
    distance:20,
  },
  {
    commodityName:'gold',
    marketId:1003,
    stationName:'Medium Port',
    stationType:'Outpost',
    distanceToArrival:300,
    maxLandingPadSize:2,
    systemAddress:'125',
    systemName:'Gamma',
    systemX:7,systemY:8,systemZ:9,
    carrierDockingAccess:'',
    buyPrice:40000,
    demand:60000,
    sellPrice:80000,
    stock:12000,
    updatedAt:new Date(now-10*60*1000).toISOString(),
    distance:8,
  },
];

let requestedUrl='';
const fetchImpl=async input=>{
  requestedUrl=String(input);
  return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
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

assert.match(requestedUrl,/gold\/nearby\/imports/);
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
assert.equal(health.source,'EDData / EDDN');

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
assert.match(requestedUrl,/gold\/nearby\/exports/);
assert.match(requestedUrl,/maxPrice=43000/);
assert.doesNotMatch(requestedUrl,/fleetCarriers=/,'include should leave the Fleet Carrier filter unset');
assert.equal(buy.results[0].stationName,'Medium Port','buy results should sort by lowest buy price');

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/Live Market Intelligence/);
assert.match(html,/data-trade-market-form/);
assert.match(html,/data-market-commodity/);
assert.match(html,/Maximum data age/);
assert.match(html,/trade-market\.css\?v=1/);
assert.match(html,/trade-market\.js\?v=1/);

const client=readFileSync(new URL('../js/trade-market.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-market\/search/);
assert.match(client,/\/api\/trade-market\/commodities/);
assert.match(client,/mongrels-trade-market-search-v1/);
assert.match(client,/MongrelTradeMarket/);

const tradeClient=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(tradeClient,/MongrelTradeMarket\?\.activate/);
assert.match(tradeClient,/mongrels:trade-market-search/);

const searchApi=readFileSync(new URL('../functions/api/trade-market/search.js',import.meta.url),'utf8');
assert.match(searchApi,/member','officer','site_admin/);
assert.match(searchApi,/searchTradeMarkets/);

const controlApi=readFileSync(new URL('../functions/api/trade-control/index.js',import.meta.url),'utf8');
assert.match(controlApi,/readTradeMarketHealth/);
assert.match(controlApi,/marketData/);

console.log('Trade market search smoke checks passed.');
