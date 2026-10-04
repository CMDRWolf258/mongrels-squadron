import { json } from '../../../lib/auth.js';
import { buildScoutJobBoard, hasActiveScoutClaim, recordScoutObservation } from '../../../lib/scout-jobs.js';
import { syncScoutDiscordBoard } from '../../../lib/scout-discord.js';
import { loadActiveMongrelSystems } from '../../../lib/scout-systems.js';
import { loadBgsDiscordView, syncBgsDiscordBoard } from '../../../lib/bgs-discord.js';
import { reconcileAutomaticRewardEntries } from '../../../lib/reward-engine-runtime.js';
import { loadRewardDiscordView, syncRewardDiscordBoard } from '../../../lib/reward-discord.js';
import { recordScoutMarketSnapshot } from '../../../lib/trade-market.js';
import { validatedConflictObservation } from '../../../lib/bgs-conflict-validation.js';
import { normalizeScoutFacilityObservation, recordScoutFacilityObservation } from '../../../lib/scout-facility-observations.js';
import { normalizeScoutFacilityVisit, deriveStationHostCandidate, recordScoutFacilityVisit } from '../../../lib/scout-facility-visits.js';

const MONGREL = 'Regiment of Imperial Mongrels';
const TOKENS_KEY = 'wolf-bgs-scout-tokens-v1';
const SNAPSHOTS_KEY = 'wolf-bgs-scout-snapshots-v1';
const RATE_KEY_PREFIX = 'wolf-bgs-scout-rate-v1:';
const DEFAULT_RATE_LIMIT_PER_HOUR = 120;
const ACCEPTED_EVENTS = new Set(['FSDJump','Location','CarrierJump']);
const MAX_FACTIONS = 20;
const MAX_CONFLICTS = 12;

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!storageReady(env)) {
    const error = env?.DAILY_ORDERS ? 'daily_orders_binding_invalid' : 'daily_orders_binding_missing';
    console.error('Mongrel Scout ingest cannot access DAILY_ORDERS', {
      error,
      hasDailyOrders:Boolean(env?.DAILY_ORDERS),
      hasGet:typeof env?.DAILY_ORDERS?.get === 'function',
      hasPut:typeof env?.DAILY_ORDERS?.put === 'function',
    });
    return reply({ok:false,error}, 503);
  }

  const auth = await authenticate(request, env);
  if (!auth) return reply({ok:false,error:'invalid_scout_token'}, 401);

  const rate = await consumeRateLimit(env, auth.id);
  if (!rate.allowed) {
    return reply({
      ok:false,
      error:'scout_rate_limit_reached',
      limit:DEFAULT_RATE_LIMIT_PER_HOUR,
      retryAfterSeconds:rate.retryAfterSeconds,
    }, 429, {'Retry-After':String(rate.retryAfterSeconds)});
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 128000) return reply({ok:false,error:'payload_too_large'}, 413);

  let body;
  try { body = await request.json(); }
  catch { return reply({ok:false,error:'invalid_json'}, 400); }

  if (isMarketPayload(body)) {
    return handleMarketSnapshot({body,auth,env});
  }
  if (isFacilityVisitPayload(body)) {
    return handleFacilityVisitObservation({body,auth,env});
  }
  if (isFacilityHostPayload(body)) {
    return handleFacilityHostObservation({body,auth,env});
  }
  if (isFacilityPayload(body)) {
    return handleFacilityObservation({body,auth,env});
  }

  const snapshot = normalizeSnapshot(body);
  if (!snapshot) return reply({ok:false,error:'invalid_scout_snapshot'}, 400);
  const eventMs = new Date(snapshot.updatedAt).getTime();
  if (eventMs > Date.now() + 15 * 60 * 1000) {
    return reply({ok:false,error:'journal_timestamp_in_future'}, 422);
  }
  if (!snapshot.factions.some(row => norm(row.name) === norm(MONGREL))) {
    return reply({ok:false,error:'mongrels_not_present'}, 422);
  }
  if (!systemAuthorized(auth, snapshot.system)) {
    const claimAuthorized=auth.ownerId
      ? await hasActiveScoutClaim(env,{system:snapshot.system,ownerId:auth.ownerId,at:new Date()})
      : false;
    if(!claimAuthorized){
      return reply({ok:false,error:'system_not_authorized',system:snapshot.system}, 403);
    }
  }

  const state = await readSnapshots(env);
  const current = state.systems[snapshot.system];
  const stored = !current || compareTime(snapshot.updatedAt, current.updatedAt) >= 0;
  if (stored) {
    state.systems[snapshot.system] = {
      ...snapshot,
      receivedAt:new Date().toISOString(),
      scoutTokenId:auth.id,
      scoutLabel:auth.label,
    };
    updateConflictHistory(state, snapshot);
    try {
      await env.DAILY_ORDERS.put(SNAPSHOTS_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Mongrel Scout snapshot write failed', error);
      return reply({
        ok:false,
        error:'scout_snapshot_write_failed',
        system:snapshot.system,
      }, 503);
    }
  }

  // System freshness is the critical path. Everything below is bookkeeping,
  // rewards, or Discord presentation and must never make an in-game jump upload fail.
  const postProcess = processAcceptedBgsSnapshot({request,env,auth,snapshot,stored});
  if (typeof context.waitUntil === 'function') {
    context.waitUntil(postProcess);
  } else {
    // Local/test runtimes without waitUntil still get deterministic behavior.
    await postProcess;
  }

  return reply({
    ok:true,
    accepted:true,
    stored,
    system:snapshot.system,
    updatedAt:snapshot.updatedAt,
    scout:auth.label,
    postProcessing:stored?'scheduled':'not_needed',
  }, 200);
}


