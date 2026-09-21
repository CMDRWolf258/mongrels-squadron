import { buildRewardPreview } from './reward-rules.js';

export const REWARD_ENGINE_MODE='dry_run';

export async function buildRewardDryRun({
  current,
  accounts=[],
  eventsByOwner=new Map(),
  rewardSettings,
  historyRecords=[],
  ledgerEntries=[],
}={}) {
  const cycleId=clean(current?.cycleId);
  const orderById=new Map((Array.isArray(current?.orders)?current.orders:[]).map(order=>[clean(order.id),order]));
  const ledgerIndex=indexVerifiedLedger(ledgerEntries);
  const obligations=[];
  const members=[];

  for(const accountRow of Array.isArray(accounts)?accounts:[]){
    const ownerId=String(accountRow?.userId||'');
    const commander=clean(accountRow?.account?.commander)||'Elite CMDR';
    const matched=accountRow?.matched||null;
    const previews=buildRewardPreview(matched?.orderTotals||[],rewardSettings);
    const memberObligations=[];

    for(const preview of previews){
      if(!preview.rewardEligible||!(Number(preview.entitlementMillions)>0))continue;
      const order=orderById.get(clean(preview.orderId));
      const logicalKey=clean(preview.logicalKey||order?.logicalKey);
      const sourceCycleId=cycleId;
      const provenance=findPublicationProvenance(historyRecords,{
        orderId:preview.orderId,
        logicalKey,
        revision:Number(preview.revision)||Number(order?.revision)||1,
        cycleId:sourceCycleId,
      });
      const variants=buildOrderPreviewVariants(preview,matched,provenance,rewardSettings);

      for(const variant of variants){
        const effective=variant.preview;
        if(!effective?.rewardEligible||!(Number(effective.entitlementMillions)>0))continue;
        const obligation=await buildOrderObligation({
          ownerId,
          commander,
          order,
          preview:effective,
          sourceCycleId,
          logicalKey,
          provenance,
          ledgerIndex,
          rewardSettings,
          forcedBlockers:variant.blockers||[],
          diagnostic:Boolean(variant.diagnostic),
        });
        obligations.push(obligation);
        memberObligations.push(obligation);
      }
    }

    members.push({
      ownerId,
      commander,
      obligationCount:memberObligations.length,
      readyCount:memberObligations.filter(item=>item.readyForLive).length,
      blockedCount:memberObligations.filter(item=>item.blockers.length).length,
      duplicateSuppressedCount:memberObligations.filter(item=>item.duplicateSuppressed).length,
      entitlementCredits:sum(memberObligations,'entitlementCredits'),
      existingCredits:sum(memberObligations,'existingCredits'),
      deltaCredits:sum(memberObligations,'deltaCredits'),
      obligations:memberObligations,
    });
  }

  const activeMembers=members.filter(member=>member.obligationCount>0);
  return {
    mode:REWARD_ENGINE_MODE,
    writeCapability:false,
    liveIssuanceSupported:false,
    cycleId:cycleId||null,
    cycleStartedAt:current?.cycleStartedAt||current?.updatedAt||null,
    generatedAt:new Date().toISOString(),
    summary:{
      connectedMembers:Array.isArray(accounts)?accounts.length:0,
      membersWithEntitlement:activeMembers.length,
      obligationCount:obligations.length,
      readyObligations:obligations.filter(item=>item.readyForLive).length,
      blockedObligations:obligations.filter(item=>item.blockers.length).length,
      duplicateSuppressed:obligations.filter(item=>item.duplicateSuppressed).length,
      entitlementCredits:sum(obligations,'entitlementCredits'),
      existingVerifiedCredits:sum(obligations,'existingCredits'),
      wouldCreateCredits:sum(obligations.filter(item=>item.readyForLive),'deltaCredits'),
      blockedDeltaCredits:sum(obligations.filter(item=>item.blockers.length&&item.deltaCredits>0),'deltaCredits'),
      overIssuedCredits:sum(obligations,'overIssuedCredits'),
    },
    members:activeMembers.sort((a,b)=>b.deltaCredits-a.deltaCredits||a.commander.localeCompare(b.commander)),
  };
}

