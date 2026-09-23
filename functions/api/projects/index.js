import { json, readSession } from '../../../lib/auth.js';
import { resolveMemberProfile, publicMemberFilter } from '../../../lib/member-profile.js';
import {
  applyDiscordState,
  eventRsvpView,
  normalizeEventRsvps,
  readProjectsBoard,
  squadEventsConfig,
  syncSquadEventDiscord,
  writeProjectsBoard,
} from '../../../lib/squad-events.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const items = await readProjectsBoard(env);
  const memberId = new URL(request.url).searchParams.get('member') || '';
  const memberProfile = memberId ? await resolveMemberProfile(env, memberId) : null;
  const selected = memberId ? (memberProfile ? items.filter(item => item.ownerId === memberProfile.ownerId) : []) : items;
  return reply({
    ok:true,
    viewer:viewer(auth.session),
    canModerate:MANAGER_ACCESS.has(auth.session.access),
    memberFilter:publicMemberFilter(memberProfile),
    squadEventsDiscordConfigured:squadEventsConfig(env).configured,
    items:selected.map(item => present(item, auth.session)),
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const now = new Date().toISOString();
  const item = normalizeItem(body.value, {
    id:crypto.randomUUID(),
    ownerId:auth.session.sub,
    ownerName:auth.session.displayName,
    createdAt:now,
    updatedAt:now,
    updatedBy:auth.session.displayName,
  }, auth.session);

  const items = await readProjectsBoard(env);
  items.unshift(item);
  await writeProjectsBoard(env, items);

  let discord=null;
  if(item.kind==='event'){
    discord=await syncSquadEventDiscord(env,item,{origin:new URL(request.url).origin});
    applyDiscordState(item,discord);
    items[0]=item;
    await writeProjectsBoard(env,items);
  }

  return reply({ok:true,item:present(item,auth.session),discord},201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const id = clean(body.value?.id,'',100); if (!id) return reply({ok:false,error:'project_id_required'},400);

  const items = await readProjectsBoard(env);
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'project_not_found'},404);
  const existing=items[idx];
  const manager=MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_project_owner'},403);

  items[idx] = normalizeItem(body.value, {
    id:existing.id,
    ownerId:existing.ownerId,
    ownerName:existing.ownerName,
    createdAt:existing.createdAt,
    updatedAt:new Date().toISOString(),
    updatedBy:auth.session.displayName,
  }, auth.session, existing);
  await writeProjectsBoard(env, items);

  let discord=null;
  if(items[idx].kind==='event'){
    discord=await syncSquadEventDiscord(env,items[idx],{
      origin:new URL(request.url).origin,
      createIfMissing:items[idx].status==='active',
    });
    applyDiscordState(items[idx],discord);
    await writeProjectsBoard(env,items);
  }

  return reply({ok:true,item:present(items[idx],auth.session),discord});
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const id=new URL(request.url).searchParams.get('id') || '';
  const items=await readProjectsBoard(env);
  const idx=items.findIndex(x=>x.id===id);
  if(idx<0) return reply({ok:false,error:'project_not_found'},404);
  const existing=items[idx];
  const manager=MANAGER_ACCESS.has(auth.session.access);
  if(!manager && existing.ownerId!==auth.session.sub) return reply({ok:false,error:'not_project_owner'},403);
  if(existing.kind==='event'&&existing.discordEventMessageId){
    return reply({ok:false,error:'published_event_must_be_cancelled_or_completed'},409);
  }
  items.splice(idx,1);
  await writeProjectsBoard(env,items);
  return reply({ok:true});
}

function normalizeItem(value, fixed, session, existing={}) {
  const src=value&&typeof value==='object'?value:{};
  const manager=MANAGER_ACCESS.has(session.access);

  let kind=clean(src.kind,existing.kind||'project',20).toLowerCase();
  if(!manager) kind='project';
  if(!['project','event'].includes(kind)) kind='project';
  if(existing?.id&&['project','event'].includes(existing.kind)) kind=existing.kind;

  const official=manager ? Boolean(src.official) : false;
  const status=normalizeStatus(src.status,kind,existing.status);

  const item={
    id:fixed.id,
    kind,
    official,
    ownerId:fixed.ownerId,
    ownerName:fixed.ownerName,
    title:clean(src.title,existing.title||'Untitled Project',120),
    system:clean(src.system,existing.system||'',120),
    category:clean(src.category,existing.category||'Other',80),
    description:clean(src.description,existing.description||'',1600),
    helpRequested:clean(src.helpRequested,existing.helpRequested||'',1200),
    target:clean(src.target,existing.target||'',220),
    progress:clampNumber(src.progress,0,100,Number(existing.progress)||0),
    status,
    deadline:clean(src.deadline,existing.deadline||'',40),
    eventTime:clean(src.eventTime,existing.eventTime||'',20),
    eventType:clean(src.eventType,existing.eventType||'',80),
    createdAt:fixed.createdAt,
    updatedAt:fixed.updatedAt,
    updatedBy:fixed.updatedBy,
  };

  if(kind==='event'){
    item.rsvps=normalizeEventRsvps(existing.rsvps);
    item.discordEventMessageId=clean(existing.discordEventMessageId,'',40);
    item.discordEventChannelId=clean(existing.discordEventChannelId,'',40);
    item.discordEventLastSyncedAt=clean(existing.discordEventLastSyncedAt,'',50);
    item.discordEventLastError=clean(existing.discordEventLastError,'',300);
  }

  return item;
}

function present(item, session){
  const {
    rsvps,
    discordEventMessageId,
    discordEventChannelId,
    discordEventLastSyncedAt,
    discordEventLastError,
    ...safe
  }=item;
  const canEdit=MANAGER_ACCESS.has(session.access)||item.ownerId===session.sub;
  const presented={...safe,canEdit,isMine:item.ownerId===session.sub};

  if(item.kind==='event'){
    presented.rsvp=eventRsvpView(item,session.sub);
    if(canEdit){
      presented.eventDiscord={
        linked:Boolean(discordEventMessageId),
        lastSyncedAt:discordEventLastSyncedAt||'',
        lastError:discordEventLastError||'',
      };
    }
  }
  return presented;
}

function requireStorage(env){
  return (!env.PROJECTS||typeof env.PROJECTS.get!=='function'||typeof env.PROJECTS.put!=='function')
    ?reply({ok:false,error:'projects_storage_not_configured'},503)
    :null;
}
async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED_ACCESS.has(session.access))return {response:reply({ok:false,error:'member_access_required'},403)};
  return {session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='projects-editor') return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
async function readBody(request){
  try{return {value:await request.json()};}
  catch{return {response:reply({ok:false,error:'invalid_json'},400)};}
}
function viewer(s){return {id:s.sub,displayName:s.displayName,access:s.access};}
function normalizeStatus(value,kind,fallback='active'){
  const x=clean(value,fallback,20).toLowerCase();
  const allowed=kind==='event'
    ?['planning','active','paused','cancelled','complete']
    :['planning','active','paused','complete'];
  return allowed.includes(x)?x:(allowed.includes(fallback)?fallback:'active');
}
function clampNumber(v,min,max,fallback){
  const n=Number(v);
  return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;
}
function clean(v,fallback,max){
  if(typeof v!=='string')return fallback;
  const x=v.trim();
  return x?x.slice(0,max):fallback;
}
function headers(){
  return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};
}
function reply(data,status=200){return json(data,{status,headers:headers()});}
