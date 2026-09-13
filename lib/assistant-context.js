import { buildMissionControlData, getMemberBgsPlaybook, selectMissionControlForAssistant } from './bgs-operations.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);

const PUBLIC_KNOWLEDGE = {
  squad: {
    name: 'Regiment of Imperial Mongrels',
    homeSystem: 'Diaba',
    identity: 'A mixed-background Elite Dangerous squadron focused on teamwork in Open Play, BGS, combat, trade, mining, exploration, colonization, anti-xeno operations, logistics, and community projects.',
  },
  rules: [
    'Open Play is the standard mode for Mongrel operations.',
    'BGS activity intended to influence a faction or system must be performed in Open Play.',
    'Solo or Private Group must never be used to avoid combat or player opposition.',
    'Combat logging is prohibited.',
    'Ship-Launched Fighters are permitted generally but strongly discouraged in PvP because of synchronization and lag concerns.',
    'Members are expected to represent the squad well, work with squadmates, honor commitments, and follow operational instructions when participating in squad activity.',
  ],
  leadership: [
    { rank: 'Admiral', commander: 'CMDR Wolf258', role: 'Commanding Officer' },
    { rank: 'Vice Admiral', commander: 'CMDR D1scoT1ts', role: 'Executive Officer' },
    { rank: 'Captain', commander: 'CMDR Lennyshow', role: 'Anti-Xeno' },
    { rank: 'Captain', commander: 'CMDR LuckyNed8', role: 'Trade' },
    { rank: 'Captain', commander: 'CMDR TheSpartanBro', role: 'Administration' },
    { rank: 'Captain', commander: 'CMDR Nuraghi', role: 'Mining' },
    { rank: 'Lieutenant', commander: 'CMDR TeslaBro', role: 'Mission Supervisor' },
    { rank: 'Second Lieutenant', commander: 'CMDR Beaverdaniel03', role: 'Combat / Special Operations' },
    { rank: 'Second Lieutenant', commander: 'CMDR Boogeyxxx', role: 'Trade / Combat' },
  ],
  pages: {
    home: '/',
    about: '/about/',
    rules: '/about/#squad-rules',
    missionControl: '/operations/',
    dailyOrders: '/operations/#daily-orders',
    ships: '/ships/',
    guides: '/guides/',
    projects: '/projects/',
    carriers: '/carriers/',
    pvp: '/pvp/',
    trading: '/trading/',
    gallery: '/gallery/',
    recruitment: '/recruitment/',
    memberPortal: '/member/',
    roster: '/members/',
  },
};

export async function buildAssistantContext(request, env, session, message) {
  const query = String(message || '').toLowerCase();
  const modules = pickModules(query);
  const links = relatedLinks(modules, query);
  const context = {
    viewer: {
      displayName: session?.displayName || 'Public visitor',
      access: session?.access || 'public',
      authenticated: Boolean(session && MEMBER_ACCESS.has(session.access)),
    },
    publicKnowledge: PUBLIC_KNOWLEDGE,
    generatedAt: new Date().toISOString(),
    modules: {},
  };

  if (modules.has('ships')) {
    context.modules.ships = await fetchStaticJson(request, '/data/ships.json');
  }
  if (modules.has('knowledge')) {
    const knowledge = await fetchStaticJson(request, '/data/elite-knowledge.json');
    context.modules.eliteKnowledge = selectEliteKnowledge(knowledge, query);
  }
  if (session && MEMBER_ACCESS.has(session.access)) {
    if (modules.has('systems')) {
      const missionControl = await buildMissionControlData(request, env, session);
      context.modules.systems = selectMissionControlForAssistant(missionControl, query);
    }
    if (modules.has('bgsOps')) context.modules.bgsOperational = getMemberBgsPlaybook();
    if (modules.has('orders')) context.modules.orders = sanitizeOrders(await readKv(env.DAILY_ORDERS, 'current', null), session.access);
    if (modules.has('projects')) context.modules.projects = sanitizeRecords(await readKv(env.PROJECTS, 'board-v1', []));
    if (modules.has('carriers')) {
      context.modules.carriers = {
        registry: sanitizeRecords(await readKv(env.CARRIERS, 'registry-v1', [])),
        coordination: sanitizeRecords(await readKv(env.CARRIERS, 'coordination-v1', [])),
      };
    }
    if (modules.has('trades')) context.modules.trades = sanitizeRecords(await readKv(env.TRADES, 'trade-board-v1', []));
    if (modules.has('bounties')) context.modules.bounties = sanitizeRecords(await readKv(env.BOUNTIES, 'board-v1', []));
    if (modules.has('profiles')) context.modules.profiles = sanitizeProfiles(await readKv(env.PROJECTS, 'profiles-v1', []));
  }

  context.modules = compactModules(context.modules);
  return { context, links };
}


