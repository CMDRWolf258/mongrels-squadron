import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api=readFileSync('functions/api/frontier/admin-events.js','utf8');
for(const pattern of [
  /site_admin_access_required/,
  /listFrontierAccounts/,
  /getEvents/,
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
  /wolf-bgs-frontier-diagnostics\.css\?v=1/,
  /wolf-bgs-frontier-diagnostics\.js\?v=2/,
])assert.match(page,pattern);

const css=readFileSync('css/wolf-bgs-frontier-diagnostics.css','utf8');
for(const pattern of [
  /wolf-frontier-event/,
  /wolf-frontier-eligibility\.is-eligible/,
  /wolf-frontier-order-match\.is-unmatched/,
])assert.match(css,pattern);

assert.doesNotMatch(api,/onRequestPost|onRequestPut|onRequestPatch|onRequestDelete/,'diagnostics API must remain read-only');

console.log('✓ Site Admin Frontier diagnostics exposes stored activity separately from order/reward matching');
