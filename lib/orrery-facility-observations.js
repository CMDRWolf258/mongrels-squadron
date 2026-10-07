import { validateSystem } from './orrery-model.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const marketKey=value=>String(value??'').trim();
const bodyNameKey=value=>String(value||'').toLowerCase().replace(/\s+/g,'');
const FACILITY_KINDS=new Set(['station','settlement','installation','carrier']);
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

  const newestVisits=new Map();
  for(const raw of Array.isArray(payload.stationVisits)?payload.stationVisits:[]){
    const visit=normalizeVisitSummary(raw);
    if(!visit)continue;
    const current=newestVisits.get(visit.marketId);
    if(!current||Date.parse(visit.observedAt)>=Date.parse(current.observedAt))newestVisits.set(visit.marketId,visit);
  }

  const newestByMarket=new Map();
  for(const raw of payload.observations){
    const observation=normalizeObservation(raw);
    const current=newestByMarket.get(observation.marketId);
    if(!current||Date.parse(observation.observedAt)>=Date.parse(current.observedAt)){
      newestByMarket.set(observation.marketId,observation);
    }
  }

  let discovered=0,discoveredVerified=0,discoveredMobile=0;
  const locations=[...(system.locations||[])];
  const knownMarkets=new Set(locations.map(location=>marketKey(location.marketId)).filter(Boolean));
  const observedMarkets=new Set([...newestByMarket.keys(),...newestVisits.keys()]);
  for(const marketId of observedMarkets){
    if(knownMarkets.has(marketId))continue;
    const observation=newestByMarket.get(marketId)||null;
    const visit=newestVisits.get(marketId)||null;
    const discoveredLocation=materializeScoutFacility({marketId,observation,visit,bodiesByJournalId,bodiesByName});
    if(!discoveredLocation)continue;
    locations.push(discoveredLocation);
    knownMarkets.add(marketId);
    discovered++;
    if(discoveredLocation.positionObservation?.status==='verified')discoveredVerified++;
    if(discoveredLocation.positionObservation?.event==='MobileStationVisit')discoveredMobile++;
  }

  const facilitiesByMarketId=new Map();
  for(const location of locations){
    const key=marketKey(location.marketId);
    if(!key||!FACILITY_KINDS.has(location.kind))continue;
    const list=facilitiesByMarketId.get(key)||[];
    list.push(location);
    facilitiesByMarketId.set(key,list);
  }

  let applied=0;
  const upgradedLocations=locations.map(location=>{
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

  let nextSystem=validateSystem({...system,locations:upgradedLocations});
  const overrideResult=applyHostOverrides(nextSystem,payload.hostOverrides||[]);
  nextSystem=overrideResult.system;
  const visitHostResult=applyVisitHostPlacements(nextSystem,payload.stationVisits||[]);
  nextSystem=visitHostResult.system;
  const estimateResult=applyHostEstimates(nextSystem,payload.stationVisits||[]);
  nextSystem=estimateResult.system;
  const mobileResult=applyMobilePlacements(nextSystem,payload.stationVisits||[]);
  nextSystem=mobileResult.system;
  const carrierOverrideResult=applyCarrierPlacementOverrides(nextSystem,payload.hostOverrides||[]);
  nextSystem=carrierOverrideResult.system;

  return{
    system:nextSystem,
    applied:applied+discovered+overrideResult.applied+visitHostResult.applied+estimateResult.applied+mobileResult.applied+carrierOverrideResult.applied,
    verifiedApplied:applied+discoveredVerified+overrideResult.applied+visitHostResult.applied,
    estimatedApplied:estimateResult.applied,
    discoveredApplied:discovered,
    mobileApplied:mobileResult.applied+discoveredMobile+carrierOverrideResult.applied,
    manualMobileApplied:carrierOverrideResult.applied,
  };
}

export function applyVisitHostPlacements(system,stationVisits){
  validateSystem(system);
  const bodies=new Map(system.bodies.filter(body=>body.kind!=='barycentre'&&Number.isInteger(body.bodyId)).map(body=>[body.bodyId,body]));
  const byMarket=new Map();
  for(const raw of Array.isArray(stationVisits)?stationVisits:[]){
    const visit=normalizeVisitSummary(raw);
    if(!visit?.hostPlacement)continue;
    const current=byMarket.get(visit.marketId);
    if(!current||Date.parse(visit.hostPlacement.observedAt)>=Date.parse(current.hostPlacement.observedAt))byMarket.set(visit.marketId,visit);
  }
  let applied=0;
  const locations=(system.locations||[]).map(location=>{
    if(location.bodyId||finite(location.latitude)||finite(location.longitude)||location.kind==='carrier')return location;
    const visit=byMarket.get(marketKey(location.marketId));
    if(!visit)return location;
    const body=bodies.get(visit.hostPlacement.bodyJournalId);
    if(!body)return location;
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
        observedAt:visit.hostPlacement.observedAt,
        marketId:visit.marketId,
        bodyJournalId:body.bodyId,
        bodyName:visit.hostPlacement.bodyName||body.name,
        evidence:[...visit.hostPlacement.evidence],
      },
    };
  });
  return{system:validateSystem({...system,locations}),applied};
}

