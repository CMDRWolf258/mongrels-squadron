export const COLONIZATION_JOBS_KEY = 'colonization-jobs-v1';
export const COLONIZATION_JOB_STATUS_OVERRIDES_KEY = 'colonization-job-status-overrides-v1';

const ACTIVE_STATUSES = new Set(['active','paused','completed']);
const SCOPES = new Set(['system','market']);
const FUNDING_MODES = new Set(['none','member','squad']);
const FUNDING_STATES = new Set(['not_required','pending','approved','rejected']);

export async function readColonizationJobs(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return {version:1,jobs:[]};
  const [stored,statusOverrides] = await Promise.all([
    env.DAILY_ORDERS.get(COLONIZATION_JOBS_KEY,{type:'json'}),
    env.DAILY_ORDERS.get(COLONIZATION_JOB_STATUS_OVERRIDES_KEY,{type:'json'}),
  ]);
  const overrides=statusOverrides&&typeof statusOverrides==='object'&&statusOverrides.jobs&&typeof statusOverrides.jobs==='object'
    ? statusOverrides.jobs
    : {};
  const jobs = Array.isArray(stored?.jobs)
    ? stored.jobs.map(normalizeStoredJob).filter(Boolean).map(job=>applyStatusOverride(job,overrides[job.id]))
    : [];
  return {
    version:1,
    jobs,
    updatedAt:stored?.updatedAt||null,
    updatedBy:stored?.updatedBy||null,
  };
}

export function buildColonizationJobsStore(jobs, actor='Wolf', updatedAt=new Date().toISOString()) {
  return {
    version:1,
    jobs:(Array.isArray(jobs)?jobs:[]).map(normalizeStoredJob).filter(Boolean).slice(0,100),
    updatedAt:iso(updatedAt)||new Date().toISOString(),
    updatedBy:clean(actor,120)||'Wolf',
  };
}

export async function writeColonizationJobs(env, jobs, actor='Wolf', updatedAt=new Date().toISOString()) {
  const stored=buildColonizationJobsStore(jobs,actor,updatedAt);
  await env.DAILY_ORDERS.put(COLONIZATION_JOBS_KEY,JSON.stringify(stored));
  return stored;
}

export async function writeColonizationJobsStore(env, store) {
  const source=store&&typeof store==='object'?store:{};
  const stored=buildColonizationJobsStore(source.jobs,source.updatedBy||'Wolf',source.updatedAt||new Date().toISOString());
  await env.DAILY_ORDERS.put(COLONIZATION_JOBS_KEY,JSON.stringify(stored));
  return stored;
}

export async function writeColonizationJobStatusOverride(env,{
  jobId,
  status,
  endsAt=null,
  actor='Mongrel Member',
  updatedAt=new Date().toISOString(),
}={}) {
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.get!=='function'||typeof env.DAILY_ORDERS.put!=='function')throw new Error('colonization_status_storage_not_configured');
  const id=clean(jobId,80);
  if(!id)throw new Error('colonization_job_id_required');
  const normalizedStatus=ACTIVE_STATUSES.has(status)?status:'active';
  const current=await env.DAILY_ORDERS.get(COLONIZATION_JOB_STATUS_OVERRIDES_KEY,{type:'json'});
  const jobs=current&&typeof current==='object'&&current.jobs&&typeof current.jobs==='object'?{...current.jobs}:{};
  jobs[id]={
    status:normalizedStatus,
    endsAt:normalizedStatus==='active'?null:(iso(endsAt)||new Date(updatedAt).toISOString()),
    updatedAt:iso(updatedAt)||new Date().toISOString(),
    updatedBy:clean(actor,120),
  };
  const payload={version:1,jobs,updatedAt:iso(updatedAt)||new Date().toISOString(),updatedBy:clean(actor,120)};
  await env.DAILY_ORDERS.put(COLONIZATION_JOB_STATUS_OVERRIDES_KEY,JSON.stringify(payload));
  return jobs[id];
}

