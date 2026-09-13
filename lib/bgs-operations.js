const STRATEGY_KV_KEY = 'bgs-strategy-v1';

export const MEMBER_ACCESS = new Set(['member', 'officer', 'site_admin']);
export const MANAGER_ACCESS = new Set(['officer', 'site_admin']);

// This seed is server-side only. It is never shipped as a public data file.
// On first authenticated use it is copied into the existing DAILY_ORDERS KV
// namespace under a separate key so future strategy data remains off the public site.
const DEFAULT_STRATEGY = {
  version: 1,
  updatedAt: '2026-09-13T16:30:00Z',
  updatedBy: 'Initial secure migration',
  prioritySystems: [
    'Diaba',
    'Miwae',
    'Col 285 Sector FA-W b16-6',
    'NGC 2546 Sector UZ-G d10-16',
    'NGC 2546 Sector XG-T b46-1',
    'Col 285 Sector OC-L c8-10',
  ],
  systems: [
    {
      name: 'Diaba',
      priority: true,
      watch: true,
      targetMin: 50,
      targetMax: 65,
      objective: 'Maintain Mongrel control between 50–65% influence.',
      watchNote: 'Influence above the preferred operating band should be reduced gradually while preserving control.',
    },
    {
      name: 'Miwae',
      priority: true,
      targetMin: 50,
      targetMax: 65,
      objective: 'Maintain Mongrel control between 50–65% influence.',
    },
    {
      name: 'Col 285 Sector FA-W b16-6',
      priority: true,
      targetMin: 50,
      targetMax: 65,
      objective: 'Maintain Mongrel control between 50–65% influence.',
    },
    {
      name: 'NGC 2546 Sector UZ-G d10-16',
      priority: true,
      watch: true,
      targetMin: 40,
      targetMax: 55,
      desiredStates: ['Boom', 'Civil Liberty'],
      objective: 'Maintain Mongrel control in the 40–55% band while working toward Boom + Civil Liberty.',
      watchNote: 'Preserve control while managing influence and desired economic/security states.',
    },
    {
      name: 'NGC 2546 Sector XG-T b46-1',
      priority: true,
      watch: true,
      targetMin: 50,
      targetMax: 65,
      objective: 'Maintain Mongrel control between 50–65% influence.',
      watchNote: 'Influence above the preferred operating band should be reduced gradually while preserving control.',
    },
    {
      name: 'Col 285 Sector OC-L c8-10',
      priority: true,
      watch: true,
      targetMin: 50,
      targetMax: 65,
      objective: 'Maintain Mongrel control between 50–65% influence.',
      watchNote: 'Influence above the preferred operating band should be reduced gradually while preserving control.',
    },
  ],
};

