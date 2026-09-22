import { arbitrateColonizationContributions } from './colonization-jobs.js';
import {
  colonizationJobDeletionTime,
  findColonizationJobRevisionOrigin,
} from './colonization-job-history.js';

export async function buildColonizationRewardDryRun({
  accounts=[],
  colonizationStore={version:1,jobs:[]},
  historyRecords=[],
  ledgerEntries=[],
}={}) {
  const catalog=buildRevisionCatalog(colonizationStore,historyRecords);
  const ledgerIndex=indexColonizationLedger(ledgerEntries);
  const obligations=[];
  const members=[];

  for(const accountRow of Array.isArray(accounts)?accounts:[]){
    const ownerId=String(accountRow?.userId||accountRow?.ownerId||'');
    const commander=clean(accountRow?.account?.commander||accountRow?.commander)||'Elite CMDR';
    const events=(Array.isArray(accountRow?.events)?accountRow.events:[])
      .filter(event=>event?.type==='colonization_contribution')
      .sort((a,b)=>String(a?.timestamp||'').localeCompare(String(b?.timestamp||'')));
    const assigned=[];
    const ambiguous=[];

    for(const event of events){
      const effective=[];
      const metaByJob=new Map();
      for(const row of catalog.values()){
        const resolved=resolveJobForEvent(row,event);
        if(!resolved)continue;
        const fundingMode=['none','member','squad'].includes(resolved.job?.fundingMode)?resolved.job.fundingMode:'squad';
        const fundingApprovalStatus=['not_required','pending','approved','rejected'].includes(resolved.job?.fundingApprovalStatus)
          ? resolved.job.fundingApprovalStatus
          : 'approved';
        if(fundingMode==='none'||Number(resolved.job?.rewardBlockMillions)<=0)continue;
        if(fundingMode==='squad'&&fundingApprovalStatus!=='approved')continue;
        effective.push(resolved.job);
        metaByJob.set(String(resolved.job.id||''),resolved);
      }
      if(!effective.length)continue;

      const arbitration=arbitrateColonizationContributions([event],effective);
      for(const assignment of arbitration.assignments||[]){
        const meta=metaByJob.get(String(assignment.jobId||''));
        if(!meta)continue;
        assigned.push({
          ...assignment,
          sourceEvent:event,
          job:meta.ruleRevision.job,
          ruleRevision:meta.ruleRevision,
          bindingRevision:meta.bindingRevision,
        });
      }
      for(const collision of arbitration.ambiguous||[]){
        ambiguous.push({...collision,sourceEvent:event,metaByJob});
      }
    }

    const memberObligations=[];
    const byJob=new Map();
    for(const row of assigned){
      const key=String(row.jobId||'');
      if(!key)continue;
      const bucket=byJob.get(key)||[];
      bucket.push(row);
      byJob.set(key,bucket);
    }

    for(const [jobId,rows] of byJob){
      const obligation=await buildJobObligation({
        ownerId,
        commander,
        jobId,
        assignments:rows,
        ledgerIndex,
      });
      if(!obligation)continue;
      obligations.push(obligation);
      memberObligations.push(obligation);
    }

    for(const collision of ambiguous){
      const diagnostic=await buildAmbiguousObligation({ownerId,commander,collision});
      obligations.push(diagnostic);
      memberObligations.push(diagnostic);
    }

    if(memberObligations.length){
      members.push(summarizeMember(ownerId,commander,memberObligations));
    }
  }

  return {
    source:'colonization',
    generatedAt:new Date().toISOString(),
    summary:summarizeObligations(obligations),
    members:members.sort((a,b)=>b.deltaCredits-a.deltaCredits||a.commander.localeCompare(b.commander)),
    obligations,
  };
}

