import { readTradeControl, tradePriorityProfile } from './trade-intelligence.js';
import { searchTradeMarkets } from './trade-market.js';
import { isRareTradeCommodity } from './trade-rares.js';
import { readTradeWatches, writeTradeWatches } from './trade-watches.js';
import {
  applyTradeWatchDiscordState,
  sendTradeWatchTransitionAlert,
  syncTradeWatchDiscord,
} from './trade-discord.js';

export const TRADE_WATCH_EVALUATION_BATCH_SIZE=6;
export const TRADE_WATCH_EVALUATION_CONCURRENCY=2;
export const TRADE_WATCH_SEARCH_TIMEOUT_MS=8000;
export const TRADE_WATCH_SHORTLIST_SIZE=5;
export const RARE_SOURCE_WATCH_TIME_ZONE='America/Chicago';
export const RARE_SOURCE_WATCH_START_HOUR=13;
export const RARE_SOURCE_WATCH_END_HOUR=20;
export const RARE_SOURCE_WATCH_SCHEDULE_LABEL='Hourly · 1–8 PM CT';

const RARE_SOURCE_WATCH_FORMATTER=new Intl.DateTimeFormat('en-US',{
  timeZone:RARE_SOURCE_WATCH_TIME_ZONE,
  year:'numeric',
  month:'2-digit',
  day:'2-digit',
  hour:'2-digit',
  hourCycle:'h23',
});

export async function evaluateTradeWatches(env,{
  now=Date.now(),
  force=false,
  watchIds=[],
  maxWatches=TRADE_WATCH_EVALUATION_BATCH_SIZE,
  concurrency=TRADE_WATCH_EVALUATION_CONCURRENCY,
  fetchImpl=fetch,
  origin='',
}={}){
  const currentNow=Number(now);
  const checkedAt=new Date(currentNow).toISOString();
  const [control,watches]=await Promise.all([
    readTradeControl(env),
    readTradeWatches(env),
  ]);

  const requestedIds=new Set((Array.isArray(watchIds)?watchIds:[]).map(value=>String(value||'')).filter(Boolean));
  const active=watches.filter(watch=>
    watch?.status==='active'
    && (!requestedIds.size||requestedIds.has(String(watch.id)))
  );
  const due=active
    .map(watch=>({watch,dueAt:watchDueAt(watch,control,currentNow)}))
    .filter(row=>force||row.dueAt<=currentNow)
    .sort((a,b)=>a.dueAt-b.dueAt||Date.parse(a.watch.createdAt||0)-Date.parse(b.watch.createdAt||0));

  const selected=due.slice(0,Math.max(1,Math.min(25,Number(maxWatches)||TRADE_WATCH_EVALUATION_BATCH_SIZE)));
  const evaluated=[];
  const width=Math.max(1,Math.min(4,Number(concurrency)||TRADE_WATCH_EVALUATION_CONCURRENCY));

  for(let offset=0;offset<selected.length;offset+=width){
    const chunk=selected.slice(offset,offset+width);
    const results=await Promise.all(chunk.map(row=>evaluateOne(env,row.watch,control,{
      now:currentNow,
      fetchImpl,
    })));
    evaluated.push(...results);
  }

  let applied=0;
  let superseded=0;
  if(evaluated.length){
    const latest=await readTradeWatches(env);
    const byId=new Map(evaluated.map(result=>[result.id,result]));

    for(const watch of latest){
      const result=byId.get(String(watch.id));
      if(!result)continue;
      if(watch.status!=='active'||String(watch.updatedAt||'')!==String(result.watchUpdatedAt||'')){
        superseded+=1;
        continue;
      }
      watch.evaluation=result.evaluation;
      applied+=1;
      result.applied=true;
    }
    await writeTradeWatches(env,latest);
  }

  const discord=await syncEvaluatedWatchDiscord(env,{
    evaluated,
    control,
    origin,
  });

  return summary({
    checkedAt,
    control,
    watches,
    active,
    due,
    selected,
    evaluated,
    applied,
    superseded,
    discord,
  });
}

export function tradeWatchIsDue(watch,control,now=Date.now()){
  if(!watch||watch.status!=='active')return false;
  return watchDueAt(watch,control,Number(now))<=Number(now);
}

