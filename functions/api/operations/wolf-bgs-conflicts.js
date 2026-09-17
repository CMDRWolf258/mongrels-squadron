import { json, readSession } from '../../../lib/auth.js';

const KV_KEY = 'wolf-bgs-conflicts-v1';
const MAX_PAIRS = 3;

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  return json({ ok: true, ...(await readState(env)) }, { headers: privateHeaders() });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function' || typeof env.DAILY_ORDERS.put !== 'function') {
    return json({ ok: false, error: 'bgs_storage_not_configured' }, { status: 503, headers: privateHeaders() });
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, { status: 400, headers: privateHeaders() }); }

  const action = cleanText(body?.action, '', 60);
  const now = new Date().toISOString();
  const actor = auth.session.displayName || auth.session.username || 'CMDR Wolf258';
  const current = await readState(env);

  if (action === 'save-system-conflicts') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const pairs = normalizePairs(body?.pairs);
    if (pairs.length) current.systemConflicts[system] = pairs;
    else delete current.systemConflicts[system];
    current.updatedAt[system] = now;
    current.updatedBy[system] = actor;
    await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  if (action === 'reset-system-conflicts') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    delete current.systemConflicts[system];
    delete current.updatedAt[system];
    delete current.updatedBy[system];
    await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
}

async function readState(env) {
  const empty = { version: 1, systemConflicts: {}, updatedAt: {}, updatedBy: {} };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    const systemConflicts = {};
    for (const [system, pairs] of Object.entries(stored.systemConflicts || {})) {
      const key = cleanText(system, '', 140);
      if (key) systemConflicts[key] = normalizePairs(pairs);
    }
    return {
      version: 1,
      systemConflicts,
      updatedAt: normalizeTextMap(stored.updatedAt, 60),
      updatedBy: normalizeTextMap(stored.updatedBy, 120),
    };
  } catch (error) {
    console.error('Could not read Wolf BGS conflict configuration', error);
    return empty;
  }
}

function normalizePairs(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const used = new Set();
  for (const row of value.slice(0, MAX_PAIRS)) {
    const factionA = cleanText(row?.factionA, '', 120);
    const factionB = cleanText(row?.factionB, '', 120);
    if (!factionA || !factionB || factionA.toLowerCase() === factionB.toLowerCase()) continue;
    const keyA = factionA.toLowerCase();
    const keyB = factionB.toLowerCase();
    if (used.has(keyA) || used.has(keyB)) continue;
    used.add(keyA); used.add(keyB);
    out.push({
      factionA,
      factionB,
      objective: ['monitor', 'win-a', 'win-b'].includes(row?.objective) ? row.objective : 'monitor',
    });
  }
  return out;
}

function normalizeTextMap(value, maxLength) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, item] of Object.entries(value)) {
    const cleanKey = cleanText(key, '', 140);
    const cleanValue = cleanText(item, '', maxLength);
    if (cleanKey && cleanValue) out[cleanKey] = cleanValue;
  }
  return out;
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response: json({ ok: false, error: 'authentication_required' }, { status: 401, headers: privateHeaders() }) };
  if (session.access !== 'site_admin') return { response: json({ ok: false, error: 'site_admin_required' }, { status: 403, headers: privateHeaders() }) };
  return { session };
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'wolf-bgs-control') {
    return json({ ok: false, error: 'request_validation_failed' }, { status: 403, headers: privateHeaders() });
  }
  return null;
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : fallback;
}
function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  };
}
