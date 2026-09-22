export async function buildScoutRewardDryRun({
  winners=[],
  ledgerEntries=[],
}={}){
  const ledgerIndex=indexScoutLedger(ledgerEntries);
  const obligations=[];
  const byOwner=new Map();

  for(const row of Array.isArray(winners)?winners:[]){
    const winner=row?.winner;
    const ownerId=clean(winner?.ownerId);
    const system=clean(row?.system);
    const cycleId=clean(row?.cycleId);
    const reward=winner?.rewardSnapshot&&typeof winner.rewardSnapshot==='object'?winner.rewardSnapshot:{};
    const entitlementCredits=Math.max(0,Math.round(Number(winner?.amountCredits)||((Number(reward.totalMillions)||0)*1_000_000)));
    if(!ownerId||!system||!cycleId||entitlementCredits<=0)continue;

    const key=scoutLedgerKey(ownerId,system,cycleId);
    const existingCredits=Math.max(0,Math.round(Number(ledgerIndex.get(key))||0));
    const deltaCredits=Math.max(0,entitlementCredits-existingCredits);
    const overIssuedCredits=Math.max(0,existingCredits-entitlementCredits);
    const blockers=[];
    if(!winner?.observationId)blockers.push('scout_evidence_missing');
    if(overIssuedCredits>0)blockers.push('existing_ledger_exceeds_entitlement');

    const sourceEventIds=winner?.observationId?[String(winner.observationId)]:[];
    const evidenceDigest=await digestText([
      'scout-evidence-v1',
      ownerId,
      system,
      cycleId,
      String(winner?.observationId||''),
      String(winner?.observedAt||''),
      String(winner?.receivedAt||''),
    ].join('|'));
    const ruleSnapshot={
      type:'scouting',
      baseMillions:Number(reward.baseMillions)||0,
      bonusMillions:Number(reward.bonusMillions)||0,
      totalMillions:Number(reward.totalMillions)||0,
      bonusReason:clean(reward.bonusReason),
      bonusOnce:reward.bonusOnce!==false,
    };
    const rewardRuleDigest=await digestText(JSON.stringify(ruleSnapshot));
    const id='scouting-job-'+(await digestText(['scouting-job-v1',ownerId,system,cycleId].join('|'))).slice(0,40);
    const duplicateSuppressed=deltaCredits===0&&entitlementCredits>0&&overIssuedCredits===0;
    const readyForLive=deltaCredits>0&&blockers.length===0;
    const reasonParts=[
      'Verified Scout Job reward',
      system,
      `${Math.round(Number(reward.baseMillions)||0).toLocaleString()}M base`,
      Number(reward.bonusMillions)>0?`+${Math.round(Number(reward.bonusMillions)||0).toLocaleString()}M priority bonus`:'',
    ].filter(Boolean);

    const plannedEntry={
      version:3,
      id,
      ownerId,
      displayName:clean(winner?.commander)||'Mongrel CMDR',
      kind:'scouting_job',
      amountCredits:deltaCredits,
      entitlementCredits,
      existingVerifiedCredits:existingCredits,
      reason:reasonParts.join(' · '),
      sourceScoutSystem:system,
      sourceScoutCycleId:cycleId,
      sourceScoutObservationId:clean(winner?.observationId),
      sourceEventIds,
      evidenceDigest,
      rewardRuleDigest,
      rewardType:'scouting',
      verifiedContribution:1,
      verifiedUnit:'fresh faction board',
      ruleSnapshot,
      status:'owed',
      createdBy:'reward-engine',
    };

    const obligation={
      source:'scouting',
      id,
      ownerId,
      commander:clean(winner?.commander)||'Mongrel CMDR',
      orderId:'',
      logicalKey:'scouting:'+norm(system)+':'+cycleId,
      sourceCycleId:cycleId,
      revision:1,
      revisions:[1],
      task:'Scout '+system,
      system,
      faction:'',
      type:'scouting',
      contribution:1,
      unit:'board',
      target:1,
      entitlementCredits,
      existingCredits,
      deltaCredits,
      overIssuedCredits,
      blockedPotentialCredits:blockers.length?deltaCredits:0,
      sourceEventIds,
      eventCount:1,
      evidenceDigest,
      rewardRuleDigest,
      provenance:null,
      blockers,
      duplicateSuppressed,
      readyForLive,
      plannedEntry,
      scout:{
        observedAt:winner?.observedAt||null,
        awardedAt:winner?.awardedAt||null,
        awardMode:winner?.mode||'',
        cycleStartedAt:row?.cycleStartedAt||null,
        cycleEndsAt:row?.cycleEndsAt||null,
        estimatedTickAt:row?.estimatedTickAt||null,
        rewardSnapshot:ruleSnapshot,
      },
    };
    obligations.push(obligation);
    const member=byOwner.get(ownerId)||{ownerId,commander:obligation.commander,obligations:[]};
    member.commander=obligation.commander||member.commander;
    member.obligations.push(obligation);
    byOwner.set(ownerId,member);
  }

  const members=[...byOwner.values()]
    .map(member=>summarizeMember(member.ownerId,member.commander,member.obligations))
    .sort((a,b)=>b.deltaCredits-a.deltaCredits||a.commander.localeCompare(b.commander));

  return {
    source:'scouting',
    generatedAt:new Date().toISOString(),
    summary:summarizeObligations(obligations),
    members,
    obligations,
  };
}

