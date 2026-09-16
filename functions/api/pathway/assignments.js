import { json, readSession } from '../../../lib/auth.js';
import { AX_ACTIVITY_ID, eligibleAxRoutes, getAxRoute } from '../../../lib/pathway-ax.js';
import { BGS_ACTIVITY_ID, eligibleBgsRoutes, getBgsRoute } from '../../../lib/pathway-bgs.js';
import { MINING_ACTIVITY_ID, eligibleMiningRoutes, getMiningRoute } from '../../../lib/pathway-mining.js';
import { TRADE_ACTIVITY_ID, eligibleTradeRoutes, getTradeRoute } from '../../../lib/pathway-trade.js';
import { CARRIER_LOGISTICS_ACTIVITY_ID, eligibleCarrierLogisticsRoutes, getCarrierLogisticsRoute } from '../../../lib/pathway-carrier-logistics.js';
import { ENGINEERING_ACTIVITY_ID, eligibleEngineeringRoutes, getEngineeringRoute } from '../../../lib/pathway-engineering.js';
import { EXPLORATION_ACTIVITY_ID, eligibleExplorationRoutes, getExplorationRoute } from '../../../lib/pathway-exploration.js';
import { EXOBIOLOGY_ACTIVITY_ID, eligibleExobiologyRoutes, getExobiologyRoute } from '../../../lib/pathway-exobiology.js';
import { PVE_ACTIVITY_ID, eligiblePveRoutes, getPveRoute } from '../../../lib/pathway-pve.js';
import { PVP_ACTIVITY_ID, eligiblePvpRoutes, getPvpRoute } from '../../../lib/pathway-pvp.js';
import { OPERATIONS_ACTIVITY_ID, eligibleOperationsRoutes, getOperationsRoute } from '../../../lib/pathway-operations.js';
import { engineeringPrepForTask } from '../../../lib/pathway-engineering-prep.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);
const PREFERENCES_PREFIX = 'pathway-preferences-v1:';
const PROGRESS_PREFIX = 'pathway-progress-v1:';
const TASK_STATUSES = new Set(['complete','known','skipped','pending']);
const TASK_TYPES = new Set(['learn','build','demonstrate','challenge','wing','mentor']);

