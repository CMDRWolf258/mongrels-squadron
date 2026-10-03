export const FACILITY_HOST_OVERRIDE_KEY_PREFIX='orrery-facility-host-overrides-v1:';
const MAX_OVERRIDES_PER_SYSTEM=500;

export function normalizeFacilityHostOverride(value,fixed={}){
  if(!value||typeof value!=='object')return null;
  const systemId64=decimalString(value.systemId64??value.systemAddress);
  const marketId=decimalString(value.marketId);
  const bodyJournalId=integer(value.bodyJournalId??value.bodyId,0,100000);
  const facilityName=cleanText(value.facilityName||value.stationName,'',180);
  const bodyName=cleanText(value.bodyName,'',180);
  const updatedAt=normalizeTime(fixed.updatedAt||value.updatedAt)||new Date().toISOString();
  const updatedBy=cleanText(fixed.updatedBy||value.updatedBy,'Mongrel Officer',120);
  if(!systemId64||!marketId||bodyJournalId===null||!facilityName)return null;
  return{
    schemaVersion:1,
    systemId64,
    marketId,
    facilityName,
    bodyJournalId,
    bodyName,
    updatedAt,
    updatedBy,
    source:'Mongrel Officer confirmation',
  };
}

export async function recordFacilityHostOverride(env,value,fixed={}){
  if(!storageReady(env))return{stored:false,error:'bgs_storage_not_configured'};
  const override=normalizeFacilityHostOverride(value,fixed);
  if(!override)return{stored:false,error:'invalid_facility_host_override'};
  const key=storageKey(override.systemId64);
  const state=await readState(env,key,override.systemId64);
  state.overrides[override.marketId]=override;
  trimState(state);
  await env.DAILY_ORDERS.put(key,JSON.stringify(state));
  return{stored:true,override};
}

export async function readFacilityHostOverridePayload(env,systemId64){
  const normalized=decimalString(systemId64);
  if(!normalized)throw new Error('invalid_system_id64');
  if(!storageReady(env))throw new Error('bgs_storage_not_configured');
  const state=await readState(env,storageKey(normalized),normalized);
  return{
    schemaVersion:1,
    systemId64:normalized,
    overrides:Object.values(state.overrides).map(publicOverride)
      .sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)),
  };
}

function publicOverride(value){
  return{
    marketId:String(value.marketId),
    facilityName:cleanText(value.facilityName,'',180),
    bodyJournalId:value.bodyJournalId,
    bodyName:cleanText(value.bodyName,'',180),
    updatedAt:value.updatedAt,
    source:'Mongrel Officer confirmation',
    verified:true,
  };
}
async function readState(env,key,systemId64){
  try{
    const stored=await env.DAILY_ORDERS.get(key,{type:'json'});
    if(stored&&stored.schemaVersion===1&&stored.systemId64===systemId64&&stored.overrides&&typeof stored.overrides==='object'){
      return{schemaVersion:1,systemId64,overrides:{...stored.overrides}};
    }
  }catch(error){
    console.error('Could not read facility host overrides',error);
  }
  return{schemaVersion:1,systemId64,overrides:{}};
}
function trimState(state){
  const entries=Object.entries(state.overrides);
  if(entries.length<=MAX_OVERRIDES_PER_SYSTEM)return;
  entries.sort((a,b)=>Date.parse(b[1]?.updatedAt||0)-Date.parse(a[1]?.updatedAt||0));
  state.overrides=Object.fromEntries(entries.slice(0,MAX_OVERRIDES_PER_SYSTEM));
}
function storageKey(systemId64){return FACILITY_HOST_OVERRIDE_KEY_PREFIX+systemId64;}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function');}
function normalizeTime(value){const date=new Date(value||'');return Number.isFinite(date.getTime())?date.toISOString():null;}
function decimalString(value){
  if(typeof value==='number'){if(!Number.isSafeInteger(value)||value<0)return null;return String(value);}
  const text=String(value??'').trim();return /^\d{1,32}$/.test(text)?text:null;
}
function integer(value,min,max){const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:null;}
function cleanText(value,fallback,maxLength){if(typeof value!=='string')return fallback;const text=value.trim();return text?text.slice(0,maxLength):fallback;}
