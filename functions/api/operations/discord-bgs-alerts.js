import { json, readSession } from '../../../lib/auth.js';
import { discordFactionAlertsConfigured } from '../../../lib/discord-webhook.js';
import { loadBgsDiscordView, syncBgsDiscordBoard } from '../../../lib/bgs-discord.js';

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!discordFactionAlertsConfigured(env))return reply({ok:false,error:'discord_faction_alerts_webhook_not_configured'},503);

  try{
    const view=await loadBgsDiscordView(request,env);
    const discord=await syncBgsDiscordBoard(env,{
      view,
      missionControlUrl:new URL('/operations/#all-systems',request.url).toString(),
      createMissing:true,
    });
    if(discord.error)return reply({ok:false,error:discord.error,discord},502);
    return reply({ok:true,discord});
  }catch(error){
    console.error('Manual Faction Alerts Discord sync failed',error);
    return reply({ok:false,error:'discord_faction_alerts_sync_failed'},502);
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
  if(origin!==expected||marker!=='wolf-bgs-control')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