export function normalizeColonizationJob(value={}, existing={}) {
  const now = new Date().toISOString();
  const hasExisting=Boolean(existing&&typeof existing==='object'&&clean(existing.id,80));
  const scope = SCOPES.has(value.scope) ? value.scope : (SCOPES.has(existing.scope)?existing.scope:'system');
  const system = clean(value.system ?? existing.system,140);
  const marketId = clean(value.marketId ?? existing.marketId,40);
  const buildName = clean(value.buildName ?? existing.buildName,140);
  const commodity = clean(value.commodity ?? existing.commodity,100);
  const title = clean(value.title ?? existing.title,160)
    || (scope==='market' ? (buildName||'Specific construction build') : (system?system+' construction':'Colonization hauling job'));
  const targetTons = integer(value.targetTons ?? existing.targetTons,0,100000000,10000);
  const rewardBlockTons = integer(value.rewardBlockTons ?? existing.rewardBlockTons,1,100000000,5000);
  const rewardBlockMillions = decimal(value.rewardBlockMillions ?? existing.rewardBlockMillions,0,1000000,100);
  const personalCapMillions = nullableDecimal(value.personalCapMillions ?? existing.personalCapMillions,0,100000000);
  const startsAt = iso(value.startsAt ?? existing.startsAt) || existing.startsAt || now;
  const endsAt = iso(value.endsAt ?? existing.endsAt);
  const status = ACTIVE_STATUSES.has(value.status) ? value.status : (ACTIVE_STATUSES.has(existing.status)?existing.status:'active');
  const legacyFunding=!Object.prototype.hasOwnProperty.call(value,'fundingMode')&&!Object.prototype.hasOwnProperty.call(existing,'fundingMode');
  const fundingMode=FUNDING_MODES.has(value.fundingMode)?value.fundingMode:(FUNDING_MODES.has(existing.fundingMode)?existing.fundingMode:(legacyFunding?'squad':'none'));
  const requestedFundingState=FUNDING_STATES.has(value.fundingApprovalStatus)?value.fundingApprovalStatus:(FUNDING_STATES.has(existing.fundingApprovalStatus)?existing.fundingApprovalStatus:'');
  const fundingApprovalStatus=fundingMode==='none'
    ? 'not_required'
    : fundingMode==='member'
      ? 'approved'
      : (requestedFundingState||'approved');
  const computedBudgetMillions=rewardBlockMillions>0
    ? Math.ceil(targetTons/Math.max(1,rewardBlockTons))*rewardBlockMillions
    : 0;
  const rewardBudgetMillions=decimal(value.rewardBudgetMillions ?? existing.rewardBudgetMillions,0,100000000,computedBudgetMillions);

  const candidate={
    id:clean(existing.id || value.id,80) || crypto.randomUUID(),
    title,
    system,
    scope,
    marketId:scope==='market'?marketId:'',
    buildName:scope==='market'?buildName:'',
    commodity,
    targetTons,
    rewardBlockTons,
    rewardBlockMillions,
    personalCapMillions,
    fundingMode,
    fundingApprovalStatus,
    rewardBudgetMillions,
    postingOwnerId:clean(existing.postingOwnerId || value.postingOwnerId,160),
    postingOwnerName:clean(existing.postingOwnerName || value.postingOwnerName,120),
    postingCommander:clean(existing.postingCommander || value.postingCommander,80),
    fundingPayerOwnerId:clean(existing.fundingPayerOwnerId || value.fundingPayerOwnerId,160),
    fundingPayerName:clean(existing.fundingPayerName || value.fundingPayerName,120),
    fundingApprovedAt:iso(value.fundingApprovedAt ?? existing.fundingApprovedAt),
    fundingApprovedBy:clean(value.fundingApprovedBy ?? existing.fundingApprovedBy,120),
    fundingNote:clean(value.fundingNote ?? existing.fundingNote,500),
    status,
    startsAt,
    endsAt,
    notes:clean(value.notes ?? existing.notes,1000),
    createdAt:existing.createdAt || now,
    createdBy:clean(existing.createdBy || value.createdBy,120),
    updatedAt:now,
    updatedBy:clean(value.updatedBy,120),
  };

  const priorRevision=Math.max(1,Math.floor(Number(existing.revision)||1));
  const changed=hasExisting
    ? colonizationJobRevisionFingerprint(candidate)!==colonizationJobRevisionFingerprint(existing)
    : false;

  return {
    ...candidate,
    revision:hasExisting?(changed?priorRevision+1:priorRevision):1,
    revisionStartedAt:hasExisting&&!changed
      ? (iso(existing.revisionStartedAt)||iso(existing.updatedAt)||iso(existing.createdAt)||iso(existing.startsAt)||now)
      : now,
  };
}