export function mergeRewardDryRuns(primary,extra,scoutingExtra=null){
  const base=primary&&typeof primary==='object'?primary:{};
  const colonization=extra&&typeof extra==='object'?extra:{};
  const scouting=scoutingExtra&&typeof scoutingExtra==='object'?scoutingExtra:{};
  const byOwner=new Map();

  for(const source of [base.members,colonization.members,scouting.members]){
    for(const member of Array.isArray(source)?source:[]){
      const ownerId=String(member?.ownerId||'');
      if(!ownerId)continue;
      const existing=byOwner.get(ownerId)||{
        ownerId,
        commander:member.commander||'Elite CMDR',
        obligations:[],
      };
      if(member.commander)existing.commander=member.commander;
      existing.obligations.push(...(Array.isArray(member.obligations)?member.obligations:[]));
      byOwner.set(ownerId,existing);
    }
  }

  const members=[...byOwner.values()]
    .map(member=>summarizeMember(member.ownerId,member.commander,member.obligations))
    .filter(member=>member.obligationCount>0)
    .sort((a,b)=>b.deltaCredits-a.deltaCredits||a.commander.localeCompare(b.commander));
  const obligations=members.flatMap(member=>member.obligations);
  const summary={
    ...(base.summary||{}),
    ...summarizeObligations(obligations),
    connectedMembers:Math.max(
      Number(base?.summary?.connectedMembers)||0,
      Number(colonization?.summary?.connectedMembers)||0,
      Number(scouting?.summary?.connectedMembers)||0,
    ),
    dailyOrderObligations:(Array.isArray(base.members)?base.members:[]).reduce((n,m)=>n+(Number(m?.obligationCount)||0),0),
    colonizationObligations:(Array.isArray(colonization.members)?colonization.members:[]).reduce((n,m)=>n+(Number(m?.obligationCount)||0),0),
    scoutingObligations:(Array.isArray(scouting.members)?scouting.members:[]).reduce((n,m)=>n+(Number(m?.obligationCount)||0),0),
  };

  const sources=['daily_orders','colonization'];
  if(Array.isArray(scouting.obligations)&&scouting.obligations.length)sources.push('scouting');

  return {
    ...base,
    summary,
    members,
    sources,
    colonization:{
      generatedAt:colonization.generatedAt||null,
      summary:colonization.summary||{},
    },
    scouting:{
      generatedAt:scouting.generatedAt||null,
      summary:scouting.summary||{},
    },
  };
}

function buildRevisionCatalog(store,historyRecords){
  const records=(Array.isArray(historyRecords)?historyRecords:[]).filter(record=>record?.state==='applied');
  const snapshots=new Map();

  const add=job=>{
    if(!job?.id)return;
    const jobId=String(job.id);
    const revision=Math.max(1,Math.floor(Number(job.revision)||1));
    const key=jobId+'|'+revision;
    if(!snapshots.has(key))snapshots.set(key,clone(job));
  };

  for(const record of records){
    for(const job of record?.before?.jobs||[])add(job);
    for(const job of record?.after?.jobs||[])add(job);
  }
  for(const job of Array.isArray(store?.jobs)?store.jobs:[])add(job);

  const catalog=new Map();
  for(const job of snapshots.values()){
    const jobId=String(job.id||'');
    const revision=Math.max(1,Math.floor(Number(job.revision)||1));
    const origin=findColonizationJobRevisionOrigin(records,{jobId,revision});
    const item=catalog.get(jobId)||{
      jobId,
      revisions:[],
      deletedAt:colonizationJobDeletionTime(records,jobId),
    };
    item.revisions.push({
      job:clone(job),
      revision,
      effectiveAt:iso(job.revisionStartedAt)||iso(job.createdAt)||iso(job.startsAt),
      createdAt:iso(job.createdAt)||iso(job.startsAt),
      provenance:origin,
    });
    catalog.set(jobId,item);
  }

  for(const item of catalog.values()){
    item.revisions.sort((a,b)=>
      String(a.effectiveAt||'').localeCompare(String(b.effectiveAt||''))
      || a.revision-b.revision
    );
  }
  return catalog;
}