export function watchDueAt(watch,control,now=Date.now()){
  const currentNow=Number(now);
  if(isRareSourceBuyWatch(watch)){
    return rareSourceWatchDueAt(watch,currentNow);
  }
  const profile=tradePriorityProfile(control,watch?.query?.priority);
  const lastAttempt=Date.parse(watch?.evaluation?.lastAttemptAt||watch?.evaluation?.lastEvaluatedAt||'');
  if(!Number.isFinite(lastAttempt))return 0;
  return lastAttempt+Math.max(5,Number(profile.refreshMinutes)||5)*60000;
}

export function isRareSourceBuyWatch(watch){
  return Boolean(
    watch?.query?.direction==='buy'
    && isRareTradeCommodity(watch?.query?.commodity)
  );
}

export function rareSourceWatchDueAt(watch,now=Date.now()){
  const currentNow=Number(now);
  const lastAttempt=Date.parse(watch?.evaluation?.lastAttemptAt||watch?.evaluation?.lastEvaluatedAt||'');
  const lastSlot=Number.isFinite(lastAttempt)?rareSourceWatchSlot(lastAttempt):'';
  const current=rareSourceWatchParts(currentNow);

  if(rareSourceWatchHourAllowed(current.hour)&&current.slot!==lastSlot){
    return currentNow;
  }

  // The global Trade Intelligence wake runs every five minutes. Walk forward
  // minute-by-minute so the Watch's displayed "Next due" resolves to the next
  // local 1 PM–8 PM hourly slot, including across CDT/CST changes.
  for(let minutes=1;minutes<=26*60;minutes++){
    const candidate=currentNow+minutes*60000;
    const parts=rareSourceWatchParts(candidate);
    if(rareSourceWatchHourAllowed(parts.hour)&&parts.slot!==lastSlot){
      return candidate;
    }
  }
  return currentNow+24*60*60000;
}

export function rareSourceWatchParts(value){
  const parts={};
  for(const part of RARE_SOURCE_WATCH_FORMATTER.formatToParts(new Date(Number(value)))){
    if(part.type!=='literal')parts[part.type]=part.value;
  }
  const hour=Number(parts.hour);
  const day=parts.year+'-'+parts.month+'-'+parts.day;
  return{day,hour,slot:day+'T'+String(hour).padStart(2,'0')};
}

function rareSourceWatchSlot(value){
  return rareSourceWatchParts(value).slot;
}

function rareSourceWatchHourAllowed(hour){
  return Number(hour)>=RARE_SOURCE_WATCH_START_HOUR&&Number(hour)<=RARE_SOURCE_WATCH_END_HOUR;
}

function nextEvaluationAfterAttempt(watch,control,now){
  const attemptedAt=new Date(Number(now)).toISOString();
  const simulated={
    ...watch,
    evaluation:{
      ...(watch?.evaluation||{}),
      lastAttemptAt:attemptedAt,
      lastEvaluatedAt:attemptedAt,
    },
  };
  return watchDueAt(simulated,control,Number(now)+1);
}

export function detectTradeWatchTransition(previous,{matchCount=0,currentBest=null,at=new Date().toISOString()}={}){
  const previousCount=finiteCount(previous?.matchCount);
  const currentCount=finiteCount(matchCount);
  const previousBest=previous?.currentBest&&typeof previous.currentBest==='object'?previous.currentBest:null;
  const hasBaseline=Number.isFinite(previousCount)
    ||Boolean(previous?.lastSuccessfulAt)
    ||Boolean(previous?.lastEvaluatedAt);

  if(!hasBaseline){
    return{type:'baseline',at,from:'',to:currentCount>0?'matching':'no_match'};
  }
  if(previousCount===0&&currentCount>0){
    return{type:'condition_met',at,from:'no_match',to:'matching'};
  }
  if(previousCount>0&&currentCount===0){
    return{type:'condition_cleared',at,from:'matching',to:'no_match'};
  }
  if(previousCount>0&&currentCount>0&&previousBest?.marketId&&currentBest?.marketId&&String(previousBest.marketId)!==String(currentBest.marketId)){
    return{
      type:'best_market_changed',
      at,
      from:String(previousBest.marketId),
      to:String(currentBest.marketId),
    };
  }
  return null;
}

