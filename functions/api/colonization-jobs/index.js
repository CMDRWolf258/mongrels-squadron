import { json, readSession } from '../../../lib/auth.js';
import { getAccount, getEvents, listFrontierAccounts, privateHeaders } from '../../../lib/frontier.js';
import {
  arbitrateColonizationContributions,
  buildColonizationJobsStore,
  colonizationJobPreview,
  normalizeColonizationJob,
  readColonizationJobs,
  writeColonizationJobsStore,
  writeColonizationJobStatusOverride,
} from '../../../lib/colonization-jobs.js';
import { listAllRewardEntries } from '../../../lib/reward-ledger.js';
import {
  ensureColonizationJobHistoryBaseline,
  markColonizationJobPublicationApplied,
  markColonizationJobPublicationFailed,
  prepareColonizationJobPublication,
} from '../../../lib/colonization-job-history.js';

const ALLOWED=new Set(['member','officer','site_admin']);
const MANAGERS=new Set(['officer','site_admin']);
const FUNDING_MODES=new Set(['none','member','squad']);

export async function onRequestGet({request,env}) {
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;

  const [store,frontierAccount,accounts,ledgerEntries]=await Promise.all([
    readColonizationJobs(env),
    getAccount(env,auth.session.sub),
    listFrontierAccounts(env),
    listAllRewardEntries(env),
  ]);
  try{await ensureColonizationJobHistoryBaseline(env,store,'Member Colonization Board');}
  catch(error){console.error('Could not initialize Colonization Job history baseline',error);}

  const memberRows=await Promise.all(accounts.map(async row=>({
    ownerId:row.userId,
    events:await getEvents(env,row.userId),
  })));
  const verification=memberRows.map(member=>({
    ...member,
    arbitration:arbitrateColonizationContributions(member.events,store.jobs),
  }));

  const jobs=store.jobs.map(job=>{
    const previews=verification.map(member=>colonizationJobPreview(job,member.events,member.arbitration))
      .filter(row=>row.tons>0||row.eventCount>0||row.ambiguousEventCount>0);
    const squadTons=previews.reduce((sum,row)=>sum+(Number(row.tons)||0),0);
    const contributorCount=previews.filter(row=>Number(row.tons)>0).length;
    const rewardPreviewMillions=round1(previews.reduce((sum,row)=>sum+(Number(row.rewardPreviewMillions)||0),0));
    const hasTrackedWork=previews.some(row=>(Number(row.tons)||0)>0||(Number(row.eventCount)||0)>0||(Number(row.ambiguousEventCount)||0)>0);
    const hasLedger=ledgerEntries.some(entry=>String(entry?.sourceJobId||'')===String(job.id||''));
    const fundingTermsLocked=hasTrackedWork||hasLedger||(Boolean(job.postingOwnerId)&&job.fundingMode==='squad'&&job.fundingApprovalStatus==='approved');
    return presentJob(job,auth.session,{
      squadTons,
      contributorCount,
      rewardPreviewMillions,
      ambiguousEvents:previews.reduce((sum,row)=>sum+(Number(row.ambiguousEventCount)||0),0),
      fundingTermsLocked,
    });
  });

  return reply({
    ok:true,
    viewer:{
      userId:auth.session.sub,
      displayName:auth.session.displayName||auth.session.username||'Mongrel Member',
      access:auth.session.access,
      commander:frontierAccount?.commander||'',
      frontierConnected:Boolean(frontierAccount?.commander),
    },
    canPost:true,
    canModerate:MANAGERS.has(auth.session.access),
    jobs,
    updatedAt:store.updatedAt||null,
    updatedBy:store.updatedBy||null,
  });
}

