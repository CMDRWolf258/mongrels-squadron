import { json, readSession } from '../../../lib/auth.js';

const ECONOMY_RULES_KV_KEY = 'wolf-bgs-economy-rules-v1';
const DEFAULTS = {
  version: 1,
  explorationRoutineMillionsPerCmdr: 2,
  explorationStrongMillionsPerCmdr: 5,
  explorationEmergencyMillionsPerCmdr: 10,
  negativeWorkEnabled: false,
};

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  return json({ ok: true, ...(await readEconomyRules(env)) }, { headers: privateHeaders() });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') {
    return json({ ok: false, error: 'bgs_storage_not_configured' }, { status: 503, headers: privateHeaders() });
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, { status: 400, headers: privateHeaders() }); }
  if (body?.action !== 'save-economy-rules') {
    return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
  }

  const current = await readEconomyRules(env);
  const settings = normalizeSettings(body?.settings);
  const next = {
    version: 1,
    settings,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.session.displayName || auth.session.username || 'CMDR Wolf258',
    createdAt: current.createdAt || new Date().toISOString(),
  };
  await env.DAILY_ORDERS.put(ECONOMY_RULES_KV_KEY, JSON.stringify(next));
  return json({ ok: true, ...next }, { headers: privateHeaders() });
}

async function readEconomyRules(env) {
  const empty = { version: 1, settings: normalizeSettings(DEFAULTS), updatedAt: null, updatedBy: null, createdAt: null };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(ECONOMY_RULES_KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    return {
      version: 1,
      settings: normalizeSettings(stored.settings || stored),
      updatedAt: stored.updatedAt || null,
      updatedBy: cleanText(stored.updatedBy, '', 120) || null,
      createdAt: stored.createdAt || null,
    };
  } catch (error) {
    console.error('Could not read Wolf BGS economy bucket rules', error);
    return empty;
  }
}

function normalizeSettings(value = {}) {
  const routine = clampNumber(value.explorationRoutineMillionsPerCmdr, 0, 10, DEFAULTS.explorationRoutineMillionsPerCmdr);
  const strongRaw = clampNumber(value.explorationStrongMillionsPerCmdr, 0, 10, DEFAULTS.explorationStrongMillionsPerCmdr);
  const emergencyRaw = clampNumber(value.explorationEmergencyMillionsPerCmdr, 0, 10, DEFAULTS.explorationEmergencyMillionsPerCmdr);
  const strong = Math.max(routine, strongRaw);
  const emergency = Math.max(strong, emergencyRaw);
  return {
    explorationRoutineMillionsPerCmdr: routine,
    explorationStrongMillionsPerCmdr: strong,
    explorationEmergencyMillionsPerCmdr: emergency,
    negativeWorkEnabled: false,
  };
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

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function clampNumber(value, min, max, fallback) {
  const n = finiteOrNull(value);
  return n === null ? fallback : Math.max(min, Math.min(max, n));
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
