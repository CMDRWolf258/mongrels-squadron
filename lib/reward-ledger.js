import { invalidateKeyListCache, listKeysCached, rememberKeyInListCache } from './kv-list-cache.js';

const ENTRY_PREFIX = 'reward-ledger:';
const REWARD_LIST_CACHE_KEY = 'kv-list-cache:reward-ledger-v2';
const REWARD_KEY_REGISTRY = 'reward-ledger-key-registry-v1';
const REWARD_KEY_LIMIT = 5000;

export async function listAllRewardEntries(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const keys = await rewardKeys(env);
  const rows = await Promise.all(keys.map(key=>env.DAILY_ORDERS.get(key,{type:'json'})));
  return rows.filter(Boolean).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

export async function listRewardEntries(env, userId) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const prefix = memberPrefix(userId);
  const keys = (await rewardKeys(env)).filter(key=>key.startsWith(prefix));
  const rows = await Promise.all(keys.map(key=>env.DAILY_ORDERS.get(key,{type:'json'})));
  return rows.filter(Boolean).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

export function summarizeRewardLedger(entries) {
  let owedCredits=0, paymentSentCredits=0, paidCredits=0, adjustmentCredits=0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const amount = Number(entry?.amountCredits)||0;
    if (entry?.kind === 'manual_adjustment') adjustmentCredits += amount;
    if (entry?.status === 'paid') paidCredits += amount;
    else if (entry?.status === 'payment_sent') paymentSentCredits += amount;
    else if (entry?.status === 'owed') owedCredits += amount;
  }
  return {
    owedCredits:round(owedCredits),
    paymentSentCredits:round(paymentSentCredits),
    unsettledCredits:round(owedCredits+paymentSentCredits),
    paidCredits:round(paidCredits),
    adjustmentCredits:round(adjustmentCredits),
    entryCount:Array.isArray(entries)?entries.length:0,
  };
}

export async function appendRewardEntry(env, entry) {
  const result=await appendRewardEntryWithResult(env,entry);
  return result.entry;
}

export async function appendRewardEntryWithResult(env, entry) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') throw new Error('reward_storage_not_configured');
  const normalized = normalizeRewardEntry(entry);
  const key = memberPrefix(normalized.ownerId) + encodeURIComponent(normalized.id);
  const existing = await env.DAILY_ORDERS.get(key,{type:'json'});
  if (existing) {
    await rememberRewardKey(env,key);
    await rememberKeyInListCache(env,{
      cacheKey:REWARD_LIST_CACHE_KEY,
      prefix:ENTRY_PREFIX,
      key,
      maxAgeSeconds:1800,
      maxKeys:REWARD_KEY_LIMIT,
    });
    return {entry:existing,created:false,key};
  }
  await env.DAILY_ORDERS.put(key,JSON.stringify(normalized));
  await rememberRewardKey(env,key);
  const remembered=await rememberKeyInListCache(env,{
    cacheKey:REWARD_LIST_CACHE_KEY,
    prefix:ENTRY_PREFIX,
    key,
    maxAgeSeconds:1800,
    maxKeys:REWARD_KEY_LIMIT,
  });
  if(!remembered)await invalidateKeyListCache(env,REWARD_LIST_CACHE_KEY);
  return {entry:normalized,created:true,key};
}

export async function markRewardEntriesPaid(env,{
  ownerId,
  entryIds=[],
  actor='Site Admin',
  batchId='',
  paidAt=null,
}={}) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function' || typeof env.DAILY_ORDERS.put !== 'function') {
    throw new Error('reward_storage_not_configured');
  }
  const owner=clean(ownerId);
  const ids=[...new Set((Array.isArray(entryIds)?entryIds:[]).map(clean).filter(Boolean))];
  if(!owner||!ids.length)throw new Error('reward_payment_selection_invalid');

  const entries=[];
  for(const id of ids){
    const key=memberPrefix(owner)+encodeURIComponent(id);
    const entry=await env.DAILY_ORDERS.get(key,{type:'json'});
    if(!entry)throw new Error('reward_entry_missing:'+id);
    if(clean(entry.ownerId)!==owner)throw new Error('reward_entry_owner_mismatch:'+id);
    if(entry.status!=='owed')throw new Error('reward_entry_not_owed:'+id);
    if(entry.fundingMode==='member')throw new Error('member_funded_reward_requires_payer_flow:'+id);
    entries.push({key,entry});
  }

  const timestamp=clean(paidAt)||new Date().toISOString();
  const paidBy=clean(actor)||'Site Admin';
  const normalizedBatch=clean(batchId);
  const paid=[];
  try{
    for(const row of entries){
      const next=normalizeRewardEntry({
        ...row.entry,
        status:'paid',
        paidAt:timestamp,
        paidBy,
        paymentBatchId:normalizedBatch,
        paymentConfirmedAt:timestamp,
        paymentConfirmedBy:paidBy,
      });
      await env.DAILY_ORDERS.put(row.key,JSON.stringify(next));
      paid.push(next);
    }
  }catch(error){
    error.paidEntryIds=paid.map(entry=>entry.id);
    throw error;
  }
  return paid;
}