async function processAcceptedBgsSnapshot({request,env,auth,snapshot,stored}) {
  try {
    await noteTokenUse(env, auth.id, snapshot);

    let scoutJob=null;
    if(stored){
      try{
        const result=await recordScoutObservation(env,{
          system:snapshot.system,
          systemAddress:snapshot.systemAddress,
          coords:snapshot.starPos,
          ownerId:auth.ownerId||'',
          commander:auth.ownerCommander||auth.label||'Mongrel Scout',
          tokenId:auth.id,
          tokenLabel:auth.label,
          observedAt:snapshot.updatedAt,
          receivedAt:new Date().toISOString(),
        });
        scoutJob={
          recorded:Boolean(result.recorded),
          duplicate:Boolean(result.duplicate),
          status:result.status||result.observation?.status||'',
          rewardWinner:Boolean(result.winner&&result.winner.observationId===(result.observation?.id||'')),
          cycleId:result.cycleId||'',
        };
      }catch(error){
        console.error('Could not apply Scout Job observation',error);
        scoutJob={recorded:false,status:'job_processing_failed'};
      }
    }

    let automaticRewards=null;
    if(stored&&scoutJob?.recorded){
      try{
        automaticRewards=await reconcileAutomaticRewardEntries(env,{actor:'Reward Engine · Live Scout'});
      }catch(error){
        console.error('Could not automatically issue verified rewards after Scout observation',error);
      }
    }

    if(Number(automaticRewards?.created)>0){
      try{
        const rewardView=await loadRewardDiscordView(env);
        const adminUrl=new URL('/wolf-bgs/',request.url);
        adminUrl.hash='reward-engine';
        await syncRewardDiscordBoard(env,{
          view:rewardView,
          adminUrl:adminUrl.toString(),
          rewardsUrl:new URL('/rewards/',request.url).toString(),
          createMissing:false,
        });
      }catch(error){
        console.error('Scout reward was issued but Rewards Discord refresh failed',error);
      }
    }

    if(stored){
      try{
        const bgsView=await loadBgsDiscordView(request,env);
        await syncBgsDiscordBoard(env,{
          view:bgsView,
          missionControlUrl:new URL('/operations/#all-systems',request.url).toString(),
          createMissing:false,
        });
      }catch(error){
        console.error('Live Scout snapshot saved but BGS Discord refresh failed',error);
      }
    }

    if(stored&&scoutJob?.recorded){
      try{
        const systems=await loadActiveMongrelSystems(request);
        const board=await buildScoutJobBoard(env,{systems,viewer:null,now:new Date()});
        await syncScoutDiscordBoard(env,{
          board,
          scoutBoardUrl:new URL('/scout-jobs/',request.url).toString(),
          setupUrl:new URL('/member/?section=live-scout-setup#live-scout-setup',request.url).toString(),
          createMissing:false,
          originSystem:'Diaba',
          ordinaryLimit:15,
        });
      }catch(error){
        console.error('Live Scout observation saved but Scout Discord refresh failed',error);
      }
    }
  } catch (error) {
    // Background integrations are intentionally non-fatal to the accepted snapshot.
    console.error('Mongrel Scout post-ingest processing failed',error);
  }
}


