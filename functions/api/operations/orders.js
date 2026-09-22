import { json, readSession } from '../../../lib/auth.js';
import { deriveLogicalOrderKey, orderRevisionFingerprint } from '../../../lib/order-identity.js';
import { decorateDailyOrdersForTiming } from '../../../lib/daily-order-cycle.js';
import { buildOrderRewardPolicies, readRewardSettings } from '../../../lib/reward-rules.js';
import { clearDailyOrdersDiscord, syncDailyOrdersDiscord } from '../../../lib/daily-orders-discord.js';
import {
  ensureOrderHistoryBaseline,
  markOrderPublicationApplied,
  markOrderPublicationFailed,
  prepareOrderPublication,
} from '../../../lib/order-history.js';

const ALLOWED_ACCESS = new Set(['member', 'officer', 'site_admin']);
const MANAGER_ACCESS = new Set(['officer', 'site_admin']);
const KV_KEY = 'current';

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;

  const orders = await readOrders(env);
  const rewardState = await readRewardSettings(env);
  const rewardPolicies = buildOrderRewardPolicies(orders?.orders, rewardState.settings);

  return json(
    {
      ok: true,
      viewer: {
        displayName: auth.session.displayName,
        access: auth.session.access,
      },
      canManage: MANAGER_ACCESS.has(auth.session.access),
      rewardPolicies,
      ...orders,
    },
    { headers: privateHeaders() },
  );
}

export async function onRequestPut({ request, env }) {
  const auth = await requireManager(request, env);
  if (auth.response) return auth.response;

  const originError = validateSameOrigin(request);
  if (originError) return originError;

  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') {
    return json(
      { ok: false, error: 'orders_storage_not_configured' },
      { status: 503, headers: privateHeaders() },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: privateHeaders() },
    );
  }

  const now = new Date().toISOString();
  const actor = auth.session.displayName || auth.session.username || 'Mongrel Officer';
  const previous = await readOrders(env);
  try {
    await ensureOrderHistoryBaseline(env,previous,null,actor);
  } catch (error) {
    console.error('Could not initialize Daily Order history baseline before publication',error);
    return json(
      { ok:false, error:'order_history_baseline_failed' },
      { status:503, headers:privateHeaders() },
    );
  }
  const publishMode = cleanText(body?.publishMode, '', 40).toLowerCase();

  const orders = publishMode === 'reconcile'
    ? reconcileOrders(previous, body, now, actor)
    : replaceOrders(previous, body, now, actor);

  if (orders.orders.length > 24) {
    return json(
      { ok:false, error:'too_many_orders', count:orders.orders.length },
      { status:400, headers:privateHeaders() },
    );
  }

  const history=await prepareOrderPublication(env,{
    before:previous,
    after:orders,
    actor,
    action:publishMode === 'reconcile' ? 'reconcile' : 'replace',
    reconcileSystems:Array.isArray(body?.reconcileSystems)?body.reconcileSystems:[],
  });

  try {
    await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(orders));
  } catch (error) {
    try { await markOrderPublicationFailed(env,history,error); }
    catch (historyError) { console.error('Could not mark failed Daily Order publication history',historyError); }
    throw error;
  }

  let historyState='prepared';
  try {
    await markOrderPublicationApplied(env,history);
    historyState='applied';
  } catch (error) {
    console.error('Daily Orders published but history finalization remained prepared',error);
  }

  const discord=await syncDailyOrdersDiscord(env,{
    document:orders,
    actor,
    missionControlUrl:missionControlUrlForRequest(request),
    publicationId:history.record.publicationId,
  });

  return json(
    {
      ok: true,
      viewer: {
        displayName: auth.session.displayName,
        access: auth.session.access,
      },
      canManage: true,
      historyPublicationId:history.record.publicationId,
      historyState,
      discord,
      ...await decorateDailyOrdersForTiming(env,orders),
    },
    { headers: privateHeaders() },
  );
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireManager(request, env);
  if (auth.response) return auth.response;

  const originError = validateSameOrigin(request);
  if (originError) return originError;

  if (!env.DAILY_ORDERS || typeof env.DAILY_ORDERS.delete !== 'function') {
    return json(
      { ok: false, error: 'orders_storage_not_configured' },
      { status: 503, headers: privateHeaders() },
    );
  }

  const previous=await readOrders(env);
  const actor=auth.session.displayName || auth.session.username || 'Mongrel Officer';
  try {
    await ensureOrderHistoryBaseline(env,previous,null,actor);
  } catch (error) {
    console.error('Could not initialize Daily Order history baseline before deletion',error);
    return json(
      { ok:false, error:'order_history_baseline_failed' },
      { status:503, headers:privateHeaders() },
    );
  }
  const empty=emptyOrders();
  const history=await prepareOrderPublication(env,{
    before:previous,
    after:empty,
    actor,
    action:'delete',
    reconcileSystems:[...new Set((previous.orders||[]).map(order=>order.system).filter(Boolean))],
  });

  try {
    await env.DAILY_ORDERS.delete(KV_KEY);
  } catch (error) {
    try { await markOrderPublicationFailed(env,history,error); }
    catch (historyError) { console.error('Could not mark failed Daily Order deletion history',historyError); }
    throw error;
  }

  let historyState='prepared';
  try {
    await markOrderPublicationApplied(env,history);
    historyState='applied';
  } catch (error) {
    console.error('Daily Orders deleted but history finalization remained prepared',error);
  }

  const discord=await clearDailyOrdersDiscord(env,{
    previous,
    actor,
    missionControlUrl:missionControlUrlForRequest(request),
    publicationId:history.record.publicationId,
  });

  return json(
    {
      ok: true,
      viewer: {
        displayName: auth.session.displayName,
        access: auth.session.access,
      },
      canManage: true,
      historyPublicationId:history.record.publicationId,
      historyState,
      discord,
      ...empty,
    },
    { headers: privateHeaders() },
  );
}

