import { json, readSession } from '../../../lib/auth.js';
import { DEFAULT_REWARD_SETTINGS, normalizeRewardSettings, readRewardSettings, REWARD_SETTINGS_KEY } from '../../../lib/reward-rules.js';

export async function onRequestGet({request,env}) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const stored = await readRewardSettings(env);
  return reply({
    ok:true,
    settings:stored.settings,
    updatedAt:stored.updatedAt,
    updatedBy:stored.updatedBy,
    defaults:DEFAULT_REWARD_SETTINGS,
  });
}

export async function onRequestPut({request,env}) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const validation = validateMutation(request);
  if (validation) return validation;
  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') {
    return reply({ok:false,error:'reward_storage_not_configured'},503);
  }

  let body;
  try { body = await request.json(); }
  catch { return reply({ok:false,error:'invalid_json'},400); }

  const settings = normalizeRewardSettings(body?.settings);
  const stored = {
    version:1,
    settings,
    updatedAt:new Date().toISOString(),
    updatedBy:auth.session.displayName || auth.session.username || 'Wolf',
  };
  await env.DAILY_ORDERS.put(REWARD_SETTINGS_KEY, JSON.stringify(stored));
  return reply({ok:true,...stored,defaults:DEFAULT_REWARD_SETTINGS});
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) return {response:reply({ok:false,error:'authentication_required'},401)};
  if (session.access !== 'site_admin') return {response:reply({ok:false,error:'site_admin_required'},403)};
  return {session};
}

function validateMutation(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'wolf-rewards') {
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}

function reply(body,status=200) {
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
