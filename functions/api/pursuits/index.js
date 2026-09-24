import { json, readSession } from '../../../lib/auth.js';
import {
  MONGREL_PURSUITS,
  getMemberPursuitIds,
  readPursuitsState,
  setMemberPursuits,
} from '../../../lib/mongrel-pursuits.js';
import {
  mongrelPursuitsDiscordConfig,
  syncMemberPursuitRoles,
  syncMongrelPursuitsDiscord,
} from '../../../lib/mongrel-pursuits-discord.js';

const ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}){
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  const state=await readPursuitsState(env);
  const selected=await getMemberPursuitIds(env,auth.session.sub,{profileFallback:true});
  const canManage=auth.session.access==='site_admin';
  const discordConfig=mongrelPursuitsDiscordConfig(env);
  return reply({
    ok:true,
    viewer:viewer(auth.session),
    pursuits:MONGREL_PURSUITS,
    selected,
    canManage,
    discord:{
      configured:discordConfig.configured,
      cardLinked:Boolean(state.discord?.messageId&&state.discord?.channelId),
      lastSyncedAt:state.discord?.lastSyncedAt||'',
      lastError:canManage?(state.discord?.lastError||''):'',
      roleCount:Object.keys(state.discord?.roleIds||{}).length,
      target:'🐺〡mongrel-pursuits',
    },
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request); if(err)return err;
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return reply({ok:false,error:'pursuits_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const action=clean(body?.action||'save').toLowerCase();
  if(action==='sync_discord'){
    if(auth.session.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);
    const discord=await syncMongrelPursuitsDiscord(env,{origin:new URL(request.url).origin});
    const state=await readPursuitsState(env);
    return reply({
      ok:Boolean(discord.ok),
      discord,
      roleCount:Object.keys(state.discord?.roleIds||{}).length,
    },discord.ok?200:502);
  }
  if(action!=='save')return reply({ok:false,error:'invalid_action'},400);

  const saved=await setMemberPursuits(env,{
    ownerId:auth.session.sub,
    displayName:auth.session.displayName||auth.session.username||'Mongrel',
    pursuits:body?.pursuits,
    source:'website',
  });
  const roleSync=await syncMemberPursuitRoles(env,{
    userId:auth.session.sub,
    pursuits:saved.member.pursuits,
    state:saved.state,
  });
  return reply({
    ok:true,
    selected:saved.member.pursuits,
    roleSync,
    updatedAt:saved.member.updatedAt,
  });
}

async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!ACCESS.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='mongrels-pursuits')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function viewer(session){return{id:String(session.sub||''),displayName:clean(session.displayName||session.username||'Mongrel'),access:session.access}}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function reply(data,status=200){return json(data,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}});}
