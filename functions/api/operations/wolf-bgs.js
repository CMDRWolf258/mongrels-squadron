import { json, readSession } from '../../../lib/auth.js';

const CONTROL_KV_KEY = 'wolf-bgs-control-v1';
const SCOUT_SNAPSHOTS_KEY = 'wolf-bgs-scout-snapshots-v1';
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

  const [live, boards, control, scoutState] = await Promise.all([
    fetchLive(request),
    fetchBoards(request),
    readControl(env),
    readScoutSnapshots(env),
  ]);
  const payload = buildPayload(live, boards, control, auth.session, scoutState);
  const alertsChanged = refreshAlertEpisodes(control, payload.systems, new Date().toISOString(), scoutState.conflictHistory);
  attachConflictTracking(payload, control);
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
  } else if (action === 'set-conflict-day') {
    const name = cleanText(body?.system, '', 140);
    const day = Math.round(Number(body?.day));
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    if (!Number.isFinite(day) || day < 1 || day > 7) {
      return json({ ok: false, error: 'conflict_day_invalid' }, { status: 400, headers: privateHeaders() });
    }
    control.conflictDayOverrides = control.conflictDayOverrides && typeof control.conflictDayOverrides === 'object' ? control.conflictDayOverrides : {};
    control.conflictDayOverrides[name] = { day, setAt: now, setBy: actor };
  } else if (action === 'clear-conflict-day') {
    const name = cleanText(body?.system, '', 140);
    if (!name) return json({ ok: false, error: 'system_required' }, { status: 400, headers: privateHeaders() });
    if (control.conflictDayOverrides) delete control.conflictDayOverrides[name];
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
  const [live, boards, scoutState] = await Promise.all([fetchLive(request), fetchBoards(request), readScoutSnapshots(env)]);
  const payload = buildPayload(live, boards, control, auth.session, scoutState);
  refreshAlertEpisodes(control, payload.systems, now, scoutState.conflictHistory);
  attachConflictTracking(payload, control, now);
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

async function readScoutSnapshots(env) {
  const empty = {version:1,systems:{},conflictHistory:{}};
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return empty;
  try {
    const stored = await env.DAILY_ORDERS.get(SCOUT_SNAPSHOTS_KEY, {type:'json'});
    return stored && typeof stored === 'object'
      ? {
          version:1,
          systems:stored.systems && typeof stored.systems === 'object' ? stored.systems : {},
          conflictHistory:stored.conflictHistory && typeof stored.conflictHistory === 'object' ? stored.conflictHistory : {},
        }
      : empty;
  } catch (error) {
    console.error('Could not read Mongrel Scout snapshots', error);
    return empty;
  }
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
    conflictDayOverrides: {},
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
      conflictDayOverrides: normalizeConflictDayOverrides(stored.conflictDayOverrides),
    };
  } catch (error) {
    console.error('Could not read Wolf BGS Control state', error);
    return empty;
  }
}