function isMarketPayload(value) {
  return value && typeof value === 'object'
    && (String(value.kind || '').toLowerCase() === 'market' || String(value.event || '') === 'Market');
}

function isFacilityPayload(value) {
  return value && typeof value === 'object'
    && (String(value.kind || '').toLowerCase() === 'facility' || String(value.event || '') === 'ApproachSettlement');
}

function isFacilityVisitPayload(value) {
  return value && typeof value === 'object'
    && String(value.kind || '').toLowerCase() === 'facility_visit';
}

function isFacilityHostPayload(value) {
  return value && typeof value === 'object'
    && (String(value.kind || '').toLowerCase() === 'facility_host' || String(value.event || '') === 'StationHost');
}

async function handleFacilityVisitObservation({body,auth,env}) {
  const observation=normalizeScoutFacilityVisit(body);
  if(!observation)return reply({ok:false,error:'invalid_facility_visit'},400);
  if(Date.parse(observation.observedAt)>Date.now()+15*60*1000){
    return reply({ok:false,error:'journal_timestamp_in_future'},422);
  }
  if(!systemAuthorized(auth,observation.system)){
    const claimAuthorized=auth.ownerId
      ? await hasActiveScoutClaim(env,{system:observation.system,ownerId:auth.ownerId,at:new Date()})
      : false;
    if(!claimAuthorized){
      return reply({ok:false,error:'system_not_authorized',system:observation.system},403);
    }
  }

  const visitResult=await recordScoutFacilityVisit(env,body);
  if(visitResult?.error){
    const status=visitResult.error==='bgs_storage_not_configured'?503
      : visitResult.error==='journal_timestamp_in_future'?422
      : 400;
    return reply({ok:false,error:visitResult.error},status);
  }

  const candidate=deriveStationHostCandidate(observation);
  let hostWrite=null;
  if(candidate){
    hostWrite=await recordScoutFacilityObservation(env,{
      event:'StationHost',
      kind:'facility_host',
      timestamp:observation.observedAt,
      system:observation.system,
      systemName:observation.system,
      systemAddress:observation.systemId64,
      facilityName:observation.stationName,
      marketId:observation.marketId,
      bodyId:candidate.bodyJournalId,
      bodyName:candidate.bodyName,
    });
  }

  return reply({
    ok:true,
    accepted:true,
    kind:'facility_visit',
    stored:Boolean(visitResult.stored),
    system:observation.system,
    station:observation.stationName,
    marketId:observation.marketId,
    updatedAt:observation.observedAt,
    hostResolved:Boolean(candidate),
    hostStored:Boolean(hostWrite?.stored),
    hostBodyId:candidate?.bodyJournalId??null,
    hostBodyName:candidate?.bodyName||'',
    scout:auth.label,
  },200);
}

async function handleFacilityHostObservation({body,auth,env}) {
  // v1.4.1/1.4.2 guessed a host inside the plugin. Accept those requests so
  // older installs do not error, but never promote them into the public Orrery.
  const system=cleanText(body?.systemName||body?.system,'',140);
  const marketId=safeInteger(body?.marketId);
  return reply({
    ok:true,
    accepted:true,
    kind:'facility_host',
    stored:false,
    quarantined:true,
    system,
    marketId,
    scout:auth.label,
  },200);
}

