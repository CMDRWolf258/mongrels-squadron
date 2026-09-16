export const MINING_ACTIVITY_ID = 'mining';

const MINING_MANUAL = '/guides/mining/';
const MINING_REFERENCE = '/guides/reference/?category=Mining';
const CARRIERS = '/carriers/';
const PROJECTS = '/projects/';

export const MINING_ROUTES = [
  {
    id:'mining-laser-foundations',
    band:'Beginner',
    title:'Mining Foundations — First Full Loop',
    subtitle:'Build a practical laser miner, find a viable ring, extract efficiently enough to finish the session, and sell the cargo intelligently.',
    audience:'For a Commander who is new to deliberate mining or has mined before without understanding why the ship, prospectors, collectors, refinery, positioning, and market choice matter.',
    outcome:'Graduate by completing a full prospect-to-sell laser-mining loop in a ship you understand well enough to repeat without a step-by-step walkthrough.',
    sourceNote:'This route follows the Mongrel Mining Field Manual. It emphasizes learning the full loop rather than prescribing one mandatory hull or profit target.',
    sources:[
      { label:'Mongrel Mining Field Manual', url:MINING_MANUAL },
      { label:'Mining Reference Database', url:MINING_REFERENCE },
    ],
    tasks:[
      {
        id:'mining-foundations-methods', stage:'Learn', type:'learn', title:'Know which mining method you are preparing for',
        objective:'Explain the practical difference between laser, core, subsurface, asteroid-surface-deposit, and Rhino surface mining. Choose laser mining for this route and identify the tools that belong to it.',
        why:'Mining is several different activities. Outfitting before choosing the method is how Commanders end up carrying tools that cannot solve the job they actually intended to do.',
        checklist:['You can distinguish all five current methods.','You selected laser mining for this route.','You can identify the core laser-mining tools without copying a complete build.'],
        link:{ label:'Choose a Mining Method', url:'/guides/mining/#choose-method' },
      },
      {
        id:'mining-foundations-build', stage:'Build', type:'build', title:'Build a complete laser-mining ship',
        objective:'Outfit a rebuy-safe ship with mining lasers, an A-rated Prospector Limpet Controller, Collector Limpet Controllers, a refinery, cargo space, and a Detailed Surface Scanner. Make sure the power distributor can sustain the lasers you fitted.',
        why:'The best beginner miner is not the ship with the most lasers or cargo. It is the ship whose prospecting, laser time, collection, refinery, and cargo flow can all keep up with one another.',
        checklist:['Mining lasers fitted.','A-rated Prospector fitted.','Collectors fitted.','Refinery fitted.','Cargo space available.','DSS fitted.','Distributor can sustain a useful laser cycle.','At least one rebuy remains after outfitting.'],
        link:{ label:'Open Mining Outfitting Guide', url:'/guides/mining/#outfitting' },
      },
      {
        id:'mining-foundations-limpets', stage:'Prepare', type:'demonstrate', title:'Leave with enough limpets',
        objective:'Load a generous supply of limpets before the session and explain why carrying a few too many is usually better than ending the run because you ran out.',
        why:'Limpets are cheap and discarded limpets can make room for valuable cargo. Running out of prospectors or collectors can end the productive part of the session immediately.',
        checklist:['Prospector/collector limpets loaded.','You know how to jettison excess limpets if cargo fills.','You understand why collector limpets should normally be launched without a collectible targeted.'],
        link:{ label:'Open Mining Outfitting Guide', url:'/guides/mining/#outfitting' },
      },
      {
        id:'mining-foundations-find-ring', stage:'Deploy', type:'demonstrate', title:'Find your own viable mining area',
        objective:'Choose a commodity, use the DSS on an appropriate ring, and enter a relevant hotspot or known mining area without being given a turn-by-turn route.',
        why:'Knowing how to acquire the site is part of being self-sufficient. A saved bookmark is useful, but a miner should also understand how hotspot selection works.',
        checklist:['Commodity chosen.','Ring mapped with DSS.','Relevant hotspot or mining area selected.','You can explain why a hotspot improves probability rather than guaranteeing good rocks.'],
        link:{ label:'Open Laser Mining Workflow', url:'/guides/mining/#laser' },
      },
      {
        id:'mining-foundations-prospect', stage:'Technique', type:'demonstrate', title:'Prospect before committing lasers',
        objective:'Prospect candidate asteroids with the A-rated controller and reject poor targets instead of lasering every rock you encounter.',
        why:'Prospecting is the decision point. It reveals contents and materially improves laser yield while the prospector remains attached and targeted.',
        checklist:['A-rated prospector used.','Asteroid contents checked before mining.','At least several poor candidates intentionally rejected.'],
        link:{ label:'Open Laser Mining Workflow', url:'/guides/mining/#laser' },
      },
      {
        id:'mining-foundations-geometry', stage:'Technique', type:'demonstrate', title:'Make the collectors travel less',
        objective:'Mine several asteroids while deliberately positioning the ship close enough that fragments leave the rock toward the cargo hatch/collector area. Adjust your position if collectors are making long loops.',
        why:'Collection travel is often a larger bottleneck than raw laser damage. Good geometry increases throughput without adding another module.',
        checklist:['Ship positioned close to the working face.','Collectors spend less time on long travel arcs.','You can recognize when collection, not lasers, is the bottleneck.'],
        link:{ label:'Open Laser Mining Workflow', url:'/guides/mining/#laser' },
      },
      {
        id:'mining-foundations-sell', stage:'Sell', type:'demonstrate', title:'Sell with demand in mind',
        objective:'Before leaving the ring, choose a buyer by checking current price, demand, and travel distance. Sell the cargo and note whether the extra travel was actually worth it.',
        why:'The highest headline price is not automatically the best end-to-end result. Demand, distance, pad access, and turnaround time are part of the mining loop.',
        checklist:['Buyer checked before travel.','Demand considered, not only price.','Cargo sold successfully.','You can state one tradeoff that affected the sale choice.'],
        link:{ label:'Open Selling Guide', url:'/guides/mining/#selling' },
      },
      {
        id:'mining-foundations-graduate', stage:'Graduate', type:'challenge', title:'Repeat the entire loop without the checklist',
        objective:'Complete another laser-mining session from preparation through sale without following this route step-by-step. Choose the site, prospect, mine, manage limpets/refinery/cargo, select the buyer, and finish the sale yourself.',
        why:'Graduation means the process is yours now. Profit per hour is not the test; independent execution is.',
        checklist:['Ship prepared independently.','Site chosen independently.','Mining loop completed.','Cargo sold.','No essential tool or supply was forgotten.'],
        link:{ label:'Open Mining Field Manual', url:MINING_MANUAL },
      },
    ],
  },
  {
    id:'mining-efficient-operator',
    band:'Developing',
    title:'Efficient Miner — Find the Bottleneck',
    subtitle:'Stop measuring success by cargo alone. Improve prospecting discipline, collector geometry, laser uptime, navigation, and the complete mine-to-sell cycle.',
    audience:'For a Commander who can already mine successfully and wants to become faster, more deliberate, and more repeatable.',
    outcome:'Graduate by measuring a real mining loop, identifying its bottleneck, changing the ship or technique, and demonstrating a meaningful improvement.',
    sourceNote:'This route uses the Field Manual operator standard: measure the whole loop, not a single rich rock or a single high sale price.',
    sources:[
      { label:'Mining Outfitting', url:'/guides/mining/#outfitting' },
      { label:'Laser Mining Workflow', url:'/guides/mining/#laser' },
      { label:'Selling', url:'/guides/mining/#selling' },
    ],
    tasks:[
      {
        id:'mining-efficient-baseline', stage:'Baseline', type:'demonstrate', title:'Time one honest mining loop',
        objective:'Run one normal mining session and record at least travel-to-site time, active mining time, cargo collected, travel-to-buyer time, and sale value. Do not optimize the run while measuring it.',
        why:'You cannot improve a bottleneck you have not measured. A baseline turns “this feels slow” into something you can actually change.',
        checklist:['Travel time recorded.','Mining time recorded.','Cargo tonnes recorded.','Sell travel recorded.','Sale value recorded.'],
      },
      {
        id:'mining-efficient-bottleneck', stage:'Diagnosis', type:'challenge', title:'Name the actual bottleneck',
        objective:'Review the baseline and decide whether the dominant limiter was finding good rocks, laser/distributor uptime, collector travel, refinery/cargo management, travel, or market choice. Defend the diagnosis with observations.',
        why:'Adding cargo or another laser is useless when the real delay is collection geometry or prospecting dead time.',
        checklist:['One primary bottleneck identified.','Evidence from the run cited.','At least one tempting but lower-priority change rejected.'],
        link:{ label:'Open Mining Outfitting Guide', url:'/guides/mining/#outfitting' },
      },
      {
        id:'mining-efficient-prospecting', stage:'Technique', type:'demonstrate', title:'Mine only rocks that meet your rule',
        objective:'Choose a simple acceptance rule for your target commodity and complete a session where you intentionally reject rocks below that rule instead of mining everything.',
        why:'Prospecting discipline trades a little search time for less time spent draining low-value asteroids.',
        checklist:['Acceptance rule chosen before the run.','Poor targets skipped consistently.','You can explain whether the stricter rule improved or hurt the overall loop.'],
      },
      {
        id:'mining-efficient-collection', stage:'Technique', type:'demonstrate', title:'Tune collector count and geometry',
        objective:'Adjust collector count and ship positioning until fragments are usually cleared without long collector queues after an asteroid depletes.',
        why:'The useful collector count depends on ship geometry, mining rate, fragment path, and controller layout; there is no universal magic number.',
        checklist:['Collector behavior observed.','Positioning adjusted deliberately.','Controller count changed only if observation justified it.','Post-depletion cleanup delay reduced or understood.'],
      },
      {
        id:'mining-efficient-distributor', stage:'Build', type:'build', title:'Match lasers to the distributor',
        objective:'Verify whether your distributor can sustain the mining lasers through a useful asteroid cycle. If weapon energy repeatedly forces long laser downtime, change pips, engineering, or laser count instead of assuming more lasers are always better.',
        why:'Unused hardpoints do not reduce throughput; lasers sitting offline waiting for WEP do.',
        checklist:['Laser uptime observed.','Four-pip WEP behavior tested.','Build changed if distributor was the limiter.'],
        link:{ label:'Open Mining Outfitting Guide', url:'/guides/mining/#outfitting' },
      },
      {
        id:'mining-efficient-navigation', stage:'Technique', type:'demonstrate', title:'Stop circling depleted rocks',
        objective:'Use a fixed reference such as the planet, hotspot marker, or another reliable landmark to maintain one deliberate direction through the field for an entire session.',
        why:'Re-prospecting your own depleted area is invisible wasted time.',
        checklist:['Reference selected before mining.','Direction maintained.','No obvious return to already-worked rocks.'],
      },
      {
        id:'mining-efficient-market', stage:'Sell', type:'challenge', title:'Compare two plausible buyers',
        objective:'For one load, compare at least two realistic sell options using price, demand, pad access, and travel time. Choose one and explain why it is better for the whole loop rather than only the unit price.',
        why:'Mining efficiency ends at the sale terminal, not when the cargo hold fills.',
        checklist:['At least two buyers compared.','Demand checked.','Travel/pad constraints considered.','Final choice justified.'],
        link:{ label:'Open Selling Guide', url:'/guides/mining/#selling' },
      },
      {
        id:'mining-efficient-rerun', stage:'Challenge', type:'challenge', title:'Re-run the loop after one deliberate change',
        objective:'Repeat a comparable session after changing the bottleneck you identified. Compare the result with your baseline and decide whether to keep, revert, or further refine the change.',
        why:'Optimization should be evidence-driven. One measured improvement teaches more than endlessly changing a build because a spreadsheet says it should be faster.',
        checklist:['Comparable second run completed.','At least one metric compared with baseline.','Change kept/reverted/refined based on evidence.'],
      },
    ],
  },
  {
    id:'mining-advanced-extraction',
    band:'Developing / Experienced',
    title:'Advanced Extraction — Core, Subsurface & Surface Deposits',
    subtitle:'Learn the advanced asteroid tools by finding the targets yourself and completing each extraction method correctly.',
    audience:'For miners who already understand cargo, collectors, prospectors, and selling but want competence beyond laser mining.',
    outcome:'Graduate by independently finding and extracting a core, a subsurface deposit, and an asteroid surface deposit, then completing a mixed advanced-mining session.',
    sourceNote:'This route follows the Field Manual’s current advanced-mining workflow. It deliberately does not provide a guaranteed motherlode location; target identification is part of the skill.',
    sources:[
      { label:'Advanced Asteroid Mining', url:'/guides/mining/#core' },
      { label:'Mining Reference Database', url:MINING_REFERENCE },
    ],
    tasks:[
      {
        id:'mining-advanced-tools', stage:'Build', type:'build', title:'Build a complete advanced-mining toolset',
        objective:'Prepare a ship with a Pulse Wave Analyser, A-rated prospector, collectors, refinery, Seismic Charge Launcher, Abrasion Blaster, and Sub-surface Displacement Missile. Keep enough cargo and shields/survivability for the session.',
        why:'Advanced deposits are different opportunities on the same candidate asteroid. Bringing the complete toolset lets you exploit what the prospector actually finds.',
        checklist:['PWA fitted.','A-rated prospector fitted.','Collectors/refinery fitted.','Seismic charges fitted.','Abrasion Blaster fitted.','Sub-surface missile fitted.'],
        link:{ label:'Open Advanced Mining Guide', url:'/guides/mining/#core' },
      },
      {
        id:'mining-advanced-pwa', stage:'Technique', type:'demonstrate', title:'Use the PWA as a candidate finder, not an answer',
        objective:'Use the Pulse Wave Analyser to locate candidate asteroids, then confirm them with prospectors. Intentionally reject at least several glowing rocks that do not contain the feature or commodity you want.',
        why:'PWA glow means advanced-mining features may be present. It does not identify the exact deposit or commodity for you.',
        checklist:['PWA used to locate candidates.','Prospector used for confirmation.','False/poor candidates rejected.'],
      },
      {
        id:'mining-advanced-core', stage:'Core', type:'demonstrate', title:'Crack a motherlode cleanly',
        objective:'Find a core asteroid, place Seismic Charges into fissures until the meter reaches the optimal blue zone, get clear before detonation, then collect the exposed material.',
        why:'Core mining combines target identification, charge strength, timing, and safety. The goal is a controlled detonation, not simply making the rock explode.',
        checklist:['Motherlode confirmed with prospector.','Charges placed deliberately.','Optimal charge zone achieved.','Ship moved clear before detonation.','Interior material collected.'],
        link:{ label:'Open Core Mining Guide', url:'/guides/mining/#core' },
      },
      {
        id:'mining-advanced-abrasion', stage:'Surface Deposits', type:'demonstrate', title:'Harvest asteroid surface deposits',
        objective:'Use the Abrasion Blaster to remove exposed surface deposits from an advanced-mining asteroid and collect the fragments.',
        why:'Surface deposits are easy to ignore after the dramatic part of a core break, but they are part of completing the extraction properly.',
        checklist:['Surface deposit targeted.','Abrasion Blaster used successfully.','Released material collected.'],
      },
      {
        id:'mining-advanced-subsurface', stage:'Subsurface', type:'demonstrate', title:'Extract a subsurface deposit',
        objective:'Find a prospected asteroid with a subsurface deposit and successfully release material using the Sub-surface Displacement Missile timing window.',
        why:'Subsurface mining tests a different timing skill from seismic charges and adds another way to capitalize on advanced-mining candidates.',
        checklist:['Subsurface deposit identified.','Missile attached successfully.','Release timing hit.','Material collected.'],
      },
      {
        id:'mining-advanced-mixed-run', stage:'Challenge', type:'challenge', title:'Run a mixed advanced-mining session',
        objective:'Complete one session where you use at least two advanced extraction tools based on what the rocks actually present, then sell the resulting cargo intelligently.',
        why:'Specialists should choose tools from the deposit, not force every asteroid into the same method.',
        checklist:['At least two advanced extraction methods used.','Cargo managed successfully.','Buyer chosen with demand/travel in mind.','Sale completed.'],
      },
    ],
  },
  {
    id:'mining-rhino-field',
    band:'Developing / Experienced',
    title:'Rhino Field Operations — Deploy, Parallelize, Recover',
    subtitle:'Learn the complete planetary mining loop and prove you can evaluate a repeatable surface site rather than merely finding one deposit.',
    audience:'For miners ready to use the Rhino surface-mining system, including Commanders who are strong asteroid miners but new to planetary rigs.',
    outcome:'Graduate by independently finding a Planetary Mining Location, operating several rigs in parallel, recovering them safely, transferring/refining cargo, and documenting a repeatable site.',
    sourceNote:'Rhino surface mining launched in September 2026 and remains a living system. Use current Field Manual facts, but treat precise efficiency formulas as field observations until Frontier or repeatable testing verifies them.',
    sources:[
      { label:'Rhino Surface Mining Guide', url:'/guides/mining/#rhino' },
      { label:'Mining Rig Operations', url:'/guides/mining/#rigs' },
      { label:'Surface Site Scouting', url:'/guides/mining/#scouting' },
    ],
    tasks:[
      {
        id:'mining-rhino-platform', stage:'Build', type:'build', title:'Prepare a Rhino-capable carrier ship',
        objective:'Prepare a ship capable of carrying and deploying the Rhino with the required Large Planetary Vehicle Hangar and the tools needed to locate eligible surface mining sites, including a DSS.',
        why:'Rhino mining begins with the carrier ship. The surface vehicle cannot solve a missing hangar or unmapped body after arrival.',
        checklist:['Rhino available.','Large Planetary Vehicle Hangar fitted.','DSS fitted.','Carrier ship has enough cargo/logistics capacity for the intended run.'],
        link:{ label:'Open Rhino Guide', url:'/guides/mining/#rhino' },
      },
      {
        id:'mining-rhino-find-location', stage:'Deploy', type:'demonstrate', title:'Find a Planetary Mining Location yourself',
        objective:'Use the DSS on an eligible landable body, identify a Planetary Mining Location containing a commodity you want, and travel to it without relying on a supplied coordinate.',
        why:'Saved sites are useful, but a Rhino operator should understand how new mining locations are acquired in the first place.',
        checklist:['Body mapped with DSS.','Planetary Mining Location identified.','Commodity/location chosen deliberately.','Site reached.'],
      },
      {
        id:'mining-rhino-scanner', stage:'Technique', type:'demonstrate', title:'Use the Planetary Mineral Scanner',
        objective:'Inside the mining location, use the Rhino scanner to reveal deposits and valid rig-placement footprints. Compare at least several deposits before committing the full rig inventory.',
        why:'A deposit can be rich but operationally poor if terrain or valid placement capacity prevents several rigs from working efficiently.',
        checklist:['Deposits scanned.','Placement footprints recognized.','Terrain considered.','Multiple candidate deposits compared.'],
        link:{ label:'Open Rhino Guide', url:'/guides/mining/#rhino' },
      },
      {
        id:'mining-rhino-parallel', stage:'Operations', type:'demonstrate', title:'Keep multiple rigs working in parallel',
        objective:'Deploy and manage at least four rigs simultaneously while continuing to scout or service other deposits instead of waiting beside one extractor.',
        why:'Rhino throughput comes from parallel extraction. Watching one rig finish wastes the system’s main advantage.',
        checklist:['At least four rigs active simultaneously.','Contacts panel used to monitor status.','You continued useful work while rigs extracted.'],
        link:{ label:'Open Rig Operations', url:'/guides/mining/#rigs' },
      },
      {
        id:'mining-rhino-six-rig', stage:'Challenge', type:'challenge', title:'Find or use a full six-rig deployment',
        objective:'Locate a deposit cluster or site that allows all six rigs to work usefully at once. If terrain or deposit spacing prevents six at your first site, keep scouting until you can demonstrate a full deployment.',
        why:'Six-rig sites are especially valuable because they let the Rhino use its complete current rig inventory in parallel.',
        checklist:['Six rigs deployed successfully.','All six have useful extraction assignments.','Terrain/spacing allows practical collection and recovery.'],
        link:{ label:'Open Rig Operations', url:'/guides/mining/#rigs' },
      },
      {
        id:'mining-rhino-collect-recover', stage:'Recovery', type:'demonstrate', title:'Collect output and recover every rig',
        objective:'Collect completed output into the Rhino refinery/cargo flow, recover every deployed rig, and transfer the cargo back to the carrier ship before leaving the instance.',
        why:'A productive run is not complete if reusable equipment is abandoned or refined cargo is stranded in the vehicle.',
        checklist:['Completed output collected.','Rhino refinery/cargo managed.','Every deployed rig recovered.','Cargo transferred to ship.','No rig intentionally abandoned.'],
        link:{ label:'Open Rig Operations', url:'/guides/mining/#rigs' },
      },
      {
        id:'mining-rhino-document', stage:'Scouting', type:'demonstrate', title:'Document a repeatable surface site',
        objective:'Record enough information for another Mongrel to return to the useful deposit cluster: body, mining-location/signal identifier, commodity, coordinates, rig capacity, terrain notes, and any meaningful travel/recovery concerns.',
        why:'A good site becomes squad knowledge only when another Commander can reproduce it.',
        checklist:['Body/location recorded.','Commodity recorded.','Coordinates recorded.','Useful simultaneous rig count recorded.','Terrain/recovery notes recorded.'],
        link:{ label:'Open Site Scouting Guide', url:'/guides/mining/#scouting' },
      },
      {
        id:'mining-rhino-graduate', stage:'Graduate', type:'challenge', title:'Complete an independent Rhino production loop',
        objective:'Choose a commodity and planetary mining location, deploy the Rhino, operate the rigs, collect/recover everything, transfer cargo, and finish the sell or squad-delivery step without following this route in sequence.',
        why:'The qualification is complete field independence, not merely knowing how to place a rig.',
        checklist:['Site chosen independently.','Rig operation completed.','All rigs recovered.','Cargo transferred.','Cargo sold or delivered to a real squad/logistics need.'],
      },
    ],
  },
  {
    id:'mining-specialist',
    band:'Experienced',
    title:'Mining Specialist — Scout, Compare, Support',
    subtitle:'Use mining knowledge as an operational capability: compare methods, validate sites, benchmark routes, and support larger squad logistics instead of simply filling your own hold.',
    audience:'For experienced miners who already own capable ships and want assignments that test judgment, field evaluation, adaptability, and logistics usefulness.',
    outcome:'Graduate by proving competence across more than one method, producing a useful site/route evaluation, and completing a mining objective tied to a larger operational need.',
    sourceNote:'This route emphasizes the Field Manual operator standard that repeatability and the complete logistics loop matter more than a single impressive yield.',
    sources:[
      { label:'Mining Field Manual', url:MINING_MANUAL },
      { label:'Surface Site Scouting', url:'/guides/mining/#scouting' },
      { label:'Carrier Coordination', url:CARRIERS },
    ],
    tasks:[
      {
        id:'mining-specialist-two-methods', stage:'Breadth', type:'challenge', title:'Complete productive runs with two different methods',
        objective:'Complete two mining sessions using different extraction methods and explain what made each method suitable for its commodity/site rather than treating one method as universally best.',
        why:'Experienced miners should select methods from the objective and geology, not from habit.',
        checklist:['Two distinct methods completed.','Both sessions reached a sale/delivery endpoint.','Method choice justified for each.'],
      },
      {
        id:'mining-specialist-build-review', stage:'Build', type:'demonstrate', title:'Audit one of your own mining builds',
        objective:'Review a miner you actually use and identify the intended role, the likely throughput bottleneck, and at least three deliberate module tradeoffs. Change only what the role or evidence justifies.',
        why:'A specialist should understand why the build looks the way it does, not merely copy a famous layout.',
        checklist:['Role stated clearly.','Likely bottleneck identified.','At least three tradeoffs explained.','Any change tied to a real need.'],
      },
      {
        id:'mining-specialist-site-compare', stage:'Scouting', type:'challenge', title:'Compare two sites for the same objective',
        objective:'Evaluate two plausible mining sites for the same commodity or squad need. Compare travel, extraction density/quality, terrain or ring efficiency, sell/delivery distance, and repeatability before choosing the better operational site.',
        why:'The richest individual deposit can lose to the site with better access, geometry, rig capacity, or logistics.',
        checklist:['Two sites tested or credibly evaluated.','Same objective used for both.','Whole-loop tradeoffs compared.','Preferred site selected with reasons.'],
        link:{ label:'Open Site Scouting Guide', url:'/guides/mining/#scouting' },
      },
      {
        id:'mining-specialist-route-benchmark', stage:'Benchmark', type:'challenge', title:'Benchmark a repeatable route',
        objective:'Run the same mining route at least twice and record enough data to estimate typical rather than best-case performance. Include extraction time, cargo, travel, and delivery/sale outcome.',
        why:'A route that only looks good on one lucky run is not reliable operational knowledge.',
        checklist:['Route repeated at least twice.','Comparable measurements captured.','Typical result separated from best result.','Main source of variance identified.'],
      },
      {
        id:'mining-specialist-live-need', stage:'Operations', type:'wing', title:'Mine for a real squad need',
        objective:'Use Mining, Projects, Carrier Coordination, or current squad tasking to identify a real commodity/logistics need and contribute mined cargo to it. If no live need exists, plan a realistic support run and explain the logistics chain.',
        why:'Mining becomes strategically valuable when extraction is connected to construction, carrier support, markets, or another actual objective.',
        checklist:['Need identified from an authoritative squad source or realistic plan.','Commodity/method chosen to match the need.','Cargo delivered or full logistics plan completed.'],
        link:{ label:'Open Projects', url:PROJECTS },
      },
      {
        id:'mining-specialist-market-risk', stage:'Logistics', type:'demonstrate', title:'Protect a large load from a bad sale',
        objective:'Before moving a substantial mining load, verify demand, price, travel, pad access, and whether splitting or redirecting the cargo would produce a better outcome.',
        why:'Experienced extraction can still be wasted by a careless last leg.',
        checklist:['Demand verified before departure.','Pad/travel constraints checked.','Alternate buyer or delivery considered.','Large load sold/delivered intentionally.'],
        link:{ label:'Open Selling Guide', url:'/guides/mining/#selling' },
      },
      {
        id:'mining-specialist-adapt', stage:'Challenge', type:'challenge', title:'Adapt when the preferred site or market stops being good',
        objective:'When a normal site, market, or method is unavailable or underperforming, choose a credible alternative without waiting for someone else to give you a replacement route.',
        why:'Specialist competence includes recovery from changing demand, poor spawns, terrain, travel constraints, or operational priorities.',
        checklist:['Problem identified correctly.','Alternative selected from evidence.','New plan completed or tested.','Reason for the adaptation documented.'],
      },
    ],
  },
  {
    id:'mining-lead-mentor',
    band:'Veteran / Mentor',
    title:'Mining Lead — Survey, Coordinate, Teach',
    subtitle:'Turn personal extraction skill into repeatable squad capability through scouting, operation design, logistics coordination, diagnosis, and teaching.',
    audience:'For veteran miners who do not need another basic outfitting checklist and want challenges that create useful knowledge and stronger Mongrel miners.',
    outcome:'Complete the route by leading a real mining/logistics objective, publishing reusable field knowledge, and helping another Commander become more independent.',
    sourceNote:'This is a Mongrel development route, not an automatic squad rank or title. Veteran work is measured by operational judgment and knowledge transfer, not only tonnes mined.',
    sources:[
      { label:'Mining Field Manual', url:MINING_MANUAL },
      { label:'Surface Site Scouting', url:'/guides/mining/#scouting' },
      { label:'Carrier Coordination', url:CARRIERS },
      { label:'Projects & Events', url:PROJECTS },
    ],
    tasks:[
      {
        id:'mining-lead-site-dossier', stage:'Survey', type:'challenge', title:'Publish a site dossier another miner can actually use',
        objective:'Scout and document one worthwhile mining site in enough detail that another Mongrel can reach it, understand the method, know the expected operational strengths/weaknesses, and reproduce the loop without asking you for missing steps.',
        why:'Veteran scouting turns private discovery into durable squad infrastructure.',
        checklist:['Location reproducible.','Commodity/method documented.','Operational advantages and limitations noted.','Return/sale or delivery context included.','Another miner could act from the dossier alone.'],
        link:{ label:'Open Site Scouting Guide', url:'/guides/mining/#scouting' },
      },
      {
        id:'mining-lead-operation-plan', stage:'Lead', type:'wing', title:'Design a squad mining operation',
        objective:'Plan a mining operation for at least two Commanders around a real or realistic objective. Define commodity, method/site, ship/role expectations, cargo target, collection or carrier staging, delivery destination, and stop condition.',
        why:'Multi-Commander mining needs a logistics plan, not merely several people arriving in the same ring.',
        checklist:['Objective/commodity explicit.','Site and method selected.','Roles or ship expectations clear.','Cargo target measurable.','Delivery/staging defined.','Stop condition defined.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'mining-lead-coordinate', stage:'Operations', type:'wing', title:'Coordinate a live group extraction',
        objective:'Run a mining session with at least one other Mongrel and coordinate enough of the work that both extraction and delivery stay organized. Capture what each participant contributed in useful units.',
        why:'Leadership means turning multiple ships into a coherent throughput gain instead of duplicated prospecting, confused cargo destinations, or idle haulers.',
        checklist:['At least two Commanders participated.','Commodity/site agreed before work.','Delivery destination remained clear.','Contributions captured in tonnes or another useful unit.'],
      },
      {
        id:'mining-lead-bottleneck', stage:'Diagnosis', type:'challenge', title:'Diagnose a group or route bottleneck',
        objective:'Take a mining route or group operation that underperformed and identify the dominant cause: prospecting, extraction tool uptime, collection, rig utilization, cargo staging, travel, market demand, coordination, or another measurable factor. Propose the smallest useful correction.',
        why:'Veteran operators should improve the system instead of reflexively demanding bigger ships or more people.',
        checklist:['Expected vs actual result stated.','Primary bottleneck supported by evidence.','Other plausible causes considered.','Correction is targeted rather than a complete rebuild.'],
      },
      {
        id:'mining-lead-build-review', stage:'Mentor', type:'mentor', title:'Review another miner’s build without replacing it',
        objective:'Have another Mongrel explain what their mining ship is meant to do. Identify the actual bottleneck and discuss at least three tradeoffs, then recommend only the highest-priority changes.',
        why:'A mentor should create a miner who can reason about builds, not a pilot dependent on receiving another module list.',
        checklist:['Pilot explains intended role first.','At least three tradeoffs discussed.','Bottleneck identified.','Only prioritized changes recommended.','Pilot can explain the revised reasoning afterward.'],
      },
      {
        id:'mining-lead-mentor-loop', stage:'Mentor', type:'mentor', title:'Teach a Commander the whole mining loop',
        objective:'Guide a less-experienced Mongrel through choosing a method, preparing the ship, finding a site, extracting, managing cargo, and selling/delivering. Let them make the decisions whenever the mistake is recoverable.',
        why:'The goal is not one successful supervised run. The goal is a Commander who can repeat the process when you are not there.',
        checklist:['Learner chooses or explains the method.','Learner handles site acquisition.','Learner understands extraction bottleneck.','Learner chooses buyer/delivery with reasons.','Learner can repeat the loop independently.'],
      },
      {
        id:'mining-lead-teach-specialty', stage:'Teach', type:'mentor', title:'Teach one advanced mining specialty until it sticks',
        objective:'Teach core mining, Rhino rig operations, site scouting, collection geometry, route benchmarking, market selection, or another advanced mining skill until the learner can demonstrate it independently.',
        why:'Knowledge transfer is complete when the learner can perform and explain the skill, not when they watched you do it.',
        checklist:['Specific skill selected.','Concept explained practically.','Learner attempts it.','Corrective feedback given.','Learner demonstrates successful independent execution.'],
      },
      {
        id:'mining-lead-capstone', stage:'Capstone', type:'wing', title:'Lead extraction from objective to delivery and leave reusable knowledge behind',
        objective:'Lead a complete real mining objective from site/method selection through extraction and delivery, then leave behind a reusable route note, site record, build lesson, or operating procedure another Mongrel can use later.',
        why:'The capstone combines mining, logistics, coordination, documentation, and succession. The squad should gain more than the cargo from the operation.',
        checklist:['Real objective completed.','Extraction and logistics coordinated.','Cargo delivered successfully.','Reusable knowledge documented.','At least one other Mongrel can explain or reuse the process.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
    ],
  },
];

export function eligibleMiningRoutes(experience = 'new') {
  if (experience === 'experienced') return ['mining-lead-mentor','mining-specialist','mining-rhino-field','mining-advanced-extraction'];
  if (experience === 'comfortable') return ['mining-specialist','mining-rhino-field','mining-advanced-extraction','mining-efficient-operator'];
  if (experience === 'some') return ['mining-efficient-operator','mining-rhino-field','mining-advanced-extraction','mining-laser-foundations'];
  return ['mining-laser-foundations'];
}

export function getMiningRoute(id) {
  return MINING_ROUTES.find(route => route.id === id) || null;
}
