import { classifyTradeDataAge, readTradeControl } from './trade-intelligence.js';
import {
  isRareTradeCommodity,
  rareTradeCommodityCanonicalName,
  rareTradeCommoditySearchNames,
  rareTradeCommoditySource,
} from './trade-rares.js';

const EDDATA_BASE='https://api.eddata.dev/v2';
const SPANSH_STATION_SEARCH='https://spansh.co.uk/api/stations/search';
const SPANSH_MARKET_FIELD_VALUES='https://spansh.co.uk/api/stations/field_values/marketplace';
const MARKET_HEALTH_KEY='trade-market-health-v1';
const MARKET_COMMODITIES_KEY='trade-market-commodities-v1';
const MARKET_OBSERVATION_PREFIX='trade-market-observations-v1:';
const MAX_STORED_PER_COMMODITY=2000;
const MAX_SEARCH_RESULTS=100;
const MAX_EXTERNAL_AGE_DAYS=14;
const MAX_RADIUS_LY=500;
const SPANSH_PAGE_SIZE=100;
const UNBOUNDED=2147483647;
const BGS_METADATA_FRESH_MINUTES=1440;
const BGS_METADATA_AGING_MINUTES=4320;

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
const MINOR_WORDS=new Set(['and','of','the','in','a','an','to','for','on']);

export async function searchTradeMarkets(env,input,{fetchImpl=fetch,timeoutMs=15000}={}) {
  const control=await readTradeControl(env);
  const query=normalizeMarketSearch(input,control);
  const startedAt=Date.now();

  let payload;
  try{
    payload=await fetchSpanshSearch(query,{fetchImpl,timeoutMs});
  }catch(error){
    const cached=await cachedSearchFallback(env,query,control,error);
    if(cached)return cached;
    await writeMarketHealth(env,{
      lastAttemptAt:new Date().toISOString(),
      lastError:friendlySourceError(error),
      lastWarning:'',
      lastQuery:publicQuery(query),
      source:'Spansh',
      sourceUrl:'https://spansh.co.uk',
      sourceMode:'spansh-stations',
    }).catch(()=>{});
    throw error;
  }

  const rows=Array.isArray(payload?.results)?payload.results:[];
  const observations=rows
    .map(item=>normalizeSpanshObservation(item,query))
    .filter(Boolean);

  const rareCached=await rareSourceCacheFallback(env,query,control,{liveRows:rows,liveObservations:observations}).catch(()=>null);
  if(rareCached)return rareCached;

  const stored=await recordMarketObservations(env,query.commodityKey,observations).catch(()=>0);
  const matches=filterAndSortObservations(observations,query,control).slice(0,query.limit);
  const fetchedAt=new Date().toISOString();
  const totalMatches=Math.max(rows.length,whole(payload?.count,0,1000000000,rows.length));
  const partial=totalMatches>rows.length;
  const warningParts=[];
  if(partial)warningParts.push('Spansh matched more markets than this interactive page returns; results are ranked from the first '+rows.length+' candidates.');
  if(query.rareSourceSearch){
    const sourceText=query.rareSource?.stationName&&query.rareSource?.systemName
      ?' Known source: '+query.rareSource.stationName+' · '+query.rareSource.systemName+'.'
      :'';
    warningParts.push('Rare-source search: radius and market-age cutoffs do not exclude the unique source; distance and freshness are still displayed from '+query.referenceSystem+'.'+sourceText);
  }
  const warning=warningParts.join(' ');

  await writeMarketHealth(env,{
    lastAttemptAt:fetchedAt,
    lastSuccessfulFetchAt:fetchedAt,
    lastError:'',
    lastWarning:warning,
    source:'Spansh',
    sourceUrl:'https://spansh.co.uk',
    sourceMode:'spansh-stations',
    sourceResultCount:observations.length,
    sourceMatchCount:totalMatches,
    lastReturnedCount:matches.length,
    lastStoredCount:stored,
    lastDurationMs:Date.now()-startedAt,
    lastQuery:publicQuery(query),
  }).catch(()=>{});

  return {
    ok:true,
    source:'Spansh',
    sourceMode:'spansh-stations',
    partial,
    warning,
    fetchedAt,
    query:publicQuery(query),
    sourceResultCount:observations.length,
    sourceMatchCount:totalMatches,
    results:matches.map(item=>presentObservation(item,control,query.priority,query)),
  };
}

