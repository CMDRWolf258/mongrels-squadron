import { json } from '../../../lib/auth.js';
import { getAccount, getEventStoreMeta, listFrontierAccounts, saveAccount } from '../../../lib/frontier.js';
import { syncFrontierAccount } from '../frontier/sync.js';

export const FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS=24*60*60*1000;
export const FRONTIER_AUTO_SYNC_HARD_ELIGIBLE_MS=30*60*60*1000;
export const FRONTIER_AUTO_SYNC_SCOUT_GRACE_MS=12*60*60*1000;
// Backwards-compatible name used by existing diagnostics/tests.
export const FRONTIER_AUTO_SYNC_INTERVAL_MS=FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS;
export const FRONTIER_AUTO_SYNC_BATCH_SIZE=8;

export async function onRequestPost({request,env}){
  const auth=await authenticateCron(request,env);
  if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);

  const now=Date.now();
  const checkedAt=new Date(now).toISOString();
  try{
    const accounts=await listFrontierAccounts(env);
    const candidates=accounts.filter(row=>autoSyncWindowOpen(row?.account,now));
    const evaluated=await Promise.all(candidates.map(async row=>{
      const activityMeta=needsScoutActivityCheck(row?.account,now)
        ? await getEventStoreMeta(env,String(row?.userId||''))
        : null;
      return{...row,activityMeta,decision:autoSyncDecision(row?.account,activityMeta,now)};
    }));
    const due=evaluated
      .filter(row=>row.decision.due)
      .sort((a,b)=>syncAgeKey(a?.account)-syncAgeKey(b?.account));
    const scoutDeferred=evaluated.filter(row=>row.decision.reason==='recent_scout_activity');
    const selected=due.slice(0,FRONTIER_AUTO_SYNC_BATCH_SIZE);
    const results=[];

    for(const row of selected){
      const userId=String(row?.userId||'');
      const commander=String(row?.account?.commander||'Elite CMDR');
      const attemptAt=new Date().toISOString();
      try{
        const before=await getAccount(env,userId);
        if(!before){
          results.push({commander,ok:false,error:'frontier_account_missing'});
          continue;
        }
        const activityMeta=needsScoutActivityCheck(before,Date.now())
          ? await getEventStoreMeta(env,userId)
          : null;
        const decision=autoSyncDecision(before,activityMeta,Date.now());
        if(!decision.due){
          results.push({commander,ok:true,skipped:true,reason:decision.reason});
          continue;
        }
        await saveAccount(env,userId,{...before,lastAutoSyncAttemptAt:attemptAt});
        const response=await syncFrontierAccount({
          request,
          env,
          userId,
          diagnostics:false,
          respectCooldown:false,
          syncSource:'auto',
        });
        const body=await response.json().catch(()=>({}));
        if(response.ok&&body?.ok!==false){
          results.push({
            commander,
            ok:true,
            reason:decision.reason,
            lastSyncAt:body?.account?.lastSyncAt||null,
            newEvents:Number(body?.newEvents)||0,
            storedEvents:Number(body?.storedEvents)||0,
            rewardsCreated:Number(body?.automaticRewards?.created||0)+Number(body?.memberFundedColonization?.created||0),
          });
          continue;
        }

        const error=String(body?.error||('frontier_auto_sync_http_'+response.status));
        await markFailure(env,userId,{attemptAt,error});
        results.push({commander,ok:false,error,status:response.status});
      }catch(error){
        const code=String(error?.message||error||'frontier_auto_sync_failed');
        await markFailure(env,userId,{attemptAt,error:code});
        results.push({commander,ok:false,error:code});
      }
    }

    return reply({
      ok:true,
      checkedAt,
      connectedAccounts:accounts.length,
      candidateAccounts:candidates.length,
      dueAccounts:due.length,
      scoutDeferredAccounts:scoutDeferred.length,
      attempted:selected.length,
      deferred:Math.max(0,due.length-selected.length)+scoutDeferred.length,
      batchDeferred:Math.max(0,due.length-selected.length),
      succeeded:results.filter(row=>row.ok&&!row.skipped).length,
      skipped:results.filter(row=>row.skipped).length,
      failed:results.filter(row=>!row.ok).length,
      softIntervalHours:24,
      hardEligibilityHours:30,
      maximumScheduledAgeHours:36,
      scoutActivityGraceHours:12,
      schedulerCadenceHours:6,
      batchSize:FRONTIER_AUTO_SYNC_BATCH_SIZE,
      results,
    });
  }catch(error){
    console.error('Scheduled Frontier auto sync failed',error);
    return reply({ok:false,error:'scheduled_frontier_auto_sync_failed'},502);
  }
}