function resolveJobForEvent(catalogRow,event){
  const time=Date.parse(event?.timestamp||'');
  if(!Number.isFinite(time))return null;
  const deleted=Date.parse(catalogRow?.deletedAt||'');
  if(Number.isFinite(deleted)&&time>=deleted)return null;

  const revisions=Array.isArray(catalogRow?.revisions)?catalogRow.revisions:[];
  let index=-1;
  for(let i=0;i<revisions.length;i++){
    const effective=Date.parse(revisions[i]?.effectiveAt||'');
    const created=Date.parse(revisions[i]?.createdAt||'');
    if(Number.isFinite(created)&&time<created)continue;
    if(Number.isFinite(effective)&&effective<=time)index=i;
  }
  if(index<0)return null;

  const ruleRevision=revisions[index];
  const job=clone(ruleRevision.job);
  let bindingRevision=ruleRevision;

  if(job.scope==='market'&&!job.marketId){
    bindingRevision=null;
    for(let i=index+1;i<revisions.length;i++){
      const next=revisions[i];
      if(next?.job?.scope!=='market')break;
      if(norm(next?.job?.system)!==norm(job.system))break;
      if(next?.job?.marketId){
        bindingRevision=next;
        job.marketId=String(next.job.marketId);
        if(!job.buildName)job.buildName=next.job.buildName||'';
        break;
      }
    }
    if(!bindingRevision)return null;
  }

  return {job,ruleRevision,bindingRevision};
}

