import { json, readSession } from '../../../lib/auth.js';
import { reconcileAutomaticRewardEntries } from '../../../lib/reward-engine-runtime.js';
import { loadRewardDiscordView, syncRewardDiscordBoard } from '../../../lib/reward-discord.js';

const ALLOWED=new Set(['officer','site_admin']);

export async function onRequestPost({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'officer_access_required'},403);

  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='wolf-reward-auto-reconcile'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }

  try{
    const actor='Reward Engine · '+(session.displayName||session.username||'Mongrel Officer');
    const result=await reconcileAutomaticRewardEntries(env,{actor,baselineActor:'Automatic reward catch-up'});
    const discord=result.created>0?await syncRewardsDiscord(request,env):null;
    return reply({
      ok:true,
      automaticIssuance:true,
      ...result,
      discord,
      message:result.created
        ? result.created+' verified reward entr'+(result.created===1?'y':'ies')+' added to OWED automatically.'
        : 'No new verified reward entries needed to be created.',
    });
  }catch(error){
    console.error('Automatic reward reconciliation failed',error);
    return reply({ok:false,error:'reward_auto_reconcile_failed',message:'Automatic reward reconciliation could not be completed.'},500);
  }
}

async function syncRewardsDiscord(request,env){
  try{
    const view=await loadRewardDiscordView(env);
    const adminUrl=new URL('/wolf-bgs/',request.url);
    adminUrl.hash='reward-engine';
    return await syncRewardDiscordBoard(env,{
      view,
      adminUrl:adminUrl.toString(),
      rewardsUrl:new URL('/rewards/',request.url).toString(),
      createMissing:false,
    });
  }catch(error){
    console.error('Automatic rewards were issued but Rewards Discord sync failed',error);
    return {feature:'rewards',configured:true,error:'discord_rewards_sync_failed',failed:1};
  }
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
