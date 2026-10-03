import { validateSystem } from './orrery-model.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const marketKey=value=>String(value??'').trim();
const bodyNameKey=value=>String(value||'').toLowerCase().replace(/\s+/g,'');
const SURFACE_FACILITY_KINDS=new Set(['station','settlement','installation']);
const HOST_ESTIMATE_KINDS=new Set(['station','settlement','installation']);

export function applyFacilityObservationPayload(system,payload){
  validateSystem(system);
  if(payload?.schemaVersion!==1||typeof payload.systemId64!=='string'||payload.systemId64!==String(system.id64)||!Array.isArray(payload.observations)){
    throw new Error('Facility observation system/schema mismatch');
  }

  const bodiesByJournalId=new Map();
  for(const body of system.bodies){
    if(body.kind==='barycentre'||!Number.isInteger(body.bodyId))continue;
    if(bodiesByJournalId.has(body.bodyId))throw new Error('Ambiguous journal body ID in Orrery system');
    bodiesByJournalId.set(body.bodyId,body);
  }

  const bodiesByName=new Map();
  for(const body of system.bodies){
    if(body.kind==='barycentre')continue;
    for(const name of [body.name,body.shortName]){
      const key=bodyNameKey(name);
      if(!key)continue;
      const list=bodiesByName.get(key)||[];
      list.push(body);
      bodiesByName.set(key,list);
    }
  }

  const facilitiesByMarketId=new Map();
  for(const location of system.locations||[]){
    const key=marketKey(location.marketId);
    if(!key||!SURFACE_FACILITY_KINDS.has(location.kind))continue;
    const list=facilitiesByMarketId.get(key)||[];
    list.push(location);
    facilitiesByMarketId.set(key,list);
  }

  const newestByMarket=new Map();
  for(const raw of payload.observations){
    const observation=normalizeObservation(raw);
    const current=newestByMarket.get(observation.marketId);
    if(!current||Date.parse(observation.observedAt)>=Date.parse(current.observedAt)){
      newestByMarket.set(observation.marketId,observation);
    }
  }

  let applied=0;
  const locations=(system.locations||[]).map(location=>{
    const key=marketKey(location.marketId);
    const matches=facilitiesByMarketId.get(key);
    const observation=newestByMarket.get(key);
    if(!observation||!matches||matches.length!==1||matches[0].id!==location.id)return location;

    // Existing exact source coordinates remain authoritative. Scout is an upgrade
    // path for schematic/unplaced facilities, not a way to silently overwrite them.
    if(finite(location.latitude)&&finite(location.longitude))return location;

    let body=Number.isInteger(observation.bodyJournalId)?bodiesByJournalId.get(observation.bodyJournalId):null;
    if(!body&&observation.bodyName){
      const byName=bodiesByName.get(bodyNameKey(observation.bodyName))||[];
      if(byName.length===1)body=byName[0];
    }
    if(!body)return location;
    if(observation.bodyName&&![body.name,body.shortName].some(name=>bodyNameKey(name)===bodyNameKey(observation.bodyName)))return location;
    if(location.bodyId&&location.bodyId!==body.id)return location;

    if(observation.hostOnly){
      if(location.bodyId===body.id)return location;
      applied++;
      return{
        ...location,
        bodyId:body.id,
        positionKnown:true,
        coordinatesKnown:false,
        positionObservation:{
          source:'Mongrel Scout / EDMC',
          event:'StationHost',
          status:'verified',
          observedAt:observation.observedAt,
          marketId:observation.marketId,
          bodyJournalId:observation.bodyJournalId,
          bodyName:observation.bodyName||body.name,
        },
      };
    }

    applied++;
    return{
      ...location,
      bodyId:body.id,
      latitude:observation.latitude,
      longitude:observation.longitude,
      positionKnown:true,
      coordinatesKnown:true,
      positionObservation:{
        source:'Mongrel Scout / EDMC',
        event:'ApproachSettlement',
        status:'verified',
        observedAt:observation.observedAt,
        marketId:observation.marketId,
        bodyJournalId:observation.bodyJournalId,
        bodyName:observation.bodyName||body.name,
      },
    };
  });

  let nextSystem=validateSystem({...system,locations});
  const overrideResult=applyHostOverrides(nextSystem,payload.hostOverrides||[]);
  nextSystem=overrideResult.system;
  const estimateResult=applyHostEstimates(nextSystem,payload.stationVisits||[]);
  nextSystem=estimateResult.system;

  return{
    system:nextSystem,
    applied:applied+overrideResult.applied+estimateResult.applied,
    verifiedApplied:applied+overrideResult.applied,
    estimatedApplied:estimateResult.applied,
  };
}

