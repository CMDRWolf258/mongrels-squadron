import { json, readSession } from '../../../lib/auth.js';

const MEMBER_ACCESS = new Set(['member', 'officer', 'site_admin']);
const APPLICATIONS_KEY = 'applications-v1';
const PROFILES_KEY = 'profiles-v1';
const STATE_PREFIX = 'member-onboarding-v1:';
const MANUAL_TASKS = new Set(['inGameConfirmed', 'reviewedTasking']);

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function') return reply({ ok:false, error:'onboarding_storage_not_configured' }, 503);

  const [applications, profiles, state] = await Promise.all([
    readArray(env.PROJECTS, APPLICATIONS_KEY),
    readArray(env.PROJECTS, PROFILES_KEY),
    readJson(env.PROJECTS, `${STATE_PREFIX}${auth.session.sub}`),
  ]);

  const application = applications.find(item => item.ownerId === auth.session.sub && item.status === 'accepted' && item.acceptedAt) || null;
  if (!application || state?.dismissed) return reply({ ok:true, eligible:false });

  const profileExists = profiles.some(profile => profile.ownerId === auth.session.sub);
  const tasks = {
    websiteAccessActive: true,
    inGameConfirmed: Boolean(state?.inGameConfirmed),
    profileCreated: profileExists,
    reviewedTasking: Boolean(state?.reviewedTasking),
  };
  const complete = Object.values(tasks).every(Boolean);

  return reply({
    ok: true,
    eligible: true,
    commanderName: application?.answers?.commanderName || auth.session.displayName || 'Commander',
    acceptedAt: application.acceptedAt,
    tasks,
    complete,
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const err = validateSameOrigin(request);
  if (err) return err;
  if (!env.PROJECTS || typeof env.PROJECTS.get !== 'function' || typeof env.PROJECTS.put !== 'function') {
    return reply({ ok:false, error:'onboarding_storage_not_configured' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  const applications = await readArray(env.PROJECTS, APPLICATIONS_KEY);
  const application = applications.find(item => item.ownerId === auth.session.sub && item.status === 'accepted' && item.acceptedAt) || null;
  if (!application) return reply({ ok:false, error:'new_member_onboarding_not_available' }, 409);

  const key = `${STATE_PREFIX}${auth.session.sub}`;
  const existing = await readJson(env.PROJECTS, key) || {};
  const now = new Date().toISOString();

  if (body?.action === 'set_task') {
    const task = String(body?.task || '');
    if (!MANUAL_TASKS.has(task)) return reply({ ok:false, error:'invalid_onboarding_task' }, 400);
    const next = {
      ...existing,
      [task]: body?.completed === true,
      updatedAt: now,
    };
    await env.PROJECTS.put(key, JSON.stringify(next));
    return reply({ ok:true });
  }

  if (body?.action === 'dismiss') {
    const profiles = await readArray(env.PROJECTS, PROFILES_KEY);
    const profileExists = profiles.some(profile => profile.ownerId === auth.session.sub);
    const complete = Boolean(existing.inGameConfirmed) && Boolean(existing.reviewedTasking) && profileExists;
    if (!complete) return reply({ ok:false, error:'onboarding_not_complete' }, 409);
    await env.PROJECTS.put(key, JSON.stringify({ ...existing, dismissed:true, dismissedAt:now, updatedAt:now }));
    return reply({ ok:true, dismissed:true });
  }

  return reply({ ok:false, error:'unsupported_action' }, 400);
}

async function requireMember(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response: reply({ ok:false, error:'authentication_required' }, 401) };
  if (!MEMBER_ACCESS.has(session.access)) return { response: reply({ ok:false, error:'member_access_required' }, 403) };
  return { session };
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'member-onboarding') {
    return reply({ ok:false, error:'request_validation_failed' }, 403);
  }
  return null;
}

async function readArray(namespace, key) {
  try {
    const value = await namespace.get(key, { type:'json' });
    return Array.isArray(value) ? value : [];
  } catch { return []; }
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