async function buildJobObligation({ownerId,commander,jobId,assignments,ledgerIndex}){
  if(!assignments.length)return null;
  const first=assignments[0];
  const job=first.job||{};
  const ruleGroups=new Map();

  for(const row of assignments){
    const fingerprint=rewardRuleFingerprint(row.job);
    const bucket=ruleGroups.get(fingerprint)||[];
    bucket.push(row);
    ruleGroups.set(fingerprint,bucket);
  }

  const sourceEventIds=unique(assignments.map(row=>row.eventId)).sort();
  const sourceRevisions=unique(assignments.map(row=>String(row.ruleRevision?.revision||row.job?.revision||1))).map(Number).sort((a,b)=>a-b);
  const ruleProvenance=uniqueProvenance(assignments.map(row=>row.ruleRevision?.provenance).filter(Boolean));
  const bindingProvenance=uniqueProvenance(assignments.map(row=>row.bindingRevision?.provenance).filter(Boolean));
  const evidenceDigest=await digestStrings(sourceEventIds);
  const blockers=[];
  const totalTons=assignments.reduce((sum,row)=>sum+(Number(row.tons)||0),0);
  const ruleChanged=ruleGroups.size>1;

  if(!sourceEventIds.length)blockers.push('frontier_evidence_missing');
  if(!ruleProvenance.length||assignments.some(row=>!row.ruleRevision?.provenance))blockers.push('colonization_archive_provenance_missing');
  if(assignments.some(row=>row.job?.scope==='market'&&!row.bindingRevision?.provenance))blockers.push('colonization_binding_provenance_missing');
  if(hasLegacyGap(assignments))blockers.push('colonization_legacy_history_gap');
  if(ruleChanged)blockers.push('colonization_reward_rules_changed_during_job');

  if(ruleChanged){
    const id=await deterministicColonizationId(ownerId,jobId,evidenceDigest,'rule-change-blocked');
    return {
      source:'colonization',
      id,
      ownerId,
      commander,
      jobId,
      orderId:'',
      logicalKey:'colonization:'+jobId,
      revision:sourceRevisions.at(-1)||1,
      revisions:sourceRevisions,
      task:clean(job.title||job.buildName)||'Colonization Job',
      system:clean(job.system),
      faction:'',
      type:'colonization',
      contribution:totalTons,
      unit:'t',
      target:Number(job.targetTons)||null,
      entitlementCredits:0,
      existingCredits:existingColonizationCredits(ledgerIndex,ownerId,jobId),
      deltaCredits:0,
      overIssuedCredits:0,
      blockedPotentialCredits:0,
      sourceEventIds,
      eventCount:sourceEventIds.length,
      evidenceDigest,
      rewardRuleDigest:'',
      provenance:ruleProvenance[0]||null,
      provenanceSet:ruleProvenance,
      bindingProvenanceSet:bindingProvenance,
      blockers:unique(blockers),
      duplicateSuppressed:false,
      readyForLive:false,
      plannedEntry:null,
    };
  }

  const rule=ruleSnapshot(job);
  if(rule.fundingMode==='none'||Number(rule.rewardBlockMillions)<=0)return null;
  if(rule.fundingMode==='member')blockers.push('colonization_member_funded_payment_flow');
  if(rule.fundingMode==='member'&&clean(rule.fundingPayerOwnerId)===clean(ownerId))blockers.push('colonization_self_funded_contributor');
  if(rule.fundingMode==='squad'&&rule.fundingApprovalStatus==='pending')blockers.push('colonization_squad_funding_pending');
  if(rule.fundingMode==='squad'&&rule.fundingApprovalStatus==='rejected')blockers.push('colonization_squad_funding_rejected');
  const rewardRuleDigest=await digestText(JSON.stringify(rule));
  const blockTons=Math.max(1,Number(rule.rewardBlockTons)||1);
  const completeBlocks=Math.floor(totalTons/blockTons);
  if(completeBlocks<=0)return null;

  const rawMillions=completeBlocks*(Number(rule.rewardBlockMillions)||0);
  const cap=rule.personalCapMillions;
  const entitlementMillions=cap===null?rawMillions:Math.min(rawMillions,Math.max(0,Number(cap)||0));
  const entitlementCredits=toCredits(entitlementMillions);
  const existingCredits=existingColonizationCredits(ledgerIndex,ownerId,jobId);
  const deltaCredits=Math.max(0,entitlementCredits-existingCredits);
  const overIssuedCredits=Math.max(0,existingCredits-entitlementCredits);
  if(overIssuedCredits>0)blockers.push('existing_ledger_exceeds_entitlement');

  const duplicateSuppressed=deltaCredits===0&&entitlementCredits>0&&overIssuedCredits===0;
  const readyForLive=deltaCredits>0&&blockers.length===0;
  const id=await deterministicColonizationId(ownerId,jobId,evidenceDigest,rewardRuleDigest);
  const publicationIds=unique([...ruleProvenance,...bindingProvenance].map(row=>row.publicationId));
  const archiveHashes=unique([...ruleProvenance,...bindingProvenance].map(row=>row.snapshotHash||row.afterHash));

  const plannedEntry={
    version:3,
    id,
    ownerId,
    displayName:commander,
    kind:'colonization_job',
    amountCredits:deltaCredits,
    entitlementCredits,
    existingVerifiedCredits:existingCredits,
    reason:`Verified Colonization Job reward · ${Math.round(totalTons).toLocaleString()} t · ${clean(job.title||job.buildName)||'Colonization Job'}`,
    sourceJobId:jobId,
    sourceJobRevisions:sourceRevisions,
    sourcePublicationIds:publicationIds,
    sourceArchiveHashes:archiveHashes,
    sourceEventIds,
    evidenceDigest,
    rewardRuleDigest,
    rewardType:'colonization',
    fundingMode:rule.fundingMode,
    fundingApprovalStatus:rule.fundingApprovalStatus,
    payerOwnerId:rule.fundingMode==='member'?clean(job.fundingPayerOwnerId):'',
    payerDisplayName:rule.fundingMode==='member'?clean(job.fundingPayerName):'Regiment of Imperial Mongrels',
    rewardBudgetCredits:toCredits(rule.rewardBudgetMillions),
    verifiedContribution:totalTons,
    verifiedUnit:'t',
    ruleSnapshot:rule,
    status:'owed',
    createdBy:'reward-engine',
  };

  return {
    source:'colonization',
    id,
    ownerId,
    commander,
    jobId,
    orderId:'',
    logicalKey:'colonization:'+jobId,
    revision:sourceRevisions.at(-1)||1,
    revisions:sourceRevisions,
    task:clean(job.title||job.buildName)||'Colonization Job',
    system:clean(job.system),
    faction:'',
    type:'colonization',
    contribution:totalTons,
    unit:'t',
    target:Number(job.targetTons)||null,
    entitlementCredits,
    existingCredits,
    deltaCredits,
    overIssuedCredits,
    blockedPotentialCredits:blockers.length?deltaCredits:0,
    completeBlocks,
    rewardBlockTons:blockTons,
    rewardBlockMillions:Number(rule.rewardBlockMillions)||0,
    personalCapMillions:cap,
    fundingMode:rule.fundingMode,
    fundingApprovalStatus:rule.fundingApprovalStatus,
    fundingPayerOwnerId:rule.fundingMode==='member'?clean(job.fundingPayerOwnerId):'',
    payerDisplayName:rule.fundingMode==='member'?clean(job.fundingPayerName):'Regiment of Imperial Mongrels',
    rewardBudgetMillions:Number(rule.rewardBudgetMillions)||0,
    firstContributionAt:assignments.map(row=>row?.sourceEvent?.timestamp).filter(Boolean).sort().at(0)||null,
    lastContributionAt:assignments.map(row=>row?.sourceEvent?.timestamp).filter(Boolean).sort().at(-1)||null,
    sourceEventIds,
    eventCount:sourceEventIds.length,
    evidenceDigest,
    rewardRuleDigest,
    provenance:ruleProvenance[0]||null,
    provenanceSet:ruleProvenance,
    bindingProvenanceSet:bindingProvenance,
    blockers:unique(blockers),
    duplicateSuppressed,
    readyForLive,
    plannedEntry,
  };
}

