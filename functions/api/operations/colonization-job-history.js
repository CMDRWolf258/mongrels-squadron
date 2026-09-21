import { json, readSession } from '../../../lib/auth.js';
import { readColonizationJobs } from '../../../lib/colonization-jobs.js';
import {
  ensureColonizationJobHistoryBaseline,
  listColonizationJobPublications,
} from '../../../lib/colonization-job-history.js';

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(session.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);

  const url=new URL(request.url);
  const limit=Math.max(1,Math.min(100,Math.floor(Number(url.searchParams.get('limit'))||40)));
  const jobId=String(url.searchParams.get('jobId')||'').trim().slice(0,80);

  const store=await readColonizationJobs(env);
  try{
    await ensureColonizationJobHistoryBaseline(env,store);
  }catch(error){
    console.error('Could not initialize Colonization Job history baseline',error);
  }

  const records=await listColonizationJobPublications(env,{limit,jobId});
  const summary={
    recordCount:records.length,
    appliedCount:records.filter(row=>row.state==='applied').length,
    preparedCount:records.filter(row=>row.state==='prepared').length,
    failedCount:records.filter(row=>row.state==='failed').length,
    baselineCount:records.filter(row=>row.action==='baseline').length,
    added:records.reduce((sum,row)=>sum+Number(row?.changes?.counts?.added||0),0),
    revised:records.reduce((sum,row)=>sum+Number(row?.changes?.counts?.revised||0),0),
    removed:records.reduce((sum,row)=>sum+Number(row?.changes?.counts?.removed||0),0),
  };

  return reply({
    ok:true,
    records,
    summary,
    archivalMode:'write-ahead',
    immutablePayload:true,
    revisionedJobs:true,
    automaticRewardIssuance:false,
  });
}

function reply(body,status=200){
  return json(body,{
    status,
    headers:{
      'Cache-Control':'private, no-store, no-cache, must-revalidate',
      Pragma:'no-cache',
      Vary:'Cookie',
      'X-Content-Type-Options':'nosniff',
    },
  });
}
