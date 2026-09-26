import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultTradeControl } from '../lib/trade-intelligence.js';
import {
  buildSpanshLoopSnapshotBody,
  evaluateSpecificLoop,
  normalizeLoopSearch,
  optimizeTradeLoops,
} from '../lib/trade-loop-finder.js';

const control=defaultTradeControl();

const twoQuery=normalizeLoopSearch({
  startSystem:'Home',
  scope:'radius',
  legCount:2,
  radiusLy:50,
  cargoCapacity:100,
  minPad:3,
  carrierMode:'exclude',
  priority:'standard',
  thresholdDropPercent:25,
  limit:10,
},control);
assert.equal(twoQuery.legCount,2);
assert.equal(twoQuery.radiusLy,50);
assert.equal(twoQuery.cargoCapacity,100);
assert.equal(twoQuery.mongrelOnly,false);

const triangleClamped=normalizeLoopSearch({
  startSystem:'Home',
  scope:'radius',
  legCount:3,
  radiusLy:250,
  cargoCapacity:100,
},control);
assert.equal(triangleClamped.radiusLy,100,'cross-system 3-leg searches must stay bounded to 100 ly');

const sameQuery=normalizeLoopSearch({
  startSystem:'Home',
  scope:'same',
  legCount:3,
  radiusLy:500,
  cargoCapacity:100,
},control);
assert.equal(sameQuery.radiusLy,0);

const station=(marketId,stationName,systemName,distanceLy,x,market,stationControllingFaction='Regiment of Imperial Mongrels')=>({
  marketId,stationName,systemName,distanceLy,stationControllingFaction,
  systemX:x,systemY:0,systemZ:0,
  distanceToArrivalLs:500,
  maxLandingPadSize:3,
  carrier:false,
  observedAt:new Date().toISOString(),
  market,
});
const row=(commodity,{buy=0,sell=0,supply=0,demand=0}={})=>({
  commodity,buyPrice:buy,sellPrice:sell,supply,demand,category:'Metals',
});

const A=station('A','Alpha Port','Home',0,0,[
  row('Gold',{buy:100,supply:1000}),
  row('Silver',{sell:200,demand:1000}),
  row('Tritium',{sell:180,demand:1000}),
]);
const B=station('B','Beta Port','Away',20,20,[
  row('Gold',{sell:300,demand:1000}),
  row('Silver',{buy:50,supply:1000}),
  row('Palladium',{buy:60,supply:1000}),
]);
const C=station('C','Gamma Port','Third',30,30,[
  row('Palladium',{sell:260,demand:1000}),
  row('Tritium',{buy:40,supply:1000}),
]);
const A2=station('A2','Home Two','Home',0,0,[
  row('Gold',{sell:180,demand:1000}),
  row('Silver',{buy:70,supply:1000}),
]);
const A3=station('A3','Home Three','Home',0,0,[
  row('Silver',{sell:250,demand:1000}),
  row('Tritium',{buy:30,supply:1000}),
]);

const two=optimizeTradeLoops([A,B,C,A2],twoQuery);
assert.ok(two.length>=1);
assert.equal(two[0].legCount,2);
assert.equal(two[0].legs[0].sourceSystem,'Home');
assert.equal(two[0].legs[0].destinationSystem,'Away');
assert.equal(two[0].legs[0].commodity,'Gold');
assert.equal(two[0].legs[0].tripProfit,20000);
assert.equal(two[0].legs[1].commodity,'Silver');
assert.equal(two[0].legs[1].tripProfit,15000);
assert.equal(two[0].loopProfit,35000);
assert.equal(two[0].totalDistanceLy,40);

const exact=evaluateSpecificLoop([A,B,C,A2],two[0].legs,twoQuery);
assert.equal(exact.valid,true);
assert.equal(exact.loopProfit,35000);

