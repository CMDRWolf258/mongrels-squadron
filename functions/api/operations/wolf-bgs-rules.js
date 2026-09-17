import { json, readSession } from '../../../lib/auth.js';

const RULES_KV_KEY = 'wolf-bgs-rules-v1';
const CONTROL_KV_KEY = 'wolf-bgs-control-v1';

const DEFAULT_RULES = {
  version: 2,
  workload: {
    missionInfPerCmdr: 25,
    missionInfStretchPerCmdr: 40,
    bountyMillionsPerCmdr: 20,
    tradeProfitMillionsPerCmdr: 20,
    explorationMillionsPerCmdr: 10,
    preferredOperators: 3,
    diversifyBuckets: true,
    soloDoNotMultiply: true,
  },
  balancing: {
    bountyBaselineMillions: 20,
    bountyCounterInf: 15,
    tradeBaselineMillions: 20,
    tradeCounterInf: null,
    triggerHeadroomPct: 2,
    maxCounterweightFactions: 2,
  },
  safety: {
    retreatWarning: 5,
    retreatEmergency: 3,
    expansionWarning: 67,
  },
  doctrine: {
    exactPerCmdrCapConfirmed: false,
    operatorStrategy: 'spread-first',
  },
};

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const rules = await readRules(env);
  return json({ ok: true, ...rules }, { headers: privateHeaders() });
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

  if (action === 'save-rules') {
    const current = await readRules(env);
    const next = {
      ...current,
      version: 2,
      rules: normalizeRules(body?.rules),
      updatedAt: now,
      updatedBy: actor,
    };
    await env.DAILY_ORDERS.put(RULES_KV_KEY, JSON.stringify(next));
    return json({ ok: true, ...next }, { headers: privateHeaders() });
  }

  if (action === 'save-system-faction-strategies') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const current = await readRules(env);
    current.systemFactionStrategies[system] = normalizeFactionStrategies(body?.strategies);
    current.factionStrategyUpdatedAt[system] = now;
    current.factionStrategyUpdatedBy[system] = actor;
    current.updatedAt = now;
    current.updatedBy = actor;
    await env.DAILY_ORDERS.put(RULES_KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  if (action === 'reset-system-faction-strategies') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const current = await readRules(env);
    delete current.systemFactionStrategies[system];
    delete current.factionStrategyUpdatedAt[system];
    delete current.factionStrategyUpdatedBy[system];
    current.updatedAt = now;
    current.updatedBy = actor;
    await env.DAILY_ORDERS.put(RULES_KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  if (action === 'save-system-calibration') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const current = await readRules(env);
    current.systemCalibrations[system] = normalizeCalibration(body?.calibration);
    current.calibrationUpdatedAt[system] = now;
    current.calibrationUpdatedBy[system] = actor;
    current.updatedAt = now;
    current.updatedBy = actor;
    await env.DAILY_ORDERS.put(RULES_KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  if (action === 'reset-system-calibration') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const current = await readRules(env);
    delete current.systemCalibrations[system];
    delete current.calibrationUpdatedAt[system];
    delete current.calibrationUpdatedBy[system];
    current.updatedAt = now;
    current.updatedBy = actor;
    await env.DAILY_ORDERS.put(RULES_KV_KEY, JSON.stringify(current));
    return json({ ok: true, ...current }, { headers: privateHeaders() });
  }

  if (action === 'reset-system-settings') {
    const system = cleanText(body?.system, '', 140);
    if (!system) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const raw = await env.DAILY_ORDERS.get(CONTROL_KV_KEY, { type: 'json' }) || {};
    const map = raw.systemSettings && typeof raw.systemSettings === 'object' ? raw.systemSettings : {};
    const existing = map?.[system] && typeof map[system] === 'object' ? map[system] : {};
    const favorite = Boolean(existing.favorite);
    const notes = cleanText(existing.notes, '', 1200);
    const preserved = {};
    if (favorite) preserved.favorite = true;
    if (notes) preserved.notes = notes;
    if (Object.keys(preserved).length) map[system] = preserved;
    else delete map[system];
    raw.systemSettings = map;
    await env.DAILY_ORDERS.put(CONTROL_KV_KEY, JSON.stringify(raw));
    return json({ ok: true, system, favoritePreserved: favorite, notesPreserved: Boolean(notes), resetAt: now, resetBy: actor }, { headers: privateHeaders() });
  }

  return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
}

async function readRules(env) {
  const empty = {
    version: 2,
    rules: normalizeRules(DEFAULT_RULES),
    systemFactionStrategies: {},
    factionStrategyUpdatedAt: {},
    factionStrategyUpdatedBy: {},
    systemCalibrations: {},
    calibrationUpdatedAt: {},
    calibrationUpdatedBy: {},
    updatedAt: null,
    updatedBy: null,
  };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(RULES_KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    return {
      version: 2,
      rules: normalizeRules(stored.rules),
      systemFactionStrategies: normalizeSystemStrategyMap(stored.systemFactionStrategies),
      factionStrategyUpdatedAt: normalizeTextMap(stored.factionStrategyUpdatedAt, 60),
      factionStrategyUpdatedBy: normalizeTextMap(stored.factionStrategyUpdatedBy, 120),
      systemCalibrations: normalizeSystemCalibrationMap(stored.systemCalibrations),
      calibrationUpdatedAt: normalizeTextMap(stored.calibrationUpdatedAt, 60),
      calibrationUpdatedBy: normalizeTextMap(stored.calibrationUpdatedBy, 120),
      updatedAt: stored.updatedAt || null,
      updatedBy: cleanText(stored.updatedBy, '', 120) || null,
    };
  } catch (error) {
    console.error('Could not read Wolf BGS automation rules', error);
    return empty;
  }
}

function normalizeRules(value = {}) {
  const workload = value?.workload || {};
  const balancing = value?.balancing || {};
  const safety = value?.safety || {};
  const doctrine = value?.doctrine || {};
  return {
    version: 2,
    workload: {
      missionInfPerCmdr: clampNumber(workload.missionInfPerCmdr, 1, 100, DEFAULT_RULES.workload.missionInfPerCmdr),
      missionInfStretchPerCmdr: clampNumber(workload.missionInfStretchPerCmdr, 1, 150, DEFAULT_RULES.workload.missionInfStretchPerCmdr),
      bountyMillionsPerCmdr: clampNumber(workload.bountyMillionsPerCmdr, 1, 250, DEFAULT_RULES.workload.bountyMillionsPerCmdr),
      tradeProfitMillionsPerCmdr: clampNumber(workload.tradeProfitMillionsPerCmdr, 1, 250, DEFAULT_RULES.workload.tradeProfitMillionsPerCmdr),
      explorationMillionsPerCmdr: clampNumber(workload.explorationMillionsPerCmdr, 1, 250, DEFAULT_RULES.workload.explorationMillionsPerCmdr),
      preferredOperators: Math.round(clampNumber(workload.preferredOperators, 1, 12, DEFAULT_RULES.workload.preferredOperators)),
      diversifyBuckets: workload.diversifyBuckets !== false,
      soloDoNotMultiply: workload.soloDoNotMultiply !== false,
    },
    balancing: {
      bountyBaselineMillions: clampNumber(balancing.bountyBaselineMillions, 1, 250, DEFAULT_RULES.balancing.bountyBaselineMillions),
      bountyCounterInf: clampNumber(balancing.bountyCounterInf, 0, 150, DEFAULT_RULES.balancing.bountyCounterInf),
      tradeBaselineMillions: clampNumber(balancing.tradeBaselineMillions, 1, 250, DEFAULT_RULES.balancing.tradeBaselineMillions),
      tradeCounterInf: nullableClampNumber(balancing.tradeCounterInf, 0, 150),
      triggerHeadroomPct: clampNumber(balancing.triggerHeadroomPct, 0, 20, DEFAULT_RULES.balancing.triggerHeadroomPct),
      maxCounterweightFactions: Math.round(clampNumber(balancing.maxCounterweightFactions, 1, 2, DEFAULT_RULES.balancing.maxCounterweightFactions)),
    },
    safety: {
      retreatWarning: clampNumber(safety.retreatWarning, 0, 20, DEFAULT_RULES.safety.retreatWarning),
      retreatEmergency: clampNumber(safety.retreatEmergency, 0, 20, DEFAULT_RULES.safety.retreatEmergency),
      expansionWarning: clampNumber(safety.expansionWarning, 0, 100, DEFAULT_RULES.safety.expansionWarning),
    },
    doctrine: {
      exactPerCmdrCapConfirmed: false,
      operatorStrategy: doctrine.operatorStrategy === 'single-grind' ? 'single-grind' : 'spread-first',
    },
  };
}

function normalizeFactionStrategies(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const row of value.slice(0, 12)) {
    const faction = cleanText(row?.faction, '', 120);
    const key = faction.toLowerCase();
    if (!faction || seen.has(key)) continue;
    seen.add(key);
    const legacyIntent = row?.intent === 'no-action' ? 'flexible' : row?.intent;
    out.push({
      faction,
      intent: ['flexible', 'avoid-interaction', 'support', 'suppress', 'maintain', 'protect-retreat', 'allow-retreat'].includes(legacyIntent) ? legacyIntent : 'flexible',
      targetMin: percentOrNull(row?.targetMin),
      targetMax: percentOrNull(row?.targetMax),
      controlObjective: ['none', 'prefer-control', 'avoid-control', 'allow-control'].includes(row?.controlObjective) ? row.controlObjective : 'none',
      notes: cleanText(row?.notes, '', 500),
    });
  }
  return out;
}

