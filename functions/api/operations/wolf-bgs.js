import { json, readSession } from '../../../lib/auth.js';

const CONTROL_KV_KEY = 'wolf-bgs-control-v1';
const MONGREL = 'Regiment of Imperial Mongrels';
const ALERT_FAMILIES = ['retreat','conflict','bust','civil-unrest'];
const CONFLICT_STATES = new Set(['war','civil war','election']);

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

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const [live, boards, control] = await Promise.all([
    fetchLive(request),
    fetchBoards(request),
    readControl(env),
  ]);
  const payload = buildPayload(live, boards, control, auth.session);
  const alertsChanged = refreshAlertEpisodes(control, payload.systems);
  attachAlertData(payload, control);
  if (alertsChanged && env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.put === 'function') {
    await env.DAILY_ORDERS.put(CONTROL_KV_KEY, JSON.stringify(control));
  }
  return json(payload, { headers: privateHeaders() });
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
  } else if (action === 'save-system-defaults') {
    control.systemDefaults = normalizeSystemDefaults(body.systemDefaults);
    control.systemDefaultsUpdatedAt = now;
    control.systemDefaultsUpdatedBy = actor;
  } else if (action === 'save-system') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const existing = control.systemSettings[name] || {};
    control.systemSettings[name] = {
      ...normalizeSystemSettings(body.settings, control.systemDefaults),
      favorite: body?.settings?.favorite === undefined ? Boolean(existing.favorite) : Boolean(body.settings.favorite),
      queueSelected: body?.settings?.queueSelected === undefined ? Boolean(existing.queueSelected) : Boolean(body.settings.queueSelected),
      updatedAt: now,
      updatedBy: actor,
    };
  } else if (action === 'toggle-favorite') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const existing = control.systemSettings[name] || {};
    control.systemSettings[name] = {
      ...normalizeSystemSettings(existing, control.systemDefaults),
      favorite: Boolean(body.favorite),
      updatedAt: now,
      updatedBy: actor,
    };
  } else if (action === 'toggle-queue-selector') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    const existing = control.systemSettings[name] || {};
    control.systemSettings[name] = {
      ...normalizeSystemSettings(existing, control.systemDefaults),
      favorite: Boolean(existing.favorite),
      queueSelected: Boolean(body.queueSelected),
      updatedAt: now,
      updatedBy: actor,
    };
  } else if (action === 'ack-alerts') {
    control.alertEpisodes = control.alertEpisodes && typeof control.alertEpisodes === 'object' ? control.alertEpisodes : {};
    for (const episode of Object.values(control.alertEpisodes)) {
      if (episode && !episode.removedAt && !episode.reviewedAt) episode.reviewedAt = now;
    }
  } else if (action === 'remove-alert') {
    const name = cleanText(body?.system, '', 140);
    const family = cleanText(body?.family, '', 40);
    if (!name || !ALERT_FAMILIES.includes(family)) {
      return json({ ok: false, error: 'alert_required' }, { status: 400, headers: privateHeaders() });
    }
    const key = alertKey(name, family);
    if (control.alertEpisodes?.[key]) control.alertEpisodes[key].removedAt = now;
  } else if (action === 'submit-status') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    control.manualSnapshots[name] = normalizeManualSnapshot(body.snapshot, now, actor);
  } else {
    return json({ ok: false, error: 'unsupported_action' }, { status: 400, headers: privateHeaders() });
  }

  control.version = 2;
  const [live, boards] = await Promise.all([fetchLive(request), fetchBoards(request)]);
  const payload = buildPayload(live, boards, control, auth.session);
  refreshAlertEpisodes(control, payload.systems, now);
  attachAlertData(payload, control);
  await env.DAILY_ORDERS.put(CONTROL_KV_KEY, JSON.stringify(control));
  return json(payload, { headers: privateHeaders() });
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

