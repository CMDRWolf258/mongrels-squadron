const ENTRY_PREFIX = 'reward-ledger:';

export async function listAllRewardEntries(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const keys = [];
  let cursor;
  do {
    const page = await env.DAILY_ORDERS.list({prefix:ENTRY_PREFIX,cursor,limit:1000});
    keys.push(...(page?.keys || []).map(item=>item.name));
    cursor = page?.list_complete ? undefined : page?.cursor;
  } while (cursor);
  const rows = await Promise.all(keys.map(key=>env.DAILY_ORDERS.get(key,{type:'json'})));
  return rows.filter(Boolean).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

export async function listRewardEntries(env, userId) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.list !== 'function') return [];
  const prefix = memberPrefix(userId);
  const keys = [];
  let cursor;
  do {
    const page = await env.DAILY_ORDERS.list({prefix,cursor,limit:1000});
    keys.push(...(page?.keys || []).map(item=>item.name));
    cursor = page?.list_complete ? undefined : page?.cursor;
  } while (cursor);
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
  return normalized;
}

export function normalizeRewardEntry(value = {}) {
  const now = new Date().toISOString();
  const amountCredits = round(Number(value.amountCredits)||0);
  return {
    version:1,
    id:clean(value.id) || crypto.randomUUID(),
    ownerId:clean(value.ownerId),
    displayName:clean(value.displayName) || 'Mongrel CMDR',
    kind:['verified_order','manual_adjustment','special_job'].includes(value.kind) ? value.kind : 'verified_order',
    amountCredits,
    reason:clean(value.reason).slice(0,500),
    sourceOrderId:clean(value.sourceOrderId).slice(0,100),
    sourceLogicalKey:clean(value.sourceLogicalKey).slice(0,520),
    sourceCycleId:clean(value.sourceCycleId).slice(0,100),
    sourceEventIds:(Array.isArray(value.sourceEventIds)?value.sourceEventIds:[]).map(clean).filter(Boolean).slice(0,100),
    status:value.status === 'paid' ? 'paid' : 'owed',
    createdAt:clean(value.createdAt) || now,
    createdBy:clean(value.createdBy) || 'system',
    paidAt:value.status === 'paid' ? (clean(value.paidAt) || now) : null,
    paidBy:value.status === 'paid' ? clean(value.paidBy) : '',
  };
}

function memberPrefix(userId) {
  return ENTRY_PREFIX + encodeURIComponent(String(userId||'')) + ':';
}
function clean(value){return typeof value==='string'?value.trim():''}
function round(value){return Math.round((Number(value)||0)*100)/100}
