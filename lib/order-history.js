import { deriveLogicalOrderKey, orderRevisionFingerprint } from './order-identity.js';
import { invalidateKeyListCache, listKeysCached } from './kv-list-cache.js';

export const ORDER_HISTORY_PREFIX='order-history:';
const ORDER_HISTORY_LIST_CACHE_KEY='kv-list-cache:order-history-v1';

export async function ensureOrderHistoryBaseline(env,current,existingRecords=null,actor='System migration') {
  requireStore(env);
  const snapshot=snapshotDocument(current);
  if(snapshot.configured===false||!snapshot.cycleId||!snapshot.orders.length)return null;

  const records=Array.isArray(existingRecords)
    ? existingRecords
    : await listOrderPublications(env,{limit:500,cycleId:snapshot.cycleId});
  const alreadyArchived=records.some(record=>
    record?.state==='applied'
    && (clean(record?.cycleId)===clean(snapshot.cycleId)||clean(record?.previousCycleId)===clean(snapshot.cycleId))
  );
  if(alreadyArchived)return null;

  const key=orderBaselineKey(snapshot.cycleId);
  const stored=await env.DAILY_ORDERS.get(key,{type:'json'});
  if(stored)return publicHistoryRecord(stored);

  const now=new Date().toISOString();
  const before=snapshotDocument({
    configured:false,
    title:'No Daily Orders Posted',
    briefing:'',
    updatedAt:null,
    updatedBy:null,
    cycleId:snapshot.cycleId,
    cycleStartedAt:snapshot.cycleStartedAt,
    officerNote:null,
    orders:[],
  });
  const record={
    version:1,
    publicationId:'order-baseline-v1:'+snapshot.cycleId,
    state:'applied',
    action:'baseline',
    cycleId:snapshot.cycleId,
    previousCycleId:snapshot.cycleId,
    preparedAt:now,
    appliedAt:now,
    failedAt:null,
    failure:'',
    actor:clean(actor).slice(0,120)||'System migration',
    reconcileSystems:unique(snapshot.orders.map(order=>order.system)).slice(0,100),
    legacyBaseline:true,
    beforeHash:await digestSnapshot(before),
    afterHash:await digestSnapshot(snapshot),
    changes:summarizeOrderChanges(before.orders,snapshot.orders),
    before,
    after:snapshot,
  };
  await env.DAILY_ORDERS.put(key,JSON.stringify(record));
  await invalidateKeyListCache(env,ORDER_HISTORY_LIST_CACHE_KEY);
  return publicHistoryRecord(record);
}

export async function prepareOrderPublication(env,{before,after,actor,action='replace',reconcileSystems=[]}={}) {
  requireStore(env);
  const preparedAt=new Date().toISOString();
  const publicationId=crypto.randomUUID();
  const beforeSnapshot=snapshotDocument(before);
  const afterSnapshot=snapshotDocument(after);
  const cycleId=clean(afterSnapshot.cycleId)||clean(beforeSnapshot.cycleId)||'uncycled';
  const record={
    version:1,
    publicationId,
    state:'prepared',
    action:['reconcile','replace','delete','baseline'].includes(action)?action:'replace',
    cycleId,
    previousCycleId:clean(beforeSnapshot.cycleId)||null,
    preparedAt,
    appliedAt:null,
    failedAt:null,
    failure:'',
    actor:clean(actor).slice(0,120)||'Mongrel Officer',
    reconcileSystems:unique(reconcileSystems).slice(0,100),
    legacyBaseline:false,
    beforeHash:await digestSnapshot(beforeSnapshot),
    afterHash:await digestSnapshot(afterSnapshot),
    changes:summarizeOrderChanges(beforeSnapshot.orders,afterSnapshot.orders),
    before:beforeSnapshot,
    after:afterSnapshot,
  };
  const key=historyKey(record);
  await env.DAILY_ORDERS.put(key,JSON.stringify(record));
  await invalidateKeyListCache(env,ORDER_HISTORY_LIST_CACHE_KEY);
  return {key,record};
}

export async function markOrderPublicationApplied(env,prepared) {
  if(!prepared?.key||!prepared?.record)return null;
  const record={
    ...prepared.record,
    state:'applied',
    appliedAt:new Date().toISOString(),
    failedAt:null,
    failure:'',
  };
  await env.DAILY_ORDERS.put(prepared.key,JSON.stringify(record));
  return record;
}

