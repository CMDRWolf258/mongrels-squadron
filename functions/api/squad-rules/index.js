import { json, readSession } from '../../../lib/auth.js';
import {
  readSquadRulesDiscordState,
  squadRulesDiscordStatus,
  syncSquadRulesDiscord,
} from '../../../lib/squad-rules-discord.js';

export async function onRequestGet({request,env}){
  const session=await readSession(request,env);
  const canManage=Boolean(session&&session.access==='site_admin');
  const state=await readSquadRulesDiscordState(env);
  return reply({
    ok:true,
    canManage,
    discord:canManage?squadRulesDiscordStatus(state,env):null,
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request); if(err)return err;
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return reply({ok:false,error:'squad_rules_storage_not_configured'},503);

  let body={};
  try{body=await request.json();}
  catch{}
  if(String(body?.action||'sync_discord').toLowerCase()!=='sync_discord')return reply({ok:false,error:'invalid_action'},400);

  const discord=await syncSquadRulesDiscord(env,{origin:new URL(request.url).origin});
  const state=await readSquadRulesDiscordState(env);
  return reply({
    ok:Boolean(discord.ok),
    discord:squadRulesDiscordStatus(state,env),
    sync:discord,
  },discord.ok?200:502);
}

async function requireAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_access_required'},403)};
  return{session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  if(origin!==new URL(request.url).origin||request.headers.get('X-Mongrels-Request')!=='squad-rules-admin'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function reply(data,status=200){
  return json(data,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}});
}
