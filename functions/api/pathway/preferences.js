import { json, readSession } from '../../../lib/auth.js';

const MEMBER_ACCESS = new Set(['member', 'officer', 'site_admin']);
const KEY_PREFIX = 'pathway-preferences-v1:';
const EXPERIENCE_LEVELS = ['new', 'some', 'comfortable', 'experienced'];
const PLAY_STYLES = ['either', 'solo', 'group'];

const ACTIVITIES = [
  { id:'pve', label:'PvE Combat', group:'Combat' },
  { id:'pvp', label:'PvP', group:'Combat' },
  { id:'ax', label:'Anti-Xeno', group:'Combat' },
  { id:'surface', label:'Surface Operations', group:'Combat' },
  { id:'mining', label:'Mining', group:'Industry & Logistics' },
  { id:'trade', label:'Trade & Hauling', group:'Industry & Logistics' },
  { id:'carrier-logistics', label:'Carrier Logistics', group:'Industry & Logistics' },
  { id:'engineering', label:'Engineering & Shipbuilding', group:'Industry & Logistics' },
  { id:'exploration', label:'Exploration', group:'Exploration & Discovery' },
  { id:'exobiology', label:'Exobiology', group:'Exploration & Discovery' },
  { id:'bgs', label:'Background Simulation', group:'Galaxy & Frontier' },
  { id:'colonization', label:'Colonization', group:'Galaxy & Frontier' },
  { id:'powerplay', label:'Powerplay', group:'Galaxy & Frontier' },
  { id:'operations', label:'Squad Operations', group:'Galaxy & Frontier' },
];
const ACTIVITY_IDS = new Set(ACTIVITIES.map(item => item.id));

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function') {
    return reply({ ok:false, error:'pathway_storage_not_configured' }, 503);
  }

  const saved = await readJson(env.PROJECTS, `${KEY_PREFIX}${auth.session.sub}`);
  return reply({
    ok:true,
    viewer:{ displayName:auth.session.displayName || auth.session.username || 'Commander', access:auth.session.access },
    catalog:{ activities:ACTIVITIES, experienceLevels:EXPERIENCE_LEVELS, playStyles:PLAY_STYLES },
    preferences:present(saved, auth.session),
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const originError = validateSameOrigin(request);
  if (originError) return originError;
  if (!env.PROJECTS || typeof env.PROJECTS.put !== 'function') {
    return reply({ ok:false, error:'pathway_storage_not_configured' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  const interests = normalizeActivities(body?.interests);
  const improve = normalizeActivities(body?.improve);
  const selected = new Set([...interests, ...improve]);
  const experience = {};
  const sourceExperience = body?.experience && typeof body.experience === 'object' ? body.experience : {};
  for (const id of selected) {
    const level = String(sourceExperience[id] || 'new');
    experience[id] = EXPERIENCE_LEVELS.includes(level) ? level : 'new';
  }

  const playStyle = PLAY_STYLES.includes(body?.playStyle) ? body.playStyle : 'either';
  const currentGoal = clean(body?.currentGoal, '', 500);
  const now = new Date().toISOString();
  const item = {
    ownerId:auth.session.sub,
    interests,
    improve,
    experience,
    playStyle,
    currentGoal,
    updatedAt:now,
  };

  await env.PROJECTS.put(`${KEY_PREFIX}${auth.session.sub}`, JSON.stringify(item));
  return reply({ ok:true, preferences:present(item, auth.session) });
}

function present(value, session) {
  const source = value && typeof value === 'object' ? value : {};
  const interests = normalizeActivities(source.interests);
  const improve = normalizeActivities(source.improve);
  const selected = new Set([...interests, ...improve]);
  const experience = {};
  const savedExperience = source.experience && typeof source.experience === 'object' ? source.experience : {};
  for (const id of selected) {
    const level = String(savedExperience[id] || 'new');
    experience[id] = EXPERIENCE_LEVELS.includes(level) ? level : 'new';
  }
  return {
    ownerId:session.sub,
    interests,
    improve,
    experience,
    playStyle:PLAY_STYLES.includes(source.playStyle) ? source.playStyle : 'either',
    currentGoal:clean(source.currentGoal, '', 500),
    updatedAt:source.updatedAt || null,
  };
}

function normalizeActivities(value) {
  const items = Array.isArray(value) ? value : [];
  return [...new Set(items.map(item => String(item)).filter(id => ACTIVITY_IDS.has(id)))].slice(0, ACTIVITIES.length);
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
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'pathway-preferences') {
    return reply({ ok:false, error:'request_validation_failed' }, 403);
  }
  return null;
}

async function readJson(namespace, key) {
  try {
    const value = await namespace.get(key, { type:'json' });
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

function clean(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const output = value.trim();
  return output ? output.slice(0, max) : fallback;
}
function headers() {
  return { 'Cache-Control':'private, no-store, no-cache, must-revalidate', Pragma:'no-cache', Vary:'Cookie', 'X-Content-Type-Options':'nosniff' };
}
function reply(data, status = 200) { return json(data, { status, headers:headers() }); }
