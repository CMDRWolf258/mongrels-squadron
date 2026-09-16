// Improve Power Distributor campaign — fourth goal-specific Engineering Campaign Planner chain.
//
// This campaign targets a useful G2 Power Distributor result first, then separates
// the experimental and optional G3 refinement into their own small jobs. It reuses
// The Dweller progress already recorded by Improve Shields and the shared black-
// market prep counter instead of making members repeat old Engineer prerequisites.

import { SHIELD_CAMPAIGN_FACTS } from './engineering-campaign-shields.js';

const INARA_DWELLER = 'https://inara.cz/elite/engineer/4/';
const INARA_PD_CHARGE = 'https://inara.cz/elite/blueprint/67/';
const INARA_PD_ENGINE = 'https://inara.cz/elite/blueprint/68/';
const INARA_PD_SYSTEM = 'https://inara.cz/elite/blueprint/69/';
const INARA_PD_WEAPON = 'https://inara.cz/elite/blueprint/70/';
const INARA_PD_HIGH_CAPACITY = 'https://inara.cz/elite/blueprint/66/';
const INARA_PD_SHIELDED = 'https://inara.cz/elite/blueprint/71/';

export const DISTRIBUTOR_CAMPAIGN_FACTS = {
  dwellerG2Ready:'engineer.dweller.power-distributor-g2-ready',
  dwellerG3Ready:'engineer.dweller.power-distributor-g3-ready',
};

