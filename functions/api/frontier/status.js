import { frontierConfigured, getAccount, getEvents, privateHeaders, publicAccount, requireMember, summarizeEvents, syncCooldown, TEST_SYSTEM } from '../../../lib/frontier.js';
import { json } from '../../../lib/auth.js';
import { matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { buildRewardPreview, readRewardSettings } from '../../../lib/reward-rules.js';

export async function onRequestGet({request,env}) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const configured = frontierConfigured(env);
  const account = configured ? await getAccount(env, auth.session.sub) : null;
  const events = account ? await getEvents(env, auth.session.sub) : [];
  const currentOrders = account ? await readCurrentOrderCycle(env) : null;
  const matched = matchVerifiedActivity(events, currentOrders);
  const rewardSettings = account ? await readRewardSettings(env) : {settings:{}};
  const rewardPreview = buildRewardPreview(matched.orderTotals, rewardSettings.settings);
  return json({
    ok:true,
    configured,
    connected:Boolean(account),
    account:publicAccount(account),
    targetSystem:TEST_SYSTEM,
    summary:summarizeEvents(events),
    orderCycleId:matched.cycleId,
    verifiedOrders:rewardPreview,
    recentEvents:matched.events.slice(-20).reverse(),
    cooldown:account ? syncCooldown(account) : {ready:true,remainingSeconds:0,nextSyncAt:null},
    requirements:configured ? [] : ['FRONTIER_CLIENT_ID'],
  }, {headers:privateHeaders()});
}