export function applyHostEstimates(system,stationVisits){
  validateSystem(system);
  const visited=new Map();
  for(const raw of Array.isArray(stationVisits)?stationVisits:[]){
    const marketId=marketKey(raw?.marketId);
    const observedAt=normalizeTime(raw?.observedAt);
    if(!/^\d+$/.test(marketId)||!observedAt)continue;
    const current=visited.get(marketId);
    if(!current||Date.parse(observedAt)>=Date.parse(current.observedAt)){
      visited.set(marketId,{marketId,observedAt,stationName:String(raw?.stationName||'').trim().slice(0,180)});
    }
  }

  let applied=0;
  const locations=(system.locations||[]).map(location=>{
    if(location.bodyId||finite(location.latitude)||finite(location.longitude)||!HOST_ESTIMATE_KINDS.has(location.kind))return location;
    const visit=visited.get(marketKey(location.marketId));
    if(!visit||!finite(location.distanceToArrivalLs))return location;
    const estimate=estimateHostBody(system,location);
    if(!estimate)return location;
    applied++;
    return{
      ...location,
      bodyId:estimate.body.id,
      positionKnown:true,
      coordinatesKnown:false,
      positionObservation:{
        source:'Mongrel Scout geometric estimate',
        event:'StationHostEstimate',
        status:'estimated',
        confidence:'high',
        confidenceScore:estimate.confidenceScore,
        observedAt:visit.observedAt,
        marketId:String(location.marketId),
        bodyJournalId:estimate.body.bodyId,
        bodyName:estimate.body.name,
        distanceDeltaLs:estimate.nearestDeltaLs,
        runnerUpDeltaLs:estimate.runnerUpDeltaLs,
      },
    };
  });
  return{system:validateSystem({...system,locations}),applied};
}

export function estimateHostBody(system,location){
  const stationDistance=Number(location?.distanceToArrivalLs);
  if(!finite(stationDistance)||stationDistance<0)return null;
  const candidates=(system.bodies||[])
    .filter(body=>body.kind!=='barycentre'&&finite(body.distanceToArrivalLs)&&Number.isInteger(body.bodyId))
    .map(body=>({body,delta:Math.abs(body.distanceToArrivalLs-stationDistance)}))
    .sort((a,b)=>a.delta-b.delta||a.body.bodyId-b.body.bodyId);
  if(candidates.length<2)return null;

  const nearest=candidates[0],runnerUp=candidates[1];
  const maxNearestDeltaLs=Math.min(15,Math.max(2,stationDistance*0.005));
  const requiredGapLs=Math.min(10,Math.max(2,stationDistance*0.002));
  const gap=runnerUp.delta-nearest.delta;
  const ratio=runnerUp.delta/Math.max(nearest.delta,0.25);
  if(nearest.delta>maxNearestDeltaLs||gap<requiredGapLs||ratio<3)return null;

  const absoluteScore=Math.max(0,1-nearest.delta/maxNearestDeltaLs);
  const ratioScore=Math.min(1,(ratio-1)/5);
  const gapScore=Math.min(1,gap/requiredGapLs);
  const confidenceScore=Math.round((absoluteScore*0.5+ratioScore*0.3+gapScore*0.2)*1000)/1000;
  if(confidenceScore<0.78)return null;
  return{
    body:nearest.body,
    confidenceScore,
    nearestDeltaLs:round3(nearest.delta),
    runnerUpDeltaLs:round3(runnerUp.delta),
  };
}

