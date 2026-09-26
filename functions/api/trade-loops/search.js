import { json, readSession } from '../../../lib/auth.js';
import { searchTradeLoops } from '../../../lib/trade-loop-finder.js';

const ALLOWED_ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestPost({request,env}){
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  const validation=validateSameOrigin(request);
  if(validation)return validation;

  let input;
  try{input=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  try{
    return reply(await searchTradeLoops(env,input));
  }catch(error){
    const code=String(error?.message||error||'trade_loop_search_failed').split(':')[0];
    const status=
      code==='start_system_required'?400:
      code==='loop_source_timeout'?504:
      code.startsWith('loop_source_http_')||code==='loop_source_invalid_response'?502:
      500;
    return reply({ok:false,error:code,message:friendly(code)},status);
  }
}

async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED_ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='trade-loop-search')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}

function friendly(code){
  if(code==='start_system_required')return'Enter the system where you want to start and finish the loop.';
  if(code==='loop_source_timeout')return'The live market source took too long to build the route snapshot. Try a smaller radius.';
  if(code.startsWith('loop_source_http_')||code==='loop_source_invalid_response')return'The live market source is temporarily unavailable.';
  return'The route optimizer could not complete this search.';
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
