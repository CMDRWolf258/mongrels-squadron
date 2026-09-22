import { json, readSession } from '../../../lib/auth.js';

const CONTROL_KV_KEY = 'wolf-bgs-control-v1';
const MONGREL = 'Regiment of Imperial Mongrels';
const ALERT_FAMILIES = new Set(['retreat','conflict','bust','civil-unrest']);

const DEFAULTS = {
  defaultTick: '19:00',
  freshnessMode: 'tick-cycle',
  transitionMinutes: 90,
  lateGraceHours: 3,
  maxDailySystems: 6,
  rolloverPolicy: 'safety',
  requirePostTickForNormalOrders: true,
  allowEmergencyWithStaleData: false,
};

const SYSTEM_DEFAULTS = {
  priority: 'normal',
  controlPolicy: 'maintain-existing',
  targetMin: null,
  targetMax: null,
  desiredStates: [],
  avoidStates: [],
  protectRetreat: true,
  avoidExpansion: false,
  allowDailyOrders: true,
  autoGenerateOrders: true,
  emergencyOverride: true,
  reactRetreat: true,
  reactConflict: true,
  reactExpansion: true,
  reactInfluence: true,
  reactStates: true,
};

const OVERRIDE_KEYS = [
  'priority', 'controlPolicy', 'targetMin', 'targetMax', 'desiredStates', 'avoidStates',
  'protectRetreat', 'avoidExpansion', 'allowDailyOrders', 'autoGenerateOrders',
  'emergencyOverride', 'reactRetreat', 'reactConflict', 'reactExpansion',
  'reactInfluence', 'reactStates', 'customTick', 'rolloverPolicy',
];

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const raw = await readRawControl(env);
  const systemDefaults = normalizeSystemDefaults(raw.systemDefaults);
  const systemSettings = normalizeSparseSettingsMap(raw.systemSettings, systemDefaults);
  return json({ ok: true, systemDefaults, systemSettings }, { headers: privateHeaders() });
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

  const action = cleanText(body?.action, '', 40);
  const now = new Date().toISOString();
  const actor = auth.session.displayName || auth.session.username || 'CMDR Wolf258';
  const raw = await readRawControl(env);
  const previousSystemDefaults = normalizeSystemDefaults(raw.systemDefaults);

  // Migrate legacy flattened per-system records before any default changes are applied.
  // Values equal to the old System Defaults are inheritance, not durable overrides.
  raw.systemSettings = normalizeSparseSettingsMap(raw.systemSettings, previousSystemDefaults);

  if (action === 'save-global') {
    raw.defaults = normalizeDefaults(body.defaults);
    raw.globalUpdatedAt = now;
    raw.globalUpdatedBy = actor;
  } else if (action === 'save-system-defaults') {
    raw.systemDefaults = normalizeSystemDefaults(body.systemDefaults);
    raw.systemDefaultsUpdatedAt = now;
    raw.systemDefaultsUpdatedBy = actor;
  } else if (action === 'save-system') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const existing = raw.systemSettings[name] || {};
    const overrides = normalizeSystemOverrides(body?.settings, previousSystemDefaults);
    const favorite = body?.settings?.favorite === undefined ? Boolean(existing.favorite) : Boolean(body.settings.favorite);
    const queueSelected = body?.settings?.queueSelected === undefined ? Boolean(existing.queueSelected) : Boolean(body.settings.queueSelected);
    const next = {
      ...overrides,
      ...(favorite ? { favorite: true } : {}),
      ...(queueSelected ? { queueSelected: true } : {}),
      updatedAt: now,
      updatedBy: actor,
    };
    if (hasStoredSystemData(next)) raw.systemSettings[name] = next;
    else delete raw.systemSettings[name];
  } else if (action === 'toggle-favorite') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const existing = raw.systemSettings[name] || {};
    const next = {
      ...existing,
      ...(body.favorite ? { favorite: true } : {}),
      updatedAt: now,
      updatedBy: actor,
    };
    if (!body.favorite) delete next.favorite;
    if (hasStoredSystemData(next)) raw.systemSettings[name] = next;
    else delete raw.systemSettings[name];
  } else if (action === 'toggle-queue-selector') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const existing = raw.systemSettings[name] || {};
    const next = {
      ...existing,
      ...(body.queueSelected ? { queueSelected:true } : {}),
      updatedAt: now,
      updatedBy: actor,
    };
    if (!body.queueSelected) delete next.queueSelected;
    if (hasStoredSystemData(next)) raw.systemSettings[name] = next;
    else delete raw.systemSettings[name];
  } else if (action === 'set-conflict-day') {
    const name = cleanText(body?.system, '', 140);
    const day = Math.round(Number(body?.day));
    if (!name) return json({ ok:false, error:'system_required' }, { status:400, headers:privateHeaders() });
    if (!Number.isFinite(day) || day < 1 || day > 7) {
      return json({ ok:false, error:'conflict_day_invalid' }, { status:400, headers:privateHeaders() });
    }
    raw.conflictDayOverrides = normalizeConflictDayOverrides(raw.conflictDayOverrides);
    raw.conflictDayOverrides[name] = { day, setAt:now, setBy:actor };
  } else if (action === 'clear-conflict-day') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok:false, error:'system_required' }, { status:400, headers:privateHeaders() });
    raw.conflictDayOverrides = normalizeConflictDayOverrides(raw.conflictDayOverrides);
    delete raw.conflictDayOverrides[name];
  } else if (action === 'ack-alerts') {
    raw.alertEpisodes = raw.alertEpisodes && typeof raw.alertEpisodes === 'object' ? raw.alertEpisodes : {};
    for (const episode of Object.values(raw.alertEpisodes)) {
      if (episode && !episode.removedAt && !episode.reviewedAt) episode.reviewedAt = now;
    }
  } else if (action === 'remove-alert') {
    const name = cleanText(body?.system, '', 140);
    const family = cleanText(body?.family, '', 40);
    if (!name || !ALERT_FAMILIES.has(family)) {
      return json({ ok:false, error:'alert_required' }, { status:400, headers:privateHeaders() });
    }
    raw.alertEpisodes = raw.alertEpisodes && typeof raw.alertEpisodes === 'object' ? raw.alertEpisodes : {};
    const key = `${name}::${family}`;
    if (raw.alertEpisodes[key] && typeof raw.alertEpisodes[key] === 'object') raw.alertEpisodes[key].removedAt = now;
  } else if (action === 'submit-status') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    raw.manualSnapshots = raw.manualSnapshots && typeof raw.manualSnapshots === 'object' ? raw.manualSnapshots : {};
    raw.manualSnapshots[name] = normalizeManualSnapshot(body.snapshot, now, actor);
  } else {
    return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
  }

  raw.version = 3;
  raw.defaults = normalizeDefaults(raw.defaults);
  raw.systemDefaults = normalizeSystemDefaults(raw.systemDefaults);
  raw.manualSnapshots = raw.manualSnapshots && typeof raw.manualSnapshots === 'object' ? raw.manualSnapshots : {};
  raw.conflictDayOverrides = normalizeConflictDayOverrides(raw.conflictDayOverrides);
  await env.DAILY_ORDERS.put(CONTROL_KV_KEY, JSON.stringify(raw));

  return json({ ok: true, action, updatedAt: now, updatedBy: actor }, { headers: privateHeaders() });
}

