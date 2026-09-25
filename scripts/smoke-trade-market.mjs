import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildSpanshSearchBody,
  buildTradeBgsContext,
  extractSpanshCommodityNames,
  normalizeMarketSearch,
  searchTradeMarkets,
} from '../lib/trade-market.js';
import { defaultTradeControl } from '../lib/trade-intelligence.js';
import { isRareTradeCommodity } from '../lib/trade-rares.js';

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
assert.equal(normalized.commodityKey,'soontillrelics');
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

assert.equal(isRareTradeCommodity('Soontill Relics'),true);
assert.equal(isRareTradeCommodity('Lavian Brandy'),true);
assert.equal(isRareTradeCommodity('Gold'),false);

const rareBuy=normalizeMarketSearch({
  commodity:'Soontill Relics',
  direction:'buy',
  referenceSystem:'Diaba',
  radiusLy:25,
  minVolume:1,
  priority:'critical',
},control);
assert.equal(rareBuy.rareCommodity,true);
assert.equal(rareBuy.rareSourceSearch,true);
assert.equal(rareBuy.radiusLimited,false,'buying a unique-source rare must ignore the user radius');
assert.equal(rareBuy.radiusLy,25,'reference radius value may remain stored for later ordinary searches');
const rareBody=buildSpanshSearchBody(rareBuy,fixedNow);
assert.equal(rareBody.reference_system,'Diaba');
assert.equal('distance' in rareBody.filters,false,'rare-source Spansh query must not include a distance filter');
assert.equal('market_updated_at' in rareBody.filters,false,'rare-source Spansh query must not exclude the unique source by market age');
assert.equal(rareBody.filters.system_name.value,'Ngurii','known unique rare sources should query their source system directly');
assert.equal('marketplace' in rareBody.filters,false,'known source-system lookup should inspect the returned market locally instead of depending on Spansh commodity indexing');
assert.equal(rareBuy.rareSource.stationName,'Cheranovsky City');
assert.equal(rareBuy.commodityKey,'soontillrelics','rare spelling aliases should share one cache key');

const aliasNow=Date.now();
const aliasRows=[{
  id:'rare-1',
  market_id:'rare-1',
  name:'Cheranovsky City',
  type:'Coriolis Starport',
  distance_to_arrival:500,
  large_pads:4,medium_pads:4,small_pads:4,
  system_id64:'987',
  system_name:'Ngurii',
  system_x:10,system_y:20,system_z:30,
  carrier_docking_access:null,
  market_updated_at:new Date(aliasNow-8*60*60*1000).toISOString(),
  distance:250,
  market:[{commodity:'Soontil Relics',category:'Consumer Items',buy_price:19700,sell_price:0,supply:12,demand:0}],
}];
const aliasEnv={TRADES:new FakeKV()};
const aliasSearch=await searchTradeMarkets(aliasEnv,{
  commodity:'Soontill Relics',
  direction:'buy',
  referenceSystem:'Diaba',
  radiusLy:5,
  minVolume:1,
  carrierMode:'exclude',
  maxAgeMinutes:90,
  priority:'critical',
  sort:'price',
},{fetchImpl:async ()=>new Response(JSON.stringify({count:1,results:aliasRows}),{status:200,headers:{'Content-Type':'application/json'}})});
assert.equal(aliasSearch.results.length,1,'two-L Soontill query must match a one-L Spansh market row');
assert.equal(aliasSearch.results[0].stationName,'Cheranovsky City');
assert.equal(aliasSearch.results[0].supply,12);
assert.equal(aliasSearch.results[0].freshness,'stale','unique rare source should remain visible even when its market observation is older than the selected profile cutoff');
assert.equal(aliasSearch.query.rareSource.systemName,'Ngurii');
assert.equal(aliasSearch.query.rareSource.stationName,'Cheranovsky City');
assert.match(aliasSearch.warning,/market-age cutoffs do not exclude the unique source/);

const legacyRareEnv={TRADES:new FakeKV()};
await legacyRareEnv.TRADES.put('trade-market-observations-v1:soontilrelics',JSON.stringify({
  commodity:'soontilrelics',
  updatedAt:new Date().toISOString(),
  items:[{
    ...aliasSearch.results[0],
    source:'Spansh',
    distanceFromSystem:'Diaba',
  }],
}));
const rareCached=await searchTradeMarkets(legacyRareEnv,{
  commodity:'Soontill Relics',
  direction:'buy',
  referenceSystem:'Diaba',
  radiusLy:5,
  minVolume:1,
  carrierMode:'exclude',
  maxAgeMinutes:90,
  priority:'critical',
  sort:'price',
},{fetchImpl:async ()=>new Response(JSON.stringify({count:0,results:[]}),{status:200,headers:{'Content-Type':'application/json'}})});
assert.equal(rareCached.source,'Mongrel Rare Source Cache');
assert.equal(rareCached.results.length,1,'old alias-key cache should keep the known rare source visible when Spansh omits the station');
assert.equal(rareCached.results[0].stationName,'Cheranovsky City');
assert.match(rareCached.warning,/known rare source station/);

