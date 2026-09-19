import { json, readSession } from '../../../lib/auth.js';
import { normalizeDuelBotLeaderboard } from '../../../lib/duelbot-leaderboard.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  if (!session) return reply({ok:false,error:'authentication_required'},401);
  if (!ALLOWED_ACCESS.has(session.access)) return reply({ok:false,error:'member_access_required'},403);

  const token = clean(env?.DUELBOT_API_TOKEN, 256);
  const endpoint = clean(env?.DUELBOT_LEADERBOARD_URL, 300);
  if (!token || !endpoint) return reply({ok:false,error:'duelbot_integration_not_configured'},503);
  if (!validDuelBotEndpoint(endpoint)) return reply({ok:false,error:'duelbot_endpoint_not_allowed'},503);

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method:'GET',
      headers:{
        Accept:'application/json',
        Authorization:'Bearer ' + token,
      },
      signal:AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error('DuelBot leaderboard request failed', error);
    return reply({ok:false,error:'duelbot_unavailable'},503);
  }

  if (upstream.status === 503) return reply({ok:false,error:'duelbot_unavailable'},503);
  if (upstream.status === 401) {
    console.error('DuelBot rejected the configured integration credential');
    return reply({ok:false,error:'duelbot_authentication_failed'},502);
  }
  if (!upstream.ok) {
    console.error('Unexpected DuelBot leaderboard status', upstream.status);
    return reply({ok:false,error:'duelbot_upstream_error'},502);
  }

  let payload;
  try { payload = await upstream.json(); }
  catch { return reply({ok:false,error:'duelbot_invalid_response'},502); }

  const normalized = normalizeDuelBotLeaderboard(payload);
  if (!normalized) return reply({ok:false,error:'duelbot_invalid_response'},502);
  return reply(normalized,200);
}

function validDuelBotEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'duelbot.fitzbound.duckdns.org'
      && url.pathname === '/api/v1/leaderboard'
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}
function clean(value,maxLength) {
  return typeof value === 'string' ? value.trim().slice(0,maxLength) : '';
}
function privateHeaders() {
  return {
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  };
}
function reply(body,status=200) {
  return json(body,{status,headers:privateHeaders()});
}
