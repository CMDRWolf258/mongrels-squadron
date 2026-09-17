import { json, readSession } from '../../../lib/auth.js';

const CONTROL_KV_KEY = 'wolf-bgs-control-v1';
const MONGREL = 'Regiment of Imperial Mongrels';

const DEFAULTS = {
  defaultTick: '19:00',
  freshnessHours: 8,
  transitionMinutes: 90,
  lateGraceHours: 3,
  maxDailySystems: 6,
  rolloverPolicy: 'safety',
  requirePostTickForNormalOrders: true,
  allowEmergencyWithStaleData: false,
};

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const [live, control] = await Promise.all([
    fetchLive(request),
    readControl(env),
  ]);

  return json(buildPayload(live, control, auth.session), { headers: privateHeaders() });
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

  const action = cleanText(body?.action, '', 40);
  const now = new Date().toISOString();
  const actor = auth.session.displayName || auth.session.username || 'CMDR Wolf258';
  const control = await readControl(env);

  if (action === 'save-global') {
    control.defaults = normalizeDefaults(body.defaults);
    control.globalUpdatedAt = now;
    control.globalUpdatedBy = actor;
  } else if (action === 'save-system') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    control.systemSettings[name] = normalizeSystemSettings(body.settings);
    control.systemSettings[name].updatedAt = now;
    control.systemSettings[name].updatedBy = actor;
  } else if (action === 'submit-status') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    control.manualSnapshots[name] = normalizeManualSnapshot(body.snapshot, now, actor);
  } else {
    return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
  }

  control.version = 1;
  await env.DAILY_ORDERS.put(CONTROL_KV_KEY, JSON.stringify(control));

  const live = await fetchLive(request);
  return json(buildPayload(live, control, auth.session), { headers: privateHeaders() });
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    return { response: json({ ok: false, error: 'authentication_required' }, { status: 401, headers: privateHeaders() }) };
  }
  if (session.access !== 'site_admin') {
    return { response: json({ ok: false, error: 'site_admin_required' }, { status: 403, headers: privateHeaders() }) };
  }
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

