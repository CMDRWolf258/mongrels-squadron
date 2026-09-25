import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  autoSyncDue,
  FRONTIER_AUTO_SYNC_BATCH_SIZE,
  FRONTIER_AUTO_SYNC_INTERVAL_MS,
} from '../functions/api/internal/frontier-auto-sync.js';

const now=Date.parse('2026-09-25T12:00:00.000Z');
assert.equal(FRONTIER_AUTO_SYNC_INTERVAL_MS,24*60*60*1000);
assert.equal(FRONTIER_AUTO_SYNC_BATCH_SIZE,8);

assert.equal(autoSyncDue({lastSyncAt:'2026-09-24T11:59:59.000Z'},now),true,'24+ hour old sync must be due');
assert.equal(autoSyncDue({lastSyncAt:'2026-09-24T18:00:00.000Z'},now),false,'Recent manual/automatic sync must suppress the safety sync');
assert.equal(autoSyncDue({lastSyncAt:null},now),true,'Never-synced connected account must be eligible');
assert.equal(
  autoSyncDue({
    lastSyncAt:'2026-09-20T00:00:00.000Z',
    autoSyncReauthRequired:true,
    lastAutoSyncAttemptAt:'2026-09-25T06:00:00.000Z',
  },now),
  false,
  'Reauthorization failures should not be retried every six-hour scheduler wake',
);
assert.equal(
  autoSyncDue({
    lastSyncAt:'2026-09-20T00:00:00.000Z',
    autoSyncReauthRequired:true,
    lastAutoSyncAttemptAt:'2026-09-24T11:00:00.000Z',
  },now),
  true,
  'Reauthorization failures may be retried after a day',
);
console.log('✓ Frontier auto-sync eligibility is 24 hours even though the scheduler wakes every 6 hours');

const endpoint=readFileSync('functions/api/internal/frontier-auto-sync.js','utf8');
for(const pattern of [
  /FRONTIER_AUTO_SYNC_BATCH_SIZE=8/,
  /listFrontierAccounts/,
  /syncFrontierAccount/,
  /respectCooldown:false/,
  /syncSource:'auto'/,
  /lastAutoSyncAttemptAt/,
  /autoSyncReauthRequired/,
  /FRONTIER_AUTO_SYNC_CRON_TOKEN/,
  /SCOUT_DISCORD_CRON_TOKEN/,
  /no_longer_due/,
])assert.match(endpoint,pattern);

const sync=readFileSync('functions/api/frontier/sync.js','utf8');
for(const pattern of [
  /export async function syncFrontierAccount/,
  /syncSource='manual'/,
  /lastSyncSource:syncSource==='auto'\?'auto':'manual'/,
  /lastAutoSyncAt:syncedAt/,
  /lastAutoSyncAttemptAt:syncedAt/,
  /archivedRemovedOrders/,
  /archivedOrderSystems/,
  /listOrderPublications\(env,\{limit:250\}\)/,
])assert.match(sync,pattern);
assert.match(sync,/userId:auth\.session\.sub/,'Manual Sync Elite must continue to bind the account to the authenticated member');

const frontier=readFileSync('lib/frontier.js','utf8');
for(const pattern of [
  /lastSyncSource/,
  /lastAutoSyncAt/,
  /lastAutoSyncAttemptAt/,
  /lastAutoSyncError/,
  /autoSyncReauthRequired/,
])assert.match(frontier,pattern);

const workflow=readFileSync('.github/workflows/frontier-auto-sync.yml','utf8');
assert.match(workflow,/cron: '23 \*\/6 \* \* \*'/,'Scheduler must wake every six hours');
assert.match(workflow,/FRONTIER_AUTO_SYNC_CRON_TOKEN/);
assert.match(workflow,/SCOUT_DISCORD_CRON_TOKEN/);
assert.match(workflow,/\/api\/internal\/frontier-auto-sync/);

console.log('✓ Scheduled Frontier safety sync is protected, bounded, and wired to the live site');
console.log('\nAll Frontier automatic safety-sync smoke checks passed.');
