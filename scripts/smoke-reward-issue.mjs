import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  appendRewardEntryWithResult,
  normalizeRewardEntry,
} from '../lib/reward-ledger.js';

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
console.log('✓ Reward ledger deterministic issue is idempotent and preserves approval audit');

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
console.log('✓ DRY RUN and manual issue share one unified reward-engine evaluation path');

const ui=readFileSync('js/wolf-bgs-rewards.js','utf8');
for(const pattern of [
  /CREATE OWED ENTRY/,
  /data-issue-ready-reward/,
  /canIssueReady===true/,
  /\/api\/rewards\/issue/,
  /expectedAmountCredits/,
  /expectedEvidenceDigest/,
  /expectedRewardRuleDigest/,
  /does NOT mark any in-game payment as sent/,
  /AUTO WRITES OFF/,
]) assert.match(ui,pattern);
new Function(ui);

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/site admin may explicitly promote a READY row into the actual ledger as OWED/i);
assert.match(page,/server re-validates the evidence, rules, amount, and duplicate state/i);
assert.match(page,/wolf-bgs-rewards\.js\?v=13/);
assert.match(page,/wolf-bgs-dry-run\.css\?v=3/);
console.log('✓ BGS Control exposes the controlled READY-to-OWED action with explicit payment wording');

console.log('\nAll controlled reward-ledger issue smoke checks passed.');
