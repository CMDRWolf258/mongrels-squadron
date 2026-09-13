import { json, readSession } from '../../../lib/auth.js';
import { resolveMemberProfile, publicMemberFilter } from '../../../lib/member-profile.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);
const REGISTRY_KEY = 'registry-v1';
const COORD_KEY = 'coordination-v1';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const resource = (url.searchParams.get('resource') || 'registry').toLowerCase();
  const session = await readSession(request, env);

  if (resource === 'registry') {
    let carriers = await readRegistry(env);
    const sync = await syncCarrierLocations(carriers);
    if (sync.changed && env.CARRIERS && typeof env.CARRIERS.put === 'function') {
      carriers = sync.carriers;
      await writeRegistry(env, carriers);
    } else {
      carriers = sync.carriers;
    }
    const authenticated = Boolean(session && ALLOWED_ACCESS.has(session.access));
    const memberId = url.searchParams.get('member') || '';
    const memberProfile = authenticated && memberId ? await resolveMemberProfile(env, memberId) : null;
    const selected = authenticated && memberId ? (memberProfile ? carriers.filter(item => item.ownerId === memberProfile.ownerId) : []) : carriers;
    return reply({
      ok: true,
      authenticated,
      viewer: authenticated ? viewer(session) : null,
      canModerate: Boolean(session && MANAGER_ACCESS.has(session.access)),
      memberFilter: publicMemberFilter(memberProfile),
      telemetry: { source: 'EDDN / EDData', checked: sync.checked, updated: sync.updated },
      carriers: selected.map(item => presentCarrier(item, session)),
    });
  }

  if (resource === 'coordination') {
    const auth = requireMemberSession(session);
    if (auth) return auth;
    const [carriers, posts] = await Promise.all([readRegistry(env), readCoordination(env)]);
    const byCallsign = new Map(carriers.map(c => [c.callsign, c]));
    return reply({
      ok: true,
      viewer: viewer(session),
      canModerate: MANAGER_ACCESS.has(session.access),
      posts: posts.map(post => presentCoordination(post, session, byCallsign.get(post.carrierCallsign))),
    });
  }

  return reply({ok:false,error:'unknown_resource'},400);
}

export async function onRequestPost({ request, env }) {
  const session = await readSession(request, env);
  const auth = requireMemberSession(session); if (auth) return auth;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const resource = clean(body.value?.resource,'',30).toLowerCase();

  if (resource === 'carrier') return createCarrier(body.value, session, env);
  if (resource === 'coordination') return createCoordination(body.value, session, env);
  return reply({ok:false,error:'unknown_resource'},400);
}

export async function onRequestPut({ request, env }) {
  const session = await readSession(request, env);
  const auth = requireMemberSession(session); if (auth) return auth;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const resource = clean(body.value?.resource,'',30).toLowerCase();

  if (resource === 'carrier') return updateCarrier(body.value, session, env);
  if (resource === 'coordination') return updateCoordination(body.value, session, env);
  return reply({ok:false,error:'unknown_resource'},400);
}

export async function onRequestDelete({ request, env }) {
  const session = await readSession(request, env);
  const auth = requireMemberSession(session); if (auth) return auth;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const url = new URL(request.url);
  const resource = (url.searchParams.get('resource') || '').toLowerCase();
  const id = url.searchParams.get('id') || '';

  if (resource === 'carrier') return deleteCarrier(id, session, env);
  if (resource === 'coordination') return deleteCoordination(id, session, env);
  return reply({ok:false,error:'unknown_resource'},400);
}

async function createCarrier(value, session, env) {
  const carriers = await readRegistry(env);
  const callsign = normalizeCallsign(value.callsign);
  if (!validCallsign(callsign)) return reply({ok:false,error:'invalid_callsign'},400);
  if (carriers.some(c => c.callsign === callsign)) return reply({ok:false,error:'callsign_already_registered'},409);
  const now = new Date().toISOString();
  const item = normalizeCarrier(value, {
    id: crypto.randomUUID(), callsign, ownerId:session.sub, ownerName:session.displayName,
    createdAt:now, updatedAt:now, updatedBy:session.displayName,
  }, session);
  carriers.unshift(item); await writeRegistry(env, carriers);
  return reply({ok:true,carrier:presentCarrier(item,session)},201);
}

async function updateCarrier(value, session, env) {
  const id = clean(value?.id,'',100); if(!id) return reply({ok:false,error:'carrier_id_required'},400);
  const carriers = await readRegistry(env); const idx = carriers.findIndex(c=>c.id===id);
  if(idx<0) return reply({ok:false,error:'carrier_not_found'},404);
  const existing = carriers[idx]; const manager = MANAGER_ACCESS.has(session.access);
  if(!manager && existing.ownerId!==session.sub) return reply({ok:false,error:'not_carrier_owner'},403);
  carriers[idx] = normalizeCarrier(value, {
    id:existing.id, callsign:existing.callsign, ownerId:existing.ownerId, ownerName:existing.ownerName,
    createdAt:existing.createdAt, updatedAt:new Date().toISOString(), updatedBy:session.displayName,
  }, session, existing);
  await writeRegistry(env,carriers);
  return reply({ok:true,carrier:presentCarrier(carriers[idx],session)});
}

