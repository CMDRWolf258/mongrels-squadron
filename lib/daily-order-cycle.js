const CONTROL_KEY='wolf-bgs-control-v1';

export const DAILY_ORDER_TICK_TIMEZONE='America/Chicago';
export const DAILY_ORDER_TIMING_DEFAULTS=Object.freeze({
  defaultTick:'19:00',
  transitionMinutes:90,
  lateGraceHours:3,
  rolloverPolicy:'safety',
});

export async function readDailyOrderTimingControl(env){
  let stored=null;
  if(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'){
    try{stored=await env.DAILY_ORDERS.get(CONTROL_KEY,{type:'json'});}
    catch(error){console.error('Could not read Daily Order timing control',error);}
  }
  const source=stored&&typeof stored==='object'?stored:{};
  const rawDefaults=source.defaults&&typeof source.defaults==='object'?source.defaults:{};
  const defaults={
    defaultTick:validTime(rawDefaults.defaultTick)?rawDefaults.defaultTick:DAILY_ORDER_TIMING_DEFAULTS.defaultTick,
    transitionMinutes:clamp(rawDefaults.transitionMinutes,0,360,DAILY_ORDER_TIMING_DEFAULTS.transitionMinutes),
    lateGraceHours:clamp(rawDefaults.lateGraceHours,0,24,DAILY_ORDER_TIMING_DEFAULTS.lateGraceHours),
    rolloverPolicy:['strict','safety','carry'].includes(rawDefaults.rolloverPolicy)?rawDefaults.rolloverPolicy:DAILY_ORDER_TIMING_DEFAULTS.rolloverPolicy,
  };
  const systemSettings=source.systemSettings&&typeof source.systemSettings==='object'?source.systemSettings:{};
  return {defaults,systemSettings,tickTimezone:DAILY_ORDER_TICK_TIMEZONE};
}

export async function decorateDailyOrdersForTiming(env,document,{now=new Date(),historyDepth=0}={}){
  if(!document||typeof document!=='object')return document;
  const control=await readDailyOrderTimingControl(env);
  const depth=Math.max(0,Math.min(30,Math.floor(Number(historyDepth)||0)));
  const orders=(Array.isArray(document.orders)?document.orders:[]).map(order=>{
    const timing=resolveOrderWorkCycle(order,control,{now,offset:0});
    const history=[];
    for(let offset=1;offset<=depth;offset+=1)history.push(resolveOrderWorkCycle(order,control,{now,offset}));
    return {...order,workCycle:timing,...(depth?{workCycleHistory:history}:{})};
  });
  const targets=orders
    .map(order=>order?.workCycle)
    .filter(Boolean)
    .map(cycle=>cycle.phase==='transition'?cycle.cycleEndsAt:cycle.estimatedTickAt)
    .filter(Boolean)
    .sort();
  return {
    ...document,
    cycleMode:'per-system-tick',
    timingDefaults:{
      defaultTick:control.defaults.defaultTick,
      transitionMinutes:control.defaults.transitionMinutes,
      lateGraceHours:control.defaults.lateGraceHours,
      rolloverPolicy:control.defaults.rolloverPolicy,
      timezone:DAILY_ORDER_TICK_TIMEZONE,
      timezoneLabel:'CT',
    },
    nextTimingAt:targets[0]||null,
    orders,
  };
}

export function resolveSystemWorkCycle(systemName,control,{now=new Date(),offset=0}={}){
  const settings=systemTimingSettings(systemName,control);
  const clock=cycleForTick(settings.tick,settings.transitionMinutes,now,offset,DAILY_ORDER_TICK_TIMEZONE);
  const system=clean(systemName)||'Squad-wide';
  return {
    version:2,
    cycleId:workCycleId(system,clock.cycleStartedAt),
    system,
    tickConfiguredTime:settings.tick,
    tickTimezone:DAILY_ORDER_TICK_TIMEZONE,
    tickTimezoneLabel:'CT',
    tickUtc:utcClock(clock.estimatedTickAt),
    estimatedTickAt:clock.estimatedTickAt,
    transitionEndsAt:clock.cycleEndsAt,
    cycleStartedAt:clock.cycleStartedAt,
    cycleEndsAt:clock.cycleEndsAt,
    lateReportGraceEndsAt:new Date(Date.parse(clock.cycleEndsAt)+settings.lateGraceHours*3_600_000).toISOString(),
    phase:clock.phase,
    transitionMinutes:settings.transitionMinutes,
    lateGraceHours:settings.lateGraceHours,
    rolloverPolicy:settings.rolloverPolicy,
    customTick:settings.customTick,
    offset:Math.max(0,Math.floor(Number(offset)||0)),
  };
}

export function resolveOrderWorkCycle(order,control,{now=new Date(),offset=0}={}){
  const clock=resolveSystemWorkCycle(order?.system,control,{now,offset});
  const createdAt=iso(order?.createdAt);
  return {
    ...clock,
    acceptFromAt:laterIso(clock.cycleStartedAt,createdAt),
  };
}

export function orderWorkCycleAt(order,offset=0){
  const wanted=Math.max(0,Math.floor(Number(offset)||0));
  if(wanted===0)return order?.workCycle||null;
  return Array.isArray(order?.workCycleHistory)?order.workCycleHistory[wanted-1]||null:null;
}

export function orderWorkCycleId(order,fallback='',offset=0){
  return clean(orderWorkCycleAt(order,offset)?.cycleId)||clean(fallback);
}

