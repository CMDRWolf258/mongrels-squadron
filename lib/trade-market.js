import { classifyTradeDataAge, readTradeControl } from './trade-intelligence.js';

const EDDATA_BASE='https://api.eddata.dev/v2';
const MARKET_HEALTH_KEY='trade-market-health-v1';
const MARKET_COMMODITIES_KEY='trade-market-commodities-v1';
const MARKET_OBSERVATION_PREFIX='trade-market-observations-v1:';
const MAX_STORED_PER_COMMODITY=2000;
const MAX_SEARCH_RESULTS=100;
const MAX_EXTERNAL_AGE_DAYS=14;
const MAX_RADIUS_LY=500;

export async function searchTradeMarkets(env,input,{fetchImpl=fetch}={}) {
  const control=await readTradeControl(env);
  const query=normalizeMarketSearch(input,control);
  const url=buildEdDataSearchUrl(query);
  const startedAt=Date.now();

  let raw;
  try{
    raw=await fetchEdDataJson(url,{fetchImpl,timeoutMs:12000});
  }catch(error){
    await writeMarketHealth(env,{
      lastAttemptAt:new Date().toISOString(),
      lastError:friendlySourceError(error),
      lastQuery:publicQuery(query),
      source:'EDData / EDDN',
    }).catch(()=>{});
    throw error;
  }

  if(!Array.isArray(raw))throw new Error('market_source_invalid_response');

  const observations=raw
    .map(item=>normalizeEdDataObservation(item,query))
    .filter(Boolean);

  const stored=await recordMarketObservations(env,query.commodity,observations).catch(()=>0);
  const matches=filterAndSortObservations(observations,query,control).slice(0,query.limit);
  const fetchedAt=new Date().toISOString();

  await writeMarketHealth(env,{
    lastAttemptAt:fetchedAt,
    lastSuccessfulFetchAt:fetchedAt,
    lastError:'',
    source:'EDData / EDDN',
    sourceUrl:'https://api.eddata.dev',
    sourceResultCount:observations.length,
    lastReturnedCount:matches.length,
    lastStoredCount:stored,
    lastDurationMs:Date.now()-startedAt,
    lastQuery:publicQuery(query),
  }).catch(()=>{});

  return {
    ok:true,
    source:'EDData / EDDN',
    fetchedAt,
    query:publicQuery(query),
    sourceResultCount:observations.length,
    results:matches.map(item=>presentObservation(item,control,query.priority)),
  };
}

export async function getTradeCommodityCatalog(env,{fetchImpl=fetch,force=false}={}) {
  const cached=await readCommodityCatalog(env);
  const now=Date.now();
  const age=Date.parse(cached?.fetchedAt||'');
  if(!force&&Array.isArray(cached?.items)&&Number.isFinite(age)&&now-age<24*60*60*1000){
    return {...cached,cached:true};
  }

  try{
    const raw=await fetchEdDataJson(EDDATA_BASE+'/commodities',{fetchImpl,timeoutMs:12000});
    const items=(Array.isArray(raw)?raw:[])
      .map(item=>{
        const name=clean(item?.commodityName).toLowerCase();
        if(!name)return null;
        return {
          name,
          label:commodityLabel(name),
          maxBuyPrice:number(item?.maxBuyPrice),
          minBuyPrice:number(item?.minBuyPrice),
          avgBuyPrice:number(item?.avgBuyPrice),
          maxSellPrice:number(item?.maxSellPrice),
          minSellPrice:number(item?.minSellPrice),
          avgSellPrice:number(item?.avgSellPrice),
        };
      })
      .filter(Boolean)
      .sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));

    const value={fetchedAt:new Date().toISOString(),items};
    if(env?.TRADES&&typeof env.TRADES.put==='function'){
      await env.TRADES.put(MARKET_COMMODITIES_KEY,JSON.stringify(value));
    }
    return {...value,cached:false};
  }catch(error){
    if(Array.isArray(cached?.items)&&cached.items.length){
      return {...cached,cached:true,stale:true,error:friendlySourceError(error)};
    }
    throw error;
  }
}

export async function readTradeMarketHealth(env) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return defaultHealth();
  try{
    const value=await env.TRADES.get(MARKET_HEALTH_KEY,{type:'json'});
    return value&&typeof value==='object'?{...defaultHealth(),...value}:defaultHealth();
  }catch{
    return defaultHealth();
  }
}