const rareSell=normalizeMarketSearch({
  commodity:'Soontill Relics',
  direction:'sell',
  referenceSystem:'Diaba',
  radiusLy:25,
  priority:'critical',
},control);
assert.equal(rareSell.radiusLimited,true,'selling a rare remains a destination search and should respect radius');
assert.equal(buildSpanshSearchBody(rareSell,fixedNow).filters.distance.max,'25');
assert.ok(buildSpanshSearchBody(rareSell,fixedNow).filters.market_updated_at,'rare destination searches should still respect market freshness');

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
    controlling_minor_faction:'Gamma Metals Cooperative',
    controlling_minor_faction_state:'Infrastructure Failure',
    primary_economy:'Industrial',
    secondary_economy:'Refinery',
    economies:[{name:'Industrial',share:0.7},{name:'Refinery',share:0.3}],
    system_primary_economy:'Industrial',
    system_secondary_economy:'Refinery',
    updated_at:new Date(now-30*60*1000).toISOString(),
    market_updated_at:new Date(now-10*60*1000).toISOString(),
    distance:8,
    market:[{commodity:'Gold',category:'Metals',buy_price:40000,sell_price:80000,supply:12000,demand:60000}],
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
assert.equal(buy.results[0].bgs.controllingFaction,'Gamma Metals Cooperative');
assert.equal(buy.results[0].bgs.factionState,'Infrastructure Failure');
assert.equal(buy.results[0].bgs.infrastructureFailure,true);
assert.equal(buy.results[0].bgs.metalCommodity,true);
assert.equal(buy.results[0].bgs.infrastructureFailureMetalOpportunity,true,'Infrastructure Failure should be highlighted for any Metals-category buy source');
assert.equal(buy.results[0].bgs.ownershipNeedsConfirmation,false,'fresh ownership metadata should not be warned');

for(const commodity of ['Gold','Silver','Palladium']){
  const signal=buildTradeBgsContext({
    commodity,
    commodityCategory:'Metals',
    stationControllingFaction:'Test Metals Faction',
    stationControllingFactionState:'InfrastructureFailure',
    stationMetadataAt:new Date().toISOString(),
    observedAt:new Date().toISOString(),
    source:'Spansh',
  },{direction:'buy'});
  assert.equal(signal.infrastructureFailureMetalOpportunity,true,commodity+' should use the generic Metals-category Infrastructure Failure signal');
}
const staleOwnership=buildTradeBgsContext({
  commodity:'Silver',
  commodityCategory:'Metals',
  stationControllingFaction:'Potential New Owner',
  stationControllingFactionState:'Infrastructure Failure',
  stationMetadataAt:new Date(Date.now()-4*24*60*60*1000).toISOString(),
  observedAt:new Date().toISOString(),
  source:'Spansh',
},{direction:'buy'});
assert.equal(staleOwnership.metadataFreshness,'stale');
assert.equal(staleOwnership.ownershipNeedsConfirmation,true,'stale port ownership must warn on an Infrastructure Failure metal opportunity');

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
assert.match(html,/inputmode="numeric"[^>]*data-market-price/);
assert.match(html,/inputmode="numeric"[^>]*data-market-volume/);
assert.match(html,/inputmode="numeric"[^>]*data-trade-watch-price/);
assert.match(html,/inputmode="numeric"[^>]*data-trade-watch-volume/);
assert.match(html,/Sort displayed results/);
assert.match(html,/Shortest arrival/);
assert.match(html,/data-market-pagination/);
assert.match(html,/trade-market\.css\?v=7/);
assert.match(html,/trade-market\.js\?v=11/);
assert.match(html,/trading\.js\?v=83/);

const client=readFileSync(new URL('../js/trade-market.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-market\/search/);
assert.match(client,/mongrels-trade-market-search-v1/);
assert.match(client,/MongrelTradeMarket/);
assert.match(client,/function commodityMatches\(term\)/);
assert.match(client,/function validateCommoditySelection\(\)/);
assert.match(client,/ArrowDown/);
assert.match(client,/includesRares/);
assert.match(client,/function rareSourceSearch\(commodityValue,directionValue\)/);
assert.match(client,/commodityAliasKey/);
assert.match(client,/soontil relics/);
assert.match(client,/Rare source&nbsp;/);
assert.match(client,/Rare source search · all distances/);
assert.match(client,/trade-commodity-rare-badge/);
assert.match(client,/const PAGE_SIZE=10/);
assert.match(client,/function bindFormattedInteger\(input\)/);
assert.match(client,/const integerValue=value=>/);
assert.match(client,/maximumFractionDigits:2/);
assert.match(client,/fmtLy\(item\.distanceLy\)/);
assert.match(client,/Infrastructure Failure metal source/);
assert.match(client,/Ownership needs confirmation/);
assert.match(client,/Port controller/);
assert.match(client,/limit:100/);
assert.match(client,/function sortedResults\(\)/);
assert.match(client,/arrival:\(a,b\)=>arrivalOf\(a\)-arrivalOf\(b\)/);
assert.match(client,/Showing '\+first\+'–'\+last\+' of /);

const tradeClient=readFileSync(new URL('../js/trading.js',import.meta.url),'utf8');
assert.match(tradeClient,/Spansh Adapter Ready/);
assert.match(tradeClient,/const fmtLy = value =>/);
assert.match(tradeClient,/maximumFractionDigits:2/);
assert.match(tradeClient,/health\.source/);

const searchApi=readFileSync(new URL('../functions/api/trade-market/search.js',import.meta.url),'utf8');
assert.match(searchApi,/member','officer','site_admin/);
assert.match(searchApi,/searchTradeMarkets/);

console.log('Trade market search smoke checks passed.');
