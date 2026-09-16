export const CARRIER_LOGISTICS_ACTIVITY_ID = 'carrier-logistics';

const CARRIERS = '/carriers/';
const TRADING = '/trading/';
const PROJECTS = '/projects/';

export const CARRIER_LOGISTICS_ROUTES = [
  {
    id:'carrier-foundations',
    band:'Beginner',
    title:'Carrier Foundations — Join the Operation',
    subtitle:'Learn the carrier network by using it: identify the right carrier, read a coordination post, move cargo for it, and follow the operation through to completion.',
    audience:'For a Commander who has little or no experience supporting fleet-carrier logistics. Owning a carrier is not required.',
    outcome:'Graduate by contributing correctly to a carrier logistics job and understanding how the carrier registry and coordination board tell you what to do next.',
    sourceNote:'Beginner Carrier Logistics is action-first. Each assignment introduces one concrete part of the workflow before deeper jump planning, tritium math, staging, and coordination appear in later routes.',
    sources:[{ label:'Carrier Registry & Coordination', url:CARRIERS }],
    tasks:[
      {
        id:'carrier-foundations-find', stage:'Find', type:'learn', title:'Find one Mongrel carrier',
        objective:'Open the Carrier Registry and identify one carrier by its name, callsign, owner, and current reported system.',
        why:'Carrier names can change or be duplicated. The callsign is the reliable identity you will use to make sure you are working with the correct carrier.',
        checklist:['Carrier name found.','Callsign found.','Owner identified.','Current system identified.'],
        link:{ label:'Open Carrier Registry', url:CARRIERS },
      },
      {
        id:'carrier-foundations-read-post', stage:'Read', type:'learn', title:'Read one active coordination post',
        objective:'Find an active carrier coordination post and identify what the carrier is doing, its current status, and what help is being requested.',
        why:'The coordination post is the operational instruction. Learn to read the job before moving cargo or travelling to the carrier.',
        checklist:['Activity identified.','Current status identified.','Requested help understood.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'carrier-foundations-load', stage:'Load', type:'demonstrate', title:'Load cargo onto a carrier',
        objective:'Join a real loading job when one is available and move at least one load of the requested commodity onto the correct carrier. If no live loading job exists, arrange a short practice transfer with a Mongrel carrier owner.',
        why:'Carrier logistics starts with putting the right cargo on the right carrier.',
        checklist:['Correct carrier verified.','Correct commodity moved.','At least one load transferred.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'carrier-foundations-status', stage:'Check', type:'demonstrate', title:'Check the operation before your next load',
        objective:'Before making another cargo run, check the coordination post again and confirm the carrier status and remaining quantity have not changed.',
        why:'Shared logistics changes while you are flying. Re-checking the post prevents wasted trips and over-delivery.',
        checklist:['Post checked again.','Status confirmed.','Remaining amount checked if the job uses one.'],
      },
      {
        id:'carrier-foundations-unload', stage:'Unload', type:'demonstrate', title:'Unload cargo from a carrier',
        objective:'Join a real unloading job and move at least one load from the carrier to the requested destination. If no live unload is available, arrange a small practice unload with a Mongrel carrier owner.',
        why:'Loading and unloading are different halves of the same logistics chain. A useful carrier crew member should be comfortable with both.',
        checklist:['Correct carrier verified.','Correct destination verified.','At least one load delivered.'],
      },
      {
        id:'carrier-foundations-jump', stage:'Move', type:'challenge', title:'Ride one carrier relocation',
        objective:'Board a Mongrel carrier before a planned relocation and remain aboard for at least one carrier jump. Confirm the destination after arrival.',
        why:'Experiencing a jump makes departure timing, boarding, destination checks, and carrier movement much easier to understand than reading about them.',
        checklist:['Correct carrier boarded before departure.','At least one carrier jump completed.','Destination confirmed after arrival.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'carrier-foundations-graduate', stage:'Graduate', type:'challenge', title:'Support a carrier job without step-by-step help',
        objective:'Choose an active carrier loading, unloading, relocation-support, project-support, or tritium job and contribute correctly without someone telling you each step.',
        why:'Beginner Carrier Logistics is complete when you can read the board, find the carrier, and contribute to the operation independently.',
        checklist:['Job selected independently.','Correct carrier and task verified.','Contribution completed.','Operation status respected.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
    ],
  },
  {
    id:'carrier-crew-operator',
    band:'Developing',
    title:'Carrier Crew — Load, Move, Unload',
    subtitle:'Become a reliable carrier crew member who can follow quantities, departure timing, movement status, and delivery instructions through a complete logistics chain.',
    audience:'For Commanders who can already help with basic carrier jobs and want to become dependable through the entire operation.',
    outcome:'Graduate by following one cargo operation from loading through movement to final unloading while keeping your actions aligned with the live coordination post.',
    sourceNote:'This route develops operational discipline rather than carrier ownership. The Commander learns to stay synchronized with a shared job as its status changes.',
    sources:[{ label:'Carrier Coordination', url:CARRIERS },{ label:"Trader's Outpost", url:TRADING }],
    tasks:[
      {
        id:'carrier-crew-quantity', stage:'Quantity', type:'demonstrate', title:'Work from the remaining quantity',
        objective:'Join a carrier cargo job with a target quantity and check the remaining amount before each of at least three loads.',
        why:'Carrier crews create problems when everyone keeps hauling from the original target after other Commanders have already contributed.',
        checklist:['Remaining amount checked before each load.','At least three loads completed or job finished first.','No avoidable large overshoot.'],
      },
      {
        id:'carrier-crew-departure', stage:'Timing', type:'demonstrate', title:'Plan around a departure time',
        objective:'Join a relocation with a posted departure time. Be aboard or clear of the carrier as appropriate before departure without requiring a last-minute reminder.',
        why:'Carrier movement is shared infrastructure. Missing the departure window can strand cargo, ships, or people on the wrong side of the operation.',
        checklist:['Departure time checked.','Your plan made before the final minutes.','You were in the intended place when the carrier departed.'],
      },
      {
        id:'carrier-crew-status', stage:'Status', type:'demonstrate', title:'Follow the carrier through its status changes',
        objective:'During one operation, observe the coordination post move through at least three useful states such as Planned, Loading, Ready, In Transit, On Station, or Complete.',
        why:'The status tells the squad what work is useful now. A good crew member changes behavior as the operation changes phase.',
        checklist:['At least three states observed.','You can explain what action was appropriate in each.'],
      },
      {
        id:'carrier-crew-stage', stage:'Stage', type:'challenge', title:'Stage yourself for the next phase',
        objective:'Before a carrier reaches its next phase, place your hauling ship, cargo, or personal location where it will be useful immediately after the transition.',
        why:'Good staging reduces dead time between loading, movement, and unloading.',
        checklist:['Next phase identified.','You staged before the transition.','You could begin useful work quickly afterward.'],
      },
      {
        id:'carrier-crew-tritium', stage:'Fuel', type:'demonstrate', title:'Contribute to a Tritium request',
        objective:'When a Tritium request is available, deliver at least one load to the requested carrier or staging location. If no live request exists, complete a small practice Tritium transfer with a carrier owner.',
        why:'Tritium is the fuel behind carrier movement. Crew members should understand that relocation depends on a real fuel supply chain.',
        checklist:['Correct carrier or staging location verified.','Tritium delivered.','Contribution amount known.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'carrier-crew-chain', stage:'Chain', type:'challenge', title:'Follow one cargo operation end to end',
        objective:'Participate in a carrier cargo operation from loading through at least one relocation and into final unloading or delivery.',
        why:'The full chain shows how carrier logistics turns many local hauls into one larger movement.',
        checklist:['Loading phase supported.','Relocation followed.','Unload/delivery phase supported.'],
      },
      {
        id:'carrier-crew-graduate', stage:'Graduate', type:'challenge', title:'Operate as a self-directed carrier crew member',
        objective:'Join a carrier operation, determine the useful current task from the coordination post, contribute, and stop or switch tasks when the post changes without needing direct instructions.',
        why:'A reliable carrier crew member reduces coordination overhead instead of creating more of it.',
        checklist:['Useful task identified independently.','Contribution completed.','Status re-checked.','Work stopped or changed at the correct time.'],
      },
    ],
  },
  {
    id:'carrier-cargo-coordinator',
    band:'Developing / Experienced',
    title:'Cargo Coordinator — Stage, Measure, Control',
    subtitle:'Learn to turn several haulers and a carrier into one controlled cargo pipeline with clear quantities, staging, reporting, and stop conditions.',
    audience:'For experienced haulers or carrier crew who want to coordinate cargo flow rather than only contribute individual loads.',
    outcome:'Graduate by planning and coordinating a measurable carrier cargo job for multiple Commanders without losing track of what remains.',
    sourceNote:'This route focuses on cargo throughput and coordination. Carrier jump range and Tritium planning are developed more deeply in Movement Planner.',
    sources:[{ label:'Carrier Coordination', url:CARRIERS },{ label:'Projects & Events', url:PROJECTS },{ label:"Trader's Outpost", url:TRADING }],
    tasks:[
      {
        id:'carrier-cargo-target', stage:'Target', type:'demonstrate', title:'Define one measurable cargo target',
        objective:'For a real or realistic carrier job, define the commodity, total quantity, source, carrier, and final destination in one clear plan.',
        why:'Cargo coordination fails quickly when different Commanders are solving slightly different objectives.',
        checklist:['Commodity explicit.','Quantity explicit.','Source identified.','Carrier identified.','Destination identified.'],
      },
      {
        id:'carrier-cargo-stage', stage:'Stage', type:'challenge', title:'Choose a useful carrier staging location',
        objective:'Choose where the carrier should sit for a loading or unloading phase based primarily on reducing hauler travel and keeping the operation practical.',
        why:'A carrier can remove enormous travel time if it is staged intelligently, or add unnecessary travel if it is not.',
        checklist:['Hauler travel considered.','Carrier access considered.','Staging choice explained.'],
      },
      {
        id:'carrier-cargo-reporting', stage:'Report', type:'wing', title:'Use one reporting unit for everyone',
        objective:'Coordinate at least two haulers and have every contribution reported in the same unit, normally tonnes, so the remaining requirement can be updated reliably.',
        why:'Shared reporting is what turns separate cargo runs into one controlled operation.',
        checklist:['At least two haulers involved.','Reporting unit agreed.','Contributions tracked consistently.'],
      },
      {
        id:'carrier-cargo-remaining', stage:'Control', type:'challenge', title:'Keep the remaining amount accurate',
        objective:'During a live or simulated loading/unloading job, maintain the remaining quantity closely enough that the team can tell whether another full load is still useful.',
        why:'The last few loads are where uncontrolled operations most often overshoot.',
        checklist:['Remaining quantity updated.','Haulers could make go/stop decisions from it.','Large avoidable overshoot prevented.'],
      },
      {
        id:'carrier-cargo-bottleneck', stage:'Diagnosis', type:'challenge', title:'Find the cargo-pipeline bottleneck',
        objective:'Identify whether the limiting factor is source supply, station distance, hauler count, cargo capacity, docking, carrier position, destination access, or another measurable constraint. Change one thing to improve it.',
        why:'More haulers do not automatically make a poorly arranged pipeline faster.',
        checklist:['Primary bottleneck identified.','One targeted change made.','Effect observed or estimated.'],
      },
      {
        id:'carrier-cargo-replan', stage:'Adapt', type:'challenge', title:'Re-plan when the cargo source or destination changes',
        objective:'When a source, destination, quantity, or priority changes, update the cargo plan and tell the haulers exactly what changed without rebuilding the entire operation from scratch.',
        why:'Carrier logistics should absorb changing conditions without losing operational clarity.',
        checklist:['Change identified.','Revised instruction concise.','Existing useful work preserved where possible.'],
      },
      {
        id:'carrier-cargo-graduate', stage:'Graduate', type:'wing', title:'Coordinate a complete loading or unloading job',
        objective:'Coordinate a real or realistic carrier cargo job involving at least two haulers from initial target through completion or clean handoff.',
        why:'The route is complete when you can keep cargo, people, and remaining quantity synchronized through the whole job.',
        checklist:['At least two haulers coordinated.','Target and remaining quantity tracked.','Operation completed or handed off cleanly.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
    ],
  },
  {
    id:'carrier-movement-planner',
    band:'Experienced',
    title:'Movement Planner — Jumps, Tritium, Timing',
    subtitle:'Plan carrier relocation as an operational movement: route, fuel, departure windows, passengers, cargo, arrival staging, and contingencies.',
    audience:'For Commanders who understand carrier cargo operations and want to plan movements. You may use your own carrier or work with a Mongrel carrier owner.',
    outcome:'Graduate by planning and executing or supervising a multi-jump carrier relocation with enough Tritium, clear timing, and a useful arrival state.',
    sourceNote:'Carrier ownership is optional. Non-owners can plan alongside an owner and demonstrate the same operational reasoning.',
    sources:[{ label:'Carrier Registry & Coordination', url:CARRIERS }],
    tasks:[
      {
        id:'carrier-movement-destination', stage:'Destination', type:'demonstrate', title:'Choose the carrier destination for a reason',
        objective:'For a real or realistic operation, choose a destination system that supports the next objective rather than moving the carrier merely because it can move.',
        why:'Every carrier jump costs time and fuel. Movement should place the carrier where it creates operational value.',
        checklist:['Next objective identified.','Destination supports it.','Reason for moving is explicit.'],
      },
      {
        id:'carrier-movement-route', stage:'Route', type:'challenge', title:'Plan a multi-jump route',
        objective:'Plan a carrier relocation requiring multiple jumps. Identify the jump sequence and any important intermediate considerations before the first jump is scheduled.',
        why:'Long carrier movement is a route-planning problem, not a series of unrelated jump clicks.',
        checklist:['Jump sequence planned.','Intermediate stops considered.','Final destination verified.'],
      },
      {
        id:'carrier-movement-tritium', stage:'Fuel', type:'challenge', title:'Plan enough Tritium for the movement',
        objective:'Estimate the Tritium requirement for the planned relocation and include a sensible reserve rather than planning to arrive effectively empty.',
        why:'A carrier stranded short of fuel turns the logistics platform into the next logistics emergency.',
        checklist:['Fuel requirement estimated.','Reserve included.','Refuel source or contingency identified if needed.'],
      },
      {
        id:'carrier-movement-window', stage:'Timing', type:'demonstrate', title:'Publish a clear departure window',
        objective:'Create or draft a carrier coordination post that tells members when the carrier is expected to depart and what they need to do before that time.',
        why:'Passengers and haulers need enough warning to board, finish transfers, or avoid being carried somewhere unintentionally.',
        checklist:['Departure time/window clear.','Destination clear.','Required pre-departure action clear.'],
      },
      {
        id:'carrier-movement-preflight', stage:'Preflight', type:'challenge', title:'Run a carrier preflight check',
        objective:'Before departure, confirm destination, fuel, cargo state, expected passengers/ships, current coordination status, and what work should stop before the jump.',
        why:'The cheapest logistics mistake is the one caught before the jump timer starts.',
        checklist:['Destination confirmed.','Fuel confirmed.','Cargo state confirmed.','Member instructions checked.'],
      },
      {
        id:'carrier-movement-arrival', stage:'Arrival', type:'demonstrate', title:'Stage the carrier for useful work after arrival',
        objective:'After the relocation, place or plan the carrier so the next mining, trade, combat, project, expedition, or unloading phase can begin with minimal unnecessary travel.',
        why:'Arrival is not the end of the movement. The carrier moved to enable the next operation.',
        checklist:['Next phase identified.','Arrival location supports it.','Members know what becomes useful next.'],
      },
      {
        id:'carrier-movement-contingency', stage:'Adapt', type:'challenge', title:'Recover from a movement change',
        objective:'Handle a changed destination, insufficient fuel, missed departure, blocked staging plan, or another realistic movement problem by producing a revised plan that still supports the objective.',
        why:'Movement planning is valuable because plans sometimes fail.',
        checklist:['Problem identified.','Revised route or timing created.','Objective preserved where possible.'],
      },
      {
        id:'carrier-movement-graduate', stage:'Graduate', type:'challenge', title:'Plan and supervise a complete relocation',
        objective:'Plan and execute, or plan alongside the carrier owner, a real multi-jump relocation from initial objective through useful arrival staging.',
        why:'The qualification is being able to move the logistics platform deliberately, fueled, communicated, and ready for the next job.',
        checklist:['Route planned.','Tritium accounted for.','Departure communicated.','Movement completed.','Arrival supports next phase.'],
      },
    ],
  },
  {
    id:'carrier-logistics-lead',
    band:'Veteran / Mentor',
    title:'Carrier Logistics Lead — Plan, Recover, Teach',
    subtitle:'Turn carriers, haulers, fuel, timing, and squad communication into one reliable logistics system.',
    audience:'For veteran carrier operators and logistics Commanders who want to lead complex carrier-supported objectives and develop other Mongrels.',
    outcome:'Complete the route by leading a carrier-supported operation, solving a meaningful disruption, and leaving another Commander capable of running the next operation with less help.',
    sourceNote:'This is a development route, not an automatic squad rank. The measure is operational judgment, coordination, and knowledge transfer—not carrier ownership.',
    sources:[{ label:'Carrier Coordination', url:CARRIERS },{ label:'Projects & Events', url:PROJECTS },{ label:"Trader's Outpost", url:TRADING }],
    tasks:[
      {
        id:'carrier-lead-plan', stage:'Lead', type:'wing', title:'Design a carrier-supported operation',
        objective:'For a real or realistic objective, define what the carrier enables, where it should stage, what cargo or fuel is required, who needs to move it, when the carrier moves, and the final stop condition.',
        why:'A carrier is most useful when it is part of an operation rather than the operation itself.',
        checklist:['Objective explicit.','Carrier role explicit.','Cargo/fuel needs defined.','Movement timing defined.','Stop condition defined.'],
      },
      {
        id:'carrier-lead-coordination-post', stage:'Brief', type:'wing', title:'Write an executable coordination post',
        objective:'Create or draft a carrier coordination post that another Mongrel could act on without asking you to restate the plan in Discord.',
        why:'Good logistics scales through clear shared instructions.',
        checklist:['Carrier identified.','Status accurate.','Destination/timing clear if relevant.','Commodity/quantity clear if relevant.','Purpose and requested help clear.'],
        link:{ label:'Open Carrier Coordination', url:CARRIERS },
      },
      {
        id:'carrier-lead-coordinate', stage:'Operations', type:'wing', title:'Coordinate carriers and haulers together',
        objective:'Lead a live or realistic operation involving a carrier and at least two other Commanders. Keep movement, cargo work, and current status synchronized until completion or handoff.',
        why:'Carrier leadership is a coordination problem spanning both the capital asset and the ships supporting it.',
        checklist:['Carrier role coordinated.','At least two other Commanders involved.','Cargo/movement status stayed visible.','Operation completed or handed off cleanly.'],
      },
      {
        id:'carrier-lead-disruption', stage:'Diagnosis', type:'challenge', title:'Recover from a serious logistics disruption',
        objective:'Take an operation where a major assumption fails—fuel, route, source, destination, timing, carrier availability, or staffing—and revise the plan while minimizing wasted work.',
        why:'Veteran logistics leadership is most visible when the original plan stops working.',
        checklist:['Failed assumption identified.','Highest-impact consequence identified.','Revised plan communicated.','Useful work preserved where possible.'],
      },
      {
        id:'carrier-lead-bottleneck', stage:'Diagnosis', type:'challenge', title:'Diagnose the entire carrier logistics chain',
        objective:'Identify the dominant bottleneck across carrier position, jump timing, Tritium, source supply, hauler throughput, destination access, reporting, or coordination. Correct the highest-impact constraint first.',
        why:'The slowest part of the system determines the operation more than the carrier’s headline capability.',
        checklist:['Bottleneck supported by evidence.','Other likely causes considered.','Correction targets the limiting factor.'],
      },
      {
        id:'carrier-lead-mentor-crew', stage:'Mentor', type:'mentor', title:'Teach a Commander to run carrier crew duty independently',
        objective:'Give a less-experienced Mongrel a carrier job and coach them through finding the carrier, reading the coordination post, contributing, re-checking the status, and stopping or switching at the right time without doing the decisions for them.',
        why:'The squad benefits when carrier operations require less direct supervision over time.',
        checklist:['Learner reads the post themselves.','Learner identifies the correct task.','Learner re-checks status.','Learner can repeat the workflow independently.'],
      },
      {
        id:'carrier-lead-mentor-planner', stage:'Mentor', type:'mentor', title:'Let another Mongrel plan the movement',
        objective:'Have another Commander draft a carrier relocation including destination, route, Tritium, departure communication, and arrival staging. Review the reasoning, then let them revise and own the final plan.',
        why:'Movement planning only becomes transferable when the learner has to make the choices.',
        checklist:['Learner writes first plan.','Fuel/timing/staging reviewed.','Learner revises it.','Learner owns the final plan.'],
      },
      {
        id:'carrier-lead-capstone', stage:'Capstone', type:'wing', title:'Lead a carrier operation from objective to handoff',
        objective:'Lead a complete carrier-supported objective from planning through cargo/fuel preparation, movement, operational use, adjustment, and final delivery or handoff. Leave a short reusable operating note for the squad.',
        why:'The capstone combines carrier movement, cargo flow, communication, contingency, and succession into one operation.',
        checklist:['Objective completed or cleanly handed off.','Carrier movement/logistics coordinated.','At least two Commanders contributed.','A disruption or changing condition was handled if one occurred.','Reusable lesson documented.'],
        link:{ label:'Open Projects & Events', url:PROJECTS },
      },
    ],
  },
];

export function eligibleCarrierLogisticsRoutes(experience = 'new') {
  if (experience === 'experienced') return ['carrier-logistics-lead','carrier-movement-planner','carrier-cargo-coordinator','carrier-crew-operator'];
  if (experience === 'comfortable') return ['carrier-movement-planner','carrier-cargo-coordinator','carrier-crew-operator'];
  if (experience === 'some') return ['carrier-crew-operator','carrier-cargo-coordinator','carrier-foundations'];
  return ['carrier-foundations'];
}

export function getCarrierLogisticsRoute(id) {
  return CARRIER_LOGISTICS_ROUTES.find(route => route.id === id) || null;
}
