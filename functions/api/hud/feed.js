import { json } from '../../../lib/auth.js';
import { buildMissionControlData } from '../../../lib/bgs-operations.js';
import { loadBgsDiscordView } from '../../../lib/bgs-discord.js';
import { listOrderPublications } from '../../../lib/order-history.js';
import { readCurrentOrderCycle } from '../../../lib/order-activity.js';
import { buildOrderProgressForHud } from '../operations/order-reports.js';
import { loadRewardDiscordView } from '../../../lib/reward-discord.js';
import { buildScoutJobBoard } from '../../../lib/scout-jobs.js';
import { loadActiveMongrelSystems } from '../../../lib/scout-systems.js';
import { isTradeRouteActive, readTradeRoutes } from '../../../lib/trade-intelligence.js';

const TOKENS_KEY='wolf-bgs-scout-tokens-v1';
const ACK_PREFIX='hud-alert-acks-v1:';
const MAX_ALERTS=40;
const RECENT_ORDER_MS=7*24*60*60*1000;

export async function onRequestGet({request,env}){
  if(!storageReady(env))return reply({ok:false,error:'hud_storage_not_configured'},503);
  const auth=await authenticateScout(request,env);
  if(!auth)return reply({ok:false,error:'invalid_scout_token'},401);
  if(!auth.ownerId)return reply({ok:false,error:'hud_owner_not_bound'},403);
  try{
    return reply(await buildHudFeed(request,env,auth));
  }catch(error){
    console.error('Could not build HUD site feed',error);
    return reply({ok:false,error:'hud_feed_unavailable'},503);
  }
}

export async function onRequestPost({request,env}){
  if(!storageReady(env))return reply({ok:false,error:'hud_storage_not_configured'},503);
  const auth=await authenticateScout(request,env);
  if(!auth)return reply({ok:false,error:'invalid_scout_token'},401);
  if(!auth.ownerId)return reply({ok:false,error:'hud_owner_not_bound'},403);
  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400);}
  const action=clean(body?.action).toLowerCase();
  const ids=action==='ack-all'
    ?unique(Array.isArray(body?.alertIds)?body.alertIds:[]).slice(0,MAX_ALERTS)
    :[clean(body?.alertId)].filter(Boolean);
  if(!['ack','ack-all'].includes(action)||!ids.length)return reply({ok:false,error:'alert_id_required'},400);
  const state=await readAcks(env,auth.ownerId);
  const now=new Date().toISOString();
  for(const id of ids)state.acks[id.slice(0,500)]=now;
  state.updatedAt=now;
  pruneAcks(state);
  await env.DAILY_ORDERS.put(ackKey(auth.ownerId),JSON.stringify(state));
  return reply({ok:true,acknowledged:ids,acknowledgedAt:now});
}

