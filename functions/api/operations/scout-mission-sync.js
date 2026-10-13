import { json } from '../../../lib/auth.js';
import { authenticateScoutActivity } from '../../../lib/scout-activity.js';
import { missionSyncKey, mergeMissionSync, visibleMissionSyncRecords } from '../../../lib/scout-mission-sync.js';

function reply(data,status=200){
  return json(data,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    'X-Content-Type-Options':'nosniff',
  }});
}
async function authenticate(request,env,commander){
  if(!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get!=='function' ||
     typeof env.DAILY_ORDERS.put!=='function')return {error:'storage_unavailable',status:503};
  const auth=await authenticateScoutActivity(request,env);
  if(!auth?.ownerId || !auth?.ownerCommander)return {error:'scout_identity_not_bound',status:403};
  if(typeof commander!=='string' ||
     commander.trim().replace(/\s+/g,' ').toLowerCase() !==
     auth.ownerCommander.trim().replace(/\s+/g,' ').toLowerCase()){
    return {error:'commander_mismatch',status:403};
  }
  return {key:missionSyncKey(auth.ownerId,auth.ownerCommander)};
}
export async function onRequestGet({request,env}){
  const commander=new URL(request.url).searchParams.get('commander');
  const access=await authenticate(request,env,commander);
  if(access.error)return reply({ok:false,error:access.error},access.status);
  try{
    const data=await env.DAILY_ORDERS.get(access.key,{type:'json'});
    return reply({ok:true,version:1,missions:visibleMissionSyncRecords(data),updatedAt:data?.updatedAt||null});
  }catch(error){
    console.error('Scout mission sync read failed',error);
    return reply({ok:false,error:'mission_sync_unavailable'},503);
  }
}
export async function onRequestPost({request,env}){
  const length=Number(request.headers.get('content-length')||0);
  if(length > 36000)return reply({ok:false,error:'payload_too_large'},413);
  let body;
  try{body=await request.json();}catch{return reply({ok:false,error:'invalid_json'},400);}
  if(!body || typeof body!=='object' || body.version!==1 ||
     !Array.isArray(body.operations) || body.operations.length>24){
    return reply({ok:false,error:'invalid_operations'},400);
  }
  const access=await authenticate(request,env,body.commander);
  if(access.error)return reply({ok:false,error:access.error},access.status);
  try{
    const prior=await env.DAILY_ORDERS.get(access.key,{type:'json'});
    const result=mergeMissionSync(prior,body.operations);
    if(result.rejected)return reply({ok:false,error:'invalid_mission_operations',rejected:result.rejected},400);
    if(result.changed){
      await env.DAILY_ORDERS.put(access.key,JSON.stringify(result.state),{expirationTtl:90*86400});
    }
    return reply({ok:true,accepted:result.accepted,changed:result.changed,updatedAt:result.state.updatedAt});
  }catch(error){
    console.error('Scout mission sync write failed',error);
    return reply({ok:false,error:'mission_sync_unavailable'},503);
  }
}
