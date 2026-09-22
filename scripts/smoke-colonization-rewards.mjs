import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildColonizationRewardDryRun,
  mergeRewardDryRuns,
} from '../lib/colonization-reward-dry-run.js';

const baseJob={
  id:'job-a',
  revision:1,
  revisionStartedAt:'2026-09-21T12:00:00.000Z',
  title:'Test Build Reward',
  system:'Test System',
  scope:'market',
  marketId:'',
  buildName:'Test Build',
  commodity:'',
  targetTons:5000,
  rewardBlockTons:500,
  rewardBlockMillions:10,
  personalCapMillions:null,
  status:'active',
  startsAt:'2026-09-21T12:00:00.000Z',
  endsAt:null,
  notes:'',
  createdAt:'2026-09-21T12:00:00.000Z',
  createdBy:'Wolf',
  updatedAt:'2026-09-21T12:00:00.000Z',
  updatedBy:'Wolf',
};
const boundJob={
  ...baseJob,
  revision:2,
  revisionStartedAt:'2026-09-21T12:10:00.000Z',
  marketId:'12345',
  updatedAt:'2026-09-21T12:10:00.000Z',
};

const history=[
  record({
    publicationId:'create-job-a',
    appliedAt:'2026-09-21T12:00:01.000Z',
    action:'create',
    before:[],
    after:[baseJob],
    beforeHash:'before-create',
    afterHash:'after-create',
  }),
  record({
    publicationId:'bind-job-a',
    appliedAt:'2026-09-21T12:10:01.000Z',
    action:'update',
    before:[baseJob],
    after:[boundJob],
    beforeHash:'before-bind',
    afterHash:'after-bind',
  }),
];

const events=[
  contribution('event-before-bind','2026-09-21T12:05:00.000Z','12345',500),
  contribution('event-after-bind','2026-09-21T12:15:00.000Z','12345',500),
];

const ready=await buildColonizationRewardDryRun({
  accounts:[account('wolf','Wolf258',events)],
  colonizationStore:{version:1,jobs:[boundJob]},
  historyRecords:history,
  ledgerEntries:[],
});
assert.equal(ready.summary.readyObligations,1,'Expected one ready Colonization obligation');
assert.equal(ready.summary.blockedObligations,0,'Retroactive initial site discovery should not create a blocker');
assert.equal(ready.summary.wouldCreateCredits,20_000_000,'Two 500t blocks should preview 20M Cr');
const obligation=ready.members[0].obligations[0];
assert.equal(obligation.contribution,1000);
assert.deepEqual(obligation.revisions,[1,2],'Evidence should retain both event-time job revisions');
assert.deepEqual(obligation.sourceEventIds,['event-after-bind','event-before-bind'],'Frontier evidence IDs should be deterministic');
assert.equal(obligation.readyForLive,true);
assert.ok(obligation.bindingProvenanceSet.some(row=>row.publicationId==='bind-job-a'),'Pre-binding cargo must cite the later site-binding publication');
assert.equal(obligation.plannedEntry.kind,'colonization_job');
assert.equal(obligation.plannedEntry.sourceJobId,'job-a');
console.log('✓ Initial construction-site discovery can identify earlier cargo while preserving event-time reward rules');

const duplicate=await buildColonizationRewardDryRun({
  accounts:[account('wolf','Wolf258',events)],
  colonizationStore:{version:1,jobs:[boundJob]},
  historyRecords:history,
  ledgerEntries:[{
    kind:'colonization_job',
    ownerId:'wolf',
    sourceJobId:'job-a',
    amountCredits:20_000_000,
  }],
});
assert.equal(duplicate.summary.readyObligations,0);
assert.equal(duplicate.summary.duplicateSuppressed,1,'Fully ledgered Colonization debt should be duplicate suppressed');
assert.equal(duplicate.members[0].obligations[0].deltaCredits,0);
console.log('✓ Existing Colonization ledger credit suppresses duplicate debt');

const jobB={
  ...boundJob,
  id:'job-b',
  revision:1,
  revisionStartedAt:'2026-09-21T12:00:00.000Z',
  title:'Competing Build Reward',
  createdAt:'2026-09-21T12:00:00.000Z',
  updatedAt:'2026-09-21T12:00:00.000Z',
};
const ambiguityHistory=[
  record({publicationId:'create-a',appliedAt:'2026-09-21T12:00:01.000Z',action:'create',before:[],after:[{...boundJob,revision:1,revisionStartedAt:'2026-09-21T12:00:00.000Z'}],beforeHash:'x',afterHash:'a'}),
  record({publicationId:'create-b',appliedAt:'2026-09-21T12:00:02.000Z',action:'create',before:[{...boundJob,revision:1,revisionStartedAt:'2026-09-21T12:00:00.000Z'}],after:[{...boundJob,revision:1,revisionStartedAt:'2026-09-21T12:00:00.000Z'},jobB],beforeHash:'a',afterHash:'b'}),
];
const ambiguous=await buildColonizationRewardDryRun({
  accounts:[account('wolf','Wolf258',[contribution('ambiguous-event','2026-09-21T12:20:00.000Z','12345',500)])],
  colonizationStore:{version:1,jobs:[{...boundJob,revision:1,revisionStartedAt:'2026-09-21T12:00:00.000Z'},jobB]},
  historyRecords:ambiguityHistory,
  ledgerEntries:[],
});
assert.equal(ambiguous.summary.readyObligations,0);
assert.equal(ambiguous.summary.blockedObligations,1);
assert.ok(ambiguous.members[0].obligations[0].blockers.includes('colonization_overlap_ambiguous'));
assert.equal(ambiguous.members[0].obligations[0].plannedEntry,null,'Ambiguous overlap must never plan a ledger entry');
console.log('✓ Equal-specificity Colonization overlap enters Reward Engine as BLOCKED');

