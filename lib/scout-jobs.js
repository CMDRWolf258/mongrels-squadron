import { readDailyOrderTimingControl, resolveSystemWorkCycle } from './daily-order-cycle.js';

export const SCOUT_JOB_SETTINGS_KEY='scout-jobs-settings-v1';
export const SCOUT_JOB_STATE_KEY='scout-jobs-state-v1';
export const SCOUT_SNAPSHOTS_KEY='wolf-bgs-scout-snapshots-v1';
export const SCOUT_TOKEN_KEY='wolf-bgs-scout-tokens-v1';
export const SCOUT_CLAIM_MINUTES=60;

const MAX_CYCLE_RECORDS=5000;
const MAX_OBSERVATIONS_PER_CYCLE=24;
const HISTORY_DAYS=60;

export const DEFAULT_SCOUT_JOB_SETTINGS=Object.freeze({
  version:1,
  defaultRewardMillions:0,
  systems:{},
});

export async function readScoutJobSettings(env){
  const empty=normalizeScoutJobSettings(DEFAULT_SCOUT_JOB_SETTINGS);
  if(!storageReady(env))return empty;
  try{
    const stored=await env.DAILY_ORDERS.get(SCOUT_JOB_SETTINGS_KEY,{type:'json'});
    return normalizeScoutJobSettings(stored||empty);
  }catch(error){
    console.error('Could not read Scout Job settings',error);
    return empty;
  }
}

export async function writeScoutJobSettings(env,value,{actor='Site Admin'}={}){
  if(!storageReady(env))throw new Error('scout_job_storage_not_configured');
  const settings=normalizeScoutJobSettings(value);
  const stored={
    ...settings,
    updatedAt:new Date().toISOString(),
    updatedBy:clean(actor)||'Site Admin',
  };
  await env.DAILY_ORDERS.put(SCOUT_JOB_SETTINGS_KEY,JSON.stringify(stored));
  return stored;
}

export function normalizeScoutJobSettings(value={}){
  const source=value&&typeof value==='object'?value:{};
  const systems={};
  for(const [name,row] of Object.entries(source.systems&&typeof source.systems==='object'?source.systems:{})){
    const system=clean(name).slice(0,140);
    if(!system||!row||typeof row!=='object')continue;
    systems[system]={
      enabled:row.enabled!==false,
      bonusMillions:bounded(row.bonusMillions,0,0,100000),
      reason:clean(row.reason).slice(0,240),
      bonusOnce:row.bonusOnce!==false,
      updatedAt:iso(row.updatedAt),
      updatedBy:clean(row.updatedBy).slice(0,120),
    };
  }
  return {
    version:1,
    defaultRewardMillions:bounded(source.defaultRewardMillions,0,0,100000),
    systems,
    updatedAt:iso(source.updatedAt),
    updatedBy:clean(source.updatedBy).slice(0,120),
  };
}

export async function readScoutJobState(env){
  const empty={version:1,cycles:{}};
  if(!storageReady(env))return empty;
  try{
    const stored=await env.DAILY_ORDERS.get(SCOUT_JOB_STATE_KEY,{type:'json'});
    if(!stored||typeof stored!=='object')return empty;
    return {version:1,cycles:stored.cycles&&typeof stored.cycles==='object'?stored.cycles:{}};
  }catch(error){
    console.error('Could not read Scout Job state',error);
    return empty;
  }
}

export async function writeScoutJobState(env,state){
  if(!storageReady(env))throw new Error('scout_job_storage_not_configured');
  const pruned=pruneScoutJobState(state);
  await env.DAILY_ORDERS.put(SCOUT_JOB_STATE_KEY,JSON.stringify(pruned));
  return pruned;
}

export async function readScoutSnapshots(env){
  const empty={version:1,systems:{},conflictHistory:{}};
  if(!storageReady(env))return empty;
  try{
    const stored=await env.DAILY_ORDERS.get(SCOUT_SNAPSHOTS_KEY,{type:'json'});
    return stored&&typeof stored==='object'
      ? {version:1,systems:stored.systems&&typeof stored.systems==='object'?stored.systems:{},conflictHistory:stored.conflictHistory&&typeof stored.conflictHistory==='object'?stored.conflictHistory:{}}
      : empty;
  }catch(error){
    console.error('Could not read Scout snapshots for jobs',error);
    return empty;
  }
}

