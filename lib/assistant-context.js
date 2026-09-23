import { buildMissionControlData, getMemberBgsPlaybook, selectMissionControlForAssistant } from './bgs-operations.js';
import { readSquadStructure, squadStructureView } from './squad-structure.js';

const MEMBER_ACCESS = new Set(['member','officer','site_admin']);
const KNOWLEDGE_PATHS = [
  '/data/elite-knowledge.json',
  '/data/elite-knowledge-engineering-materials.json',
  '/data/elite-knowledge-guardian-tech.json',
  '/data/elite-knowledge-human-tech.json',
  '/data/elite-knowledge-ranks-permits.json',
  '/data/elite-knowledge-navigation-travel.json',
  '/data/elite-knowledge-salvage-piracy.json',
  '/data/elite-knowledge-multiplayer.json',
  '/data/elite-knowledge-hangar-compatibility.json',
  '/data/elite-knowledge-field-support.json',
  '/data/elite-knowledge-crime-missions.json',
  '/data/elite-knowledge-odyssey.json',
  '/data/elite-knowledge-exploration.json',
  '/data/elite-knowledge-ax.json',
  '/data/elite-knowledge-combat.json',
  '/data/elite-knowledge-carriers-trade.json',
  '/data/elite-knowledge-colonization.json',
  '/data/elite-knowledge-powerplay.json',
];

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
  leadership: [],
  pages: {
    home: '/',
    startHere: '/start/',
    activities: '/activities/',
    about: '/about/',
    squadStructure: '/about/#structure',
    rules: '/about/#squad-rules',
    missionControl: '/operations/',
    dailyOrders: '/operations/#daily-orders',
    pathway: '/pathway/',
    profile: '/profile/',
    ships: '/ships/',
    guides: '/guides/',
    engineeringGuide: '/guides/engineering/',
    miningGuide: '/guides/mining/',
    bgsGuide: '/guides/bgs/',
    reference: '/guides/reference/',
    glossary: '/guides/glossary/',
    projects: '/projects/#project-list',
    carrierRegistry: '/carriers/#carrier-directory',
    carrierCoordination: '/carriers/#carrier-coordination',
    pvp: '/pvp/',
    bountyBoard: '/pvp/#bounty-board',
    trading: '/trading/',
    gallery: '/gallery/',
    announcements: '/announcements/',
    recruitment: '/recruitment/',
    memberPortal: '/member/',
    roster: '/members/',
  },
  navigationBasics: {
    desktop: 'Desktop/tablet navigation uses Start Here plus the grouped menus Activities, Command, Resources, Community, and Join Us.',
    compact: 'On compact layouts, open MENU first, then use the same top-level group and item names.',
    memberMenu: 'The authenticated member button opens My Pathway, Member Portal, My Profile, and Sign Out.',
  },
};

