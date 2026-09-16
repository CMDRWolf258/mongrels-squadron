import { json, readSession } from '../../../lib/auth.js';
import { AX_ACTIVITY_ID, eligibleAxRoutes, getAxRoute } from '../../../lib/pathway-ax.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);
const PREFERENCES_PREFIX = 'pathway-preferences-v1:';
const PROGRESS_PREFIX = 'pathway-progress-v1:';
const TASK_STATUSES = new Set(['complete','known','skipped','pending']);

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const storageError = requireStorage(env, false);
  if (storageError) return storageError;

  const result = await buildState(env, auth.session);
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

  const prefs = await readJson(env.PROJECTS, `${PREFERENCES_PREFIX}${auth.session.sub}`) || {};
  const selectedAx = new Set([...(Array.isArray(prefs.interests) ? prefs.interests : []), ...(Array.isArray(prefs.improve) ? prefs.improve : [])]).has(AX_ACTIVITY_ID);
  if (!selectedAx) return reply({ ok:false, error:'ax_not_selected', detail:'Add Anti-Xeno to My Pathway before using AX assignments.' }, 409);

  const experience = normalizeExperience(prefs?.experience?.ax);
  const eligible = eligibleAxRoutes(experience);
  const key = `${PROGRESS_PREFIX}${auth.session.sub}:ax`;
  const existing = await readJson(env.PROJECTS, key) || {};
  const progress = normalizeProgress(existing, auth.session.sub);
  const currentRouteId = eligible.includes(progress.selectedRoute) ? progress.selectedRoute : chooseInitialRoute(auth.session.sub, experience, eligible);
  const action = String(body?.action || '');

  if (action === 'set_task') {
    const route = getAxRoute(currentRouteId);
    if (!route) return reply({ ok:false, error:'route_not_found' }, 404);
    const taskId = String(body?.taskId || '');
    if (!route.tasks.some(task => task.id === taskId)) return reply({ ok:false, error:'task_not_found' }, 404);
    const status = String(body?.status || 'pending');
    if (!TASK_STATUSES.has(status)) return reply({ ok:false, error:'invalid_task_status' }, 400);

    const next = ensureRouteState(progress, currentRouteId);
    if (status === 'pending') delete next.routes[currentRouteId].taskStates[taskId];
    else next.routes[currentRouteId].taskStates[taskId] = status;
    next.selectedRoute = currentRouteId;
    next.updatedAt = new Date().toISOString();
    next.routes[currentRouteId].updatedAt = next.updatedAt;
    if (!next.routes[currentRouteId].startedAt) next.routes[currentRouteId].startedAt = next.updatedAt;
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true, ...(await buildState(env, auth.session, next)) });
  }

  if (action === 'another_route') {
    const next = ensureRouteState(progress, currentRouteId);
    const index = Math.max(0, eligible.indexOf(currentRouteId));
    const nextRouteId = eligible[(index + 1) % eligible.length];
    next.selectedRoute = nextRouteId;
    next.routeGeneration = Number(next.routeGeneration || 0) + 1;
    next.updatedAt = new Date().toISOString();
    ensureRouteState(next, nextRouteId);
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true, routeChanged:true, ...(await buildState(env, auth.session, next)) });
  }

  if (action === 'reset_route') {
    const next = ensureRouteState(progress, currentRouteId);
    next.routes[currentRouteId] = { taskStates:{}, startedAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    next.selectedRoute = currentRouteId;
    next.updatedAt = new Date().toISOString();
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true, ...(await buildState(env, auth.session, next)) });
  }

  return reply({ ok:false, error:'unsupported_action' }, 400);
}

async function buildState(env, session, suppliedProgress = null) {
  const prefs = await readJson(env.PROJECTS, `${PREFERENCES_PREFIX}${session.sub}`) || {};
  const selected = new Set([...(Array.isArray(prefs.interests) ? prefs.interests : []), ...(Array.isArray(prefs.improve) ? prefs.improve : [])]);
  if (!selected.has(AX_ACTIVITY_ID)) {
    return { activity:'ax', eligible:false, reason:'not_selected' };
  }

  const experience = normalizeExperience(prefs?.experience?.ax);
  const eligible = eligibleAxRoutes(experience);
  const stored = suppliedProgress || await readJson(env.PROJECTS, `${PROGRESS_PREFIX}${session.sub}:ax`) || {};
  const progress = normalizeProgress(stored, session.sub);
  const selectedRoute = eligible.includes(progress.selectedRoute) ? progress.selectedRoute : chooseInitialRoute(session.sub, experience, eligible);
  const route = getAxRoute(selectedRoute) || getAxRoute(eligible[0]);
  const routeState = progress.routes?.[route.id] || { taskStates:{} };
  const taskStates = routeState.taskStates || {};
  const tasks = route.tasks.map((task, index) => ({ ...task, index:index + 1, status:TASK_STATUSES.has(taskStates[task.id]) ? taskStates[task.id] : 'pending' }));
  const doneStatuses = new Set(['complete','known','skipped']);
  const completed = tasks.filter(task => doneStatuses.has(task.status)).length;
  const current = tasks.find(task => !doneStatuses.has(task.status)) || null;

  return {
    activity:'ax',
    eligible:true,
    experience,
    route:{
      id:route.id,
      title:route.title,
      subtitle:route.subtitle,
      audience:route.audience,
      outcome:route.outcome,
      sourceNote:route.sourceNote,
      sources:route.sources,
      tasks,
    },
    routeOptions:eligible.map(id => {
      const option = getAxRoute(id);
      return option ? { id:option.id, title:option.title, subtitle:option.subtitle } : null;
    }).filter(Boolean),
    currentTaskId:current?.id || null,
    progress:{ completed, total:tasks.length, percent:tasks.length ? Math.round((completed / tasks.length) * 100) : 0 },
    canChooseAnother:eligible.length > 1,
  };
}

function chooseInitialRoute(ownerId, experience, eligible) {
  if (!eligible.length) return '';
  const seed = `${ownerId}:${experience}:ax-v1`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return eligible[Math.abs(hash) % eligible.length];
}

function normalizeProgress(value, ownerId) {
  const source = value && typeof value === 'object' ? value : {};
  const routes = source.routes && typeof source.routes === 'object' ? structuredClone(source.routes) : {};
  for (const [routeId, state] of Object.entries(routes)) {
    if (!getAxRoute(routeId) || !state || typeof state !== 'object') {
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

function ensureRouteState(progress, routeId) {
  const next = normalizeProgress(progress, progress.ownerId || '');
  if (!next.routes[routeId]) next.routes[routeId] = { taskStates:{}, startedAt:null, updatedAt:null };
  return next;
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
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'pathway-assignments') {
    return reply({ ok:false, error:'request_validation_failed' }, 403);
  }
  return null;
}

function requireStorage(env, write) {
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || (write && typeof env.PROJECTS.put !== 'function')) {
    return reply({ ok:false, error:'pathway_storage_not_configured' }, 503);
  }
  return null;
}

async function readJson(namespace, key) {
  try {
    const value = await namespace.get(key, { type:'json' });
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

function headers() {
  return { 'Cache-Control':'private, no-store, no-cache, must-revalidate', Pragma:'no-cache', Vary:'Cookie', 'X-Content-Type-Options':'nosniff' };
}
function reply(data, status = 200) { return json(data, { status, headers:headers() }); }