export async function listBoundScoutTokens(env,ownerId=''){
  if(!storageReady(env))return[];
  try{
    const stored=await env.DAILY_ORDERS.get(SCOUT_TOKEN_KEY,{type:'json'});
    const rows=Object.values(stored?.tokens&&typeof stored.tokens==='object'?stored.tokens:{});
    return rows
      .filter(row=>row&&clean(row.ownerId)&&(ownerId?clean(row.ownerId)===clean(ownerId):true))
      .map(row=>({
        id:clean(row.id).slice(0,80),
        label:clean(row.label).slice(0,80),
        ownerId:clean(row.ownerId),
        ownerCommander:clean(row.ownerCommander).slice(0,80),
        scope:row.scope==='restricted'?'restricted':'trusted',
        allowedSystems:Array.isArray(row.allowedSystems)?row.allowedSystems.map(clean).filter(Boolean).slice(0,80):[],
      }));
  }catch(error){
    console.error('Could not read bound Scout tokens',error);
    return[];
  }
}

export async function buildScoutJobBoard(env,{
  systems=[],
  viewer=null,
  now=new Date(),
  includeDisabled=false,
}={}){
  const [settings,state,control,snapshots,boundTokens]=await Promise.all([
    readScoutJobSettings(env),
    readScoutJobState(env),
    readDailyOrderTimingControl(env),
    readScoutSnapshots(env),
    viewer?.userId?listBoundScoutTokens(env,viewer.userId):Promise.resolve([]),
  ]);

  const resolved=resolveExpiredClaimsInState(state,settings,now);
  if(resolved.changed){
    await Promise.all([
      writeScoutJobState(env,state),
      resolved.settingsChanged?writeScoutJobSettings(env,settings,{actor:'Scout Job rollover'}):Promise.resolve(),
    ]);
  }

  const rows=[];
  const seen=new Set();
  for(const raw of Array.isArray(systems)?systems:[]){
    const system=clean(typeof raw==='string'?raw:raw?.name).slice(0,140);
    const key=norm(system);
    if(!system||seen.has(key))continue;
    seen.add(key);
    const systemRule=findSystemRule(settings,system);
    if(systemRule.enabled===false&&!includeDisabled)continue;

    const cycle=resolveSystemWorkCycle(system,control,{now});
    const cycleRecord=state.cycles[cycleRecordKey(system,cycle.cycleId)]||null;
    const snapshot=findSystemSnapshot(snapshots.systems,system);
    const latestScoutAt=iso(snapshot?.updatedAt);
    const dataFresh=isWithinCycle(latestScoutAt,cycle);
    const activeClaim=cycleRecord?.claim&&!cycleRecord?.winner&&Date.parse(cycleRecord.claim.expiresAt||'')>dateMs(now)
      ? cycleRecord.claim
      : null;
    const reward=rewardSnapshot(settings,system);
    const viewerObservation=viewer?.userId&&cycleRecord
      ? [...(cycleRecord.observations||[])].reverse().find(obs=>clean(obs.ownerId)===clean(viewer.userId))||null
      : null;

    let status=systemRule.enabled===false?'disabled':'available';
    if(systemRule.enabled!==false){
      if(cycleRecord?.winner)status='fresh';
      else if(dataFresh)status='fresh_unattributed';
      else if(activeClaim)status='claimed';
    }

    rows.push({
      system,
      status,
      cycle,
      reward,
      latestScoutAt,
      dataFresh,
      claim:activeClaim?publicClaim(activeClaim,viewer?.userId):null,
      winner:cycleRecord?.winner?publicWinner(cycleRecord.winner,viewer?.userId):null,
      runnerUpCount:(cycleRecord?.observations||[]).filter(obs=>obs.status==='runner_up').length,
      viewerObservation:viewerObservation?publicObservation(viewerObservation):null,
      enabled:systemRule.enabled!==false,
      canClaim:status==='available'&&Boolean(viewer?.userId)&&boundTokens.length>0,
      canRelease:Boolean(activeClaim&&viewer?.userId&&clean(activeClaim.ownerId)===clean(viewer.userId)),
    });
  }

  rows.sort((a,b)=>
    Number(b.reward.bonusMillions>0)-Number(a.reward.bonusMillions>0)
    || scoutStatusRank(a.status)-scoutStatusRank(b.status)
    || a.system.localeCompare(b.system)
  );

  return {
    version:1,
    generatedAt:new Date(dateMs(now)).toISOString(),
    defaultRewardMillions:settings.defaultRewardMillions,
    claimMinutes:SCOUT_CLAIM_MINUTES,
    viewer:{
      userId:clean(viewer?.userId),
      displayName:clean(viewer?.displayName)||'Mongrel Member',
      commander:clean(viewer?.commander),
      scoutBound:boundTokens.length>0,
      scoutTokens:boundTokens.map(row=>({id:row.id,label:row.label,scope:row.scope})),
    },
    summary:{
      systems:rows.length,
      available:rows.filter(row=>row.status==='available').length,
      claimed:rows.filter(row=>row.status==='claimed').length,
      fresh:rows.filter(row=>row.status==='fresh'||row.status==='fresh_unattributed').length,
      priority:rows.filter(row=>row.reward.bonusMillions>0&&row.status!=='fresh'&&row.status!=='fresh_unattributed').length,
    },
    jobs:rows,
    settings,
  };
}

