import { KNOWLEDGE_WORKSHOP_SEEDS } from './knowledge-workshop-seed.js';

const STORE_KEY = 'knowledge-workshop:v1';
const MAX_ITEMS = 1200;
const STATUSES = new Set(['draft','review','approved','retired']);
const CONFIDENCE = new Set(['unverified','anecdotal','mixed','strong','tested']);
const STABILITY = new Set(['stable','patch-sensitive','experimental']);

export async function getKnowledgeWorkshopItems(env) {
  const merged = new Map();
  for (const raw of Array.isArray(KNOWLEDGE_WORKSHOP_SEEDS) ? KNOWLEDGE_WORKSHOP_SEEDS : []) {
    const item = normalizeItem(raw, { origin:'research', allowMissingId:false });
    if (item) merged.set(item.id, item);
  }
  for (const raw of await readStoredItems(env)) {
    const item = normalizeItem(raw, { origin:raw?.origin || 'manual', allowMissingId:false });
    if (item) merged.set(item.id, item);
  }
  return [...merged.values()].sort(sortItems);
}

export async function createKnowledgeWorkshopItem(env, input, actor='Site Admin') {
  const now = new Date().toISOString();
  const raw = {
    ...(input && typeof input === 'object' ? input : {}),
    id: clean(input?.id, makeId(), 100),
    origin: clean(input?.origin, 'manual', 30),
    createdAt: now,
    updatedAt: now,
    updatedBy: clean(actor, 'Site Admin', 100),
  };
  const item = normalizeItem(raw, { origin:'manual', allowMissingId:false });
  if (!item || !item.topic || !item.answer) return null;
  if (item.status === 'approved') item.reviewedAt = now;
  await upsertStored(env, item);
  return item;
}

export async function updateKnowledgeWorkshopItem(env, id, patch, actor='Site Admin') {
  const current = (await getKnowledgeWorkshopItems(env)).find(item => item.id === id);
  if (!current) return null;
  const now = new Date().toISOString();
  const next = normalizeItem({
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {}),
    id: current.id,
    origin: current.origin,
    createdAt: current.createdAt || now,
    updatedAt: now,
    updatedBy: clean(actor, 'Site Admin', 100),
  }, { origin:current.origin || 'manual', allowMissingId:false });
  if (!next || !next.topic || !next.answer) return null;
  if (next.status === 'approved' && current.status !== 'approved') next.reviewedAt = now;
  if (next.status === 'approved' && !next.reviewedAt) next.reviewedAt = now;
  await upsertStored(env, next);
  return next;
}

export async function getPublishedWorkshopKnowledge(env) {
  const items = await getKnowledgeWorkshopItems(env);
  const approved = items.filter(item => item.status === 'approved' && item.assistantVisible !== false);
  const entries = approved.map(toAssistantEntry);
  const reviewedAt = approved.map(item => item.reviewedAt || item.updatedAt || '').filter(Boolean).sort().pop() || null;
  return {
    version: 'workshop-v1',
    scope: 'Site Admin-reviewed Mongrel Know-How from the private Knowledge Workshop.',
    reviewedAt,
    entries,
  };
}

export function summarizeKnowledgeWorkshop(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    total: list.length,
    draft: list.filter(item => item.status === 'draft').length,
    review: list.filter(item => item.status === 'review').length,
    approved: list.filter(item => item.status === 'approved').length,
    retired: list.filter(item => item.status === 'retired').length,
  };
}

async function upsertStored(env, item) {
  const stored = await readStoredItems(env);
  const index = stored.findIndex(existing => existing && existing.id === item.id);
  if (index >= 0) stored[index] = item;
  else stored.unshift(item);
  await env.AI_USAGE.put(STORE_KEY, JSON.stringify(stored.slice(0, MAX_ITEMS)));
}

async function readStoredItems(env) {
  if (!env?.AI_USAGE || typeof env.AI_USAGE.get !== 'function') return [];
  try {
    const value = await env.AI_USAGE.get(STORE_KEY, { type:'json' });
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  } catch {
    try {
      const raw = await env.AI_USAGE.get(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function normalizeItem(raw, { origin='manual', allowMissingId=false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clean(raw.id, allowMissingId ? makeId() : '', 100);
  if (!id) return null;
  const status = STATUSES.has(raw.status) ? raw.status : 'draft';
  const confidence = CONFIDENCE.has(raw.confidence) ? raw.confidence : 'unverified';
  const stability = STABILITY.has(raw.stability) ? raw.stability : 'stable';
  const sources = normalizeSources(raw.sources);
  return {
    id,
    topic: clean(raw.topic, '', 180),
    question: clean(raw.question, '', 900),
    category: clean(raw.category, 'General', 120),
    answer: clean(raw.answer ?? raw.ruleOfThumb, '', 4000),
    details: cleanList(raw.details, 18, 700),
    keywords: cleanList(raw.keywords ?? raw.aliases, 40, 140),
    sourceClaim: clean(raw.sourceClaim, '', 3500),
    fieldNotes: clean(raw.fieldNotes, '', 3500),
    sources,
    status,
    confidence,
    stability,
    gameVersion: clean(raw.gameVersion, '', 80),
    assistantVisible: raw.assistantVisible !== false,
    origin: clean(raw.origin, origin, 30),
    createdAt: clean(raw.createdAt, '', 40),
    updatedAt: clean(raw.updatedAt, '', 40),
    reviewedAt: clean(raw.reviewedAt, '', 40),
    updatedBy: clean(raw.updatedBy, '', 100),
  };
}

function toAssistantEntry(item) {
  const details = [...item.details];
  if (item.sourceClaim) details.push('Source/context claim: ' + item.sourceClaim);
  if (item.fieldNotes) details.push('Mongrel field note: ' + item.fieldNotes);
  const keywords = [...new Set([
    ...item.keywords,
    item.question,
    item.topic,
  ].map(value => clean(value, '', 180)).filter(Boolean))];
  return {
    id: 'workshop-' + item.id,
    category: item.category || 'Mongrel Know-How',
    topic: item.topic,
    question: item.question,
    keywords,
    ruleOfThumb: item.answer,
    mongrelGuidance: item.answer,
    details,
    sourceClaim: item.sourceClaim,
    fieldNotes: item.fieldNotes,
    sources: item.sources,
    reviewedAt: item.reviewedAt || item.updatedAt || null,
    stability: item.stability,
    confidence: item.confidence,
    evidence: item.confidence,
    gameVersion: item.gameVersion || null,
    curatedBy: 'Mongrel Knowledge Workshop',
  };
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 16).map(source => {
    if (!source || typeof source !== 'object') return null;
    const url = safeUrl(source.url);
    const name = clean(source.name, url || 'Source', 180);
    if (!name && !url) return null;
    return {
      name,
      url,
      type: clean(source.type, '', 60),
      note: clean(source.note, '', 700),
    };
  }).filter(Boolean);
}

function safeUrl(value) {
  const text = clean(value, '', 900);
  if (!text) return '';
  try {
    const url = new URL(text);
    return ['http:','https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function cleanList(value, maxItems, maxLength) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]+/) : [];
  return [...new Set(list.map(item => clean(item, '', maxLength)).filter(Boolean))].slice(0, maxItems);
}

function clean(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, max) : fallback;
}

function makeId() {
  return 'know-' + crypto.randomUUID();
}

function sortItems(a, b) {
  const rank = { review:0, draft:1, approved:2, retired:3 };
  const diff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
  if (diff) return diff;
  return Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0);
}