export async function markOrderPublicationFailed(env,prepared,error) {
  if(!prepared?.key||!prepared?.record)return null;
  const record={
    ...prepared.record,
    state:'failed',
    failedAt:new Date().toISOString(),
    failure:clean(error?.message||error||'publication_failed').slice(0,500),
  };
  await env.DAILY_ORDERS.put(prepared.key,JSON.stringify(record));
  return record;
}

export async function listOrderPublications(env,{limit=100,cycleId=''}={}) {
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.list!=='function')return[];
  const wanted=Math.max(1,Math.min(500,Math.floor(Number(limit)||100)));
  const keys=await listKeysCached(env,{
    prefix:ORDER_HISTORY_PREFIX,
    cacheKey:ORDER_HISTORY_LIST_CACHE_KEY,
    maxAgeSeconds:21600,
    maxKeys:3000,
  });

  const rows=await Promise.all(keys.map(key=>env.DAILY_ORDERS.get(key,{type:'json'})));
  const wantedCycle=clean(cycleId);
  return rows
    .filter(Boolean)
    .filter(row=>!wantedCycle||clean(row.cycleId)===wantedCycle||clean(row.previousCycleId)===wantedCycle)
    .sort((a,b)=>eventTime(b).localeCompare(eventTime(a)))
    .slice(0,wanted)
    .map(publicHistoryRecord);
}

export function archivedRemovedOrders(records,currentOrders=[]) {
  const currentIds=new Set(
    (Array.isArray(currentOrders)?currentOrders:[])
      .map(order=>clean(order?.id))
      .filter(Boolean)
  );
  const seen=new Set();
  const removed=[];
  const applied=(Array.isArray(records)?records:[])
    .filter(record=>record?.state==='applied')
    .sort((a,b)=>eventTime(b).localeCompare(eventTime(a)));

  for(const record of applied){
    const before=Array.isArray(record?.before?.orders)?record.before.orders:[];
    const after=Array.isArray(record?.after?.orders)?record.after.orders:[];
    for(const prior of before){
      const id=clean(prior?.id);
      const logical=clean(prior?.logicalKey)||deriveLogicalOrderKey(prior);
      const revision=Math.max(1,Math.floor(Number(prior?.revision)||1));
      const stillPresent=after.some(next=>
        (id&&clean(next?.id)===id)
        || (!id&&logical&&(clean(next?.logicalKey)||deriveLogicalOrderKey(next))===logical)
      );
      if(stillPresent||!id||currentIds.has(id))continue;
      const key=id+'|'+revision;
      if(seen.has(key))continue;
      seen.add(key);
      removed.push({
        ...prior,
        logicalKey:logical,
        revision,
        rewardHistoryArchived:true,
        rewardHistoryRemovedAt:record.preparedAt||record.appliedAt||null,
        rewardHistoryPublicationCycleId:clean(record?.before?.cycleId)
          || clean(record?.previousCycleId)
          || clean(record?.cycleId)
          || null,
      });
    }
  }
  return removed;
}

export function summarizeOrderChanges(beforeOrders=[],afterOrders=[]) {
  const before=Array.isArray(beforeOrders)?beforeOrders:[];
  const after=Array.isArray(afterOrders)?afterOrders:[];
  const used=new Set();
  const rows=[];

  for(const next of after){
    const index=findPrior(before,next,used);
    if(index<0){
      rows.push({status:'added',before:null,after:orderSummary(next)});
      continue;
    }
    used.add(index);
    const prior=before[index];
    const changed=orderRevisionFingerprint(prior)!==orderRevisionFingerprint(next);
    rows.push({status:changed?'revised':'unchanged',before:orderSummary(prior),after:orderSummary(next)});
  }
  before.forEach((prior,index)=>{
    if(!used.has(index))rows.push({status:'removed',before:orderSummary(prior),after:null});
  });

  const counts={added:0,revised:0,removed:0,unchanged:0};
  rows.forEach(row=>{counts[row.status]=(counts[row.status]||0)+1;});
  return {
    counts,
    material:counts.added+counts.revised+counts.removed>0,
    rows,
  };
}

