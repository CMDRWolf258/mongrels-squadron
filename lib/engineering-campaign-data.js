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

export const FIRST_ENGINEERING_WIN = {
  id:'first-engineering-win',
  title:'First Engineering Win',
  subtitle:'Make one useful change, feel the result, and take the mystery out of Engineering.',
  goal:'Take a Frame Shift Drive to G2 Increased Range, add the appropriate range-focused experimental (normally Mass Manager), then compare a familiar route before and after.',
  optional:true,
  steps:[
    {
      id:'first-win.choose-ship',
      title:'Choose the ship you want to travel better',
      objective:'Pick one ship you already use enough to notice whether its travel gets easier.',
      factId:'first-win.fsd.ship-chosen',
      resource:'/ships/',
    },
    {
      id:'first-win.baseline',
      title:'Notice your current travel baseline',
      objective:'Check the ship’s current jump range and remember or record a familiar route you can compare later.',
      factId:'first-win.fsd.baseline-recorded',
    },
    {
      id:'first-win.plan',
      title:'Plan only the G2 FSD upgrade',
      objective:'Use a planning resource such as Inara to identify Increased Range G1 through G2 and the materials needed for that stopping point. Do not plan the entire G5 grind yet.',
      factId:'first-win.fsd.g2-plan-ready',
      resourceHint:'inara-engineering',
    },
    {
      id:'first-win.access',
      title:'Open the path to an FSD engineer',
      objective:'Complete the next small access step toward an engineer who can apply FSD Increased Range. This step will be expanded into audited bite-size unlock dependencies before the starter is exposed publicly.',
      factId:'first-win.fsd.engineer-access-ready',
      gatedUntilAudited:true,
    },
    {
      id:'first-win.deciat-safety',
      title:'Prepare for the trip into Deciat',
      objective:'Before carrying the Meta-Alloy to Felicity Farseer in Deciat, prepare for possible hostile player contact in Open instead of treating the trip like ordinary point-to-point travel.',
      factId:'first-win.fsd.deciat-safety-ready',
      safety:{
        system:'Deciat',
        level:'high-risk-open',
        warning:'Deciat is a well-known player-traffic and ganking hotspot because Felicity Farseer attracts newer Commanders carrying engineer-unlock cargo. Expect that hostile player contact is possible.',
        checklist:[
          'Make sure you can afford the rebuy on the ship you are taking.',
          'Sell exploration data you do not want to risk losing before the trip.',
          'Know the difference between low wake and high wake, and preselect a nearby system you can high-wake to if escape becomes necessary.',
          'Do not linger unnecessarily with the Meta-Alloy aboard once you are ready to make the delivery.',
          'If you are uncomfortable making the run alone, ask the Mongrels for an escort or another experienced Commander to fly with you.',
        ],
        squadHelp:true,
      },
    },
    {
      id:'first-win.materials',
      title:'Gather only what the G2 plan needs',
      objective:'Gather or trade for the exact materials needed to complete the planned G1 and G2 rolls instead of starting a general material farm.',
      factId:'first-win.fsd.g2-materials-ready',
    },
    {
      id:'first-win.g2',
      title:'Apply G2 Increased Range',
      objective:'Engineer the selected Frame Shift Drive through Grade 2 Increased Range. Stop there and take the win.',
      factId:'first-win.fsd.g2-increased-range',
    },
    {
      id:'first-win.experimental',
      title:'Add the range-focused experimental',
      objective:'Add Mass Manager when it is appropriate for the drive/build, or use the appropriate alternative if the ship is a small-drive edge case.',
      factId:'first-win.fsd.range-experimental',
      resource:'/guides/engineering/',
    },
    {
      id:'first-win.test',
      title:'Fly the same kind of trip again',
      objective:'Replot the familiar trip or another comparable route and notice what changed: fewer jumps, a more direct route, or simply easier travel.',
      factId:'first-win.fsd.tested',
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
    readyForPublicUI:steps.every(step => !step.gatedUntilAudited),
    completed:steps.filter(step => step.complete).length,
    total:steps.length,
    current,
    steps,
  };
}

export function buildEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign) return [];

  // v1 framework intentionally ships without hard-coded engineer unlock chains.
  // Add audited goal-specific nodes here as the engineer dependency database is
  // built and verified.
  void facts;
  return [];
}