const NAVIGATION_DESTINATIONS = [
  {
    id:'carrier-coordination', label:'Carrier Coordination', href:'/carriers/#carrier-coordination',
    desktop:'Command → Carrier Coordination', compact:'MENU → Command → Carrier Coordination',
    memberPortal:'Member button → Member Portal → Carrier Coordination → Open Carrier Board',
    action:'To create a carrier movement/loading/unloading request, choose New Coordination Post. For loading, set Activity to Loading and fill in commodity, quantity, timing, purpose, and instructions as needed.',
    keywords:['carrier coordination','carrier loading','carrier unloading','loading event','unloading event','coordination post','new coordination post','carrier jump','tritium request','carrier movement','load carrier','unload carrier'],
  },
  {
    id:'carrier-registry', label:'Carrier Registry', href:'/carriers/#carrier-directory',
    desktop:'Command → Carrier Coordination → Fleet Carrier Directory', compact:'MENU → Command → Carrier Coordination → Fleet Carrier Directory',
    action:'Use Register My Carrier in the Fleet Carrier Directory to add your carrier.',
    keywords:['carrier registry','carrier directory','register my carrier','register carrier','carrier callsign','carrier id'],
  },
  {
    id:'projects-events', label:'Projects & Events', href:'/projects/#project-list',
    desktop:'Command → Projects & Events', compact:'MENU → Command → Projects & Events',
    memberPortal:'Member button → Member Portal → Projects & Events',
    action:'Use New Project or Start a Post to create a project/help request. Officers can create Squad Events. Members can RSVP Going, Maybe, or Can’t Make It on the event card; the same RSVP can also be changed from the event buttons in Discord.',
    keywords:['projects and events','project board','new project','create project','help request','post a project','squad event','create event','rsvp','event rsvp','going to event','maybe event','cant make event'],
  },
  {
    id:'announcements', label:'Squadron Announcements', href:'/announcements/',
    desktop:'Community → Announcements', compact:'MENU → Community → Announcements',
    action:'Open Announcements to read current official squad notices or browse the archive.',
    keywords:['announcement','announcements','squad announcement','official notice','official announcement','leadership update','squad notice','news from command'],
  },
  {
    id:'daily-orders', label:'Daily Orders', href:'/operations/#daily-orders',
    desktop:'Command → Daily Orders', compact:'MENU → Command → Daily Orders',
    memberPortal:'Member button → Member Portal → Daily Orders',
    keywords:['daily orders','today\'s orders','todays orders','current orders','squad tasking','what should i work on today'],
  },
  {
    id:'mission-control', label:'Mission Control', href:'/operations/',
    desktop:'Command → Mission Control', compact:'MENU → Command → Mission Control',
    memberPortal:'Member button → Member Portal → Mission Control',
    keywords:['mission control','priority systems','priority system','watch list','bgs status','system status'],
  },
  {
    id:'member-portal', label:'Member Portal', href:'/member/',
    desktop:'Command → Member Portal or member button → Member Portal', compact:'MENU → Command → Member Portal or member button → Member Portal',
    keywords:['member portal','member dashboard','member tools','dashboard'],
  },
  {
    id:'my-pathway', label:'My Pathway', href:'/pathway/',
    desktop:'Member button → My Pathway', compact:'Member button → My Pathway',
    keywords:['my pathway','pathway settings','pathway assignment','pathway progress'],
  },
  {
    id:'my-profile', label:'My Profile', href:'/profile/',
    desktop:'Member button → My Profile', compact:'Member button → My Profile',
    keywords:['my profile','edit profile','create profile','profile settings'],
  },
  {
    id:'pvp-bounty-board', label:'PvP Bounty Board', href:'/pvp/#bounty-board',
    desktop:'Activities → Combat → PvP → Bounty Board', compact:'MENU → Activities → Combat → PvP → Bounty Board',
    memberPortal:'Member button → Member Portal → PvP Tools',
    keywords:['bounty board','pvp bounty','pvp target','pvp tools','combat bounty'],
  },
  {
    id:'traders-outpost', label:"Trader's Outpost", href:'/trading/',
    desktop:'Activities → Industry & Discovery → Trade & Logistics', compact:'MENU → Activities → Industry & Discovery → Trade & Logistics',
    memberPortal:"Member button → Member Portal → Trader's Outpost",
    keywords:['trader\'s outpost','traders outpost','trade board','trade opportunity','trade route','hauling opportunity'],
  },
  {
    id:'squadron-roster', label:'Squadron Roster', href:'/members/',
    desktop:'Community → Squadron Roster', compact:'MENU → Community → Squadron Roster',
    memberPortal:'Member button → Member Portal → Squadron Roster',
    keywords:['squadron roster','member roster','member directory','find a member','who can help','specialist'],
  },
  {
    id:'squad-structure', label:'Squad Structure', href:'/about/#structure',
    desktop:'Community → About the Mongrels → Leadership', compact:'MENU → Community → About the Mongrels → Leadership',
    keywords:['squad structure','leadership','leadership structure','command structure','captain corps','pilot ranks','admiral','vice admiral','lieutenant','specialist corps','who is in charge','squad ranks'],
  },
  {
    id:'rules', label:'Rules & ROE', href:'/about/#squad-rules',
    desktop:'Community → About the Mongrels → Squad Rules', compact:'MENU → Community → About the Mongrels → Squad Rules',
    keywords:['rules','roe','rules and roe','squad rules','combat logging','open play rule','conduct'],
  },
  {
    id:'ship-catalogue', label:'Ship Catalogue', href:'/ships/',
    desktop:'Resources → Build & Ask → Ship Catalogue', compact:'MENU → Resources → Build & Ask → Ship Catalogue',
    keywords:['ship catalogue','ship catalog','mongrel builds','edsy builds','published builds'],
  },
  {
    id:'engineering-guide', label:'Engineering Guide', href:'/guides/engineering/',
    desktop:'Resources → Learn → Engineering', compact:'MENU → Resources → Learn → Engineering',
    keywords:['engineering guide','engineering page','engineering resource','engineering manual'],
  },
  {
    id:'mining-guide', label:'Mining Guide', href:'/guides/mining/',
    desktop:'Activities → Industry & Discovery → Mining', compact:'MENU → Activities → Industry & Discovery → Mining',
    keywords:['mining guide','mining page','mining manual','rhino mining guide'],
  },
  {
    id:'bgs-guide', label:'BGS Guide', href:'/guides/bgs/',
    desktop:'Activities → Galaxy & Frontier → BGS', compact:'MENU → Activities → Galaxy & Frontier → BGS',
    keywords:['bgs guide','bgs page','bgs manual','background simulation guide'],
  },
  {
    id:'reference-database', label:'Reference Database', href:'/guides/reference/',
    desktop:'Resources → Learn → Reference Database', compact:'MENU → Resources → Learn → Reference Database',
    keywords:['reference database','reference page','exact mechanics','lookup'],
  },
  {
    id:'field-manual', label:'Field Manual', href:'/guides/',
    desktop:'Resources → Learn → Field Manual', compact:'MENU → Resources → Learn → Field Manual',
    keywords:['field manual','guides','guide index'],
  },
  {
    id:'glossary', label:'Glossary', href:'/guides/glossary/',
    desktop:'Resources → Learn → Glossary', compact:'MENU → Resources → Learn → Glossary',
    keywords:['glossary','acronym','terminology','what does this mean'],
  },
  {
    id:'start-here', label:'Start Here', href:'/start/',
    desktop:'Start Here', compact:'MENU → Start Here',
    keywords:['start here','what can i do next','something to do','random task','daily task'],
  },
  {
    id:'recruitment', label:'Recruitment', href:'/recruitment/',
    desktop:'Join Us', compact:'MENU → Join Us',
    keywords:['recruitment','join us','join the squad','apply to squad','application'],
  },
];