async function handleFacilityObservation({body,auth,env}) {
  const observation=normalizeScoutFacilityObservation(body);
  if(!observation)return reply({ok:false,error:'invalid_facility_observation'},400);
  if(Date.parse(observation.observedAt)>Date.now()+15*60*1000){
    return reply({ok:false,error:'journal_timestamp_in_future'},422);
  }
  if(!systemAuthorized(auth,observation.system)){
    const claimAuthorized=auth.ownerId
      ? await hasActiveScoutClaim(env,{system:observation.system,ownerId:auth.ownerId,at:new Date()})
      : false;
    if(!claimAuthorized){
      return reply({ok:false,error:'system_not_authorized',system:observation.system},403);
    }
  }

  const result=await recordScoutFacilityObservation(env,body);
  if(result?.error){
    const status=result.error==='bgs_storage_not_configured'?503
      : result.error==='journal_timestamp_in_future'?422
      : 400;
    return reply({ok:false,error:result.error},status);
  }

  return reply({
    ok:true,
    accepted:true,
    kind:'facility',
    stored:Boolean(result.stored),
    system:observation.system,
    facility:observation.facilityName,
    marketId:observation.marketId,
    bodyId:observation.bodyJournalId,
    updatedAt:observation.observedAt,
    scout:auth.label,
  },200);
}

async function handleMarketSnapshot({body,auth,env}) {
  if (!env?.TRADES || typeof env.TRADES.get !== 'function' || typeof env.TRADES.put !== 'function') {
    return reply({ok:false,error:'trade_storage_not_configured'},503);
  }

  const observedAt=normalizeTime(body?.timestamp || body?.observedAt);
  if (!observedAt) return reply({ok:false,error:'invalid_market_snapshot'},400);
  if (new Date(observedAt).getTime() > Date.now() + 15 * 60 * 1000) {
    return reply({ok:false,error:'journal_timestamp_in_future'},422);
  }

  const result=await recordScoutMarketSnapshot(env,{
    ...body,
    observedAt,
    scoutTokenId:auth.id,
    scoutLabel:auth.label,
    scoutOwnerId:auth.ownerId || '',
    scoutCommander:auth.ownerCommander || auth.label || 'Mongrel Scout',
  });

  if (!result?.stored && result?.error) {
    return reply({ok:false,error:result.error},result.error==='trade_storage_not_configured'?503:400);
  }

  await noteTokenUse(env,auth.id,{
    system:result.systemName || cleanText(body?.systemName || body?.system,'',140),
    starPos:normalizeCoordinates(body?.starPos),
    updatedAt:result.observedAt || observedAt,
  });

  return reply({
    ok:true,
    accepted:true,
    kind:'market',
    stored:Boolean(result.stored),
    system:result.systemName,
    station:result.stationName,
    marketId:result.marketId,
    updatedAt:result.observedAt,
    commodityCount:result.commodityCount,
    scout:auth.label,
  },200);
}

async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token.startsWith('mscout_') || token.length > 180) return null;
  const hash = await sha256Hex(token);
  const state = await readTokens(env);
  for (const value of Object.values(state.tokens)) {
    if (value?.hash && constantTimeEqual(value.hash, hash)) return value;
  }
  return null;
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const event = cleanText(value.event, '', 40);
  const system = cleanText(value.system, '', 140);
  const updatedAt = normalizeTime(value.timestamp);
  if (!ACCEPTED_EVENTS.has(event) || !system || !updatedAt) return null;

  const factions = Array.isArray(value.factions)
    ? value.factions.slice(0,MAX_FACTIONS).map(normalizeFaction).filter(Boolean)
    : [];
  if (!factions.length) return null;

  const conflicts = Array.isArray(value.conflicts)
    ? value.conflicts.slice(0,MAX_CONFLICTS).map(normalizeConflict).filter(Boolean)
    : [];

  return {
    version:1,
    event,
    system,
    systemAddress:safeInteger(value.systemAddress),
    starPos:normalizeCoordinates(value.starPos),
    updatedAt,
    systemFaction:normalizeSystemFaction(value.systemFaction),
    security:cleanText(value.security, '', 80),
    population:safeInteger(value.population),
    factions,
    conflicts,
    source:'Mongrel Scout / EDMC',
  };
}

