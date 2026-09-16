// Improve Power & Heat campaign — fifth goal-specific Engineering Campaign Planner chain.
//
// This campaign starts with power priorities and a measured thermal/power baseline
// before touching the Power Plant. Felicity can provide a small G1 win when she is
// already available; G2/G3 use any suitable higher-grade Power Plant engineer the
// Commander actually has rather than silently forcing one long Engineer-unlock path.

import { JUMP_RANGE_CAMPAIGN_FACTS } from './engineering-campaign-jump-range.js';

const INARA_FARSEER = 'https://inara.cz/elite/engineer/1/';
const INARA_MARCO = 'https://inara.cz/elite/engineer/7/';
const INARA_HERA = 'https://inara.cz/elite/engineer/12/';
const INARA_PP_ARMOURED = 'https://inara.cz/elite/blueprint/12/';
const INARA_PP_OVERCHARGED = 'https://inara.cz/elite/blueprint/13/';
const INARA_PP_LOW_EMISSIONS = 'https://inara.cz/elite/blueprint/14/';
const INARA_META_ALLOY = 'https://inara.cz/elite/commodity/101/';

const FIRST_WIN_FACTS = {
  scoutReady:'first-win.fsd.scout-ready',
  felicityUnlocked:'first-win.fsd.engineer-access-ready',
};

export const POWER_THERMAL_CAMPAIGN_FACTS = {
  powerPlantG2Ready:'engineer.power-plant.g2-ready',
  powerPlantG3Ready:'engineer.power-plant.g3-ready',
};

