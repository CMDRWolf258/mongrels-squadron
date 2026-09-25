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
    Number(q.radiusLy)>0?Number(q.radiusLy)+' ly':'',
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

function normalizeBestMarket(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source)return null;
  const marketId=clean(source.marketId).slice(0,80);
  if(!marketId)return null;
  return{
    marketId,
    systemName:clean(source.systemName).slice(0,140),
    stationName:clean(source.stationName).slice(0,140),
    price:whole(source.price,0,2000000000,0),
    volume:whole(source.volume,0,2000000000,0),
    distanceLy:finiteNullable(source.distanceLy),
    observedAt:iso(source.observedAt),
    source:clean(source.source).slice(0,60),
  };
}
function normalizeTransition(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source)return null;
  const type=clean(source.type);
  if(!['baseline','condition_met','condition_cleared','best_market_changed'].includes(type))return null;
  return{
    type,
    at:iso(source.at),
    from:clean(source.from).slice(0,100),
    to:clean(source.to).slice(0,100),
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
