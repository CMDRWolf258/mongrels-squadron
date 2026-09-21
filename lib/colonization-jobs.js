export const COLONIZATION_JOBS_KEY = 'colonization-jobs-v1';

const ACTIVE_STATUSES = new Set(['active','paused','completed']);
const SCOPES = new Set(['system','market']);

export async function readColonizationJobs(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return {version:1,jobs:[]};
  const stored = await env.DAILY_ORDERS.get(COLONIZATION_JOBS_KEY,{type:'json'});
  const jobs = Array.isArray(stored?.jobs) ? stored.jobs.map(normalizeStoredJob).filter(Boolean) : [];
  return {
    version:1,
    jobs,
    updatedAt:stored?.updatedAt||null,
    updatedBy:stored?.updatedBy||null,
  };
}

export async function writeColonizationJobs(env, jobs, actor='Wolf') {
  const stored = {
    version:1,
    jobs:(Array.isArray(jobs)?jobs:[]).map(normalizeStoredJob).filter(Boolean).slice(0,100),
    updatedAt:new Date().toISOString(),
    updatedBy:clean(actor,120)||'Wolf',
  };
  await env.DAILY_ORDERS.put(COLONIZATION_JOBS_KEY,JSON.stringify(stored));
  return stored;
}

export function normalizeColonizationJob(value={}, existing={}) {
  const now = new Date().toISOString();
  const scope = SCOPES.has(value.scope) ? value.scope : (SCOPES.has(existing.scope)?existing.scope:'system');
  const system = clean(value.system ?? existing.system,140);
  const marketId = clean(value.marketId ?? existing.marketId,40);
  const buildName = clean(value.buildName ?? existing.buildName,140);
  const commodity = clean(value.commodity ?? existing.commodity,100);
  const title = clean(value.title ?? existing.title,160)
    || (scope==='market' ? (buildName||'Specific construction build') : (system?system+' construction':'Colonization hauling job'));
  const targetTons = integer(value.targetTons ?? existing.targetTons,1,100000000,10000);
  const rewardBlockTons = integer(value.rewardBlockTons ?? existing.rewardBlockTons,1,100000000,5000);
  const rewardBlockMillions = decimal(value.rewardBlockMillions ?? existing.rewardBlockMillions,0,1000000,100);
  const personalCapMillions = nullableDecimal(value.personalCapMillions ?? existing.personalCapMillions,0,100000000);
  const startsAt = iso(value.startsAt ?? existing.startsAt) || existing.startsAt || now;
  const endsAt = iso(value.endsAt ?? existing.endsAt);
  const status = ACTIVE_STATUSES.has(value.status) ? value.status : (ACTIVE_STATUSES.has(existing.status)?existing.status:'active');

  return {
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
    status,
    startsAt,
    endsAt,
    notes:clean(value.notes ?? existing.notes,1000),
    createdAt:existing.createdAt || now,
    createdBy:clean(existing.createdBy || value.createdBy,120),
    updatedAt:now,
    updatedBy:clean(value.updatedBy,120),
  };
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
  const active = (Array.isArray(jobs)?jobs:[]).filter(job=>job && ['active','paused','completed'].includes(job.status));
  return active.map(job=>colonizationJobPreview(job,events));
}

export function colonizationJobPreview(job, events) {
  const matched=[];
  let tons=0;
  const commodities=new Map();
  for(const sourceEvent of Array.isArray(events)?events:[]) {
    const event=matchingContribution(sourceEvent,job);
    if(!event)continue;
    const amount=Math.max(0,Math.floor(Number(event.totalTons)||0));
    if(!amount)continue;
    tons+=amount;
    matched.push(event);
    for(const item of Array.isArray(event.contributions)?event.contributions:[]) {
      const name=clean(item.commodity,100)||clean(item.commodityCode,100)||'Unknown commodity';
      const qty=Math.max(0,Math.floor(Number(item.amount)||0));
      if(qty)commodities.set(name,(commodities.get(name)||0)+qty);
    }
  }

  const blockTons=Math.max(1,Number(job.rewardBlockTons)||1);
  const completeBlocks=Math.floor(tons/blockTons);
  const rawRewardMillions=round1(completeBlocks*(Number(job.rewardBlockMillions)||0));
  const cap=job.personalCapMillions===null||job.personalCapMillions===undefined?null:Number(job.personalCapMillions);
  const rewardPreviewMillions=cap===null?rawRewardMillions:round1(Math.min(rawRewardMillions,Math.max(0,cap)));
  return {
    jobId:job.id,
    tons,
    targetTons:Number(job.targetTons)||0,
    completeBlocks,
    rewardBlockTons:blockTons,
    rewardBlockMillions:Number(job.rewardBlockMillions)||0,
    rewardPreviewMillions,
    personalCapMillions:cap,
    nextBlockTons:tons%blockTons,
    tonsToNextBlock:(tons%blockTons)===0?blockTons:blockTons-(tons%blockTons),
    eventCount:matched.length,
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
  if(job.scope==='market' && String(event.marketId||'')!==String(job.marketId||''))return null;
  if(!job.commodity)return event;
  const wanted=norm(job.commodity);
  const filtered=(Array.isArray(event.contributions)?event.contributions:[]).filter(item=>norm(item.commodity)===wanted||norm(item.commodityCode)===wanted);
  if(!filtered.length)return null;
  return {...event,totalTons:filtered.reduce((sum,item)=>sum+(Number(item.amount)||0),0),contributions:filtered};
}

function normalizeStoredJob(value) {
  if(!value||typeof value!=='object')return null;
  const scope=SCOPES.has(value.scope)?value.scope:'system';
  return {
    id:clean(value.id,80),
    title:clean(value.title,160),
    system:clean(value.system,140),
    scope,
    marketId:scope==='market'?clean(value.marketId,40):'',
    buildName:scope==='market'?clean(value.buildName,140):'',
    commodity:clean(value.commodity,100),
    targetTons:integer(value.targetTons,1,100000000,10000),
    rewardBlockTons:integer(value.rewardBlockTons,1,100000000,5000),
    rewardBlockMillions:decimal(value.rewardBlockMillions,0,1000000,100),
    personalCapMillions:nullableDecimal(value.personalCapMillions,0,100000000),
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
