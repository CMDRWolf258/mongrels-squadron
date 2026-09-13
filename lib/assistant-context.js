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
    projects: '/projects/',
    carriers: '/carriers/',
    pvp: '/pvp/',
    trading: '/trading/',
    gallery: '/gallery/',
    recruitment: '/recruitment/',
    memberPortal: '/member/',
  },
};

export async function buildAssistantContext(request, env, session, message) {
  const query = String(message || '').toLowerCase();
  const modules = pickModules(query);
  const links = relatedLinks(modules);
  const context = {
    viewer: {
      displayName: session?.displayName || 'Public visitor',
      access: session?.access || 'public',
      authenticated: Boolean(session && MEMBER_ACCESS.has(session.access)),
    },
    publicKnowledge: PUBLIC_KNOWLEDGE,
    modules: {},
  };

  if (modules.has('ships')) {
    context.modules.ships = await fetchStaticJson(request, '/data/ships.json');
  }
  if (modules.has('systems')) {
    const [policy, live] = await Promise.all([
      fetchStaticJson(request, '/data/systems.json'),
      fetchStaticJson(request, '/data/live-bgs.json'),
    ]);
    context.modules.systems = { policy, live };
  }

  if (session && MEMBER_ACCESS.has(session.access)) {
    if (modules.has('orders')) context.modules.orders = await readKv(env.DAILY_ORDERS, 'current', null);
    if (modules.has('projects')) context.modules.projects = await readKv(env.PROJECTS, 'board-v1', []);
    if (modules.has('carriers')) {
      context.modules.carriers = {
        registry: await readKv(env.CARRIERS, 'registry-v1', []),
        coordination: await readKv(env.CARRIERS, 'coordination-v1', []),
      };
    }
    if (modules.has('trades')) context.modules.trades = await readKv(env.TRADES, 'trade-board-v1', []);
    if (modules.has('bounties')) context.modules.bounties = await readKv(env.BOUNTIES, 'board-v1', []);
  }

  context.modules = compactModules(context.modules);
  return { context, links };
}

function pickModules(query) {
  const set = new Set();
  const has = (...words) => words.some(word => query.includes(word));
  if (has('order','today','task','bgs','mission control','priority system','influence','faction')) { set.add('orders'); set.add('systems'); }
  if (has('project','event','campaign','colonization','help request','expedition')) set.add('projects');
  if (has('carrier','fleet carrier','tritium','loading','unloading','jump','pneuma')) set.add('carriers');
  if (has('trade','trader','commodity','profit','hauling','market','credits')) set.add('trades');
  if (has('pvp','bounty','target','combat calendar','duel','wing fight')) { set.add('bounties'); set.add('projects'); }
  if (has('ship','build','edsy','engineering','cutter','mandalay','vulture','anaconda','challenger','corsair','fer-de-lance','fdl')) set.add('ships');
  if (has('system','diaba','miwae','ngc 2546','col 285')) set.add('systems');

  // Broad questions get compact snapshots so the assistant can answer "what's going on?"
  if (set.size === 0 || has('what is going on','what\'s going on','anything happening','summary','overview','dashboard')) {
    ['orders','projects','carriers','trades','bounties'].forEach(x => set.add(x));
  }
  return set;
}

function relatedLinks(modules) {
  const links = [];
  const add = (label, href) => { if (!links.some(x => x.href === href)) links.push({ label, href }); };
  if (modules.has('orders') || modules.has('systems')) add('Mission Control', '/operations/');
  if (modules.has('orders')) add('Daily Orders', '/operations/#daily-orders');
  if (modules.has('projects')) add('Projects & Events', '/projects/');
  if (modules.has('carriers')) add('Carrier Coordination', '/carriers/');
  if (modules.has('trades')) add("Trader's Outpost", '/trading/');
  if (modules.has('bounties')) add('PvP Hub', '/pvp/');
  if (modules.has('ships')) add('Ship Catalogue', '/ships/');
  if (!links.length) { add('Member Portal', '/member/'); add('Rules & ROE', '/about/#squad-rules'); }
  return links.slice(0, 4);
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
  if (modules.systems) out.systems = modules.systems;
  return out;
}
