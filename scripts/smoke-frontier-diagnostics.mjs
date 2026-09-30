import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const frontier=readFileSync('lib/frontier.js','utf8');
const sync=readFileSync('functions/api/frontier/sync.js','utf8');

const api=readFileSync('functions/api/frontier/admin-events.js','utf8');
for(const pattern of [
  /site_admin_access_required/,
  /listFrontierAccounts/,
  /getEvents/,
  /getDiagnosticEvents/,
  /diagnostics:/,
  /matchVerifiedActivityHistory/,
  /summarizeEvents/,
  /storedEventCount/,
  /bgsTradeEligible/,
  /tradeEligibilityReason/,
  /tradeSourceVerified/,
])assert.match(api,pattern);

const client=readFileSync('js/wolf-bgs-frontier-diagnostics.js','utf8');
for(const pattern of [
  /\/api\/frontier\/admin-events/,
  /BGS TRADE ELIGIBLE/,
  /INELIGIBLE/,
  /NO DAILY ORDER MATCH/,
  /DAILY ORDER MATCH/,
  /tradeEligibilityReason/,
  /sessionStorage/,
  /data-frontier-diagnostics-view/,
  /Raw Journal Trace/,
  /diagnosticCard/,
  /loadMember/,
])assert.match(client,pattern);
new Function(client);

const page=readFileSync('wolf-bgs/index.html','utf8');
for(const pattern of [
  /data-frontier-diagnostics/,
  /Stored Frontier Activity/,
  /data-frontier-last-sync/,
  /data-frontier-last-event/,
  /data-frontier-event-count/,
  /data-frontier-journal-count/,
  /data-frontier-diagnostics-view/,
  /wolf-bgs-frontier-diagnostics\.css\?v=1/,
  /wolf-bgs-frontier-diagnostics\.js\?v=3/,
])assert.match(page,pattern);

const css=readFileSync('css/wolf-bgs-frontier-diagnostics.css','utf8');
for(const pattern of [
  /wolf-frontier-event/,
  /wolf-frontier-eligibility\.is-eligible/,
  /wolf-frontier-order-match\.is-unmatched/,
])assert.match(css,pattern);

assert.doesNotMatch(api,/onRequestPost|onRequestPut|onRequestPatch|onRequestDelete/,'diagnostics API must remain read-only');

assert.match(frontier,/DIAGNOSTICS_PREFIX/,'Diagnostic journal rows need their own store');
assert.match(frontier,/MAX_DIAGNOSTIC_EVENTS = 2000/,'Diagnostic journal store must remain bounded');
assert.match(frontier,/mergeDiagnosticEvents/,'Diagnostic journal rows must be persistable');
assert.match(frontier,/getDiagnosticEvents/,'Persisted diagnostic journal rows must be readable');
assert.match(sync,/mergeDiagnosticEvents\(env,userId,parsed\.diagnostics\)/,'Site-admin sync must persist sanitized diagnostics');
assert.match(sync,/storedDiagnosticEvents/,'Sync response should expose persisted diagnostic row count');

console.log('✓ Site Admin Frontier diagnostics exposes stored activity separately from order/reward matching');