const MEMBER_PLAYBOOK = {
  title: 'Member BGS Operational Playbook',
  note: 'Starting workloads are per CMDR, per system, per tick. They are practical calibration targets—not hard caps and not guaranteed influence percentages. Mix levers and reassess after the tick instead of grinding one bucket indefinitely.',
  benchmarks: [
    { activity: 'Mission influence rewards', small: '~15 INF', medium: '~25 INF', large: '~50 INF', measure: 'Mission reward INF pips' },
    { activity: 'Bounty vouchers', small: '~10M Cr', medium: '~20M Cr', large: '~30M Cr', measure: 'Voucher value redeemed for the intended faction' },
    { activity: 'Exploration data', small: '~5M Cr', medium: '~10M Cr', large: '~15M Cr', measure: 'Data value sold at an asset owned by the intended faction' },
    { activity: 'Profitable trade', small: '~10M Cr profit', medium: '~20M Cr profit', large: '~30M Cr profit', measure: 'Profit at a market owned by the intended faction' },
  ],
  recipes: [
    {
      id: 'raise',
      title: 'Raise a faction',
      steps: [
        'Confirm the beneficiary is influence-unlocked and not already at a threshold you are trying to avoid.',
        'Choose two or more positive levers when practical: mission INF, profitable trade, exploration data, and/or bounty vouchers.',
        'Use the benchmark table as a starting workload, then stop and let the tick measure the result.',
        'Avoid accidental support for competing factions in the same system while the push is underway.',
      ],
    },
    {
      id: 'lower',
      title: 'Lower a faction',
      steps: [
        'If the objective is simply “Faction A down,” support several other influence-unlocked factions rather than only one rival.',
        'Add direct negative actions against the target only when the operation calls for them and the consequences are understood.',
        'Conflict-locked factions do not participate normally in influence redistribution; account for them before estimating movement.',
        'Stop near the desired band instead of overshooting, then recalibrate after the tick.',
      ],
    },
    {
      id: 'avoid-expansion',
      title: 'Avoid an unwanted Expansion',
      steps: [
        'Stop positive work for the high faction early enough to preserve a safety margin below the community-observed Expansion region.',
        'Support selected minority factions to pull share away efficiently.',
        'Do not wait until the faction is sitting directly on the observed threshold before correcting it.',
        'Recheck pending states after each tick; once Expansion is pending, influence correction may be too late to cancel the state.',
      ],
    },
    {
      id: 'save-retreat',
      title: 'Save a faction from Retreat',
      steps: [
        'Confirm the faction is actually in or approaching Retreat and identify the critical late-cycle check.',
        'Push it decisively above the observed ~2.5% danger line—do not aim for a rounding-edge rescue.',
        'Mix positive levers and avoid all accidental negative actions against the faction.',
        'Keep pressure on until the critical tick has passed and the faction is clearly safe.',
      ],
    },
    {
      id: 'force-retreat',
      title: 'Force a Retreat',
      steps: [
        'Confirm the target is non-native and that system faction count/state conditions allow Retreat to start.',
        'Drive the target below the observed ~2.5% region and prevent accidental support.',
        'Support the other influence-unlocked factions so they absorb the available share; use direct negatives only where appropriate.',
        'Maintain the target comfortably below the line through the critical late-cycle check.',
      ],
    },
    {
      id: 'war',
      title: 'Win War / Civil War',
      steps: [
        'Win Conflict Zone objectives for the supported faction.',
        'Redeem Combat Bonds and complete relevant war-valid combat missions/objectives.',
        'Do not substitute ordinary bounty hunting for CZ work—Bounty Vouchers are not Combat Bonds.',
        'Track the daily conflict score. Conflicts are best-of-seven and can end early once the trailing side cannot force a draw.',
      ],
    },
    {
      id: 'election',
      title: 'Win an Election',
      steps: [
        'Prioritize valid non-combat missions for the supported faction.',
        'Add profitable trade, exploration data, and other election-valid economic support where useful.',
        'Combat is not the primary election lever.',
        'Track the daily conflict score and stop once the day/series objective is secure enough for the opposition risk.',
      ],
    },
  ],
};

export function hasMemberAccess(session) {
  return Boolean(session && MEMBER_ACCESS.has(session.access));
}

export async function readBgsStrategy(env) {
  if (env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.get === 'function') {
    try {
      const stored = await env.DAILY_ORDERS.get(STRATEGY_KV_KEY, { type: 'json' });
      if (stored && typeof stored === 'object') return normalizeStrategy(stored);
    } catch (error) {
      console.error('Could not read private BGS strategy', error);
    }
  }

  const seed = normalizeStrategy(DEFAULT_STRATEGY);
  if (env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.put === 'function') {
    try {
      await env.DAILY_ORDERS.put(STRATEGY_KV_KEY, JSON.stringify(seed));
    } catch (error) {
      console.error('Could not seed private BGS strategy', error);
    }
  }
  return seed;
}