export function colonizationJobRevisionFingerprint(value={}) {
  const scope=value?.scope==='market'?'market':'system';
  return JSON.stringify({
    title:clean(value.title,160),
    system:clean(value.system,140),
    scope,
    marketId:scope==='market'?clean(value.marketId,40):'',
    buildName:scope==='market'?clean(value.buildName,140):'',
    commodity:clean(value.commodity,100),
    targetTons:integer(value.targetTons,0,100000000,10000),
    rewardBlockTons:integer(value.rewardBlockTons,1,100000000,5000),
    rewardBlockMillions:decimal(value.rewardBlockMillions,0,1000000,100),
    personalCapMillions:nullableDecimal(value.personalCapMillions,0,100000000),
    fundingMode:FUNDING_MODES.has(value.fundingMode)?value.fundingMode:'squad',
    fundingApprovalStatus:FUNDING_STATES.has(value.fundingApprovalStatus)?value.fundingApprovalStatus:'approved',
    rewardBudgetMillions:decimal(value.rewardBudgetMillions,0,100000000,0),
    fundingPayerOwnerId:clean(value.fundingPayerOwnerId,160),
    status:ACTIVE_STATUSES.has(value.status)?value.status:'active',
    startsAt:iso(value.startsAt),
    endsAt:iso(value.endsAt),
    notes:clean(value.notes,1000),
  });
}

export function activeColonizationJobs(storeOrJobs) {
  const jobs=Array.isArray(storeOrJobs)?storeOrJobs:(Array.isArray(storeOrJobs?.jobs)?storeOrJobs.jobs:[]);
  return jobs.filter(job=>job?.status==='active');
}

export function activeColonizationSystems(storeOrJobs) {
  return [...new Set(activeColonizationJobs(storeOrJobs).map(job=>clean(job.system,140)).filter(Boolean))];
}

export function earliestColonizationStart(storeOrJobs) {
  const times=activeColonizationJobs(storeOrJobs).map(job=>Date.parse(job.startsAt||'')).filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)) : null;
}

export function matchColonizationJobs(events, jobs) {
  const arbitration=arbitrateColonizationContributions(events,jobs);
  const eligible=(Array.isArray(jobs)?jobs:[]).filter(job=>job&&['active','paused','completed'].includes(job.status));
  return eligible.map(job=>colonizationJobPreview(job,events,arbitration));
}