export function buildDistributorEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign || campaign.goalId !== 'distributor') return [];

  const hasFact = factId => Boolean(facts?.[factId]?.value);
  const firstProof = (...factIds) => factIds.find(hasFact) || '';

  // Lei Cheung referral/unlock proves The Dweller had already reached the G3–G4
  // reputation band. That is valid proof for G2/G3 Power Distributor access even
  // though the earlier campaign recorded the milestone for a shield-unlock chain.
  const g3Proof = firstProof(
    DISTRIBUTOR_CAMPAIGN_FACTS.dwellerG3Ready,
    SHIELD_CAMPAIGN_FACTS.leiUnlocked,
    SHIELD_CAMPAIGN_FACTS.leiReferralReady,
  );
  const g2Proof = firstProof(
    g3Proof,
    DISTRIBUTOR_CAMPAIGN_FACTS.dwellerG2Ready,
  );
  const dwellerProof = firstProof(
    g3Proof,
    g2Proof,
    SHIELD_CAMPAIGN_FACTS.dwellerUnlocked,
  );

  return [
    {
      id:'distributor.baseline',
      kind:'assess',
      title:'Find the distributor bottleneck you can actually feel',
      objective:'Record the current Power Distributor module and engineering, then identify the real problem in normal use: boost cadence, WEP running dry, SYS recovery under shield load, one capacitor needing more reserve, or a general three-capacitor recharge problem.',
      dependsOn:['campaign.map-dependencies'],
      meta:{
        stage:'Baseline',
        note:'Do not start with a favorite blueprint. Start with the capacitor behavior that is limiting the ship in its real role.',
      },
    },
    {
      id:'distributor.choose-blueprint',
      kind:'plan',
      title:'Choose the Power Distributor job around that bottleneck',
      objective:'Choose the blueprint deliberately. Charge Enhanced is the broad recharge comparison; Engine, Weapon, and System Focused deliberately favor one capacitor; High Charge Capacity favors reserve over recharge; Shielded trades mass for integrity and lower draw. Balanced and Support Focused are Merc-module special cases rather than default answers.',
      dependsOn:['distributor.baseline'],
      resourceHint:'engineering-power-distributor',
      meta:{
        stage:'Build Plan',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        secondaryResources:[
          { label:'Inara · Charge Enhanced', url:INARA_PD_CHARGE },
          { label:'Inara · Engine Focused', url:INARA_PD_ENGINE },
          { label:'Inara · Weapon Focused', url:INARA_PD_WEAPON },
          { label:'Inara · System Focused', url:INARA_PD_SYSTEM },
          { label:'Inara · High Charge Capacity', url:INARA_PD_HIGH_CAPACITY },
          { label:'Inara · Shielded', url:INARA_PD_SHIELDED },
        ],
        stoppingPoint:'Pick the blueprint and a useful G2 stopping point first. The Dweller can take Power Distributors much farther, but this campaign does not assume G5 is necessary.',
      },
    },
    {
      id:'distributor.plan-g2-materials',
      kind:'plan',
      title:'Plan only the G1 → G2 distributor job',
      objective:'Use Inara or another trusted planner to calculate only the materials needed to complete G2 of the blueprint you chose. Leave the experimental and G3–G5 off the first shopping list.',
      dependsOn:['distributor.choose-blueprint'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Material Plan',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Engineering',
        note:'The exact material list depends on the blueprint. Define the job before gathering for it.',
      },
    },
    {
      id:'distributor.gather-g2-materials',
      kind:'prepare',
      title:'Gather only the planned G2 materials',
      objective:'Acquire or trade for the materials in your G1 → G2 plan and stop when that small job is covered. If your inventory already covers it, mark the step complete immediately.',
      dependsOn:['distributor.plan-g2-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Targeted Gathering',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Engineering',
        stoppingPoint:'Once the planned G2 job is funded, leave material gathering and move on.',
      },
    },
    {
      id:'distributor.dweller.black-markets',
      kind:'prepare',
      title:'Use 5 distinct black markets only if The Dweller is still locked',
      objective:'If The Dweller is not already available, use five different black markets. Repeat visits to the same black market do not increase the total. Existing Improve Shields progress or the shared Prep Tracker can clear this automatically.',
      dependsOn:['distributor.gather-g2-materials'],
      factCompletion:dwellerProof
        ? { factId:dwellerProof, operator:'truthy', target:true }
        : { factId:'trade.black-markets-used-distinct', operator:'gte', target:5 },
      backgroundActivities:['trade'],
      chunkSize:1,
      meta:{
        stage:'Engineer Access',
        progressLabel:'Distinct black markets used',
        trackerFactId:'trade.black-markets-used-distinct',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        note:'This is cumulative account progress. Fold it into normal play or cross-path Trade prep instead of treating it as a mandatory one-session sprint.',
        alternateFacts:[
          { factId:SHIELD_CAMPAIGN_FACTS.dwellerUnlocked, label:'I Already Unlocked The Dweller' },
          { factId:SHIELD_CAMPAIGN_FACTS.leiReferralReady, label:'I Already Earned The Dweller Referral' },
          { factId:SHIELD_CAMPAIGN_FACTS.leiUnlocked, label:'I Already Unlocked Lei Cheung' },
        ],
      },
    },
    {
      id:'distributor.dweller.unlock',
      kind:'unlock',
      title:'Unlock The Dweller',
      objective:'Once the black-market requirement has registered, visit Black Hide in Wyrd and pay the 500,000 Cr unlock cost. If Improve Shields already recorded The Dweller, his referral, or Lei Cheung access, this clears automatically.',
      dependsOn:['distributor.dweller.black-markets'],
      factCompletion:{ factId:dwellerProof || SHIELD_CAMPAIGN_FACTS.dwellerUnlocked, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'The Dweller is unlocked',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        stoppingPoint:'Unlocking The Dweller is a complete session-sized win. You can stop here.',
        alternateFacts:[
          { factId:SHIELD_CAMPAIGN_FACTS.leiReferralReady, label:'I Already Earned The Dweller Referral' },
          { factId:SHIELD_CAMPAIGN_FACTS.leiUnlocked, label:'I Already Unlocked Lei Cheung' },
        ],
      },
    },
    {
      id:'distributor.dweller.g2-access',
      kind:'engineer',
      title:'Open G2 Power Distributor access',
      objective:'Raise The Dweller reputation only until the chosen Power Distributor blueprint can be completed through Grade 2. If Improve Shields already reached his Lei Cheung referral band, this clears automatically because Engineer reputation is shared across modules.',
      dependsOn:['distributor.dweller.unlock'],
      factCompletion:{ factId:g2Proof || DISTRIBUTOR_CAMPAIGN_FACTS.dwellerG2Ready, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Reputation',
        factActionLabel:'G2 Distributor access is ready',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        alternateFacts:[
          { factId:DISTRIBUTOR_CAMPAIGN_FACTS.dwellerG3Ready, label:'I Already Have G3+ Distributor Access' },
          { factId:SHIELD_CAMPAIGN_FACTS.leiReferralReady, label:'I Already Earned The Dweller Referral' },
          { factId:SHIELD_CAMPAIGN_FACTS.leiUnlocked, label:'I Already Unlocked Lei Cheung' },
        ],
      },
    },
    {
      id:'distributor.refresh-g2-materials',
      kind:'plan',
      title:'Check the exact G2 material shortfall',
      objective:'Now that The Dweller access and reputation are known, refresh the G1 → G2 material plan once. If the first gather covers it, move on. If you are short, gather or trade only the missing amount.',
      dependsOn:['distributor.dweller.g2-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Final Material Check',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Engineering',
      },
    },
    {
      id:'distributor.module.g2',
      kind:'engineer',
      title:'Take the Power Distributor to G2',
      objective:'Apply the chosen blueprint through a complete Grade 2. Stop there even if higher grades are available; the next job is to test the ship rather than keep clicking upgrades.',
      dependsOn:['distributor.refresh-g2-materials'],
      meta:{
        stage:'Engineer',
        stoppingPoint:'G2 is a legitimate distributor win. Do not continue automatically just because The Dweller offers higher grades.',
      },
    },
    {
      id:'distributor.test.g2',
      kind:'demonstrate',
      title:'Stress-test the G2 distributor in the ship’s real workload',
      objective:'Repeat the situation that exposed the original bottleneck. Check boost interval, WEP sustain and heat behavior, SYS recovery under shield load, and whether normal pip changes now keep the ship inside a comfortable energy envelope.',
      dependsOn:['distributor.module.g2'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If G2 fixes the capacitor problem you started with, complete the campaign here. The experimental and G3 are optional follow-on jobs.',
      },
    },
    {
      id:'distributor.experimental.plan',
      kind:'plan',
      title:'Choose the distributor experimental as a separate job',
      objective:'If you still want more after the G2 test, compare the experimentals against the actual bottleneck. Super Conduits favors recharge at the cost of capacitor reserve; Cluster Capacitors favors reserve at the cost of recharge. Double Braced, Flow Control, and Stripped Down solve integrity, power-draw, or mass problems instead. Choose for this ship rather than treating one effect as universal.',
      dependsOn:['distributor.test.g2'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Experimentals',
        note:'The experimental is separate because recharge rate and capacitor size solve different problems. Test the G2 blueprint first so you know which problem remains.',
        stoppingPoint:'If G2 already solved the distributor problem, finish the campaign instead.',
      },
    },
    {
      id:'distributor.experimental.materials',
      kind:'prepare',
      title:'Gather only the chosen experimental materials',
      objective:'Gather or trade for the exact materials required by the experimental you selected, then stop. Do not expand this into a general Engineering-material farm.',
      dependsOn:['distributor.experimental.plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Experimentals',
      },
    },
    {
      id:'distributor.experimental.apply',
      kind:'engineer',
      title:'Apply the chosen Power Distributor experimental',
      objective:'Apply the experimental chosen for the ship’s real capacitor problem. Keep the decision tied to measured behavior rather than copying a default from another build.',
      dependsOn:['distributor.experimental.materials'],
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Experimentals',
      },
    },
    {
      id:'distributor.experimental.test',
      kind:'demonstrate',
      title:'Re-run the workload with the experimental',
      objective:'Repeat the same practical stress test and compare it with G2 alone. Confirm that the recharge/capacity or secondary tradeoff actually improved the way this ship is flown.',
      dependsOn:['distributor.experimental.apply'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'The G2 + experimental package may already be all this ship needs. G3 remains optional refinement.',
      },
    },
    {
      id:'distributor.dweller.g3-access',
      kind:'engineer',
      title:'Open G3 only if the ship still needs more',
      objective:'If the G2/experimental test still leaves a meaningful capacitor problem, raise The Dweller reputation only enough for Grade 3. If Improve Shields already earned his Lei Cheung referral or unlocked Lei Cheung, this step clears automatically.',
      dependsOn:['distributor.experimental.test'],
      factCompletion:{ factId:g3Proof || DISTRIBUTOR_CAMPAIGN_FACTS.dwellerG3Ready, operator:'truthy', target:true },
      meta:{
        stage:'Optional Refinement',
        factActionLabel:'G3 Distributor access is ready',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        alternateFacts:[
          { factId:SHIELD_CAMPAIGN_FACTS.leiReferralReady, label:'I Already Earned The Dweller Referral' },
          { factId:SHIELD_CAMPAIGN_FACTS.leiUnlocked, label:'I Already Unlocked Lei Cheung' },
        ],
      },
    },
    {
      id:'distributor.plan-g3-materials',
      kind:'plan',
      title:'Plan only the remaining G3 materials',
      objective:'Calculate the materials needed to move the chosen blueprint from the current G2 result through complete G3. Do not append G4/G5.',
      dependsOn:['distributor.dweller.g3-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Engineering',
      },
    },
    {
      id:'distributor.gather-g3-materials',
      kind:'prepare',
      title:'Gather only the G3 shortfall',
      objective:'Acquire or trade for the remaining G3 materials and stop once the plan is covered.',
      dependsOn:['distributor.plan-g3-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_PD_CHARGE,
        resourceLabel:'Inara · Power Distributor Engineering',
      },
    },
    {
      id:'distributor.module.g3',
      kind:'engineer',
      title:'Take the Power Distributor to G3',
      objective:'Apply the chosen blueprint through complete Grade 3. Stop when G3 is complete; G4/G5 are outside this campaign phase.',
      dependsOn:['distributor.gather-g3-materials'],
      meta:{
        stage:'Optional Refinement',
        stoppingPoint:'G3 is the end of this campaign phase even though The Dweller can engineer Power Distributors further.',
      },
    },
    {
      id:'distributor.test.g3',
      kind:'demonstrate',
      title:'Test G3 and close the distributor phase',
      objective:'Repeat the same ship-specific workload one final time. Compare G3 with the original baseline and decide whether the remaining limitation is still the distributor or has moved somewhere else in the build.',
      dependsOn:['distributor.module.g3'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'Finish the campaign here. If the ship still has an energy problem, diagnose the whole build before deciding that G4/G5 is automatically the answer.',
      },
    },
  ];
}
