export const PVE_ACTIVITY_ID = 'pve';

const COMBAT_HUB = '/activities/#combat';
const SHIPS = '/ships/';
const ENGINEERING = '/guides/engineering/';
const OPERATIONS = '/operations/#daily-orders';
const PVP = '/pvp/';

export const PVE_ROUTES = [
  {
    id:'pve-foundations',
    band:'Beginner',
    title:'Combat Foundations — Scan, Fight, Cash In',
    subtitle:'Use one rebuy-safe combat ship to learn legal target selection, pips, positioning, disengagement, and a complete bounty-hunting loop.',
    audience:'For a Commander who is new to ship combat or has won fights before without a repeatable process for choosing targets, managing pips, surviving mistakes, and bringing the reward home.',
    outcome:'Graduate by completing a short independent bounty session with several legal NPC kills, deliberate pip changes, at least one safe disengagement decision, and the bounty vouchers cashed in.',
    sourceNote:'This route teaches control before damage. A beginner does not need an engineered meta ship; they need a ship they can afford to lose, targets they can evaluate, and enough discipline to leave before a bad fight becomes a rebuy.',
    sources:[
      { label:'Combat Activities Hub', url:COMBAT_HUB },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
    ],
    tasks:[
      {
        id:'pve-foundations-ship', stage:'Prepare', type:'build', title:'Prepare one rebuy-safe combat ship',
        objective:'Use a ship you already own and make sure it can survive a beginner combat session: functioning shields or a deliberate hull-tank plan, weapons you understand, enough distributor/power headroom to fight, and a rebuy you can afford.',
        why:'The first combat ship is a training platform, not a trophy build. You should be able to concentrate on flying and decision-making without one loss threatening your account balance.',
        checklist:['Rebuy covered.','Weapons assigned to usable fire groups.','Shield/hull strategy understood.','Power priorities do not disable something essential when hardpoints deploy.','You know whether the loadout depends on ammunition.'],
        link:{ label:'Browse Mongrel Combat Builds', url:SHIPS },
      },
      {
        id:'pve-foundations-legal-target', stage:'Targeting', type:'learn', title:'Confirm the target before opening fire',
        objective:'At a lawful bounty-hunting location, scan prospective targets and confirm the ship is a valid WANTED target before firing. Do not rely on appearance, ship type, or another pilot shooting first.',
        why:'A combat pilot who cannot distinguish a legal target from a bad trigger pull creates fines, bounties, friendly-fire problems, and unnecessary confusion before the real fight even starts.',
        checklist:['Target scan allowed to complete.','WANTED status confirmed before firing where local law applies.','At least one target deliberately rejected because the situation was unclear or unsuitable.'],
      },
      {
        id:'pve-foundations-pips', stage:'Pips', type:'demonstrate', title:'Move pips for the job you are doing now',
        objective:'During several low-risk engagements, deliberately change SYS, ENG, and WEP allocation as the situation changes: defend, maneuver/boost, then sustain weapon fire. Notice what happens when you leave the distributor in one static setting.',
        why:'Pip management is one of the fastest ways to make the same ship feel tougher, faster, and more consistent without buying or engineering anything.',
        checklist:['Pips changed intentionally during combat.','You can recover ENG when you need movement.','You can recover WEP when sustained fire is limited.','You can prioritize SYS when survival matters more than damage.'],
      },
      {
        id:'pve-foundations-target-choice', stage:'Threat', type:'demonstrate', title:'Choose a fight you can finish',
        objective:'Before engaging, compare target ship, combat rank, wing status, nearby contacts, and your own condition. Choose at least one favorable target and reject at least one fight that is a poor beginner trade.',
        why:'Good PvE is not proving you can attack everything on the scanner. Target selection keeps learning time focused on fights that teach rather than punish.',
        checklist:['Target condition/rank/wing status checked.','Nearby threats noticed.','At least one favorable fight chosen deliberately.','At least one poor fight rejected or postponed.'],
      },
      {
        id:'pve-foundations-first-fight', stage:'Fight', type:'demonstrate', title:'Win a clean bounty fight',
        objective:'Destroy a legal WANTED NPC while keeping control of range, pips, target tracking, and your own ship condition. Security help is acceptable; the goal is learning the loop, not proving a solo meta benchmark.',
        why:'The first useful win is one you understand. You should be able to explain what kept you alive and what actually let you keep damage on target.',
        checklist:['Legal target destroyed.','Ship remained controllable.','Pips changed at least once for a reason.','You can name one mistake and one thing that worked.'],
      },
      {
        id:'pve-foundations-disengage', stage:'Recovery', type:'demonstrate', title:'Leave before the ship forces you to leave',
        objective:'Practice breaking contact from a fight or deliberately end a session while the ship is still recoverable. Create distance, stop taking unnecessary damage, and return to safety rather than waiting for critical failure.',
        why:'Disengagement is a combat skill. Learning it early prevents the common beginner habit of treating every fight as a mandatory fight to the death.',
        checklist:['A retreat decision was made before destruction was inevitable.','Distance was created deliberately.','You reached a safe repair/rearm point.','You can identify the warning sign that triggered the decision.'],
      },
      {
        id:'pve-foundations-cash-in', stage:'Return', type:'demonstrate', title:'Bring the reward home',
        objective:'Return safely and redeem the bounty vouchers from the session. Review whether repairs, ammunition, travel time, or repeated retreats changed how productive the run felt.',
        why:'The combat loop is not complete when the target explodes. Returning safely and understanding the cost of the session turns kills into repeatable progression.',
        checklist:['Bounty vouchers redeemed.','Repair/rearm needs reviewed.','One cost or delay from the session identified.'],
      },
      {
        id:'pve-foundations-graduate', stage:'Graduate', type:'challenge', title:'Run a short bounty session without the checklist',
        objective:'Independently complete a short session with at least three legal NPC bounty kills. Choose the fights yourself, manage pips, disengage if needed, survive the return, and cash in the vouchers.',
        why:'Graduation means the basic combat loop belongs to you. The next step is making those decisions faster and under more pressure, not simply buying a larger ship.',
        checklist:['At least three legal bounty kills completed.','Targets selected independently.','Pips managed deliberately.','Any bad engagement was escaped or declined.','Vouchers returned and redeemed.'],
      },
    ],
  },
  {
    id:'pve-bounty-hunter',
    band:'Developing',
    title:'Bounty Hunter — Pips, Position, Pressure',
    subtitle:'Measure a normal combat session, improve time-on-target and resource management, then prove the change across a sustained bounty run.',
    audience:'For a Commander who can already win normal NPC fights but wants fewer messy chases, fewer avoidable shield losses, better weapon uptime, and more confidence choosing targets without relying on security forces.',
    outcome:'Graduate by completing a sustained bounty session with deliberate pip transitions, improved positioning, purposeful subsystem use, and one evidence-based ship or technique change.',
    sourceNote:'This route treats bounty hunting as repeatable combat craft. The goal is not a particular ship or credits-per-hour figure; it is reducing the waste between spotting a valid target and finishing the fight safely.',
    sources:[
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
      { label:'Combat Activities Hub', url:COMBAT_HUB },
    ],
    tasks:[
      {
        id:'pve-bounty-baseline', stage:'Baseline', type:'demonstrate', title:'Record one honest combat baseline',
        objective:'Run a normal bounty session and record a few practical observations: approximate session length, targets destroyed, shield/hull damage, ammunition or synthesis pressure, WEP starvation, heat trouble, and the biggest reason targets escaped your guns.',
        why:'A better build cannot fix a problem you have not identified. A short baseline separates damage problems from positioning, distributor, heat, survivability, and target-choice problems.',
        checklist:['Session length noted.','Targets destroyed noted.','Damage/repair state noted.','Ammo/WEP/heat issue noted if present.','Largest combat bottleneck named.'],
      },
      {
        id:'pve-bounty-firegroups', stage:'Weapons', type:'demonstrate', title:'Make the fire groups match the weapon jobs',
        objective:'Review the hardpoint package and fire groups, then test whether you can apply the right weapons at the intended range without wasting distributor, ammunition, or trigger time. Change one grouping if the current layout makes the fight harder.',
        why:'A strong weapon package can still perform poorly when every trigger does everything at once or when weapons with different jobs are difficult to control separately.',
        checklist:['Each fire group has a clear purpose.','Range/application differences understood.','One confusing or wasteful grouping corrected if needed.','Weapon use feels deliberate rather than automatic.'],
        link:{ label:'Open Engineering & Shipbuilding', url:ENGINEERING },
      },
      {
        id:'pve-bounty-pip-rhythm', stage:'Pips', type:'challenge', title:'Use a deliberate pip rhythm across three fights',
        objective:'Across at least three engagements, move pips proactively for approach, defense, boost/maneuver, and sustained fire. Do not wait for an empty capacitor or collapsing shield to remind you.',
        why:'Developing combat skill means anticipating the next demand rather than reacting after the ship has already run out of the resource you need.',
        checklist:['At least three fights completed.','Pips changed before a resource was exhausted.','Boost/WEP/shield needs were anticipated.','You can describe your normal pip rhythm in plain language.'],
      },
      {
        id:'pve-bounty-position', stage:'Position', type:'challenge', title:'Increase useful time on target',
        objective:'Focus one session on positioning rather than raw damage. Use throttle, boost, vertical/lateral thrust, and turn timing to keep the target in a useful firing window while reducing the time you spend directly in its strongest firing arc.',
        why:'More time on target often improves real damage more than another theoretical DPS upgrade—and it usually reduces incoming damage at the same time.',
        checklist:['Positioning was the deliberate focus.','Less time was spent chasing from a poor angle.','At least one maneuver improved firing time or reduced incoming fire.','You can name the maneuver that helped most.'],
      },
      {
        id:'pve-bounty-subtargets', stage:'Targeting', type:'demonstrate', title:'Use subsystem targeting on purpose',
        objective:'In at least two suitable fights, select a subsystem because disabling or damaging it serves a clear goal—control, escape prevention, damage application, or finishing the fight. Compare that result with simply shooting the hull.',
        why:'Subsystem targeting is useful when it solves a problem. It should be a deliberate tool, not a ritual applied to every NPC regardless of ship or situation.',
        checklist:['Subsystem selected deliberately in at least two fights.','Reason for the chosen subsystem understood.','Result compared with hull-only pressure.','You know when subsystem targeting is not worth the distraction.'],
      },
      {
        id:'pve-bounty-sustain', stage:'Endurance', type:'challenge', title:'Complete a sustained bounty run',
        objective:'Stay in a bounty-hunting area long enough for resource management to matter. Keep fighting only while the ship remains effective, then choose the return point based on shields/hull, ammunition, heat, synthesis needs, concentration, and voucher risk.',
        why:'A combat ship should be judged over the session it is meant to fly, not one perfect duel at full ammunition and full shields.',
        checklist:['Multiple engagements completed without an unnecessary reset.','Ship resources monitored between fights.','Return point chosen deliberately.','Session ended before effectiveness collapsed.'],
      },
      {
        id:'pve-bounty-rerun', stage:'Compare', type:'challenge', title:'Change the real bottleneck and re-run',
        objective:'Change one thing that directly addresses the baseline bottleneck—flying technique, fire groups, module choice, Engineering, target rule, or another measured issue—then run a comparable session and decide whether the change stays.',
        why:'Combat development should be testable. Keeping every upgrade because it looked good on paper eventually produces a ship whose compromises no longer match how you actually fight.',
        checklist:['One measured bottleneck targeted.','One change tested.','Comparable second session completed.','Change kept, reverted, or refined based on evidence.'],
      },
    ],
  },
  {
    id:'pve-conflict-zone',
    band:'Developing / Experienced',
    title:'Conflict Zone Specialist — Survive the Battle',
    subtitle:'Learn sustained battlefield awareness, friendly support, target priority, objectives, and recovery in fights where pressure does not stop after one kill.',
    audience:'For a Commander who is comfortable in ordinary bounty fights and wants to operate effectively in Conflict Zones without becoming isolated, tunnel-visioned, or dependent on repeated rearm/repair cycles.',
    outcome:'Graduate by completing a meaningful Conflict Zone session, supporting the correct side, staying integrated with friendlies, adapting to battlefield pressure, and returning safely enough to turn in the result.',
    sourceNote:'Conflict Zones reward endurance and battlefield judgement. This route does not assume the largest ship is best; it teaches how to stay useful while the fight changes around you.',
    sources:[
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Mission Control / Daily Orders', url:OPERATIONS },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
    ],
    tasks:[
      {
        id:'pve-cz-build-audit', stage:'Prepare', type:'build', title:'Audit the ship for sustained combat',
        objective:'Review the combat ship specifically for a longer battlefield: survivability, distributor endurance, ammunition, heat, module integrity, power priorities, and what condition should trigger a retreat. Do not assume a bounty build is automatically a good CZ build.',
        why:'Conflict Zones expose resource and survivability weaknesses that a short bounty fight can hide.',
        checklist:['Survivability plan understood.','Ammo/endurance limitation understood.','Power priorities checked.','Retreat condition chosen before entering.','Rebuy covered.'],
        link:{ label:'Browse Mongrel Combat Builds', url:SHIPS },
      },
      {
        id:'pve-cz-first-run', stage:'Battlefield', type:'demonstrate', title:'Complete a controlled Conflict Zone run',
        objective:'Enter an appropriate Conflict Zone, make sure you are fighting for the intended side before engaging, stay near useful friendly pressure, and complete a meaningful portion of the battle or withdraw safely if the ship reaches its planned stop condition.',
        why:'The first CZ lesson is surviving the battlefield while contributing to the correct side—not chasing the first red contact until the friendly formation disappears behind you.',
        checklist:['Correct side confirmed before committing.','Friendly ships used as battlefield context.','At least several hostile targets engaged.','Retreat condition respected if reached.'],
      },
      {
        id:'pve-cz-focus-fire', stage:'Priority', type:'challenge', title:'Choose targets that help the battle',
        objective:'Prioritize targets that are already pressured, threatening vulnerable friendlies, isolated, or otherwise practical to finish. Compare that with chasing a healthy target far away from the main fight.',
        why:'Finishing the right ship can change local pressure faster than spreading damage across every hostile contact.',
        checklist:['Several targets chosen for battlefield reasons.','At least one bad chase avoided.','Friendly pressure considered when selecting targets.','You can explain what made a target high priority.'],
      },
      {
        id:'pve-cz-objective-awareness', stage:'Objectives', type:'demonstrate', title:'Respond to the battle instead of tunnel-visioning',
        objective:'During a CZ session, pay attention to changing battlefield events or objectives and decide deliberately whether supporting them is worth breaking your current engagement. If no special objective appears, practice the same decision around a threatened ally or concentrated hostile group.',
        why:'A battlefield pilot needs enough spare attention to notice when the important fight is no longer the ship directly in front of them.',
        checklist:['Battlefield events monitored.','At least one priority decision made outside the current target.','Decision was proportional to ship condition and position.'],
      },
      {
        id:'pve-cz-harder-run', stage:'Challenge', type:'challenge', title:'Step up the pressure once',
        objective:'Attempt a more demanding CZ session than your normal baseline—through intensity, duration, ship choice, reduced outside support, or another meaningful difficulty increase—and finish or withdraw according to the plan instead of pride.',
        why:'Progress comes from controlled increases in pressure, not from jumping straight to the hardest instance and hoping the rebuy teaches the lesson.',
        checklist:['Difficulty increased for a specific reason.','Ship condition stayed monitored.','At least one pressure-management adjustment made.','Finish or retreat decision followed the plan.'],
      },
      {
        id:'pve-cz-wing', stage:'Wing / Team', type:'wing', title:'Run a CZ with another Mongrel',
        objective:'Fight with at least one squadmate and practice simple target calls, focus fire, separation awareness, and a clear rule for when one pilot needs help or needs to leave.',
        why:'Wing combat is not several solo fights happening near each other. Even basic focus and recovery calls can turn the same ships into a much stronger unit.',
        checklist:['Target calls used.','At least one focus-fire engagement completed.','Wing separation noticed and corrected.','Retreat/help call understood.'],
      },
      {
        id:'pve-cz-operations', stage:'Squad Support', type:'challenge', title:'Apply CZ skill to the correct squad objective',
        objective:'When using combat for BGS or squad work, check Mission Control / Daily Orders first and make sure the faction, conflict, mission rewards, and turn-in behavior actually support the current objective. If no live combat task is appropriate, explain what you would verify before acting.',
        why:'Winning the wrong fight can work against squad strategy. Combat skill becomes operational skill only when it is pointed at the correct objective.',
        checklist:['Current orders checked or verification process explained.','Correct faction/objective confirmed.','Combat result not assumed to be strategically useful without context.'],
        link:{ label:'Open Daily Orders', url:OPERATIONS },
      },
    ],
  },
  {
    id:'pve-combat-specialist',
    band:'Experienced',
    title:'Combat Specialist — Diagnose, Adapt, Sustain',
    subtitle:'Use harder PvE as a diagnostic tool: separate flying, build, weapon-application, endurance, and target-selection problems, then refine only what the evidence justifies.',
    audience:'For an experienced NPC combat pilot who can already bounty hunt and fight in CZs but wants more consistent performance against tougher targets, harder missions, and longer independent sessions.',
    outcome:'Graduate by diagnosing a real combat limitation, testing a targeted change against comparable pressure, and completing a higher-threat PvE objective with a clear explanation of what made the result repeatable.',
    sourceNote:'Experienced combat development should become more selective, not more grindy. The objective is to know why a ship wins, where it fails, and which change actually addresses the failure.',
    sources:[
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
      { label:'PvP Hub — Separate Discipline', url:PVP },
    ],
    tasks:[
      {
        id:'pve-specialist-benchmark', stage:'Benchmark', type:'challenge', title:'Choose a repeatable hard-fight benchmark',
        objective:'Select a PvE environment or mission type that is genuinely challenging for the current ship but repeatable enough to compare attempts. Record the failure pressure: time on target, incoming damage, WEP, heat, ammunition, module damage, target escape, or another concrete limit.',
        why:'A difficult benchmark is useful only if you can tell what failed and test whether the next change improves it.',
        checklist:['Repeatable benchmark chosen.','Primary failure pressure identified.','At least one observable measure recorded.','Benchmark is hard but not reckless.'],
      },
      {
        id:'pve-specialist-application', stage:'Application', type:'challenge', title:'Separate paper damage from applied damage',
        objective:'Review the weapon package in the benchmark fight and identify where theoretical damage is being lost to range, falloff, projectile travel, convergence, WEP starvation, heat, time off target, or ammunition discipline. Choose the largest real application loss.',
        why:'Adding damage to a weapon that rarely connects or cannot be sustained may make the build sheet better while making the fight unchanged.',
        checklist:['Largest application loss identified.','Weapon/range behavior observed in the real fight.','Distributor/heat/ammo effects considered.','One tempting but irrelevant DPS change rejected.'],
      },
      {
        id:'pve-specialist-defense', stage:'Defense', type:'challenge', title:'Identify how the ship actually loses fights',
        objective:'Determine whether the benchmark is threatening shields, hull, modules, canopy, mobility, power, or simply pilot concentration. Compare defensive strength with recovery options and decide what failure mode deserves attention first.',
        why:'More raw shield or hull is not automatically the best defensive improvement if the real loss comes from module failure, poor positioning, heat, or staying too long.',
        checklist:['Actual failure mode identified.','Recovery options reviewed.','One defensive change or flying adjustment chosen.','Change tied directly to the observed failure.'],
      },
      {
        id:'pve-specialist-subsystem-control', stage:'Control', type:'demonstrate', title:'Use subsystem pressure as a fight-control tool',
        objective:'Against suitable tougher targets, choose subsystem pressure only when it changes the fight: reducing mobility, limiting escape, degrading offense, or accelerating a finish. Compare at least one case where hull pressure remains the better choice.',
        why:'Experienced targeting means knowing both when subsystem work is powerful and when it simply steals attention from the fastest path to victory.',
        checklist:['Subsystem pressure used for a specific purpose.','At least one hull-focused comparison made.','Outcome evaluated by fight control, not habit.'],
      },
      {
        id:'pve-specialist-change', stage:'Refine', type:'build', title:'Make one targeted build or technique change',
        objective:'Change only what addresses the benchmark limitation: module, Engineering choice, hardpoint behavior, fire group, pip rhythm, maneuver, target rule, synthesis plan, or another directly relevant factor. Keep unrelated upgrades out of the test.',
        why:'Changing five things at once produces a better-looking ship but teaches nothing about which decision solved the problem.',
        checklist:['One primary limitation targeted.','Change is directly connected to it.','Unrelated upgrades deferred.','Expected tradeoff stated before testing.'],
        link:{ label:'Open Engineering & Shipbuilding', url:ENGINEERING },
      },
      {
        id:'pve-specialist-retest', stage:'Field Test', type:'challenge', title:'Re-run the benchmark under comparable pressure',
        objective:'Repeat the benchmark and compare the same measures. Keep the change only if it improves the real fight enough to justify any new cost in heat, power, ammunition, survivability, handling, or complexity.',
        why:'A specialist build is the result of repeated evidence, not a collection of upgrades that were never challenged after installation.',
        checklist:['Comparable retest completed.','Original pressure re-measured.','Tradeoff observed.','Change kept, reverted, or refined based on evidence.'],
      },
      {
        id:'pve-specialist-capstone', stage:'Capstone', type:'challenge', title:'Complete a higher-threat PvE objective on your terms',
        objective:'Choose a demanding PvE objective appropriate to your ship and ability, plan the engagement and exit conditions, complete it or make a disciplined withdrawal, then explain what made the result repeatable rather than lucky.',
        why:'The capstone is judgement under pressure. Success includes recognizing when the correct combat decision is to stop, recover, and try again with better information.',
        checklist:['Objective selected deliberately.','Entry/exit conditions planned.','Result completed or disciplined withdrawal made.','One repeatable lesson documented.'],
      },
    ],
  },
  {
    id:'pve-combat-lead',
    band:'Veteran / Mentor',
    title:'Combat Lead — Coordinate, Recover, Teach',
    subtitle:'Turn personal NPC-combat skill into wing effectiveness, clear tasking, recoverable operations, and better combat pilots around you.',
    audience:'For a veteran PvE pilot who can already operate independently across bounty hunting, Conflict Zones, and difficult NPC engagements and is ready to lead or mentor other Mongrels.',
    outcome:'Graduate by planning and leading a wing combat operation, adapting the plan once, recovering a pressured wingmate or degraded situation, mentoring another pilot, and publishing a concise debrief.',
    sourceNote:'Veteran PvE is not a bigger kill count. It is target judgement, communication, wing awareness, recovery, and leaving the squad with stronger pilots than it started with.',
    sources:[
      { label:'Mission Control / Daily Orders', url:OPERATIONS },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Combat Activities Hub', url:COMBAT_HUB },
    ],
    tasks:[
      {
        id:'pve-lead-plan', stage:'Planning', type:'mentor', title:'Plan a combat operation with a real objective',
        objective:'Choose a useful PvE objective and define location, intended target type, expected duration, ship assumptions, turn-in/reporting requirements, and the condition that ends the operation early.',
        why:'“Go shoot things” is recreation. A lead gives the wing a purpose, constraints, and a safe way to know when the operation is over.',
        checklist:['Objective defined.','Location/target type defined.','Ship assumptions stated.','Turn-in/reporting requirement checked.','Stop condition defined.'],
      },
      {
        id:'pve-lead-brief', stage:'Briefing', type:'mentor', title:'Brief roles, target calls, and exits',
        objective:'Before the first fight, make sure the wing understands who is calling targets, how focus fire will work, what to do if separated, how a damaged pilot signals trouble, and where the group will recover or regroup.',
        why:'Simple shared rules remove hesitation when the battlefield gets noisy.',
        checklist:['Target caller clear.','Focus-fire convention clear.','Separation/rejoin rule clear.','Damage/retreat call clear.','Regroup point understood.'],
      },
      {
        id:'pve-lead-operate', stage:'Wing / Team', type:'wing', title:'Lead the operation and adapt once',
        objective:'Run a meaningful combat session with other Commanders and make at least one real adjustment based on target composition, wing condition, ammunition, mission progress, instance behavior, or changing squad needs.',
        why:'Leadership starts when the original plan stops matching reality.',
        checklist:['Meaningful group combat completed.','Wing condition monitored.','At least one real adjustment made.','Change communicated clearly.'],
      },
      {
        id:'pve-lead-recovery', stage:'Recovery', type:'wing', title:'Recover a pressured wingmate or degraded fight',
        objective:'Handle or deliberately simulate one recovery problem: a wingmate losing shields/modules, separation, ammunition shortage, accidental aggro, poor target pull, or a fight that has become strategically pointless. Get the group back to a controlled state.',
        why:'A combat lead is measured as much by the disasters that do not become rebuys as by the targets that die.',
        checklist:['Problem recognized early.','Clear recovery call made.','Wing returned to a controlled state.','Decision did not depend on everyone improvising separately.'],
      },
      {
        id:'pve-lead-mentor', stage:'Teach / Mentor', type:'mentor', title:'Make another combat pilot more independent',
        objective:'Mentor another Mongrel through one specific PvE skill they could not perform confidently before: target selection, pip rhythm, positioning, subsystem use, CZ awareness, build diagnosis, disengagement, or wing discipline. Let them perform the skill themselves.',
        why:'The goal is not to become somebody else’s permanent target caller. It is to improve their judgement until they can make the decision without you.',
        checklist:['One specific skill chosen.','Commander performed the skill themselves.','Feedback focused on process/judgement.','Commander can repeat it independently.'],
      },
      {
        id:'pve-lead-debrief', stage:'Debrief', type:'mentor', title:'Publish the combat lesson and next adjustment',
        objective:'After the operation, summarize what worked, what created unnecessary damage or delay, target/wing lessons, any strategic reporting needed, and one concrete change for the next combat session.',
        why:'A debrief turns one successful night into reusable squad combat capability.',
        checklist:['Operational result recorded.','Combat lesson recorded.','Wing-development lesson recorded.','Required squad reporting completed if applicable.','One next adjustment recommended.'],
        link:{ label:'Open Daily Orders / Mission Control', url:OPERATIONS },
      },
    ],
  },
];

export function eligiblePveRoutes(experience = 'new') {
  if (experience === 'experienced') return ['pve-combat-lead','pve-combat-specialist','pve-conflict-zone'];
  if (experience === 'comfortable') return ['pve-combat-specialist','pve-conflict-zone','pve-bounty-hunter'];
  if (experience === 'some') return ['pve-bounty-hunter','pve-conflict-zone','pve-foundations'];
  return ['pve-foundations'];
}

export function getPveRoute(id) {
  return PVE_ROUTES.find(route => route.id === id) || null;
}
