import { colonizationJobRevisionFingerprint } from './colonization-jobs.js';
import { invalidateKeyListCache, listKeysCached } from './kv-list-cache.js';

export const COLONIZATION_JOB_HISTORY_PREFIX='colonization-job-history:';
export const COLONIZATION_JOB_HISTORY_BASELINE_KEY=COLONIZATION_JOB_HISTORY_PREFIX+'baseline-v1';
const COLONIZATION_JOB_HISTORY_LIST_CACHE_KEY='kv-list-cache:colonization-job-history-v1';

export async function ensureColonizationJobHistoryBaseline(env,store,actor='System migration') {
  requireStore(env);
  const current=snapshotColonizationStore(store);
  if(!current.jobs.length)return null;

  const existing=await env.DAILY_ORDERS.get(COLONIZATION_JOB_HISTORY_BASELINE_KEY,{type:'json'});
  if(existing)return publicHistoryRecord(existing);

  const now=new Date().toISOString();
  const before=snapshotColonizationStore({version:1,jobs:[],updatedAt:null,updatedBy:null});
  const record={
    version:1,
    publicationId:'colonization-baseline-v1',
    state:'applied',
    action:'baseline',
    targetJobId:'',
    preparedAt:now,
    appliedAt:now,
    failedAt:null,
    failure:'',
    actor:clean(actor).slice(0,120)||'System migration',
    legacyBaseline:true,
    beforeHash:await digestSnapshot(before),
    afterHash:await digestSnapshot(current),
    changes:summarizeColonizationJobChanges(before.jobs,current.jobs),
    before,
    after:current,
  };
  await env.DAILY_ORDERS.put(COLONIZATION_JOB_HISTORY_BASELINE_KEY,JSON.stringify(record));
  await invalidateKeyListCache(env,COLONIZATION_JOB_HISTORY_LIST_CACHE_KEY);
  return publicHistoryRecord(record);
}

export async function prepareColonizationJobPublication(env,{before,after,actor,action='update',targetJobId=''}={}) {
  requireStore(env);
  const preparedAt=new Date().toISOString();
  const publicationId=crypto.randomUUID();
  const beforeSnapshot=snapshotColonizationStore(before);
  const afterSnapshot=snapshotColonizationStore(after);
  const record={
    version:1,
    publicationId,
    state:'prepared',
    action:normalizeAction(action),
    targetJobId:clean(targetJobId).slice(0,80),
    preparedAt,
    appliedAt:null,
    failedAt:null,
    failure:'',
    actor:clean(actor).slice(0,120)||'Mongrel Officer',
    legacyBaseline:false,
    beforeHash:await digestSnapshot(beforeSnapshot),
    afterHash:await digestSnapshot(afterSnapshot),
    changes:summarizeColonizationJobChanges(beforeSnapshot.jobs,afterSnapshot.jobs),
    before:beforeSnapshot,
    after:afterSnapshot,
  };
  const key=historyKey(record);
  await env.DAILY_ORDERS.put(key,JSON.stringify(record));
  await invalidateKeyListCache(env,COLONIZATION_JOB_HISTORY_LIST_CACHE_KEY);
  return {key,record};
}

export async function markColonizationJobPublicationApplied(env,prepared) {
  if(!prepared?.key||!prepared?.record)return null;
  const record={
    ...prepared.record,
    state:'applied',
    appliedAt:new Date().toISOString(),
    failedAt:null,
    failure:'',
  };
  await env.DAILY_ORDERS.put(prepared.key,JSON.stringify(record));
  return publicHistoryRecord(record);
}

export async function markColonizationJobPublicationFailed(env,prepared,error) {
  if(!prepared?.key||!prepared?.record)return null;
  const record={
    ...prepared.record,
    state:'failed',
    failedAt:new Date().toISOString(),
    failure:clean(error?.message||error||'publication_failed').slice(0,500),
  };
  await env.DAILY_ORDERS.put(prepared.key,JSON.stringify(record));
  return publicHistoryRecord(record);
}

export async function listColonizationJobPublications(env,{limit=100,jobId=''}={}) {
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.list!=='function')return[];
  const wanted=Math.max(1,Math.min(500,Math.floor(Number(limit)||100)));
  const keys=await listKeysCached(env,{
    prefix:COLONIZATION_JOB_HISTORY_PREFIX,
    cacheKey:COLONIZATION_JOB_HISTORY_LIST_CACHE_KEY,
    maxAgeSeconds:21600,
    maxKeys:3000,
  });

  const rows=await Promise.all(keys.map(key=>env.DAILY_ORDERS.get(key,{type:'json'})));
  const wantedJob=clean(jobId);
  return rows
    .filter(Boolean)
    .map(publicHistoryRecord)
    .filter(row=>!wantedJob||recordTouchesJob(row,wantedJob))
    .sort((a,b)=>eventTime(b).localeCompare(eventTime(a)))
    .slice(0,wanted);
}