export function autoSyncDue(account,now=Date.now(),activityMeta=null){
  return autoSyncDecision(account,activityMeta,now).due;
}

export function autoSyncDecision(account,activityMeta=null,now=Date.now()){
  const current=Number(now);
  const lastSync=Date.parse(account?.lastSyncAt||'');
  const lastAttempt=Date.parse(account?.lastAutoSyncAttemptAt||'');

  if(account?.autoSyncReauthRequired===true){
    const due=!Number.isFinite(lastAttempt)||current-lastAttempt>=FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS;
    return{due,reason:due?'reauth_retry_due':'reauth_retry_wait'};
  }
  if(!Number.isFinite(lastSync))return{due:true,reason:'never_synced'};

  const age=current-lastSync;
  if(age<FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS)return{due:false,reason:'recent_frontier_sync'};
  if(age>=FRONTIER_AUTO_SYNC_HARD_ELIGIBLE_MS)return{due:true,reason:'hard_reconciliation_due'};

  const lastScout=Date.parse(activityMeta?.lastScoutActivityAt||'');
  if(Number.isFinite(lastScout)&&current-lastScout<FRONTIER_AUTO_SYNC_SCOUT_GRACE_MS){
    return{due:false,reason:'recent_scout_activity',lastScoutActivityAt:new Date(lastScout).toISOString()};
  }
  return{due:true,reason:'soft_reconciliation_due'};
}

function autoSyncWindowOpen(account,now){
  const current=Number(now);
  const lastSync=Date.parse(account?.lastSyncAt||'');
  const lastAttempt=Date.parse(account?.lastAutoSyncAttemptAt||'');
  if(account?.autoSyncReauthRequired===true){
    return !Number.isFinite(lastAttempt)||current-lastAttempt>=FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS;
  }
  return !Number.isFinite(lastSync)||current-lastSync>=FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS;
}

function needsScoutActivityCheck(account,now){
  const current=Number(now);
  const lastSync=Date.parse(account?.lastSyncAt||'');
  if(account?.autoSyncReauthRequired===true||!Number.isFinite(lastSync))return false;
  const age=current-lastSync;
  return age>=FRONTIER_AUTO_SYNC_SOFT_INTERVAL_MS&&age<FRONTIER_AUTO_SYNC_HARD_ELIGIBLE_MS;
}

function syncAgeKey(account){
  const last=Date.parse(account?.lastSyncAt||'');
  return Number.isFinite(last)?last:0;
}

async function markFailure(env,userId,{attemptAt,error}={}){
  try{
    const current=await getAccount(env,userId);
    if(!current)return;
    const code=String(error||'frontier_auto_sync_failed').slice(0,160);
    await saveAccount(env,userId,{
      ...current,
      lastAutoSyncAttemptAt:attemptAt||new Date().toISOString(),
      lastAutoSyncError:code,
      autoSyncReauthRequired:code.includes('frontier_reauthorization_required'),
    });
  }catch(saveError){
    console.error('Could not store Frontier auto-sync failure state',saveError);
  }
}

async function authenticateCron(request,env){
  const expected=String(
    env?.FRONTIER_AUTO_SYNC_CRON_TOKEN
    || env?.SCOUT_DISCORD_CRON_TOKEN
    || ''
  ).trim();
  if(expected.length<24)return{ok:false,status:503,error:'frontier_auto_sync_cron_not_configured'};
  const header=String(request.headers.get('Authorization')||'');
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return{ok:false,status:401,error:'invalid_cron_token'};
  const supplied=match[1].trim();
  return await secureEqual(supplied,expected)
    ? {ok:true,status:200,error:''}
    : {ok:false,status:401,error:'invalid_cron_token'};
}

async function secureEqual(a,b){
  const [aa,bb]=await Promise.all([sha256(a),sha256(b)]);
  if(aa.length!==bb.length)return false;
  let diff=0;
  for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
  return diff===0;
}
async function sha256(value){
  const data=new TextEncoder().encode(String(value||''));
  return new Uint8Array(await crypto.subtle.digest('SHA-256',data));
}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    'X-Content-Type-Options':'nosniff',
  }});
}
