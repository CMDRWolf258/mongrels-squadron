import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildHudFeed} from '../functions/api/hud/feed.js';
import * as cycles from '../lib/daily-order-cycle.js';

// Pins the complete 245-system/10-order/1-route response, including the
// intentionally added carrier dialogue envelope. Time and data are fixed,
// rather than CPU milliseconds.
const EXPECTED_FEED_SHA256='a5610317ce36ba8fc89f97b2c17c66437442b69d021349c2afd79cbf571c35cd';
const stamp='2026-10-04T18:00:00.000Z';
const RealDate=Date;
globalThis.Date=class extends RealDate{
  constructor(...args){super(...(args.length?args:[stamp]));}
  static now(){return RealDate.parse(stamp);}
};
const NativeFormatter=Intl.DateTimeFormat;
let formatterConstructions=0,partsConversions=0;
Intl.DateTimeFormat=new Proxy(NativeFormatter,{
  construct(target,args,newTarget){
    formatterConstructions++;
    const formatter=Reflect.construct(target,args,newTarget);
    const original=formatter.formatToParts.bind(formatter);
    formatter.formatToParts=date=>{partsConversions++;return original(date);};
    return formatter;
  },
});
const systems=Array.from({length:245},(_,i)=>({name:i?'Fixture '+String(i).padStart(3,'0'):'Diaba',present:true,influence:50,coords:{x:i,y:0,z:1},sourceUpdated:stamp}));
const current={title:'Fixture10orders',configured:true,cycleId:'fixture',orders:systems.slice(0,10).map((s,i)=>({id:'fixture-order-'+i,system:s.name,faction:'Regiment of Imperial Mongrels',task:'Win CZs',priority:'HIGH',status:'active'}))};
const records=new Map([
  ['current',current],
  ['wolf-bgs-control-v1',{defaults:{defaultTick:'19:00',transitionMinutes:90,lateGraceHours:3,rolloverPolicy:'safety'},systemSettings:Object.fromEntries(systems.map((s,i)=>[s.name,i%11===0?{customTick:'18:15'}:{}]))}],
  ['trade-board-v1',[{id:'fixture-trade',title:'Fixture Trade',status:'active',estimatedLoopProfit:1000000}]],
]);
const store={
  async get(key){return structuredClone(records.get(key)??null);},
  async put(key,value){records.set(key,JSON.parse(value));},
  async list(){return{keys:[],list_complete:true};},
};
const env={DAILY_ORDERS:store,PROJECTS:store,TRADES:store,ADMIN_USER_ID:'fixture-admin'};
globalThis.fetch=async()=>Response.json({faction:'Regiment of Imperial Mongrels',systems});
const feed=await buildHudFeed(new Request('https://example.invalid/api/hud/feed'),env,{ownerId:'fixture-admin',ownerCommander:'Fixture CMDR'});
assert.equal(feed.mission.orderCount,10);
assert.equal(feed.trade.activeCount,1);
assert.equal(feed.scout.jobs.length,245);
assert.deepEqual(feed.carriers,[]);
assert.deepEqual(feed.carrierDialogue,{});
assert.equal(feed.carrierDialogueUpdatedAt,null);
assert.equal(createHash('sha256').update(JSON.stringify(feed)).digest('hex'),EXPECTED_FEED_SHA256,'Optimization must preserve the complete expected feed shape');
assert.ok(formatterConstructions<=2,`245-system feed recreated ${formatterConstructions} expensive timezone formatters`);
assert.ok(partsConversions<=40,`245-system feed repeated ${partsConversions} identical calendar conversions`);
console.log(`Full 245-system feed retains all legacy data with ${formatterConstructions} formatter construction and ${partsConversions} calendar conversions`);

// Compare every exposed clock field with the two original uncached conversion
// functions. All surrounding cycle logic is the same; only reuse is under test.
const legacyConversions=`function zonedParts(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const value=type=>Number(parts.find(part=>part.type===type)?.value||0);
  return{year:value('year'),month:value('month'),day:value('day'),hour:value('hour'),minute:value('minute'),second:value('second')};
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
`;
const source=readFileSync(new URL('../lib/daily-order-cycle.js',import.meta.url),'utf8');
const start=source.indexOf('function zonedParts('),end=source.indexOf('function addDays(',start);
assert.ok(start>0&&end>start);
const legacy=await import('data:text/javascript;base64,'+Buffer.from(source.slice(0,start)+legacyConversions+source.slice(end)).toString('base64'));
const control={defaults:{defaultTick:'19:00',transitionMinutes:90,lateGraceHours:3,rolloverPolicy:'safety'},systemSettings:{Diaba:{customTick:'18:15',rolloverPolicy:'strict'}}};
const instants=[
  '2026-10-05T00:00:00.000Z', // Chicago evening clock.
  '2026-10-05T00:29:59.999Z','2026-10-05T00:30:00.000Z', // Custom tick transition boundary.
  '2026-10-05T00:30:00.001Z',
  '2026-10-04T23:14:59.999Z','2026-10-04T23:15:00.000Z','2026-10-04T23:15:00.001Z',
  '2026-03-08T07:59:59.999Z','2026-03-08T08:00:00.000Z','2026-03-09T01:00:00.000Z', // Spring DST.
  '2026-11-01T06:59:59.999Z','2026-11-01T07:00:00.000Z','2026-11-02T01:00:00.000Z', // Autumn DST.
  '2026-12-31T23:59:59.999Z','2027-01-01T00:00:00.000Z',
];
function compareClock(control,instant,offset=0){
  const args={now:new Date(instant),offset};
  for(const system of ['Diaba','Default System'])assert.deepEqual(cycles.resolveSystemWorkCycle(system,control,args),legacy.resolveSystemWorkCycle(system,control,args));
}
for(const instant of instants)for(const offset of [0,1,14,30])compareClock(control,instant,offset);
for(const tick of ['00:00','02:15','19:00','23:59']){
  control.defaults.defaultTick=tick;
  control.systemSettings.Diaba.customTick=tick;
  for(const policy of ['strict','safety','carry']){
    control.defaults.rolloverPolicy=policy;
    control.systemSettings.Diaba.rolloverPolicy=policy;
    control.defaults.transitionMinutes=policy==='strict'?0:90;
    control.defaults.lateGraceHours=policy==='carry'?24:3;
    for(const instant of instants)compareClock(control,instant);
  }
}
// More than 256 distinct dates exercise bounded reuse eviction and revisiting
// older inputs; new tick/date/timezone keys must never reuse a stale conversion.
for(let i=0;i<270;i++){
  const instant=new Date(Date.parse('2025-01-01T12:00:00.000Z')+i*86_400_000).toISOString();
  compareClock(control,instant);
}
compareClock(control,instants[0]);
for(const timeZone of ['America/Chicago','UTC','Europe/London']){
  for(const instant of instants){
    assert.equal(cycles.nextConfiguredTickAfter(instant,'19:00',timeZone),legacy.nextConfiguredTickAfter(instant,'19:00',timeZone));
    assert.equal(cycles.configuredTicksElapsed(instant,new Date(Date.parse(instant)+3*86_400_000),'19:00',timeZone),legacy.configuredTicksElapsed(instant,new Date(Date.parse(instant)+3*86_400_000),'19:00',timeZone));
  }
}
Intl.DateTimeFormat=NativeFormatter;
globalThis.Date=RealDate;
console.log('Calendar reuse preserves edited ticks/defaults/rollover, exact phase boundaries, DST, offsets, time progression and eviction');