export async function markMemberRewardPaymentSent(env,{payerOwnerId,ownerId,entryId,actor='Member payer'}={}) {
  requireLedgerWrite(env);
  const payer=clean(payerOwnerId),owner=clean(ownerId),id=clean(entryId);
  if(!payer||!owner||!id)throw new Error('member_payment_selection_invalid');
  const key=memberPrefix(owner)+encodeURIComponent(id);
  const entry=await env.DAILY_ORDERS.get(key,{type:'json'});
  if(!entry)throw new Error('reward_entry_missing');
  if(entry.fundingMode!=='member'||clean(entry.payerOwnerId)!==payer)throw new Error('member_payment_not_payer');
  if(entry.status!=='owed')throw new Error('member_payment_not_owed');
  const timestamp=new Date().toISOString();
  const next=normalizeRewardEntry({
    ...entry,
    status:'payment_sent',
    paymentSentAt:timestamp,
    paymentSentBy:clean(actor)||'Member payer',
  });
  await env.DAILY_ORDERS.put(key,JSON.stringify(next));
  return next;
}

export async function confirmMemberRewardPayment(env,{ownerId,entryId,actor='Reward recipient'}={}) {
  requireLedgerWrite(env);
  const owner=clean(ownerId),id=clean(entryId);
  if(!owner||!id)throw new Error('member_payment_selection_invalid');
  const key=memberPrefix(owner)+encodeURIComponent(id);
  const entry=await env.DAILY_ORDERS.get(key,{type:'json'});
  if(!entry)throw new Error('reward_entry_missing');
  if(clean(entry.ownerId)!==owner||entry.fundingMode!=='member')throw new Error('member_payment_not_recipient');
  if(entry.status!=='payment_sent')throw new Error('member_payment_not_sent');
  const timestamp=new Date().toISOString();
  const confirmedBy=clean(actor)||entry.displayName||'Reward recipient';
  const next=normalizeRewardEntry({
    ...entry,
    status:'paid',
    paidAt:timestamp,
    paidBy:entry.paymentSentBy||entry.payerDisplayName||'Member payer',
    paymentConfirmedAt:timestamp,
    paymentConfirmedBy:confirmedBy,
  });
  await env.DAILY_ORDERS.put(key,JSON.stringify(next));
  return next;
}

function requireLedgerWrite(env){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'||typeof env.DAILY_ORDERS.put!=='function')throw new Error('reward_storage_not_configured');
}

export function normalizeRewardEntry(value = {}) {
  const now = new Date().toISOString();
  const amountCredits = round(Number(value.amountCredits)||0);
  return {
    version:3,
    id:clean(value.id) || crypto.randomUUID(),
    ownerId:clean(value.ownerId),
    displayName:clean(value.displayName) || 'Mongrel CMDR',
    kind:['verified_order','manual_adjustment','special_job','colonization_job','scouting_job'].includes(value.kind) ? value.kind : 'verified_order',
    amountCredits,
    entitlementCredits:round(Number(value.entitlementCredits)||0),
    existingVerifiedCredits:round(Number(value.existingVerifiedCredits)||0),
    reason:clean(value.reason).slice(0,500),
    sourceOrderId:clean(value.sourceOrderId).slice(0,100),
    sourceLogicalKey:clean(value.sourceLogicalKey).slice(0,520),
    sourceCycleId:clean(value.sourceCycleId).slice(0,100),
    sourceOrderRevision:Math.max(0,Math.floor(Number(value.sourceOrderRevision)||0)),
    sourcePublicationId:clean(value.sourcePublicationId).slice(0,100),
    sourceArchiveHash:clean(value.sourceArchiveHash).slice(0,100),
    sourceJobId:clean(value.sourceJobId).slice(0,100),
    sourceScoutSystem:clean(value.sourceScoutSystem).slice(0,140),
    sourceScoutCycleId:clean(value.sourceScoutCycleId).slice(0,120),
    sourceScoutObservationId:clean(value.sourceScoutObservationId).slice(0,120),
    sourceJobRevisions:(Array.isArray(value.sourceJobRevisions)?value.sourceJobRevisions:[])
      .map(item=>Math.max(1,Math.floor(Number(item)||1))).slice(0,50),
    sourcePublicationIds:(Array.isArray(value.sourcePublicationIds)?value.sourcePublicationIds:[])
      .map(clean).filter(Boolean).slice(0,100),
    sourceArchiveHashes:(Array.isArray(value.sourceArchiveHashes)?value.sourceArchiveHashes:[])
      .map(clean).filter(Boolean).slice(0,100),
    sourceEventIds:(Array.isArray(value.sourceEventIds)?value.sourceEventIds:[]).map(clean).filter(Boolean).slice(0,100),
    evidenceDigest:clean(value.evidenceDigest).slice(0,100),
    rewardRuleDigest:clean(value.rewardRuleDigest).slice(0,100),
    rewardType:clean(value.rewardType).slice(0,40),
    fundingMode:['member','squad'].includes(value.fundingMode)?value.fundingMode:'squad',
    fundingApprovalStatus:clean(value.fundingApprovalStatus).slice(0,40),
    payerOwnerId:clean(value.payerOwnerId).slice(0,160),
    payerDisplayName:clean(value.payerDisplayName).slice(0,120),
    rewardBudgetCredits:round(Number(value.rewardBudgetCredits)||0),
    verifiedContribution:round(Number(value.verifiedContribution)||0),
    verifiedUnit:clean(value.verifiedUnit).slice(0,40),
    ruleSnapshot:value.ruleSnapshot&&typeof value.ruleSnapshot==='object'?JSON.parse(JSON.stringify(value.ruleSnapshot)):null,
    status:['owed','payment_sent','paid'].includes(value.status)?value.status:'owed',
    createdAt:clean(value.createdAt) || now,
    createdBy:clean(value.createdBy) || 'system',
    sourceObligationId:clean(value.sourceObligationId).slice(0,120),
    approvalMode:clean(value.approvalMode).slice(0,60),
    approvedAt:clean(value.approvedAt) || null,
    approvedBy:clean(value.approvedBy).slice(0,120),
    paymentBatchId:clean(value.paymentBatchId).slice(0,120),
    paymentSentAt:clean(value.paymentSentAt) || null,
    paymentSentBy:clean(value.paymentSentBy).slice(0,120),
    paymentConfirmedAt:clean(value.paymentConfirmedAt) || null,
    paymentConfirmedBy:clean(value.paymentConfirmedBy).slice(0,120),
    paidAt:value.status === 'paid' ? (clean(value.paidAt) || now) : null,
    paidBy:value.status === 'paid' ? clean(value.paidBy) : '',
  };
}