async function deleteCarrier(id, session, env) {
  const carriers = await readRegistry(env); const idx=carriers.findIndex(c=>c.id===id);
  if(idx<0) return reply({ok:false,error:'carrier_not_found'},404);
  const existing=carriers[idx]; const manager=MANAGER_ACCESS.has(session.access);
  if(!manager && existing.ownerId!==session.sub) return reply({ok:false,error:'not_carrier_owner'},403);
  const posts=await readCoordination(env);
  if(posts.some(p=>p.carrierCallsign===existing.callsign && p.status!=='complete')) return reply({ok:false,error:'carrier_has_active_coordination'},409);
  carriers.splice(idx,1); await writeRegistry(env,carriers);
  return reply({ok:true});
}

async function createCoordination(value, session, env) {
  const carriers=await readRegistry(env);
  const callsign=normalizeCallsign(value.carrierCallsign);
  const carrier=carriers.find(c=>c.callsign===callsign);
  if(!carrier) return reply({ok:false,error:'carrier_not_registered'},400);
  const manager=MANAGER_ACCESS.has(session.access);
  if(!manager && carrier.ownerId!==session.sub) return reply({ok:false,error:'not_carrier_owner'},403);
  const now=new Date().toISOString();
  const post=normalizeCoordination(value, {
    id:crypto.randomUUID(), carrierCallsign:callsign, ownerId:session.sub, ownerName:session.displayName,
    createdAt:now, updatedAt:now, updatedBy:session.displayName,
  }, session);
  const posts=await readCoordination(env); posts.unshift(post); await writeCoordination(env,posts);
  return reply({ok:true,post:presentCoordination(post,session,carrier)},201);
}

async function updateCoordination(value, session, env) {
  const id=clean(value?.id,'',100); if(!id) return reply({ok:false,error:'coordination_id_required'},400);
  const posts=await readCoordination(env); const idx=posts.findIndex(p=>p.id===id);
  if(idx<0) return reply({ok:false,error:'coordination_not_found'},404);
  const existing=posts[idx]; const manager=MANAGER_ACCESS.has(session.access);
  if(!manager && existing.ownerId!==session.sub) return reply({ok:false,error:'not_post_owner'},403);
  const carriers=await readRegistry(env); const carrier=carriers.find(c=>c.callsign===existing.carrierCallsign);
  posts[idx]=normalizeCoordination(value, {
    id:existing.id, carrierCallsign:existing.carrierCallsign, ownerId:existing.ownerId, ownerName:existing.ownerName,
    createdAt:existing.createdAt, updatedAt:new Date().toISOString(), updatedBy:session.displayName,
  }, session, existing);
  await writeCoordination(env,posts);
  return reply({ok:true,post:presentCoordination(posts[idx],session,carrier)});
}

async function deleteCoordination(id, session, env) {
  const posts=await readCoordination(env); const idx=posts.findIndex(p=>p.id===id);
  if(idx<0) return reply({ok:false,error:'coordination_not_found'},404);
  const existing=posts[idx]; const manager=MANAGER_ACCESS.has(session.access);
  if(!manager && existing.ownerId!==session.sub) return reply({ok:false,error:'not_post_owner'},403);
  posts.splice(idx,1); await writeCoordination(env,posts); return reply({ok:true});
}

function normalizeCarrier(value,fixed,session,existing={}) {
  const src=value&&typeof value==='object'?value:{}; const manager=MANAGER_ACCESS.has(session.access);
  const currentSystem=clean(src.currentSystem,existing.currentSystem||'',120);
  const previousSystem=existing.currentSystem||'';
  const locationChanged=currentSystem!==previousSystem;
  return {
    id:fixed.id, callsign:fixed.callsign, ownerId:fixed.ownerId, ownerName:fixed.ownerName,
    commanderName:clean(src.commanderName,existing.commanderName||session.displayName,80),
    name:clean(src.name,existing.name||'Unnamed Carrier',100), role:clean(src.role,existing.role||'General Logistics',80),
    status:normalizeCarrierStatus(src.status||existing.status), notes:clean(src.notes,existing.notes||'',1200),
    currentSystem, locationSource: currentSystem ? (existing.locationSource && !locationChanged ? existing.locationSource : 'member') : '',
    locationUpdatedAt: currentSystem ? (locationChanged || !existing.locationUpdatedAt ? fixed.updatedAt : existing.locationUpdatedAt) : '',
    telemetrySystem: existing.telemetrySystem || '', telemetryUpdatedAt: existing.telemetryUpdatedAt || '',
    telemetryCheckedAt: existing.telemetryCheckedAt || '', telemetrySource: existing.telemetrySource || '',
    services:normalizeList(src.services,existing.services||[]), official:manager?Boolean(src.official):Boolean(existing.official),
    createdAt:fixed.createdAt, updatedAt:fixed.updatedAt, updatedBy:fixed.updatedBy,
  };
}