const PROVIDERS = {
  [AX_ACTIVITY_ID]: {
    id:AX_ACTIVITY_ID,
    label:'Anti-Xeno',
    getRoute:getAxRoute,
    eligibleRoutes:eligibleAxRoutes,
    seedVersion:'ax-v2',
  },
  [BGS_ACTIVITY_ID]: {
    id:BGS_ACTIVITY_ID,
    label:'BGS',
    getRoute:getBgsRoute,
    eligibleRoutes:eligibleBgsRoutes,
    seedVersion:'bgs-v1',
  },
  [MINING_ACTIVITY_ID]: {
    id:MINING_ACTIVITY_ID,
    label:'Mining',
    getRoute:getMiningRoute,
    eligibleRoutes:eligibleMiningRoutes,
    seedVersion:'mining-v1',
  },
  [TRADE_ACTIVITY_ID]: {
    id:TRADE_ACTIVITY_ID,
    label:'Trade & Hauling',
    getRoute:getTradeRoute,
    eligibleRoutes:eligibleTradeRoutes,
    seedVersion:'trade-v2',
  },
  [CARRIER_LOGISTICS_ACTIVITY_ID]: {
    id:CARRIER_LOGISTICS_ACTIVITY_ID,
    label:'Carrier Logistics',
    getRoute:getCarrierLogisticsRoute,
    eligibleRoutes:eligibleCarrierLogisticsRoutes,
    seedVersion:'carrier-logistics-v1',
  },
  [ENGINEERING_ACTIVITY_ID]: {
    id:ENGINEERING_ACTIVITY_ID,
    label:'Engineering & Shipbuilding',
    getRoute:getEngineeringRoute,
    eligibleRoutes:eligibleEngineeringRoutes,
    seedVersion:'engineering-v1',
  },
  [EXPLORATION_ACTIVITY_ID]: {
    id:EXPLORATION_ACTIVITY_ID,
    label:'Exploration',
    getRoute:getExplorationRoute,
    eligibleRoutes:eligibleExplorationRoutes,
    seedVersion:'exploration-v1',
  },
  [EXOBIOLOGY_ACTIVITY_ID]: {
    id:EXOBIOLOGY_ACTIVITY_ID,
    label:'Exobiology',
    getRoute:getExobiologyRoute,
    eligibleRoutes:eligibleExobiologyRoutes,
    seedVersion:'exobiology-v1',
  },
  [PVE_ACTIVITY_ID]: {
    id:PVE_ACTIVITY_ID,
    label:'PvE Combat',
    getRoute:getPveRoute,
    eligibleRoutes:eligiblePveRoutes,
    seedVersion:'pve-v1',
  },
  [PVP_ACTIVITY_ID]: {
    id:PVP_ACTIVITY_ID,
    label:'PvP',
    getRoute:getPvpRoute,
    eligibleRoutes:eligiblePvpRoutes,
    seedVersion:'pvp-v1',
  },
  [OPERATIONS_ACTIVITY_ID]: {
    id:OPERATIONS_ACTIVITY_ID,
    label:'Operations',
    getRoute:getOperationsRoute,
    eligibleRoutes:eligibleOperationsRoutes,
    seedVersion:'operations-v1',
  },
};

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const storageError = requireStorage(env, false);
  if (storageError) return storageError;
  const activity = activityFromUrl(request.url);
  const provider = PROVIDERS[activity];
  if (!provider) return reply({ ok:false, error:'unsupported_activity' }, 400);
  const result = await buildState(env, auth.session, activity);
  return reply({ ok:true, ...result });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  const storageError = requireStorage(env, true);
  if (storageError) return storageError;

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  const activity = normalizeActivity(body?.activity || activityFromUrl(request.url));
  const provider = PROVIDERS[activity];
  if (!provider) return reply({ ok:false, error:'unsupported_activity' }, 400);

  const prefs = await readJson(env.PROJECTS, `${PREFERENCES_PREFIX}${auth.session.sub}`) || {};
  const selected = new Set([...(Array.isArray(prefs.interests) ? prefs.interests : []), ...(Array.isArray(prefs.improve) ? prefs.improve : [])]).has(activity);
  if (!selected) return reply({ ok:false, error:`${activity}_not_selected`, detail:`Add ${provider.label} to My Pathway before using its assignments.` }, 409);

  const experience = normalizeExperience(prefs?.experience?.[activity]);
  const eligible = provider.eligibleRoutes(experience);
  if (!eligible.length) return reply({ ok:false, error:'no_eligible_route' }, 409);
  const routeChoices = routeChoicesFor(activity, experience, eligible);
  const key = `${PROGRESS_PREFIX}${auth.session.sub}:${activity}`;
  const existing = await readJson(env.PROJECTS, key) || {};
  const progress = normalizeProgress(existing, auth.session.sub, provider);
  const currentRouteId = routeChoices.includes(progress.selectedRoute) ? progress.selectedRoute : chooseInitialRoute(auth.session.sub, experience, routeChoices, provider);
  const action = String(body?.action || '');

  if (action === 'set_task') {
    const route = provider.getRoute(currentRouteId);
    if (!route) return reply({ ok:false, error:'route_not_found' }, 404);
    const taskId = String(body?.taskId || '');
    if (!route.tasks.some(task => task.id === taskId)) return reply({ ok:false, error:'task_not_found' }, 404);
    const status = String(body?.status || 'pending');
    if (!TASK_STATUSES.has(status)) return reply({ ok:false, error:'invalid_task_status' }, 400);

    const next = ensureRouteState(progress, currentRouteId, provider);
    if (status === 'pending') delete next.routes[currentRouteId].taskStates[taskId];
    else next.routes[currentRouteId].taskStates[taskId] = status;
    next.selectedRoute = currentRouteId;
    next.updatedAt = new Date().toISOString();
    next.routes[currentRouteId].updatedAt = next.updatedAt;
    if (!next.routes[currentRouteId].startedAt) next.routes[currentRouteId].startedAt = next.updatedAt;
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true, ...(await buildState(env, auth.session, activity, next)) });
  }

  if (action === 'another_route') {
    let next = ensureRouteState(progress, currentRouteId, provider);
    const index = Math.max(0, routeChoices.indexOf(currentRouteId));
    const nextRouteId = routeChoices[(index + 1) % routeChoices.length];
    next.selectedRoute = nextRouteId;
    next.routeGeneration = Number(next.routeGeneration || 0) + 1;
    next.updatedAt = new Date().toISOString();
    next = ensureRouteState(next, nextRouteId, provider);
    next.selectedRoute = nextRouteId;
    next.updatedAt = new Date().toISOString();
    if (!next.routes[nextRouteId].startedAt) next.routes[nextRouteId].startedAt = next.updatedAt;
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true, routeChanged:true, ...(await buildState(env, auth.session, activity, next)) });
  }

  if (action === 'reset_route') {
    const next = ensureRouteState(progress, currentRouteId, provider);
    next.routes[currentRouteId] = { taskStates:{}, startedAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    next.selectedRoute = currentRouteId;
    next.updatedAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true, ...(await buildState(env, auth.session, activity, next)) });
  }

  return reply({ ok:false, error:'unsupported_action' }, 400);
}