function buildPayload(live, boards, control, session, scoutState = {systems:{}}) {
  const sourceRows = Array.isArray(live?.systems) ? live.systems : [];
  const boardsBySystem = boardMap(boards?.systems);
  const scoutsBySystem = boardMap(scoutState?.systems);
  const rowsBySystem = new Map();
  const allExternalRows = new Map();

  for (const row of sourceRows) {
    if (!row?.name) continue;
    const key = norm(row.name);
    allExternalRows.set(key, row);
    if (row.present !== false && row.formerPresence !== true) rowsBySystem.set(key, row);
  }
  for (const scout of scoutsBySystem.values()) {
    if (!scout?.system || !scoutHasMongrels(scout)) continue;
    const key = norm(scout.system);
    if (rowsBySystem.has(key)) continue;
    const external = allExternalRows.get(key);
    const externalSaysGone = external && (external.present === false || external.formerPresence === true);
    const externalPresenceClock = external ? newestTimestamp(external.sourceUpdated, external.lastSeen || external.fetchedAt) : null;
    if (externalSaysGone && compareTime(externalPresenceClock, scout.updatedAt) >= 0) continue;
    rowsBySystem.set(key, scoutPresenceRow(scout));
  }

  const systems = [...rowsBySystem.values()]
    .map(row => buildSystem(row, boardsBySystem.get(norm(row.name)) || null, control, scoutsBySystem.get(norm(row.name)) || null))
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
      scoutSnapshotCount: systems.filter(system => system.scoutUpdatedAt).length,
      scoutActiveCount: systems.filter(system => system.activeSnapshotSource === 'scout').length,
      newestScoutAt: systems.map(system => system.scoutUpdatedAt).filter(Boolean).reduce((latest,value) => newestTimestamp(latest,value), null),
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

function normalizeConflictScore(value, stale = false) {
  if (!value || typeof value !== 'object') return null;
  const factionWonDays = finiteOrNull(value.factionWonDays);
  const opponentWonDays = finiteOrNull(value.opponentWonDays);
  if (factionWonDays === null || opponentWonDays === null) return null;
  return {
    factionWonDays: Math.max(0, Math.round(factionWonDays)),
    opponentWonDays: Math.max(0, Math.round(opponentWonDays)),
    opponentFaction: cleanText(value.opponentFaction, '', 120),
    type: prettyStateText(cleanText(value.type, '', 60)),
    status: prettyStateText(cleanText(value.status, '', 60)),
    factionStake: cleanText(value.factionStake, '', 160),
    opponentStake: cleanText(value.opponentStake, '', 160),
    updatedAt: value.updatedAt || null,
    stale: Boolean(stale),
  };
}

function buildSystem(row, externalBoard, control, scout = null) {
  const name = String(row.name);
  const storedSettings = control.systemSettings[name] || null;
  const settings = resolveSystemSettings(control.systemDefaults, storedSettings);
  const manual = control.manualSnapshots[name] || null;
  const rowExternalUpdated = row.sourceKind === 'scout' ? null : normalizeSourceTime(row.sourceUpdated);
  const externalBoardUpdated = normalizeSourceTime(externalBoard?.updatedAt);
  const scoutUpdated = normalizeSourceTime(scout?.updatedAt);
  const manualUpdated = normalizeSourceTime(manual?.updatedAt);
  const sourceFallbackFaction = {
    name: MONGREL,
    influence: finiteOrNull(row.influence),
    state: prettyStateText(cleanText(row.state, 'None', 120)),
    pending: prettyStateList(row.pendingStates).join(', '),
    recovering: prettyStateList(row.recoveringStates).join(', '),
    activeStates: prettyStateList(row.activeStates),
    pendingStates: prettyStateList(row.pendingStates),
    recoveringStates: prettyStateList(row.recoveringStates),
    updatedAt: rowExternalUpdated,
    source: 'External source',
  };
  const externalFactions = normalizeExternalFactions(externalBoard?.factions);
  const scoutFactions = normalizeScoutFactions(scout?.factions, scoutUpdated);
  const externalUpdated = newestTimestamp(rowExternalUpdated, externalBoardUpdated);
  const externalFactionTimes=externalFactions.map(faction=>normalizeSourceTime(faction?.updatedAt)).filter(Boolean);
  const externalBoardFullyTimed=Boolean(externalFactions.length) && externalFactionTimes.length===externalFactions.length;
  const externalBoardCompleteThrough=externalBoardFullyTimed ? oldestTimestamp(externalFactionTimes) : null;
  const externalBoardNewest=externalFactionTimes.reduce((latest,value)=>newestTimestamp(latest,value), null) || externalUpdated;
  const scoutPreferred=Boolean(scoutUpdated&&scoutFactions.length)
    && (!externalBoardCompleteThrough || compareTime(scoutUpdated,externalBoardCompleteThrough)>=0);
  const baseSourceUpdated=scoutPreferred
    ? scoutUpdated
    : (externalBoardCompleteThrough || externalUpdated || scoutUpdated);
  const manualIsNewer=Boolean(manualUpdated&&manual?.factions?.length)
    && compareTime(manualUpdated,baseSourceUpdated)>0;
  const activeSource=manualIsNewer
    ? 'manual'
    : (scoutPreferred ? 'scout' : (externalFactions.length ? 'external' : (scoutFactions.length ? 'scout' : 'fallback')));

  let factions;
  if(activeSource==='manual'){
    factions = manual.factions.map(faction => ({ ...faction, source: 'Manual', updatedAt:manualUpdated }));
  }else if(activeSource==='scout'){
    factions = scoutFactions;
  }else if(activeSource==='external'){
    factions = externalFactions;
  }else{
    factions = mergeFactionBoard(sourceFallbackFaction, manual?.factions || [], row.sourceUpdated, manual?.updatedAt);
  }

  factions = sortFactions(factions);
  const mongrel = factions.find(faction => norm(faction.name) === norm(MONGREL)) || sourceFallbackFaction;
  const influence = finiteOrNull(mongrel.influence) ?? finiteOrNull(row.influence);
  const state = prettyStateText(mongrel.state || row.state || 'None');
  const activeStates = factionStateArray(mongrel, 'activeStates', 'state');
  const pendingStates = factionStateArray(mongrel, 'pendingStates', 'pending');
  const recoveringStates = factionStateArray(mongrel, 'recoveringStates', 'recovering');
  const scoutController = cleanText(scout?.systemFaction?.name, '', 120);
  const activeController = activeSource==='manual' && manual?.controller
    ? manual.controller
    : (activeSource==='scout' && scoutController ? scoutController : (row.control || scoutController || ''));
  const newest = activeSource==='manual'
    ? manualUpdated
    : (activeSource==='scout' ? scoutUpdated : (externalBoardCompleteThrough || externalUpdated || scoutUpdated));
  const factionTimes=factions.map(faction=>normalizeSourceTime(faction?.updatedAt)).filter(Boolean);
  const boardOldestUpdatedAt=oldestTimestamp(factionTimes) || newest;
  const boardNewestUpdatedAt=factionTimes.reduce((latest,value)=>newestTimestamp(latest,value), null) || newest;
  const boardAgeSpreadHours=timestampSpreadHours(boardOldestUpdatedAt,boardNewestUpdatedAt);
  const boardMixedAge=boardAgeSpreadHours !== null && boardAgeSpreadHours >= 1;
  const conflictWords = factions.map(faction => `${faction.state || ''} ${faction.pending || ''}`).join(' ').toLowerCase();
  const freshnessLimit = settings.freshnessHours ?? control.defaults.freshnessHours;
  const boardComplete = activeSource==='manual'
    ? Boolean(manual?.factions?.length)
    : (activeSource==='scout' ? Boolean(scoutFactions.length) : Boolean(externalFactions.length));
  const mongrelConflict = activeStates.some(item => ['war','civil war','election'].includes(norm(item)));
  const externalConflictScore = normalizeConflictScore(externalBoard?.conflict, externalBoard?.conflictStale);
  const directScoutConflictScore = scoutConflictScore(scout);
  const conflictScore = mongrelConflict ? newestConflictScore(externalConflictScore, directScoutConflictScore) : null;

  return {
    name,
    controlled: norm(activeController) === norm(MONGREL),
    control: activeController,
    influence,
    state,
    activeStates,
    pendingStates,
    recoveringStates,
    security: activeSource==='scout' && scout?.security ? scout.security : (row.security || ''),
    population: activeSource==='scout' && scout?.population !== null && scout?.population !== undefined ? scout.population : (row.population || null),
    sourceUpdated: activeSource==='manual' ? manualUpdated : (activeSource==='scout' ? scoutUpdated : (externalBoardCompleteThrough || boardOldestUpdatedAt || externalUpdated || null)),
    externalSourceUpdated:externalUpdated || null,
    sourceFetchedAt: activeSource==='scout'
      ? (normalizeSourceTime(scout?.receivedAt) || scoutUpdated)
      : (normalizeSourceTime(externalBoard?.fetchedAt) || normalizeSourceTime(row.fetchedAt) || liveFallbackTimestamp(row)),
    externalBoardUpdatedAt: externalBoardUpdated,
    externalBoardOldestAt: externalBoardCompleteThrough || (externalFactions.length ? oldestTimestamp(externalFactionTimes) : rowExternalUpdated),
    externalBoardNewestAt: externalBoardNewest,
    externalBoardComplete: Boolean(externalFactions.length),
    scoutBoardComplete: Boolean(scoutFactions.length),
    scoutUpdatedAt:scoutUpdated,
    scoutReceivedAt:scout?.receivedAt || null,
    scoutLabel:cleanText(scout?.scoutLabel, '', 80),
    externalBoardOk: externalBoard ? externalBoard.ok !== false : false,
    factionCount: factions.length,
    manualUpdatedAt: manualUpdated,
    manualUpdatedBy: manual?.updatedBy || null,
    activeSnapshotTime: activeSource==='manual'
      ? manualUpdated
      : (activeSource==='scout' ? scoutUpdated : (externalBoardCompleteThrough || boardOldestUpdatedAt || externalUpdated)),
    activeSnapshotNewestTime: activeSource==='manual'
      ? manualUpdated
      : (activeSource==='scout' ? scoutUpdated : (externalBoardNewest || boardNewestUpdatedAt)),
    activeSnapshotSource: activeSource,
    boardAgeSpreadHours,
    boardMixedAge,
    boardComplete,
    factions,
    manualController: manual?.controller || '',
    manualNotes: manual?.notes || '',
    settings,
    hasCustomSettings: Boolean(storedSettings?.updatedAt),
    conflict: /\bwar\b|civil war|election/.test(conflictWords),
    mongrelConflict,
    conflictScore,
    retreatPending: pendingStates.some(item => norm(item) === 'retreat'),
    retreatRisk: influence !== null && Number(influence) < 5,
    dataCondition: dataCondition({
      sourceUpdated: activeSource==='manual'
        ? manualUpdated
        : (activeSource==='scout' ? scoutUpdated : (externalBoardCompleteThrough || boardOldestUpdatedAt || externalUpdated)),
      manualUpdatedAt:null,
    }, freshnessLimit),
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
      firstPhase: ['pending','active'].includes(episode.firstPhase) ? episode.firstPhase : (['pending','active'].includes(episode.phase) ? episode.phase : 'active'),
      pendingSeenAt: episode.pendingSeenAt || null,
      expectedActiveAt: episode.expectedActiveAt || null,
      activeSeenAt: episode.activeSeenAt || null,
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

function refreshAlertEpisodes(control, systems, timestamp = new Date().toISOString(), scoutConflictHistory = {}) {
  if (!control.alertEpisodes || typeof control.alertEpisodes !== 'object') control.alertEpisodes = {};
  const current = new Map();
  for (const system of systems || []) {
    for (const family of ALERT_FAMILIES) {
      const condition = alertCondition(system, family);
      if (condition) current.set(alertKey(system.name, family), {
        system:system.name,
        family,
        tick:system.settings?.customTick || control.defaults?.defaultTick || DEFAULTS.defaultTick,
        ...condition,
      });
    }
  }

  let changed = false;
  for (const key of Object.keys(control.alertEpisodes)) {
    if (!current.has(key)) {
      const episode = control.alertEpisodes[key];
      if (episode?.family === 'conflict' && control.conflictDayOverrides?.[episode.system]) {
        delete control.conflictDayOverrides[episode.system];
      }
      delete control.alertEpisodes[key];
      changed = true;
    }
  }

  for (const [key, condition] of current) {
    const existing = control.alertEpisodes[key];
    const sameEvent = existing && norm(existing.detail) === norm(condition.detail);
    if (!sameEvent) {
      if (condition.family === 'conflict' && control.conflictDayOverrides?.[condition.system]) {
        delete control.conflictDayOverrides[condition.system];
      }
      const scoutHistory = condition.family === 'conflict' ? scoutConflictHistory?.[condition.system] : null;
      const matchingScoutHistory = scoutHistory && norm(scoutHistory.detail) === norm(condition.detail) ? scoutHistory : null;
      const pendingSeenAt = condition.family === 'conflict'
        ? (condition.phase === 'pending' ? (matchingScoutHistory?.pendingSeenAt || timestamp) : (matchingScoutHistory?.pendingSeenAt || null))
        : null;
      control.alertEpisodes[key] = {
        system:condition.system,
        family:condition.family,
        detail:condition.detail,
        phase:condition.phase,
        firstPhase:pendingSeenAt ? 'pending' : condition.phase,
        firstSeenAt:timestamp,
        lastSeenAt:timestamp,
        pendingSeenAt,
        expectedActiveAt:pendingSeenAt ? nextTickAfter(pendingSeenAt, condition.tick) : null,
        activeSeenAt:condition.family === 'conflict' && condition.phase === 'active' ? (matchingScoutHistory?.activeSeenAt || timestamp) : null,
        reviewedAt:null,
        removedAt:null,
      };
      changed = true;
      continue;
    }

    if (condition.family === 'conflict') {
      const scoutHistory = scoutConflictHistory?.[condition.system];
      const matchingScoutHistory = scoutHistory && norm(scoutHistory.detail) === norm(condition.detail) ? scoutHistory : null;
      if (!existing.pendingSeenAt && matchingScoutHistory?.pendingSeenAt) {
        existing.pendingSeenAt = matchingScoutHistory.pendingSeenAt;
        existing.expectedActiveAt = existing.expectedActiveAt || nextTickAfter(existing.pendingSeenAt, condition.tick);
        existing.firstPhase = 'pending';
        changed = true;
      } else if (condition.phase === 'pending' && !existing.pendingSeenAt) {
        existing.pendingSeenAt = existing.firstPhase === 'pending' ? (existing.firstSeenAt || timestamp) : timestamp;
        existing.expectedActiveAt = existing.expectedActiveAt || nextTickAfter(existing.pendingSeenAt, condition.tick);
        changed = true;
      }

      if (condition.phase === 'active' && !existing.activeSeenAt) {
        existing.activeSeenAt = matchingScoutHistory?.activeSeenAt || timestamp;
        changed = true;
      }
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

function normalizeConflictDayOverrides(value) {
  if (!value || typeof value !== 'object') return {};
  const out = {};
  for (const [system, item] of Object.entries(value)) {
    const name = cleanText(system, '', 140);
    const day = Math.round(Number(item?.day));
    if (!name || !Number.isFinite(day) || day < 1 || day > 7) continue;
    out[name] = {
      day,
      setAt:item?.setAt || null,
      setBy:cleanText(item?.setBy, '', 120),
    };
  }
  return out;
}

function tickParts(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour:19, minute:0 };
  const hour = Number(match[1]), minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return { hour:19, minute:0 };
  return { hour, minute };
}

function nextTickAfter(timestamp, tick) {
  const start = new Date(timestamp);
  if (!Number.isFinite(start.getTime())) return null;
  const { hour, minute } = tickParts(tick);
  let tickMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), hour, minute, 0, 0);
  if (tickMs <= start.getTime()) tickMs += 86400000;
  return new Date(tickMs).toISOString();
}

function ticksElapsedAfter(anchor, now, tick) {
  const start = new Date(anchor);
  const end = new Date(now);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0;
  const first = nextTickAfter(anchor, tick);
  if (!first) return 0;
  const firstMs = new Date(first).getTime();
  if (end.getTime() < firstMs) return 0;
  return 1 + Math.floor((end.getTime() - firstMs) / 86400000);
}

function conflictTimelineFor(system, control, nowIso) {
  const episode = control.alertEpisodes?.[alertKey(system.name, 'conflict')] || null;
  const override = control.conflictDayOverrides?.[system.name] || null;
  const tick = system.settings?.customTick || control.defaults?.defaultTick || DEFAULTS.defaultTick;
  const active = Boolean(system.mongrelConflict);
  const pending = (system.pendingStates || []).some(state => CONFLICT_STATES.has(norm(state)));
  const phase = override && (active || pending || episode) ? 'active' : (active ? 'active' : pending ? 'pending' : 'none');

  let day = null;
  let rawDay = null;
  let source = 'unknown';
  let anchoredAt = null;

  if (override && phase !== 'none') {
    rawDay = override.day + ticksElapsedAfter(override.setAt, nowIso, tick);
    day = Math.min(7, rawDay);
    source = 'manual';
    anchoredAt = override.setAt;
  } else if (phase === 'active' && episode?.pendingSeenAt && episode?.expectedActiveAt) {
    const start = new Date(episode.expectedActiveAt).getTime();
    const now = new Date(nowIso).getTime();
    rawDay = Math.max(1, Math.floor((now - start) / 86400000) + 1);
    day = Math.min(7, rawDay);
    source = 'inferred';
    anchoredAt = episode.expectedActiveAt;
  }

  return {
    phase,
    day,
    rawDay,
    source,
    tick,
    pendingSeenAt:episode?.pendingSeenAt || null,
    expectedActiveAt:episode?.expectedActiveAt || null,
    activeSeenAt:episode?.activeSeenAt || null,
    anchoredAt,
    manualDay:override?.day || null,
    manualSetAt:override?.setAt || null,
    manualSetBy:override?.setBy || null,
    minimumDays:4,
    maximumDays:7,
    minimumReached:day !== null ? day >= 4 : false,
    overdue:rawDay !== null ? rawDay > 7 : false,
  };
}

function attachConflictTracking(payload, control, nowIso = new Date().toISOString()) {
  for (const system of payload.systems || []) {
    system.conflictTimeline = conflictTimelineFor(system, control, nowIso);
  }
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

function normalizeScoutFactions(value, updatedAt = null) {
  if (!Array.isArray(value)) return [];
  const snapshotUpdatedAt=normalizeSourceTime(updatedAt);
  return value.slice(0,20).map(row => {
    const activeStates = prettyStateList(row?.activeStates);
    const pendingStates = prettyStateList(row?.pendingStates);
    const recoveringStates = prettyStateList(row?.recoveringStates);
    return {
      name:cleanText(row?.name, '', 120),
      influence:percentOrNull(row?.influence),
      state:activeStates.length ? activeStates.join(', ') : prettyStateText(cleanText(row?.state, 'None', 120)),
      pending:pendingStates.join(', '),
      recovering:recoveringStates.join(', '),
      activeStates,
      pendingStates,
      recoveringStates,
      updatedAt:snapshotUpdatedAt,
      source:'Mongrel Scout',
    };
  }).filter(row => row.name);
}

function scoutHasMongrels(snapshot) {
  return Array.isArray(snapshot?.factions) && snapshot.factions.some(row => norm(row?.name) === norm(MONGREL));
}

function scoutPresenceRow(snapshot) {
  const mongrel = (snapshot.factions || []).find(row => norm(row?.name) === norm(MONGREL)) || {};
  const activeStates = prettyStateList(mongrel.activeStates);
  const controller = cleanText(snapshot?.systemFaction?.name, '', 120);
  return {
    name:snapshot.system,
    influence:percentOrNull(mongrel.influence),
    controlled:norm(controller) === norm(MONGREL),
    control:controller,
    state:activeStates.length ? activeStates.join(', ') : prettyStateText(cleanText(mongrel.state, 'None', 120)),
    activeStates,
    pendingStates:prettyStateList(mongrel.pendingStates),
    recoveringStates:prettyStateList(mongrel.recoveringStates),
    security:cleanText(snapshot.security, '', 80),
    population:snapshot.population ?? null,
    sourceUpdated:snapshot.updatedAt || null,
    source:'Mongrel Scout / EDMC',
    sourceKind:'scout',
    fetchedAt:snapshot.receivedAt || snapshot.updatedAt || null,
    present:true,
    formerPresence:false,
    stale:false,
    ok:true,
  };
}

function scoutConflictScore(snapshot) {
  if (!Array.isArray(snapshot?.conflicts)) return null;
  for (const conflict of snapshot.conflicts) {
    const one = conflict?.faction1;
    const two = conflict?.faction2;
    const oneIsMongrel = norm(one?.name) === norm(MONGREL);
    const twoIsMongrel = norm(two?.name) === norm(MONGREL);
    if (!oneIsMongrel && !twoIsMongrel) continue;
    const ours = oneIsMongrel ? one : two;
    const theirs = oneIsMongrel ? two : one;
    return {
      factionWonDays:Math.max(0,Math.round(Number(ours?.wonDays) || 0)),
      opponentWonDays:Math.max(0,Math.round(Number(theirs?.wonDays) || 0)),
      opponentFaction:cleanText(theirs?.name, '', 120),
      type:prettyStateText(cleanText(conflict?.type, '', 60)),
      status:prettyStateText(cleanText(conflict?.status, '', 60)),
      factionStake:cleanText(ours?.stake, '', 160),
      opponentStake:cleanText(theirs?.stake, '', 160),
      updatedAt:snapshot.updatedAt || null,
      stale:false,
      source:'Mongrel Scout',
    };
  }
  return null;
}

function newestConflictScore(a,b) {
  if (!a) return b || null;
  if (!b) return a;
  return compareTime(b.updatedAt, a.updatedAt) >= 0 ? b : a;
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
      updatedAt: normalizeSourceTime(row?.updatedAt),
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

function oldestTimestamp(values) {
  let oldest=null;
  for(const value of Array.isArray(values)?values:[]){
    const normalized=normalizeSourceTime(value);
    if(!normalized)continue;
    if(!oldest||compareTime(normalized,oldest)<0)oldest=normalized;
  }
  return oldest;
}

function timestampSpreadHours(oldest,newest){
  const start=Date.parse(oldest||''),end=Date.parse(newest||'');
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return null;
  return Math.round(((end-start)/3600000)*100)/100;
}

function normalizeSourceTime(value) {
  if (!value) return null;
  let text=String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) text += 'Z';
  const time=Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
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