async function fetchLive(request) {
  try {
    const url = new URL('/data/live-bgs.json', request.url);
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cf: { cacheTtl: 0 } });
    if (!response.ok) throw new Error(`live-bgs ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Wolf BGS Control could not read live BGS snapshot', error);
    return { systems: [], errors: ['Live BGS snapshot unavailable'], source: 'EliteHub Vault / EDDN' };
  }
}

async function readControl(env) {
  const empty = {
    version: 1,
    defaults: { ...DEFAULTS },
    globalUpdatedAt: null,
    globalUpdatedBy: null,
    systemSettings: {},
    manualSnapshots: {},
  };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(CONTROL_KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    return {
      version: 1,
      defaults: normalizeDefaults(stored.defaults),
      globalUpdatedAt: stored.globalUpdatedAt || null,
      globalUpdatedBy: stored.globalUpdatedBy || null,
      systemSettings: normalizeSettingsMap(stored.systemSettings),
      manualSnapshots: normalizeSnapshotMap(stored.manualSnapshots),
    };
  } catch (error) {
    console.error('Could not read Wolf BGS Control state', error);
    return empty;
  }
}

function buildPayload(live, control, session) {
  const rows = Array.isArray(live?.systems) ? live.systems : [];
  const systems = rows
    .filter(row => row && row.present !== false && row.formerPresence !== true && row.name)
    .map(row => buildSystem(row, control))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sourceAges = systems.map(s => ageHours(s.sourceUpdated)).filter(Number.isFinite);
  return {
    ok: true,
    viewer: { displayName: session.displayName || session.username || 'CMDR Wolf258', access: session.access },
    meta: {
      source: live?.source || 'EliteHub Vault / EDDN',
      generatedAt: live?.generatedAt || null,
      refreshInterval: live?.refreshInterval || 'Every 2 hours',
      presenceCount: systems.length,
      controlledCount: systems.filter(s => s.controlled).length,
      staleCount: systems.filter(s => dataCondition(s, control.defaults) === 'stale').length,
      attentionCount: systems.filter(s => s.retreatRisk || s.conflict || dataCondition(s, control.defaults) === 'stale').length,
      newestSourceAgeHours: sourceAges.length ? Math.min(...sourceAges) : null,
      sourceBoardCoverage: 'mongrel-presence-only',
      sourceBoardNote: 'The automated source currently supplies the Mongrel presence row and system metadata. Full faction boards can be entered manually in this prototype until full-board ingestion is added.',
    },
    defaults: control.defaults,
    globalUpdatedAt: control.globalUpdatedAt,
    globalUpdatedBy: control.globalUpdatedBy,
    systems,
  };
}

function buildSystem(row, control) {
  const name = String(row.name);
  const settings = control.systemSettings[name] || defaultSystemSettings();
  const manual = control.manualSnapshots[name] || null;
  const sourceFaction = {
    name: MONGREL,
    influence: finiteOrNull(row.influence),
    state: cleanText(row.state, 'None', 80),
    pending: Array.isArray(row.pendingStates) ? row.pendingStates.map(String).join(', ') : '',
    recovering: Array.isArray(row.recoveringStates) ? row.recoveringStates.map(String).join(', ') : '',
    source: 'third-party',
  };
  const factions = mergeFactionBoard(sourceFaction, manual?.factions || [], row.sourceUpdated, manual?.updatedAt);
  const newest = newestTimestamp(row.sourceUpdated, manual?.updatedAt);
  const conflictWords = [row.state, ...(row.activeStates || []), ...(row.pendingStates || [])].join(' ').toLowerCase();

  return {
    name,
    controlled: Boolean(row.controlled),
    control: row.control || '',
    influence: finiteOrNull(row.influence),
    state: row.state || 'None',
    pendingStates: Array.isArray(row.pendingStates) ? row.pendingStates : [],
    recoveringStates: Array.isArray(row.recoveringStates) ? row.recoveringStates : [],
    security: row.security || '',
    population: row.population || null,
    sourceUpdated: row.sourceUpdated || null,
    sourceFetchedAt: row.fetchedAt || liveFallbackTimestamp(row),
    manualUpdatedAt: manual?.updatedAt || null,
    manualUpdatedBy: manual?.updatedBy || null,
    activeSnapshotTime: newest,
    activeSnapshotSource: newest === manual?.updatedAt ? 'manual' : 'third-party',
    boardComplete: Boolean(manual?.factions?.length),
    factions,
    manualController: manual?.controller || '',
    manualNotes: manual?.notes || '',
    settings,
    conflict: /\bwar\b|civil war|election/.test(conflictWords),
    retreatRisk: finiteOrNull(row.influence) !== null && Number(row.influence) < 5,
    dataCondition: dataCondition({ sourceUpdated: row.sourceUpdated, manualUpdatedAt: manual?.updatedAt }, control.defaults),
  };
}

function mergeFactionBoard(sourceFaction, manualFactions, sourceUpdated, manualUpdated) {
  const map = new Map();
  for (const faction of manualFactions) map.set(norm(faction.name), { ...faction, source: 'manual' });
  const sourceIsNewer = compareTime(sourceUpdated, manualUpdated) >= 0;
  const key = norm(sourceFaction.name);
  if (!map.has(key) || sourceIsNewer) map.set(key, sourceFaction);
  return [...map.values()].filter(f => f.name).sort((a, b) => {
    if (norm(a.name) === norm(MONGREL)) return -1;
    if (norm(b.name) === norm(MONGREL)) return 1;
    return a.name.localeCompare(b.name);
  });
}

function normalizeDefaults(value = {}) {
  return {
    defaultTick: validTime(value.defaultTick) ? value.defaultTick : DEFAULTS.defaultTick,
    freshnessHours: clampNumber(value.freshnessHours, 1, 72, DEFAULTS.freshnessHours),
    transitionMinutes: clampNumber(value.transitionMinutes, 0, 360, DEFAULTS.transitionMinutes),
    lateGraceHours: clampNumber(value.lateGraceHours, 0, 24, DEFAULTS.lateGraceHours),
    maxDailySystems: Math.round(clampNumber(value.maxDailySystems, 1, 12, DEFAULTS.maxDailySystems)),
    rolloverPolicy: ['strict', 'safety', 'carry'].includes(value.rolloverPolicy) ? value.rolloverPolicy : DEFAULTS.rolloverPolicy,
    requirePostTickForNormalOrders: value.requirePostTickForNormalOrders !== false,
    allowEmergencyWithStaleData: Boolean(value.allowEmergencyWithStaleData),
  };
}

function defaultSystemSettings() {
  return {
    strategicPriority: 'normal',
    targetMin: null,
    targetMax: null,
    desiredControl: 'maintain',
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
    customTick: '',
    freshnessHours: null,
    rolloverPolicy: '',
    notes: '',
    updatedAt: null,
    updatedBy: null,
  };
}

function normalizeSystemSettings(value = {}) {
  const base = defaultSystemSettings();
  const priority = ['critical', 'high', 'normal', 'low'].includes(value.strategicPriority) ? value.strategicPriority : base.strategicPriority;
  return {
    strategicPriority: priority,
    targetMin: percentOrNull(value.targetMin),
    targetMax: percentOrNull(value.targetMax),
    desiredControl: ['maintain', 'gain', 'allow-transfer', 'none'].includes(value.desiredControl) ? value.desiredControl : base.desiredControl,
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
    customTick: validTime(value.customTick) ? value.customTick : '',
    freshnessHours: value.freshnessHours === '' || value.freshnessHours === null || value.freshnessHours === undefined ? null : clampNumber(value.freshnessHours, 1, 72, null),
    rolloverPolicy: ['', 'strict', 'safety', 'carry'].includes(value.rolloverPolicy) ? value.rolloverPolicy : '',
    notes: cleanText(value.notes, '', 1200),
  };
}

function normalizeManualSnapshot(value = {}, now, actor) {
  const factions = Array.isArray(value.factions) ? value.factions.slice(0, 12).map((row, index) => ({
    name: cleanText(row?.name, index === 0 ? MONGREL : '', 120),
    influence: percentOrNull(row?.influence),
    state: cleanText(row?.state, 'None', 80),
    pending: cleanText(row?.pending, '', 120),
    recovering: cleanText(row?.recovering, '', 120),
  })).filter(row => row.name) : [];
  return {
    updatedAt: now,
    updatedBy: actor,
    controller: cleanText(value.controller, '', 120),
    notes: cleanText(value.notes, '', 1200),
    factions,
  };
}

function normalizeSettingsMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [name, settings] of Object.entries(value)) {
    const key = cleanText(name, '', 140);
    if (!key) continue;
    out[key] = { ...normalizeSystemSettings(settings), updatedAt: settings?.updatedAt || null, updatedBy: settings?.updatedBy || null };
  }
  return out;
}

function normalizeSnapshotMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [name, snapshot] of Object.entries(value)) {
    const key = cleanText(name, '', 140);
    if (!key || !snapshot) continue;
    out[key] = {
      updatedAt: snapshot.updatedAt || null,
      updatedBy: cleanText(snapshot.updatedBy, '', 120),
      controller: cleanText(snapshot.controller, '', 120),
      notes: cleanText(snapshot.notes, '', 1200),
      factions: Array.isArray(snapshot.factions) ? snapshot.factions.slice(0, 12).map(row => ({
        name: cleanText(row?.name, '', 120),
        influence: percentOrNull(row?.influence),
        state: cleanText(row?.state, 'None', 80),
        pending: cleanText(row?.pending, '', 120),
        recovering: cleanText(row?.recovering, '', 120),
      })).filter(row => row.name) : [],
    };
  }
  return out;
}

function dataCondition(system, defaults) {
  const newest = newestTimestamp(system.sourceUpdated, system.manualUpdatedAt);
  const hours = ageHours(newest);
  if (hours === null || hours > Number(defaults?.freshnessHours || DEFAULTS.freshnessHours)) return 'stale';
  return 'current';
}

function newestTimestamp(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return compareTime(a, b) >= 0 ? a : b;
}

function compareTime(a, b) {
  const at = Date.parse(a || '') || 0;
  const bt = Date.parse(b || '') || 0;
  return at - bt;
}

function ageHours(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) && time > 0 ? Math.max(0, (Date.now() - time) / 3600000) : null;
}

function liveFallbackTimestamp(row) { return row?.lastSeen || row?.firstSeen || null; }
function norm(value) { return String(value || '').trim().toLowerCase(); }
function finiteOrNull(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function percentOrNull(value) { const n = finiteOrNull(value); return n === null ? null : Math.max(0, Math.min(100, Math.round(n * 100) / 100)); }
function clampNumber(value, min, max, fallback) { const n = finiteOrNull(value); return n === null ? fallback : Math.max(min, Math.min(max, n)); }
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')); }
function stringList(value, maxItems, maxLength) { return Array.isArray(value) ? value.map(v => cleanText(v, '', maxLength)).filter(Boolean).slice(0, maxItems) : []; }
function cleanText(value, fallback, maxLength) { if (typeof value !== 'string') return fallback; const text = value.trim(); return text ? text.slice(0, maxLength) : fallback; }

function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  };
}
