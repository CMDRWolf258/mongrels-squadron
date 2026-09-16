export const BGS_ACTIVITY_ID = 'bgs';

const BGS_MANUAL = '/guides/bgs/';
const BGS_REFERENCE = '/guides/reference/#bgs-background-simulation';
const MISSION_CONTROL = '/operations/';
const DAILY_ORDERS = '/operations/#daily-orders';

export const BGS_ROUTES = [
  {
    id:'bgs-foundations',
    band:'Beginner',
    title:'BGS Foundations — Read Before You Push',
    subtitle:'Learn to read the board, attribute actions correctly, and follow a real order without accidentally helping the wrong faction.',
    audience:'For a Commander who is new to deliberate BGS work or has mostly run missions without tracking who and what they were moving.',
    outcome:'Graduate by reading a live system correctly, completing correctly attributed BGS work, and comparing your actions with the next tick instead of treating BGS as blind grinding.',
    sourceNote:'This route follows the Mongrel BGS Field Manual and authenticated Mission Control workflow. Thresholds and edge cases marked community-observed in the manual should be treated with the same caution here.',
    sources:[
      { label:'Mongrel BGS Field Manual', url:BGS_MANUAL },
      { label:'BGS Reference Database', url:BGS_REFERENCE },
      { label:'Mission Control', url:MISSION_CONTROL },
    ],
    tasks:[
      {
        id:'bgs-foundation-inf-vs-percent', stage:'Learn', type:'learn', title:'Separate mission INF from influence %',
        objective:'Explain the difference between mission Influence reward pips (INF) and a faction’s system influence percentage. Give one example of each.',
        why:'This distinction prevents one of the most common BGS reporting errors. INF is workload/reward weight; it is not a direct percentage-point change.',
        checklist:['You can identify mission INF on a mission reward.','You can identify faction influence % in a system snapshot.','You do not describe +5 INF as +5 percentage points.'],
        link:{ label:'Open BGS Influence Guide', url:'/guides/bgs/#influence' },
      },
      {
        id:'bgs-foundation-read-board', stage:'Snapshot', type:'learn', title:'Read the whole faction board',
        objective:'Choose a current Mongrel system in Mission Control and identify every present faction, the controller, each faction’s influence, active/pending states, and the total faction count.',
        why:'BGS is a shared board. Looking only at the faction you want to help hides the factions that will absorb or lose influence and the states that can lock movement.',
        checklist:['All present factions identified.','Controller identified.','Influence values recorded.','Active/pending states checked.','Faction count recorded.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'bgs-foundation-read-mission', stage:'Attribution', type:'demonstrate', title:'Read a mission before accepting it',
        objective:'Before accepting a BGS mission, identify the issuing faction, any target faction, destination, and the Influence reward. Predict who the mission will help and whether it can hurt another faction.',
        why:'A mission can help one faction while applying negative pressure to another. Reading only the reward line is not enough.',
        checklist:['Issuer identified.','Target faction checked if present.','Destination checked.','INF reward checked.','Expected beneficiary and victim understood.'],
        link:{ label:'Open Mission Mechanics', url:'/guides/bgs/#influence' },
      },
      {
        id:'bgs-foundation-asset-owner', stage:'Attribution', type:'learn', title:'Know who owns the asset',
        objective:'Pick one station, outpost, or settlement used in current squad operations and identify its owning faction. Explain why that matters for trade, exploration data, missions, or other asset-linked BGS activity.',
        why:'System control and asset ownership are not the same thing. Activity delivered at the wrong asset can feed a faction you did not intend to support.',
        checklist:['Asset owner identified.','System controller identified separately.','You can name at least one activity whose BGS credit depends on the receiving asset.'],
        link:{ label:'Open Control & Assets', url:'/guides/bgs/#control-assets' },
      },
      {
        id:'bgs-foundation-match-lever', stage:'Levers', type:'demonstrate', title:'Match the action to the objective',
        objective:'For influence support, security support, economic support, and conflict scoring, name an appropriate activity for each. Include the difference between bounty vouchers and Combat Bonds.',
        why:'Doing a useful-looking activity is not enough. The lever has to move the dimension the operation actually needs.',
        checklist:['Influence lever identified.','Security lever identified.','Economic lever identified.','Conflict-scoring lever identified.','Bounty vouchers are not confused with Combat Bonds.'],
        link:{ label:'Open BGS Activity Guide', url:'/guides/bgs/#influence' },
      },
      {
        id:'bgs-foundation-follow-orders', stage:'Operate', type:'demonstrate', title:'Follow one Daily Order exactly',
        objective:'Choose one current Mission Control / Daily Orders task that fits your abilities and complete only the requested workload. Respect the named beneficiary, avoid list, quantity, and stop condition.',
        why:'Reliable BGS operators do not improvise around a strategic order unless they understand the consequences. Precision is more valuable than extra grind.',
        checklist:['Correct beneficiary supported.','Avoided factions were not accidentally supported.','Requested quantity/workload was respected.','You stopped at the stated condition.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'bgs-foundation-watch-tick', stage:'Feedback', type:'demonstrate', title:'Watch one tick as feedback',
        objective:'Record a before-and-after snapshot across one BGS tick for a system you worked in. Compare the observed change with what you expected from the day’s activity.',
        why:'BGS is a control problem, not a fixed conversion formula. Traffic, opposition, locks, population, and diminishing returns all affect the result.',
        checklist:['Before snapshot saved.','Your own workload noted.','After-tick influence/state changes recorded.','At least one reason considered if the result differed from expectation.'],
        link:{ label:'Open BGS Workflow', url:'/guides/bgs/#operations' },
      },
      {
        id:'bgs-foundation-graduate', stage:'Graduate', type:'challenge', title:'Complete a clean BGS work cycle',
        objective:'On a current Mongrel objective, read the board, choose a correct assigned lever, complete the requested work, stop on time, and report what you did using INF/workload units rather than claiming a percentage change.',
        why:'The beginner qualification is not memorizing thresholds. It is proving you can contribute without creating cleanup work for the people planning the system.',
        checklist:['Board read before acting.','Correct task/lever selected.','Workload completed without overshoot.','Report uses correct units.','No accidental support to an avoid faction.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
    ],
  },
  {
    id:'bgs-operator',
    band:'Developing',
    title:'BGS Operator — Execute With Precision',
    subtitle:'Turn a strategic objective into clean daily work: snapshots, quantified workload, conflicts, state levers, stop conditions, and post-tick calibration.',
    audience:'For a Commander who understands the vocabulary and wants to become someone officers can trust with a real BGS assignment.',
    outcome:'Graduate by executing multiple forms of BGS work correctly, recognizing conflict/state constraints, and adjusting from tick feedback without overshooting the objective.',
    sourceNote:'This route uses the Mongrel BGS Field Manual for mechanics and Mission Control for current squad-specific quantities. Current Daily Orders always outrank generic examples in this route.',
    sources:[
      { label:'Mongrel BGS Field Manual', url:BGS_MANUAL },
      { label:'Mission Control / Daily Orders', url:DAILY_ORDERS },
      { label:'BGS Reference Database', url:BGS_REFERENCE },
    ],
    tasks:[
      {
        id:'bgs-operator-clean-snapshot', stage:'Snapshot', type:'demonstrate', title:'Build an operator snapshot',
        objective:'Create a concise current snapshot for one operational system: factions, influence, controller, relevant asset ownership, active/pending states, conflict locks/scores, and faction count.',
        why:'A usable snapshot contains enough information to choose the correct lever without drowning the operator in unrelated system data.',
        checklist:['Faction/influence list complete.','Controller and relevant asset owners identified.','Active/pending states included.','Any conflict locks/scores included.','Faction count included.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'bgs-operator-beneficiary-avoid', stage:'Planning', type:'demonstrate', title:'Name the beneficiary and the avoid list',
        objective:'For a current squad objective, identify which faction(s) should receive positive work today and which faction(s) should receive no accidental support. Explain the reason in one or two sentences.',
        why:'The same activity can be strategically good or bad depending on attribution. Good operators know not only who to help, but who must not be helped.',
        checklist:['Beneficiary named.','Avoid faction(s) named.','Reason tied to the current objective rather than habit.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'bgs-operator-quantified-order', stage:'Operate', type:'demonstrate', title:'Complete a quantified workload',
        objective:'Complete one current Daily Order with a measurable target — mission INF, bounty value, trade profit, exploration data, conflict wins, or another listed workload — and stop when the order says to stop.',
        why:'Open-ended grinding makes calibration harder and increases the risk of overshooting influence bands or thresholds.',
        checklist:['Correct workload unit used.','Target quantity reached or intentionally stopped at the operation’s condition.','Result reported in the same unit the order used.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'bgs-operator-conflict-score', stage:'Conflict', type:'demonstrate', title:'Use the correct conflict lever',
        objective:'When a War, Civil War, or Election is available, identify the conflict type and use the correct scoring activity for that conflict day. If no live conflict is available, analyze a current/recent conflict and state what would score it.',
        why:'Influence is frozen during conflicts. Ordinary influence work does not replace winning the daily conflict result.',
        checklist:['Conflict type identified.','Correct scoring activity identified.','You can explain why bounty vouchers do not substitute for Combat Bonds in a War/Civil War.'],
        link:{ label:'Open Conflict Guide', url:'/guides/bgs/#conflicts' },
      },
      {
        id:'bgs-operator-stop-condition', stage:'Control', type:'challenge', title:'Respect a stop condition',
        objective:'Work an objective with a target band, threshold, or explicit daily cap and stop even if you could easily continue grinding.',
        why:'BGS skill includes restraint. Extra work can trigger Expansion, cause an unwanted crossover, crush a minority faction, or make tomorrow harder.',
        checklist:['Stop condition identified before starting.','You monitored progress/workload while operating.','You stopped without adding “just one more” batch after the condition was met.'],
        link:{ label:'Open BGS Workflow', url:'/guides/bgs/#operations' },
      },
      {
        id:'bgs-operator-two-levers', stage:'Levers', type:'demonstrate', title:'Support one objective with two appropriate levers',
        objective:'When the current state/objective allows it, contribute using two different appropriate activity types rather than repeating one bucket indefinitely. Examples include missions + bounties or trade + exploration data.',
        why:'Different levers can support different buckets and repeated activity can face diminishing returns. The mix must still match the objective.',
        checklist:['Both activities benefit the intended faction/objective.','Asset ownership/attribution checked for both.','You did not add a second lever merely for variety if it would move an unwanted state.'],
        link:{ label:'Open Influence & Levers', url:'/guides/bgs/#influence' },
      },
      {
        id:'bgs-operator-state-buckets', stage:'States', type:'learn', title:'Read economy and security separately from influence',
        objective:'Choose a faction with an active or desired economic/security state and identify which actions would push Economy and which would push Security. Explain why high influence does not automatically mean healthy Economy or Security.',
        why:'Influence, Economy, and Security are separate control problems that can overlap but should not be treated as one number.',
        checklist:['Economic lever(s) identified.','Security lever(s) identified.','Influence distinguished from both state dimensions.'],
        link:{ label:'Open State Guide', url:'/guides/bgs/#states' },
      },
      {
        id:'bgs-operator-asset-risk', stage:'Assets', type:'learn', title:'Identify what a conflict would actually move',
        objective:'For one possible or active faction crossover, identify the likely conflict type, the asset at risk, and whether system control is at stake.',
        why:'Winning a conflict is only useful if the asset/control outcome matches the strategic plan. Not every conflict transfers everything a faction owns.',
        checklist:['Opponent pairing identified.','Conflict type checked against ethos/history.','Asset at risk identified.','Control-at-stake question answered.'],
        link:{ label:'Open Control & Assets', url:'/guides/bgs/#control-assets' },
      },
      {
        id:'bgs-operator-calibrate', stage:'Feedback', type:'demonstrate', title:'Calibrate instead of doubling down',
        objective:'After a tick, compare the observed movement with the previous day’s workload. If the result missed expectations, list at least three things you would check before simply increasing activity.',
        why:'Unexpected ticks can come from traffic, opposition, ownership mistakes, state locks, diminishing returns, or bad assumptions. More grinding is not automatically the answer.',
        checklist:['Input workload known.','Observed result recorded.','At least three possible causes considered.','Next action is based on diagnosis, not frustration.'],
        link:{ label:'Open BGS Calibration Method', url:'/guides/bgs/#operations' },
      },
      {
        id:'bgs-operator-graduate', stage:'Graduate', type:'challenge', title:'Run two clean operational days',
        objective:'Complete two BGS work cycles on current Mongrel objectives: read the order, execute the quantified workload, respect the avoid/stop conditions, and compare both results after their ticks.',
        why:'Repeatability is the difference between knowing BGS facts and becoming a dependable operator.',
        checklist:['Two separate work cycles completed.','Both used correct attribution and units.','Both respected stop conditions.','Both received a post-tick review.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
    ],
  },
  {
    id:'bgs-strategist',
    band:'Experienced',
    title:'BGS Strategist — Shape the Board',
    subtitle:'Move beyond executing orders: manage influence bands, conflicts, Expansion/Retreat risk, assets, and multi-faction geometry.',
    audience:'For an operator who can already follow Daily Orders and now needs to understand how officers shape the board before assigning the grind.',
    outcome:'Graduate by designing and executing a controlled one-day plan, using advanced BGS constraints correctly, and recalibrating the next day from the tick result.',
    sourceNote:'This route emphasizes planning under uncertainty. Expansion targeting, Retreat edge cases, and some state behavior are community-observed; safety margins and post-tick validation matter more than memorizing a single threshold.',
    sources:[
      { label:'BGS Strategy Guide', url:'/guides/bgs/#strategies' },
      { label:'Expansion & Retreat', url:'/guides/bgs/#expansion' },
      { label:'Mission Control', url:MISSION_CONTROL },
    ],
    tasks:[
      {
        id:'bgs-strategist-maintenance-band', stage:'Control', type:'challenge', title:'Hold a faction inside a useful band',
        objective:'Identify a faction that should be maintained inside a range rather than maximized. Define the band, the reason for it, and the actions you would stop or redirect as the faction approaches the upper/lower boundary.',
        why:'Strong BGS play often means keeping control without triggering unwanted Expansion, crossovers, or minority collapse.',
        checklist:['Target band defined.','Upper/lower risks identified.','Support/avoid actions change logically near the boundaries.'],
        link:{ label:'Open General Strategies', url:'/guides/bgs/#strategies' },
      },
      {
        id:'bgs-strategist-conflict-lock', stage:'Strategy', type:'challenge', title:'Design a conflict-lock use case',
        objective:'Find a current or plausible system where locking two factions in a conflict could simplify another objective. Identify which influence becomes frozen and what another faction could do during that window.',
        why:'Conflict locks can change which factions participate in normal influence redistribution and create temporary strategic openings.',
        checklist:['Locked pair identified.','Separate objective identified.','You can explain what becomes easier while the pair is frozen.','You considered what happens when the conflict ends.'],
        link:{ label:'Open Conflict-Lock Strategy', url:'/guides/bgs/#strategies' },
      },
      {
        id:'bgs-strategist-expansion', stage:'Expansion', type:'demonstrate', title:'Manage Expansion before it manages you',
        objective:'For a faction near the observed Expansion threshold, decide whether Expansion is wanted. If wanted, inspect likely neighborhood constraints; if unwanted, define a safe operating ceiling with margin. Treat Pending Expansion as committed.',
        why:'Crossing a threshold and asking questions afterward is not strategy. Expansion is a neighborhood problem and detailed targeting is not perfectly documented.',
        checklist:['Wanted/unwanted decision made.','Safety margin defined if unwanted.','Nearby faction counts/open slots considered if wanted.','Pending Expansion treated as a management problem rather than something you can casually cancel.'],
        link:{ label:'Open Expansion Guide', url:'/guides/bgs/#expansion' },
      },
      {
        id:'bgs-strategist-retreat', stage:'Retreat', type:'demonstrate', title:'Build a safe Retreat or rescue plan',
        objective:'Analyze a current or hypothetical non-native faction near Retreat. Verify native status and faction count, define the safety margin, identify which factions should absorb share, and state what must be true before the decisive late-stage check.',
        why:'Retreat operations fail when people aim at the threshold instead of managing the entire timeline and accidental support.',
        checklist:['Native status checked.','Faction-count eligibility checked.','Below/above-threshold objective includes margin.','Accidental positive support considered.','Late-stage decisive check accounted for.'],
        link:{ label:'Open Retreat Guide', url:'/guides/bgs/#expansion' },
      },
      {
        id:'bgs-strategist-precision-transfer', stage:'Influence', type:'challenge', title:'Plan one winner + one victim',
        objective:'Choose a system where the desired result is a controlled transfer. Name one beneficiary and one victim, choose positive and negative levers, identify factions that should remain untouched, and define the stop condition.',
        why:'Precision transfers are easier to interpret than scattering activity everywhere and hoping the right faction moves most.',
        checklist:['Beneficiary identified.','Victim identified.','Positive and negative levers chosen deliberately.','Untouched factions named.','Stop condition defined.'],
        link:{ label:'Open Influence Strategies', url:'/guides/bgs/#strategies' },
      },
      {
        id:'bgs-strategist-control-assets', stage:'Assets', type:'demonstrate', title:'Pre-stage an asset transfer',
        objective:'Before forcing a faction crossover, identify government ethos/history, predicted conflict type, asset at risk, whether control is at stake, and the likely post-conflict influence order.',
        why:'A successful conflict can still be strategically wrong if it transfers the wrong asset or leaves the factions ordered badly for the next phase.',
        checklist:['Ethos/history checked.','Conflict type predicted with caveats.','Asset at risk identified.','Control-at-stake answered.','Post-conflict order considered.'],
        link:{ label:'Open Control & Assets', url:'/guides/bgs/#control-assets' },
      },
      {
        id:'bgs-strategist-write-orders', stage:'Plan', type:'wing', title:'Write a one-day BGS order',
        objective:'Using a live system snapshot, write a concise daily order for other Mongrels containing: exact objective, beneficiary, quantified workload, allowed levers, avoid list, and stop condition.',
        why:'A strategist has to turn analysis into instructions another pilot can execute without needing the strategist in the cockpit beside them.',
        checklist:['Objective is measurable.','Beneficiary named.','Workload quantified.','Allowed actions specified.','Avoid list included.','Stop condition included.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'bgs-strategist-run-plan', stage:'Operate', type:'wing', title:'Run and review your plan',
        objective:'Have at least one other Mongrel contribute to the order you wrote, or execute it yourself if nobody is available. After the tick, compare the result to the plan and write the next-day adjustment.',
        why:'Planning is only useful if it survives contact with live traffic and produces better decisions after the next tick.',
        checklist:['Work was executed against the written order.','Actual workload recorded.','Tick result compared with expectation.','Next-day adjustment written.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'bgs-strategist-graduate', stage:'Graduate', type:'challenge', title:'Explain the board, not just the grind',
        objective:'Take one current operational system and explain to another Mongrel or officer why today’s chosen actions are preferable to at least two plausible alternatives.',
        why:'Experienced operators should understand tradeoffs well enough to defend the plan, not merely repeat it.',
        checklist:['Current objective explained.','Chosen lever(s) justified.','At least two alternatives considered.','You can explain what would make you change the plan after the tick.'],
        link:{ label:'Open BGS Strategy Guide', url:'/guides/bgs/#strategies' },
      },
    ],
  },
  {
    id:'bgs-lead-mentor',
    band:'Veteran / Mentor',
    title:'BGS Lead — Plan, Calibrate, Teach',
    subtitle:'Veteran BGS work is no longer about proving you can grind. It is about creating good plans, coordinating other operators, diagnosing surprises, and growing the next planner.',
    audience:'For experienced BGS pilots who already understand the mechanics and want challenge through judgment, leadership, campaign planning, and knowledge transfer.',
    outcome:'Complete the route by leading live BGS work across multiple ticks and demonstrating that another Mongrel can make better BGS decisions because you taught them.',
    sourceNote:'This is a Mongrel leadership-development route, not an automatic squad rank. Completion demonstrates pathway work only; officer/site roles remain separate leadership decisions.',
    sources:[
      { label:'Mission Control', url:MISSION_CONTROL },
      { label:'BGS Strategy Guide', url:'/guides/bgs/#strategies' },
      { label:'BGS Operations Method', url:'/guides/bgs/#operations' },
    ],
    tasks:[
      {
        id:'bgs-lead-sitrep', stage:'Lead', type:'wing', title:'Produce a decision-ready situation report',
        objective:'For a live Mongrel system, produce a compact situation report that includes only the information needed to make today’s decision: faction order, states/locks, assets relevant to the objective, thresholds/risks, recent movement, and unresolved uncertainty.',
        why:'Veteran analysis is not more data; it is better filtering. The reader should know what matters and what is still uncertain.',
        checklist:['Situation is current.','Relevant facts separated from assumptions.','Risks/thresholds identified.','Uncertainty called out instead of hidden.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'bgs-lead-orders', stage:'Lead', type:'wing', title:'Publish executable daily orders',
        objective:'Turn the situation report into a daily plan another member can follow: priorities, quantities, beneficiaries, avoid list, stop conditions, and what to report back.',
        why:'Good orders reduce interpretation errors and let several Commanders contribute consistently without constant supervision.',
        checklist:['Priorities ordered.','Quantities measurable.','Beneficiaries/avoid factions explicit.','Stop conditions explicit.','Reporting format/units explicit.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'bgs-lead-coordinate-tick', stage:'Operations', type:'wing', title:'Coordinate one live tick of work',
        objective:'Coordinate contributions from at least two Commanders toward one BGS objective. Track what each person did well enough to interpret the next tick.',
        why:'Once several people work a system, workload attribution and overshoot control become leadership problems rather than solo piloting problems.',
        checklist:['At least two Commanders contributed.','Workloads captured in useful units.','Conflicting/duplicate work avoided.','Team stopped when the plan said to stop.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'bgs-lead-guardrails', stage:'Control', type:'challenge', title:'Protect the operation from its own success',
        objective:'During a live or planned operation, identify at least two ways excessive success could create a new problem — Expansion, unwanted conflict, minority collapse/Retreat, state movement, or asset crossover — and build guardrails into the plan.',
        why:'Veteran BGS leadership includes preventing the squad from creating tomorrow’s emergency while solving today’s objective.',
        checklist:['At least two overperformance risks identified.','Each risk has a practical stop/redirect condition.','Guardrails communicated before work begins.'],
        link:{ label:'Open BGS Strategy Guide', url:'/guides/bgs/#strategies' },
      },
      {
        id:'bgs-lead-campaign-plan', stage:'Campaign', type:'challenge', title:'Design a multi-tick campaign',
        objective:'Design a 2–3 tick campaign for a meaningful objective such as control/asset transfer, influence-band correction, Expansion management, Retreat/rescue, or conflict setup. Define expected phases and decision points rather than fixed assumptions.',
        why:'Longer BGS work succeeds by adapting between ticks. A campaign should contain branches for what you will do if the board moves differently than expected.',
        checklist:['Objective defined.','Initial board state recorded.','2–3 phases described.','Decision points/branches included.','Stop/failure conditions included.'],
        link:{ label:'Open BGS Operations Method', url:'/guides/bgs/#operations' },
      },
      {
        id:'bgs-lead-diagnose-miss', stage:'Diagnosis', type:'challenge', title:'Diagnose an unexpected tick',
        objective:'Take a tick that materially missed expectation and build a ranked diagnosis using available evidence: outside traffic, opposition, state/conflict locks, asset attribution, diminishing returns, bad workload assumptions, or another plausible cause. Choose the next test/action that best distinguishes the possibilities.',
        why:'Veteran operators do not explain every surprise with “the BGS is random.” They form testable explanations and adjust carefully.',
        checklist:['Expected vs actual movement stated.','Multiple causes considered.','Evidence for/against each considered.','Next action chosen to reduce uncertainty.'],
        link:{ label:'Open Calibration Method', url:'/guides/bgs/#operations' },
      },
      {
        id:'bgs-lead-mentor-first-order', stage:'Mentor', type:'mentor', title:'Guide a Mongrel through their first real BGS order',
        objective:'Take a less-experienced Mongrel through a current Daily Order. Make them identify the beneficiary, avoid list, workload unit, and stop condition before they begin; do not simply tell them which mission button to press.',
        why:'The goal is an independent operator. They should leave able to reason about the next order with less help.',
        checklist:['Learner reads the order themselves.','Learner identifies beneficiary/avoid list.','Learner reports work in correct units.','Learner can explain why the action helped the objective.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'bgs-lead-review-plan', stage:'Mentor', type:'mentor', title:'Review another operator’s plan without replacing it',
        objective:'Have another Mongrel propose a BGS plan. Ask questions, identify risks, and give prioritized corrections while leaving them responsible for the final plan.',
        why:'Strong mentors create planners rather than becoming a permanent approval bottleneck.',
        checklist:['Operator presents their own plan first.','You identify strengths as well as risks.','Corrections are prioritized, not a total rewrite.','Operator can explain the revised plan afterward.'],
      },
      {
        id:'bgs-lead-teach-strategy', stage:'Teach', type:'mentor', title:'Teach one advanced strategy until it sticks',
        objective:'Teach one advanced concept — conflict locking, precision transfer, Retreat timing, Expansion guardrails, asset transfer, influence-band management, or another comparable topic — until the learner can apply it to a different example without prompting.',
        why:'Knowledge transfer is proven when the learner can generalize the idea, not when they can repeat your example.',
        checklist:['Advanced concept chosen.','Real or realistic example explained.','Learner applies it to a second example.','Misunderstandings corrected.'],
        link:{ label:'Open BGS Strategy Guide', url:'/guides/bgs/#strategies' },
      },
      {
        id:'bgs-lead-capstone', stage:'Capstone', type:'wing', title:'Lead a short campaign and hand off the logic',
        objective:'Lead a real 2–3 tick BGS objective from initial situation report through daily tasking and recalibration. At the end, hand the system to another Mongrel who can explain the current state, what changed, and what they would do next.',
        why:'The capstone combines analysis, operations, restraint, adaptation, and succession. A veteran lead should leave both the system and the team in a better state.',
        checklist:['Campaign ran across at least two ticks.','Orders were quantified and adjusted from results.','No avoidable threshold/ownership mistakes were created.','Another Mongrel can explain the handoff and next decision.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
    ],
  },
];

export function eligibleBgsRoutes(experience = 'new') {
  if (experience === 'experienced') return ['bgs-lead-mentor','bgs-strategist'];
  if (experience === 'comfortable') return ['bgs-strategist','bgs-operator'];
  if (experience === 'some') return ['bgs-operator','bgs-foundations'];
  return ['bgs-foundations'];
}

export function getBgsRoute(id) {
  return BGS_ROUTES.find(route => route.id === id) || null;
}
