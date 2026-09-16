export const TRADE_ACTIVITY_ID = 'trade';

const TRADERS_OUTPOST = '/trading/';
const CARRIERS = '/carriers/';
const PROJECTS = '/projects/';
const DAILY_ORDERS = '/operations/#daily-orders';

export const TRADE_ROUTES = [
  {
    id:'trade-foundations',
    band:'Beginner',
    title:'Trade Foundations — Build, Haul, Discover',
    subtitle:'Start with a simple cargo ship, make a few specific hauls, and learn what makes trading worthwhile by seeing the results yourself.',
    audience:'For a Commander who has little or no deliberate cargo-trading experience and should learn by doing before worrying about route optimization.',
    outcome:'Graduate by building a basic hauler, finding and trading specific commodities, discovering the value of better cargo, and completing a profitable trade without step-by-step instructions.',
    sourceNote:'Beginner Trade is deliberately action-first. Each assignment teaches one main idea. Market freshness, demand management, route benchmarking, backhauls, and deeper optimization belong in later routes after the Commander has completed ordinary trades firsthand.',
    sources:[
      { label:"Trader's Outpost", url:TRADERS_OUTPOST },
      { label:'Ship Catalogue', url:'/ships/' },
    ],
    tasks:[
      {
        id:'trade-foundations-build-v2', stage:'Build', type:'build', title:'Build a simple cargo ship',
        objective:'Prepare an affordable cargo ship for normal station-to-station hauling. A Type-6 is a good target, but another small or medium hauler is fine. Focus on cargo racks and enough jump range to travel comfortably; stop once the ship is ready to carry cargo.',
        why:'The first goal is simply to own a usable hauler. Optimization can wait until you have real trade experience to optimize around.',
        checklist:['Cargo ship selected.','Cargo racks installed.','Ship can make normal trade jumps.','Rebuy covered.'],
        link:{ label:'Open Ship Catalogue', url:'/ships/' },
      },
      {
        id:'trade-foundations-cheap-haul-v2', stage:'Haul', type:'demonstrate', title:'Make one cheap haul',
        objective:'Buy one load of an inexpensive, low-margin commodity such as Water, Food Cartridges, or another basic staple and sell it somewhere for a profit. Note roughly how many credits the trip earned.',
        why:'This gives you a simple baseline. The point is not to make good money yet; it is to complete the basic buy → move → sell loop once.',
        checklist:['Commodity purchased.','Cargo delivered and sold.','Approximate profit noticed or recorded.'],
      },
      {
        id:'trade-foundations-find-silver-v2', stage:'Find', type:'learn', title:'Find a market that sells Silver',
        objective:'Locate a station or market where you can buy Silver. Use whatever normal in-game or external market-search method you can learn; the assignment will not give you the station name.',
        why:'Finding the source is part of trading. This is your first deliberate commodity search rather than following a prepared route.',
        checklist:['Silver source found.','You know how you found it.','Your cargo ship can dock there.'],
      },
      {
        id:'trade-foundations-buy-silver-v2', stage:'Buy', type:'demonstrate', title:'Buy a load of Silver',
        objective:'Travel to the Silver source and buy a useful load for your current cargo ship. Do not worry about perfect route math yet.',
        why:'Separating the source-finding step from the sale keeps the lesson simple: first acquire the commodity deliberately.',
        checklist:['Correct market reached.','Silver purchased.','Cargo is ready for delivery.'],
      },
      {
        id:'trade-foundations-sell-silver-v2', stage:'Sell', type:'demonstrate', title:'Find a better buyer and sell the Silver',
        objective:'Find a market offering more for Silver than you paid, fly there, and sell the load for a profit.',
        why:'This is the core trading idea in its simplest form: buy where a commodity is cheaper and move it where it is worth more.',
        checklist:['Buyer found independently.','Sale price is above purchase price.','Silver delivered and sold.'],
      },
      {
        id:'trade-foundations-compare-profit-v2', stage:'Compare', type:'demonstrate', title:'Compare the two payouts',
        objective:'Compare your cheap staple haul with your Silver haul. You do not need a spreadsheet; just identify which trip earned substantially more and why choosing the commodity mattered.',
        why:'The lesson is easier to remember after you have seen the credit difference yourself.',
        checklist:['Both hauls compared.','Higher-value haul identified.','You can explain that commodity choice can matter more than simply filling the hold.'],
      },
      {
        id:'trade-foundations-outpost-v2', stage:'Access', type:'challenge', title:'Make a trade involving an outpost',
        objective:'Find and complete one profitable delivery that uses an outpost or another medium-pad destination.',
        why:'This introduces pad access through experience. You will see why a smaller hauler can reach markets that large ships cannot.',
        checklist:['Outpost or medium-pad destination found.','Your ship can dock there.','Cargo delivered profitably.'],
      },
      {
        id:'trade-foundations-own-commodity-v2', stage:'Discover', type:'challenge', title:'Choose your own profitable commodity',
        objective:'Pick a commodity other than Silver, find a source, find a buyer offering more, and complete the haul without the pathway choosing the commodity for you.',
        why:'You are now moving from following examples to making the trade choice yourself.',
        checklist:['Commodity chosen independently.','Source found.','Buyer found.','Profitable haul completed.'],
      },
      {
        id:'trade-foundations-graduate-v2', stage:'Graduate', type:'challenge', title:'Complete a profitable trade without instructions',
        objective:'Find and complete another worthwhile trade from start to finish using your own judgment. The pathway will not specify the commodity, source, buyer, or route.',
        why:'Beginner Trade is complete when you can create a basic profitable haul for yourself.',
        checklist:['Opportunity found independently.','Cargo bought and delivered.','Trade produced a profit.','You can explain how you found the opportunity.'],
        link:{ label:"Open Trader's Outpost", url:TRADERS_OUTPOST },
      },
    ],
  },
  {
    id:'trade-route-runner',
    band:'Developing',
    title:'Route Runner — Learn What Makes a Route Good',
    subtitle:'Now that you can trade, improve one idea at a time: profit, travel time, repeatability, return cargo, freshness, and the bottleneck in your loop.',
    audience:'For a trader who can find and complete ordinary profitable hauls and is ready to understand why some routes are better than others.',
    outcome:'Graduate by measuring real routes, improving one limiting factor, and publishing a route another Mongrel can use.',
    sourceNote:'Developing Trade introduces route analysis gradually. Each assignment isolates one factor before the capstone asks the Commander to combine them.',
    sources:[{ label:"Trader's Outpost", url:TRADERS_OUTPOST }],
    tasks:[
      {
        id:'trade-runner-profit-v2', stage:'Profit', type:'demonstrate', title:'Compare two commodities by profit',
        objective:'Find two possible hauls and compare the approximate profit per tonne. Run the one with the better margin and note the result.',
        why:'This isolates the first route-selection variable: how much value each tonne of cargo can produce.',
        checklist:['Two possible hauls compared.','Profit-per-ton difference understood.','Higher-margin option completed.'],
      },
      {
        id:'trade-runner-time-v2', stage:'Time', type:'demonstrate', title:'Compare two routes by travel time',
        objective:'Compare two routes where one requires noticeably more jumps or supercruise travel. Run both or time representative legs and decide which feels better once travel time is included.',
        why:'A high-margin route can still be a poor use of time if most of the session is spent travelling.',
        checklist:['Two travel profiles compared.','Approximate time difference observed.','You can explain how travel changes route value.'],
      },
      {
        id:'trade-runner-benchmark-v2', stage:'Repeat', type:'challenge', title:'Run the same route three times',
        objective:'Complete the same trade loop at least three times and record approximate profit and loop time for each run.',
        why:'Repeating one route shows whether the opportunity is reliably good rather than just looking good once.',
        checklist:['Three loops completed.','Profit recorded.','Approximate loop time recorded.','Typical result identified.'],
      },
      {
        id:'trade-runner-backhaul-v2', stage:'Return', type:'demonstrate', title:'Add a useful return cargo',
        objective:'Find a commodity you can carry on the return trip of a route you already know. Complete one full loop with the backhaul and compare it with returning empty.',
        why:'A return cargo can improve a route, but now you have a baseline to judge whether it was actually worth the extra work.',
        checklist:['Return commodity found.','Full loop completed.','Backhaul compared with empty return.'],
      },
      {
        id:'trade-runner-freshness-v2', stage:'Freshness', type:'challenge', title:'Verify a posted route before trusting it',
        objective:'Choose a Trader’s Outpost post, check how old it is, and verify the important market values before committing a full load. If the route has changed, adjust or abandon it.',
        why:'This introduces freshness after you already understand normal trading, so the warning has practical meaning instead of being another beginner rule to memorize.',
        checklist:['Post age checked.','Market conditions verified.','Route either confirmed or changed intentionally.'],
        link:{ label:"Open Trader's Outpost", url:TRADERS_OUTPOST },
      },
      {
        id:'trade-runner-bottleneck-v2', stage:'Improve', type:'challenge', title:'Improve one bottleneck',
        objective:'Choose one thing slowing your normal route—jump count, supercruise distance, cargo capacity, docking, loading, or another obvious factor—change only that factor, and run the route again.',
        why:'Optimization is easier to understand when you change one variable and feel the result yourself.',
        checklist:['One bottleneck selected.','One targeted change made.','Route repeated.','Before/after difference observed.'],
      },
      {
        id:'trade-runner-graduate-v2', stage:'Graduate', type:'challenge', title:'Publish a route worth another Mongrel’s time',
        objective:'Find and verify a useful trade route, run it yourself, then post it to Trader’s Outpost with enough information for another member to decide whether to try it.',
        why:'The Developing capstone combines the separate lessons without turning every earlier assignment into a checklist of six variables.',
        checklist:['Route personally run.','Profit and destination information included.','Pad/access noted if relevant.','Freshness and meaningful caveats included.'],
        link:{ label:'Post to Trader’s Outpost', url:TRADERS_OUTPOST },
      },
    ],
  },
  {
    id:'trade-medium-pad-specialist',
    band:'Developing / Experienced',
    title:'Medium-Pad Specialist — Access Over Raw Capacity',
    subtitle:'Experience the situations where a medium hauler can do work a large ship simply cannot.',
    audience:'For traders who already understand normal hauling and want to explore the practical value of medium-pad access.',
    outcome:'Graduate by using medium-pad access in profitable and squad-useful situations and knowing when it is worth giving up raw cargo capacity.',
    sourceNote:'This route keeps the lesson focused on access. General route optimization belongs in Route Runner; deep market intelligence belongs in Market Specialist.',
    sources:[{ label:"Trader's Outpost", url:TRADERS_OUTPOST }],
    tasks:[
      {
        id:'trade-medium-ready-v2', stage:'Build', type:'build', title:'Prepare a medium-pad hauler',
        objective:'Build or use a medium-pad cargo ship with useful cargo capacity and enough range for ordinary trade routes. Keep the build simple.',
        why:'The purpose of this ship is access. You do not need to solve every possible hauling problem in the outfitting screen.',
        checklist:['Medium-pad capable.','Useful cargo space.','Practical jump range.','Rebuy covered.'],
      },
      {
        id:'trade-medium-visit-v2', stage:'Access', type:'demonstrate', title:'Trade at an outpost a large ship cannot use',
        objective:'Find an outpost with a commodity market and complete one buy or sell transaction there in your medium hauler.',
        why:'The value of medium-pad access becomes obvious the moment you use a market that a large ship cannot reach.',
        checklist:['Outpost found.','Medium ship docked successfully.','Trade completed.'],
      },
      {
        id:'trade-medium-exclusive-v2', stage:'Route', type:'challenge', title:'Complete a profitable medium-only route',
        objective:'Find and complete a profitable route with at least one medium-pad-only endpoint.',
        why:'Now use the access advantage for an actual route rather than just proving you can land there.',
        checklist:['Medium-only endpoint verified.','Profitable route completed.','Access advantage identified.'],
        link:{ label:'Filter Trader’s Outpost by pad size', url:TRADERS_OUTPOST },
      },
      {
        id:'trade-medium-compare-v2', stage:'Compare', type:'demonstrate', title:'Compare access against capacity',
        objective:'Compare one medium-pad route with one large-pad route you could run instead. Focus on the practical tradeoff between reaching more markets and carrying more tonnes.',
        why:'The lesson is not that medium is better. It is knowing when access is worth more than capacity.',
        checklist:['Medium route considered.','Large route considered.','Access/capacity tradeoff explained.'],
      },
      {
        id:'trade-medium-mission-v2', stage:'Operations', type:'demonstrate', title:'Use medium access for a squad need',
        objective:'Complete a current or realistic squad logistics task where medium-pad access or the smaller remaining cargo requirement makes a medium hauler a sensible choice.',
        why:'Specialized ships matter most when they solve a real operational constraint.',
        checklist:['Objective identified.','Medium ship chosen for a concrete reason.','Cargo delivered successfully.'],
        link:{ label:'Open Current Tasking', url:DAILY_ORDERS },
      },
      {
        id:'trade-medium-graduate-v2', stage:'Graduate', type:'challenge', title:'Know when to choose the medium ship',
        objective:'Document one real route or situation where you would choose the medium hauler and one where you would switch back to a large ship.',
        why:'The qualification is judgment, not loyalty to one hull size.',
        checklist:['Medium-hauler use case documented.','Large-hauler use case documented.','Reason for each choice explained.'],
      },
    ],
  },
  {
    id:'trade-strategic-hauler',
    band:'Experienced',
    title:'Strategic Hauler — Move What the Pack Needs',
    subtitle:'Shift from personal profit toward BGS, construction, project, carrier, and other squad logistics where the objective determines the cargo.',
    audience:'For capable traders who want their hauling to directly support Mongrel operations.',
    outcome:'Graduate by completing objective-driven hauls and showing that you can source cargo, choose the right hauler, respect the stop condition, and adapt when the logistics change.',
    sourceNote:'Strategic hauling should follow the authoritative squad source for the objective. Trader’s Outpost, Projects, Carrier Coordination, and Daily Orders may each own different logistics needs.',
    sources:[
      { label:"Trader's Outpost — Squad Priority", url:TRADERS_OUTPOST },
      { label:'Projects & Events', url:PROJECTS },
      { label:'Carrier Coordination', url:CARRIERS },
      { label:'Daily Orders', url:DAILY_ORDERS },
    ],
    tasks:[
      {
        id:'trade-strategic-source', stage:'Objective', type:'demonstrate', title:'Find the authoritative logistics need',
        objective:'Identify one current squad hauling requirement and verify the commodity, destination, remaining quantity, and stop condition from the site that owns the objective.',
        why:'Strategic hauling starts with knowing exactly what the squad needs now.',
        checklist:['Authoritative source identified.','Commodity/destination verified.','Remaining quantity or stop condition checked.'],
      },
      {
        id:'trade-strategic-source-market', stage:'Source', type:'challenge', title:'Choose a practical supply source',
        objective:'For the required commodity, compare at least two supply locations and choose the source that gives the operation the best combination of availability and travel time.',
        why:'The cheapest market is not automatically the best supply point for an operation.',
        checklist:['Two sources compared.','Availability checked.','Travel difference considered.','Source selected.'],
      },
      {
        id:'trade-strategic-ship', stage:'Ship', type:'demonstrate', title:'Match the hauler to the job',
        objective:'Choose a hauler based on destination pad access and the amount of cargo still required. Explain why that ship fits this job.',
        why:'This keeps ship choice tied to the actual constraint instead of maximum cargo by default.',
        checklist:['Pad access checked.','Remaining quantity considered.','Ship choice explained.'],
      },
      {
        id:'trade-strategic-deliver', stage:'Deliver', type:'demonstrate', title:'Complete a real squad haul',
        objective:'Deliver a meaningful amount of cargo toward a live squad objective and report the contribution in tonnes or the exact unit requested by the operation.',
        why:'Operational reporting lets planners know what remains.',
        checklist:['Correct cargo delivered.','Correct destination used.','Contribution reported in useful units.'],
      },
      {
        id:'trade-strategic-stop', stage:'Control', type:'challenge', title:'Stop when the operation is done',
        objective:'Track the remaining requirement during a live or realistic haul and stop or redirect before another load would materially overshoot the target.',
        why:'More hauling is not always better. Good logistics includes restraint.',
        checklist:['Remaining requirement tracked.','Stop/redirect decision made deliberately.','No avoidable large overshoot.'],
      },
      {
        id:'trade-strategic-carrier', stage:'Carrier', type:'wing', title:'Support one carrier loading or unloading job',
        objective:'Join a carrier coordination job and complete at least one deliberate load or unload cycle while following the posted commodity and remaining quantity.',
        why:'Carrier jobs add shared inventory and coordination without requiring you to become the carrier operator.',
        checklist:['Correct carrier/post verified.','Correct commodity moved.','Contribution tracked.','Remaining amount respected.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'trade-strategic-contingency', stage:'Adapt', type:'challenge', title:'Recover when the supply plan breaks',
        objective:'When a chosen supply source, carrier, or destination becomes poor or unavailable, find a workable alternative that still completes the original squad objective.',
        why:'Experienced hauling includes adapting without losing sight of the mission.',
        checklist:['Broken assumption identified.','Alternative preserves the objective.','New route completed or ready to execute.'],
      },
    ],
  },
  {
    id:'trade-market-specialist',
    band:'Experienced / Veteran',
    title:'Market Specialist — Verify, Benchmark, Adapt',
    subtitle:'Treat trade information as time-sensitive evidence: validate opportunities, detect when a route is decaying, benchmark alternatives, and publish information others can trust.',
    audience:'For experienced traders who want deeper market judgment rather than simply higher cargo capacity.',
    outcome:'Graduate by building and maintaining reliable route intelligence for yourself and the squad.',
    sourceNote:'Trader’s Outpost is intentionally member-maintained and freshness-aware. This route develops the judgment needed to turn changing market observations into useful squad information.',
    sources:[{ label:"Trader's Outpost", url:TRADERS_OUTPOST }],
    tasks:[
      {
        id:'trade-market-freshness', stage:'Analysis', type:'challenge', title:'Audit route freshness',
        objective:'Review several current Trader’s Outpost posts and classify which are worth immediate verification, which are only leads, and which are too stale to justify a cargo commitment without independent checking.',
        why:'Freshness is a confidence signal, not decoration.',
        checklist:['Several posts reviewed.','Confidence judgments explained.','No stale route treated as guaranteed.'],
      },
      {
        id:'trade-market-demand', stage:'Analysis', type:'demonstrate', title:'Plan around demand and cargo size',
        objective:'Before a large haul, compare your intended cargo amount with destination demand and decide whether one load, a partial load, split deliveries, or a different buyer makes more sense.',
        why:'A huge hold can become a liability when the destination cannot absorb it well.',
        checklist:['Demand checked.','Cargo size considered against demand.','Delivery strategy chosen deliberately.'],
      },
      {
        id:'trade-market-route-decay', stage:'Diagnosis', type:'challenge', title:'Recognize route decay before it becomes a bad loop',
        objective:'Run or observe a route across multiple checks and identify signs that the opportunity is weakening: lower demand, worse spread, depleted supply, longer turnaround, or another meaningful change. Decide when to stop running it.',
        why:'Good traders leave degrading routes before sunk cost turns into habit.',
        checklist:['Baseline established.','At least one degradation signal identified.','Exit condition defined.'],
      },
      {
        id:'trade-market-alternatives', stage:'Planning', type:'challenge', title:'Maintain a fallback route',
        objective:'For one preferred trade loop, identify at least one credible alternate commodity, source, buyer, or route that you could switch to quickly if the main opportunity disappears.',
        why:'Contingency planning reduces idle time when markets move.',
        checklist:['Primary route documented.','Fallback identified.','Trigger for switching defined.'],
      },
      {
        id:'trade-market-publish', stage:'Intel', type:'demonstrate', title:'Publish high-quality trade intelligence',
        objective:'Create or update a Trader’s Outpost post using personally verified information. Include meaningful caveats, pad access, quantity/demand context, and a freshness timestamp through the site workflow.',
        why:'A route post is only useful when another Commander can judge its confidence and fit.',
        checklist:['Information personally verified.','Access/quantity context included.','Limitations noted.','Post maintained if conditions change.'],
        link:{ label:'Open Trader’s Outpost', url:TRADERS_OUTPOST },
      },
      {
        id:'trade-market-review', stage:'Mentor', type:'mentor', title:'Review another trader’s route reasoning',
        objective:'Have another Mongrel explain why they chose a route. Ask about freshness, pad access, demand, loop time, and alternatives, then give only the highest-value corrections.',
        why:'Experienced traders should teach decision-making rather than hand out coordinates and prices.',
        checklist:['Trader presents reasoning first.','At least four route factors discussed.','Corrections prioritized.','Trader can explain the revised decision.'],
      },
    ],
  },
  {
    id:'trade-logistics-lead',
    band:'Veteran / Mentor',
    title:'Logistics Lead — Plan, Coordinate, Teach',
    subtitle:'Turn hauling skill into squad capability by designing cargo plans, coordinating multiple haulers, managing changing constraints, and teaching others to make good logistics decisions.',
    audience:'For veteran traders who no longer need basic route guidance and want work centered on leadership, operational planning, diagnosis, and knowledge transfer.',
    outcome:'Complete the route by leading a real or realistic multi-hauler objective and leaving another Mongrel capable of planning the next one.',
    sourceNote:'This is a development route, not an automatic squad rank. The emphasis is objective completion, control, and teaching rather than personal credits earned.',
    sources:[
      { label:"Trader's Outpost", url:TRADERS_OUTPOST },
      { label:'Carrier Coordination', url:CARRIERS },
      { label:'Projects & Events', url:PROJECTS },
      { label:'Daily Orders', url:DAILY_ORDERS },
    ],
    tasks:[
      {
        id:'trade-lead-plan', stage:'Lead', type:'wing', title:'Design a multi-hauler logistics plan',
        objective:'For a real or realistic cargo objective, define commodity, total quantity, source, destination, ship/access constraints, staging, reporting unit, and stop condition for at least two haulers.',
        why:'A group haul should be an operation, not several pilots independently guessing what remains.',
        checklist:['Objective and quantity explicit.','Source/destination verified.','Access constraints included.','Reporting/stop conditions explicit.'],
      },
      {
        id:'trade-lead-work-split', stage:'Lead', type:'wing', title:'Split the work intelligently',
        objective:'Assign or recommend different cargo roles based on ship capacity, pad access, distance, online time, or carrier staging. Avoid giving every pilot the same job by default.',
        why:'Different haulers can be complementary rather than redundant.',
        checklist:['Pilot/ship constraints considered.','Work split has a reason.','Plan can adapt if one hauler leaves.'],
      },
      {
        id:'trade-lead-coordinate', stage:'Operations', type:'wing', title:'Coordinate a live cargo objective',
        objective:'Coordinate at least two Commanders through a current squad haul or carrier job. Track contributions and remaining quantity well enough to prevent major duplicate or overshoot work.',
        why:'Once multiple haulers are active, information flow becomes as important as cargo capacity.',
        checklist:['At least two Commanders contribute.','Progress tracked in useful units.','Remaining quantity stays visible.','Operation stops or redirects cleanly.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'trade-lead-contingency', stage:'Diagnosis', type:'challenge', title:'Re-plan after a major assumption fails',
        objective:'Take a logistics plan whose market, carrier, source, destination, or timing assumption breaks and produce a revised plan that preserves the objective with minimal wasted movement.',
        why:'Real logistics leadership is tested by changes, not by the perfect first plan.',
        checklist:['Failed assumption identified.','Revised plan preserves objective.','Wasted cargo/movement minimized.','Team receives clear updated instructions.'],
      },
      {
        id:'trade-lead-bottleneck', stage:'Diagnosis', type:'challenge', title:'Diagnose the operation bottleneck',
        objective:'Identify whether the limiting factor in a group haul is source supply, pad access, carrier loading, route length, hauler count, cargo capacity, coordination, demand, or another measurable constraint. Fix the highest-impact bottleneck first.',
        why:'Adding more ships can make a poorly designed logistics chain worse instead of faster.',
        checklist:['Bottleneck supported by evidence.','Other causes considered.','Correction targets the limiting factor.'],
      },
      {
        id:'trade-lead-mentor-route', stage:'Mentor', type:'mentor', title:'Teach a Commander to choose a route independently',
        objective:'Give a less-experienced Mongrel a trade objective and coach them through route selection without choosing it for them. They should evaluate access, freshness, market conditions, time, and alternatives themselves.',
        why:'A logistics lead should create independent haulers, not permanent followers.',
        checklist:['Learner makes the initial choice.','Learner checks market/access factors.','Feedback is corrective rather than prescriptive.','Learner can choose a second route with less help.'],
      },
      {
        id:'trade-lead-mentor-operation', stage:'Mentor', type:'mentor', title:'Let another Mongrel write the haul plan',
        objective:'Have another trader write a small logistics plan. Review it for quantities, access, staging, stop conditions, and contingency, then let them revise and own the final version.',
        why:'Planning skill only develops when the learner has to make and defend decisions.',
        checklist:['Learner writes first draft.','Risks discussed.','Learner revises plan.','Learner owns final decision.'],
      },
      {
        id:'trade-lead-capstone', stage:'Capstone', type:'wing', title:'Lead an objective from requirement to final delivery',
        objective:'Lead a real or realistic squad logistics objective from requirement discovery through sourcing, assignments, hauling, adjustment, and final delivery. Finish with a short handoff describing what worked, what changed, and what should be reused next time.',
        why:'The capstone combines route judgment, coordination, restraint, contingency planning, and knowledge transfer.',
        checklist:['Requirement verified.','At least two haulers coordinated.','Progress/remaining amount tracked.','Objective completed or cleanly handed off.','Reusable lesson documented.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
    ],
  },
];

export function eligibleTradeRoutes(experience = 'new') {
  if (experience === 'experienced') return ['trade-logistics-lead','trade-market-specialist','trade-strategic-hauler','trade-medium-pad-specialist'];
  if (experience === 'comfortable') return ['trade-strategic-hauler','trade-market-specialist','trade-medium-pad-specialist','trade-route-runner'];
  if (experience === 'some') return ['trade-route-runner','trade-medium-pad-specialist','trade-foundations'];
  return ['trade-foundations'];
}

export function getTradeRoute(id) {
  return TRADE_ROUTES.find(route => route.id === id) || null;
}
