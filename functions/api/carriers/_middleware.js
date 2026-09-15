import { readSession } from '../../../lib/auth.js';

const REGISTRY_KEY = 'registry-v1';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const resource = (url.searchParams.get('resource') || (request.method === 'GET' ? 'registry' : '')).toLowerCase();
  const session = await readSession(request, env);

  if (request.method === 'PUT') {
    const body = await readJson(request.clone());
    if (body?.resource === 'carrier') {
      const carrier = await findCarrier(env, body.id);
      const blocked = carrierWriteBlock(carrier, session, env, false);
      if (blocked) return blocked;
    }
  }

  if (request.method === 'DELETE' && resource === 'carrier') {
    const carrier = await findCarrier(env, url.searchParams.get('id') || '');
    const blocked = carrierWriteBlock(carrier, session, env, true);
    if (blocked) return blocked;
  }

  const response = await context.next();

  if (request.method === 'GET' && resource === 'registry' && response.ok) {
    try {
      const payload = await response.clone().json();
      if (!Array.isArray(payload?.carriers)) return response;
      const registry = await readRegistry(env);
      const owners = new Map(registry.map(item => [item.id, item.ownerId]));

      payload.carriers = payload.carriers.map(carrier => {
        const ownerId = owners.get(carrier.id) || '';
        const isOwner = Boolean(session && ownerId && ownerId === session.sub);
        const isSiteAdmin = session?.access === 'site_admin';
        const isOfficer = session?.access === 'officer';
        const isAdminOwned = Boolean(ownerId && env.ADMIN_USER_ID && ownerId === env.ADMIN_USER_ID);

        return {
          ...carrier,
          canEdit: Boolean(session && (isOwner || isSiteAdmin || (isOfficer && !isAdminOwned))),
          canDelete: Boolean(session && (isOwner || isSiteAdmin)),
        };
      });

      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=UTF-8');
      headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      return new Response(JSON.stringify(payload), { status: response.status, headers });
    } catch {
      return response;
    }
  }

  return response;
}

function carrierWriteBlock(carrier, session, env, deleting) {
  if (!carrier || !session) return null;

  const isOwner = carrier.ownerId === session.sub;
  const isSiteAdmin = session.access === 'site_admin';
  const isAdminOwned = Boolean(env.ADMIN_USER_ID && carrier.ownerId === env.ADMIN_USER_ID);

  // The Site Admin's own carrier is owner-only. Officers cannot alter it.
  if (isAdminOwned && !isOwner) return forbidden('protected_admin_carrier');

  // Owners may manage their own carrier. Site Admin may manage any carrier.
  if (isOwner || isSiteAdmin) return null;

  // Officers may edit other members' carriers, but never delete them.
  if (!deleting && session.access === 'officer') return null;

  return forbidden('not_carrier_owner');
}

async function findCarrier(env, id) {
  if (!id) return null;
  const registry = await readRegistry(env);
  return registry.find(item => item.id === id) || null;
}

async function readRegistry(env) {
  if (!env.CARRIERS || typeof env.CARRIERS.get !== 'function') return [];
  try {
    const value = await env.CARRIERS.get(REGISTRY_KEY, { type: 'json' });
    return Array.isArray(value) ? value : [];
  } catch {
    try {
      const raw = await env.CARRIERS.get(REGISTRY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function forbidden(error) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
