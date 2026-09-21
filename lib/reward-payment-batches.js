const PAYMENT_BATCH_PREFIX='reward-payment-batch:';

export async function prepareRewardPaymentBatch(env,{
  batchId,
  ownerId,
  displayName,
  entries=[],
  totalCredits=0,
  actor='Site Admin',
}={}) {
  requireStore(env);
  const now=new Date().toISOString();
  const id=clean(batchId)||crypto.randomUUID();
  const key=PAYMENT_BATCH_PREFIX+encodeURIComponent(id);
  const existing=await env.DAILY_ORDERS.get(key,{type:'json'});
  if(existing)return {key,record:existing,existing:true};

  const rows=(Array.isArray(entries)?entries:[]).map(entry=>({
    id:clean(entry?.id),
    amountCredits:round(entry?.amountCredits),
    reason:clean(entry?.reason).slice(0,500),
    kind:clean(entry?.kind).slice(0,60),
    createdAt:clean(entry?.createdAt)||null,
    sourceOrderId:clean(entry?.sourceOrderId).slice(0,100),
    sourceJobId:clean(entry?.sourceJobId).slice(0,100),
  })).filter(entry=>entry.id);

  const record={
    version:1,
    batchId:id,
    state:'prepared',
    ownerId:clean(ownerId),
    displayName:clean(displayName)||'Mongrel CMDR',
    actor:clean(actor)||'Site Admin',
    preparedAt:now,
    appliedAt:null,
    failedAt:null,
    failure:'',
    totalCredits:round(totalCredits),
    entryCount:rows.length,
    entryIds:rows.map(entry=>entry.id),
    paidEntryIds:[],
    entries:rows,
  };
  await env.DAILY_ORDERS.put(key,JSON.stringify(record));
  return {key,record,existing:false};
}

export async function markRewardPaymentBatchApplied(env,key,{paidEntryIds=[]}={}) {
  return updateBatch(env,key,record=>({
    ...record,
    state:'applied',
    appliedAt:new Date().toISOString(),
    failedAt:null,
    failure:'',
    paidEntryIds:unique(paidEntryIds),
  }));
}

export async function markRewardPaymentBatchFailed(env,key,{failure='',paidEntryIds=[]}={}) {
  return updateBatch(env,key,record=>({
    ...record,
    state:'failed',
    failedAt:new Date().toISOString(),
    failure:clean(failure).slice(0,1000),
    paidEntryIds:unique(paidEntryIds),
  }));
}

export async function readRewardPaymentBatch(env,batchId='') {
  requireStore(env);
  const id=clean(batchId);
  if(!id)return null;
  return env.DAILY_ORDERS.get(PAYMENT_BATCH_PREFIX+encodeURIComponent(id),{type:'json'});
}

async function updateBatch(env,key,mutate){
  requireStore(env);
  const record=await env.DAILY_ORDERS.get(key,{type:'json'});
  if(!record)throw new Error('reward_payment_batch_missing');
  const next=mutate(record);
  await env.DAILY_ORDERS.put(key,JSON.stringify(next));
  return next;
}

function requireStore(env){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'||typeof env.DAILY_ORDERS.put!=='function'){
    throw new Error('reward_storage_not_configured');
  }
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function round(value){return Math.max(0,Math.round(Number(value)||0))}
function unique(values){return [...new Set((Array.isArray(values)?values:[]).map(clean).filter(Boolean))]}