export async function onRequestPost({request,env}) {
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);
  if(!storageReady(env))return reply({ok:false,error:'colonization_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const store=await readColonizationJobs(env);
  const account=await getAccount(env,auth.session.sub);
  const actor=auth.session.displayName||auth.session.username||'Mongrel Member';
  const postingCommander=account?.commander||actor;
  const fundingMode=FUNDING_MODES.has(body?.job?.fundingMode)?body.job.fundingMode:'none';
  if(fundingMode==='member'&&!account?.commander){
    return reply({
      ok:false,
      error:'frontier_required_for_member_funding',
      message:'Connect your Elite account before posting a member-funded Colonization Job so the payer CMDR is verified.',
    },409);
  }

  const funding=normalizeFundingForCreate(body?.job||{},{
    fundingMode,
    ownerId:auth.session.sub,
    payerName:postingCommander,
    actor,
  });
  const job=normalizeColonizationJob({
    ...(body?.job||{}),
    ...funding,
    marketId:body?.job?.scope==='market'?'':undefined,
    postingOwnerId:auth.session.sub,
    postingOwnerName:actor,
    postingCommander,
    createdBy:actor,
    updatedBy:actor,
    startsAt:new Date().toISOString(),
    status:'active',
  });
  const validation=validateJob(job);
  if(validation)return reply({ok:false,error:validation},400);

  const jobs=[job,...store.jobs];
  const saved=await commitMutation(env,{before:store,jobs,actor,action:'create',targetJobId:job.id});
  return reply({ok:true,job:presentJob(job,auth.session),updatedAt:saved.updatedAt},201);
}

export async function onRequestPut({request,env}) {
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);
  if(!storageReady(env))return reply({ok:false,error:'colonization_storage_not_configured'},503);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}

  const action=clean(body?.action,30)||'update';
  const id=clean(body?.id||body?.job?.id,80);
  if(!id)return reply({ok:false,error:'colonization_job_id_required'},400);

  const store=await readColonizationJobs(env);
  const jobs=[...store.jobs];
  const index=jobs.findIndex(job=>String(job.id)===id);
  if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);

  const existing=jobs[index];
  const manager=MANAGERS.has(auth.session.access);
  const mine=String(existing.postingOwnerId||'')===String(auth.session.sub||'');
  if(!manager&&!mine)return reply({ok:false,error:'not_colonization_job_owner'},403);

  const actor=auth.session.displayName||auth.session.username||'Mongrel Member';
  let next=existing;

  if(action==='status'){
    const status=clean(body?.status,20);
    if(!['active','paused','completed'].includes(status))return reply({ok:false,error:'colonization_status_invalid'},400);
    const endsAt=status==='active'?null:(existing.endsAt||new Date().toISOString());
    next=normalizeColonizationJob({...existing,status,endsAt,updatedBy:actor},existing);
  }else if(action==='approve-funding'||action==='reject-funding'){
    if(!manager)return reply({ok:false,error:'colonization_funding_approval_required'},403);
    if(existing.fundingMode!=='squad')return reply({ok:false,error:'colonization_funding_not_squad'},409);
    const approved=action==='approve-funding';
    next=normalizeColonizationJob({
      ...existing,
      fundingApprovalStatus:approved?'approved':'rejected',
      fundingApprovedAt:approved?new Date().toISOString():null,
      fundingApprovedBy:actor,
      fundingNote:clean(body?.fundingNote,500),
      updatedBy:actor,
    },existing);
  }else if(action==='update'){
    const requested=body?.job&&typeof body.job==='object'?body.job:{};
    const requestedStatus=requested.status??existing.status;
    if(!['active','paused','completed'].includes(requestedStatus))return reply({ok:false,error:'colonization_status_invalid'},400);
    const statusChanged=requestedStatus!==existing.status;
    const merged={
      ...existing,
      title:requested.title??existing.title,
      targetTons:requested.targetTons??existing.targetTons,
      notes:requested.notes??existing.notes,
      status:requestedStatus,
      endsAt:statusChanged?(requestedStatus==='active'?null:(existing.endsAt||new Date().toISOString())):existing.endsAt,
      updatedBy:actor,
    };
    if(manager){
      merged.system=requested.system??existing.system;
      merged.scope=requested.scope??existing.scope;
      merged.marketId=requested.marketId??existing.marketId;
      merged.buildName=requested.buildName??existing.buildName;
      merged.commodity=requested.commodity??existing.commodity;
    }

    if(fundingFieldsRequested(requested)&&fundingDefinitionChanged(existing,requested)){
      const locked=await fundingTermsLocked(env,existing,store.jobs);
      if(locked){
        return reply({
          ok:false,
          error:'colonization_funding_terms_locked',
          message:'Reward settings are locked because verified hauling, an issued reward, or squad approval already exists for this job.',
        },409);
      }
      try{
        const funding=await normalizeFundingForEdit(env,requested,existing,{actor,session:auth.session});
        Object.assign(merged,funding);
      }catch(error){
        if(error?.code==='frontier_required_for_member_funding'){
          return reply({
            ok:false,
            error:'frontier_required_for_member_funding',
            message:'Connect the posting CMDR to Elite before changing this job to member-funded.',
          },409);
        }
        throw error;
      }
    }
    next=normalizeColonizationJob(merged,existing);
  }else{
    return reply({ok:false,error:'unsupported_action'},400);
  }

  const validation=action==='status'?'':validateJob(next);
  if(validation)return reply({ok:false,error:validation},400);
  const statusChanged=next.status!==existing.status;
  jobs[index]=next;
  const saved=await commitMutation(env,{before:store,jobs,actor,action:action==='status'?'status':'update',targetJobId:id});
  if(statusChanged){
    await writeColonizationJobStatusOverride(env,{
      jobId:id,
      status:next.status,
      endsAt:next.endsAt,
      actor,
      updatedAt:next.updatedAt,
    });
  }
  return reply({ok:true,job:presentJob(next,auth.session),updatedAt:saved.updatedAt});
}

