import { invalidateKeyListCache, listKeysCached } from './kv-list-cache.js';

const ENTRY_PREFIX = 'reward-ledger:';
const REWARD_LIST_CACHE_KEY = 'kv-list-cache:reward-ledger-v1';

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
  let owedCredits=0, paidCredits=0, adjustmentCredits=0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const amount = Number(entry?.amountCredits)||0;
    if (entry?.kind === 'manual_adjustment') adjustmentCredits += amount;
    if (entry?.status === 'paid') paidCredits += amount;
    else if (entry?.status === 'owed') owedCredits += amount;
  }
  return {
    owedCredits:round(owedCredits),
    paidCredits:round(paidCredits),
    adjustmentCredits:round(adjustmentCredits),
    entryCount:Array.isArray(entries)?entries.length:0,
  };
}

export async function appendRewardEntry(env, entry) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.put !== 'function') throw new Error('reward_storage_not_configured');
  const normalized = normalizeRewardEntry(entry);
  const key = memberPrefix(normalized.ownerId) + encodeURIComponent(normalized.id);
  const existing = await env.DAILY_ORDERS.get(key,{type:'json'});
  if (existing) return existing;
  await env.DAILY_ORDERS.put(key,JSON.stringify(normalized));
  await invalidateKeyListCache(env,REWARD_LIST_CACHE_KEY);
  return normalized;
}

export function normalizeRewardEntry(value = {}) {
  const now = new Date().toISOString();
  const amountCredits = round(Number(value.amountCredits)||0);
  return {
    version:2,
    id:clean(value.id) || crypto.randomUUID(),
    ownerId:clean(value.ownerId),
    displayName:clean(value.displayName) || 'Mongrel CMDR',
    kind:['verified_order','manual_adjustment','special_job'].includes(value.kind) ? value.kind : 'verified_order',
    amountCredits,
    reason:clean(value.reason).slice(0,500),
    sourceOrderId:clean(value.sourceOrderId).slice(0,100),
    sourceLogicalKey:clean(value.sourceLogicalKey).slice(0,520),
    sourceCycleId:clean(value.sourceCycleId).slice(0,100),
    sourceOrderRevision:Math.max(0,Math.floor(Number(value.sourceOrderRevision)||0)),
    sourcePublicationId:clean(value.sourcePublicationId).slice(0,100),
    sourceArchiveHash:clean(value.sourceArchiveHash).slice(0,100),
    sourceEventIds:(Array.isArray(value.sourceEventIds)?value.sourceEventIds:[]).map(clean).filter(Boolean).slice(0,100),
    evidenceDigest:clean(value.evidenceDigest).slice(0,100),
    rewardRuleDigest:clean(value.rewardRuleDigest).slice(0,100),
    rewardType:clean(value.rewardType).slice(0,40),
    verifiedContribution:round(Number(value.verifiedContribution)||0),
    verifiedUnit:clean(value.verifiedUnit).slice(0,40),
    ruleSnapshot:value.ruleSnapshot&&typeof value.ruleSnapshot==='object'?JSON.parse(JSON.stringify(value.ruleSnapshot)):null,
    status:value.status === 'paid' ? 'paid' : 'owed',
    createdAt:clean(value.createdAt) || now,
    createdBy:clean(value.createdBy) || 'system',
    paidAt:value.status === 'paid' ? (clean(value.paidAt) || now) : null,
    paidBy:value.status === 'paid' ? clean(value.paidBy) : '',
  };
}

async function rewardKeys(env) {
  return listKeysCached(env,{
    prefix:ENTRY_PREFIX,
    cacheKey:REWARD_LIST_CACHE_KEY,
    maxAgeSeconds:1800,
    maxKeys:5000,
  });
}

function memberPrefix(userId) {
  return ENTRY_PREFIX + encodeURIComponent(String(userId||'')) + ':';
}
function clean(value){return typeof value==='string'?value.trim():''}
function round(value){return Math.round((Number(value)||0)*100)/100}