export async function buildHudFeed(request,env,auth){
  const access=String(auth.ownerId||'')===String(env.ADMIN_USER_ID||'')?'site_admin':'member';
  const session={
    sub:auth.ownerId,
    username:auth.ownerCommander||auth.label||'Mongrel Scout',
    displayName:auth.ownerCommander||auth.label||'Mongrel Scout',
    access,
  };
  const [mission,currentOrders,routes,systems,bgsView,rewardView,history,ackState]=await Promise.all([
    buildMissionControlData(request,env,session),
    readCurrentOrderCycle(env),
    readTradeRoutes(env),
    loadActiveMongrelSystems(request),
    loadBgsDiscordView(request,env),
    access==='site_admin'?loadRewardDiscordView(env):Promise.resolve(null),
    access==='site_admin'?listOrderPublications(env,{limit:20}):Promise.resolve([]),
    readAcks(env,auth.ownerId),
  ]);
  const orderProgress=access==='site_admin'
    ?await buildOrderProgressForHud(env,currentOrders,auth.ownerId)
    :{summaries:{},verifiedSummaries:{}};

  const scoutBoard=await buildScoutJobBoard(env,{
    systems,
    viewer:{
      userId:auth.ownerId,
      displayName:auth.ownerCommander||auth.label||'Mongrel Member',
      commander:auth.ownerCommander||auth.label||'Mongrel CMDR',
    },
    now:new Date(),
  });

  const severityRank={critical:0,high:1,medium:2,low:3};
  const alerts=[
    ...factionAlerts(bgsView),
    ...(access==='site_admin'?payoutAlerts(rewardView):[]),
    ...(access==='site_admin'?orderAlerts(history):[]),
    ...tradeAlerts(routes),
  ]
    .sort((a,b)=>(severityRank[norm(a?.severity)]??9)-(severityRank[norm(b?.severity)]??9)
      ||alertTimestamp(b)-alertTimestamp(a))
    .slice(0,MAX_ALERTS)
    .map(alert=>({
      ...alert,
      indicator:alertIndicator(alert.type,alert.severity),
      acknowledged:Boolean(ackState.acks[alert.id]),
      acknowledgedAt:ackState.acks[alert.id]||null,
    }))
    // Faction alerts describe live conditions and may remain visible after ACK.
    // Daily Order changes are notifications: ACK means dismiss them.
    .filter(alert=>!(alert.type==='orders'&&alert.acknowledged));

  return{
    ok:true,
    generatedAt:new Date().toISOString(),
    viewer:{userId:auth.ownerId,commander:auth.ownerCommander||auth.label||'',access},
    mission:summarizeMission(mission,currentOrders,orderProgress),
    trade:summarizeTrades(routes),
    scout:summarizeScoutBoard(scoutBoard),
    alerts,
    unacknowledgedCount:alerts.filter(alert=>!alert.acknowledged).length,
  };
}

export function summarizeMission(mission,currentOrders,progressState={}){
  const closed=new Set(['complete','completed','closed','cancelled','canceled','inactive']);
  const activeOrders=(Array.isArray(currentOrders?.orders)?currentOrders.orders:[])
    .filter(order=>!closed.has(norm(order?.status)));
  const orders=activeOrders
    .slice(0,24)
    .map(order=>{
      const reporting=order?.reporting&&typeof order.reporting==='object'
        ?{type:clean(order.reporting.type),target:numberOrNull(order.reporting.target),blitz:Boolean(order.reporting.blitz)}
        :null;
      return{
        id:clean(order?.id),
        system:clean(order?.system),
        faction:clean(order?.faction),
        priority:clean(order?.priority),
        task:clean(order?.task),
        detail:clean(order?.detail),
        status:clean(order?.status),
        revision:Math.max(1,Math.floor(Number(order?.revision)||1)),
        reporting,
        progress:orderProgress(order,progressState),
      };
    });
  const attention=(Array.isArray(mission?.systems)?mission.systems:[])
    .filter(system=>system?.attention)
    .sort((a,b)=>Number(Boolean(b?.priority))-Number(Boolean(a?.priority))
      ||Number(Boolean(b?.watch))-Number(Boolean(a?.watch))
      ||String(a?.name||'').localeCompare(String(b?.name||'')))
    .slice(0,8)
    .map(system=>({
      system:clean(system?.name),
      influence:Number.isFinite(Number(system?.influence))?Number(system.influence):null,
      alerts:Array.isArray(system?.alerts)?system.alerts.map(clean).filter(Boolean).slice(0,4):[],
      objective:clean(system?.objective),
      dataCondition:clean(system?.dataCondition),
    }));
  return{
    title:clean(currentOrders?.title)||'Mission Control',
    updatedAt:currentOrders?.updatedAt||mission?.meta?.generatedAt||null,
    orderCount:activeOrders.length,
    attentionCount:Number(mission?.meta?.attentionCount||attention.length||0),
    systems:unique(activeOrders.map(order=>order?.system)),
    orders,
    attention,
  };
}

