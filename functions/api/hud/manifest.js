import { resolveOrderWorkCycle } from '../../../lib/daily-order-cycle.js';
import { HUD_SIGNAL_MISSION_PROGRESS, signalKey } from '../../../lib/hud-change-signals.js';

const TOKENS_KEY='wolf-bgs-scout-tokens-v1';
const CURRENT_ORDERS_KEY='current';
const BGS_STRATEGY_KEY='bgs-strategy-v1';
const BGS_CONTROL_KEY='wolf-bgs-control-v1';
const SCOUT_SNAPSHOTS_KEY='wolf-bgs-scout-snapshots-v1';
const SCOUT_SETTINGS_KEY='scout-jobs-settings-v1';
const SCOUT_STATE_KEY='scout-jobs-state-v1';
const TRADE_BOARD_KEY='trade-board-v1';
const CARRIER_REGISTRY_KEY='registry-v1';
const CARRIER_DIALOGUE_KEY='carrier-dialogue-v1';
const SHARED_CACHE_SECONDS=10;
const MANIFEST_VERSION=1;

export async function onRequestGet(context){
  const {request,env}=context;
  if(!storageReady(env))return reply({ok:false,error:'hud_storage_not_configured'},503);
  const auth=await authenticateScout(request,env);
  if(!auth)return reply({ok:false,error:'invalid_scout_token'},401);
  if(!auth.ownerId)return reply({ok:false,error:'hud_owner_not_bound'},403);

  try{
    const shared=await sharedManifest(request,env,context);
    return reply({
      ...shared,
      viewer:{
        token:await digestToken({
          ownerId:auth.ownerId,
          spokenName:auth.ownerSpokenName,
          lastSystem:auth.lastSystem,
          lastCoords:auth.lastCoords,
        }),
      },
    });
  }catch(error){
    console.error('Could not build HUD change manifest',error);
    return reply({ok:false,error:'hud_manifest_unavailable'},503);
  }
}

export async function buildHudChangeManifest(request,env,{now=new Date()}={}){
  const daily=env?.DAILY_ORDERS;
  const trades=env?.TRADES;
  const carriers=env?.CARRIERS;
  const [
    current,
    strategy,
    control,
    snapshots,
    scoutSettings,
    scoutState,
    missionProgress,
    tradeBoard,
    carrierRegistry,
    carrierDialogue,
    liveBgsStamp,
  ]=await Promise.all([
    safeGet(daily,CURRENT_ORDERS_KEY),
    safeGet(daily,BGS_STRATEGY_KEY),
    safeGet(daily,BGS_CONTROL_KEY),
    safeGet(daily,SCOUT_SNAPSHOTS_KEY),
    safeGet(daily,SCOUT_SETTINGS_KEY),
    safeGet(daily,SCOUT_STATE_KEY),
    safeGet(daily,signalKey(HUD_SIGNAL_MISSION_PROGRESS)),
    safeGet(trades,TRADE_BOARD_KEY),
    safeGet(carriers,CARRIER_REGISTRY_KEY),
    safeGet(carriers,CARRIER_DIALOGUE_KEY),
    readLiveBgsStamp(request),
  ]);

  const orderCycles=(Array.isArray(current?.orders)?current.orders:[])
    .map(order=>{
      const cycle=resolveOrderWorkCycle(order,control||{},{now});
      return{
        id:String(order?.id||''),
        cycleId:String(cycle?.cycleId||''),
        phase:String(cycle?.phase||''),
      };
    });

  const channels={
    missionOrders:await digestToken({current,control}),
    missionProgress:await digestToken({signal:missionProgress,orderCycles}),
    bgs:await digestToken({liveBgsStamp,strategy,snapshots,control}),
    scout:await digestToken({liveBgsStamp,snapshots,settings:scoutSettings,state:scoutState,control}),
    trades:await digestToken(tradeBoard),
    carriers:await digestToken(carrierRegistry),
    dialogue:await digestToken(carrierDialogue),
    alerts:await digestToken({bgsControl:control,trades:tradeBoard}),
  };

  return{
    ok:true,
    version:MANIFEST_VERSION,
    generatedAt:now.toISOString(),
    channels,
  };
}

async function sharedManifest(request,env,context){
  const cache=globalThis.caches?.default;
  if(!cache)return buildHudChangeManifest(request,env);
  const cacheUrl=new URL('/__mongrels-cache/hud-change-manifest-v1',request.url);
  const cacheKey=new Request(cacheUrl.toString(),{method:'GET'});
  try{
    const hit=await cache.match(cacheKey);
    if(hit){
      const body=await hit.json();
      if(body?.ok===true&&body?.version===MANIFEST_VERSION)return body;
    }
  }catch(error){
    console.error('HUD manifest cache read failed',error);
  }

  const body=await buildHudChangeManifest(request,env);
  const cached=new Response(JSON.stringify(body),{
    status:200,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':`public, max-age=${SHARED_CACHE_SECONDS}`,
    },
  });
  try{
    const write=cache.put(cacheKey,cached);
    if(typeof context?.waitUntil==='function')context.waitUntil(write);
    else await write;
  }catch(error){
    console.error('HUD manifest cache write failed',error);
  }
  return body;
}

async function readLiveBgsStamp(request){
  try{
    const response=await fetch(new URL('/data/live-bgs.json',request.url),{
      headers:{Accept:'application/json'},
    });
    if(!response.ok)return null;
    const body=await response.json().catch(()=>null);
    if(!body||typeof body!=='object')return null;
    return{
      generatedAt:body.generatedAt||null,
      sourceUpdated:body.sourceUpdated||null,
      sourceCount:Number(body.vaultPresenceRows||body.activePresenceSystems||0)||0,
    };
  }catch{
    return null;
  }
}

async function safeGet(kv,key){
  if(!kv||typeof kv.get!=='function'||!key)return null;
  try{return await kv.get(key,{type:'json'});}
  catch(error){
    console.error('HUD manifest source read failed',key,error);
    return null;
  }
}

async function authenticateScout(request,env){
  const header=request.headers.get('Authorization')||'';
  const match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return null;
  const token=match[1].trim();
  if(!token.startsWith('mscout_')||token.length>180)return null;
  const hash=await sha256Hex(token);
  const stored=await env.DAILY_ORDERS.get(TOKENS_KEY,{type:'json'});
  for(const value of Object.values(stored?.tokens&&typeof stored.tokens==='object'?stored.tokens:{})){
    if(value?.hash&&constantTimeEqual(String(value.hash),hash)){
      return{
        id:clean(value.id),
        label:clean(value.label),
        ownerId:clean(value.ownerId),
        ownerCommander:clean(value.ownerCommander),
        ownerSpokenName:clean(value.ownerSpokenName),
        lastSystem:clean(value.lastSystem),
        lastSeenAt:value.lastSeenAt||null,
        lastEventAt:value.lastEventAt||null,
        lastCoords:value.lastCoords&&typeof value.lastCoords==='object'?value.lastCoords:null,
      };
    }
  }
  return null;
}

export async function digestToken(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value??null)));
  return [...new Uint8Array(digest)].slice(0,12).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function storageReady(env){
  return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function');
}
function reply(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store, no-cache, must-revalidate',
      Pragma:'no-cache',
      'X-Content-Type-Options':'nosniff',
    },
  });
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function constantTimeEqual(a,b){
  const left=String(a||''),right=String(b||'');
  if(left.length!==right.length)return false;
  let diff=0;
  for(let i=0;i<left.length;i+=1)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
