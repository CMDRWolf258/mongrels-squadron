import { readTradeControl, tradePriorityProfile, requireTradeStorage } from './trade-intelligence.js';
import { fetchTradeLoopSnapshot } from './trade-loop-finder.js';

export const TRADE_CG_KEY='trade-cg-campaigns-v1';
export const CG_REFRESH_MINUTES=15;
export const CG_PROMOTION_HOLD_MINUTES=60;
export const CG_DEFAULT_MIN_PRIMARY_SUPPLY=5000;
export const CG_DEFAULT_PRIMARY_FRESH_MINUTES=60;
export const CG_MAX_CAMPAIGNS=20;
export const CG_MAX_RESULTS=10;

export async function readTradeCgCampaigns(env){
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return[];
  try{
    const stored=await env.TRADES.get(TRADE_CG_KEY,{type:'json'});
    return Array.isArray(stored)?stored.map(normalizeTradeCgCampaign).filter(Boolean):[];
  }catch(error){
    console.error('Could not read Trade CG campaigns',error);
    return[];
  }
}

export async function writeTradeCgCampaigns(env,items){
  requireTradeStorage(env);
  const rows=(Array.isArray(items)?items:[])
    .map(normalizeTradeCgCampaign)
    .filter(Boolean)
    .slice(0,CG_MAX_CAMPAIGNS);
  await env.TRADES.put(TRADE_CG_KEY,JSON.stringify(rows));
  return rows;
}

export function normalizeTradeCgCampaign(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const destinationSystem=clean(source.destinationSystem).slice(0,140);
  const destinationStation=clean(source.destinationStation).slice(0,140);
  const commodities=normalizeCommodities(source.commodities);
  if(!source.id||!destinationSystem||!destinationStation||!commodities.length)return null;
  const automationSource=source.automation&&typeof source.automation==='object'&&!Array.isArray(source.automation)?source.automation:{};
  const evaluationSource=source.evaluation&&typeof source.evaluation==='object'&&!Array.isArray(source.evaluation)?source.evaluation:{};
  const status=['active','closed'].includes(clean(source.status).toLowerCase())?clean(source.status).toLowerCase():'active';
  return{
    id:clean(source.id).slice(0,80),
    title:clean(source.title).slice(0,180)||'Community Goal',
    status,
    destinationSystem,
    destinationStation,
    commodities,
    startsAt:iso(source.startsAt),
    endsAt:iso(source.endsAt),
    notes:clean(source.notes).slice(0,1600),
    automation:normalizeCgSolverSettings(automationSource),
    primary:normalizeCgRoute(source.primary),
    pendingPrimary:normalizePendingPrimary(source.pendingPrimary),
    evaluation:{
      lastAttemptAt:iso(evaluationSource.lastAttemptAt),
      lastEvaluatedAt:iso(evaluationSource.lastEvaluatedAt),
      nextEvaluationAt:iso(evaluationSource.nextEvaluationAt),
      lastError:clean(evaluationSource.lastError).slice(0,300),
      lastWarning:clean(evaluationSource.lastWarning).slice(0,500),
      stationCount:whole(evaluationSource.stationCount,0,1000000,0),
      sourceResultCount:whole(evaluationSource.sourceResultCount,0,1000000,0),
      partial:Boolean(evaluationSource.partial),
    },
    discord:normalizeCgDiscord(source.discord),
    createdById:clean(source.createdById).slice(0,80),
    createdByName:clean(source.createdByName).slice(0,100),
    createdAt:iso(source.createdAt)||new Date().toISOString(),
    updatedAt:iso(source.updatedAt)||new Date().toISOString(),
    updatedBy:clean(source.updatedBy).slice(0,100),
  };
}

export function normalizeCgSolverSettings(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return{
    cargoCapacity:whole(source.cargoCapacity,1,2000,784),
    radiusLy:whole(source.radiusLy,1,500,100),
    minPad:[0,1,2,3].includes(Number(source.minPad))?Number(source.minPad):3,
    carrierMode:['exclude','include','only'].includes(clean(source.carrierMode).toLowerCase())
      ?clean(source.carrierMode).toLowerCase()
      :'exclude',
    maxAgeMinutes:whole(source.maxAgeMinutes,5,1440,120),
    primaryFreshMinutes:whole(source.primaryFreshMinutes,5,720,CG_DEFAULT_PRIMARY_FRESH_MINUTES),
    minPrimarySupply:whole(source.minPrimarySupply,1,2000000000,CG_DEFAULT_MIN_PRIMARY_SUPPLY),
    refreshMinutes:whole(source.refreshMinutes,5,360,CG_REFRESH_MINUTES),
    promotionHoldMinutes:CG_PROMOTION_HOLD_MINUTES,
    ranking:clean(source.ranking).toLowerCase()==='supply'?'supply':'profit',
  };
}

