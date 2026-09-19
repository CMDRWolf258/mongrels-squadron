import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for(const path of ['js/daily-orders-v2.js','css/mission-control-orders-v2.css','functions/api/operations/order-reports.js','functions/api/operations/orders.js','operations/index.html']) assert.ok(existsSync(path), path+' missing');

const page=readFileSync('operations/index.html','utf8');
assert.match(page,/mission-control-orders-v2\.css/);
assert.match(page,/daily-orders-v2\.js/);

const client=readFileSync('js/daily-orders-v2.js','utf8');
for(const pattern of [/mc-system-order-card/,/mc-report-head/,/CZ victories/,/Losses \/ disconnects/,/Full-instance disconnect/,/Combat Bonds not redeemed/,/Mission INF/,/inf2/,/inf3/,/inf4/,/inf5/,/REPORT BOUNTIES/,/REPORT TRADE/,/REPORT EXPLORATION/,/mc-system-focus/,/HIGH PRIORITY/,/VIEW ORDERS/,/HIDE ORDERS/,/mc-reset-report/,/resetReport/,/mc-my-reports/,/beginEdit/,/deleteSubmittedReport/,/method:editing\?'PATCH':'POST'/,/data-credit-amount/,/profit, not gross sales/i,/M Cr/,/one shared wing instance/i,/daily-order-report/,/score>=target/,/BLITZ · keep pushing/]) assert.match(client,pattern);
new Function(client);

const apiSource=readFileSync('functions/api/operations/order-reports.js','utf8');
for(const pattern of [/ALLOWED_ACCESS/,/MANAGER_ACCESS/,/order-report:/,/order-submission:/,/daily-order-report/,/CZ_WEIGHTS/,/CREDIT_TYPES/,/bounties/,/trade/,/exploration/,/normalizeCredits/,/safeMillions/,/faction:order\.faction/,/kind:order\.kind/,/source:order\.source/,/lossLow/,/disconnectLow/,/czScore/,/infScore/,/reporterCount/,/submissions/,/canModify/,/reportView/]) assert.match(apiSource,pattern);
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

console.log('✓ Mission Control expandable system cards and structured squad reporting are wired');
