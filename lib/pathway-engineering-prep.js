// Cross-path Engineering preparation opportunities.
//
// These mappings let ordinary activity in another Pathway contribute to a real
// Engineering prerequisite without making that other Pathway responsible for
// Engineering completion. Nothing here auto-awards progress: the Commander must
// explicitly record the amount that actually happened.
//
// Important distinction:
// - pathway task status remains owned by the activity (Trade, Mining, ...)
// - Engineering prep facts remain owned by the Engineering campaign state
// - resetting/changing an activity route must not erase prep already recorded

const INARA_LEI = 'https://inara.cz/elite/engineer/10/';
const INARA_SELENE = 'https://inara.cz/elite/engineer/8/';

export const CROSS_PATH_ENGINEERING_PREP = {
  trade: {
    'trade-foundations-cheap-haul-v2': [marketOpportunity(2)],
    'trade-foundations-buy-silver-v2': [marketOpportunity(1)],
    'trade-foundations-sell-silver-v2': [marketOpportunity(1)],
    'trade-foundations-outpost-v2': [marketOpportunity(2)],
    'trade-foundations-own-commodity-v2': [marketOpportunity(2)],
    'trade-foundations-graduate-v2': [marketOpportunity(2)],

    'trade-runner-profit-v2': [marketOpportunity(2)],
    'trade-runner-time-v2': [marketOpportunity(4)],
    'trade-runner-benchmark-v2': [marketOpportunity(2)],
    'trade-runner-backhaul-v2': [marketOpportunity(2)],
    'trade-runner-graduate-v2': [marketOpportunity(2)],

    'trade-medium-visit-v2': [marketOpportunity(1)],
    'trade-medium-exclusive-v2': [marketOpportunity(2)],
    'trade-medium-mission-v2': [marketOpportunity(2)],

    'trade-strategic-deliver': [marketOpportunity(2)],
  },
  mining: {
    'mining-foundations-sell': [minedTonnageOpportunity()],
    'mining-foundations-graduate': [minedTonnageOpportunity()],
    'mining-efficient-baseline': [minedTonnageOpportunity()],
    'mining-efficient-prospecting': [minedTonnageOpportunity()],
    'mining-efficient-rerun': [minedTonnageOpportunity()],
  },
};

export function engineeringPrepForTask(activityValue, taskIdValue) {
  const activity = String(activityValue || '').toLowerCase();
  const taskId = String(taskIdValue || '');
  const items = CROSS_PATH_ENGINEERING_PREP?.[activity]?.[taskId];
  return Array.isArray(items) ? items.map(item => ({ ...item, quickAdd:[...(item.quickAdd || [])] })) : [];
}

export function recordedEngineeringPrep(progressValue, taskIdValue, factIdValue) {
  const taskId = String(taskIdValue || '');
  const factId = String(factIdValue || '');
  const raw = progressValue?.engineeringPrepContributions?.[taskId]?.[factId];
  return Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : 0;
}

export function withEngineeringPrepContribution(progressValue, taskIdValue, factIdValue, amountValue, maxContributionValue) {
  const taskId = String(taskIdValue || '');
  const factId = String(factIdValue || '');
  const amount = Number(amountValue);
  const maxContribution = Number(maxContributionValue);
  if (!taskId || !factId) throw new Error('invalid_engineering_prep_target');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('invalid_engineering_prep_amount');
  if (!Number.isInteger(maxContribution) || maxContribution <= 0) throw new Error('invalid_engineering_prep_limit');

  const existing = recordedEngineeringPrep(progressValue, taskId, factId);
  if (existing + amount > maxContribution) throw new Error('engineering_prep_task_limit');

  const next = clone(progressValue && typeof progressValue === 'object' ? progressValue : {});
  if (!next.engineeringPrepContributions || typeof next.engineeringPrepContributions !== 'object') next.engineeringPrepContributions = {};
  if (!next.engineeringPrepContributions[taskId] || typeof next.engineeringPrepContributions[taskId] !== 'object') {
    next.engineeringPrepContributions[taskId] = {};
  }
  next.engineeringPrepContributions[taskId][factId] = existing + amount;
  return next;
}

export function normalizeEngineeringPrepContributions(value) {
  const source = value && typeof value === 'object' ? value : {};
  const output = {};
  for (const [taskId, taskValue] of Object.entries(source)) {
    if (!taskId || !taskValue || typeof taskValue !== 'object') continue;
    const facts = {};
    for (const [factId, raw] of Object.entries(taskValue)) {
      const amount = Number(raw);
      if (!factId || !Number.isInteger(amount) || amount <= 0 || amount > 1000000) continue;
      facts[factId] = amount;
    }
    if (Object.keys(facts).length) output[taskId] = facts;
  }
  return output;
}

function marketOpportunity(maxContribution = 2) {
  const max = Math.max(1, Math.min(6, Number(maxContribution) || 1));
  return {
    id:'lei-markets',
    factId:'trade.markets-visited-distinct',
    kind:'counter',
    label:'Distinct markets toward Lei Cheung',
    unit:'markets',
    target:50,
    maxContribution:max,
    quickAdd:[1,2,3,4].filter(value => value <= max),
    prompt:'If this assignment included commodity markets you have never counted before, record only those new distinct markets. Reusing the same market does not increase the total.',
    note:'This is optional background Engineering prep. Recording it does not complete, score, or change the Trade assignment.',
    resourceUrl:INARA_LEI,
    resourceLabel:'Lei Cheung on Inara',
  };
}

function minedTonnageOpportunity() {
  return {
    id:'selene-mined-tonnage',
    factId:'mining.ore-mined-total-tonnes',
    kind:'counter',
    label:'Ore mined toward Selene Jean',
    unit:'tonnes',
    target:500,
    maxContribution:5000,
    quickAdd:[25,50,100],
    prompt:'Record the tonnes of ore you actually mined during this assignment. Use the real session amount; cargo sold is a useful lower bound if you did not track fragments you discarded.',
    note:'Selene Jean currently requires at least 500 tonnes mined before the unlock. This tracks the historical mining requirement only; it does not claim you already have her separate unlock cargo.',
    resourceUrl:INARA_SELENE,
    resourceLabel:'Selene Jean on Inara',
  };
}

function clone(value) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return {}; }
}
