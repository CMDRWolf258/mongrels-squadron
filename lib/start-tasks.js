export const DAILY_TASK_LIMIT = 3;

export const START_ACTIVITY_META = {
  pve:{ label:'PvE Combat', group:'Combat', link:'/activities/#combat' },
  pvp:{ label:'PvP', group:'Combat', link:'/pvp/' },
  ax:{ label:'Anti-Xeno', group:'Combat', link:'/activities/#ax' },
  surface:{ label:'Surface Operations', group:'Combat', link:'/guides/operations/' },
  mining:{ label:'Mining', group:'Industry & Logistics', link:'/guides/mining/' },
  trade:{ label:'Trade & Hauling', group:'Industry & Logistics', link:'/trading/' },
  'carrier-logistics':{ label:'Carrier Logistics', group:'Industry & Logistics', link:'/carriers/' },
  engineering:{ label:'Engineering & Shipbuilding', group:'Industry & Logistics', link:'/guides/engineering/' },
  exploration:{ label:'Exploration', group:'Exploration & Discovery', link:'/activities/#exploration' },
  exobiology:{ label:'Exobiology', group:'Exploration & Discovery', link:'/activities/#exploration' },
  bgs:{ label:'Background Simulation', group:'Galaxy & Frontier', link:'/operations/#daily-orders' },
  colonization:{ label:'Colonization', group:'Galaxy & Frontier', link:'/projects/' },
  powerplay:{ label:'Powerplay', group:'Galaxy & Frontier', link:'/activities/#powerplay' },
  operations:{ label:'Squad Operations', group:'Galaxy & Frontier', link:'/operations/#daily-orders' },
};

const ALL = ['new','some','comfortable','experienced'];
const DEV_PLUS = ['some','comfortable','experienced'];
const EXP_PLUS = ['comfortable','experienced'];
const VET = ['experienced'];
const NEW_DEV = ['new','some'];

const task = (id, title, objective, levels = ALL, kind = 'activity', style = 'any', link = '') => ({ id,title,objective,levels,kind,style,link });

