import { readTradeControl, tradePriorityProfile } from './trade-intelligence.js';
import { searchTradeMarkets } from './trade-market.js';
import { readTradeWatches, writeTradeWatches } from './trade-watches.js';
import {
  applyTradeWatchDiscordState,
  sendTradeWatchTransitionAlert,
  syncTradeWatchDiscord,
} from './trade-discord.js';

export const TRADE_WATCH_EVALUATION_BATCH_SIZE=6;
export const TRADE_WATCH_EVALUATION_CONCURRENCY=2;
export const TRADE_WATCH_SEARCH_TIMEOUT_MS=8000;

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
    .map(watch=>({watch,dueAt:watchDueAt(watch,control)}))
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
  return watchDueAt(watch,control)<=Number(now);
}

export function watchDueAt(watch,control){
  const profile=tradePriorityProfile(control,watch?.query?.priority);
  const lastAttempt=Date.parse(watch?.evaluation?.lastAttemptAt||watch?.evaluation?.lastEvaluatedAt||'');
  if(!Number.isFinite(lastAttempt))return 0;
  return lastAttempt+Math.max(5,Number(profile.refreshMinutes)||5)*60000;
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
  const nextEvaluationAt=new Date(now+Math.max(5,Number(profile.refreshMinutes)||5)*60000).toISOString();
  const previous=watch?.evaluation&&typeof watch.evaluation==='object'?watch.evaluation:{};

  try{
    const result=await searchTradeMarkets(env,watch.query,{
      fetchImpl,
      timeoutMs:TRADE_WATCH_SEARCH_TIMEOUT_MS,
    });
    const matches=Array.isArray(result?.results)?result.results:[];
    const currentBest=matches[0]?snapshotBest(matches[0],watch.query):null;
    const transition=detectTradeWatchTransition(previous,{
      matchCount:matches.length,
      currentBest,
      at:attemptedAt,
    });

    return{
      id:String(watch.id),
      watchUpdatedAt:String(watch.updatedAt||''),
      ok:true,
      matchCount:matches.length,
      transition:transition?.type||'',
      evaluation:{
        state:result?.partial?'warning':'healthy',
        lastAttemptAt:attemptedAt,
        lastEvaluatedAt:attemptedAt,
        lastSuccessfulAt:attemptedAt,
        nextEvaluationAt,
        lastError:'',
        matchCount:matches.length,
        source:String(result?.source||''),
        sourceMode:String(result?.sourceMode||''),
        partial:Boolean(result?.partial),
        warning:String(result?.warning||'').slice(0,300),
        currentBest,
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

    if(['condition_met','condition_cleared','best_market_changed'].includes(result.transition)){
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

function snapshotBest(item,query){
  const buying=query?.direction==='buy';
  return{
    marketId:String(item?.marketId||''),
    systemName:String(item?.systemName||'').slice(0,140),
    stationName:String(item?.stationName||'').slice(0,140),
    price:Math.max(0,Math.round(Number(buying?item?.buyPrice:item?.sellPrice)||0)),
    volume:Math.max(0,Math.round(Number(buying?item?.supply:item?.demand)||0)),
    distanceLy:finite(item?.distanceLy),
    observedAt:iso(item?.observedAt),
    source:String(item?.source||'').slice(0,60),
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