function sanitizeProfiles(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(x => x && x.directoryVisible !== false).map(item => ({
    commanderName: item.commanderName || '',
    squadRank: item.squadRank || '',
    leadershipRole: item.leadershipRole || '',
    tagline: item.tagline || '',
    homeSystem: item.homeSystem || '',
    specialties: Array.isArray(item.specialties) ? item.specialties : [],
    activities: Array.isArray(item.activities) ? item.activities : [],
  }));
}

function sanitizeOrders(value, access) {
  if (!value || typeof value !== 'object') return value;
  const copy = JSON.parse(JSON.stringify(value));
  if (access === 'member') {
    delete copy.officerNote;
    delete copy.leadershipNote;
  }
  return copy;
}

function pickModules(query) {
  const set = new Set();
  const has = (...words) => words.some(word => query.includes(word));
  if (has('order','daily order','today','task','mission control','priority system','priority','priorities','focus','watch list','our systems','mongrel systems','system status','where are we working')) set.add('orders');
  if (has('mission control','priority system','priority','priorities','focus','watch list','our systems','mongrel systems','system status','systems need attention','where are we working','all systems','territory','footprint','diaba','miwae','ngc 2546','col 285')) set.add('systems');
  if (has('bgs','background simulation','influence','inf','tick','minor faction','conflict','conflict day','conflict lock','influence lock','leapfrog','best of seven','government','ethos','corporate','dictatorship','democracy','cooperative','anarchy','expansion','retreat','war','civil war','election','boom','bust','civil liberty','civil unrest','lockdown','outbreak','famine','public holiday','pirate attack','asset ownership','asset at risk','controlling faction','invasion','diminishing returns','saturation','daily target','how much trade','trade profit','bounty vouchers','combat bonds','lower faction','raise faction')) set.add('knowledge');
  if (has('daily target','how much trade','how much should','how much is enough','today','raise faction','lower faction','force retreat','save from retreat','avoid expansion','win war','win election','workload','benchmark')) set.add('bgsOps');
  if (has('project','event','campaign','colonization','help request','expedition')) set.add('projects');
  if (has('member','members','roster','profile','profiles','who does','who can help','specialist','specialty','leadership')) set.add('profiles');
  if (has('carrier','fleet carrier','tritium','loading','unloading','jump','pneuma')) set.add('carriers');
  if (has('trade','trader','commodity','profit','hauling','market','credits')) set.add('trades');
  if (has('pvp','bounty','target','combat calendar','duel','wing fight')) { set.add('bounties'); set.add('projects'); }
  if (has('ship','build','edsy','engineering','cutter','mandalay','vulture','anaconda','challenger','corsair','fer-de-lance','fdl')) set.add('ships');
  if (has('engineering','engineer','experimental','corrosive','incendiary','auto loader','oversized','feedback','drag munitions','thermal vent','emissive','scramble','phasing','plasma slug','super penetrator','dispersal','target lock breaker','screening shell','thermal conduit','shield generator','shield booster','bi-weave','bi weave','prismatic','hull reinforcement','hrp','mrp','module reinforcement','deep plating','resistance','armour','armor','power plant','thruster','dirty drives','drag drives','power distributor','charge enhanced','engine focused','weapon focused','system focused','fsd','frame shift drive','mass manager','deep charge','sensors','life support')) set.add('knowledge');
  if (has('mining','miner','laser mining','core mining','subsurface','sub-surface','prospector','collector limpet','refinery','hotspot','pulse wave','pwa','abrasion blaster','seismic charge','motherlode','rhino','mining rig','planetary mining','mineral scanner','surface deposit','72t','72 t')) set.add('knowledge');
  if (has('diaba','miwae','ngc 2546','col 285')) set.add('systems');

  // Broad questions get compact snapshots so the assistant can answer a useful daily briefing.
  const broad = has('what is going on','what\'s going on','what is happening','what\'s happening','anything happening','summary','overview','dashboard','briefing','today');
  if (set.size === 0 || broad) {
    ['orders','systems','projects','carriers','trades','bounties'].forEach(x => set.add(x));
  }
  return set;
}