async function rewardKeys(env) {
  const [listed,indexed]=await Promise.all([
    listKeysCached(env,{
      prefix:ENTRY_PREFIX,
      cacheKey:REWARD_LIST_CACHE_KEY,
      maxAgeSeconds:1800,
      maxKeys:REWARD_KEY_LIMIT,
    }),
    readRewardKeyRegistry(env),
  ]);
  const merged=[...new Set([...indexed,...listed])]
    .filter(key=>key.startsWith(ENTRY_PREFIX))
    .slice(0,REWARD_KEY_LIMIT);

  // Keep the registry cumulative. Unlike KV list(), this key is never rebuilt
  // from an eventually-consistent enumeration, so a successfully written
  // ledger entry cannot disappear from later reads when an old list cache is
  // rebuilt in another edge location.
  if(merged.some(key=>!indexed.includes(key)))await writeRewardKeyRegistry(env,merged);
  return merged;
}

async function readRewardKeyRegistry(env){
  const kv=env?.DAILY_ORDERS;
  if(!kv||typeof kv.get!=='function')return[];
  try{
    const record=await kv.get(REWARD_KEY_REGISTRY,{type:'json'});
    return Array.isArray(record?.keys)
      ? [...new Set(record.keys.map(value=>String(value||'')).filter(key=>key.startsWith(ENTRY_PREFIX)))].slice(0,REWARD_KEY_LIMIT)
      : [];
  }catch(error){
    console.error('Could not read reward ledger key registry',error);
    return[];
  }
}

async function writeRewardKeyRegistry(env,keys){
  const kv=env?.DAILY_ORDERS;
  if(!kv||typeof kv.put!=='function')return false;
  const normalized=[...new Set((Array.isArray(keys)?keys:[]).map(value=>String(value||'')).filter(key=>key.startsWith(ENTRY_PREFIX)))].slice(0,REWARD_KEY_LIMIT);
  try{
    await kv.put(REWARD_KEY_REGISTRY,JSON.stringify({
      version:1,
      updatedAt:new Date().toISOString(),
      keys:normalized,
    }));
    return true;
  }catch(error){
    console.error('Could not write reward ledger key registry',error);
    return false;
  }
}

async function rememberRewardKey(env,key){
  const cleanKey=String(key||'');
  if(!cleanKey.startsWith(ENTRY_PREFIX))return false;
  const current=await readRewardKeyRegistry(env);
  if(current.includes(cleanKey))return true;
  return writeRewardKeyRegistry(env,[cleanKey,...current]);
}

function memberPrefix(userId) {
  return ENTRY_PREFIX + encodeURIComponent(String(userId||'')) + ':';
}
function clean(value){return typeof value==='string'?value.trim():''}
function round(value){return Math.round((Number(value)||0)*100)/100}
