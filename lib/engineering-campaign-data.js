// Goal-specific engineering dependency graphs live here.
//
// Keep this separate from the campaign/state engine so engineer unlock changes,
// prerequisite corrections, new blueprint guidance, and background-prep tuning can
// be updated without migrating stored member campaign state.
//
// Node contract supported by lib/engineering-campaign.js:
// {
//   id, kind, title, objective,
//   dependsOn: ['other.node'],
//   factCompletion: { factId:'counter.example', operator:'gte', target:50 },
//   backgroundActivities: ['trade'],
//   backgroundOnly: false,
//   chunkSize: 5,
//   resourceHint: 'inara-engineering',
//   meta: {}
// }

export const ENGINEERING_TRACKED_FACTS = {
  'trade.markets-visited-distinct': {
    id:'trade.markets-visited-distinct',
    label:'Distinct commodity markets traded at',
    unit:'markets',
    kind:'counter',
    minimum:0,
  },
  'trade.black-markets-used-distinct': {
    id:'trade.black-markets-used-distinct',
    label:'Distinct black markets used',
    unit:'black markets',
    kind:'counter',
    minimum:0,
  },
};

const INARA_FARSEER = 'https://inara.cz/elite/engineer/1/';
const INARA_FSD_RANGE = 'https://inara.cz/elite/blueprint/2/';
const INARA_META_ALLOY = 'https://inara.cz/elite/commodity/101/';

