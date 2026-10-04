import fs from 'node:fs';
import assert from 'node:assert/strict';
import { alertId, alertIndicator, factionAlerts, orderAlerts, summarizeMission, summarizeScoutBoard, summarizeTrades } from '../functions/api/hud/feed.js';

assert.equal(alertId('faction','retreat','Diaba','Retreat active'),'faction:retreat:diaba:retreat-active');

const mission=summarizeMission(
  {meta:{attentionCount:1},systems:[{name:'Diaba',attention:true,priority:true,influence:51.2,alerts:['Conflict active/pending'],objective:'Hold control',dataCondition:'current'}]},
  {title:'Daily Orders',updatedAt:'2026-10-03T20:00:00Z',orders:[{id:'o1',system:'Diaba',faction:'Regiment of Imperial Mongrels',task:'Win CZs',status:'active',revision:2,reporting:{type:'cz',target:20}}]},
  {summaries:{o1:{squad:{score:6}}},verifiedSummaries:{o1:{contribution:4}}},
);
assert.equal(mission.orders.length,1);
assert.deepEqual(mission.systems,['Diaba']);
assert.equal(mission.orders[0].progress.current,10);
assert.equal(mission.orders[0].progress.percent,50);
assert.equal(mission.orders[0].progress.unit,'CZ pts');
assert.equal(mission.attention[0].system,'Diaba');
assert.equal(alertIndicator('faction','high'),'red');
assert.equal(alertIndicator('orders','high'),'amber');

const mirroredFactionAlerts=factionAlerts({alerts:[
  {system:'Col 285 Sector CF-W b16-2',family:'conflict',detail:'War',phase:'active',firstSeenAt:'2026-09-29T20:47:00Z',reviewedAt:null},
  {system:'Chingpho',family:'civil-unrest',detail:'Civil Unrest',phase:'active',firstSeenAt:'2026-09-18T20:28:00Z',reviewedAt:'2026-10-04T04:00:00Z'},
]});
assert.equal(mirroredFactionAlerts.length,2);
assert.equal(mirroredFactionAlerts[0].title,'CONFLICT CHANGE · Col 285 Sector CF-W b16-2');
assert.equal(mirroredFactionAlerts[0].acknowledged,false);
assert.equal(mirroredFactionAlerts[1].title,'CIVIL UNREST · Chingpho');
assert.equal(mirroredFactionAlerts[1].acknowledged,true);
assert.equal(mirroredFactionAlerts[1].acknowledgedAt,'2026-10-04T04:00:00Z');

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

const scout=summarizeScoutBoard({
  summary:{available:1,claimed:0,fresh:2,priority:1,coordinates:1},
  viewer:{lastScoutLocation:{system:'Diaba',coords:{x:10,y:20,z:30},observedAt:'2026-10-03T20:00:00Z',coordinateSource:'Live Scout'}},
  jobs:[{system:'Miwae',status:'available',coords:{x:11,y:20,z:30},coordinateSource:'EDSM',reward:{totalMillions:10,bonusMillions:5,bonusReason:'Priority'}}],
});
assert.equal(scout.jobs[0].system,'Miwae');
assert.deepEqual(scout.jobs[0].coords,[11,20,30]);
assert.equal(scout.origin.system,'Diaba');

const alerts=orderAlerts([{
  state:'applied',
  legacyBaseline:false,
  publicationId:'pub-1',
  appliedAt:'2026-10-03T20:00:00Z',
  changes:{
    material:true,
    counts:{added:1,revised:1,removed:1},
    rows:[
      {status:'added',before:null,after:{id:'o2',system:'Diaba',faction:'Regiment of Imperial Mongrels',task:'Claim bounties',priority:'high',reporting:{type:'bounties',target:20}}},
      {status:'revised',before:{id:'o1',system:'Diaba',faction:'Regiment of Imperial Mongrels',task:'Trade 10M',priority:'high',reporting:{type:'trade',target:10}},after:{id:'o1',system:'Diaba',faction:'Regiment of Imperial Mongrels',task:'Trade 20M',priority:'high',reporting:{type:'trade',target:20}}},
      {status:'removed',before:{id:'o3',system:'Miwae',faction:'Regiment of Imperial Mongrels',task:'Run missions',priority:'normal'},after:null},
    ],
  },
}],{now:Date.parse('2026-10-03T21:00:00Z')});
assert.equal(alerts.length,3);
assert.equal(alerts[0].title,'[ADDED] Claim bounties');
assert.match(alerts[1].detail,/Was: Trade 10M/);
assert.equal(alerts[2].title,'[REMOVED] Run missions');
const pendingSinceBgsAck=orderAlerts([
  {
    state:'applied',legacyBaseline:false,publicationId:'newest',appliedAt:'2026-10-03T20:30:00Z',
    changes:{material:true,rows:[{status:'added',after:{id:'n1',system:'Diaba',task:'Newest task'}}]},
  },
  {
    state:'applied',legacyBaseline:false,publicationId:'older',appliedAt:'2026-10-03T20:00:00Z',
    changes:{material:true,rows:[{status:'added',after:{id:'o1',system:'Miwae',task:'Older task'}}]},
  },
],{now:Date.parse('2026-10-03T21:00:00Z'),reviews:{Miwae:{reviewedAt:'2026-10-03T20:15:00Z',signature:'older-review'}}});
assert.equal(pendingSinceBgsAck.length,1);
assert.equal(pendingSinceBgsAck[0].title,'[ADDED] Newest task');