async function buildState(env, session, activity, suppliedProgress = null) {
  const provider = PROVIDERS[activity];
  if (!provider) return { activity, eligible:false, reason:'unsupported_activity' };

  const prefs = await readJson(env.PROJECTS, `${PREFERENCES_PREFIX}${session.sub}`) || {};
  const selected = new Set([...(Array.isArray(prefs.interests) ? prefs.interests : []), ...(Array.isArray(prefs.improve) ? prefs.improve : [])]);
  if (!selected.has(activity)) return { activity, eligible:false, reason:'not_selected' };

  const experience = normalizeExperience(prefs?.experience?.[activity]);
  const eligible = provider.eligibleRoutes(experience);
  if (!eligible.length) return { activity, eligible:false, reason:'no_route' };
  const routeChoices = routeChoicesFor(activity, experience, eligible);
  const stored = suppliedProgress || await readJson(env.PROJECTS, `${PROGRESS_PREFIX}${session.sub}:${activity}`) || {};
  const progress = normalizeProgress(stored, session.sub, provider);
  const selectedRoute = routeChoices.includes(progress.selectedRoute) ? progress.selectedRoute : chooseInitialRoute(session.sub, experience, routeChoices, provider);
  const route = provider.getRoute(selectedRoute) || provider.getRoute(routeChoices[0]);
  if (!route) return { activity, eligible:false, reason:'no_route' };
  const routeState = progress.routes?.[route.id] || { taskStates:{} };
  const taskStates = routeState.taskStates || {};
  const tasks = route.tasks.map((task, index) => ({
    ...task,
    type:normalizeTaskType(task),
    index:index + 1,
    status:TASK_STATUSES.has(taskStates[task.id]) ? taskStates[task.id] : 'pending',
    engineeringPrep:engineeringPrepForTask(activity, task.id),
  }));
  const creditedStatuses = new Set(['complete','known']);
  const completed = tasks.filter(task => creditedStatuses.has(task.status)).length;
  const skipped = tasks.filter(task => task.status === 'skipped').length;
  const current = tasks.find(task => task.status === 'pending') || tasks.find(task => task.status === 'skipped') || null;

  return {
    activity, eligible:true, experience,
    route:{ id:route.id, band:route.band || '', title:route.title, subtitle:route.subtitle, audience:route.audience, outcome:route.outcome, sourceNote:route.sourceNote, sources:route.sources, tasks },
    routeOptions:routeChoices.map(id => {
      const option = provider.getRoute(id);
      return option ? { id:option.id, band:option.band || '', title:option.title, subtitle:option.subtitle } : null;
    }).filter(Boolean),
    currentTaskId:current?.id || null,
    progress:{ completed, skipped, total:tasks.length, percent:tasks.length ? Math.round((completed / tasks.length) * 100) : 0 },
    canChooseAnother:routeChoices.length > 1,
  };
}

