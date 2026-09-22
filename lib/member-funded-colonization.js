import { getEvents, listFrontierAccounts } from './frontier.js';
import { readColonizationJobs } from './colonization-jobs.js';
import { listColonizationJobPublications } from './colonization-job-history.js';
import { buildColonizationRewardDryRun } from './colonization-reward-dry-run.js';
import { appendRewardEntryWithResult, listAllRewardEntries } from './reward-ledger.js';

const MEMBER_FLOW_BLOCKER='colonization_member_funded_payment_flow';

export async function reconcileMemberFundedColonizationRewards(env,{actor='member-funded-colonization-reconciler'}={}) {
  const [store,accounts,historyRecords,ledgerEntries]=await Promise.all([
    readColonizationJobs(env),
    listFrontierAccounts(env),
    listColonizationJobPublications(env,{limit:500}),
    listAllRewardEntries(env),
  ]);
  if(!accounts.length||!store.jobs.length)return{created:0,createdCredits:0,skipped:0};

  const accountRows=await Promise.all(accounts.map(async row=>({
    ...row,
    events:await getEvents(env,row.userId),
  })));
  const dry=await buildColonizationRewardDryRun({
    accounts:accountRows,
    colonizationStore:store,
    historyRecords,
    ledgerEntries,
  });

  const spentByJob=new Map();
  for(const entry of ledgerEntries){
    if(entry?.fundingMode!=='member'||!entry?.sourceJobId)continue;
    spentByJob.set(String(entry.sourceJobId),(spentByJob.get(String(entry.sourceJobId))||0)+(Number(entry.amountCredits)||0));
  }

  const candidates=(dry.obligations||[])
    .filter(obligation=>
      obligation?.fundingMode==='member'
      && obligation?.plannedEntry
      && Number(obligation?.deltaCredits)>0
      && memberOnlyBlockers(obligation.blockers)
      && obligation?.fundingPayerOwnerId
      && obligation?.ownerId!==obligation?.fundingPayerOwnerId
    )
    .sort((a,b)=>
      String(a.firstContributionAt||'').localeCompare(String(b.firstContributionAt||''))
      || String(a.jobId||'').localeCompare(String(b.jobId||''))
      || String(a.ownerId||'').localeCompare(String(b.ownerId||''))
    );

  let created=0,createdCredits=0,skipped=0;
  for(const obligation of candidates){
    const budgetCredits=Math.round((Number(obligation.rewardBudgetMillions)||0)*1000000);
    const unlimitedBudget=budgetCredits<=0;
    const alreadySpent=Math.round(spentByJob.get(String(obligation.jobId))||0);
    const remaining=unlimitedBudget?Number.POSITIVE_INFINITY:Math.max(0,budgetCredits-alreadySpent);
    const blockCredits=Math.max(1,Math.round((Number(obligation.rewardBlockMillions)||0)*1000000));
    const budgeted=unlimitedBudget
      ? Math.round(Number(obligation.deltaCredits)||0)
      : Math.floor(remaining/blockCredits)*blockCredits;
    const award=Math.min(Math.round(Number(obligation.deltaCredits)||0),budgeted);
    if(award<=0){skipped+=1;continue;}

    const entryId=await memberEntryId(obligation,alreadySpent,award);
    const entry={
      ...obligation.plannedEntry,
      id:entryId,
      amountCredits:award,
      fundingMode:'member',
      fundingApprovalStatus:'approved',
      payerOwnerId:obligation.fundingPayerOwnerId,
      payerDisplayName:obligation.payerDisplayName||'Posting CMDR',
      rewardBudgetCredits:budgetCredits,
      sourceObligationId:obligation.id,
      approvalMode:'member_funded_auto_verified',
      approvedAt:new Date().toISOString(),
      approvedBy:actor,
      createdBy:actor,
      status:'owed',
    };
    const result=await appendRewardEntryWithResult(env,entry);
    if(result.created){
      created+=1;
      createdCredits+=award;
      spentByJob.set(String(obligation.jobId),alreadySpent+award);
    }
  }

  return{
    created,
    createdCredits,
    skipped,
    evaluated:candidates.length,
    generatedAt:new Date().toISOString(),
  };
}

function memberOnlyBlockers(blockers=[]){
  const rows=(Array.isArray(blockers)?blockers:[]).filter(Boolean);
  return rows.length===1&&rows[0]===MEMBER_FLOW_BLOCKER;
}
async function memberEntryId(obligation,alreadySpent,award){
  const text=[
    'member-funded-colonization-v1',
    obligation.ownerId||'',
    obligation.jobId||'',
    obligation.evidenceDigest||'',
    obligation.rewardRuleDigest||'',
    Math.round(Number(alreadySpent)||0),
    Math.round(Number(award)||0),
  ].join('|');
  const bytes=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  const hex=[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return'member-colonization-'+hex.slice(0,40);
}
