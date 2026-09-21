import { json, readSession } from '../../../lib/auth.js';

const KV_KEY='wolf-bgs-order-change-reviews-v1';

export async function onRequestGet({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const stored=await readState(env);
  return reply({ok:true,reviews:stored.reviews});
}

export async function onRequestPut({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.put!=='function') {
    return reply({ok:false,error:'review_storage_not_configured'},503);
  }

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const incoming=Array.isArray(body?.reviews)?body.reviews:[];
  const stored=await readState(env);
  const now=new Date().toISOString();
  const actor=auth.session.displayName||auth.session.username||'CMDR Wolf258';

  for(const item of incoming.slice(0,50)){
    const system=clean(item?.system,140);
    const signature=clean(item?.signature,120);
    if(!system||!signature)continue;
    stored.reviews[system]={signature,reviewedAt:now,reviewedBy:actor};
  }

  const entries=Object.entries(stored.reviews)
    .sort((a,b)=>String(b[1]?.reviewedAt||'').localeCompare(String(a[1]?.reviewedAt||'')))
    .slice(0,120);
  stored.reviews=Object.fromEntries(entries);
  stored.updatedAt=now;

  await env.DAILY_ORDERS.put(KV_KEY,JSON.stringify(stored));
  return reply({ok:true,reviews:stored.reviews});
}

async function readState(env){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function')return{version:1,reviews:{},updatedAt:null};
  try{
    const stored=await env.DAILY_ORDERS.get(KV_KEY,{type:'json'});
    return {
      version:1,
      reviews:stored?.reviews&&typeof stored.reviews==='object'?stored.reviews:{},
      updatedAt:stored?.updatedAt||null,
    };
  }catch(error){
    console.error('Could not read order change review state',error);
    return{version:1,reviews:{},updatedAt:null};
  }
}

async function requireSiteAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='wolf-bgs-order-review')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}

function clean(value,max){
  return typeof value==='string'?value.trim().slice(0,max):'';
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
