import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildRewardPaidHistoryPage } from '../lib/reward-history.js';
import {
  cancelRewardPayoutRequest,
  readRewardPayoutRequest,
  reconcileRewardPayoutRequest,
  requestRewardPayout,
  rewardPayoutRequestView,
} from '../lib/reward-payout-requests.js';

function fakeKv(){
  const map=new Map();
  return {
    map,
    async get(key,{type}={}){
      const value=map.get(key);
      if(value===undefined)return null;
      return type==='json'?JSON.parse(value):value;
    },
    async put(key,value){map.set(key,String(value));},
    async delete(key){map.delete(key);},
    async list({prefix=''}) {
      return {keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),list_complete:true};
    },
  };
}

const env={DAILY_ORDERS:fakeKv()};
const entries=[
  {id:'reward-a',ownerId:'wolf',displayName:'Wolf258',status:'owed',amountCredits:20_000_000,kind:'colonization_job'},
  {id:'reward-b',ownerId:'wolf',displayName:'Wolf258',status:'owed',amountCredits:10_000_000,kind:'verified_order'},
  {id:'reward-paid',ownerId:'wolf',displayName:'Wolf258',status:'paid',amountCredits:5_000_000,kind:'verified_order'},
];

const requested=await requestRewardPayout(env,{
  ownerId:'wolf',
  displayName:'Wolf258',
  entries,
  actor:'Wolf258',
});
assert.equal(requested.state,'requested');
assert.equal(requested.requestedCredits,30_000_000);
assert.deepEqual(new Set(requested.entryIds),new Set(['reward-a','reward-b']));
let view=rewardPayoutRequestView(requested,entries);
assert.equal(view.active,true);
assert.equal(view.requestedRemainingCredits,30_000_000);
assert.equal(view.currentAvailableCredits,30_000_000);
console.log('✓ Member payout request snapshots the current owed balance and entries');

const withNew=[...entries,{id:'reward-new',ownerId:'wolf',displayName:'Wolf258',status:'owed',amountCredits:7_000_000,kind:'scouting_job'}];
view=rewardPayoutRequestView(requested,withNew);
assert.equal(view.newSinceRequestCredits,7_000_000,'New rewards after a request should be visible separately');
assert.equal(view.requestedRemainingCredits,30_000_000);
console.log('✓ Rewards earned after a payout request remain distinguishable from the requested snapshot');

const partial=withNew.map(entry=>entry.id==='reward-a'?{...entry,status:'paid'}:entry);
const stillRequested=await reconcileRewardPayoutRequest(env,{
  ownerId:'wolf',
  entries:partial,
  actor:'Wolf',
  paymentBatchId:'batch-partial',
});
assert.equal(stillRequested.state,'requested','Partial settlement must not fulfill the payout request');
view=rewardPayoutRequestView(stillRequested,partial);
assert.equal(view.requestedRemainingCredits,10_000_000);

const full=partial.map(entry=>entry.id==='reward-b'?{...entry,status:'paid'}:entry);
const fulfilled=await reconcileRewardPayoutRequest(env,{
  ownerId:'wolf',
  entries:full,
  actor:'Wolf',
  paymentBatchId:'batch-full',
});
assert.equal(fulfilled.state,'fulfilled');
assert.equal(fulfilled.paymentBatchId,'batch-full');
view=rewardPayoutRequestView(fulfilled,full);
assert.equal(view.active,false);
assert.equal(view.currentAvailableCredits,7_000_000,'New scouting reward remains available after the older request is fulfilled');
console.log('✓ Payout request stays active through partial payment and fulfills only after requested entries settle');

const second=await requestRewardPayout(env,{ownerId:'wolf',displayName:'Wolf258',entries:full,actor:'Wolf258'});
assert.equal(second.requestedCredits,7_000_000);
const cancelled=await cancelRewardPayoutRequest(env,{ownerId:'wolf',actor:'Wolf258'});
assert.equal(cancelled.state,'cancelled');
assert.equal((await readRewardPayoutRequest(env,'wolf')).state,'cancelled');
console.log('✓ Members can cancel a request without changing the underlying owed balance');

const paidHistoryEntries=[];
for(let batch=0;batch<15;batch+=1){
  const paidAt=new Date(Date.UTC(2026,8,22-batch,12,0,0)).toISOString();
  paidHistoryEntries.push({
    id:'history-'+batch+'-a',
    ownerId:'wolf',
    displayName:'Wolf258',
    status:'paid',
    amountCredits:1_000_000,
    kind:'verified_order',
    reason:'History reward A',
    paidAt,
    paidBy:'Wolf',
    paymentBatchId:'history-batch-'+batch,
  });
  if(batch===0)paidHistoryEntries.push({
    id:'history-'+batch+'-b',
    ownerId:'wolf',
    displayName:'Wolf258',
    status:'paid',
    amountCredits:2_000_000,
    kind:'colonization_job',
    reason:'History reward B',
    paidAt,
    paidBy:'Wolf',
    paymentBatchId:'history-batch-'+batch,
  });
}
const firstHistory=buildRewardPaidHistoryPage(paidHistoryEntries,{offset:0,limit:12});
assert.equal(firstHistory.returnedBatchCount,12);
assert.equal(firstHistory.totalBatchCount,15);
assert.equal(firstHistory.hasMore,true);
assert.equal(firstHistory.nextOffset,12);
assert.equal(firstHistory.batches[0].entryCount,2,'Entries paid in one transfer should stay grouped as one payout batch');
assert.equal(firstHistory.batches[0].totalCredits,3_000_000);
const olderHistory=buildRewardPaidHistoryPage(paidHistoryEntries,{offset:firstHistory.nextOffset,limit:12});
assert.equal(olderHistory.returnedBatchCount,3);
assert.equal(olderHistory.hasMore,false);
assert.equal(olderHistory.nextOffset,null);
console.log('✓ Paid history starts with 12 payout batches and can load the remaining older batches');

