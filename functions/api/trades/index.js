import { json, readSession } from '../../../lib/auth.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);
const KV_KEY = 'trade-board-v1';

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  const items = await readItems(env);
  const viewer = session && ALLOWED_ACCESS.has(session.access)
    ? { id: session.sub, displayName: session.displayName, access: session.access }
    : null;
  return reply({
    ok: true,
    configured: Boolean(env.TRADES && typeof env.TRADES.get === 'function'),
    viewer,
    canPost: Boolean(viewer),
    canModerate: Boolean(viewer && MANAGER_ACCESS.has(viewer.access)),
    routes: items.map(item => present(item, session)),
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const now = new Date().toISOString();
  const route = normalizeRoute(body.value, {
    id: crypto.randomUUID(), ownerId: auth.session.sub, ownerName: auth.session.displayName,
    createdAt: now, updatedAt: now, updatedBy: auth.session.displayName,
  }, auth.session);
  const items = await readItems(env); items.unshift(route); await writeItems(env, items);
  return reply({ ok:true, route:present(route, auth.session) }, 201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;
  const id = clean(body.value?.id,'',100); if (!id) return reply({ok:false,error:'route_id_required'},400);
  const items = await readItems(env); const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'route_not_found'},404);
  const existing = items[idx]; const manager = MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_route_owner'},403);
  items[idx] = normalizeRoute(body.value, {
    id: existing.id, ownerId: existing.ownerId, ownerName: existing.ownerName,
    createdAt: existing.createdAt, updatedAt: new Date().toISOString(), updatedBy: auth.session.displayName,
  }, auth.session, existing);
  await writeItems(env, items);
  return reply({ok:true,route:present(items[idx],auth.session)});
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const id = new URL(request.url).searchParams.get('id') || '';
  const items = await readItems(env); const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'route_not_found'},404);
  const existing = items[idx]; const manager = MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_route_owner'},403);
  items.splice(idx,1); await writeItems(env,items); return reply({ok:true});
}

function normalizeRoute(value, fixed, session, existing={}) {
  const src = value && typeof value === 'object' ? value : {};
  const manager = MANAGER_ACCESS.has(session.access);
  let category = clean(src.category, existing.category || 'credits', 20).toLowerCase();
  if (!['squad','credits'].includes(category)) category = 'credits';
  const official = manager ? Boolean(src.official) : false;
  return {
    id: fixed.id,
    ownerId: fixed.ownerId,
    ownerName: fixed.ownerName,
    official,
    category,
    title: clean(src.title, existing.title || 'Trade Opportunity', 140),
    commodity: clean(src.commodity, existing.commodity || '', 100),
    originSystem: clean(src.originSystem, '', 120),
    originStation: clean(src.originStation, '', 120),
    destinationSystem: clean(src.destinationSystem, '', 120),
    destinationStation: clean(src.destinationStation, '', 120),
    profitPerTon: clampNumber(src.profitPerTon,0,1000000000,0),
    estimatedLoopProfit: clampNumber(src.estimatedLoopProfit,0,1000000000000,0),
    padSize: normalizePad(src.padSize),
    distanceLy: clean(String(src.distanceLy ?? ''),'',30),
    quantity: clean(src.quantity,'',80),
    objective: clean(src.objective,'',500),
    notes: clean(src.notes,'',1400),
    expires: clean(src.expires,'',40),
    status: normalizeStatus(src.status),
    tags: normalizeTags(src.tags),
    createdAt: fixed.createdAt,
    updatedAt: fixed.updatedAt,
    updatedBy: fixed.updatedBy,
  };
}

function present(item, session) {
  const manager = Boolean(session && MANAGER_ACCESS.has(session.access));
  const mine = Boolean(session && item.ownerId === session.sub);
  const { ownerId, ...publicItem } = item;
  return {...publicItem, canEdit: manager || mine, isMine: mine};
}
async function readItems(env){if(!env.TRADES||typeof env.TRADES.get!=='function') return []; const stored=await env.TRADES.get(KV_KEY,{type:'json'}); return Array.isArray(stored)?stored:[];}
async function writeItems(env,items){await env.TRADES.put(KV_KEY,JSON.stringify(items.slice(0,300)));}
function requireStorage(env){return (!env.TRADES||typeof env.TRADES.put!=='function')?reply({ok:false,error:'trades_storage_not_configured'},503):null;}
async function requireMember(request,env){const session=await readSession(request,env);if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};if(!ALLOWED_ACCESS.has(session.access))return {response:reply({ok:false,error:'member_access_required'},403)};return {session};}
function validateSameOrigin(request){const origin=request.headers.get('Origin');const expected=new URL(request.url).origin;const marker=request.headers.get('X-Mongrels-Request');if(origin!==expected||marker!=='trade-editor')return reply({ok:false,error:'request_validation_failed'},403);return null;}
async function readBody(request){try{return {value:await request.json()};}catch{return {response:reply({ok:false,error:'invalid_json'},400)};}}
function normalizePad(v){const x=clean(v,'unknown',20).toLowerCase();return ['large','medium','small','unknown'].includes(x)?x:'unknown';}
function normalizeStatus(v){const x=clean(v,'active',20).toLowerCase();return ['active','complete','expired'].includes(x)?x:'active';}
function normalizeTags(v){const raw=Array.isArray(v)?v:String(v||'').split(',');return raw.map(x=>String(x).trim()).filter(Boolean).slice(0,10).map(x=>x.slice(0,40));}
function clampNumber(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;}
function clean(v,fallback,max){if(typeof v!=='string')return fallback;const x=v.trim();return x?x.slice(0,max):fallback;}
function headers(){return {'Cache-Control':'no-store, no-cache, must-revalidate',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};}
function reply(data,status=200){return json(data,{status,headers:headers()});}
