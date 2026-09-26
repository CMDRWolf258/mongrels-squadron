import { readTradeControl, tradePriorityProfile } from './trade-intelligence.js';

const SPANSH_STATION_SEARCH='https://spansh.co.uk/api/stations/search';
const STATIC_TRADE_TYPES=[
  'Asteroid base',
  'Coriolis Starport',
  'Dodec Starport',
  'Mega ship',
  'Ocellus Starport',
  'Orbis Starport',
  'Outpost',
  'Planetary Outpost',
  'Planetary Port',
  'Settlement',
];
const CARRIER_TRADE_TYPES=['Drake-Class Carrier'];
const MAX_TWO_LEG_RADIUS=500;
const MAX_THREE_LEG_RADIUS=100;
const MAX_STATIONS=200;
const DEFAULT_CARGO=784;
const DEFAULT_LIMIT=10;
const MONGREL_FACTION='Regiment of Imperial Mongrels';

export async function searchTradeLoops(env,input,{fetchImpl=fetch,timeoutMs=20000}={}) {
  const control=await readTradeControl(env);
  const query=normalizeLoopSearch(input,control);
  const snapshot=await fetchTradeLoopSnapshot(query,{fetchImpl,timeoutMs});
  const results=optimizeTradeLoops(snapshot.stations,query);
  return {
    ok:true,
    source:'Spansh',
    fetchedAt:snapshot.fetchedAt,
    query:publicLoopQuery(query),
    stationCount:snapshot.stations.length,
    sourceResultCount:snapshot.sourceResultCount,
    partial:snapshot.partial,
    warning:snapshot.partial
      ?'Spansh matched more stations than this route search loaded. Rankings are based on the first '+snapshot.stations.length+' market stations in range.'
      :'',
    results,
  };
}

export function normalizeLoopSearch(input,control) {
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const startSystem=clean(source.startSystem).replace(/\s+/g,' ').slice(0,140);
  if(!startSystem)throw new Error('start_system_required');

  const legCount=Number(source.legCount)===3?3:2;
  const scope=clean(source.scope).toLowerCase()==='same'?'same':'radius';
  const radiusCap=legCount===3?MAX_THREE_LEG_RADIUS:MAX_TWO_LEG_RADIUS;
  const radiusLy=scope==='same'?0:whole(source.radiusLy,1,radiusCap,Math.min(50,radiusCap));
  const cargoCapacity=whole(source.cargoCapacity,1,2000,DEFAULT_CARGO);
  const minPad=[0,1,2,3].includes(Number(source.minPad))?Number(source.minPad):3;
  const carrierMode=['exclude','include','only'].includes(clean(source.carrierMode).toLowerCase())
    ?clean(source.carrierMode).toLowerCase()
    :'exclude';
  const priority=['critical','high','standard','low'].includes(clean(source.priority).toLowerCase())
    ?clean(source.priority).toLowerCase()
    :'standard';
  const profile=tradePriorityProfile(control,priority);
  const maxAgeMinutes=whole(source.maxAgeMinutes,1,20160,profile.freshMinutes);
  const thresholdDropPercent=whole(source.thresholdDropPercent,5,90,25);
  const mongrelOnly=Boolean(source.mongrelOnly);
  const limit=whole(source.limit,1,10,DEFAULT_LIMIT);

  return {
    startSystem,
    legCount,
    scope,
    radiusLy,
    cargoCapacity,
    minPad,
    carrierMode,
    priority,
    maxAgeMinutes,
    thresholdDropPercent,
    mongrelOnly,
    limit,
  };
}