export function arbitrateColonizationContributions(events,jobs) {
  const eligibleJobs=(Array.isArray(jobs)?jobs:[])
    .filter(job=>job&&['active','paused','completed'].includes(job.status));
  const assignments=[];
  const ambiguous=[];
  const suppressed=[];

  for(const sourceEvent of Array.isArray(events)?events:[]) {
    if(sourceEvent?.type!=='colonization_contribution')continue;
    const candidates=[];

    for(const job of eligibleJobs) {
      const matchedEvent=matchingContribution(sourceEvent,job);
      if(!matchedEvent)continue;
      const tons=Math.max(0,Math.floor(Number(matchedEvent.totalTons)||0));
      if(!tons)continue;
      candidates.push({
        jobId:String(job.id||''),
        title:clean(job.title,160)||clean(job.buildName,140)||clean(job.system,140)||'Colonization Job',
        scope:job.scope==='market'?'market':'system',
        commodity:clean(job.commodity,100),
        scopeRank:job.scope==='market'?1:0,
        commodityRank:job.commodity?1:0,
        tons,
        matchedEvent,
      });
    }

    if(!candidates.length)continue;

    candidates.sort((a,b)=>
      b.scopeRank-a.scopeRank
      || b.commodityRank-a.commodityRank
      || a.jobId.localeCompare(b.jobId)
    );
    const top=candidates[0];
    const finalists=candidates.filter(item=>
      item.scopeRank===top.scopeRank
      && item.commodityRank===top.commodityRank
    );
    const eventId=eventKey(sourceEvent);

    if(finalists.length>1) {
      ambiguous.push({
        eventId,
        timestamp:sourceEvent.timestamp||null,
        system:sourceEvent.system||'',
        marketId:String(sourceEvent.marketId||''),
        totalTons:Math.max(0,Math.floor(Number(sourceEvent.totalTons)||0)),
        reason:'equal_specificity',
        candidateJobIds:finalists.map(item=>item.jobId).sort(),
        candidates:finalists.map(item=>({
          jobId:item.jobId,
          title:item.title,
          scope:item.scope,
          commodity:item.commodity,
          candidateTons:item.tons,
        })),
      });
      continue;
    }

    const winner=finalists[0];
    assignments.push({
      eventId,
      timestamp:sourceEvent.timestamp||null,
      system:sourceEvent.system||'',
      marketId:String(sourceEvent.marketId||''),
      jobId:winner.jobId,
      tons:winner.tons,
      matchedEvent:winner.matchedEvent,
      scope:winner.scope,
      commodity:winner.commodity,
    });

    for(const loser of candidates) {
      if(loser===winner)continue;
      suppressed.push({
        eventId,
        timestamp:sourceEvent.timestamp||null,
        system:sourceEvent.system||'',
        marketId:String(sourceEvent.marketId||''),
        candidateJobId:loser.jobId,
        winningJobId:winner.jobId,
        candidateTons:loser.tons,
        reason:arbitrationReason(winner,loser),
      });
    }
  }

  return {
    version:1,
    assignments,
    ambiguous,
    suppressed,
    summary:{
      contributionEvents:(Array.isArray(events)?events:[]).filter(event=>event?.type==='colonization_contribution').length,
      assignedEvents:assignments.length,
      ambiguousEvents:ambiguous.length,
      suppressedMatches:suppressed.length,
      assignedTons:assignments.reduce((sum,row)=>sum+(Number(row.tons)||0),0),
      ambiguousObservedTons:ambiguous.reduce((sum,row)=>sum+(Number(row.totalTons)||0),0),
    },
  };
}

