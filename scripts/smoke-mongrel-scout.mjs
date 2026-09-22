import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const required=[
  'downloads/mongrel-scout/load.py',
  'downloads/mongrel-scout/README.md',
  'functions/api/operations/scout-tokens.js',
  'functions/api/operations/scout-ingest.js',
  'js/wolf-bgs-scout.js',
  'functions/downloads/mongrel-scout.zip.js',
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
  /Not assigned:/,
  /Scout rate limit reached/,
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
  /onRequestPatch/,
  /onRequestDelete/,
  /restricted_systems_required/,
  /normalizeAllowedSystems/,
  /scope/,
  /allowedSystems/,
  /DEFAULT_RATE_LIMIT_PER_HOUR = 120/,
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
  /systemAuthorized/,
  /system_not_authorized/,
  /scout_rate_limit_reached/,
  /RATE_KEY_PREFIX/,
  /DEFAULT_RATE_LIMIT_PER_HOUR = 120/,
  /Retry-After/,
  /expirationTtl:7200/,
])assert.match(ingest,pattern);

const ingestFactory=new Function(
  ingest.replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'')+
  '; return {systemAuthorized,normalizeAllowedSystems,normalizeScope,consumeRateLimit,DEFAULT_RATE_LIMIT_PER_HOUR};'
);
const ingestHelpers=ingestFactory();
assert.equal(ingestHelpers.systemAuthorized({scope:'trusted',allowedSystems:[]},'Anywhere'),true);
assert.equal(ingestHelpers.systemAuthorized({scope:'restricted',allowedSystems:['Baldur','Miwae']},'  baldur  '),true);
assert.equal(ingestHelpers.systemAuthorized({scope:'restricted',allowedSystems:['Baldur','Miwae']},'Diaba'),false);
assert.equal(ingestHelpers.DEFAULT_RATE_LIMIT_PER_HOUR,120);

const rateStore=new Map();
const rateEnv={DAILY_ORDERS:{
  async get(key){return rateStore.has(key)?JSON.parse(rateStore.get(key)):null;},
  async put(key,value){rateStore.set(key,value);},
}};
let lastRate;
for(let i=0;i<121;i++)lastRate=await ingestHelpers.consumeRateLimit(rateEnv,'test-token');
assert.equal(lastRate.allowed,false,'121st Scout request in one hour should be rate-limited');