export function normalizeCgSearch(input,campaign,control){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const base=campaign?.automation||normalizeCgSolverSettings({});
  const priority='critical';
  const profile=tradePriorityProfile(control,priority);
  return{
    cargoCapacity:whole(source.cargoCapacity,1,2000,base.cargoCapacity),
    radiusLy:whole(source.radiusLy,1,500,base.radiusLy),
    minPad:[0,1,2,3].includes(Number(source.minPad))?Number(source.minPad):base.minPad,
    carrierMode:['exclude','include','only'].includes(clean(source.carrierMode).toLowerCase())
      ?clean(source.carrierMode).toLowerCase()
      :base.carrierMode,
    maxAgeMinutes:whole(source.maxAgeMinutes,5,1440,base.maxAgeMinutes||profile.agingMinutes),
    primaryFreshMinutes:whole(source.primaryFreshMinutes,5,720,base.primaryFreshMinutes),
    minPrimarySupply:whole(source.minPrimarySupply,1,2000000000,base.minPrimarySupply),
    ranking:clean(source.ranking).toLowerCase()==='supply'?'supply':'profit',
    limit:whole(source.limit,1,CG_MAX_RESULTS,CG_MAX_RESULTS),
    priority,
  };
}

export async function solveTradeCgCampaign(env,campaign,input={},{
  fetchImpl=fetch,
  timeoutMs=20000,
  now=Date.now(),
  includePrimaryKey='',
}={}){
  const normalized=normalizeTradeCgCampaign(campaign);
  if(!normalized)throw new Error('cg_campaign_invalid');
  const control=await readTradeControl(env);
  const query=normalizeCgSearch(input,normalized,control);
  const snapshot=await fetchTradeLoopSnapshot({
    startSystem:normalized.destinationSystem,
    scope:'radius',
    radiusLy:query.radiusLy,
    cargoCapacity:query.cargoCapacity,
    minPad:query.minPad,
    // Always include static stations and carriers in the snapshot so the fixed
    // CG destination is never filtered out by a source-only carrier preference.
    carrierMode:'include',
    priority:'critical',
    maxAgeMinutes:query.maxAgeMinutes,
    thresholdDropPercent:25,
    mongrelOnly:false,
    legCount:2,
    limit:10,
  },{fetchImpl,timeoutMs});

  const destination=findDestination(snapshot.stations,normalized);
  if(!destination)throw new Error('cg_destination_market_not_found');

  const candidates=buildCgCandidates(snapshot.stations,destination,normalized,query,now);
  const sorted=sortCgCandidates(candidates,query.ranking);
  const results=sorted.slice(0,query.limit);
  const key=clean(includePrimaryKey);
  const primaryObservation=key
    ?observeCgRoute(snapshot.stations,destination,normalized,query,key,now)
    :null;

  return{
    ok:true,
    source:'Spansh',
    fetchedAt:snapshot.fetchedAt,
    campaignId:normalized.id,
    query,
    destination:{
      marketId:destination.marketId,
      systemName:destination.systemName,
      stationName:destination.stationName,
      observedAt:destination.observedAt,
    },
    stationCount:snapshot.stations.length,
    sourceResultCount:snapshot.sourceResultCount,
    partial:snapshot.partial,
    warning:snapshot.partial
      ?'Spansh matched more stations than this CG search loaded. Rankings are based on the first '+snapshot.stations.length+' market stations in range.'
      :'',
    results,
    primaryObservation,
  };
}

export function buildCgCandidates(stations,destination,campaign,query,now=Date.now()){
  const accepted=new Map((campaign.commodities||[]).map(name=>[norm(name),name]));
  const destinationRows=new Map((destination.market||[]).map(row=>[norm(row.commodity),row]));
  const rows=[];
  for(const station of Array.isArray(stations)?stations:[]){
    if(!station?.marketId||station.marketId===destination.marketId)continue;
    if(query.minPad>0&&Number(station.maxLandingPadSize||0)<query.minPad)continue;
    if(query.carrierMode==='exclude'&&station.carrier)continue;
    if(query.carrierMode==='only'&&!station.carrier)continue;
    if(Number.isFinite(Number(station.distanceLy))&&Number(station.distanceLy)>query.radiusLy)continue;
    for(const market of station.market||[]){
      const commodity=accepted.get(norm(market.commodity));
      if(!commodity)continue;
      const dest=destinationRows.get(norm(commodity));
      if(!dest||Number(dest.sellPrice)<=0)continue;
      if(Number(market.buyPrice)<=0||Number(market.supply)<=0)continue;
      const route=makeCgRoute(station,destination,market,dest,commodity,query,now);
      if(route)rows.push(route);
    }
  }
  return dedupeCgCandidates(rows);
}

