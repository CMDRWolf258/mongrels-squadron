export const FACILITY_VISIT_KEY_PREFIX='orrery-facility-visits-v1:';
const MAX_VISITS_PER_SYSTEM=600;

export function normalizeScoutFacilityVisit(value){
  if(!value||typeof value!=='object')return null;
  const kind=String(value.kind||'').toLowerCase();
  const event=cleanText(value.event,'',40);
  if(kind!=='facility_visit'||!['DockingRequested','Docked'].includes(event))return null;

  const system=cleanText(value.systemName||value.system,'',140);
  const systemId64=decimalString(value.systemAddress);
  const stationName=cleanText(value.stationName||value.facilityName,'',180);
  const stationType=cleanText(value.stationType,'',80);
  const marketId=decimalString(value.marketId);
  const observedAt=normalizeTime(value.timestamp||value.observedAt);
  if(!system||!systemId64||!stationName||!marketId||!observedAt)return null;

  return{
    schemaVersion:1,
    event,
    system,
    systemId64,
    stationName,
    stationType,
    marketId,
    observedAt,
    destination:normalizeDestination(value.dashboard?.destination),
    lastDestination:normalizeDestination(value.dashboard?.lastDestination),
    dashboardBodyName:cleanText(value.dashboard?.bodyName,'',180),
    dashboardObservedAt:normalizeTime(value.dashboard?.timestamp),
    currentBody:normalizeBody(value.currentBody),
    journalBody:normalizeBody(value.journalBody),
    context:normalizeContext(value.context),
    source:'Mongrel Scout / EDMC',
  };
}

export function deriveStationHostCandidate(value){
  const visit=value?.schemaVersion===1?value:normalizeScoutFacilityVisit(value);
  if(!visit)return null;
  if(isMobileStationType(visit.stationType))return null;

  const destination=visit.destination;
  const current=visit.currentBody;
  if(!destination||!current)return null;
  if(norm(destination.name)!==norm(visit.stationName))return null;
  if(destination.bodyId===null||current.bodyId===null||destination.bodyId!==current.bodyId)return null;
  if(destination.systemId64&&destination.systemId64!==visit.systemId64)return null;
  if(!current.name||!current.bodyType||isStationBodyType(current.bodyType))return null;
  if(!visit.dashboardBodyName||norm(visit.dashboardBodyName)!==norm(current.name))return null;

  return{
    bodyJournalId:destination.bodyId,
    bodyName:current.name,
    evidence:['destination_body','edmc_current_body','dashboard_body_name'],
  };
}


export function diagnoseStationHostCandidate(value){
  const visit=value?.schemaVersion===1?value:normalizeScoutFacilityVisit(value);
  if(!visit)return{resolved:false,reason:'invalid_visit'};
  if(isMobileStationType(visit.stationType))return summary(visit,'mobile_station');

  const destination=visit.destination;
  const current=visit.currentBody;
  if(!destination)return summary(visit,'destination_missing');
  if(norm(destination.name)!==norm(visit.stationName))return summary(visit,'destination_name_mismatch');
  if(destination.bodyId===null)return summary(visit,'destination_body_missing');
  if(destination.systemId64&&destination.systemId64!==visit.systemId64)return summary(visit,'destination_system_mismatch');
  if(!current)return summary(visit,'current_body_missing');
  if(current.bodyId===null)return summary(visit,'current_body_id_missing');
  if(!current.bodyType)return summary(visit,'current_body_type_missing');
  if(isStationBodyType(current.bodyType))return summary(visit,'current_body_is_station');
  if(destination.bodyId!==current.bodyId)return summary(visit,'current_body_id_mismatch');
  if(!current.name)return summary(visit,'current_body_name_missing');
  if(!visit.dashboardBodyName)return summary(visit,'dashboard_body_missing');
  if(norm(visit.dashboardBodyName)!==norm(current.name))return summary(visit,'dashboard_body_name_mismatch');

  return{
    ...summary(visit,'verified_candidate'),
    resolved:true,
    candidate:{
      bodyJournalId:destination.bodyId,
      bodyName:current.name,
      evidence:['destination_body','edmc_current_body','dashboard_body_name'],
    },
  };
}

function summary(visit,reason){
  return{
    resolved:false,
    reason,
    observedAt:visit.observedAt,
    stationName:visit.stationName,
    stationType:visit.stationType,
    marketId:visit.marketId,
    system:visit.system,
    systemId64:visit.systemId64,
    destination:visit.destination?{
      name:visit.destination.name,
      bodyId:visit.destination.bodyId,
      systemId64:visit.destination.systemId64,
    }:null,
    lastDestination:visit.lastDestination?{
      name:visit.lastDestination.name,
      bodyId:visit.lastDestination.bodyId,
      systemId64:visit.lastDestination.systemId64,
      observedAt:visit.lastDestination.observedAt,
    }:null,
    currentBody:visit.currentBody,
    journalBody:visit.journalBody,
    dashboardBodyName:visit.dashboardBodyName,
    supercruiseExit:visit.context?.SupercruiseExit||null,
    approachBody:visit.context?.ApproachBody||null,
    leaveBody:visit.context?.LeaveBody||null,
  };
}

