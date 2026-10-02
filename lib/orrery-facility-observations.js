import { validateSystem } from './orrery-model.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const marketKey=value=>String(value??'').trim();
const bodyNameKey=value=>String(value||'').toLowerCase().replace(/\s+/g,'');
const SURFACE_FACILITY_KINDS=new Set(['station','settlement','installation']);

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

    const body=bodiesByJournalId.get(observation.bodyJournalId);
    if(!body)return location;
    if(observation.bodyName&&![body.name,body.shortName].some(name=>bodyNameKey(name)===bodyNameKey(observation.bodyName)))return location;
    if(location.bodyId&&location.bodyId!==body.id)return location;

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
        observedAt:observation.observedAt,
        marketId:observation.marketId,
        bodyJournalId:observation.bodyJournalId,
        bodyName:observation.bodyName||body.name,
      },
    };
  });

  return{
    system:validateSystem({...system,locations}),
    applied,
  };
}

export async function loadFacilityObservationProvider(system,url,{fetcher=fetch,signal}={}){
  const response=await fetcher(url,{signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Facility observation provider unavailable (${response.status})`);
  return applyFacilityObservationPayload(system,await response.json());
}

function normalizeObservation(value){
  if(!value||typeof value!=='object')throw new Error('Invalid facility observation');
  const marketId=marketKey(value.marketId);
  const bodyJournalId=Number(value.bodyJournalId);
  const latitude=Number(value.latitude);
  const longitude=Number(value.longitude);
  const observed=new Date(value.observedAt);
  const bodyName=value.bodyName==null?'':String(value.bodyName).trim();
  if(!/^\d+$/.test(marketId)||!Number.isInteger(bodyJournalId)||bodyJournalId<0||!finite(latitude)||Math.abs(latitude)>90||!finite(longitude)||Math.abs(longitude)>180||!Number.isFinite(observed.getTime())){
    throw new Error('Invalid facility observation');
  }
  return{
    marketId,
    bodyJournalId,
    bodyName:bodyName.slice(0,180),
    latitude,
    longitude,
    observedAt:observed.toISOString(),
  };
}
