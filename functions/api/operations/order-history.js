import { json, readSession } from '../../../lib/auth.js';
import { ensureOrderHistoryBaseline, listOrderPublications } from '../../../lib/order-history.js';
import { readCurrentOrderCycle } from '../../../lib/order-activity.js';

export async function onRequestGet({request,env}) {
  const session=await readSession(request,env);
  if(!session)return reply({ok:false,error:'authentication_required'},401);
  if(session.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);

  const url=new URL(request.url);
  const limit=Math.max(1,Math.min(100,Math.floor(Number(url.searchParams.get('limit'))||40)));
  const cycleId=String(url.searchParams.get('cycleId')||'').trim().slice(0,100);
  let records=await listOrderPublications(env,{limit,cycleId});
  const current=await readCurrentOrderCycle(env);
  if(current?.cycleId&&(!cycleId||cycleId===current.cycleId)){
    try{
      const baseline=await ensureOrderHistoryBaseline(env,current,records,'Daily Order History migration');
      if(baseline){
        records=[baseline,...records]
          .sort((a,b)=>String(b.appliedAt||b.preparedAt||'').localeCompare(String(a.appliedAt||a.preparedAt||'')))
          .slice(0,limit);
      }
    }catch(error){
      console.error('Could not initialize Daily Order history baseline',error);
    }
  }

  const summary={
    recordCount:records.length,
    appliedCount:records.filter(row=>row.state==='applied').length,
    preparedCount:records.filter(row=>row.state==='prepared').length,
    failedCount:records.filter(row=>row.state==='failed').length,
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
    legacyBaselineSupported:true,
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
