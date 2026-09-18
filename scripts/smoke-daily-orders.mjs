import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for(const path of ['js/daily-orders-v2.js','css/mission-control-orders-v2.css','functions/api/operations/order-reports.js','functions/api/operations/orders.js','operations/index.html']) assert.ok(existsSync(path), path+' missing');

const page=readFileSync('operations/index.html','utf8');
assert.match(page,/mission-control-orders-v2\.css/);
assert.match(page,/daily-orders-v2\.js/);

const client=readFileSync('js/daily-orders-v2.js','utf8');
for(const pattern of [/mc-system-order-card/,/SQUAD PROGRESS/,/CZ victories/,/Losses \/ disconnects/,/Full-instance disconnect/,/Combat Bonds not redeemed/,/Mission INF/,/inf2/,/inf3/,/inf4/,/inf5/,/one shared wing instance/i,/daily-order-report/,/score>=s\.target/,/BLITZ · keep pushing/]) assert.match(client,pattern);
new Function(client);

const apiSource=readFileSync('functions/api/operations/order-reports.js','utf8');
for(const pattern of [/ALLOWED_ACCESS/,/order-report:/,/daily-order-report/,/CZ_WEIGHTS/,/lossLow/,/disconnectLow/,/czScore/,/infScore/,/reporterCount/,/submissions/]) assert.match(apiSource,pattern);
const api=await import('../functions/api/operations/order-reports.js');
assert.equal(typeof api.onRequestGet,'function');
assert.equal(typeof api.onRequestPost,'function');

const orders=readFileSync('functions/api/operations/orders.js','utf8');
assert.match(orders,/cycleId/);
assert.match(orders,/reporting/);

console.log('✓ Mission Control expandable system cards and structured squad reporting are wired');
