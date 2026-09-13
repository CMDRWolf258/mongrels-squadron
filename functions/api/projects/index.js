import { json, readSession } from '../../../lib/auth.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);
const KV_KEY = 'board-v1';

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const items = await readItems(env);
  return reply({ok:true, viewer:viewer(auth.session), canModerate:MANAGER_ACCESS.has(auth.session.access), items:items.map(item => present(item, auth.session))});
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const now = new Date().toISOString();
  const item = normalizeItem(body.value, {id:crypto.randomUUID(), ownerId:auth.session.sub, ownerName:auth.session.displayName, createdAt:now, updatedAt:now, updatedBy:auth.session.displayName}, auth.session);
  const items = await readItems(env); items.unshift(item); await writeItems(env, items);
  return reply({ok:true, item:present(item, auth.session)}, 201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const id = clean(body.value?.id,'',100); if (!id) return reply({ok:false,error:'project_id_required'},400);
  const items = await readItems(env); const idx = items.findIndex(x => x.id === id); if (idx < 0) return reply({ok:false,error:'project_not_found'},404);
  const existing=items[idx]; const manager=MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_project_owner'},403);
  items[idx] = normalizeItem(body.value, {id:existing.id, ownerId:existing.ownerId, ownerName:existing.ownerName, createdAt:existing.createdAt, updatedAt:new Date().toISOString(), updatedBy:auth.session.displayName}, auth.session, existing);
  await writeItems(env, items); return reply({ok:true,item:present(items[idx],auth.session)});
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const id=new URL(request.url).searchParams.get('id') || '';
  const items=await readItems(env); const idx=items.findIndex(x=>x.id===id); if(idx<0) return reply({ok:false,error:'project_not_found'},404);
  const existing=items[idx]; const manager=MANAGER_ACCESS.has(auth.session.access);
  if(!manager && existing.ownerId!==auth.session.sub) return reply({ok:false,error:'not_project_owner'},403);
  items.splice(idx,1); await writeItems(env,items); return reply({ok:true});
}

function normalizeItem(value, fixed, session, existing={}) {
  const src=value&&typeof value==='object'?value:{}; const manager=MANAGER_ACCESS.has(session.access);
  let kind=clean(src.kind,existing.kind||'project',20).toLowerCase(); if(!manager) kind='project'; if(!['project','event'].includes(kind)) kind='project';
  let official=manager ? Boolean(src.official) : false;
  return {
    id:fixed.id, kind, official, ownerId:fixed.ownerId, ownerName:fixed.ownerName,
    title:clean(src.title,existing.title||'Untitled Project',120), system:clean(src.system,'',120), category:clean(src.category,'Other',80),
    description:clean(src.description,'',1600), helpRequested:clean(src.helpRequested,'',1200), target:clean(src.target,'',220),
    progress:clampNumber(src.progress,0,100,0), status:normalizeStatus(src.status), deadline:clean(src.deadline,'',40),
    createdAt:fixed.createdAt, updatedAt:fixed.updatedAt, updatedBy:fixed.updatedBy,
  };
}
function present(item, session){return {...item, canEdit:MANAGER_ACCESS.has(session.access)||item.ownerId===session.sub, isMine:item.ownerId===session.sub};}
async function readItems(env){if(!env.PROJECTS||typeof env.PROJECTS.get!=='function') return []; const stored=await env.PROJECTS.get(KV_KEY,{type:'json'}); return Array.isArray(stored)?stored:[];}
async function writeItems(env,items){await env.PROJECTS.put(KV_KEY,JSON.stringify(items.slice(0,250)));}
function requireStorage(env){return (!env.PROJECTS||typeof env.PROJECTS.put!=='function')?reply({ok:false,error:'projects_storage_not_configured'},503):null;}
async function requireMember(request,env){const session=await readSession(request,env); if(!session)return {response:reply({ok:false,error:'authentication_required'},401)}; if(!ALLOWED_ACCESS.has(session.access))return {response:reply({ok:false,error:'member_access_required'},403)}; return {session};}
function validateSameOrigin(request){const origin=request.headers.get('Origin'); const expected=new URL(request.url).origin; const marker=request.headers.get('X-Mongrels-Request'); if(origin!==expected||marker!=='projects-editor') return reply({ok:false,error:'request_validation_failed'},403); return null;}
async function readBody(request){try{return {value:await request.json()};}catch{return {response:reply({ok:false,error:'invalid_json'},400)};}}
function viewer(s){return {id:s.sub,displayName:s.displayName,access:s.access};}
function normalizeStatus(v){const x=clean(v,'active',20).toLowerCase(); return ['planning','active','paused','complete'].includes(x)?x:'active';}
function clampNumber(v,min,max,fallback){const n=Number(v); return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;}
function clean(v,fallback,max){if(typeof v!=='string')return fallback; const x=v.trim(); return x?x.slice(0,max):fallback;}
function headers(){return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
