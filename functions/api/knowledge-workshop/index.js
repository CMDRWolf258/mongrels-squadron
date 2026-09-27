import { json, readSession } from '../../../lib/auth.js';
import {
  createKnowledgeWorkshopItem,
  getKnowledgeWorkshopItems,
  summarizeKnowledgeWorkshop,
  updateKnowledgeWorkshopItem,
} from '../../../lib/knowledge-workshop.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const storage = requireStorage(env);
  if (storage) return storage;
  const items = await getKnowledgeWorkshopItems(env);
  return reply({ ok:true, summary:summarizeKnowledgeWorkshop(items), items });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const origin = validateSameOrigin(request);
  if (origin) return origin;
  const storage = requireStorage(env);
  if (storage) return storage;

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  const item = await createKnowledgeWorkshopItem(env, body?.item || body, auth.session.displayName);
  if (!item) return reply({ ok:false, error:'topic_and_answer_required' }, 400);
  const items = await getKnowledgeWorkshopItems(env);
  return reply({ ok:true, item, summary:summarizeKnowledgeWorkshop(items) }, 201);
}

export async function onRequestPatch({ request, env }) {
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;
  const origin = validateSameOrigin(request);
  if (origin) return origin;
  const storage = requireStorage(env);
  if (storage) return storage;

  let body;
  try { body = await request.json(); }
  catch { return reply({ ok:false, error:'invalid_json' }, 400); }

  const id = clean(body?.id, '', 100);
  if (!id) return reply({ ok:false, error:'knowledge_id_required' }, 400);
  const item = await updateKnowledgeWorkshopItem(env, id, body?.item || body?.patch || {}, auth.session.displayName);
  if (!item) return reply({ ok:false, error:'knowledge_item_not_found_or_invalid' }, 404);
  const items = await getKnowledgeWorkshopItems(env);
  return reply({ ok:true, item, summary:summarizeKnowledgeWorkshop(items) });
}

async function requireSiteAdmin(request, env) {
  const session = await readSession(request, env);
  if (!session) return { response:reply({ ok:false, error:'authentication_required' }, 401) };
  if (session.access !== 'site_admin') return { response:reply({ ok:false, error:'site_admin_required' }, 403) };
  return { session };
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
  if (origin !== expected || marker !== 'knowledge-workshop-admin') return reply({ ok:false, error:'request_validation_failed' }, 403);
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
