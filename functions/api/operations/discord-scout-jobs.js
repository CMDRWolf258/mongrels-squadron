import { json, readSession } from '../../../lib/auth.js';
import { buildScoutJobBoard } from '../../../lib/scout-jobs.js';
import { syncScoutDiscordBoard } from '../../../lib/scout-discord.js';
import { loadActiveMongrelSystems } from '../../../lib/scout-systems.js';
import { discordScoutNetworkConfigured } from '../../../lib/discord-webhook.js';

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!discordScoutNetworkConfigured(env))return reply({ok:false,error:'discord_scout_network_webhook_not_configured'},503);

  try{
    const systems=await loadActiveMongrelSystems(request);
    const board=await buildScoutJobBoard(env,{systems,viewer:null,now:new Date()});
    const discord=await syncScoutDiscordBoard(env,{
      board,
      scoutBoardUrl:new URL('/scout-jobs/',request.url).toString(),
      setupUrl:new URL('/member/?section=live-scout-setup#live-scout-setup',request.url).toString(),
      createMissing:true,
      originSystem:'Diaba',
      ordinaryLimit:15,
    });
    if(discord.error)return reply({ok:false,error:discord.error,discord},502);
    return reply({ok:true,discord});
  }catch(error){
    console.error('Manual Scout Network Discord sync failed',error);
    return reply({ok:false,error:'discord_scout_sync_failed'},502);
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