export function applyMobilePlacements(system,stationVisits){
  validateSystem(system);
  const bodies=new Map(system.bodies.filter(body=>body.kind!=='barycentre'&&Number.isInteger(body.bodyId)).map(body=>[body.bodyId,body]));
  const byMarket=new Map();
  for(const raw of Array.isArray(stationVisits)?stationVisits:[]){
    const visit=normalizeVisitSummary(raw);
    if(!visit||!isMobileStationType(visit.stationType))continue;
    const current=byMarket.get(visit.marketId);
    if(!current||Date.parse(visit.observedAt)>=Date.parse(current.observedAt))byMarket.set(visit.marketId,visit);
  }
  let applied=0;
  const locations=(system.locations||[]).map(location=>{
    const visit=byMarket.get(marketKey(location.marketId));
    if(!visit||!isMobileStationType(visit.stationType))return location;

    const observedBody=visit.mobilePlacement
      ?bodies.get(visit.mobilePlacement.bodyJournalId)
      :null;
    const distance=finite(visit.distanceToArrivalLs)?visit.distanceToArrivalLs:null;
    const estimate=!observedBody&&distance!==null
      ?estimateHostBody(system,{...location,type:visit.stationType||location.type,distanceToArrivalLs:distance})
      :null;
    const body=observedBody||estimate?.body||null;
    applied++;

    if(body){
      const observed=Boolean(observedBody);
      return{
        ...location,
        bodyId:body.id,
        distanceToArrivalLs:distance!==null?distance:location.distanceToArrivalLs,
        latitude:null,
        longitude:null,
        positionKnown:true,
        coordinatesKnown:false,
        positionObservation:observed?{
          source:'Mongrel Scout / EDMC',
          event:'MobileStationVisit',
          status:'observed',
          temporary:true,
          observedAt:visit.mobilePlacement.observedAt,
          marketId:visit.marketId,
          bodyJournalId:body.bodyId,
          bodyName:visit.mobilePlacement.bodyName||body.name,
          evidence:[...visit.mobilePlacement.evidence],
        }:{
          source:'Mongrel Scout geometric estimate',
          event:'MobileStationVisit',
          status:'estimated',
          temporary:true,
          confidence:'high',
          confidenceScore:estimate.confidenceScore,
          observedAt:visit.observedAt,
          marketId:visit.marketId,
          bodyJournalId:body.bodyId,
          bodyName:body.name,
          distanceDeltaLs:estimate.nearestDeltaLs,
          runnerUpDeltaLs:estimate.runnerUpDeltaLs,
          evidence:['recent_mobile_visit','arrival_distance'],
        },
      };
    }

    // A recent carrier visit is more authoritative than a dated imported host.
    // If Scout cannot resolve the current parent body, clear the stale association
    // instead of continuing to present it as the carrier's current location.
    return{
      ...location,
      bodyId:null,
      distanceToArrivalLs:distance!==null?distance:location.distanceToArrivalLs,
      latitude:null,
      longitude:null,
      positionKnown:false,
      coordinatesKnown:false,
      positionObservation:{
        source:'Mongrel Scout / EDMC',
        event:'MobileStationVisit',
        status:'unresolved',
        temporary:true,
        observedAt:visit.observedAt,
        marketId:visit.marketId,
        evidence:['recent_mobile_visit',...(distance!==null?['arrival_distance']:[])],
      },
    };
  });
  return{system:validateSystem({...system,locations}),applied};
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
  const rawStationDistance=location?.distanceToArrivalLs;
  if(rawStationDistance===null||rawStationDistance===undefined||rawStationDistance==='')return null;
  const stationDistance=Number(rawStationDistance);
  if(!finite(stationDistance)||stationDistance<0)return null;
  const typeText=String(location?.type||'').toLowerCase().replace(/\s+/g,'');
  const asteroidBase=typeText.includes('asteroid');
  const surfaceAt=Date.parse(location?.surfaceEvidence?.observedAt||'');
  const sourceAt=Date.parse(location?.sourceUpdatedAt||'');
  const freshNoSurfacePosition=location?.surfaceEvidence?.hasLatLong===false
    && Number.isFinite(surfaceAt)&&Number.isFinite(sourceAt)
    && Math.abs(sourceAt-surfaceAt)<=60*1000;
  const journalSurfaceButOrbital=typeText.includes('surfacestation')&&freshNoSurfacePosition;
  const asteroidLike=asteroidBase||journalSurfaceButOrbital;
  const candidates=(system.bodies||[])
    .filter(body=>body.kind!=='barycentre'&&finite(body.distanceToArrivalLs)&&Number.isInteger(body.bodyId))
    .filter(body=>!asteroidLike||(body.rings||[]).length>0)
    .map(body=>({body,delta:Math.abs(body.distanceToArrivalLs-stationDistance)}))
    .sort((a,b)=>a.delta-b.delta||a.body.bodyId-b.body.bodyId);
  if(candidates.length<2)return null;

  const nearest=candidates[0],runnerUp=candidates[1];
  const maxNearestDeltaLs=asteroidLike
    ? Math.min(8,Math.max(3,stationDistance*0.01))
    : Math.min(15,Math.max(2,stationDistance*0.005));
  const requiredGapLs=asteroidLike
    ? Math.min(25,Math.max(10,stationDistance*0.02))
    : Math.min(10,Math.max(2,stationDistance*0.002));
  const gap=runnerUp.delta-nearest.delta;
  const ratio=runnerUp.delta/Math.max(nearest.delta,0.25);
  const minimumRatio=asteroidLike?5:3;
  if(nearest.delta>maxNearestDeltaLs||gap<requiredGapLs||ratio<minimumRatio)return null;

  const absoluteScore=Math.max(0,1-nearest.delta/maxNearestDeltaLs);
  const ratioScore=Math.min(1,(ratio-1)/5);
  const gapScore=Math.min(1,gap/requiredGapLs);
  const confidenceScore=Math.round((
    asteroidLike
      ? absoluteScore*0.3+ratioScore*0.3+gapScore*0.4
      : absoluteScore*0.5+ratioScore*0.3+gapScore*0.2
  )*1000)/1000;
  if(confidenceScore<0.78)return null;
  return{
    body:nearest.body,
    confidenceScore,
    nearestDeltaLs:round3(nearest.delta),
    runnerUpDeltaLs:round3(runnerUp.delta),
  };
}

