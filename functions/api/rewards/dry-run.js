import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts } from '../../../lib/frontier.js';
import { matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { ensureOrderHistoryBaseline, listOrderPublications } from '../../../lib/order-history.js';
import { listAllRewardEntries } from '../../../lib/reward-ledger.js';
import { readRewardSettings } from '../../../lib/reward-rules.js';
import { buildRewardDryRun, REWARD_ENGINE_MODE } from '../../../lib/reward-dry-run.js';
import { readColonizationJobs } from '../../../lib/colonization-jobs.js';
import { listColonizationJobPublications } from '../../../lib/colonization-job-history.js';
import { buildColonizationRewardDryRun, mergeRewardDryRuns } from '../../../lib/colonization-reward-dry-run.js';

const ALLOWED=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'officer_access_required'},403);

  const [current,rewardSettings,accounts,ledgerEntries,colonizationStore]=await Promise.all([
    readCurrentOrderCycle(env),
    readRewardSettings(env),
    listFrontierAccounts(env),
    listAllRewardEntries(env),
    readColonizationJobs(env),
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
      const baseline=await ensureOrderHistoryBaseline(env,current,historyRecords,'Reward Engine migration');
      if(baseline)historyRecords=[baseline];
    }catch(error){
      console.error('Could not initialize Daily Order history baseline for reward dry run',error);
    }
  }

  const enriched=[];
  for(const accountRow of accounts){
    const events=await getEvents(env,accountRow.userId);
    const matched=matchVerifiedActivity(events,current);
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
  const dryRun=mergeRewardDryRuns(dailyDryRun,colonizationDryRun);

  return reply({
    ok:true,
    ...dryRun,
    engineMode:REWARD_ENGINE_MODE,
    automaticLedgerWrites:false,
    dryRunOnly:true,
    rewardSettingsUpdatedAt:rewardSettings.updatedAt,
    rewardSettingsUpdatedBy:rewardSettings.updatedBy,
    historyRecordCount:historyRecords.length,
    colonizationHistoryRecordCount:colonizationHistoryRecords.length,
    colonizationJobCount:Array.isArray(colonizationStore?.jobs)?colonizationStore.jobs.length:0,
    ledgerEntryCount:ledgerEntries.length,
  });
}

function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
