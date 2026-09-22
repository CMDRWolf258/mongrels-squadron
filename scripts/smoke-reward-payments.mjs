import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  appendRewardEntryWithResult,
  listAllRewardEntries,
  markRewardEntriesPaid,
} from '../lib/reward-ledger.js';
import {
  markRewardPaymentBatchApplied,
  prepareRewardPaymentBatch,
  readRewardPaymentBatch,
} from '../lib/reward-payment-batches.js';

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
      return {
        keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),
        list_complete:true,
      };
    },
  };
}

const env={DAILY_ORDERS:fakeKv()};
for(const [id,amount] of [['pay-a',10_000_000],['pay-b',20_000_000]]){
  const result=await appendRewardEntryWithResult(env,{
    id,
    ownerId:'wolf',
    displayName:'Wolf258',
    kind:'colonization_job',
    amountCredits:amount,
    reason:'Payment test '+id,
    status:'owed',
    createdBy:'Reward Engine',
  });
  assert.equal(result.created,true);
}
await appendRewardEntryWithResult(env,{
  id:'other-cmdr',
  ownerId:'other',
  displayName:'OtherCMDR',
  kind:'verified_order',
  amountCredits:5_000_000,
  reason:'Other member',
  status:'owed',
});

const ledger=await listAllRewardEntries(env);
const wolfEntries=ledger.filter(entry=>entry.ownerId==='wolf');
const prepared=await prepareRewardPaymentBatch(env,{
  batchId:'batch-test-1',
  ownerId:'wolf',
  displayName:'Wolf258',
  entries:wolfEntries,
  totalCredits:30_000_000,
  actor:'Wolf',
});
assert.equal(prepared.record.state,'prepared');
assert.equal(prepared.record.entryCount,2);
assert.equal(prepared.record.totalCredits,30_000_000);

const paid=await markRewardEntriesPaid(env,{
  ownerId:'wolf',
  entryIds:['pay-a','pay-b'],
  actor:'Wolf',
  batchId:'batch-test-1',
  paidAt:'2026-09-21T23:55:00.000Z',
});
assert.equal(paid.length,2);
assert.ok(paid.every(entry=>entry.status==='paid'));
assert.ok(paid.every(entry=>entry.paidBy==='Wolf'));
assert.ok(paid.every(entry=>entry.paymentBatchId==='batch-test-1'));

const applied=await markRewardPaymentBatchApplied(env,prepared.key,{paidEntryIds:paid.map(entry=>entry.id)});
assert.equal(applied.state,'applied');
assert.deepEqual(new Set(applied.paidEntryIds),new Set(['pay-a','pay-b']));
const storedBatch=await readRewardPaymentBatch(env,'batch-test-1');
assert.equal(storedBatch.state,'applied');
console.log('✓ Multi-entry payment batch records one CMDR, total, audit actor, and APPLIED settlement');

await assert.rejects(
  ()=>markRewardEntriesPaid(env,{
    ownerId:'wolf',
    entryIds:['other-cmdr'],
    actor:'Wolf',
    batchId:'bad-batch',
  }),
  /reward_entry_missing/,
);
console.log('✓ Ledger settlement cannot cross into another CMDR keyspace');

const payApi=readFileSync('functions/api/rewards/pay.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /wolf-reward-payment/,
  /multiple_commanders_not_allowed/,
  /payment_selection_changed/,
  /expectedTotalCredits/,
  /MAX_BATCH_ENTRIES=100/,
  /prepareRewardPaymentBatch/,
  /markRewardEntriesPaid/,
  /markRewardPaymentBatchApplied/,
  /markRewardPaymentBatchFailed/,
]) assert.match(payApi,pattern);
assert.doesNotMatch(payApi,/status:'paid'.*body/s,'Payment endpoint must not trust client-supplied paid ledger records');
console.log('✓ Payment API enforces site-admin, same-origin, same-CMDR, expected-total, and write-ahead batch guards');

const admin=readFileSync('functions/api/rewards/admin.js','utf8');
assert.match(admin,/canConfirmPayments:session\.access==='site_admin'/);
assert.match(admin,/owedEntries:/);

const ui=readFileSync('js/wolf-bgs-rewards.js','utf8');
for(const pattern of [
  /wolf-payment-member/,
  /SELECT ALL OWED/,
  /data-payment-entry-id/,
  /paymentSelectionOwnerId/,
  /data-reward-payment-bar/,
  /data-payment-selected-total/,
  /CONFIRM PAYMENT/,
  /expectedTotalCredits/,
  /paymentRequestId/,
  /Use this only after you have actually transferred these credits in Elite Dangerous/,
  /All selected ledger entries will be marked PAID/,
]) assert.match(ui,pattern);
new Function(ui);

const html=readFileSync('wolf-bgs/index.html','utf8');
assert.match(html,/Actual Reward Ledger · Payment Console/);
assert.match(html,/selection is limited to one CMDR at a time/i);
assert.match(html,/data-payment-selected-total/);
assert.match(html,/wolf-bgs-rewards\.js\?v=15/);
assert.match(html,/wolf-bgs-dry-run\.css\?v=4/);

const css=readFileSync('css/wolf-bgs-dry-run.css','utf8');
for(const pattern of [
  /\.wolf-payment-member/,
  /\.wolf-payment-entry/,
  /\.wolf-payment-check/,
  /\.wolf-payment-selection-bar/,
  /position:sticky/,
]) assert.match(css,pattern);

console.log('✓ Grouped CMDR accordions, multi-select checkboxes, one-CMDR selection lock, running total, and confirm controls are wired');
console.log('\nAll reward payment console smoke checks passed.');
