import { json, readSession } from '../../../lib/auth.js';
import { applyEventRsvp } from '../../../lib/squad-events.js';

const ALLOWED_ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestPost({request,env}){
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED_ACCESS.has(session.access))return reply({ok:false,error:'member_access_required'},403);
  const error=validateSameOrigin(request);
  if(error)return error;
  if(!env?.PROJECTS||typeof env.PROJECTS.get!=='function'||typeof env.PROJECTS.put!=='function'){
    return reply({ok:false,error:'projects_storage_not_configured'},503);
  }

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const eventId=clean(body?.id).slice(0,100);
  const status=clean(body?.status).slice(0,20);
  if(!eventId)return reply({ok:false,error:'event_id_required'},400);

  const result=await applyEventRsvp(env,{
    eventId,
    userId:session.sub,
    displayName:session.displayName||session.username||'Commander',
    status,
    origin:new URL(request.url).origin,
  });
  if(!result.ok){
    const statusCode=result.mode==='event_not_found'?404
      :result.mode==='event_rsvp_closed'?409
        :400;
    return reply({ok:false,error:result.mode},statusCode);
  }
  return reply(result);
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  if(origin!==expected||request.headers.get('X-Mongrels-Request')!=='project-event-rsvp'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function reply(data,status=200){
  return json(data,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
