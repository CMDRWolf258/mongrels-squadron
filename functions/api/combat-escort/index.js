import { json, readSession } from '../../../lib/auth.js';
import {
  createEscortRequest,
  presentEscortRequest,
  readEscortRequests,
  setEscortResponse,
  setEscortStatus,
  updateEscortRequest,
  writeEscortRequests,
} from '../../../lib/combat-escort.js';
import {
  combatEscortDiscordConfig,
  syncCombatEscortDiscord,
} from '../../../lib/combat-escort-discord.js';

const ACCESS=new Set(['member','officer','site_admin']);

export async function onRequestGet({request,env}){
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  const items=await readEscortRequests(env);
  const visible=[...items]
    .sort((a,b)=>statusRank(a.status)-statusRank(b.status)||Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0))
    .slice(0,100)
    .map(item=>presentEscortRequest(item,{viewerId:auth.session.sub,access:auth.session.access}));
  return reply({
    ok:true,
    viewer:{id:String(auth.session.sub||''),displayName:clean(auth.session.displayName||auth.session.username||'Mongrel'),access:auth.session.access},
    discord:{configured:combatEscortDiscordConfig(env).configured,target:'combat-escort-requests'},
    items:visible,
  });
}

export async function onRequestPost({request,env}){
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request); if(err)return err;
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return reply({ok:false,error:'escort_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  let item;
  try{
    item=createEscortRequest(body,{
      ownerId:auth.session.sub,
      ownerName:auth.session.displayName||auth.session.username||'Commander',
    });
  }catch(error){
    return modelError(error);
  }

  const items=await readEscortRequests(env);
  items.unshift(item);
  await writeEscortRequests(env,items);

  const discord=await syncCombatEscortDiscord(env,{request:item,origin:new URL(request.url).origin});
  if(discord.attempted||discord.ok){
    item.discord={
      messageId:discord.messageId||'',
      channelId:discord.channelId||'',
      lastSyncedAt:discord.lastSyncedAt||'',
      lastError:discord.ok?'':(discord.error||''),
    };
    items[0]=item;
    await writeEscortRequests(env,items);
  }

  return reply({
    ok:true,
    item:presentEscortRequest(item,{viewerId:auth.session.sub,access:auth.session.access}),
    discord,
  },201);
}

export async function onRequestPut({request,env}){
  const auth=await requireMember(request,env); if(auth.response)return auth.response;
  const err=validateSameOrigin(request); if(err)return err;
  if(!env?.PROJECTS||typeof env.PROJECTS.put!=='function')return reply({ok:false,error:'escort_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const id=clean(body?.id).slice(0,60);
  const action=clean(body?.action||'update').toLowerCase();
  if(!id)return reply({ok:false,error:'escort_request_id_required'},400);

  const items=await readEscortRequests(env);
  const index=items.findIndex(item=>item.id===id);
  if(index<0)return reply({ok:false,error:'escort_request_not_found'},404);
  const existing=items[index];
  const canManage=existing.ownerId===String(auth.session.sub||'')||auth.session.access==='officer'||auth.session.access==='site_admin';

  let item;
  try{
    if(action==='respond'){
      item=setEscortResponse(existing,{
        userId:auth.session.sub,
        displayName:auth.session.displayName||auth.session.username||'Commander',
        state:body?.state,
      });
    }else if(action==='complete'||action==='cancel'){
      if(!canManage)return reply({ok:false,error:'escort_request_manage_required'},403);
      item=setEscortStatus(existing,action==='complete'?'complete':'cancelled',{
        actorId:auth.session.sub,
        actorName:auth.session.displayName||auth.session.username||'Commander',
      });
    }else if(action==='update'){
      if(!canManage)return reply({ok:false,error:'escort_request_manage_required'},403);
      item=updateEscortRequest(existing,body);
    }else{
      return reply({ok:false,error:'invalid_action'},400);
    }
  }catch(error){
    return modelError(error);
  }

  items[index]=item;
  await writeEscortRequests(env,items);

  const discord=await syncCombatEscortDiscord(env,{request:item,origin:new URL(request.url).origin});
  item.discord={
    ...item.discord,
    messageId:discord.messageId||item.discord?.messageId||'',
    channelId:discord.channelId||item.discord?.channelId||'',
    lastSyncedAt:discord.lastSyncedAt||item.discord?.lastSyncedAt||'',
    lastError:discord.ok?'':(discord.error||''),
  };
  items[index]=item;
  await writeEscortRequests(env,items);

  return reply({
    ok:true,
    item:presentEscortRequest(item,{viewerId:auth.session.sub,access:auth.session.access}),
    discord,
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
  if(origin!==expected||marker!=='mongrels-combat-escort')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
function statusRank(status){return status==='open'?0:status==='complete'?1:2}
function modelError(error){
  const code=String(error?.message||'escort_request_invalid');
  const status=['system_required','objective_required','invalid_escort_response','requester_cannot_respond','invalid_escort_status'].includes(code)?400:code==='escort_request_closed'?409:400;
  return reply({ok:false,error:code},status);
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function reply(data,status=200){return json(data,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}});}
