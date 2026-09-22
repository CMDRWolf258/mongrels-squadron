import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts, privateHeaders } from '../../../lib/frontier.js';
import {
  arbitrateColonizationContributions,
  buildColonizationJobsStore,
  colonizationJobPreview,
  normalizeColonizationJob,
  readColonizationJobs,
  writeColonizationJobsStore,
  writeColonizationJobStatusOverride,
} from '../../../lib/colonization-jobs.js';
import {
  ensureColonizationJobHistoryBaseline,
  markColonizationJobPublicationApplied,
  markColonizationJobPublicationFailed,
  prepareColonizationJobPublication,
} from '../../../lib/colonization-job-history.js';
import { archiveColonizationJobDiscord, syncColonizationJobDiscord } from '../../../lib/colonization-discord.js';

export async function onRequestGet({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  const store=await readColonizationJobs(env);
  try{
    await ensureColonizationJobHistoryBaseline(env,store);
  }catch(error){
    console.error('Could not initialize Colonization Job history baseline',error);
  }
  const accounts=await listFrontierAccounts(env);
  const memberRows=await Promise.all(accounts.map(async row=>({
    ownerId:row.userId,
    commander:row.account?.commander||'Elite CMDR',
    events:await getEvents(env,row.userId),
  })));

  const verificationByMember=memberRows.map(member=>({
    ...member,
    arbitration:arbitrateColonizationContributions(member.events,store.jobs),
  }));

  const jobs=store.jobs.map(job=>{
    const members=verificationByMember.map(member=>({
      ownerId:member.ownerId,
      commander:member.commander,
      ...colonizationJobPreview(job,member.events,member.arbitration),
    })).filter(row=>
      row.tons>0
      || row.eventCount>0
      || row.ambiguousEventCount>0
      || row.suppressedEventCount>0
    );
    const squadTons=members.reduce((sum,row)=>sum+(Number(row.tons)||0),0);
    const squadEvents=members.reduce((sum,row)=>sum+(Number(row.eventCount)||0),0);
    const ambiguousEvents=members.reduce((sum,row)=>sum+(Number(row.ambiguousEventCount)||0),0);
    const ambiguousPotentialTons=members.reduce((sum,row)=>sum+(Number(row.ambiguousPotentialTons)||0),0);
    const suppressedEvents=members.reduce((sum,row)=>sum+(Number(row.suppressedEventCount)||0),0);
    const suppressedTons=members.reduce((sum,row)=>sum+(Number(row.suppressedTons)||0),0);
    return {
      ...job,
      squadTons,
      payableTons:squadTons,
      squadEvents,
      contributorCount:members.filter(row=>row.tons>0).length,
      arbitrationBlocked:ambiguousEvents>0,
      ambiguousEvents,
      ambiguousPotentialTons,
      suppressedEvents,
      suppressedTons,
      members,
    };
  });

  const observedMap=new Map();
  for(const member of memberRows) {
    for(const event of member.events) {
      if(!['colonization_depot','colonization_contribution'].includes(event?.type))continue;
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
        lastObservedAt:null,
        constructionProgress:null,
        constructionComplete:false,
        constructionFailed:false,
        resources:[],
      };
      if(event.station)row.station=event.station;
      row.commanders.add(member.commander);
      if(event.timestamp&&(!row.lastObservedAt||event.timestamp>row.lastObservedAt))row.lastObservedAt=event.timestamp;
      if(event.type==='colonization_contribution') {
        row.totalTons+=Number(event.totalTons)||0;
        row.contributionEvents+=1;
        if(event.timestamp&&(!row.lastContributionAt||event.timestamp>row.lastContributionAt))row.lastContributionAt=event.timestamp;
      }
      if(event.type==='colonization_depot') {
        row.constructionProgress=Number.isFinite(Number(event.constructionProgress))?Number(event.constructionProgress):row.constructionProgress;
        row.constructionComplete=Boolean(event.constructionComplete);
        row.constructionFailed=Boolean(event.constructionFailed);
        row.resources=Array.isArray(event.resources)?event.resources:[];
      }
      observedMap.set(key,row);
    }
  }

  const observedMarkets=[...observedMap.values()].map(row=>({
    ...row,
    commanders:[...row.commanders].sort(),
  })).sort((a,b)=>String(b.lastObservedAt||'').localeCompare(String(a.lastObservedAt||'')));

  return reply({
    ok:true,
    jobs,
    observedMarkets,
    connectedMembers:accounts.length,
    arbitrationSummary:{
      assignedEvents:verificationByMember.reduce((sum,row)=>sum+(Number(row.arbitration?.summary?.assignedEvents)||0),0),
      ambiguousEvents:verificationByMember.reduce((sum,row)=>sum+(Number(row.arbitration?.summary?.ambiguousEvents)||0),0),
      suppressedMatches:verificationByMember.reduce((sum,row)=>sum+(Number(row.arbitration?.summary?.suppressedMatches)||0),0),
      assignedTons:verificationByMember.reduce((sum,row)=>sum+(Number(row.arbitration?.summary?.assignedTons)||0),0),
      ambiguousObservedTons:verificationByMember.reduce((sum,row)=>sum+(Number(row.arbitration?.summary?.ambiguousObservedTons)||0),0),
    },
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
  let targetJobId='';
  let targetJob=null;
  let removedJob=null;
  let statusOverride=null;

  try{
    await ensureColonizationJobHistoryBaseline(env,store);
  }catch(error){
    console.error('Could not initialize Colonization Job history baseline before mutation',error);
    return reply({ok:false,error:'colonization_history_baseline_failed'},503);
  }

  if(action==='create') {
    const job=normalizeColonizationJob({...body.job,createdBy:actor,updatedBy:actor});
    const error=validateJob(job);
    if(error)return reply({ok:false,error},400);
    jobs.unshift(job);
    targetJobId=job.id;
    targetJob=job;
  } else if(action==='update') {
    const id=clean(body?.job?.id||body?.id,80);
    const index=jobs.findIndex(job=>String(job.id)===id);
    if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
    const job=normalizeColonizationJob({...body.job,updatedBy:actor},jobs[index]);
    const error=validateJob(job);
    if(error)return reply({ok:false,error},400);
    jobs[index]=job;
    targetJobId=id;
    targetJob=job;
  } else if(action==='status') {
    const id=clean(body?.id,80);
    const status=clean(body?.status,20);
    const index=jobs.findIndex(job=>String(job.id)===id);
    if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
    if(!['active','paused','completed'].includes(status))return reply({ok:false,error:'colonization_status_invalid'},400);
    const endsAt=status==='active'?null:(jobs[index].endsAt||new Date().toISOString());
    jobs[index]=normalizeColonizationJob({...jobs[index],status,endsAt,updatedBy:actor},jobs[index]);
    statusOverride={jobId:id,status:jobs[index].status,endsAt:jobs[index].endsAt,actor,updatedAt:jobs[index].updatedAt};
    targetJobId=id;
    targetJob=jobs[index];
  } else if(action==='delete') {
    const id=clean(body?.id,80);
    const index=jobs.findIndex(job=>String(job.id)===id);
    if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
    targetJobId=id;
    removedJob=jobs[index];
    jobs.splice(index,1);
  } else {
    return reply({ok:false,error:'unsupported_action'},400);
  }

  const afterStore=buildColonizationJobsStore(jobs,actor);
  const history=await prepareColonizationJobPublication(env,{
    before:store,
    after:afterStore,
    actor,
    action,
    targetJobId,
  });

  let saved;
  try{
    saved=await writeColonizationJobsStore(env,afterStore);
    if(statusOverride)await writeColonizationJobStatusOverride(env,statusOverride);
  }catch(error){
    try{await markColonizationJobPublicationFailed(env,history,error);}
    catch(historyError){console.error('Could not mark failed Colonization Job publication history',historyError);}
    throw error;
  }

  let historyState='prepared';
  try{
    await markColonizationJobPublicationApplied(env,history);
    historyState='applied';
  }catch(error){
    console.error('Colonization Jobs changed but history finalization remained prepared',error);
  }

  let discord=null;
  try{
    if(action==='delete'&&removedJob){
      discord=await archiveColonizationJobDiscord(env,{
        job:removedJob,
        actor,
        controlUrl:colonizationControlUrlForRequest(request),
      });
    }else if(targetJob){
      discord=await syncColonizationJobDiscord(env,{
        job:targetJob,
        actor,
        controlUrl:colonizationControlUrlForRequest(request),
        createMissing:action==='create',
      });
    }
  }catch(error){
    console.error('Colonization Job saved but Discord sync failed',error);
    discord={feature:'colonization_job',configured:true,attempted:true,ok:false,mode:'failed',error:'discord_colonization_sync_failed'};
  }

  return reply({
    ok:true,
    jobs:saved.jobs,
    updatedAt:saved.updatedAt,
    updatedBy:saved.updatedBy,
    historyPublicationId:history.record.publicationId,
    historyState,
    discord,
    automaticRewardIssuance:false,
  });
}

async function requireSiteAdmin(request,env) {
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}

function colonizationControlUrlForRequest(request){
  const url=new URL('/wolf-bgs/',request.url);
  url.hash='colonization-jobs';
  return url.toString();
}

function validateJob(job) {
  if(!job.system)return'colonization_system_required';
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