async function evaluateOne(env,watch,control,{now,fetchImpl}){
  const attemptedAt=new Date(now).toISOString();
  const profile=tradePriorityProfile(control,watch?.query?.priority);
  const nextEvaluationAt=new Date(nextEvaluationAfterAttempt(watch,control,now)).toISOString();
  const previous=watch?.evaluation&&typeof watch.evaluation==='object'?watch.evaluation:{};

  try{
    const result=await searchTradeMarkets(env,watch.query,{
      fetchImpl,
      timeoutMs:TRADE_WATCH_SEARCH_TIMEOUT_MS,
    });
    const visibleResults=Array.isArray(result?.results)?result.results:[];
    const rareEvaluation=isRareSourceBuyWatch(watch)
      ?evaluateRareSourceAllocation(watch,previous,visibleResults,attemptedAt)
      :null;
    const matches=rareEvaluation
      ?(rareEvaluation.currentBest?[rareEvaluation.currentBest]:[])
      :visibleResults.filter(item=>item?.qualifies!==false);
    const qualifyingMatchCount=rareEvaluation
      ?rareEvaluation.matchCount
      :Number.isFinite(Number(result?.qualifyingMatchCount))
        ?Math.max(0,Math.round(Number(result.qualifyingMatchCount)))
        :matches.length;
    const rankedMarkets=rareEvaluation
      ?(rareEvaluation.currentBest?[rareEvaluation.currentBest]:[])
      :matches
        .slice(0,TRADE_WATCH_SHORTLIST_SIZE)
        .map((item,index)=>snapshotMarket(item,watch.query,index+1));
    const knownRareSource=rareEvaluation
      ?rareEvaluation.knownRareSource
      :visibleResults.find(item=>item?.qualifies===false&&item?.rareSourceStatus)
        ?snapshotMarket(visibleResults.find(item=>item?.qualifies===false&&item?.rareSourceStatus),watch.query,1)
        :null;
    const currentBest=rareEvaluation?rareEvaluation.currentBest:(rankedMarkets[0]||null);
    const transition=rareEvaluation
      ?rareEvaluation.transition
      :detectTradeWatchTransition(previous,{
        matchCount:qualifyingMatchCount,
        currentBest,
        at:attemptedAt,
      });

    return{
      id:String(watch.id),
      watchUpdatedAt:String(watch.updatedAt||''),
      ok:true,
      matchCount:qualifyingMatchCount,
      transition:transition?.type||'',
      evaluation:{
        state:result?.partial?'warning':'healthy',
        lastAttemptAt:attemptedAt,
        lastEvaluatedAt:attemptedAt,
        lastSuccessfulAt:attemptedAt,
        nextEvaluationAt,
        lastError:'',
        matchCount:qualifyingMatchCount,
        source:String(result?.source||''),
        sourceMode:String(result?.sourceMode||''),
        partial:Boolean(result?.partial),
        warning:String(result?.warning||'').slice(0,300),
        currentBest,
        knownRareSource,
        rareAllocation:rareEvaluation?.rareAllocation||previous?.rareAllocation||null,
        rankedMarkets,
        lastTransition:transition||(previous?.lastTransition&&typeof previous.lastTransition==='object'?previous.lastTransition:null),
      },
    };
  }catch(error){
    return{
      id:String(watch.id),
      watchUpdatedAt:String(watch.updatedAt||''),
      ok:false,
      error:friendlyError(error),
      transition:'',
      evaluation:{
        ...previous,
        state:'error',
        lastAttemptAt:attemptedAt,
        nextEvaluationAt,
        lastError:friendlyError(error),
      },
    };
  }
}

