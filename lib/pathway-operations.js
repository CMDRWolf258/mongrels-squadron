export const OPERATIONS_ACTIVITY_ID = 'surface';

const OPERATIONS_GUIDE = '/guides/operations/';
const SHIPS = '/ships/';
const ENGINEERING = '/guides/engineering/';
const PROJECTS = '/projects/';

export const OPERATIONS_ROUTES = [
  {
    id:'operations-foundations',
    band:'Beginner',
    title:'Operations Foundations — Launch, Adapt, Extract',
    subtitle:'Learn the complete Operations loop with one manageable run instead of treating the feature as only on-foot combat.',
    audience:'For a Commander who is new to Operations, has only sampled one phase of them, or wants a safe first route through the Operation Runner workflow.',
    outcome:'Graduate by completing an Operation from selection through extraction, using both ship and on-foot phases when the scenario requires them, then explaining what preparation or role choice mattered most.',
    sourceNote:'Operations are mixed, instanced squad missions. Some scenarios lean heavily toward ship combat, some toward on-foot work or rescue, and several deliberately transition between them. The beginner goal is to understand the complete loop, not to master every scenario at once.',
    sources:[
      { label:'Operations Field Manual', url:OPERATIONS_GUIDE },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'operations-foundations-loop', stage:'Learn', type:'learn', title:'Understand the Runner loop before launch',
        objective:'Review how an Operation starts, how the Operation Runner moves the squad, what happens after death or ship destruction, and how extraction/reward completion works. Be able to describe the loop from station selection to final extraction.',
        why:'The Runner is the backbone of the feature. Knowing the loop prevents avoidable confusion when the scenario changes phases or a death sends you back to the Runner.',
        checklist:['Launch flow understood.','Runner role understood.','Respawn/redeployment flow understood.','Final extraction/reward step understood.'],
        link:{ label:'Open Operations Field Manual', url:OPERATIONS_GUIDE },
      },
      {
        id:'operations-foundations-scenario', stage:'Select', type:'learn', title:'Choose a manageable first Operation',
        objective:'Pick an Easy Operation whose activity mix matches equipment you already have. State whether the run is primarily ship combat, on-foot, rescue, or mixed before you begin.',
        why:'A first Operation should teach the system, not bury the lesson under an equipment mismatch.',
        checklist:['Scenario chosen deliberately.','Difficulty chosen deliberately.','Primary activity mix identified.','Major equipment requirement identified.'],
        link:{ label:'Compare Operations', url:`${OPERATIONS_GUIDE}#scenarios` },
      },
      {
        id:'operations-foundations-loadout', stage:'Prepare', type:'build', title:'Prepare both sides of the mission',
        objective:'Before launch, check the ship and suit/weapon loadout against the scenario. Even if one side is expected to do most of the work, make sure a phase transition will not leave you helpless.',
        why:'Ship choice locks when the Operation begins. Mixed scenarios punish a Commander who prepared only for the first five minutes.',
        checklist:['Ship role stated.','Suit/weapon role stated.','Power/fire groups or utility bindings checked.','Ammo/consumables checked.','Rebuy covered.'],
        link:{ label:'Review Operations Loadouts', url:`${OPERATIONS_GUIDE}#loadouts` },
      },
      {
        id:'operations-foundations-deploy', stage:'Deploy', type:'demonstrate', title:'Deploy from the Runner without rushing the start',
        objective:'Join the Runner, confirm the squad is ready, deploy with the correct ship and suit, and identify the first objective before charging ahead. Use the Runner as the reset point if the run goes wrong.',
        why:'Operations reward coordinated starts. A clean launch teaches more than recovering from a preventable split squad.',
        checklist:['Correct ship locked before launch.','Correct suit/loadout selected.','First objective identified.','Runner location/function kept in mind.'],
      },
      {
        id:'operations-foundations-transition', stage:'Adapt', type:'demonstrate', title:'Handle one real phase transition',
        objective:'When the scenario changes from ship to foot, foot to ship, rescue to combat, or one objective type to another, pause long enough to recognize the new problem and change your role or resource use accordingly.',
        why:'The defining Operations skill is adaptation. The mission can change what “useful” means several times in one run.',
        checklist:['Phase change recognized.','Role changed deliberately if needed.','Resources/ammo/position reassessed.','Squad objective remained clear.'],
      },
      {
        id:'operations-foundations-recovery', stage:'Recovery', type:'demonstrate', title:'Recover from one mistake or defeat correctly',
        objective:'If you die, lose the ship, run low on resources, or become separated, use normal Runner/redeployment mechanics and rejoin the objective calmly. If the run stays clean, deliberately explain what you would do after a defeat.',
        why:'Operations are designed around recoverable failure. Knowing the recovery loop prevents one mistake from becoming a failed run.',
        checklist:['Recovery/redeployment process used or explained.','No panic abandonment of the objective.','Re-entry point chosen deliberately.'],
      },
      {
        id:'operations-foundations-extract', stage:'Complete', type:'challenge', title:'Finish the extraction and verify the reward',
        objective:'Complete the scenario, follow the extraction flow all the way back through the Runner, and verify the reward screen or Merc Coin/credit result before considering the run finished.',
        why:'The Operation is not over when the last enemy falls. Learning the formal completion loop protects the reward and closes the session cleanly.',
        checklist:['Primary objective completed.','Extraction prompt followed.','Returned through the Runner as required.','Reward/result verified.'],
      },
      {
        id:'operations-foundations-graduate', stage:'Graduate', type:'challenge', title:'Repeat one Operation with less coaching',
        objective:'Complete another Operation while independently handling scenario choice, loadout, Runner deployment, phase changes, recovery decisions, extraction, and a short debrief.',
        why:'Graduation means the feature is no longer mysterious. You can now enter an Operation knowing what to prepare for and how to recover when the plan changes.',
        checklist:['Scenario/loadout selected independently.','Runner flow handled independently.','At least one phase or role decision explained.','Extraction/reward completed.','One improvement for the next run identified.'],
      },
    ],
  },
  {
    id:'operations-multi-role',
    band:'Developing',
    title:'Multi-Role Operator — Ship, Foot & Transition',
    subtitle:'Become useful across mixed Operations by recognizing when your ship, suit, mobility, or support role should take priority.',
    audience:'For a Commander who can complete basic Operations but becomes inefficient when the scenario changes phase or when the squad needs a different role mid-run.',
    outcome:'Graduate by completing mixed Operations while making deliberate role transitions, maintaining enough redundancy to survive a missing specialist, and improving one measured transition bottleneck.',
    sourceNote:'This route is not about building one ship or suit that is perfect at everything. It teaches how to enter a mixed mission with enough capability to stay useful when the objective changes.',
    sources:[
      { label:'Operations Field Manual', url:OPERATIONS_GUIDE },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'operations-multi-role-baseline', stage:'Baseline', type:'demonstrate', title:'Record where mixed Operations slow you down',
        objective:'Complete or review a mixed Operation and identify the biggest repeated transition problem: ship survivability, travel time, weak on-foot equipment, ammo/consumables, poor role handoff, or confusion about the next objective.',
        why:'Mixed-phase performance improves faster when you fix the transition that actually costs the team time.',
        checklist:['Mixed scenario reviewed.','Largest transition bottleneck named.','Ship-side limitation noted if present.','On-foot/support limitation noted if present.'],
      },
      {
        id:'operations-multi-role-role-map', stage:'Roles', type:'learn', title:'Map the scenario into jobs',
        objective:'Before launch, break one Operation into its likely jobs and state which parts your current ship and suit can cover well, which they can cover poorly, and where another squadmate should take the lead.',
        why:'Role clarity is more useful than four Commanders all bringing “general purpose” gear and discovering the same weakness together.',
        checklist:['Major phases listed.','Primary role chosen.','Secondary role chosen.','Known weak phase identified.'],
        link:{ label:'Review Scenario & Loadout Guide', url:`${OPERATIONS_GUIDE}#loadouts` },
      },
      {
        id:'operations-multi-role-ship', stage:'Ship Phase', type:'demonstrate', title:'Make the ship solve its assigned problem',
        objective:'During an Operation with a ship phase, deliberately fly the job your build is meant to do—anchor, interceptor/finisher, rescue, transport, or mixed utility—instead of chasing whatever target is closest.',
        why:'The ship is part of the team composition. Role discipline often matters more than individual kill count.',
        checklist:['Ship role stated before launch.','Role performed during the relevant phase.','At least one distraction from that role avoided.','Ship limitation noted afterward.'],
      },
      {
        id:'operations-multi-role-foot', stage:'On-Foot Phase', type:'demonstrate', title:'Make the suit solve its assigned problem',
        objective:'During an on-foot phase, use movement, cover, weapon pairing, objective awareness, and consumables to support the actual task rather than turning every phase into a stand-up firefight.',
        why:'On-foot Operations often combine combat with interaction, defense, rescue, or movement objectives. Surviving while doing the job is the skill.',
        checklist:['Objective remained primary.','Cover/movement used deliberately.','Weapon/consumable choice matched the target.','Ammo/resources monitored.'],
      },
      {
        id:'operations-multi-role-handoff', stage:'Transition', type:'wing', title:'Practice one clean role handoff',
        objective:'Coordinate with another Mongrel so one of you takes over a phase or problem the other is poorly suited for. Communicate the handoff rather than both Commanders assuming the other saw it.',
        why:'Good Operations teams do not require every pilot to do everything. They require clear handoffs and enough overlap to prevent a single point of failure.',
        checklist:['Handoff need recognized.','Role transfer communicated.','Receiving Commander confirmed.','Original role resumed or changed deliberately afterward.'],
      },
      {
        id:'operations-multi-role-redundancy', stage:'Redundancy', type:'wing', title:'Remove one single point of failure',
        objective:'Identify one critical squad role that only one person can currently perform and create a backup plan—another capable ship, another suitable suit, spare consumables, or a different tactic.',
        why:'Operations can fail because one disconnect or defeat removes the only person capable of a required phase.',
        checklist:['Critical single point of failure identified.','Backup Commander/equipment/tactic chosen.','Backup plan briefed before launch.'],
      },
      {
        id:'operations-multi-role-refine', stage:'Refine', type:'challenge', title:'Fix one transition bottleneck and re-run',
        objective:'Change one thing from your baseline—equipment, bindings, role assignment, consumables, travel choice, or squad handoff—then rerun a comparable mixed Operation and compare the result.',
        why:'One controlled change shows whether you solved the real transition problem.',
        checklist:['One major variable changed.','Comparable mixed run completed.','Original bottleneck compared.','Change kept, reverted, or refined.'],
      },
    ],
  },
  {
    id:'operations-scenario-specialist',
    band:'Developing / Experienced',
    title:'Scenario Specialist — Pick the Right Job',
    subtitle:'Learn the seven-scenario decision space so squad composition, equipment, difficulty, and reward goals drive the Operation choice.',
    audience:'For a Commander who can complete Operations reliably and wants to become better at selecting the right scenario for the team, practice objective, or reward goal.',
    outcome:'Graduate by comparing multiple Operations, building a useful scenario-selection rule, and successfully choosing a run that fits the squad rather than forcing the squad to fit the run.',
    sourceNote:'Scenario selection is a tactical decision. Difficulty alone does not define efficiency or challenge; the type of work, squad equipment, role coverage, and desired reward all matter.',
    sources:[
      { label:'Operations Scenario Guide', url:`${OPERATIONS_GUIDE}#scenarios` },
      { label:'Merc Coin Planner', url:`${OPERATIONS_GUIDE}#merc-coin` },
    ],
    tasks:[
      {
        id:'operations-scenario-breadth', stage:'Breadth', type:'challenge', title:'Experience different Operation types',
        objective:'Complete at least three different Operation scenarios, including at least one that is ship-heavy or mixed and at least one with substantial on-foot or rescue work.',
        why:'You cannot make good scenario recommendations from one favorite mission type.',
        checklist:['At least three different scenarios completed.','Ship-heavy/mixed example completed.','On-foot/rescue-heavy example completed.','Major difference between them recorded.'],
      },
      {
        id:'operations-scenario-fit', stage:'Analysis', type:'challenge', title:'Match squad capability to scenario demand',
        objective:'For each of the runs, note what the squad actually needed: ship durability, small-target application, passenger capacity, foot gear, objective defense, speed, or mixed-role flexibility.',
        why:'The best Operation for a squad is the one whose hard problems the team can actually solve.',
        checklist:['Key demand identified for each run.','Strongest squad capability identified.','Weakest squad capability identified.'],
      },
      {
        id:'operations-scenario-difficulty', stage:'Difficulty', type:'demonstrate', title:'Choose Easy or Hard for a reason',
        objective:'Compare difficulty based on success rate, equipment, time, and squad composition rather than treating Hard as the automatic target. Explain why the chosen difficulty is right for the next run.',
        why:'A failed Hard run can be worse training and worse reward efficiency than a clean Easy run.',
        checklist:['Success probability considered.','Equipment considered.','Time/reward goal considered.','Difficulty choice explained.'],
      },
      {
        id:'operations-scenario-reward', stage:'Rewards', type:'demonstrate', title:'Set a Merc Coin or practice goal before grinding',
        objective:'If the squad is running for Merc Coin or a MERC target, state the target before launch and track the real return. If the goal is practice rather than currency, define the skill being trained instead.',
        why:'Operations become an unfocused grind when the team never decides what the session is trying to produce.',
        checklist:['Reward or training goal stated.','Actual result tracked.','Next-run decision based on result.'],
        link:{ label:'Open Merc Coin Planner', url:`${OPERATIONS_GUIDE}#merc-coin` },
      },
      {
        id:'operations-scenario-rule', stage:'Decision Rule', type:'mentor', title:'Build a reusable scenario-selection rule',
        objective:'Create a concise rule or matrix another Mongrel could use: given squad size, equipment, preferred activity, difficulty tolerance, and reward/training goal, which Operation types are sensible candidates?',
        why:'Reusable judgement is more valuable than memorizing one “best” Operation.',
        checklist:['Squad size included.','Equipment/role coverage included.','Activity preference included.','Reward/training goal included.','Rule avoids claiming one universal best scenario.'],
      },
      {
        id:'operations-scenario-capstone', stage:'Capstone', type:'wing', title:'Choose the Operation for the squad and prove it',
        objective:'Given the actual Commanders available, choose the scenario, mode, difficulty, and basic role plan. Complete the run, then compare the result with your pre-launch reasoning.',
        why:'The specialist skill is choosing well before the Runner jumps, then learning when the prediction was wrong.',
        checklist:['Scenario chosen from squad evidence.','Mode/difficulty chosen deliberately.','Run completed or failure diagnosed.','Pre-launch reasoning compared with outcome.'],
      },
    ],
  },
  {
    id:'operations-hard-specialist',
    band:'Experienced',
    title:'Hard Operations Specialist — Sustain Under Pressure',
    subtitle:'Prepare and execute harder Operations without confusing maximum difficulty with good planning.',
    audience:'For a Commander who already understands the normal Operations loop and wants to become reliable when enemy pressure, equipment demands, time limits, or mixed-phase complexity increase.',
    outcome:'Graduate by completing a deliberately selected Hard Operation or by making a disciplined abort/replan after identifying a repeatable failure mode, then demonstrating a measurable improvement on the next attempt.',
    sourceNote:'Hard Operations should expose a specific weakness worth solving. This route emphasizes survivability, sustained resources, role discipline, and evidence-based build changes rather than brute-force retries.',
    sources:[
      { label:'Operations Field Manual', url:OPERATIONS_GUIDE },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'operations-hard-benchmark', stage:'Benchmark', type:'challenge', title:'Choose one repeatable Hard benchmark',
        objective:'Pick a Hard Operation that matches the team’s current capability well enough to expose a real limitation without being a random wall. Record the likely failure modes before launch.',
        why:'A repeatable benchmark turns failure into useful data instead of a string of unrelated rebuys.',
        checklist:['Hard scenario chosen deliberately.','Team capability considered.','Likely ship failure mode listed.','Likely foot/support failure mode listed.'],
      },
      {
        id:'operations-hard-build', stage:'Prepare', type:'build', title:'Engineer for the measured problem, not for a label',
        objective:'Review ship and suit preparation against the benchmark. Change only the systems that address the expected bottleneck—survivability, sustained damage, mobility, ammo, passenger throughput, heat/power, or foot combat durability.',
        why:'“Hard build” is not a single configuration. The correct change depends on what the scenario asks the role to survive or accomplish.',
        checklist:['Measured bottleneck named.','Relevant build system identified.','Unrelated rebuild avoided.','Rebuy and consumables prepared.'],
        link:{ label:'Open Engineering Guide', url:ENGINEERING },
      },
      {
        id:'operations-hard-resources', stage:'Sustain', type:'demonstrate', title:'Manage resources across the whole run',
        objective:'Track ammunition, heat, distributor, shields/hull, suit consumables, medkits, energy cells, and time as relevant to your role. Reset or resupply before depletion forces a bad decision.',
        why:'Hard pressure punishes resource collapse more than one imperfect attack.',
        checklist:['Relevant ship resources monitored.','Relevant foot resources monitored.','At least one proactive reset/resupply decision made.'],
      },
      {
        id:'operations-hard-role', stage:'Discipline', type:'wing', title:'Stay useful when the squad is under pressure',
        objective:'During a difficult phase, keep performing the assigned job and communicate when you can no longer do it. Avoid silently abandoning a critical role to chase damage or recover alone.',
        why:'Hard Operations often fail when a stressed squad stops behaving like a team.',
        checklist:['Primary role maintained.','Critical problem communicated.','Role handoff requested if needed.','Personal score did not override squad objective.'],
      },
      {
        id:'operations-hard-failure', stage:'Diagnosis', type:'challenge', title:'Name the actual failure mode',
        objective:'After a success, close call, or failed attempt, identify the first repeatable condition that put the run in danger. Separate equipment, execution, coordination, and scenario-choice problems.',
        why:'The first controllable failure usually matters more than the dramatic final moment.',
        checklist:['First repeatable failure identified.','Equipment issue separated from execution issue.','Coordination issue considered.','Scenario/difficulty choice reconsidered if needed.'],
      },
      {
        id:'operations-hard-retest', stage:'Retest', type:'challenge', title:'Change one major variable and re-run',
        objective:'Make one major correction and repeat a comparable Hard attempt. If the original plan was clearly inappropriate, deliberately step down or change scenario rather than forcing the benchmark.',
        why:'Hard-mode competence includes knowing when to refine, when to regroup, and when the scenario choice itself was the mistake.',
        checklist:['One major correction selected.','Comparable retest completed.','Original failure mode compared.','Next difficulty/scenario decision justified.'],
      },
    ],
  },
  {
    id:'operations-lead',
    band:'Veteran / Mentor',
    title:'Operations Lead — Brief, Adapt, Teach',
    subtitle:'Turn personal Operations experience into better scenario choices, cleaner squad roles, faster recovery, and more independent operators.',
    audience:'For a veteran Commander who can already complete mixed and difficult Operations and is ready to organize runs, teach newer members, and preserve useful squad knowledge.',
    outcome:'Graduate by planning and leading an Operations session, adapting the plan once, mentoring another Commander through one real role or transition, and publishing a concise debrief that improves the next run.',
    sourceNote:'Operations leadership is not just selecting Hard. A good lead chooses the right scenario for the actual squad, gives every Commander a useful role, protects redundancy, and changes the plan when evidence says the original assumption was wrong.',
    sources:[
      { label:'Operations Field Manual', url:OPERATIONS_GUIDE },
      { label:'Projects & Events', url:PROJECTS },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'operations-lead-objective', stage:'Planning', type:'mentor', title:'Plan a session with one clear purpose',
        objective:'Choose whether the session is for first-run training, scenario breadth, Merc Coin, Hard progression, role practice, or another explicit goal. Select scenarios and difficulty around that purpose and the actual members attending.',
        why:'A clear purpose prevents the session from becoming an unstructured sequence of whatever the menu offers next.',
        checklist:['Session purpose defined.','Expected participants considered.','Scenario candidates chosen.','Difficulty logic stated.'],
      },
      {
        id:'operations-lead-roles', stage:'Brief', type:'wing', title:'Assign roles and redundancy before the Runner jumps',
        objective:'Brief primary roles, secondary coverage, ship/suit expectations, critical single points of failure, and how the team will handle a disconnect or defeat.',
        why:'Operations can form across multiple phases. A two-minute role brief often saves far more time than it costs.',
        checklist:['Primary roles assigned.','Secondary coverage assigned.','Critical single point of failure addressed.','Recovery/disconnect expectation briefed.'],
      },
      {
        id:'operations-lead-run', stage:'Lead', type:'wing', title:'Lead the run and adapt once',
        objective:'Run the Operation and make at least one real adjustment based on pressure, role performance, equipment, objective timing, or an unexpected phase. Communicate the change and why it is happening.',
        why:'Leadership means preserving the objective while changing the plan when reality disagrees with the briefing.',
        checklist:['Operation led.','At least one meaningful adaptation made.','Reason communicated.','Squad objective remained clear.'],
      },
      {
        id:'operations-lead-recovery', stage:'Recovery', type:'wing', title:'Recover the squad, not just yourself',
        objective:'When a Commander is defeated, separated, under-equipped, disconnected, or overloaded, reorganize roles or tempo so the team can continue or deliberately abort. Do not let one failure cascade silently.',
        why:'A strong lead turns recoverable problems into a new plan instead of a chain reaction.',
        checklist:['Problem recognized quickly.','Role/tempo adjusted.','Continue/abort decision stated.','Team regrouped or exited deliberately.'],
      },
      {
        id:'operations-lead-mentor', stage:'Teach / Mentor', type:'mentor', title:'Make another operator more independent',
        objective:'Coach another Mongrel through one specific Operations skill—Runner flow, scenario selection, ship role, foot role, phase transition, recovery, or resource management—then let them make the decision themselves under pressure.',
        why:'The best Operations lead produces more Commanders who can diagnose the mission without waiting for instructions.',
        checklist:['One specific skill selected.','Commander made the decision themselves.','Feedback focused on reasoning.','They can explain how to repeat it.'],
      },
      {
        id:'operations-lead-debrief', stage:'Debrief', type:'mentor', title:'Preserve the lesson for the next squad',
        objective:'Create a concise debrief covering the scenario, squad composition, what worked, the first repeatable failure or delay, the adaptation used, and one recommendation for the next run. Keep balance-sensitive observations framed as current evidence, not permanent law.',
        why:'Operations can change with balance updates. Good notes preserve judgement and context instead of fossilizing one patch into doctrine.',
        checklist:['Scenario/composition recorded.','Repeated success/failure pattern recorded.','Adaptation result recorded.','One next recommendation stated.','Balance-sensitive uncertainty preserved.'],
      },
    ],
  },
];

export function eligibleOperationsRoutes(experience = 'new') {
  if (experience === 'experienced') return ['operations-lead','operations-hard-specialist','operations-scenario-specialist'];
  if (experience === 'comfortable') return ['operations-hard-specialist','operations-scenario-specialist','operations-multi-role'];
  if (experience === 'some') return ['operations-multi-role','operations-scenario-specialist','operations-foundations'];
  return ['operations-foundations'];
}

export function getOperationsRoute(id) {
  return OPERATIONS_ROUTES.find(route => route.id === id) || null;
}