function normalizeFaction(value) {
  if (!value || typeof value !== 'object') return null;
  const name = cleanText(value.name, '', 120);
  if (!name) return null;
  return {
    name,
    influence:percentOrNull(value.influence),
    state:cleanText(value.state, 'None', 80),
    activeStates:stringList(value.activeStates, 12, 80),
    pendingStates:stringList(value.pendingStates, 12, 80),
    recoveringStates:stringList(value.recoveringStates, 12, 80),
    happiness:cleanText(value.happiness, '', 80),
  };
}

function normalizeConflict(value) {
  if (!value || typeof value !== 'object') return null;
  const faction1 = normalizeConflictSide(value.faction1);
  const faction2 = normalizeConflictSide(value.faction2);
  if (!faction1 || !faction2) return null;
  return {
    type:cleanText(value.type, '', 60),
    status:cleanText(value.status, '', 60),
    faction1,
    faction2,
  };
}
function normalizeConflictSide(value) {
  if (!value || typeof value !== 'object') return null;
  const name = cleanText(value.name, '', 120);
  if (!name) return null;
  const wonDays = Math.round(Number(value.wonDays));
  return {
    name,
    stake:cleanText(value.stake, '', 160),
    wonDays:Number.isFinite(wonDays) ? Math.max(0,Math.min(7,wonDays)) : 0,
  };
}
function normalizeSystemFaction(value) {
  if (!value || typeof value !== 'object') return {name:'',state:''};
  return {name:cleanText(value.name, '', 120),state:cleanText(value.state, '', 80)};
}

async function readTokens(env) {
  try {
    const stored = await env.DAILY_ORDERS.get(TOKENS_KEY, {type:'json'});
    if (!stored || typeof stored !== 'object') return {version:2,tokens:{}};
    const tokens = {};
    for (const [id,value] of Object.entries(stored.tokens || {})) {
      if (!value || typeof value !== 'object') continue;
      tokens[id] = {
        ...value,
        id:cleanText(value.id || id, '', 80),
        ownerId:cleanText(value.ownerId, '', 120),
        ownerCommander:cleanText(value.ownerCommander, '', 80),
        scope:normalizeScope(value.scope, 'trusted'),
        allowedSystems:normalizeAllowedSystems(value.allowedSystems),
      };
    }
    return {version:2,tokens};
  } catch { return {version:2,tokens:{}}; }
}
function normalizeScope(value, fallback = 'restricted') {
  const scope = String(value || '').trim().toLowerCase();
  return scope === 'trusted' || scope === 'restricted' ? scope : fallback;
}

function normalizeAllowedSystems(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    const name = cleanText(raw, '', 140);
    const key = norm(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 80) break;
  }
  return out;
}

function systemAuthorized(token, system) {
  if (normalizeScope(token?.scope, 'trusted') === 'trusted') return true;
  const key = norm(system);
  return normalizeAllowedSystems(token?.allowedSystems).some(name => norm(name) === key);
}

async function consumeRateLimit(env, tokenId) {
  const now = Date.now();
  const windowStart = Math.floor(now / 3600000) * 3600000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + 3600000 - now) / 1000));
  const key = `${RATE_KEY_PREFIX}${tokenId}:${windowStart}`;
  let count = 0;
  try {
    const stored = await env.DAILY_ORDERS.get(key, {type:'json'});
    count = Math.max(0, Math.round(Number(stored?.count) || 0));
  } catch (error) {
    console.error('Could not read Mongrel Scout rate counter', error);
  }
  if (count >= DEFAULT_RATE_LIMIT_PER_HOUR) {
    return {allowed:false,count,retryAfterSeconds};
  }
  try {
    await env.DAILY_ORDERS.put(
      key,
      JSON.stringify({count:count + 1,windowStart:new Date(windowStart).toISOString()}),
      {expirationTtl:7200},
    );
  } catch (error) {
    console.error('Could not write Mongrel Scout rate counter', error);
  }
  return {allowed:true,count:count + 1,retryAfterSeconds};
}

