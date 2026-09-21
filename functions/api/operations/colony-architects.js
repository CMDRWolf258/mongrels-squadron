import { json, readSession } from '../../../lib/auth.js';
import { getEvents, listFrontierAccounts, privateHeaders } from '../../../lib/frontier.js';
import { readColonizationJobs } from '../../../lib/colonization-jobs.js';
import {
  pairForSystem,
  readColonyArchitects,
  unpairArchitect,
  upsertArchitectPair,
  writeColonyArchitects,
} from '../../../lib/colony-architects.js';

export async function onRequestGet({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;

  const [store,accounts,colonizationJobs,knownSystems]=await Promise.all([
    readColonyArchitects(env),
    listFrontierAccounts(env),
    readColonizationJobs(env),
    readKnownSystems(request),
  ]);
  const claims=await readClaimObservations(env,accounts);
  const latestClaims=latestClaimsBySystem(claims);
  const accountByOwner=new Map(accounts.map(item=>[String(item.userId),item.account]));
  const accountByCommander=new Map(accounts.map(item=>[norm(item.account?.commander),{userId:item.userId,account:item.account}]).filter(([key])=>key));

  const pairs=store.pairs.map(pair=>{
    const claim=latestClaims.get(systemKey(pair.system,pair.systemAddress)) || latestClaims.get(systemKey(pair.system,null)) || null;
    const linked=pair.ownerId?accountByOwner.get(String(pair.ownerId)):accountByCommander.get(norm(pair.commander))?.account;
    let claimAlignment='none';
    if(claim?.claimed===false)claimAlignment='released';
    else if(claim?.claimed===true)claimAlignment=norm(claim.commander)===norm(pair.commander)?'match':'conflict';
    return {
      ...pair,
      linkedFrontier:Boolean(linked),
      claimAlignment,
      latestClaim:claim,
    };
  });

  const pairedKeys=new Set(pairs.map(pair=>systemKey(pair.system,pair.systemAddress)));
  const observedClaims=[...latestClaims.values()].map(claim=>({
    ...claim,
    paired:Boolean(pairForSystem(store,claim.system)),
    pairedCommander:pairForSystem(store,claim.system)?.commander||'',
  })).sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));

  const systems=[...new Set([
    ...knownSystems,
    ...store.pairs.map(pair=>pair.system),
    ...observedClaims.map(claim=>claim.system),
    ...(Array.isArray(colonizationJobs?.jobs)?colonizationJobs.jobs.map(job=>job.system):[]),
  ].map(value=>clean(value,140)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  const commanders=[...new Set([
    ...accounts.map(item=>item.account?.commander),
    ...store.pairs.map(pair=>pair.commander),
    ...observedClaims.map(claim=>claim.commander),
  ].map(value=>clean(value,100)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  return reply({
    ok:true,
    pairs,
    observedClaims,
    claimHistory:claims.slice(0,100),
    systems,
    commanders,
    connectedCommanders:accounts.map(item=>({
      ownerId:item.userId,
      commander:item.account?.commander||'Elite CMDR',
      lastSyncAt:item.account?.lastSyncAt||null,
    })).sort((a,b)=>String(a.commander).localeCompare(String(b.commander))),
    summary:{
      pairedSystems:pairs.length,
      observedClaimSystems:observedClaims.length,
      activeObservedClaims:observedClaims.filter(claim=>claim.claimed).length,
      unpairedActiveClaims:observedClaims.filter(claim=>claim.claimed&&!pairForSystem(store,claim.system)).length,
      claimConflicts:pairs.filter(pair=>pair.claimAlignment==='conflict').length,
    },
    updatedAt:store.updatedAt,
    updatedBy:store.updatedBy,
    jobCreationRestrictedByArchitect:false,
  });
}

export async function onRequestPut({request,env}) {
  const auth=await requireSiteAdmin(request,env);
  if(auth.response)return auth.response;
  if(!sameOrigin(request))return reply({ok:false,error:'request_validation_failed'},403);

  let body;
  try{body=await request.json();}
  catch{return reply({ok:false,error:'invalid_json'},400)}

  const action=clean(body?.action,30);
  const actor=auth.session.displayName||auth.session.username||'Wolf';
  const store=await readColonyArchitects(env);

  if(action==='unpair') {
    const result=unpairArchitect(store,clean(body?.system,140),actor);
    if(result.error)return reply({ok:false,error:result.error},404);
    const saved=await writeColonyArchitects(env,{pairs:result.pairs,history:result.history},actor);
    return reply({ok:true,action:'unpaired',pairs:saved.pairs,updatedAt:saved.updatedAt,jobCreationRestrictedByArchitect:false});
  }

  if(action!=='pair')return reply({ok:false,error:'unsupported_action'},400);

  const accounts=await listFrontierAccounts(env);
  const claims=await readClaimObservations(env,accounts);
  const claimEventId=clean(body?.claimEventId,100);
  const claim=claimEventId?claims.find(item=>String(item.eventId)===claimEventId):null;
  if(claimEventId&&!claim)return reply({ok:false,error:'claim_event_not_found'},404);
  if(claim&&!claim.claimed)return reply({ok:false,error:'released_claim_cannot_pair'},409);

  let system=claim?.system||clean(body?.system,140);
  let commander=claim?.commander||clean(body?.commander,100);
  let ownerId=claim?.ownerId||'';
  let systemAddress=claim?.systemAddress??body?.systemAddress??null;
  if(!system||!commander)return reply({ok:false,error:'architect_pair_required'},400);

  if(!ownerId) {
    const linked=accounts.find(item=>norm(item.account?.commander)===norm(commander));
    if(linked)ownerId=linked.userId;
  }

  const result=upsertArchitectPair(store,{
    system,
    systemAddress,
    commander,
    ownerId,
    source:claim?'claim_confirmed':'manual',
    claimEventId:claim?.eventId||'',
    claimTimestamp:claim?.timestamp||null,
    note:clean(body?.note,500),
  },actor);
  if(result.error)return reply({ok:false,error:result.error},400);

  const saved=await writeColonyArchitects(env,{pairs:result.pairs,history:result.history},actor);
  return reply({
    ok:true,
    action:'paired',
    pair:result.pair,
    pairs:saved.pairs,
    updatedAt:saved.updatedAt,
    jobCreationRestrictedByArchitect:false,
  });
}

async function readClaimObservations(env,accounts) {
  const rows=[];
  for(const accountRow of accounts) {
    const events=await getEvents(env,accountRow.userId);
    for(const event of events) {
      if(!['colonization_system_claim','colonization_system_claim_release'].includes(event?.type))continue;
      rows.push({
        eventId:event.id||'',
        type:event.type,
        claimed:event.type==='colonization_system_claim',
        system:clean(event.system,140),
        systemAddress:event.systemAddress===null||event.systemAddress===undefined?null:String(event.systemAddress),
        timestamp:event.timestamp||null,
        commander:accountRow.account?.commander||'Elite CMDR',
        ownerId:accountRow.userId,
      });
    }
  }
  return rows.filter(row=>row.system).sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
}

function latestClaimsBySystem(claims) {
  const map=new Map();
  for(const claim of claims) {
    const key=systemKey(claim.system,claim.systemAddress);
    if(!map.has(key))map.set(key,claim);
    const fallback=systemKey(claim.system,null);
    if(!map.has(fallback))map.set(fallback,claim);
  }
  return map;
}

async function readKnownSystems(request) {
  try{
    const url=new URL('/data/live-bgs.json',request.url);
    const response=await fetch(url.toString(),{headers:{Accept:'application/json'},cf:{cacheTtl:0}});
    if(!response.ok)return[];
    const data=await response.json();
    return (Array.isArray(data?.systems)?data.systems:[])
      .filter(row=>row?.present!==false&&row?.formerPresence!==true)
      .map(row=>clean(row?.name,140))
      .filter(Boolean);
  }catch{return[]}
}

async function requireSiteAdmin(request,env) {
  const session=await readSession(request,env);
  if(!session)return{response:reply({ok:false,error:'authentication_required'},401)};
  if(session.access!=='site_admin')return{response:reply({ok:false,error:'site_admin_required'},403)};
  return{session};
}
function sameOrigin(request) {
  return request.headers.get('Origin')===new URL(request.url).origin
    && request.headers.get('X-Mongrels-Request')==='wolf-colony-architects';
}
function systemKey(system,address){return address!==null&&address!==undefined&&address!==''?'a:'+String(address):'n:'+norm(system)}
function clean(value,max){return typeof value==='string'?value.trim().slice(0,max):String(value??'').trim().slice(0,max)}
function norm(value){return clean(value,200).toLowerCase().replace(/\s+/g,' ')}
function reply(body,status=200){return json(body,{status,headers:privateHeaders()})}
