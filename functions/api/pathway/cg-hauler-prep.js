import { json, readSession } from '../../../lib/auth.js';
import {
  CG_HAULER_PREP_KEY_PREFIX,
  normalizeCgHaulerPrepState,
  setCgHaulerTaskStatus,
  resetCgHaulerPrep,
  buildCgHaulerPrepView,
} from '../../../lib/pathway-cg-hauler-prep.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const storageError = requireStorage(env, false);
  if (storageError) return storageError;
  const state = await loadState(env, auth.session.sub);
  return reply(present(state));
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

  let state = await loadState(env, auth.session.sub);
  const action = String(body?.action || '');
  const now = new Date().toISOString();

  try {
    if (action === 'set_task') {
      state = setCgHaulerTaskStatus(state, String(body?.taskId || ''), String(body?.status || ''), now);
    } else if (action === 'reset') {
      state = resetCgHaulerPrep(state, now);
    } else {
      return reply({ ok:false, error:'unsupported_action' }, 400);
    }
  } catch (error) {
    return reply({ ok:false, error:String(error?.message || 'invalid_specialty_action') }, 400);
  }

  state.ownerId = auth.session.sub;
  state.updatedAt = now;
  await env.PROJECTS.put(`${CG_HAULER_PREP_KEY_PREFIX}${auth.session.sub}`, JSON.stringify(state));
  return reply(present(state));
}

function present(stateValue) {
  const state = normalizeCgHaulerPrepState(stateValue, stateValue?.ownerId || '');
  return { ok:true, state, view:buildCgHaulerPrepView(state) };
}

async function loadState(env, ownerId) {
  let value = null;
  try { value = await env.PROJECTS.get(`${CG_HAULER_PREP_KEY_PREFIX}${ownerId}`, { type:'json' }); }
  catch { value = null; }
  return normalizeCgHaulerPrepState(value, ownerId);
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
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'pathway-cg-hauler-prep') {
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