async function requireMember(request, env) {
  const session = await readSession(request, env);

  if (!session) {
    return {
      response: json(
        { ok: false, error: 'authentication_required' },
        { status: 401, headers: privateHeaders() },
      ),
    };
  }

  if (!ALLOWED_ACCESS.has(session.access)) {
    return {
      response: json(
        { ok: false, error: 'member_access_required' },
        { status: 403, headers: privateHeaders() },
      ),
    };
  }

  return { session };
}

async function requireManager(request, env) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth;

  if (!MANAGER_ACCESS.has(auth.session.access)) {
    return {
      response: json(
        { ok: false, error: 'officer_access_required' },
        { status: 403, headers: privateHeaders() },
      ),
    };
  }

  return auth;
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');

  if (origin !== expected || marker !== 'daily-orders-editor') {
    return json(
      { ok: false, error: 'request_validation_failed' },
      { status: 403, headers: privateHeaders() },
    );
  }

  return null;
}

async function readOrders(env) {
  if (env.DAILY_ORDERS && typeof env.DAILY_ORDERS.get === 'function') {
    const stored = await env.DAILY_ORDERS.get(KV_KEY, { type: 'json' });
    if (stored) return decorateDailyOrdersForTiming(env,normalizeOrders(stored));
  }

  // Temporary fallback retained for anyone who used the v38 environment-variable method.
  if (env.DAILY_ORDERS_JSON) {
    try {
      return decorateDailyOrdersForTiming(env,normalizeOrders(JSON.parse(env.DAILY_ORDERS_JSON)));
    } catch (error) {
      console.error('DAILY_ORDERS_JSON is not valid JSON', error);
    }
  }

  return emptyOrders();
}

function missionControlUrlForRequest(request) {
  const url = new URL('/operations/', request.url);
  url.hash = 'daily-orders';
  return url.toString();
}

function privateHeaders() {
  return {
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  };
}

function emptyOrders() {
  return {
    configured: false,
    title: 'No Daily Orders Posted',
    briefing: 'Your Mongrel member access is verified. No private operational orders have been published for this cycle yet.',
    updatedAt: null,
    updatedBy: null,
    cycleId: null,
    cycleStartedAt: null,
    orders: [],
    officerNote: null,
  };
}

function normalizeOrders(value, overrides = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const list = Array.isArray(source.orders) ? source.orders.slice(0, 24) : [];

  return {
    configured: overrides.configured ?? source.configured !== false,
    title: cleanText(source.title, 'Squadron Daily Orders', 120),
    briefing: cleanText(source.briefing, '', 1200),
    updatedAt: overrides.updatedAt ?? (cleanText(source.updatedAt, '', 80) || null),
    updatedBy: overrides.updatedBy ?? (cleanText(source.updatedBy, '', 120) || null),
    cycleId: overrides.cycleId ?? (cleanText(source.cycleId, '', 100) || null),
    cycleStartedAt: overrides.cycleStartedAt ?? (cleanText(source.cycleStartedAt, '', 80) || null),
    orders: list.map((order, index) => normalizeOrder(order, index)),
    officerNote: cleanText(source.officerNote, '', 1200) || null,
  };
}

function normalizeOrder(order, index) {
  const source = order && typeof order === 'object' ? order : {};
  const normalized = {
    id: cleanText(source.id, `order-${index + 1}`, 80),
    system: cleanText(source.system, '', 120),
    faction: cleanText(source.faction, '', 120),
    kind: cleanText(source.kind, '', 60),
    source: cleanText(source.source, '', 60),
    priority: cleanText(source.priority, '', 40),
    task: cleanText(source.task, 'Operational task', 220),
    detail: cleanText(source.detail, '', 900),
    status: cleanText(source.status, '', 60),
    reporting: normalizeReporting(source.reporting, source.task, source.detail),
    logicalKey:cleanText(source.logicalKey, '', 520),
    revision:Math.max(1, Math.floor(Number(source.revision)||1)),
    createdAt:cleanText(source.createdAt, '', 80) || null,
    revisedAt:cleanText(source.revisedAt, '', 80) || null,
  };
  normalized.logicalKey = normalized.logicalKey || deriveLogicalOrderKey(normalized);
  return normalized;
}