export async function recordScoutFacilityVisit(env,value){
  if(!storageReady(env))return{stored:false,error:'bgs_storage_not_configured'};
  const observation=normalizeScoutFacilityVisit(value);
  if(!observation)return{stored:false,error:'invalid_facility_visit'};
  if(Date.parse(observation.observedAt)>Date.now()+15*60*1000)return{stored:false,error:'journal_timestamp_in_future',observation};

  const key=storageKey(observation.systemId64);
  const state=await readState(env,key,observation.systemId64);
  const duplicate=state.visits.some(row=>
    row.marketId===observation.marketId&&
    row.event===observation.event&&
    row.observedAt===observation.observedAt
  );
  if(!duplicate){
    state.visits.push(observation);
    state.visits.sort((a,b)=>compareTime(b.observedAt,a.observedAt));
    state.visits=state.visits.slice(0,MAX_VISITS_PER_SYSTEM);
    await env.DAILY_ORDERS.put(key,JSON.stringify(state));
  }
  return{stored:!duplicate,duplicate,observation};
}

export async function readScoutFacilityVisits(env,systemId64){
  const normalized=decimalString(systemId64);
  if(!normalized)throw new Error('invalid_system_id64');
  if(!storageReady(env))throw new Error('bgs_storage_not_configured');
  const state=await readState(env,storageKey(normalized),normalized);
  return{
    schemaVersion:1,
    systemId64:normalized,
    visits:state.visits.map(row=>({...row})),
  };
}

function normalizeDestination(value){
  if(!value||typeof value!=='object')return null;
  const name=cleanText(value.name,'',180);
  const bodyId=optionalInteger(value.bodyId,0,100000);
  const systemId64=decimalString(value.systemAddress);
  const observedAt=normalizeTime(value.observedAt);
  if(!name&&bodyId===null&&!systemId64)return null;
  return{name,bodyId,systemId64,observedAt};
}

function normalizeBody(value){
  if(!value||typeof value!=='object')return null;
  const name=cleanText(value.name,'',180);
  const bodyId=optionalInteger(value.bodyId,0,100000);
  const bodyType=cleanText(value.bodyType,'',80);
  if(!name&&bodyId===null&&!bodyType)return null;
  return{name,bodyId,bodyType};
}

function normalizeContext(value){
  if(!value||typeof value!=='object')return{};
  const out={};
  for(const key of ['ApproachBody','LeaveBody','SupercruiseEntry','SupercruiseExit']){
    const row=value[key];
    if(!row||typeof row!=='object')continue;
    out[key]={
      event:key,
      timestamp:normalizeTime(row.timestamp),
      system:cleanText(row.system,'',140),
      systemId64:decimalString(row.systemAddress),
      bodyName:cleanText(row.bodyName,'',180),
      bodyId:optionalInteger(row.bodyId,0,100000),
      bodyType:cleanText(row.bodyType,'',80),
    };
  }
  return out;
}

function isMobileStationType(value){
  const text=norm(value);
  return text.includes('fleetcarrier')||text.includes('fleet carrier')||text.includes('megaship');
}
function isStationBodyType(value){
  const text=norm(value);
  return text.includes('station')||text.includes('carrier')||text.includes('megaship');
}
async function readState(env,key,systemId64){
  try{
    const stored=await env.DAILY_ORDERS.get(key,{type:'json'});
    if(stored&&stored.schemaVersion===1&&stored.systemId64===systemId64&&Array.isArray(stored.visits)){
      return{schemaVersion:1,systemId64,visits:[...stored.visits]};
    }
  }catch(error){
    console.error('Could not read Scout facility visits',error);
  }
  return{schemaVersion:1,systemId64,visits:[]};
}
function storageKey(systemId64){return FACILITY_VISIT_KEY_PREFIX+systemId64;}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function');}
function compareTime(a,b){
  const aa=Date.parse(a||''),bb=Date.parse(b||'');
  return(Number.isFinite(aa)?aa:0)-(Number.isFinite(bb)?bb:0);
}
function normalizeTime(value){
  if(!value)return null;
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():null;
}
function decimalString(value){
  if(value===null||value===undefined||value==='')return null;
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||value<0)return null;
    return String(value);
  }
  const text=String(value).trim();
  return /^\d{1,32}$/.test(text)?text:null;
}
function optionalInteger(value,min,max){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>=min&&n<=max?n:null;
}
function cleanText(value,fallback,maxLength){
  if(typeof value!=='string')return fallback;
  const text=value.trim();
  return text?text.slice(0,maxLength):fallback;
}
function norm(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
