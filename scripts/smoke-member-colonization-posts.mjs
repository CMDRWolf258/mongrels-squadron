import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalizeColonizationJob } from '../lib/colonization-jobs.js';
import { buildColonizationRewardDryRun } from '../lib/colonization-reward-dry-run.js';
import {
  appendRewardEntryWithResult,
  confirmMemberRewardPayment,
  listRewardEntries,
  markMemberRewardPaymentSent,
  markRewardEntriesPaid,
} from '../lib/reward-ledger.js';

class MemoryKv {
  constructor(){this.map=new Map();}
  async get(key,options={}){
    const value=this.map.get(key);
    if(value===undefined)return null;
    if(options?.type==='json')return typeof value==='string'?JSON.parse(value):value;
    return value;
  }
  async put(key,value){this.map.set(key,value);}
  async delete(key){this.map.delete(key);}
  async list({prefix='',limit=1000,cursor}={}){
    const names=[...this.map.keys()].filter(key=>key.startsWith(prefix)).sort();
    const keys=names.slice(0,limit).map(name=>({name}));
    return {keys,list_complete:true,cursor:''};
  }
}

const memberJob={...normalizeColonizationJob({
  id:'member-job',
  title:'Member funded build',
  system:'Test System',
  scope:'system',
  targetTons:5000,
  rewardBlockTons:1000,
  rewardBlockMillions:10,
  rewardBudgetMillions:50,
  fundingMode:'member',
  fundingApprovalStatus:'approved',
  postingOwnerId:'payer-user',
  postingCommander:'PayerCMDR',
  fundingPayerOwnerId:'payer-user',
  fundingPayerName:'PayerCMDR',
  startsAt:'2026-09-22T12:00:00.000Z',
  createdAt:'2026-09-22T12:00:00.000Z',
  createdBy:'Payer',
  updatedBy:'Payer',
}),revisionStartedAt:'2026-09-22T12:00:00.000Z',createdAt:'2026-09-22T12:00:00.000Z',updatedAt:'2026-09-22T12:00:00.000Z'};
assert.equal(memberJob.fundingMode,'member');
assert.equal(memberJob.fundingApprovalStatus,'approved');
assert.equal(memberJob.fundingPayerOwnerId,'payer-user');
memberJob.revisionStartedAt='2026-09-22T12:00:00.000Z';
memberJob.createdAt='2026-09-22T12:00:00.000Z';
memberJob.updatedAt='2026-09-22T12:00:00.000Z';
assert.equal(memberJob.rewardBudgetMillions,50);
console.log('✓ Member-funded Colonization metadata is durable');

const memberHistory=[record({
  publicationId:'member-create',
  appliedAt:'2026-09-22T12:00:01.000Z',
  after:[memberJob],
})];
const memberDry=await buildColonizationRewardDryRun({
  accounts:[account('hauler-user','HaulerCMDR',[contribution('member-event','2026-09-22T12:20:00.000Z',1000)])],
  colonizationStore:{version:1,jobs:[memberJob]},
  historyRecords:memberHistory,
  ledgerEntries:[],
});
assert.equal(memberDry.obligations.length,1);
const memberObligation=memberDry.obligations[0];
assert.equal(memberObligation.fundingMode,'member');
assert.equal(memberObligation.fundingPayerOwnerId,'payer-user');
assert.equal(memberObligation.payerDisplayName,'PayerCMDR');
assert.equal(memberObligation.deltaCredits,10_000_000);
assert.deepEqual(memberObligation.blockers,['colonization_member_funded_payment_flow']);
assert.equal(memberObligation.readyForLive,false,'Member-funded debt must not enter the squad manual issue path');
console.log('✓ Member-funded verified work is separated from the squad issue queue');

const selfDry=await buildColonizationRewardDryRun({
  accounts:[account('payer-user','PayerCMDR',[contribution('self-event','2026-09-22T12:25:00.000Z',1000)])],
  colonizationStore:{version:1,jobs:[memberJob]},
  historyRecords:memberHistory,
  ledgerEntries:[],
});
assert.ok(selfDry.obligations[0].blockers.includes('colonization_self_funded_contributor'));
console.log('✓ A member cannot generate a payable reward to themself');

