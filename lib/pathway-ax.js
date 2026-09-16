export const AX_ACTIVITY_ID = 'ax';

export const AX_ROUTES = [
  {
    id:'ax-scout-vulture',
    band:'Beginner',
    title:'Scout School — Vulture',
    subtitle:'Get into real AX combat quickly with a simple, purpose-built Scout hunter.',
    audience:'Best for a CMDR who wants an approachable first live Thargoid fight before committing to the full Interceptor engineering path.',
    outcome:'Graduate by building the ship, finding your own Scout signals, destroying Scouts, and returning alive.',
    sourceNote:'Equipment and target-selection guidance follows current Anti-Xeno Initiative Scout and Thargoid-location guidance. The Mongrel assignments are our own training sequence.',
    sources:[
      { label:'AXI Recommended Builds', url:'https://wiki.antixenoinitiative.com/en/builds' },
      { label:'AXI Finding Thargoids', url:'https://wiki.antixenoinitiative.com/en/finding-thargoids' },
      { label:'AXI Optional & Utility Modules', url:'https://wiki.antixenoinitiative.com/en/optionals' },
    ],
    tasks:[
      {
        id:'scout-budget', stage:'Prepare', title:'Fund the training ship',
        objective:'Set aside about 25 million credits for the Vulture Scout School build and keep at least one rebuy untouched.',
        why:'The Vulture is a cheap AX Scout platform and does not require engineering for this introductory route. The rebuy reserve is non-negotiable.',
        checklist:['Have roughly 25M Cr available for ship + outfitting.','Keep at least one full rebuy after outfitting; two is better.'],
        link:{ label:'Browse Mongrel Ship Catalogue', url:'/ships/' },
      },
      {
        id:'scout-buy-vulture', stage:'Build', title:'Acquire the hull',
        objective:'Purchase a Vulture. This is your assigned first AX training ship for this route.',
        why:'Its two large hardpoints make a very simple Scout-killing platform, and losing one is far less painful than learning in an expensive end-game ship.',
        checklist:['Purchase Vulture.','Do not sell your normal combat ship to fund it.'],
      },
      {
        id:'scout-fit-weapons', stage:'Build', title:'Install the AX weapons',
        objective:'Fit 2 × Large Gimballed Enhanced AX Multi-Cannons. Do not use fixed AX multi-cannons for this Scout route.',
        why:'Scouts move erratically. AXI recommends gimballed or turreted Enhanced AX Multi-Cannons for reliable Scout tracking and AX damage.',
        checklist:['Large Gimballed Enhanced AX Multi-Cannon ×2.','Put both weapons in the same primary-fire group.'],
        link:{ label:'AXI Scout Build Guidance', url:'https://wiki.antixenoinitiative.com/en/builds', external:true },
      },
      {
        id:'scout-fit-survival', stage:'Build', title:'Make it survivable',
        objective:'Fit a Class 5 shield generator, reinforce the hull, and install a Caustic Sink Launcher. Add an Enhanced Xeno Scanner if you have the utility slot.',
        why:'Scout weapons can damage both shield and hull, and caustic effects can continue eating your ship after the initial hit. The Enhanced Xeno Scanner makes identification much easier.',
        checklist:['Class 5 shield generator fitted.','Use remaining practical internals for hull/module survivability.','Caustic Sink Launcher fitted.','Enhanced Xeno Scanner fitted if practical.'],
        link:{ label:'AXI Utility Module Guide', url:'https://wiki.antixenoinitiative.com/en/optionals', external:true },
      },
      {
        id:'scout-controls', stage:'Ready', title:'Set the cockpit before combat',
        objective:'Configure your AXMC fire group, scanner, caustic-sink control, boost, pips, and target-ahead controls before leaving the station.',
        why:'AX is the wrong place to discover that an important control is unbound.',
        checklist:['AXMCs fire together.','Enhanced Xeno Scanner assigned if fitted.','Caustic Sink Launcher control understood.','Boost and pip controls are comfortable.','Target Ahead is bound and easy to reach.'],
      },
      {
        id:'scout-travel-pleiades', stage:'Deploy', title:'Go to the training ground',
        objective:'Travel to Asterope in the Pleiades. Use the FSS or Nav Beacon to locate Non-Human Signal Sources.',
        why:'AXI currently recommends Asterope, Sterope II, and Merope for consistent Pleiades NHSS activity. Asterope is the assigned Mongrel starter location for this route.',
        checklist:['Arrive in Asterope.','Refuel/rearm before hunting.','Locate at least one Non-Human Signal Source.'],
        link:{ label:'AXI Finding Thargoids', url:'https://wiki.antixenoinitiative.com/en/finding-thargoids', external:true },
      },
      {
        id:'scout-first-contact', stage:'Fight', title:'First contact — two Scouts',
        objective:'Enter a Threat 3 Non-Human Signal Source, destroy the two Scouts, and return to supercruise alive.',
        why:'Threat 3 NHSS are a small, controlled first combat step. The goal is not speed; it is completing your first entire AX engagement without a rebuy.',
        checklist:['Choose NHSS Threat 3.','Destroy both Scouts.','Manage caustic if applied.','Leave the instance alive.'],
      },
      {
        id:'scout-threat-four', stage:'Fight', title:'Clear a real Scout pack',
        objective:'Enter a Threat 4 Non-Human Signal Source and destroy at least four Scouts in one deployment without rebuying.',
        why:'Threat 4 commonly contains a larger Scout group. This tests target tracking, damage management, and staying calm when several Thargoids are active.',
        checklist:['Choose NHSS Threat 4.','Destroy at least four Scouts.','Return to dock and repair/rearm.'],
      },
      {
        id:'scout-graduate', stage:'Graduate', title:'Scout School qualification',
        objective:'Complete one more Scout deployment of your choice and return to port. Then mark this assignment complete.',
        why:'You now know how to build an AX-specific ship, find Thargoid activity, manage basic caustic risk, and complete live AX combat. Your next useful step is Interceptor preparation.',
        checklist:['Complete another Scout run.','Return safely.','Decide whether to continue into the Chieftain Interceptor pathway.'],
      },
    ],
  },
  {
    id:'ax-chieftain-academy',
    band:'Beginner / Developing',
    title:'Interceptor Academy — Chieftain',
    subtitle:'Build the classic learning platform, unlock the required technology, then earn your first Cyclops kill.',
    audience:'Best for a CMDR willing to prepare properly before taking on an Interceptor.',
    outcome:'Graduate by building an engineered Guardian-Gauss Chieftain, completing flight/aim drills, destroying a Cyclops heart, then killing a Cyclops.',
    sourceNote:'The build and engineering sequence is based on current AXI Chieftain doctrine, Guardian unlock guidance, and Interceptor combat guidance. Mongrel drill order is our training sequence.',
    sources:[
      { label:'AXI Advanced Combat / Chieftain Doctrine', url:'https://wiki.antixenoinitiative.com/en/advanced-combat-guide' },
      { label:'AXI Guardian Unlocks', url:'https://wiki.antixenoinitiative.com/en/guardianunlocks' },
      { label:'AXI AX Engineering', url:'https://wiki.antixenoinitiative.com/en/Unlocking-Engineers' },
      { label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide' },
    ],
    tasks:[
      {
        id:'chief-buy', stage:'Platform', title:'Acquire the AX learning platform',
        objective:'Purchase an Alliance Chieftain and keep enough credits for at least one full rebuy after outfitting.',
        why:'AXI continues to recommend the Chieftain as a premier learning platform for shieldless cold-orbit Interceptor combat because of its agility, hardpoint layout, and relatively low cost.',
        checklist:['Purchase Alliance Chieftain.','Keep at least one rebuy untouched; two is better.'],
        link:{ label:'AXI Chieftain Doctrine', url:'https://wiki.antixenoinitiative.com/en/advanced-combat-guide', external:true },
      },
      {
        id:'chief-core', stage:'Platform', title:'Fit the core ship',
        objective:'Install Military Grade Composite, 6A Power Plant, 6A Thrusters, 5A FSD, 6A Power Distributor, and 4D Sensors.',
        why:'These are the core sizes used by the AXI Chieftain doctrine before engineering and optional refinements.',
        checklist:['Military Grade Composite.','6A Power Plant.','6A Thrusters.','5A Frame Shift Drive.','6A Power Distributor.','4D Sensors.'],
      },
      {
        id:'chief-engineer-dweller', stage:'Engineering', title:'Engineer power and heat control',
        objective:'Use The Dweller to engineer the 6A Power Distributor to Grade 5 Charge Enhanced + Super Conduits, and prepare a small Beam Laser with Long Range + Thermal Vent (Grade 3 is sufficient for this route).',
        why:'The distributor supports repeated weapon/boost use. Thermal Vent gives you a renewable way to pull heat down while maintaining contact with the Interceptor.',
        checklist:['Dweller unlocked.','6A distributor: G5 Charge Enhanced + Super Conduits.','Small beam: Long Range + Thermal Vent, at least G3.'],
        link:{ label:'AXI AX Engineering Guide', url:'https://wiki.antixenoinitiative.com/en/Unlocking-Engineers', external:true },
      },
      {
        id:'chief-engineer-palin', stage:'Engineering', title:'Build the movement you need',
        objective:'Engineer the 6A Thrusters to Grade 5 Dirty Drives + Drag Drives with Professor Palin.',
        why:'Speed and lateral authority are central to cold-orbit AX flying; this is one of the core engineering requirements in the AXI Chieftain doctrine.',
        checklist:['Professor Palin unlocked.','6A thrusters: G5 Dirty Drives + Drag Drives.'],
        link:{ label:'AXI AX Engineering Guide', url:'https://wiki.antixenoinitiative.com/en/Unlocking-Engineers', external:true },
      },
      {
        id:'chief-guardian-weapons', stage:'Guardian Tech', title:'Unlock Guardian Gauss',
        objective:'Obtain Guardian weapon blueprints/materials and unlock the Gauss Cannons needed for the Chieftain. Fit 2 × Class 2 Guardian Gauss and 2 × Class 1 Guardian Gauss.',
        why:'Guardian Gauss remains the standard precision weapon for learning Interceptor heart combat. AXI lists Synuefe GV-T b50-4 B 1 as a weapon-blueprint site.',
        checklist:['Guardian weapon blueprint(s) acquired.','Class 2 Guardian Gauss ×2 unlocked/fitted.','Class 1 Guardian Gauss ×2 unlocked/fitted.'],
        link:{ label:'AXI Guardian Unlock Guide', url:'https://wiki.antixenoinitiative.com/en/guardianunlocks', external:true },
      },
      {
        id:'chief-guardian-modules', stage:'Guardian Tech', title:'Add module protection',
        objective:'Unlock Guardian Module Reinforcement and fit the AXI doctrine stack: 5D, 2D, and 1D Guardian Module Reinforcement Packages.',
        why:'Interceptor damage can cripple critical modules. Layered module reinforcement is part of the proven shieldless Chieftain survival setup.',
        checklist:['Guardian module blueprint/materials acquired.','5D GMRP fitted.','2D GMRP fitted.','1D GMRP fitted.'],
        link:{ label:'AXI Guardian Unlock Guide', url:'https://wiki.antixenoinitiative.com/en/guardianunlocks', external:true },
      },
      {
        id:'chief-internals', stage:'Build', title:'Finish the survival package',
        objective:'Fit a 5D Repair Limpet Controller, 4E Cargo Rack, 2A AFMU, and 3 × 4D Hull Reinforcement Packages in the military slots.',
        why:'This gives you in-field hull repair, module repair, limpet storage, and the raw hull needed for shieldless AX combat.',
        checklist:['5D Repair Limpet Controller.','4E Cargo Rack.','2A AFMU.','4D HRP ×3 in military slots.','Load limpets before deployment.'],
      },
      {
        id:'chief-hardpoints-utils', stage:'Build', title:'Finish weapons and utilities',
        objective:'Fit the four Gauss Cannons, one Medium Remote Release Flak Launcher, the Thermal Vent Beam Laser, and at least 3 Heat Sink Launchers. Use the remaining utility for an Enhanced Xeno Scanner or a fourth heat sink.',
        why:'This completes the classic training layout: Gauss for hull/hearts, flak for swarms, beam/heatsinks for heat control, scanner if you want explicit heart targeting/status.',
        checklist:['2 × C2 Guardian Gauss.','2 × C1 Guardian Gauss.','1 × C2 Remote Release Flak.','1 × small Long Range/Thermal Vent Beam.','Heat Sink Launcher ×3 minimum.','Enhanced Xeno Scanner or fourth heat sink.'],
      },
      {
        id:'chief-controls', stage:'Cockpit', title:'Bind the AX controls',
        objective:'Before combat, bind Flight Assist toggle, Heat Sink, Boost, all pip controls, Target Ahead, fire-group cycling, and your Shutdown Field Neutralizer control if you later fit one.',
        why:'AX flying uses controls many normal PvE builds can ignore. Set them up before a Thargoid is shooting at you.',
        checklist:['Flight Assist toggle.','Heat Sink.','Boost.','SYS/ENG/WEP pip controls.','Target Ahead.','Fire-group cycle.'],
        link:{ label:'AXI Recommended Controls', url:'https://wiki.antixenoinitiative.com/en/recommended-controls', external:true },
      },
      {
        id:'chief-flight-drill', stage:'Training', title:'Cold-orbit flight drill',
        objective:'Spend at least 10 minutes practicing FA-off lateral orbiting around a station, nav target, or willing squadmate. Hold the target near your nose while your ship continues moving sideways around it.',
        why:'The real skill is decoupling where the ship is moving from where the weapons are pointing. Learn the geometry before adding Interceptor pressure.',
        checklist:['10 minutes FA-off orbit practice.','Use lateral/vertical thrusters instead of only nose-to-target flying.','Practice boosting without losing the orbit completely.'],
        link:{ label:'AXI Control / FA-Off Guidance', url:'https://wiki.antixenoinitiative.com/en/recommended-controls', external:true },
      },
      {
        id:'chief-gauss-drill', stage:'Training', title:'Gauss aim drill',
        objective:'Travel to Asterope, find Scout NHSS, and destroy at least 3 Scouts using your Guardian Gauss Cannons as the primary damage source.',
        why:'AXI notes Scouts are roughly heart-sized targets and useful Gauss practice. They are erratic, so this is deliberately an aim drill rather than the efficient way to farm Scouts.',
        checklist:['Travel to Asterope.','Find Scout NHSS.','Destroy at least 3 Scouts primarily with Gauss.','Return and repair/rearm.'],
        link:{ label:'AXI Finding Thargoids', url:'https://wiki.antixenoinitiative.com/en/finding-thargoids', external:true },
      },
      {
        id:'chief-first-heart', stage:'Interceptor', title:'First Interceptor objective — one heart',
        objective:'Find a solo Cyclops encounter. Exert and destroy one heart, then disengage and return alive. You are allowed to leave after the heart dies.',
        why:'Your first Interceptor assignment is deliberately not “kill it.” Learn the exert → exposed heart → destroy-heart cycle under real pressure, then prove you can disengage.',
        checklist:['Locate a solo Cyclops encounter.','Exert the first heart.','Destroy one heart.','Disengage and survive the return.'],
        link:{ label:'AXI Basic Interceptor Combat', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
      {
        id:'chief-cyclops-kill', stage:'Graduate', title:'Interceptor qualification — Cyclops',
        objective:'Return to a solo Cyclops and destroy the Interceptor. Survival and a complete kill are the objective; speed is irrelevant.',
        why:'This is the graduation task. Completing it means you have built the ship, unlocked the technology, practiced the flight model, learned the heart cycle, and finished a full Interceptor fight.',
        checklist:['Solo Cyclops engaged.','All hearts destroyed.','Cyclops destroyed.','Return alive and repair/rearm.'],
        link:{ label:'AXI Basic Interceptor Combat', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
    ],
  },
  {
    id:'ax-basilisk-hunter',
    band:'Developing / Experienced',
    title:'Interceptor Hunter — Basilisk',
    subtitle:'Move beyond first-kill fundamentals and prove you can manage a faster, less forgiving Interceptor.',
    audience:'For a CMDR who can already kill Cyclopes and needs a combat challenge that develops consistency, disengagement discipline, swarm control, and stronger Interceptor fundamentals.',
    outcome:'Graduate by demonstrating repeatable Cyclops competence, learning the Basilisk threat profile, and completing a full Basilisk kill.',
    sourceNote:'Interceptor behavior and combat references follow current AXI Interceptor, combat, and swarm guidance. The staged Mongrel challenge sequence is our own.',
    sources:[
      { label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide' },
      { label:'AXI Thargoid Specifications', url:'https://wiki.antixenoinitiative.com/en/thargoid-specs' },
      { label:'AXI Wing Combat', url:'https://wiki.antixenoinitiative.com/en/wing-combat' },
    ],
    tasks:[
      {
        id:'hunter-cyclops-repeat', stage:'Baseline', type:'demonstrate', title:'Prove the Cyclops is repeatable',
        objective:'Destroy two Cyclops Interceptors without a rebuy. Repairing and rearming between fights is allowed.',
        why:'The route starts by checking consistency rather than assuming one previous kill means the fundamentals are automatic.',
        checklist:['Two Cyclops kills completed.','No rebuy between the two kills.','You can explain what caused the most hull or module damage in each fight.'],
        link:{ label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
      {
        id:'hunter-basilisk-study', stage:'Threat Study', type:'learn', title:'Learn what changes with a Basilisk',
        objective:'Before engaging one, research the Basilisk enough to explain how its speed, heart count, swarm, and timing change your plan compared with a Cyclops.',
        why:'The assignment gives you the problem, not every answer. Knowing what is different before the fight is part of becoming an independent AX pilot.',
        checklist:['You can identify the major differences from a Cyclops.','You have a plan for disengaging from a faster target.','You know how you will handle the larger swarm.'],
        link:{ label:'AXI Thargoid Specifications', url:'https://wiki.antixenoinitiative.com/en/thargoid-specs', external:true },
      },
      {
        id:'hunter-basilisk-heart', stage:'First Contact', type:'demonstrate', title:'Take one Basilisk heart and leave',
        objective:'Engage a Basilisk, exert and destroy one heart, then disengage and return alive.',
        why:'Like the first Cyclops-heart exercise, this isolates the new threat level from the pressure to finish the entire kill.',
        checklist:['Basilisk engaged.','One heart destroyed.','Disengagement completed without rebuy.','Return and repair/rearm.'],
        link:{ label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
      {
        id:'hunter-swarm-control', stage:'Technique', type:'demonstrate', title:'Own the swarm instead of surviving it',
        objective:'In a Basilisk fight, deliberately engage the Thargon swarm with flak and reduce it enough that the swarm is no longer dictating the fight.',
        why:'Stronger Interceptors punish pilots who can only ignore or outrun the swarm. This task makes swarm management an intentional skill instead of an emergency reaction.',
        checklist:['Use Remote Release Flak intentionally.','Maintain enough distance and control to make multiple useful flak passes.','Return without a rebuy.'],
        link:{ label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
      {
        id:'hunter-basilisk-kill', stage:'Challenge', type:'challenge', title:'Destroy a Basilisk',
        objective:'Destroy a Basilisk from start to finish and return alive. Speed does not matter.',
        why:'This is the route’s main combat test: more speed, more hearts, more swarm pressure, and less room for sloppy disengagement.',
        checklist:['Basilisk destroyed.','No rebuy.','Return alive and repair/rearm.'],
        link:{ label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
      {
        id:'hunter-wing-interceptor', stage:'Wing', type:'wing', title:'Fight as part of an AX wing',
        objective:'Complete an Interceptor kill in a wing while communicating target state, positioning, and disengagement instead of simply adding damage.',
        why:'Wing AX introduces coordination and aggro complications. Learning to be predictable and useful to other pilots is a different skill from solo survival.',
        checklist:['Join at least one coordinated Interceptor fight.','Use voice/text comms or agreed calls.','Avoid disrupting another pilot’s orbit or escape line.','Complete the engagement with the wing.'],
        link:{ label:'AXI Wing Combat Guide', url:'https://wiki.antixenoinitiative.com/en/wing-combat', external:true },
      },
    ],
  },
  {
    id:'ax-guardian-specialist',
    band:'Developing / Experienced',
    title:'Guardian Systems — AX Specialist',
    subtitle:'Turn Guardian technology from a checklist unlock into knowledge you can apply across different AX builds and threats.',
    audience:'For a CMDR who already understands basic AX combat and wants broader Guardian-site, weapon, module, synthesis, and build-theory knowledge.',
    outcome:'Graduate by independently acquiring Guardian technology, building an alternate AX loadout around it, and proving you understand where Guardian equipment helps and where it creates new constraints.',
    sourceNote:'Guardian acquisition, material, build, and anti-Guardian references use current AXI guidance. The route intentionally leaves research and route-planning work to the Commander.',
    sources:[
      { label:'AXI Guardian Unlocks', url:'https://wiki.antixenoinitiative.com/en/guardianunlocks' },
      { label:'AXI Engineering Materials', url:'https://wiki.antixenoinitiative.com/en/engineering-materials' },
      { label:'AXI Recommended Builds', url:'https://wiki.antixenoinitiative.com/en/builds' },
      { label:'AXI Thargoid Special Attacks', url:'https://wiki.antixenoinitiative.com/en/special-attacks' },
    ],
    tasks:[
      {
        id:'guardian-site-independent', stage:'Guardian Fieldwork', type:'learn', title:'Run a Guardian site independently',
        objective:'Choose an appropriate Guardian site, travel there with the equipment you decide you need, and acquire at least one weapon or module blueprint plus useful Guardian materials.',
        why:'This deliberately does not give you a turn-by-turn site walkthrough. Planning the trip, understanding the site, and solving the material problem are part of the assignment.',
        checklist:['Choose the correct blueprint type for your goal.','Complete the site activity.','Leave with at least one blueprint fragment.','Collect additional Guardian materials you expect to use.'],
        link:{ label:'AXI Guardian Unlock Guide', url:'https://wiki.antixenoinitiative.com/en/guardianunlocks', external:true },
      },
      {
        id:'guardian-new-weapon', stage:'Unlock', type:'build', title:'Add another Guardian weapon family',
        objective:'Unlock and fit one Guardian weapon family you did not use for your first Interceptor qualification.',
        why:'A specialist should understand more than one answer to AX damage. The point is to learn the weapon’s handling, heat, distributor, convergence, range, and ammunition tradeoffs.',
        checklist:['Weapon unlocked.','Weapon fitted to a suitable AX ship.','You can explain why the ship/hardpoints suit that weapon.'],
        link:{ label:'AXI Recommended Builds', url:'https://wiki.antixenoinitiative.com/en/builds', external:true },
      },
      {
        id:'guardian-alt-build', stage:'Build Theory', type:'build', title:'Build an alternate AX loadout around it',
        objective:'Create a complete combat-ready AX loadout around the new Guardian weapon instead of simply swapping hardpoints onto your existing ship.',
        why:'Different weapons change heat, power, distributor demand, convergence, range, and sometimes whether flak or utility slots still make sense.',
        checklist:['Core and optional internals support the new weapon choice.','Power priorities are tested.','Heat and ammunition plan are understood.','You know what the build gives up compared with your normal AX ship.'],
        link:{ label:'AXI Ship Build Theory', url:'https://wiki.antixenoinitiative.com/en/shipbuildtheory', external:true },
      },
      {
        id:'guardian-combat-proof', stage:'Field Test', type:'demonstrate', title:'Prove the alternate build in combat',
        objective:'Use the alternate Guardian loadout to destroy a Cyclops or stronger Interceptor and return alive.',
        why:'A build is not understood until you have felt its compromises under pressure.',
        checklist:['Interceptor destroyed with the alternate build.','No rebuy.','Identify at least one strength and one weakness compared with your usual ship.'],
      },
      {
        id:'guardian-antiguardian-plan', stage:'Threat Study', type:'learn', title:'Prepare for anti-Guardian conditions',
        objective:'Research which Thargoid threats or environments can degrade unprotected Guardian equipment, then prepare a ship/loadout that can operate when normal Guardian assumptions are unsafe.',
        why:'Guardian knowledge includes knowing when not to rely on Guardian modules or weapons without the right preparation.',
        checklist:['Identify the anti-Guardian threat you are planning around.','Choose protected Guardian equipment or a human-AX alternative as appropriate.','Explain the tradeoff in your chosen solution.'],
        link:{ label:'AXI Thargoid Special Attacks', url:'https://wiki.antixenoinitiative.com/en/special-attacks', external:true },
      },
      {
        id:'guardian-specialist-challenge', stage:'Challenge', type:'challenge', title:'Complete an AX fight outside your default comfort build',
        objective:'Complete a meaningful AX engagement using the Guardian-specialist or anti-Guardian-capable loadout you developed in this route.',
        why:'The goal is adaptable knowledge: selecting technology for the situation instead of flying one memorized build everywhere.',
        checklist:['Use the specialist loadout in real AX combat.','Complete the engagement objective.','Return alive.','Be able to explain why that loadout was appropriate.'],
      },
    ],
  },
  {
    id:'ax-hellhound-development',
    band:'Veteran / Mentor',
    title:'Hellhound Development — Hunt, Lead, Teach',
    subtitle:'Advanced AX challenges for pilots who already own the ships and knowledge — now prove mastery by hunting harder targets and creating stronger Mongrels.',
    audience:'For veteran AX pilots who do not need another beginner build checklist. These assignments emphasize advanced combat, wing responsibility, judgment, and teaching.',
    outcome:'Complete the route by demonstrating advanced combat, contributing to coordinated AX operations, and successfully helping less-experienced Mongrels grow. Completion does not automatically grant any squad role or title.',
    sourceNote:'Advanced Interceptor, wing, and AXCZ mechanics reference current AXI guidance. The leadership and mentoring standards are Mongrel development objectives rather than AXI ranks.',
    sources:[
      { label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide' },
      { label:'AXI Wing Combat', url:'https://wiki.antixenoinitiative.com/en/wing-combat' },
      { label:'AXI Conflict Zones', url:'https://wiki.antixenoinitiative.com/en/conflict-zones' },
      { label:'AXI Thargoid Specifications', url:'https://wiki.antixenoinitiative.com/en/thargoid-specs' },
    ],
    tasks:[
      {
        id:'hellhound-medusa', stage:'Hunt', type:'challenge', title:'Kill a Medusa',
        objective:'Destroy a Medusa and return alive. Solo is the standard for this challenge; if this is already routine for you, use “Already Know / Have This” and keep moving.',
        why:'A veteran route should test actual Interceptor mastery rather than ask you to rebuild equipment you already own.',
        checklist:['Medusa destroyed.','No rebuy.','Return alive and repair/rearm.'],
        link:{ label:'AXI Basic Combat Guide', url:'https://wiki.antixenoinitiative.com/en/basic-combat-guide', external:true },
      },
      {
        id:'hellhound-axcz-wing', stage:'Operations', type:'wing', title:'Clear an AX conflict zone in a wing',
        objective:'When an appropriate AX conflict zone is available, join a Mongrel or allied wing and help clear the zone from start to completion.',
        why:'AXCZs combine Scouts, Interceptors, NPC traffic, shifting aggro, and wing coordination. Success requires situational awareness beyond a clean isolated duel.',
        checklist:['Enter as part of a coordinated wing.','Stay through the full zone objective unless survival requires disengagement.','Contribute to Scout/Interceptor control as needed.','Complete the zone with the wing.'],
        link:{ label:'AXI Conflict Zone Guide', url:'https://wiki.antixenoinitiative.com/en/conflict-zones', external:true },
      },
      {
        id:'hellhound-wing-lead', stage:'Lead', type:'wing', title:'Lead an Interceptor engagement',
        objective:'Lead at least one AX wing engagement. Set the target, establish the plan, communicate important changes, and make the disengage/repair call when needed.',
        why:'Leadership is not having the highest DPS. It is keeping several pilots working toward the same fight while preserving their ability to recover from mistakes.',
        checklist:['Brief the wing before contact.','Keep calls concise during the fight.','Adapt when aggro/positioning changes.','Get the wing through the engagement.'],
        link:{ label:'AXI Wing Combat Guide', url:'https://wiki.antixenoinitiative.com/en/wing-combat', external:true },
      },
      {
        id:'hellhound-first-interceptor-mentor', stage:'Teach', type:'mentor', title:'Help a Mongrel through their first Interceptor',
        objective:'Take a less-experienced Mongrel into their first Interceptor fight and help them personally complete the heart cycle and earn meaningful progress toward the kill.',
        why:'Do not carry the learner. The objective is for them to understand what happened and leave more capable than when they entered the instance.',
        checklist:['Learner participates directly in the Interceptor mechanics.','Explain only what they need when they need it.','Let them make recoverable mistakes.','Debrief the fight afterward.'],
      },
      {
        id:'hellhound-build-review', stage:'Teach', type:'mentor', title:'Review another pilot’s AX build',
        objective:'Review a Mongrel’s AX ship and explain at least three meaningful choices or tradeoffs instead of simply handing them a replacement build.',
        why:'Future Hellhounds should create independent pilots. Teaching why a build works is more valuable than copying a module list.',
        checklist:['Identify the ship’s intended AX role.','Explain at least three module/engineering tradeoffs.','Give the pilot one or two prioritized changes rather than rebuilding everything for them.'],
        link:{ label:'AXI Ship Build Theory', url:'https://wiki.antixenoinitiative.com/en/shipbuildtheory', external:true },
      },
      {
        id:'hellhound-hydra-wing', stage:'Challenge', type:'wing', title:'Contribute to a Hydra kill',
        objective:'Join a coordinated wing or AXCZ engagement and make a meaningful contribution to destroying a Hydra.',
        why:'This is a high-pressure team challenge. The standard is not merely being present; you should be able to explain the role you played and the decisions you made.',
        checklist:['Hydra destroyed.','You contributed intentionally to damage, swarm control, aggro management, support, or another agreed role.','Survive the engagement if reasonably possible.'],
        link:{ label:'AXI Wing Combat Guide', url:'https://wiki.antixenoinitiative.com/en/wing-combat', external:true },
      },
      {
        id:'hellhound-teachback', stage:'Mentor', type:'mentor', title:'Teach one advanced AX skill until it sticks',
        objective:'Choose one advanced concept — cold orbiting, heat/aggro control, flak technique, repair discipline, heart timing, or another comparable skill — and coach another Mongrel until they can demonstrate it themselves.',
        why:'The capstone is knowledge transfer. A strong AX community grows when veterans can turn personal skill into repeatable squad capability.',
        checklist:['Choose one specific advanced skill.','Explain the concept in practical terms.','Observe the learner attempt it.','Give corrective feedback.','Learner demonstrates clear improvement or successful execution.'],
      },
    ],
  },
];

export function eligibleAxRoutes(experience = 'new') {
  if (experience === 'experienced') {
    return ['ax-hellhound-development','ax-guardian-specialist','ax-basilisk-hunter'];
  }
  if (experience === 'comfortable') {
    return ['ax-basilisk-hunter','ax-guardian-specialist','ax-hellhound-development'];
  }
  if (experience === 'some') {
    return ['ax-chieftain-academy','ax-basilisk-hunter','ax-guardian-specialist'];
  }
  return ['ax-scout-vulture','ax-chieftain-academy'];
}

export function getAxRoute(id) {
  return AX_ROUTES.find(route => route.id === id) || null;
}