async function buildAmbiguousObligation({ownerId,commander,collision}){
  const eventId=String(collision?.eventId||collision?.sourceEvent?.id||'');
  const candidates=Array.isArray(collision?.candidates)?collision.candidates:[];
  const id=await deterministicColonizationId(ownerId,'ambiguous',eventId||String(collision?.timestamp||''),'ambiguous-overlap');
  return {
    source:'colonization',
    id,
    ownerId,
    commander,
    jobId:'',
    orderId:'',
    logicalKey:'',
    revision:0,
    revisions:[],
    task:'Ambiguous Colonization Job overlap',
    system:clean(collision?.system),
    faction:'',
    type:'colonization',
    contribution:Number(collision?.totalTons)||0,
    unit:'t observed',
    target:null,
    entitlementCredits:0,
    existingCredits:0,
    deltaCredits:0,
    overIssuedCredits:0,
    blockedPotentialCredits:0,
    sourceEventIds:eventId?[eventId]:[],
    eventCount:1,
    evidenceDigest:eventId?await digestStrings([eventId]):'',
    rewardRuleDigest:'',
    provenance:null,
    provenanceSet:[],
    bindingProvenanceSet:[],
    blockers:['colonization_overlap_ambiguous'],
    ambiguity:{
      reason:collision?.reason||'equal_specificity',
      candidateJobIds:candidates.map(row=>row.jobId).filter(Boolean),
      candidateTitles:candidates.map(row=>row.title).filter(Boolean),
    },
    duplicateSuppressed:false,
    readyForLive:false,
    plannedEntry:null,
  };
}

function hasLegacyGap(assignments){
  for(const row of assignments){
    const eventTime=Date.parse(row?.sourceEvent?.timestamp||'');
    for(const provenance of [row?.ruleRevision?.provenance,row?.bindingRevision?.provenance]){
      if(!provenance?.legacyBaseline)continue;
      const published=Date.parse(provenance?.publishedAt||'');
      if(Number.isFinite(eventTime)&&Number.isFinite(published)&&eventTime<published)return true;
    }
  }
  return false;
}

function rewardRuleFingerprint(job){
  return JSON.stringify(ruleSnapshot(job));
}

function ruleSnapshot(job={}){
  return {
    type:'colonization',
    rewardBlockTons:Math.max(1,Number(job.rewardBlockTons)||1),
    rewardBlockMillions:Math.max(0,Number(job.rewardBlockMillions)||0),
    personalCapMillions:job.personalCapMillions===null||job.personalCapMillions===undefined
      ? null
      : Math.max(0,Number(job.personalCapMillions)||0),
    fundingMode:['none','member','squad'].includes(job.fundingMode)?job.fundingMode:'squad',
    fundingApprovalStatus:['not_required','pending','approved','rejected'].includes(job.fundingApprovalStatus)?job.fundingApprovalStatus:'approved',
    rewardBudgetMillions:Math.max(0,Number(job.rewardBudgetMillions)||0),
    fundingPayerOwnerId:clean(job.fundingPayerOwnerId),
  };
}