export function colonizationJobPreview(job, events, arbitration=null) {
  const matched=[];
  const arbitrationData=arbitration&&typeof arbitration==='object'?arbitration:null;

  if(arbitrationData) {
    for(const assignment of Array.isArray(arbitrationData.assignments)?arbitrationData.assignments:[]) {
      if(String(assignment.jobId||'')!==String(job?.id||''))continue;
      if(assignment.matchedEvent)matched.push(assignment.matchedEvent);
    }
  } else {
    for(const sourceEvent of Array.isArray(events)?events:[]) {
      const event=matchingContribution(sourceEvent,job);
      if(event)matched.push(event);
    }
  }

  let tons=0;
  const commodities=new Map();
  for(const event of matched) {
    const amount=Math.max(0,Math.floor(Number(event.totalTons)||0));
    if(!amount)continue;
    tons+=amount;
    for(const item of Array.isArray(event.contributions)?event.contributions:[]) {
      const name=clean(item.commodity,100)||clean(item.commodityCode,100)||'Unknown commodity';
      const qty=Math.max(0,Math.floor(Number(item.amount)||0));
      if(qty)commodities.set(name,(commodities.get(name)||0)+qty);
    }
  }

  const ambiguousForJob=arbitrationData
    ? (Array.isArray(arbitrationData.ambiguous)?arbitrationData.ambiguous:[]).filter(row=>(row.candidateJobIds||[]).map(String).includes(String(job?.id||'')))
    : [];
  const suppressedForJob=arbitrationData
    ? (Array.isArray(arbitrationData.suppressed)?arbitrationData.suppressed:[]).filter(row=>String(row.candidateJobId||'')===String(job?.id||''))
    : [];
  const ambiguousPotentialTons=ambiguousForJob.reduce((sum,row)=>{
    const candidate=(row.candidates||[]).find(item=>String(item.jobId||'')===String(job?.id||''));
    return sum+(Number(candidate?.candidateTons)||0);
  },0);
  const suppressedTons=suppressedForJob.reduce((sum,row)=>sum+(Number(row.candidateTons)||0),0);

  const blockTons=Math.max(1,Number(job.rewardBlockTons)||1);
  const completeBlocks=Math.floor(tons/blockTons);
  const rawRewardMillions=round1(completeBlocks*(Number(job.rewardBlockMillions)||0));
  const cap=job.personalCapMillions===null||job.personalCapMillions===undefined?null:Number(job.personalCapMillions);
  const rewardPreviewMillions=cap===null?rawRewardMillions:round1(Math.min(rawRewardMillions,Math.max(0,cap)));
  return {
    jobId:job.id,
    tons,
    payableTons:tons,
    observedCandidateTons:tons+ambiguousPotentialTons+suppressedTons,
    targetTons:Number(job.targetTons)||0,
    completeBlocks,
    rewardBlockTons:blockTons,
    rewardBlockMillions:Number(job.rewardBlockMillions)||0,
    rewardPreviewMillions,
    personalCapMillions:cap,
    nextBlockTons:tons%blockTons,
    tonsToNextBlock:(tons%blockTons)===0?blockTons:blockTons-(tons%blockTons),
    eventCount:matched.length,
    assignedEventIds:arbitrationData
      ? arbitrationData.assignments.filter(row=>String(row.jobId||'')===String(job?.id||'')).map(row=>row.eventId)
      : matched.map(event=>eventKey(event)),
    ambiguousEventCount:ambiguousForJob.length,
    ambiguousPotentialTons,
    suppressedEventCount:suppressedForJob.length,
    suppressedTons,
    arbitrationApplied:Boolean(arbitrationData),
    arbitrationBlocked:ambiguousForJob.length>0,
    commodities:[...commodities.entries()].map(([commodity,amount])=>({commodity,amount})).sort((a,b)=>b.amount-a.amount||a.commodity.localeCompare(b.commodity)),
    lastContributionAt:matched.map(event=>event.timestamp).filter(Boolean).sort().at(-1)||null,
  };
}

function matchingContribution(event,job) {
  if(event?.type!=='colonization_contribution')return null;
  if(norm(event.system)!==norm(job.system))return null;
  const timestamp=Date.parse(event.timestamp||'');
  const start=Date.parse(job.startsAt||'');
  const end=Date.parse(job.endsAt||'');
  if(Number.isFinite(start) && (!Number.isFinite(timestamp)||timestamp<start))return null;
  if(Number.isFinite(end) && (!Number.isFinite(timestamp)||timestamp>end))return null;
  if(job.scope==='market') {
    if(!job.marketId)return null;
    if(String(event.marketId||'')!==String(job.marketId||''))return null;
  }
  if(!job.commodity)return event;
  const wanted=norm(job.commodity);
  const filtered=(Array.isArray(event.contributions)?event.contributions:[]).filter(item=>norm(item.commodity)===wanted||norm(item.commodityCode)===wanted);
  if(!filtered.length)return null;
  return {...event,totalTons:filtered.reduce((sum,item)=>sum+(Number(item.amount)||0),0),contributions:filtered};
}