export function applyHostOverrides(system,hostOverrides){
  validateSystem(system);
  const byMarket=new Map();
  for(const raw of Array.isArray(hostOverrides)?hostOverrides:[]){
    const marketId=marketKey(raw?.marketId);
    const bodyJournalId=Number(raw?.bodyJournalId);
    const updatedAt=normalizeTime(raw?.updatedAt);
    if(!/^\d+$/.test(marketId)||!Number.isInteger(bodyJournalId)||bodyJournalId<0||!updatedAt)continue;
    byMarket.set(marketId,{marketId,bodyJournalId,bodyName:String(raw?.bodyName||'').trim().slice(0,180),updatedAt});
  }
  const bodies=new Map(system.bodies.filter(body=>body.kind!=='barycentre'&&Number.isInteger(body.bodyId)).map(body=>[body.bodyId,body]));
  let applied=0;
  const locations=(system.locations||[]).map(location=>{
    const override=byMarket.get(marketKey(location.marketId));
    if(!override||finite(location.latitude)||finite(location.longitude))return location;
    const body=bodies.get(override.bodyJournalId);
    if(!body)return location;
    if(override.bodyName&&bodyNameKey(override.bodyName)!==bodyNameKey(body.name)&&bodyNameKey(override.bodyName)!==bodyNameKey(body.shortName))return location;
    if(location.bodyId===body.id&&location.positionObservation?.event==='StationHostOverride')return location;
    applied++;
    return{
      ...location,
      bodyId:body.id,
      positionKnown:true,
      coordinatesKnown:false,
      positionObservation:{
        source:'Mongrel Officer confirmation',
        event:'StationHostOverride',
        status:'verified',
        observedAt:override.updatedAt,
        marketId:override.marketId,
        bodyJournalId:body.bodyId,
        bodyName:body.name,
      },
    };
  });
  return{system:validateSystem({...system,locations}),applied};
}

function round3(value){return Math.round(value*1000)/1000;}
function normalizeTime(value){const date=new Date(value||'');return Number.isFinite(date.getTime())?date.toISOString():null;}

export async function loadFacilityObservationProvider(system,url,{fetcher=fetch,signal}={}){
  const response=await fetcher(url,{signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Facility observation provider unavailable (${response.status})`);
  return applyFacilityObservationPayload(system,await response.json());
}

function normalizeObservation(value){
  if(!value||typeof value!=='object')throw new Error('Invalid facility observation');
  const marketId=marketKey(value.marketId);
  const hostOnly=value.hostOnly===true||String(value.event||'')==='StationHost';
  const bodyJournalId=value.bodyJournalId==null?null:Number(value.bodyJournalId);
  const latitude=hostOnly?null:Number(value.latitude);
  const longitude=hostOnly?null:Number(value.longitude);
  const observed=new Date(value.observedAt);
  const bodyName=value.bodyName==null?'':String(value.bodyName).trim();
  if(!/^\d+$/.test(marketId)||!Number.isFinite(observed.getTime())){
    throw new Error('Invalid facility observation');
  }
  if(bodyJournalId!==null&&(!Number.isInteger(bodyJournalId)||bodyJournalId<0))throw new Error('Invalid facility observation');
  if(hostOnly){
    if(bodyJournalId===null&&!bodyName)throw new Error('Invalid facility observation');
  }else if(bodyJournalId===null||!finite(latitude)||Math.abs(latitude)>90||!finite(longitude)||Math.abs(longitude)>180){
    throw new Error('Invalid facility observation');
  }
  return{
    marketId,
    hostOnly,
    bodyJournalId,
    bodyName:bodyName.slice(0,180),
    latitude,
    longitude,
    observedAt:observed.toISOString(),
  };
}