export async function fetchTradeLoopSnapshot(query,{fetchImpl=fetch,timeoutMs=20000}={}) {
  const body=buildSpanshLoopSnapshotBody(query);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(SPANSH_STATION_SEARCH,{
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/json',
        'User-Agent':'Mongrels-Trader-Outpost/1.0',
      },
      body:JSON.stringify(body),
      signal:controller.signal,
    });
    if(!response.ok){
      const text=await response.text().catch(()=>'');
      throw new Error('loop_source_http_'+response.status+(text?':'+text.slice(0,120):''));
    }
    const payload=await response.json();
    if(!payload||typeof payload!=='object'||!Array.isArray(payload.results))throw new Error('loop_source_invalid_response');
    const stations=payload.results.map(normalizeSnapshotStation).filter(Boolean);
    const count=Math.max(stations.length,whole(payload.count,0,1000000000,stations.length));
    return{
      fetchedAt:new Date().toISOString(),
      sourceResultCount:count,
      partial:count>payload.results.length,
      stations,
    };
  }catch(error){
    if(error?.name==='AbortError')throw new Error('loop_source_timeout');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

export function buildSpanshLoopSnapshotBody(query,now=new Date()) {
  const types=query.carrierMode==='only'
    ?CARRIER_TRADE_TYPES
    :query.carrierMode==='include'
      ?[...STATIC_TRADE_TYPES,...CARRIER_TRADE_TYPES]
      :STATIC_TRADE_TYPES;
  const end=new Date(now);
  const start=new Date(end.getTime()-query.maxAgeMinutes*60000);
  const filters={
    type:{value:types},
    services:[{name:['Market']}],
    market_updated_at:{min:start.toISOString(),max:end.toISOString()},
  };
  if(query.scope==='same'){
    filters.system_name={value:query.startSystem};
  }else{
    filters.distance={min:'0',max:String(query.radiusLy)};
  }
  return{
    filters,
    sort:[{distance:{direction:'asc'}}],
    size:MAX_STATIONS,
    reference_system:query.startSystem,
  };
}

export function normalizeSnapshotStation(item) {
  if(!item||typeof item!=='object')return null;
  const marketId=String(item.market_id??item.id??'').trim();
  const stationName=clean(item.name);
  const systemName=clean(item.system_name);
  const observedAt=iso(item.market_updated_at||item.updated_at);
  if(!marketId||!stationName||!systemName||!observedAt)return null;

  const stationType=clean(item.type);
  const maxLandingPadSize=Number(item.large_pads)>0||item.has_large_pad===true
    ?3
    :Number(item.medium_pads)>0
      ?2
      :Number(item.small_pads)>0
        ?1
        :0;
  const market=(Array.isArray(item.market)?item.market:[])
    .map(row=>normalizeMarketRow(row))
    .filter(Boolean);
  if(!market.length)return null;

  return{
    marketId,
    stationName,
    systemName,
    stationType,
    stationControllingFaction:clean(item.controlling_minor_faction),
    carrier:isCarrierType(stationType),
    maxLandingPadSize,
    distanceLy:finite(item.distance),
    distanceToArrivalLs:finite(item.distance_to_arrival),
    systemX:finite(item.system_x),
    systemY:finite(item.system_y),
    systemZ:finite(item.system_z),
    observedAt,
    market,
  };
}

export function optimizeTradeLoops(stations,query) {
  const normalizedQuery=query&&query.startSystem?query:normalizeLoopSearch(query||{},{});
  const eligible=(Array.isArray(stations)?stations:[]).filter(station=>{
    if(!station?.marketId||!Array.isArray(station.market)||!station.market.length)return false;
    if(normalizedQuery.minPad>0&&Number(station.maxLandingPadSize||0)<normalizedQuery.minPad)return false;
    if(normalizedQuery.carrierMode==='exclude'&&station.carrier)return false;
    if(normalizedQuery.carrierMode==='only'&&!station.carrier)return false;
    if(normalizedQuery.mongrelOnly&&norm(station.stationControllingFaction)!==norm(MONGREL_FACTION))return false;
    if(normalizedQuery.scope==='same'&&norm(station.systemName)!==norm(normalizedQuery.startSystem))return false;
    if(normalizedQuery.scope==='radius'&&Number.isFinite(Number(station.distanceLy))&&Number(station.distanceLy)>normalizedQuery.radiusLy)return false;
    return true;
  });
  const startStations=eligible.filter(station=>norm(station.systemName)===norm(normalizedQuery.startSystem));
  if(!startStations.length)return[];

  const marketMaps=new Map(eligible.map(station=>[
    station.marketId,
    new Map(station.market.map(row=>[norm(row.commodity),row])),
  ]));
  const edgeCache=new Map();
  const edge=(from,to)=>{
    const key=from.marketId+'>'+to.marketId;
    if(edgeCache.has(key))return edgeCache.get(key);
    const value=bestTradeEdge(from,to,marketMaps.get(to.marketId),normalizedQuery);
    edgeCache.set(key,value);
    return value;
  };

  if(normalizedQuery.legCount===3){
    return optimizeThreeLeg(startStations,eligible,edge,normalizedQuery);
  }
  return optimizeTwoLeg(startStations,eligible,edge,normalizedQuery);
}

export function evaluateSpecificLoop(stations,routeLegs,query) {
  const list=Array.isArray(stations)?stations:[];
  const stationMap=new Map(list.map(station=>[String(station.marketId),station]));
  const legs=[];
  for(const prior of Array.isArray(routeLegs)?routeLegs:[]){
    const source=stationMap.get(String(prior?.sourceMarketId||''));
    const destination=stationMap.get(String(prior?.destinationMarketId||''));
    if(!source||!destination)return{valid:false,loopProfit:0,legs:[]};
    const sourceRow=(source.market||[]).find(row=>norm(row.commodity)===norm(prior.commodity));
    const destinationRow=(destination.market||[]).find(row=>norm(row.commodity)===norm(prior.commodity));
    if(!sourceRow||!destinationRow)return{valid:false,loopProfit:0,legs:[]};
    const leg=tradeEdgeForCommodity(source,destination,sourceRow,destinationRow,query);
    if(!leg)return{valid:false,loopProfit:0,legs:[]};
    legs.push(leg);
  }
  if(!legs.length)return{valid:false,loopProfit:0,legs:[]};
  return{
    valid:true,
    loopProfit:legs.reduce((sum,leg)=>sum+leg.tripProfit,0),
    totalDistanceLy:round2(legs.reduce((sum,leg)=>sum+(Number(leg.distanceLy)||0),0)),
    observedAt:oldestDate(legs.map(leg=>leg.observedAt)),
    legs,
  };
}

function optimizeTwoLeg(startStations,stations,edge,query) {
  const best=new Map();
  for(const a of startStations){
    for(const b of stations){
      if(a.marketId===b.marketId)continue;
      if(query.scope==='radius'&&norm(b.systemName)===norm(query.startSystem))continue;
      const out=edge(a,b);
      const back=edge(b,a);
      if(!out||!back)continue;
      const signature=[a.marketId,b.marketId].sort().join('|');
      const result=routeResult([out,back],query,signature);
      const current=best.get(signature);
      if(!current||result.loopProfit>current.loopProfit)best.set(signature,result);
    }
  }
  return [...best.values()].sort(compareRoute).slice(0,query.limit);
}

function optimizeThreeLeg(startStations,stations,edge,query) {
  const best=new Map();
  for(const a of startStations){
    for(const b of stations){
      if(b.marketId===a.marketId)continue;
      if(query.scope==='radius'&&!withinLegRadius(a,b,query.radiusLy))continue;
      const ab=edge(a,b);
      if(!ab)continue;
      for(const c of stations){
        if(c.marketId===a.marketId||c.marketId===b.marketId)continue;
        if(query.scope==='radius'){
          if(norm(b.systemName)===norm(query.startSystem)&&norm(c.systemName)===norm(query.startSystem))continue;
          if(!withinLegRadius(b,c,query.radiusLy)||!withinLegRadius(c,a,query.radiusLy))continue;
        }
        const bc=edge(b,c);
        if(!bc)continue;
        const ca=edge(c,a);
        if(!ca)continue;
        const signature=canonicalDirectedCycle([a.marketId,b.marketId,c.marketId]);
        const result=routeResult([ab,bc,ca],query,signature);
        const current=best.get(signature);
        if(!current||result.loopProfit>current.loopProfit)best.set(signature,result);
      }
    }
  }
  return [...best.values()].sort(compareRoute).slice(0,query.limit);
}

function bestTradeEdge(source,destination,destinationMap,query) {
  if(!source||!destination||source.marketId===destination.marketId||!destinationMap)return null;
  let best=null;
  for(const sourceRow of source.market||[]){
    if(sourceRow.buyPrice<=0||sourceRow.supply<=0)continue;
    const destinationRow=destinationMap.get(norm(sourceRow.commodity));
    if(!destinationRow||destinationRow.sellPrice<=sourceRow.buyPrice||destinationRow.demand<=0)continue;
    const candidate=tradeEdgeForCommodity(source,destination,sourceRow,destinationRow,query);
    if(candidate&&(!best||candidate.tripProfit>best.tripProfit))best=candidate;
  }
  return best;
}

function tradeEdgeForCommodity(source,destination,sourceRow,destinationRow,query) {
  const spread=Math.round(Number(destinationRow.sellPrice||0)-Number(sourceRow.buyPrice||0));
  if(spread<=0)return null;
  const quantity=Math.max(0,Math.min(
    Number(query.cargoCapacity)||DEFAULT_CARGO,
    Number(sourceRow.supply)||0,
    Number(destinationRow.demand)||0,
  ));
  if(quantity<=0)return null;
  const distanceLy=systemDistance(source,destination);
  if(query.scope==='radius'&&Number.isFinite(distanceLy)&&distanceLy>query.radiusLy)return null;
  const tripProfit=Math.round(quantity*spread);
  return{
    commodity:clean(sourceRow.commodity).slice(0,100),
    sourceMarketId:String(source.marketId),
    sourceSystem:clean(source.systemName).slice(0,140),
    sourceStation:clean(source.stationName).slice(0,140),
    destinationMarketId:String(destination.marketId),
    destinationSystem:clean(destination.systemName).slice(0,140),
    destinationStation:clean(destination.stationName).slice(0,140),
    sourceFaction:clean(source.stationControllingFaction).slice(0,140),
    destinationFaction:clean(destination.stationControllingFaction).slice(0,140),
    buyPrice:Math.round(Number(sourceRow.buyPrice)||0),
    sellPrice:Math.round(Number(destinationRow.sellPrice)||0),
    profitPerTon:spread,
    quantity:Math.round(quantity),
    tripProfit,
    sourceSupply:Math.round(Number(sourceRow.supply)||0),
    destinationDemand:Math.round(Number(destinationRow.demand)||0),
    distanceLy:Number.isFinite(distanceLy)?round2(distanceLy):null,
    sourceArrivalLs:finite(source.distanceToArrivalLs),
    destinationArrivalLs:finite(destination.distanceToArrivalLs),
    observedAt:oldestDate([source.observedAt,destination.observedAt]),
  };
}

function routeResult(legs,query,signature) {
  const loopProfit=legs.reduce((sum,leg)=>sum+leg.tripProfit,0);
  const totalDistanceLy=round2(legs.reduce((sum,leg)=>sum+(Number(leg.distanceLy)||0),0));
  return{
    signature,
    legCount:legs.length,
    loopProfit,
    equivalentProfitPerTon:Math.round(loopProfit/Math.max(1,query.cargoCapacity)),
    cargoCapacity:query.cargoCapacity,
    totalDistanceLy,
    observedAt:oldestDate(legs.map(leg=>leg.observedAt)),
    legs,
  };
}

function compareRoute(a,b) {
  return Number(b.loopProfit||0)-Number(a.loopProfit||0)
    ||Number(b.equivalentProfitPerTon||0)-Number(a.equivalentProfitPerTon||0)
    ||Number(a.totalDistanceLy||0)-Number(b.totalDistanceLy||0);
}

function normalizeMarketRow(row) {
  if(!row||typeof row!=='object')return null;
  const commodity=clean(row.commodity).replace(/\s+/g,' ').slice(0,100);
  if(!commodity)return null;
  return{
    commodity,
    category:clean(row.category).slice(0,80),
    buyPrice:whole(row.buy_price,0,2147483647,0),
    sellPrice:whole(row.sell_price,0,2147483647,0),
    supply:whole(row.supply,0,2147483647,0),
    demand:whole(row.demand,0,2147483647,0),
  };
}

function stationTypes(carrierMode) {
  if(carrierMode==='only')return CARRIER_TRADE_TYPES;
  if(carrierMode==='include')return[...STATIC_TRADE_TYPES,...CARRIER_TRADE_TYPES];
  return STATIC_TRADE_TYPES;
}

function isCarrierType(value){
  const key=norm(value);
  return key.includes('carrier')||key.includes('fleet carrier')||key.includes('drake');
}

function systemDistance(a,b) {
  if(norm(a?.systemName)===norm(b?.systemName))return 0;
  const ax=Number(a?.systemX), ay=Number(a?.systemY), az=Number(a?.systemZ);
  const bx=Number(b?.systemX), by=Number(b?.systemY), bz=Number(b?.systemZ);
  if([ax,ay,az,bx,by,bz].every(Number.isFinite)){
    return Math.sqrt((ax-bx)**2+(ay-by)**2+(az-bz)**2);
  }
  const ad=finite(a?.distanceLy), bd=finite(b?.distanceLy);
  if(ad===0&&bd!==null)return bd;
  if(bd===0&&ad!==null)return ad;
  return null;
}

function withinLegRadius(a,b,radius) {
  const distance=systemDistance(a,b);
  return distance!==null&&distance<=radius;
}

function canonicalDirectedCycle(ids) {
  const list=ids.map(String);
  const rotations=list.map((_,index)=>[...list.slice(index),...list.slice(0,index)].join('>'));
  return rotations.sort()[0];
}

function publicLoopQuery(query) {
  return{
    startSystem:query.startSystem,
    legCount:query.legCount,
    scope:query.scope,
    radiusLy:query.radiusLy,
    cargoCapacity:query.cargoCapacity,
    minPad:query.minPad,
    carrierMode:query.carrierMode,
    priority:query.priority,
    maxAgeMinutes:query.maxAgeMinutes,
    thresholdDropPercent:query.thresholdDropPercent,
    mongrelOnly:Boolean(query.mongrelOnly),
    limit:query.limit,
  };
}

function oldestDate(values) {
  const times=(Array.isArray(values)?values:[])
    .map(value=>Date.parse(value||''))
    .filter(Number.isFinite);
  return times.length?new Date(Math.min(...times)).toISOString():'';
}

function finite(value){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function whole(value,min,max,fallback){
  const number=Number(value);
  if(!Number.isFinite(number))return fallback;
  return Math.min(max,Math.max(min,Math.round(number)));
}
function clean(value){return String(value??'').trim();}
function norm(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function iso(value){
  const time=Date.parse(value||'');
  return Number.isFinite(time)?new Date(time).toISOString():'';
}
function round2(value){return Math.round((Number(value)||0)*100)/100;}
