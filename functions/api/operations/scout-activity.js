import { json } from '../../../lib/auth.js';
import { mergeEventsWithResult } from '../../../lib/frontier.js';
import {
  authenticateScoutActivity,
  consumeScoutActivityRateLimit,
  normalizeScoutActivityBatch,
  SCOUT_ACTIVITY_RATE_LIMIT_PER_HOUR,
} from '../../../lib/scout-activity.js';

export async function onRequestPost({request,env}){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'||typeof env.DAILY_ORDERS.put!=='function'){
    return reply({ok:false,error:'activity_storage_not_configured'},503);
  }

  const auth=await authenticateScoutActivity(request,env);
  if(!auth)return reply({ok:false,error:'invalid_scout_token'},401);
  if(!auth.ownerId)return reply({ok:false,error:'scout_owner_not_bound'},403);

  const rate=await consumeScoutActivityRateLimit(env,auth.id);
  if(!rate.allowed){
    return reply({
      ok:false,
      error:'scout_rate_limit_reached',
      limit:SCOUT_ACTIVITY_RATE_LIMIT_PER_HOUR,
      retryAfterSeconds:rate.retryAfterSeconds,
    },429,{'Retry-After':String(rate.retryAfterSeconds)});
  }

  const length=Number(request.headers.get('content-length')||0);
  if(length>96000)return reply({ok:false,error:'payload_too_large'},413);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const normalized=normalizeScoutActivityBatch(body,auth);
  if(!normalized)return reply({ok:false,error:'invalid_activity_batch'},400);
  if(!normalized.events.length&&!normalized.excluded.length){
    return reply({
      ok:true,
      accepted:true,
      changed:false,
      received:Array.isArray(body?.events)?Math.min(body.events.length,24):0,
      normalized:0,
      rejected:normalized.rejected,
      scout:auth.label,
    },200);
  }

  const result=await mergeEventsWithResult(
    env,
    auth.ownerId,
    normalized.events,
    normalized.excluded,
    {lastScoutActivityAt:normalized.lastActivityAt},
  );

  return reply({
    ok:true,
    accepted:true,
    changed:result.changed,
    eventChanged:result.eventChanged,
    received:Array.isArray(body?.events)?Math.min(body.events.length,24):0,
    normalized:normalized.events.length,
    excluded:normalized.excluded.length,
    rejected:normalized.rejected,
    added:result.added,
    updated:result.updated,
    removed:result.removed,
    lastScoutActivityAt:result.lastScoutActivityAt,
    scout:auth.label,
  },200);
}

function reply(body,status=200,extraHeaders={}){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    'X-Content-Type-Options':'nosniff',
    ...extraHeaders,
  }});
}