function normalizeCalibration(value = {}) {
  return {
    bountyPercentAdjustment: clampNumber(value?.bountyPercentAdjustment, -100, 300, 0),
    bountyFlatInfAdjustment: clampNumber(value?.bountyFlatInfAdjustment, -100, 100, 0),
    tradePercentAdjustment: clampNumber(value?.tradePercentAdjustment, -100, 300, 0),
    tradeFlatInfAdjustment: clampNumber(value?.tradeFlatInfAdjustment, -100, 100, 0),
  };
}

function normalizeSystemStrategyMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [system, rows] of Object.entries(value)) {
    const key = cleanText(system, '', 140);
    if (key) out[key] = normalizeFactionStrategies(rows);
  }
  return out;
}

function normalizeSystemCalibrationMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [system, calibration] of Object.entries(value)) {
    const key = cleanText(system, '', 140);
    if (key) out[key] = normalizeCalibration(calibration);
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

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function clampNumber(value, min, max, fallback) {
  const n = finiteOrNull(value);
  return n === null ? fallback : Math.max(min, Math.min(max, n));
}
function nullableClampNumber(value, min, max) {
  const n = finiteOrNull(value);
  return n === null ? null : Math.max(min, Math.min(max, n));
}
function percentOrNull(value) {
  const n = finiteOrNull(value);
  return n === null ? null : Math.max(0, Math.min(100, Math.round(n * 100) / 100));
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
