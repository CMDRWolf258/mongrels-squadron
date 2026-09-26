import { json, readSession } from '../../../lib/auth.js';
import { resolveMemberProfile, publicMemberFilter } from '../../../lib/member-profile.js';
import {
  normalizeTradeDiscordState,
  readTradeRoutes,
  removeTradeAlertSubscriptions,
  requireTradeStorage,
  writeTradeRoutes,
} from '../../../lib/trade-intelligence.js';
import { applyTradeDiscordState, syncTradeDiscord } from '../../../lib/trade-discord.js';

const ALLOWED_ACCESS = new Set(['member','officer','site_admin']);
const MANAGER_ACCESS = new Set(['officer','site_admin']);

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);
  const items = await readTradeRoutes(env);
  const viewer = session && ALLOWED_ACCESS.has(session.access)
    ? { id: session.sub, displayName: session.displayName, access: session.access }
    : null;
  const memberId = new URL(request.url).searchParams.get('member') || '';
  const memberProfile = viewer && memberId ? await resolveMemberProfile(env, memberId) : null;
  const selected = viewer && memberId ? (memberProfile ? items.filter(item => item.ownerId === memberProfile.ownerId) : []) : items;
  return reply({
    ok: true,
    configured: Boolean(env.TRADES && typeof env.TRADES.get === 'function'),
    viewer,
    canPost: Boolean(viewer),
    canModerate: Boolean(viewer && MANAGER_ACCESS.has(viewer.access)),
    memberFilter: publicMemberFilter(memberProfile),
    routes: selected.map(item => present(item, session)),
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;

  const now = new Date().toISOString();
  const route = normalizeRoute(body.value, {
    id: crypto.randomUUID(),
    ownerId: auth.session.sub,
    ownerName: auth.session.displayName,
    createdAt: now,
    updatedAt: now,
    updatedBy: auth.session.displayName,
  }, auth.session);

  const items = await readTradeRoutes(env);
  items.unshift(route);
  await writeTradeRoutes(env, items);

  const discord = await syncAndPersistDiscord(env, items, 0, request);
  return reply({
    ok:true,
    route:present(items[0], auth.session),
    discord:discordSummary(discord),
  }, 201);
}

export async function onRequestPut({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;
  const body = await readBody(request); if (body.response) return body.response;

  const id = clean(body.value?.id,'',100);
  if (!id) return reply({ok:false,error:'route_id_required'},400);

  const items = await readTradeRoutes(env);
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'route_not_found'},404);

  const existing = items[idx];
  const manager = MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_route_owner'},403);

  items[idx] = normalizeRoute(body.value, {
    id: existing.id,
    ownerId: existing.ownerId,
    ownerName: existing.ownerName,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.session.displayName,
  }, auth.session, existing);

  await writeTradeRoutes(env, items);
  const discord = await syncAndPersistDiscord(env, items, idx, request);
  return reply({
    ok:true,
    route:present(items[idx],auth.session),
    discord:discordSummary(discord),
  });
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireMember(request, env); if (auth.response) return auth.response;
  const err = validateSameOrigin(request); if (err) return err;
  const storage = requireStorage(env); if (storage) return storage;

  const id = new URL(request.url).searchParams.get('id') || '';
  const items = await readTradeRoutes(env);
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return reply({ok:false,error:'route_not_found'},404);

  const existing = items[idx];
  const manager = MANAGER_ACCESS.has(auth.session.access);
  if (!manager && existing.ownerId !== auth.session.sub) return reply({ok:false,error:'not_route_owner'},403);

  let discord=null;
  if(existing.discord?.messageId){
    const closed={
      ...existing,
      status:'expired',
      updatedAt:new Date().toISOString(),
      updatedBy:auth.session.displayName,
    };
    discord=await syncTradeDiscord(env,{
      route:closed,
      origin:new URL(request.url).origin,
    });
  }

  items.splice(idx,1);
  await writeTradeRoutes(env,items);
  await removeTradeAlertSubscriptions(env,id).catch(()=>{});

  return reply({ok:true,discord:discordSummary(discord)});
}

