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

// Strong identifiers are specific enough to classify an exchange as Elite-related
// on their own. This mirrors topics already routed into the Mongrel knowledge base.
const STRONG_ELITE_TERMS = [
  'elite dangerous', 'elite: dangerous', 'cmdr', 'commander', 'mongrel', 'mongrels',
  'inara', 'edsy', 'coriolis', 'frontier developments', 'background simulation', 'bgs',
  'powerplay', 'power play', 'odyssey', 'thargoid', 'anti-xeno', 'anti xeno', ' ax ',
  'guardian tech', 'guardian module', 'guardian weapon', 'guardian site',
  'frame shift drive', 'fsd', 'supercruise', 'sco', 'srv', 'scarab', 'scorpion', 'rhino',
  'fleet carrier', 'ship-launched fighter', 'ship launched fighter', 'slf',
  'engineering blueprint', 'experimental effect', 'material trader', 'tech broker',
  'exobiology', 'vista genomics', 'genetic sampler', 'artemis suit', 'maverick suit', 'dominator suit',
  'high grade emissions', 'hge', 'interstellar factors', 'notoriety', 'nav beacon',
  'resource extraction site', 'haz res', 'res site', 'combat zone', 'conflict zone',
  'mission board', 'influence reward', 'inf reward', 'minor faction', 'system architect',
  'colonization', 'colonisation', 'primary port', 'construction point', 'merit', 'merc coin',
  'mining rig', 'surface mining', 'core mining', 'laser mining', 'subsurface mining',
  'prospector limpet', 'collector limpet', 'refinery', 'pulse wave analyser', 'pulse wave analyzer',
  'seismic charge', 'abrasion blaster', 'planetary vehicle hangar', 'vessel hangar',
  'type-11', 'type 11', 'type-10', 'type 10', 'type-9', 'type 9', 'type-8', 'type 8',
  'panther clipper', 'caspian explorer', 'imperial cutter', 'federal corvette', 'federal gunship',
  'anaconda', 'python mk ii', 'python mk 2', 'krait mk ii', 'krait mk 2', 'mandalay',
  'corsair', 'fer-de-lance', 'fer de lance', 'fdl', 'vulture', 'alliance challenger',
  'alliance crusader', 'alliance chieftain', 'beluga liner', 'keelback', 'diamondback explorer',
  'sidewinder', 'cobra mk iii', 'cobra mk iv', 'asp explorer', 'orca', 'dolphin',
  'diaba', 'miwae', 'shinrarta', 'jameson memorial', 'sol permit', 'achenar', 'colonia',
  'daily orders', 'mission control', 'trader\'s outpost', 'ask the mongrels',
];

// Only distinctive Elite words get fuzzy matching. Generic terms stay strict so
// ordinary off-topic questions do not leak into the knowledge-gap queue.
const FUZZY_ELITE_TERMS = [
  'anaconda', 'coriolis', 'exobiology', 'guardian', 'inara', 'keelback', 'mandalay',
  'mongrels', 'multicannon', 'odyssey', 'powerplay', 'rhino', 'scarab', 'scorpion',
  'shinrarta', 'sidewinder', 'supercruise', 'thargoid', 'tritium', 'vulture',
  'colonization', 'colonisation',
];

// These can be ordinary English, so require at least two distinct matches unless
// a strong Elite identifier appears in the question or recent conversation.
const CONTEXT_ELITE_TERMS = [
  'ship', 'ships', 'module', 'modules', 'hardpoint', 'hardpoints', 'loadout', 'outfitting',
  'engineering', 'engineered', 'shield', 'shields', 'thruster', 'thrusters', 'power distributor',
  'power plant', 'weapon', 'weapons', 'rail gun', 'railgun', 'multicannon', 'multi-cannon',
  'plasma accelerator', 'fragment cannon', 'shield booster', 'shield cell', 'heat sink',
  'faction', 'factions', 'influence', 'tick', 'boom', 'civil liberty', 'expansion', 'retreat',
  'war', 'civil war', 'election', 'bounty', 'bounties', 'combat bond', 'permit', 'rank',
  'carrier', 'carriers', 'tritium', 'jump range', 'light year', 'station', 'starport',
  'system', 'galaxy map', 'route plotting', 'neutron', 'fuel scoop', 'exploration', 'explorer',
  'mining', 'miner', 'hotspot', 'commodity', 'trade route', 'cargo rack', 'limpet', 'limpets',
  'planetary', 'surface', 'settlement', 'on-foot', 'on foot', 'suit', 'conflict', 'mission',
  'wing', 'team', 'multicrew', 'pvp', 'pve', 'credits', 'cr/t', 'materials', 'synthesis',
];

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return context.next();

  let question = '';
  let conversationContext = '';
  try {
    const body = await request.clone().json();
    question = typeof body?.message === 'string' ? body.message.trim().slice(0,1600) : '';
    if (Array.isArray(body?.history)) {
      conversationContext = body.history
        .slice(-6)
        .map(item => typeof item?.text === 'string' ? item.text.trim().slice(0,600) : '')
        .filter(Boolean)
        .join(' ');
    }
  } catch {}

  const session = await readSession(request, env).catch(() => null);
  const response = await context.next();
  if (!response.ok || !question || !session) return response;

  try {
    const payload = await response.clone().json();
    const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
    if (answer && signalsKnowledgeGap(answer) && isEliteRelated(question, conversationContext)) {
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

function isEliteRelated(question, conversationContext) {
  const text = ` ${String(question || '').toLowerCase()} ${String(conversationContext || '').toLowerCase()} `;
  if (STRONG_ELITE_TERMS.some(term => text.includes(term))) return true;
  if (hasFuzzyEliteTerm(text)) return true;

  let matches = 0;
  const seen = new Set();
  for (const term of CONTEXT_ELITE_TERMS) {
    if (!seen.has(term) && text.includes(term)) {
      seen.add(term);
      matches += 1;
      if (matches >= 2) return true;
    }
  }
  return false;
}

function hasFuzzyEliteTerm(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const word of words) {
    if (word.length < 4) continue;
    for (const term of FUZZY_ELITE_TERMS) {
      const maxDistance = term.length >= 9 ? 2 : 1;
      if (Math.abs(word.length - term.length) > maxDistance) continue;
      if (damerauLevenshteinWithin(word, term, maxDistance)) return true;
    }
  }
  return false;
}

// Bounded Damerau-Levenshtein catches the common typo cases we care about:
// one wrong/missing/extra character or an adjacent transposition such as Rihno.
function damerauLevenshteinWithin(a, b, maxDistance) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > maxDistance) return false;

  const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let rowBest = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = value;
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > maxDistance) return false;
  }
  return rows[a.length][b.length] <= maxDistance;
}
