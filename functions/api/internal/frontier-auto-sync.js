import { json } from '../../../lib/auth.js';
import { getAccount, listFrontierAccounts, saveAccount } from '../../../lib/frontier.js';
import { syncFrontierAccount } from '../frontier/sync.js';

export const FRONTIER_AUTO_SYNC_INTERVAL_MS=24*60*60*1000;
export const FRONTIER_AUTO_SYNC_BATCH_SIZE=8;

export async function onRequestPost({request,env}){
  const auth=await authenticateCron(request,env);
  if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);

  const now=Date.now();
  const checkedAt=new Date(now).toISOString();
  try{
    const accounts=await listFrontierAccounts(env);
    const due=accounts
      .filter(row=>autoSyncDue(row?.account,now))
      .sort((a,b)=>syncAgeKey(a?.account)-syncAgeKey(b?.account));
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
        if(!autoSyncDue(before,Date.now())){
          results.push({commander,ok:true,skipped:true,reason:'no_longer_due'});
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
      dueAccounts:due.length,
      attempted:selected.length,
      deferred:Math.max(0,due.length-selected.length),
      succeeded:results.filter(row=>row.ok).length,
      failed:results.filter(row=>!row.ok).length,
      intervalHours:24,
      schedulerCadenceHours:6,
      batchSize:FRONTIER_AUTO_SYNC_BATCH_SIZE,
      results,
    });
  }catch(error){
    console.error('Scheduled Frontier auto sync failed',error);
    return reply({ok:false,error:'scheduled_frontier_auto_sync_failed'},502);
  }
}

export function autoSyncDue(account,now=Date.now()){
  const current=Number(now);
  const lastSync=Date.parse(account?.lastSyncAt||'');
  const lastAttempt=Date.parse(account?.lastAutoSyncAttemptAt||'');
  if(account?.autoSyncReauthRequired===true){
    return !Number.isFinite(lastAttempt)||current-lastAttempt>=FRONTIER_AUTO_SYNC_INTERVAL_MS;
  }
  return !Number.isFinite(lastSync)||current-lastSync>=FRONTIER_AUTO_SYNC_INTERVAL_MS;
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