function relatedLinks(modules, query = '') {
  const links = [];
  const add = (label, href) => { if (!links.some(x => x.href === href)) links.push({ label, href }); };
  if (modules.has('orders') || modules.has('systems') || modules.has('bgsOps')) add('Mission Control', '/operations/');
  if (modules.has('orders')) add('Daily Orders', '/operations/#daily-orders');
  if (modules.has('bgsOps')) add('Member BGS Playbook', '/operations/#playbook');
  if (modules.has('projects')) add('Projects & Events', '/projects/');
  if (modules.has('carriers')) add('Carrier Coordination', '/carriers/');
  if (modules.has('trades')) add("Trader's Outpost", '/trading/');
  if (modules.has('bounties')) add('PvP Hub', '/pvp/');
  if (modules.has('knowledge')) { add('Field Manual', '/guides/'); if (hasBgsTerms(query)) add('BGS Guide', '/guides/bgs/'); if (hasMiningTerms(query)) add('Mining Guide', '/guides/mining/'); }
  if (modules.has('ships')) add('Ship Catalogue', '/ships/');
  if (modules.has('profiles')) add('Squadron Roster', '/members/');
  if (!links.length) { add('Member Portal', '/member/'); add('Rules & ROE', '/about/#squad-rules'); }
  return links.slice(0, 4);
}

function hasBgsTerms(query) {
  const q = String(query || '').toLowerCase();
  return ['bgs','background simulation','influence','inf','tick','minor faction','conflict','conflict day','conflict lock','influence lock','leapfrog','best of seven','government','ethos','corporate','dictatorship','democracy','cooperative','anarchy','expansion','retreat','war','civil war','election','boom','bust','civil liberty','civil unrest','lockdown','outbreak','famine','public holiday','pirate attack','asset ownership','asset at risk','controlling faction','invasion','diminishing returns','saturation','daily target','how much trade','trade profit','bounty vouchers','combat bonds','lower faction','raise faction'].some(x => q.includes(x));
}

function hasMiningTerms(query) {
  const q = String(query || '').toLowerCase();
  return ['mining','miner','laser mining','core mining','subsurface','sub-surface','prospector','collector limpet','refinery','hotspot','pulse wave','pwa','abrasion blaster','seismic charge','motherlode','rhino','mining rig','planetary mining','mineral scanner','surface deposit'].some(x => q.includes(x));
}

function sanitizeRecords(value) {
  if (!Array.isArray(value)) return value;
  const privateKeys = new Set([
    'ownerUserId','ownerDiscordId','discordUserId','discordId','userId','createdById','updatedById','authorId','memberId','sub',
  ]);
  const cleanValue = input => {
    if (Array.isArray(input)) return input.map(cleanValue);
    if (!input || typeof input !== 'object') return input;
    const out = {};
    for (const [key,val] of Object.entries(input)) {
      if (privateKeys.has(key)) continue;
      out[key] = cleanValue(val);
    }
    return out;
  };
  return cleanValue(value);
}

function selectEliteKnowledge(value, query) {
  if (!value || !Array.isArray(value.entries)) return null;
  const q = String(query || '').toLowerCase();
  const terms = q.split(/[^a-z0-9-]+/).filter(term => term.length >= 3);
  const scored = value.entries.map(entry => {
    const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];
    const haystack = [entry.topic, entry.category, entry.ruleOfThumb, ...keywords].join(' ').toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      const k = String(keyword).toLowerCase();
      if (k && q.includes(k)) score += k.includes(' ') ? 8 : 5;
    }
    for (const term of terms) if (haystack.includes(term)) score += 1;
    return { entry, score };
  }).filter(item => item.score > 0).sort((a,b) => b.score - a.score);

  const entries = scored.slice(0, 5).map(item => item.entry);
  if (!entries.length) return null;
  return {
    scope: value.scope || '',
    reviewedAt: value.reviewedAt || null,
    entries,
  };
}

async function readKv(binding, key, fallback) {
  if (!binding || typeof binding.get !== 'function') return fallback;
  try {
    const value = await binding.get(key, { type: 'json' });
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchStaticJson(request, path) {
  try {
    const url = new URL(path, request.url);
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function compactModules(modules) {
  const out = {};
  if (modules.orders) out.orders = modules.orders;
  if (Array.isArray(modules.projects)) out.projects = modules.projects.slice(0, 30);
  if (modules.carriers) {
    out.carriers = {
      registry: Array.isArray(modules.carriers.registry) ? modules.carriers.registry.slice(0, 30) : [],
      coordination: Array.isArray(modules.carriers.coordination) ? modules.carriers.coordination.slice(0, 30) : [],
    };
  }
  if (Array.isArray(modules.trades)) out.trades = modules.trades.slice(0, 30);
  if (Array.isArray(modules.bounties)) out.bounties = modules.bounties.slice(0, 30);
  if (modules.ships) out.ships = modules.ships;
  if (modules.eliteKnowledge) out.eliteKnowledge = modules.eliteKnowledge;
  if (modules.bgsOperational) out.bgsOperational = modules.bgsOperational;
  if (modules.systems) out.systems = modules.systems;
  return out;
}
