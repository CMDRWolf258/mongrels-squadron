import { json, readSession } from '../../../lib/auth.js';
import { recordFacilityHostOverride } from '../../../lib/orrery-facility-host-overrides.js';

const ALLOWED=new Set(['officer','site_admin']);

export async function onRequestPost({request,env}){
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'officer_access_required'},403);
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);

  let body;
  try{body=await request.json();}catch{return reply({ok:false,error:'invalid_json'},400);}
  const placementMode=body?.placementMode==='temporary_mobile'?'temporary_mobile':'fixed';
  const result=await recordFacilityHostOverride(env,body,{
    updatedAt:new Date().toISOString(),
    updatedBy:session.displayName||session.username||'Mongrel Officer',
    placementMode,
  });
  if(result?.error){
    const status=result.error==='bgs_storage_not_configured'?503:400;
    return reply({ok:false,error:result.error},status);
  }
  return reply({ok:true,override:{
    marketId:result.override.marketId,
    facilityName:result.override.facilityName,
    bodyJournalId:result.override.bodyJournalId,
    bodyName:result.override.bodyName,
    updatedAt:result.override.updatedAt,
    placementMode:result.override.placementMode,
    temporary:result.override.temporary===true,
    verified:true,
  }});
}
function sameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  return origin===expected&&request.headers.get('X-Mongrels-Request')==='orrery-host-editor';
}
function reply(body,status=200){return json(body,{status,headers:{
  'Cache-Control':'private, no-store, no-cache, must-revalidate',
  Pragma:'no-cache',
  Vary:'Cookie',
  'X-Content-Type-Options':'nosniff',
}});}
