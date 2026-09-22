import { decorateDailyOrdersForTiming, orderWorkCycleAt } from './daily-order-cycle.js';

const CLOSED = new Set(['complete','completed','closed','cancelled','canceled','inactive']);

export async function readCurrentOrderCycle(env,{historyDepth=0,now=new Date()}={}) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return null;
  const current = await env.DAILY_ORDERS.get('current',{type:'json'});
  if(!current||typeof current!=='object')return null;
  return decorateDailyOrdersForTiming(env,current,{historyDepth,now});
}

export function activeOrderSystems(current) {
  const out=[];
  const seen=new Set();
  for (const order of Array.isArray(current?.orders) ? current.orders : []) {
    if (!isActiveOrder(order)) continue;
    const system=clean(order?.system);
    if (!system || norm(system)==='squad-wide') continue;
    const key=norm(system);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(system);
  }
  return out;
}

export function matchVerifiedActivity(events,current,{cycleOffset=0}={}) {
  const orders=(Array.isArray(current?.orders)?current.orders:[]).filter(isActiveOrder);
  const annotated=[];
  const totals={};

  for(const event of Array.isArray(events)?events:[]){
    const components=activityComponents(event);
    const matches=[];
    const unmatched=[];
    const ambiguous=[];

    for(const component of components){
      const candidates=orders.filter(order=>qualifies(order,component,event,cycleOffset));
      if(candidates.length===1){
        const order=candidates[0];
        const cycle=orderWorkCycleAt(order,cycleOffset);
        const sourceCycleId=clean(cycle?.cycleId);
        const match={
          eventId:event.id||'',
          orderId:order.id||'',
          logicalKey:order.logicalKey||'',
          revision:Number(order.revision)||1,
          orderTask:order.task||'Daily Order',
          orderTarget:numberOrNull(order?.reporting?.target),
          sourceCycleId,
          cycleStartedAt:cycle?.cycleStartedAt||null,
          cycleEndsAt:cycle?.cycleEndsAt||null,
          type:component.type,
          contribution:round(component.contribution),
          unit:component.unit,
          faction:component.faction||'',
          system:component.system||'',
          timestamp:event.timestamp||'',
        };
        matches.push(match);
        const totalKey=(order.id||'')+'|'+sourceCycleId;
        const bucket=totals[totalKey]||{
          orderId:order.id,
          logicalKey:order.logicalKey||'',
          revision:Number(order.revision)||1,
          task:order.task||'Daily Order',
          type:component.type,
          system:order.system||'',
          faction:order.faction||'',
          target:numberOrNull(order?.reporting?.target),
          sourceCycleId,
          cycleStartedAt:cycle?.cycleStartedAt||null,
          cycleEndsAt:cycle?.cycleEndsAt||null,
          contribution:0,
          unit:component.unit,
          eventCount:0,
          sourceEventIds:[],
        };
        bucket.contribution=round(bucket.contribution+component.contribution);
        bucket.eventCount+=1;
        if(event.id&&!bucket.sourceEventIds.includes(event.id))bucket.sourceEventIds.push(event.id);
        totals[totalKey]=bucket;
      }else if(candidates.length>1){
        ambiguous.push({
          type:component.type,
          contribution:round(component.contribution),
          unit:component.unit,
          faction:component.faction||'',
          system:component.system||'',
          candidateOrderIds:candidates.map(order=>order.id),
        });
      }else{
        unmatched.push(component);
      }
    }

    annotated.push({
      ...event,
      orderMatches:matches,
      orderMatchStatus:ambiguous.length?'ambiguous':matches.length?'matched':'unmatched',
      orderMatchAmbiguous:ambiguous,
      orderMatchUnmatched:unmatched,
    });
  }

  return {
    cycleId:current?.cycleId||null,
    cycleStartedAt:current?.cycleStartedAt||current?.updatedAt||null,
    cycleOffset:Math.max(0,Math.floor(Number(cycleOffset)||0)),
    workCycleIds:[...new Set(Object.values(totals).map(row=>row.sourceCycleId).filter(Boolean))],
    orderTotals:Object.values(totals),
    events:annotated,
  };
}

export function matchVerifiedActivityHistory(events,current,{depth=7}={}) {
  const maxDepth=Math.max(0,Math.min(30,Math.floor(Number(depth)||0)));
  const runs=[];
  for(let offset=0;offset<=maxDepth;offset+=1)runs.push(matchVerifiedActivity(events,current,{cycleOffset:offset}));
  const totals=runs.flatMap(run=>run.orderTotals||[]);
  const eventMap=new Map();
  for(const run of runs){
    for(const event of Array.isArray(run.events)?run.events:[]){
      const id=String(event?.id||event?.timestamp||eventMap.size);
      const row=eventMap.get(id)||{...event,orderMatches:[],orderMatchAmbiguous:[],orderMatchUnmatched:[]};
      row.orderMatches.push(...(Array.isArray(event.orderMatches)?event.orderMatches:[]));
      row.orderMatchAmbiguous.push(...(Array.isArray(event.orderMatchAmbiguous)?event.orderMatchAmbiguous:[]));
      eventMap.set(id,row);
    }
  }
  const combined=[...eventMap.values()].map(event=>({
    ...event,
    orderMatchStatus:event.orderMatchAmbiguous.length?'ambiguous':event.orderMatches.length?'matched':'unmatched',
  }));
  return {
    cycleId:current?.cycleId||null,
    cycleStartedAt:current?.cycleStartedAt||current?.updatedAt||null,
    historyDepth:maxDepth,
    workCycleIds:[...new Set(totals.map(row=>row.sourceCycleId).filter(Boolean))],
    orderTotals:totals,
    events:combined,
  };
}