async function syncEvaluatedWatchDiscord(env,{evaluated=[],control,origin='' }={}){
  const outcome={synced:0,alerts:0,delivered:0,failed:0,skipped:0};
  const base=String(origin||'').trim().replace(/\/$/,'');
  if(!base||!env?.DISCORD_BOT_TOKEN)return outcome;

  const candidates=(Array.isArray(evaluated)?evaluated:[])
    .filter(result=>result?.applied)
    .filter(result=>result?.ok);
  if(!candidates.length)return outcome;

  const current=await readTradeWatches(env);
  const patches=[];

  for(const result of candidates){
    const watch=current.find(item=>
      String(item?.id)===String(result.id)
      && item?.status==='active'
      && String(item?.updatedAt||'')===String(result.watchUpdatedAt||'')
    );
    if(!watch||watch?.discord?.publish===false){
      outcome.skipped+=1;
      continue;
    }

    const working=JSON.parse(JSON.stringify(watch));
    const synced=await syncTradeWatchDiscord(env,{watch:working,origin:base,control});
    applyTradeWatchDiscordState(working,synced);
    if(synced.ok&&synced.attempted)outcome.synced+=1;
    if(!synced.ok&&synced.attempted)outcome.failed+=1;

    if(['condition_met','condition_cleared','best_market_changed','rare_allocation_changed'].includes(result.transition)){
      const alert=await sendTradeWatchTransitionAlert(env,{
        watch:working,
        transition:result.evaluation?.lastTransition,
        origin:base,
        control,
      });
      if(alert.ok&&alert.attempted){
        outcome.alerts+=1;
        outcome.delivered+=Number(alert.delivered)||0;
        working.discord.lastAlertAt=alert.alertAt||new Date().toISOString();
        working.discord.lastAlertType=alert.alertType||result.transition;
      }else if(!alert.ok&&alert.attempted){
        outcome.failed+=1;
      }
    }

    patches.push({
      id:String(watch.id),
      updatedAt:String(watch.updatedAt||''),
      discord:working.discord,
    });
  }

  if(!patches.length)return outcome;

  const latest=await readTradeWatches(env);
  let changed=false;
  for(const patch of patches){
    const watch=latest.find(item=>
      String(item?.id)===patch.id
      && String(item?.updatedAt||'')===patch.updatedAt
    );
    if(!watch)continue;
    watch.discord=patch.discord;
    changed=true;
  }
  if(changed)await writeTradeWatches(env,latest);
  return outcome;
}

