import { json, readSession } from '../../../lib/auth.js';
import { normalizeMarketSearch } from '../../../lib/trade-market.js';
import { readTradeControl } from '../../../lib/trade-intelligence.js';
import {
  normalizeTradeWatch,
  readTradeWatches,
  watchQuerySummary,
  writeTradeWatches,
} from '../../../lib/trade-watches.js';

const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const watches=await readTradeWatches(env);
  return reply({
    ok:true,
    watches:watches
      .sort((a,b)=>statusRank(a.status)-statusRank(b.status)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt))
      .map(present),
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;
  const body=await readBody(request);
  if(body.response)return body.response;

  const control=await readTradeControl(env);
  const queryResult=normalizedWatchQuery(body.value?.query,control);
  if(queryResult.error)return reply({ok:false,error:queryResult.error},400);

  const now=new Date().toISOString();
  const query=queryResult.query;

  const watch=normalizeTradeWatch({
    id:crypto.randomUUID(),
    name:String(body.value?.name||'').trim(),
    status:'active',
    query,
    createdById:auth.session.sub,
    createdByName:auth.session.displayName,
    createdAt:now,
    updatedAt:now,
    evaluation:{state:'pending_scheduler'},
    discord:{publish:body.value?.publishDiscord!==false},
  });

  const items=await readTradeWatches(env);
  items.unshift(watch);
  await writeTradeWatches(env,items);
  return reply({ok:true,watch:present(watch)},201);
}

export async function onRequestPut({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;
  const body=await readBody(request);
  if(body.response)return body.response;

  const id=String(body.value?.id||'').trim();
  const items=await readTradeWatches(env);
  const index=items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'watch_not_found'},404);

  const current=items[index];
  const action=String(body.value?.action||'').trim();
  const now=new Date().toISOString();

  if(action==='pause')current.status='paused';
  else if(action==='resume')current.status='active';
  else if(action==='edit'){
    const control=await readTradeControl(env);
    const queryResult=normalizedWatchQuery(body.value?.query,control);
    if(queryResult.error)return reply({ok:false,error:queryResult.error},400);
    const name=String(body.value?.name||'').trim().slice(0,160);
    if(!name)return reply({ok:false,error:'watch_name_required'},400);
    current.name=name;
    current.query=queryResult.query;
    current.discord={...current.discord,publish:body.value?.publishDiscord!==false};
    current.evaluation={
      state:'pending_scheduler',
      lastAttemptAt:'',
      lastEvaluatedAt:'',
      lastSuccessfulAt:'',
      nextEvaluationAt:'',
      lastError:'',
      warning:'',
      matchCount:null,
      source:'',
      sourceMode:'',
      partial:false,
      currentBest:null,
      lastTransition:null,
    };
  }else if(action==='rename'){
    const name=String(body.value?.name||'').trim().slice(0,160);
    if(!name)return reply({ok:false,error:'watch_name_required'},400);
    current.name=name;
  }else if(action==='discord'){
    current.discord={...current.discord,publish:body.value?.publishDiscord!==false};
  }else{
    return reply({ok:false,error:'unsupported_watch_action'},400);
  }

  current.updatedAt=now;
  items[index]=current;
  await writeTradeWatches(env,items);
  return reply({ok:true,watch:present(current)});
}

export async function onRequestDelete({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;

  const id=new URL(request.url).searchParams.get('id')||'';
  const items=await readTradeWatches(env);
  const index=items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'watch_not_found'},404);
  const [removed]=items.splice(index,1);
  await writeTradeWatches(env,items);
  return reply({ok:true,removed:{id:removed.id,name:removed.name}});
}

function present(watch){
  return{
    ...watch,
    summary:watchQuerySummary(watch),
  };
}

async function requireManager(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!MANAGER_ACCESS.has(session.access))return{response:reply({ok:false,error:'officer_access_required'},403)};
  return{session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='trade-watch-editor')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
async function readBody(request){
  try{return{value:await request.json()};}
  catch{return{response:reply({ok:false,error:'invalid_json'},400)};}
}
function normalizedWatchQuery(value,control){
  try{
    const normalized=normalizeMarketSearch(value||{},control);
    return{
      query:{
        commodity:normalized.commodity,
        direction:normalized.direction,
        referenceSystem:normalized.referenceSystem,
        radiusLy:normalized.radiusLy,
        minVolume:normalized.minVolume,
        price:normalized.price,
        minPad:normalized.minPad,
        carrierMode:normalized.carrierMode,
        maxAgeMinutes:normalized.maxAgeMinutes,
        priority:normalized.priority,
        sort:normalized.sort,
        limit:100,
      },
    };
  }catch(error){
    return{error:publicQueryError(error)};
  }
}
function publicQueryError(error){
  const code=String(error?.message||error);
  if(code==='commodity_required')return'commodity_required';
  if(code==='reference_system_required')return'reference_system_required';
  return'invalid_watch_query';
}
function statusRank(value){return value==='active'?0:1;}
function headers(){return{'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