export function orderProgress(order,progressState={}){
  const id=clean(order?.id);
  const reporting=order?.reporting&&typeof order.reporting==='object'?order.reporting:{};
  const type=clean(reporting.type);
  const target=numberOrNull(reporting.target);
  const manual=Number(progressState?.summaries?.[id]?.squad?.score)||0;
  const verified=Number(progressState?.verifiedSummaries?.[id]?.contribution)||0;
  const current=Math.max(0,Math.round((manual+verified)*10)/10);
  const unit=type==='inf'?'INF':type==='cz'?'CZ pts':['bounties','trade','exploration'].includes(type)?'M Cr':'';
  return{
    current,
    target,
    percent:target!==null&&target>0?Math.max(0,Math.min(100,Math.round((current/target)*1000)/10)):null,
    unit,
    manual:Math.max(0,Math.round(manual*10)/10),
    verified:Math.max(0,Math.round(verified*10)/10),
    met:target!==null&&current>=target,
  };
}

export function summarizeTrades(routes){
  const priorityRank={critical:0,high:1,standard:2,low:3};
  const all=Array.isArray(routes)?routes:[];
  const active=all
    .filter(route=>isTradeRouteActive(route))
    .sort((a,b)=>Number(Boolean(b?.official))-Number(Boolean(a?.official))
      ||(priorityRank[clean(a?.intelligence?.priority)]??9)-(priorityRank[clean(b?.intelligence?.priority)]??9)
      ||String(b?.updatedAt||'').localeCompare(String(a?.updatedAt||'')))
    .slice(0,8)
    .map(route=>({
      id:clean(route?.id),
      title:clean(route?.title)||'Trade Opportunity',
      commodity:clean(route?.commodity),
      originSystem:clean(route?.originSystem),
      originStation:clean(route?.originStation),
      destinationSystem:clean(route?.destinationSystem),
      destinationStation:clean(route?.destinationStation),
      legs:(Array.isArray(route?.legs)?route.legs:[]).slice(0,3).map((leg,index)=>({
        index:index+1,
        commodity:clean(leg?.commodity),
        sourceSystem:clean(leg?.sourceSystem),
        sourceStation:clean(leg?.sourceStation),
        destinationSystem:clean(leg?.destinationSystem),
        destinationStation:clean(leg?.destinationStation),
        buyPrice:Math.max(0,Math.round(Number(leg?.buyPrice)||0)),
        sellPrice:Math.max(0,Math.round(Number(leg?.sellPrice)||0)),
        profitPerTon:Math.max(0,Math.round(Number(leg?.profitPerTon)||0)),
        tripProfit:Math.max(0,Math.round(Number(leg?.tripProfit)||0)),
      })),
      profitPerTon:Math.max(0,Math.round(Number(route?.profitPerTon)||0)),
      loopProfit:Math.max(0,Math.round(Number(route?.optimizer?.currentProfit||route?.estimatedLoopProfit)||0)),
      official:Boolean(route?.official),
      priority:clean(route?.intelligence?.priority)||'standard',
      state:clean(route?.optimizer?.state)||'',
      updatedAt:route?.updatedAt||null,
    }));
  return{activeCount:all.filter(route=>isTradeRouteActive(route)).length,routes:active};
}

export function summarizeScoutBoard(board){
  const jobs=(Array.isArray(board?.jobs)?board.jobs:[])
    .filter(job=>!['fresh','fresh_unattributed','disabled'].includes(clean(job?.status)))
    .slice(0,250)
    .map(job=>({
      system:clean(job?.system),
      status:clean(job?.status),
      rewardMillions:Number(job?.reward?.totalMillions)||0,
      bonusMillions:Number(job?.reward?.bonusMillions)||0,
      bonusReason:clean(job?.reward?.bonusReason),
      claimCommander:clean(job?.claim?.commander),
      claimMine:Boolean(job?.claim?.mine),
      claimExpiresAt:job?.claim?.expiresAt||null,
      latestScoutAt:job?.latestScoutAt||null,
      coords:normalizeHudCoords(job?.coords),
      coordinateSource:clean(job?.coordinateSource),
    }));
  const origin=board?.viewer?.lastScoutLocation&&typeof board.viewer.lastScoutLocation==='object'
    ?{
      system:clean(board.viewer.lastScoutLocation.system),
      coords:normalizeHudCoords(board.viewer.lastScoutLocation.coords),
      observedAt:board.viewer.lastScoutLocation.observedAt||null,
      coordinateSource:clean(board.viewer.lastScoutLocation.coordinateSource),
    }
    :null;
  return{
    summary:{
      available:Number(board?.summary?.available||0),
      claimed:Number(board?.summary?.claimed||0),
      fresh:Number(board?.summary?.fresh||0),
      priority:Number(board?.summary?.priority||0),
      coordinates:Number(board?.summary?.coordinates||0),
    },
    origin:origin?.coords?origin:null,
    jobs,
  };
}