function normalizeCoordination(value,fixed,session,existing={}) {
  const src=value&&typeof value==='object'?value:{}; const manager=MANAGER_ACCESS.has(session.access);
  return {
    id:fixed.id, carrierCallsign:fixed.carrierCallsign, ownerId:fixed.ownerId, ownerName:fixed.ownerName,
    activityType:normalizeActivity(src.activityType||existing.activityType), status:normalizeCoordStatus(src.status||existing.status),
    priority:normalizePriority(src.priority||existing.priority), official:manager?Boolean(src.official):Boolean(existing.official),
    destination:clean(src.destination,existing.destination||'',120), departure:clean(src.departure,existing.departure||'',40), eta:clean(src.eta,existing.eta||'',40),
    purpose:clean(src.purpose,existing.purpose||'',500), commodity:clean(src.commodity,existing.commodity||'',100),
    targetQuantity:clampNumber(src.targetQuantity,0,100000000,existing.targetQuantity||0), remainingQuantity:clampNumber(src.remainingQuantity,0,100000000,existing.remainingQuantity||0),
    notes:clean(src.notes,existing.notes||'',1400), createdAt:fixed.createdAt, updatedAt:fixed.updatedAt, updatedBy:fixed.updatedBy,
  };
}

function presentCarrier(item,session){
  const authenticated=Boolean(session&&ALLOWED_ACCESS.has(session.access));
  const canEdit=authenticated&&(MANAGER_ACCESS.has(session.access)||item.ownerId===session.sub);
  return {id:item.id,callsign:item.callsign,name:item.name,commanderName:item.commanderName,role:item.role,status:item.status,notes:item.notes,currentSystem:item.currentSystem,locationSource:item.locationSource,locationUpdatedAt:item.locationUpdatedAt,locationFreshness:freshness(item.locationUpdatedAt),telemetrySystem:item.telemetrySystem||'',telemetryUpdatedAt:item.telemetryUpdatedAt||'',telemetryCheckedAt:item.telemetryCheckedAt||'',telemetrySource:item.telemetrySource||'',services:item.services,official:item.official,updatedAt:item.updatedAt,canEdit,isMine:authenticated&&item.ownerId===session.sub};
}
function presentCoordination(item,session,carrier){return {...item,carrierName:carrier?.name||item.carrierCallsign,carrierCommander:carrier?.commanderName||'',currentSystem:carrier?.currentSystem||'',locationSource:carrier?.locationSource||'',locationUpdatedAt:carrier?.locationUpdatedAt||'',canEdit:MANAGER_ACCESS.has(session.access)||item.ownerId===session.sub,isMine:item.ownerId===session.sub};}


const TELEMETRY_LOOKUP_MS = 15 * 60 * 1000;
const TELEMETRY_BATCH = 12;
const EDDATA_BASE = 'https://api.eddata.dev/v2/search/station/name/';

async function syncCarrierLocations(carriers) {
  const now = Date.now();
  const candidates = carriers
    .map((carrier, index) => ({ carrier, index }))
    .filter(({ carrier }) => !carrier.telemetryCheckedAt || now - timestamp(carrier.telemetryCheckedAt) >= TELEMETRY_LOOKUP_MS)
    .sort((a,b) => timestamp(a.carrier.telemetryCheckedAt) - timestamp(b.carrier.telemetryCheckedAt))
    .slice(0, TELEMETRY_BATCH);
  if (!candidates.length) return { carriers, changed:false, checked:0, updated:0 };

  const copy = carriers.map(c => ({ ...c }));
  let changed = false, checked = 0, updated = 0;
  await Promise.all(candidates.map(async ({ carrier, index }) => {
    const checkedAt = new Date().toISOString();
    const result = await lookupCarrierTelemetry(carrier.callsign);
    copy[index].telemetryCheckedAt = checkedAt;
    checked += 1;
    changed = true;
    if (!result) return;
    copy[index].telemetrySystem = result.systemName;
    copy[index].telemetryUpdatedAt = result.updatedAt;
    copy[index].telemetrySource = 'eddata';

    const currentStamp = timestamp(copy[index].locationUpdatedAt);
    const telemetryStamp = timestamp(result.updatedAt);
    // A newer manual correction wins until telemetry catches up.
    if (!copy[index].currentSystem || telemetryStamp >= currentStamp) {
      const moved = copy[index].currentSystem !== result.systemName;
      copy[index].currentSystem = result.systemName;
      copy[index].locationSource = 'eddata';
      copy[index].locationUpdatedAt = result.updatedAt;
      if (moved) copy[index].updatedAt = checkedAt;
      updated += 1;
    }
  }));
  return { carriers:copy, changed, checked, updated };
}