export function snapshotDocument(value={}) {
  const source=value&&typeof value==='object'?value:{};
  return {
    configured:source.configured!==false,
    title:clean(source.title).slice(0,120),
    briefing:clean(source.briefing).slice(0,1200),
    updatedAt:iso(source.updatedAt),
    updatedBy:clean(source.updatedBy).slice(0,120),
    cycleId:clean(source.cycleId).slice(0,100)||null,
    cycleStartedAt:iso(source.cycleStartedAt),
    officerNote:clean(source.officerNote).slice(0,1200)||null,
    orders:(Array.isArray(source.orders)?source.orders:[]).slice(0,24).map(orderSnapshot),
  };
}

function orderSnapshot(value={}) {
  const reporting=value?.reporting&&typeof value.reporting==='object'
    ? {
        type:clean(value.reporting.type).slice(0,40),
        target:numberOrNull(value.reporting.target),
        blitz:Boolean(value.reporting.blitz),
      }
    : null;
  return {
    id:clean(value.id).slice(0,100),
    logicalKey:clean(value.logicalKey).slice(0,520)||deriveLogicalOrderKey(value),
    revision:Math.max(1,Math.floor(Number(value.revision)||1)),
    system:clean(value.system).slice(0,140),
    faction:clean(value.faction).slice(0,140),
    kind:clean(value.kind).slice(0,80),
    source:clean(value.source).slice(0,80),
    priority:clean(value.priority).slice(0,40),
    task:clean(value.task).slice(0,240),
    detail:clean(value.detail).slice(0,1000),
    status:clean(value.status).slice(0,80),
    reporting,
    createdAt:iso(value.createdAt),
    revisedAt:iso(value.revisedAt),
  };
}

function orderSummary(value={}) {
  const order=orderSnapshot(value);
  return {
    id:order.id,
    logicalKey:order.logicalKey,
    revision:order.revision,
    system:order.system,
    faction:order.faction,
    kind:order.kind,
    priority:order.priority,
    task:order.task,
    reporting:order.reporting,
  };
}

function findPrior(before,next,used) {
  const id=clean(next?.id);
  if(id){
    const byId=before.findIndex((item,index)=>!used.has(index)&&clean(item?.id)===id);
    if(byId>=0)return byId;
  }
  const logical=clean(next?.logicalKey)||deriveLogicalOrderKey(next);
  return before.findIndex((item,index)=>!used.has(index)&&(clean(item?.logicalKey)||deriveLogicalOrderKey(item))===logical);
}

function publicHistoryRecord(value={}) {
  const record=value&&typeof value==='object'?value:{};
  return {
    version:1,
    publicationId:clean(record.publicationId),
    state:['prepared','applied','failed'].includes(record.state)?record.state:'prepared',
    action:['reconcile','replace','delete','baseline'].includes(record.action)?record.action:'replace',
    cycleId:clean(record.cycleId)||null,
    previousCycleId:clean(record.previousCycleId)||null,
    preparedAt:iso(record.preparedAt),
    appliedAt:iso(record.appliedAt),
    failedAt:iso(record.failedAt),
    failure:clean(record.failure).slice(0,500),
    actor:clean(record.actor).slice(0,120),
    legacyBaseline:Boolean(record.legacyBaseline),
    reconcileSystems:unique(record.reconcileSystems).slice(0,100),
    beforeHash:clean(record.beforeHash).slice(0,100),
    afterHash:clean(record.afterHash).slice(0,100),
    changes:record.changes&&typeof record.changes==='object'?record.changes:summarizeOrderChanges(record.before?.orders,record.after?.orders),
    before:snapshotDocument(record.before),
    after:snapshotDocument(record.after),
  };
}

function orderBaselineKey(cycleId) {
  return ORDER_HISTORY_PREFIX+encodeURIComponent(clean(cycleId)||'uncycled')+':baseline-v1';
}

function historyKey(record) {
  const stamp=String(record.preparedAt||new Date().toISOString()).replace(/[:.]/g,'-');
  return ORDER_HISTORY_PREFIX+encodeURIComponent(record.cycleId||'uncycled')+':'+stamp+':'+encodeURIComponent(record.publicationId);
}

async function digestSnapshot(snapshot) {
  const data=new TextEncoder().encode(JSON.stringify(snapshot));
  const hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function requireStore(env){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.put!=='function')throw new Error('order_history_storage_not_configured');
}
function eventTime(row){return String(row?.appliedAt||row?.failedAt||row?.preparedAt||'')}
function unique(values){return [...new Set((Array.isArray(values)?values:[]).map(value=>clean(value)).filter(Boolean))]}
function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null}
function iso(value){if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
