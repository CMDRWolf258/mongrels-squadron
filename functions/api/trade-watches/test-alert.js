import { json, readSession } from '../../../lib/auth.js';
import { sendTradeWatchTestAlert } from '../../../lib/trade-discord.js';
import { readTradeWatches } from '../../../lib/trade-watches.js';

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

  const watches=await readTradeWatches(env);
  const watch=watches.find(item=>String(item?.id)===id);
  if(!watch)return reply({ok:false,error:'watch_not_found'},404);
  if(watch.status!=='active')return reply({ok:false,error:'watch_not_active'},409);
  if(watch.discord?.publish===false)return reply({ok:false,error:'watch_discord_disabled'},409);

  try{
    const result=await sendTradeWatchTestAlert(env,{
      watch,
      origin:new URL(request.url).origin,
    });
    if(!result.ok)return reply({ok:false,error:result.error||result.mode||'test_alert_failed'},502);
    return reply({ok:true,...result});
  }catch(error){
    console.error('Trade Watch test alert failed',error);
    return reply({ok:false,error:'trade_watch_test_alert_failed'},502);
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
  if(origin!==expected||marker!=='trade-watch-test-alert')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function headers(){return{'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