export const FIRST_ENGINEERING_WIN = {
  id:'first-engineering-win',
  title:'First Engineering Win',
  subtitle:'Make one useful change, feel the result, and take the mystery out of Engineering.',
  goal:'Take a Frame Shift Drive to G2 Increased Range, add the appropriate range-focused experimental (normally Mass Manager), then compare a familiar route before and after.',
  optional:true,
  designNote:'This starter is intentionally longer in number of cards but smaller in effort per card. The Commander should see frequent stopping points and visible wins instead of one hidden multi-hour engineer-unlock task.',
  steps:[
    {
      id:'first-win.choose-ship',
      stage:'Choose',
      title:'Choose the ship you want to travel better',
      objective:'Pick one ship you already use enough to notice whether its travel gets easier. Do not buy a special engineering ship just for this starter.',
      factId:'first-win.fsd.ship-chosen',
      resource:'/ships/',
    },
    {
      id:'first-win.baseline',
      stage:'Observe',
      title:'Record one simple travel baseline',
      objective:'Check the ship’s current jump range and save one familiar route or destination you can replot after the upgrade. A screenshot or quick note is enough.',
      factId:'first-win.fsd.baseline-recorded',
    },
    {
      id:'first-win.check-scout',
      stage:'Check',
      title:'Check your Exploration rank',
      objective:'Open your Commander ranks and see whether you are already Scout or higher in Exploration. Felicity Farseer requires Scout or higher before she will meet you.',
      factId:'first-win.fsd.scout-checked',
      resource:INARA_FARSEER,
      external:true,
      currentRequirement:{ type:'rank', category:'Exploration', minimum:'Scout' },
    },
    {
      id:'first-win.earn-scout',
      stage:'Explore',
      title:'Reach Scout only if you still need it',
      objective:'If you are below Scout, turn the trip toward your Meta-Alloy source into a small exploration run: honk systems, use the FSS when you want more data, map worthwhile bodies if desired, then sell the data at a safe station until you reach Scout. If you already have Scout, mark this as already done.',
      factId:'first-win.fsd.scout-ready',
      why:'This folds the rank requirement into travel you were already going to do instead of creating a separate exploration grind.',
    },
    {
      id:'first-win.meta-alloy-source',
      stage:'Source',
      title:'Find one current Meta-Alloy source',
      objective:'Use current market data to find one Meta-Alloy. Darnielle’s Progress in Maia is the traditional source and may still be useful, but verify live supply before committing to a long trip and use a closer reliable source when that makes more sense.',
      factId:'first-win.fsd.meta-alloy-source-found',
      resource:INARA_META_ALLOY,
      external:true,
    },
    {
      id:'first-win.meta-alloy',
      stage:'Acquire',
      title:'Get exactly one Meta-Alloy',
      objective:'Buy or otherwise acquire one Meta-Alloy for Felicity’s unlock. You do not need to stockpile them for this starter.',
      factId:'first-win.fsd.meta-alloy-acquired',
      currentRequirement:{ commodity:'Meta-Alloys', quantity:1 },
    },
    {
      id:'first-win.plan',
      stage:'Plan',
      title:'Plan only G1 → G2 Increased Range',
      objective:'Use Inara’s Increased Range blueprint / crafting tools to calculate the materials needed to reach a complete G2 at your current Felicity reputation. Do not plan G3–G5 yet.',
      factId:'first-win.fsd.g2-plan-ready',
      resource:INARA_FSD_RANGE,
      external:true,
      resourceHint:'inara-engineering',
      recipeReference:{
        note:'Crafting cost is per roll. Engineer reputation affects how many deterministic rolls are required.',
        grade1:['1 Atypical Disrupted Wake Echoes per roll'],
        grade2:['1 Atypical Disrupted Wake Echoes per roll','1 Chemical Processors per roll'],
      },
    },
    {
      id:'first-win.materials',
      stage:'Gather',
      title:'Gather only what the G2 plan says you need',
      objective:'Gather or trade for the Atypical Disrupted Wake Echoes and Chemical Processors shown by your G1 → G2 plan. Stop when the plan is covered instead of starting a general engineering-material grind.',
      factId:'first-win.fsd.g2-materials-ready',
      why:'The 2024 Engineering rebalance made blueprint rolls deterministic, but a newly unlocked engineer can require more rolls than a max-reputation engineer. Planning first avoids both shortage and pointless over-farming.',
    },
    {
      id:'first-win.deciat-safety',
      stage:'Prepare',
      title:'Prepare for the trip into Deciat',
      objective:'Before carrying the Meta-Alloy to Felicity Farseer in Deciat, prepare for possible hostile player contact in Open instead of treating the trip like ordinary point-to-point travel.',
      factId:'first-win.fsd.deciat-safety-ready',
      safety:{
        system:'Deciat',
        level:'high-risk-open',
        warning:'Deciat is a well-known player-traffic and ganking hotspot because Felicity Farseer attracts newer Commanders carrying engineer-unlock cargo. Expect that hostile player contact is possible.',
        checklist:[
          'Make sure you can afford the rebuy on the ship you are taking.',
          'Sell exploration data you do not want to risk losing before the dangerous leg. If you still need data for Felicity reputation, keep only what you deliberately choose to carry.',
          'Know the difference between low wake and high wake, and preselect a nearby system you can high-wake to if escape becomes necessary.',
          'Do not linger unnecessarily with the Meta-Alloy aboard once you are ready to make the delivery.',
          'If you are uncomfortable making the run alone, ask the Mongrels for an escort or another experienced Commander to fly with you.',
        ],
        squadHelp:true,
      },
    },
    {
      id:'first-win-arrive',
      stage:'Travel',
      title:'Reach Farseer Inc with the Meta-Alloy',
      objective:'Travel to Farseer Inc in Deciat with the one Meta-Alloy. Treat arriving safely as the objective; fighting another Commander is not required.',
      factId:'first-win.fsd.farseer-arrived',
      resource:INARA_FARSEER,
      external:true,
    },
    {
      id:'first-win-unlock',
      stage:'Unlock',
      title:'Give Felicity the Meta-Alloy',
      objective:'Provide the Meta-Alloy and unlock Felicity Farseer. If her normal station services do not appear immediately afterward, re-log before assuming something is wrong.',
      factId:'first-win.fsd.engineer-access-ready',
      currentRequirement:{ engineer:'Felicity Farseer', meeting:'Exploration rank Scout or higher', unlock:'1 Meta-Alloy' },
    },
    {
      id:'first-win-reputation',
      stage:'Reputation',
      title:'Open enough Felicity access for G2',
      objective:'Use engineering at Farseer Inc and/or sell exploration data there to raise Felicity’s reputation enough to use Grade 2 Increased Range. Stop once G2 is available; G5 reputation is not today’s goal.',
      factId:'first-win.fsd.g2-access-ready',
      why:'Felicity accepts exploration data for reputation, so the exploration you did on the way can shorten this step instead of becoming a separate grind.',
    },
    {
      id:'first-win.g1',
      stage:'Engineer',
      title:'Apply G1 Increased Range',
      objective:'Apply Grade 1 Increased Range to the selected FSD until Grade 2 becomes available. You do not need to keep rolling G1 after the next grade opens.',
      factId:'first-win.fsd.g1-increased-range',
      resource:INARA_FSD_RANGE,
      external:true,
    },
    {
      id:'first-win.g2',
      stage:'Engineer',
      title:'Complete G2 Increased Range',
      objective:'Apply Grade 2 Increased Range until the G2 modification is complete. Then stop and acknowledge the first real Engineering win before doing anything else.',
      factId:'first-win.fsd.g2-increased-range',
      payoff:'The FSD’s optimal-mass bonus reaches +25% at complete G2 Increased Range.',
    },
    {
      id:'first-win.experimental-plan',
      stage:'Plan',
      title:'Plan the experimental as a separate small job',
      objective:'Check whether Mass Manager is appropriate for this drive/build. If so, plan exactly 5 Atypical Disrupted Wake Echoes, 3 Galvanising Alloys, and 1 Eccentric Hyperspace Trajectories. If this is a small-drive edge case where another experimental is deliberately preferable, document that choice instead.',
      factId:'first-win.fsd.experimental-plan-ready',
      resource:INARA_FSD_RANGE,
      external:true,
      stoppingPoint:'It is completely fine to stop after G2 for the day and return for the experimental in another session.',
    },
    {
      id:'first-win.experimental-materials',
      stage:'Gather',
      title:'Gather only the experimental materials',
      objective:'Gather or trade for the experimental materials from your plan. Do not expand this into a general material-farming session.',
      factId:'first-win.fsd.experimental-materials-ready',
    },
    {
      id:'first-win.experimental',
      stage:'Engineer',
      title:'Add the range-focused experimental',
      objective:'Apply Mass Manager when it is appropriate for the drive/build, or the deliberately chosen alternative for a small-drive edge case.',
      factId:'first-win.fsd.range-experimental',
      resource:'/guides/engineering/',
    },
    {
      id:'first-win.test',
      stage:'Payoff',
      title:'Replot the trip and feel the difference',
      objective:'Use the same ship and replot the familiar route or another comparable trip. Compare jump range and route length with your baseline and identify what became easier.',
      factId:'first-win.fsd.tested',
      payoff:'The goal is not a perfect endgame FSD. The goal is for the Commander to experience that Engineering made a ship they already use noticeably better.',
    },
  ],
};

export function buildFirstEngineeringWinView(facts = {}) {
  const dismissed = Boolean(facts?.['first-win.dismissed']?.value);
  const overrideComplete = Boolean(facts?.['first-win.complete']?.value);
  const steps = FIRST_ENGINEERING_WIN.steps.map((step, index) => {
    const complete = Boolean(facts?.[step.factId]?.value);
    return { ...step, index:index + 1, complete };
  });
  const complete = overrideComplete || steps.every(step => step.complete);
  const current = complete || dismissed ? null : steps.find(step => !step.complete) || null;
  return {
    id:FIRST_ENGINEERING_WIN.id,
    title:FIRST_ENGINEERING_WIN.title,
    subtitle:FIRST_ENGINEERING_WIN.subtitle,
    goal:FIRST_ENGINEERING_WIN.goal,
    optional:true,
    dismissed,
    complete,
    readyForPublicUI:true,
    completed:steps.filter(step => step.complete).length,
    total:steps.length,
    current,
    steps,
  };
}

export function buildEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign) return [];

  // Goal-specific chains will be added here as each engineer path is audited.
  // First Engineering Win is kept as its own gentle onboarding sequence above so it
  // can exist even when Engineering is not selected in My Pathway.
  void facts;
  return [];
}
