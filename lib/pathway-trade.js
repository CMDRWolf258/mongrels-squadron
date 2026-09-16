export const TRADE_ACTIVITY_ID = 'trade';

const TRADERS_OUTPOST = '/trading/';
const CARRIERS = '/carriers/';
const PROJECTS = '/projects/';
const DAILY_ORDERS = '/operations/#daily-orders';

export const TRADE_ROUTES = [
  {
    id:'trade-foundations',
    band:'Beginner',
    title:'Trade Foundations — First Profitable Loop',
    subtitle:'Learn to read a route, match the ship to the destination, move cargo safely, and verify that the market still makes sense before committing your hold.',
    audience:'For a Commander who has not deliberately planned and completed a repeatable trade loop before.',
    outcome:'Graduate by completing a profitable round trip, verifying market conditions yourself, and explaining why the route fit your ship instead of blindly following an old price.',
    sourceNote:'This route uses the Trader’s Outpost as the squad trade board. Member-posted prices are leads rather than guaranteed live market data, so verification and freshness checks are part of the training.',
    sources:[
      { label:"Trader's Outpost", url:TRADERS_OUTPOST },
      { label:'Carrier Coordination', url:CARRIERS },
    ],
    tasks:[
      {
        id:'trade-foundations-ship', stage:'Prepare', type:'build', title:'Prepare a practical hauler',
        objective:'Use a ship with meaningful cargo capacity, adequate jump range for your chosen route, a fuel scoop or reliable refuel plan, and enough survivability to finish the trip without turning the build into a combat ship.',
        why:'The best trade ship is not simply the hull with the largest theoretical cargo number. Range, pad access, survivability, and turnaround all affect whether a route is actually usable.',
        checklist:['Cargo capacity is useful for the route.','Jump/refuel plan is practical.','Rebuy is covered.','Ship can survive routine interdiction risk.'],
        link:{ label:'Open Ship Catalogue', url:'/ships/' },
      },
      {
        id:'trade-foundations-read-card', stage:'Learn', type:'learn', title:'Read an entire trade route before launching',
        objective:'Choose a current Trader’s Outpost route and identify commodity, origin, destination, pad size, estimated profit, available quantity or demand, distance, and freshness before deciding whether to fly it.',
        why:'A single impressive profit number can hide the reason a route is unusable for your ship or stale by the time you arrive.',
        checklist:['Commodity identified.','Origin/destination checked.','Pad requirement checked.','Profit and quantity/demand checked.','Freshness checked.'],
        link:{ label:"Open Trader's Outpost", url:TRADERS_OUTPOST },
      },
      {
        id:'trade-foundations-pad', stage:'Access', type:'demonstrate', title:'Match pad access to your ship',
        objective:'Before one run, verify that both ends of the route can accept your current ship. Then identify one otherwise-attractive route that your ship cannot use because of pad access.',
        why:'A route that pays more on paper is worthless if the destination cannot accept the ship carrying the cargo.',
        checklist:['Your route supports your ship’s pad size.','You can identify a route excluded by pad access.','You understand why smaller ships can access markets large haulers cannot.'],
      },
      {
        id:'trade-foundations-verify', stage:'Market', type:'demonstrate', title:'Verify the market before filling the hold',
        objective:'At the origin and destination, confirm the current commodity conditions are still reasonable before committing a full cargo load. If the posted route has materially changed, choose whether to reduce the load, redirect, or abandon it.',
        why:'The Trader’s Outpost deliberately shows freshness because Elite markets move. Good traders verify instead of treating a posted price as a promise.',
        checklist:['Origin supply/price checked.','Destination demand/price checked.','Decision adjusted if conditions changed.'],
        link:{ label:"Open Trader's Outpost", url:TRADERS_OUTPOST },
      },
      {
        id:'trade-foundations-first-leg', stage:'Operate', type:'demonstrate', title:'Complete a loaded leg cleanly',
        objective:'Buy cargo for the planned route, travel to the destination, handle any interdiction or navigation issue safely, and sell without losing the load.',
        why:'Trade competence includes getting the cargo there. Route math means nothing if poor preparation turns a routine haul into a rebuy.',
        checklist:['Cargo purchased intentionally.','Destination reached safely.','Cargo sold at an acceptable result.','No rebuy.'],
      },
      {
        id:'trade-foundations-return', stage:'Operate', type:'demonstrate', title:'Make the return trip useful',
        objective:'Before leaving the destination, decide whether the return leg should carry another profitable commodity, support a squad need, reposition empty, or end the loop. Complete the choice intentionally rather than automatically flying empty.',
        why:'A good trade loop evaluates both directions. Sometimes the best return cargo is profit; sometimes the right answer is empty repositioning because forcing a bad backhaul wastes time.',
        checklist:['Return options considered.','Choice made for a reason.','Return/reposition completed.'],
      },
      {
        id:'trade-foundations-record', stage:'Feedback', type:'demonstrate', title:'Measure the whole loop',
        objective:'Record approximate cargo moved, total profit, number of jumps, and total loop time. Calculate whether the route felt good because of profit per tonne or because the whole loop was efficient.',
        why:'Profit per tonne alone does not measure a route. A lower-margin route can outperform a glamorous one when the loop is shorter or easier.',
        checklist:['Tonnes moved recorded.','Total profit recorded.','Loop time recorded.','At least one efficiency observation made.'],
      },
      {
        id:'trade-foundations-graduate', stage:'Graduate', type:'challenge', title:'Find and complete your own second route',
        objective:'Choose a different current route without being told which one to run, verify it, complete the haul, and explain why it was appropriate for your ship and available play time.',
        why:'The beginner route is complete when you can make the trade decision yourself rather than only follow one prepared example.',
        checklist:['Different route selected independently.','Market/pad/freshness checked.','Haul completed.','Route choice explained.'],
        link:{ label:"Open Trader's Outpost", url:TRADERS_OUTPOST },
      },
    ],
  },
  {
    id:'trade-route-runner',
    band:'Developing',
    title:'Route Runner — Profit Is a Loop, Not a Screenshot',
    subtitle:'Compare routes by total turnaround, cargo utilization, freshness, and repeatability instead of chasing the largest listed profit-per-ton figure.',
    audience:'For a trader who can complete normal hauling but wants better judgment about which route is actually worth running.',
    outcome:'Graduate by comparing, benchmarking, and improving a repeatable route using whole-loop measurements.',
    sourceNote:'Trader’s Outpost route cards contain the data needed to evaluate opportunities, but posted market figures remain time-sensitive. This route trains verification and repeatability rather than blind route copying.',
    sources:[{ label:"Trader's Outpost", url:TRADERS_OUTPOST }],
    tasks:[
      {
        id:'trade-runner-compare', stage:'Planning', type:'demonstrate', title:'Compare three routes before choosing one',
        objective:'Evaluate three current trade opportunities using profit, distance/jumps, pad access, quantity/demand, freshness, and expected turnaround. Pick one and state why it wins for your current ship.',
        why:'Experienced route choice is multi-variable. The highest displayed profit is only one input.',
        checklist:['Three routes compared.','At least five route factors considered.','Choice tied to current ship and time available.'],
        link:{ label:"Open Trader's Outpost", url:TRADERS_OUTPOST },
      },
      {
        id:'trade-runner-benchmark', stage:'Benchmark', type:'challenge', title:'Benchmark three consecutive loops',
        objective:'Run the same route for at least three loops and record tonnes, profit, and approximate loop time for each. Separate the typical result from the best single run.',
        why:'Repeatability matters more than one lucky market snapshot or unusually fast leg.',
        checklist:['Three loops completed.','Comparable measurements captured.','Typical result identified.','Main source of variation identified.'],
      },
      {
        id:'trade-runner-backhaul', stage:'Efficiency', type:'demonstrate', title:'Build a useful backhaul',
        objective:'Find a return commodity or secondary leg that improves the loop without adding enough delay to erase the benefit. Compare it against simply returning empty.',
        why:'Backhaul cargo is valuable only when the extra search, detour, or docking time improves the whole route.',
        checklist:['Backhaul option identified.','Empty-return baseline considered.','Decision based on whole-loop value.'],
      },
      {
        id:'trade-runner-stale', stage:'Market', type:'challenge', title:'Recover from a stale route',
        objective:'When a listed route is stale or materially worse on arrival, choose a sensible response: reduced load, alternative buyer, different commodity, or abandonment. Do not force the original route simply because you already traveled there.',
        why:'Good traders minimize sunk-cost mistakes. Markets changing is normal; adaptation is part of the job.',
        checklist:['Change identified before major loss.','At least one alternative checked.','Cargo or route adjusted intentionally.'],
      },
      {
        id:'trade-runner-bottleneck', stage:'Diagnosis', type:'demonstrate', title:'Find the bottleneck in your loop',
        objective:'Identify whether your current limiting factor is station distance, jump count, supercruise, pad access, cargo capacity, loading quantity, market demand, docking, or something else. Change one factor and measure again.',
        why:'A bigger cargo rack does not solve every trading problem. Improve the limiting factor, not the most visible number.',
        checklist:['Primary bottleneck named.','One targeted change made.','Before/after result compared.'],
      },
      {
        id:'trade-runner-alternate-ship', stage:'Adapt', type:'challenge', title:'Run one route in a different class of hauler',
        objective:'Use a different ship size or role than your normal hauler and complete a route that benefits from that choice. Compare access, cargo, jump range, safety, and turnaround.',
        why:'Knowing when a smaller or more specialized hauler is better is part of route judgment.',
        checklist:['Different ship class used.','Route chosen to exploit its strengths.','Tradeoffs compared afterward.'],
      },
      {
        id:'trade-runner-graduate', stage:'Graduate', type:'challenge', title:'Publish a route worth another Mongrel’s time',
        objective:'Find, verify, and post a useful route to Trader’s Outpost with enough information and caveats that another member can decide whether it fits their ship.',
        why:'A developing trader should be able to create useful squad information, not only consume it.',
        checklist:['Route personally verified.','Pad/freshness/quantity or demand included.','Profit information realistic.','Notes warn about meaningful limitations.'],
        link:{ label:'Post to Trader’s Outpost', url:TRADERS_OUTPOST },
      },
    ],
  },
  {
    id:'trade-medium-pad-specialist',
    band:'Developing / Experienced',
    title:'Medium-Pad Specialist — Access Over Raw Capacity',
    subtitle:'Learn when access, turnaround, and market exclusivity make a medium hauler more useful than a larger ship.',
    audience:'For traders who normally think in maximum tonnes and want to become comfortable exploiting medium-pad destinations and tighter logistics.',
    outcome:'Graduate by finding and running routes where medium-pad access materially changes the opportunity.',
    sourceNote:'Pad-size filtering is built directly into Trader’s Outpost because access can define the route. This route develops that skill rather than assuming larger is always better.',
    sources:[{ label:"Trader's Outpost", url:TRADERS_OUTPOST }],
    tasks:[
      {
        id:'trade-medium-ready', stage:'Prepare', type:'build', title:'Prepare a medium-pad hauler',
        objective:'Use a medium-pad-capable cargo ship with a practical balance of capacity, jump range, survivability, and optional fuel support for the kinds of routes you intend to run.',
        why:'The point of this route is access and flexibility, not duplicating a large hauler at half the capacity.',
        checklist:['Medium-pad capable.','Cargo/range balance suits the route.','Rebuy covered.','Survival plan understood.'],
      },
      {
        id:'trade-medium-exclusive', stage:'Access', type:'challenge', title:'Find a route your large hauler cannot use',
        objective:'Find and complete a profitable or useful route with at least one medium-pad-only endpoint that would exclude a large ship.',
        why:'This demonstrates the concrete value of access instead of treating medium hauling as merely a lower-capacity compromise.',
        checklist:['Medium-only access verified.','Route completed.','Benefit of access explained.'],
        link:{ label:'Filter Trader’s Outpost by pad size', url:TRADERS_OUTPOST },
      },
      {
        id:'trade-medium-compare', stage:'Benchmark', type:'demonstrate', title:'Compare medium access against large capacity',
        objective:'Compare one medium-pad route and one large-pad route on total credits or cargo moved per unit time. Include travel, docking, and availability rather than only tonnes per trip.',
        why:'The correct ship depends on the route. Capacity is valuable only when the market and access let you use it efficiently.',
        checklist:['Two routes benchmarked.','Whole-loop time considered.','Capacity/access tradeoff explained.'],
      },
      {
        id:'trade-medium-mission', stage:'Operations', type:'demonstrate', title:'Use medium access for a squad objective',
        objective:'Complete a current or realistic squad logistics task where medium-pad access, lower cargo requirement, or fast turnaround makes the medium hauler a good choice.',
        why:'Specialized ships earn their place when they solve operational constraints better than a generic maximum-capacity build.',
        checklist:['Objective identified.','Medium ship chosen for a concrete reason.','Cargo delivered successfully.'],
        link:{ label:'Open Current Tasking', url:DAILY_ORDERS },
      },
      {
        id:'trade-medium-contingency', stage:'Adapt', type:'challenge', title:'Recover when the best large-pad market is unavailable',
        objective:'When a preferred large-pad buyer or source is stale, inaccessible, or oversupplied, use medium-pad options to complete a profitable or strategically useful alternative haul.',
        why:'Access creates resilience when the obvious market fails.',
        checklist:['Original constraint identified.','Medium-pad alternative found.','Alternative completed intentionally.'],
      },
      {
        id:'trade-medium-graduate', stage:'Graduate', type:'challenge', title:'Build a medium-hauler use case another trader can copy',
        objective:'Document one route or scenario where a medium-pad hauler is clearly useful. Include ship requirements, access reason, route conditions, and what would make you switch back to a large ship.',
        why:'The goal is judgment: know when medium access matters and when it does not.',
        checklist:['Use case documented.','Pad/access reason explicit.','Switch-back condition included.'],
      },
    ],
  },
  {
    id:'trade-strategic-hauler',
    band:'Experienced',
    title:'Strategic Hauler — Move What the Pack Needs',
    subtitle:'Shift from personal profit toward BGS, construction, project, carrier, and other squad logistics where the objective determines the cargo.',
    audience:'For capable traders who want their hauling to directly support Mongrel operations.',
    outcome:'Graduate by completing several objective-driven hauls and showing that you can choose the right ship, source, staging plan, and stop condition for the job.',
    sourceNote:'Strategic hauling should follow the authoritative squad source for the objective. Trader’s Outpost, Projects, Carrier Coordination, and Daily Orders may each own different logistics needs.',
    sources:[
      { label:"Trader's Outpost — Squad Priority", url:TRADERS_OUTPOST },
      { label:'Projects & Events', url:PROJECTS },
      { label:'Carrier Coordination', url:CARRIERS },
      { label:'Daily Orders', url:DAILY_ORDERS },
    ],
    tasks:[
      {
        id:'trade-strategic-source', stage:'Planning', type:'demonstrate', title:'Find the authoritative logistics need',
        objective:'Identify one current squad hauling requirement and verify which site or board owns the authoritative quantity, destination, priority, and completion state before moving cargo.',
        why:'Strategic hauling goes wrong when several people act on stale chat messages or assumptions after the objective has changed.',
        checklist:['Authoritative source identified.','Commodity/destination verified.','Remaining quantity or stop condition checked.'],
      },
      {
        id:'trade-strategic-source-market', stage:'Planning', type:'challenge', title:'Choose the source, not just the cargo',
        objective:'For a squad commodity requirement, compare at least two supply options using availability, price, distance, pad access, and loading speed. Pick the source that best serves the operation.',
        why:'The cheapest source is not always the fastest way to complete a strategic objective.',
        checklist:['Two sources compared.','Operational factors considered.','Source choice justified.'],
      },
      {
        id:'trade-strategic-ship', stage:'Planning', type:'demonstrate', title:'Match the hauler to the objective',
        objective:'Choose large, medium, or another practical hauler based on destination access, remaining quantity, travel, risk, and time available. Explain why a different ship would be worse for this run.',
        why:'Strategic hauling rewards the correct tool more than the biggest cargo number.',
        checklist:['Access checked.','Remaining quantity considered.','Ship choice explained.'],
      },
      {
        id:'trade-strategic-deliver', stage:'Operations', type:'demonstrate', title:'Complete a real squad haul',
        objective:'Deliver a meaningful amount of cargo toward a live squad objective and report the contribution in tonnes or the exact unit requested by the operation.',
        why:'Operational reporting lets planners know what remains and prevents unnecessary over-delivery.',
        checklist:['Correct cargo delivered.','Correct destination used.','Contribution reported in useful units.'],
      },
      {
        id:'trade-strategic-stop', stage:'Control', type:'challenge', title:'Stop when the operation is done',
        objective:'During a live or realistic haul, track the remaining requirement and stop or redirect before your next load would materially overshoot the target or waste cargo.',
        why:'More hauling is not always better. Good logistics includes restraint and redirection.',
        checklist:['Remaining requirement tracked.','Stop/redirect decision made deliberately.','No avoidable large overshoot.'],
      },
      {
        id:'trade-strategic-carrier', stage:'Operations', type:'wing', title:'Support one carrier loading or unloading job',
        objective:'Join a carrier coordination job and complete at least one deliberate load/unload cycle while following the posted commodity, quantity, destination, and timing instructions.',
        why:'Carrier jobs introduce shared inventory and coordination constraints that normal station loops do not.',
        checklist:['Correct carrier/post verified.','Correct commodity moved.','Contribution tracked.','Post status/remaining amount respected.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'trade-strategic-contingency', stage:'Adapt', type:'challenge', title:'Recover a logistics plan when supply changes',
        objective:'When a chosen supply source, buyer, carrier, or destination becomes poor or unavailable, develop a workable alternative without losing sight of the original squad objective.',
        why:'Operations continue even when markets or staging assumptions change.',
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
        objective:'Coordinate at least two Commanders through a current squad haul or carrier job. Track contributions and remaining quantity well enough to prevent major duplicate/overshoot work.',
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
        objective:'Have another trader write a small logistics plan. Review it for quantities, access, attribution, staging, stop conditions, and contingency, then let them revise and own the final version.',
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