async function buildOrderObligation({
  ownerId,
  commander,
  order,
  preview,
  sourceCycleId,
  logicalKey,
  provenance,
  ledgerIndex,
  rewardSettings,
  forcedBlockers=[],
  diagnostic=false,
}={}) {
  const sourceEventIds=unique(preview?.sourceEventIds||[]).sort();
  const entitlementCredits=toCredits(preview?.entitlementMillions);
  const ledgerKey=verifiedLedgerKey(ownerId,sourceCycleId,logicalKey);
  const prior=ledgerIndex.get(ledgerKey)||{credits:0,entries:[]};
  const existingCredits=diagnostic?0:Math.max(0,Math.round(Number(prior.credits)||0));
  const deltaCredits=Math.max(0,entitlementCredits-existingCredits);
  const overIssuedCredits=diagnostic?0:Math.max(0,existingCredits-entitlementCredits);
  const archiveExact=provenance?.match==='exact';
  const evidenceDigest=await digestStrings(sourceEventIds);
  const rules=ruleSnapshot(preview,rewardSettings);
  const rewardRuleDigest=await digestText(JSON.stringify(rules));
  const id=await deterministicRewardId(ownerId,sourceCycleId,logicalKey,evidenceDigest,rewardRuleDigest);
  const blockers=unique(forcedBlockers);
  const needsIssuance=deltaCredits>0;

  if(needsIssuance){
    if(!sourceCycleId)blockers.push('cycle_missing');
    if(!logicalKey)blockers.push('logical_order_key_missing');
    if(!order)blockers.push('current_order_missing');
    if(!sourceEventIds.length)blockers.push('frontier_evidence_missing');
    if(!provenance)blockers.push('archive_provenance_missing');
    else if(!archiveExact)blockers.push('archive_revision_mismatch');
  }
  if(overIssuedCredits>0)blockers.push('existing_ledger_exceeds_entitlement');

  const normalizedBlockers=unique(blockers);
  const duplicateSuppressed=!diagnostic&&!needsIssuance&&entitlementCredits>0&&overIssuedCredits===0;
  const readyForLive=!diagnostic&&needsIssuance&&normalizedBlockers.length===0;
  const plannedEntry=diagnostic?null:{
    version:3,
    id,
    ownerId,
    displayName:commander,
    kind:'verified_order',
    amountCredits:deltaCredits,
    entitlementCredits,
    existingVerifiedCredits:existingCredits,
    reason:rewardReason(preview),
    sourceOrderId:clean(preview.orderId),
    sourceLogicalKey:logicalKey,
    sourceCycleId,
    sourceOrderRevision:Number(preview.revision)||Number(order?.revision)||1,
    sourcePublicationId:provenance?.publicationId||'',
    sourceArchiveHash:provenance?.afterHash||'',
    sourceEventIds,
    evidenceDigest,
    rewardRuleDigest,
    rewardType:clean(preview.type),
    verifiedContribution:Number(preview.contribution)||0,
    verifiedUnit:clean(preview.unit),
    ruleSnapshot:rules,
    status:'owed',
    createdBy:'reward-engine',
  };

  return {
    source:'daily_order',
    id,
    ownerId,
    commander,
    orderId:clean(preview.orderId),
    logicalKey,
    revision:Number(preview.revision)||Number(order?.revision)||1,
    task:clean(preview.task||order?.task)||'Daily Order',
    system:clean(preview.system||order?.system),
    faction:clean(preview.faction||order?.faction),
    type:clean(preview.type),
    contribution:Number(preview.contribution)||0,
    unit:clean(preview.unit),
    target:preview.target??null,
    entitlementCredits,
    existingCredits,
    deltaCredits,
    overIssuedCredits,
    sourceEventIds,
    eventCount:sourceEventIds.length||Number(preview.eventCount)||0,
    evidenceDigest,
    rewardRuleDigest,
    provenance,
    blockers:normalizedBlockers,
    duplicateSuppressed,
    readyForLive,
    plannedEntry,
    diagnostic,
  };
}

