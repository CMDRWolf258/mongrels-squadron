import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  appendRewardEntryWithResult,
  listAllRewardEntries,
  normalizeRewardEntry,
} from '../lib/reward-ledger.js';
import { issueReadyRewardObligations } from '../lib/reward-engine-runtime.js';

function fakeKv(){
  const map=new Map();
  return {
    map,
    async get(key,{type}={}){
      const value=map.get(key);
      if(value===undefined)return null;
      return type==='json'?JSON.parse(value):value;
    },
    async put(key,value){map.set(key,String(value));},
    async delete(key){map.delete(key);},
    async list({prefix=''}) {
      return {
        keys:[...map.keys()].filter(key=>key.startsWith(prefix)).map(name=>({name})),
        list_complete:true,
      };
    },
  };
}

const env={DAILY_ORDERS:fakeKv()};
const candidate={
  id:'verified-test-obligation',
  ownerId:'wolf',
  displayName:'Wolf258',
  kind:'colonization_job',
  amountCredits:20_000_000,
  entitlementCredits:20_000_000,
  existingVerifiedCredits:0,
  reason:'Verified Colonization Job reward',
  sourceJobId:'job-test',
  sourceJobRevisions:[1,2],
  sourcePublicationIds:['pub-a','pub-b'],
  sourceArchiveHashes:['hash-a','hash-b'],
  sourceEventIds:['event-a'],
  evidenceDigest:'evidence-digest',
  rewardRuleDigest:'rule-digest',
  rewardType:'colonization',
  verifiedContribution:1234,
  verifiedUnit:'t',
  ruleSnapshot:{type:'colonization',rewardBlockTons:500,rewardBlockMillions:10,personalCapMillions:null},
  status:'owed',
  createdBy:'Wolf',
  sourceObligationId:'verified-test-obligation',
  approvalMode:'manual_ready_issue',
  approvedAt:'2026-09-21T23:45:00.000Z',
  approvedBy:'Wolf',
};

const normalized=normalizeRewardEntry(candidate);
assert.equal(normalized.status,'owed');
assert.equal(normalized.approvalMode,'manual_ready_issue');
assert.equal(normalized.approvedBy,'Wolf');
assert.equal(normalized.sourceObligationId,candidate.id);
assert.equal(normalized.entitlementCredits,20_000_000);
assert.equal(normalized.existingVerifiedCredits,0);

const first=await appendRewardEntryWithResult(env,candidate);
assert.equal(first.created,true,'First deterministic obligation should create one ledger entry');
const second=await appendRewardEntryWithResult(env,candidate);
assert.equal(second.created,false,'Second attempt with same deterministic obligation must be idempotent');
assert.equal(second.entry.id,candidate.id);

await listAllRewardEntries(env);
const candidateTwo={...candidate,id:'verified-test-obligation-two',sourceObligationId:'verified-test-obligation-two',sourceEventIds:['event-b'],evidenceDigest:'evidence-digest-two'};
const third=await appendRewardEntryWithResult(env,candidateTwo);
assert.equal(third.created,true);
const cacheRecord=JSON.parse(env.DAILY_ORDERS.map.get('kv-list-cache:reward-ledger-v2'));
assert.ok(cacheRecord.keys.includes(third.key),'New reward keys must be written through to the cached ledger key list immediately');
assert.equal((await listAllRewardEntries(env)).length,2,'Immediate ledger reads must include a just-created entry without waiting for KV list propagation');