export async function buildMissionControlData(request, env, session) {
  if (!hasMemberAccess(session)) return null;
  const [live, strategy] = await Promise.all([
    fetchStaticJson(request, '/data/live-bgs.json'),
    readBgsStrategy(env),
  ]);

  const systems = mergeSystems(live, strategy);
  const active = systems.filter(system => system.present === true && !system.formerPresence);
  const former = systems.filter(system => system.present === false || system.formerPresence === true);
  const awaiting = systems.filter(system => system.present === null || system.present === undefined);
  const controlled = active.filter(system => system.controlled === true);
  const attention = active.filter(system => system.attention === true);

  return {
    ok: true,
    viewer: {
      displayName: session.displayName || session.username || 'Mongrel Member',
      access: session.access,
    },
    canManage: MANAGER_ACCESS.has(session.access),
    meta: {
      faction: live?.faction || 'Regiment of Imperial Mongrels',
      source: live?.source || 'EliteHub Vault / EDDN',
      refreshInterval: live?.refreshInterval || 'Every 2 hours',
      generatedAt: live?.generatedAt || null,
      sourceCount: Number(live?.vaultPresenceRows || live?.activePresenceSystems || active.length || 0),
      presenceCount: active.length,
      formerPresenceCount: former.length,
      strategyAwaitingCount: awaiting.length,
      controlledCount: controlled.length,
      priorityCount: active.filter(system => system.priority).length,
      attentionCount: attention.length,
      strategyUpdatedAt: strategy.updatedAt || null,
      strategyUpdatedBy: strategy.updatedBy || null,
      syncErrors: Array.isArray(live?.errors) ? live.errors.slice(0, 8) : [],
    },
    systems,
    playbook: MEMBER_PLAYBOOK,
    strategy: MANAGER_ACCESS.has(session.access) ? strategy : undefined,
  };
}