function evaluateRareSourceAllocation(watch,previous,visibleResults,attemptedAt){
  const sourceItem=(Array.isArray(visibleResults)?visibleResults:[])[0]||null;
  const source=sourceItem?snapshotMarket(sourceItem,watch.query,1):null;
  const priorBest=previous?.currentBest&&typeof previous.currentBest==='object'?previous.currentBest:null;
  const priorState=previous?.rareAllocation&&typeof previous.rareAllocation==='object'?previous.rareAllocation:{};
  const nowMs=Date.parse(attemptedAt);
  const nowParts=rareSourceWatchParts(nowMs);

  const previousValue=Math.max(
    0,
    Math.round(Number(priorState.value)||0),
    Math.round(Number(priorBest?.volume)||0)
  );
  const priorDayKey=String(priorState.dayKey||'');
  let dayHigh=priorDayKey===nowParts.day?Math.max(0,Math.round(Number(priorState.dayHigh)||0)):0;
  let dayHighObservedAt=priorDayKey===nowParts.day?iso(priorState.dayHighObservedAt):'';
  let dayHighPrice=priorDayKey===nowParts.day?Math.max(0,Math.round(Number(priorState.dayHighPrice)||0)):0;
  let positiveReports=priorDayKey===nowParts.day?Math.max(0,Math.round(Number(priorState.positiveReports)||0)):0;
  let lastPositiveReportAt=priorDayKey===nowParts.day?iso(priorState.lastPositiveReportAt):'';

  const reportedVolume=Math.max(0,Math.round(Number(source?.reportedVolume)||0));
  const reportAt=iso(source?.observedAt);
  const reportDay=reportAt?rareSourceWatchParts(Date.parse(reportAt)).day:'';
  const reportedPositiveToday=reportedVolume>0&&reportDay===nowParts.day;

  if(reportedPositiveToday&&reportAt!==lastPositiveReportAt){
    positiveReports+=1;
    lastPositiveReportAt=reportAt;
  }

  if(reportedPositiveToday&&reportedVolume>dayHigh){
    dayHigh=reportedVolume;
    dayHighObservedAt=reportAt;
    dayHighPrice=Math.max(0,Math.round(Number(source?.price)||0));
  }else if(reportedPositiveToday&&reportedVolume===dayHigh&&Date.parse(reportAt)>Date.parse(dayHighObservedAt||0)){
    dayHighObservedAt=reportAt;
    dayHighPrice=Math.max(0,Math.round(Number(source?.price)||0))||dayHighPrice;
  }

  let value=previousValue;
  let changed=false;
  let trackedObservedAt=iso(priorState.observedAt)||iso(priorBest?.observedAt);
  let price=Math.max(0,Math.round(Number(priorState.price)||0),Math.round(Number(priorBest?.price)||0));

  if(value<=0&&dayHigh>0){
    value=dayHigh;
    price=dayHighPrice||price;
    trackedObservedAt=dayHighObservedAt||trackedObservedAt;
    changed=true;
  }else if(dayHigh>value){
    value=dayHigh;
    price=dayHighPrice||price;
    trackedObservedAt=dayHighObservedAt||trackedObservedAt;
    changed=true;
  }else if(
    nowParts.hour>=RARE_SOURCE_WATCH_END_HOUR
    &&dayHigh>0
    &&dayHigh<value
    &&positiveReports>=2
  ){
    // A lower allocation is not conclusive from a single commander report because
    // partial purchases can also reduce a personal market view. Only accept a
    // downward daily change after at least two separate positive observations and
    // after the full afternoon tick-observation window has completed.
    value=dayHigh;
    price=dayHighPrice||price;
    trackedObservedAt=dayHighObservedAt||trackedObservedAt;
    changed=true;
  }

  if(!price){
    price=Math.max(
      0,
      Math.round(Number(source?.allocationPrice)||0),
      Math.round(Number(source?.price)||0)
    );
  }

  const minVolume=Math.max(0,Math.round(Number(watch?.query?.minVolume)||0));
  const maxPrice=Math.max(0,Math.round(Number(watch?.query?.price)||0));
  const sourcePad=Number(sourceItem?.maxLandingPadSize??0);
  const padOkay=Number(watch?.query?.minPad||0)<=0||sourcePad>=Number(watch.query.minPad);
  const qualifies=value>=minVolume&&value>0&&price>0&&(!maxPrice||price<=maxPrice)&&padOkay;

  const baseSource=source||priorBest||null;
  const currentBest=qualifies&&baseSource?{
    ...baseSource,
    rank:1,
    volume:value,
    allocationVolume:value,
    allocationPrice:price,
    price,
    observedAt:trackedObservedAt||baseSource.observedAt||'',
    allocationObservedAt:trackedObservedAt||baseSource.allocationObservedAt||'',
    commanderSensitiveSupply:true,
  }:null;

  let transition=detectTradeWatchTransition(previous,{
    matchCount:qualifies?1:0,
    currentBest,
    at:attemptedAt,
  });
  if(
    changed
    && previousValue>0
    && value>0
    && value!==previousValue
    && (!transition||!['condition_met','condition_cleared'].includes(transition.type))
  ){
    transition={
      type:'rare_allocation_changed',
      at:attemptedAt,
      from:String(previousValue),
      to:String(value),
      fromVolume:previousValue,
      toVolume:value,
      direction:value>previousValue?'up':'down',
    };
  }

  const rareAllocation={
    value,
    price,
    observedAt:trackedObservedAt,
    dayKey:nowParts.day,
    dayHigh,
    dayHighObservedAt,
    dayHighPrice,
    positiveReports,
    lastPositiveReportAt,
    previousValue:changed&&previousValue>0&&value!==previousValue
      ?previousValue
      :Math.max(0,Math.round(Number(priorState.previousValue)||0)),
    lastReportedSupply:reportedVolume,
    lastReportAt:reportAt||iso(priorState.lastReportAt),
  };

  return{
    matchCount:qualifies?1:0,
    currentBest,
    knownRareSource:source,
    rareAllocation,
    transition,
  };
}

function snapshotMarket(item,query,rank=1){
  const buying=query?.direction==='buy';
  return{
    rank:Math.max(1,Math.round(Number(rank)||1)),
    marketId:String(item?.marketId||''),
    systemName:String(item?.systemName||'').slice(0,140),
    stationName:String(item?.stationName||'').slice(0,140),
    price:Math.max(0,Math.round(Number(buying?item?.buyPrice:item?.sellPrice)||0)),
    volume:Math.max(0,Math.round(Number(buying
      ?(item?.allocationSupply??item?.supply)
      :item?.demand)||0)),
    reportedVolume:Math.max(0,Math.round(Number(buying
      ?(item?.reportedSupply??item?.supply)
      :item?.demand)||0)),
    allocationVolume:Math.max(0,Math.round(Number(item?.allocationSupply)||0)),
    allocationPrice:Math.max(0,Math.round(Number(item?.allocationBuyPrice)||0)),
    allocationObservedAt:iso(item?.allocationObservedAt),
    commanderSensitiveSupply:Boolean(item?.commanderSensitiveSupply),
    distanceLy:finite(item?.distanceLy),
    observedAt:iso(item?.observedAt),
    source:String(item?.source||'').slice(0,60),
    qualifies:item?.qualifies!==false,
    rareSourceStatus:String(item?.rareSourceStatus||'').slice(0,60),
    bgs:snapshotBgs(item?.bgs),
  };
}

