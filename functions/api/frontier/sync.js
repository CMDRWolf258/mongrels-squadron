import { ensureAccessToken, fetchJournal, getAccount, mergeEvents, parseJournal, privateHeaders, publicAccount, requireMember, sameOrigin, saveAccount, summarizeEvents, syncCooldown, TEST_SYSTEM } from '../../../lib/frontier.js';
import { json } from '../../../lib/auth.js';
import { matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { buildRewardPreview, readRewardSettings } from '../../../lib/reward-rules.js';

export async function onRequestPost({request,env}) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  if (!sameOrigin(request)) return json({ok:false,error:'request_validation_failed'}, {status:403,headers:privateHeaders()});
  let account = await getAccount(env, auth.session.sub);
  if (!account) return json({ok:false,error:'frontier_not_connected'}, {status:409,headers:privateHeaders()});
  const cooldown = syncCooldown(account);
  if (!cooldown.ready) {
    return json({
      ok:false,
      error:'frontier_sync_cooldown',
      retryAfterSeconds:cooldown.remainingSeconds,
      nextSyncAt:cooldown.nextSyncAt,
      cooldown:syncCooldown(account),
      account:publicAccount(account),
    }, {status:429,headers:{...privateHeaders(),'Retry-After':String(cooldown.remainingSeconds)}});
  }

  try {
    const access = await ensureAccessToken(request, env, auth.session.sub, account);
    account = access.account;
    let response = await fetchJournal(access.accessToken, env);
    if (response.response.status === 401 || response.response.status === 422) {
      const retry = await ensureAccessToken(request, env, auth.session.sub, {...account,accessExpiresAt:'1970-01-01T00:00:00Z'});
      account = retry.account;
      response = await fetchJournal(retry.accessToken, env);
    }
    const status = response.response.status;
    if (status === 204) {
      account = {...account,lastSyncAt:new Date().toISOString()};
      await saveAccount(env, auth.session.sub, account);
      return json({ok:true,partial:false,targetSystem:TEST_SYSTEM,newEvents:0,summary:summarizeEvents([]),cooldown:syncCooldown(account),account:publicAccount(account),message:'No journal data is available from Frontier for today yet.'},{headers:privateHeaders()});
    }
    if (![200,206].includes(status)) throw new Error('frontier_journal_' + status);
    const text = await response.response.text();
    if (text.trim() === 'Journal unavailable') throw new Error('frontier_journal_unavailable');
    const parsed = parseJournal(text, TEST_SYSTEM, {diagnostics:auth.session.access === 'site_admin'});
    const merged = await mergeEvents(env, auth.session.sub, parsed.events, parsed.excluded);
    const currentOrders = await readCurrentOrderCycle(env);
    const matched = matchVerifiedActivity(merged, currentOrders);
    const rewardSettings = await readRewardSettings(env);
    const rewardPreview = buildRewardPreview(matched.orderTotals, rewardSettings.settings);
    account = {
      ...account,
      lastSyncAt:new Date().toISOString(),
      lastJournalEventAt:parsed.lastEventAt || account.lastJournalEventAt,
      lastSystem:parsed.lastSystem || account.lastSystem,
    };
    await saveAccount(env, auth.session.sub, account);
    return json({
      ok:true,
      partial:status===206,
      targetSystem:TEST_SYSTEM,
      newEvents:parsed.events.length,
      storedEvents:merged.length,
      summary:summarizeEvents(merged),
      orderCycleId:matched.cycleId,
      verifiedOrders:rewardPreview,
      recentEvents:matched.events.slice(-20).reverse(),
      diagnosticEvents:auth.session.access === 'site_admin' ? parsed.diagnostics.slice(-500).reverse() : [],
      cooldown:syncCooldown(account),
      account:publicAccount(account),
    }, {headers:privateHeaders()});
  } catch (error) {
    console.error('Frontier journal sync failed', error);
    const code=String(error?.message||'');
    const reauth=code.includes('reauthorization');
    return json({ok:false,error:reauth?'frontier_reauthorization_required':'frontier_sync_failed'}, {status:reauth?401:502,headers:privateHeaders()});
  }
}
