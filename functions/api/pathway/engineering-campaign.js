import { json, readSession } from '../../../lib/auth.js';
import {
  ENGINEERING_CAMPAIGN_KEY_PREFIX,
  ENGINEERING_GOAL_CATALOG,
  normalizeEngineeringCampaignState,
  startEngineeringCampaign,
  setEngineeringFact,
  clearEngineeringFact,
  setEngineeringNodeComplete,
  setEngineeringCampaignStatus,
  buildEngineeringCampaignView,
} from '../../../lib/engineering-campaign.js';
import { buildEngineeringDependencyNodes } from '../../../lib/engineering-campaign-data.js';

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
    if (action === 'start_campaign') {
      state = startEngineeringCampaign(state, {
        goalId:body?.goalId,
        shipName:body?.shipName,
        targetNotes:body?.targetNotes,
      }, now);
    } else if (action === 'set_fact') {
      // Browser/API writes are manual in v1. Future imports/connectors should use
      // server-owned source labels rather than accepting provenance from the client.
      state = setEngineeringFact(state, body?.factId, body?.value, 'manual', now);
    } else if (action === 'clear_fact') {
      state = clearEngineeringFact(state, body?.factId, now);
    } else if (action === 'set_node') {
      state = setEngineeringNodeComplete(state, body?.campaignId, body?.nodeId, Boolean(body?.complete), 'manual', now);
    } else if (action === 'set_campaign_status') {
      state = setEngineeringCampaignStatus(state, body?.campaignId, String(body?.status || ''), now);
    } else {
      return reply({ ok:false, error:'unsupported_action' }, 400);
    }
  } catch (error) {
    const code = String(error?.message || 'invalid_campaign_action');
    return reply({ ok:false, error:code }, 400);
  }

  state.ownerId = auth.session.sub;
  state.updatedAt = now;
  await env.PROJECTS.put(`${ENGINEERING_CAMPAIGN_KEY_PREFIX}${auth.session.sub}`, JSON.stringify(state));
  return reply(present(state));
}

function present(stateValue) {
  const state = normalizeEngineeringCampaignState(stateValue, stateValue?.ownerId || '');
  const active = state.activeCampaignId ? state.campaigns[state.activeCampaignId] : null;
  const dependencyNodes = buildEngineeringDependencyNodes({ campaign:active, facts:state.facts });
  return {
    ok:true,
    frameworkVersion:1,
    goalCatalog:ENGINEERING_GOAL_CATALOG,
    state,
    planner:buildEngineeringCampaignView(state, dependencyNodes),
  };
}

async function loadState(env, ownerId) {
  const key = `${ENGINEERING_CAMPAIGN_KEY_PREFIX}${ownerId}`;
  let value = null;
  try { value = await env.PROJECTS.get(key, { type:'json' }); }
  catch { value = null; }
  return normalizeEngineeringCampaignState(value, ownerId);
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
  if (origin !== expected || request.headers.get('X-Mongrels-Request') !== 'pathway-engineering-campaign') {
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
