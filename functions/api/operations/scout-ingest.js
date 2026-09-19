import { json } from '../../../lib/auth.js';

const MONGREL = 'Regiment of Imperial Mongrels';
const TOKENS_KEY = 'wolf-bgs-scout-tokens-v1';
const SNAPSHOTS_KEY = 'wolf-bgs-scout-snapshots-v1';
const ACCEPTED_EVENTS = new Set(['FSDJump','Location','CarrierJump']);
const MAX_FACTIONS = 20;
const MAX_CONFLICTS = 12;

export async function onRequestPost({ request, env }) {
  if (!storageReady(env)) return reply({ok:false,error:'bgs_storage_not_configured'}, 503);

  const auth = await authenticate(request, env);
  if (!auth) return reply({ok:false,error:'invalid_scout_token'}, 401);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 128000) return reply({ok:false,error:'payload_too_large'}, 413);

  let body;
  try { body = await request.json(); }
  catch { return reply({ok:false,error:'invalid_json'}, 400); }

  const snapshot = normalizeSnapshot(body);
  if (!snapshot) return reply({ok:false,error:'invalid_scout_snapshot'}, 400);
  const eventMs = new Date(snapshot.updatedAt).getTime();
  if (eventMs > Date.now() + 15 * 60 * 1000) {
    return reply({ok:false,error:'journal_timestamp_in_future'}, 422);
  }
  if (!snapshot.factions.some(row => norm(row.name) === norm(MONGREL))) {
    return reply({ok:false,error:'mongrels_not_present'}, 422);
  }

  const state = await readSnapshots(env);
  const current = state.systems[snapshot.system];
  const stored = !current || compareTime(snapshot.updatedAt, current.updatedAt) >= 0;
  if (stored) {
    state.systems[snapshot.system] = {
      ...snapshot,
      receivedAt:new Date().toISOString(),
      scoutTokenId:auth.id,
      scoutLabel:auth.label,
    };
    updateConflictHistory(state, snapshot);
    await env.DAILY_ORDERS.put(SNAPSHOTS_KEY, JSON.stringify(state));
  }

  await noteTokenUse(env, auth.id, snapshot);
  return reply({
    ok:true,
    accepted:true,
    stored,
    system:snapshot.system,
    updatedAt:snapshot.updatedAt,
    scout:auth.label,
  }, 200);
}

async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token.startsWith('mscout_') || token.length > 180) return null;
  const hash = await sha256Hex(token);
  const state = await readTokens(env);
  for (const value of Object.values(state.tokens)) {
    if (value?.hash && constantTimeEqual(value.hash, hash)) return value;
  }
  return null;
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const event = cleanText(value.event, '', 40);
  const system = cleanText(value.system, '', 140);
  const updatedAt = normalizeTime(value.timestamp);
  if (!ACCEPTED_EVENTS.has(event) || !system || !updatedAt) return null;

  const factions = Array.isArray(value.factions)
    ? value.factions.slice(0,MAX_FACTIONS).map(normalizeFaction).filter(Boolean)
    : [];
  if (!factions.length) return null;

  const conflicts = Array.isArray(value.conflicts)
    ? value.conflicts.slice(0,MAX_CONFLICTS).map(normalizeConflict).filter(Boolean)
    : [];

  return {
    version:1,
    event,
    system,
    systemAddress:safeInteger(value.systemAddress),
    updatedAt,
    systemFaction:normalizeSystemFaction(value.systemFaction),
    security:cleanText(value.security, '', 80),
    population:safeInteger(value.population),
    factions,
    conflicts,
    source:'Mongrel Scout / EDMC',
  };
}

function normalizeFaction(value) {
  if (!value || typeof value !== 'object') return null;
  const name = cleanText(value.name, '', 120);
  if (!name) return null;
  return {
    name,
    influence:percentOrNull(value.influence),
    state:cleanText(value.state, 'None', 80),
    activeStates:stringList(value.activeStates, 12, 80),
    pendingStates:stringList(value.pendingStates, 12, 80),
    recoveringStates:stringList(value.recoveringStates, 12, 80),
    happiness:cleanText(value.happiness, '', 80),
  };
}

