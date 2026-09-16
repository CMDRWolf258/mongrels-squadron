export const EXOBIOLOGY_ACTIVITY_ID = 'exobiology';

const EXPLORATION_HUB = '/activities/#exploration';
const RESOURCES = '/guides/resources/';
const GALLERY = '/gallery/?filter=Exobiology';
const PROJECTS = '/projects/';

export const EXOBIOLOGY_ROUTES = [
  {
    id:'exobiology-foundations',
    band:'Beginner',
    title:'First Bio Survey — Find, Sample, Sell',
    subtitle:'Use an Artemis suit and a ship you already trust to complete one entire exobiology loop from body selection through Vista Genomics.',
    audience:'For a Commander who is new to Odyssey exobiology or has sampled organisms before without really understanding biological signal selection, DSS heatmaps, terrain, sample spacing, and the return/sale loop.',
    outcome:'Graduate by independently selecting a suitable body, locating and completing at least one biological sample set, returning safely, and selling the data at Vista Genomics.',
    sourceNote:'This route teaches the complete exobiology loop before optimizing credits or chasing rare species. Exobiology overlaps with Exploration, but this route is about surface biology decisions rather than long-range travel itself.',
    sources:[
      { label:'Exploration & Discovery Hub', url:EXPLORATION_HUB },
      { label:'External Exploration Resources', url:RESOURCES },
      { label:'Mongrel Exobiology Gallery', url:GALLERY },
    ],
    tasks:[
      {
        id:'exobiology-foundations-kit', stage:'Prepare', type:'build', title:'Prepare a practical bio-survey loadout',
        objective:'Use a ship you already trust, equip an Artemis suit with its Genetic Sampler, and make sure the ship can map and land on the bodies you intend to survey. Bring an SRV only if you want it for mobility; it is useful, not mandatory.',
        why:'The first lesson is the workflow, not building a dedicated meta exobiology ship. You need surface access, a DSS, the correct suit, and a way to move safely between sample locations.',
        checklist:['Artemis suit available.','Genetic Sampler understood.','Detailed Surface Scanner fitted.','Ship can land on the target body.','Rebuy covered.','You chose ship/SRV/on-foot movement deliberately.'],
        link:{ label:'Open Exploration Resources', url:RESOURCES },
      },
      {
        id:'exobiology-foundations-select', stage:'Select', type:'learn', title:'Choose a body with biological signals yourself',
        objective:'Use the system map/FSS information to identify a landable body with biological signals, then choose one you can safely approach and survey without being handed a precise landing coordinate.',
        why:'Exobiology becomes repeatable when you can identify a candidate from system information rather than only following somebody else’s bookmark.',
        checklist:['Landable body selected.','Biological signals confirmed.','Gravity/terrain risk considered.','You can explain why this body is a reasonable first target.'],
      },
      {
        id:'exobiology-foundations-map', stage:'Map', type:'demonstrate', title:'Use the DSS biological heatmap',
        objective:'Map the body with the DSS, cycle the biological signal filters, and choose a landing area where the relevant heatmap and terrain give you a sensible chance of finding the organism.',
        why:'A blue biological region is a search area, not a waypoint. Reading the heatmap together with terrain is the bridge between orbital information and finding the organism on the ground.',
        checklist:['Body mapped with DSS.','Biological filters cycled deliberately.','Landing area chosen from heatmap plus terrain.','You understand that the heatmap does not mark an exact plant location.'],
      },
      {
        id:'exobiology-foundations-locate', stage:'Field Search', type:'demonstrate', title:'Find the organism without chasing one exact coordinate',
        objective:'Search the chosen terrain from ship, SRV, or on foot until you visually locate the target organism. Adjust altitude, speed, lighting, or search pattern if your first pass is ineffective.',
        why:'Surface search is a visual field skill. A Commander who can adapt the search pattern is much more self-sufficient than one who only knows a saved coordinate.',
        checklist:['Target organism located.','Search method adjusted at least once if needed.','Terrain and lighting were used rather than ignored.','You can relocate the ship or sample area if the first landing is poor.'],
      },
      {
        id:'exobiology-foundations-sample', stage:'Sample', type:'demonstrate', title:'Complete one genetic sample set correctly',
        objective:'Use the Genetic Sampler to collect the required three genetically distinct samples of one species. Move far enough between samples for the sampler to accept each new colony, and finish that species before beginning another incomplete sample set.',
        why:'The required spacing is species-dependent, so the important skill is reading the sampler feedback and moving intelligently rather than memorizing one universal distance.',
        checklist:['Three accepted samples collected for one species.','Sampler feedback used to judge spacing.','You did not repeatedly rescan the same colony.','The species sample set completed successfully.'],
      },
      {
        id:'exobiology-foundations-safety', stage:'Safety', type:'demonstrate', title:'Leave the surface with the data intact',
        objective:'Return to the ship safely after sampling and depart the body without turning a successful survey into a terrain, gravity, suit-power, or landing accident.',
        why:'Biological data only matters if you survive the surface operation and bring it back. Surface complacency is a real part of exobiology risk.',
        checklist:['Returned to ship safely.','Surface/gravity risk remained controlled.','Suit power was not allowed to become an emergency.','Ship departed without avoidable surface damage.'],
      },
      {
        id:'exobiology-foundations-sell', stage:'Sell', type:'demonstrate', title:'Sell the biological data at Vista Genomics',
        objective:'Return to a station or port with Vista Genomics access and sell the completed biological data. Compare the payout with the time and effort the survey required.',
        why:'The full exobiology loop ends at Vista Genomics. Seeing the actual payout helps you understand why some organisms or detours are worth more attention than others.',
        checklist:['Reached Vista Genomics safely.','Biological data sold.','You noted the payout.','You can name one thing that made the survey faster or slower than expected.'],
      },
      {
        id:'exobiology-foundations-graduate', stage:'Graduate', type:'challenge', title:'Repeat the entire bio loop independently',
        objective:'On another suitable body, independently select the target, map it, choose terrain, locate an organism, complete the sample set, return safely, and sell the data without following this route step-by-step.',
        why:'Graduation means you can create your own exobiology opportunity instead of only reproducing somebody else’s route.',
        checklist:['Body selected independently.','Landing/search area chosen independently.','Sample set completed.','Data returned and sold.','No essential step required a walkthrough.'],
        link:{ label:'Browse Mongrel Exobiology Gallery', url:GALLERY },
      },
    ],
  },
  {
    id:'exobiology-field-surveyor',
    band:'Developing',
    title:'Field Surveyor — Read Terrain & Signals',
    subtitle:'Turn one successful sample loop into a repeatable field method across different organisms, terrain, and body conditions.',
    audience:'For a Commander who can already complete a sample set and wants to become better at choosing landing areas, recognizing habitat clues, and moving between colonies without wasting the entire session searching.',
    outcome:'Graduate by surveying multiple organisms on a body or small group of bodies while demonstrating deliberate heatmap, terrain, search-pattern, and movement decisions.',
    sourceNote:'This route develops field judgement. It does not require a specific credit target or a particular rare genus; the skill is adapting the search to what the body actually presents.',
    sources:[
      { label:'Exploration & Discovery Hub', url:EXPLORATION_HUB },
      { label:'Mongrel Exobiology Gallery', url:GALLERY },
    ],
    tasks:[
      {
        id:'exobiology-surveyor-baseline', stage:'Baseline', type:'demonstrate', title:'Time one normal biological search',
        objective:'Complete one ordinary sample set and note approximate time from orbital mapping to the first sample, time between accepted colonies, movement method, and the biggest delay.',
        why:'“This genus is annoying” becomes actionable once you know whether the real problem was landing area, terrain, visibility, movement, or sample spacing.',
        checklist:['Map-to-first-sample time estimated.','Between-sample movement noted.','Movement method recorded.','Primary delay identified.'],
      },
      {
        id:'exobiology-surveyor-heatmap', stage:'Terrain', type:'challenge', title:'Compare two heatmap regions before landing',
        objective:'For one biological signal, inspect at least two plausible heatmap/terrain regions and choose between them deliberately. After searching, judge whether the selected terrain was actually productive.',
        why:'The broad heatmap can cover terrain where a genus is technically possible but practically difficult to spot. Comparing candidate regions improves landing judgement.',
        checklist:['Two candidate regions compared.','Terrain differences considered.','Landing choice explained.','Post-search judgement recorded.'],
      },
      {
        id:'exobiology-surveyor-search-pattern', stage:'Field Search', type:'demonstrate', title:'Use a repeatable search pattern',
        objective:'Search one area using a deliberate pattern—parallel passes, contour-following, ridge/valley sweeps, or another method—rather than random circling. Adjust the pattern if the organism’s habitat suggests a better approach.',
        why:'Random search makes poor terrain selection hard to distinguish from bad luck. A repeatable pattern helps you know when to keep searching and when to relocate.',
        checklist:['Search pattern chosen.','Pattern maintained long enough to evaluate.','Relocation decision made if appropriate.','You can explain why the organism was easier or harder to spot.'],
      },
      {
        id:'exobiology-surveyor-spacing', stage:'Sampling', type:'demonstrate', title:'Use sampler feedback instead of guessing colony distance',
        objective:'Complete sample sets for at least two different organisms while using the Genetic Sampler feedback to judge when you have moved far enough for genetic diversity. Compare how the required movement feels between the organisms.',
        why:'Different organisms demand different spacing. Learning the instrument feedback is more reliable than carrying one memorized distance into every survey.',
        checklist:['Two organisms completed.','Sampler feedback used deliberately.','Spacing behavior compared.','No universal-distance assumption used.'],
      },
      {
        id:'exobiology-surveyor-movement', stage:'Mobility', type:'challenge', title:'Compare ship, SRV, and on-foot movement where practical',
        objective:'On a suitable survey, compare at least two movement methods and decide which one best matches the terrain and organism spacing. Do not force an SRV or repeated ship hops when walking is clearly better, or vice versa.',
        why:'Exobiology efficiency is often a movement problem. The best method changes with visibility, terrain roughness, gravity, and colony spacing.',
        checklist:['At least two movement methods compared.','Terrain influenced the choice.','Sample turnaround time or ease compared.','Preferred method justified.'],
      },
      {
        id:'exobiology-surveyor-multi', stage:'Survey', type:'challenge', title:'Work a multi-species body without losing the plot',
        objective:'On a body with multiple biological signals, complete more than one species while deliberately deciding the order, landing changes, and when to stop searching for a stubborn target.',
        why:'A multi-species body tests whether you can manage several habitats and search costs without letting one difficult organism consume the entire session.',
        checklist:['Multiple species completed.','Order chosen deliberately.','At least one stop/relocate decision made.','Time was not sacrificed indefinitely to one target.'],
      },
    ],
  },
  {
    id:'exobiology-efficient-naturalist',
    band:'Developing / Experienced',
    title:'Efficient Naturalist — Find the Time Sink',
    subtitle:'Measure the complete surface workflow, identify where the minutes disappear, and improve that part without turning biology into a joyless credits-per-hour grind.',
    audience:'For a Commander who already finds and samples organisms reliably and wants better judgement about target selection, landing, search, movement, and when a biological detour is actually worth doing.',
    outcome:'Graduate by comparing two real survey sessions, changing one major bottleneck, and demonstrating a more efficient biological workflow while preserving the kind of exploration you actually enjoy.',
    sourceNote:'Efficiency here means less wasted effort, not maximum payout at any cost. Photography, discovery, unusual terrain, Codex completion, first-footfall opportunities, and squad scouting can all be valid reasons to accept a slower target.',
    sources:[
      { label:'Exploration & Discovery Hub', url:EXPLORATION_HUB },
      { label:'External Exploration Resources', url:RESOURCES },
    ],
    tasks:[
      {
        id:'exobiology-efficient-baseline', stage:'Baseline', type:'demonstrate', title:'Measure one complete exobiology stop',
        objective:'For one body, record approximate time for orbital detour, DSS mapping, landing/search, the three-sample cycle, return to ship, and any relocation. Also record how many species you completed.',
        why:'The slowest part may be supercruise, bad landing choice, colony spacing, or searching—not the sampling animation itself.',
        checklist:['Orbital/detour time noted.','Search/landing time noted.','Sampling movement time noted.','Relocations noted.','Primary bottleneck named.'],
      },
      {
        id:'exobiology-efficient-target-rule', stage:'Selection', type:'challenge', title:'Create a biological detour rule',
        objective:'Define what makes you accept or reject a biological stop based on your real objective: value, novelty, first-footfall potential, Codex interest, terrain, number of signals, distance, photography, or squad reconnaissance. Use the rule for one session.',
        why:'Stopping for every biological signal can erase the purpose of an expedition; skipping all of them wastes opportunities. A rule keeps the choice intentional.',
        checklist:['Detour rule defined.','At least one target accepted.','At least one target rejected.','Rule matched the purpose of the trip.'],
      },
      {
        id:'exobiology-efficient-landing', stage:'Landing', type:'demonstrate', title:'Reduce bad landings and unnecessary relocations',
        objective:'Use orbital terrain, heatmaps, approach angle, and low-altitude visual inspection to choose a better first landing area. Compare the result with your baseline search.',
        why:'A strong landing choice can save more time than driving faster after a poor one.',
        checklist:['Landing selected deliberately.','Low-altitude inspection used where helpful.','Unnecessary relocation reduced or understood.','Result compared with baseline.'],
      },
      {
        id:'exobiology-efficient-three-sample', stage:'Sampling', type:'challenge', title:'Optimize the three-sample loop, not one plant',
        objective:'Once the first colony is found, choose movement and direction with the next two genetically distinct samples in mind. Avoid returning repeatedly to the same terrain patch or colony cluster.',
        why:'Finding sample one is only the start. Good field movement anticipates the whole genetic set.',
        checklist:['Three-sample path planned as a sequence.','Duplicate/too-close colonies recognized quickly.','Movement method matched spacing/terrain.','Full set completed with fewer dead movements.'],
      },
      {
        id:'exobiology-efficient-stop', stage:'Judgement', type:'challenge', title:'Abandon one bad search on purpose',
        objective:'During a real session, recognize one survey where the current landing/search is no longer worth the time. Relocate, switch target, or leave the body, then explain the evidence behind the decision.',
        why:'Persistence is useful until it becomes sunk-cost behavior. Experienced exobiology includes knowing when the current approach is simply bad.',
        checklist:['Stop condition recognized.','Decision based on evidence, not frustration alone.','A better alternative chosen.','You can explain what would make you try that target again later.'],
      },
      {
        id:'exobiology-efficient-rerun', stage:'Compare', type:'challenge', title:'Re-run after changing the real bottleneck',
        objective:'Complete a comparable second biological stop after changing the bottleneck you identified. Compare time, frustration, number of relocations, or another meaningful measure without reducing the result to credits alone.',
        why:'One measured improvement teaches more than copying a “fast exobiology” routine that may not fit your ship, terrain, or goals.',
        checklist:['Comparable second stop completed.','One major change tested.','At least one meaningful result compared.','Change kept, reverted, or refined based on evidence.'],
      },
    ],
  },
  {
    id:'exobiology-target-specialist',
    band:'Experienced',
    title:'Target Specialist — Hunt Biology With a Purpose',
    subtitle:'Use system/body information, terrain expectations, route context, and documentation to search deliberately for valuable or unusual biological targets.',
    audience:'For an experienced exobiologist who wants to move beyond opportunistic sampling into purposeful target hunting, reconnaissance, Codex/discovery goals, or expedition-support biology.',
    outcome:'Graduate by planning and completing a purposeful biological search, documenting both successful and rejected targets well enough that another Mongrel could use the result.',
    sourceNote:'This route is about target intelligence and repeatability, not guaranteeing a rare species. A failed search can still be good reconnaissance if the criteria and result are documented clearly.',
    sources:[
      { label:'External Exploration Resources', url:RESOURCES },
      { label:'Projects & Expeditions', url:PROJECTS },
      { label:'Mongrel Exobiology Gallery', url:GALLERY },
    ],
    tasks:[
      {
        id:'exobiology-specialist-objective', stage:'Intel', type:'challenge', title:'Define a biological search objective',
        objective:'Choose a real objective such as a high-value survey, Codex gap, unusual genus, first-footfall opportunity, expedition region, photographic target, or colony-system reconnaissance. State what would count as a successful search before departing.',
        why:'Purposeful exobiology starts with criteria. Without them, any result can be rationalized after the fact and the search teaches very little.',
        checklist:['Objective stated.','Success criteria stated.','Search region or body criteria defined.','Reason the target matters explained.'],
      },
      {
        id:'exobiology-specialist-shortlist', stage:'Research', type:'challenge', title:'Build a candidate shortlist before you fly',
        objective:'Use current galaxy/body information and specialist tools to identify several candidate systems or bodies. Record why each candidate fits the objective and what would make you reject it on arrival.',
        why:'A shortlist turns long-range wandering into a testable reconnaissance plan while still leaving room for discovery.',
        checklist:['Several candidates identified.','Reason for each candidate recorded.','Reject criteria defined.','Route between candidates is practical.'],
        link:{ label:'Open External Exploration Resources', url:RESOURCES },
      },
      {
        id:'exobiology-specialist-ground-truth', stage:'Survey', type:'demonstrate', title:'Ground-truth the prediction',
        objective:'Visit the candidate targets and compare predicted usefulness with what the system map, DSS, terrain, and actual surface biology show. Record both hits and misses.',
        why:'Search tools narrow possibilities; they do not replace field verification. The mismatch between prediction and reality is valuable information.',
        checklist:['Multiple candidates checked.','At least one rejection documented.','At least one promising target surveyed deeply.','Prediction vs reality compared.'],
      },
      {
        id:'exobiology-specialist-document', stage:'Documentation', type:'challenge', title:'Create a reusable biological field report',
        objective:'Document one useful target with system/body name, signal/genus result, terrain/landing notes, search method, sample difficulty, and why another Commander might care. Include screenshots or coordinates when they materially help.',
        why:'Squad knowledge becomes useful when somebody else can act on it without repeating your entire search from scratch.',
        checklist:['System/body recorded.','Biology result recorded.','Terrain/search notes recorded.','Usefulness explained.','Enough detail exists for another Commander to repeat the survey.'],
      },
      {
        id:'exobiology-specialist-adapt', stage:'Adapt', type:'challenge', title:'Change the hunt after new evidence',
        objective:'Use what the first candidates taught you to change at least one search criterion, destination, landing expectation, or target priority, then test the revision on another candidate.',
        why:'Reconnaissance is not a fixed checklist. The best search plan gets sharper as evidence arrives.',
        checklist:['New evidence identified.','Search rule changed.','Revised candidate tested.','Result compared with the original assumption.'],
      },
      {
        id:'exobiology-specialist-share', stage:'Squad Support', type:'wing', title:'Turn the result into something another Mongrel can use',
        objective:'Share the field report, expedition recommendation, route note, or target warning with another Mongrel or appropriate squad resource. Explain what is known and what remains uncertain.',
        why:'Specialist reconnaissance has more value when it improves somebody else’s decision instead of living only in your personal bookmarks.',
        checklist:['Result shared.','Known facts separated from assumptions.','Uncertainty stated.','Another Commander could decide whether the target is worth visiting.'],
      },
    ],
  },
  {
    id:'exobiology-expedition-lead',
    band:'Veteran / Mentor',
    title:'Expedition Bio Lead — Survey, Coordinate, Teach',
    subtitle:'Design and lead biological reconnaissance that develops other Commanders and leaves useful squad knowledge behind.',
    audience:'For a veteran exobiologist who can already find, sample, select, and document biological targets independently and is ready to coordinate surveys or mentor others.',
    outcome:'Graduate by leading a small biological survey or expedition segment, adapting the plan once, mentoring another Commander through a field skill, and publishing a useful debrief.',
    sourceNote:'Veteran exobiology is not “collect a larger number of plants.” It is judgement, reconnaissance, coordination, teaching, and preserving what the group learned.',
    sources:[
      { label:'Projects & Expeditions', url:PROJECTS },
      { label:'Mongrel Exobiology Gallery', url:GALLERY },
      { label:'Exploration & Discovery Hub', url:EXPLORATION_HUB },
    ],
    tasks:[
      {
        id:'exobiology-lead-plan', stage:'Planning', type:'mentor', title:'Design a biological survey with a real objective',
        objective:'Create a small group survey or expedition segment with a biological objective, candidate-selection method, expected duration, minimum equipment, rendezvous assumptions, and a useful end product.',
        why:'“Go scan plants together” is an activity, not a survey plan. Leadership creates a reason to search and a result worth preserving.',
        checklist:['Biological objective defined.','Candidate method defined.','Minimum capability stated.','Time/commitment stated.','End product defined.'],
      },
      {
        id:'exobiology-lead-roles', stage:'Coordination', type:'wing', title:'Assign survey roles without removing discovery',
        objective:'Coordinate several Commanders so they can split systems/bodies, scout terrain, verify signals, or document results without forcing everyone to follow the same landing site in a line.',
        why:'A group survey is more powerful when Commanders search in parallel and share useful findings rather than duplicating every step.',
        checklist:['Responsibilities clear.','Duplicate effort reduced.','Rendezvous/comms plan clear.','Participants retain room for independent discovery.'],
      },
      {
        id:'exobiology-lead-operate', stage:'Wing / Team', type:'wing', title:'Run the survey and adapt once',
        objective:'Lead a meaningful survey segment and make at least one real adjustment based on poor candidate yield, difficult terrain, participant needs, unexpected biology, timing, or route conditions.',
        why:'The test of a survey plan is whether it can absorb new evidence without collapsing into random wandering.',
        checklist:['Group survey completed.','Progress/conditions monitored.','At least one real adjustment made.','Change communicated clearly.'],
      },
      {
        id:'exobiology-lead-quality', stage:'Quality Control', type:'challenge', title:'Verify one field report before the group relies on it',
        objective:'Review another participant’s biological report or recommendation for system/body identity, signal result, terrain notes, and uncertainty. Correct ambiguity before it becomes squad knowledge.',
        why:'Shared reconnaissance is only useful if location and conclusion are trustworthy enough for somebody else to act on.',
        checklist:['Report reviewed.','Location/result verified as far as practical.','Ambiguity corrected.','Uncertainty preserved instead of erased.'],
      },
      {
        id:'exobiology-lead-mentor', stage:'Teach / Mentor', type:'mentor', title:'Make another Commander more independent in the field',
        objective:'Mentor another Mongrel through one exobiology skill they could not confidently perform before: body selection, heatmap/terrain judgement, sample spacing, movement choice, target triage, or field documentation. Let them perform the skill themselves.',
        why:'The goal of mentoring is not to become somebody’s permanent waypoint generator. It is to improve their judgement until they no longer need one.',
        checklist:['One specific skill chosen.','Commander performed the skill themselves.','You corrected process/judgement rather than only giving the answer.','They can repeat it independently.'],
      },
      {
        id:'exobiology-lead-debrief', stage:'Debrief', type:'mentor', title:'Publish the biology lessons and next recommendation',
        objective:'Summarize useful discoveries, failed assumptions, terrain/search lessons, participant-development notes, and one concrete improvement for the next survey or expedition.',
        why:'A veteran survey should leave the squad with better biological knowledge and better exobiologists, not only a gallery folder.',
        checklist:['Useful discoveries preserved.','Failed assumptions recorded.','Operational lesson recorded.','Mentoring lesson recorded.','One next improvement recommended.'],
      },
    ],
  },
];

export function eligibleExobiologyRoutes(experience = 'new') {
  if (experience === 'experienced') return ['exobiology-expedition-lead','exobiology-target-specialist','exobiology-efficient-naturalist'];
  if (experience === 'comfortable') return ['exobiology-target-specialist','exobiology-efficient-naturalist','exobiology-field-surveyor'];
  if (experience === 'some') return ['exobiology-field-surveyor','exobiology-efficient-naturalist','exobiology-foundations'];
  return ['exobiology-foundations'];
}

export function getExobiologyRoute(id) {
  return EXOBIOLOGY_ROUTES.find(route => route.id === id) || null;
}
