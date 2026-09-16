export const COLONIZATION_ACTIVITY_ID = 'colonization';

const PROJECTS = '/projects/';
const CARRIERS = '/carriers/';
const TRADE = '/trading/';
const BGS = '/guides/bgs/';
const FRONTIER_TRAILBLAZERS = 'https://www.elitedangerous.com/update-notes/4-1-0-0';

export const COLONIZATION_ROUTES = [
  {
    id:'colonization-foundations',
    band:'Beginner',
    title:'Colonization Foundations — Join a Build, Finish a Loop',
    subtitle:'Learn Colonization by contributing to one real construction project instead of needing to own a system first.',
    audience:'For a Commander who is new to Colonization or has hauled colony commodities without understanding the complete construction loop.',
    outcome:'Graduate by joining a real Colonization project, identifying the active build and requirement, delivering useful cargo, verifying that the contribution counted, and explaining what happens next.',
    sourceNote:'System Colonization begins with a claim and primary port, but squad members can learn the practical loop by supporting any active build. Ownership is not required for this route.',
    sources:[
      { label:'Mongrel Projects & Events', url:PROJECTS },
      { label:'Frontier Trailblazers overview', url:FRONTIER_TRAILBLAZERS, external:true },
    ],
    tasks:[
      {
        id:'colonization-foundations-find', stage:'Find', type:'learn', title:'Find one real Colonization project',
        objective:'Choose an active squad or member Colonization project. Identify the system, the structure currently under construction, its current status, and what help is actually requested before loading cargo.',
        why:'Colonization support is useful only when it serves the build that is actually active. A random cargo load can be wasted effort.',
        checklist:['Active project identified.','System identified.','Current construction identified.','Requested help or commodity need confirmed.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
      {
        id:'colonization-foundations-loop', stage:'Learn', type:'learn', title:'Understand the basic construction loop',
        objective:'Explain the practical sequence: an eligible system is claimed, a primary port is established, construction requirements are supplied, the build completes, and later structures expand the colony.',
        why:'The hauling makes more sense when you know which phase of the colony lifecycle it supports.',
        checklist:['Claim/primary-port concept understood.','Construction requirement concept understood.','Completion/activation concept understood.','Later-build expansion concept understood.'],
        link:{ label:'Frontier Trailblazers overview', url:FRONTIER_TRAILBLAZERS, external:true },
      },
      {
        id:'colonization-foundations-capacity', stage:'Prepare', type:'build', title:'Use a ship that fits the delivery job',
        objective:'Choose a ship you already own that can safely move a useful load to the project. Check cargo capacity, pad access where relevant, jump range, rebuy, and whether the route needs carrier staging or another logistics handoff.',
        why:'The best beginner Colonization ship is the one that can complete the actual delivery reliably. Ownership of a maximum-capacity hauler is not a prerequisite.',
        checklist:['Cargo capacity known.','Destination access checked.','Route/rebuy checked.','Carrier or handoff need considered.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'colonization-foundations-source', stage:'Source', type:'demonstrate', title:'Source only what the build still needs',
        objective:'Before buying or loading, confirm the current outstanding requirement and choose a source that makes sense for the amount you can carry. Do not assume yesterday’s requirement is still current.',
        why:'Construction totals change as other Commanders contribute. Rechecking prevents overbuying and keeps the squad focused on the remaining bottleneck.',
        checklist:['Outstanding need rechecked.','Commodity and quantity chosen from current need.','Source selected deliberately.'],
        link:{ label:'Open Trader’s Outpost', url:TRADE },
      },
      {
        id:'colonization-foundations-deliver', stage:'Deliver', type:'demonstrate', title:'Complete one construction delivery',
        objective:'Move the cargo to the correct construction destination and contribute it through the intended Colonization/construction interface. Keep enough evidence to confirm that the delivered amount reduced the requirement.',
        why:'A successful loop is not merely arriving in-system with cargo; the contribution must land against the correct build.',
        checklist:['Correct destination reached.','Cargo contributed through the correct interface.','Delivered quantity confirmed.','Remaining requirement checked afterward.'],
      },
      {
        id:'colonization-foundations-close', stage:'Observe', type:'demonstrate', title:'Watch what happens after the delivery',
        objective:'After contributing, identify whether the build still needs materials, is ready to complete, is awaiting activation/server processing, or has moved on to the next construction target.',
        why:'Colonization is a sequence of state changes. Learning to read the state prevents members from continuing work after the objective has already moved.',
        checklist:['Post-delivery build state identified.','Next useful action identified.','No assumption that hauling is still required.'],
      },
      {
        id:'colonization-foundations-graduate', stage:'Graduate', type:'challenge', title:'Run the support loop independently',
        objective:'Without step-by-step coaching, find a current Colonization need, choose an appropriate ship/source, deliver a useful load, verify the contribution, and post or communicate the updated status so another Mongrel can continue.',
        why:'Graduation means you can join a colony project and make useful progress without creating coordination overhead for the project owner.',
        checklist:['Need verified independently.','Delivery completed independently.','Contribution verified.','Updated status communicated.'],
      },
    ],
  },
  {
    id:'colonization-construction-operator',
    band:'Developing',
    title:'Construction Operator — Supply, Stage, Close',
    subtitle:'Move from individual deliveries to managing a construction requirement efficiently and accurately.',
    audience:'For a Commander who can complete colony deliveries and wants to become reliable at sourcing, staging, progress reporting, and closing out builds.',
    outcome:'Graduate by helping drive one build from an incomplete requirement to a clean handoff or completion while keeping quantities, staging, and squad communication accurate.',
    sourceNote:'Construction work is a logistics problem before it is an architecture problem. This route teaches how to keep several haulers useful without overbuying, duplicating effort, or losing track of the true remaining requirement.',
    sources:[
      { label:'Mongrel Projects & Events', url:PROJECTS },
      { label:'Carrier Coordination', url:CARRIERS },
      { label:'Trader’s Outpost', url:TRADE },
    ],
    tasks:[
      {
        id:'colonization-operator-snapshot', stage:'Snapshot', type:'demonstrate', title:'Take an accurate requirement snapshot',
        objective:'For one active build, record the current outstanding commodities and quantities before work begins. Separate confirmed in-game requirements from estimates, old screenshots, or planned future builds.',
        why:'The squad needs one current picture of the job before multiple Commanders start buying cargo.',
        checklist:['Current build identified.','Outstanding quantities recorded.','Source/time of snapshot recorded.','Future/planned requirements kept separate.'],
      },
      {
        id:'colonization-operator-sourcing', stage:'Plan', type:'challenge', title:'Split sourcing into sensible loads',
        objective:'Turn the requirement snapshot into a hauling plan that respects ship capacity, pad access, source supply, travel time, and the number of available haulers. Avoid assigning more cargo than the build can accept.',
        why:'Good construction logistics minimizes empty travel and duplicate purchasing rather than maximizing one pilot’s tonnage.',
        checklist:['Loads divided intentionally.','Pad/capacity constraints considered.','Source availability considered.','Overbuy risk controlled.'],
      },
      {
        id:'colonization-operator-stage', stage:'Stage', type:'wing', title:'Use carrier staging only when it helps',
        objective:'For a build that benefits from staging, coordinate a Fleet Carrier or other handoff point and define who loads, who moves, and who unloads. If direct hauling is better, explain why staging would add needless steps.',
        why:'Carrier logistics can multiply throughput, but only when the extra handling actually reduces the total bottleneck.',
        checklist:['Direct vs staged hauling compared.','Carrier/handoff role chosen deliberately.','Load/move/unload ownership clear.','No unnecessary staging introduced.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'colonization-operator-live', stage:'Operate', type:'wing', title:'Keep the requirement live while others haul',
        objective:'During a multi-Commander construction session, update the remaining requirement often enough that incoming haulers can adjust before they overbuy or duplicate another pilot’s load.',
        why:'Colonization logistics is a moving target. A stale requirement list creates wasted cargo and wasted flight time.',
        checklist:['Progress updated during the session.','Incoming loads accounted for where practical.','Duplicate buying corrected before delivery when possible.'],
      },
      {
        id:'colonization-operator-bottleneck', stage:'Diagnose', type:'challenge', title:'Identify the real construction bottleneck',
        objective:'Decide whether the slowest part of the build is source supply, long travel, pad access, carrier handling, commodity mix, number of haulers, or simple coordination. Change one thing that addresses that bottleneck.',
        why:'Adding more cargo ships does not solve every logistics problem.',
        checklist:['Primary bottleneck named.','Evidence for bottleneck recorded.','One targeted change made.','Effect observed.'],
      },
      {
        id:'colonization-operator-closeout', stage:'Close', type:'demonstrate', title:'Close or hand off the build cleanly',
        objective:'When the final requirement is met or the session ends, confirm the true build state, stop unnecessary purchases, update the project status, and state the next useful colony action.',
        why:'A clean closeout prevents the squad from hauling yesterday’s requirement after the project has moved on.',
        checklist:['Final/paused state confirmed.','Unneeded purchases stopped.','Project/status updated.','Next action communicated.'],
        link:{ label:'Update Projects & Events', url:PROJECTS },
      },
    ],
  },
  {
    id:'colonization-system-architect',
    band:'Developing / Experienced',
    title:'System Architect — Claim With a Purpose',
    subtitle:'Learn to evaluate a system, choose a primary port deliberately, and turn a colony idea into a build sequence before committing the squad to it.',
    audience:'For a Commander who understands construction logistics and wants to participate in system selection, claiming, primary-port choice, or early colony planning.',
    outcome:'Graduate by producing and defending a practical colonization plan for a real or candidate system, including purpose, claim/primary-port decisions, early construction sequence, and a logistics reality check.',
    sourceNote:'Frontier’s Colonization flow begins at a Colonisation contact, followed by system selection, a primary-port choice, beacon deployment, and construction. This route teaches those decisions without requiring every learner to own a new claim.',
    sources:[
      { label:'Frontier Trailblazers overview', url:FRONTIER_TRAILBLAZERS, external:true },
      { label:'Mongrel Projects & Events', url:PROJECTS },
    ],
    tasks:[
      {
        id:'colonization-architect-purpose', stage:'Purpose', type:'learn', title:'State why this system should exist',
        objective:'For a real or candidate colony system, define the purpose before choosing structures: bridge/expansion node, mining base, trade hub, BGS foothold, exploration support, personal home, tourism destination, or another concrete role.',
        why:'A colony without a purpose tends to accumulate expensive structures that do not support one another.',
        checklist:['Primary purpose stated.','Secondary purpose limited to what can coexist.','Success condition described.'],
      },
      {
        id:'colonization-architect-system', stage:'Survey', type:'challenge', title:'Evaluate the candidate system',
        objective:'Use the Galaxy/System Map and available scouting data to evaluate location, reachable neighbors, bodies, rings/resources, usable construction sites, travel times, and any feature that materially affects the colony purpose.',
        why:'The system itself is the first design constraint. Infrastructure cannot fix every poor location choice.',
        checklist:['Strategic location considered.','Body/site options considered.','Resource/travel considerations recorded.','Major limitation identified.'],
      },
      {
        id:'colonization-architect-claim', stage:'Claim', type:'demonstrate', title:'Understand or shadow the claim sequence',
        objective:'Perform the claim process if you are the owner, or shadow/analyze a real claim if you are not: Colonisation contact, system selection, primary-port selection, beacon deployment, and arrival of the construction phase.',
        why:'Ownership should not gate learning, but architects must understand the irreversible or time-sensitive decisions that occur before hauling begins.',
        checklist:['Colonisation contact step understood.','Primary-port decision understood.','Beacon/deployment step understood.','Construction handoff understood.'],
        link:{ label:'Frontier Trailblazers overview', url:FRONTIER_TRAILBLAZERS, external:true },
      },
      {
        id:'colonization-architect-primary', stage:'Primary Port', type:'challenge', title:'Choose the primary port for the job',
        objective:'Compare at least two reasonable primary-port choices for the same colony purpose. Consider construction burden, services/capability, pad access, location inside the system, and what the early colony actually needs.',
        why:'The largest or most prestigious option is not automatically the best first port.',
        checklist:['At least two options compared.','Construction burden considered.','Access/services considered.','Location considered.','Choice defended.'],
      },
      {
        id:'colonization-architect-sequence', stage:'Sequence', type:'challenge', title:'Draft the first build sequence',
        objective:'Plan the first several structures in an order that supports the colony purpose and the next construction unlocks or capabilities. Separate must-have infrastructure from nice-to-have expansion.',
        why:'Build order determines when the colony becomes useful and how much logistics must be completed before it pays back in capability.',
        checklist:['First several builds ordered.','Reason for each build stated.','Must-have vs optional identified.','Dependencies/constraints noted.'],
      },
      {
        id:'colonization-architect-logistics', stage:'Reality Check', type:'challenge', title:'Price the plan in squad effort',
        objective:'Before committing, estimate the hauling, sourcing, carrier support, active players, and time windows the proposed early build sequence will require. Scale the plan if the squad cannot realistically support it.',
        why:'A technically valid architecture can still be a bad squad project if the logistics burden is larger than the available team.',
        checklist:['Hauling burden estimated.','Likely sources/staging considered.','Available team considered.','Plan scaled if needed.'],
      },
      {
        id:'colonization-architect-brief', stage:'Brief', type:'mentor', title:'Turn the plan into a squad-readable brief',
        objective:'Publish or present the colony purpose, claim state, first build target, current logistics need, and next decision in a form another Mongrel can act on without asking for the entire history.',
        why:'A colony plan becomes useful when it can coordinate people who were not in the original planning conversation.',
        checklist:['Purpose concise.','Current build clear.','Help request actionable.','Next decision visible.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
    ],
  },
  {
    id:'colonization-colony-developer',
    band:'Experienced',
    title:'Colony Developer — Build a System, Not a Pile of Sites',
    subtitle:'Use construction choices, local infrastructure, economy, population, and BGS awareness to make the colony function as a coherent system.',
    audience:'For a Commander who can plan and complete structures and wants to reason about what later development actually changes for the system.',
    outcome:'Graduate by diagnosing one colony-development goal, choosing a build or operational intervention that addresses it, measuring the result after activation, and preserving the lesson for the next development decision.',
    sourceNote:'Colonization development has moving and sometimes opaque interactions. This route emphasizes observed in-game results and current project data over pretending every economy or system-stat effect is perfectly known forever.',
    sources:[
      { label:'Mongrel Projects & Events', url:PROJECTS },
      { label:'BGS Operator Manual', url:BGS },
      { label:'Carrier Coordination', url:CARRIERS },
    ],
    tasks:[
      {
        id:'colonization-developer-goal', stage:'Goal', type:'challenge', title:'Choose one development goal',
        objective:'Pick one measurable colony problem or goal: population, market/economy capability, logistics access, security, technology, wealth, standard of living, development, strategic BGS use, or another current system need. Do not try to optimize everything at once.',
        why:'Colony development becomes guesswork when every build is justified by a different goal after the fact.',
        checklist:['One primary goal chosen.','Current baseline recorded.','Success measure defined.'],
      },
      {
        id:'colonization-developer-links', stage:'Map', type:'challenge', title:'Map the local infrastructure relationships',
        objective:'Identify which port, body, settlements, installations, hubs, or nearby infrastructure are expected to influence the development goal. Mark assumptions separately from effects you have actually observed.',
        why:'Colonization systems can have local relationships that are not obvious from a simple system-wide list.',
        checklist:['Relevant local sites mapped.','Observed effects separated from assumptions.','Uncertain relationship identified.'],
      },
      {
        id:'colonization-developer-choice', stage:'Choose', type:'challenge', title:'Choose the smallest useful intervention',
        objective:'Select one build, support structure, logistics change, or operational action that is expected to move the chosen development goal. Explain why it is preferred over at least one alternative.',
        why:'Building the biggest available structure is not a substitute for understanding the problem.',
        checklist:['Intervention stated.','Expected effect stated.','Alternative compared.','Cost/effort considered.'],
      },
      {
        id:'colonization-developer-build', stage:'Execute', type:'wing', title:'Coordinate the development build',
        objective:'Create or use a project, organize sourcing/hauling, and complete the chosen intervention without losing the original development goal in the logistics.',
        why:'The build process should preserve the reason the structure was selected, not become an end in itself.',
        checklist:['Project/brief available.','Logistics coordinated.','Build completed or advanced meaningfully.','Original goal kept visible.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
      {
        id:'colonization-developer-measure', stage:'Measure', type:'demonstrate', title:'Measure after activation',
        objective:'After the site becomes active and relevant data updates, compare the same baseline measures you recorded before construction. Record what actually changed and what did not.',
        why:'Observed before/after evidence is more useful than repeating assumptions about how Colonization is supposed to work.',
        checklist:['Post-activation data captured.','Same baseline metrics compared.','Unexpected result recorded.'],
      },
      {
        id:'colonization-developer-bgs', stage:'Integrate', type:'challenge', title:'Separate colony development from BGS work',
        objective:'Identify which current objective is a construction/development problem and which is a faction/BGS problem. When faction influence, state, ownership, or conflict is the lever, use current Mission Control/Daily Orders rather than assuming another construction will fix it.',
        why:'Colonization and BGS interact, but they are not the same system. Good operators use the correct lever.',
        checklist:['Development lever identified.','BGS lever identified separately.','Live BGS instructions checked when relevant.'],
        link:{ label:'Open BGS Operator Manual', url:BGS },
      },
      {
        id:'colonization-developer-record', stage:'Document', type:'mentor', title:'Preserve the development lesson',
        objective:'Write a short before/after note for the squad: goal, baseline, intervention, observed result, uncertainty, and what you would do next. Avoid turning one observation into a universal rule.',
        why:'Colonization knowledge becomes much more valuable when the squad can compare repeated observations across different systems and builds.',
        checklist:['Goal/baseline included.','Intervention included.','Observed result included.','Uncertainty included.','Next test suggested.'],
      },
    ],
  },
  {
    id:'colonization-lead',
    band:'Veteran / Mentor',
    title:'Colonization Lead — Plan, Coordinate, Teach',
    subtitle:'Turn long colony projects into clear phases that multiple Commanders can support without losing strategic intent.',
    audience:'For experienced colonizers ready to lead claims, multi-site construction, logistics, development experiments, and newer Commanders across a long-running project.',
    outcome:'Graduate by leading a real or simulated colonization phase from objective and build sequence through logistics, progress control, adaptation, and debrief while making at least one other Commander more independent.',
    sourceNote:'Veteran Colonization work is primarily coordination and judgement: choosing what not to build, keeping logistics aligned with the objective, recovering from bad assumptions, and preserving reliable knowledge for the next project.',
    sources:[
      { label:'Mongrel Projects & Events', url:PROJECTS },
      { label:'Carrier Coordination', url:CARRIERS },
      { label:'BGS Operator Manual', url:BGS },
    ],
    tasks:[
      {
        id:'colonization-lead-objective', stage:'Objective', type:'mentor', title:'Define the colony phase and stop condition',
        objective:'Choose a real colony phase to lead and state the strategic objective, the builds included, what is explicitly out of scope, and the condition that ends the phase.',
        why:'Long colony projects sprawl unless leadership makes the current phase small enough to finish.',
        checklist:['Objective explicit.','Included builds explicit.','Out-of-scope work explicit.','Stop condition explicit.'],
      },
      {
        id:'colonization-lead-plan', stage:'Plan', type:'mentor', title:'Build the sequence and logistics plan',
        objective:'Translate the objective into ordered construction targets, sourcing assumptions, carrier/direct-haul decisions, staffing needs, and fallback options. Mark any uncertain game-mechanic assumption that could invalidate the plan.',
        why:'The squad needs an executable sequence, not merely a vision of the finished system.',
        checklist:['Build sequence defined.','Logistics model defined.','Staffing/roles defined.','Fallbacks defined.','Uncertain assumptions marked.'],
      },
      {
        id:'colonization-lead-brief', stage:'Brief', type:'wing', title:'Publish actionable work for the squad',
        objective:'Create or update the squad project so a member can see the current build, quantities or task needed, staging instructions, status, and whom to contact without needing a separate private briefing.',
        why:'Good project leadership lowers the coordination cost of helping.',
        checklist:['Current task visible.','Help request quantified where possible.','Staging/location clear.','Status/owner clear.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
      {
        id:'colonization-lead-run', stage:'Lead', type:'wing', title:'Run the construction phase and adapt once',
        objective:'Lead the active phase, keep requirements current, and make at least one evidence-based adjustment when supply, participation, access, timing, or the game state differs from the plan.',
        why:'Colonization plans meet live markets, live players, and sometimes changing mechanics. Leadership means adapting without losing the objective.',
        checklist:['Progress kept current.','One real change detected.','Plan adapted for evidence.','Objective remained intact.'],
      },
      {
        id:'colonization-lead-recover', stage:'Recover', type:'challenge', title:'Handle a colony project failure mode',
        objective:'Resolve or simulate one serious failure mode: wrong commodity assumptions, source collapse, carrier unavailable, build sequencing mistake, missing capability, overpurchase, stalled participation, or a development result that contradicts the plan.',
        why:'Large colony projects need recovery plans because the cost of discovering a bad assumption late can be enormous.',
        checklist:['Failure mode identified.','Immediate waste limited.','Alternative path chosen.','Project status corrected.'],
      },
      {
        id:'colonization-lead-mentor', stage:'Mentor', type:'mentor', title:'Make another colonizer more independent',
        objective:'Give another Commander ownership of one real planning, sourcing, progress-control, or development-analysis task. Review their reasoning without simply doing the work for them.',
        why:'A sustainable colonization program cannot depend on one architect remembering every detail.',
        checklist:['Real responsibility delegated.','Reasoning reviewed.','Commander can repeat the task with less help.'],
      },
      {
        id:'colonization-lead-debrief', stage:'Debrief', type:'mentor', title:'Close the phase and preserve the playbook',
        objective:'Publish a debrief covering planned vs actual effort, construction results, logistics bottlenecks, development observations, failed assumptions, and the next recommended phase. Separate reliable observations from hypotheses.',
        why:'The next colony should start from accumulated squad knowledge rather than rediscovering the same lessons.',
        checklist:['Planned vs actual compared.','Bottlenecks recorded.','Observed effects separated from hypotheses.','Next phase recommendation stated.'],
      },
    ],
  },
];

export function getColonizationRoute(routeId) {
  return COLONIZATION_ROUTES.find(route => route.id === routeId) || null;
}

export function eligibleColonizationRoutes(experience = 'new') {
  if (experience === 'experienced') return ['colonization-lead','colonization-colony-developer','colonization-system-architect'];
  if (experience === 'comfortable') return ['colonization-colony-developer','colonization-system-architect','colonization-construction-operator'];
  if (experience === 'some') return ['colonization-construction-operator','colonization-system-architect','colonization-foundations'];
  return ['colonization-foundations'];
}
