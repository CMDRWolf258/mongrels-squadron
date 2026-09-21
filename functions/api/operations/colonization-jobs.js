import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts, privateHeaders } from '../../../lib/frontier.js';
import {
  COLONIZATION_JOBS_KEY,
  colonizationJobPreview,
  normalizeColonizationJob,
  readColonizationJobs,
  writeColonizationJobs,
} from '../../../lib/colonization-jobs.js';

export async function onRequestGet({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const store=await readColonizationJobs(env);
  const accounts=await listFrontierAccounts(env);
  const memberRows=await Promise.all(accounts.map(async row=>({
    ownerId:row.userId,
    commander:row.account?.commander||'Elite CMDR',
    events:await getEvents(env,row.userId),
  })));

  const jobs=store.jobs.map(job=>{
    const members=memberRows.map(member=>({
      ownerId:member.ownerId,
      commander:member.commander,
      ...colonizationJobPreview(job,member.events),
    })).filter(row=>row.tons>0||row.eventCount>0);
    const squadTons=members.reduce((sum,row)=>sum+(Number(row.tons)||0),0);
    const squadEvents=members.reduce((sum,row)=>sum+(Number(row.eventCount)||0),0);
    return {
      ...job,
      squadTons,
      squadEvents,
      contributorCount:members.length,
      members,
    };
  });

  const observedMap=new Map();
  for(const member of memberRows) {
    for(const event of member.events) {
      if(event?.type!=='colonization_contribution')continue;
      const key=[String(event.system||''),String(event.marketId||'')].join('|');
      if(!event.system||!event.marketId)continue;
      const row=observedMap.get(key)||{
        system:event.system,
        marketId:String(event.marketId),
        station:event.station||'',
        totalTons:0,
        contributionEvents:0,
        commanders:new Set(),
        lastContributionAt:null,
      };
      row.totalTons+=Number(event.totalTons)||0;
      row.contributionEvents+=1;
      row.commanders.add(member.commander);
      if(event.timestamp&&(!row.lastContributionAt||event.timestamp>row.lastContributionAt))row.lastContributionAt=event.timestamp;
      observedMap.set(key,row);
    }
  }

  const observedMarkets=[...observedMap.values()].map(row=>({
    ...row,
    commanders:[...row.commanders].sort(),
  })).sort((a,b)=>String(b.lastContributionAt||'').localeCompare(String(a.lastContributionAt||'')));

  return reply({
    ok:true,
    jobs,
    observedMarkets,
    connectedMembers:accounts.length,
    updatedAt:store.updatedAt,
    updatedBy:store.updatedBy,
    automaticRewardIssuance:false,
  });
}

export async function onRequestPut({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);
  if(!env?.DAILY_ORDERS||typeof env.DAILY_ORDERS.put!=='function')return reply({ok:false,error:'colonization_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400)}

  const action=clean(body?.action,30);
  const store=await readColonizationJobs(env);
  const jobs=[...store.jobs];
  const actor=auth.session.displayName||auth.session.username||'Wolf';

  if(action==='create') {
    const job=normalizeColonizationJob({...body.job,createdBy:actor,updatedBy:actor});
    const error=validateJob(job);
    if(error)return reply({ok:false,error},400);
    jobs.unshift(job);
  } else if(action==='update') {
    const id=clean(body?.job?.id||body?.id,80);
    const index=jobs.findIndex(job=>String(job.id)===id);
    if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
    const job=normalizeColonizationJob({...body.job,updatedBy:actor},jobs[index]);
    const error=validateJob(job);
    if(error)return reply({ok:false,error},400);
    jobs[index]=job;
  } else if(action==='status') {
    const id=clean(body?.id,80);
    const status=clean(body?.status,20);
    const index=jobs.findIndex(job=>String(job.id)===id);
    if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
    if(!['active','paused','completed'].includes(status))return reply({ok:false,error:'colonization_status_invalid'},400);
    jobs[index]=normalizeColonizationJob({...jobs[index],status,updatedBy:actor},jobs[index]);
  } else if(action==='delete') {
    const id=clean(body?.id,80);
    const index=jobs.findIndex(job=>String(job.id)===id);
    if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
    jobs.splice(index,1);
  } else {
    return reply({ok:false,error:'unsupported_action'},400);
  }

  const saved=await writeColonizationJobs(env,jobs,actor);
  return reply({ok:true,jobs:saved.jobs,updatedAt:saved.updatedAt,updatedBy:saved.updatedBy,automaticRewardIssuance:false});
}

async function requireSiteAdmin(request,env) {
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}

function validateJob(job) {
  if(!job.system)return'colonization_system_required';
  if(job.scope==='market'&&!job.marketId)return'colonization_market_id_required';
  if(!(Number(job.targetTons)>0))return'colonization_target_required';
  if(!(Number(job.rewardBlockTons)>0))return'colonization_reward_block_required';
  if(Number(job.rewardBlockMillions)<0)return'colonization_reward_invalid';
  return'';
}
function sameOrigin(request) {
  const origin=request.headers.get('Origin');
  return origin===new URL(request.url).origin&&request.headers.get('X-Mongrels-Request')==='wolf-colonization-jobs';
}
function clean(value,max){return String(value??'').trim().slice(0,max)}
function reply(body,status=200){return json(body,{status,headers:privateHeaders()})}
