import { json, readSession } from '../../../lib/auth.js';
import { getAccount } from '../../../lib/frontier.js';
import {
  buildScoutJobBoard,
  claimScoutJob,
  listBoundScoutTokens,
  readScoutJobSettings,
  releaseScoutJobClaim,
  writeScoutJobSettings,
} from '../../../lib/scout-jobs.js';

const ALLOWED=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}){
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;

  const admin=new URL(request.url).searchParams.get('admin')==='1'&&auth.session.access==='site_admin';
  const [systems,account]=await Promise.all([
    activeMongrelSystems(request),
    getAccount(env,auth.session.sub),
  ]);
  const board=await buildScoutJobBoard(env,{
    systems,
    viewer:{
      userId:auth.session.sub,
      displayName:auth.session.displayName||auth.session.username||'Mongrel Member',
      commander:account?.commander||auth.session.displayName||auth.session.username||'Mongrel CMDR',
    },
    now:new Date(),
    includeDisabled:admin,
  });

  return reply({
    ok:true,
    ...board,
    canManage:auth.session.access==='site_admin',
    ...(admin?{settings:board.settings}:{settings:undefined}),
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!storageReady(env))return reply({ok:false,error:'scout_job_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const action=clean(body?.action);
  const system=clean(body?.system).slice(0,140);
  const actor=auth.session.displayName||auth.session.username||'Mongrel Member';

  try{
    if(action==='claim'){
      if(!system)return reply({ok:false,error:'system_required'},400);
      const [systems,account,boundTokens]=await Promise.all([
        activeMongrelSystems(request),
        getAccount(env,auth.session.sub),
        listBoundScoutTokens(env,auth.session.sub),
      ]);
      if(!containsSystem(systems,system))return reply({ok:false,error:'scout_job_system_not_active'},409);
      if(!boundTokens.length)return reply({ok:false,error:'scout_token_not_bound'},409);
      const result=await claimScoutJob(env,{
        system,
        ownerId:auth.session.sub,
        commander:account?.commander||actor,
        now:new Date(),
      });
      return reply({ok:true,action:'claim',claim:result.claim,alreadyClaimed:result.alreadyClaimed});
    }

    if(action==='release'){
      if(!system)return reply({ok:false,error:'system_required'},400);
      const result=await releaseScoutJobClaim(env,{system,ownerId:auth.session.sub,now:new Date()});
      return reply({ok:true,action:'release',...result});
    }

    if(auth.session.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);
    const current=await readScoutJobSettings(env);

    if(action==='save-global'){
      const next={
        ...current,
        defaultRewardMillions:bounded(body?.defaultRewardMillions,current.defaultRewardMillions,0,100000),
      };
      const saved=await writeScoutJobSettings(env,next,{actor});
      return reply({ok:true,action,settings:saved});
    }

    if(action==='save-system'){
      if(!system)return reply({ok:false,error:'system_required'},400);
      const existing=findRule(current,system)||{};
      current.systems={
        ...(current.systems||{}),
        [canonicalRuleName(current,system)]:{
          ...existing,
          enabled:body?.enabled!==false,
          bonusMillions:bounded(body?.bonusMillions,existing.bonusMillions||0,0,100000),
          reason:clean(body?.reason).slice(0,240),
          bonusOnce:body?.bonusOnce!==false,
          updatedAt:new Date().toISOString(),
          updatedBy:actor,
        },
      };
      const saved=await writeScoutJobSettings(env,current,{actor});
      return reply({ok:true,action,settings:saved});
    }

    return reply({ok:false,error:'unsupported_action'},400);
  }catch(error){
    const code=clean(error?.message)||'scout_job_action_failed';
    const status=['scout_job_claimed_by_another','scout_job_already_awarded','scout_job_disabled'].includes(code)?409:400;
    return reply({ok:false,error:code},status);
  }
}

async function activeMongrelSystems(request){
  try{
    const url=new URL('/data/live-bgs.json',request.url);
    const response=await fetch(url.toString(),{headers:{Accept:'application/json'},cf:{cacheTtl:0}});
    if(!response.ok)throw new Error('live_bgs_'+response.status);
    const data=await response.json();
    return (Array.isArray(data?.systems)?data.systems:[])
      .filter(row=>row?.name&&row.present!==false&&row.formerPresence!==true)
      .map(row=>({name:clean(row.name).slice(0,140)}));
  }catch(error){
    console.error('Scout Jobs could not load active Mongrel systems',error);
    return[];
  }
}

function containsSystem(rows,system){
  const wanted=norm(system);
  return rows.some(row=>norm(row?.name)===wanted);
}
function findRule(settings,system){
  const wanted=norm(system);
  for(const [name,row] of Object.entries(settings?.systems||{}))if(norm(name)===wanted)return row;
  return null;
}
function canonicalRuleName(settings,system){
  const wanted=norm(system);
  for(const name of Object.keys(settings?.systems||{}))if(norm(name)===wanted)return name;
  return system;
}
async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='scout-jobs')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function bounded(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