function indexScoutLedger(entries){
  const out=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    if(entry?.kind!=='scouting_job'&&entry?.rewardType!=='scouting')continue;
    const ownerId=clean(entry?.ownerId),system=clean(entry?.sourceScoutSystem),cycleId=clean(entry?.sourceScoutCycleId);
    if(!ownerId||!system||!cycleId)continue;
    const key=scoutLedgerKey(ownerId,system,cycleId);
    out.set(key,(out.get(key)||0)+Math.max(0,Number(entry?.amountCredits)||0));
  }
  return out;
}
function scoutLedgerKey(ownerId,system,cycleId){return clean(ownerId)+'|'+norm(system)+'|'+clean(cycleId)}
function summarizeMember(ownerId,commander,rows){
  return {
    ownerId,
    commander,
    obligationCount:rows.length,
    readyCount:rows.filter(item=>item.readyForLive).length,
    blockedCount:rows.filter(item=>item.blockers?.length).length,
    duplicateSuppressedCount:rows.filter(item=>item.duplicateSuppressed).length,
    entitlementCredits:sum(rows,'entitlementCredits'),
    existingCredits:sum(rows,'existingCredits'),
    deltaCredits:sum(rows,'deltaCredits'),
    obligations:rows,
  };
}
function summarizeObligations(rows){
  const list=Array.isArray(rows)?rows:[];
  return {
    membersWithEntitlement:new Set(list.filter(row=>row.entitlementCredits>0).map(row=>row.ownerId)).size,
    obligationCount:list.length,
    readyObligations:list.filter(item=>item.readyForLive).length,
    blockedObligations:list.filter(item=>item.blockers?.length).length,
    duplicateSuppressed:list.filter(item=>item.duplicateSuppressed).length,
    entitlementCredits:sum(list,'entitlementCredits'),
    existingVerifiedCredits:sum(list,'existingCredits'),
    wouldCreateCredits:sum(list.filter(item=>item.readyForLive),'deltaCredits'),
    blockedDeltaCredits:sum(list.filter(item=>item.blockers?.length),item=>Number(item.blockedPotentialCredits)||Number(item.deltaCredits)||0),
    overIssuedCredits:sum(list,'overIssuedCredits'),
  };
}
function sum(rows,keyOrFn){
  const fn=typeof keyOrFn==='function'?keyOrFn:row=>Number(row?.[keyOrFn])||0;
  return Math.round((Array.isArray(rows)?rows:[]).reduce((total,row)=>total+(Number(fn(row))||0),0));
}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
function norm(value){return clean(value).toLowerCase().replace(/\s+/g,' ')}
async function digestText(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