function summary({checkedAt,control,watches,active,due,selected,evaluated,applied,superseded,discord={}}){
  return{
    ok:true,
    checkedAt,
    totalWatches:watches.length,
    activeWatches:active.length,
    dueWatches:due.length,
    attempted:selected.length,
    applied,
    superseded,
    deferred:Math.max(0,due.length-selected.length),
    succeeded:evaluated.filter(row=>row.ok).length,
    failed:evaluated.filter(row=>!row.ok).length,
    schedulerFloorMinutes:5,
    rareSourceBuySchedule:{
      timeZone:RARE_SOURCE_WATCH_TIME_ZONE,
      startHour:RARE_SOURCE_WATCH_START_HOUR,
      endHour:RARE_SOURCE_WATCH_END_HOUR,
      label:RARE_SOURCE_WATCH_SCHEDULE_LABEL,
    },
    discord:{
      synced:Number(discord.synced)||0,
      alerts:Number(discord.alerts)||0,
      delivered:Number(discord.delivered)||0,
      failed:Number(discord.failed)||0,
      skipped:Number(discord.skipped)||0,
    },
    results:evaluated.map(row=>({
      id:row.id,
      ok:row.ok,
      applied:Boolean(row.applied),
      matchCount:Number.isFinite(Number(row.matchCount))?Number(row.matchCount):null,
      transition:row.transition||'',
      error:row.error||'',
      nextEvaluationAt:row.evaluation?.nextEvaluationAt||'',
      state:row.evaluation?.state||'',
    })),
    priorities:Object.fromEntries(['critical','high','standard','low'].map(key=>{
      const profile=tradePriorityProfile(control,key);
      return[key,{refreshMinutes:profile.refreshMinutes}];
    })),
  };
}

function finiteCount(value){
  if(value===null||value===undefined||value==='')return NaN;
  const number=Number(value);
  return Number.isFinite(number)?Math.max(0,Math.round(number)):NaN;
}
function snapshotBgs(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const economies=Array.isArray(source.stationEconomies)
    ?source.stationEconomies.slice(0,8).map(item=>({
      name:String(item?.name||'').slice(0,80),
      share:finite(item?.share),
    })).filter(item=>item.name)
    :[];
  return{
    controllingFaction:String(source.controllingFaction||'').slice(0,140),
    factionState:String(source.factionState||'').slice(0,100),
    stationPrimaryEconomy:String(source.stationPrimaryEconomy||'').slice(0,80),
    stationSecondaryEconomy:String(source.stationSecondaryEconomy||'').slice(0,80),
    stationEconomies:economies,
    systemPrimaryEconomy:String(source.systemPrimaryEconomy||'').slice(0,80),
    systemSecondaryEconomy:String(source.systemSecondaryEconomy||'').slice(0,80),
    metadataAt:iso(source.metadataAt),
    metadataAgeMinutes:finite(source.metadataAgeMinutes),
    metadataLagMinutes:finite(source.metadataLagMinutes),
    metadataFreshness:['fresh','aging','stale','unknown'].includes(String(source.metadataFreshness))?String(source.metadataFreshness):'unknown',
    infrastructureFailure:Boolean(source.infrastructureFailure),
    metalCommodity:Boolean(source.metalCommodity),
    infrastructureFailureMetalOpportunity:Boolean(source.infrastructureFailureMetalOpportunity),
    ownershipNeedsConfirmation:Boolean(source.ownershipNeedsConfirmation),
    source:String(source.source||'').slice(0,80),
  };
}

function finite(value){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function iso(value){
  const date=new Date(value||'');
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
function friendlyError(error){
  const code=String(error?.message||error||'trade_watch_evaluation_failed');
  if(code==='market_source_timeout')return'Live market source timed out.';
  if(code==='market_source_unavailable')return'Live market source is temporarily unavailable.';
  if(code.startsWith('market_source_http_'))return'Live market source returned an upstream error.';
  return code.slice(0,300);
}