async function fetchBoards(request) {
  try {
    const url = new URL('/data/live-bgs-boards.json', request.url);
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cf: { cacheTtl: 0 } });
    if (!response.ok) throw new Error(`live-bgs-boards ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Wolf BGS Control could not read full BGS boards', error);
    return { systems: {}, syncOk: false, successfulSystems: 0, requestedSystems: 0, errors: ['Full BGS board snapshot unavailable'] };
  }
}

async function readControl(env) {
  const empty = {
    version: 2,
    defaults: { ...DEFAULTS },
    globalUpdatedAt: null,
    globalUpdatedBy: null,
    systemDefaults: { ...SYSTEM_DEFAULTS },
    systemDefaultsUpdatedAt: null,
    systemDefaultsUpdatedBy: null,
    systemSettings: {},
    manualSnapshots: {},
    alertEpisodes: {},
  };
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(CONTROL_KV_KEY, { type: 'json' });
    if (!stored || typeof stored !== 'object') return empty;
    const normalizedSystemDefaults = normalizeSystemDefaults(stored.systemDefaults);
    return {
      version: 2,
      defaults: normalizeDefaults(stored.defaults),
      globalUpdatedAt: stored.globalUpdatedAt || null,
      globalUpdatedBy: stored.globalUpdatedBy || null,
      systemDefaults: normalizedSystemDefaults,
      systemDefaultsUpdatedAt: stored.systemDefaultsUpdatedAt || null,
      systemDefaultsUpdatedBy: stored.systemDefaultsUpdatedBy || null,
      systemSettings: normalizeSettingsMap(stored.systemSettings, normalizedSystemDefaults),
      manualSnapshots: normalizeSnapshotMap(stored.manualSnapshots),
      alertEpisodes: normalizeAlertEpisodes(stored.alertEpisodes),
    };
  } catch (error) {
    console.error('Could not read Wolf BGS Control state', error);
    return empty;
  }
}

function buildPayload(live, boards, control, session) {
  const rows = Array.isArray(live?.systems) ? live.systems : [];
  const boardsBySystem = boardMap(boards?.systems);
  const systems = rows
    .filter(row => row && row.present !== false && row.formerPresence !== true && row.name)
    .map(row => buildSystem(row, boardsBySystem.get(norm(row.name)) || null, control))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sourceAges = systems.map(s => ageHours(s.sourceUpdated)).filter(Number.isFinite);
  const boardSuccessful = Number(boards?.successfulSystems || 0);
  const boardRequested = Number(boards?.requestedSystems || systems.length || 0);
  const fullBoardCount = systems.filter(system => system.externalBoardComplete).length;
  const boardReady = fullBoardCount > 0;
  const boardNote = boardReady
    ? `Full EliteHub faction boards available for ${fullBoardCount}/${systems.length} active Mongrel systems. ${boards?.syncOk ? 'Latest board refresh completed successfully.' : 'Any failed refreshes retain the last good board when available.'}`
    : 'Full faction-board ingestion is configured and awaiting its first successful refresh; the Mongrel presence feed remains available in the meantime.';

  return {
    ok: true,
    viewer: { displayName: session.displayName || session.username || 'CMDR Wolf258', access: session.access },
    meta: {
      source: live?.source || 'EliteHub Vault / EDDN',
      generatedAt: live?.generatedAt || null,
      refreshInterval: live?.refreshInterval || 'Every 2 hours',
      presenceCount: systems.length,
      controlledCount: systems.filter(s => s.controlled).length,
      favoriteCount: systems.filter(s => s.settings?.favorite).length,
      queueSelectorCount: systems.filter(s => s.settings?.queueSelected).length,
      staleCount: systems.filter(s => s.dataCondition === 'stale').length,
      attentionCount: systems.filter(s => s.retreatRisk || s.conflict || s.dataCondition === 'stale').length,
      newestSourceAgeHours: sourceAges.length ? Math.min(...sourceAges) : null,
      sourceBoardCoverage: fullBoardCount === systems.length && systems.length ? 'full-faction-boards' : (boardReady ? 'partial-full-boards' : 'mongrel-presence-only'),
      sourceBoardNote: boardNote,
      boardGeneratedAt: boards?.generatedAt || null,
      boardSyncOk: Boolean(boards?.syncOk),
      boardSuccessfulSystems: boardSuccessful,
      boardRequestedSystems: boardRequested,
    },
    defaults: control.defaults,
    globalUpdatedAt: control.globalUpdatedAt,
    globalUpdatedBy: control.globalUpdatedBy,
    systemDefaults: control.systemDefaults,
    systemDefaultsUpdatedAt: control.systemDefaultsUpdatedAt,
    systemDefaultsUpdatedBy: control.systemDefaultsUpdatedBy,
    systems,
  };
}

function buildSystem(row, externalBoard, control) {
  const name = String(row.name);
  const storedSettings = control.systemSettings[name] || null;
  const settings = resolveSystemSettings(control.systemDefaults, storedSettings);
  const manual = control.manualSnapshots[name] || null;
  const sourceFallbackFaction = {
    name: MONGREL,
    influence: finiteOrNull(row.influence),
    state: prettyStateText(cleanText(row.state, 'None', 120)),
    pending: prettyStateList(row.pendingStates).join(', '),
    recovering: prettyStateList(row.recoveringStates).join(', '),
    activeStates: prettyStateList(row.activeStates),
    pendingStates: prettyStateList(row.pendingStates),
    recoveringStates: prettyStateList(row.recoveringStates),
    updatedAt: row.sourceUpdated || null,
    source: 'External source',
  };
  const externalFactions = normalizeExternalFactions(externalBoard?.factions);
  const externalUpdated = newestTimestamp(row.sourceUpdated, externalBoard?.updatedAt);
  const manualIsNewer = Boolean(manual?.updatedAt) && compareTime(manual.updatedAt, externalUpdated) > 0;

  let factions;
  if (manualIsNewer && manual?.factions?.length) {
    factions = manual.factions.map(faction => ({ ...faction, source: 'Manual' }));
  } else if (externalFactions.length) {
    factions = externalFactions;
  } else {
    factions = mergeFactionBoard(sourceFallbackFaction, manual?.factions || [], row.sourceUpdated, manual?.updatedAt);
  }

  factions = sortFactions(factions);
  const mongrel = factions.find(faction => norm(faction.name) === norm(MONGREL)) || sourceFallbackFaction;
  const influence = finiteOrNull(mongrel.influence) ?? finiteOrNull(row.influence);
  const state = prettyStateText(mongrel.state || row.state || 'None');
  const activeStates = factionStateArray(mongrel, 'activeStates', 'state');
  const pendingStates = factionStateArray(mongrel, 'pendingStates', 'pending');
  const recoveringStates = factionStateArray(mongrel, 'recoveringStates', 'recovering');
  const activeController = manualIsNewer && manual?.controller ? manual.controller : (row.control || '');
  const newest = manualIsNewer ? manual.updatedAt : externalUpdated;
  const conflictWords = factions.map(faction => `${faction.state || ''} ${faction.pending || ''}`).join(' ').toLowerCase();
  const freshnessLimit = settings.freshnessHours ?? control.defaults.freshnessHours;
  const boardComplete = manualIsNewer ? Boolean(manual?.factions?.length) : Boolean(externalFactions.length);

  return {
    name,
    controlled: norm(activeController) === norm(MONGREL),
    control: activeController,
    influence,
    state,
    activeStates,
    pendingStates,
    recoveringStates,
    security: row.security || '',
    population: row.population || null,
    sourceUpdated: externalUpdated || null,
    sourceFetchedAt: externalBoard?.fetchedAt || row.fetchedAt || liveFallbackTimestamp(row),
    externalBoardUpdatedAt: externalBoard?.updatedAt || null,
    externalBoardComplete: Boolean(externalFactions.length),
    externalBoardOk: externalBoard ? externalBoard.ok !== false : false,
    factionCount: factions.length,
    manualUpdatedAt: manual?.updatedAt || null,
    manualUpdatedBy: manual?.updatedBy || null,
    activeSnapshotTime: newest,
    activeSnapshotSource: manualIsNewer ? 'manual' : 'external',
    boardComplete,
    factions,
    manualController: manual?.controller || '',
    manualNotes: manual?.notes || '',
    settings,
    hasCustomSettings: Boolean(storedSettings?.updatedAt),
    conflict: /\bwar\b|civil war|election/.test(conflictWords),
    retreatPending: pendingStates.some(item => norm(item) === 'retreat'),
    retreatRisk: influence !== null && Number(influence) < 5,
    dataCondition: dataCondition({ sourceUpdated: externalUpdated, manualUpdatedAt: manual?.updatedAt }, freshnessLimit),
  };
}

function resolveSystemSettings(systemDefaults, stored) {
  const base = normalizeSystemDefaults(systemDefaults);
  if (!stored) {
    return {
      ...base,
      favorite: false,
      queueSelected: false,
      customTick: '',
      freshnessHours: null,
      rolloverPolicy: '',
      notes: '',
      updatedAt: null,
      updatedBy: null,
    };
  }
  return {
    ...base,
    ...normalizeSystemSettings(stored, base),
    favorite: Boolean(stored.favorite),
    queueSelected: Boolean(stored.queueSelected),
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
}


function normalizeAlertEpisodes(value) {
  if (!value || typeof value !== 'object') return {};
  const out = {};
  for (const [key, episode] of Object.entries(value)) {
    if (!episode || typeof episode !== 'object') continue;
    const system = cleanText(episode.system, '', 140);
    const family = cleanText(episode.family, '', 40);
    if (!system || !ALERT_FAMILIES.includes(family)) continue;
    out[key] = {
      system,
      family,
      detail: cleanText(episode.detail, '', 80),
      phase: ['pending','active'].includes(episode.phase) ? episode.phase : 'active',
      firstSeenAt: episode.firstSeenAt || null,
      lastSeenAt: episode.lastSeenAt || null,
      reviewedAt: episode.reviewedAt || null,
      removedAt: episode.removedAt || null,
    };
  }
  return out;
}

function alertKey(system, family) {
  return `${system}::${family}`;
}

function alertCondition(system, family) {
  const active = Array.isArray(system?.activeStates) ? system.activeStates : [];
  const pending = Array.isArray(system?.pendingStates) ? system.pendingStates : [];
  const find = (items, predicate) => items.find(item => predicate(norm(item))) || '';
  if (family === 'retreat') {
    const detail = find(pending, value => value === 'retreat');
    return detail ? { detail, phase:'pending' } : null;
  }
  if (family === 'conflict') {
    const pendingDetail = find(pending, value => CONFLICT_STATES.has(value));
    if (pendingDetail) return { detail:pendingDetail, phase:'pending' };
    const activeDetail = find(active, value => CONFLICT_STATES.has(value));
    return activeDetail ? { detail:activeDetail, phase:'active' } : null;
  }
  if (family === 'bust') {
    const pendingDetail = find(pending, value => value === 'bust');
    if (pendingDetail) return { detail:pendingDetail, phase:'pending' };
    const activeDetail = find(active, value => value === 'bust');
    return activeDetail ? { detail:activeDetail, phase:'active' } : null;
  }
  if (family === 'civil-unrest') {
    const pendingDetail = find(pending, value => value === 'civil unrest');
    if (pendingDetail) return { detail:pendingDetail, phase:'pending' };
    const activeDetail = find(active, value => value === 'civil unrest');
    return activeDetail ? { detail:activeDetail, phase:'active' } : null;
  }
  return null;
}

function refreshAlertEpisodes(control, systems, timestamp = new Date().toISOString()) {
  if (!control.alertEpisodes || typeof control.alertEpisodes !== 'object') control.alertEpisodes = {};
  const current = new Map();
  for (const system of systems || []) {
    for (const family of ALERT_FAMILIES) {
      const condition = alertCondition(system, family);
      if (condition) current.set(alertKey(system.name, family), { system:system.name, family, ...condition });
    }
  }

  let changed = false;
  for (const key of Object.keys(control.alertEpisodes)) {
    if (!current.has(key)) {
      delete control.alertEpisodes[key];
      changed = true;
    }
  }

  for (const [key, condition] of current) {
    const existing = control.alertEpisodes[key];
    const sameEvent = existing && norm(existing.detail) === norm(condition.detail);
    if (!sameEvent) {
      control.alertEpisodes[key] = {
        system:condition.system,
        family:condition.family,
        detail:condition.detail,
        phase:condition.phase,
        firstSeenAt:timestamp,
        lastSeenAt:timestamp,
        reviewedAt:null,
        removedAt:null,
      };
      changed = true;
      continue;
    }
    if (existing.phase !== condition.phase || existing.detail !== condition.detail || existing.lastSeenAt !== timestamp) {
      existing.phase = condition.phase;
      existing.detail = condition.detail;
      existing.lastSeenAt = timestamp;
      changed = true;
    }
  }
  return changed;
}

function attachAlertData(payload, control) {
  const priority = { retreat:0, conflict:1, 'civil-unrest':2, bust:3 };
  const visible = Object.values(control.alertEpisodes || {})
    .filter(episode => !episode.removedAt)
    .sort((a,b) => Number(Boolean(a.reviewedAt)) - Number(Boolean(b.reviewedAt)) || (priority[a.family] ?? 9) - (priority[b.family] ?? 9) || String(a.system).localeCompare(String(b.system)));
  payload.alertMeta = {
    listedCount: visible.length,
    unreviewedCount: visible.filter(episode => !episode.reviewedAt).length,
  };
  payload.alerts = visible.map(episode => ({
    system:episode.system,
    family:episode.family,
    detail:episode.detail,
    phase:episode.phase,
    firstSeenAt:episode.firstSeenAt,
    reviewedAt:episode.reviewedAt || null,
  }));
}

function boardMap(value) {
  const map = new Map();
  if (Array.isArray(value)) {
    for (const board of value) if (board?.name) map.set(norm(board.name), board);
    return map;
  }
  if (!value || typeof value !== 'object') return map;
  for (const [name, board] of Object.entries(value)) {
    if (board && typeof board === 'object') map.set(norm(board.name || name), board);
  }
  return map;
}

function normalizeExternalFactions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map(row => {
    const activeStates = prettyStateList(row?.activeStates);
    const pendingStates = prettyStateList(row?.pendingStates);
    const recoveringStates = prettyStateList(row?.recoveringStates);
    return {
      name: cleanText(row?.name, '', 120),
      influence: percentOrNull(row?.influence),
      state: activeStates.length ? activeStates.join(', ') : prettyStateText(cleanText(row?.state, 'None', 120)),
      pending: pendingStates.join(', '),
      recovering: recoveringStates.join(', '),
      activeStates,
      pendingStates,
      recoveringStates,
      updatedAt: row?.updatedAt || null,
      source: 'External source',
    };
  }).filter(row => row.name);
}

function mergeFactionBoard(sourceFaction, manualFactions, sourceUpdated, manualUpdated) {
  const map = new Map();
  for (const faction of manualFactions) map.set(norm(faction.name), { ...faction, source: 'Manual' });
  const sourceIsNewer = compareTime(sourceUpdated, manualUpdated) >= 0;
  const key = norm(sourceFaction.name);
  if (!map.has(key) || sourceIsNewer) map.set(key, sourceFaction);
  return sortFactions([...map.values()].filter(f => f.name));
}

function sortFactions(factions) {
  return [...factions].filter(faction => faction?.name).sort((a, b) => {
    if (norm(a.name) === norm(MONGREL)) return -1;
    if (norm(b.name) === norm(MONGREL)) return 1;
    return String(a.name).localeCompare(String(b.name));
  });
}

function factionStateArray(faction, arrayKey, textKey) {
  if (Array.isArray(faction?.[arrayKey])) return prettyStateList(faction[arrayKey]);
  const value = cleanText(faction?.[textKey], '', 240);
  if (!value || norm(value) === 'none') return [];
  return value.split(',').map(part => prettyStateText(part.trim())).filter(Boolean).filter(state => norm(state) !== 'none');
}

function prettyStateList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => prettyStateText(String(item || '').trim())).filter(Boolean).filter(state => norm(state) !== 'none');
}

function prettyStateText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text.replaceAll("'", '"'));
      if (Array.isArray(parsed)) return parsed.map(prettyStateText).filter(Boolean).join(', ') || 'None';
    } catch {}
  }
  return text.replace(/([a-z])([A-Z])/g, '$1 $2');
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

function normalizeSystemDefaults(value = {}) {
  const legacyControl = value.desiredControl === 'maintain' ? 'maintain-existing' : value.desiredControl;
  return {
    priority: normalizePriority(value.priority || value.strategicPriority),
    controlPolicy: normalizeControlPolicy(value.controlPolicy || legacyControl),
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

function normalizeSystemSettings(value = {}, baseDefaults = SYSTEM_DEFAULTS) {
  const base = normalizeSystemDefaults(baseDefaults);
  const legacyControl = value.desiredControl === 'maintain' ? 'maintain-existing' : value.desiredControl;
  return {
    priority: normalizePriority(value.priority || value.strategicPriority || base.priority),
    controlPolicy: normalizeControlPolicy(value.controlPolicy || legacyControl || base.controlPolicy),
    targetMin: value.targetMin === '' || value.targetMin === undefined ? base.targetMin : percentOrNull(value.targetMin),
    targetMax: value.targetMax === '' || value.targetMax === undefined ? base.targetMax : percentOrNull(value.targetMax),
    desiredStates: Array.isArray(value.desiredStates) ? stringList(value.desiredStates, 8, 60) : [...base.desiredStates],
    avoidStates: Array.isArray(value.avoidStates) ? stringList(value.avoidStates, 8, 60) : [...base.avoidStates],
    protectRetreat: value.protectRetreat === undefined ? base.protectRetreat : value.protectRetreat !== false,
    avoidExpansion: value.avoidExpansion === undefined ? base.avoidExpansion : Boolean(value.avoidExpansion),
    allowDailyOrders: value.allowDailyOrders === undefined ? base.allowDailyOrders : value.allowDailyOrders !== false,
    autoGenerateOrders: value.autoGenerateOrders === undefined ? base.autoGenerateOrders : value.autoGenerateOrders !== false,
    emergencyOverride: value.emergencyOverride === undefined ? base.emergencyOverride : value.emergencyOverride !== false,
    reactRetreat: value.reactRetreat === undefined ? base.reactRetreat : value.reactRetreat !== false,
    reactConflict: value.reactConflict === undefined ? base.reactConflict : value.reactConflict !== false,
    reactExpansion: value.reactExpansion === undefined ? base.reactExpansion : value.reactExpansion !== false,
    reactInfluence: value.reactInfluence === undefined ? base.reactInfluence : value.reactInfluence !== false,
    reactStates: value.reactStates === undefined ? base.reactStates : value.reactStates !== false,
    customTick: validTime(value.customTick) ? value.customTick : '',
    freshnessHours: value.freshnessHours === '' || value.freshnessHours === null || value.freshnessHours === undefined ? null : clampNumber(value.freshnessHours, 1, 72, null),
    rolloverPolicy: ['', 'strict', 'safety', 'carry'].includes(value.rolloverPolicy) ? value.rolloverPolicy : '',
    notes: cleanText(value.notes, '', 1200),
    favorite: Boolean(value.favorite),
    queueSelected: Boolean(value.queueSelected),
  };
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

function normalizeSettingsMap(value, systemDefaults) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [name, settings] of Object.entries(value)) {
    const key = cleanText(name, '', 140);
    if (!key) continue;
    out[key] = {
      ...normalizeSystemSettings(settings, systemDefaults),
      favorite: Boolean(settings?.favorite),
      queueSelected: Boolean(settings?.queueSelected),
      updatedAt: settings?.updatedAt || null,
      updatedBy: settings?.updatedBy || null,
    };
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
        state: cleanText(row?.state, 'None', 120),
        pending: cleanText(row?.pending, '', 240),
        recovering: cleanText(row?.recovering, '', 240),
      })).filter(row => row.name) : [],
    };
  }
  return out;
}

function dataCondition(system, freshnessHours) {
  const newest = newestTimestamp(system.sourceUpdated, system.manualUpdatedAt);
  const hours = ageHours(newest);
  if (hours === null || hours > Number(freshnessHours || DEFAULTS.freshnessHours)) return 'stale';
  return 'current';
}

function normalizePriority(value) {
  return ['critical', 'high', 'normal', 'low'].includes(value) ? value : SYSTEM_DEFAULTS.priority;
}

function normalizeControlPolicy(value) {
  return ['maintain-existing', 'gain', 'allow-transfer', 'none'].includes(value) ? value : SYSTEM_DEFAULTS.controlPolicy;
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
function finiteOrNull(value) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
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