const legacyJob={
  ...boundJob,
  id:'legacy-job',
  revision:1,
  revisionStartedAt:'2026-09-21T13:00:00.000Z',
  createdAt:'2026-09-21T13:00:00.000Z',
  updatedAt:'2026-09-21T13:00:00.000Z',
};
const legacyHistory=[{
  ...record({
    publicationId:'colonization-baseline-v1',
    appliedAt:'2026-09-21T14:00:00.000Z',
    action:'baseline',
    before:[],
    after:[legacyJob],
    beforeHash:'legacy-before',
    afterHash:'legacy-after',
  }),
  legacyBaseline:true,
}];
const legacy=await buildColonizationRewardDryRun({
  accounts:[account('wolf','Wolf258',[contribution('legacy-event','2026-09-21T13:30:00.000Z','12345',500,'Test System')])],
  colonizationStore:{version:1,jobs:[legacyJob]},
  historyRecords:legacyHistory,
  ledgerEntries:[],
});
assert.equal(legacy.summary.readyObligations,0);
assert.equal(legacy.summary.blockedObligations,1);
assert.equal(legacy.members[0].obligations[0].entitlementCredits,10_000_000);
assert.ok(legacy.members[0].obligations[0].blockers.includes('colonization_legacy_history_gap'));
console.log('✓ Pre-baseline legacy cargo is valued but BLOCKED instead of receiving guessed provenance');

const merged=mergeRewardDryRuns({
  mode:'dry_run',
  summary:{connectedMembers:1},
  members:[],
},ready);
assert.deepEqual(merged.sources,['daily_orders','colonization']);
assert.equal(merged.summary.colonizationObligations,1);
assert.equal(merged.summary.wouldCreateCredits,20_000_000);
console.log('✓ Colonization obligations merge into the existing unified DRY RUN summary');

const api=readFileSync('functions/api/rewards/dry-run.js','utf8');
const runtime=readFileSync('lib/reward-engine-runtime.js','utf8');
assert.match(api,/buildUnifiedRewardEngineState/,'Reward DRY RUN API is not using the unified reward engine');
assert.match(runtime,/buildColonizationRewardDryRun/,'Unified Reward Engine is not building Colonization obligations');
assert.match(runtime,/listColonizationJobPublications/,'Unified Reward Engine is missing Colonization history provenance');
const ui=readFileSync('js/wolf-bgs-rewards.js','utf8');
for(const pattern of [/DAILY ORDERS/,/COLONIZATION/,/SCOUTING/,/sourceNames/])assert.match(ui,pattern,'Reward Engine UI does not identify the unified sources');
assert.match(ui,/colonization_overlap_ambiguous/,'Reward Engine UI is missing the Colonization ambiguity blocker');
const html=readFileSync('wolf-bgs/index.html','utf8');
assert.match(html,/COLONY ARCHIVE/,'Reward Engine metadata does not expose the Colonization archive');

console.log('\nAll Colonization Reward Engine dry-run smoke checks passed.');

function account(userId,commander,events){
  return {userId,account:{commander},events};
}

function contribution(id,timestamp,marketId,totalTons,system='Test System'){
  return {
    id,
    type:'colonization_contribution',
    timestamp,
    system,
    marketId,
    totalTons,
    contributions:[{commodity:'Titanium',commodityCode:'titanium',amount:totalTons}],
  };
}

function record({publicationId,appliedAt,action,before,after,beforeHash,afterHash}){
  return {
    version:1,
    publicationId,
    state:'applied',
    action,
    targetJobId:'',
    preparedAt:appliedAt,
    appliedAt,
    failedAt:null,
    failure:'',
    actor:'Wolf',
    legacyBaseline:false,
    beforeHash,
    afterHash,
    changes:{counts:{added:0,revised:0,removed:0,unchanged:0},material:true,rows:[]},
    before:{version:1,jobs:before,updatedAt:appliedAt,updatedBy:'Wolf'},
    after:{version:1,jobs:after,updatedAt:appliedAt,updatedBy:'Wolf'},
  };
}
