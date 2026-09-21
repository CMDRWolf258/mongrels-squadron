import { ensureAccessToken, fetchJournal, getAccount, mergeEvents, parseJournal, privateHeaders, publicAccount, requireMember, sameOrigin, saveAccount, summarizeEvents, syncCooldown } from '../../../lib/frontier.js';
import { json } from '../../../lib/auth.js';
import { activeOrderSystems, matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { buildRewardPreview, readRewardSettings } from '../../../lib/reward-rules.js';
import { activeColonizationJobs, activeColonizationSystems, earliestColonizationStart, readColonizationJobs } from '../../../lib/colonization-jobs.js';

const HISTORICAL_LOOKBACK_DAYS = 3;

export async function onRequestPost({request,env}) {
  const auth = await requireMember(request, env);
  if (auth.response) return auth.response;
  if (!sameOrigin(request)) return json({ok:false,error:'request_validation_failed'}, {status:403,headers:privateHeaders()});

  let account = await getAccount(env, auth.session.sub);
  if (!account) return json({ok:false,error:'frontier_not_connected'}, {status:409,headers:privateHeaders()});

  const currentOrders = await readCurrentOrderCycle(env);
  const colonizationStore = await readColonizationJobs(env);
  const colonizationJobs = activeColonizationJobs(colonizationStore);
  const targetSystems = [...new Set([...activeOrderSystems(currentOrders),...activeColonizationSystems(colonizationJobs)])];
  const cooldown = syncCooldown(account);
  if (!cooldown.ready) {
    return json({
      ok:false,
      error:'frontier_sync_cooldown',
      retryAfterSeconds:cooldown.remainingSeconds,
      nextSyncAt:cooldown.nextSyncAt,
      targetSystems,
      claimTrackingEnabled:true,
      cooldown,
      account:publicAccount(account),
    }, {status:429,headers:{...privateHeaders(),'Retry-After':String(cooldown.remainingSeconds)}});
  }

  try {
    let access = await ensureAccessToken(request, env, auth.session.sub, account);
    account = access.account;

    let current = await fetchJournal(access.accessToken, env);
    if (current.response.status === 401 || current.response.status === 422) {
      access = await ensureAccessToken(request, env, auth.session.sub, {...account,accessExpiresAt:'1970-01-01T00:00:00Z'});
      account = access.account;
      current = await fetchJournal(access.accessToken, env);
    }

    const currentStatus=current.response.status;
    if (![200,204,206].includes(currentStatus)) throw new Error('frontier_journal_' + currentStatus);
    let currentText='';
    if (currentStatus !== 204) {
      currentText=await current.response.text();
      if (currentText.trim()==='Journal unavailable') throw new Error('frontier_journal_unavailable');
    }

    const reconciled = new Set(Array.isArray(account.reconciledJournalDates) ? account.reconciledJournalDates : []);
    const historicalDate = nextHistoricalDate(currentOrders,reconciled,colonizationJobs);
    let historicalStatus=null;
    let historicalText='';

    if (historicalDate) {
      const path='/' + historicalDate.replaceAll('-','/');
      const historical=await fetchJournal(access.accessToken,env,path);
      historicalStatus=historical.response.status;
      if ([200,206].includes(historicalStatus)) {
        historicalText=await historical.response.text();
        if (historicalText.trim()==='Journal unavailable') historicalText='';
      } else if (historicalStatus !== 204) {
        console.warn('Historical Frontier journal request failed', historicalDate, historicalStatus);
      }
      if (historicalStatus===200 || historicalStatus===204) reconciled.add(historicalDate);
    }

    const yesterday=formatUtcDay(addUtcDays(utcDay(new Date()),-1));
    let parsed;
    if (historicalText && historicalDate === yesterday) {
      parsed=parseJournal([historicalText,currentText].filter(Boolean).join('\n'),targetSystems,{
        diagnostics:auth.session.access === 'site_admin',
        knownSystemAddresses:account.systemAddresses || {},
      });
    } else {
      const historicalParsed=historicalText
        ? parseJournal(historicalText,targetSystems,{
            diagnostics:auth.session.access === 'site_admin',
            knownSystemAddresses:account.systemAddresses || {},
          })
        : emptyParsed(targetSystems);
      const currentParsed=currentText
        ? parseJournal(currentText,targetSystems,{
            diagnostics:auth.session.access === 'site_admin',
            knownSystemAddresses:{...(account.systemAddresses||{}),...(historicalParsed.systemAddresses||{})},
          })
        : emptyParsed(targetSystems);
      parsed=mergeParsed(historicalParsed,currentParsed,targetSystems);
    }
    const merged = await mergeEvents(env, auth.session.sub, parsed.events, parsed.excluded);
    const matched = matchVerifiedActivity(merged, currentOrders);
    const rewardSettings = await readRewardSettings(env);
    const rewardPreview = buildRewardPreview(matched.orderTotals, rewardSettings.settings);

    account = {
      ...account,
      lastSyncAt:new Date().toISOString(),
      lastJournalEventAt:parsed.lastEventAt || account.lastJournalEventAt,
      lastSystem:parsed.lastSystem || account.lastSystem,
      systemAddresses:{...(account.systemAddresses||{}),...(parsed.systemAddresses||{})},
      reconciledJournalDates:[...reconciled].sort().slice(-14),
    };
    await saveAccount(env, auth.session.sub, account);

    return json({
      ok:true,
      partial:currentStatus===206 || historicalStatus===206,
      targetSystems,
      claimTrackingEnabled:true,
      newEvents:parsed.events.length,
      storedEvents:merged.length,
      summary:summarizeEvents(merged),
      orderCycleId:matched.cycleId,
      verifiedOrders:rewardPreview,
      recentEvents:matched.events.slice(-20).reverse(),
      diagnosticEvents:auth.session.access === 'site_admin' ? parsed.diagnostics.slice(-500).reverse() : [],
      journalCoverage:{
        currentStatus,
        historicalDate,
        historicalStatus,
        reconciledDates:account.reconciledJournalDates,
      },
      cooldown:syncCooldown(account),
      account:publicAccount(account),
      message:currentStatus===204 && !historicalText
        ? 'No current-day journal data is available from Frontier yet.'
        : undefined,
    }, {headers:privateHeaders()});
  } catch (error) {
    console.error('Frontier journal sync failed', error);
    const code=String(error?.message||'');
    const reauth=code.includes('reauthorization');
    return json({ok:false,error:reauth?'frontier_reauthorization_required':'frontier_sync_failed'}, {status:reauth?401:502,headers:privateHeaders()});
  }
}

function emptyParsed(targetSystems) {
  return {
    events:[],excluded:[],diagnostics:[],lastEventAt:null,lastSystem:'',
    targetSystems:Array.isArray(targetSystems)?targetSystems:[],
    systemAddresses:{},
  };
}

function mergeParsed(a,b,targetSystems) {
  return {
    events:[...(a?.events||[]),...(b?.events||[])],
    excluded:[...(a?.excluded||[]),...(b?.excluded||[])],
    diagnostics:[...(a?.diagnostics||[]),...(b?.diagnostics||[])],
    lastEventAt:[a?.lastEventAt,b?.lastEventAt].filter(Boolean).sort().at(-1)||null,
    lastSystem:b?.lastSystem||a?.lastSystem||'',
    targetSystems:Array.isArray(targetSystems)?targetSystems:[],
    systemAddresses:{...(a?.systemAddresses||{}),...(b?.systemAddresses||{})},
  };
}

function nextHistoricalDate(currentOrders,reconciled,colonizationJobs=[]) {
  const today=utcDay(new Date());
  const orderStart=cycleStart(currentOrders);
  const colonizationStart=earliestColonizationStart(colonizationJobs);
  const startCandidates=[orderStart,colonizationStart].filter(Boolean).map(value=>new Date(value));
  const oldestAllowed=addUtcDays(today,-HISTORICAL_LOOKBACK_DAYS);
  const start=startCandidates.length?new Date(Math.min(...startCandidates.map(value=>value.getTime()))):oldestAllowed;
  const startDay=utcDay(start);
  if (startDay >= today) return null;

  const first=startDay < oldestAllowed ? oldestAllowed : startDay;
  const candidates=[];
  for(let day=addUtcDays(today,-1); day>=first; day=addUtcDays(day,-1)) {
    const key=formatUtcDay(day);
    if (!reconciled.has(key)) candidates.push(key);
  }
  return candidates[0] || null;
}

function cycleStart(current) {
  const values=[
    current?.cycleStartedAt,
    ...(Array.isArray(current?.orders)?current.orders.map(order=>order?.createdAt):[]),
    current?.updatedAt,
  ].map(value=>Date.parse(value||'')).filter(Number.isFinite);
  return values.length ? new Date(Math.min(...values)) : null;
}

function utcDay(value) {
  const d=value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
}
function addUtcDays(value,days) {
  const d=new Date(value);
  d.setUTCDate(d.getUTCDate()+days);
  return d;
}
function formatUtcDay(value) {
  return value.toISOString().slice(0,10);
}

async function readStoredEvents(env,userId) {
  const stored=await env.DAILY_ORDERS.get('frontier-bgs-events:'+userId,{type:'json'});
  return Array.isArray(stored?.events)?stored.events:[];
}