function normalizeHudCoords(value){
  const source=Array.isArray(value)
    ? value.slice(0,3)
    : (value&&typeof value==='object'?[value.x,value.y,value.z]:null);
  if(!source||source.length<3)return null;
  const coords=source.map(Number);
  return coords.every(Number.isFinite)?coords:null;
}

export function factionAlerts(view){
  return (Array.isArray(view?.actions)?view.actions:[]).slice(0,16).map(action=>({
    id:alertId('faction',action?.family,action?.system,action?.detail),
    type:'faction',
    severity:clean(action?.family)==='retreat'?'critical':'high',
    title:(clean(action?.family)==='retreat'?'RETREAT · ':'CONFLICT · ')+(clean(action?.system)||'Unknown system'),
    detail:[clean(action?.detail),clean(action?.opponent)?'Opponent: '+clean(action.opponent):'',action?.dataFresh===false?'STALE DATA':''].filter(Boolean).join(' · '),
    createdAt:action?.sourceAt||view?.generatedAt||new Date().toISOString(),
  }));
}

export function payoutAlerts(view){
  return (Array.isArray(view?.activeRequests)?view.activeRequests:[]).slice(0,16).map(member=>({
    id:alertId('payout',member?.payoutRequest?.requestId||member?.ownerId),
    type:'payout',
    severity:'high',
    title:'PAYOUT REQUEST · '+(clean(member?.displayName)||'Mongrel CMDR'),
    detail:formatCredits(member?.payoutRequest?.requestedRemainingCredits||member?.payoutRequest?.requestedCredits||member?.owedCredits),
    createdAt:member?.payoutRequest?.requestedAt||member?.latestAt||new Date().toISOString(),
  }));
}

export function orderAlerts(records,now=Date.now()){
  // Daily Order changes are transient notifications, not a seven-day activity
  // log. Show only the newest material publication so repeated BGS Control
  // edits cannot stack old revisions/removals indefinitely in the HUD.
  const record=(Array.isArray(records)?records:[]).find(row=>{
    if(row?.state!=='applied'||row?.legacyBaseline===true||!row?.changes?.material)return false;
    const at=Date.parse(row?.appliedAt||row?.preparedAt||'');
    return Number.isFinite(at)&&now-at<=RECENT_ORDER_MS;
  });
  if(!record)return[];

  const createdAt=record?.appliedAt||record?.preparedAt||new Date().toISOString();
  const rows=(Array.isArray(record?.changes?.rows)?record.changes.rows:[])
    .filter(row=>['added','revised','removed'].includes(norm(row?.status)));

  if(!rows.length){
    const counts=record?.changes?.counts||{};
    return [{
      id:alertId('orders',record?.publicationId),
      type:'orders',
      severity:'high',
      title:'DAILY ORDERS CHANGED',
      detail:['+'+Number(counts.added||0)+' added',Number(counts.revised||0)+' revised','-'+Number(counts.removed||0)+' removed'].join(' · '),
      createdAt,
    }];
  }

  return rows.slice(0,12).map((row,index)=>{
    const status=norm(row?.status);
    const current=status==='removed'?(row?.before||{}):(row?.after||{});
    const previous=row?.before||{};
    const task=clean(current?.task)||clean(previous?.task)||'Daily Order';
    const system=clean(current?.system)||clean(previous?.system);
    const faction=clean(current?.faction)||clean(previous?.faction);
    const detailParts=[system,faction];
    if(status==='revised'&&clean(previous?.task)&&clean(previous.task)!==task){
      detailParts.push('Was: '+clean(previous.task));
    }else if(status==='revised'){
      const beforeTarget=previous?.reporting?.target;
      const afterTarget=current?.reporting?.target;
      if(beforeTarget!==afterTarget&&afterTarget!==undefined&&afterTarget!==null)detailParts.push('Target: '+afterTarget);
      else if(clean(previous?.priority)!==clean(current?.priority)&&clean(current?.priority))detailParts.push('Priority: '+clean(current.priority));
    }
    return{
      id:alertId('orders',record?.publicationId,current?.id||current?.logicalKey||previous?.id||previous?.logicalKey||index,status),
      type:'orders',
      severity:'high',
      title:'['+status.toUpperCase()+'] '+task,
      detail:detailParts.filter(Boolean).join(' · '),
      createdAt,
    };
  });
}

