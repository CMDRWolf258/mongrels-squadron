import { json, readSession } from '../../../lib/auth.js';
import { buildMissionControlData, hasMemberAccess, MANAGER_ACCESS, writeBgsStrategy } from '../../../lib/bgs-operations.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  const payload = await buildMissionControlData(request, env, auth.session);
  return json(payload, { headers: privateHeaders() });
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  if (!MANAGER_ACCESS.has(auth.session.access)) {
    return json({ ok: false, error: 'officer_access_required' }, { status: 403, headers: privateHeaders() });
  }

  const originError = validateSameOrigin(request);
  if (originError) return originError;

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, { status: 400, headers: privateHeaders() }); }

  try {
    await writeBgsStrategy(env, body, auth.session.displayName || auth.session.username || 'Mongrel Officer');
  } catch (error) {
    console.error('Could not save private BGS strategy', error);
    return json({ ok: false, error: error?.message || 'strategy_save_failed' }, { status: 503, headers: privateHeaders() });
  }

  const payload = await buildMissionControlData(request, env, auth.session);
  return json(payload, { headers: privateHeaders() });
}

async function requireMember(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    return { response: json({ ok: false, error: 'authentication_required' }, { status: 401, headers: privateHeaders() }) };
  }
  if (!hasMemberAccess(session)) {
    return { response: json({ ok: false, error: 'member_access_required' }, { status: 403, headers: privateHeaders() }) };
  }
  return { session };
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'mission-control-strategy') {
    return json({ ok: false, error: 'request_validation_failed' }, { status: 403, headers: privateHeaders() });
  }
  return null;
}

function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Cookie',
  };
}