export async function onRequestDelete({request,env}) {
  const auth=await requireMember(request,env);
  if(auth.response)return auth.response;
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);
  if(!MANAGERS.has(auth.session.access))return reply({ok:false,error:'colonization_moderator_required'},403);
  if(!storageReady(env))return reply({ok:false,error:'colonization_storage_not_configured'},503);
  const id=clean(new URL(request.url).searchParams.get('id'),80);
  const store=await readColonizationJobs(env);
  const jobs=[...store.jobs];
  const index=jobs.findIndex(job=>String(job.id)===id);
  if(index<0)return reply({ok:false,error:'colonization_job_not_found'},404);
  jobs.splice(index,1);
  const actor=auth.session.displayName||auth.session.username||'Mongrel Officer';
  const saved=await commitMutation(env,{before:store,jobs,actor,action:'delete',targetJobId:id});
  return reply({ok:true,updatedAt:saved.updatedAt});
}

function normalizeFundingForCreate(source,{fundingMode,ownerId,payerName,actor}){
  const blockTons=positiveInt(source.rewardBlockTons,5000);
  const blockMillions=fundingMode==='none'?0:nonNegative(source.rewardBlockMillions,0);
  const targetTons=nonNegativeInt(source.targetTons,0);
  const requestedBudget=nonNegative(source.rewardBudgetMillions,0);
  if(fundingMode==='none'){
    return {
      fundingMode:'none',
      fundingApprovalStatus:'not_required',
      rewardBlockTons:blockTons,
      rewardBlockMillions:0,
      rewardBudgetMillions:0,
      personalCapMillions:null,
      fundingPayerOwnerId:'',
      fundingPayerName:'',
      fundingApprovedAt:null,
      fundingApprovedBy:'',
    };
  }
  if(fundingMode==='member'){
    return {
      fundingMode:'member',
      fundingApprovalStatus:'approved',
      rewardBlockTons:blockTons,
      rewardBlockMillions:blockMillions,
      rewardBudgetMillions:requestedBudget,
      personalCapMillions:nullableNumber(source.personalCapMillions),
      fundingPayerOwnerId:ownerId,
      fundingPayerName:payerName,
      fundingApprovedAt:new Date().toISOString(),
      fundingApprovedBy:actor,
    };
  }
  return {
    fundingMode:'squad',
    fundingApprovalStatus:'pending',
    rewardBlockTons:blockTons,
    rewardBlockMillions:blockMillions,
    rewardBudgetMillions:requestedBudget,
    personalCapMillions:nullableNumber(source.personalCapMillions),
    fundingPayerOwnerId:'',
    fundingPayerName:'Regiment of Imperial Mongrels',
    fundingApprovedAt:null,
    fundingApprovedBy:'',
  };
}