export function observeCgRoute(stations,destination,campaign,query,key,now=Date.now()){
  const parsed=parseRouteKey(key);
  if(!parsed)return null;
  const source=(Array.isArray(stations)?stations:[]).find(station=>String(station?.marketId)===parsed.marketId);
  if(!source)return{
    key,
    commodity:parsed.commodity,
    state:'missing',
    healthy:false,
    sourceSupply:0,
    ageMinutes:null,
  };
  const sourceRow=(source.market||[]).find(row=>norm(row.commodity)===norm(parsed.commodity));
  const destRow=(destination.market||[]).find(row=>norm(row.commodity)===norm(parsed.commodity));
  if(!sourceRow||!destRow)return{
    key,
    commodity:parsed.commodity,
    sourceMarketId:String(source.marketId),
    sourceSystem:source.systemName,
    sourceStation:source.stationName,
    state:'missing',
    healthy:false,
    sourceSupply:Math.max(0,Math.round(Number(sourceRow?.supply)||0)),
    ageMinutes:ageMinutes(oldestDate([source.observedAt,destination.observedAt]),now),
  };
  return makeCgRoute(source,destination,sourceRow,destRow,parsed.commodity,query,now,{allowZero:true});
}

function makeCgRoute(source,destination,sourceRow,destRow,commodity,query,now,{allowZero=false}={}){
  const supply=Math.max(0,Math.round(Number(sourceRow.supply)||0));
  if(!allowZero&&supply<=0)return null;
  const buyPrice=Math.max(0,Math.round(Number(sourceRow.buyPrice)||0));
  const sellPrice=Math.max(0,Math.round(Number(destRow.sellPrice)||0));
  if(!allowZero&&(buyPrice<=0||sellPrice<=0))return null;
  const quantity=Math.max(0,Math.min(query.cargoCapacity,supply));
  const profitPerTon=sellPrice-buyPrice;
  const tripProfit=Math.round(quantity*profitPerTon);
  const observedAt=oldestDate([source.observedAt,destination.observedAt]);
  const age=ageMinutes(observedAt,now);
  const healthy=Boolean(
    supply>=query.minPrimarySupply
    && Number.isFinite(age)
    && age<=query.primaryFreshMinutes
    && buyPrice>0
    && sellPrice>0
  );
  const state=supply<=0
    ?'depleted'
    :!Number.isFinite(age)||age>query.primaryFreshMinutes
      ?'stale'
      :healthy
        ?'healthy'
        :'low_supply';
  return{
    key:routeKey(source.marketId,commodity),
    commodity,
    sourceMarketId:String(source.marketId),
    sourceSystem:clean(source.systemName).slice(0,140),
    sourceStation:clean(source.stationName).slice(0,140),
    sourceFaction:clean(source.stationControllingFaction).slice(0,140),
    destinationMarketId:String(destination.marketId),
    destinationSystem:clean(destination.systemName).slice(0,140),
    destinationStation:clean(destination.stationName).slice(0,140),
    buyPrice,
    sellPrice,
    profitPerTon,
    cargoCapacity:query.cargoCapacity,
    quantity,
    sourceSupply:supply,
    distanceLy:finite(source.distanceLy),
    sourceArrivalLs:finite(source.distanceToArrivalLs),
    observedAt,
    ageMinutes:Number.isFinite(age)?age:null,
    tripProfit,
    healthy,
    state,
  };
}

export function sortCgCandidates(items,ranking='profit'){
  const rows=[...(Array.isArray(items)?items:[])];
  if(ranking==='supply'){
    return rows.sort((a,b)=>
      Number(b.sourceSupply||0)-Number(a.sourceSupply||0)
      ||Number(b.tripProfit||0)-Number(a.tripProfit||0)
      ||distanceValue(a)-distanceValue(b)
    );
  }
  return rows.sort((a,b)=>
    Number(b.tripProfit||0)-Number(a.tripProfit||0)
    ||Number(b.profitPerTon||0)-Number(a.profitPerTon||0)
    ||Number(b.sourceSupply||0)-Number(a.sourceSupply||0)
    ||distanceValue(a)-distanceValue(b)
  );
}

export function cgRouteEligibleForPrimary(route){
  return Boolean(route?.healthy&&Number(route?.sourceSupply)>0&&route?.key);
}