export const START_TASKS = {
  pve:[
    task('pve-bounties-10','Bounty warm-up','Destroy 10 wanted ships and cash the vouchers without losing your ship.',ALL,'activity'),
    task('pve-missions-3','Three-job combat run','Complete three combat missions for the same session and return to port.',ALL,'activity'),
    task('pve-res-session','Resource-site patrol','Spend 15 minutes fighting wanted ships in a Resource Extraction Site, then leave before greed turns it into a rebuy.',ALL,'activity'),
    task('pve-module-target','Shoot something important','Destroy at least three hostile ships after deliberately targeting a useful subsystem instead of only shooting the hull.',DEV_PLUS,'challenge'),
    task('pve-fixed-session','Fixed-weapon practice','Spend one combat session using at least one fixed weapon and focus on keeping good firing solutions.',DEV_PLUS,'challenge'),
    task('pve-hazres','HazRES pressure test','Spend 20 minutes in a Hazardous Resource Extraction Site and leave on your own terms.',EXP_PLUS,'challenge'),
    task('pve-wing-hunt','Wing bounty hunt','Join another Mongrel for a bounty-hunting session and practice target focus instead of splitting damage.',DEV_PLUS,'challenge','group'),
    task('pve-teach','Combat coach','Take a less-experienced Mongrel into PvE and teach one practical skill they can demonstrate before the session ends.',VET,'challenge','group'),
  ],
  pvp:[
    task('pvp-escape-drill','Interdiction escape drill','Practice submitting, boosting, evasive flying, and high-waking with a willing squadmate until the sequence feels automatic.',NEW_DEV,'challenge','group'),
    task('pvp-duels-3','Three friendly duels','Fight three rebuy-safe friendly duels and identify one mistake you repeated.',ALL,'activity','group'),
    task('pvp-pips','PvP pip drill','Run several short friendly rounds where your main goal is deliberate SYS/ENG/WEP management instead of winning.',ALL,'challenge','group'),
    task('pvp-fixed-accuracy','Fixed-weapon accuracy','Spend a duel session focusing on fixed-weapon hit rate rather than winning the fight.',DEV_PLUS,'challenge','group'),
    task('pvp-range-control','Control the range','Run several short duels where your only goal is to hold the engagement range you chose.',DEV_PLUS,'challenge','group'),
    task('pvp-defense','Survival round','Fight a stronger or more experienced pilot and make survival, disengagement, and recovery the objective.',EXP_PLUS,'challenge','group'),
    task('pvp-wing','Wing-fight night','Join a coordinated friendly wing fight and practice calls, focus fire, and staying with your team.',EXP_PLUS,'challenge','group'),
    task('pvp-coach','Teach one PvP fundamental','Coach another Mongrel through one PvP fundamental and keep drilling it until they improve measurably.',VET,'challenge','group'),
  ],
  ax:[
    task('ax-scouts-10','Scout sweep','Destroy 10 Thargoid Scouts in one session and return alive.',ALL,'activity'),
    task('ax-threat4','Clear a Scout pack','Clear a Threat 4 Non-Human Signal Source and return to port.',ALL,'activity'),
    task('ax-nhss-recon','NHSS reconnaissance','Find a Non-Human Signal Source yourself, enter it, identify what is there, and leave alive after completing a sensible objective for your current skill.',ALL,'activity'),
    task('ax-gauss-scouts','Gauss aim practice','Destroy at least three Scouts primarily with Guardian Gauss or another precision AX weapon.',DEV_PLUS,'challenge'),
    task('ax-cyclops','Cyclops hunt','Destroy a Cyclops Interceptor and return alive.',DEV_PLUS,'challenge'),
    task('ax-basilisk','Basilisk hunt','Destroy a Basilisk Interceptor and return alive.',EXP_PLUS,'challenge'),
    task('ax-wing-cz','AX wing operation','Join a wing and contribute through a complete AX conflict-zone objective when one is available.',EXP_PLUS,'challenge','group'),
    task('ax-mentor','Bring a Mongrel into AX','Help a less-experienced Mongrel complete a meaningful AX objective without simply carrying the fight for them.',VET,'challenge','group'),
  ],
  surface:[
    task('surface-missions-3','Three boots-on-ground jobs','Complete three on-foot missions in one session.',ALL,'activity'),
    task('surface-loot','Clean extraction','Complete an on-foot mission, collect useful materials along the way, and leave without dying.',ALL,'activity'),
    task('surface-one-settlement','One complete settlement run','Choose one settlement mission you understand, complete the objective from insertion through extraction, and return to port.',ALL,'activity'),
    task('surface-stealth','Quiet approach','Complete a settlement objective while avoiding unnecessary alarms and firefights.',DEV_PLUS,'challenge'),
    task('surface-gcz','Ground CZ run','Complete a ground conflict zone from deployment through final result.',DEV_PLUS,'activity'),
    task('surface-reactivation','Settlement reactivation','Complete a settlement reactivation or restoration-style operation.',DEV_PLUS,'challenge'),
    task('surface-team','Surface team operation','Run a coordinated surface mission with another Mongrel and divide roles before insertion.',EXP_PLUS,'challenge','group'),
    task('surface-coach','Teach settlement work','Take a newer player through a settlement operation and teach access, threat, and extraction habits.',VET,'challenge','group'),
  ],
  mining:[
    task('mining-100t','Fill 100 tonnes','Mine and sell at least 100 tonnes of your chosen commodity.',ALL,'activity'),
    task('mining-full-loop','Complete the whole loop','Start empty, locate a site, mine, refine/collect, travel to market, and sell the haul in one session.',ALL,'activity'),
    task('mining-method','Change the routine','Use a mining method or commodity you do not normally choose and complete a full gather-to-sell loop.',ALL,'challenge'),
    task('mining-core-5','Crack five cores','Find and successfully crack five core asteroids.',DEV_PLUS,'challenge'),
    task('mining-laser-200','Two-hundred-tonne laser run','Mine and sell at least 200 tonnes using laser mining.',DEV_PLUS,'challenge'),
    task('mining-new-site','Scout somewhere new','Try a mining location you have not used recently and decide whether you would return.',EXP_PLUS,'challenge'),
    task('mining-supply','Mine for a purpose','Choose a commodity needed by a current project, carrier, or squad goal and deliver a useful load.',EXP_PLUS,'challenge'),
    task('mining-mentor','Teach a full mining loop','Take another Mongrel from outfitting/site choice through sale and explain the decisions instead of only leading the way.',VET,'challenge','group'),
  ],
  trade:[
    task('trade-500t','Move 500 tonnes','Complete a profitable haul totaling at least 500 tonnes.',ALL,'activity'),
    task('trade-3legs','Three-leg trader','Complete three profitable station-to-station trade legs without using the same destination twice.',ALL,'activity'),
    task('trade-new-cargo','Haul something different','Choose a legal commodity you do not normally trade, find a profitable source/destination pair, and complete a successful run.',ALL,'challenge'),
    task('trade-medium','Medium-pad logistics','Run a profitable trade session using a medium-pad ship.',DEV_PLUS,'challenge'),
    task('trade-5m','Five-million-profit session','Earn at least 5 million credits in trade profit during one session.',DEV_PLUS,'challenge'),
    task('trade-fast-loop','Build a fast loop','Find or design a repeatable trade loop and complete three cycles while tracking turnaround time.',EXP_PLUS,'challenge'),
    task('trade-carrier','Carrier support haul','Load or unload at least 1,000 tonnes for a carrier or squad logistics objective.',EXP_PLUS,'challenge','group'),
    task('trade-coordinate','Coordinate the haulers','Organize a small hauling effort with at least one other Mongrel and divide the workload.',VET,'challenge','group'),
  ],
  'carrier-logistics':[
    task('carrier-tritium-500','Tritium top-up','Deliver at least 500 tonnes of Tritium to a carrier that can use it.',ALL,'activity'),
    task('carrier-load-1000','Load a thousand','Load at least 1,000 tonnes of cargo onto a carrier.',ALL,'activity'),
    task('carrier-unload-1000','Unload a thousand','Unload at least 1,000 tonnes from a carrier to the intended destination.',ALL,'activity'),
    task('carrier-route','Plan a carrier move','Plan a multi-jump carrier route including fuel needs and a reasonable contingency reserve.',DEV_PLUS,'challenge'),
    task('carrier-scout','Scout the destination','Scout a proposed carrier destination and verify useful nearby services or operational constraints.',DEV_PLUS,'challenge'),
    task('carrier-two-haulers','Two-hauler logistics','Coordinate a carrier load/unload with at least one other Commander and keep the flow organized.',EXP_PLUS,'challenge','group'),
    task('carrier-lead','Lead a carrier operation','Plan and run a small carrier logistics operation from objective through completion.',VET,'challenge','group'),
  ],
  engineering:[
    task('eng-one-module','Improve one real module','Choose one important module on a ship you actually fly and complete a meaningful engineering upgrade.',ALL,'activity'),
    task('eng-materials','Restock one material family','Pick Raw, Manufactured, or Encoded materials and deliberately improve your useful stock.',ALL,'activity'),
    task('eng-g3','Take something to Grade 3','Engineer one useful module to at least Grade 3 and understand why you chose that blueprint.',NEW_DEV,'activity'),
    task('eng-experimental','Choose an experimental','Add or change one experimental effect because you understand the tradeoff, not because a build list told you to.',DEV_PLUS,'challenge'),
    task('eng-build-plan','Engineer on paper first','Create a complete engineering plan for one ship before visiting any Engineer, including experimentals and power priorities.',EXP_PLUS,'challenge'),
    task('eng-compare','Compare two valid choices','Pick one module where two engineering approaches are plausible and explain which one better suits the ship’s role.',EXP_PLUS,'challenge'),
    task('eng-review','Review another build','Help another Mongrel improve a build by explaining priorities and tradeoffs instead of handing them a replacement list.',VET,'challenge','group'),
  ],
  exploration:[
    task('explore-500ly','Leave the neighborhood','Travel at least 500 light-years from your starting point and return with exploration data.',ALL,'activity'),
    task('explore-map5','Map five worlds','Fully map five bodies worth mapping during one session.',ALL,'activity'),
    task('explore-fss10','Ten-system survey','Fully FSS-scan ten systems you pass through instead of only honking and moving on.',ALL,'activity'),
    task('explore-new-system','Find something untouched','Visit systems off the obvious route and try to earn a first-discovery or first-mapping tag.',DEV_PLUS,'challenge'),
    task('explore-neutron','Use the neutron highway','Complete a route that includes at least three neutron supercharges and return safely.',DEV_PLUS,'challenge'),
    task('explore-2000ly','Two-thousand-light-year loop','Plan and complete an exploration loop of at least 2,000 light-years.',EXP_PLUS,'challenge'),
    task('explore-unusual','Find an unusual destination','Choose an unusual stellar, planetary, or regional target and navigate there without following a pre-written expedition route.',EXP_PLUS,'challenge'),
    task('explore-lead','Lead a mini expedition','Pick a destination and lead at least one other Mongrel on a short exploration outing.',VET,'challenge','group'),
  ],
  exobiology:[
    task('exo-three-species','Sample three species','Complete genetic samples for three different biological species.',ALL,'activity'),
    task('exo-first-footfall','Find your own biology','Look for an unexplored or lightly traveled body, earn first footfall if possible, and complete at least one sample.',ALL,'activity'),
    task('exo-one-body','Work one biological world','Choose one body with multiple biological signals and complete samples for at least two species there.',ALL,'activity'),
    task('exo-five-scans','Five complete samples','Complete five biological samples in one session.',DEV_PLUS,'challenge'),
    task('exo-value-run','High-value bio hunt','Deliberately target higher-value biological possibilities and complete at least three samples.',DEV_PLUS,'challenge'),
    task('exo-route','Build an exobiology route','Plan a short multi-system route around biological prospects instead of sampling only what you stumble across.',EXP_PLUS,'challenge'),
    task('exo-combined','Explore and sample','Complete a session where exploration mapping and exobiology are both meaningful parts of the route.',EXP_PLUS,'challenge'),
    task('exo-teach','Teach field technique','Take another Mongrel exobiology hunting and teach efficient planet selection, landing, and sample spacing.',VET,'challenge','group'),
  ],
  bgs:[
    task('bgs-read-orders','Work one real Daily Order','Open current Daily Orders, choose one posted BGS objective that matches your skills, and complete a meaningful contribution without freelancing against the plan.',ALL,'activity'),
    task('bgs-predict','Predict the tick','Pick one priority system, review its state/influence/objective, and decide what you expect the next tick to do before checking leadership guidance.',ALL,'challenge'),
    task('bgs-observe','Read before you push','Open Mission Control, choose one tracked system, and identify its influence band, state, alerts, and current objective before doing any BGS work.',ALL,'activity'),
    task('bgs-inf','Mission-INF contribution','If current Daily Orders call for mission support, complete roughly 15 INF worth of missions for the specified faction and stop there.',DEV_PLUS,'activity'),
    task('bgs-bounties','Voucher contribution','If current Daily Orders call for bounty support, redeem roughly 10M Cr in bounty vouchers for the specified beneficiary.',DEV_PLUS,'activity'),
    task('bgs-mixed','Mixed-lever BGS run','For a current raise objective, use two approved positive levers instead of grinding only one, then stop and let the tick measure the result.',EXP_PLUS,'challenge'),
    task('bgs-diagnose','Diagnose before acting','Choose one system outside its desired band and explain which factions/states are locked or sensitive before you do any work.',EXP_PLUS,'challenge'),
    task('bgs-brief','Brief another Mongrel','Explain one live BGS objective to another member, including what to do, what to avoid, and when to stop.',VET,'challenge','group'),
  ],
  colonization:[
    task('colony-haul500','Construction haul','Deliver at least 500 tonnes toward an active construction or colony logistics need.',ALL,'activity'),
    task('colony-three-runs','Three construction runs','Complete three cargo runs to or from a colony/construction site.',ALL,'activity'),
    task('colony-visit','Visit the frontier','Visit an active Mongrel colony or construction project, inspect what is being built, and complete at least one useful support run.',ALL,'activity'),
    task('colony-tour','Inspect a developing system','Visit a current colony system and inspect several sites/stations to understand how its layout and economies are developing.',DEV_PLUS,'activity'),
    task('colony-supply','Supply a real build','Choose an active project requirement and deliver a useful quantity of one needed commodity.',DEV_PLUS,'challenge'),
    task('colony-plan','Plan the logistics','Take one construction requirement and estimate shiploads, pad constraints, source market, and carrier usefulness before hauling.',EXP_PLUS,'challenge'),
    task('colony-carrier','Carrier construction support','Use or support a fleet carrier as part of a meaningful colony construction haul.',EXP_PLUS,'challenge','group'),
    task('colony-coordinate','Coordinate a build push','Organize at least one other Mongrel around a construction/logistics objective and keep the effort focused on the actual requirement.',VET,'challenge','group'),
  ],
  powerplay:[
    task('pp-review','Choose one Powerplay activity','Review the current Powerplay options available to you and complete one activity you already understand.',ALL,'activity'),
    task('pp-learn-one','Learn one mechanic','Pick one Powerplay mechanic you do not fully understand, research it, then perform the related activity once.',ALL,'challenge'),
    task('pp-short-session','Thirty-minute Powerplay session','Choose a Powerplay activity appropriate to your current allegiance and spend about 30 focused minutes doing it before reassessing.',ALL,'activity'),
    task('pp-merits','Complete a merit session','Set a modest personal merit target and complete it without turning the session into an all-night grind.',DEV_PLUS,'activity'),
    task('pp-route','Plan before committing','Compare two possible Powerplay activities and choose the one that best fits your ship, location, and available time.',DEV_PLUS,'challenge'),
    task('pp-efficient','Efficiency test','Repeat one Powerplay activity several times and improve your turnaround or execution between the first and last run.',EXP_PLUS,'challenge'),
    task('pp-wing','Powerplay with a wing','Complete a Powerplay session with another Commander and coordinate the activity rather than simply flying nearby.',EXP_PLUS,'challenge','group'),
    task('pp-teach','Teach one Powerplay loop','Teach another Mongrel one Powerplay activity you know well and have them complete it independently.',VET,'challenge','group'),
  ],
  operations:[
    task('ops-daily','Take a Daily Order','Open current Daily Orders and complete one task that genuinely matches your skills.',ALL,'activity'),
    task('ops-help','Answer a help request','Look for a Mongrel who needs a wingmate, logistics help, build advice, or another practical assist and spend part of the session helping them.',ALL,'activity','group'),
    task('ops-briefing','Check the board before flying','Review Daily Orders, Projects, and Carrier Coordination, then choose the one current squad need where your available ship and time can actually help.',ALL,'activity'),
    task('ops-report','Close the loop','Complete a squad task and clearly report what you did and the useful result instead of disappearing after the work.',DEV_PLUS,'challenge'),
    task('ops-cross-skill','Support outside your default','Choose a current squad objective that uses a secondary skill instead of your normal specialty.',DEV_PLUS,'challenge'),
    task('ops-wing','Join a coordinated operation','Join a Mongrel wing/team activity and follow the agreed objective through completion.',EXP_PLUS,'challenge','group'),
    task('ops-lead','Lead a small operation','Turn one current squad need into a simple brief, gather at least one other member, and lead the work to a clear stopping point.',VET,'challenge','group'),
    task('ops-mentor','Grow another Mongrel','Spend a session helping another member become independently better at one activity useful to the squad.',VET,'challenge','group'),
  ],
};

export function getEligibleStartTasks(activity, experience = 'new', playStyle = 'either') {
  const pool = Array.isArray(START_TASKS[activity]) ? START_TASKS[activity] : [];
  const levelPool = pool.filter(item => Array.isArray(item.levels) && item.levels.includes(experience));
  const stylePreferred = levelPool.filter(item => !(playStyle === 'solo' && item.style === 'group'));
  const selected = stylePreferred.length >= DAILY_TASK_LIMIT ? stylePreferred : levelPool;
  return selected.map(item => ({ ...item, link:item.link || START_ACTIVITY_META[activity]?.link || '/activities/' }));
}
