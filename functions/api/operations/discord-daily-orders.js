import { json, readSession } from '../../../lib/auth.js';
import { discordOperationsConfigured } from '../../../lib/discord-webhook.js';
import { syncDailyOrdersDiscord } from '../../../lib/daily-orders-discord.js';

const ORDERS_KEY='current';

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!discordOperationsConfigured(env))return reply({ok:false,error:'discord_webhook_not_configured'},503);
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'){
    return reply({ok:false,error:'orders_storage_not_configured'},503);
  }

  let document=null;
  try{document=await env.DAILY_ORDERS.get(ORDERS_KEY,{type:'json'});}
  catch(error){
    console.error('Could not read current Daily Orders for Discord sync',error);
    return reply({ok:false,error:'daily_orders_read_failed'},503);
  }
  if(!document?.configured||!document?.cycleId){
    return reply({ok:false,error:'no_daily_orders_published'},409);
  }

  const actor=String(auth.session.displayName||auth.session.username||'Site Admin').trim().slice(0,120);
  const discord=await syncDailyOrdersDiscord(env,{
    document,
    actor,
    missionControlUrl:missionControlUrlForRequest(request),
    publicationId:'manual-sync',
  });
  if(!discord.ok){
    return reply({ok:false,error:discord.error||'discord_daily_orders_sync_failed',discord},502);
  }
  return reply({ok:true,discord,cycleId:String(document.cycleId)});
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
  if(origin!==expected||marker!=='wolf-bgs-control'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function missionControlUrlForRequest(request){
  const url=new URL('/operations/',request.url);
  url.hash='daily-orders';
  return url.toString();
}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
