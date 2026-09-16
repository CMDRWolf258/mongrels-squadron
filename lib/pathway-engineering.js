export const ENGINEERING_ACTIVITY_ID = 'engineering';

const ENGINEERING_GUIDE = '/guides/engineering/';
const ENGINEERING_REFERENCE = '/guides/reference/';
const SHIPS = '/ships/';

export const ENGINEERING_ROUTES = [
  {
    id:'engineering-foundations',
    band:'Beginner',
    title:'Engineering Foundations — Improve One Ship',
    subtitle:'Start with a ship you already use, improve one thing you can feel, then add one complementary modification with a clear purpose.',
    audience:'For a Commander who has little or no engineering experience and should learn by improving a real ship instead of studying the whole engineering system first.',
    outcome:'Graduate by engineering a ship you actually use, testing the result, and solving a second weakness without needing a complete build handed to you.',
    sourceNote:'Beginner Engineering is action-first. The goal is not to memorize every blueprint, engineer, material, or experimental. Learn the system by making one useful change at a time.',
    sources:[{ label:'Engineering Guides', url:ENGINEERING_GUIDE },{ label:'Engineering Reference', url:ENGINEERING_REFERENCE }],
    tasks:[
      {
        id:'engineering-foundations-pick-ship', stage:'Choose', type:'learn', title:'Pick one ship you actually fly',
        objective:'Choose a ship you use regularly and state its main job in one sentence.',
        why:'Engineering only makes sense when the ship has a job. Start with something you already understand well enough to notice the difference.',
        checklist:['Ship selected.','Primary role stated.'],
        link:{ label:'Open Ship Catalogue', url:SHIPS },
      },
      {
        id:'engineering-foundations-weakness', stage:'Notice', type:'learn', title:'Name one thing you want the ship to do better',
        objective:'Choose one concrete weakness you can feel in normal use, such as jump range, speed, boost recovery, weapon sustain, shield strength, heat, or another obvious limitation.',
        why:'A good first modification solves a problem you already recognize.',
        checklist:['One weakness identified.','Improvement goal is specific.'],
      },
      {
        id:'engineering-foundations-module', stage:'Choose', type:'learn', title:'Find the module that controls that problem',
        objective:'Identify the module most directly responsible for the weakness you chose and find an engineering blueprint that could improve it.',
        why:'This teaches the basic engineering question: what system actually controls the performance you want to change?',
        checklist:['Relevant module identified.','One suitable blueprint found.'],
        link:{ label:'Open Engineering Reference', url:ENGINEERING_REFERENCE },
      },
      {
        id:'engineering-foundations-access', stage:'Unlock', type:'build', title:'Get access to the engineer you need',
        objective:'Find and unlock an engineer who can apply the chosen modification, or confirm that you already have access to one.',
        why:'Engineer access is part of the progression, but you only need to learn the chain relevant to the modification you are making now.',
        checklist:['Required engineer identified.','Access requirement completed or already satisfied.'],
      },
      {
        id:'engineering-foundations-materials', stage:'Gather', type:'demonstrate', title:'Gather only the materials for this modification',
        objective:'Collect enough materials to make meaningful progress on the selected blueprint. Do not try to stockpile the entire engineering economy yet.',
        why:'Focused gathering keeps the first engineering project small and gives materials a clear purpose.',
        checklist:['Required materials identified.','Enough materials gathered to apply the modification.'],
      },
      {
        id:'engineering-foundations-first-mod', stage:'Engineer', type:'build', title:'Apply your first useful modification',
        objective:'Engineer the chosen module and add an experimental effect if an appropriate one is available and you understand why you want it.',
        why:'The point is to change the ship, not just study the menu.',
        checklist:['Blueprint applied.','Experimental chosen deliberately if used.','Ship remains functional for its role.'],
      },
      {
        id:'engineering-foundations-test', stage:'Test', type:'demonstrate', title:'Fly the ship and feel the difference',
        objective:'Use the ship in its normal role and compare the engineered behavior with what you remember from before the change.',
        why:'Engineering becomes intuitive when the numbers connect to something you can actually feel while flying.',
        checklist:['Ship tested in normal use.','At least one noticeable change identified.'],
      },
      {
        id:'engineering-foundations-second', stage:'Build', type:'challenge', title:'Make one complementary improvement',
        objective:'Choose a second module that supports the same ship role and engineer it for a different but complementary reason.',
        why:'This is the first step from “one upgraded module” toward “a ship whose systems support each other.”',
        checklist:['Second weakness or opportunity identified.','Different module engineered.','Reason for the second change explained.'],
      },
      {
        id:'engineering-foundations-graduate', stage:'Graduate', type:'challenge', title:'Solve one more ship problem without a recipe',
        objective:'Identify another weakness on the same ship, choose the module and engineering yourself, apply the change, and test the result.',
        why:'Beginner Engineering is complete when you can repeat the improvement process without being told exactly what to modify.',
        checklist:['Problem identified independently.','Engineering choice made independently.','Modification applied.','Result tested.'],
      },
    ],
  },
  {
    id:'engineering-network',
    band:'Developing',
    title:'Engineer Network — Unlock, Gather, Pin',
    subtitle:'Turn one-off engineering trips into a usable network of engineers, materials, traders, and pinned blueprints.',
    audience:'For Commanders who have engineered a few modules but still treat every new project as a fresh scavenger hunt.',
    outcome:'Graduate with a small but practical engineer network, a repeatable material workflow, and pinned blueprints that reduce unnecessary travel.',
    sourceNote:'This route focuses on engineering access and logistics. Full-build design belongs in Role Builder and deeper ship optimization belongs in later routes.',
    sources:[{ label:'Engineering Guides', url:ENGINEERING_GUIDE },{ label:'Engineering Reference', url:ENGINEERING_REFERENCE }],
    tasks:[
      {
        id:'engineering-network-map', stage:'Map', type:'learn', title:'Map the engineers you actually need next',
        objective:'Pick three engineering capabilities relevant to ships you currently fly and identify which engineers can provide them.',
        why:'A useful network is built around real ships, not around unlocking every engineer just because they exist.',
        checklist:['Three capabilities chosen.','Engineer for each identified.'],
      },
      {
        id:'engineering-network-unlock', stage:'Unlock', type:'build', title:'Unlock one new useful engineer',
        objective:'Complete the access path for one engineer who materially expands what you can do to your current ships.',
        why:'Each unlock should create a new practical capability rather than simply tick a box.',
        checklist:['Engineer chosen for a reason.','Unlock completed.'],
      },
      {
        id:'engineering-network-raw', stage:'Materials', type:'demonstrate', title:'Build a raw-material routine',
        objective:'Gather a useful batch of raw engineering materials and learn one reliable way to replenish them later.',
        why:'Engineering gets much easier once material gathering becomes a known routine instead of an emergency.',
        checklist:['Useful raw materials gathered.','Repeatable source or method understood.'],
      },
      {
        id:'engineering-network-manufactured', stage:'Materials', type:'demonstrate', title:'Build a manufactured-material routine',
        objective:'Gather a useful batch of manufactured materials and learn one repeatable source or exchange strategy.',
        why:'Different material classes require different habits. Learning them separately keeps the system understandable.',
        checklist:['Useful manufactured materials gathered.','Repeatable method understood.'],
      },
      {
        id:'engineering-network-data', stage:'Materials', type:'demonstrate', title:'Build a data-material routine',
        objective:'Gather a useful batch of encoded/data materials and learn one repeatable way to replenish them.',
        why:'Data materials stop feeling random once you know where your normal supply comes from.',
        checklist:['Useful data materials gathered.','Repeatable method understood.'],
      },
      {
        id:'engineering-network-trader', stage:'Trade', type:'challenge', title:'Use a material trader deliberately',
        objective:'Use a material trader to convert surplus into something needed for a current build, and explain why the trade was worth the loss in exchange efficiency.',
        why:'Material traders are strongest when they rescue an actual build plan rather than becoming the default way to acquire everything.',
        checklist:['Surplus identified.','Needed material identified.','Trade completed for a current purpose.'],
      },
      {
        id:'engineering-network-pin', stage:'Pin', type:'challenge', title:'Pin blueprints that reduce future travel',
        objective:'Review your unlocked engineers and pin blueprints that support ships you regularly modify. Avoid duplicating pins with no clear use.',
        why:'Pinned blueprints turn the engineer network into a practical remote workshop.',
        checklist:['Pins chosen around real needs.','At least one future trip eliminated or reduced.'],
      },
      {
        id:'engineering-network-graduate', stage:'Graduate', type:'challenge', title:'Complete an engineering project without an emergency material grind',
        objective:'Choose a useful module upgrade, use your existing access/material network to complete it efficiently, and note which part of the network saved the most time.',
        why:'The route is complete when engineering starts to feel like infrastructure you can use, not a new expedition every time.',
        checklist:['Project completed.','Existing network materially helped.','One remaining network gap identified.'],
      },
    ],
  },
  {
    id:'engineering-role-builder',
    band:'Developing / Experienced',
    title:'Role Builder — Make the Whole Ship Agree',
    subtitle:'Engineer a complete ship around one job so its core modules, defenses, weapons, power, and utility support the same purpose.',
    audience:'For Commanders who can engineer individual modules but want to stop building ships as collections of unrelated upgrades.',
    outcome:'Graduate with a coherent engineered ship whose major choices can all be explained in terms of the role it performs.',
    sourceNote:'The Mongrel Engineering Guide emphasizes role-first design, power-plant decisions late in the process, distributor recharge, effective defenses, and whole-package weapon effects.',
    sources:[{ label:'Engineering Guides', url:ENGINEERING_GUIDE },{ label:'Ship Catalogue', url:SHIPS }],
    tasks:[
      {
        id:'engineering-role-define', stage:'Role', type:'learn', title:'Define the ship job before touching engineering',
        objective:'Write a short role statement for one ship including what it must do well and one thing it does not need to optimize.',
        why:'A build becomes coherent when every major choice can be judged against the same role.',
        checklist:['Primary job stated.','One non-priority stated.'],
      },
      {
        id:'engineering-role-mobility', stage:'Mobility', type:'build', title:'Engineer movement for the role',
        objective:'Choose thruster and FSD engineering that fits how the ship needs to move and travel, then test the result.',
        why:'Speed, boost behavior, and travel performance shape how the entire ship feels.',
        checklist:['Thruster choice tied to role.','FSD choice tied to role.','Result tested.'],
      },
      {
        id:'engineering-role-distributor', stage:'Distributor', type:'build', title:'Make the distributor support the workload',
        objective:'Engineer the power distributor around the ship’s real boost, shield-pip, and weapon demands rather than choosing the largest-looking capacitor stat.',
        why:'Recharge rhythm often matters more than static capacity in repeated combat and maneuver cycles.',
        checklist:['Primary SYS/ENG/WEP demand identified.','Distributor engineering chosen deliberately.'],
      },
      {
        id:'engineering-role-defense', stage:'Defense', type:'build', title:'Build the defense you actually intend to use',
        objective:'Choose shield, booster, hull, and module-protection engineering around the ship’s expected fight length and damage exposure.',
        why:'Raw MJ or hull integrity alone does not define practical durability.',
        checklist:['Defense strategy named.','Resistance or raw-strength choices explained.','Module protection considered if relevant.'],
      },
      {
        id:'engineering-role-weapons', stage:'Weapons', type:'build', title:'Engineer the weapon package as a package',
        objective:'Review weapon blueprints and experimentals so utility effects are deliberate and non-stacking effects are not duplicated without a reason.',
        why:'The strongest weapon setup is often the set of guns that work together rather than the individually highest-paper-DPS options.',
        checklist:['Weapon roles identified.','Utility effects assigned deliberately.','Unnecessary duplicate effects avoided.'],
      },
      {
        id:'engineering-role-power', stage:'Power', type:'challenge', title:'Engineer the power plant last',
        objective:'Finish the major loadout, set realistic power priorities, then choose the lowest-cost power-plant engineering that closes the actual budget.',
        why:'Power Plant engineering is easier to judge once you know what the complete ship truly needs.',
        checklist:['Loadout substantially complete.','Power priorities set.','Plant engineering chosen from real demand.'],
      },
      {
        id:'engineering-role-field-test', stage:'Test', type:'challenge', title:'Field-test the complete build',
        objective:'Use the ship in the role it was built for and identify one engineering choice that worked well and one that deserves another look.',
        why:'A build is not finished when EDSY says it works; it is finished when the ship works for you in the intended job.',
        checklist:['Ship tested in role.','One successful choice identified.','One possible refinement identified.'],
      },
      {
        id:'engineering-role-graduate', stage:'Graduate', type:'challenge', title:'Explain the build without saying “because it is meta”',
        objective:'Walk another Mongrel through the major engineering choices and explain what each one contributes to the ship’s role and what tradeoff it accepts.',
        why:'If you can explain the tradeoffs, you understand the build rather than merely copying it.',
        checklist:['Core choices explained.','Defense choices explained.','Weapon/utility choices explained.','At least one tradeoff acknowledged.'],
      },
    ],
  },
  {
    id:'engineering-combat-systems',
    band:'Experienced',
    title:'Combat Systems — Weapons, Defense, Core Tradeoffs',
    subtitle:'Study how engineering choices interact under combat pressure: weapon utility, resistances, heat, power, distributor demand, speed, and module survival.',
    audience:'For experienced combat pilots who want to understand why different engineered combat builds behave differently rather than copying a standard package.',
    outcome:'Graduate by building and testing two meaningfully different combat engineering solutions and explaining when each is preferable.',
    sourceNote:'This route uses the deeper weapon, defense, and core-module guidance in the Mongrel Field Manual and expects the Commander to test engineering in live combat rather than only compare paper stats.',
    sources:[{ label:'Engineering Guides', url:ENGINEERING_GUIDE },{ label:'Engineering Reference', url:ENGINEERING_REFERENCE }],
    tasks:[
      {
        id:'engineering-combat-utility', stage:'Weapons', type:'challenge', title:'Allocate weapon utility on purpose',
        objective:'Build or revise a combat weapon package so effects such as Corrosive, Feedback, Thermal Vent, Drag, Dispersal, Emissive, or other utility are assigned for a reason and unnecessary duplicates are removed.',
        why:'Hardpoints can control the fight as well as deal damage.',
        checklist:['Utility effects identified.','Non-stacking effects reviewed.','Each experimental has a purpose.'],
      },
      {
        id:'engineering-combat-resistance', stage:'Defense', type:'challenge', title:'Fix a real defensive weakness',
        objective:'Inspect one combat ship’s shield or hull resistance profile, identify the weakest practical exposure, and revise engineering to improve it without blindly maximizing one number.',
        why:'Effective durability depends on what damage the ship actually expects to take.',
        checklist:['Weakness identified.','Engineering changed deliberately.','Tradeoff measured or explained.'],
      },
      {
        id:'engineering-combat-heat', stage:'Thermal', type:'challenge', title:'Engineer around heat instead of ignoring it',
        objective:'Test the ship under its heaviest normal thermal load and change engineering, power use, weapon effects, or procedure if heat is limiting the build.',
        why:'A build that only works while cool on paper may fail during sustained combat, boosting, or Shield Cell use.',
        checklist:['High-load heat observed.','Heat source identified.','One mitigation tested.'],
      },
      {
        id:'engineering-combat-distributor', stage:'Distributor', type:'challenge', title:'Measure the combat distributor bottleneck',
        objective:'Identify whether repeated boosts, shield pips, or weapon fire are exhausting the distributor first and test an engineering change or flying adjustment that improves the limiting cycle.',
        why:'The distributor defines the tempo of many combat builds.',
        checklist:['Limiting capacitor identified.','Change tested.','Combat rhythm improved or tradeoff understood.'],
      },
      {
        id:'engineering-combat-modules', stage:'Survival', type:'demonstrate', title:'Plan for fighting after shields fail',
        objective:'For a ship expected to continue fighting or escaping with shields down, review module reinforcement, critical-module placement, power priorities, and repair options.',
        why:'Hull integrity is not useful if the thrusters, canopy, power plant, or weapons fail before the hull does.',
        checklist:['Critical modules identified.','Module protection reviewed.','Escape/repair capability considered.'],
      },
      {
        id:'engineering-combat-compare', stage:'Compare', type:'challenge', title:'Compare two valid engineering philosophies',
        objective:'Build or analyze two different approaches to the same combat role—for example raw shields versus resistance balance, hotter damage versus thermal control, or heavier durability versus speed—and test or defend both.',
        why:'Advanced engineering is about choosing among valid tradeoffs, not discovering one universally correct build.',
        checklist:['Two approaches defined.','Strengths and weaknesses compared.','Use case for each explained.'],
      },
      {
        id:'engineering-combat-graduate', stage:'Graduate', type:'challenge', title:'Build a combat ship around a deliberate compromise',
        objective:'Create or substantially revise a combat build where you intentionally sacrifice one desirable stat to strengthen another part of the role, then test the result in combat.',
        why:'Mastery begins when tradeoffs are intentional instead of accidental.',
        checklist:['Compromise stated before testing.','Build completed or revised.','Combat test completed.','Tradeoff judged afterward.'],
      },
    ],
  },
  {
    id:'engineering-ship-architect',
    band:'Experienced / Veteran',
    title:'Ship Architect — Diagnose, Test, Refine',
    subtitle:'Treat an engineered ship as a system: diagnose the limiting behavior, model alternatives, change the smallest useful thing, and validate the result in the field.',
    audience:'For experienced builders who already understand common blueprints and want stronger diagnostic judgment across different ship roles.',
    outcome:'Graduate by diagnosing and materially improving several ships without replacing them with canned meta builds.',
    sourceNote:'Ship Architect emphasizes diagnosis and iteration. The target is the Commander’s ability to explain why a change improves the specific ship, not adherence to one preferred template.',
    sources:[{ label:'Engineering Guides', url:ENGINEERING_GUIDE },{ label:'Ship Catalogue', url:SHIPS }],
    tasks:[
      {
        id:'engineering-architect-audit', stage:'Audit', type:'challenge', title:'Audit a finished engineered ship',
        objective:'Take one fully or mostly engineered ship and identify the three most important compromises in the build.',
        why:'Every strong build has compromises. Seeing them is the start of useful diagnosis.',
        checklist:['Three compromises identified.','Each tied to the ship role.'],
      },
      {
        id:'engineering-architect-bottleneck', stage:'Diagnosis', type:'challenge', title:'Find the limiting system',
        objective:'Identify the single system currently limiting the ship most—mobility, power, heat, distributor, defense, damage application, range, module survival, or another measurable factor.',
        why:'Changing five modules at once hides the reason the ship improved or got worse.',
        checklist:['Primary bottleneck named.','Evidence or flight behavior supports it.'],
      },
      {
        id:'engineering-architect-model', stage:'Model', type:'challenge', title:'Model two possible fixes',
        objective:'Use EDSY or equivalent build comparison to create two different engineering solutions for the same bottleneck before spending materials.',
        why:'Modeling lets you compare tradeoffs cheaply before committing to engineering work.',
        checklist:['Two fixes modeled.','Important gains/losses compared.','One option selected.'],
      },
      {
        id:'engineering-architect-change', stage:'Refine', type:'demonstrate', title:'Change the smallest useful thing',
        objective:'Apply the selected fix with the fewest module changes needed to test the hypothesis.',
        why:'Controlled changes make diagnosis repeatable.',
        checklist:['Targeted change applied.','Unrelated modules left alone where possible.'],
      },
      {
        id:'engineering-architect-test', stage:'Test', type:'challenge', title:'Validate the fix under real use',
        objective:'Test the ship in the scenario that exposed the original problem and decide whether the change actually solved it.',
        why:'A successful spreadsheet change can still fail in the cockpit.',
        checklist:['Original scenario repeated.','Result observed.','Keep/revert/revise decision made.'],
      },
      {
        id:'engineering-architect-cross-role', stage:'Breadth', type:'challenge', title:'Diagnose a ship from a different role',
        objective:'Repeat the audit-and-fix process on a ship whose role differs substantially from your normal build specialty.',
        why:'Broad builders learn to diagnose from the role outward instead of applying the same template everywhere.',
        checklist:['Different role selected.','Role-specific bottleneck identified.','Useful change completed or proposed.'],
      },
      {
        id:'engineering-architect-graduate', stage:'Graduate', type:'challenge', title:'Improve a Mongrel build without replacing its identity',
        objective:'Review another Mongrel’s ship, preserve the owner’s intended role and preferred play style, and recommend a small set of engineering changes that solve the biggest problems first.',
        why:'Strong build advice improves the Commander’s ship rather than turning every ship into your ship.',
        checklist:['Owner’s intent understood.','Highest-impact issues prioritized.','Recommendations preserve the role.','Tradeoffs explained.'],
      },
    ],
  },
  {
    id:'engineering-mentor',
    band:'Veteran / Mentor',
    title:'Engineering Mentor — Review, Explain, Teach',
    subtitle:'Turn build knowledge into squad capability by teaching diagnosis, reviewing tradeoffs, and helping other Commanders make their own engineering decisions.',
    audience:'For veteran builders who no longer need blueprint guidance and should be challenged on explanation, judgment, and knowledge transfer.',
    outcome:'Complete the route by helping other Mongrels become more independent builders while demonstrating advanced diagnosis across multiple ship roles.',
    sourceNote:'This is a development route, not an automatic squad rank. The goal is to create better builders, not more people who copy the mentor’s preferred templates.',
    sources:[{ label:'Engineering Guides', url:ENGINEERING_GUIDE },{ label:'Ship Catalogue', url:SHIPS }],
    tasks:[
      {
        id:'engineering-mentor-review', stage:'Mentor', type:'mentor', title:'Review a build by asking questions first',
        objective:'Review another Mongrel’s build without immediately prescribing changes. First establish the ship’s role, the owner’s priorities, what feels wrong, and what they refuse to give up.',
        why:'Good engineering advice starts with the Commander’s intent.',
        checklist:['Role understood first.','Owner priorities identified.','Constraints respected.'],
      },
      {
        id:'engineering-mentor-prioritize', stage:'Mentor', type:'mentor', title:'Give only the highest-value corrections',
        objective:'From a full build review, identify the two or three engineering changes that would make the largest practical improvement and explain why the rest can wait.',
        why:'Dumping twenty corrections on someone is less useful than teaching them what matters most.',
        checklist:['Recommendations limited and prioritized.','Each tied to observed role/performance.'],
      },
      {
        id:'engineering-mentor-tradeoff', stage:'Teach', type:'mentor', title:'Teach one engineering tradeoff instead of one answer',
        objective:'Choose a real build decision with at least two valid options and coach another Commander through comparing them until they choose the option that fits their own ship.',
        why:'Understanding a tradeoff transfers to future builds; memorizing your answer does not.',
        checklist:['Two valid options discussed.','Learner makes final choice.','Learner can explain the tradeoff afterward.'],
      },
      {
        id:'engineering-mentor-diagnose', stage:'Diagnosis', type:'challenge', title:'Diagnose an unfamiliar build quickly',
        objective:'Review a ship or role outside your usual specialty and identify the most likely engineering bottleneck without rebuilding the entire ship from scratch.',
        why:'Veteran engineering skill should travel across hulls and roles.',
        checklist:['Unfamiliar role used.','Primary issue identified.','Recommendation is role-specific.'],
      },
      {
        id:'engineering-mentor-field', stage:'Mentor', type:'mentor', title:'Test a learner’s change in the field',
        objective:'Have another Mongrel apply one engineering change they chose, then fly with them or review the result after a real use case and help them decide whether to keep it.',
        why:'The learning loop is incomplete until the Commander connects the engineering choice to how the ship actually behaves.',
        checklist:['Learner chose/applied change.','Real test completed.','Learner judges result first.'],
      },
      {
        id:'engineering-mentor-plan', stage:'Lead', type:'wing', title:'Write a staged engineering plan for a difficult build',
        objective:'Create a practical engineering sequence for a complex ship that prioritizes high-impact changes, required unlocks/materials, test points, and optional refinements instead of demanding a full G5 build immediately.',
        why:'A staged plan helps a member improve now while still understanding the path to the finished ship.',
        checklist:['High-impact steps first.','Unlock/material dependencies considered.','Test points included.','Optional refinements separated.'],
      },
      {
        id:'engineering-mentor-capstone', stage:'Capstone', type:'mentor', title:'Help another Mongrel become an independent builder',
        objective:'Mentor a less-experienced Commander through one complete ship-improvement cycle: define the role, identify a weakness, select engineering, acquire what is needed, apply it, test it, and let them choose the next improvement themselves.',
        why:'The capstone succeeds when the learner needs less help on the next ship than they did on the first.',
        checklist:['Learner owns the decisions.','One complete improvement cycle finished.','Result tested.','Learner independently identifies the next step.'],
      },
    ],
  },
];

export function eligibleEngineeringRoutes(experience = 'new') {
  if (experience === 'experienced') return ['engineering-mentor','engineering-ship-architect','engineering-combat-systems','engineering-role-builder'];
  if (experience === 'comfortable') return ['engineering-ship-architect','engineering-combat-systems','engineering-role-builder','engineering-network'];
  if (experience === 'some') return ['engineering-role-builder','engineering-network','engineering-foundations'];
  return ['engineering-foundations'];
}

export function getEngineeringRoute(id) {
  return ENGINEERING_ROUTES.find(route => route.id === id) || null;
}
