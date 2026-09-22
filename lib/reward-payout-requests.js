const PAYOUT_REQUEST_PREFIX='reward-payout-request:';

export async function readRewardPayoutRequest(env,ownerId=''){
  requireStore(env);
  const id=clean(ownerId);
  if(!id)return null;
  return env.DAILY_ORDERS.get(PAYOUT_REQUEST_PREFIX+encodeURIComponent(id),{type:'json'});
}

export async function requestRewardPayout(env,{
  ownerId,
  displayName,
  entries=[],
  actor='Mongrel Member',
}={}){
  requireStore(env);
  const owner=clean(ownerId);
  if(!owner)throw new Error('reward_payout_owner_required');

  const owed=(Array.isArray(entries)?entries:[])
    .filter(entry=>clean(entry?.ownerId)===owner&&entry?.status==='owed'&&(Number(entry?.amountCredits)||0)>0)
    .sort((a,b)=>String(a?.createdAt||'').localeCompare(String(b?.createdAt||'')));
  if(!owed.length)throw new Error('reward_payout_nothing_owed');

  const entryIds=owed.map(entry=>clean(entry.id)).filter(Boolean);
  const requestedCredits=round(owed.reduce((sum,entry)=>sum+(Number(entry.amountCredits)||0),0));
  const existing=await readRewardPayoutRequest(env,owner);
  if(existing?.state==='requested'){
    const sameIds=JSON.stringify(unique(existing.entryIds).sort())===JSON.stringify(unique(entryIds).sort());
    const sameAmount=round(existing.requestedCredits)===requestedCredits;
    if(sameIds&&sameAmount)return existing;
  }

  const now=new Date().toISOString();
  const record={
    version:1,
    requestId:'payout-request-'+crypto.randomUUID(),
    ownerId:owner,
    displayName:clean(displayName)||clean(owed[0]?.displayName)||'Mongrel CMDR',
    state:'requested',
    requestedAt:now,
    requestedBy:clean(actor)||'Mongrel Member',
    requestedCredits,
    entryIds,
    fulfilledAt:null,
    fulfilledBy:'',
    paymentBatchId:'',
    cancelledAt:null,
    cancelledBy:'',
    updatedAt:now,
  };
  await env.DAILY_ORDERS.put(key(owner),JSON.stringify(record));
  return record;
}

export async function cancelRewardPayoutRequest(env,{
  ownerId,
  actor='Mongrel Member',
}={}){
  requireStore(env);
  const owner=clean(ownerId);
  const current=await readRewardPayoutRequest(env,owner);
  if(!current)return null;
  if(current.state!=='requested')return current;
  const now=new Date().toISOString();
  const next={
    ...current,
    state:'cancelled',
    cancelledAt:now,
    cancelledBy:clean(actor)||'Mongrel Member',
    updatedAt:now,
  };
  await env.DAILY_ORDERS.put(key(owner),JSON.stringify(next));
  return next;
}

export async function reconcileRewardPayoutRequest(env,{
  ownerId,
  entries=[],
  actor='Site Admin',
  paymentBatchId='',
}={}){
  requireStore(env);
  const owner=clean(ownerId);
  const current=await readRewardPayoutRequest(env,owner);
  if(!current||current.state!=='requested')return current;

  const owedIds=new Set(
    (Array.isArray(entries)?entries:[])
      .filter(entry=>clean(entry?.ownerId)===owner&&entry?.status==='owed')
      .map(entry=>clean(entry.id))
      .filter(Boolean)
  );
  const remaining=unique(current.entryIds).filter(id=>owedIds.has(id));
  if(remaining.length)return current;

  const now=new Date().toISOString();
  const next={
    ...current,
    state:'fulfilled',
    fulfilledAt:now,
    fulfilledBy:clean(actor)||'Site Admin',
    paymentBatchId:clean(paymentBatchId),
    updatedAt:now,
  };
  await env.DAILY_ORDERS.put(key(owner),JSON.stringify(next));
  return next;
}

export function rewardPayoutRequestView(record,entries=[]){
  const rows=Array.isArray(entries)?entries:[];
  const owed=rows.filter(entry=>entry?.status==='owed');
  const currentAvailableCredits=round(owed.reduce((sum,entry)=>sum+(Number(entry?.amountCredits)||0),0));
  if(!record){
    return {
      state:'none',
      active:false,
      requestId:'',
      requestedAt:null,
      requestedCredits:0,
      requestedRemainingCredits:0,
      requestedEntryCount:0,
      currentAvailableCredits,
      newSinceRequestCredits:0,
    };
  }

  const requestedIds=new Set(unique(record.entryIds));
  const requestedRemaining=owed.filter(entry=>requestedIds.has(clean(entry?.id)));
  const requestedRemainingCredits=round(requestedRemaining.reduce((sum,entry)=>sum+(Number(entry?.amountCredits)||0),0));
  const effectiveState=record.state==='requested'&&requestedRemaining.length===0?'fulfilled':clean(record.state)||'none';
  const active=effectiveState==='requested';
  const newSinceRequestCredits=round(
    owed.filter(entry=>!requestedIds.has(clean(entry?.id)))
      .reduce((sum,entry)=>sum+(Number(entry?.amountCredits)||0),0)
  );

  return {
    state:effectiveState,
    active,
    requestId:clean(record.requestId),
    requestedAt:record.requestedAt||null,
    requestedBy:clean(record.requestedBy),
    requestedCredits:round(record.requestedCredits),
    requestedRemainingCredits,
    requestedEntryCount:unique(record.entryIds).length,
    currentAvailableCredits,
    newSinceRequestCredits,
    fulfilledAt:record.fulfilledAt||null,
    fulfilledBy:clean(record.fulfilledBy),
    paymentBatchId:clean(record.paymentBatchId),
    cancelledAt:record.cancelledAt||null,
  };
}

function key(ownerId){return PAYOUT_REQUEST_PREFIX+encodeURIComponent(clean(ownerId))}
function requireStore(env){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'||typeof env.DAILY_ORDERS.put!=='function'){
    throw new Error('reward_storage_not_configured');
  }
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function unique(values){return [...new Set((Array.isArray(values)?values:[]).map(clean).filter(Boolean))]}
function round(value){return Math.max(0,Math.round(Number(value)||0))}