function replaceOrders(previous, body, now, actor) {
  const requestedCycle = cleanText(body?.cycleId, '', 100);
  const cycleId = requestedCycle || crypto.randomUUID();
  const sameCycle = Boolean(previous?.cycleId && requestedCycle && previous.cycleId === requestedCycle);
  const normalized = normalizeOrders(body, {
    configured:true,
    updatedAt:now,
    updatedBy:actor,
    cycleId,
    cycleStartedAt:sameCycle
      ? (previous.cycleStartedAt || previous.updatedAt || now)
      : now,
  });
  const previousOrders = sameCycle && Array.isArray(previous?.orders) ? previous.orders : [];
  normalized.orders = normalized.orders.map((order,index) => reconcileOneOrder(
    order, previousOrders, now, index, normalized.cycleStartedAt || previous?.updatedAt || now
  ));
  return normalized;
}

function reconcileOrders(previous, body, now, actor) {
  const current = previous?.configured ? normalizeOrders(previous) : emptyOrders();
  const cycleId = current.cycleId || cleanText(body?.cycleId, '', 100) || crypto.randomUUID();
  const cycleStartedAt = current.cycleStartedAt || current.updatedAt || now;
  const incomingDoc = normalizeOrders(body, {
    configured:true,
    updatedAt:now,
    updatedBy:actor,
    cycleId,
    cycleStartedAt,
  });
  const incomingSystems = new Set(
    (Array.isArray(body?.reconcileSystems) ? body.reconcileSystems : incomingDoc.orders.map(order => order.system))
      .map(norm)
      .filter(Boolean)
  );
  const currentOrders = Array.isArray(current.orders) ? current.orders : [];
  const kept = currentOrders.filter(order => !incomingSystems.has(norm(order.system)));
  const reconciled = incomingDoc.orders.map((order,index) => reconcileOneOrder(
    order, currentOrders, now, index, cycleStartedAt
  ));
  const orders = [...kept, ...reconciled];

  return {
    ...incomingDoc,
    cycleId,
    cycleStartedAt,
    orders,
  };
}

function reconcileOneOrder(order, previousOrders, now, index, startFallback = now) {
  const logicalKey = deriveLogicalOrderKey(order);
  const incomingId = cleanText(order?.id, '', 80);
  const prior = previousOrders.find(item => incomingId && cleanText(item?.id, '', 80) === incomingId)
    || previousOrders.find(item =>
      cleanText(item?.logicalKey, '', 520) === logicalKey
      || deriveLogicalOrderKey(item) === logicalKey
    );
  if (!prior) {
    return {
      ...order,
      id:crypto.randomUUID(),
      logicalKey,
      revision:1,
      createdAt:now,
      revisedAt:now,
    };
  }
  const before = orderRevisionFingerprint(prior);
  const after = orderRevisionFingerprint({...order,logicalKey});
  const changed = before !== after;
  return {
    ...order,
    id:cleanText(prior.id, '', 80) || crypto.randomUUID(),
    logicalKey,
    revision:Math.max(1,Math.floor(Number(prior.revision)||1)) + (changed ? 1 : 0),
    createdAt:cleanText(prior.createdAt, '', 80) || currentOrderStart(prior, startFallback),
    revisedAt:changed ? now : (cleanText(prior.revisedAt, '', 80) || now),
  };
}

function currentOrderStart(order, fallback) {
  return cleanText(order?.createdAt, '', 80)
    || cleanText(order?.revisedAt, '', 80)
    || fallback;
}

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
}

function normalizeReporting(value, task, detail) {
  const source = value && typeof value === 'object' ? value : {};
  const text = [task, detail].filter(Boolean).join(' ');
  const allowedTypes = new Set(['cz', 'inf', 'bounties', 'trade', 'exploration']);
  let type = allowedTypes.has(source.type) ? source.type : '';
  if (!type && /\b(?:CZ|Conflict Zones?)\b/i.test(text)) type = 'cz';
  if (!type && /\bINF\b/i.test(text)) type = 'inf';
  if (!type && /\bbount(?:y|ies)\b[^.]{0,80}\bvouchers?\b|\bbounty vouchers?\b/i.test(text)) type = 'bounties';
  if (!type && /\bexploration data\b/i.test(text)) type = 'exploration';
  if (!type && /\bprofitable trade\b|\btrade profit\b/i.test(text)) type = 'trade';
  const explicitTarget = source.target === null || source.target === undefined || source.target === '' ? null : Number(source.target);
  let target = Number.isFinite(explicitTarget) && explicitTarget >= 0 ? explicitTarget : null;
  if (target === null && type === 'cz') {
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:CZ\s*)?(?:points?|pts?)\b/i);
    if (match) target = Number(match[1]);
  }
  if (target === null && type === 'inf') {
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*INF\b/i);
    if (match) target = Number(match[1]);
  }
  if (target === null && ['bounties', 'trade', 'exploration'].includes(type)) {
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*M\s*Cr\b/i);
    if (match) target = Number(match[1]);
  }
  return type ? { type, target, blitz: Boolean(source.blitz || /\bBLITZ\b/i.test(text)) } : null;
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}