const pendingSquad={...memberJob,id:'pending-squad',fundingMode:'squad',fundingApprovalStatus:'pending',fundingPayerOwnerId:'',fundingPayerName:'Regiment of Imperial Mongrels'};
const pendingDry=await buildColonizationRewardDryRun({
  accounts:[account('hauler-user','HaulerCMDR',[contribution('pending-event','2026-09-22T12:30:00.000Z',1000)])],
  colonizationStore:{version:1,jobs:[pendingSquad]},
  historyRecords:[record({publicationId:'pending-create',appliedAt:'2026-09-22T12:00:01.000Z',after:[pendingSquad]})],
  ledgerEntries:[],
});
assert.equal(pendingDry.obligations.length,0,'Pending squad funding must not accrue retroactive reward entitlement');
console.log('✓ Squad-funded requests start reward eligibility only after approval');

const approvedSquad={
  ...pendingSquad,
  revision:2,
  revisionStartedAt:'2026-09-22T12:40:00.000Z',
  fundingApprovalStatus:'approved',
  fundingApprovedAt:'2026-09-22T12:40:00.000Z',
  fundingApprovedBy:'Officer',
  updatedAt:'2026-09-22T12:40:00.000Z',
};
const approvedHistory=[
  record({publicationId:'pending-create',appliedAt:'2026-09-22T12:00:01.000Z',after:[pendingSquad]}),
  {
    ...record({publicationId:'pending-approve',appliedAt:'2026-09-22T12:40:01.000Z',after:[approvedSquad]}),
    action:'update',
    before:{version:1,jobs:[pendingSquad],updatedAt:'2026-09-22T12:40:01.000Z',updatedBy:'Officer'},
  },
];
const approvedDry=await buildColonizationRewardDryRun({
  accounts:[account('hauler-user','HaulerCMDR',[contribution('approved-event','2026-09-22T12:45:00.000Z',1000)])],
  colonizationStore:{version:1,jobs:[approvedSquad]},
  historyRecords:approvedHistory,
  ledgerEntries:[],
});
assert.equal(approvedDry.summary.readyObligations,1,'Post-approval hauling should enter the squad reward engine');
assert.equal(approvedDry.obligations[0].deltaCredits,10_000_000);
console.log('✓ Post-approval verified hauling becomes squad-reward eligible');

const env={DAILY_ORDERS:new MemoryKv()};
const created=await appendRewardEntryWithResult(env,{
  id:'member-ledger-1',
  ownerId:'hauler-user',
  displayName:'HaulerCMDR',
  kind:'colonization_job',
  amountCredits:10_000_000,
  reason:'Verified member-funded Colonization reward',
  sourceJobId:'member-job',
  fundingMode:'member',
  fundingApprovalStatus:'approved',
  payerOwnerId:'payer-user',
  payerDisplayName:'PayerCMDR',
  status:'owed',
});
assert.equal(created.created,true);
await assert.rejects(
  ()=>markRewardEntriesPaid(env,{ownerId:'hauler-user',entryIds:['member-ledger-1'],actor:'Site Admin'}),
  /member_funded_reward_requires_payer_flow/,
  'Site-admin squad payout flow must not settle member-funded debt',
);
const sent=await markMemberRewardPaymentSent(env,{
  payerOwnerId:'payer-user',
  ownerId:'hauler-user',
  entryId:'member-ledger-1',
  actor:'PayerCMDR',
});
assert.equal(sent.status,'payment_sent');
assert.ok(sent.paymentSentAt);
const paid=await confirmMemberRewardPayment(env,{
  ownerId:'hauler-user',
  entryId:'member-ledger-1',
  actor:'HaulerCMDR',
});
assert.equal(paid.status,'paid');
assert.ok(paid.paymentConfirmedAt);
const ledger=await listRewardEntries(env,'hauler-user');
assert.equal(ledger[0].status,'paid');
console.log('✓ Member-funded settlement follows OWED → PAYMENT SENT → PAID');

