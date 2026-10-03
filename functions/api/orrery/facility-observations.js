import { json } from '../../../lib/auth.js';
import { readScoutFacilityObservationPayload } from '../../../lib/scout-facility-observations.js';
import { readScoutFacilityVisits } from '../../../lib/scout-facility-visits.js';
import { readFacilityHostOverridePayload } from '../../../lib/orrery-facility-host-overrides.js';

export async function onRequestGet({request,env}){
  const systemId64=new URL(request.url).searchParams.get('systemId64')||'';
  if(!/^\d{1,32}$/.test(systemId64)){
    return json({ok:false,error:'invalid_system_id64'},{status:400,headers:headers(5)});
  }
  try{
    const [payload,visits,overrides]=await Promise.all([
      readScoutFacilityObservationPayload(env,systemId64),
      readScoutFacilityVisits(env,systemId64),
      readFacilityHostOverridePayload(env,systemId64),
    ]);
    return json({
      ...payload,
      stationVisits:latestStationVisits(visits.visits),
      hostOverrides:overrides.overrides,
    },{status:200,headers:headers(5)});
  }catch(error){
    const code=error?.message==='bgs_storage_not_configured'?'bgs_storage_not_configured':'facility_observations_unavailable';
    return json({ok:false,error:code},{status:code==='bgs_storage_not_configured'?503:500,headers:headers(5)});
  }
}
function latestStationVisits(visits){
  const latest=new Map();
  for(const row of Array.isArray(visits)?visits:[]){
    const marketId=String(row?.marketId||'');
    if(!/^\d+$/.test(marketId))continue;
    if(!latest.has(marketId))latest.set(marketId,{
      marketId,
      stationName:String(row?.stationName||'').slice(0,180),
      stationType:String(row?.stationType||'').slice(0,80),
      observedAt:row?.observedAt||null,
    });
  }
  return [...latest.values()].slice(0,500);
}
function headers(maxAge){
  return{
    'Cache-Control':`public, max-age=${maxAge}, s-maxage=${maxAge}`,
    'X-Content-Type-Options':'nosniff',
  };
}
