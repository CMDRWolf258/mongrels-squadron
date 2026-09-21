import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts } from '../../../lib/frontier.js';
import { matchVerifiedActivity, readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { listOrderPublications } from '../../../lib/order-history.js';
import { listAllRewardEntries } from '../../../lib/reward-ledger.js';
import { readRewardSettings } from '../../../lib/reward-rules.js';
import { buildRewardDryRun, REWARD_ENGINE_MODE } from '../../../lib/reward-dry-run.js';

const ALLOWED=new Set(['officer','site_admin']);

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(!ALLOWED.has(session.access))return reply({ok:false,error:'officer_access_required'},403);

  const [current,rewardSettings,accounts,ledgerEntries]=await Promise.all([
    readCurrentOrderCycle(env),
    readRewardSettings(env),
    listFrontierAccounts(env),
    listAllRewardEntries(env),
  ]);

  const historyRecords=await listOrderPublications(env,{
    limit:250,
    cycleId:current?.cycleId||'',
  });

  const enriched=[];
  for(const accountRow of accounts){
    const events=await getEvents(env,accountRow.userId);
    const matched=matchVerifiedActivity(events,current);
    enriched.push({...accountRow,matched});
  }

  const dryRun=await buildRewardDryRun({
    current,
    accounts:enriched,
    rewardSettings:rewardSettings.settings,
    historyRecords,
    ledgerEntries,
  });

  return reply({
    ok:true,
    ...dryRun,
    engineMode:REWARD_ENGINE_MODE,
    automaticLedgerWrites:false,
    dryRunOnly:true,
    rewardSettingsUpdatedAt:rewardSettings.updatedAt,
    rewardSettingsUpdatedBy:rewardSettings.updatedBy,
    historyRecordCount:historyRecords.length,
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