function normalizeRoute(value, fixed, session, existing={}) {
  const src = value && typeof value === 'object' ? value : {};
  const manager = MANAGER_ACCESS.has(session.access);
  let category = clean(src.category, existing.category || 'credits', 20).toLowerCase();
  if (!['squad','credits'].includes(category)) category = 'credits';
  const official = manager ? Boolean(src.official) : Boolean(existing.official);
  const existingIntelligence=existing.intelligence&&typeof existing.intelligence==='object'?existing.intelligence:{};

  return {
    id: fixed.id,
    ownerId: fixed.ownerId,
    ownerName: fixed.ownerName,
    official,
    category,
    title: clean(src.title, existing.title || 'Trade Opportunity', 140),
    commodity: clean(src.commodity, existing.commodity || '', 100),
    originSystem: clean(src.originSystem, '', 120),
    originStation: clean(src.originStation, '', 120),
    destinationSystem: clean(src.destinationSystem, '', 120),
    destinationStation: clean(src.destinationStation, '', 120),
    profitPerTon: clampNumber(src.profitPerTon,0,1000000000,0),
    estimatedLoopProfit: clampNumber(src.estimatedLoopProfit,0,1000000000000,0),
    padSize: normalizePad(src.padSize),
    distanceLy: clean(String(src.distanceLy ?? ''),'',30),
    quantity: clean(src.quantity,'',80),
    returnCommodity: clean(src.returnCommodity, existing.returnCommodity || '', 100),
    returnProfitPerTon: clampNumber(src.returnProfitPerTon,0,1000000000,0),
    returnQuantity: clean(src.returnQuantity, existing.returnQuantity || '',80),
    objective: clean(src.objective,'',500),
    notes: clean(src.notes,'',1400),
    expires: clean(src.expires,'',40),
    status: normalizeStatus(src.status),
    tags: normalizeTags(src.tags),
    legs: normalizeRouteLegs(Array.isArray(src.legs)?src.legs:existing.legs),
    optimizer: normalizeRouteOptimizer(src.optimizer,existing.optimizer),
    intelligence:{
      enabled:Boolean(src.intelligence?.enabled ?? existingIntelligence.enabled),
      priority:normalizePriority(src.intelligence?.priority || existingIntelligence.priority),
      watchId:clean(existingIntelligence.watchId || '','',80),
    },
    discord:normalizeTradeDiscordState(existing.discord),
    createdAt: fixed.createdAt,
    updatedAt: fixed.updatedAt,
    updatedBy: fixed.updatedBy,
  };
}

function present(item, session) {
  const manager = Boolean(session && MANAGER_ACCESS.has(session.access));
  const mine = Boolean(session && item.ownerId === session.sub);
  const { ownerId, discord, ...publicItem } = item;
  const discordStatus=(manager||mine)
    ?{
        synced:Boolean(discord?.messageId),
        lastSyncedAt:discord?.lastSyncedAt||'',
        lastError:discord?.lastError||'',
        lifecycle:discord?.lifecycle||'active',
      }
    :undefined;
  return {
    ...publicItem,
    ...(discordStatus?{discordStatus}:{}),
    canEdit: manager || mine,
    isMine: mine,
  };
}

async function syncAndPersistDiscord(env,items,index,request){
  const route=items[index];
  const discord=await syncTradeDiscord(env,{
    route,
    origin:new URL(request.url).origin,
  });
  applyTradeDiscordState(route,discord);
  items[index]=route;
  await writeTradeRoutes(env,items);
  return discord;
}

function discordSummary(value){
  if(!value)return null;
  return {
    ok:Boolean(value.ok),
    mode:value.mode||'',
    configured:value.configured!==false,
    attempted:Boolean(value.attempted),
    error:value.error||'',
    subscriberCount:Number(value.subscriberCount||0),
  };
}

function requireStorage(env){
  try{
    requireTradeStorage(env);
    return null;
  }catch{
    return reply({ok:false,error:'trades_storage_not_configured'},503);
  }
}
async function requireMember(request,env){
  const session=await readSession(request,env);
  if(!session)return {response:reply({ok:false,error:'authentication_required'},401)};
  if(!ALLOWED_ACCESS.has(session.access))return {response:reply({ok:false,error:'member_access_required'},403)};
  return {session};
}
function validateSameOrigin(request){
  const origin=request.headers.get('Origin');
  const expected=new URL(request.url).origin;
  const marker=request.headers.get('X-Mongrels-Request');
  if(origin!==expected||marker!=='trade-editor')return reply({ok:false,error:'request_validation_failed'},403);
  return null;
}
async function readBody(request){
  try{return {value:await request.json()};}
  catch{return {response:reply({ok:false,error:'invalid_json'},400)};}
}