const retainedUntilBgsAck=orderAlerts([
  {
    state:'applied',legacyBaseline:false,publicationId:'newest',appliedAt:'2026-10-03T20:30:00Z',
    changes:{material:true,rows:[{status:'added',after:{id:'n1',system:'Diaba',task:'Newest task'}}]},
  },
  {
    state:'applied',legacyBaseline:false,publicationId:'older',appliedAt:'2026-10-03T20:00:00Z',
    changes:{material:true,rows:[{status:'added',after:{id:'o1',system:'Miwae',task:'Older task'}}]},
  },
],{now:Date.parse('2026-10-03T21:00:00Z')});
assert.equal(retainedUntilBgsAck.length,2,'HUD order references stay until the BGS Control master amber is acknowledged');

const rc=value=>String(value??'').trim().replace(/\s+/g,' ');
const rn=value=>value===''||value===null||value===undefined?null:(Number.isFinite(Number(value))?Number(value):null);
const rf=order=>JSON.stringify({
  system:rc(order?.system),faction:rc(order?.faction),kind:rc(order?.kind),source:rc(order?.source),
  priority:rc(order?.priority),task:rc(order?.task),detail:rc(order?.detail),status:rc(order?.status),
  reporting:order?.reporting&&typeof order.reporting==='object'?{type:rc(order.reporting.type),target:rn(order.reporting.target),blitz:Boolean(order.reporting.blitz)}:null,
});
const rh=value=>{let hash=2166136261;for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);};
const beforeReviewed=[{id:'old',system:'Diaba',faction:'The Consortium',kind:'mission-inf',source:'automation',priority:'high',task:'Complete about 15 INF for The Consortium',detail:'',status:'active',reporting:{type:'inf',target:15,blitz:false}}];
const afterReviewed=[{id:'new',system:'Diaba',faction:'The Consortium',kind:'mission-inf',source:'automation',priority:'high',task:'Complete about 25 INF for The Consortium',detail:'',status:'active',reporting:{type:'inf',target:25,blitz:false}}];
const reviewedSignature=rh(JSON.stringify({
  cycleId:'cycle-1',
  system:'Diaba',
  before:beforeReviewed.map(rf).sort(),
  after:afterReviewed.map(rf).sort(),
}));
const reviewedBeforePublish=orderAlerts([{
  state:'applied',legacyBaseline:false,publicationId:'reviewed-publish',cycleId:'cycle-1',appliedAt:'2026-10-03T20:30:00Z',
  before:{orders:beforeReviewed},after:{orders:afterReviewed},
  changes:{material:true,rows:[{status:'revised',before:beforeReviewed[0],after:afterReviewed[0]}]},
}],{now:Date.parse('2026-10-03T21:00:00Z'),reviews:{Diaba:{reviewedAt:'2026-10-03T20:25:00Z',signature:reviewedSignature}}});
assert.equal(reviewedBeforePublish.length,0,'BGS Control ACK before publish clears the matching publication from HUD');

const source=fs.readFileSync(new URL('../functions/api/hud/feed.js',import.meta.url),'utf8');
for(const token of ['invalid_scout_token','hud_owner_not_bound','hud-alert-acks-v1:','wolf-bgs-order-change-reviews-v1','wolf-bgs-control-v1','loadRewardDiscordView','buildScoutJobBoard','buildOrderProgressForHud','unacknowledgedCount','indicator','severityRank','alertTimestamp',"BGS Control's amber acknowledgement is authoritative",'readOrderReviewState','readBgsFactionAlertState','publicationReviewSignature','orderChangeReviewed']){
  assert.ok(source.includes(token),token);
}
console.log('✓ HUD site feed aggregates mission/trade/scout leadership data with persistent acknowledgements');