export async function getTradeCommodityCatalog(env,{fetchImpl=fetch,force=false}={}) {
  const cached=await readCommodityCatalog(env);
  const now=Date.now();
  const age=Date.parse(cached?.fetchedAt||'');
  if(!force&&cached?.source==='Spansh Marketplace'&&Array.isArray(cached?.items)&&Number.isFinite(age)&&now-age<24*60*60*1000){
    return {
      ...cached,
      catalogVersion:2,
      items:cached.items.map(item=>{
        const label=clean(item?.label||item?.name);
        return {...item,label,name:clean(item?.name||label),rare:isRareTradeCommodity(label)};
      }),
      cached:true,
    };
  }

  try{
    const raw=await fetchJson(SPANSH_MARKET_FIELD_VALUES,{fetchImpl,timeoutMs:8000});
    const names=extractSpanshCommodityNames(raw);
    if(names.length<20)throw new Error('commodity_catalog_incomplete');
    const items=names.map(label=>({name:label,label,rare:isRareTradeCommodity(label)}));
    const value={
      fetchedAt:new Date().toISOString(),
      source:'Spansh Marketplace',
      catalogVersion:2,
      includesRares:true,
      items,
    };
    if(env?.TRADES&&typeof env.TRADES.put==='function'){
      await env.TRADES.put(MARKET_COMMODITIES_KEY,JSON.stringify(value));
    }
    return {...value,cached:false};
  }catch(spanshError){
    try{
      const raw=await fetchEdDataJson(EDDATA_BASE+'/commodities',{fetchImpl,timeoutMs:6000});
      const items=(Array.isArray(raw)?raw:[])
        .map(item=>{
          const name=clean(item?.commodityName);
          if(!name)return null;
          const label=commodityLabel(name);
          return {name,label,rare:isRareTradeCommodity(label)};
        })
        .filter(Boolean)
        .sort((a,b)=>a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));
      if(!items.length)throw new Error('commodity_catalog_incomplete');
      const value={
        fetchedAt:new Date().toISOString(),
        source:'EDData fallback',
        catalogVersion:2,
        includesRares:false,
        items,
      };
      if(env?.TRADES&&typeof env.TRADES.put==='function'){
        await env.TRADES.put(MARKET_COMMODITIES_KEY,JSON.stringify(value));
      }
      return {...value,cached:false,warning:'Spansh commodity catalog was unavailable; using fallback names.'};
    }catch(error){
      if(Array.isArray(cached?.items)&&cached.items.length){
        return {...cached,cached:true,stale:true,error:friendlySourceError(error)};
      }
      return {fetchedAt:'',source:'Unavailable',includesRares:false,items:[],cached:false,stale:true,error:friendlySourceError(error)};
    }
  }
}

