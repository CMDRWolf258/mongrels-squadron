import { json, readSession } from '../../../lib/auth.js';
import { evaluateTradeWatches } from '../../../lib/trade-watch-evaluator.js';

const MANAGER_ACCESS=new Set(['officer','site_admin']);

export async function onRequestPost({request,env}){
  const auth=await requireManager(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const id=String(body?.id||'').trim();
  if(!id)return reply({ok:false,error:'watch_id_required'},400);

  try{
    const result=await evaluateTradeWatches(env,{
      force:true,
      watchIds:[id],
      maxWatches:1,
      concurrency:1,
    });
    if(!result.attempted)return reply({ok:false,error:'watch_not_found_or_inactive'},404);
    return reply(result);
  }catch(error){
    console.error('Manual Trade Watch evaluation failed',error);
    return reply({ok:false,error:'trade_watch_evaluation_failed'},502);
  }
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
  if(origin!==expected||marker!=='trade-watch-evaluate')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function headers(){return{'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