export async function claimScoutJob(env,{system,ownerId,commander,now=new Date()}={}){
  if(!storageReady(env))throw new Error('scout_job_storage_not_configured');
  const [settings,state,control]=await Promise.all([
    readScoutJobSettings(env),
    readScoutJobState(env),
    readDailyOrderTimingControl(env),
  ]);
  const cleanSystem=clean(system).slice(0,140);
  const cleanOwner=clean(ownerId);
  if(!cleanSystem||!cleanOwner)throw new Error('scout_job_claim_invalid');
  const rule=findSystemRule(settings,cleanSystem);
  if(rule.enabled===false)throw new Error('scout_job_disabled');

  const changedBefore=resolveExpiredClaimsInState(state,settings,now);
  if(changedBefore.changed){
    await Promise.all([
      writeScoutJobState(env,state),
      changedBefore.settingsChanged?writeScoutJobSettings(env,settings,{actor:'Scout Job rollover'}):Promise.resolve(),
    ]);
  }
  const cycle=resolveSystemWorkCycle(cleanSystem,control,{now});
  const key=cycleRecordKey(cleanSystem,cycle.cycleId);
  const record=state.cycles[key]||createCycleRecord(cleanSystem,cycle);
  state.cycles[key]=record;
  if(record.winner)throw new Error('scout_job_already_awarded');

  const nowIso=new Date(dateMs(now)).toISOString();
  const active=record.claim&&Date.parse(record.claim.expiresAt||'')>dateMs(now);
  if(active&&clean(record.claim.ownerId)!==cleanOwner)throw new Error('scout_job_claimed_by_another');
  if(active&&clean(record.claim.ownerId)===cleanOwner){
    return {record,claim:record.claim,alreadyClaimed:true};
  }

  const boundary=Date.parse(cycle.cycleEndsAt||'');
  const requested=dateMs(now)+SCOUT_CLAIM_MINUTES*60_000;
  const expiresAt=new Date(Number.isFinite(boundary)?Math.min(requested,boundary):requested).toISOString();
  record.claim={
    id:'claim-'+crypto.randomUUID(),
    ownerId:cleanOwner,
    commander:clean(commander)||'Mongrel CMDR',
    claimedAt:nowIso,
    expiresAt,
    rewardSnapshot:rewardSnapshot(settings,cleanSystem),
  };
  record.updatedAt=nowIso;
  await writeScoutJobState(env,state);
  return {record,claim:record.claim,alreadyClaimed:false};
}

export async function releaseScoutJobClaim(env,{system,ownerId,now=new Date()}={}){
  const [settings,state,control]=await Promise.all([
    readScoutJobSettings(env),
    readScoutJobState(env),
    readDailyOrderTimingControl(env),
  ]);
  const cleanSystem=clean(system).slice(0,140);
  const cycle=resolveSystemWorkCycle(cleanSystem,control,{now});
  const record=state.cycles[cycleRecordKey(cleanSystem,cycle.cycleId)];
  if(!record?.claim||record.winner)return {released:false};
  if(clean(record.claim.ownerId)!==clean(ownerId))throw new Error('scout_job_claim_not_owned');
  record.claim=null;
  record.updatedAt=new Date(dateMs(now)).toISOString();

  // Releasing immediately promotes the earliest protected runner-up.
  const promoted=promoteEarliestRunnerUp(record,settings);
  await Promise.all([
    writeScoutJobState(env,state),
    promoted.settingsChanged?writeScoutJobSettings(env,settings,{actor:'Scout Job claim release'}):Promise.resolve(),
  ]);
  return {released:true,promoted:promoted.winner||null};
}

