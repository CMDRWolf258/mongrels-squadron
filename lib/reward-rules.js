export const DEFAULT_REWARD_SETTINGS = Object.freeze({
  version:1,
  trade:{
    profitBlockMillions:10,
    rewardPerBlockMillions:10,
    capMillions:30,
  },
  inf:{
    rewardPerInfBeforeGoalMillions:1,
    rewardPerInfAfterGoalMillions:0.5,
    minCapMillions:30,
  },
  bounties:{
    rewardPerRedeemedMillion:1,
    minCapMillions:30,
  },
});

export const REWARD_SETTINGS_KEY = 'reward-settings-v1';

export async function readRewardSettings(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') {
    return {settings:normalizeRewardSettings(),updatedAt:null,updatedBy:null};
  }
  const stored = await env.DAILY_ORDERS.get(REWARD_SETTINGS_KEY,{type:'json'});
  if (!stored || typeof stored !== 'object') {
    return {settings:normalizeRewardSettings(),updatedAt:null,updatedBy:null};
  }
  return {
    settings:normalizeRewardSettings(stored.settings),
    updatedAt:stored.updatedAt || null,
    updatedBy:stored.updatedBy || null,
  };
}

export function buildRewardPreview(verifiedOrders, settings = DEFAULT_REWARD_SETTINGS) {
  return (Array.isArray(verifiedOrders) ? verifiedOrders : []).map(item => {
    const type = String(item?.type || '');
    const contribution = Math.max(0, Number(item?.contribution) || 0);
    const target = item?.target ?? null;
    const eligible = ['trade','inf','bounties'].includes(type);
    const entitlementMillions = eligible
      ? rewardEntitlementMillions(type, contribution, target, settings)
      : 0;
    const capMillions = eligible
      ? rewardCapMillions(type, target, settings)
      : 0;
    return {
      ...item,
      rewardEligible:eligible,
      entitlementMillions,
      capMillions,
      remainingMillions:eligible ? roundCredits(Math.max(0, capMillions - entitlementMillions)) : 0,
    };
  });
}

export function normalizeRewardSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const trade = source.trade && typeof source.trade === 'object' ? source.trade : {};
  const inf = source.inf && typeof source.inf === 'object' ? source.inf : {};
  const bounties = source.bounties && typeof source.bounties === 'object' ? source.bounties : {};
  return {
    version:1,
    trade:{
      profitBlockMillions:bounded(trade.profitBlockMillions, DEFAULT_REWARD_SETTINGS.trade.profitBlockMillions, 0.1, 1000),
      rewardPerBlockMillions:bounded(trade.rewardPerBlockMillions, DEFAULT_REWARD_SETTINGS.trade.rewardPerBlockMillions, 0, 1000),
      capMillions:bounded(trade.capMillions, DEFAULT_REWARD_SETTINGS.trade.capMillions, 0, 100000),
    },
    inf:{
      rewardPerInfBeforeGoalMillions:bounded(inf.rewardPerInfBeforeGoalMillions, DEFAULT_REWARD_SETTINGS.inf.rewardPerInfBeforeGoalMillions, 0, 1000),
      rewardPerInfAfterGoalMillions:bounded(inf.rewardPerInfAfterGoalMillions, DEFAULT_REWARD_SETTINGS.inf.rewardPerInfAfterGoalMillions, 0, 1000),
      minCapMillions:bounded(inf.minCapMillions, DEFAULT_REWARD_SETTINGS.inf.minCapMillions, 0, 100000),
    },
    bounties:{
      rewardPerRedeemedMillion:bounded(bounties.rewardPerRedeemedMillion, DEFAULT_REWARD_SETTINGS.bounties.rewardPerRedeemedMillion, 0, 1000),
      minCapMillions:bounded(bounties.minCapMillions, DEFAULT_REWARD_SETTINGS.bounties.minCapMillions, 0, 100000),
    },
  };
}

/**
 * Returns the member's total reward entitlement for one order.
 * contribution is the verified personal contribution for that order:
 * - trade: M Cr profit
 * - inf: INF units
 * - bounties: M Cr redeemed
 *
 * The squad goal does not close reward eligibility. Caps are personal and per order.
 */
export function rewardEntitlementMillions(type, contribution, orderGoal, settings = DEFAULT_REWARD_SETTINGS) {
  const rules = normalizeRewardSettings(settings);
  const amount = Math.max(0, Number(contribution) || 0);
  const target = finiteOrNull(orderGoal);

  if (type === 'trade') {
    const blocks = Math.floor((amount + 1e-9) / rules.trade.profitBlockMillions);
    return roundCredits(Math.min(rules.trade.capMillions, blocks * rules.trade.rewardPerBlockMillions));
  }

  if (type === 'inf') {
    const fullRateGoal = target === null ? rules.inf.minCapMillions : Math.max(0, target);
    const cap = Math.max(rules.inf.minCapMillions, target === null ? 0 : target);
    const before = Math.min(amount, fullRateGoal);
    const after = Math.max(0, amount - fullRateGoal);
    const earned = before * rules.inf.rewardPerInfBeforeGoalMillions
      + after * rules.inf.rewardPerInfAfterGoalMillions;
    return roundCredits(Math.min(cap, earned));
  }

  if (type === 'bounties') {
    const cap = Math.max(rules.bounties.minCapMillions, target === null ? 0 : target);
    return roundCredits(Math.min(cap, amount * rules.bounties.rewardPerRedeemedMillion));
  }

  return 0;
}

export function rewardCapMillions(type, orderGoal, settings = DEFAULT_REWARD_SETTINGS) {
  const rules = normalizeRewardSettings(settings);
  const target = finiteOrNull(orderGoal);
  if (type === 'trade') return rules.trade.capMillions;
  if (type === 'inf') return Math.max(rules.inf.minCapMillions, target === null ? 0 : target);
  if (type === 'bounties') return Math.max(rules.bounties.minCapMillions, target === null ? 0 : target);
  return 0;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function bounded(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function roundCredits(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