async function readRawControl(env) {
  const empty = {
    version: 3,
    defaults: { ...DEFAULTS },
    globalUpdatedAt: null,
    globalUpdatedBy: null,
    systemDefaults: { ...SYSTEM_DEFAULTS },
    systemDefaultsUpdatedAt: null,
    systemDefaultsUpdatedBy: null,
    systemSettings: {},
    manualSnapshots: {},
    alertEpisodes: {},
    conflictDayOverrides: {},
  };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(CONTROL_KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    return {
      ...empty,
      ...stored,
      defaults: stored.defaults && typeof stored.defaults === 'object' ? stored.defaults : empty.defaults,
      systemDefaults: stored.systemDefaults && typeof stored.systemDefaults === 'object' ? stored.systemDefaults : empty.systemDefaults,
      systemSettings: stored.systemSettings && typeof stored.systemSettings === 'object' ? stored.systemSettings : {},
      manualSnapshots: stored.manualSnapshots && typeof stored.manualSnapshots === 'object' ? stored.manualSnapshots : {},
      alertEpisodes: stored.alertEpisodes && typeof stored.alertEpisodes === 'object' ? stored.alertEpisodes : {},
      conflictDayOverrides: normalizeConflictDayOverrides(stored.conflictDayOverrides),
    };
  } catch (error) {
    console.error('Could not read raw Wolf BGS Control state', error);
    return empty;
  }
}