const bgsApi=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
for(const pattern of [
  /SCOUT_SNAPSHOTS_KEY/,
  /readScoutSnapshots/,
  /normalizeScoutFactions/,
  /scoutConflictScore/,
  /scoutPresenceRow/,
  /activeSnapshotSource: activeSource/,
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

const mixedExternalBoard={
  name:'Scout Test',
  updatedAt:'2026-09-22T01:05:48.298000',
  factions:[
    {name:'Regiment of Imperial Mongrels',influence:44,state:'Boom',activeStates:['Boom'],pendingStates:[],recoveringStates:[],updatedAt:'2026-09-21T18:18:24.737000'},
    {name:'Opponent Faction',influence:56,state:'None',activeStates:[],pendingStates:[],recoveringStates:[],updatedAt:'2026-09-22T01:05:48.298000'},
  ],
  ok:true,
};
payload=bgs.buildPayload(
  {systems:[{name:'Scout Test',influence:44,control:'Regiment of Imperial Mongrels',state:'Boom',sourceUpdated:'2026-09-21T18:18:24.737000',present:true}],source:'test'},
  {systems:{'Scout Test':mixedExternalBoard},syncOk:true,successfulSystems:1,requestedSystems:1},
  control,
  {displayName:'Wolf',access:'site_admin'},
  {systems:{}}
);
assert.equal(payload.systems[0].externalBoardNewestAt,'2026-09-22T01:05:48.298Z');
assert.equal(payload.systems[0].externalBoardOldestAt,'2026-09-21T18:18:24.737Z');
assert.equal(payload.systems[0].activeSnapshotTime,'2026-09-21T18:18:24.737Z');
assert.equal(payload.systems[0].boardMixedAge,true);
assert.ok(payload.systems[0].boardAgeSpreadHours>6);
console.log('✓ Mixed-age external boards expose complete-board freshness instead of newest-row freshness');

const newerScout={
  ...scoutSnapshot,
  updatedAt:'2026-09-21T23:00:00Z',
  receivedAt:'2026-09-21T23:00:02Z',
  factions:[
    {name:'Regiment of Imperial Mongrels',influence:51,state:'Boom',activeStates:['Boom'],pendingStates:[],recoveringStates:[]},
    {name:'Opponent Faction',influence:49,state:'None',activeStates:[],pendingStates:[],recoveringStates:[]},
  ],
};
payload=bgs.buildPayload(
  {systems:[{name:'Scout Test',influence:44,control:'Regiment of Imperial Mongrels',state:'Boom',sourceUpdated:'2026-09-21T18:18:24.737000',present:true}],source:'test'},
  {systems:{'Scout Test':mixedExternalBoard},syncOk:true,successfulSystems:1,requestedSystems:1},
  control,
  {displayName:'Wolf',access:'site_admin'},
  {systems:{'Scout Test':newerScout}}
);
assert.equal(payload.systems[0].activeSnapshotSource,'scout','Scout must win while any required external faction row is older than the Scout board');
assert.equal(payload.systems[0].activeSnapshotTime,'2026-09-21T23:00:00.000Z');
assert.equal(payload.systems[0].influence,51);
console.log('✓ Coherent Scout board stays active until the whole external board is newer');

const allExternalNewer={
  ...mixedExternalBoard,
  updatedAt:'2026-09-22T01:05:48.298000',
  factions:mixedExternalBoard.factions.map((row,index)=>({
    ...row,
    updatedAt:index===0?'2026-09-22T00:30:00.000000':'2026-09-22T01:05:48.298000',
  })),
};
payload=bgs.buildPayload(
  {systems:[{name:'Scout Test',influence:44,control:'Regiment of Imperial Mongrels',state:'Boom',sourceUpdated:'2026-09-22T00:30:00.000000',present:true}],source:'test'},
  {systems:{'Scout Test':allExternalNewer},syncOk:true,successfulSystems:1,requestedSystems:1},
  control,
  {displayName:'Wolf',access:'site_admin'},
  {systems:{'Scout Test':newerScout}}
);
assert.equal(payload.systems[0].activeSnapshotSource,'external','External may replace Scout only after every faction row is newer');
assert.equal(payload.systems[0].activeSnapshotTime,'2026-09-22T00:30:00.000Z');
console.log('✓ External board takes over only when the complete board is newer than Scout');

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

const memberPage=readFileSync('member/index.html','utf8');
for(const pattern of [/Elite Connection & Scout/,/data-frontier-card-connect/,/Connect Elite Account/,/Scout & Setup/,/Read README/,/member-dashboard\.js\?v=87/])assert.match(memberPage,pattern);
const memberUi=readFileSync('js/member-dashboard.js','utf8');
for(const pattern of [/Live Scout \(EDMC\)/,/Live Scout installation & refresh instructions/,/Recent verified activity/,/data-frontier-activity-count/,/Read README/,/Plugins → Open/,/MongrelScout FOLDER/,/jump out and back in/,/data-frontier-card-connect/,/Frontier \+ EDMC/])assert.match(memberUi,pattern);
const operationsPage=readFileSync('operations/index.html','utf8');
assert.match(operationsPage,/Connect Elite & Scout/);
assert.match(operationsPage,/\.\.\/member\/#mongrel-scout/);
new Function(memberUi);

const page=readFileSync('wolf-bgs/index.html','utf8');
for(const pattern of [/Scout Network/,/data-scout-network/,/Restricted Scout/,/Trusted Scout/,/data-scout-create-systems/,/Download Mongrel Scout \(\.zip\)/,/\/api\/downloads\/mongrel-scout/,/wolf-bgs-scout\.js/])assert.match(page,pattern);

const client=readFileSync('js/wolf-bgs-scout.js','utf8');
for(const pattern of [/Generate Scout Token|Generating one-time scout token/,/COPY TOKEN|copied/i,/EDIT ACCESS/,/REVOKE/,/PATCH/,/restricted/,/trusted/,/allowedSystems/,/WolfBgsRefresh/,/setInterval\(\(\)=>load\(\),30000\)/])assert.match(client,pattern);
new Function(client);

const scoutCss=readFileSync('css/wolf-bgs.css','utf8');
for(const pattern of [
  /\.wolf-bgs-page \.wolf-scout-system-checks input\[type="checkbox"\]/,
  /overflow-x:hidden/,
  /text-transform:none/,
  /word-break:normal/,
])assert.match(scoutCss,pattern);

const baseClient=readFileSync('js/wolf-bgs.js','utf8');
for(const pattern of [/wolf-scout-source-chip/,/Active board/,/Refresh with Scout:/,/jump out and back in/,/activeSnapshotSource === 'scout'/,/window\.WolfBgsRefresh/,/window\.WolfBgsGetSystems/,/parsedTime/])assert.match(baseClient,pattern);
assert.doesNotMatch(baseClient,/External board newest/);
assert.doesNotMatch(baseClient,/External board oldest/);
assert.doesNotMatch(baseClient,/Mixed \/ Stale/);
new Function(baseClient);


const zipSource=readFileSync('functions/downloads/mongrel-scout.zip.js','utf8');
new Function(zipSource.replace(/\bexport\s+/g,''));
for(const pattern of [/MongrelScout\/load\.py/,/path:'README\.md'/,/application\/zip/,/Content-Disposition/,/crc32/,/buildStoredZip/])assert.match(zipSource,pattern);
assert.doesNotMatch(zipSource,/path:'MongrelScout\/README\.md'/);
const zipFactory=new Function(zipSource.replace(/\bexport\s+/g,'')+'; return {buildStoredZip};');
const zipBytes=zipFactory().buildStoredZip([{name:'MongrelScout/load.py',data:new TextEncoder().encode('print("ok")')}]);
assert.equal(zipBytes[0],0x50);
assert.equal(zipBytes[1],0x4b);
assert.match(Buffer.from(zipBytes).toString('latin1'),/MongrelScout\/load\.py/);

const apiZipSource=readFileSync('functions/api/downloads/mongrel-scout.js','utf8');
assert.match(apiZipSource,/path:'README\.md'/);
assert.doesNotMatch(apiZipSource,/path:'MongrelScout\/README\.md'/);
const scoutReadme=readFileSync('downloads/mongrel-scout/README.md','utf8');
for(const pattern of [/Plugins → Open/,/actual plugin folder/,/MongrelScout FOLDER/,/whole folder, not the individual files/,/top-level \*\*README\.md\*\*/])assert.match(scoutReadme,pattern);
assert.doesNotMatch(scoutReadme,/included `load\.py`/);

for(const path of ['functions/api/operations/scout-tokens.js','functions/api/operations/scout-ingest.js','functions/api/operations/wolf-bgs.js']){
  const source=readFileSync(path,'utf8').replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'');
  new Function(source);
}

console.log('✓ Mongrel Scout direct EDMC uplink, privacy boundary, token security, and BGS integration are wired');
