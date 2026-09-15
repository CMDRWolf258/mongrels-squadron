import { json, readSession } from '../../../../lib/auth.js';
import { getAssistantKnowledgeGaps, summarizeAssistantKnowledgeGaps, updateAssistantKnowledgeGap } from '../../../../lib/assistant-gap-log.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth) return auth;
  const storage = requireStorage(env);
  if (storage) return storage;

  const items = await getAssistantKnowledgeGaps(env);
  return reply({ ok:true, summary:summarizeAssistantKnowledgeGaps(items), items });
}

export async function onRequestPatch({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth) return auth;
  const origin = validateSameOrigin(request);
  if (origin) return origin;
  const storage = requireStorage(env);
  if (storage) return storage;

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  const id = clean(body?.id, '', 100);
  const status = clean(body?.status, '', 20).toLowerCase();
  const adminNote = typeof body?.adminNote === 'string' ? body.adminNote : undefined;
  if (!id) return reply({ ok:false, error:'gap_id_required' }, 400);
  if (!['open','resolved','dismissed'].includes(status)) return reply({ ok:false, error:'invalid_status' }, 400);

  const item = await updateAssistantKnowledgeGap(env, id, { status, adminNote });
  if (!item) return reply({ ok:false, error:'gap_not_found' }, 404);
  return reply({ ok:true, item });
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) return reply({ ok:false, error:'authentication_required' }, 401);
  if (session.access !== 'site_admin') return reply({ ok:false, error:'site_admin_required' }, 403);
  return null;
}

function requireStorage(env) {
  if (!env.AI_USAGE || typeof env.AI_USAGE.get !== 'function' || typeof env.AI_USAGE.put !== 'function') {
    return reply({ ok:false, error:'assistant_usage_storage_not_configured' }, 503);
  }
  return null;
}

function validateSameOrigin(request) {
  const origin = request.headers.get('Origin');
  const expected = new URL(request.url).origin;
  const marker = request.headers.get('X-Mongrels-Request');
  if (origin !== expected || marker !== 'assistant-gap-admin') return reply({ ok:false, error:'request_validation_failed' }, 403);
  return null;
}

function clean(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0,max) : fallback;
}

function reply(data,status=200){
  return json(data,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
}
