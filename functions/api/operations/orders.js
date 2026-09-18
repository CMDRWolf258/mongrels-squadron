import { json, readSession } from '../../../lib/auth.js';

const ALLOWED_ACCESS = new Set(['member', 'officer', 'site_admin']);
const MANAGER_ACCESS = new Set(['officer', 'site_admin']);
const KV_KEY = 'current';

export async function onRequestGet({ request, env }) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;

  const orders = await readOrders(env);

  return json(
    {
      ok: true,
      viewer: {
        displayName: auth.session.displayName,
        access: auth.session.access,
      },
      canManage: MANAGER_ACCESS.has(auth.session.access),
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

  const orders = normalizeOrders(body, {
    configured: true,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.session.displayName || auth.session.username || 'Mongrel Officer',
    cycleId: cleanText(body?.cycleId, '', 100) || crypto.randomUUID(),
  });

  await env.DAILY_ORDERS.put(KV_KEY, JSON.stringify(orders));

  return json(
    {
      ok: true,
      viewer: {
        displayName: auth.session.displayName,
        access: auth.session.access,
      },
      canManage: true,
      ...orders,
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

  await env.DAILY_ORDERS.delete(KV_KEY);

  return json(
    {
      ok: true,
      viewer: {
        displayName: auth.session.displayName,
        access: auth.session.access,
      },
      canManage: true,
      ...emptyOrders(),
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
    if (stored) return normalizeOrders(stored);
  }

  // Temporary fallback retained for anyone who used the v38 environment-variable method.
  if (env.DAILY_ORDERS_JSON) {
    try {
      return normalizeOrders(JSON.parse(env.DAILY_ORDERS_JSON));
    } catch (error) {
      console.error('DAILY_ORDERS_JSON is not valid JSON', error);
    }
  }

  return emptyOrders();
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
    orders: list.map((order, index) => normalizeOrder(order, index)),
    officerNote: cleanText(source.officerNote, '', 1200) || null,
  };
}

function normalizeOrder(order, index) {
  const source = order && typeof order === 'object' ? order : {};
  return {
    id: cleanText(source.id, `order-${index + 1}`, 80),
    system: cleanText(source.system, '', 120),
    priority: cleanText(source.priority, '', 40),
    task: cleanText(source.task, 'Operational task', 220),
    detail: cleanText(source.detail, '', 900),
    status: cleanText(source.status, '', 60),
    reporting: normalizeReporting(source.reporting, source.task, source.detail),
  };
}

function normalizeReporting(value, task, detail) {
  const source = value && typeof value === 'object' ? value : {};
  const text = [task, detail].filter(Boolean).join(' ');
  let type = source.type === 'cz' || source.type === 'inf' ? source.type : '';
  if (!type && /\\b(?:CZ|Conflict Zones?)\\b/i.test(text)) type = 'cz';
  if (!type && /\\bINF\\b/i.test(text)) type = 'inf';
  let target = Number.isFinite(Number(source.target)) && Number(source.target) >= 0 ? Number(source.target) : null;
  if (target === null && type === 'cz') {
    const match = text.match(/([0-9]+(?:\\.[0-9]+)?)\\s*(?:CZ\\s*)?(?:points?|pts?)\\b/i);
    if (match) target = Number(match[1]);
  }
  if (target === null && type === 'inf') {
    const match = text.match(/([0-9]+(?:\\.[0-9]+)?)\\s*INF\\b/i);
    if (match) target = Number(match[1]);
  }
  return type ? { type, target, blitz: Boolean(source.blitz || /\\bBLITZ\\b/i.test(text)) } : null;
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}