function presentJob(job,session,progress={}){
  const manager=MANAGERS.has(session?.access);
  const mine=Boolean(job.postingOwnerId&&String(job.postingOwnerId)===String(session?.sub||''));
  const budget=Math.max(0,Number(job.rewardBudgetMillions)||0);
  const unlimitedBudget=job.fundingMode!=='none'&&budget<=0;
  const preview=Number(progress.rewardPreviewMillions)||0;
  return {
    id:job.id,
    revision:job.revision,
    title:job.title,
    system:job.system,
    scope:job.scope,
    marketId:job.marketId,
    buildName:job.buildName,
    commodity:job.commodity,
    targetTons:Number(job.targetTons)||0,
    rewardBlockTons:Number(job.rewardBlockTons)||0,
    rewardBlockMillions:Number(job.rewardBlockMillions)||0,
    personalCapMillions:job.personalCapMillions===null?null:Number(job.personalCapMillions),
    fundingMode:job.fundingMode||'squad',
    fundingApprovalStatus:job.fundingApprovalStatus||'approved',
    rewardBudgetMillions:budget,
    rewardBudgetUnlimited:unlimitedBudget,
    fundingPayerName:job.fundingPayerName||'',
    fundingNote:job.fundingNote||'',
    postingOwnerName:job.postingOwnerName||job.createdBy||'Mongrel Member',
    postingCommander:job.postingCommander||'',
    status:job.status,
    startsAt:job.startsAt,
    endsAt:job.endsAt,
    notes:job.notes,
    createdAt:job.createdAt,
    updatedAt:job.updatedAt,
    squadTons:Number(progress.squadTons)||0,
    contributorCount:Number(progress.contributorCount)||0,
    rewardPreviewMillions:round1(preview),
    remainingBudgetMillions:unlimitedBudget?null:round1(Math.max(0,budget-preview)),
    ambiguousEvents:Number(progress.ambiguousEvents)||0,
    isMine:mine,
    canEdit:mine||manager,
    canEditFunding:(mine||manager)&&!Boolean(progress.fundingTermsLocked),
    fundingTermsLocked:Boolean(progress.fundingTermsLocked),
    canModerate:manager,
    canApproveFunding:manager&&job.fundingMode==='squad'&&job.fundingApprovalStatus==='pending',
  };
}

function fundingFieldsRequested(source={}){
  return ['fundingMode','rewardBlockTons','rewardBlockMillions','rewardBudgetMillions','personalCapMillions']
    .some(key=>Object.prototype.hasOwnProperty.call(source,key));
}

function fundingDefinitionChanged(existing={},requested={}){
  const next={
    fundingMode:FUNDING_MODES.has(requested.fundingMode)?requested.fundingMode:existing.fundingMode,
    rewardBlockTons:Object.prototype.hasOwnProperty.call(requested,'rewardBlockTons')?Number(requested.rewardBlockTons):Number(existing.rewardBlockTons),
    rewardBlockMillions:Object.prototype.hasOwnProperty.call(requested,'rewardBlockMillions')?Number(requested.rewardBlockMillions):Number(existing.rewardBlockMillions),
    rewardBudgetMillions:Object.prototype.hasOwnProperty.call(requested,'rewardBudgetMillions')?Number(requested.rewardBudgetMillions):Number(existing.rewardBudgetMillions),
    personalCapMillions:Object.prototype.hasOwnProperty.call(requested,'personalCapMillions')
      ? (requested.personalCapMillions===null||requested.personalCapMillions===''?null:Number(requested.personalCapMillions))
      : (existing.personalCapMillions===null||existing.personalCapMillions===undefined?null:Number(existing.personalCapMillions)),
  };
  return String(next.fundingMode||'')!==String(existing.fundingMode||'')
    || next.rewardBlockTons!==Number(existing.rewardBlockTons)
    || next.rewardBlockMillions!==Number(existing.rewardBlockMillions)
    || next.rewardBudgetMillions!==Number(existing.rewardBudgetMillions)
    || next.personalCapMillions!==(existing.personalCapMillions===null||existing.personalCapMillions===undefined?null:Number(existing.personalCapMillions));
}

async function fundingTermsLocked(env,job,allJobs=[]){
  if(Boolean(job.postingOwnerId)&&job.fundingMode==='squad'&&job.fundingApprovalStatus==='approved')return true;
  const ledger=await listAllRewardEntries(env);
  if(ledger.some(entry=>String(entry?.sourceJobId||'')===String(job.id||'')))return true;
  const accounts=await listFrontierAccounts(env);
  for(const row of accounts){
    const events=await getEvents(env,row.userId);
    const arbitration=arbitrateColonizationContributions(events,allJobs);
    const preview=colonizationJobPreview(job,events,arbitration);
    if((Number(preview?.tons)||0)>0||(Number(preview?.eventCount)||0)>0||(Number(preview?.ambiguousEventCount)||0)>0)return true;
  }
  return false;
}