export function aggregateVerifiedOrderTotals(memberMatches=[]){
  const buckets=new Map();
  for(const row of Array.isArray(memberMatches)?memberMatches:[]){
    const userId=String(row?.userId||'');
    const totals=Array.isArray(row?.matched?.orderTotals)?row.matched.orderTotals:[];
    for(const total of totals){
      const orderId=String(total?.orderId||'');
      if(!orderId)continue;
      const key=orderId+'|'+String(total?.sourceCycleId||'');
      const bucket=buckets.get(key)||{
        orderId,
        logicalKey:total.logicalKey||'',
        revision:Number(total.revision)||1,
        task:total.task||'Daily Order',
        type:total.type||'',
        system:total.system||'',
        faction:total.faction||'',
        target:numberOrNull(total.target),
        sourceCycleId:total.sourceCycleId||'',
        contribution:0,
        unit:total.unit||'',
        eventCount:0,
        sourceEventIds:new Set(),
        commanderIds:new Set(),
      };
      bucket.contribution=round(bucket.contribution+(Number(total.contribution)||0));
      bucket.eventCount+=Number(total.eventCount)||0;
      for(const id of Array.isArray(total.sourceEventIds)?total.sourceEventIds:[])if(id)bucket.sourceEventIds.add(String(id));
      if(userId&&(Number(total.contribution)||0)>0)bucket.commanderIds.add(userId);
      buckets.set(key,bucket);
    }
  }
  const out={};
  for(const bucket of buckets.values()){
    const current=out[bucket.orderId];
    const value={
      orderId:bucket.orderId,
      logicalKey:bucket.logicalKey,
      revision:bucket.revision,
      task:bucket.task,
      type:bucket.type,
      system:bucket.system,
      faction:bucket.faction,
      target:bucket.target,
      sourceCycleId:bucket.sourceCycleId,
      contribution:round(bucket.contribution),
      unit:bucket.unit,
      eventCount:bucket.eventCount,
      sourceEventCount:bucket.sourceEventIds.size,
      commanderCount:bucket.commanderIds.size,
    };
    if(!current||String(value.sourceCycleId)>=String(current.sourceCycleId))out[bucket.orderId]=value;
  }
  return out;
}

function activityComponents(event) {
  if (!event || typeof event !== 'object') return [];

  if (event.type === 'mission_inf') {
    return (Array.isArray(event.effects) ? event.effects : [])
      .map(effect => ({
        type:'inf',
        contribution:Number(effect?.infUnits)||0,
        unit:'INF',
        faction:clean(effect?.faction),
        system:clean(effect?.system || event.affectedSystem || event.system),
      }))
      .filter(item => item.contribution > 0 && item.faction && item.system);
  }

  if (event.type === 'bounties_redeemed') {
    const split = (Array.isArray(event.factions) ? event.factions : [])
      .map(item => ({
        type:'bounties',
        contribution:(Number(item?.amount)||0)/1_000_000,
        unit:'M Cr',
        faction:clean(item?.faction),
        system:clean(event.system),
      }))
      .filter(item => item.contribution > 0 && item.faction && item.system);
    if (split.length) return split;
    const faction = clean(event.faction);
    const amount = (Number(event.amount)||0)/1_000_000;
    return faction && amount > 0 && event.system ? [{
      type:'bounties',contribution:amount,unit:'M Cr',faction,system:clean(event.system)
    }] : [];
  }

  if (event.type === 'market_sell') {
    const profit = Number(event.profit);
    if (
      event.profitKnown !== true
      || event.bgsTradeEligible !== true
      || !Number.isFinite(profit)
      || profit <= 0
    ) return [];
    return [{
      type:'trade',
      contribution:profit/1_000_000,
      unit:'M Cr',
      faction:clean(event.stationFaction),
      system:clean(event.system),
    }].filter(item=>item.faction&&item.system);
  }

  if (event.type === 'exploration_sale') {
    const amount = Number(event.amount)||0;
    return amount > 0 ? [{
      type:'exploration',
      contribution:amount/1_000_000,
      unit:'M Cr',
      faction:clean(event.stationFaction),
      system:clean(event.system),
    }].filter(item=>item.faction&&item.system) : [];
  }

  return [];
}

function qualifies(order,component,event,cycleOffset) {
  const type=clean(order?.reporting?.type);
  if(type!==component.type)return false;
  if(norm(order.system)!==norm(component.system))return false;
  if(norm(order.faction)!==norm(component.faction))return false;

  const cycle=orderWorkCycleAt(order,cycleOffset);
  if(!cycle)return false;
  const eventTime=Date.parse(event?.timestamp||'');
  const start=Date.parse(cycle.acceptFromAt||cycle.cycleStartedAt||'');
  const end=Date.parse(cycle.cycleEndsAt||'');
  if(Number.isFinite(eventTime)&&Number.isFinite(start)&&eventTime<start)return false;
  if(Number.isFinite(eventTime)&&Number.isFinite(end)&&eventTime>=end)return false;
  return true;
}

function isActiveOrder(order) {return !CLOSED.has(norm(order?.status))}
function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null}
function clean(value){return typeof value==='string'?value.trim():''}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
function round(value){return Math.round((Number(value)||0)*1000)/1000}