const status=readFileSync('functions/api/rewards/status.js','utf8');
assert.match(status,/rewardPayoutRequestView/);
assert.match(status,/viewer:/);
assert.match(status,/paidHistory:buildRewardPaidHistoryPage/);
assert.match(status,/status==='owed'\|\|entry\?\.status==='payment_sent'/);
const historyApi=readFileSync('functions/api/rewards/history.js','utf8');
assert.match(historyApi,/buildRewardPaidHistoryPage/);
assert.match(historyApi,/session\.sub/);
assert.match(historyApi,/member_access_required/);
const requestApi=readFileSync('functions/api/rewards/request.js','utf8');
for(const pattern of [
  /member_access_required/,
  /mongrels-reward-request/,
  /expectedAvailableCredits/,
  /reward_balance_changed/,
  /requestRewardPayout/,
  /cancelRewardPayoutRequest/,
]) assert.match(requestApi,pattern);
assert.doesNotMatch(requestApi,/ownerId\s*=\s*clean\(body/,'Member payout requests must be bound to the authenticated session, not a client owner ID');

const admin=readFileSync('functions/api/rewards/admin.js','utf8');
assert.match(admin,/payoutRequest:rewardPayoutRequestView/);
assert.match(admin,/payoutRequest\?\.active/);
const pay=readFileSync('functions/api/rewards/pay.js','utf8');
assert.match(pay,/reconcileRewardPayoutRequest/);

const page=readFileSync('rewards/index.html','utf8');
for(const pattern of [
  /Member Account/,
  /Unsettled Rewards/,
  /Outstanding Rewards/,
  /id="outstanding-rewards"/,
  /id="payments-i-owe"/,
  /Squad Payout Status/,
  /Request Payout/,
  /Paid Rewards/,
  /Private account/,
  /data-reward-paid-more/,
  /rewards\.js\?v=3/,
  /rewards\.css\?v=3/,
]) assert.match(page,pattern);

const ui=readFileSync('js/rewards.js','utf8');
for(const pattern of [
  /\/api\/rewards\/status/,
  /\/api\/rewards\/request/,
  /COLONIZATION/,
  /SCOUTING/,
  /BGS/,
  /Update Request/,
  /data-cancel-reward-payout/,
  /mutateRequest\('cancel'\)/,
  /LOAD OLDER PAYOUTS/,
  /\/api\/rewards\/history/,
  /\/api\/rewards\/member-payments/,
  /paidHistoryNextOffset/,
]) assert.match(ui,pattern);
new Function(ui);

const ops=readFileSync('operations/index.html','utf8');
assert.match(ops,/data-mc-reward-preview/);
assert.match(ops,/Open Reward Account/);
assert.match(ops,/reward-preview\.js\?v=2/);
const preview=readFileSync('js/reward-preview.js','utf8');
assert.match(preview,/PAYOUT REQUESTED/);
assert.match(preview,/\/api\/rewards\/status/);
new Function(preview);
console.log('✓ Dedicated member Rewards page and Mission Control balance preview are wired');

const ledger=readFileSync('lib/reward-ledger.js','utf8');
assert.match(ledger,/scouting_job/,'Reward ledger should preserve future scouting reward entries');

const frontierSync=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(
  frontierSync,
  /Number\(automaticRewards\?\.created\|\|0\)\+Number\(memberFundedColonization\?\.created\|\|0\)/,
  'Frontier sync must refresh Rewards Discord when either squad-funded or member-funded rewards are created',
);
const colonizationJobsApi=readFileSync('functions/api/colonization-jobs/index.js','utf8');
for(const pattern of [
  /syncRewardsDiscordIfCreated/,
  /reconciliation\?\.memberFunded\?\.created/,
  /reconciliation\?\.squad\?\.created/,
  /syncRewardDiscordBoard/,
])assert.match(colonizationJobsApi,pattern,'Colonization reconciliation must refresh the Rewards Discord board when it creates reward entries');
console.log('✓ Rewards Discord automatically refreshes for both squad-funded and member-funded reward issuance paths');

const wolfCss=readFileSync('css/wolf-bgs.css','utf8');
assert.match(wolfCss,/animation:wolf-master-alert-flash/);
assert.match(wolfCss,/@media \(prefers-reduced-motion: reduce\)\{[\s\S]*animation-duration:1\.6s/);
assert.doesNotMatch(wolfCss,/wolf-master-alert-button\.is-active\{animation:none\}/,'Reduced-motion rule must not silently extinguish the critical alert blink');
const wolfPage=readFileSync('wolf-bgs/index.html','utf8');
assert.match(wolfPage,/wolf-bgs\.css\?v=23/);
console.log('✓ Critical Faction Alert retains its visible blink while nonessential transitions remain reduced');

console.log('\nAll member Reward Account and alert-blink smoke checks passed.');