export async function hasActiveScoutClaim(env,{system,ownerId,at=new Date()}={}){
  const [state,control]=await Promise.all([readScoutJobState(env),readDailyOrderTimingControl(env)]);
  const cycle=resolveSystemWorkCycle(system,control,{now:at});
  const record=state.cycles[cycleRecordKey(system,cycle.cycleId)];
  if(!record?.claim||record.winner)return false;
  const when=dateMs(at);
  return clean(record.claim.ownerId)===clean(ownerId)
    && Date.parse(record.claim.claimedAt||'')<=when
    && Date.parse(record.claim.expiresAt||'')>when;
}

export async function recordScoutObservation(env,{
  system,
  systemAddress=null,
  ownerId='',
  commander='',
  tokenId='',
  tokenLabel='',
  observedAt,
  receivedAt=new Date().toISOString(),
}={}){
  if(!storageReady(env))return {recorded:false,reason:'storage_unavailable'};
  const cleanSystem=clean(system).slice(0,140);
  const observationTime=iso(observedAt);
  const receivedTime=iso(receivedAt)||new Date().toISOString();
  if(!cleanSystem||!observationTime)return {recorded:false,reason:'invalid_observation'};

  const [settings,state,control]=await Promise.all([
    readScoutJobSettings(env),
    readScoutJobState(env),
    readDailyOrderTimingControl(env),
  ]);
  const rule=findSystemRule(settings,cleanSystem);
  if(rule.enabled===false)return {recorded:false,reason:'job_disabled'};

  const before=resolveExpiredClaimsInState(state,settings,new Date(receivedTime));
  const cycle=resolveSystemWorkCycle(cleanSystem,control,{now:new Date(observationTime)});
  const key=cycleRecordKey(cleanSystem,cycle.cycleId);
  const record=state.cycles[key]||createCycleRecord(cleanSystem,cycle);
  state.cycles[key]=record;

  const observationId=await digestText([
    'scout-observation-v1',
    cleanSystem,
    String(systemAddress??''),
    clean(tokenId),
    clean(ownerId),
    observationTime,
  ].join('|'));
  const existing=(record.observations||[]).find(row=>row.id===observationId);
  if(existing){
    if(before.changed)await Promise.all([
      writeScoutJobState(env,state),
      before.settingsChanged?writeScoutJobSettings(env,settings,{actor:'Scout Job rollover'}):Promise.resolve(),
    ]);
    return {recorded:false,duplicate:true,observation:existing,winner:record.winner||null};
  }

  const attributed=Boolean(clean(ownerId));
  const activeClaim=record.claim&&!record.winner&&Date.parse(record.claim.expiresAt||'')>Date.parse(receivedTime)
    ? record.claim
    : null;
  const observation={
    id:observationId,
    system:cleanSystem,
    systemAddress:Number.isSafeInteger(Number(systemAddress))?Number(systemAddress):null,
    ownerId:clean(ownerId),
    commander:clean(commander)||clean(tokenLabel)||'Unattributed Scout',
    tokenId:clean(tokenId).slice(0,80),
    tokenLabel:clean(tokenLabel).slice(0,80),
    observedAt:observationTime,
    receivedAt:receivedTime,
    rewardSnapshot:rewardSnapshot(settings,cleanSystem),
    status:'non_rewarded',
    note:'',
  };

  if(record.winner){
    observation.status='non_rewarded';
    observation.note='Reward already awarded for this system cycle';
  }else if(!attributed){
    observation.status='unattributed';
    observation.note='Scout token is not bound to a Mongrel account';
  }else if(activeClaim){
    if(clean(activeClaim.ownerId)===clean(ownerId)){
      observation.status='winner';
      selectWinner(record,observation,activeClaim.rewardSnapshot||observation.rewardSnapshot,'claimed');
    }else{
      observation.status='runner_up';
      observation.note='Protected by another CMDR claim until '+activeClaim.expiresAt;
    }
  }else{
    observation.status='winner';
    selectWinner(record,observation,observation.rewardSnapshot,'first_valid');
  }

  record.observations=[...(record.observations||[]),observation]
    .sort((a,b)=>String(a.receivedAt||'').localeCompare(String(b.receivedAt||'')))
    .slice(-MAX_OBSERVATIONS_PER_CYCLE);
  record.updatedAt=receivedTime;

  let settingsChanged=before.settingsChanged;
  if(record.winner&&record.winner.observationId===observation.id){
    settingsChanged=consumeOneShotBonus(settings,cleanSystem,record.winner)||settingsChanged;
  }

  await Promise.all([
    writeScoutJobState(env,state),
    settingsChanged?writeScoutJobSettings(env,settings,{actor:'Scout Job completion'}):Promise.resolve(),
  ]);

  return {
    recorded:true,
    observation,
    winner:record.winner||null,
    status:observation.status,
    cycleId:cycle.cycleId,
  };
}