export function workCycleForTimestamp(order,timestamp){
  const time=Date.parse(timestamp||'');
  if(!Number.isFinite(time))return null;
  const cycles=[order?.workCycle,...(Array.isArray(order?.workCycleHistory)?order.workCycleHistory:[])].filter(Boolean);
  for(const cycle of cycles){
    const start=Date.parse(cycle.acceptFromAt||cycle.cycleStartedAt||'');
    const end=Date.parse(cycle.cycleEndsAt||'');
    if(Number.isFinite(start)&&Number.isFinite(end)&&time>=start&&time<end)return cycle;
  }
  return null;
}

function systemTimingSettings(system,control={}){
  const defaults=control?.defaults||DAILY_ORDER_TIMING_DEFAULTS;
  const systems=control?.systemSettings&&typeof control.systemSettings==='object'?control.systemSettings:{};
  const wanted=norm(system);
  let settings={};
  for(const [name,value] of Object.entries(systems)){
    if(norm(name)===wanted){settings=value&&typeof value==='object'?value:{};break;}
  }
  const customTick=validTime(settings.customTick)?settings.customTick:'';
  return {
    tick:customTick||defaults.defaultTick||DAILY_ORDER_TIMING_DEFAULTS.defaultTick,
    customTick:Boolean(customTick),
    transitionMinutes:clamp(defaults.transitionMinutes,0,360,DAILY_ORDER_TIMING_DEFAULTS.transitionMinutes),
    lateGraceHours:clamp(defaults.lateGraceHours,0,24,DAILY_ORDER_TIMING_DEFAULTS.lateGraceHours),
    rolloverPolicy:['strict','safety','carry'].includes(settings.rolloverPolicy)
      ? settings.rolloverPolicy
      : (defaults.rolloverPolicy||DAILY_ORDER_TIMING_DEFAULTS.rolloverPolicy),
  };
}

function cycleForTick(tick,transitionMinutes,now,offset=0,timeZone=DAILY_ORDER_TICK_TIMEZONE){
  const instant=now instanceof Date?now:new Date(now);
  const nowMs=Number.isFinite(instant.getTime())?instant.getTime():Date.now();
  const local=zonedParts(new Date(nowMs),timeZone);
  const today={year:local.year,month:local.month,day:local.day};
  const {hour,minute}=tickParts(tick);
  const transitionMs=transitionMinutes*60_000;
  const todayTickMs=Date.parse(zonedLocalIso(today,hour,minute,timeZone));

  let tickDate=today;
  let phase;
  if(nowMs<todayTickMs){
    phase='pre_tick';
  }else if(nowMs<todayTickMs+transitionMs){
    phase='transition';
  }else{
    tickDate=addDays(today,1);
    phase='pre_tick';
  }

  const back=Math.max(0,Math.floor(Number(offset)||0));
  if(back){
    tickDate=addDays(tickDate,-back);
    phase='closed';
  }

  const tickMs=Date.parse(zonedLocalIso(tickDate,hour,minute,timeZone));
  const previousTickDate=addDays(tickDate,-1);
  const previousTickMs=Date.parse(zonedLocalIso(previousTickDate,hour,minute,timeZone));

  return {
    phase,
    estimatedTickAt:new Date(tickMs).toISOString(),
    cycleStartedAt:new Date(previousTickMs+transitionMs).toISOString(),
    cycleEndsAt:new Date(tickMs+transitionMs).toISOString(),
  };
}

function zonedParts(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hourCycle:'h23',
  }).formatToParts(date);
  const value=type=>Number(parts.find(part=>part.type===type)?.value||0);
  return {
    year:value('year'),
    month:value('month'),
    day:value('day'),
    hour:value('hour'),
    minute:value('minute'),
    second:value('second'),
  };
}

function zonedLocalIso(dateParts,hour,minute,timeZone){
  const desiredWall=Date.UTC(dateParts.year,dateParts.month-1,dateParts.day,hour,minute,0,0);
  let guess=desiredWall;
  for(let i=0;i<4;i+=1){
    const actual=zonedParts(new Date(guess),timeZone);
    const actualWall=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second,0);
    const diff=desiredWall-actualWall;
    if(Math.abs(diff)<1000)break;
    guess+=diff;
  }
  return new Date(guess).toISOString();
}

function addDays(parts,days){
  const date=new Date(Date.UTC(parts.year,parts.month-1,parts.day+days,12,0,0));
  return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};
}

function workCycleId(system,startAt){
  const slug=norm(system).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,44)||'squad-wide';
  const stamp=String(startAt||'').replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z').replace('T','t').toLowerCase();
  return ('tick-v2:'+slug+':'+stamp).slice(0,100);
}
function tickParts(value){
  const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return{hour:19,minute:0};
  const hour=Number(match[1]),minute=Number(match[2]);
  return Number.isFinite(hour)&&Number.isFinite(minute)&&hour>=0&&hour<=23&&minute>=0&&minute<=59?{hour,minute}:{hour:19,minute:0};
}
function validTime(value){return /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(String(value||''))}
function utcClock(value){const date=new Date(value||'');return Number.isNaN(date.getTime())?'':date.toISOString().slice(11,16)}
function laterIso(a,b){const aa=Date.parse(a||''),bb=Date.parse(b||'');if(Number.isFinite(aa)&&Number.isFinite(bb))return new Date(Math.max(aa,bb)).toISOString();return iso(a)||iso(b)}
function iso(value){if(!value)return null;const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null}
function clamp(value,min,max,fallback){const number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
