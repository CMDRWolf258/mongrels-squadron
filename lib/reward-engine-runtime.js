import { getEvents, listFrontierAccounts } from './frontier.js';
import { matchVerifiedActivityHistory, readCurrentOrderCycle } from './order-activity.js';
import { decorateDailyOrdersForTiming } from './daily-order-cycle.js';
import { archivedRemovedOrders, ensureOrderHistoryBaseline, listOrderPublications } from './order-history.js';
import { appendRewardEntryWithResult, listAllRewardEntries } from './reward-ledger.js';
import { readRewardSettings } from './reward-rules.js';
import { buildRewardDryRun, REWARD_ENGINE_MODE } from './reward-dry-run.js';
import { readColonizationJobs } from './colonization-jobs.js';
import { listColonizationJobPublications } from './colonization-job-history.js';
import { buildColonizationRewardDryRun, mergeRewardDryRuns } from './colonization-reward-dry-run.js';
import { listScoutRewardWinners } from './scout-jobs.js';
import { buildScoutRewardDryRun } from './scout-reward-dry-run.js';

export async function buildUnifiedRewardEngineState(env,{baselineActor='Reward Engine migration'}={}) {
  const [current,rewardSettings,accounts,ledgerEntries,colonizationStore,scoutWinners]=await Promise.all([
    readCurrentOrderCycle(env,{historyDepth:7}),
    readRewardSettings(env),
    listFrontierAccounts(env),
    listAllRewardEntries(env),
    readColonizationJobs(env),
    listScoutRewardWinners(env),
  ]);

  let [historyRecords,colonizationHistoryRecords]=await Promise.all([
    listOrderPublications(env,{limit:250}),
    listColonizationJobPublications(env,{limit:500}),
  ]);

  const currentCycleHistory=historyRecords.filter(record=>
    !current?.cycleId
    || record?.cycleId===current.cycleId
    || record?.previousCycleId===current.cycleId
  );
  if(!currentCycleHistory.length&&current?.cycleId){
    try{
      const baseline=await ensureOrderHistoryBaseline(env,current,historyRecords,baselineActor);
      if(baseline)historyRecords=[baseline,...historyRecords];
    }catch(error){
      console.error('Could not initialize Daily Order history baseline for reward engine',error);
    }
  }

  const archivedOrders=archivedRemovedOrders(historyRecords,current?.orders);
  const rewardCurrent=archivedOrders.length
    ? await decorateDailyOrdersForTiming(env,{
        ...current,
        orders:[...(Array.isArray(current?.orders)?current.orders:[]),...archivedOrders],
      },{historyDepth:7})
    : current;

  const enriched=[];
  for(const accountRow of accounts){
    const events=await getEvents(env,accountRow.userId);
    const matched=matchVerifiedActivityHistory(events,rewardCurrent,{depth:7});
    enriched.push({...accountRow,events,matched});
  }

  const dailyDryRun=await buildRewardDryRun({
    current:rewardCurrent,
    accounts:enriched,
    rewardSettings:rewardSettings.settings,
    historyRecords,
    ledgerEntries,
  });
  const colonizationDryRun=await buildColonizationRewardDryRun({
    accounts:enriched,
    colonizationStore,
    historyRecords:colonizationHistoryRecords,
    ledgerEntries,
  });
  const scoutingDryRun=await buildScoutRewardDryRun({
    winners:scoutWinners,
    ledgerEntries,
  });
  const dryRun=mergeRewardDryRuns(dailyDryRun,colonizationDryRun,scoutingDryRun);

  return {
    dryRun:{
      ...dryRun,
      engineMode:REWARD_ENGINE_MODE,
      automaticLedgerWrites:false,
      dryRunOnly:true,
      rewardSettingsUpdatedAt:rewardSettings.updatedAt,
      rewardSettingsUpdatedBy:rewardSettings.updatedBy,
      historyRecordCount:historyRecords.length,
      dailyOrderWorkCycleHistoryDepth:7,
      colonizationHistoryRecordCount:colonizationHistoryRecords.length,
      colonizationJobCount:Array.isArray(colonizationStore?.jobs)?colonizationStore.jobs.length:0,
      scoutWinnerCount:Array.isArray(scoutWinners)?scoutWinners.length:0,
      ledgerEntryCount:ledgerEntries.length,
    },
    current,
    rewardMatchingOrderCount:Array.isArray(rewardCurrent?.orders)?rewardCurrent.orders.length:0,
    archivedRewardOrderCount:archivedOrders.length,
    rewardSettings,
    accounts:enriched,
    ledgerEntries,
    colonizationStore,
    historyRecords,
    colonizationHistoryRecords,
    scoutWinners,
  };
}

export function flattenRewardObligations(dryRun){
  return (Array.isArray(dryRun?.members)?dryRun.members:[])
    .flatMap(member=>Array.isArray(member?.obligations)?member.obligations:[]);
}

export async function issueReadyRewardObligations(env,dryRun,{actor='Reward Engine'}={}){
  const obligations=flattenRewardObligations(dryRun);
  const ready=obligations.filter(item=>
    item?.readyForLive===true
    && item?.plannedEntry
    && !(Array.isArray(item?.blockers)&&item.blockers.length)
    && Math.round(Number(item?.deltaCredits)||0)>0
    && item?.plannedEntry?.fundingMode!=='member'
    && item?.fundingMode!=='member'
  );
  const approvedAt=new Date().toISOString();
  const createdEntries=[];
  let duplicateSuppressed=0;
  let createdCredits=0;

  for(const obligation of ready){
    const amountCredits=Math.round(Number(obligation.deltaCredits)||0);
    const entry={
      ...obligation.plannedEntry,
      id:obligation.id,
      amountCredits,
      status:'owed',
      createdAt:approvedAt,
      createdBy:'reward-engine-auto',
      sourceObligationId:obligation.id,
      approvalMode:'automatic_verified_issue',
      approvedAt,
      approvedBy:actor,
    };
    const result=await appendRewardEntryWithResult(env,entry);
    if(result.created){
      createdEntries.push(result.entry);
      createdCredits+=amountCredits;
    }else{
      duplicateSuppressed+=1;
    }
  }

  return{
    evaluated:obligations.length,
    ready:ready.length,
    created:createdEntries.length,
    createdCredits,
    duplicateSuppressed,
    entries:createdEntries,
    reconciledAt:approvedAt,
  };
}

export async function reconcileAutomaticRewardEntries(env,{
  actor='Reward Engine',
  baselineActor='Automatic reward issuance',
}={}){
  const state=await buildUnifiedRewardEngineState(env,{baselineActor});
  const issuance=await issueReadyRewardObligations(env,state.dryRun,{actor});
  return{...issuance,dryRun:state.dryRun};
}

