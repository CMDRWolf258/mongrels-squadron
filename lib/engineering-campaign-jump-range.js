// Improve Jump Range campaign — second goal-specific Engineering Campaign Planner chain.
//
// This campaign deliberately targets a useful G2 Frame Shift Drive improvement first,
// then separates the range-focused experimental and optional G3 refinement into their
// own small jobs. Permanent progress from First Engineering Win can satisfy Felicity
// access gates so a Commander is never sent backward through work the site already knows.

const INARA_FARSEER = 'https://inara.cz/elite/engineer/1/';
const INARA_ENGINEERS = 'https://inara.cz/elite/engineers/';
const INARA_FSD_RANGE = 'https://inara.cz/elite/blueprint/2/';
const INARA_META_ALLOY = 'https://inara.cz/elite/commodity/101/';

export const JUMP_RANGE_CAMPAIGN_FACTS = {
  scoutReady:'rank.exploration.scout-or-higher',
  felicityUnlocked:'engineer.felicity-farseer.unlocked',
  felicityG2Ready:'engineer.felicity-farseer.fsd-g2-ready',
  felicityG3Ready:'engineer.felicity-farseer.fsd-g3-ready',
};

const FIRST_WIN_FACTS = {
  scoutReady:'first-win.fsd.scout-ready',
  felicityUnlocked:'first-win.fsd.engineer-access-ready',
  felicityG2Ready:'first-win.fsd.g2-access-ready',
};