export async function buildAssistantContext(request, env, session, message) {
  const query = String(message || '').toLowerCase();
  const modules = pickModules(query);
  const siteNavigation = selectNavigation(query);
  const links = relatedLinks(modules, query, siteNavigation);
  const publicKnowledge={...PUBLIC_KNOWLEDGE};
  if(/\b(?:squad structure|leadership|command structure|captain corps|pilot ranks?|admiral|vice admiral|lieutenant|specialist corps|who is in charge|squad ranks?)\b/i.test(query)){
    const structure=squadStructureView(await readSquadStructure(env));
    publicKnowledge.leadership=[
      ...structure.command.map(item=>({rank:item.rank,commander:item.holder||'Vacant',role:item.role})),
      ...structure.captains.filter(item=>item.holder).map(item=>({rank:'Captain',commander:item.holder,role:item.title})),
      ...structure.fieldLeadership.flatMap(item=>item.assignments.map(assignment=>({rank:item.rank,commander:assignment.name,role:assignment.focus||item.title}))),
      ...structure.specialists.filter(item=>item.holder).map(item=>({rank:item.rank,commander:item.holder,role:item.focus||item.title})),
    ];
    publicKnowledge.squadStructure={pilotRanks:structure.pilotRanks.map(item=>({rank:item.rank,title:item.title,count:item.count}))};
  }

  const context = {
    viewer: {
      displayName: session?.displayName || 'Public visitor',
      access: session?.access || 'public',
      authenticated: Boolean(session && MEMBER_ACCESS.has(session.access)),
    },
    publicKnowledge,
    generatedAt: new Date().toISOString(),
    modules: {},
  };

  if (siteNavigation.length) context.modules.siteNavigation = siteNavigation;
  if (modules.has('ships')) {
    context.modules.ships = await fetchStaticJson(request, '/data/ships.json');
  }
  if (modules.has('knowledge')) {
    const knowledgeParts = await Promise.all(KNOWLEDGE_PATHS.map(path => fetchStaticJson(request, path)));
    const knowledge = mergeKnowledgeSources(knowledgeParts);
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
  if (has('project','event','campaign','colonization','colonisation','help request','expedition')) set.add('projects');
  if (has('member','members','roster','profile','profiles','who does','who can help','specialist','specialty','leadership')) set.add('profiles');
  if (has('carrier','fleet carrier','tritium','loading','unloading','carrier jump','carrier upkeep','carrier market','buy order','sell order','pneuma')) { set.add('carriers'); set.add('knowledge'); }
  if (has('trade','trader','commodity','profit','hauling','market','credits','supply','demand','bulk tax','bulk sales','pad size','profit per hour','round trip')) { set.add('trades'); set.add('knowledge'); }
  if (has('pvp','bounty','target','combat calendar','duel','wing fight')) { set.add('bounties'); set.add('projects'); set.add('knowledge'); }
  if (has('combat','dogfight','pips','pip management','sys pips','eng pips','wep pips','flight assist off','fa off','high wake','interdiction escape','chaff','silent running','shield cell bank','scb','subsystem','module targeting','range control','jousting','gimballed','gimbaled','turreted')) set.add('knowledge');
  if (has('ship','build','edsy','engineering','cutter','mandalay','vulture','anaconda','challenger','corsair','fer-de-lance','fdl','type-11','type 11','type-10','type 10','type-9','type 9','krait','keelback','beluga','federal gunship','federal corvette','panther clipper','caspian explorer','alliance crusader')) set.add('ships');
  if (has('engineering','engineer','experimental','corrosive','incendiary','auto loader','oversized','feedback','drag munitions','thermal vent','emissive','scramble','phasing','plasma slug','super penetrator','dispersal','target lock breaker','screening shell','thermal conduit','shield generator','shield booster','bi-weave','bi weave','prismatic','hull reinforcement','hrp','mrp','module reinforcement','deep plating','resistance','armour','armor','power plant','thruster','dirty drives','drag drives','power distributor','charge enhanced','engine focused','weapon focused','system focused','fsd','frame shift drive','mass manager','deep charge','sensors','life support','material','materials','material trader','raw materials','manufactured materials','encoded materials','high grade emissions','hge','pharmaceutical isolators','datamined wake exceptions','dwe','modified embedded firmware','mef','biotech conductors','exquisite focus crystals','remote workshop','pinned blueprint','engineering rolls','selenium','polonium','tellurium','yttrium','antimony','ruthenium','technetium')) set.add('knowledge');
  if (has('odyssey','on foot','on-foot','maverick','dominator','pioneer supplies','suit schematic','weapon schematic','manufacturing instructions','weapon test data','operational manual','biometric data','audio masking','noise suppressor','quieter footsteps','extra backpack','ground cz','frontline solutions','bartender','arc cutter','personal equipment engineer','suit upgrade','weapon upgrade')) set.add('knowledge');
  if (has('guardian','guardian tech','guardian technology','guardian blueprint','module blueprint fragment','weapon blueprint fragment','vessel blueprint fragment','guardian fsd booster','guardian module reinforcement','guardian shield reinforcement','guardian hull reinforcement','guardian power plant','guardian hybrid power distributor','guardian shard','modified shard','mod shard','guardian plasma','modified guardian','guardian fighter','guardian slf','trident','javelin','lance','ancient data terminal','guardian structure','power pylons','ancient relic','obelisk data','anti-guardian zone resistance','ram tah')) set.add('knowledge');
  if (has('human tech broker','human technology broker','technology broker','tech broker','permanent unlock','engineered fsd v1','v1 fsd','engineered fsd sco','sco v1','pesco','engineered dss','dss v1','engineered seeker','modified mining laser','sirius heatsink','sirius heat sink','sirius ax missile','azimuth enhanced ax','corrosion resistant cargo rack','meta alloy hull reinforcement','shock cannon','flechette launcher','enzyme missile','caustic sink launcher','thargoid pulse neutraliser','experimental weapon stabiliser','experimental weapon stabilizer','titan drive component')) set.add('knowledge');
  if (has('rank vs reputation','rank vs rep','minor faction reputation','minor faction rep','superpower reputation','superpower rep','federal rank','federation rank','federal navy rank','federal promotion','federal navy mission','rear admiral','federal corvette','imperial rank','empire rank','imperial navy rank','imperial promotion','imperial navy mission','duke rank','imperial cutter','alliance rank','alliance reputation','pilots federation rank','combat rank','trade rank','exploration rank','mercenary rank','exobiology rank','cqc rank','elite v','elite 5','system permit','permit locked','permit-locked','permit mission','founders world','shinrarta','jameson memorial','sol permit','achenar permit','alioth permit','sirius permit','vega permit','ross 128 permit','facece permit','summerland permit','bill turner','marco qwent','lori jameson','tiana fortune')) set.add('knowledge');
  if (has('navigation','route planning','galaxy map route','plot route','route unavailable','cannot plot route','fastest route','economical route','scoopable star','fuel star','kgbfoam','supercruise','gravity well','six second rule','6 second rule','7 second rule','loop of shame','supercruise assist','supercruise overcharge','sco','orbital cruise','planetary glide','glide approach','neutron highway','neutron supercharge','white dwarf boost','jet cone boost','fsd injection','jumponium','caspian explorer','mk ii supercharge optimised','long range travel')) set.add('knowledge');
  if (has('synthesis','synthesize','field support','repair limpet','repair controller','fuel transfer limpet','decontamination limpet','decon limpet','reboot repair','reboot and repair','life support synthesis','oxygen refill','canopy breach','canopy broken','heat sink synthesis','ammo synthesis','ammunition synthesis','limpet synthesis','multi limpet','multi-limpet','operations limpet','rescue limpet','universal limpet','srv repair','srv refuel','srv rearm','expedition loadout','deep space support','out of limpets','out of fuel')) set.add('knowledge');
  if (has('crime','criminal','legal status','fine','pay fine','bounty on me','wanted status','notoriety','anonymous access','interstellar factor','interstellar factors','detention centre','detention center','prison ship','turn myself in','hand myself in','mission board','mission reward','rep reward','reputation reward','inf reward','influence reward','wing mission','team mission','share mission','shared mission','massacre mission','massacre stacking','assassination mission','illegal assassination','abandon mission','mission failed','mission expired','illegal cargo','stolen cargo','smuggling mission','black market')) set.add('knowledge');
  if (has('salvage','salvaging','piracy','pirate','smuggling','smuggler','stolen goods','stolen cargo','illegal goods','illegal cargo','illicit cargo','black market','manifest scanner','cargo scanner','hatch breaker','hatch breaker limpet','collector limpet','jettison abandon','jettison cargo','abandon cargo','search and rescue','search & rescue','rescue agent','occupied escape pod','damaged escape pod','black box','personal effects','wreckage components','hostages','recovery mission','illegal recovery','degraded emissions','salvageable wreckage','megaship salvage','megaship cargo','recon limpet','operations multi limpet')) set.add('knowledge');
  if (has('multiplayer','wing up','team up','team beacon','wing beacon','nav lock','nav-lock','instancing','same instance','different instance','multicrew','multi crew','telepresence','physical multicrew','physical crew','helm','gunner','fighter con','ship launched fighter','ship-launched fighter','slf','slf crew','fighter hangar','fighter bay','scorpion multicrew','team mission','wing mission','share mission','mission depot','trade dividend','shared bounty','operation runner','elite operations','operations update','merc coin','merc coins','operations matchmaking','mercenary mode','powerplay mode','mass jump','more than four commanders','more than 4 commanders')) set.add('knowledge');
  if (has('mining','miner','laser mining','core mining','subsurface','sub-surface','prospector','collector limpet','refinery','hotspot','pulse wave','pwa','abrasion blaster','seismic charge','motherlode','rhino','mining rig','planetary mining','mineral scanner','surface deposit','large planetary vehicle hangar','rhino hangar','72t','72 t')) set.add('knowledge');
  if (has('exploration','explorer','exobiology','exobiologist','artemis','genetic sampler','vista genomics','first footfall','first logged','discovery scanner','system honk','honk','full spectrum scanner','fss','detailed surface scanner','dss','fuel scoop','kgbfoam','neutron star','neutron boost','neutron highway','jumponium','fsd injection','jet cone','afmu','universal cartographics')) set.add('knowledge');
  if (has('anti-xeno','anti xeno','ax combat','thargoid','interceptor','cyclops','basilisk','medusa','hydra','orthrus','thargon','swarm','cold orbit','xeno scanner','shutdown field neutralizer','sfn','thargoid pulse neutralizer','tpn','caustic','guardian gauss','heart exertion')) set.add('knowledge');
  if (has('colonization','colonisation','system architect','architect mode','primary port','construction points','construction tier','claim range','claim sniping','colony economy','founding faction')) set.add('knowledge');
  if (has('powerplay','power play','pp2','powerplay 2.0','stronghold','fortified','exploited','acquisition system','reinforcement system','undermining','control points','power merits','power ethos','stronghold carrier')) set.add('knowledge');
  if (has('diaba','miwae','ngc 2546','col 285')) set.add('systems');

  const broad = has('what is going on','what\'s going on','what is happening','what\'s happening','anything happening','summary','overview','dashboard','briefing','today');
  if (set.size === 0 || broad) {
    ['orders','systems','projects','carriers','trades','bounties'].forEach(x => set.add(x));
  }
  return set;
}

function selectNavigation(query) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const intent = ['where','find','open','create','post','go to','navigate','menu','page','section','how do i get','how can i get','where can i','where do i'].some(term => q.includes(term));
  const scored = NAVIGATION_DESTINATIONS.map(item => {
    let score = 0;
    const label = item.label.toLowerCase();
    if (q.includes(label)) score += 9;
    for (const keyword of item.keywords) {
      const k = keyword.toLowerCase();
      if (q.includes(k)) score += k.includes(' ') ? 8 : 4;
    }
    if (intent && score > 0) score += 3;
    return { item, score };
  }).filter(entry => entry.score > 0).sort((a,b) => b.score - a.score);

  return scored.slice(0, intent ? 3 : 2).map(({ item }) => ({
    id:item.id,
    label:item.label,
    href:item.href,
    desktop:item.desktop,
    compact:item.compact,
    memberPortal:item.memberPortal || null,
    action:item.action || null,
  }));
}