export function extractSpanshCommodityNames(raw) {
  const names=new Map();
  const add=value=>{
    const label=clean(value).replace(/\s+/g,' ').slice(0,100);
    if(!label||!/[A-Za-z]/.test(label))return;
    const key=normalizeCommodity(label);
    if(key&&!names.has(key))names.set(key,label);
  };
  const visit=(value,keyHint='',depth=0)=>{
    if(depth>8||value===null||value===undefined)return;
    if(typeof value==='string'){
      if(depth===0||['commodity','commodities','value','values','items','options','marketplace'].includes(keyHint))add(value);
      return;
    }
    if(Array.isArray(value)){
      for(const item of value){
        if(typeof item==='string')add(item);
        else visit(item,keyHint,depth+1);
      }
      return;
    }
    if(typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){
      const hint=String(key||'').toLowerCase();
      if(hint==='commodity'||hint==='commodities'){
        if(typeof child==='string')add(child);
        else if(Array.isArray(child)){
          for(const item of child)typeof item==='string'?add(item):visit(item,hint,depth+1);
        }else visit(child,hint,depth+1);
      }else if(['value','values','items','options','marketplace','results','data'].includes(hint)){
        visit(child,hint,depth+1);
      }else if(depth<2){
        visit(child,hint,depth+1);
      }
    }
  };
  visit(raw,'',0);
  return [...names.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
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
  const commodity=clean(source.commodity).replace(/\s+/g,' ').slice(0,100);
  const commodityKey=normalizeCommodity(rareTradeCommodityCanonicalName(commodity)||commodity);
  const referenceSystem=clean(source.referenceSystem).slice(0,140);
  if(!commodityKey)throw new Error('commodity_required');
  if(!referenceSystem)throw new Error('reference_system_required');

  const priority=['critical','high','standard','low'].includes(clean(source.priority).toLowerCase())
    ?clean(source.priority).toLowerCase()
    :control?.defaultPriority||'standard';
  const rareCommodity=isRareTradeCommodity(commodity);
  const rareSourceSearch=rareCommodity&&direction==='buy';
  const rareSource=rareSourceSearch?rareTradeCommoditySource(commodity):null;

  const profile=control?.priorities?.[priority]||{};
  const defaultAge=Math.max(1,Number(profile.agingMinutes)||2880);
  const maxAgeMinutes=whole(source.maxAgeMinutes,1,MAX_EXTERNAL_AGE_DAYS*1440,defaultAge);

  return {
    commodity,
    commodityKey,
    direction,
    referenceSystem,
    radiusLy:whole(source.radiusLy,1,MAX_RADIUS_LY,100),
    radiusLimited:!rareSourceSearch,
    rareCommodity,
    rareSourceSearch,
    rareSource,
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

export function buildSpanshSearchBody(query,now=new Date()) {
  const stationTypes=query.rareSourceSearch
    ?STATIC_TRADE_TYPES
    :query.carrierMode==='only'
      ?CARRIER_TRADE_TYPES
      :query.carrierMode==='include'
        ?[...STATIC_TRADE_TYPES,...CARRIER_TRADE_TYPES]
        :STATIC_TRADE_TYPES;

  const market={
    commodity:commoditySpellings(query.commodity),
  };
  if(query.direction==='buy'){
    market.supply=range(Math.max(1,query.minVolume),UNBOUNDED);
    market.buy_price=range(1,query.price>0?query.price:UNBOUNDED);
  }else{
    market.demand=range(Math.max(1,query.minVolume),UNBOUNDED);
    market.sell_price=range(query.price>0?query.price:1,UNBOUNDED);
  }

  const end=now instanceof Date?now:new Date(now);
  const start=new Date(end.getTime()-query.maxAgeMinutes*60000);

  const filters={
    type:{value:stationTypes},
    services:[{name:['Market']}],
  };
  if(query.rareSourceSearch&&query.rareSource?.systemName){
    filters.system_name={value:query.rareSource.systemName};
  }else{
    filters.marketplace=[market];
  }
  if(!query.rareSourceSearch){
    filters.market_updated_at={
      value:[start.toISOString(),end.toISOString()],
      comparison:'<=>',
    };
  }
  if(query.radiusLimited!==false)filters.distance={min:'0',max:String(query.radiusLy)};

  return {
    filters,
    sort:[{distance:{direction:'asc'}}],
    size:SPANSH_PAGE_SIZE,
    page:0,
    reference_system:query.referenceSystem,
  };
}

export function normalizeSpanshObservation(item,query) {
  if(!item||typeof item!=='object')return null;
  const marketId=String(item.market_id??item.id??'').trim();
  const systemName=clean(item.system_name);
  const stationName=clean(item.name);
  const observedAt=iso(item.market_updated_at||item.updated_at);
  if(!marketId||!systemName||!stationName||!observedAt)return null;
  if(query.rareSourceSearch&&query.rareSource?.systemName&&norm(systemName)!==norm(query.rareSource.systemName))return null;
  if(query.rareSourceSearch&&query.rareSource?.stationName&&norm(stationName)!==norm(query.rareSource.stationName))return null;

  const wanted=new Set(
    rareTradeCommoditySearchNames(query.commodity).map(name=>normalizeCommodity(name))
  );
  const entry=(Array.isArray(item.market)?item.market:[]).find(row=>
    wanted.has(normalizeCommodity(row?.commodity))
  );
  if(!entry)return null;

  const stationType=clean(item.type);
  const maxLandingPadSize=Number(item.large_pads)>0||item.has_large_pad===true
    ?3
    :Number(item.medium_pads)>0
      ?2
      :Number(item.small_pads)>0
        ?1
        :0;

  return {
    commodity:query.commodity,
    marketId,
    stationName,
    stationType,
    systemName,
    systemAddress:String(item.system_id64??'').trim(),
    systemX:finite(item.system_x),
    systemY:finite(item.system_y),
    systemZ:finite(item.system_z),
    bodyName:'',
    distanceToArrivalLs:finite(item.distance_to_arrival),
    maxLandingPadSize,
    carrier:isCarrierType(stationType),
    carrierDockingAccess:clean(item.carrier_docking_access),
    buyPrice:number(entry.buy_price),
    sellPrice:number(entry.sell_price),
    supply:number(entry.supply),
    demand:number(entry.demand),
    meanPrice:0,
    commodityCategory:clean(entry.category),
    stationControllingFaction:clean(item.controlling_minor_faction),
    stationControllingFactionState:clean(item.controlling_minor_faction_state),
    stationPrimaryEconomy:clean(item.primary_economy),
    stationSecondaryEconomy:clean(item.secondary_economy),
    stationEconomies:normalizeEconomies(item.economies),
    systemPrimaryEconomy:clean(item.system_primary_economy),
    systemSecondaryEconomy:clean(item.system_secondary_economy),
    stationMetadataAt:iso(item.updated_at),
    observedAt,
    source:'Spansh',
    distanceLy:finite(item.distance),
    distanceFromSystem:query.referenceSystem,
  };
}

export function buildEdDataSearchUrl(query) {
  return query.sort==='price'
    ?buildEdDataPriceSearchUrl(query)
    :buildEdDataNearbySearchUrl(query);
}

export function buildEdDataPriceSearchUrl(query) {
  const action=query.direction==='buy'?'exports':'imports';
  const path=[EDDATA_BASE,'commodity/name',encodeURIComponent(query.commodityKey||normalizeCommodity(query.commodity)),action].join('/');
  const params=baseEdDataParams(query);
  params.set('systemName',query.referenceSystem);
  return path+'?'+params.toString();
}

export function buildEdDataNearbySearchUrl(query) {
  const action=query.direction==='buy'?'exports':'imports';
  const path=[
    EDDATA_BASE,
    'system/name',
    encodeURIComponent(query.referenceSystem),
    'commodity/name',
    encodeURIComponent(query.commodityKey||normalizeCommodity(query.commodity)),
    'nearby',
    action,
  ].join('/');
  const params=baseEdDataParams(query);
  params.set('sort',query.sort==='distance'?'distance':'price');
  return path+'?'+params.toString();
}

function baseEdDataParams(query){
  const params=new URLSearchParams();
  params.set('minVolume',String(query.minVolume||1));
  if(query.radiusLimited!==false)params.set('maxDistance',String(query.radiusLy));
  params.set('maxDaysAgo',String(Math.max(1,Math.min(MAX_EXTERNAL_AGE_DAYS,Math.ceil(query.maxAgeMinutes/1440)))));
  if(query.direction==='buy'&&query.price>0)params.set('maxPrice',String(query.price));
  if(query.direction==='sell'&&query.price>0)params.set('minPrice',String(query.price));
  if(query.carrierMode==='exclude')params.set('fleetCarriers','false');
  if(query.carrierMode==='only')params.set('fleetCarriers','true');
  return params;
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
    maxLandingPadSize:padSizeNumber(item.maxLandingPadSize),
    carrier:isCarrierType(stationType),
    carrierDockingAccess:clean(item.carrierDockingAccess),
    buyPrice:number(item.buyPrice),
    sellPrice:number(item.sellPrice),
    supply:number(item.stock),
    demand:number(item.demand),
    meanPrice:number(item.meanPrice),
    commodityCategory:'',
    stationControllingFaction:'',
    stationControllingFactionState:'',
    stationPrimaryEconomy:'',
    stationSecondaryEconomy:'',
    stationEconomies:[],
    systemPrimaryEconomy:'',
    systemSecondaryEconomy:'',
    stationMetadataAt:'',
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
    if(!Number.isFinite(timestamp))return false;
    if(!query.rareSourceSearch&&timestamp<cutoff)return false;
    if(query.minPad>0&&Number(item.maxLandingPadSize||0)<query.minPad)return false;
    if(query.radiusLimited!==false&&item.distanceLy!==null&&item.distanceLy!==undefined&&Number(item.distanceLy)>query.radiusLy)return false;
    if(query.carrierMode==='exclude'&&item.carrier)return false;
    if(query.carrierMode==='only'&&!item.carrier)return false;
    if(query.direction==='buy'){
      if(item.supply<query.minVolume)return false;
      if(query.price>0&&item.buyPrice>query.price)return false;
      if(item.buyPrice<=0)return false;
    }else{
      if(item.demand<query.minVolume)return false;
      if(query.price>0&&item.sellPrice<query.price)return false;
      if(item.sellPrice<=0)return false;
    }
    return true;
  });

  const volume=item=>query.direction==='buy'?item.supply:item.demand;
  const price=item=>query.direction==='buy'?item.buyPrice:item.sellPrice;
  const compare={
    price:(a,b)=>query.direction==='buy'?price(a)-price(b):price(b)-price(a),
    distance:(a,b)=>(a.distanceLy??Number.MAX_SAFE_INTEGER)-(b.distanceLy??Number.MAX_SAFE_INTEGER),
    freshness:(a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt),
    volume:(a,b)=>volume(b)-volume(a),
  }[query.sort]||(()=>0);

  return [...filtered].sort((a,b)=>compare(a,b)||Date.parse(b.observedAt)-Date.parse(a.observedAt));
}

export function presentObservation(item,control,priority,query={}) {
  const age=classifyTradeDataAge(item.observedAt,control,priority);
  return {
    ...item,
    freshness:age.state,
    ageMinutes:age.ageMinutes,
    priority:age.profile.key,
    priorityLabel:age.profile.label,
    bgs:buildTradeBgsContext(item,query),
  };
}

export function buildTradeBgsContext(item,query={}) {
  const controller=clean(item?.stationControllingFaction);
  const factionState=clean(item?.stationControllingFactionState);
  const metadataAt=iso(item?.stationMetadataAt);
  const metadataAgeMinutes=ageMinutes(metadataAt);
  const marketTime=Date.parse(item?.observedAt||'');
  const metadataTime=Date.parse(metadataAt||'');
  const metadataLagMinutes=Number.isFinite(marketTime)&&Number.isFinite(metadataTime)
    ?Math.max(0,Math.round((marketTime-metadataTime)/60000))
    :null;
  const metadataFreshness=!Number.isFinite(metadataAgeMinutes)
    ?'unknown'
    :metadataAgeMinutes<=BGS_METADATA_FRESH_MINUTES
      ?'fresh'
      :metadataAgeMinutes<=BGS_METADATA_AGING_MINUTES
        ?'aging'
        :'stale';
  const infrastructureFailure=normalizeState(factionState).includes('infrastructurefailure');
  const metalCommodity=normalizeState(item?.commodityCategory)==='metals';
  const buying=query?.direction==='buy';
  const infrastructureFailureMetalOpportunity=Boolean(infrastructureFailure&&metalCommodity&&buying);
  const ownershipNeedsConfirmation=Boolean(
    infrastructureFailureMetalOpportunity
    && (
      !controller
      || metadataFreshness!=='fresh'
      || (Number.isFinite(metadataLagMinutes)&&metadataLagMinutes>BGS_METADATA_FRESH_MINUTES)
    )
  );

  return {
    controllingFaction:controller,
    factionState,
    stationPrimaryEconomy:clean(item?.stationPrimaryEconomy),
    stationSecondaryEconomy:clean(item?.stationSecondaryEconomy),
    stationEconomies:normalizeEconomies(item?.stationEconomies),
    systemPrimaryEconomy:clean(item?.systemPrimaryEconomy),
    systemSecondaryEconomy:clean(item?.systemSecondaryEconomy),
    metadataAt,
    metadataAgeMinutes:Number.isFinite(metadataAgeMinutes)?metadataAgeMinutes:null,
    metadataLagMinutes:Number.isFinite(metadataLagMinutes)?metadataLagMinutes:null,
    metadataFreshness,
    infrastructureFailure,
    metalCommodity,
    infrastructureFailureMetalOpportunity,
    ownershipNeedsConfirmation,
    source:item?.source==='Spansh'?'Spansh station metadata':'',
  };
}

async function fetchJson(url,{fetchImpl,timeoutMs}) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(url,{
      headers:{Accept:'application/json','User-Agent':'Mongrels-Trader-Outpost/1.0'},
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('market_source_http_'+response.status);
    return response.json();
  }catch(error){
    if(error?.name==='AbortError')throw new Error('market_source_timeout');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

async function fetchSpanshSearch(query,{fetchImpl,timeoutMs}) {
  const body=buildSpanshSearchBody(query);
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
      throw new Error('market_source_http_'+response.status+(text?':'+text.slice(0,120):''));
    }
    const payload=await response.json();
    if(!payload||typeof payload!=='object'||!Array.isArray(payload.results)){
      throw new Error('market_source_invalid_response');
    }
    return payload;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('market_source_timeout');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

async function cachedSearchFallback(env,query,control,error){
  if(!isTransientSourceError(error))return null;
  const cached=await readMarketObservationsForQuery(env,query);
  if(!cached.length)return null;
  const reference=norm(query.referenceSystem);
  const candidates=cached.filter(item=>
    norm(item?.distanceFromSystem)===reference
    && (query.radiusLimited===false||item?.distanceLy===null||item?.distanceLy===undefined||Number(item.distanceLy)<=query.radiusLy)
  );
  if(!candidates.length)return null;

  const matches=filterAndSortObservations(candidates,query,control).slice(0,query.limit);
  if(!matches.length)return null;

  const fetchedAt=new Date().toISOString();
  const warning='Live market lookup was unavailable, so these are matching observations from the Mongrel market cache.';
  await writeMarketHealth(env,{
    lastAttemptAt:fetchedAt,
    lastError:friendlySourceError(error),
    lastWarning:warning,
    source:'Mongrel Market Cache',
    sourceMode:'cache-fallback',
    sourceResultCount:candidates.length,
    lastReturnedCount:matches.length,
    lastStoredCount:cached.length,
    lastDurationMs:0,
    lastQuery:publicQuery(query),
  }).catch(()=>{});

  return{
    ok:true,
    source:'Mongrel Market Cache',
    sourceMode:'cache-fallback',
    cached:true,
    partial:true,
    warning,
    fetchedAt,
    query:publicQuery(query),
    sourceResultCount:candidates.length,
    results:matches.map(item=>presentObservation(item,control,query.priority,query)),
  };
}

async function readMarketObservationsForQuery(env,query){
  const keys=new Set([query?.commodityKey,normalizeCommodity(query?.commodity)]);
  if(query?.rareSourceSearch){
    for(const name of rareTradeCommoditySearchNames(query.commodity))keys.add(normalizeCommodity(name));
  }
  const groups=await Promise.all([...keys].filter(Boolean).map(key=>readMarketObservations(env,key)));
  const map=new Map();
  for(const item of groups.flat()){
    const id=String(item?.marketId||'');
    if(!id)continue;
    const current=map.get(id);
    if(!current||Date.parse(item?.observedAt||0)>=Date.parse(current?.observedAt||0))map.set(id,item);
  }
  return [...map.values()];
}

async function rareSourceCacheFallback(env,query,control,{liveRows=[],liveObservations=[]}={}){
  if(!query?.rareSourceSearch||!query?.rareSource?.systemName||!query?.rareSource?.stationName)return null;

  const sourceObservationSeen=Array.isArray(liveObservations)&&liveObservations.some(item=>
    norm(item?.systemName)===norm(query.rareSource.systemName)
    && norm(item?.stationName)===norm(query.rareSource.stationName)
  );
  // A normalized live observation means Spansh explicitly returned the rare commodity row.
  // Respect that live row even if supply/price later fails the user's filters. In particular,
  // do not replace a fresh supply=0 observation with older cached stock.
  if(sourceObservationSeen)return null;

  const sourceStationSeen=Array.isArray(liveRows)&&liveRows.some(row=>
    norm(row?.system_name)===norm(query.rareSource.systemName)
    && norm(row?.name)===norm(query.rareSource.stationName)
  );

  const cached=await readMarketObservationsForQuery(env,query);
  const sourceCandidates=cached
    .filter(item=>
      norm(item?.systemName)===norm(query.rareSource.systemName)
      && norm(item?.stationName)===norm(query.rareSource.stationName)
    )
    .map(item=>({
      ...item,
      distanceLy:norm(item?.distanceFromSystem)===norm(query.referenceSystem)?item.distanceLy:null,
      distanceFromSystem:query.referenceSystem,
      source:'Mongrel Rare Source Cache',
    }));
  if(!sourceCandidates.length)return null;

  const matches=filterAndSortObservations(sourceCandidates,query,control).slice(0,query.limit);
  if(!matches.length)return null;

  const fetchedAt=new Date().toISOString();
  const warning=sourceStationSeen
    ?'Spansh returned the known rare source station but omitted the rare commodity market row, so this result is the last matching observation from the Mongrel rare-source cache. Verify the age and stock before travel.'
    :'Spansh did not return the known rare source station, so this result is the last matching observation from the Mongrel rare-source cache. Verify the age before travel.';
  await writeMarketHealth(env,{
    lastAttemptAt:fetchedAt,
    lastSuccessfulFetchAt:fetchedAt,
    lastError:'',
    lastWarning:warning,
    source:'Mongrel Rare Source Cache',
    sourceMode:'rare-cache-fallback',
    sourceResultCount:sourceCandidates.length,
    sourceMatchCount:sourceCandidates.length,
    lastReturnedCount:matches.length,
    lastStoredCount:cached.length,
    lastDurationMs:0,
    lastQuery:publicQuery(query),
  }).catch(()=>{});

  return{
    ok:true,
    source:'Mongrel Rare Source Cache',
    sourceMode:'rare-cache-fallback',
    cached:true,
    partial:true,
    warning,
    fetchedAt,
    query:publicQuery(query),
    sourceResultCount:sourceCandidates.length,
    sourceMatchCount:sourceCandidates.length,
    results:matches.map(item=>presentObservation(item,control,query.priority,query)),
  };
}

async function readMarketObservations(env,commodity){
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return[];
  try{
    const stored=await env.TRADES.get(MARKET_OBSERVATION_PREFIX+commodityKey(commodity),{type:'json'});
    return Array.isArray(stored?.items)?stored.items:[];
  }catch{
    return[];
  }
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
    const payload=await response.json();
    if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&payload.status==='unavailable'){
      throw new Error('market_source_unavailable');
    }
    return payload;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('market_source_timeout');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

function defaultHealth(){
  return {
    source:'Spansh',
    sourceUrl:'https://spansh.co.uk',
    lastAttemptAt:'',
    lastSuccessfulFetchAt:'',
    lastError:'',
    lastWarning:'',
    sourceMode:'',
    sourceResultCount:0,
    sourceMatchCount:0,
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
    radiusLimited:query.radiusLimited!==false,
    rareCommodity:Boolean(query.rareCommodity),
    rareSourceSearch:Boolean(query.rareSourceSearch),
    rareSource:query.rareSource?{
      commodity:clean(query.rareSource.commodity).slice(0,100),
      systemName:clean(query.rareSource.systemName).slice(0,140),
      stationName:clean(query.rareSource.stationName).slice(0,140),
    }:null,
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

function normalizeEconomies(value){
  if(!Array.isArray(value))return[];
  return value
    .map(item=>({
      name:clean(item?.name),
      share:finite(item?.share),
    }))
    .filter(item=>item.name)
    .slice(0,8);
}
function ageMinutes(value){
  const time=Date.parse(value||'');
  if(!Number.isFinite(time))return NaN;
  return Math.max(0,Math.round((Date.now()-time)/60000));
}
function normalizeState(value){
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function commoditySpellings(value){
  const sourceNames=rareTradeCommoditySearchNames(value);
  const variants=[];
  for(const sourceName of sourceNames){
    const original=clean(sourceName).replace(/\s+/g,' ');
    const lower=original.toLowerCase();
    variants.push(
      original,
      titleCase(lower,false),
      titleCase(lower,true),
      sentenceCase(lower),
    );
  }
  return [...new Set(variants.filter(Boolean))];
}

function titleCase(lower,keepMinorWordsLower){
  return lower.split(' ').map((word,index)=>
    index>0&&keepMinorWordsLower&&MINOR_WORDS.has(word)
      ?word
      :capitalized(word)
  ).join(' ');
}
function sentenceCase(lower){return capitalized(lower);}
function capitalized(value){return value?value.charAt(0).toUpperCase()+value.slice(1):'';}
function range(min,max){return{comparison:'<=>',value:[Math.max(0,Math.round(min)),Math.max(0,Math.round(max))]};}
function isCarrierType(value){return clean(value).toLowerCase().includes('carrier');}
function padSizeNumber(value){
  const text=clean(value).toUpperCase();
  if(text==='L'||text==='LARGE')return 3;
  if(text==='M'||text==='MEDIUM')return 2;
  if(text==='S'||text==='SMALL')return 1;
  return whole(value,0,3,0);
}
function isTransientSourceError(error){
  const code=String(error?.message||'');
  return code==='market_source_timeout'
    ||code==='market_source_unavailable'
    ||/^market_source_http_(429|5\d\d)/.test(code);
}
function friendlySourceError(error){
  const code=String(error?.message||error||'market_source_failed');
  if(code==='market_source_timeout')return'Live market source timed out.';
  if(code==='market_source_unavailable')return'Live market source is temporarily unavailable.';
  if(code==='market_source_not_found')return'Reference system or commodity was not found by the market source.';
  if(code.startsWith('market_source_http_'))return'Live market source returned an upstream error.';
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
function norm(value){return clean(value).toLowerCase();}
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
