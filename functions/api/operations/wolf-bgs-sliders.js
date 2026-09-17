import { json, readSession } from '../../../lib/auth.js';

const SLIDER_KV_KEY = 'wolf-bgs-slider-objectives-v1';

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const state = await readState(env);
  return json({ ok: true, ...state }, { headers: privateHeaders() });
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
  const system = cleanText(body?.system, '', 140);
  const now = new Date().toISOString();
  const actor = auth.session.displayName || auth.session.username || 'CMDR Wolf258';

  if (!system) {
    return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
  }

  const state = await readState(env);

  if (action === 'save-system-slider-objectives') {
    state.systemSliderObjectives[system] = normalizeObjectives(body?.objectives);
    state.sliderUpdatedAt[system] = now;
    state.sliderUpdatedBy[system] = actor;
  } else if (action === 'reset-system-slider-objectives') {
    delete state.systemSliderObjectives[system];
    delete state.sliderUpdatedAt[system];
    delete state.sliderUpdatedBy[system];
  } else {
    return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
  }

  state.updatedAt = now;
  state.updatedBy = actor;
  await env.DAILY_ORDERS.put(SLIDER_KV_KEY, JSON.stringify(state));
  return json({ ok: true, ...state }, { headers: privateHeaders() });
}

async function readState(env) {
  const empty = {
    version: 1,
    systemSliderObjectives: {},
    sliderUpdatedAt: {},
    sliderUpdatedBy: {},
    updatedAt: null,
    updatedBy: null,
  };

  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;

  try {
    const stored = await env.DAILY_ORDERS.get(SLIDER_KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    return {
      version: 1,
      systemSliderObjectives: normalizeSystemMap(stored.systemSliderObjectives),
      sliderUpdatedAt: normalizeTextMap(stored.sliderUpdatedAt, 60),
      sliderUpdatedBy: normalizeTextMap(stored.sliderUpdatedBy, 120),
      updatedAt: stored.updatedAt || null,
      updatedBy: cleanText(stored.updatedBy, '', 120) || null,
    };
  } catch (error) {
    console.error('Could not read Wolf BGS Economy/Security objectives', error);
    return empty;
  }
}

function normalizeObjectives(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];

  for (const row of value.slice(0, 12)) {
    const faction = cleanText(row?.faction, '', 120);
    const key = faction.toLowerCase();
    if (!faction || seen.has(key)) continue;
    seen.add(key);

    const economyObjective = normalizeSliderObjective(row?.economyObjective);
    const securityObjective = normalizeSecurityObjective(row?.securityObjective);
    const notes = cleanText(row?.notes, '', 500);

    if (economyObjective === 'ignore' && securityObjective === 'ignore' && !notes) continue;
    out.push({ faction, economyObjective, securityObjective, notes });
  }

  return out;
}

function normalizeSystemMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [system, rows] of Object.entries(value)) {
    const key = cleanText(system, '', 140);
    if (key) out[key] = normalizeObjectives(rows);
  }
  return out;
}

function normalizeSliderObjective(value) {
  return ['ignore', 'raise', 'hold', 'lower'].includes(value) ? value : 'ignore';
}

function normalizeSecurityObjective(value) {
  return ['ignore', 'raise', 'hold', 'lower', 'locked'].includes(value) ? value : 'ignore';
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
