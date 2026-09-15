const GAP_KEY = 'assistant-knowledge-gaps:v1';
const MAX_GAPS = 250;
const VALID_STATUSES = new Set(['open','resolved','dismissed']);

export async function logAssistantKnowledgeGap(env, { question, answer, displayName = '', model = '' } = {}) {
  if (!env?.AI_USAGE || typeof env.AI_USAGE.get !== 'function' || typeof env.AI_USAGE.put !== 'function') return;
  const cleanQuestion = clean(question, '', 1600);
  const cleanAnswer = clean(answer, '', 4000);
  if (!cleanQuestion || !cleanAnswer) return;

  const now = new Date().toISOString();
  const normalized = normalizeQuestion(cleanQuestion);
  const gaps = await readRawGaps(env);
  const existing = gaps.find(item => item.normalizedQuestion === normalized);

  if (existing) {
    existing.question = cleanQuestion;
    existing.answer = cleanAnswer;
    existing.lastAskedAt = now;
    existing.occurrences = Math.max(1, Number(existing.occurrences) || 1) + 1;
    existing.lastAskedBy = clean(displayName, '', 100);
    existing.model = clean(model, existing.model || '', 80);
    // If a supposedly resolved gap is still triggering, surface it again.
    if (existing.status === 'resolved') existing.status = 'open';
  } else {
    gaps.unshift({
      id: crypto.randomUUID(),
      question: cleanQuestion,
      answer: cleanAnswer,
      normalizedQuestion: normalized,
      status: 'open',
      occurrences: 1,
      firstAskedAt: now,
      lastAskedAt: now,
      lastAskedBy: clean(displayName, '', 100),
      model: clean(model, '', 80),
      adminNote: '',
      reviewedAt: '',
    });
  }

  gaps.sort((a,b) => Date.parse(b.lastAskedAt || 0) - Date.parse(a.lastAskedAt || 0));
  await env.AI_USAGE.put(GAP_KEY, JSON.stringify(gaps.slice(0, MAX_GAPS)));
}

export async function getAssistantKnowledgeGaps(env) {
  const gaps = await readRawGaps(env);
  return gaps
    .map(publicGap)
    .sort((a,b) => {
      const rank = { open:0, resolved:1, dismissed:2 };
      const statusDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      return statusDiff || Date.parse(b.lastAskedAt || 0) - Date.parse(a.lastAskedAt || 0);
    });
}

export async function updateAssistantKnowledgeGap(env, id, { status, adminNote } = {}) {
  const gaps = await readRawGaps(env);
  const item = gaps.find(gap => gap.id === id);
  if (!item) return null;
  if (VALID_STATUSES.has(status)) item.status = status;
  if (typeof adminNote === 'string') item.adminNote = clean(adminNote, '', 1200);
  item.reviewedAt = new Date().toISOString();
  await env.AI_USAGE.put(GAP_KEY, JSON.stringify(gaps.slice(0, MAX_GAPS)));
  return publicGap(item);
}

export function summarizeAssistantKnowledgeGaps(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    total: list.length,
    open: list.filter(item => item.status === 'open').length,
    resolved: list.filter(item => item.status === 'resolved').length,
    dismissed: list.filter(item => item.status === 'dismissed').length,
    repeated: list.filter(item => Number(item.occurrences) > 1).length,
  };
}

async function readRawGaps(env) {
  if (!env?.AI_USAGE || typeof env.AI_USAGE.get !== 'function') return [];
  try {
    const value = await env.AI_USAGE.get(GAP_KEY, { type:'json' });
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  } catch {
    try {
      const raw = await env.AI_USAGE.get(GAP_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function publicGap(item) {
  return {
    id: clean(item?.id, '', 100),
    question: clean(item?.question, '', 1600),
    answer: clean(item?.answer, '', 4000),
    status: VALID_STATUSES.has(item?.status) ? item.status : 'open',
    occurrences: Math.max(1, Number(item?.occurrences) || 1),
    firstAskedAt: clean(item?.firstAskedAt, '', 40),
    lastAskedAt: clean(item?.lastAskedAt, '', 40),
    lastAskedBy: clean(item?.lastAskedBy, '', 100),
    model: clean(item?.model, '', 80),
    adminNote: clean(item?.adminNote, '', 1200),
    reviewedAt: clean(item?.reviewedAt, '', 40),
  };
}

function normalizeQuestion(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

function clean(value, fallback, max) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, max) : fallback;
}
