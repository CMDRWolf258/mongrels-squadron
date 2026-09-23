import { json, readSession } from '../../../lib/auth.js';
import { listAllRewardEntries, markRewardEntriesPaid } from '../../../lib/reward-ledger.js';
import { reconcileRewardPayoutRequest } from '../../../lib/reward-payout-requests.js';
import {
  markRewardPaymentBatchApplied,
  markRewardPaymentBatchFailed,
  prepareRewardPaymentBatch,
  readRewardPaymentBatch,
} from '../../../lib/reward-payment-batches.js';
import { loadRewardDiscordView, syncRewardDiscordBoard } from '../../../lib/reward-discord.js';

const MAX_BATCH_ENTRIES=100;

export async function onRequestPost({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(session.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);

  const originError=validateSameOrigin(request);
  if(originError)return originError;

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const ownerId=clean(body?.ownerId).slice(0,160);
  const entryIds=unique(body?.entryIds).slice(0,MAX_BATCH_ENTRIES);
  const requestId=clean(body?.paymentRequestId).slice(0,120);
  const expectedTotalCredits=Math.round(Number(body?.expectedTotalCredits)||0);
  if(!ownerId||!entryIds.length||!requestId||expectedTotalCredits<=0){
    return reply({ok:false,error:'payment_selection_invalid'},400);
  }

  const existingBatch=await readRewardPaymentBatch(env,requestId);
  if(existingBatch?.state==='applied'){
    return reply({
      ok:true,
      alreadyApplied:true,
      batch:publicBatch(existingBatch),
      message:'This payment confirmation was already applied.',
    });
  }
  if(existingBatch&&existingBatch.state!=='applied'){
    return reply({
      ok:false,
      error:'payment_batch_requires_review',
      batch:publicBatch(existingBatch),
      message:'A previous attempt with this payment request did not finish cleanly. Review the batch before retrying.',
    },409);
  }

  const ledger=await listAllRewardEntries(env);
  const selected=[];
  const byId=new Map(ledger.map(entry=>[clean(entry?.id),entry]));
  for(const id of entryIds){
    const entry=byId.get(id);
    if(!entry)return reply({ok:false,error:'reward_entry_missing',entryId:id},409);
    if(clean(entry.ownerId)!==ownerId){
      return reply({ok:false,error:'multiple_commanders_not_allowed',entryId:id},409);
    }
    if(entry.status!=='owed'){
      return reply({ok:false,error:'reward_entry_not_owed',entryId:id},409);
    }
    selected.push(entry);
  }

  const displayNames=unique(selected.map(entry=>entry.displayName));
  if(displayNames.length>1){
    return reply({ok:false,error:'commander_identity_mismatch'},409);
  }
  const totalCredits=Math.round(selected.reduce((sum,entry)=>sum+(Number(entry.amountCredits)||0),0));
  if(totalCredits!==expectedTotalCredits){
    return reply({
      ok:false,
      error:'payment_selection_changed',
      expectedTotalCredits,
      currentTotalCredits:totalCredits,
      message:'The selected payment total changed. Refresh the ledger before confirming.',
    },409);
  }

  const actor=clean(session.displayName||session.username)||'Site Admin';
  const prepared=await prepareRewardPaymentBatch(env,{
    batchId:requestId,
    ownerId,
    displayName:displayNames[0]||'Mongrel CMDR',
    entries:selected,
    totalCredits,
    actor,
  });

  try{
    const paid=await markRewardEntriesPaid(env,{
      ownerId,
      entryIds,
      actor,
      batchId:requestId,
      paidAt:prepared.record.preparedAt,
    });
    const applied=await markRewardPaymentBatchApplied(env,prepared.key,{
      paidEntryIds:paid.map(entry=>entry.id),
    });

    let payoutRequest=null;
    try{
      const paidById=new Map(paid.map(entry=>[clean(entry.id),entry]));
      const ownerEntries=ledger
        .filter(entry=>clean(entry?.ownerId)===ownerId)
        .map(entry=>paidById.get(clean(entry?.id))||entry);
      payoutRequest=await reconcileRewardPayoutRequest(env,{
        ownerId,
        entries:ownerEntries,
        actor,
        paymentBatchId:requestId,
      });
    }catch(requestError){
      console.error('Could not reconcile member payout request after payment',requestError);
    }

    const discord=await syncRewardsDiscord(request,env);
    return reply({
      ok:true,
      alreadyApplied:false,
      batch:publicBatch(applied),
      paidEntries:paid.map(publicEntry),
      payoutRequestState:payoutRequest?.state||null,
      discord,
      message:'Selected reward entries were marked PAID.',
    });
  }catch(error){
    const paidEntryIds=Array.isArray(error?.paidEntryIds)?error.paidEntryIds:[];
    try{
      await markRewardPaymentBatchFailed(env,prepared.key,{
        failure:String(error?.message||error||'payment_write_failed'),
        paidEntryIds,
      });
    }catch(batchError){
      console.error('Could not finalize failed reward payment batch',batchError);
    }
    console.error('Reward payment batch failed',error);
    return reply({
      ok:false,
      error:'reward_payment_failed',
      batchId:requestId,
      paidEntryIds,
      message:paidEntryIds.length
        ? 'Payment confirmation stopped after some ledger entries were updated. Review this batch before any retry.'
        : 'Payment confirmation failed before any selected ledger entry was updated.',
    },503);
  }
}

async function syncRewardsDiscord(request,env){
  try{
    const view=await loadRewardDiscordView(env);
    const adminUrl=new URL('/wolf-bgs/',request.url);
    adminUrl.hash='reward-engine';
    return await syncRewardDiscordBoard(env,{
      view,
      adminUrl:adminUrl.toString(),
      rewardsUrl:new URL('/rewards/',request.url).toString(),
      createMissing:false,
    });
  }catch(error){
    console.error('Reward payment succeeded but Rewards Discord sync failed',error);
    return {feature:'rewards',configured:true,error:'discord_rewards_sync_failed',failed:1};
  }
}

function publicBatch(record={}){
  return {
    batchId:record.batchId||'',
    state:record.state||'',
    ownerId:record.ownerId||'',
    displayName:record.displayName||'',
    actor:record.actor||'',
    preparedAt:record.preparedAt||null,
    appliedAt:record.appliedAt||null,
    failedAt:record.failedAt||null,
    totalCredits:Number(record.totalCredits)||0,
    entryCount:Number(record.entryCount)||0,
    entryIds:Array.isArray(record.entryIds)?record.entryIds:[],
    paidEntryIds:Array.isArray(record.paidEntryIds)?record.paidEntryIds:[],
  };
}
function publicEntry(entry={}){
  return {
    id:entry.id||'',
    ownerId:entry.ownerId||'',
    displayName:entry.displayName||'',
    amountCredits:Number(entry.amountCredits)||0,
    status:entry.status||'',
    paidAt:entry.paidAt||null,
    paidBy:entry.paidBy||'',
    paymentBatchId:entry.paymentBatchId||'',
  };
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='wolf-reward-payment'){
    return reply({ok:false,error:'request_validation_failed'},403);
  }
  return null;
}
function unique(values){return [...new Set((Array.isArray(values)?values:[]).map(clean).filter(Boolean))]}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function reply(body,status=200){
  return json(body,{status,headers:{
    'Cache-Control':'private, no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  }});
}
