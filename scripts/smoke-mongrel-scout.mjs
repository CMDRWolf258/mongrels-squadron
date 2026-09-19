import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const required=[
  'downloads/mongrel-scout/load.py',
  'downloads/mongrel-scout/README.md',
  'functions/api/operations/scout-tokens.js',
  'functions/api/operations/scout-ingest.js',
  'js/wolf-bgs-scout.js',
];
for(const path of required)assert.ok(existsSync(path),`${path} missing`);

const plugin=readFileSync('downloads/mongrel-scout/load.py','utf8');
for(const pattern of [
  /def plugin_start3/,
  /def plugin_prefs/,
  /def prefs_changed/,
  /def journal_entry/,
  /FSDJump/,
  /Location/,
  /CarrierJump/,
  /monitor\.is_live_galaxy/,
  /timeout_session\.new_session/,
  /threading\.Thread/,
  /event_generate/,
  /Regiment of Imperial Mongrels/,
  /Authorization/,
  /Bearer/,
  /MongrelScoutToken/,
])assert.match(plugin,pattern);
assert.doesNotMatch(plugin,/"cmdr"\s*:/i,'Scout payload must not transmit commander name');
assert.match(plugin,/Commander name, cargo, credits/i);
assert.match(plugin,/general travel history are not transmitted/i);

const tokenApi=readFileSync('functions/api/operations/scout-tokens.js','utf8');
for(const pattern of [
  /site_admin_required/,
  /crypto\.randomUUID/,
  /crypto\.getRandomValues/,
  /sha256Hex/,
  /mscout_/,
  /lastSeenAt/,
  /lastSystem/,
  /onRequestDelete/,
])assert.match(tokenApi,pattern);
assert.doesNotMatch(tokenApi,/state\.tokens\[id\]\s*=\s*\{[^}]*token,/s,'Raw Scout token must not be persisted');

const ingest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
for(const pattern of [
  /Authorization/,
  /Bearer/,
  /sha256Hex/,
  /constantTimeEqual/,
  /mongrels_not_present/,
  /wolf-bgs-scout-snapshots-v1/,
  /factionWonDays|wonDays/,
  /FSDJump/,
  /Location/,
  /CarrierJump/,
])assert.match(ingest,pattern);

const bgsApi=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
for(const pattern of [
  /SCOUT_SNAPSHOTS_KEY/,
  /readScoutSnapshots/,
  /normalizeScoutFactions/,
  /scoutConflictScore/,
  /scoutPresenceRow/,
  /activeSnapshotSource: manualIsNewer \? 'manual' : \(scoutIsNewer \? 'scout'/,
  /scoutActiveCount/,
])assert.match(bgsApi,pattern);

const bgsFactory=new Function(
  bgsApi.replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'')+
  '; return {buildPayload,DEFAULTS,SYSTEM_DEFAULTS};'
);
const bgs=bgsFactory();
const control={
  defaults:{...bgs.DEFAULTS},
  systemDefaults:{...bgs.SYSTEM_DEFAULTS},
  systemSettings:{},
  manualSnapshots:{},
  alertEpisodes:{},
  conflictDayOverrides:{},
  globalUpdatedAt:null,
  globalUpdatedBy:null,
  systemDefaultsUpdatedAt:null,
  systemDefaultsUpdatedBy:null,
};
const scoutSnapshot={
  system:'Scout Test',
  updatedAt:'2026-09-19T12:00:00Z',
  receivedAt:'2026-09-19T12:00:02Z',
  scoutLabel:'CMDR Test',
  systemFaction:{name:'Regiment of Imperial Mongrels',state:'War'},
  security:'High',
  population:12345,
  factions:[
    {name:'Regiment of Imperial Mongrels',influence:42,state:'War',activeStates:['War'],pendingStates:[],recoveringStates:[]},
    {name:'Opponent Faction',influence:41,state:'War',activeStates:['War'],pendingStates:[],recoveringStates:[]},
  ],
  conflicts:[{
    type:'War',status:'Active',
    faction1:{name:'Opponent Faction',stake:'',wonDays:0},
    faction2:{name:'Regiment of Imperial Mongrels',stake:'',wonDays:1},
  }],
};
let payload=bgs.buildPayload(
  {systems:[],source:'test'},
  {systems:{},syncOk:true,successfulSystems:0,requestedSystems:0},
  control,
  {displayName:'Wolf',access:'site_admin'},
  {systems:{'Scout Test':scoutSnapshot}}
);
assert.equal(payload.systems.length,1,'Scout-only Mongrel system should surface immediately');
assert.equal(payload.systems[0].activeSnapshotSource,'scout');
assert.equal(payload.systems[0].influence,42);
assert.equal(payload.systems[0].conflictScore.factionWonDays,1,'Mongrel score must be normalized to the left side');
assert.equal(payload.systems[0].conflictScore.opponentWonDays,0);
assert.equal(payload.systems[0].conflictScore.opponentFaction,'Opponent Faction');

const manualControl={
  ...control,
  manualSnapshots:{
    'Scout Test':{
      updatedAt:'2026-09-19T12:05:00Z',
      updatedBy:'Wolf',
      controller:'Regiment of Imperial Mongrels',
      factions:[
        {name:'Regiment of Imperial Mongrels',influence:55,state:'War',pending:'',recovering:''},
        {name:'Opponent Faction',influence:40,state:'War',pending:'',recovering:''},
      ],
    },
  },
};
payload=bgs.buildPayload(
  {systems:[],source:'test'},
  {systems:{},syncOk:true,successfulSystems:0,requestedSystems:0},
  manualControl,
  {displayName:'Wolf',access:'site_admin'},
  {systems:{'Scout Test':scoutSnapshot}}
);
assert.equal(payload.systems[0].activeSnapshotSource,'manual','Newer Wolf manual snapshot must remain authoritative');
assert.equal(payload.systems[0].influence,55);

payload=bgs.buildPayload(
  {systems:[{
    name:'Scout Test',present:false,formerPresence:true,
    sourceUpdated:'2026-09-20T12:00:00Z',lastSeen:'2026-09-20T12:00:00Z',
  }],source:'test'},
  {systems:{},syncOk:true,successfulSystems:0,requestedSystems:0},
  control,
  {displayName:'Wolf',access:'site_admin'},
  {systems:{'Scout Test':scoutSnapshot}}
);
assert.equal(payload.systems.length,0,'Newer external former-presence data must retire an older Scout snapshot');

const page=readFileSync('wolf-bgs/index.html','utf8');
for(const pattern of [/Scout Network/,/data-scout-network/,/Download EDMC Plugin/,/wolf-bgs-scout\.js/])assert.match(page,pattern);

const client=readFileSync('js/wolf-bgs-scout.js','utf8');
for(const pattern of [/Generate Scout Token|Generating one-time scout token/,/COPY TOKEN|copied/i,/REVOKE/,/WolfBgsRefresh/,/setInterval\(load,30000\)/])assert.match(client,pattern);
new Function(client);

const baseClient=readFileSync('js/wolf-bgs.js','utf8');
for(const pattern of [/wolf-scout-source-chip/,/activeSnapshotSource === 'scout'/,/window\.WolfBgsRefresh/])assert.match(baseClient,pattern);
new Function(baseClient);

for(const path of ['functions/api/operations/scout-tokens.js','functions/api/operations/scout-ingest.js','functions/api/operations/wolf-bgs.js']){
  const source=readFileSync(path,'utf8').replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'');
  new Function(source);
}

console.log('✓ Mongrel Scout direct EDMC uplink, privacy boundary, token security, and BGS integration are wired');