function buildOrderPreviewVariants(preview,matched,provenance,rewardSettings){
  if(provenance?.match!=='exact')return[{preview,blockers:[],diagnostic:false}];
  const threshold=Date.parse(provenance.effectiveAt||provenance.publishedAt||'');
  if(!Number.isFinite(threshold))return[{preview,blockers:[],diagnostic:false}];

  const rows=collectOrderMatches(matched,preview);
  if(!rows.length)return[{preview,blockers:[],diagnostic:false}];

  const early=[],safe=[],unknown=[];
  for(const row of rows){
    const time=Date.parse(row.timestamp||'');
    if(!Number.isFinite(time))unknown.push(row);
    else if(time<threshold)early.push(row);
    else safe.push(row);
  }

  if(!early.length&&!unknown.length)return[{preview,blockers:[],diagnostic:false}];

  const variants=[];
  if(early.length){
    const blocked=previewFromMatches(preview,early,rewardSettings);
    if(blocked?.rewardEligible&&Number(blocked.entitlementMillions)>0){
      variants.push({
        preview:blocked,
        blockers:[provenance.legacyBaseline?'order_legacy_history_gap':'order_revision_time_mismatch'],
        diagnostic:true,
      });
    }
  }
  if(unknown.length){
    const blocked=previewFromMatches(preview,unknown,rewardSettings);
    if(blocked?.rewardEligible&&Number(blocked.entitlementMillions)>0){
      variants.push({
        preview:blocked,
        blockers:['order_event_time_missing'],
        diagnostic:true,
      });
    }
  }
  if(safe.length){
    const ready=previewFromMatches(preview,safe,rewardSettings);
    if(ready?.rewardEligible&&Number(ready.entitlementMillions)>0){
      variants.push({preview:ready,blockers:[],diagnostic:false});
    }
  }
  return variants;
}

function collectOrderMatches(matched,preview){
  const wantedOrder=clean(preview?.orderId);
  const wantedLogical=clean(preview?.logicalKey);
  const wantedType=clean(preview?.type);
  const rows=[];

  for(const event of Array.isArray(matched?.events)?matched.events:[]){
    for(const match of Array.isArray(event?.orderMatches)?event.orderMatches:[]){
      const sameOrder=(wantedOrder&&clean(match?.orderId)===wantedOrder)
        || (wantedLogical&&clean(match?.logicalKey)===wantedLogical);
      if(!sameOrder)continue;
      if(wantedType&&clean(match?.type)!==wantedType)continue;
      rows.push({
        eventId:clean(match?.eventId||event?.id),
        timestamp:clean(match?.timestamp||event?.timestamp),
        contribution:Number(match?.contribution)||0,
      });
    }
  }
  return rows.filter(row=>row.contribution>0);
}

function previewFromMatches(preview,rows,rewardSettings){
  const contribution=round(rows.reduce((sum,row)=>sum+(Number(row?.contribution)||0),0));
  const sourceEventIds=unique(rows.map(row=>row.eventId)).sort();
  const base={
    ...preview,
    contribution,
    sourceEventIds,
    eventCount:sourceEventIds.length,
  };
  delete base.rewardEligible;
  delete base.entitlementMillions;
  delete base.capMillions;
  delete base.remainingMillions;
  return buildRewardPreview([base],rewardSettings)[0]||null;
}