function normalizeConflictDayOverrides(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [system, item] of Object.entries(value)) {
    const name = cleanText(system, '', 140);
    const day = Math.round(Number(item?.day));
    if (!name || !Number.isFinite(day) || day < 1 || day > 7) continue;
    out[name] = {
      day,
      setAt:cleanText(item?.setAt, '', 80) || null,
      setBy:cleanText(item?.setBy, '', 120),
    };
  }
  return out;
}

function normalizeSparseSettingsMap(value, systemDefaults) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [name, settings] of Object.entries(value)) {
    const key = cleanText(name, '', 140);
    if (!key || !settings || typeof settings !== 'object') continue;
    const normalized = normalizeSystemOverrides(settings, systemDefaults);
    if (settings.favorite) normalized.favorite = true;
    if (settings.queueSelected) normalized.queueSelected = true;
    const updatedAt = cleanText(settings.updatedAt, '', 80);
    const updatedBy = cleanText(settings.updatedBy, '', 120);
    if (updatedAt) normalized.updatedAt = updatedAt;
    if (updatedBy) normalized.updatedBy = updatedBy;
    if (hasStoredSystemData(normalized)) out[key] = normalized;
  }
  return out;
}

function normalizeSystemOverrides(value = {}, baseDefaults = SYSTEM_DEFAULTS) {
  const base = normalizeSystemDefaults(baseDefaults);
  const out = {};

  const priority = normalizePriorityOptional(value.priority || value.strategicPriority);
  if (priority && priority !== base.priority) out.priority = priority;

  const legacyControl = value.desiredControl === 'maintain' ? 'maintain-existing' : value.desiredControl;
  const controlPolicy = normalizeControlPolicyOptional(value.controlPolicy || legacyControl);
  if (controlPolicy && controlPolicy !== base.controlPolicy) out.controlPolicy = controlPolicy;

  if (value.targetMin !== '' && value.targetMin !== null && value.targetMin !== undefined) {
    const targetMin = percentOrNull(value.targetMin);
    if (targetMin !== base.targetMin) out.targetMin = targetMin;
  }
  if (value.targetMax !== '' && value.targetMax !== null && value.targetMax !== undefined) {
    const targetMax = percentOrNull(value.targetMax);
    if (targetMax !== base.targetMax) out.targetMax = targetMax;
  }

  if (Array.isArray(value.desiredStates)) {
    const desiredStates = stringList(value.desiredStates, 8, 60);
    if (desiredStates.length && !sameList(desiredStates, base.desiredStates)) out.desiredStates = desiredStates;
  }
  if (Array.isArray(value.avoidStates)) {
    const avoidStates = stringList(value.avoidStates, 8, 60);
    if (avoidStates.length && !sameList(avoidStates, base.avoidStates)) out.avoidStates = avoidStates;
  }

  for (const key of [
    'protectRetreat', 'avoidExpansion', 'allowDailyOrders', 'autoGenerateOrders',
    'emergencyOverride', 'reactRetreat', 'reactConflict', 'reactExpansion',
    'reactInfluence', 'reactStates',
  ]) {
    if (typeof value[key] === 'boolean' && value[key] !== base[key]) out[key] = value[key];
  }

  if (validTime(value.customTick)) out.customTick = value.customTick;
  if (['strict', 'safety', 'carry'].includes(value.rolloverPolicy)) out.rolloverPolicy = value.rolloverPolicy;

  const notes = cleanText(value.notes, '', 1200);
  if (notes) out.notes = notes;
  if (value.favorite === true) out.favorite = true;

  return out;
}

