import { json, readSession } from '../../../lib/auth.js';

const ALLOWED_ACCESS = new Set(['member', 'officer', 'site_admin']);

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);

  if (!session) {
    return json(
      { ok: false, error: 'authentication_required' },
      { status: 401, headers: privateHeaders() },
    );
  }

  if (!ALLOWED_ACCESS.has(session.access)) {
    return json(
      { ok: false, error: 'member_access_required' },
      { status: 403, headers: privateHeaders() },
    );
  }

  let orders = emptyOrders();

  if (env.DAILY_ORDERS_JSON) {
    try {
      const parsed = JSON.parse(env.DAILY_ORDERS_JSON);
      orders = normalizeOrders(parsed);
    } catch (error) {
      console.error('DAILY_ORDERS_JSON is not valid JSON', error);
      return json(
        { ok: false, error: 'orders_configuration_error' },
        { status: 500, headers: privateHeaders() },
      );
    }
  }

  return json(
    {
      ok: true,
      viewer: {
        displayName: session.displayName,
        access: session.access,
      },
      canManage: session.access === 'officer' || session.access === 'site_admin',
      ...orders,
    },
    { headers: privateHeaders() },
  );
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
    orders: [],
    officerNote: null,
  };
}

function normalizeOrders(value) {
  const source = value && typeof value === 'object' ? value : {};
  const list = Array.isArray(source.orders) ? source.orders.slice(0, 24) : [];

  return {
    configured: true,
    title: cleanText(source.title, 'Squadron Daily Orders', 120),
    briefing: cleanText(source.briefing, '', 1200),
    updatedAt: cleanText(source.updatedAt, '', 80) || null,
    orders: list.map((order, index) => normalizeOrder(order, index)),
    officerNote: cleanText(source.officerNote, '', 1200) || null,
  };
}

function normalizeOrder(order, index) {
  const source = order && typeof order === 'object' ? order : {};
  return {
    id: cleanText(source.id, `order-${index + 1}`, 80),
    priority: cleanText(source.priority, '', 40),
    task: cleanText(source.task, 'Operational task', 220),
    detail: cleanText(source.detail, '', 900),
    status: cleanText(source.status, '', 60),
  };
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}