export function tradeAlerts(routes){
  return (Array.isArray(routes)?routes:[])
    .filter(route=>isTradeRouteActive(route)&&route?.optimizer?.managed&&['degraded','unavailable'].includes(clean(route?.optimizer?.state)))
    .slice(0,8)
    .map(route=>({
      id:alertId('trade',route?.id,route?.optimizer?.state),
      type:'trade',
      severity:clean(route?.optimizer?.state)==='unavailable'?'critical':'high',
      title:'TRADE ROUTE '+clean(route?.optimizer?.state).toUpperCase(),
      detail:clean(route?.title)||clean(route?.commodity)||'Managed route',
      createdAt:route?.optimizer?.lastEvaluatedAt||route?.updatedAt||new Date().toISOString(),
    }));
}

function alertTimestamp(alert){
  const ms=Date.parse(alert?.createdAt||'');
  return Number.isFinite(ms)?ms:0;
}

export function alertIndicator(type,severity=''){
  const kind=norm(type);
  if(kind==='faction')return'red';
  if(kind==='orders')return'amber';
  if(kind==='payout')return'cyan';
  if(kind==='trade')return norm(severity)==='critical'?'red':'amber';
  return'cyan';
}

export function alertId(prefix,...parts){
  return [clean(prefix),...parts.map(part=>norm(part).replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,140))]
    .filter(Boolean).join(':').slice(0,500);
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
      return{id:clean(value.id),label:clean(value.label),ownerId:clean(value.ownerId),ownerCommander:clean(value.ownerCommander)};
    }
  }
  return null;
}

async function readAcks(env,ownerId){
  try{
    const stored=await env.DAILY_ORDERS.get(ackKey(ownerId),{type:'json'});
    return stored&&typeof stored==='object'&&stored.acks&&typeof stored.acks==='object'
      ?{version:1,acks:{...stored.acks},updatedAt:stored.updatedAt||null}
      :{version:1,acks:{},updatedAt:null};
  }catch{return{version:1,acks:{},updatedAt:null};}
}
function pruneAcks(state){
  const cutoff=Date.now()-30*24*60*60*1000;
  const rows=Object.entries(state.acks||{})
    .filter(([,at])=>{const ms=Date.parse(at||'');return Number.isFinite(ms)&&ms>=cutoff;})
    .sort((a,b)=>String(b[1]).localeCompare(String(a[1])))
    .slice(0,300);
  state.acks=Object.fromEntries(rows);
}
function ackKey(ownerId){return ACK_PREFIX+encodeURIComponent(clean(ownerId));}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function');}
function reply(body,status=200){return json(body,{status,headers:{'Cache-Control':'private, no-store, no-cache, must-revalidate',Pragma:'no-cache','X-Content-Type-Options':'nosniff'}});}
function formatCredits(value){return Math.max(0,Math.round(Number(value)||0)).toLocaleString('en-US')+' Cr';}
function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function unique(values){return[...new Set((Array.isArray(values)?values:[]).map(clean).filter(Boolean))];}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim();}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ');}
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
