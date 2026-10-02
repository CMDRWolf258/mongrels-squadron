import { json } from '../../../lib/auth.js';
import { readScoutFacilityObservationPayload } from '../../../lib/scout-facility-observations.js';

export async function onRequestGet({request,env}){
  const systemId64=new URL(request.url).searchParams.get('systemId64')||'';
  if(!/^\d{1,32}$/.test(systemId64)){
    return json({ok:false,error:'invalid_system_id64'},{status:400,headers:headers(30)});
  }
  try{
    const payload=await readScoutFacilityObservationPayload(env,systemId64);
    return json(payload,{status:200,headers:headers(30)});
  }catch(error){
    const code=error?.message==='bgs_storage_not_configured'?'bgs_storage_not_configured':'facility_observations_unavailable';
    return json({ok:false,error:code},{status:code==='bgs_storage_not_configured'?503:500,headers:headers(30)});
  }
}

function headers(maxAge){
  return{
    'Cache-Control':`public, max-age=${maxAge}, s-maxage=${maxAge}`,
    'X-Content-Type-Options':'nosniff',
  };
}
