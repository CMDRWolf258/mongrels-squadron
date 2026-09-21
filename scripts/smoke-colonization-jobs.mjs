import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  buildColonizationJobsStore,
  colonizationJobRevisionFingerprint,
  normalizeColonizationJob,
} from '../lib/colonization-jobs.js';
import {
  COLONIZATION_JOB_HISTORY_BASELINE_KEY,
  ensureColonizationJobHistoryBaseline,
  findColonizationJobRevisionProvenance,
  listColonizationJobPublications,
  markColonizationJobPublicationApplied,
  prepareColonizationJobPublication,
} from '../lib/colonization-job-history.js';

class MemoryKv {
  constructor(){this.map=new Map();}
  async get(key,options={}){
    const value=this.map.get(key);
    if(value===undefined)return null;
    if(options?.type==='json')return typeof value==='string'?JSON.parse(value):value;
    return value;
  }
  async put(key,value){this.map.set(key,value);}
  async list({prefix='',limit=1000}={}){
    const keys=[...this.map.keys()].filter(key=>key.startsWith(prefix)).sort().slice(0,limit).map(name=>({name}));
    return {keys,list_complete:true};
  }
}

const original=normalizeColonizationJob({
  id:'rivers-hub',
  title:'Rivers Hub construction',
  system:'Test System',
  scope:'market',
  marketId:'12345',
  buildName:'Rivers Hub',
  targetTons:10000,
  rewardBlockTons:500,
  rewardBlockMillions:10,
  personalCapMillions:40,
  startsAt:'2026-09-21T12:00:00.000Z',
  createdBy:'Wolf',
  updatedBy:'Wolf',
});
assert.equal(original.revision,1,'New Colonization Jobs must begin at revision 1');
assert.ok(original.revisionStartedAt,'New Colonization Jobs must record revisionStartedAt');

const noOp=normalizeColonizationJob({...original,updatedBy:'Wolf'},original);
assert.equal(noOp.revision,1,'Metadata-only/no-op normalization must not create a new job revision');
assert.equal(
  colonizationJobRevisionFingerprint(noOp),
  colonizationJobRevisionFingerprint(original),
  'No-op normalization changed the material fingerprint',
);

const changed=normalizeColonizationJob({...original,rewardBlockMillions:15,updatedBy:'Wolf'},original);
assert.equal(changed.revision,2,'Changing a payout rule must increment the Colonization Job revision');
assert.notEqual(
  colonizationJobRevisionFingerprint(changed),
  colonizationJobRevisionFingerprint(original),
  'Changing a payout rule did not change the material fingerprint',
);

const rebound=normalizeColonizationJob({...changed,marketId:'67890',updatedBy:'Wolf'},changed);
assert.equal(rebound.revision,3,'Changing the construction-site binding must increment the revision');

const kv=new MemoryKv();
const env={DAILY_ORDERS:kv};
const legacyStore=buildColonizationJobsStore([original],'Wolf','2026-09-21T13:00:00.000Z');
const baseline=await ensureColonizationJobHistoryBaseline(env,legacyStore);
assert.ok(baseline,'Existing jobs should receive a one-time history baseline');
assert.equal(baseline.state,'applied','Legacy baseline must be immediately APPLIED');
assert.equal(baseline.action,'baseline','Legacy baseline action changed unexpectedly');
assert.equal(baseline.after.jobs[0].revision,1,'Legacy baseline must preserve revision 1');
assert.ok(kv.map.has(COLONIZATION_JOB_HISTORY_BASELINE_KEY),'Baseline key was not persisted');

const keyCountAfterBaseline=kv.map.size;
await ensureColonizationJobHistoryBaseline(env,legacyStore);
assert.equal(kv.map.size,keyCountAfterBaseline,'Baseline migration must be idempotent');

const revisedStore=buildColonizationJobsStore([changed],'Wolf','2026-09-21T14:00:00.000Z');
const prepared=await prepareColonizationJobPublication(env,{
  before:legacyStore,
  after:revisedStore,
  actor:'Wolf',
  action:'update',
  targetJobId:original.id,
});
assert.equal(prepared.record.state,'prepared','Job history must be written before the live mutation');
assert.equal(prepared.record.changes.counts.revised,1,'Revision change was not detected');
assert.ok(prepared.record.beforeHash&&prepared.record.afterHash,'History snapshot hashes are required');
assert.notEqual(prepared.record.beforeHash,prepared.record.afterHash,'Material revision should change the snapshot hash');

const applied=await markColonizationJobPublicationApplied(env,prepared);
assert.equal(applied.state,'applied','Prepared Colonization Job history did not finalize as APPLIED');

const records=await listColonizationJobPublications(env,{limit:20});
assert.equal(records.length,2,'Expected baseline plus one revision publication');
const provenanceV1=findColonizationJobRevisionProvenance(records,{jobId:original.id,revision:1});
const provenanceV2=findColonizationJobRevisionProvenance(records,{jobId:original.id,revision:2});
assert.equal(provenanceV1?.match,'exact','Revision 1 provenance was not recoverable');
assert.equal(provenanceV2?.match,'exact','Revision 2 provenance was not recoverable');
assert.equal(provenanceV2?.archivedJob?.rewardBlockMillions,15,'Archived payout rule did not match revision 2');

for(const path of [
  'lib/colonization-job-history.js',
  'functions/api/operations/colonization-job-history.js',
  'js/wolf-bgs-colonization-history.js',
  'wolf-bgs/index.html',
]){
  assert.ok(existsSync(path),`Colonization Job history critical file is missing: ${path}`);
}

const apiSource=readFileSync('functions/api/operations/colonization-jobs.js','utf8');
assert.match(apiSource,/prepareColonizationJobPublication/,'Colonization Jobs API is not preparing write-ahead history');
assert.match(apiSource,/markColonizationJobPublicationApplied/,'Colonization Jobs API is not finalizing history');
assert.match(apiSource,/ensureColonizationJobHistoryBaseline/,'Colonization Jobs API is not protecting legacy jobs with a baseline');

const html=readFileSync('wolf-bgs/index.html','utf8');
assert.match(html,/data-colonization-history/,'Wolf BGS Control is missing the Colonization Job History panel');
assert.match(html,/wolf-bgs-colonization-history\.js/,'Wolf BGS Control is not loading the Colonization Job History client');

const client=readFileSync('js/wolf-bgs-colonization.js','utf8');
assert.match(client,/wolf-bgs-colonization-history-updated/,'Colonization Job mutations do not refresh history');

console.log('✓ Colonization Job revisions increment only on material definition changes');
console.log('✓ Legacy jobs receive an idempotent revision-1 provenance baseline');
console.log('✓ Colonization Job mutations have PREPARED → APPLIED write-ahead history');
console.log('✓ Exact archived job revisions remain recoverable for future reward provenance');
console.log('\nAll Colonization Job history smoke checks passed.');