async function readSnapshots(env) {
  try {
    const stored = await env.DAILY_ORDERS.get(SNAPSHOTS_KEY, {type:'json'});
    return stored && typeof stored === 'object'
      ? {version:1,systems:stored.systems || {},conflictHistory:stored.conflictHistory || {}}
      : {version:1,systems:{},conflictHistory:{}};
  } catch { return {version:1,systems:{},conflictHistory:{}}; }
}
function conflictObservation(snapshot) {
  return validatedConflictObservation(snapshot);
}

function updateConflictHistory(state, snapshot) {
  if (!state.conflictHistory || typeof state.conflictHistory !== 'object') state.conflictHistory = {};
  const observation = conflictObservation(snapshot);
  const existing = state.conflictHistory[snapshot.system];

  if (!observation) {
    if (existing) delete state.conflictHistory[snapshot.system];
    return;
  }

  const sameType = existing && norm(existing.detail) === norm(observation.detail);
  if (!sameType || (observation.phase === 'pending' && existing?.lastPhase === 'active')) {
    state.conflictHistory[snapshot.system] = {
      system:snapshot.system,
      detail:observation.detail,
      pendingSeenAt:observation.phase === 'pending' ? snapshot.updatedAt : null,
      activeSeenAt:observation.phase === 'active' ? snapshot.updatedAt : null,
      lastPhase:observation.phase,
      lastSeenAt:snapshot.updatedAt,
    };
    return;
  }

  existing.lastPhase = observation.phase;
  existing.lastSeenAt = snapshot.updatedAt;
  if (observation.phase === 'pending' && !existing.pendingSeenAt) existing.pendingSeenAt = snapshot.updatedAt;
  if (observation.phase === 'active' && !existing.activeSeenAt) existing.activeSeenAt = snapshot.updatedAt;
}

async function noteTokenUse(env, id, snapshot) {
  try {
    const state = await readTokens(env);
    if (!state.tokens[id]) return;
    state.tokens[id] = {
      ...state.tokens[id],
      lastSeenAt:new Date().toISOString(),
      lastSystem:snapshot.system,
      lastCoords:snapshot.starPos||null,
      lastEventAt:snapshot.updatedAt,
    };
    await env.DAILY_ORDERS.put(TOKENS_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Could not update Mongrel Scout token activity', error);
  }
}

function stringList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,maxItems).map(item => cleanText(item, '', maxLength)).filter(Boolean);
}
function percentOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const percent = n <= 1 ? n * 100 : n;
  return Math.max(0,Math.min(100,percent));
}
function normalizeCoordinates(value) {
  const source=Array.isArray(value)
    ? {x:value[0],y:value[1],z:value[2]}
    : (value&&typeof value==='object'?value:null);
  if(!source)return null;
  const x=Number(source.x),y=Number(source.y),z=Number(source.z);
  return Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)?{x,y,z}:null;
}
function safeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}
function normalizeTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function compareTime(a,b) {
  const aa = new Date(a || 0).getTime();
  const bb = new Date(b || 0).getTime();
  return (Number.isFinite(aa)?aa:0) - (Number.isFinite(bb)?bb:0);
}
function norm(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g,' '); }
function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0,maxLength) : fallback;
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
function constantTimeEqual(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function storageReady(env) {
  return Boolean(env?.DAILY_ORDERS && typeof env.DAILY_ORDERS.get === 'function' && typeof env.DAILY_ORDERS.put === 'function');
}
function reply(value,status,extraHeaders = {}) {
  return json(value, {status,headers:{
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'null',
    ...extraHeaders,
  }});
}