const orphanEnv={DAILY_ORDERS:fakeKv()};
const orphanKey='reward-ledger:wolf:verified-test-obligation';
orphanEnv.DAILY_ORDERS.map.set(orphanKey,JSON.stringify(normalized));
orphanEnv.DAILY_ORDERS.map.set('kv-list-cache:reward-ledger-v2',JSON.stringify({
  version:1,
  prefix:'reward-ledger:',
  cachedAt:new Date().toISOString(),
  keys:[],
}));
const recovered=await appendRewardEntryWithResult(orphanEnv,candidate);
assert.equal(recovered.created,false,'Direct deterministic lookup should find an existing orphan ledger entry');
assert.ok(JSON.parse(orphanEnv.DAILY_ORDERS.map.get('reward-ledger-key-registry-v1')).keys.includes(orphanKey),'Re-observing an existing ledger entry must adopt its key into the durable registry');
// Simulate a stale edge rebuilding the ordinary list cache without the entry.
orphanEnv.DAILY_ORDERS.map.set('kv-list-cache:reward-ledger-v2',JSON.stringify({
  version:1,
  prefix:'reward-ledger:',
  cachedAt:new Date().toISOString(),
  keys:[],
}));
const recoveredRows=await listAllRewardEntries(orphanEnv);
assert.equal(recoveredRows.length,1,'Durable reward key registry must keep an existing entry visible even when the normal KV list cache is stale');
assert.equal(recoveredRows[0].id,candidate.id);

console.log('✓ Reward ledger deterministic issue is idempotent and durable key registry survives stale KV enumeration');

const autoEnv={DAILY_ORDERS:fakeKv()};
const readyObligation={
  id:'auto-ready-one',
  ownerId:'wolf',
  commander:'Wolf258',
  deltaCredits:14_000_000,
  readyForLive:true,
  blockers:[],
  fundingMode:'squad',
  plannedEntry:{
    version:3,
    id:'auto-ready-one',
    ownerId:'wolf',
    displayName:'Wolf258',
    kind:'verified_order',
    amountCredits:14_000_000,
    entitlementCredits:24_000_000,
    existingVerifiedCredits:10_000_000,
    reason:'Verified Daily Order reward',
    sourceCycleId:'cycle-a',
    sourceLogicalKey:'wolf-dynasty-inf',
    sourceEventIds:['event-1'],
    evidenceDigest:'evidence-auto-one',
    rewardRuleDigest:'rules-auto-one',
    rewardType:'inf',
    verifiedContribution:24,
    verifiedUnit:'INF',
    fundingMode:'squad',
    status:'owed',
    createdBy:'reward-engine',
  },
};
const blockedObligation={
  ...readyObligation,
  id:'blocked-one',
  deltaCredits:5_000_000,
  readyForLive:false,
  blockers:['archive_provenance_missing'],
  plannedEntry:{...readyObligation.plannedEntry,id:'blocked-one',amountCredits:5_000_000},
};
const memberFundedObligation={
  ...readyObligation,
  id:'member-funded-one',
  fundingMode:'member',
  plannedEntry:{...readyObligation.plannedEntry,id:'member-funded-one',fundingMode:'member',payerOwnerId:'payer'},
};
const autoDryRun={members:[{ownerId:'wolf',commander:'Wolf258',obligations:[readyObligation,blockedObligation,memberFundedObligation]}]};
const automatic=await issueReadyRewardObligations(autoEnv,autoDryRun,{actor:'Reward Engine Test'});
assert.equal(automatic.created,1,'Exactly one current READY squad obligation should auto-create debt');
assert.equal(automatic.createdCredits,14_000_000);
assert.equal(automatic.ready,1,'Blocked and member-funded obligations must not enter squad automatic issuance');
const autoRows=await listAllRewardEntries(autoEnv);
assert.equal(autoRows.length,1);
assert.equal(autoRows[0].status,'owed');
assert.equal(autoRows[0].approvalMode,'automatic_verified_issue');
assert.equal(autoRows[0].approvedBy,'Reward Engine Test');
const automaticRetry=await issueReadyRewardObligations(autoEnv,autoDryRun,{actor:'Reward Engine Test'});
assert.equal(automaticRetry.created,0,'Repeating the same READY obligation must not duplicate debt');
assert.equal(automaticRetry.duplicateSuppressed,1);
assert.equal((await listAllRewardEntries(autoEnv)).length,1);
console.log('✓ READY verified rewards auto-create OWED debt exactly once while blockers remain audit-only');

