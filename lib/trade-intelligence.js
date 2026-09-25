export const TRADE_BOARD_KEY = 'trade-board-v1';
export const TRADE_CONTROL_KEY = 'trade-control-v1';
const SUBSCRIPTION_PREFIX = 'trade-alert-sub-v1:';

const DEFAULT_TEST_CHANNEL_ID = '1552127291234983956';
const DEFAULT_PRODUCTION_CHANNEL_ID = '1029221573988720722';

const DEFAULT_PRIORITY_PROFILES = {
  critical: { label:'Critical', refreshMinutes:5, freshMinutes:30, agingMinutes:90 },
  high: { label:'High', refreshMinutes:15, freshMinutes:120, agingMinutes:360 },
  standard: { label:'Standard', refreshMinutes:60, freshMinutes:1440, agingMinutes:2880 },
  low: { label:'Low', refreshMinutes:360, freshMinutes:4320, agingMinutes:10080 },
};

export function defaultTradeControl() {
  return {
    version:1,
    defaultPriority:'standard',
    discord:{
      mode:'testing',
      testingChannelId:DEFAULT_TEST_CHANNEL_ID,
      productionChannelId:DEFAULT_PRODUCTION_CHANNEL_ID,
      autoPublish:true,
      routineSilent:true,
      thresholdMessages:true,
      compactSuperseded:true,
    },
    priorities:Object.fromEntries(
      Object.entries(DEFAULT_PRIORITY_PROFILES).map(([key,value])=>[key,{...value}]),
    ),
  };
}

export function normalizeTradeControl(value) {
  const base=defaultTradeControl();
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const discordSource=source.discord&&typeof source.discord==='object'&&!Array.isArray(source.discord)?source.discord:{};
  const prioritySource=source.priorities&&typeof source.priorities==='object'&&!Array.isArray(source.priorities)?source.priorities:{};

  const defaultPriority=['critical','high','standard','low'].includes(clean(source.defaultPriority))
    ?clean(source.defaultPriority)
    :base.defaultPriority;

  return {
    version:1,
    defaultPriority,
    discord:{
      mode:clean(discordSource.mode)==='live'?'live':'testing',
      testingChannelId:discordId(discordSource.testingChannelId)||base.discord.testingChannelId,
      productionChannelId:discordId(discordSource.productionChannelId)||base.discord.productionChannelId,
      autoPublish:bool(discordSource.autoPublish,base.discord.autoPublish),
      routineSilent:true,
      thresholdMessages:bool(discordSource.thresholdMessages,base.discord.thresholdMessages),
      compactSuperseded:bool(discordSource.compactSuperseded,base.discord.compactSuperseded),
    },
    priorities:Object.fromEntries(
      Object.entries(base.priorities).map(([key,defaults])=>[
        key,
        normalizePriorityProfile(prioritySource[key],defaults),
      ]),
    ),
  };
}

export async function readTradeControl(env) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return defaultTradeControl();
  try{
    const stored=await env.TRADES.get(TRADE_CONTROL_KEY,{type:'json'});
    return normalizeTradeControl(stored);
  }catch(error){
    console.error('Could not read Trade Control config',error);
    return defaultTradeControl();
  }
}

export async function writeTradeControl(env,value) {
  requireTradeStorage(env);
  const normalized=normalizeTradeControl(value);
  await env.TRADES.put(TRADE_CONTROL_KEY,JSON.stringify(normalized));
  return normalized;
}

export async function readTradeRoutes(env) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return[];
  try{
    const stored=await env.TRADES.get(TRADE_BOARD_KEY,{type:'json'});
    return Array.isArray(stored)?stored:[];
  }catch(error){
    console.error('Could not read Trader\'s Outpost routes',error);
    return[];
  }
}

export async function writeTradeRoutes(env,items) {
  requireTradeStorage(env);
  const routes=Array.isArray(items)?items:[];
  await env.TRADES.put(TRADE_BOARD_KEY,JSON.stringify(routes.slice(0,300)));
}

export function tradeDiscordChannelId(control) {
  const config=normalizeTradeControl(control);
  return config.discord.mode==='live'
    ?config.discord.productionChannelId
    :config.discord.testingChannelId;
}

export function tradePriorityProfile(control,priority) {
  const config=normalizeTradeControl(control);
  const key=['critical','high','standard','low'].includes(clean(priority))
    ?clean(priority)
    :config.defaultPriority;
  return { key, ...config.priorities[key] };
}

export function classifyTradeDataAge(observedAt,control,priority) {
  const profile=tradePriorityProfile(control,priority);
  const timestamp=Date.parse(observedAt||'');
  if(!Number.isFinite(timestamp))return {state:'unknown',ageMinutes:null,profile};
  const ageMinutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));
  const state=ageMinutes<=profile.freshMinutes
    ?'fresh'
    :ageMinutes<=profile.agingMinutes
      ?'aging'
      :'stale';
  return {state,ageMinutes,profile};
}

