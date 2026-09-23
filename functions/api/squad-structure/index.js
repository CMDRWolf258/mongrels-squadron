import { json, readSession } from '../../../lib/auth.js';
import {
  normalizeSquadStructureUpdate,
  readSquadStructure,
  squadStructureDiscordStatus,
  squadStructureView,
  writeSquadStructure,
} from '../../../lib/squad-structure.js';
import {
  applySquadStructureDiscordState,
  syncSquadStructureDiscord,
} from '../../../lib/squad-structure-discord.js';

export async function onRequestGet({request,env}){
  const session=await readSession(request,env);
  const state=await readSquadStructure(env,{fresh:true});
  const admin=Boolean(session&&session.access==='site_admin');
  return reply({
    ok:true,
    structure:squadStructureView(state),
    canEdit:admin,
    discord:admin?squadStructureDiscordStatus(state):null,
  });
}

export async function onRequestPatch({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request); if(err)return err;
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return reply({ok:false,error:'squad_structure_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const existing=await readSquadStructure(env,{fresh:true});
  const next=normalizeSquadStructureUpdate(body?.structure,existing);
  next.updatedAt=new Date().toISOString();
  next.updatedBy=auth.session.displayName||'Site Admin';

  await writeSquadStructure(env,next);
  const discord=await syncSquadStructureDiscord(env,next,{origin:new URL(request.url).origin});
  applySquadStructureDiscordState(next,discord);
  await writeSquadStructure(env,next);

  return reply({
    ok:true,
    structure:squadStructureView(next),
    discord:squadStructureDiscordStatus(next),
    sync:discord,
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireAdmin(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request); if(err)return err;
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return reply({ok:false,error:'squad_structure_storage_not_configured'},503);

  let body={};
  try{body=await request.json();}
  catch{}
  if(String(body?.action||'sync').toLowerCase()!=='sync')return reply({ok:false,error:'invalid_squad_structure_action'},400);

  const state=await readSquadStructure(env,{fresh:true});
  const discord=await syncSquadStructureDiscord(env,state,{origin:new URL(request.url).origin});
  applySquadStructureDiscordState(state,discord);
  await writeSquadStructure(env,state);

  return reply({
    ok:Boolean(discord.ok),
    structure:squadStructureView(state),
    discord:squadStructureDiscordStatus(state),
    sync:discord,
  },discord.ok?200:502);
}

async function requireAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return {response:reply({ok:false,error:'site_admin_access_required'},403)};
  return {session};
}

function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  if(origin!==new URL(request.url).origin||request.headers.get('X-Mongrels-Request')!=='squad-structure-editor'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}

function headers(){
  return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};
}
function reply(data,status=200){return json(data,{status,headers:headers()})}