export function summarizeColonizationJobChanges(beforeJobs=[],afterJobs=[]) {
  const before=Array.isArray(beforeJobs)?beforeJobs:[];
  const after=Array.isArray(afterJobs)?afterJobs:[];
  const used=new Set();
  const rows=[];

  for(const next of after){
    const id=clean(next?.id);
    const index=before.findIndex((item,i)=>!used.has(i)&&clean(item?.id)===id);
    if(index<0){
      rows.push({status:'added',before:null,after:jobSummary(next)});
      continue;
    }
    used.add(index);
    const prior=before[index];
    const changed=
      Number(prior?.revision||1)!==Number(next?.revision||1)
      || colonizationJobRevisionFingerprint(prior)!==colonizationJobRevisionFingerprint(next);
    rows.push({status:changed?'revised':'unchanged',before:jobSummary(prior),after:jobSummary(next)});
  }

  before.forEach((prior,index)=>{
    if(!used.has(index))rows.push({status:'removed',before:jobSummary(prior),after:null});
  });

  const counts={added:0,revised:0,removed:0,unchanged:0};
  rows.forEach(row=>{counts[row.status]=(counts[row.status]||0)+1;});
  return {
    counts,
    material:counts.added+counts.revised+counts.removed>0,
    rows,
  };
}

export function snapshotColonizationStore(value={}) {
  const source=value&&typeof value==='object'?value:{};
  return {
    version:1,
    jobs:(Array.isArray(source.jobs)?source.jobs:[]).slice(0,100).map(jobSnapshot).filter(job=>job.id),
    updatedAt:iso(source.updatedAt),
    updatedBy:clean(source.updatedBy).slice(0,120),
  };
}

export function findColonizationJobRevisionProvenance(records,{jobId='',revision=1}={}) {
  const wantedJob=clean(jobId);
  const wantedRevision=Math.max(1,Math.floor(Number(revision)||1));
  const candidates=(Array.isArray(records)?records:[])
    .filter(record=>record?.state==='applied')
    .sort((a,b)=>eventTime(b).localeCompare(eventTime(a)));

  for(const record of candidates){
    const after=(Array.isArray(record?.after?.jobs)?record.after.jobs:[])
      .find(job=>clean(job?.id)===wantedJob&&Number(job?.revision||1)===wantedRevision);
    if(after)return provenance(record,after,'after');

    const before=(Array.isArray(record?.before?.jobs)?record.before.jobs:[])
      .find(job=>clean(job?.id)===wantedJob&&Number(job?.revision||1)===wantedRevision);
    if(before)return provenance(record,before,'before');
  }
  return null;
}

export function findColonizationJobRevisionOrigin(records,{jobId='',revision=1}={}) {
  const wantedJob=clean(jobId);
  const wantedRevision=Math.max(1,Math.floor(Number(revision)||1));
  const candidates=(Array.isArray(records)?records:[])
    .filter(record=>record?.state==='applied')
    .sort((a,b)=>eventTime(a).localeCompare(eventTime(b)));

  let fallback=null;
  for(const record of candidates){
    const before=(Array.isArray(record?.before?.jobs)?record.before.jobs:[])
      .find(job=>clean(job?.id)===wantedJob);
    const after=(Array.isArray(record?.after?.jobs)?record.after.jobs:[])
      .find(job=>clean(job?.id)===wantedJob);

    if(after&&Number(after?.revision||1)===wantedRevision){
      const beforeSame=before&&Number(before?.revision||1)===wantedRevision;
      const origin=!beforeSame
        || colonizationJobRevisionFingerprint(before)!==colonizationJobRevisionFingerprint(after);
      const found=provenance(record,after,'after');
      if(origin)return found;
      if(!fallback)fallback=found;
    }

    if(before&&Number(before?.revision||1)===wantedRevision&&!fallback){
      fallback=provenance(record,before,'before');
    }
  }
  return fallback;
}

export function colonizationJobDeletionTime(records,jobId='') {
  const wantedJob=clean(jobId);
  const candidates=(Array.isArray(records)?records:[])
    .filter(record=>record?.state==='applied')
    .sort((a,b)=>eventTime(a).localeCompare(eventTime(b)));

  for(const record of candidates){
    const before=(Array.isArray(record?.before?.jobs)?record.before.jobs:[])
      .some(job=>clean(job?.id)===wantedJob);
    const after=(Array.isArray(record?.after?.jobs)?record.after.jobs:[])
      .some(job=>clean(job?.id)===wantedJob);
    if(before&&!after)return iso(record.appliedAt||record.preparedAt);
  }
  return null;
}