export function normalizeMarketSearch(input,control) {
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const direction=clean(source.direction).toLowerCase()==='buy'?'buy':'sell';
  const commodity=normalizeCommodity(source.commodity);
  const referenceSystem=clean(source.referenceSystem).slice(0,140);
  if(!commodity)throw new Error('commodity_required');
  if(!referenceSystem)throw new Error('reference_system_required');

  const priority=['critical','high','standard','low'].includes(clean(source.priority).toLowerCase())
    ?clean(source.priority).toLowerCase()
    :control?.defaultPriority||'standard';

  const profile=control?.priorities?.[priority]||{};
  const defaultAge=Math.max(1,Number(profile.agingMinutes)||2880);
  const maxAgeMinutes=whole(source.maxAgeMinutes,1,MAX_EXTERNAL_AGE_DAYS*1440,defaultAge);

  return {
    commodity,
    direction,
    referenceSystem,
    radiusLy:whole(source.radiusLy,1,MAX_RADIUS_LY,100),
    minVolume:whole(source.minVolume,0,2000000000,1),
    price:whole(source.price,0,2000000000,0),
    minPad:whole(source.minPad,0,3,0),
    carrierMode:['include','exclude','only'].includes(clean(source.carrierMode).toLowerCase())
      ?clean(source.carrierMode).toLowerCase()
      :'exclude',
    maxAgeMinutes,
    priority,
    sort:['price','distance','freshness','volume'].includes(clean(source.sort).toLowerCase())
      ?clean(source.sort).toLowerCase()
      :'price',
    limit:whole(source.limit,1,MAX_SEARCH_RESULTS,50),
  };
}

export function buildEdDataSearchUrl(query) {
  const action=query.direction==='buy'?'exports':'imports';
  const path=[
    EDDATA_BASE,
    'system/name',
    encodeURIComponent(query.referenceSystem),
    'commodity/name',
    encodeURIComponent(query.commodity),
    'nearby',
    action,
  ].join('/');

  const params=new URLSearchParams();
  params.set('minVolume',String(query.minVolume||1));
  params.set('maxDistance',String(query.radiusLy));
  params.set('maxDaysAgo',String(Math.max(1,Math.min(MAX_EXTERNAL_AGE_DAYS,Math.ceil(query.maxAgeMinutes/1440)))));
  if(query.direction==='buy'&&query.price>0)params.set('maxPrice',String(query.price));
  if(query.direction==='sell'&&query.price>0)params.set('minPrice',String(query.price));
  if(query.carrierMode==='exclude')params.set('fleetCarriers','false');
  if(query.carrierMode==='only')params.set('fleetCarriers','true');
  params.set('sort',query.sort==='distance'?'distance':'price');

  return path+'?'+params.toString();
}

export function normalizeEdDataObservation(item,query) {
  if(!item||typeof item!=='object')return null;
  const marketId=String(item.marketId??'').trim();
  const systemName=clean(item.systemName);
  const stationName=clean(item.stationName);
  const observedAt=iso(item.updatedAt);
  if(!marketId||!systemName||!stationName||!observedAt)return null;

  const stationType=clean(item.stationType);
  return {
    commodity:query.commodity,
    marketId,
    stationName,
    stationType,
    systemName,
    systemAddress:String(item.systemAddress??'').trim(),
    systemX:finite(item.systemX),
    systemY:finite(item.systemY),
    systemZ:finite(item.systemZ),
    bodyName:clean(item.bodyName),
    distanceToArrivalLs:finite(item.distanceToArrival),
    maxLandingPadSize:whole(item.maxLandingPadSize,0,3,0),
    carrier:stationType.toLowerCase()==='fleetcarrier',
    carrierDockingAccess:clean(item.carrierDockingAccess),
    buyPrice:number(item.buyPrice),
    sellPrice:number(item.sellPrice),
    supply:number(item.stock),
    demand:number(item.demand),
    meanPrice:number(item.meanPrice),
    observedAt,
    source:'EDData / EDDN',
    distanceLy:finite(item.distance),
    distanceFromSystem:query.referenceSystem,
  };
}

export function filterAndSortObservations(observations,query,control) {
  const cutoff=Date.now()-query.maxAgeMinutes*60000;
  const filtered=observations.filter(item=>{
    const timestamp=Date.parse(item.observedAt);
    if(!Number.isFinite(timestamp)||timestamp<cutoff)return false;
    if(query.minPad>0&&Number(item.maxLandingPadSize||0)<query.minPad)return false;
    if(query.direction==='buy'){
      if(item.supply<query.minVolume)return false;
      if(query.price>0&&item.buyPrice>query.price)return false;
    }else{
      const qualifiesDemand=item.demand===0||item.demand>=query.minVolume;
      if(!qualifiesDemand)return false;
      if(query.price>0&&item.sellPrice<query.price)return false;
    }
    return true;
  });

  const volume=item=>query.direction==='buy'?item.supply:(item.demand===0?Number.MAX_SAFE_INTEGER:item.demand);
  const price=item=>query.direction==='buy'?item.buyPrice:item.sellPrice;
  const compare={
    price:(a,b)=>query.direction==='buy'?price(a)-price(b):price(b)-price(a),
    distance:(a,b)=>(a.distanceLy??Number.MAX_SAFE_INTEGER)-(b.distanceLy??Number.MAX_SAFE_INTEGER),
    freshness:(a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt),
    volume:(a,b)=>volume(b)-volume(a),
  }[query.sort]||(()=>0);

  return [...filtered].sort((a,b)=>compare(a,b)||Date.parse(b.observedAt)-Date.parse(a.observedAt));
}

