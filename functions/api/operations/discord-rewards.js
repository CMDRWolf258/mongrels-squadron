import { json, readSession } from '../../../lib/auth.js';
import { discordOperationsConfigured } from '../../../lib/discord-webhook.js';
import { loadRewardDiscordView, syncRewardDiscordBoard } from '../../../lib/reward-discord.js';

export async function onRequestPost({request,env}){
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const originError=validateSameOrigin(request);
  if(originError)return originError;
  if(!discordOperationsConfigured(env))return reply({ok:false,error:'discord_webhook_not_configured'},503);

  try{
    const view=await loadRewardDiscordView(env);
    const discord=await syncRewardDiscordBoard(env,{
      view,
      adminUrl:rewardAdminUrl(request),
      rewardsUrl:new URL('/rewards/',request.url).toString(),
      createMissing:true,
    });
    if(discord.error)return reply({ok:false,error:discord.error,discord},502);
    return reply({ok:true,discord});
  }catch(error){
    console.error('Manual Rewards Discord sync failed',error);
    return reply({ok:false,error:'discord_rewards_sync_failed'},502);
  }
}

function rewardAdminUrl(request){
  const url=new URL('/wolf-bgs/',request.url);
  url.hash='reward-engine';
  return url.toString();
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
