import { json } from '../../../lib/auth.js';
import { diagnoseStationHostCandidate, readScoutFacilityVisits } from '../../../lib/scout-facility-visits.js';

export async function onRequestGet({request,env}){
  const url=new URL(request.url);
  const systemId64=url.searchParams.get('systemId64')||'';
  const marketId=url.searchParams.get('marketId')||'';
  if(!/^\d{1,32}$/.test(systemId64)||!/^\d{1,32}$/.test(marketId)){
    return json({ok:false,error:'invalid_station_diagnostic_request'},{status:400,headers:noStore()});
  }
  try{
    const payload=await readScoutFacilityVisits(env,systemId64);
    const visit=payload.visits.find(row=>String(row.marketId)===marketId);
    if(!visit)return json({ok:true,found:false,systemId64,marketId},{status:200,headers:noStore()});
    return json({
      ok:true,
      found:true,
      diagnostic:diagnoseStationHostCandidate(visit),
    },{status:200,headers:noStore()});
  }catch(error){
    const code=error?.message==='bgs_storage_not_configured'?'bgs_storage_not_configured':'station_diagnostic_unavailable';
    return json({ok:false,error:code},{status:code==='bgs_storage_not_configured'?503:500,headers:noStore()});
  }
}
function noStore(){
  return{
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
  };
}