function normalizeConflict(value) {
  if (!value || typeof value !== 'object') return null;
  const faction1 = normalizeConflictSide(value.faction1);
  const faction2 = normalizeConflictSide(value.faction2);
  if (!faction1 || !faction2) return null;
  return {
    type:cleanText(value.type, '', 60),
    status:cleanText(value.status, '', 60),
    faction1,
    faction2,
  };
}
function normalizeConflictSide(value) {
  if (!value || typeof value !== 'object') return null;
  const name = cleanText(value.name, '', 120);
  if (!name) return null;
  const wonDays = Math.round(Number(value.wonDays));
  return {
    name,
    stake:cleanText(value.stake, '', 160),
    wonDays:Number.isFinite(wonDays) ? Math.max(0,Math.min(7,wonDays)) : 0,
  };
}
function normalizeSystemFaction(value) {
  if (!value || typeof value !== 'object') return {name:'',state:''};
  return {name:cleanText(value.name, '', 120),state:cleanText(value.state, '', 80)};
}

async function readTokens(env) {
  try {
    const stored = await env.DAILY_ORDERS.get(TOKENS_KEY, {type:'json'});
    return stored && typeof stored === 'object' ? {version:1,tokens:stored.tokens || {}} : {version:1,tokens:{}};
  } catch { return {version:1,tokens:{}}; }
}
async function readSnapshots(env) {
  try {
    const stored = await env.DAILY_ORDERS.get(SNAPSHOTS_KEY, {type:'json'});
    return stored && typeof stored === 'object'
      ? {version:1,systems:stored.systems || {},conflictHistory:stored.conflictHistory || {}}
      : {version:1,systems:{},conflictHistory:{}};
  } catch { return {version:1,systems:{},conflictHistory:{}}; }
}
function conflictObservation(snapshot) {
  const mongrel = (snapshot.factions || []).find(row => norm(row?.name) === norm(MONGREL));
  if (!mongrel) return null;
  const conflictName = value => {
    const text = norm(value).replaceAll('_',' ');
    if (text === 'civilwar' || text === 'civil war') return 'Civil War';
    if (text === 'war') return 'War';
    if (text === 'election') return 'Election';
    return '';
  };
  for (const state of mongrel.pendingStates || []) {
    const detail = conflictName(state);
    if (detail) return {phase:'pending',detail};
  }
  for (const state of mongrel.activeStates || []) {
    const detail = conflictName(state);
    if (detail) return {phase:'active',detail};
  }
  const detail = conflictName(mongrel.state);
  return detail ? {phase:'active',detail} : null;
}

function updateConflictHistory(state, snapshot) {
  if (!state.conflictHistory || typeof state.conflictHistory !== 'object') state.conflictHistory = {};
  const observation = conflictObservation(snapshot);
  const existing = state.conflictHistory[snapshot.system];

  if (!observation) {
    if (existing) delete state.conflictHistory[snapshot.system];
    return;
  }

  const sameType = existing && norm(existing.detail) === norm(observation.detail);
  if (!sameType || (observation.phase === 'pending' && existing?.lastPhase === 'active')) {
    state.conflictHistory[snapshot.system] = {
      system:snapshot.system,
      detail:observation.detail,
      pendingSeenAt:observation.phase === 'pending' ? snapshot.updatedAt : null,
      activeSeenAt:observation.phase === 'active' ? snapshot.updatedAt : null,
      lastPhase:observation.phase,
      lastSeenAt:snapshot.updatedAt,
    };
    return;
  }

  existing.lastPhase = observation.phase;
  existing.lastSeenAt = snapshot.updatedAt;
  if (observation.phase === 'pending' && !existing.pendingSeenAt) existing.pendingSeenAt = snapshot.updatedAt;
  if (observation.phase === 'active' && !existing.activeSeenAt) existing.activeSeenAt = snapshot.updatedAt;
}

async function noteTokenUse(env, id, snapshot) {
  try {
    const state = await readTokens(env);
    if (!state.tokens[id]) return;
    state.tokens[id] = {
      ...state.tokens[id],
      lastSeenAt:new Date().toISOString(),
      lastSystem:snapshot.system,
      lastEventAt:snapshot.updatedAt,
    };
    await env.DAILY_ORDERS.put(TOKENS_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Could not update Mongrel Scout token activity', error);
  }
}

function stringList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,maxItems).map(item => cleanText(item, '', maxLength)).filter(Boolean);
}
function percentOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const percent = n <= 1 ? n * 100 : n;
  return Math.max(0,Math.min(100,percent));
}
function safeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}
function normalizeTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function compareTime(a,b) {
  const aa = new Date(a || 0).getTime();
  const bb = new Date(b || 0).getTime();
  return (Number.isFinite(aa)?aa:0) - (Number.isFinite(bb)?bb:0);
}
function norm(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g,' '); }
function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0,maxLength) : fallback;
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
function constantTimeEqual(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function storageReady(env) {
  return Boolean(env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.get === 'function' && typeof env.DAILY_ORDERS.put === 'function');
}
function reply(value,status) {
  return json(value, {status,headers:{
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'null',
  }});
}