const tradePage=readFileSync('trading/index.html','utf8');
assert.match(tradePage,/data-colonization-board/);
assert.match(tradePage,/Post Colonization Job/);
assert.match(tradePage,/value="member">Member funded/);
assert.match(tradePage,/value="squad">Request squad funding/);
assert.match(tradePage,/trading-colonization\.js\?v=2/);
assert.match(tradePage,/trading-colonization\.css\?v=1/);
assert.match(tradePage,/value="archived">Archived/,'Trader\'s Outpost must expose completed Colonization Jobs as an archive');

const colonyUi=readFileSync('js/trading-colonization.js','utf8');
assert.match(colonyUi,/Complete & Archive/);
assert.match(colonyUi,/recentJobUpdates/,'Recent Colonization mutations must survive an immediately stale KV read');
assert.match(colonyUi,/mode==='archived'/);
assert.match(colonyUi,/Job completed and archived/);
new Function(colonyUi);

const memberApi=readFileSync('functions/api/colonization-jobs/index.js','utf8');
assert.match(memberApi,/requireMember/);
assert.match(memberApi,/postingOwnerId:auth\.session\.sub/);
assert.match(memberApi,/fundingApprovalStatus:'pending'/);
assert.match(memberApi,/approve-funding/);
assert.match(memberApi,/not_colonization_job_owner/);
assert.match(memberApi,/marketId:body\?\.job\?\.scope==='market'\?'':undefined/,'Member specific-build posts must start unbound');
assert.match(memberApi,/endsAt:statusChanged\?\(requestedStatus==='active'\?null:/,'Editor status changes must create the same pause\/complete earning boundary');

const paymentsApi=readFileSync('functions/api/rewards/member-payments.js','utf8');
assert.match(paymentsApi,/mark-sent/);
assert.match(paymentsApi,/confirm-received/);

const rewardAdmin=readFileSync('functions/api/rewards/admin.js','utf8');
assert.match(rewardAdmin,/entry=>entry\?\.fundingMode!=='member'/,'Member-funded debt must be excluded from the squad payment console');

const frontierSync=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(frontierSync,/reconcileMemberFundedColonizationRewards/,'Verified Frontier sync must reconcile member-funded Colonization obligations');

const rewardsPage=readFileSync('rewards/index.html','utf8');
assert.match(rewardsPage,/Payments I Owe/);
assert.match(rewardsPage,/data-member-payment-list/);
assert.match(rewardsPage,/rewards\.js\?v=3/);
assert.match(rewardsPage,/rewards\.css\?v=3/);
const rewardsUi=readFileSync('js/rewards.js','utf8');
assert.match(rewardsUi,/Mark Payment Sent/);
assert.match(rewardsUi,/Confirm Received/);
assert.match(rewardsUi,/squadOwedCredits/);
const rewardPreview=readFileSync('js/reward-preview.js','utf8');
assert.match(rewardPreview,/memberPaymentSentCredits/);

console.log('\nAll member Colonization posting and funding smoke checks passed.');

function account(userId,commander,events){
  return {userId,account:{commander},events};
}
function contribution(id,timestamp,totalTons){
  return {
    id,
    type:'colonization_contribution',
    timestamp,
    system:'Test System',
    marketId:'',
    totalTons,
    contributions:[{commodity:'Titanium',commodityCode:'titanium',amount:totalTons}],
  };
}
function record({publicationId,appliedAt,after}){
  return {
    version:1,
    publicationId,
    state:'applied',
    action:'create',
    targetJobId:after?.[0]?.id||'',
    preparedAt:appliedAt,
    appliedAt,
    actor:'Test',
    legacyBaseline:false,
    beforeHash:'before-'+publicationId,
    afterHash:'after-'+publicationId,
    changes:{counts:{added:1,revised:0,removed:0,unchanged:0},material:true,rows:[]},
    before:{version:1,jobs:[],updatedAt:null,updatedBy:null},
    after:{version:1,jobs:after||[],updatedAt:appliedAt,updatedBy:'Test'},
  };
}
