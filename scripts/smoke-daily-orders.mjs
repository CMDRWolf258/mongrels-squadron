import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for(const path of ['js/daily-orders-v2.js','css/mission-control-orders-v2.css','functions/api/operations/order-reports.js','functions/api/operations/orders.js','operations/index.html']) assert.ok(existsSync(path), path+' missing');

const page=readFileSync('operations/index.html','utf8');
assert.match(page,/mission-control-orders-v2\.css/);
assert.match(page,/daily-orders-v2\.js/);
assert.match(page,/data-orders-frontier-connect/);
assert.match(page,/data-orders-frontier-sync/);
assert.match(page,/Connect Elite/);
assert.match(page,/Sync Activity/);

const client=readFileSync('js/daily-orders-v2.js','utf8');
for(const pattern of [/\/api\/frontier\/status/,/\/api\/frontier\/sync/,/mongrel-frontier/,/renderFrontierControl/,/syncFrontierActivity/,/mc-system-order-card/,/mc-report-head/,/REPORT CZ VICTORY/,/Report a loss \/ disconnect/,/Full-instance disconnect/,/Combat Bonds not redeemed/,/Mission INF/,/inf2/,/inf3/,/inf4/,/inf5/,/REPORT BOUNTIES/,/REPORT TRADE/,/REPORT EXPLORATION/,/mc-system-focus/,/HIGH PRIORITY/,/VIEW ORDERS/,/HIDE ORDERS/,/mc-reset-report/,/resetReport/,/mc-my-reports/,/beginEdit/,/deleteSubmittedReport/,/method:editing\?'PATCH':'POST'/,/data-credit-amount/,/profit, not gross sales/i,/M Cr/,/one shared CZ victory counts once/i,/REPORT CZ VICTORY/,/data-cz-result/,/submitCzResult/,/joined-wing-result/,/Combat Bonds are supporting Frontier evidence/,/daily-order-report/,/trackedScore>=target/,/OPEN · CONTINUE PUSHING/]) assert.match(client,pattern);
new Function(client);

const apiSource=readFileSync('functions/api/operations/order-reports.js','utf8');
for(const pattern of [/ALLOWED_ACCESS/,/MANAGER_ACCESS/,/order-report:/,/order-submission:/,/daily-order-report/,/CZ_WEIGHTS/,/CZ_RESULT_OUTCOMES/,/WING_RESULT_WINDOW_MS/,/findCzResultDuplicate/,/participants/,/czResult/,/CREDIT_TYPES/,/bounties/,/trade/,/exploration/,/normalizeCredits/,/safeMillions/,/faction:order\.faction/,/kind:order\.kind/,/source:order\.source/,/lossLow/,/disconnectLow/,/czScore/,/infScore/,/reporterCount/,/submissions/,/canModify/,/recordIncludesUser/,/reportView/,/type!=='cz'/]) assert.match(apiSource,pattern);
const api=await import('../functions/api/operations/order-reports.js');
assert.equal(typeof api.onRequestGet,'function');
assert.equal(typeof api.onRequestPost,'function');
assert.equal(typeof api.onRequestPatch,'function');
assert.equal(typeof api.onRequestDelete,'function');
assert.match(apiSource,/value===null\|\|value===undefined\|\|value===''/,'Null workload targets must remain unquantified');

const orders=readFileSync('functions/api/operations/orders.js','utf8');
assert.match(orders,/cycleId/);
assert.match(orders,/reporting/);
for(const pattern of [/faction/,/kind/,/source/,/explicitTarget/,/source\.target === null/]) assert.match(orders,pattern);
for(const pattern of [/bounties/,/trade/,/exploration/,/M\\s\*Cr/]) assert.match(orders,pattern);

// Website requests include historical cycles; HUD requests intentionally omit
// them. Both must hit the same progress snapshot without cache ping-pong.
const baseProgressOrder={
  id:'trade-1',system:'NGC 2546 Sector UZ-G d10-16',faction:'Regiment of Imperial Mongrels',
  reporting:{type:'trade',target:20},
  workCycle:{cycleId:'cycle-1',cycleStartedAt:'2026-10-10T00:00:00Z',cycleEndsAt:'2026-10-11T00:00:00Z'},
};
const hudOrders={cycleId:'published-1',updatedAt:'2026-10-10T04:00:00Z',orders:[baseProgressOrder]};
const websiteOrders=structuredClone(hudOrders);
websiteOrders.orders[0].workCycleHistory=Array.from({length:14},(_,i)=>({cycleId:'past-'+i}));
assert.equal(api.orderProgressFingerprint(hudOrders),api.orderProgressFingerprint(websiteOrders),
  'HUD and website must share the same progress cache fingerprint despite different history depth');
assert.equal(websiteOrders.orders[0].workCycleHistory.length,14,'fingerprinting must not mutate historical order data');
const revisedOrders=structuredClone(hudOrders);
revisedOrders.orders[0].reporting.target=25;
assert.notEqual(api.orderProgressFingerprint(hudOrders),api.orderProgressFingerprint(revisedOrders),
  'changing an actual order target must invalidate progress');
const nextCycle=structuredClone(hudOrders);
nextCycle.orders[0].workCycle.cycleId='cycle-2';
assert.notEqual(api.orderProgressFingerprint(hudOrders),api.orderProgressFingerprint(nextCycle),
  'a new work cycle must invalidate progress');

console.log('✓ Mission Control expandable system cards and structured squad reporting are wired');