function normalizeRouteLegs(value){
  const rows=Array.isArray(value)?value:[];
  return rows.slice(0,3).map((leg,index)=>({
    index:index+1,
    commodity:clean(leg?.commodity,'',100),
    sourceMarketId:clean(String(leg?.sourceMarketId??''),'',80),
    sourceSystem:clean(leg?.sourceSystem,'',140),
    sourceStation:clean(leg?.sourceStation,'',140),
    destinationMarketId:clean(String(leg?.destinationMarketId??''),'',80),
    destinationSystem:clean(leg?.destinationSystem,'',140),
    destinationStation:clean(leg?.destinationStation,'',140),
    buyPrice:clampNumber(leg?.buyPrice,0,2147483647,0),
    sellPrice:clampNumber(leg?.sellPrice,0,2147483647,0),
    profitPerTon:clampNumber(leg?.profitPerTon,0,2147483647,0),
    quantity:clampNumber(leg?.quantity,0,2000000000,0),
    tripProfit:clampNumber(leg?.tripProfit,0,1000000000000,0),
    sourceSupply:clampNumber(leg?.sourceSupply,0,2147483647,0),
    destinationDemand:clampNumber(leg?.destinationDemand,0,2147483647,0),
    distanceLy:finiteNumber(leg?.distanceLy),
    sourceArrivalLs:finiteNumber(leg?.sourceArrivalLs),
    destinationArrivalLs:finiteNumber(leg?.destinationArrivalLs),
    observedAt:clean(leg?.observedAt,'',40),
  })).filter(leg=>leg.commodity&&leg.sourceMarketId&&leg.destinationMarketId);
}
function normalizeRouteOptimizer(value,existing={}){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const prior=existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{};
  const managed=Boolean(source.managed ?? prior.managed);
  if(!managed)return{};
  const legCount=Number(source.legCount??prior.legCount)===3?3:2;
  const scope=clean(source.scope??prior.scope,'radius',20).toLowerCase()==='same'?'same':'radius';
  return{
    managed:true,
    startSystem:clean(source.startSystem??prior.startSystem,'',140),
    legCount,
    scope,
    radiusLy:clampNumber(source.radiusLy??prior.radiusLy,0,legCount===3?100:500,0),
    cargoCapacity:clampNumber(source.cargoCapacity??prior.cargoCapacity,1,2000,784),
    minPad:[0,1,2,3].includes(Number(source.minPad??prior.minPad))?Number(source.minPad??prior.minPad):3,
    carrierMode:['exclude','include','only'].includes(clean(source.carrierMode??prior.carrierMode,'exclude',20))?clean(source.carrierMode??prior.carrierMode,'exclude',20):'exclude',
    priority:normalizePriority(source.priority??prior.priority),
    maxAgeMinutes:clampNumber(source.maxAgeMinutes??prior.maxAgeMinutes,1,20160,1440),
    thresholdDropPercent:clampNumber(source.thresholdDropPercent??prior.thresholdDropPercent,5,90,25),
    baselineProfit:clampNumber(source.baselineProfit??prior.baselineProfit,0,1000000000000,0),
    currentProfit:clampNumber(source.currentProfit??prior.currentProfit,0,1000000000000,0),
    state:['healthy','degraded','unavailable'].includes(clean(source.state??prior.state,'healthy',20))?clean(source.state??prior.state,'healthy',20):'healthy',
    lastEvaluatedAt:clean(source.lastEvaluatedAt??prior.lastEvaluatedAt,'',40),
    lastAlertAt:clean(source.lastAlertAt??prior.lastAlertAt,'',40),
    alternative:normalizeOptimizerAlternative(source.alternative??prior.alternative),
  };
}
function normalizeOptimizerAlternative(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!source)return null;
  const legs=normalizeRouteLegs(source.legs);
  if(!legs.length)return null;
  return{
    loopProfit:clampNumber(source.loopProfit,0,1000000000000,0),
    totalDistanceLy:finiteNumber(source.totalDistanceLy),
    observedAt:clean(source.observedAt,'',40),
    legs,
  };
}
function finiteNumber(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100)/100:null;
}

function normalizePad(v){
  const x=clean(v,'unknown',20).toLowerCase();
  return ['large','medium','small','unknown'].includes(x)?x:'unknown';
}
function normalizeStatus(v){
  const x=clean(v,'active',20).toLowerCase();
  return ['active','complete','expired'].includes(x)?x:'active';
}
function normalizePriority(v){
  const x=clean(v,'standard',20).toLowerCase();
  return ['critical','high','standard','low'].includes(x)?x:'standard';
}
function normalizeTags(v){
  const raw=Array.isArray(v)?v:String(v||'').split(',');
  return raw.map(x=>String(x).trim()).filter(Boolean).slice(0,10).map(x=>x.slice(0,40));
}
function clampNumber(v,min,max,fallback){
  const n=Number(v);
  return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback;
}
function clean(v,fallback='',max=1000){
  if(typeof v!=='string')return fallback;
  const x=v.trim();
  return x?x.slice(0,max):fallback;
}
function headers(){
  return {
    'Cache-Control':'no-store, no-cache, must-revalidate',
    Pragma:'no-cache',
    Vary:'Cookie',
    'X-Content-Type-Options':'nosniff',
  };
}
function reply(data,status=200){return json(data,{status,headers:headers()});}