const issue=readFileSync('functions/api/rewards/issue.js','utf8');
for(const pattern of [
  /session\.access!=='site_admin'/,
  /validateSameOrigin/,
  /wolf-reward-issue/,
  /buildUnifiedRewardEngineState/,
  /flattenRewardObligations/,
  /reward_obligation_stale_or_missing/,
  /reward_obligation_not_ready/,
  /reward_obligation_changed/,
  /expectedAmountCredits/,
  /expectedEvidenceDigest/,
  /expectedRewardRuleDigest/,
  /appendRewardEntryWithResult/,
  /manual_ready_issue/,
  /status:'owed'/,
]) assert.match(issue,pattern);
assert.doesNotMatch(issue,/body\?\.plannedEntry|body\.plannedEntry/,'Issue endpoint must never trust a client-supplied ledger entry');
assert.doesNotMatch(issue,/status:'paid'/,'Controlled issue must create debt only, never mark payment sent');
console.log('✓ Issue API re-computes READY state server-side and only creates OWED debt');

const runtime=readFileSync('lib/reward-engine-runtime.js','utf8');
assert.match(runtime,/buildRewardDryRun/);
assert.match(runtime,/buildColonizationRewardDryRun/);
assert.match(runtime,/mergeRewardDryRuns/);
assert.match(runtime,/listAllRewardEntries/);
assert.match(runtime,/issueReadyRewardObligations/);
assert.match(runtime,/automatic_verified_issue/);
assert.match(runtime,/reconcileAutomaticRewardEntries/);
console.log('✓ Unified Reward Engine can automatically reconcile READY obligations into OWED debt');

const ui=readFileSync('js/wolf-bgs-rewards.js','utf8');
for(const pattern of [
  /\/api\/rewards\/reconcile/,
  /wolf-reward-auto-reconcile/,
  /AUTO OWED ON/,
  /automatic OWED issuance ON/,
]) assert.match(ui,pattern);
assert.doesNotMatch(ui,/issue\.textContent='CREATE OWED ENTRY'/,'Reward audit must not require per-obligation issuance buttons');
assert.doesNotMatch(ui,/if\(index===0\)details\.open=true/,'Reward audit member rows should stay collapsed until opened');
new Function(ui);

const reconcileApi=readFileSync('functions/api/rewards/reconcile.js','utf8');
for(const pattern of [
  /reconcileAutomaticRewardEntries/,
  /wolf-reward-auto-reconcile/,
  /automaticIssuance:true/,
]) assert.match(reconcileApi,pattern);

const frontierSync=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(frontierSync,/reconcileAutomaticRewardEntries/);
assert.match(frontierSync,/Reward Engine · Frontier Sync/);
const scoutIngest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
assert.match(scoutIngest,/reconcileAutomaticRewardEntries/);
assert.match(scoutIngest,/Reward Engine · Live Scout/);

const dryRunApi=readFileSync('functions/api/rewards/dry-run.js','utf8');
assert.match(dryRunApi,/engineMode:'automatic_verified'/);
assert.match(dryRunApi,/automaticLedgerWrites:true/);
assert.match(dryRunApi,/canIssueReady:false/);

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/Reward Engine · AUTOMATIC/);
assert.match(page,/Valid READY rewards now create OWED ledger entries automatically/i);
assert.match(page,/blocked rows stay in this audit for review and never create debt automatically/i);
assert.match(page,/wolf-bgs-rewards\.js\?v=17/);
assert.match(page,/wolf-bgs-dry-run\.css\?v=4/);
console.log('✓ BGS Control uses automatic READY-to-OWED issuance and keeps the audit collapsed');

console.log('\nAll automatic reward-ledger issuance smoke checks passed.');
