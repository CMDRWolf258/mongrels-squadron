export const EXPLORATION_ACTIVITY_ID = 'exploration';

const EXPLORATION_HUB = '/activities/#exploration';
const RESOURCES = '/guides/resources/';
const PROJECTS = '/projects/';
const GALLERY = '/gallery/?filter=Exploration';
const SPANSH = 'https://www.spansh.co.uk/';

export const EXPLORATION_ROUTES = [
  {
    id:'exploration-foundations',
    band:'Beginner',
    title:'Exploration Foundations — Leave, Survey, Return',
    subtitle:'Prepare one ship you already trust, complete a short independent survey loop, and return with the data intact.',
    audience:'For a Commander who is new to deliberate exploration or has travelled before without really using the Discovery Scanner, FSS, DSS, route tools, fuel planning, and safe return as one connected workflow.',
    outcome:'Graduate by planning and completing a short exploration loop without following a turn-by-turn route, then selling the data safely and explaining what you would change before going farther.',
    sourceNote:'This route teaches the complete exploration loop before optimizing jump range or chasing rare discoveries. The objective is self-sufficiency, not maximum credits or distance.',
    sources:[
      { label:'Exploration & Discovery Hub', url:EXPLORATION_HUB },
      { label:'External Resources · Spansh and EDSY', url:RESOURCES },
      { label:'Spansh Route Tools', url:SPANSH },
    ],
    tasks:[
      {
        id:'exploration-foundations-ship', stage:'Build', type:'build', title:'Prepare one rebuy-safe exploration ship',
        objective:'Use a ship you already own and fit it for reliable travel. Make sure you can scoop fuel, scan systems, map planets, survive an imperfect landing or heat mistake, and still afford the rebuy.',
        why:'The first exploration ship does not need to be a record-setting jump build. It needs enough range, fuel, scanning capability, and survivability that you can learn the loop without one forgotten module ending the trip.',
        checklist:['Fuel Scoop fitted.','Detailed Surface Scanner fitted.','Discovery/FSS controls understood.','Enough jump range for the planned trip.','Rebuy covered.','You know which optional repair or surface tools you chose to carry and why.'],
        link:{ label:'Open EDSY / Exploration Resources', url:RESOURCES },
      },
      {
        id:'exploration-foundations-route', stage:'Plan', type:'learn', title:'Plan a short loop you can navigate yourself',
        objective:'Choose a destination or small loop outside your normal traffic pattern, plot it yourself, and identify at least one safe fuel or return option before departure.',
        why:'Exploration begins before the first jump. A modest route teaches fuel range, map filters, plotting, and return planning without making distance itself the challenge.',
        checklist:['Destination or loop chosen.','Route plotted without a turn-by-turn walkthrough.','Fuel strategy checked.','A return or alternate stop is understood.'],
        link:{ label:'Open Spansh Route Tools', url:SPANSH, external:true },
      },
      {
        id:'exploration-foundations-scan', stage:'Survey', type:'demonstrate', title:'Honk and read several systems with the FSS',
        objective:'In several systems on the route, use the Discovery Scanner and Full Spectrum System Scanner deliberately instead of jumping through immediately. Identify stars, bodies, signal counts, and anything that looks worth closer attention.',
        why:'An explorer is not only travelling. The FSS turns an anonymous waypoint into a system you can interpret and decide whether to investigate further.',
        checklist:['Multiple systems scanned deliberately.','You can tell when the FSS survey is complete.','You identified at least one body or signal that justified closer inspection.'],
      },
      {
        id:'exploration-foundations-dss', stage:'Map', type:'demonstrate', title:'Choose and map bodies with the DSS',
        objective:'Use the Detailed Surface Scanner on several bodies you deliberately selected rather than mapping everything automatically. Pay attention to approach time, probe efficiency, surface signals, and what made each body worth the detour.',
        why:'Mapping has a travel cost. Learning when the extra supercruise and mapping time are worth it is more useful than memorizing one universal list of bodies to scan.',
        checklist:['Several bodies mapped.','Probe interface used confidently.','At least one long or low-value detour intentionally rejected.','You can explain why you mapped the bodies you chose.'],
      },
      {
        id:'exploration-foundations-safety', stage:'Safety', type:'demonstrate', title:'Practice the small mistakes before deep space makes them expensive',
        objective:'During the trip, deliberately practice safe fuel-scooping distance, heat awareness, star exclusion-zone discipline, and one controlled planetary approach or landing if your ship is equipped for it.',
        why:'Most early exploration losses are not caused by exotic deep-space hazards. They come from ordinary fuel, heat, star, and landing mistakes repeated far from help.',
        checklist:['Fuel scooping performed without panic.','Heat kept under control.','You can recognize a dangerous star approach.','If landing-equipped, one controlled surface approach completed.'],
      },
      {
        id:'exploration-foundations-return', stage:'Return', type:'demonstrate', title:'Bring the data home before changing the build',
        objective:'Return to a safe data-selling location and sell the exploration data before treating the trip as complete. Note anything that made the return leg harder than expected.',
        why:'Unsold exploration data is part of the risk. The complete loop includes getting it home rather than only reaching the destination.',
        checklist:['Returned safely.','Exploration data sold.','You noted at least one risk or inconvenience from the return leg.'],
      },
      {
        id:'exploration-foundations-review', stage:'Compare', type:'challenge', title:'Name one change that would make the next trip better',
        objective:'Review the trip and choose one evidence-based improvement for the next outing: range, scoop speed, heat, repair capability, surface access, route choice, scan discipline, or another problem you actually experienced.',
        why:'Exploration builds should grow from trips you have actually flown. One measured improvement is more useful than copying a fully optimized expedition build before you know what bothers you.',
        checklist:['One real problem identified.','One change selected.','At least one tempting but unnecessary upgrade rejected.'],
      },
      {
        id:'exploration-foundations-graduate', stage:'Graduate', type:'challenge', title:'Repeat the whole loop without the route checklist',
        objective:'Plan and complete another short exploration trip independently: prepare the ship, plot the route, survey systems, choose what to map, manage fuel and safety, return, and sell the data.',
        why:'Graduation means the process belongs to you. Distance and credits are secondary to being able to leave and return without needing a script.',
        checklist:['Ship prepared independently.','Route planned independently.','Systems surveyed deliberately.','Data returned and sold.','No essential exploration step required a walkthrough.'],
        link:{ label:'Browse Mongrel Exploration Gallery', url:GALLERY },
      },
    ],
  },
  {
    id:'exploration-surveyor',
    band:'Developing',
    title:'Surveyor — Read the Route, Not Just the Destination',
    subtitle:'Measure how you travel and scan, then make deliberate choices about route mode, system depth, mapping detours, and the information worth keeping.',
    audience:'For a Commander who can already leave, scan, map, and return safely but wants a more efficient and intentional exploration workflow.',
    outcome:'Graduate by comparing two real exploration runs, identifying the largest source of wasted travel or scanning time, and demonstrating a better survey workflow without simply skipping everything.',
    sourceNote:'This route treats exploration efficiency as decision quality. Faster is only better when you are still finding the things you care about.',
    sources:[
      { label:'Exploration & Discovery Hub', url:EXPLORATION_HUB },
      { label:'Spansh Route Tools', url:SPANSH },
      { label:'Mongrel Exploration Gallery', url:GALLERY },
    ],
    tasks:[
      {
        id:'exploration-surveyor-baseline', stage:'Baseline', type:'demonstrate', title:'Record one honest survey run',
        objective:'Complete a normal exploration session and record what you actually did: jumps, approximate route time, number of systems fully FSS-scanned, bodies mapped, surface detours if any, and anything that slowed the run.',
        why:'You cannot tell whether a scanning habit or route choice is helping until you have a baseline that includes more than total distance.',
        checklist:['Jumps or route length recorded.','Session time estimated.','Systems scanned recorded.','Bodies mapped recorded.','Primary delay noted.'],
      },
      {
        id:'exploration-surveyor-route-modes', stage:'Navigation', type:'demonstrate', title:'Compare route plotting choices',
        objective:'Use two different route-planning approaches on comparable legs—for example ordinary galaxy-map plotting versus a specialist route tool, or fastest versus a more discovery-oriented route—and note how the experience changes.',
        why:'The fastest route and the most interesting route are often different products. An explorer should know which one is being optimized.',
        checklist:['Two route approaches compared.','Fuel implications understood.','You can state which approach better matched the purpose of each leg.'],
        link:{ label:'Open Spansh Route Tools', url:SPANSH, external:true },
      },
      {
        id:'exploration-surveyor-scan-rule', stage:'Survey', type:'challenge', title:'Create a system-scan decision rule',
        objective:'Define a simple rule for when you will stop to FSS deeply, when you will only make a quick pass, and when you will leave the system immediately. Test the rule across a real session.',
        why:'Scanning every signal in every system is thorough but can turn a travel objective into an accidental grind. Skipping everything removes the discovery part. A decision rule keeps the route purposeful.',
        checklist:['Decision rule chosen before the session.','Rule used consistently enough to evaluate.','At least one exception was made for a genuinely interesting system.'],
      },
      {
        id:'exploration-surveyor-mapping-rule', stage:'Map', type:'challenge', title:'Create a mapping-detour rule',
        objective:'Choose when a body is worth the supercruise and DSS time based on your goal—value, novelty, surface signals, first discovery potential, photography, future scouting, or another reason—and use that rule for one session.',
        why:'The value of a mapping detour depends on why you are exploring. The skill is making the choice deliberately rather than mapping by habit.',
        checklist:['Mapping rule defined.','Several bodies accepted.','Several bodies rejected.','At least one decision was based on something other than raw credits.'],
      },
      {
        id:'exploration-surveyor-data-discipline', stage:'Field Notes', type:'demonstrate', title:'Keep useful notes on something worth returning to',
        objective:'During the route, record at least one location, system, body, route condition, or discovery you may want to revisit or share. Use bookmarks, screenshots, journal tools, or another repeatable method.',
        why:'A discovery you cannot find again is difficult to turn into squad knowledge, an expedition target, or a future personal objective.',
        checklist:['At least one useful location recorded.','Method is repeatable.','Another Commander could understand enough of the note to find the place.'],
      },
      {
        id:'exploration-surveyor-rerun', stage:'Compare', type:'challenge', title:'Re-run after changing one survey habit',
        objective:'Complete a comparable second session after changing the biggest inefficiency or decision problem you identified. Compare the route without reducing the run to a pure speed test.',
        why:'Exploration optimization should improve the experience you want, not only the number of jumps per hour.',
        checklist:['Comparable second run completed.','One habit changed deliberately.','At least one metric or observation improved.','You can explain what was lost, if anything, by the faster or deeper approach.'],
      },
    ],
  },
  {
    id:'exploration-deep-space-navigator',
    band:'Developing / Experienced',
    title:'Deep-Space Navigator — Range, Neutrons & Recovery',
    subtitle:'Prepare for a trip where mistakes cannot be fixed by simply docking at the next station.',
    audience:'For an explorer who is comfortable with normal surveying and wants confidence with longer routes, neutron-assisted travel, remote repair, fuel margins, and recovery planning.',
    outcome:'Graduate by completing a deliberately remote route that includes advanced travel planning and at least one practiced recovery procedure, then returning without treating rescue as the normal plan.',
    sourceNote:'This route teaches remote self-reliance. It does not require an extreme-range meta ship, a record destination, or reckless neutron use.',
    sources:[
      { label:'Spansh Route Tools', url:SPANSH },
      { label:'External Exploration Resources', url:RESOURCES },
      { label:'Projects & Expeditions', url:PROJECTS },
    ],
    tasks:[
      {
        id:'exploration-deep-build-audit', stage:'Build', type:'build', title:'Audit the ship for remote failure modes',
        objective:'Review fuel scoop, heat behavior, FSD integrity/repair options, hull/surface risk, power priorities, synthesis capability, and whether the ship can tolerate one mistake without becoming stranded.',
        why:'Deep-space resilience is not the same as maximum jump range. A ship that travels slightly farther but cannot recover from a damaged FSD or bad landing may be less useful on a real expedition.',
        checklist:['Fuel and scoop margin understood.','Repair strategy understood.','Power priorities checked.','Surface risk considered if landing.','At least one unnecessary module or unnecessary fragility identified.'],
      },
      {
        id:'exploration-deep-fuel-margin', stage:'Navigation', type:'demonstrate', title:'Travel with deliberate fuel margin',
        objective:'Complete a route leg where you actively monitor scoopable stars, tank state, and the galaxy-map route rather than waiting for a low-fuel warning to make the decision for you.',
        why:'Fuel emergencies are usually visible before they become emergencies. The skill is recognizing the trend early enough to change course calmly.',
        checklist:['Fuel state monitored.','Scoopable-star availability checked.','At least one route decision made before fuel became critical.'],
      },
      {
        id:'exploration-deep-neutron-plan', stage:'Plan', type:'learn', title:'Plan a neutron-assisted leg before flying it',
        objective:'Use a specialist route tool to compare a neutron-assisted route with an ordinary route. Understand the expected benefit, extra FSD wear, and where you would stop using boosts if the ship or Commander is no longer comfortable.',
        why:'Neutron travel is a tool, not a requirement. Planning it first keeps the time saving from becoming an uncontrolled risk experiment.',
        checklist:['Ordinary route compared with neutron route.','FSD wear understood.','A stop condition chosen.','Repair capability checked before departure.'],
        link:{ label:'Open Spansh Neutron / Galaxy Tools', url:SPANSH, external:true },
      },
      {
        id:'exploration-deep-neutron-practice', stage:'Technique', type:'demonstrate', title:'Complete controlled neutron boosts',
        objective:'Use neutron boosting on a controlled route while maintaining safe approach discipline and monitoring FSD integrity. Stop if the procedure becomes unstable rather than forcing the route.',
        why:'The useful skill is repeatable control. A single dramatic boost does not matter if the next one damages or destroys the expedition.',
        checklist:['Boost entry performed deliberately.','FSD integrity checked.','At least one boost completed without losing situational control.','You know when to stop using the neutron route.'],
      },
      {
        id:'exploration-deep-repair', stage:'Recovery', type:'demonstrate', title:'Practice remote repair before you need it',
        objective:'Use the ship’s actual repair strategy in a safe situation—such as repairing FSD/module damage with an AFMU or demonstrating the alternative recovery plan your build uses. Know what the chosen repair tool cannot repair as well as what it can.',
        why:'A repair module you have never operated is not yet a recovery plan.',
        checklist:['Repair procedure practiced.','Power/module handling understood.','Limitations of the repair method understood.','You know what damage would still force a route change or rescue request.'],
      },
      {
        id:'exploration-deep-remote-leg', stage:'Challenge', type:'challenge', title:'Complete a genuinely remote leg and return',
        objective:'Choose a route far enough from routine services that preparation matters, complete it using the fuel/neutron/repair discipline you practiced, and return or reach a planned safe endpoint without relying on a rescue as the expected outcome.',
        why:'The capstone is not distance for its own sake. It is proving that the ship, route, and recovery plan work together when help is inconvenient.',
        checklist:['Remote objective reached.','Fuel remained controlled.','FSD/ship condition monitored.','Any recovery action was handled deliberately.','Data reached a safe endpoint.'],
      },
    ],
  },
  {
    id:'exploration-discovery-specialist',
    band:'Experienced',
    title:'Discovery Specialist — Scout With a Purpose',
    subtitle:'Turn exploration from general wandering into deliberate reconnaissance, unusual-target hunting, documentation, and useful squad knowledge.',
    audience:'For an experienced explorer who can travel and recover independently and now wants more purposeful discovery work.',
    outcome:'Graduate by defining a discovery objective, scouting it independently, documenting useful findings, and producing something another Mongrel could act on or revisit.',
    sourceNote:'This route rewards curiosity and useful documentation rather than one specific rare body, credit payout, or first-discovery badge.',
    sources:[
      { label:'Exploration Gallery', url:GALLERY },
      { label:'Projects & Expeditions', url:PROJECTS },
      { label:'Spansh Galaxy Tools', url:SPANSH },
    ],
    tasks:[
      {
        id:'exploration-specialist-objective', stage:'Plan', type:'challenge', title:'Choose a discovery objective that changes how you route',
        objective:'Choose a clear scouting objective such as unusual stellar features, a region boundary, valuable worlds, remote landable bodies, photo targets, route reconnaissance, colony-support reconnaissance, or another defined discovery goal.',
        why:'Purpose changes what “interesting” means. A route built for a photo expedition should not be evaluated by the same rules as a fast transit or strategic scouting mission.',
        checklist:['Objective written clearly.','Success criteria defined.','Route/search method chosen to match the objective.'],
      },
      {
        id:'exploration-specialist-search', stage:'Scouting', type:'demonstrate', title:'Use galaxy tools to narrow the search without outsourcing the discovery',
        objective:'Use map filters or specialist galaxy tools to define a useful search area, then do the actual system-level scouting yourself rather than following a prewritten list of guaranteed finds.',
        why:'External tools are most powerful when they reduce an impossible search space while leaving the observation and judgement to the explorer.',
        checklist:['Search area narrowed.','Tool assumptions understood.','Systems still evaluated in-game rather than treated as guaranteed answers.'],
        link:{ label:'Open Spansh Galaxy Tools', url:SPANSH, external:true },
      },
      {
        id:'exploration-specialist-evaluate', stage:'Analysis', type:'challenge', title:'Separate novelty, value, beauty, and strategic usefulness',
        objective:'For several candidate systems, explain why each is or is not worth further investigation using more than one dimension: novelty, scan value, surface access, visual interest, route position, future expedition usefulness, or squad relevance.',
        why:'Experienced exploration is judgement. The same system can be unremarkable for credits and excellent as a waypoint, photo site, colony scout, or expedition objective.',
        checklist:['Several candidates compared.','More than one value dimension used.','At least one high-credit or visually impressive candidate rejected because it did not serve the objective.'],
      },
      {
        id:'exploration-specialist-document', stage:'Field Notes', type:'demonstrate', title:'Document a find so somebody else can use it',
        objective:'Create a concise record for at least one useful discovery containing the system/body, why it matters, any approach or landing notes, and enough context that another Commander can reproduce the visit.',
        why:'Documentation turns a personal screenshot into reusable squad knowledge.',
        checklist:['Location recorded precisely.','Reason for interest recorded.','Approach/landing/risk notes included when relevant.','Record is understandable by another Commander.'],
      },
      {
        id:'exploration-specialist-share', stage:'Support', type:'wing', title:'Turn the discovery into a squad-useful recommendation',
        objective:'Share one finding, route segment, or scouting conclusion with another Mongrel, a project lead, or an expedition group and explain what action it supports.',
        why:'Scouting becomes operationally useful when the result reaches the people who can use it.',
        checklist:['Finding shared.','Recommended use explained.','Questions or follow-up from another Commander handled.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
      {
        id:'exploration-specialist-capstone', stage:'Capstone', type:'challenge', title:'Complete a purpose-built scouting mission',
        objective:'Plan and execute a scouting trip around one defined objective, return or reach a safe endpoint, and produce a short final summary of what you found, what you did not find, and what should happen next.',
        why:'A specialist can turn an open-ended galaxy into a bounded problem, search it intelligently, and report a useful result even when the perfect target never appears.',
        checklist:['Objective-driven trip completed.','Search process documented.','Useful findings recorded.','Negative/unsuccessful search information preserved when relevant.','Next recommendation stated.'],
      },
    ],
  },
  {
    id:'exploration-lead-mentor',
    band:'Veteran / Mentor',
    title:'Expedition Lead — Plan, Recover, Teach',
    subtitle:'Design an exploration operation other Commanders can actually participate in, keep the group moving when something goes wrong, and leave newer explorers more capable afterward.',
    audience:'For veteran explorers ready to lead expeditions, support squad reconnaissance, mentor newer Commanders, and own the operational side of long-range discovery.',
    outcome:'Graduate by planning and leading a small exploration operation or mentoring sequence with clear objectives, rendezvous/recovery planning, useful reporting, and demonstrated development of another Commander.',
    sourceNote:'Veteran progression is not “fly farther.” It is planning, risk management, judgement, communication, recovery, and teaching.',
    sources:[
      { label:'Projects & Expeditions', url:PROJECTS },
      { label:'Exploration Gallery', url:GALLERY },
      { label:'External Route Resources', url:RESOURCES },
    ],
    tasks:[
      {
        id:'exploration-lead-concept', stage:'Planning', type:'mentor', title:'Design an expedition with a real objective',
        objective:'Create a small expedition or reconnaissance concept with a clear purpose, expected duration, participation assumptions, route style, and what useful result should exist at the end.',
        why:'“Fly somewhere far away” is a destination, not an operation. A leader gives the group a reason to go and a way to know when the objective is complete.',
        checklist:['Purpose defined.','Expected duration/commitment stated.','Participant assumptions stated.','End product or success condition defined.'],
      },
      {
        id:'exploration-lead-route', stage:'Planning', type:'wing', title:'Build rendezvous, fuel, repair, and fallback into the route',
        objective:'Plan the expedition route with realistic rendezvous points, slower-ship compatibility, fuel considerations, repair/recovery options, and at least one fallback if the primary route or destination becomes impractical.',
        why:'Group exploration is constrained by the fleet, not the lead ship’s maximum range.',
        checklist:['Rendezvous points chosen.','Slowest practical ship considered.','Fuel/repair assumptions checked.','Fallback route or safe endpoint defined.'],
      },
      {
        id:'exploration-lead-brief', stage:'Briefing', type:'mentor', title:'Brief participants without turning the trip into a script',
        objective:'Give participants the objective, risk notes, required capabilities, rendezvous expectations, and communication plan while leaving room for independent discovery between waypoints.',
        why:'Good expedition leadership creates shared intent without eliminating the exploration part.',
        checklist:['Objective explained.','Required capabilities separated from optional recommendations.','Rendezvous/comms expectations clear.','Participants still have freedom to scout independently.'],
      },
      {
        id:'exploration-lead-operate', stage:'Wing / Team', type:'wing', title:'Lead the route and adapt once',
        objective:'Run a meaningful portion of the expedition with other Commanders and make at least one real adjustment based on fleet condition, timing, discovery opportunity, route issue, or participant needs.',
        why:'The test of a plan is what happens after the galaxy refuses to follow it exactly.',
        checklist:['Group leg completed.','Fleet condition monitored.','At least one adjustment made for a real reason.','Change communicated clearly.'],
      },
      {
        id:'exploration-lead-recovery', stage:'Recovery', type:'wing', title:'Practice or handle an expedition recovery problem',
        objective:'Resolve or simulate one realistic problem such as a damaged FSD, fuel concern, missed rendezvous, unexpectedly short jump range, difficult surface extraction, or participant needing to leave early. Keep the solution proportional to the problem.',
        why:'Expedition leadership includes getting people unstuck without turning every problem into a crisis.',
        checklist:['Problem identified.','Options compared.','Safe solution chosen.','Participant or group understood the recovery plan.'],
      },
      {
        id:'exploration-lead-mentor', stage:'Teach / Mentor', type:'mentor', title:'Make another explorer more independent',
        objective:'Mentor another Mongrel through one exploration skill they could not confidently perform before—route planning, FSS/DSS judgement, neutron travel, repair, expedition build decisions, documentation, or another meaningful skill.',
        why:'The strongest proof of mastery is not doing the task for somebody else. It is leaving them able to do it without you.',
        checklist:['One specific skill chosen.','Commander performed the skill themselves.','You corrected judgement/process rather than only giving answers.','They can repeat it independently.'],
      },
      {
        id:'exploration-lead-debrief', stage:'Debrief', type:'mentor', title:'Publish the lessons and next recommendation',
        objective:'After the operation, summarize what worked, what created unnecessary risk or delay, useful discoveries, participant lessons, and one concrete improvement for the next expedition.',
        why:'A debrief turns one expedition into better squad capability instead of a story that disappears into chat history.',
        checklist:['Useful discoveries preserved.','Operational lesson recorded.','Participant-development lesson recorded.','One next improvement recommended.'],
      },
    ],
  },
];

export function eligibleExplorationRoutes(experience = 'new') {
  if (experience === 'experienced') return ['exploration-lead-mentor','exploration-discovery-specialist','exploration-deep-space-navigator'];
  if (experience === 'comfortable') return ['exploration-discovery-specialist','exploration-deep-space-navigator','exploration-surveyor'];
  if (experience === 'some') return ['exploration-surveyor','exploration-deep-space-navigator','exploration-foundations'];
  return ['exploration-foundations'];
}

export function getExplorationRoute(id) {
  return EXPLORATION_ROUTES.find(route => route.id === id) || null;
}
