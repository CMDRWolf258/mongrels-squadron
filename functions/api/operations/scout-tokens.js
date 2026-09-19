import { json, readSession } from '../../../lib/auth.js';

const TOKENS_KEY = 'wolf-bgs-scout-tokens-v1';
const MAX_TOKENS = 24;

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const state = await readState(env);
  return json({
    ok:true,
    tokens:Object.values(state.tokens)
      .sort((a,b) => String(a.label).localeCompare(String(b.label)))
      .map(publicToken),
  }, { headers:privateHeaders() });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!storageReady(env)) return unavailable();

  let body;
  try { body = await request.json(); }
  catch { return json({ok:false,error:'invalid_json'}, {status:400,headers:privateHeaders()}); }

  const label = cleanText(body?.label, '', 80);
  if (!label) return json({ok:false,error:'label_required'}, {status:400,headers:privateHeaders()});

  const state = await readState(env);
  if (Object.keys(state.tokens).length >= MAX_TOKENS) {
    return json({ok:false,error:'token_limit_reached'}, {status:409,headers:privateHeaders()});
  }

  const id = crypto.randomUUID();
  const token = 'mscout_' + randomBase64Url(32);
  const hash = await sha256Hex(token);
  const now = new Date().toISOString();
  state.tokens[id] = {
    id,
    label,
    hash,
    createdAt:now,
    createdBy:auth.session.displayName || auth.session.username || 'CMDR Wolf258',
    lastSeenAt:null,
    lastSystem:'',
    lastEventAt:null,
  };
  await env.DAILY_ORDERS.put(TOKENS_KEY, JSON.stringify(state));

  return json({
    ok:true,
    token,
    scout:publicToken(state.tokens[id]),
    warning:'This token is shown once. Copy it into the Mongrel Scout EDMC plugin before closing this view.',
  }, {headers:privateHeaders()});
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!storageReady(env)) return unavailable();

  let body;
  try { body = await request.json(); }
  catch { return json({ok:false,error:'invalid_json'}, {status:400,headers:privateHeaders()}); }

  const id = cleanText(body?.id, '', 80);
  const state = await readState(env);
  if (!id || !state.tokens[id]) {
    return json({ok:false,error:'token_not_found'}, {status:404,headers:privateHeaders()});
  }
  delete state.tokens[id];
  await env.DAILY_ORDERS.put(TOKENS_KEY, JSON.stringify(state));
  return json({ok:true,id}, {headers:privateHeaders()});
}

async function readState(env) {
  const empty = {version:1,tokens:{}};
  if (!storageReady(env)) return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(TOKENS_KEY, {type:'json'});
    if (!stored || typeof stored !== 'object') return empty;
    const tokens = {};
    for (const [id,value] of Object.entries(stored.tokens || {})) {
      if (!value || typeof value !== 'object') continue;
      const cleanId = cleanText(value.id || id, '', 80);
      const hash = cleanText(value.hash, '', 128);
      const label = cleanText(value.label, '', 80);
      if (!cleanId || !hash || !label) continue;
      tokens[cleanId] = {
        id:cleanId,
        label,
        hash,
        createdAt:value.createdAt || null,
        createdBy:cleanText(value.createdBy, '', 120),
        lastSeenAt:value.lastSeenAt || null,
        lastSystem:cleanText(value.lastSystem, '', 140),
        lastEventAt:value.lastEventAt || null,
      };
    }
    return {version:1,tokens};
  } catch (error) {
    console.error('Could not read Mongrel Scout tokens', error);
    return empty;
  }
}

function publicToken(value) {
  return {
    id:value.id,
    label:value.label,
    createdAt:value.createdAt,
    createdBy:value.createdBy,
    lastSeenAt:value.lastSeenAt,
    lastSystem:value.lastSystem,
    lastEventAt:value.lastEventAt,
  };
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) return {response:json({ok:false,error:'authentication_required'}, {status:401,headers:privateHeaders()})};
  if (session.access !== 'site_admin') return {response:json({ok:false,error:'site_admin_required'}, {status:403,headers:privateHeaders()})};
  return {session};
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'wolf-bgs-control') {
    return json({ok:false,error:'request_validation_failed'}, {status:403,headers:privateHeaders()});
  }
  return null;
}

function storageReady(env) {
  return Boolean(env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.get === 'function' && typeof env.DAILY_ORDERS.put === 'function');
}
function unavailable() {
  return json({ok:false,error:'bgs_storage_not_configured'}, {status:503,headers:privateHeaders()});
}
function randomBase64Url(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0,maxLength) : fallback;
}
function privateHeaders() {
  return {'Cache-Control':'private, no-store, max-age=0',Pragma:'no-cache','X-Content-Type-Options':'nosniff',Vary:'Cookie'};
}