export function buildPowerThermalEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign || campaign.goalId !== 'power-thermal') return [];

  const hasFact = factId => Boolean(facts?.[factId]?.value);
  const firstProof = (...factIds) => factIds.find(hasFact) || '';

  const g3Proof = firstProof(POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG3Ready);
  const g2Proof = firstProof(g3Proof, POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG2Ready);
  const felicityProof = firstProof(
    g2Proof,
    JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready,
    JUMP_RANGE_CAMPAIGN_FACTS.felicityG2Ready,
    JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked,
    FIRST_WIN_FACTS.felicityUnlocked,
  );
  const scoutProof = felicityProof || firstProof(
    JUMP_RANGE_CAMPAIGN_FACTS.scoutReady,
    FIRST_WIN_FACTS.scoutReady,
  );

  const higherEngineerAlternates = [
    { factId:POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG2Ready, label:'I Already Have G2+ Power Plant Access' },
    { factId:POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG3Ready, label:'I Already Have G3+ Power Plant Access' },
  ];

  return [
    {
      id:'power-thermal.baseline',
      kind:'assess',
      title:'Measure the power or heat problem before changing anything',
      objective:'Record the current Power Plant, engineering, deployed/retracted power usage, and one practical thermal baseline. Use the situation that actually causes trouble: hardpoints deployed, repeated boosts, shield-cell use, fuel scooping, sustained weapons fire, silent running, or another real workload.',
      dependsOn:['campaign.map-dependencies'],
      meta:{
        stage:'Baseline',
        note:'“Runs hot” and “needs more power” are not the same diagnosis. Record what actually fails or overheats before choosing a blueprint.',
      },
    },
    {
      id:'power-thermal.priority-audit',
      kind:'plan',
      title:'Audit module priorities before engineering the plant',
      objective:'Check whether nonessential modules can safely move to lower power priorities or be disabled during the demanding phase of the ship’s role. Preserve critical flight, defensive, and escape systems. Do not engineer extra generation merely to keep every convenience module powered at all times.',
      dependsOn:['power-thermal.baseline'],
      meta:{
        stage:'Power Budget',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        note:'Module priorities are part of the build. A priority fix can solve a deployed-power problem with no Power Plant engineering at all.',
      },
    },
    {
      id:'power-thermal.priority-test',
      kind:'demonstrate',
      title:'Re-test the ship with the corrected power priorities',
      objective:'Repeat the same workload with the new priorities. Confirm that critical systems remain powered, hardpoint deployment behaves correctly, and the original failure is either solved or still measurable.',
      dependsOn:['power-thermal.priority-audit'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If module priorities solved the real problem and the ship’s thermal behavior is acceptable, complete the campaign here. Engineering a Power Plant is optional, not mandatory.',
      },
    },
    {
      id:'power-thermal.choose-blueprint',
      kind:'plan',
      title:'Choose the Power Plant job around the remaining problem',
      objective:'Choose deliberately. Armoured adds integrity with modest extra power and improved thermal efficiency at a mass cost. Low Emissions sacrifices power and adds mass for much better thermal handling. Overcharged adds the most power but worsens integrity and thermal efficiency. Use the coolest plant that still meets the ship’s real power requirement rather than treating Overcharged as the default.',
      dependsOn:['power-thermal.priority-test'],
      resourceHint:'engineering-power-plant',
      meta:{
        stage:'Build Plan',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        secondaryResources:[
          { label:'Inara · Armoured Power Plant', url:INARA_PP_ARMOURED },
          { label:'Inara · Low Emissions Power Plant', url:INARA_PP_LOW_EMISSIONS },
          { label:'Inara · Overcharged Power Plant', url:INARA_PP_OVERCHARGED },
        ],
        stoppingPoint:'Choose only enough engineering to solve the measured problem. Start with G1 if Felicity is already available; do not plan G5 by default.',
      },
    },
    {
      id:'power-thermal.plan-g1-materials',
      kind:'plan',
      title:'Plan only the Grade 1 Power Plant job',
      objective:'Use Inara or another trusted planner to calculate the materials for one complete G1 of the blueprint you chose. Keep G2+, the experimental, and unrelated Engineering materials off this first shopping list.',
      dependsOn:['power-thermal.choose-blueprint'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Material Plan',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
        note:'Felicity can apply Grade 1 Power Plant engineering. That gives an already-unlocked Commander a deliberately small first test before a larger Engineer-access project.',
      },
    },
    {
      id:'power-thermal.gather-g1-materials',
      kind:'prepare',
      title:'Gather only the planned G1 materials',
      objective:'Acquire or trade for the exact G1 material requirement and stop. If your inventory already covers it, mark this step complete immediately.',
      dependsOn:['power-thermal.plan-g1-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Targeted Gathering',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
        stoppingPoint:'Once G1 is funded, leave material gathering and move on.',
      },
    },
    {
      id:'power-thermal.felicity.scout',
      kind:'prepare',
      title:'Reach Exploration rank Scout only if Felicity is still locked',
      objective:'Felicity Farseer requires Exploration rank Scout or higher before she will meet you. Existing First Engineering Win, Jump Range, Mobility, or higher-grade Power Plant access clears this automatically.',
      dependsOn:['power-thermal.gather-g1-materials'],
      factCompletion:{ factId:scoutProof || JUMP_RANGE_CAMPAIGN_FACTS.scoutReady, operator:'truthy', target:true },
      backgroundActivities:['exploration'],
      meta:{
        stage:'Engineer Access',
        factActionLabel:'I Have Scout or Higher',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        alternateFacts:higherEngineerAlternates,
      },
    },
    {
      id:'power-thermal.felicity.meta-alloy',
      kind:'prepare',
      title:'Get one Meta-Alloy only if Felicity is still locked',
      objective:'If Felicity is not yet unlocked, verify a current source and acquire exactly one Meta-Alloy. Existing Felicity or higher-grade Power Plant access proves this step is unnecessary.',
      dependsOn:['power-thermal.felicity.scout'],
      factCompletion:felicityProof ? { factId:felicityProof, operator:'truthy', target:true } : null,
      meta:{
        stage:'Engineer Access',
        resourceUrl:INARA_META_ALLOY,
        resourceLabel:'Meta-Alloys on Inara',
        requirement:'1 Meta-Alloy if Felicity is still locked',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, label:'I Already Unlocked Felicity' },
          ...higherEngineerAlternates,
        ],
      },
    },
    {
      id:'power-thermal.felicity.deciat-safety',
      kind:'prepare',
      title:'Prepare for Deciat only if the unlock is still ahead',
      objective:'Before carrying the Meta-Alloy into Deciat in Open, make sure you can afford the rebuy, protect exploration data you do not want to lose, and preselect a high-wake escape option. Ask the Mongrels for escort support if desired.',
      dependsOn:['power-thermal.felicity.meta-alloy'],
      factCompletion:felicityProof ? { factId:felicityProof, operator:'truthy', target:true } : null,
      meta:{
        stage:'Safety',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        note:'Arriving safely is the objective. Fighting another Commander is not required.',
        alternateFacts:higherEngineerAlternates,
      },
    },
    {
      id:'power-thermal.felicity.unlock',
      kind:'unlock',
      title:'Unlock Felicity Farseer',
      objective:'Provide the Meta-Alloy at Farseer Inc and unlock Felicity. If another campaign already recorded her unlock, or you already have a G2+ Power Plant Engineer available, this clears automatically.',
      dependsOn:['power-thermal.felicity.deciat-safety'],
      factCompletion:{ factId:felicityProof || JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'Felicity is unlocked',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        alternateFacts:higherEngineerAlternates,
        stoppingPoint:'Unlocking Felicity is a complete session-sized win. You can stop here.',
      },
    },
    {
      id:'power-thermal.refresh-g1-materials',
      kind:'plan',
      title:'Check the exact G1 material shortfall',
      objective:'Refresh the G1 plan once with the Engineer access you actually have. If your first gather covers it, move on. If you are short, acquire only the missing amount.',
      dependsOn:['power-thermal.felicity.unlock'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Final Material Check',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
      },
    },
    {
      id:'power-thermal.plant.g1',
      kind:'engineer',
      title:'Apply one complete Grade 1 Power Plant upgrade',
      objective:'Apply G1 of the chosen blueprint and stop. Do not continue simply because a higher-grade Engineer is available; the next job is to repeat the same power/thermal test.',
      dependsOn:['power-thermal.refresh-g1-materials'],
      meta:{
        stage:'Engineer',
        stoppingPoint:'G1 is intentionally small. It is enough to learn whether the chosen direction is helping before committing to a longer access or material job.',
      },
    },
    {
      id:'power-thermal.test.g1',
      kind:'demonstrate',
      title:'Re-run the workload after G1',
      objective:'Repeat the same deployed-power and thermal test. Compare idle/normal heat, the demanding workload, power headroom, and any heat spike that originally caused trouble.',
      dependsOn:['power-thermal.plant.g1'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If G1 solves the real problem, complete the campaign here. A bigger Engineer-unlock project is unnecessary.',
      },
    },
    {
      id:'power-thermal.g2-access',
      kind:'unlock',
      title:'Confirm a Grade 2+ Power Plant Engineer only if the ship still needs more',
      objective:'If the G1 test still leaves a meaningful problem, use a Power Plant Engineer who can reach G2 or higher. Marco Qwent, Hera Tani, and Etienne Dorn can all exceed Felicity’s G1 limit. If none is currently available, treat unlocking one as a separate Engineer Network project instead of hiding that potentially long chain inside this campaign.',
      dependsOn:['power-thermal.test.g1'],
      factCompletion:{ factId:g2Proof || POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG2Ready, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'I Have G2+ Power Plant Access',
        resourceUrl:INARA_MARCO,
        resourceLabel:'Marco Qwent on Inara',
        secondaryResources:[
          { label:'Hera Tani on Inara', url:INARA_HERA },
          { label:'All Engineers on Inara', url:'https://inara.cz/elite/engineers/' },
        ],
        note:'This campaign does not force one universal unlock route. Use the higher-grade Power Plant Engineer you already have or deliberately choose the shortest Engineer Network path for your account.',
        alternateFacts:[
          { factId:POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG3Ready, label:'I Already Have G3+ Power Plant Access' },
        ],
      },
    },
    {
      id:'power-thermal.plan-g2-materials',
      kind:'plan',
      title:'Plan only the remaining G2 materials',
      objective:'Calculate the materials needed to move the chosen Power Plant blueprint from its current result through complete G2. Do not append the experimental or G3–G5.',
      dependsOn:['power-thermal.g2-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
      },
    },
    {
      id:'power-thermal.gather-g2-materials',
      kind:'prepare',
      title:'Gather only the G2 shortfall',
      objective:'Acquire or trade for the remaining G2 materials and stop once that plan is covered.',
      dependsOn:['power-thermal.plan-g2-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
      },
    },
    {
      id:'power-thermal.plant.g2',
      kind:'engineer',
      title:'Take the Power Plant to G2',
      objective:'Apply the chosen blueprint through complete G2, then stop and test. Keep the same blueprint unless the G1 result proved the original diagnosis was wrong.',
      dependsOn:['power-thermal.gather-g2-materials'],
      meta:{
        stage:'Optional Refinement',
        stoppingPoint:'G2 is a legitimate Power Plant win. Test before adding an experimental or another grade.',
      },
    },
    {
      id:'power-thermal.test.g2',
      kind:'demonstrate',
      title:'Test the G2 Power Plant under the same load',
      objective:'Repeat the same workload and compare power headroom, sustained heat, heat spikes, and critical-system behavior with the original baseline and G1 result.',
      dependsOn:['power-thermal.plant.g2'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If G2 solves the measured power/thermal problem, complete the campaign here. The experimental and G3 are optional.',
      },
    },
    {
      id:'power-thermal.experimental.plan',
      kind:'plan',
      title:'Choose the Power Plant experimental as a separate job',
      objective:'If the ship still needs a secondary adjustment, choose the experimental around that remaining problem. Thermal Spread improves heat efficiency; Monstered adds power at a mass cost; Double Braced adds integrity; Stripped Down reduces mass. Do not use Monstered merely because more megawatts look better on paper.',
      dependsOn:['power-thermal.test.g2'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Experimentals',
        note:'The experimental is split out because power, heat, mass, and integrity are different build problems.',
        stoppingPoint:'If G2 already solved the problem, finish the campaign instead.',
      },
    },
    {
      id:'power-thermal.experimental.materials',
      kind:'prepare',
      title:'Gather only the chosen experimental materials',
      objective:'Acquire the exact materials for the experimental you selected, then stop.',
      dependsOn:['power-thermal.experimental.plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Experimentals',
      },
    },
    {
      id:'power-thermal.experimental.apply',
      kind:'engineer',
      title:'Apply the chosen Power Plant experimental',
      objective:'Apply the experimental chosen for the ship’s remaining power, heat, mass, or integrity issue. Keep the choice tied to the measured problem.',
      dependsOn:['power-thermal.experimental.materials'],
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Experimentals',
      },
    },
    {
      id:'power-thermal.experimental.test',
      kind:'demonstrate',
      title:'Re-run the power and heat test with the experimental',
      objective:'Repeat the same workload and confirm the experimental improved the intended behavior rather than merely moving the problem somewhere else.',
      dependsOn:['power-thermal.experimental.apply'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'The G2 + experimental package may already be all this ship needs. G3 remains optional refinement.',
      },
    },
    {
      id:'power-thermal.g3-access',
      kind:'engineer',
      title:'Confirm G3 Power Plant access only if the ship still needs more',
      objective:'If the G2/experimental result still leaves a meaningful measured problem, raise or confirm your chosen higher-grade Power Plant Engineer only as far as G3. Do not turn this into a G5 unlock grind by default.',
      dependsOn:['power-thermal.experimental.test'],
      factCompletion:{ factId:g3Proof || POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG3Ready, operator:'truthy', target:true },
      meta:{
        stage:'Optional Refinement',
        factActionLabel:'I Have G3+ Power Plant Access',
        resourceUrl:INARA_MARCO,
        resourceLabel:'Marco Qwent on Inara',
        secondaryResources:[
          { label:'Hera Tani on Inara', url:INARA_HERA },
        ],
      },
    },
    {
      id:'power-thermal.plan-g3-materials',
      kind:'plan',
      title:'Plan only the remaining G3 materials',
      objective:'Calculate only the materials needed to move the chosen blueprint from the current result through complete G3. Do not append G4/G5.',
      dependsOn:['power-thermal.g3-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
      },
    },
    {
      id:'power-thermal.gather-g3-materials',
      kind:'prepare',
      title:'Gather only the G3 shortfall',
      objective:'Acquire or trade for the remaining G3 materials and stop once the plan is covered.',
      dependsOn:['power-thermal.plan-g3-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_PP_ARMOURED,
        resourceLabel:'Inara · Power Plant Engineering',
      },
    },
    {
      id:'power-thermal.plant.g3',
      kind:'engineer',
      title:'Take the Power Plant to G3 and stop',
      objective:'Apply the chosen blueprint through complete G3. Do not continue into G4/G5 as part of this campaign phase.',
      dependsOn:['power-thermal.gather-g3-materials'],
      meta:{
        stage:'Optional Refinement',
        stoppingPoint:'G3 is the end of this campaign phase. Higher grades should begin from a new measured need, not momentum.',
      },
    },
    {
      id:'power-thermal.test.g3',
      kind:'demonstrate',
      title:'Run the final G3 power and heat test',
      objective:'Repeat the original workload one final time. Confirm the ship now has the power headroom and thermal behavior you wanted without creating a worse mass, integrity, or efficiency tradeoff than the role can justify.',
      dependsOn:['power-thermal.plant.g3'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'End this campaign phase at G3. If the ship later needs G4/G5, start from the new measured problem rather than assuming more grade is automatically better.',
      },
    },
  ];
}