function arbitrationReason(winner,loser) {
  if(winner.scopeRank>loser.scopeRank)return'specific_build_preferred';
  if(winner.commodityRank>loser.commodityRank)return'commodity_specific_preferred';
  return'higher_priority_candidate';
}

function eventKey(event) {
  if(event?.id)return String(event.id);
  return [
    event?.timestamp||'',
    event?.system||'',
    event?.marketId||'',
    Number(event?.totalTons)||0,
  ].join('|');
}

function applyStatusOverride(job,override) {
  if(!override||typeof override!=='object')return job;
  const status=ACTIVE_STATUSES.has(override.status)?override.status:job.status;
  return {
    ...job,
    status,
    endsAt:status==='active'?null:(iso(override.endsAt)||job.endsAt),
    statusOverrideUpdatedAt:iso(override.updatedAt),
    statusOverrideUpdatedBy:clean(override.updatedBy,120),
  };
}

function normalizeStoredJob(value) {
  if(!value||typeof value!=='object')return null;
  const scope=SCOPES.has(value.scope)?value.scope:'system';
  return {
    id:clean(value.id,80),
    revision:Math.max(1,Math.floor(Number(value.revision)||1)),
    revisionStartedAt:iso(value.revisionStartedAt)||iso(value.createdAt)||iso(value.startsAt),
    title:clean(value.title,160),
    system:clean(value.system,140),
    scope,
    marketId:scope==='market'?clean(value.marketId,40):'',
    buildName:scope==='market'?clean(value.buildName,140):'',
    commodity:clean(value.commodity,100),
    targetTons:integer(value.targetTons,0,100000000,10000),
    rewardBlockTons:integer(value.rewardBlockTons,1,100000000,5000),
    rewardBlockMillions:decimal(value.rewardBlockMillions,0,1000000,100),
    personalCapMillions:nullableDecimal(value.personalCapMillions,0,100000000),
    fundingMode:FUNDING_MODES.has(value.fundingMode)?value.fundingMode:'squad',
    fundingApprovalStatus:FUNDING_STATES.has(value.fundingApprovalStatus)?value.fundingApprovalStatus:'approved',
    rewardBudgetMillions:decimal(value.rewardBudgetMillions,0,100000000,0),
    postingOwnerId:clean(value.postingOwnerId,160),
    postingOwnerName:clean(value.postingOwnerName,120),
    postingCommander:clean(value.postingCommander,80),
    fundingPayerOwnerId:clean(value.fundingPayerOwnerId,160),
    fundingPayerName:clean(value.fundingPayerName,120),
    fundingApprovedAt:iso(value.fundingApprovedAt),
    fundingApprovedBy:clean(value.fundingApprovedBy,120),
    fundingNote:clean(value.fundingNote,500),
    status:ACTIVE_STATUSES.has(value.status)?value.status:'active',
    startsAt:iso(value.startsAt)||value.createdAt||new Date().toISOString(),
    endsAt:iso(value.endsAt),
    notes:clean(value.notes,1000),
    createdAt:iso(value.createdAt),
    createdBy:clean(value.createdBy,120),
    updatedAt:iso(value.updatedAt),
    updatedBy:clean(value.updatedBy,120),
  };
}
function clean(value,max){return typeof value==='string'?value.trim().slice(0,max):String(value??'').trim().slice(0,max)}
function norm(value){return clean(value,200).toLowerCase().replace(/^\$|;$/g,'').replace(/\s+/g,' ')}
function integer(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function decimal(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function nullableDecimal(value,min,max){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):null}
function iso(value){if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null}
function round1(value){return Math.round((Number(value)||0)*10)/10}
