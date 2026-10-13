import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {missionSyncKey,mergeMissionSync,visibleMissionSyncRecords} from '../lib/scout-mission-sync.js';
import {onRequestGet,onRequestPost} from '../functions/api/operations/scout-mission-sync.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const now=Date.parse('2026-10-13T14:00:00Z');
const stamp=(minute)=>new Date(now+minute*60000).toISOString();
function mission(id,delivered=0,updatedAt=stamp(0)){
  return {missionId:id,name:'Mission_Collect',localisedName:'Collect Cargo',
    commodity:'gold',commodityName:'Gold',faction:'The Consortium',
    count:120,delivered,wing:false,destinationSystem:'Diaba',
    destinationStation:'Niijima Station',acceptedAt:stamp(0),updatedAt};
}
function upsert(m,when=m.updatedAt){return{kind:'upsert',missionId:m.missionId,occurredAt:when,mission:m};}
function closed(id,when){return{kind:'closed',missionId:id,occurredAt:when};}
assert.equal(missionSyncKey('user:A',' CMDR  Wolf '),
  'scout-mission-cargo-v1:user%3AA:cmdr%20wolf');
let state=mergeMissionSync(null,[upsert(mission(12345))],now+360000);
assert.equal(state.changed,true);
assert.equal(visibleMissionSyncRecords(state.state).length,1);
state=mergeMissionSync(state.state,[upsert(mission(12345,40,stamp(1)))],now+360000);
assert.equal(visibleMissionSyncRecords(state.state)[0].delivered,40);
state=mergeMissionSync(state.state,[upsert(mission(12345,0,stamp(0)))],now+360000);
assert.equal(visibleMissionSyncRecords(state.state)[0].delivered,40,'Old laptop cannot reduce delivered cargo');
state=mergeMissionSync(state.state,[closed(12345,stamp(3))],now+360000);
assert.equal(visibleMissionSyncRecords(state.state).length,0);
state=mergeMissionSync(state.state,[upsert(mission(12345,60,stamp(4)))],now+360000);
assert.equal(visibleMissionSyncRecords(state.state).length,0,'Closed mission must never resurrect');
assert.equal(state.state.records['12345'].closed,true);
assert.equal(mergeMissionSync(null,[{kind:'upsert',missionId:99,occurredAt:stamp(0),
  mission:{...mission(99),commodity:''}}],now+360000).rejected,1);

// Exercise the real Pages Function with two distinct Scout tokens for one owner.
// Verify that a different authenticated Commander cannot inspect or mutate it.
const kv=new Map();
const ownerId='shared-user',otherId='another-user';
const keys=[['mscout_Serenity',ownerId,'Wolf258'],['mscout_Laptop',ownerId,'Wolf258'],['mscout_Other',otherId,'Other CMDR']];
kv.set('wolf-bgs-scout-tokens-v1',{tokens:Object.fromEntries(keys.map(([token,ownerId,ownerCommander],i)=>[
  'id-'+i,{id:'id-'+i,hash:createHash('sha256').update(token).digest('hex'),ownerId,ownerCommander}
]))});
const env={DAILY_ORDERS:{
  async get(key){return structuredClone(kv.get(key)??null);},
  async put(key,value){kv.set(key,JSON.parse(value));},
}};
function request(method,token,commander,operations=[]){
  const url='https://mongrels-squadron.pages.dev/api/operations/scout-mission-sync'+
    (method==='GET'?'?commander='+encodeURIComponent(commander):'');
  return new Request(url,{
    method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    ...(method==='POST'?{body:JSON.stringify({version:1,commander,operations})}:{}),
  });
}
async function call(method,token,commander,ops=[]){
 const requestObject=request(method,token,commander,ops);
 const response=await (method==='GET'?onRequestGet({request:requestObject,env}):
   onRequestPost({request:requestObject,env}));
 return{status:response.status,body:await response.json()};
}
const liveStamp=new Date().toISOString();
const gold=mission(877,0,liveStamp);
gold.acceptedAt=liveStamp;
assert.equal((await call('POST','mscout_Laptop','Wolf258',[upsert(gold,liveStamp)])).status,200);
let remote=await call('GET','mscout_Serenity','Wolf258');
assert.equal(remote.status,200);
assert.equal(remote.body.missions[0].count,120);
assert.equal(remote.body.missions[0].faction,'The Consortium');
assert.equal(remote.body.missions[0].delivered,0);
assert.equal((await call('GET','mscout_Other','Wolf258')).status,403);
assert.equal((await call('GET','mscout_Other','Other CMDR')).body.missions.length,0);
assert.equal((await call('POST','mscout_Other','Wolf258',[upsert(gold,liveStamp)])).status,403);
assert.equal((await call('POST','mscout_Laptop','Wolf258',[{kind:'closed',missionId:877,occurredAt:liveStamp}])).status,200);
assert.equal((await call('GET','mscout_Serenity','Wolf258')).body.missions.length,0);
assert.equal((await call('POST','mscout_Serenity','Wolf258',[upsert(gold,liveStamp)])).status,200);
assert.equal((await call('GET','mscout_Laptop','Wolf258')).body.missions.length,0);
assert.equal((await call('POST','mscout_Laptop','Wolf258',[upsert({...gold,commodity:'invalid/payload'},liveStamp)])).status,400);
console.log('✓ Private per-Commander Scout mission sync: bootstrap, progress, tombstone and auth isolation');
