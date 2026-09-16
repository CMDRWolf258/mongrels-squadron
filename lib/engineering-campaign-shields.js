// Improve Shields campaign — first goal-specific Engineering Campaign Planner chain.
//
// This deliberately targets a useful G2/G3 Shield Generator win through Lei Cheung
// before asking a Commander to pursue endgame G5 booster engineering. The campaign
// works backward through Engineer access without hiding the unlock chain in one task.

const INARA_DWELLER = 'https://inara.cz/elite/engineer/4';
const INARA_LEI = 'https://inara.cz/elite/engineer/10';
const INARA_ENGINEERS = 'https://inara.cz/elite/engineers/';
const INARA_SHIELD_REINFORCED = 'https://inara.cz/elite/blueprint/21/';
const INARA_SHIELD_THERMAL = 'https://inara.cz/elite/blueprint/22/';

export const SHIELD_CAMPAIGN_FACTS = {
  dwellerUnlocked:'engineer.dweller.unlocked',
  leiReferralReady:'engineer.dweller.lei-referral-ready',
  leiUnlocked:'engineer.lei-cheung.unlocked',
  leiG2Ready:'engineer.lei-cheung.shield-g2-ready',
  leiG3Ready:'engineer.lei-cheung.shield-g3-ready',
};

export function buildShieldEngineeringDependencyNodes({ campaign = null } = {}) {
  if (!campaign || campaign.goalId !== 'shields') return [];

  return [
    {
      id:'shields.choose-blueprint',
      kind:'plan',
      title:'Choose what this shield is supposed to do',
      objective:'Choose the generator blueprint around the ship’s role, not by chasing one number. Reinforced emphasizes raw strength; Thermal Resistant repairs the common thermal weakness; regeneration-focused Bi-Weaves may value recharge behavior more heavily. Check the final package with its boosters before committing.',
      dependsOn:['campaign.map-dependencies'],
      resourceHint:'engineering-shields',
      meta:{
        stage:'Build Plan',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        secondaryResources:[
          { label:'Inara · Reinforced Shield Generator', url:INARA_SHIELD_REINFORCED },
          { label:'Inara · Thermal Resistant Shield Generator', url:INARA_SHIELD_THERMAL },
        ],
        stoppingPoint:'Pick the blueprint and the G2/G3 stopping point first. Do not gather for G5 by default.',
      },
    },
    {
      id:'shields.plan-materials',
      kind:'plan',
      title:'Plan only the G1 → G2 material job',
      objective:'After choosing the blueprint, use Inara or another trusted engineering planner to estimate only the materials needed to reach the intended G2 stopping point. Do not add G3–G5 to the shopping list. Because exact roll count can depend on engineer reputation, refresh the quantity when you reach Lei Cheung if your current reputation changes the requirement.',
      dependsOn:['shields.choose-blueprint'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Material Plan',
        resourceUrl:INARA_ENGINEERS,
        resourceLabel:'Inara Engineers / Crafting',
        secondaryResources:[
          { label:'Reinforced Shield Generator', url:INARA_SHIELD_REINFORCED },
          { label:'Thermal Resistant Shield Generator', url:INARA_SHIELD_THERMAL },
        ],
        note:'Define the job first, then gather for the job. This is a targeted G1 → G2 plan, not a general Engineering-material farm.',
        stoppingPoint:'Once the G1 → G2 plan is covered, stop gathering unless a later step gives you a new reason.',
      },
    },
    {
      id:'shields.dweller.black-markets',
      kind:'prepare',
      title:'Use 5 distinct black markets',
      objective:'Build The Dweller meeting requirement in small pieces. Use five different black markets; repeat visits to the same black market do not increase the count. If your tracker already shows 5, this step clears automatically.',
      dependsOn:['shields.plan-materials'],
      factCompletion:{ factId:'trade.black-markets-used-distinct', operator:'gte', target:5 },
      backgroundActivities:['trade'],
      chunkSize:1,
      meta:{
        stage:'Engineer Access',
        progressLabel:'Distinct black markets used',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        trackerFactId:'trade.black-markets-used-distinct',
        note:'This is cumulative account progress. Do not turn it into a five-station sprint if you would rather fold it into normal play.',
      },
    },
    {
      id:'shields.dweller.unlock',
      kind:'unlock',
      title:'Unlock The Dweller',
      objective:'Once the five-black-market requirement has registered, visit Black Hide in Wyrd and pay the 500,000 Cr unlock cost. Stop when The Dweller is available; you do not need to max his reputation in the same session.',
      dependsOn:['shields.dweller.black-markets'],
      factCompletion:{ factId:SHIELD_CAMPAIGN_FACTS.dwellerUnlocked, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'The Dweller is unlocked',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        stoppingPoint:'Unlocking the engineer is a complete session-sized win. You can stop here.',
      },
    },
    {
      id:'shields.dweller.referral',
      kind:'unlock',
      title:'Get the Lei Cheung referral',
      objective:'Engineer with The Dweller only until Lei Cheung appears in your Engineer panel. Current references place the referral around Grade 3 with some progress toward Grade 4. Confirm the referral in-game instead of grinding reputation farther than necessary.',
      dependsOn:['shields.dweller.unlock'],
      factCompletion:{ factId:SHIELD_CAMPAIGN_FACTS.leiReferralReady, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'Lei Cheung referral received',
        resourceUrl:INARA_DWELLER,
        resourceLabel:'The Dweller on Inara',
        stoppingPoint:'Stop as soon as Lei Cheung is visible in your Engineer panel.',
      },
    },
    {
      id:'shields.lei.markets',
      kind:'prepare',
      title:'Build the Lei Cheung market requirement',
      objective:'Trade at distinct commodity markets until your cumulative market count reaches the tracked 50-market milestone. At 50, check the Engineer panel; current references differ between “at least 50” and “over 50,” so make one additional unique-market trade if the invitation has not registered.',
      dependsOn:['shields.plan-materials'],
      factCompletion:{ factId:'trade.markets-visited-distinct', operator:'gte', target:50 },
      backgroundActivities:['trade'],
      chunkSize:5,
      meta:{
        stage:'Background Prep',
        progressLabel:'Distinct commodity markets',
        trackerFactId:'trade.markets-visited-distinct',
        resourceUrl:INARA_LEI,
        resourceLabel:'Lei Cheung on Inara',
        note:'This is exactly the kind of prerequisite that should accumulate during ordinary Trade instead of becoming a later 50-market grind.',
      },
    },
    {
      id:'shields.lei.unlock',
      kind:'unlock',
      title:'Unlock Lei Cheung',
      objective:'After the Dweller referral and market requirement have registered, take 200 units of Gold to Trader’s Rest in Laksak and unlock Lei Cheung. If normal station services do not appear immediately after the unlock, re-log before assuming something is wrong.',
      dependsOn:['shields.dweller.referral','shields.lei.markets'],
      factCompletion:{ factId:SHIELD_CAMPAIGN_FACTS.leiUnlocked, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Access',
        factActionLabel:'Lei Cheung is unlocked',
        resourceUrl:INARA_LEI,
        resourceLabel:'Lei Cheung on Inara',
        requirement:'200 units of Gold',
        stoppingPoint:'Unlocking Lei is enough for one session. The shield work can wait.',
      },
    },
    {
      id:'shields.lei.g2-access',
      kind:'engineer',
      title:'Open Grade 2 shield access',
      objective:'Craft only enough useful work with Lei Cheung to open Grade 2 for the Shield Generator blueprint you chose. Stop when G2 is available instead of pushing reputation for its own sake.',
      dependsOn:['shields.lei.unlock'],
      factCompletion:{ factId:SHIELD_CAMPAIGN_FACTS.leiG2Ready, operator:'truthy', target:true },
      meta:{
        stage:'Engineer Reputation',
        factActionLabel:'G2 shield access is ready',
        resourceUrl:INARA_LEI,
        resourceLabel:'Lei Cheung on Inara',
      },
    },
    {
      id:'shields.generator.g2',
      kind:'engineer',
      title:'Take the Shield Generator to G2',
      objective:'Apply the chosen Shield Generator blueprint through Grade 2 using the material plan you made. Do not continue automatically just because higher grades exist.',
      dependsOn:['shields.lei.g2-access'],
      meta:{
        stage:'Engineer',
        stoppingPoint:'G2 is a legitimate stopping point. The next step is to fly the ship, not immediately grind G3–G5.',
      },
    },
    {
      id:'shields.test.g2',
      kind:'demonstrate',
      title:'Fly the G2 shield before deciding what comes next',
      objective:'Use the ship in the activity it was built for. Pay attention to shield strength, thermal weakness, recharge/reform behavior, SYS distributor demand, and whether the change actually solved the problem you wrote down at the start.',
      dependsOn:['shields.generator.g2'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If the ship now does its job noticeably better, you may complete the campaign here. G3 is optional refinement, not a mandatory next grind.',
      },
    },
    {
      id:'shields.lei.g3-access',
      kind:'engineer',
      title:'Open Grade 3 only if the test says you need it',
      objective:'If G2 did not meet the target, raise Lei Cheung reputation only enough to open Grade 3 Shield Generator work. If G2 already solved the problem, finish the campaign instead.',
      dependsOn:['shields.test.g2'],
      factCompletion:{ factId:SHIELD_CAMPAIGN_FACTS.leiG3Ready, operator:'truthy', target:true },
      meta:{
        stage:'Optional Refinement',
        factActionLabel:'G3 shield access is ready',
        resourceUrl:INARA_LEI,
        resourceLabel:'Lei Cheung on Inara',
      },
    },
    {
      id:'shields.generator.g3',
      kind:'engineer',
      title:'Refine the Shield Generator to G3',
      objective:'Apply Grade 3 of the same deliberate shield plan. Keep the build coherent; do not change blueprint direction midstream just to consume materials.',
      dependsOn:['shields.lei.g3-access'],
      meta:{ stage:'Optional Refinement' },
    },
    {
      id:'shields.test.g3',
      kind:'demonstrate',
      title:'Test the G3 result and end this phase',
      objective:'Fly the same role again and compare the result with your original problem. Record what improved and what still needs work before deciding whether a later campaign should tackle boosters, cell banks, power, or something else.',
      dependsOn:['shields.generator.g3'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'This campaign phase is complete. G5 Shield Generator or G5 booster work can be a later goal instead of being silently appended here.',
      },
    },
  ];
}