function routeChoicesFor(activity, experience, eligible) {
  if (activity !== ENGINEERING_ACTIVITY_ID) return eligible;
  if (experience === 'some') {
    const routes = ['engineering-role-builder','engineering-network'];
    return routes.filter(id => eligible.includes(id));
  }
  if (experience === 'comfortable') {
    const routes = ['engineering-ship-architect','engineering-combat-systems','engineering-role-builder'];
    return routes.filter(id => eligible.includes(id));
  }
  if (experience === 'experienced') {
    const routes = ['engineering-mentor','engineering-ship-architect'];
    return routes.filter(id => eligible.includes(id));
  }
  return eligible;
}

function chooseInitialRoute(ownerId, experience, eligible, provider) {
  if (!eligible.length) return '';
  const seed = `${ownerId}:${experience}:${provider.seedVersion}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return eligible[Math.abs(hash) % eligible.length];
}

function normalizeProgress(value, ownerId, provider) {
  const source = value && typeof value === 'object' ? value : {};
  let routes = {};
  if (source.routes && typeof source.routes === 'object') {
    try { routes = JSON.parse(JSON.stringify(source.routes)); }
    catch { routes = {}; }
  }
  for (const [routeId, state] of Object.entries(routes)) {
    if (!provider.getRoute(routeId) || !state || typeof state !== 'object') {
      delete routes[routeId];
      continue;
    }
    const taskStates = state.taskStates && typeof state.taskStates === 'object' ? state.taskStates : {};
    routes[routeId] = {
      taskStates:Object.fromEntries(Object.entries(taskStates).filter(([, status]) => TASK_STATUSES.has(status) && status !== 'pending')),
      startedAt:state.startedAt || null,
      updatedAt:state.updatedAt || null,
    };
  }
  return {
    ownerId,
    selectedRoute:typeof source.selectedRoute === 'string' ? source.selectedRoute : '',
    routeGeneration:Number(source.routeGeneration || 0),
    routes,
    updatedAt:source.updatedAt || null,
  };
}

function ensureRouteState(progress, routeId, provider) {
  const next = normalizeProgress(progress, progress.ownerId || '', provider);
  if (!next.routes[routeId]) next.routes[routeId] = { taskStates:{}, startedAt:null, updatedAt:null };
  return next;
}

function normalizeTaskType(task) {
  if (TASK_TYPES.has(task?.type)) return task.type;
  const stage = String(task?.stage || '').toLowerCase();
  if (/mentor|teach/.test(stage)) return 'mentor';
  if (/wing|operations|lead|campaign/.test(stage)) return 'wing';
  if (/graduate|challenge|control|strategy|diagnosis|capstone|survey|benchmark|analysis|adapt|intel/.test(stage)) return 'challenge';
  if (/build|platform|engineering|guardian tech|internals|unlock/.test(stage)) return 'build';
  if (/ready|cockpit|training|deploy|fight|interceptor|field test|first contact|technique|baseline|snapshot|operate|feedback|conflict|states|assets|expansion|retreat|influence|planning|attribution|levers|prepare|sell|core|subsurface|surface deposits|recovery|scouting|breadth|logistics|access|market|efficiency/.test(stage)) return 'demonstrate';
  return 'learn';
}

function activityFromUrl(url) {
  try { return normalizeActivity(new URL(url).searchParams.get('activity') || AX_ACTIVITY_ID); }
  catch { return AX_ACTIVITY_ID; }
}

function normalizeActivity(value) {
  const activity = String(value || AX_ACTIVITY_ID).toLowerCase();
  return activity;
}

function normalizeExperience(value) {
  return ['new','some','comfortable','experienced'].includes(value) ? value : 'new';
}

async function requireMember(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response:reply({ ok:false, error:'authentication_required' }, 401) };
  if (!MEMBER_ACCESS.has(session.access)) return { response:reply({ ok:false, error:'member_access_required' }, 403) };
  return { session };
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'pathway-assignments') return reply({ ok:false, error:'request_validation_failed' }, 403);
  return null;
}

function requireStorage(env, write) {
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || (write && typeof env.PROJECTS.put !== 'function')) return reply({ ok:false, error:'pathway_storage_not_configured' }, 503);
  return null;
}

async function readJson(namespace, key) {
  try {
    const value = await namespace.get(key, { type:'json' });
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

function headers() {
  return {
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  };
}

function reply(data, status = 200) {
  return json(data, { status, headers:headers() });
}
