export const SQUADRON_COORDINATION_ACTIVITY_ID = 'operations';

const MISSION_CONTROL = '/operations/';
const DAILY_ORDERS = '/operations/#daily-orders';
const PROJECTS = '/projects/';
const CARRIERS = '/carriers/';
const ACTIVITIES = '/activities/';

export const SQUADRON_COORDINATION_ROUTES = [
  {
    id:'coordination-foundations',
    band:'Beginner',
    title:'Squadron Coordination Foundations — Read, Choose, Report',
    subtitle:'Learn how to turn current squad priorities into one useful contribution without relearning the activity used to complete it.',
    audience:'For a Mongrel who is new to coordinated squad work, unsure where authoritative tasking lives, or has useful game skills but has not yet connected them to Mission Control and Daily Orders.',
    outcome:'Graduate by independently reading current tasking, choosing an appropriate contribution lane, completing useful work, reporting what actually happened, and rechecking whether the objective still needs more.',
    sourceNote:'Squadron Coordination does not reteach mining, hauling, combat, BGS, Colonization, carrier work, or other activity fundamentals. Those skills belong to their own Pathways. This route teaches how to use existing skills in the Regiment’s current plan. If Coordination is one of your only selected Pathways, it may expose you to unfamiliar lanes as guided support without claiming that you have mastered them.',
    sources:[
      { label:'Mission Control', url:MISSION_CONTROL },
      { label:'Daily Orders', url:DAILY_ORDERS },
      { label:'Projects & Events', url:PROJECTS },
    ],
    tasks:[
      {
        id:'coordination-foundations-authority', stage:'Find', type:'learn', title:'Know where current squad tasking lives',
        objective:'Open Mission Control, Daily Orders, and Projects & Events. Be able to identify which page owns a current BGS order, a construction/project requirement, or another squad objective, and treat that current source as authoritative over generic examples.',
        why:'Coordination starts by getting everyone to work from the same current picture instead of old screenshots, memory, or Discord fragments.',
        checklist:['Mission Control located.','Daily Orders located.','Projects & Events located.','You can identify the authoritative source for a current objective.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'coordination-foundations-read', stage:'Read', type:'learn', title:'Read the whole order before acting',
        objective:'Choose one current squad objective and identify its purpose, beneficiary or destination, requested workload, any avoid instructions, and its stop condition before doing any work.',
        why:'A useful activity can become counterproductive when it supports the wrong faction, delivers after the requirement is closed, or ignores a stop condition.',
        checklist:['Objective understood.','Beneficiary/destination identified.','Requested workload identified.','Avoid instructions checked.','Stop condition identified.'],
        link:{ label:'Open Daily Orders', url:DAILY_ORDERS },
      },
      {
        id:'coordination-foundations-lane', stage:'Choose', type:'demonstrate', title:'Choose the contribution lane that fits you',
        objective:'Pick one way you can help the objective using a capability you already have. If Squadron Coordination is one of your only selected Pathways, choose one manageable lane to sample with the current objective as your guide rather than trying to master the entire activity first.',
        why:'The squad needs useful contributions, not duplicate training. Existing skills should be used immediately; unfamiliar lanes can be sampled when this Pathway is serving as your guided tour of squad work.',
        checklist:['Contribution lane chosen for a reason.','Existing capability used when available.','Unfamiliar work kept to a manageable support role when applicable.'],
        link:{ label:'Browse Activities', url:ACTIVITIES },
      },
      {
        id:'coordination-foundations-contribute', stage:'Contribute', type:'demonstrate', title:'Complete one meaningful contribution',
        objective:'Complete one current squad contribution using the instructions owned by that objective. The work may be hauling, combat, mining, BGS, Colonization support, carrier logistics, exploration, or another lane; this task grades whether you supported the plan, not whether you relearned that activity.',
        why:'Coordination becomes real when the plan turns into useful work. The activity Pathway owns the specialist skill; this Pathway owns alignment with the squad objective.',
        checklist:['Current objective was still active before starting.','Contribution matched the requested lane or outcome.','No known avoid/stop instruction was violated.'],
      },
      {
        id:'coordination-foundations-report', stage:'Report', type:'demonstrate', title:'Report what actually happened',
        objective:'Report the contribution using the same unit or evidence the objective uses—such as mission INF, credits, tonnes, completed deliveries, conflict results, or a clear status update. Do not claim downstream effects you have not observed.',
        why:'Good reports let the next Commander or planner make a decision. Inflated or vague reports create more work than they save.',
        checklist:['Correct workload/result unit used.','What you actually did is clear.','Unobserved effects are not presented as facts.','Any uncertainty is stated.'],
      },
      {
        id:'coordination-foundations-recheck', stage:'Recheck', type:'challenge', title:'Recheck before doing more',
        objective:'Return to the authoritative source after your contribution. Confirm whether the task still needs work, has reached its stop condition, has changed, or should be handed to a different contribution lane.',
        why:'Squad priorities can move while you are flying. Rechecking prevents yesterday’s useful work from becoming today’s overshoot.',
        checklist:['Objective rechecked.','Stop/continue decision made from current status.','Changed objective or handoff recognized if applicable.'],
        link:{ label:'Recheck Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'coordination-foundations-graduate', stage:'Graduate', type:'challenge', title:'Close one squad contribution loop independently',
        objective:'Without step-by-step coaching, read a current squad objective, choose a suitable contribution lane, complete useful work, report it accurately, and recheck the objective before deciding whether to continue.',
        why:'Graduation means you can plug into current Regiment work without needing someone to translate every order into a personal checklist.',
        checklist:['Authoritative objective found independently.','Appropriate lane chosen.','Useful work completed.','Result reported accurately.','Objective rechecked before more work.'],
      },
    ],
  },
  {
    id:'coordination-contributor',
    band:'Developing',
    title:'Squad Contributor — Work the Plan, Respect the Stop',
    subtitle:'Become the member planners can trust to take a current objective, work it precisely, and hand back a clean result.',
    audience:'For a Commander who can follow basic squad tasking and wants to become reliable across different objectives without needing constant supervision.',
    outcome:'Graduate by completing multiple clean squad contributions, respecting quantities and stop conditions, and using a second contribution lane only when it genuinely helps the plan.',
    sourceNote:'This route still does not replace activity-specific Pathways. It develops operational judgement: attribution, workload, restraint, handoff, and choosing the right capability for the current need.',
    sources:[{ label:'Daily Orders', url:DAILY_ORDERS },{ label:'Projects & Events', url:PROJECTS }],
    tasks:[
      {
        id:'coordination-contributor-priority', stage:'Priority', type:'demonstrate', title:'Separate the goal from the non-goal',
        objective:'For one live squad objective, state what success looks like and name at least one tempting activity that would not help—or could actively hurt—the current plan.',
        why:'Dependable contributors understand both what to do and what not to do.',
        checklist:['Success condition stated.','At least one non-goal/avoid action identified.','Reason tied to the current plan.'],
      },
      {
        id:'coordination-contributor-fit', stage:'Match', type:'demonstrate', title:'Match a capability to the job',
        objective:'Use your saved Pathway experience and your real ships/skills to choose the contribution lane that solves the current need with the least extra setup. Do not retrain a familiar activity just because it appears in this Pathway.',
        why:'Coordination rewards fit. The best contribution is often the useful capability you can deploy now.',
        checklist:['Capability chosen from real experience.','Choice tied to objective need.','Unnecessary retraining/setup avoided.'],
      },
      {
        id:'coordination-contributor-workload', stage:'Execute', type:'demonstrate', title:'Complete a bounded workload',
        objective:'Complete a current contribution with a measurable amount or clear deliverable, then stop at the requested quantity, threshold, handoff point, or completion condition.',
        why:'Open-ended grinding makes the plan harder to calibrate and can turn useful effort into overshoot.',
        checklist:['Workload/deliverable defined before starting.','Requested contribution completed.','Stop condition respected.'],
      },
      {
        id:'coordination-contributor-handoff', stage:'Handoff', type:'wing', title:'Leave the next Commander a clean handoff',
        objective:'Communicate the updated state so another Mongrel can continue without reconstructing the session: what changed, what remains, what is already inbound or claimed, and what should stop.',
        why:'Coordination is a team skill. Clean handoffs preserve work between players and time zones.',
        checklist:['Completed work stated.','Remaining need stated.','Inbound/claimed work noted if relevant.','Stop/avoid note included when needed.'],
      },
      {
        id:'coordination-contributor-second-lane', stage:'Breadth', type:'challenge', title:'Use a second lane only when it adds value',
        objective:'On a later objective, contribute through a different activity lane if it is genuinely useful. If the plan does not need another lane, explain why staying with the current capability is the better coordination decision.',
        why:'Breadth is useful, but variety for its own sake is not. This task teaches exposure without forcing duplicate mastery work.',
        checklist:['Second lane used only if useful, or restraint explained.','Authoritative instructions followed.','No claim of specialist mastery from one support task.'],
      },
      {
        id:'coordination-contributor-graduate', stage:'Graduate', type:'challenge', title:'Complete two clean squad contributions',
        objective:'Complete two current squad contributions from order to report/handoff with no avoid-list errors, no stop-condition overshoot, and no need for another member to reconstruct what you did.',
        why:'Repeatability is what turns a helpful member into a dependable squad contributor.',
        checklist:['Two contribution loops completed.','Both followed current authority.','Both respected stop conditions.','Both ended with usable reports/handoffs.'],
      },
    ],
  },
  {
    id:'coordination-cross-activity',
    band:'Developing / Experienced',
    title:'Cross-Activity Coordinator — Match People to Work',
    subtitle:'Coordinate several activity lanes around one objective without pretending every Commander needs to master every job.',
    audience:'For a contributor who understands individual orders and is ready to coordinate handoffs between combat, logistics, BGS, Colonization, mining, carriers, exploration, or other specialties.',
    outcome:'Graduate by mapping one real objective into jobs, matching people to those jobs, keeping the shared status current, and adapting when the true bottleneck changes.',
    sourceNote:'Cross-activity coordination uses specialist Pathways as capability evidence; it does not replace them. The coordinator’s job is to understand enough about each lane to sequence and hand off work, not to perform every specialist task personally.',
    sources:[{ label:'Mission Control', url:MISSION_CONTROL },{ label:'Projects & Events', url:PROJECTS },{ label:'Carrier Coordination', url:CARRIERS }],
    tasks:[
      {
        id:'coordination-cross-map', stage:'Map', type:'challenge', title:'Break one objective into contribution lanes',
        objective:'Take a real squad objective and identify the distinct jobs it may require—such as sourcing, hauling, carrier staging, combat, BGS attribution, scouting, construction, reporting, or another dependency. Keep unnecessary lanes out of the plan.',
        why:'A shared objective becomes manageable when the team can see which work is actually different and which work is just duplicate effort.',
        checklist:['Objective broken into real jobs.','Dependencies identified.','Unnecessary work excluded.'],
      },
      {
        id:'coordination-cross-capabilities', stage:'People', type:'wing', title:'Match people to demonstrated capability',
        objective:'Use what members have actually demonstrated, selected, or volunteered to do when assigning jobs. Do not assume rank, ship size, or one successful support task proves mastery in an unrelated activity.',
        why:'Good assignments reduce setup time and failure risk while still leaving room for guided exposure when someone wants to learn.',
        checklist:['Capabilities checked rather than assumed.','Primary owners matched to suitable work.','Learning/support roles separated from specialist ownership when needed.'],
      },
      {
        id:'coordination-cross-handoffs', stage:'Sequence', type:'challenge', title:'Define the handoffs before launch',
        objective:'Identify what information or completion state must pass between jobs—for example source confirmed → carrier loaded → carrier moved → destination unloaded, or combat/security cleared → objective team enters.',
        why:'Most cross-activity failures happen between jobs, not inside them.',
        checklist:['Critical handoffs identified.','Owner on each side of the handoff known.','Completion signal defined.'],
      },
      {
        id:'coordination-cross-staging', stage:'Logistics', type:'challenge', title:'Use staging only if it removes a bottleneck',
        objective:'Decide whether a Fleet Carrier, rendezvous point, stockpile, escort, or other staging step helps the objective. If direct work is simpler, explicitly leave the extra logistics out.',
        why:'Coordination should remove friction, not create ceremonial complexity.',
        checklist:['Direct vs staged approach considered.','Extra logistics justified or rejected.','Roles clear if staging is used.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'coordination-cross-live-picture', stage:'Track', type:'wing', title:'Keep one shared progress picture',
        objective:'During the operation, maintain a concise current status that accounts for completed work, in-progress work, remaining need, and any new stop condition so members are not operating from different versions of the plan.',
        why:'A team cannot coordinate from five private snapshots.',
        checklist:['Completed work tracked.','In-progress commitments visible.','Remaining need current.','Stop/change conditions communicated.'],
      },
      {
        id:'coordination-cross-bottleneck', stage:'Adapt', type:'challenge', title:'Move effort when the bottleneck moves',
        objective:'Identify the first point where the original plan stops being efficient—supply, combat, travel, carrier timing, player availability, requirement closure, or another constraint—and reassign or stop work accordingly.',
        why:'The strongest coordinator is not the one who follows the original plan longest; it is the one who notices when the plan is no longer the best use of people.',
        checklist:['Current bottleneck identified.','At least one assignment changed or intentionally retained from evidence.','Obsolete work stopped.'],
      },
      {
        id:'coordination-cross-graduate', stage:'Graduate', type:'challenge', title:'Coordinate one multi-lane objective to closure',
        objective:'Coordinate a real objective involving at least two distinct contribution lanes from initial job map through handoffs, live tracking, adaptation, and final closeout/debrief.',
        why:'Graduation proves you can make several specialties behave like one operation without absorbing those specialties into this Pathway.',
        checklist:['At least two lanes coordinated.','Handoffs worked or were corrected.','Status stayed usable.','Objective closed or cleanly handed off.'],
      },
    ],
  },
  {
    id:'coordination-mission-planner',
    band:'Experienced',
    title:'Mission Planner — Turn Strategy Into Jobs',
    subtitle:'Translate a larger squad goal into clear assignments, ownership, stop conditions, feedback, and a plan that can survive contact with reality.',
    audience:'For an experienced coordinator who can run multi-lane work and is ready to design the tasking other Mongrels will execute.',
    outcome:'Graduate by planning and running one real squad objective whose jobs are clear enough to execute, measurable enough to control, and flexible enough to adapt once conditions change.',
    sourceNote:'Mission planning owns the coordination structure, not every underlying mechanic. BGS strategy, combat doctrine, Colonization mechanics, trade sourcing, and other specialist decisions should still use their authoritative domain knowledge.',
    sources:[{ label:'Mission Control', url:MISSION_CONTROL },{ label:'Projects & Events', url:PROJECTS }],
    tasks:[
      {
        id:'coordination-planner-intent', stage:'Intent', type:'challenge', title:'Define one measurable squad objective',
        objective:'State the desired end state, why it matters, the authoritative owner/source, and what evidence will tell the team the objective is complete or should stop.',
        why:'A task list is not a plan until everyone knows what outcome the tasks are trying to create.',
        checklist:['End state measurable.','Authority/source identified.','Completion/stop evidence defined.','Non-goals named if relevant.'],
      },
      {
        id:'coordination-planner-jobs', stage:'Jobs', type:'challenge', title:'Turn the objective into owned jobs',
        objective:'Break the objective into the smallest useful jobs, assign an owner or owner type to each, and define which can run in parallel and which depend on another job finishing first.',
        why:'Clear ownership prevents important work from belonging to “everyone” and therefore no one.',
        checklist:['Jobs concrete.','Ownership clear.','Parallel/dependent work distinguished.','Duplicate work controlled.'],
      },
      {
        id:'coordination-planner-guardrails', stage:'Control', type:'challenge', title:'Write the stop and avoid conditions',
        objective:'For each job where overshoot or misattribution matters, state quantity caps, thresholds, avoid targets, expiry conditions, or “do not continue until rechecked” rules.',
        why:'The plan should tell members when success means stopping, not only how to start.',
        checklist:['Relevant stop conditions explicit.','Avoid instructions explicit.','Recheck points placed where conditions can change.'],
      },
      {
        id:'coordination-planner-brief', stage:'Brief', type:'mentor', title:'Publish a brief another Mongrel can execute',
        objective:'Turn the plan into a concise briefing that includes objective, priorities, jobs, owners, measurements, handoffs, stop conditions, and where updates belong without dumping the entire planning history on the reader.',
        why:'A good plan is only useful if a member joining late can understand what to do next.',
        checklist:['Objective concise.','Jobs/action items clear.','Measurements and stops visible.','Update location stated.'],
        link:{ label:'Open Mission Control', url:MISSION_CONTROL },
      },
      {
        id:'coordination-planner-run', stage:'Run', type:'wing', title:'Run and monitor the plan',
        objective:'Execute the operation long enough to receive real progress reports. Track whether jobs are producing the expected result and whether any commitment or requirement has changed.',
        why:'Planning skill includes observing the system you created, not disappearing after the briefing.',
        checklist:['Progress reports received.','Commitments/remaining work reconciled.','Expected vs actual progress compared.'],
      },
      {
        id:'coordination-planner-adapt', stage:'Adapt', type:'challenge', title:'Change the plan once for evidence',
        objective:'Make at least one justified adjustment—reassign people, change a workload, remove a lane, alter staging, pause an objective, or change the handoff—based on current evidence rather than preference.',
        why:'A plan that cannot change is a script. Coordination requires control under changing conditions.',
        checklist:['Change triggered by evidence.','Reason communicated.','Obsolete instruction superseded clearly.'],
      },
      {
        id:'coordination-planner-close', stage:'Close', type:'challenge', title:'Close the objective and preserve the lesson',
        objective:'Declare the objective complete, paused, failed, or handed off; stop stale work; record the final useful state; and preserve one planning lesson that should change the next operation.',
        why:'Clean closure prevents successful operations from producing hours of unnecessary follow-on work.',
        checklist:['Final state explicit.','Stale work stopped.','Remaining follow-up owned if any.','One reusable lesson preserved.'],
      },
    ],
  },
  {
    id:'coordination-lead',
    band:'Veteran / Mentor',
    title:'Squadron Coordination Lead — Brief, Adapt, Teach',
    subtitle:'Lead coordinated squad work while building other members who can plan, communicate, and recover without depending on you forever.',
    audience:'For veterans, officers, project leads, or experienced members ready to coordinate people across specialties and mentor the next layer of coordinators.',
    outcome:'Graduate by leading one real objective through intent, delegation, execution, recovery, closure, and mentorship while preserving a single authoritative operational picture.',
    sourceNote:'Leadership in this Pathway is functional rather than rank-gated. The skill is creating clarity, matching people to work, keeping authority coherent, adapting under pressure, and making another coordinator more independent.',
    sources:[{ label:'Mission Control', url:MISSION_CONTROL },{ label:'Projects & Events', url:PROJECTS },{ label:'Carrier Coordination', url:CARRIERS }],
    tasks:[
      {
        id:'coordination-lead-intent', stage:'Command Intent', type:'mentor', title:'State what matters when the plan changes',
        objective:'For a real objective, brief the desired end state, priority order, major constraints, and what members should protect if the detailed task list becomes outdated mid-session.',
        why:'Clear intent lets people make good local decisions without inventing a new strategy.',
        checklist:['End state clear.','Priorities ordered.','Major constraints/avoid rules clear.','Decision freedom bounded.'],
      },
      {
        id:'coordination-lead-delegate', stage:'Delegate', type:'mentor', title:'Delegate by capability, not by habit',
        objective:'Assign primary and backup ownership using members’ demonstrated capabilities, current equipment, availability, and learning goals. Give a developing member a supported role when appropriate without making them the hidden single point of failure.',
        why:'Good delegation gets the work done while expanding the squad’s future capability.',
        checklist:['Primary owners fit the jobs.','Backups exist for critical work.','Learning roles supported rather than abandoned.','No rank-only assumptions.'],
      },
      {
        id:'coordination-lead-brief', stage:'Brief', type:'wing', title:'Brief comms, reporting, and stop conditions',
        objective:'Before launch, make clear what belongs in voice/comms, what belongs in the website/status source, how progress should be reported, and who can call a stop, redirect, or handoff.',
        why:'Coordination degrades when every update has the same urgency or when contradictory instructions live in different places.',
        checklist:['Comms expectations clear.','Authoritative status location clear.','Reporting format/units clear.','Stop/redirect authority clear.'],
      },
      {
        id:'coordination-lead-recover', stage:'Recover', type:'challenge', title:'Recover from a real disruption',
        objective:'When a member disconnects, a carrier is delayed, a market changes, an objective closes, opposition appears, or another major assumption fails, reorganize the work without losing the end state or leaving stale instructions active.',
        why:'Leadership is most visible when the original tasking stops being valid.',
        checklist:['Disruption recognized quickly.','Affected work paused or reassigned.','New authoritative instruction communicated.','Unnecessary cascade avoided.'],
      },
      {
        id:'coordination-lead-authority', stage:'Clarity', type:'challenge', title:'Protect one authoritative operational picture',
        objective:'Resolve one case of conflicting, duplicated, or stale tasking by identifying the current authoritative source, updating or superseding the old instruction, and making the resolution obvious to members joining later.',
        why:'A squad cannot coordinate if every channel contains a different version of the plan.',
        checklist:['Conflict/stale instruction identified.','Authoritative source confirmed.','Old instruction superseded or corrected.','Late joiner can find the current state.'],
      },
      {
        id:'coordination-lead-mentor', stage:'Mentor', type:'mentor', title:'Make another coordinator more independent',
        objective:'Give another Mongrel responsibility for part of the planning or live coordination. Coach through one decision, then let them own the next comparable decision without you solving it first.',
        why:'The strongest coordination system is not dependent on one person being online.',
        checklist:['Specific responsibility delegated.','One decision coached.','Later decision owned independently by learner.','Feedback given after rather than during when safe.'],
      },
      {
        id:'coordination-lead-debrief', stage:'Debrief', type:'mentor', title:'Improve the coordination system, not just the outcome',
        objective:'After the operation, debrief what created clarity or friction in tasking, handoffs, reporting, tools, and delegation. Preserve one concrete process improvement and one lesson worth teaching to future coordinators.',
        why:'A win can still expose a poor process. Veteran coordination should make the next operation easier to run.',
        checklist:['Outcome separated from process quality.','One friction point identified.','One process improvement preserved.','One mentoring lesson recorded.'],
      },
    ],
  },
];

export function eligibleSquadronCoordinationRoutes(experience) {
  if (experience === 'some') return ['coordination-contributor','coordination-cross-activity'];
  if (experience === 'comfortable') return ['coordination-cross-activity','coordination-mission-planner'];
  if (experience === 'experienced') return ['coordination-lead','coordination-mission-planner'];
  return ['coordination-foundations'];
}

export function getSquadronCoordinationRoute(id) {
  return SQUADRON_COORDINATION_ROUTES.find(route => route.id === id) || null;
}