function hasStoredSystemData(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.favorite || value.queueSelected || value.notes) return true;
  if (OVERRIDE_KEYS.some(key => Object.prototype.hasOwnProperty.call(value, key))) return true;
  return Boolean(value.updatedAt && value.updatedBy && (value.favorite || value.notes));
}

function normalizeManualSnapshot(value = {}, now, actor) {
  const factions = Array.isArray(value.factions) ? value.factions.slice(0, 12).map((row, index) => ({
    name: cleanText(row?.name, index === 0 ? MONGREL : '', 120),
    influence: percentOrNull(row?.influence),
    state: cleanText(row?.state, 'None', 120),
    pending: cleanText(row?.pending, '', 240),
    recovering: cleanText(row?.recovering, '', 240),
  })).filter(row => row.name) : [];
  return {
    updatedAt: now,
    updatedBy: actor,
    controller: cleanText(value.controller, '', 120),
    notes: cleanText(value.notes, '', 1200),
    factions,
  };
}

function normalizeDefaults(value = {}) {
  return {
    defaultTick: validTime(value.defaultTick) ? value.defaultTick : DEFAULTS.defaultTick,
    freshnessMode: 'tick-cycle',
    transitionMinutes: clampNumber(value.transitionMinutes, 0, 360, DEFAULTS.transitionMinutes),
    lateGraceHours: clampNumber(value.lateGraceHours, 0, 24, DEFAULTS.lateGraceHours),
    maxDailySystems: Math.round(clampNumber(value.maxDailySystems, 1, 12, DEFAULTS.maxDailySystems)),
    rolloverPolicy: ['strict', 'safety', 'carry'].includes(value.rolloverPolicy) ? value.rolloverPolicy : DEFAULTS.rolloverPolicy,
    requirePostTickForNormalOrders: value.requirePostTickForNormalOrders !== false,
    allowEmergencyWithStaleData: Boolean(value.allowEmergencyWithStaleData),
  };
}

function normalizeSystemDefaults(value = {}) {
  const legacyControl = value.desiredControl === 'maintain' ? 'maintain-existing' : value.desiredControl;
  return {
    priority: normalizePriorityOptional(value.priority || value.strategicPriority) || SYSTEM_DEFAULTS.priority,
    controlPolicy: normalizeControlPolicyOptional(value.controlPolicy || legacyControl) || SYSTEM_DEFAULTS.controlPolicy,
    targetMin: percentOrNull(value.targetMin),
    targetMax: percentOrNull(value.targetMax),
    desiredStates: stringList(value.desiredStates, 8, 60),
    avoidStates: stringList(value.avoidStates, 8, 60),
    protectRetreat: value.protectRetreat !== false,
    avoidExpansion: Boolean(value.avoidExpansion),
    allowDailyOrders: value.allowDailyOrders !== false,
    autoGenerateOrders: value.autoGenerateOrders !== false,
    emergencyOverride: value.emergencyOverride !== false,
    reactRetreat: value.reactRetreat !== false,
    reactConflict: value.reactConflict !== false,
    reactExpansion: value.reactExpansion !== false,
    reactInfluence: value.reactInfluence !== false,
    reactStates: value.reactStates !== false,
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

function normalizePriorityOptional(value) {
  return ['critical', 'high', 'normal', 'low'].includes(value) ? value : '';
}
function normalizeControlPolicyOptional(value) {
  return ['maintain-existing', 'gain', 'allow-transfer', 'none'].includes(value) ? value : '';
}
function sameList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
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
function percentOrNull(value) {
  const n = finiteOrNull(value);
  return n === null ? null : Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function stringList(value, maxItems, maxLength) {
  return Array.isArray(value) ? value.map(v => cleanText(v, '', maxLength)).filter(Boolean).slice(0, maxItems) : [];
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
