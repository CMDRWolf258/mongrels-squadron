import { json, readSession } from '../../../lib/auth.js';
import { buildMissionControlData } from '../../../lib/bgs-operations.js';
import { DAILY_TASK_LIMIT, START_ACTIVITY_META, getEligibleStartTasks } from '../../../lib/start-tasks.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);
const PREFS_PREFIX = 'pathway-preferences-v1:';
const DAILY_PREFIX = 'start-daily-v1:';
const EXPERIENCE = new Set(['new','some','comfortable','experienced']);
const PLAY_STYLES = new Set(['either','solo','group']);

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  if (!session || !MEMBER_ACCESS.has(session.access)) {
    return reply({ ok:true, authenticated:false, limitPerCategory:DAILY_TASK_LIMIT });
  }
  const storageError = requireStorage(env, false);
  if (storageError) return storageError;

  const timeZone = normalizeTimeZone(new URL(request.url).searchParams.get('tz'));
  const result = await buildDailyState(request, env, session, timeZone);
  return reply({ ok:true, authenticated:true, ...result });
}

export async function onRequestPost({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return reply({ ok:false, error:'authentication_required' }, 401);
  if (!MEMBER_ACCESS.has(session.access)) return reply({ ok:false, error:'member_access_required' }, 403);
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  const storageError = requireStorage(env, true);
  if (storageError) return storageError;

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  if (String(body?.action || '') !== 'reveal') return reply({ ok:false, error:'unsupported_action' }, 400);
  const activity = String(body?.activity || '');
  if (!START_ACTIVITY_META[activity]) return reply({ ok:false, error:'invalid_activity' }, 400);

  const timeZone = normalizeTimeZone(body?.timeZone);
  const prefs = await readPreferences(env, session.sub);
  const selected = selectedActivities(prefs);
  if (!selected.includes(activity)) return reply({ ok:false, error:'activity_not_selected' }, 409);

  const date = localDateKey(timeZone);
  const key = `${DAILY_PREFIX}${date}:${session.sub}`;
  const state = normalizeDailyState(await readJson(env.PROJECTS, key), date, timeZone);
  const revealed = state.reveals[activity] || [];

  if (revealed.length >= DAILY_TASK_LIMIT) {
    const result = await buildDailyState(request, env, session, timeZone, state);
    return reply({ ok:true, authenticated:true, limitReached:true, ...result });
  }

  const experience = normalizeExperience(prefs?.experience?.[activity]);
  const playStyle = normalizePlayStyle(prefs?.playStyle);
  let candidates = getEligibleStartTasks(activity, experience, playStyle);
  const squad = await buildSquadOpportunity(request, env, session, activity, date);
  if (squad) candidates = [squad, ...candidates];

  const used = new Set(revealed.map(item => item.id));
  const available = candidates.filter(item => item?.id && !used.has(item.id));
  if (!available.length) {
    const result = await buildDailyState(request, env, session, timeZone, state);
    return reply({ ok:true, authenticated:true, poolExhausted:true, ...result });
  }

  const seed = `${session.sub}:${date}:${activity}:${revealed.length}:start-here-v1`;
  const picked = available[hashIndex(seed, available.length)];
  const snapshot = presentTask(picked, new Date().toISOString());
  state.reveals[activity] = [...revealed, snapshot];
  state.updatedAt = new Date().toISOString();
  await env.PROJECTS.put(key, JSON.stringify(state), { expirationTtl:7 * 24 * 60 * 60 });

  const result = await buildDailyState(request, env, session, timeZone, state);
  return reply({ ok:true, authenticated:true, revealed:snapshot, ...result });
}

async function buildDailyState(request, env, session, timeZone, suppliedState = null) {
  const prefs = await readPreferences(env, session.sub);
  const selected = selectedActivities(prefs);
  const date = localDateKey(timeZone);
  const key = `${DAILY_PREFIX}${date}:${session.sub}`;
  const state = suppliedState || normalizeDailyState(await readJson(env.PROJECTS, key), date, timeZone);
  const playStyle = normalizePlayStyle(prefs?.playStyle);

  const categories = selected.map(id => {
    const meta = START_ACTIVITY_META[id];
    const revealed = Array.isArray(state.reveals[id]) ? state.reveals[id].slice(0, DAILY_TASK_LIMIT) : [];
    return {
      id,
      label:meta.label,
      group:meta.group,
      link:meta.link,
      experience:normalizeExperience(prefs?.experience?.[id]),
      playStyle,
      revealed,
      remaining:Math.max(0, DAILY_TASK_LIMIT - revealed.length),
      limit:DAILY_TASK_LIMIT,
    };
  });

  return {
    viewer:{ displayName:session.displayName || session.username || 'Mongrel Member', access:session.access },
    date,
    timeZone,
    resetLabel:'Resets on your next local calendar day',
    limitPerCategory:DAILY_TASK_LIMIT,
    hasPreferences:selected.length > 0,
    categories,
  };
}

async function buildSquadOpportunity(request, env, session, activity, date) {
  if (activity !== 'bgs' && activity !== 'operations') return null;
  try {
    const payload = await buildMissionControlData(request, env, session);
    const systems = Array.isArray(payload?.systems) ? payload.systems.filter(system =>
      system && system.present !== false && (system.priority || system.attention || system.watch) && String(system.objective || '').trim()
    ) : [];
    if (!systems.length) return null;
    const system = systems[hashIndex(`${session.sub}:${date}:${activity}:squad`, systems.length)];
    return {
      id:`squad-${activity}-${slug(system.name)}-${date}`,
      title:`Squad opportunity — ${system.name}`,
      objective:`${String(system.objective).trim()} Check current Daily Orders and Mission Control before acting so you follow the intended faction, method, and stopping point.`,
      kind:'squad',
      style:'any',
      levels:['new','some','comfortable','experienced'],
      link:'/operations/#daily-orders',
    };
  } catch (error) {
    console.error('Could not build Start Here squad opportunity', error);
    return null;
  }
}

function selectedActivities(prefs) {
  const interests = Array.isArray(prefs?.interests) ? prefs.interests : [];
  const improve = Array.isArray(prefs?.improve) ? prefs.improve : [];
  return [...new Set([...interests, ...improve].map(String).filter(id => START_ACTIVITY_META[id]))];
}

async function readPreferences(env, ownerId) {
  return await readJson(env.PROJECTS, `${PREFS_PREFIX}${ownerId}`) || {};
}

function normalizeDailyState(value, date, timeZone) {
  const source = value && typeof value === 'object' && value.date === date ? value : {};
  const rawReveals = source.reveals && typeof source.reveals === 'object' ? source.reveals : {};
  const reveals = {};
  for (const id of Object.keys(START_ACTIVITY_META)) {
    if (!Array.isArray(rawReveals[id])) continue;
    reveals[id] = rawReveals[id].filter(item => item && item.id && item.title && item.objective).slice(0, DAILY_TASK_LIMIT).map(item => presentTask(item, item.revealedAt || null));
  }
  return { date, timeZone, reveals, updatedAt:source.updatedAt || null };
}

function presentTask(item, revealedAt = null) {
  return {
    id:String(item.id || ''),
    title:String(item.title || ''),
    objective:String(item.objective || ''),
    kind:['activity','challenge','squad'].includes(item.kind) ? item.kind : 'activity',
    link:String(item.link || '/activities/'),
    revealedAt:revealedAt || null,
  };
}

function normalizeExperience(value) {
  return EXPERIENCE.has(value) ? value : 'new';
}
function normalizePlayStyle(value) {
  return PLAY_STYLES.has(value) ? value : 'either';
}

function normalizeTimeZone(value) {
  const candidate = typeof value === 'string' && value.length <= 80 ? value : 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone:candidate }).format(new Date());
    return candidate;
  } catch { return 'UTC'; }
}

function localDateKey(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function hashIndex(value, size) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % Math.max(1, size);
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'objective';
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'start-daily-tasks') {
    return reply({ ok:false, error:'request_validation_failed' }, 403);
  }
  return null;
}

function requireStorage(env, write) {
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || (write && typeof env.PROJECTS.put !== 'function')) {
    return reply({ ok:false, error:'daily_task_storage_not_configured' }, 503);
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
