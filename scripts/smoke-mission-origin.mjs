import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJournal } from '../lib/frontier.js';
import { matchVerifiedActivity } from '../lib/order-activity.js';

const origin='NGC 2546 Sector OQ-H b38-0';
const destination='NGC 2546 Sector UZ-G d10-16';
const dynasty='Wolf 258 Dynasty';
const consortium='The Consortium';

const acceptedJournal=[
  {timestamp:'2026-09-21T20:00:00Z',event:'Location',StarSystem:origin,SystemAddress:111,Docked:true,StationName:'Origin Port'},
  {timestamp:'2026-09-21T20:01:00Z',event:'MissionAccepted',MissionID:9001,Faction:dynasty,DestinationSystem:destination,DestinationStation:'Eon Blue Apocalypse',Influence:'High'},
].map(row=>JSON.stringify(row)).join('\n');

const accepted=parseJournal(acceptedJournal,[origin,destination]);
assert.equal(accepted.missionOrigins['9001'].originSystem,origin);
assert.equal(accepted.missionOrigins['9001'].originSystemAddress,111);
assert.equal(accepted.missionOrigins['9001'].sourceFaction,dynasty);
console.log('✓ MissionAccepted captures origin from current journal location');

const completedJournal=[
  {timestamp:'2026-09-21T21:00:00Z',event:'FSDJump',StarSystem:destination,SystemAddress:222},
  {
    timestamp:'2026-09-21T21:11:07Z',
    event:'MissionCompleted',
    MissionID:9001,
    Faction:dynasty,
    DestinationSystem:destination,
    DestinationStation:'Eon Blue Apocalypse',
    FactionEffects:[
      {Faction:consortium,Influence:[{SystemAddress:222,Trend:'UpGood',Influence:'+'}],Reputation:''},
      {Faction:dynasty,Influence:[{SystemAddress:111,Trend:'UpGood',Influence:'+++++'}],Reputation:'++++'},
    ],
  },
].map(row=>JSON.stringify(row)).join('\n');

const completed=parseJournal(completedJournal,[origin,destination],{
  knownMissionOrigins:accepted.missionOrigins,
  knownSystemAddresses:accepted.systemAddresses,
});
assert.equal(completed.events.length,1);
const mission=completed.events[0];
assert.equal(mission.originSystem,origin);
assert.equal(mission.sourceFaction,dynasty);
assert.deepEqual(
  mission.effects.map(effect=>[effect.faction,effect.system,effect.infUnits,effect.role]).sort(),
  [
    [consortium,destination,1,'secondary'],
    [dynasty,origin,5,'source'],
  ].sort()
);
console.log('✓ Mission completion preserves source + secondary influence as separate faction/system effects');

const cycle={cycleId:'cycle',cycleStartedAt:'2026-09-21T00:00:00Z',cycleEndsAt:'2026-09-22T23:59:59Z',acceptFromAt:'2026-09-21T00:00:00Z'};
const current={
  cycleId:'publication',
  cycleStartedAt:'2026-09-21T00:00:00Z',
  orders:[
    {id:'dynasty-order',logicalKey:'dynasty',system:origin,faction:dynasty,status:'active',task:'Support Dynasty',reporting:{type:'inf',target:25},workCycle:cycle},
    {id:'consortium-order',logicalKey:'consortium',system:destination,faction:consortium,status:'active',task:'Support Consortium',reporting:{type:'inf',target:25},workCycle:cycle},
  ],
};
const matched=matchVerifiedActivity(completed.events,current);
const totals=Object.fromEntries(matched.orderTotals.map(row=>[row.orderId,row.contribution]));
assert.equal(totals['dynasty-order'],5);
assert.equal(totals['consortium-order'],1);
assert.equal(matched.events[0].orderMatches.length,2);
console.log('✓ One passenger mission can correctly advance both source and destination Daily Orders without combining their INF');

const member=readFileSync('js/member-dashboard.js','utf8');
assert.match(member,/BGS INF Effects/);
assert.match(member,/Origin: /);
assert.match(member,/parts\.join\(' · '\)/);
assert.doesNotMatch(member,/const inf=effects\.reduce/);

const sync=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(sync,/knownMissionOrigins/);
assert.match(sync,/missionOrigins:pruneMissionOrigins/);
assert.match(sync,/missionOrigins:\{\.\.\.\(a\?\.missionOrigins/);

console.log('\nAll mission-origin attribution smoke checks passed.');
