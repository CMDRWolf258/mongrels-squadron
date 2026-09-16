export const AX_ACTIVITY_ID = 'ax';

export const AX_ROUTES = [
  {
    id:'ax-scout-vulture',
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
];

export function eligibleAxRoutes(experience = 'new') {
  if (experience === 'experienced' || experience === 'comfortable') {
    return ['ax-chieftain-academy','ax-scout-vulture'];
  }
  if (experience === 'some') {
    return ['ax-chieftain-academy','ax-scout-vulture'];
  }
  return ['ax-scout-vulture','ax-chieftain-academy'];
}

export function getAxRoute(id) {
  return AX_ROUTES.find(route => route.id === id) || null;
}
