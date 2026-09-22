import { getEvents, listFrontierAccounts } from './frontier.js';
import { matchVerifiedActivityHistory, readCurrentOrderCycle } from './order-activity.js';
import { ensureOrderHistoryBaseline, listOrderPublications } from './order-history.js';
import { listAllRewardEntries } from './reward-ledger.js';
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
    listOrderPublications(env,{
      limit:250,
      cycleId:current?.cycleId||'',
    }),
    listColonizationJobPublications(env,{limit:500}),
  ]);

  if(!historyRecords.length&&current?.cycleId){
    try{
      const baseline=await ensureOrderHistoryBaseline(env,current,historyRecords,baselineActor);
      if(baseline)historyRecords=[baseline];
    }catch(error){
      console.error('Could not initialize Daily Order history baseline for reward engine',error);
    }
  }

  const enriched=[];
  for(const accountRow of accounts){
    const events=await getEvents(env,accountRow.userId);
    const matched=matchVerifiedActivityHistory(events,current,{depth:7});
    enriched.push({...accountRow,events,matched});
  }

  const dailyDryRun=await buildRewardDryRun({
    current,
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