async function lookupCarrierTelemetry(callsign) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`${EDDATA_BASE}${encodeURIComponent(callsign)}`, {
      headers: { 'Accept':'application/json', 'User-Agent':'Mongrels-Squadron-Carrier-Registry/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.stations) ? payload.stations : Array.isArray(payload?.results) ? payload.results : [];
    const exact = rows.find(row => normalizeCallsign(row?.stationName || row?.name || '') === callsign);
    if (!exact) return null;
    const type = String(exact.stationType || exact.type || '').toLowerCase();
    if (type && !type.includes('carrier')) return null;
    const systemName = clean(exact.systemName || exact.system || '', '', 120);
    if (!systemName) return null;
    const updatedAt = validTimestamp(exact.updatedAt || exact.updated_at || exact.timestamp) || new Date().toISOString();
    return { systemName, updatedAt };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function timestamp(value){ const n = value ? new Date(value).getTime() : 0; return Number.isFinite(n) ? n : 0; }
function validTimestamp(value){ const n = timestamp(value); return n ? new Date(n).toISOString() : ''; }
function freshness(value){ const age = Date.now() - timestamp(value); if(!timestamp(value)) return 'unknown'; if(age <= 6*60*60*1000) return 'fresh'; if(age <= 24*60*60*1000) return 'aging'; return 'stale'; }

async function readRegistry(env){if(!env.CARRIERS||typeof env.CARRIERS.get!=='function') return []; const v=await env.CARRIERS.get(REGISTRY_KEY,{type:'json'}); return Array.isArray(v)?v:[];}
async function writeRegistry(env,v){await env.CARRIERS.put(REGISTRY_KEY,JSON.stringify(v.slice(0,300)));}
async function readCoordination(env){if(!env.CARRIERS||typeof env.CARRIERS.get!=='function') return []; const v=await env.CARRIERS.get(COORD_KEY,{type:'json'}); return Array.isArray(v)?v:[];}
async function writeCoordination(env,v){await env.CARRIERS.put(COORD_KEY,JSON.stringify(v.slice(0,500)));}
function requireStorage(env){return (!env.CARRIERS||typeof env.CARRIERS.put!=='function')?reply({ok:false,error:'carrier_storage_not_configured'},503):null;}
function requireMemberSession(session){if(!session)return reply({ok:false,error:'authentication_required'},401); if(!ALLOWED_ACCESS.has(session.access))return reply({ok:false,error:'member_access_required'},403); return null;}
function validateSameOrigin(request){const origin=request.headers.get('Origin'); const expected=new URL(request.url).origin; const marker=request.headers.get('X-Mongrels-Request'); if(origin!==expected||marker!=='carrier-coordination') return reply({ok:false,error:'request_validation_failed'},403); return null;}
async function readBody(request){try{return {value:await request.json()};}catch{return {response:reply({ok:false,error:'invalid_json'},400)};}}
function viewer(s){return {id:s.sub,displayName:s.displayName,access:s.access};}
function normalizeCallsign(v){return clean(v,'',20).toUpperCase().replace(/\s+/g,'');}
function validCallsign(v){return /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(v);}
function normalizeCarrierStatus(v){const x=clean(v,'active',24).toLowerCase(); return ['active','relocating','supporting','maintenance','unavailable'].includes(x)?x:'active';}
function normalizeActivity(v){const x=clean(v,'relocation',30).toLowerCase(); return ['relocation','loading','unloading','project_support','expedition_support','refuel_tritium','other'].includes(x)?x:'relocation';}
function normalizeCoordStatus(v){const x=clean(v,'planned',24).toLowerCase(); return ['planned','loading','ready','in_transit','on_station','complete'].includes(x)?x:'planned';}
function normalizePriority(v){return clean(v,'normal',16).toLowerCase()==='urgent'?'urgent':'normal';}
function normalizeList(v,fallback=[]){if(Array.isArray(v))return v.map(x=>clean(x,'',60)).filter(Boolean).slice(0,20); if(typeof v==='string')return v.split(',').map(x=>clean(x,'',60)).filter(Boolean).slice(0,20); return fallback;}
function clampNumber(v,min,max,fallback){const n=Number(v); return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;}
function clean(v,fallback,max){if(typeof v!=='string')return fallback; const x=v.trim(); return x?x.slice(0,max):fallback;}
function headers(){return {'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