function jobSnapshot(value={}) {
  const scope=value?.scope==='market'?'market':'system';
  const personalCap=value?.personalCapMillions===null||value?.personalCapMillions===undefined||value?.personalCapMillions===''
    ? null
    : numberOrNull(value.personalCapMillions);
  return {
    id:clean(value.id).slice(0,80),
    revision:Math.max(1,Math.floor(Number(value.revision)||1)),
    revisionStartedAt:iso(value.revisionStartedAt)||iso(value.createdAt)||iso(value.startsAt),
    title:clean(value.title).slice(0,160),
    system:clean(value.system).slice(0,140),
    scope,
    marketId:scope==='market'?clean(value.marketId).slice(0,40):'',
    buildName:scope==='market'?clean(value.buildName).slice(0,140):'',
    commodity:clean(value.commodity).slice(0,100),
    targetTons:numberOrZero(value.targetTons),
    rewardBlockTons:numberOrZero(value.rewardBlockTons),
    rewardBlockMillions:numberOrZero(value.rewardBlockMillions),
    personalCapMillions:personalCap,
    status:['active','paused','completed'].includes(value.status)?value.status:'active',
    startsAt:iso(value.startsAt),
    endsAt:iso(value.endsAt),
    notes:clean(value.notes).slice(0,1000),
    createdAt:iso(value.createdAt),
    createdBy:clean(value.createdBy).slice(0,120),
    updatedAt:iso(value.updatedAt),
    updatedBy:clean(value.updatedBy).slice(0,120),
  };
}

function jobSummary(value={}) {
  const job=jobSnapshot(value);
  return {
    id:job.id,
    revision:job.revision,
    revisionStartedAt:job.revisionStartedAt,
    title:job.title,
    system:job.system,
    scope:job.scope,
    marketId:job.marketId,
    buildName:job.buildName,
    commodity:job.commodity,
    targetTons:job.targetTons,
    rewardBlockTons:job.rewardBlockTons,
    rewardBlockMillions:job.rewardBlockMillions,
    personalCapMillions:job.personalCapMillions,
    status:job.status,
    startsAt:job.startsAt,
    endsAt:job.endsAt,
  };
}

function publicHistoryRecord(value={}) {
  const record=value&&typeof value==='object'?value:{};
  const before=snapshotColonizationStore(record.before);
  const after=snapshotColonizationStore(record.after);
  return {
    version:1,
    publicationId:clean(record.publicationId),
    state:['prepared','applied','failed'].includes(record.state)?record.state:'prepared',
    action:normalizeAction(record.action),
    targetJobId:clean(record.targetJobId).slice(0,80),
    preparedAt:iso(record.preparedAt),
    appliedAt:iso(record.appliedAt),
    failedAt:iso(record.failedAt),
    failure:clean(record.failure).slice(0,500),
    actor:clean(record.actor).slice(0,120),
    legacyBaseline:Boolean(record.legacyBaseline),
    beforeHash:clean(record.beforeHash).slice(0,100),
    afterHash:clean(record.afterHash).slice(0,100),
    changes:record.changes&&typeof record.changes==='object'
      ? record.changes
      : summarizeColonizationJobChanges(before.jobs,after.jobs),
    before,
    after,
  };
}

function provenance(record,job,snapshotSide) {
  return {
    match:'exact',
    publicationId:clean(record.publicationId),
    action:normalizeAction(record.action),
    actor:clean(record.actor),
    publishedAt:record.appliedAt||record.preparedAt||null,
    snapshotSide,
    snapshotHash:snapshotSide==='after'?clean(record.afterHash):clean(record.beforeHash),
    archivedJobId:clean(job.id),
    archivedRevision:Math.max(1,Math.floor(Number(job.revision)||1)),
    revisionStartedAt:iso(job.revisionStartedAt),
    archivedJob:jobSnapshot(job),
    legacyBaseline:Boolean(record.legacyBaseline),
  };
}

function recordTouchesJob(record,jobId) {
  if(clean(record.targetJobId)===jobId)return true;
  return [...(record?.before?.jobs||[]),...(record?.after?.jobs||[])].some(job=>clean(job?.id)===jobId);
}

function normalizeAction(value) {
  const action=clean(value).toLowerCase();
  return ['baseline','create','update','status','delete'].includes(action)?action:'update';
}

function historyKey(record) {
  const stamp=String(record.preparedAt||new Date().toISOString()).replace(/[:.]/g,'-');
  return COLONIZATION_JOB_HISTORY_PREFIX+stamp+':'+encodeURIComponent(record.publicationId);
}

async function digestSnapshot(snapshot) {
  const data=new TextEncoder().encode(JSON.stringify(snapshot));
  const hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function requireStore(env){
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.put!=='function')throw new Error('colonization_job_history_storage_not_configured');
}
function eventTime(row){return String(row?.appliedAt||row?.failedAt||row?.preparedAt||'')}
function numberOrZero(value){const n=Number(value);return Number.isFinite(n)?n:0}
function numberOrNull(value){const n=Number(value);return Number.isFinite(n)?n:null}
function iso(value){if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
