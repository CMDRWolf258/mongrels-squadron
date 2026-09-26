import { isRareTradeCommodity, rareTradeCommoditySource } from './trade-rares.js';
export const TRADE_WATCHES_KEY='trade-watches-v1';

export async function readTradeWatches(env){
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return[];
  try{
    const stored=await env.TRADES.get(TRADE_WATCHES_KEY,{type:'json'});
    return Array.isArray(stored)?stored.map(normalizeTradeWatch).filter(Boolean):[];
  }catch(error){
    console.error('Could not read Trade watches',error);
    return[];
  }
}

export async function writeTradeWatches(env,items){
  requireStorage(env);
  const watches=(Array.isArray(items)?items:[])
    .map(normalizeTradeWatch)
    .filter(Boolean)
    .slice(0,250);
  await env.TRADES.put(TRADE_WATCHES_KEY,JSON.stringify(watches));
  return watches;
}

export function normalizeTradeWatch(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const id=cleanId(source.id);
  if(!id)return null;
  const query=normalizeWatchQuery(source.query);
  if(!query)return null;
  const evaluationSource=source.evaluation&&typeof source.evaluation==='object'?source.evaluation:{};
  const discordSource=source.discord&&typeof source.discord==='object'?source.discord:{};
  return{
    version:1,
    id,
    name:clean(source.name).slice(0,160)||defaultWatchName(query),
    status:source.status==='paused'?'paused':'active',
    query,
    createdById:clean(source.createdById).slice(0,80),
    createdByName:clean(source.createdByName).slice(0,80)||'Commander',
    createdAt:iso(source.createdAt)||new Date().toISOString(),
    updatedAt:iso(source.updatedAt)||new Date().toISOString(),
    evaluation:{
      state:['pending_scheduler','ready','healthy','warning','error'].includes(clean(evaluationSource.state))
        ?clean(evaluationSource.state)
        :'pending_scheduler',
      lastAttemptAt:iso(evaluationSource.lastAttemptAt),
      lastEvaluatedAt:iso(evaluationSource.lastEvaluatedAt),
      lastSuccessfulAt:iso(evaluationSource.lastSuccessfulAt),
      nextEvaluationAt:iso(evaluationSource.nextEvaluationAt),
      lastError:clean(evaluationSource.lastError).slice(0,300),
      warning:clean(evaluationSource.warning).slice(0,300),
      matchCount:wholeNullable(evaluationSource.matchCount,0,1000000),
      source:clean(evaluationSource.source).slice(0,80),
      sourceMode:clean(evaluationSource.sourceMode).slice(0,80),
      partial:Boolean(evaluationSource.partial),
      currentBest:normalizeBestMarket(evaluationSource.currentBest),
      knownRareSource:normalizeBestMarket(evaluationSource.knownRareSource),
      rareAllocation:normalizeRareAllocation(evaluationSource.rareAllocation),
      rankedMarkets:normalizeRankedMarkets(evaluationSource.rankedMarkets),
      lastTransition:normalizeTransition(evaluationSource.lastTransition),
    },
    discord:{
      publish:discordSource.publish!==false,
      routeId:clean(discordSource.routeId).slice(0,80),
      messageId:discordId(discordSource.messageId),
      channelId:discordId(discordSource.channelId),
      lastSyncedAt:iso(discordSource.lastSyncedAt),
      lastError:clean(discordSource.lastError).slice(0,300),
      lifecycle:['active','paused','closed'].includes(clean(discordSource.lifecycle))?clean(discordSource.lifecycle):'active',
      lastAlertAt:iso(discordSource.lastAlertAt),
      lastAlertType:clean(discordSource.lastAlertType).slice(0,60),
    },
  };
}

export function watchQuerySummary(watch){
  const q=watch?.query||{};
  const action=q.direction==='buy'?'Buy':'Sell';
  const volume=q.direction==='buy'?'supply':'demand';
  const parts=[
    action+' '+(q.commodity||'commodity'),
    'near '+(q.referenceSystem||'unknown system'),
    isRareTradeCommodity(q.commodity)&&q.direction==='buy'
      ?'all distances'
      :Number(q.radiusLy)>0?Number(q.radiusLy)+' ly':'',
    isRareTradeCommodity(q.commodity)&&q.direction==='buy'
      ?'rare timer 1–8 PM CT'
      :'',
    Number(q.price)>0
      ?(q.direction==='buy'?'≤ ':'≥ ')+Number(q.price).toLocaleString()+' Cr/t'
      :'',
    Number(q.minVolume)>0?'≥ '+Number(q.minVolume).toLocaleString()+' t '+volume:'',
  ].filter(Boolean);
  return parts.join(' · ');
}

function normalizeWatchQuery(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const commodity=clean(source.commodity).slice(0,100);
  const referenceSystem=clean(source.referenceSystem).slice(0,140);
  if(!commodity||!referenceSystem)return null;
  return{
    commodity,
    direction:source.direction==='buy'?'buy':'sell',
    referenceSystem,
    rareSource:source.direction==='buy'?rareTradeCommoditySource(commodity):null,
    radiusLy:whole(source.radiusLy,1,500,100),
    minVolume:whole(source.minVolume,0,2000000000,1),
    price:whole(source.price,0,2000000000,0),
    minPad:whole(source.minPad,0,3,0),
    carrierMode:['include','exclude','only'].includes(clean(source.carrierMode))?clean(source.carrierMode):'exclude',
    maxAgeMinutes:whole(source.maxAgeMinutes,1,20160,2880),
    priority:['critical','high','standard','low'].includes(clean(source.priority))?clean(source.priority):'standard',
    sort:['price','distance','freshness','volume'].includes(clean(source.sort))?clean(source.sort):'price',
    limit:whole(source.limit,1,100,100),
  };
}