function indexColonizationLedger(entries){
  const map=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    const jobId=clean(entry?.sourceJobId);
    if(!jobId)continue;
    if(entry?.kind!=='colonization_job'&&entry?.rewardType!=='colonization')continue;
    const key=String(entry?.ownerId||'')+'|'+jobId;
    map.set(key,(map.get(key)||0)+Math.max(0,Number(entry?.amountCredits)||0));
  }
  return map;
}

function existingColonizationCredits(index,ownerId,jobId){
  return Math.max(0,Math.round(Number(index.get(String(ownerId||'')+'|'+String(jobId||'')))||0));
}

function summarizeMember(ownerId,commander,memberObligations){
  return {
    ownerId,
    commander,
    obligationCount:memberObligations.length,
    readyCount:memberObligations.filter(item=>item.readyForLive).length,
    blockedCount:memberObligations.filter(item=>item.blockers?.length).length,
    duplicateSuppressedCount:memberObligations.filter(item=>item.duplicateSuppressed).length,
    entitlementCredits:sum(memberObligations,'entitlementCredits'),
    existingCredits:sum(memberObligations,'existingCredits'),
    deltaCredits:sum(memberObligations,'deltaCredits'),
    obligations:memberObligations,
  };
}

function summarizeObligations(obligations){
  const rows=Array.isArray(obligations)?obligations:[];
  return {
    membersWithEntitlement:new Set(rows.filter(row=>row.entitlementCredits>0).map(row=>row.ownerId)).size,
    obligationCount:rows.length,
    readyObligations:rows.filter(item=>item.readyForLive).length,
    blockedObligations:rows.filter(item=>item.blockers?.length).length,
    duplicateSuppressed:rows.filter(item=>item.duplicateSuppressed).length,
    entitlementCredits:sum(rows,'entitlementCredits'),
    existingVerifiedCredits:sum(rows,'existingCredits'),
    wouldCreateCredits:sum(rows.filter(item=>item.readyForLive),'deltaCredits'),
    blockedDeltaCredits:sum(rows.filter(item=>item.blockers?.length),item=>Number(item.blockedPotentialCredits)||Number(item.deltaCredits)||0),
    overIssuedCredits:sum(rows,'overIssuedCredits'),
  };
}

function uniqueProvenance(rows){
  const seen=new Set();
  const out=[];
  for(const row of rows){
    const key=[row?.publicationId||'',row?.archivedJobId||'',row?.archivedRevision||'',row?.snapshotSide||''].join('|');
    if(seen.has(key))continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function deterministicColonizationId(ownerId,jobId,evidenceDigest,rewardRuleDigest){
  const digest=await digestText(['colonization-job-v1',ownerId,jobId,evidenceDigest,rewardRuleDigest].join('|'));
  return 'colonization-job-'+digest.slice(0,40);
}

async function digestStrings(values){return digestText(unique(values).sort().join('|'))}
async function digestText(value){
  const data=new TextEncoder().encode(String(value||''));
  const hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function toCredits(millions){return Math.max(0,Math.round((Number(millions)||0)*1_000_000))}
function sum(rows,keyOrFn){
  const fn=typeof keyOrFn==='function'?keyOrFn:row=>Number(row?.[keyOrFn])||0;
  return Math.round((Array.isArray(rows)?rows:[]).reduce((total,row)=>total+(Number(fn(row))||0),0));
}
function unique(values){return [...new Set((Array.isArray(values)?values:[]).map(value=>String(value??'').trim()).filter(Boolean))]}
function clone(value){return value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):{}}
function norm(value){return clean(value).toLowerCase().replace(/^\$|;$/g,'').replace(/\s+/g,' ')}
function iso(value){if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