export function isTradeRouteActive(route,now=Date.now()) {
  if(!route||route.active===false)return false;
  if(route.status==='complete'||route.status==='expired')return false;
  if(route.expires){
    const expiry=Date.parse(String(route.expires).length<=10?route.expires+'T23:59:59':route.expires);
    if(Number.isFinite(expiry)&&expiry<now)return false;
  }
  return true;
}

export async function toggleTradeAlertSubscription(env,{routeId,userId,displayName='Commander'}={}) {
  requireTradeStorage(env);
  const route=cleanRouteId(routeId);
  const user=discordId(userId);
  if(!route||!user)throw new Error('invalid_trade_subscription');
  const key=subscriptionKey(route,user);
  const existing=await env.TRADES.get(key);
  if(existing!==null){
    await env.TRADES.delete(key);
    return {subscribed:false};
  }
  const subscribedAt=new Date().toISOString();
  await env.TRADES.put(key,JSON.stringify({
    routeId:route,
    userId:user,
    displayName:clean(displayName).slice(0,80)||'Commander',
    subscribedAt,
  }));
  return {subscribed:true,subscribedAt};
}

export async function hasTradeAlertSubscription(env,{routeId,userId}={}) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function')return false;
  const route=cleanRouteId(routeId);
  const user=discordId(userId);
  if(!route||!user)return false;
  return (await env.TRADES.get(subscriptionKey(route,user)))!==null;
}

export async function listTradeAlertSubscriberIds(env,routeId,{limit=100}={}) {
  if(!env?.TRADES||typeof env.TRADES.list!=='function')return[];
  const route=cleanRouteId(routeId);
  if(!route)return[];
  const prefix=SUBSCRIPTION_PREFIX+route+':';
  const ids=[];
  let cursor=undefined;
  do{
    const page=await env.TRADES.list({prefix,limit:Math.min(1000,Math.max(1,limit-ids.length)),...(cursor?{cursor}:{})});
    for(const item of page.keys||[]){
      const id=discordId(String(item.name||'').slice(prefix.length));
      if(id&&!ids.includes(id))ids.push(id);
      if(ids.length>=limit)return ids;
    }
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor&&ids.length<limit);
  return ids;
}

export async function removeTradeAlertSubscriptions(env,routeId) {
  if(!env?.TRADES||typeof env.TRADES.list!=='function'||typeof env.TRADES.delete!=='function')return 0;
  const route=cleanRouteId(routeId);
  if(!route)return 0;
  const prefix=SUBSCRIPTION_PREFIX+route+':';
  let removed=0;
  let cursor=undefined;
  do{
    const page=await env.TRADES.list({prefix,limit:1000,...(cursor?{cursor}:{})});
    await Promise.all((page.keys||[]).map(async item=>{
      await env.TRADES.delete(item.name);
      removed+=1;
    }));
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  return removed;
}

export function normalizeTradeDiscordState(value) {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {
    messageId:discordId(source.messageId),
    channelId:discordId(source.channelId),
    lastSyncedAt:iso(source.lastSyncedAt),
    lastError:clean(source.lastError).slice(0,300),
    lifecycle:['active','superseded','closed'].includes(clean(source.lifecycle))?clean(source.lifecycle):'active',
  };
}

export function requireTradeStorage(env) {
  if(!env?.TRADES||typeof env.TRADES.get!=='function'||typeof env.TRADES.put!=='function'){
    throw new Error('trades_storage_not_configured');
  }
}

function normalizePriorityProfile(value,defaults) {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const refreshMinutes=whole(source.refreshMinutes,5,10080,defaults.refreshMinutes);
  const freshMinutes=whole(source.freshMinutes,1,43200,defaults.freshMinutes);
  const agingMinutes=Math.max(
    freshMinutes,
    whole(source.agingMinutes,freshMinutes,43200,defaults.agingMinutes),
  );
  return {
    label:clean(source.label).slice(0,30)||defaults.label,
    refreshMinutes,
    freshMinutes,
    agingMinutes,
  };
}

function subscriptionKey(routeId,userId){return SUBSCRIPTION_PREFIX+routeId+':'+userId;}
function cleanRouteId(value){
  const text=clean(value).slice(0,80);
  return /^[A-Za-z0-9_-]{8,80}$/.test(text)?text:'';
}
function discordId(value){const text=clean(value);return /^\d{5,30}$/.test(text)?text:'';}
function bool(value,fallback){return typeof value==='boolean'?value:fallback;}
function whole(value,min,max,fallback){
  const n=Number(value);
  return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
function iso(value){
  if(!value)return'';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():'';
}