const threeQuery=normalizeLoopSearch({
  startSystem:'Home',
  scope:'radius',
  legCount:3,
  radiusLy:50,
  cargoCapacity:100,
  minPad:3,
  carrierMode:'exclude',
  priority:'standard',
  limit:10,
},control);
const three=optimizeTradeLoops([A,B,C,A2],threeQuery);
assert.ok(three.length>=1);
assert.equal(three[0].legCount,3);
assert.deepEqual(three[0].legs.map(leg=>leg.commodity),['Gold','Palladium','Tritium']);
assert.equal(three[0].loopProfit,54000);
assert.equal(three[0].totalDistanceLy,60);

const same=optimizeTradeLoops([A,A2,A3],sameQuery);
assert.ok(same.length>=1,'same-system optimizer should find loops between distinct stations in the work system');
assert.equal(same[0].totalDistanceLy,0);

const outsider=station('X','Outsider Port','Home',0,0,[
  row('Gold',{sell:999,demand:1000}),
  row('Silver',{buy:1,supply:1000}),
],'Some Other Faction');
const mongrelQuery=normalizeLoopSearch({
  startSystem:'Home',scope:'same',legCount:2,cargoCapacity:100,minPad:3,mongrelOnly:true,
},control);
const mongrelOnlyResults=optimizeTradeLoops([A,A2,outsider],mongrelQuery);
assert.ok(mongrelOnlyResults.length>=1);
assert.ok(mongrelOnlyResults.every(route=>route.legs.every(leg=>
  leg.sourceFaction==='Regiment of Imperial Mongrels'&&leg.destinationFaction==='Regiment of Imperial Mongrels'
)),'Mongrel Faction Routes must exclude non-Mongrel-controlled stations');

const body=buildSpanshLoopSnapshotBody(twoQuery,new Date('2026-09-25T12:00:00Z'));
assert.equal(body.reference_system,'Home');
assert.equal(body.filters.distance.max,'50');
assert.ok(Array.isArray(body.filters.services));
assert.ok(Array.isArray(body.filters.type.value));
assert.equal(body.size,200);

const sameBody=buildSpanshLoopSnapshotBody(sameQuery,new Date('2026-09-25T12:00:00Z'));
assert.equal(sameBody.filters.system_name.value,'Home');
assert.equal(sameBody.filters.distance,undefined);

const html=readFileSync(new URL('../trading/index.html',import.meta.url),'utf8');
assert.match(html,/data-trade-loops/);
assert.match(html,/Trade Loop Finder/);
assert.match(html,/Same system only/);
assert.match(html,/3 legs · triangle/);
assert.match(html,/data-loop-threshold/);
assert.match(html,/data-loop-mongrel-only/);
assert.match(html,/Mongrel Faction Routes/);
assert.match(html,/trade-loops\.css\?v=2/);
assert.match(html,/trade-loops\.js\?v=2/);

const client=readFileSync(new URL('../js/trade-loops.js',import.meta.url),'utf8');
assert.match(client,/\/api\/trade-loops\/search/);
assert.match(client,/Post Managed Route/);
assert.match(client,/optimizer:/);
assert.match(client,/thresholdDropPercent/);
assert.match(client,/mongrelOnly/);
assert.match(client,/sourceFaction/);
assert.match(client,/destinationFaction/);
assert.match(client,/mongrels:trade-route-posted/);

const tradeApi=readFileSync(new URL('../functions/api/trades/index.js',import.meta.url),'utf8');
assert.match(tradeApi,/normalizeRouteLegs/);
assert.match(tradeApi,/normalizeRouteOptimizer/);

const evaluator=readFileSync(new URL('../lib/trade-route-evaluator.js',import.meta.url),'utf8');
assert.match(evaluator,/evaluateManagedTradeRoutes/);
assert.match(evaluator,/sendTradeThresholdAlert/);
assert.match(evaluator,/Better matching loop available/);

const internal=readFileSync(new URL('../functions/api/internal/trade-watch-evaluate.js',import.meta.url),'utf8');
assert.match(internal,/evaluateManagedTradeRoutes/);
assert.match(internal,/managedRoutes/);

console.log('Trade Loop Finder smoke checks passed.');