export function presentObservation(item,control,priority) {
  const age=classifyTradeDataAge(item.observedAt,control,priority);
  return {
    ...item,
    freshness:age.state,
    ageMinutes:age.ageMinutes,
    priority:age.profile.key,
    priorityLabel:age.profile.label,
  };
}

async function recordMarketObservations(env,commodity,observations) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function'||typeof env.TRADES.put!=='function')return 0;
  const key=MARKET_OBSERVATION_PREFIX+commodityKey(commodity);
  let previous=[];
  try{
    const stored=await env.TRADES.get(key,{type:'json'});
    previous=Array.isArray(stored?.items)?stored.items:[];
  }catch{}

  const map=new Map();
  for(const item of [...previous,...observations]){
    const id=String(item?.marketId||'');
    if(!id)continue;
    const current=map.get(id);
    if(!current||Date.parse(item.observedAt||0)>=Date.parse(current.observedAt||0))map.set(id,item);
  }

  const items=[...map.values()]
    .sort((a,b)=>Date.parse(b.observedAt||0)-Date.parse(a.observedAt||0))
    .slice(0,MAX_STORED_PER_COMMODITY);

  await env.TRADES.put(key,JSON.stringify({
    commodity,
    updatedAt:new Date().toISOString(),
    items,
  }));
  return items.length;
}

async function writeMarketHealth(env,patch) {
  if(!env?.TRADES||typeof env.TRADES.put!=='function')return;
  const current=await readTradeMarketHealth(env);
  await env.TRADES.put(MARKET_HEALTH_KEY,JSON.stringify({...current,...patch}));
}

async function readCommodityCatalog(env) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return null;
  try{return await env.TRADES.get(MARKET_COMMODITIES_KEY,{type:'json'});}
  catch{return null;}
}

async function fetchEdDataJson(url,{fetchImpl,timeoutMs}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(url,{
      headers:{Accept:'application/json','User-Agent':'Mongrels-Trader-Outpost/1.0'},
      signal:controller.signal,
    });
    if(!response.ok){
      const text=await response.text().catch(()=>'');
      if(response.status===404)throw new Error('market_source_not_found');
      throw new Error('market_source_http_'+response.status+(text?':'+text.slice(0,120):''));
    }
    return response.json();
  }catch(error){
    if(error?.name==='AbortError')throw new Error('market_source_timeout');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

function defaultHealth(){
  return {
    source:'EDData / EDDN',
    sourceUrl:'https://api.eddata.dev',
    lastAttemptAt:'',
    lastSuccessfulFetchAt:'',
    lastError:'',
    sourceResultCount:0,
    lastReturnedCount:0,
    lastStoredCount:0,
    lastDurationMs:0,
    lastQuery:null,
  };
}

function publicQuery(query){
  return {
    commodity:query.commodity,
    direction:query.direction,
    referenceSystem:query.referenceSystem,
    radiusLy:query.radiusLy,
    minVolume:query.minVolume,
    price:query.price,
    minPad:query.minPad,
    carrierMode:query.carrierMode,
    maxAgeMinutes:query.maxAgeMinutes,
    priority:query.priority,
    sort:query.sort,
    limit:query.limit,
  };
}

function friendlySourceError(error){
  const code=String(error?.message||error||'market_source_failed');
  if(code==='market_source_timeout')return'EDData market query timed out.';
  if(code==='market_source_not_found')return'Reference system or commodity was not found by the market source.';
  if(code.startsWith('market_source_http_'))return'EDData returned an upstream error.';
  return code.slice(0,220);
}
function normalizeCommodity(value){
  return clean(value).toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9_-]/g,'').slice(0,100);
}
function commodityLabel(value){
  const raw=clean(value);
  return raw
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .replace(/[_-]+/g,' ')
    .replace(/\b\w/g,char=>char.toUpperCase());
}
function commodityKey(value){return normalizeCommodity(value)||'unknown';}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
function number(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.round(n)):0;}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function whole(value,min,max,fallback){
  if(value===null||value===undefined||value==='')return fallback;
  const n=Number(value);
  return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;
}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