export async function listScoutRewardWinners(env,{now=new Date()}={}){
  const [settings,state]=await Promise.all([readScoutJobSettings(env),readScoutJobState(env)]);
  const resolved=resolveExpiredClaimsInState(state,settings,now);
  if(resolved.changed){
    await Promise.all([
      writeScoutJobState(env,state),
      resolved.settingsChanged?writeScoutJobSettings(env,settings,{actor:'Scout Reward resolution'}):Promise.resolve(),
    ]);
  }
  return Object.values(state.cycles||{})
    .filter(record=>record?.winner)
    .map(record=>({
      system:record.system,
      cycleId:record.cycleId,
      cycleStartedAt:record.cycleStartedAt,
      cycleEndsAt:record.cycleEndsAt,
      estimatedTickAt:record.estimatedTickAt,
      winner:record.winner,
    }))
    .sort((a,b)=>String(b.winner?.awardedAt||'').localeCompare(String(a.winner?.awardedAt||'')));
}

function resolveExpiredClaimsInState(state,settings,now){
  const nowMs=dateMs(now);
  let changed=false,settingsChanged=false;
  for(const record of Object.values(state?.cycles||{})){
    if(!record||record.winner||!record.claim)continue;
    const expires=Date.parse(record.claim.expiresAt||'');
    if(!Number.isFinite(expires)||expires>nowMs)continue;
    const promoted=promoteEarliestRunnerUp(record,settings);
    record.claim=null;
    record.updatedAt=new Date(nowMs).toISOString();
    changed=true;
    if(promoted.settingsChanged)settingsChanged=true;
  }
  return {changed,settingsChanged};
}

function promoteEarliestRunnerUp(record,settings){
  if(record?.winner)return {winner:record.winner,settingsChanged:false};
  const runner=[...(record?.observations||[])]
    .filter(obs=>obs?.status==='runner_up'&&clean(obs.ownerId))
    .sort((a,b)=>String(a.receivedAt||'').localeCompare(String(b.receivedAt||'')))[0];
  if(!runner)return {winner:null,settingsChanged:false};
  runner.status='winner';
  runner.note='Promoted after protected claim expired or was released';
  selectWinner(record,runner,runner.rewardSnapshot,'runner_up_promotion');
  return {
    winner:record.winner,
    settingsChanged:consumeOneShotBonus(settings,record.system,record.winner),
  };
}

function selectWinner(record,observation,reward,mode){
  const snapshot=normalizeRewardSnapshot(reward);
  record.winner={
    ownerId:clean(observation.ownerId),
    commander:clean(observation.commander)||'Mongrel CMDR',
    observationId:observation.id,
    observedAt:observation.observedAt,
    receivedAt:observation.receivedAt,
    awardedAt:new Date().toISOString(),
    mode,
    rewardSnapshot:snapshot,
    amountCredits:Math.round(snapshot.totalMillions*1_000_000),
  };
  record.claim=null;
  return record.winner;
}

function consumeOneShotBonus(settings,system,winner){
  const reward=winner?.rewardSnapshot;
  if(!reward||!reward.bonusOnce||Number(reward.bonusMillions)<=0)return false;
  const entry=findStoredSystemRule(settings,system);
  if(!entry||Number(entry.bonusMillions)<=0||entry.bonusOnce===false)return false;
  entry.bonusMillions=0;
  entry.reason='';
  entry.updatedAt=new Date().toISOString();
  entry.updatedBy='Scout Job completion';
  return true;
}

function createCycleRecord(system,cycle){
  return {
    version:1,
    system,
    cycleId:cycle.cycleId,
    cycleStartedAt:cycle.cycleStartedAt,
    cycleEndsAt:cycle.cycleEndsAt,
    estimatedTickAt:cycle.estimatedTickAt,
    tickConfiguredTime:cycle.tickConfiguredTime,
    transitionMinutes:cycle.transitionMinutes,
    claim:null,
    observations:[],
    winner:null,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
  };
}

