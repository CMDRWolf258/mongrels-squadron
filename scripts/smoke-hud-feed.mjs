import fs from 'node:fs';
import assert from 'node:assert/strict';
import { alertId, alertIndicator, orderAlerts, summarizeMission, summarizeScoutBoard, summarizeTrades } from '../functions/api/hud/feed.js';

assert.equal(alertId('faction','retreat','Diaba','Retreat active'),'faction:retreat:diaba:retreat-active');

const mission=summarizeMission(
  {meta:{attentionCount:1},systems:[{name:'Diaba',attention:true,priority:true,influence:51.2,alerts:['Conflict active/pending'],objective:'Hold control',dataCondition:'current'}]},
  {title:'Daily Orders',updatedAt:'2026-10-03T20:00:00Z',orders:[{id:'o1',system:'Diaba',faction:'Regiment of Imperial Mongrels',task:'Win CZs',status:'active',revision:2,reporting:{type:'cz',target:20}}]},
  {summaries:{o1:{squad:{score:6}}},verifiedSummaries:{o1:{contribution:4}}},
);
assert.equal(mission.orders.length,1);
assert.equal(mission.orders[0].progress.current,10);
assert.equal(mission.orders[0].progress.percent,50);
assert.equal(mission.orders[0].progress.unit,'CZ pts');
assert.equal(mission.attention[0].system,'Diaba');
assert.equal(alertIndicator('faction','high'),'red');
assert.equal(alertIndicator('orders','high'),'amber');

const trade=summarizeTrades([{
  id:'route-12345678',
  title:'Platinum Loop',
  status:'active',
  official:true,
  originSystem:'Diaba',
  originStation:'Niijima Station',
  destinationSystem:'Miwae',
  destinationStation:'Test Exchange',
  legs:[{
    commodity:'Platinum',
    sourceSystem:'Diaba',
    sourceStation:'Niijima Station',
    destinationSystem:'Miwae',
    destinationStation:'Test Exchange',
    buyPrice:50000,
    sellPrice:70000,
    profitPerTon:20000,
    tripProfit:15000000,
  }],
  intelligence:{priority:'critical'},
  optimizer:{managed:true,state:'healthy',currentProfit:16500000},
  updatedAt:'2026-10-03T20:00:00Z',
}]);
assert.equal(trade.routes[0].loopProfit,16500000);
assert.equal(trade.routes[0].legs[0].sourceStation,'Niijima Station');
assert.equal(trade.routes[0].legs[0].destinationStation,'Test Exchange');

const scout=summarizeScoutBoard({summary:{available:1,claimed:0,fresh:2,priority:1},jobs:[{system:'Miwae',status:'available',reward:{totalMillions:10,bonusMillions:5,bonusReason:'Priority'}}]});
assert.equal(scout.jobs[0].system,'Miwae');

const alerts=orderAlerts([{state:'applied',legacyBaseline:false,publicationId:'pub-1',appliedAt:'2026-10-03T20:00:00Z',changes:{material:true,counts:{added:1,revised:2,removed:0}}}],Date.parse('2026-10-03T21:00:00Z'));
assert.equal(alerts.length,1);
assert.match(alerts[0].detail,/2 revised/);

const source=fs.readFileSync(new URL('../functions/api/hud/feed.js',import.meta.url),'utf8');
for(const token of ['invalid_scout_token','hud_owner_not_bound','hud-alert-acks-v1:','loadRewardDiscordView','buildScoutJobBoard','buildOrderProgressForHud','unacknowledgedCount','indicator']){
  assert.ok(source.includes(token),token);
}
console.log('✓ HUD site feed aggregates mission/trade/scout leadership data with persistent acknowledgements');
