import { json } from '../../../lib/auth.js';
import { readScoutFacilityObservationPayload } from '../../../lib/scout-facility-observations.js';
import { readScoutFacilityVisits, deriveStationHostCandidate, deriveMobileStationPlacement } from '../../../lib/scout-facility-visits.js';
import { readFacilityHostOverridePayload } from '../../../lib/orrery-facility-host-overrides.js';

const PRODUCTION_HOST='mongrels-squadron.pages.dev';

export async function onRequestGet({request,env}){
  const requestUrl=new URL(request.url);
  const systemId64=requestUrl.searchParams.get('systemId64')||'';
  if(!/^\d{1,32}$/.test(systemId64)){
    return json({ok:false,error:'invalid_system_id64'},{status:400,headers:headers(5)});
  }
  if(isPagesPreview(requestUrl.hostname)){
    try{
      const productionUrl=new URL('/api/orrery/facility-observations',`https://${PRODUCTION_HOST}`);
      productionUrl.searchParams.set('systemId64',systemId64);
      const upstream=await fetch(productionUrl.toString(),{headers:{Accept:'application/json'}});
      if(upstream.ok){
        const productionPayload=await upstream.json();
        let previewOverrides=[];
        try{
          previewOverrides=(await readFacilityHostOverridePayload(env,systemId64)).overrides||[];
        }catch{}
        const hostOverrides=mergeHostOverrides(productionPayload.hostOverrides||[],previewOverrides);
        return json({
          ...productionPayload,
          hostOverrides,
        },{
          status:upstream.status,
          headers:{
            ...headers(5),
            'X-Orrery-Observation-Source':previewOverrides.length?'production+preview-overrides':'production',
          },
        });
      }
    }catch(error){
      console.error('Could not proxy production Orrery observations into preview',error);
    }
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
function mergeHostOverrides(production,preview){
  const byMarket=new Map();
  for(const row of [...production,...preview]){
    const marketId=String(row?.marketId||'');
    if(!/^\d+$/.test(marketId))continue;
    const current=byMarket.get(marketId);
    const rowTime=Date.parse(row?.updatedAt||''),currentTime=Date.parse(current?.updatedAt||'');
    if(!current||(!Number.isFinite(currentTime)&&Number.isFinite(rowTime))||(Number.isFinite(rowTime)&&rowTime>=currentTime)){
      byMarket.set(marketId,row);
    }
  }
  return [...byMarket.values()];
}

export function latestStationVisits(visits){
  const latest=new Map();
  const hostPlacements=new Map();
  const mobilePlacements=new Map();
  const distances=new Map();
  const stationTypes=new Map();
  const surfaceEvidence=new Map();
  for(const row of Array.isArray(visits)?visits:[]){
    const marketId=String(row?.marketId||'');
    if(!/^\d+$/.test(marketId))continue;
    if(!latest.has(marketId))latest.set(marketId,{
      marketId,
      stationName:String(row?.stationName||'').slice(0,180),
      stationType:String(row?.stationType||'').slice(0,80),
      observedAt:row?.observedAt||null,
      distanceToArrivalLs:finiteDistance(row?.distanceToArrivalLs),
    });
    if(row?.surfaceEvidence&&!surfaceEvidence.has(marketId)){
      surfaceEvidence.set(marketId,{
        hasLatLong:row.surfaceEvidence.hasLatLong===true,
        latitude:finiteOptional(row.surfaceEvidence.latitude),
        longitude:finiteOptional(row.surfaceEvidence.longitude),
        planetRadius:finiteOptional(row.surfaceEvidence.planetRadius),
        observedAt:row.surfaceEvidence.observedAt||row?.observedAt||null,
      });
    }
    const stationType=String(row?.stationType||'').trim().slice(0,80);
    if(stationType&&!stationTypes.has(marketId)){
      stationTypes.set(marketId,{value:stationType,observedAt:row?.observedAt||null});
    }
    const distance=finiteDistance(row?.distanceToArrivalLs);
    if(distance!==null&&!distances.has(marketId)){
      distances.set(marketId,{value:distance,observedAt:row?.observedAt||null});
    }
    if(!hostPlacements.has(marketId)){
      const placement=deriveStationHostCandidate(row);
      if(placement)hostPlacements.set(marketId,{
        bodyJournalId:placement.bodyJournalId,
        bodyName:String(placement.bodyName||'').slice(0,180),
        observedAt:row?.observedAt||null,
        evidence:[...placement.evidence],
      });
    }
    if(!mobilePlacements.has(marketId)){
      const placement=deriveMobileStationPlacement(row);
      if(placement)mobilePlacements.set(marketId,{
        bodyJournalId:placement.bodyJournalId,
        bodyName:String(placement.bodyName||'').slice(0,180),
        observedAt:row?.observedAt||null,
        evidence:[...placement.evidence],
      });
    }
  }
  return [...latest.values()].slice(0,500).map(row=>{
    const placement=mobilePlacements.get(row.marketId);
    const latestMs=Date.parse(row.observedAt||''),placementMs=Date.parse(placement?.observedAt||'');
    const placementIsCurrent=placement&&Number.isFinite(latestMs)&&Number.isFinite(placementMs)
      && placementMs<=latestMs+60*1000
      && latestMs-placementMs<=10*60*1000;
    const distance=distances.get(row.marketId);
    const stationType=stationTypes.get(row.marketId);
    const surface=surfaceEvidence.get(row.marketId);
    return{
      ...row,
      ...(surface?{surfaceEvidence:surface}:{}),
      ...(stationType?{stationType:stationType.value,stationTypeObservedAt:stationType.observedAt}:{}),
      ...(distance?{distanceToArrivalLs:distance.value,distanceObservedAt:distance.observedAt}:{}),
      ...(hostPlacements.has(row.marketId)?{hostPlacement:hostPlacements.get(row.marketId)}:{}),
      ...(placementIsCurrent?{mobilePlacement:placement}:{}),
    };
  });
}
function finiteOptional(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function finiteDistance(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?number:null;
}
function isPagesPreview(hostname){
  const host=String(hostname||'').toLowerCase();
  return host!==PRODUCTION_HOST&&host.endsWith('.mongrels-squadron.pages.dev');
}
function headers(maxAge){
  return{
    'Cache-Control':`public, max-age=${maxAge}, s-maxage=${maxAge}`,
    'X-Content-Type-Options':'nosniff',
  };
}