async function normalizeFundingForEdit(env,source,existing,{actor,session}){
  const fundingMode=FUNDING_MODES.has(source.fundingMode)?source.fundingMode:existing.fundingMode;
  const blockTons=positiveInt(source.rewardBlockTons,Number(existing.rewardBlockTons)||5000);
  const blockMillions=fundingMode==='none'?0:nonNegative(source.rewardBlockMillions,Number(existing.rewardBlockMillions)||0);
  const budget=fundingMode==='none'?0:nonNegative(source.rewardBudgetMillions,Number(existing.rewardBudgetMillions)||0);
  const personalCap=Object.prototype.hasOwnProperty.call(source,'personalCapMillions')
    ? nullableNumber(source.personalCapMillions)
    : existing.personalCapMillions;

  if(fundingMode==='none'){
    return {
      fundingMode:'none',
      fundingApprovalStatus:'not_required',
      rewardBlockTons:blockTons,
      rewardBlockMillions:0,
      rewardBudgetMillions:0,
      personalCapMillions:null,
      fundingPayerOwnerId:'',
      fundingPayerName:'',
      fundingApprovedAt:null,
      fundingApprovedBy:'',
      fundingNote:'',
    };
  }
  if(fundingMode==='member'){
    const payerOwnerId=existing.postingOwnerId||session.sub;
    const payerAccount=await getAccount(env,payerOwnerId);
    if(!payerAccount?.commander){
      const error=new Error('frontier_required_for_member_funding');
      error.code='frontier_required_for_member_funding';
      throw error;
    }
    return {
      fundingMode:'member',
      fundingApprovalStatus:'approved',
      rewardBlockTons:blockTons,
      rewardBlockMillions:blockMillions,
      rewardBudgetMillions:budget,
      personalCapMillions:personalCap,
      fundingPayerOwnerId:payerOwnerId,
      fundingPayerName:payerAccount.commander,
      fundingApprovedAt:new Date().toISOString(),
      fundingApprovedBy:actor,
      fundingNote:'',
    };
  }
  return {
    fundingMode:'squad',
    fundingApprovalStatus:'pending',
    rewardBlockTons:blockTons,
    rewardBlockMillions:blockMillions,
    rewardBudgetMillions:budget,
    personalCapMillions:personalCap,
    fundingPayerOwnerId:'',
    fundingPayerName:'Regiment of Imperial Mongrels',
    fundingApprovedAt:null,
    fundingApprovedBy:'',
    fundingNote:'',
  };
}

async function commitMutation(env,{before,jobs,actor,action,targetJobId}){
  await ensureColonizationJobHistoryBaseline(env,before,'Colonization Job board');
  const after=buildColonizationJobsStore(jobs,actor);
  const history=await prepareColonizationJobPublication(env,{before,after,actor,action,targetJobId});
  let saved;
  try{
    saved=await writeColonizationJobsStore(env,after);
  }catch(error){
    try{await markColonizationJobPublicationFailed(env,history,error);}catch(historyError){console.error('Could not mark failed member Colonization publication',historyError);}
    throw error;
  }
  try{await markColonizationJobPublicationApplied(env,history);}
  catch(error){console.error('Member Colonization Job changed but history finalization remained prepared',error);}
  return saved;
}

function validateJob(job){
  if(!job.system)return'colonization_system_required';
  if(job.fundingMode!=='none'&&!(Number(job.rewardBlockTons)>0))return'colonization_reward_block_required';
  if(job.fundingMode!=='none'&&!(Number(job.rewardBlockMillions)>0))return'colonization_reward_required';
  if(job.fundingMode!=='none'&&Number(job.rewardBudgetMillions)>0&&Number(job.rewardBudgetMillions)<Number(job.rewardBlockMillions))return'colonization_reward_budget_too_small';
  if(job.fundingMode==='member'&&!job.fundingPayerOwnerId)return'colonization_member_payer_required';
  return'';
}
async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED.has(session.access))return{response:reply({ok:false,error:'member_access_required'},403)};
  return{session};
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.put==='function')}
function sameOrigin(request){const origin=request.headers.get('Origin');return origin===new URL(request.url).origin&&request.headers.get('X-Mongrels-Request')==='colonization-post-editor'}
function clean(value,max){return String(value??'').trim().slice(0,max)}
function positiveInt(value,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?n:fallback}
function nonNegativeInt(value,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>=0?n:fallback}
function nonNegative(value,fallback){const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback}
function nullableNumber(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null}
function round1(value){return Math.round((Number(value)||0)*10)/10}
function reply(body,status=200){return json(body,{status,headers:privateHeaders()})}