export function routeKey(marketId,commodity){
  return String(marketId||'')+'|'+encodeURIComponent(clean(commodity).slice(0,100));
}

export function parseRouteKey(value){
  const text=clean(value);
  const split=text.indexOf('|');
  if(split<=0)return null;
  try{
    return{marketId:text.slice(0,split),commodity:decodeURIComponent(text.slice(split+1))};
  }catch{return null;}
}

export function normalizeCgRoute(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source||!source.key)return null;
  return{
    key:clean(source.key).slice(0,220),
    commodity:clean(source.commodity).slice(0,100),
    sourceMarketId:clean(String(source.sourceMarketId??'')).slice(0,80),
    sourceSystem:clean(source.sourceSystem).slice(0,140),
    sourceStation:clean(source.sourceStation).slice(0,140),
    sourceFaction:clean(source.sourceFaction).slice(0,140),
    destinationMarketId:clean(String(source.destinationMarketId??'')).slice(0,80),
    destinationSystem:clean(source.destinationSystem).slice(0,140),
    destinationStation:clean(source.destinationStation).slice(0,140),
    buyPrice:wholeSigned(source.buyPrice,-2147483647,2147483647,0),
    sellPrice:wholeSigned(source.sellPrice,-2147483647,2147483647,0),
    profitPerTon:wholeSigned(source.profitPerTon,-2147483647,2147483647,0),
    cargoCapacity:whole(source.cargoCapacity,1,2000,784),
    quantity:whole(source.quantity,0,2000000000,0),
    sourceSupply:whole(source.sourceSupply,0,2000000000,0),
    distanceLy:finite(source.distanceLy),
    sourceArrivalLs:finite(source.sourceArrivalLs),
    observedAt:iso(source.observedAt),
    ageMinutes:finite(source.ageMinutes),
    tripProfit:wholeSigned(source.tripProfit,-1000000000000,1000000000000,0),
    healthy:Boolean(source.healthy),
    state:['healthy','low_supply','stale','depleted','missing'].includes(clean(source.state))
      ?clean(source.state)
      :'missing',
    promotedAt:iso(source.promotedAt),
    promotionReason:clean(source.promotionReason).slice(0,80),
  };
}

export function normalizePendingPrimary(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const route=normalizeCgRoute(source?.route);
  if(!route)return null;
  return{
    route,
    firstSeenAt:iso(source.firstSeenAt),
    promoteAfter:iso(source.promoteAfter),
  };
}

function normalizeCgDiscord(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return{
    messageId:discordId(source.messageId),
    channelId:discordId(source.channelId),
    lastSyncedAt:iso(source.lastSyncedAt),
    lastError:clean(source.lastError).slice(0,300),
  };
}

function findDestination(stations,campaign){
  return(Array.isArray(stations)?stations:[]).find(station=>
    norm(station?.systemName)===norm(campaign.destinationSystem)
    &&norm(station?.stationName)===norm(campaign.destinationStation)
  )||null;
}

function dedupeCgCandidates(rows){
  const map=new Map();
  for(const row of rows){
    const current=map.get(row.key);
    if(!current||Date.parse(row.observedAt||0)>Date.parse(current.observedAt||0))map.set(row.key,row);
  }
  return[...map.values()];
}

function normalizeCommodities(value){
  const raw=Array.isArray(value)?value:String(value||'').split(/[\n,;]+/);
  const seen=new Set();
  const out=[];
  for(const item of raw){
    const name=clean(item).replace(/\s+/g,' ').slice(0,100);
    const key=norm(name);
    if(!key||seen.has(key))continue;
    seen.add(key);
    out.push(name);
    if(out.length>=12)break;
  }
  return out;
}

function oldestDate(values){
  const times=(Array.isArray(values)?values:[])
    .map(value=>Date.parse(value||''))
    .filter(Number.isFinite);
  return times.length?new Date(Math.min(...times)).toISOString():'';
}
function ageMinutes(value,now=Date.now()){
  const time=Date.parse(value||'');
  return Number.isFinite(time)?Math.max(0,Math.floor((Number(now)-time)/60000)):null;
}
function distanceValue(route){
  return Number.isFinite(Number(route?.distanceLy))?Number(route.distanceLy):Number.MAX_SAFE_INTEGER;
}
function discordId(value){const text=clean(value);return /^\d{5,30}$/.test(text)?text:'';}
function finite(value){const n=Number(value);return Number.isFinite(n)?Math.round(n*100)/100:null;}
function whole(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;}
function wholeSigned(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;}
function clean(value){return String(value??'').trim();}
function norm(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function iso(value){
  const time=Date.parse(value||'');
  return Number.isFinite(time)?new Date(time).toISOString():'';
}