function relatedLinks(modules, query = '', siteNavigation = []) {
  const links = [];
  const add = (label, href) => { if (!links.some(x => x.href === href)) links.push({ label, href }); };

  siteNavigation.forEach(item => add(item.label, item.href));
  if (modules.has('orders') || modules.has('systems') || modules.has('bgsOps')) add('Mission Control', '/operations/');
  if (modules.has('orders')) add('Daily Orders', '/operations/#daily-orders');
  if (modules.has('bgsOps')) add('Member BGS Playbook', '/operations/#playbook');
  if (modules.has('projects')) add('Projects & Events', '/projects/#project-list');
  if (modules.has('carriers')) { add('Carrier Coordination', '/carriers/#carrier-coordination'); add('Member Portal', '/member/#carrier-coordination'); }
  if (modules.has('trades')) add("Trader's Outpost", '/trading/');
  if (modules.has('bounties')) add('PvP Bounty Board', '/pvp/#bounty-board');
  if (modules.has('knowledge')) {
    add('Reference Database', '/guides/reference/');
    add('Field Manual', '/guides/');
    if (hasBgsTerms(query)) add('BGS Guide', '/guides/bgs/');
    if (hasMiningTerms(query)) add('Mining Guide', '/guides/mining/');
  }
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

function mergeKnowledgeSources(parts) {
  const valid = (Array.isArray(parts) ? parts : []).filter(part => part && Array.isArray(part.entries));
  if (!valid.length) return null;
  const seen = new Set();
  const entries = valid.flatMap(part => part.entries).filter(entry => {
    if (!entry || !entry.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  const reviewed = valid.map(part => part.reviewedAt).filter(Boolean).sort().pop() || null;
  return {
    scope: valid.map(part => part.scope).filter(Boolean).join(' | '),
    reviewedAt: reviewed,
    entries,
  };
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

  const broadKnowledge = ['how should','how do i','what should','best way','build','outfit','setup','loadout','guide','prepare','strategy','compare','complete answer','recommend'].some(term => q.includes(term));
  const maxEntries = broadKnowledge ? 8 : 5;
  const selected = [];
  const selectedIds = new Set();

  if (broadKnowledge) {
    const categoryLeaders = new Map();
    for (const item of scored) {
      const category = item.entry?.category || '';
      if (category && !categoryLeaders.has(category)) categoryLeaders.set(category, item);
    }
    for (const item of [...categoryLeaders.values()].slice(0, 4)) {
      selected.push(item.entry);
      selectedIds.add(item.entry.id);
    }
  }

  for (const item of scored) {
    if (selected.length >= maxEntries) break;
    if (selectedIds.has(item.entry.id)) continue;
    selected.push(item.entry);
    selectedIds.add(item.entry.id);
  }

  if (!selected.length) return null;
  return {
    scope: value.scope || '',
    reviewedAt: value.reviewedAt || null,
    entries: selected,
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
  if (modules.siteNavigation) out.siteNavigation = modules.siteNavigation;
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
  if (Array.isArray(modules.profiles)) out.profiles = modules.profiles.slice(0, 60);
  if (modules.ships) out.ships = modules.ships;
  if (modules.eliteKnowledge) out.eliteKnowledge = modules.eliteKnowledge;
  if (modules.bgsOperational) out.bgsOperational = modules.bgsOperational;
  if (modules.systems) out.systems = modules.systems;
  return out;
}