export async function writeBgsStrategy(env, value, updatedBy = 'Mongrel Officer') {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') {
    throw new Error('strategy_storage_not_configured');
  }
  const strategy = normalizeStrategy({
    ...value,
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
  strategy.prioritySystems = strategy.systems.filter(row => row.priority).map(row => row.name);
  await env.DAILY_ORDERS.put(STRATEGY_KV_KEY, JSON.stringify(strategy));
  return strategy;
}

export function normalizeBgsStrategy(value) {
  return normalizeStrategy(value);
}

export function getMemberBgsPlaybook() {
  return MEMBER_PLAYBOOK;
}

export function selectMissionControlForAssistant(payload, query = '') {
  if (!payload) return null;
  const q = String(query || '').toLowerCase();
  const systems = Array.isArray(payload.systems) ? payload.systems : [];

  let selected = systems.filter(system => {
    const name = String(system.name || '').toLowerCase();
    return name && q.includes(name);
  });

  if (!selected.length && /priority|focus|watch|attention|problem|risk|today|briefing|our systems|mongrel systems/.test(q)) {
    selected = systems.filter(system => system.priority || system.watch || system.attention).slice(0, 30);
  }

  if (!selected.length && /all systems|how many systems|presence|territory|footprint/.test(q)) {
    selected = systems.slice(0, 20);
  }

  return {
    meta: payload.meta,
    systems: selected.map(compactSystem),
  };
}

function compactSystem(system) {
  return {
    name: system.name,
    influence: system.influence,
    controlled: system.controlled,
    control: system.control,
    state: system.state,
    pendingStates: system.pendingStates,
    recoveringStates: system.recoveringStates,
    priority: system.priority,
    watch: system.watch,
    targetMin: system.targetMin,
    targetMax: system.targetMax,
    desiredStates: system.desiredStates,
    objective: system.objective,
    alerts: system.alerts,
    present: system.present,
    sourceUpdated: system.sourceUpdated,
    fetchedAt: system.fetchedAt,
  };
}

function normalizeStrategy(value) {
  const systems = Array.isArray(value?.systems) ? value.systems : [];
  const prioritySystems = Array.isArray(value?.prioritySystems) ? value.prioritySystems : [];
  return {
    version: Number(value?.version || 1),
    updatedAt: value?.updatedAt || null,
    updatedBy: value?.updatedBy || null,
    prioritySystems: prioritySystems.map(String),
    systems: systems
      .filter(row => row && row.name)
      .map(row => ({
        name: String(row.name),
        priority: Boolean(row.priority || prioritySystems.includes(row.name)),
        watch: Boolean(row.watch),
        targetMin: finiteOrNull(row.targetMin),
        targetMax: finiteOrNull(row.targetMax),
        desiredStates: Array.isArray(row.desiredStates) ? row.desiredStates.map(String) : [],
        objective: row.objective ? String(row.objective) : '',
        watchNote: row.watchNote ? String(row.watchNote) : '',
        alerts: Array.isArray(row.alerts) ? row.alerts.map(String) : [],
        note: row.note ? String(row.note) : '',
        region: row.region ? String(row.region) : '',
      })),
  };
}

function mergeSystems(live, strategy) {
  const liveRows = Array.isArray(live?.systems) ? live.systems : [];
  const strategyByName = new Map(strategy.systems.map(row => [normalizeName(row.name), row]));
  const priorityNames = new Set(strategy.prioritySystems.map(normalizeName));
  const merged = [];
  const seen = new Set();

  for (const observed of liveRows) {
    if (!observed?.name) continue;
    const key = normalizeName(observed.name);
    const policy = strategyByName.get(key) || {};
    const row = deriveSystem({ ...observed, present: observed.present !== false && !observed.formerPresence, ...policy, name: observed.name }, priorityNames.has(key));
    merged.push(row);
    seen.add(key);
  }

  // Keep a strategy-tracked system visible even if the upstream feed temporarily
  // misses it. It will be clearly marked as awaiting/last-known data.
  for (const policy of strategy.systems) {
    const key = normalizeName(policy.name);
    if (seen.has(key)) continue;
    merged.push(deriveSystem({
      name: policy.name,
      present: null,
      live: false,
      stale: true,
      ...policy,
    }, priorityNames.has(key)));
  }

  return merged.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function deriveSystem(system, priorityFromList) {
  const influence = finiteOrNull(system.influence);
  const targetMin = finiteOrNull(system.targetMin);
  const targetMax = finiteOrNull(system.targetMax);
  const stateWords = [system.state, ...(system.activeStates || []), ...(system.pendingStates || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const priority = Boolean(system.priority || priorityFromList);
  const watch = Boolean(system.watch);
  const conflict = /\bwar\b|civil war|election/.test(stateWords);
  const expansionRisk = /expansion/.test(stateWords) || (influence !== null && influence >= 70);
  const retreatRisk = /retreat/.test(stateWords) || (influence !== null && influence <= 5);
  const belowTarget = influence !== null && targetMin !== null && influence < targetMin;
  const aboveTarget = influence !== null && targetMax !== null && influence > targetMax;

  const alerts = Array.isArray(system.alerts) ? [...system.alerts] : [];
  if (belowTarget) alerts.push(`Below target band (${targetMin}–${targetMax}%)`);
  if (aboveTarget) alerts.push(`Above target band (${targetMin}–${targetMax}%)`);
  if (conflict) alerts.push('Conflict active/pending');
  if (expansionRisk && !alerts.some(item => /expansion/i.test(item))) alerts.push('Expansion watch');
  if (retreatRisk && !alerts.some(item => /retreat/i.test(item))) alerts.push('Retreat watch');

  return {
    ...system,
    influence,
    targetMin,
    targetMax,
    priority,
    watch,
    conflict,
    expansionRisk,
    retreatRisk,
    belowTarget,
    aboveTarget,
    attention: Boolean(watch || belowTarget || aboveTarget || conflict || expansionRisk || retreatRisk || system.stale),
    alerts: [...new Set(alerts.filter(Boolean))],
  };
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchStaticJson(request, path) {
  try {
    const url = new URL(path, request.url);
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Could not load ${path}`, error);
    return null;
  }
}