function normalizeRankedMarkets(value){
  if(!Array.isArray(value))return[];
  return value
    .map((item,index)=>{
      const market=normalizeBestMarket(item);
      return market?{...market,rank:whole(item?.rank,1,5,index+1)}:null;
    })
    .filter(Boolean)
    .slice(0,5);
}
function normalizeBestMarket(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source)return null;
  const marketId=clean(source.marketId).slice(0,80);
  if(!marketId)return null;
  return{
    rank:whole(source.rank,1,5,1),
    marketId,
    systemName:clean(source.systemName).slice(0,140),
    stationName:clean(source.stationName).slice(0,140),
    price:whole(source.price,0,2000000000,0),
    volume:whole(source.volume,0,2000000000,0),
    reportedVolume:whole(source.reportedVolume,0,2000000000,0),
    allocationVolume:whole(source.allocationVolume,0,2000000000,0),
    allocationPrice:whole(source.allocationPrice,0,2000000000,0),
    allocationObservedAt:iso(source.allocationObservedAt),
    commanderSensitiveSupply:Boolean(source.commanderSensitiveSupply),
    distanceLy:finiteNullable(source.distanceLy),
    observedAt:iso(source.observedAt),
    source:clean(source.source).slice(0,60),
    qualifies:source.qualifies!==false,
    rareSourceStatus:clean(source.rareSourceStatus).slice(0,60),
    bgs:normalizeMarketBgs(source.bgs),
  };
}
function normalizeMarketBgs(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return{
    controllingFaction:clean(source.controllingFaction).slice(0,140),
    factionState:clean(source.factionState).slice(0,100),
    stationPrimaryEconomy:clean(source.stationPrimaryEconomy).slice(0,80),
    stationSecondaryEconomy:clean(source.stationSecondaryEconomy).slice(0,80),
    stationEconomies:Array.isArray(source.stationEconomies)
      ?source.stationEconomies.slice(0,8).map(item=>({
        name:clean(item?.name).slice(0,80),
        share:finiteNullable(item?.share),
      })).filter(item=>item.name)
      :[],
    systemPrimaryEconomy:clean(source.systemPrimaryEconomy).slice(0,80),
    systemSecondaryEconomy:clean(source.systemSecondaryEconomy).slice(0,80),
    metadataAt:iso(source.metadataAt),
    metadataAgeMinutes:finiteNullable(source.metadataAgeMinutes),
    metadataLagMinutes:finiteNullable(source.metadataLagMinutes),
    metadataFreshness:['fresh','aging','stale','unknown'].includes(clean(source.metadataFreshness))
      ?clean(source.metadataFreshness)
      :'unknown',
    infrastructureFailure:Boolean(source.infrastructureFailure),
    metalCommodity:Boolean(source.metalCommodity),
    infrastructureFailureMetalOpportunity:Boolean(source.infrastructureFailureMetalOpportunity),
    ownershipNeedsConfirmation:Boolean(source.ownershipNeedsConfirmation),
    source:clean(source.source).slice(0,80),
  };
}
function normalizeRareAllocation(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source)return null;
  return{
    value:whole(source.value,0,2000000000,0),
    price:whole(source.price,0,2000000000,0),
    observedAt:iso(source.observedAt),
    dayKey:clean(source.dayKey).slice(0,20),
    dayHigh:whole(source.dayHigh,0,2000000000,0),
    dayHighObservedAt:iso(source.dayHighObservedAt),
    previousValue:whole(source.previousValue,0,2000000000,0),
    lastReportedSupply:whole(source.lastReportedSupply,0,2000000000,0),
    lastReportAt:iso(source.lastReportAt),
  };
}
function normalizeTransition(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source)return null;
  const type=clean(source.type);
  if(!['baseline','condition_met','condition_cleared','best_market_changed','rare_allocation_changed'].includes(type))return null;
  return{
    type,
    at:iso(source.at),
    from:clean(source.from).slice(0,100),
    to:clean(source.to).slice(0,100),
    fromVolume:whole(source.fromVolume,0,2000000000,0),
    toVolume:whole(source.toVolume,0,2000000000,0),
    direction:['up','down'].includes(clean(source.direction))?clean(source.direction):'',
  };
}
function wholeNullable(value,min,max){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?Math.min(max,Math.max(min,Math.round(number))):null;
}
function finiteNullable(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function defaultWatchName(query){
  const action=query.direction==='buy'?'Buy':'Sell';
  return action+' '+query.commodity+' near '+query.referenceSystem;
}
function discordId(value){const text=clean(value);return /^\d{5,30}$/.test(text)?text:'';}
function cleanId(value){
  const text=clean(value).slice(0,80);
  return /^[A-Za-z0-9_-]{8,80}$/.test(text)?text:'';
}
function requireStorage(env){
  if(!env?.TRADES||typeof env.TRADES.get!=='function'||typeof env.TRADES.put!=='function'){
    throw new Error('trades_storage_not_configured');
  }
}
function whole(value,min,max,fallback){
  if(value===null||value===undefined||value==='')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?Math.min(max,Math.max(min,Math.round(number))):fallback;
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
