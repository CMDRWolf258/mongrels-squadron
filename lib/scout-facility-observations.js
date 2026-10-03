export const FACILITY_OBSERVATION_KEY_PREFIX='orrery-facility-observations-v1:';
const MAX_OBSERVATIONS_PER_SYSTEM=500;

export function normalizeScoutFacilityObservation(value){
  if(!value||typeof value!=='object')return null;
  const event=String(value.event||'');
  const kind=String(value.kind||'').toLowerCase();
  const hostOnly=event==='StationHost'||kind==='facility_host';
  if(event!=='ApproachSettlement'&&!hostOnly)return null;

  const system=cleanText(value.systemName||value.system,'',140);
  const systemId64=decimalString(value.systemAddress);
  const marketId=decimalString(value.marketId);
  const bodyJournalId=optionalInteger(value.bodyId??value.bodyJournalId,0,100000);
  const facilityName=cleanText(value.facilityName||value.name,'',180);
  const bodyName=cleanText(value.bodyName,'',180);
  const latitude=hostOnly?null:finiteNumber(value.latitude,-90,90);
  const longitude=hostOnly?null:finiteNumber(value.longitude,-180,180);
  const observedAt=normalizeTime(value.timestamp||value.observedAt);

  if(!system||!systemId64||!marketId||!facilityName||!observedAt)return null;
  if(hostOnly){
    if(bodyJournalId===null&&!bodyName)return null;
  }else if(bodyJournalId===null||latitude===null||longitude===null){
    return null;
  }

  return{
    schemaVersion:1,
    event:hostOnly?'StationHost':'ApproachSettlement',
    hostOnly,
    system,
    systemId64,
    facilityName,
    marketId,
    bodyJournalId,
    bodyName,
    latitude,
    longitude,
    observedAt,
    source:'Mongrel Scout / EDMC',
  };
}

export async function recordScoutFacilityObservation(env,value){
  if(!storageReady(env))return{stored:false,error:'bgs_storage_not_configured'};
  const observation=normalizeScoutFacilityObservation(value);
  if(!observation)return{stored:false,error:'invalid_facility_observation'};
  if(Date.parse(observation.observedAt)>Date.now()+15*60*1000)return{stored:false,error:'journal_timestamp_in_future',observation};

  const key=storageKey(observation.systemId64);
  const state=await readState(env,key,observation.systemId64);
  const current=state.observations[observation.marketId];
  const currentExact=Boolean(current&&current.hostOnly!==true&&current.latitude!=null&&current.longitude!=null);
  const nextExact=observation.hostOnly!==true&&observation.latitude!=null&&observation.longitude!=null;
  const stored=!current
    || (nextExact&&!currentExact)
    || (nextExact===currentExact&&compareTime(observation.observedAt,current.observedAt)>=0);
  if(stored){
    state.observations[observation.marketId]=observation;
    trimState(state);
    await env.DAILY_ORDERS.put(key,JSON.stringify(state));
  }
  return{stored,observation:stored?observation:current};
}

export async function readScoutFacilityObservationPayload(env,systemId64){
  const normalized=decimalString(systemId64);
  if(!normalized)throw new Error('invalid_system_id64');
  if(!storageReady(env))throw new Error('bgs_storage_not_configured');
  const state=await readState(env,storageKey(normalized),normalized);
  return{
    schemaVersion:1,
    systemId64:normalized,
    observations:Object.values(state.observations)
      .map(publicObservation)
      .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)),
  };
}

function publicObservation(value){
  return{
    event:value.hostOnly===true?'StationHost':'ApproachSettlement',
    hostOnly:value.hostOnly===true,
    marketId:String(value.marketId),
    facilityName:cleanText(value.facilityName,'',180),
    bodyJournalId:value.bodyJournalId,
    bodyName:cleanText(value.bodyName,'',180),
    latitude:value.latitude,
    longitude:value.longitude,
    observedAt:value.observedAt,
    source:'Mongrel Scout / EDMC',
  };
}

async function readState(env,key,systemId64){
  try{
    const stored=await env.DAILY_ORDERS.get(key,{type:'json'});
    if(stored&&stored.schemaVersion===1&&stored.systemId64===systemId64&&stored.observations&&typeof stored.observations==='object'){
      return{schemaVersion:1,systemId64,observations:{...stored.observations}};
    }
  }catch(error){
    console.error('Could not read Scout facility observations',error);
  }
  return{schemaVersion:1,systemId64,observations:{}};
}

function trimState(state){
  const entries=Object.entries(state.observations);
  if(entries.length<=MAX_OBSERVATIONS_PER_SYSTEM)return;
  entries.sort((a,b)=>compareTime(b[1]?.observedAt,a[1]?.observedAt));
  state.observations=Object.fromEntries(entries.slice(0,MAX_OBSERVATIONS_PER_SYSTEM));
}

function storageKey(systemId64){return FACILITY_OBSERVATION_KEY_PREFIX+systemId64;}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function');}
function compareTime(a,b){
  const aa=Date.parse(a||''),bb=Date.parse(b||'');
  return(Number.isFinite(aa)?aa:0)-(Number.isFinite(bb)?bb:0);
}
function normalizeTime(value){
  const date=new Date(value||'');
  return Number.isFinite(date.getTime())?date.toISOString():null;
}
function decimalString(value){
  if(typeof value==='number'){
    if(!Number.isSafeInteger(value)||value<0)return null;
    return String(value);
  }
  const text=String(value??'').trim();
  return /^\d{1,32}$/.test(text)?text:null;
}
function integer(value,min,max){
  const n=Number(value);
  return Number.isInteger(n)&&n>=min&&n<=max?n:null;
}
function optionalInteger(value,min,max){
  if(value===null||value===undefined||value==='')return null;
  return integer(value,min,max);
}
function finiteNumber(value,min,max){
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
function cleanText(value,fallback,maxLength){
  if(typeof value!=='string')return fallback;
  const text=value.trim();
  return text?text.slice(0,maxLength):fallback;
}