export function applyCarrierPlacementOverrides(system,hostOverrides){
  validateSystem(system);
  const byMarket=new Map();
  for(const raw of Array.isArray(hostOverrides)?hostOverrides:[]){
    if(raw?.placementMode!=='temporary_mobile')continue;
    const marketId=marketKey(raw.marketId);
    const bodyJournalId=Number(raw.bodyJournalId);
    const updatedAt=normalizeTime(raw.updatedAt);
    if(!/^\d+$/.test(marketId)||!Number.isInteger(bodyJournalId)||bodyJournalId<0||!updatedAt)continue;
    byMarket.set(marketId,{
      marketId,
      bodyJournalId,
      bodyName:String(raw.bodyName||'').trim().slice(0,180),
      updatedAt,
    });
  }
  const bodies=new Map(system.bodies.filter(body=>body.kind!=='barycentre'&&Number.isInteger(body.bodyId)).map(body=>[body.bodyId,body]));
  let applied=0;
  const locations=(system.locations||[]).map(location=>{
    if(location.kind!=='carrier')return location;
    const override=byMarket.get(marketKey(location.marketId));
    if(!override)return location;

    const scoutObservation=location.positionObservation;
    const scoutAt=Date.parse(scoutObservation?.observedAt||'');
    const overrideAt=Date.parse(override.updatedAt);
    const scoutIsBetter=scoutObservation?.event==='MobileStationVisit'
      && ['observed','estimated'].includes(String(scoutObservation.status||''))
      && Number.isFinite(scoutAt)&&Number.isFinite(overrideAt)
      && scoutAt>overrideAt;
    if(scoutIsBetter)return location;

    const body=bodies.get(override.bodyJournalId);
    if(!body)return location;
    if(override.bodyName&&bodyNameKey(override.bodyName)!==bodyNameKey(body.name)&&bodyNameKey(override.bodyName)!==bodyNameKey(body.shortName))return location;
    applied++;
    return{
      ...location,
      bodyId:body.id,
      latitude:null,
      longitude:null,
      positionKnown:true,
      coordinatesKnown:false,
      positionObservation:{
        source:'Mongrel Officer current placement',
        event:'MobileStationOverride',
        status:'confirmed',
        temporary:true,
        observedAt:override.updatedAt,
        marketId:override.marketId,
        bodyJournalId:body.bodyId,
        bodyName:body.name,
        evidence:['officer_current_placement'],
      },
    };
  });
  return{system:validateSystem({...system,locations}),applied};
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
    if(!override||override.placementMode==='temporary_mobile'||finite(location.latitude)||finite(location.longitude))return location;
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

function materializeScoutFacility({marketId,observation,visit,bodiesByJournalId,bodiesByName}){
  const name=String(visit?.stationName||observation?.facilityName||'').trim().slice(0,180);
  if(!name)return null;
  const stationType=String(visit?.stationType||'').trim().slice(0,80);
  const kind=inferFacilityKind(stationType,Boolean(observation&&!observation.hostOnly));
  const body=resolveObservedBody(observation,bodiesByJournalId,bodiesByName)
    || resolvePlacementBody(visit?.hostPlacement,bodiesByJournalId,bodiesByName)
    || resolvePlacementBody(visit?.mobilePlacement,bodiesByJournalId,bodiesByName);
  const exact=Boolean(observation&&!observation.hostOnly&&body);
  const observedAt=observation?.observedAt||visit?.observedAt||null;
  const positionObservation=exact?{
    source:'Mongrel Scout / EDMC',
    event:'ApproachSettlement',
    status:'verified',
    observedAt,
    marketId,
    bodyJournalId:body.bodyId,
    bodyName:observation.bodyName||body.name,
  }:observation?.hostOnly&&body?{
    source:'Mongrel Scout / EDMC',
    event:'StationHost',
    status:'verified',
    observedAt,
    marketId,
    bodyJournalId:body.bodyId,
    bodyName:observation.bodyName||body.name,
  }:visit?.hostPlacement&&body?{
    source:'Mongrel Scout / EDMC',
    event:'StationHost',
    status:'verified',
    observedAt:visit.hostPlacement.observedAt,
    marketId,
    bodyJournalId:body.bodyId,
    bodyName:visit.hostPlacement.bodyName||body.name,
    evidence:[...visit.hostPlacement.evidence],
  }:visit?.mobilePlacement&&body?{
    source:'Mongrel Scout / EDMC',
    event:'MobileStationVisit',
    status:'observed',
    temporary:true,
    observedAt:visit.mobilePlacement.observedAt,
    marketId,
    bodyJournalId:body.bodyId,
    bodyName:visit.mobilePlacement.bodyName||body.name,
    evidence:[...visit.mobilePlacement.evidence],
  }:null;
  return{
    id:`scout-facility-${marketId}`,
    name,
    kind,
    bodyId:body?.id||null,
    type:stationType||friendlyFacilityType(kind),
    distanceToArrivalLs:finite(visit?.distanceToArrivalLs)?visit.distanceToArrivalLs:null,
    surfaceEvidence:visit?.surfaceEvidence?{...visit.surfaceEvidence}:null,
    latitude:exact?observation.latitude:null,
    longitude:exact?observation.longitude:null,
    commodities:[],
    services:[],
    marketId:safeMarketId(marketId),
    positionKnown:Boolean(body),
    coordinatesKnown:exact,
    notes:'Observed by Mongrel Scout after the imported station snapshot. Placement reflects the best verified Scout evidence currently available.',
    source:{name:'Mongrel Scout / EDMC',reference:'Scout-observed facility'},
    sourceUpdatedAt:observedAt,
    discoveredByScout:true,
    ...(positionObservation?{positionObservation}:{}),
  };
}
function resolveObservedBody(observation,bodiesByJournalId,bodiesByName){
  if(!observation)return null;
  let body=Number.isInteger(observation.bodyJournalId)?bodiesByJournalId.get(observation.bodyJournalId):null;
  if(!body&&observation.bodyName){
    const matches=bodiesByName.get(bodyNameKey(observation.bodyName))||[];
    if(matches.length===1)body=matches[0];
  }
  if(body&&observation.bodyName&&![body.name,body.shortName].some(name=>bodyNameKey(name)===bodyNameKey(observation.bodyName)))return null;
  return body||null;
}
function resolvePlacementBody(placement,bodiesByJournalId,bodiesByName){
  if(!placement)return null;
  let body=Number.isInteger(placement.bodyJournalId)?bodiesByJournalId.get(placement.bodyJournalId):null;
  if(!body&&placement.bodyName){
    const matches=bodiesByName.get(bodyNameKey(placement.bodyName))||[];
    if(matches.length===1)body=matches[0];
  }
  return body||null;
}
function inferFacilityKind(stationType,exactSurface){
  const text=String(stationType||'').toLowerCase().replace(/\s+/g,'');
  if(text.includes('fleetcarrier'))return'carrier';
  if(exactSurface||text.includes('settlement'))return'settlement';
  if(text.includes('installation'))return'installation';
  return'station';
}
function friendlyFacilityType(kind){
  return kind==='carrier'?'Fleet Carrier':kind==='settlement'?'Settlement':kind==='installation'?'Installation':'Station';
}
function safeMarketId(value){
  const n=Number(value);
  return Number.isSafeInteger(n)?n:String(value);
}
function isMobileStationType(value){
  const text=String(value||'').toLowerCase().replace(/\s+/g,'');
  return text.includes('fleetcarrier')||text.includes('megaship');
}
function normalizeVisitSummary(raw){
  if(!raw||typeof raw!=='object')return null;
  const marketId=marketKey(raw.marketId);
  const observedAt=normalizeTime(raw.observedAt);
  const stationName=String(raw.stationName||'').trim().slice(0,180);
  const stationType=String(raw.stationType||'').trim().slice(0,80);
  const rawDistance=raw.distanceToArrivalLs;
  const distanceToArrivalLs=rawDistance===null||rawDistance===undefined||rawDistance===''?null:Number(rawDistance);
  if(distanceToArrivalLs!==null&&(!finite(distanceToArrivalLs)||distanceToArrivalLs<0))return null;
  if(!/^\d+$/.test(marketId)||!observedAt||!stationName)return null;
  let hostPlacement=null;
  if(raw.hostPlacement&&typeof raw.hostPlacement==='object'){
    const bodyJournalId=Number(raw.hostPlacement.bodyJournalId);
    const placementObservedAt=normalizeTime(raw.hostPlacement.observedAt);
    const bodyName=String(raw.hostPlacement.bodyName||'').trim().slice(0,180);
    const evidence=Array.isArray(raw.hostPlacement.evidence)?raw.hostPlacement.evidence.map(value=>String(value).slice(0,80)).slice(0,6):[];
    if(Number.isInteger(bodyJournalId)&&bodyJournalId>=0&&placementObservedAt){
      hostPlacement={bodyJournalId,bodyName,observedAt:placementObservedAt,evidence};
    }
  }
  let surfaceEvidence=null;
  if(raw.surfaceEvidence&&typeof raw.surfaceEvidence==='object'){
    const surfaceObservedAt=normalizeTime(raw.surfaceEvidence.observedAt);
    const hasLatLong=raw.surfaceEvidence.hasLatLong===true;
    const latitude=raw.surfaceEvidence.latitude==null?null:Number(raw.surfaceEvidence.latitude);
    const longitude=raw.surfaceEvidence.longitude==null?null:Number(raw.surfaceEvidence.longitude);
    const planetRadius=raw.surfaceEvidence.planetRadius==null?null:Number(raw.surfaceEvidence.planetRadius);
    if(surfaceObservedAt
      &&(!hasLatLong||(finite(latitude)&&Math.abs(latitude)<=90&&finite(longitude)&&Math.abs(longitude)<=180))
      &&(planetRadius===null||(finite(planetRadius)&&planetRadius>=0))){
      surfaceEvidence={hasLatLong,latitude,longitude,planetRadius,observedAt:surfaceObservedAt};
    }
  }
  let mobilePlacement=null;
  if(raw.mobilePlacement&&typeof raw.mobilePlacement==='object'){
    const bodyJournalId=Number(raw.mobilePlacement.bodyJournalId);
    const placementObservedAt=normalizeTime(raw.mobilePlacement.observedAt);
    const bodyName=String(raw.mobilePlacement.bodyName||'').trim().slice(0,180);
    const evidence=Array.isArray(raw.mobilePlacement.evidence)?raw.mobilePlacement.evidence.map(value=>String(value).slice(0,80)).slice(0,6):[];
    if(Number.isInteger(bodyJournalId)&&bodyJournalId>=0&&placementObservedAt){
      mobilePlacement={bodyJournalId,bodyName,observedAt:placementObservedAt,evidence};
    }
  }
  return{marketId,observedAt,stationName,stationType,distanceToArrivalLs,surfaceEvidence,hostPlacement,mobilePlacement};
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
  const facilityName=value.facilityName==null?'':String(value.facilityName).trim();
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
    facilityName:facilityName.slice(0,180),
    hostOnly,
    bodyJournalId,
    bodyName:bodyName.slice(0,180),
    latitude,
    longitude,
    observedAt:observed.toISOString(),
  };
}
