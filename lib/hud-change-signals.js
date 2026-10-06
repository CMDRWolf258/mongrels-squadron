export const HUD_SIGNAL_PREFIX='hud-change-signal-v1:';
export const HUD_SIGNAL_MISSION_PROGRESS='mission-progress';

export async function touchHudSignal(env,channel,{at=new Date()}={}){
  const kv=env?.DAILY_ORDERS;
  const normalized=normalizeChannel(channel);
  if(!kv||typeof kv.put!=='function'||!normalized)return null;
  const updatedAt=toIso(at);
  const record={
    version:1,
    channel:normalized,
    token:updatedAt+'|'+crypto.randomUUID(),
    updatedAt,
  };
  await kv.put(signalKey(normalized),JSON.stringify(record));
  return record;
}

export async function readHudSignal(env,channel){
  const kv=env?.DAILY_ORDERS;
  const normalized=normalizeChannel(channel);
  if(!kv||typeof kv.get!=='function'||!normalized)return null;
  try{
    const stored=await kv.get(signalKey(normalized),{type:'json'});
    return stored&&typeof stored==='object'?stored:null;
  }catch(error){
    console.error('Could not read HUD change signal',normalized,error);
    return null;
  }
}

export function signalKey(channel){
  const normalized=normalizeChannel(channel);
  return normalized?HUD_SIGNAL_PREFIX+normalized:'';
}

function normalizeChannel(value){
  return String(value||'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}
function toIso(value){
  const date=value instanceof Date?value:new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString();
}