function rewardSnapshot(settings,system){
  const rule=findSystemRule(settings,system);
  return normalizeRewardSnapshot({
    baseMillions:settings.defaultRewardMillions,
    bonusMillions:rule.bonusMillions,
    bonusReason:rule.reason,
    bonusOnce:rule.bonusOnce,
  });
}

function normalizeRewardSnapshot(value={}){
  const base=bounded(value.baseMillions,0,0,100000);
  const bonus=bounded(value.bonusMillions,0,0,100000);
  return {
    baseMillions:base,
    bonusMillions:bonus,
    totalMillions:round(base+bonus),
    bonusReason:clean(value.bonusReason).slice(0,240),
    bonusOnce:value.bonusOnce!==false,
  };
}

function findSystemRule(settings,system){
  const existing=findStoredSystemRule(settings,system);
  return existing||{enabled:true,bonusMillions:0,reason:'',bonusOnce:true};
}

function findStoredSystemRule(settings,system){
  const wanted=norm(system);
  for(const [name,row] of Object.entries(settings?.systems||{})){
    if(norm(name)===wanted)return row;
  }
  return null;
}

function findSystemSnapshot(systems,system){
  const wanted=norm(system);
  for(const [name,row] of Object.entries(systems&&typeof systems==='object'?systems:{})){
    if(norm(name)===wanted||norm(row?.system)===wanted)return row;
  }
  return null;
}

function publicClaim(claim,viewerId){
  return {
    ownerId:clean(claim.ownerId)===clean(viewerId)?clean(claim.ownerId):'',
    commander:clean(claim.commander)||'Mongrel CMDR',
    claimedAt:claim.claimedAt||null,
    expiresAt:claim.expiresAt||null,
    mine:Boolean(viewerId&&clean(claim.ownerId)===clean(viewerId)),
  };
}

function publicWinner(winner,viewerId){
  return {
    commander:clean(winner.commander)||'Mongrel CMDR',
    mine:Boolean(viewerId&&clean(winner.ownerId)===clean(viewerId)),
    observedAt:winner.observedAt||null,
    awardedAt:winner.awardedAt||null,
    amountCredits:Math.round(Number(winner.amountCredits)||0),
    mode:winner.mode||'',
  };
}

function publicObservation(obs){
  return {
    status:obs.status||'',
    observedAt:obs.observedAt||null,
    receivedAt:obs.receivedAt||null,
    note:obs.note||'',
  };
}

function cycleRecordKey(system,cycleId){return norm(system)+'|'+clean(cycleId)}
function isWithinCycle(timestamp,cycle){
  const time=Date.parse(timestamp||''),start=Date.parse(cycle?.cycleStartedAt||''),end=Date.parse(cycle?.cycleEndsAt||'');
  return Number.isFinite(time)&&Number.isFinite(start)&&Number.isFinite(end)&&time>=start&&time<end;
}
function scoutStatusRank(status){return({available:0,claimed:1,fresh_unattributed:2,fresh:3,disabled:4})[status]??9}
function pruneScoutJobState(state){
  const cutoff=Date.now()-HISTORY_DAYS*86400000;
  const rows=Object.entries(state?.cycles&&typeof state.cycles==='object'?state.cycles:{})
    .filter(([,record])=>{
      const end=Date.parse(record?.cycleEndsAt||record?.updatedAt||'');
      return !Number.isFinite(end)||end>=cutoff;
    })
    .sort((a,b)=>String(b[1]?.cycleEndsAt||b[1]?.updatedAt||'').localeCompare(String(a[1]?.cycleEndsAt||a[1]?.updatedAt||'')))
    .slice(0,MAX_CYCLE_RECORDS);
  return {version:1,cycles:Object.fromEntries(rows)};
}
function storageReady(env){return Boolean(env?.DAILY_ORDERS&&typeof env.DAILY_ORDERS.get==='function'&&typeof env.DAILY_ORDERS.put==='function')}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
function iso(value){const ms=Date.parse(value||'');return Number.isFinite(ms)?new Date(ms).toISOString():null}
function dateMs(value){const date=value instanceof Date?value:new Date(value);const ms=date.getTime();return Number.isFinite(ms)?ms:Date.now()}
function bounded(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function round(value){return Math.round((Number(value)||0)*100)/100}
async function digestText(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