export function buildJumpRangeEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign || campaign.goalId !== 'jump-range') return [];

  const hasFact = factId => Boolean(facts?.[factId]?.value);
  const firstProof = (...factIds) => factIds.find(hasFact) || '';

  // Later permanent access proves earlier gates were already satisfied. First
  // Engineering Win facts are accepted as proof for existing members so this new
  // campaign benefits from progress recorded before shared Felicity facts existed.
  const felicityAccessProof = firstProof(
    JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready,
    JUMP_RANGE_CAMPAIGN_FACTS.felicityG2Ready,
    FIRST_WIN_FACTS.felicityG2Ready,
    JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked,
    FIRST_WIN_FACTS.felicityUnlocked,
  );
  const scoutProof = felicityAccessProof || firstProof(
    JUMP_RANGE_CAMPAIGN_FACTS.scoutReady,
    FIRST_WIN_FACTS.scoutReady,
  );
  const g2Proof = firstProof(
    JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready,
    JUMP_RANGE_CAMPAIGN_FACTS.felicityG2Ready,
    FIRST_WIN_FACTS.felicityG2Ready,
  );

  return [
    {
      id:'jump-range.confirm-plan',
      kind:'plan',
      title:'Confirm the FSD job for this ship',
      objective:'Use the ship’s real role to confirm that Increased Range is the right Frame Shift Drive blueprint and decide what a useful stopping point looks like. Record the current drive, current engineering if any, and whether the priority is exploration range, cargo travel, combat travel, or general Bubble convenience.',
      dependsOn:['campaign.map-dependencies'],
      resourceHint:'engineering-fsd',
      meta:{
        stage:'Build Plan',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        secondaryResources:[
          { label:'Inara · Increased Range FSD', url:INARA_FSD_RANGE },
        ],
        note:'The campaign improves the ship you actually use. It does not assume every ship needs a max-grade exploration FSD.',
        stoppingPoint:'Plan around G2 first. G3 and the experimental remain separate decisions after you have flown the result.',
      },
    },
    {
      id:'jump-range.plan-g2-materials',
      kind:'plan',
      title:'Plan only the G1 → G2 Increased Range job',
      objective:'Use Inara or another trusted engineering planner to calculate only the materials needed to reach a complete G2 Increased Range modification at your current Felicity reputation. Do not add G3–G5 or the experimental materials to this first shopping list.',
      dependsOn:['jump-range.confirm-plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Material Plan',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · Increased Range FSD',
        note:'Define the job first, then gather for the job. This first material plan funds only the next useful improvement.',
      },
    },
    {
      id:'jump-range.gather-g2-materials',
      kind:'prepare',
      title:'Gather only the planned G2 materials',
      objective:'Acquire or trade for the materials in the G1 → G2 plan and stop when that small job is covered. If your current inventory already covers the plan, mark this step complete immediately.',
      dependsOn:['jump-range.plan-g2-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Targeted Gathering',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · Increased Range FSD',
        note:'This is a targeted FSD job, not a general material-cap grind.',
        stoppingPoint:'Once the estimated G1 → G2 job is covered, leave material gathering and move on.',
      },
    },
    {
      id:'jump-range.felicity.scout',
      kind:'prepare',
      title:'Reach Exploration rank Scout if Felicity still needs it',
      objective:'Felicity Farseer requires Exploration rank Scout or higher before she will meet you. If the site already knows you reached Scout or unlocked Felicity during First Engineering Win, this step clears automatically. Otherwise, reach Scout and record that permanent milestone.',
      dependsOn:['jump-range.gather-g2-materials'],
      factCompletion:{ factId:scoutProof || JUMP_RANGE_CAMPAIGN_FACTS.scoutReady, operator:'truthy', target:true },
      backgroundActivities:['exploration'],
      meta:{
        stage:'Engineer Access',
        factActionLabel:'I Have Scout or Higher',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        note:'Scout is an account-wide permanent rank threshold. Once recorded, later Engineering campaigns should never ask you to earn it again.',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, label:'I Already Unlocked Felicity' },
        ],
      },
    },
    {
      id:'jump-range.felicity.meta-alloy',
      kind:'prepare',
      title:'Get one Meta-Alloy only if Felicity is still locked',
      objective:'If Felicity is not yet unlocked, verify a current source and acquire exactly one Meta-Alloy for her unlock. If Felicity is already unlocked, this step clears from that permanent access proof instead of asking you to buy another one.',
      dependsOn:['jump-range.felicity.scout'],
      factCompletion:felicityAccessProof
        ? { factId:felicityAccessProof, operator:'truthy', target:true }
        : null,
      meta:{
        stage:'Engineer Access',
        resourceUrl:INARA_META_ALLOY,
        resourceLabel:'Meta-Alloys on Inara',
        requirement:'1 Meta-Alloy if Felicity is still locked',
        stoppingPoint:'You need one for the unlock, not a stockpile.',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, label:'I Already Unlocked Felicity' },
        ],
      },
    },
    {
      id:'jump-range.felicity.deciat-safety',
      kind:'prepare',
      title:'Prepare for the Deciat trip if the unlock is still ahead',
      objective:'Before carrying the Meta-Alloy into Deciat in Open, make sure you can afford the rebuy, protect exploration data you do not want to lose, know your high-wake escape option, and avoid lingering with the unlock cargo aboard. Ask the Mongrels for escort support if desired.',
      dependsOn:['jump-range.felicity.meta-alloy'],
      factCompletion:felicityAccessProof
        ? { factId:felicityAccessProof, operator:'truthy', target:true }
        : null,
      meta:{
        stage:'Safety',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        note:'Deciat is a well-known high-traffic Engineer system. The goal is to arrive safely; fighting another Commander is not required.',
        stoppingPoint:'Prepare the escape plan before the dangerous leg rather than inventing one under interdiction.',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, label:'Felicity Is Already Unlocked' },
        ],
      },
    },
    {
      id:'jump-range.felicity.unlock',
      kind:'unlock',
      title:'Unlock Felicity Farseer',
      objective:'At Farseer Inc in Deciat, provide the one Meta-Alloy and unlock Felicity. If station services do not appear immediately after the unlock, re-log before assuming something is wrong. If First Engineering Win already recorded the unlock, this step clears automatically.',
      dependsOn:['jump-range.felicity.deciat-safety'],
      factCompletion:{ factId:felicityAccessProof || JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'Felicity is unlocked',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        stoppingPoint:'Unlocking Felicity is a complete session-sized win. You can stop here.',
      },
    },
    {
      id:'jump-range.felicity.g2-access',
      kind:'engineer',
      title:'Open Grade 2 Increased Range access',
      objective:'Raise Felicity reputation only until Grade 2 Increased Range is available. Engineering useful modules and selling exploration data at Farseer Inc can raise her reputation. If First Engineering Win or an earlier campaign already proved G2+ access, skip this step automatically.',
      dependsOn:['jump-range.felicity.unlock'],
      factCompletion:{ factId:g2Proof || JUMP_RANGE_CAMPAIGN_FACTS.felicityG2Ready, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Reputation',
        factActionLabel:'G2 FSD access is ready',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready, label:'I Already Have G3+ FSD Access' },
        ],
      },
    },
    {
      id:'jump-range.refresh-g2-materials',
      kind:'plan',
      title:'Check the exact G2 material shortfall',
      objective:'Now that Felicity access and reputation are known, refresh the G1 → G2 material plan once. If your first gather already covers the job, mark this complete. If you are short, gather or trade only the missing amount.',
      dependsOn:['jump-range.felicity.g2-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Final Material Check',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · Increased Range FSD',
        note:'This catches reputation-dependent roll differences without turning the campaign into broad material farming.',
      },
    },
    {
      id:'jump-range.fsd.g2',
      kind:'engineer',
      title:'Take the FSD to G2 Increased Range',
      objective:'Apply Increased Range through a complete Grade 2 on the selected ship. Stop there even if higher grades are available; the next step is to measure the result.',
      dependsOn:['jump-range.refresh-g2-materials'],
      meta:{
        stage:'Engineer',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · Increased Range FSD',
        stoppingPoint:'G2 is a legitimate stopping point. Fly the ship before deciding whether more Engineering is worth the time.',
      },
    },
    {
      id:'jump-range.test.g2',
      kind:'demonstrate',
      title:'Replot a familiar trip and test the G2 result',
      objective:'Use the same ship and compare its new jump range and route length against the baseline you recorded. Pay attention to whether the actual travel problem improved, not just whether the outfitting number became larger.',
      dependsOn:['jump-range.fsd.g2'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If G2 makes the ship meaningfully easier to travel in, you may complete the campaign here. The experimental and G3 are optional follow-on improvements.',
      },
    },
    {
      id:'jump-range.experimental.plan',
      kind:'plan',
      title:'Choose the range-focused experimental as a separate job',
      objective:'If you want more range after the G2 test, compare Mass Manager and Deep Charge for this specific FSD size and ship. Mass Manager raises optimal mass; Deep Charge raises maximum fuel per jump. Use the planner result instead of assuming one experimental fits every drive.',
      dependsOn:['jump-range.test.g2'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · FSD Experimentals',
        note:'The experimental is intentionally separate so the Commander understands the choice rather than blindly copying a recipe.',
        stoppingPoint:'If G2 already solved the travel problem, finish the campaign instead.',
      },
    },
    {
      id:'jump-range.experimental.materials',
      kind:'prepare',
      title:'Gather only the chosen experimental materials',
      objective:'Gather or trade for the exact materials required by the experimental you selected. For Mass Manager or Deep Charge, Inara currently lists 5 Atypical Disrupted Wake Echoes, 3 Galvanising Alloys, and 1 Eccentric Hyperspace Trajectories.',
      dependsOn:['jump-range.experimental.plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · FSD Experimentals',
        stoppingPoint:'Gather for this one experimental and stop.',
      },
    },
    {
      id:'jump-range.experimental.apply',
      kind:'engineer',
      title:'Apply the chosen range-focused experimental',
      objective:'Apply the experimental selected for this drive and ship. Keep the choice tied to the actual range/travel goal rather than treating Mass Manager or Deep Charge as a universal rule.',
      dependsOn:['jump-range.experimental.materials'],
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · FSD Experimentals',
      },
    },
    {
      id:'jump-range.experimental.test',
      kind:'demonstrate',
      title:'Test the experimental and take another win',
      objective:'Recheck the same ship and comparable route after the experimental. Confirm that the added range is useful enough to justify any tradeoff, including Deep Charge fuel use or Mass Manager integrity loss.',
      dependsOn:['jump-range.experimental.apply'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'The G2 + experimental package may already be all this ship needs. G3 is optional refinement.',
      },
    },
    {
      id:'jump-range.felicity.g3-access',
      kind:'engineer',
      title:'Open Grade 3 only if the ship still needs more range',
      objective:'If the G2/experimental tests still leave a meaningful travel problem, raise Felicity reputation only enough to open Grade 3 Increased Range. If the ship already meets the goal, finish the campaign instead.',
      dependsOn:['jump-range.experimental.test'],
      factCompletion:{ factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready, operator:'truthy', target:true },
      meta:{
        stage:'Optional Refinement',
        factActionLabel:'G3 FSD access is ready',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
      },
    },
    {
      id:'jump-range.plan-g3-materials',
      kind:'plan',
      title:'Plan only the remaining G3 materials',
      objective:'Refresh the Increased Range crafting plan for Grade 3 and identify only the materials still required to complete that grade. Do not append G4 or G5 to the list.',
      dependsOn:['jump-range.felicity.g3-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · Increased Range FSD',
      },
    },
    {
      id:'jump-range.gather-g3-materials',
      kind:'prepare',
      title:'Gather only the G3 shortfall',
      objective:'Acquire or trade for only the materials missing from the G3 plan, then return to the ship. Do not let optional refinement become a general material grind.',
      dependsOn:['jump-range.plan-g3-materials'],
      meta:{
        stage:'Optional Refinement',
        stoppingPoint:'Stop gathering as soon as the G3 job is covered.',
      },
    },
    {
      id:'jump-range.fsd.g3',
      kind:'engineer',
      title:'Refine Increased Range to G3',
      objective:'Complete Grade 3 Increased Range on the same FSD and keep the existing experimental unless your deliberate build plan says otherwise.',
      dependsOn:['jump-range.gather-g3-materials'],
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_FSD_RANGE,
        resourceLabel:'Inara · Increased Range FSD',
      },
    },
    {
      id:'jump-range.test.g3',
      kind:'demonstrate',
      title:'Test the G3 result and end this campaign phase',
      objective:'Replot the familiar route one more time and compare the practical result with the original problem. Record whether this ship now travels the way you wanted before considering any later G4/G5 campaign.',
      dependsOn:['jump-range.fsd.g3'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'This phase is complete. G4/G5 can be a later deliberate goal instead of being silently appended here.',
      },
    },
  ];
}