export function findPublicationProvenance(records,{orderId='',logicalKey='',revision=1,cycleId=''}={}) {
  const wantedOrder=clean(orderId),wantedLogical=clean(logicalKey),wantedCycle=clean(cycleId);
  const candidates=(Array.isArray(records)?records:[])
    .filter(record=>record?.state==='applied')
    .filter(record=>!wantedCycle||clean(record?.cycleId)===wantedCycle||clean(record?.previousCycleId)===wantedCycle)
    .sort((a,b)=>eventTime(a).localeCompare(eventTime(b)));

  let fallbackExact=null;
  let fallbackMismatch=null;
  for(const record of candidates){
    const orders=Array.isArray(record?.after?.orders)?record.after.orders:[];
    const found=orders.find(order=>
      (wantedOrder&&clean(order?.id)===wantedOrder)
      || (wantedLogical&&clean(order?.logicalKey)===wantedLogical)
    );
    if(!found)continue;

    const provenance={
      match:Number(found?.revision||1)===Number(revision||1)?'exact':'revision_mismatch',
      publicationId:clean(record.publicationId),
      action:clean(record.action),
      actor:clean(record.actor),
      publishedAt:record.appliedAt||record.preparedAt||null,
      effectiveAt:record.preparedAt||record.appliedAt||null,
      afterHash:clean(record.afterHash),
      archivedOrderId:clean(found.id),
      archivedLogicalKey:clean(found.logicalKey),
      archivedRevision:Number(found.revision)||1,
      legacyBaseline:Boolean(record.legacyBaseline),
    };

    if(provenance.match!=='exact'){
      if(!fallbackMismatch)fallbackMismatch=provenance;
      continue;
    }

    const beforeOrders=Array.isArray(record?.before?.orders)?record.before.orders:[];
    const prior=beforeOrders.find(order=>
      (wantedOrder&&clean(order?.id)===wantedOrder)
      || (wantedLogical&&clean(order?.logicalKey)===wantedLogical)
    );
    const sameRevision=prior&&Number(prior?.revision||1)===Number(revision||1);
    if(!sameRevision)return provenance;
    if(!fallbackExact)fallbackExact=provenance;
  }
  return fallbackExact||fallbackMismatch;
}

export function verifiedLedgerKey(ownerId,cycleId,logicalKey) {
  return [String(ownerId||''),clean(cycleId),clean(logicalKey)].join('|');
}

function indexVerifiedLedger(entries) {
  const map=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
    if(entry?.kind!=='verified_order')continue;
    const key=verifiedLedgerKey(entry.ownerId,entry.sourceCycleId,entry.sourceLogicalKey);
    if(!key||key==='||')continue;
    const bucket=map.get(key)||{credits:0,entries:[]};
    const amount=Math.max(0,Number(entry.amountCredits)||0);
    bucket.credits+=amount;
    bucket.entries.push(entry);
    map.set(key,bucket);
  }
  return map;
}

function ruleSnapshot(preview,settings={}) {
  const type=clean(preview.type);
  const source=settings&&typeof settings==='object'?settings:{};
  if(type==='trade')return{type,rule:{...(source.trade||{})},target:preview.target??null};
  if(type==='inf')return{type,rule:{...(source.inf||{})},target:preview.target??null};
  if(type==='bounties')return{type,rule:{...(source.bounties||{})},target:preview.target??null};
  return{type,rule:{},target:preview.target??null};
}

function rewardReason(preview) {
  const amount=round(Number(preview.contribution)||0);
  const unit=clean(preview.unit);
  const type=clean(preview.type).replaceAll('_',' ');
  return 'Verified '+type+' reward · '+amount.toLocaleString()+(unit?' '+unit:'')+' · '+clean(preview.task||'Daily Order');
}

async function deterministicRewardId(ownerId,cycleId,logicalKey,evidenceDigest,rewardRuleDigest) {
  const digest=await digestText([
    'verified-order-v2',
    ownerId,
    cycleId,
    logicalKey,
    evidenceDigest,
    rewardRuleDigest,
  ].join('|'));
  return 'verified-order-'+digest.slice(0,40);
}

async function digestStrings(values) {
  return digestText(unique(values).sort().join('|'));
}

async function digestText(value) {
  const data=new TextEncoder().encode(String(value||''));
  const hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function toCredits(millions){return Math.max(0,Math.round((Number(millions)||0)*1_000_000))}
function sum(rows,key){return Math.round((Array.isArray(rows)?rows:[]).reduce((total,row)=>total+(Number(row?.[key])||0),0))}
function unique(values){return [...new Set((Array.isArray(values)?values:[]).map(value=>clean(value)).filter(Boolean))]}
function eventTime(row){return String(row?.appliedAt||row?.preparedAt||'')}
function round(value){return Math.round((Number(value)||0)*1000)/1000}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
