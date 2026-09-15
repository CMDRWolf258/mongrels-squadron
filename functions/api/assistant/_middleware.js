import { readSession } from '../../../lib/auth.js';
import { logAssistantKnowledgeGap } from '../../../lib/assistant-gap-log.js';

const GAP_SIGNALS = [
  'not currently available in the site data',
  'not available in the site data',
  'not in the site data',
  'not currently in the site data',
  'not covered by the local knowledge',
  'not covered in the local knowledge',
  'not covered by our knowledge',
  'not covered in our knowledge',
  'not in the local knowledge base',
  'not in our knowledge base',
  'knowledge base does not include',
  'knowledge base does not cover',
  'local knowledge base does not',
  'live verification would be appropriate',
  'would need live verification',
  'needs live verification',
  'cannot confirm from the local',
  "can't confirm from the local",
  'cannot confirm from the site',
  "can't confirm from the site",
  'i do not have enough information',
  "i don't have enough information",
  'i do not know from the available data',
  "i don't know from the available data",
  'from general game knowledge',
  'from general elite dangerous knowledge',
  'from general elite knowledge',
  'general model knowledge',
];

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return context.next();

  let question = '';
  try {
    const body = await request.clone().json();
    question = typeof body?.message === 'string' ? body.message.trim().slice(0,1600) : '';
  } catch {}

  const session = await readSession(request, env).catch(() => null);
  const response = await context.next();
  if (!response.ok || !question || !session) return response;

  try {
    const payload = await response.clone().json();
    const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
    if (answer && signalsKnowledgeGap(answer)) {
      await logAssistantKnowledgeGap(env, {
        question,
        answer,
        displayName: session.displayName || '',
        model: payload.model || '',
      });
    }
  } catch (error) {
    console.error('Assistant gap logger failed', error);
  }

  return response;
}

function signalsKnowledgeGap(answer) {
  const text = String(answer || '').toLowerCase();
  return GAP_SIGNALS.some(signal => text.includes(signal));
}
