// Improve Speed & Mobility campaign — third goal-specific Engineering Campaign Planner chain.
//
// This campaign targets a useful G2 Thrusters result first, then separates the
// experimental and optional G3 refinement into their own small jobs. Felicity
// Farseer access already recorded by First Engineering Win / Improve Jump Range
// is reused so members do not repeat the Scout / Meta-Alloy / Deciat unlock chain.

import { JUMP_RANGE_CAMPAIGN_FACTS } from './engineering-campaign-jump-range.js';

const INARA_FARSEER = 'https://inara.cz/elite/engineer/1/';
const INARA_THRUSTERS_DIRTY = 'https://inara.cz/elite/blueprint/4/';
const INARA_THRUSTERS_REINFORCED = 'https://inara.cz/elite/blueprint/5/';
const INARA_THRUSTERS_CLEAN = 'https://inara.cz/elite/blueprint/6/';
const INARA_META_ALLOY = 'https://inara.cz/elite/commodity/101/';

const FIRST_WIN_FACTS = {
  scoutReady:'first-win.fsd.scout-ready',
  felicityUnlocked:'first-win.fsd.engineer-access-ready',
  felicityG2Ready:'first-win.fsd.g2-access-ready',
};

export function buildMobilityEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign || campaign.goalId !== 'mobility') return [];

  const hasFact = factId => Boolean(facts?.[factId]?.value);
  const firstProof = (...factIds) => factIds.find(hasFact) || '';

  // Felicity reputation is shared across the modules she engineers. The legacy
  // FSD-named G2/G3 facts therefore legitimately prove that the same Engineer
  // access already exists for Thrusters.
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
      id:'mobility.baseline',
      kind:'assess',
      title:'Record how the ship moves now',
      objective:'Record the current Thrusters module and engineering, then note a simple baseline you can feel again later: boost speed, normal speed, turn response, boost interval, heat behavior, or how the ship handles near its usual combat/cargo mass.',
      dependsOn:['campaign.map-dependencies'],
      meta:{
        stage:'Baseline',
        note:'This campaign is about the way the ship actually flies, not just making the outfitting number larger.',
      },
    },
    {
      id:'mobility.choose-blueprint',
      kind:'plan',
      title:'Choose the Thrusters job around the ship’s role',
      objective:'Choose the blueprint deliberately. Dirty Drives trades integrity, heat and some mass-curve headroom for the strongest performance gain. Clean Drives gives a smaller performance gain with lower thruster thermal load. Reinforced prioritizes integrity and thermal behavior rather than speed. For a pure speed/mobility goal, Dirty is usually the comparison point, but confirm the whole ship before committing.',
      dependsOn:['mobility.baseline'],
      resourceHint:'engineering-thrusters',
      meta:{
        stage:'Build Plan',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        secondaryResources:[
          { label:'Inara · Dirty Thrusters', url:INARA_THRUSTERS_DIRTY },
          { label:'Inara · Clean Thrusters', url:INARA_THRUSTERS_CLEAN },
          { label:'Inara · Reinforced Thrusters', url:INARA_THRUSTERS_REINFORCED },
        ],
        stoppingPoint:'Pick the blueprint and a G2 stopping point first. Do not plan G5 by default.',
      },
    },
    {
      id:'mobility.plan-g2-materials',
      kind:'plan',
      title:'Plan only the G1 → G2 Thrusters job',
      objective:'Use Inara or another trusted planner to calculate only the materials needed to reach a complete G2 of the blueprint you chose. Do not add the experimental or G3–G5 to this first shopping list.',
      dependsOn:['mobility.choose-blueprint'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Material Plan',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Engineering',
        note:'Define the job first, then gather for the job. This first material plan funds only the next useful mobility improvement.',
      },
    },
    {
      id:'mobility.gather-g2-materials',
      kind:'prepare',
      title:'Gather only the planned G2 Thrusters materials',
      objective:'Acquire or trade for the materials in the G1 → G2 plan and stop when that small job is covered. If your inventory already covers it, mark the step complete immediately.',
      dependsOn:['mobility.plan-g2-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Targeted Gathering',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Engineering',
        stoppingPoint:'Once the planned G2 job is covered, leave material gathering and move on.',
      },
    },
    {
      id:'mobility.felicity.scout',
      kind:'prepare',
      title:'Reach Exploration rank Scout if Felicity still needs it',
      objective:'Felicity Farseer requires Exploration rank Scout or higher before she will meet you. If First Engineering Win or Improve Jump Range already proved Scout/Felicity access, this step clears automatically.',
      dependsOn:['mobility.gather-g2-materials'],
      factCompletion:{ factId:scoutProof || JUMP_RANGE_CAMPAIGN_FACTS.scoutReady, operator:'truthy', target:true },
      backgroundActivities:['exploration'],
      meta:{
        stage:'Engineer Access',
        factActionLabel:'I Have Scout or Higher',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, label:'I Already Unlocked Felicity' },
        ],
      },
    },
    {
      id:'mobility.felicity.meta-alloy',
      kind:'prepare',
      title:'Get one Meta-Alloy only if Felicity is still locked',
      objective:'If Felicity is not yet unlocked, verify a current source and acquire exactly one Meta-Alloy. If Felicity is already unlocked, the existing access fact clears this step instead of asking you to repeat the delivery.',
      dependsOn:['mobility.felicity.scout'],
      factCompletion:felicityAccessProof ? { factId:felicityAccessProof, operator:'truthy', target:true } : null,
      meta:{
        stage:'Engineer Access',
        resourceUrl:INARA_META_ALLOY,
        resourceLabel:'Meta-Alloys on Inara',
        requirement:'1 Meta-Alloy if Felicity is still locked',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityUnlocked, label:'I Already Unlocked Felicity' },
        ],
      },
    },
    {
      id:'mobility.felicity.deciat-safety',
      kind:'prepare',
      title:'Prepare for Deciat only if the unlock is still ahead',
      objective:'Before carrying the Meta-Alloy into Deciat in Open, make sure you can afford the rebuy, protect exploration data you do not want to lose, and preselect a high-wake escape option. Ask the Mongrels for escort support if desired.',
      dependsOn:['mobility.felicity.meta-alloy'],
      factCompletion:felicityAccessProof ? { factId:felicityAccessProof, operator:'truthy', target:true } : null,
      meta:{
        stage:'Safety',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        note:'Deciat is a well-known high-traffic Engineer system. Arriving safely is the objective; fighting another Commander is not required.',
      },
    },
    {
      id:'mobility.felicity.unlock',
      kind:'unlock',
      title:'Unlock Felicity Farseer',
      objective:'Provide the Meta-Alloy at Farseer Inc and unlock Felicity. If First Engineering Win or another campaign already recorded the unlock, this clears automatically.',
      dependsOn:['mobility.felicity.deciat-safety'],
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
      id:'mobility.felicity.g2-access',
      kind:'engineer',
      title:'Open Grade 2 Thrusters access',
      objective:'Raise Felicity reputation only until the chosen Thrusters blueprint can be completed through Grade 2. If First Engineering Win or Improve Jump Range already proved G2+ Felicity access, this clears automatically because Engineer reputation is shared.',
      dependsOn:['mobility.felicity.unlock'],
      factCompletion:{ factId:g2Proof || JUMP_RANGE_CAMPAIGN_FACTS.felicityG2Ready, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Reputation',
        factActionLabel:'G2 Felicity access is ready',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        alternateFacts:[
          { factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready, label:'I Already Have G3+ Felicity Access' },
        ],
      },
    },
    {
      id:'mobility.refresh-g2-materials',
      kind:'plan',
      title:'Check the exact G2 material shortfall',
      objective:'Now that Felicity access and reputation are known, refresh the G1 → G2 material plan once. If the first gather covers it, move on. If you are short, gather or trade only the missing amount.',
      dependsOn:['mobility.felicity.g2-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Final Material Check',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Engineering',
      },
    },
    {
      id:'mobility.thrusters.g2',
      kind:'engineer',
      title:'Take the Thrusters to G2',
      objective:'Apply the chosen Thrusters blueprint through a complete Grade 2. Stop there even if higher grades are available; the next job is to fly the ship and feel what changed.',
      dependsOn:['mobility.refresh-g2-materials'],
      meta:{
        stage:'Engineer',
        stoppingPoint:'G2 is a legitimate mobility win. Do not continue automatically just because G3 exists.',
      },
    },
    {
      id:'mobility.test.g2',
      kind:'demonstrate',
      title:'Fly the G2 Thrusters before deciding what comes next',
      objective:'Use the ship in the role it was built for and compare it with your baseline. Check boost and normal speed, turn response, heat while boosting, power headroom, and whether the ship feels better at its normal operating mass.',
      dependsOn:['mobility.thrusters.g2'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If G2 solves the handling or speed problem you started with, complete the campaign here. The experimental and G3 are optional follow-on jobs.',
      },
    },
    {
      id:'mobility.experimental.plan',
      kind:'plan',
      title:'Choose the Thrusters experimental as a separate job',
      objective:'If you want more after the G2 test, compare the experimentals for this specific drive and ship. Drag Drives increases the optimal multiplier and adds thermal load. Drive Distributors raises optimal mass and can outperform Drag Drives in some small-drive or Enhanced Performance Thruster cases. Thermal Spread, Stripped Down, and Double Braced solve different problems. Use the ship’s actual mass curve and role instead of blindly copying one choice.',
      dependsOn:['mobility.test.g2'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Experimentals',
        note:'The experimental is split out because the best choice depends on drive size, ship mass and the problem you are solving.',
        stoppingPoint:'If G2 already solved the mobility problem, finish the campaign instead.',
      },
    },
    {
      id:'mobility.experimental.materials',
      kind:'prepare',
      title:'Gather only the chosen experimental materials',
      objective:'Gather or trade for the exact materials required by the experimental you selected, then stop. Do not expand this into a general Engineering-material session.',
      dependsOn:['mobility.experimental.plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Experimentals',
      },
    },
    {
      id:'mobility.experimental.apply',
      kind:'engineer',
      title:'Apply the chosen Thrusters experimental',
      objective:'Apply the experimental chosen for this drive and ship. Keep the decision tied to the real mass/heat/performance goal rather than treating Drag Drives as a universal answer.',
      dependsOn:['mobility.experimental.materials'],
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Experimentals',
      },
    },
    {
      id:'mobility.experimental.test',
      kind:'demonstrate',
      title:'Fly the experimental and take another win',
      objective:'Repeat the same practical flight test and compare the result with G2 alone. Confirm that the extra speed, mass-curve change or thermal behavior is worth the tradeoff on this ship.',
      dependsOn:['mobility.experimental.apply'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'The G2 + experimental package may already be all this ship needs. G3 remains optional refinement.',
      },
    },
    {
      id:'mobility.felicity.g3-access',
      kind:'engineer',
      title:'Open G3 only if the blueprint and ship still need it',
      objective:'If the G2/experimental test still leaves a meaningful mobility problem, raise Felicity reputation only enough for Grade 3. Felicity currently offers G3 Dirty and Clean Thrusters; Reinforced G3 is not part of this Felicity path, so a Reinforced build should treat G2 as the end of this campaign unless you deliberately choose another Engineer later.',
      dependsOn:['mobility.experimental.test'],
      factCompletion:{ factId:JUMP_RANGE_CAMPAIGN_FACTS.felicityG3Ready, operator:'truthy', target:true },
      meta:{
        stage:'Optional Refinement',
        factActionLabel:'G3 Felicity access is ready',
        resourceUrl:INARA_FARSEER,
        resourceLabel:'Felicity Farseer on Inara',
        stoppingPoint:'If you chose Reinforced, complete this campaign at G2/experimental rather than turning the task into a new Engineer-unlock chain.',
      },
    },
    {
      id:'mobility.plan-g3-materials',
      kind:'plan',
      title:'Plan only the G3 Thrusters refinement',
      objective:'If you deliberately chose to continue, calculate only the materials needed to finish Grade 3 of the same blueprint. Do not add G4/G5 to this plan.',
      dependsOn:['mobility.felicity.g3-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_THRUSTERS_DIRTY,
        resourceLabel:'Inara · Thrusters Engineering',
      },
    },
    {
      id:'mobility.thrusters.g3',
      kind:'engineer',
      title:'Refine the Thrusters to G3',
      objective:'Apply Grade 3 of the same deliberate Thrusters plan. Keep the blueprint direction coherent; do not switch recipes midstream just to use available materials.',
      dependsOn:['mobility.plan-g3-materials'],
      meta:{ stage:'Optional Refinement' },
    },
    {
      id:'mobility.test.g3',
      kind:'demonstrate',
      title:'Test G3 and end this campaign phase',
      objective:'Repeat the same role-specific flight test and compare the result with the original baseline. Record what improved and what still needs work before deciding whether a later campaign should tackle distributor, power/heat, or another part of the ship.',
      dependsOn:['mobility.thrusters.g3'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'This mobility campaign phase is complete. G4/G5 or a different Engineer can be a later goal instead of being silently appended here.',
      },
    },
  ];
}
