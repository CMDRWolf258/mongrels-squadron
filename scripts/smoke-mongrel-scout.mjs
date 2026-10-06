import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolveSystemWorkCycle } from '../lib/daily-order-cycle.js';
import { validatedConflictRows } from '../lib/bgs-conflict-validation.js';
import { applyFacilityObservationPayload, applyHostEstimates, applyHostOverrides, estimateHostBody } from '../lib/orrery-facility-observations.js';
import { normalizeScoutFacilityObservation, recordScoutFacilityObservation, readScoutFacilityObservationPayload } from '../lib/scout-facility-observations.js';
import { normalizeScoutFacilityVisit, deriveStationHostCandidate, diagnoseStationHostCandidate, recordScoutFacilityVisit, readScoutFacilityVisits } from '../lib/scout-facility-visits.js';
import { normalizeFacilityHostOverride, recordFacilityHostOverride, readFacilityHostOverridePayload } from '../lib/orrery-facility-host-overrides.js';
import { normalizeScoutActivityBatch, systemAuthorized as activitySystemAuthorized } from '../lib/scout-activity.js';
import { mergeEventsWithResult } from '../lib/frontier.js';

const required=[
  'downloads/mongrel-scout/load.py',
  'downloads/mongrel-scout/README.md',
  'functions/api/operations/scout-tokens.js',
  'functions/api/operations/scout-ingest.js',
  'functions/api/operations/scout-activity.js',
  'lib/scout-activity.js',
  'functions/api/hud/auth.js',
  'functions/api/orrery/facility-observations.js',
  'lib/orrery-facility-observations.js',
  'lib/scout-facility-observations.js',
  'lib/scout-facility-visits.js',
  'lib/orrery-facility-host-overrides.js',
  'functions/api/orrery/host-override.js',
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
  /def dashboard_entry/,
  /destinationBodyId/,
  /lastDestination/,
  /facility_visit/,
  /_build_station_visit_payload/,
  /Station context recorded:/,
  /Host verified:/,
  /FSDJump/,
  /Location/,
  /CarrierJump/,
  /Market/,
  /ApproachSettlement/,
  /ShipTargeted/,
  /Subsystem_Localised/,
  /SubsystemHealth/,
  /HullDamage/,
  /combat\.target/,
  /_update_hud_status/,
  /planetRadius/,
  /_build_market_payload/,
  /_build_facility_payload/,
  /Market updated:/,
  /Facility mapped:/,
  /HUD_BRIDGE_HOST = "127\.0\.0\.1"/,
  /HUD_BRIDGE_PORT = 43857/,
  /DockingRequested/,
  /DockingGranted/,
  /DockingDenied/,
  /DockingCancelled/,
  /DockingTimeout/,
  /Docked/,
  /Undocked/,
  /CarrierStats/,
  /CarrierJumpRequest/,
  /CarrierJumpCancelled/,
  /carrier\.jump_request/,
  /carrier\.jump_cancelled/,
  /SupercruiseEntry/,
  /SupercruiseExit/,
  /docking\.granted/,
  /carrier\.stats/,
  /ThreadingHTTPServer/,
  /\/v1\/health/,
  /\/v1\/state/,
  /\/v1\/events/,
  /\/v1\/site-feed\/ack/,
  /\/v1\/mining\/report/,
  /\/v1\/mining\/center/,
  /\/v1\/mining\/data/,
  /\/v1\/mining\/centers/,
  /HUD_SITE_FEED_REFRESH_SECONDS = 30\.0/,
  /HUD_SITE_FEED_SAFETY_REFRESH_SECONDS = 600\.0/,
  /def _hud_site_manifest_endpoint/,
  /def _refresh_hud_site_manifest_once/,
  /def _hud_manifest_signature/,
  /invalid_hud_manifest/,
  /Compatibility fallback/,
  /HUD_MINING_REPORT_ENDPOINT/,
  /HUD_MINING_CENTER_ENDPOINT/,
  /HUD_MINING_DATA_ENDPOINT/,
  /HUD_MINING_DATA_ENDPOINT = "https:\/\/ten16-archive\.pages\.dev\/api\/mining"/,
  /HUD_MINING_CENTERS_ENDPOINT/,
  /FSD_OPTIMAL_MASS/,
  /GUARDIAN_FSD_BOOST/,
  /def _extract_jump_model/,
  /def _update_current_jump_range_locked/,
  /def _refresh_hud_site_feed_once/,
  /def _submit_hud_mining_request/,
  /def _fetch_hud_mining_resource/,
  /def plugin_stop/,
  /def _publish_hud_event/,
  /def _update_hud_system_context/,
  /def _restore_last_system_context/,
  /def _normalize_hud_event/,
  /MongrelScoutOwnerCarrier/,
  /MongrelScoutLastSystem/,
  /monitor\.is_live_galaxy/,
  /timeout_session\.new_session/,
  /threading\.Thread/,
  /event_generate/,
  /Regiment of Imperial Mongrels/,
  /Authorization/,
  /Bearer/,
  /MongrelScoutToken/,
  /PLUGIN_VERSION = "1\.12\.0"/,
  /HUD_BRIDGE_VERSION = 9/,
  /MongrelScoutCargoMissionCache/,
  /def _update_cargo_missions_from_journal/,
  /def _recover_cargo_missions_from_recent_journals/,
  /MissionAccepted/,
  /Journal\*\.log/,
  /def _build_local_cargo_state/,
  /CargoJSON/,
  /missionNeeds/,
  /MongrelScoutCargoPriorityFaction/,
  /\/v1\/cargo-priority/,
  /def _apply_cargo_priority/,
  /"faction": str\(entry\.get\("Faction"\)/,
  /stolenItems/,
  /limpets/,
  /StarPos/,
  /Not assigned:/,
  /Scout rate limit reached/,
  /BGS upload/,
  /detail_text/,
  /DEFAULT_ACTIVITY_ENDPOINT/,
  /ACTIVITY_BATCH_DELAY_SECONDS = 8\.0/,
  /MongrelScoutActivityMissionOrigins/,
  /def _remember_activity_mission_origin/,
  /def _build_realtime_activity_payload/,
  /def _queue_realtime_activity/,
  /def _send_activity_batch/,
  /MissionCompleted/,
  /ColonisationContribution/,
  /ColonisationConstructionDepot/,
  /activity_batch/,
])assert.match(plugin,pattern);
assert.doesNotMatch(plugin,/"cmdr"\s*:/i,'Scout payload must not transmit commander name');
assert.match(plugin,/Commander name[\s\S]{0,260}cargo inventory, credit balance/i);
assert.match(plugin,/history are not transmitted/i);
assert.match(plugin,/commodity prices, supply and demand/i,'Scout privacy copy should disclose market fields');
assert.match(plugin,/facility market ID, host body ID\/name, latitude and longitude/i,'Scout privacy copy should disclose facility placement fields');
assert.match(plugin,/local-only bridge state/i,'Scout privacy copy should distinguish local HUD identity from cloud uploads');
assert.match(plugin,/curated 10-16 mining archive/i,'Scout privacy copy should disclose explicit HUD mining submissions');
assert.match(plugin,/near-real-time Mission Control and Colonization progress/i,'Scout privacy copy should disclose realtime activity uploads');
assert.match(plugin,/MissionCompleted faction\/influence effects/i);
assert.match(plugin,/event-driven rather than continuously polled/i);
assert.match(plugin,/Intentionally no Access-Control-Allow-Origin header/,'Local bridge must not opt arbitrary web pages into CORS');
assert.doesNotMatch(plugin,/send_header\("Access-Control-Allow-Origin"/,'Local HUD bridge must not emit a permissive CORS header');
assert.match(plugin,/_publish_hud_event\(cmdr, system, station, entry\)[\s\S]*token = \(config\.get_str\(KEY_TOKEN\)/,'Local HUD events must publish before cloud token checks');
assert.doesNotMatch(plugin,/"cmdr"\s*:/i,'Market payload must not transmit commander name');

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

const hudAuth=readFileSync('functions/api/hud/auth.js','utf8');
for(const pattern of [/wolf-bgs-scout-tokens-v1/,/Authorization/,/Bearer/,/sha256Hex/,/constantTimeEqual/,/site_admin/])assert.match(hudAuth,pattern);
assert.doesNotMatch(hudAuth,/token\s*:/i,'HUD auth response must not expose the raw Scout token');

const activityEndpoint=readFileSync('functions/api/operations/scout-activity.js','utf8');
for(const pattern of [/mergeEventsWithResult/,/normalizeScoutActivityBatch/,/lastScoutActivityAt/,/scout_owner_not_bound/,/scout_rate_limit_reached/])assert.match(activityEndpoint,pattern);

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
  /handleMarketSnapshot/,
  /recordScoutMarketSnapshot/,
  /handleFacilityObservation/,
  /handleFacilityVisitObservation/,
  /handleFacilityHostObservation/,
  /recordScoutFacilityObservation/,
  /recordScoutFacilityVisit/,
  /deriveStationHostCandidate/,
  /ApproachSettlement/,
  /facility_visit/,
  /StationHost/,
  /trade_storage_not_configured/,
  /systemAuthorized/,
  /system_not_authorized/,
  /scout_rate_limit_reached/,
  /RATE_KEY_PREFIX/,
  /DEFAULT_RATE_LIMIT_PER_HOUR = 120/,
  /Retry-After/,
  /expirationTtl:7200/,
  /starPos:normalizeCoordinates/,
  /lastCoords:snapshot\.starPos/,
])assert.match(ingest,pattern);

const ingestFactory=new Function(
  ingest.replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'')+
  '; return {systemAuthorized,normalizeAllowedSystems,normalizeScope,normalizeCoordinates,consumeRateLimit,isFacilityPayload,isFacilityVisitPayload,isFacilityHostPayload,DEFAULT_RATE_LIMIT_PER_HOUR};'
);
const ingestHelpers=ingestFactory();
assert.equal(ingestHelpers.systemAuthorized({scope:'trusted',allowedSystems:[]},'Anywhere'),true);
assert.equal(ingestHelpers.systemAuthorized({scope:'restricted',allowedSystems:['Baldur','Miwae']},'  baldur  '),true);
assert.equal(ingestHelpers.systemAuthorized({scope:'restricted',allowedSystems:['Baldur','Miwae']},'Diaba'),false);
assert.equal(ingestHelpers.DEFAULT_RATE_LIMIT_PER_HOUR,120);
assert.equal(ingestHelpers.isFacilityPayload({event:'ApproachSettlement'}),true);
assert.equal(ingestHelpers.isFacilityPayload({kind:'facility'}),true);
assert.equal(ingestHelpers.isFacilityVisitPayload({kind:'facility_visit'}),true);
assert.equal(ingestHelpers.isFacilityHostPayload({event:'StationHost'}),true);
assert.equal(ingestHelpers.isFacilityHostPayload({kind:'facility_host'}),true);

const activityNow=Date.parse('2026-10-06T18:00:00Z');
assert.equal(activitySystemAuthorized({scope:'restricted',allowedSystems:['NGC 2546 Sector UZ-G d10-16']},'ngc 2546 sector uz-g d10-16'),true);
const realtime=normalizeScoutActivityBatch({
  kind:'activity_batch',
  events:[
    {
      event:'MissionCompleted',
      timestamp:'2026-10-06T17:55:00Z',
      system:'NGC 2546 Sector UZ-G d10-16',
      systemAddress:'560820275507',
      station:'Eon Blue Apocalypse',
      missionId:8123,
      faction:'Wolf 258 Dynasty',
      missionOrigin:{
        missionId:'8123',
        acceptedAt:'2026-10-06T17:20:00Z',
        originSystem:'NGC 2546 Sector OQ-H b38-0',
        originSystemAddress:'111111111111',
        originStation:'Test Port',
        sourceFaction:'Wolf 258 Dynasty',
        destinationSystem:'NGC 2546 Sector UZ-G d10-16',
      },
      factionEffects:[
        {Faction:'Wolf 258 Dynasty',Reputation:'++',Influence:[{SystemAddress:'111111111111',Influence:'+++++'}]},
        {Faction:'The Consortium',Reputation:'+',Influence:[{SystemAddress:'560820275507',Influence:'++++'}]},
      ],
    },
    {
      event:'RedeemVoucher',timestamp:'2026-10-06T17:56:00Z',
      system:'NGC 2546 Sector UZ-G d10-16',systemAddress:'560820275507',
      station:'Eon Blue Apocalypse',stationType:'Orbis',stationFaction:'Regiment of Imperial Mongrels',
      voucherType:'bounty',amount:12000000,
      factions:[{Faction:'Regiment of Imperial Mongrels',Amount:12000000}],
    },
    {
      event:'ColonisationContribution',timestamp:'2026-10-06T17:57:00Z',
      system:'NGC 2546 Sector UZ-G d10-16',systemAddress:'560820275507',
      station:'Construction Site',marketId:'1234567890',
      contributions:[{Name:'$Steel_Name;',Name_Localised:'Steel',Amount:384}],
    },
    {
      event:'ColonisationConstructionDepot',timestamp:'2026-10-06T17:57:05Z',
      system:'NGC 2546 Sector UZ-G d10-16',systemAddress:'560820275507',
      station:'Construction Site',marketId:'1234567890',constructionProgress:0.72,
      resourcesRequired:[{Name:'$Steel_Name;',Name_Localised:'Steel',RequiredAmount:2000,ProvidedAmount:1400,Payment:1000}],
    },
  ],
},{scope:'trusted',allowedSystems:[]},{now:activityNow});
assert.equal(realtime.events.length,4);
const realtimeMission=realtime.events.find(row=>row.type==='mission_inf');
assert.equal(realtimeMission.provisional,true);
assert.deepEqual(realtimeMission.effects.map(row=>[row.faction,row.system,row.infUnits]),[
  ['Wolf 258 Dynasty','NGC 2546 Sector OQ-H b38-0',5],
  ['The Consortium','NGC 2546 Sector UZ-G d10-16',4],
]);
assert.equal(realtime.events.find(row=>row.type==='bounties_redeemed').amount,12000000);
assert.equal(realtime.events.find(row=>row.type==='colonization_contribution').totalTons,384);
assert.equal(realtime.events.find(row=>row.type==='colonization_depot').resources[0].providedAmount,1400);
const carrierVoucher=normalizeScoutActivityBatch({
  kind:'activity_batch',
  events:[{event:'RedeemVoucher',timestamp:'2026-10-06T17:58:00Z',system:'Diaba',systemAddress:'42',station:'Carrier',stationType:'FleetCarrier',voucherType:'bounty',amount:5000000}],
},{scope:'trusted',allowedSystems:[]},{now:activityNow});
assert.equal(carrierVoucher.events.length,0);
assert.equal(carrierVoucher.excluded.length,1,'Fleet Carrier voucher redemption must remain excluded like Frontier sync');

// Realtime Scout and later Frontier reconciliation share the same event identity.
const eventStore=new Map();
let eventPutCount=0;
const mergeEnv={DAILY_ORDERS:{
  async get(key,{type}={}){const raw=eventStore.get(key);return raw===undefined?null:(type==='json'?JSON.parse(raw):raw);},
  async put(key,value){eventPutCount+=1;eventStore.set(key,String(value));},
}};
const provisionalBounty=realtime.events.find(row=>row.type==='bounties_redeemed');
const firstMerge=await mergeEventsWithResult(mergeEnv,'wolf-user',[provisionalBounty],[],{lastScoutActivityAt:provisionalBounty.timestamp});
assert.equal(firstMerge.eventChanged,true);
assert.equal(firstMerge.added,1);
const putsAfterFirst=eventPutCount;
const duplicateMerge=await mergeEventsWithResult(mergeEnv,'wolf-user',[provisionalBounty],[],{lastScoutActivityAt:provisionalBounty.timestamp});
assert.equal(duplicateMerge.changed,false,'Identical Scout activity must not rewrite KV or touch the HUD signal');
assert.equal(eventPutCount,putsAfterFirst,'Duplicate Scout activity must produce zero additional KV writes');
const frontierConfirmed={...provisionalBounty};
delete frontierConfirmed.provisional;
delete frontierConfirmed.ingestSource;
const reconciliation=await mergeEventsWithResult(mergeEnv,'wolf-user',[frontierConfirmed]);
assert.equal(reconciliation.eventChanged,true);
assert.equal(reconciliation.updated,1,'Frontier confirmation should replace the provisional record, not add a duplicate');
assert.equal(reconciliation.events.length,1);
assert.equal(reconciliation.events[0].provisional,undefined);

const rewardRuntime=readFileSync('lib/reward-engine-runtime.js','utf8');
assert.match(rewardRuntime,/filter\(event=>event\?\.provisional!==true\)/,'Provisional realtime activity must never issue payouts before Frontier confirmation');

assert.deepEqual(ingestHelpers.normalizeCoordinates([-12.5,4,99.25]),{x:-12.5,y:4,z:99.25});
assert.deepEqual(ingestHelpers.normalizeCoordinates({x:1,y:2,z:3}),{x:1,y:2,z:3});
assert.equal(ingestHelpers.normalizeCoordinates(['bad',2,3]),null);

const rateStore=new Map();
const rateEnv={DAILY_ORDERS:{
  async get(key){return rateStore.has(key)?JSON.parse(rateStore.get(key)):null;},
  async put(key,value){rateStore.set(key,value);},
}};
let lastRate;
for(let i=0;i<121;i++)lastRate=await ingestHelpers.consumeRateLimit(rateEnv,'test-token');
assert.equal(lastRate.allowed,false,'121st Scout request in one hour should be rate-limited');

const rawStationVisit={
  kind:'facility_visit',
  event:'DockingRequested',
  timestamp:'2026-10-03T01:15:00Z',
  system:'NGC 2546 Sector UZ-G d10-16',
  systemAddress:'668059324240760',
  stationName:'Rivers Hub',
  stationType:'Outpost',
  marketId:'4391607555',
  currentBody:{name:'NGC 2546 Sector UZ-G d10-16 9 a',bodyId:61,bodyType:'Planet'},
  journalBody:{name:'',bodyId:null,bodyType:''},
  dashboard:{
    timestamp:'2026-10-03T01:14:59Z',
    bodyName:'NGC 2546 Sector UZ-G d10-16 9 a',
    destination:{name:'Rivers Hub',bodyId:61,systemAddress:'668059324240760'},
    lastDestination:{name:'Rivers Hub',bodyId:61,systemAddress:'668059324240760',observedAt:'2026-10-03T01:14:59Z'},
  },
  context:{
    ApproachBody:{timestamp:'2026-10-03T01:14:20Z',system:'NGC 2546 Sector UZ-G d10-16',systemAddress:'668059324240760',bodyName:'NGC 2546 Sector UZ-G d10-16 9 a',bodyId:61,bodyType:'Planet'},
    SupercruiseExit:{timestamp:'2026-10-03T01:14:58Z',system:'NGC 2546 Sector UZ-G d10-16',systemAddress:'668059324240760',bodyName:'Rivers Hub',bodyId:90,bodyType:'Station'},
  },
};
const normalizedVisit=normalizeScoutFacilityVisit(rawStationVisit);
assert.equal(normalizedVisit.marketId,'4391607555');
assert.equal(normalizedVisit.destination.bodyId,61);
assert.equal(normalizedVisit.currentBody.bodyId,61);
assert.deepEqual(deriveStationHostCandidate(normalizedVisit),{
  bodyJournalId:61,
  bodyName:'NGC 2546 Sector UZ-G d10-16 9 a',
  evidence:['destination_body','edmc_current_body','dashboard_body_name'],
},'Three agreeing independent signals may resolve a station host');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  currentBody:{name:'NGC 2546 Sector UZ-G d10-16 9 b',bodyId:62,bodyType:'Planet'},
  dashboard:{...rawStationVisit.dashboard,bodyName:'NGC 2546 Sector UZ-G d10-16 9 b'},
})),null,'A closer/wrong nearby moon must not be promoted when it disagrees with Destination.Body');
assert.equal(diagnoseStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  currentBody:{name:'Rivers Hub',bodyId:90,bodyType:'Station'},
  dashboard:{...rawStationVisit.dashboard,bodyName:'Rivers Hub'},
})).reason,'current_body_is_station');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  dashboard:{...rawStationVisit.dashboard,bodyName:'NGC 2546 Sector UZ-G d10-16 9 b'},
})),null,'Dashboard/body disagreement must block stale EDMC body state');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  dashboard:{...rawStationVisit.dashboard,destination:{name:'Another Station',bodyId:61,systemAddress:'668059324240760'}},
})),null,'Changing targets before docking must block automatic host resolution');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  dashboard:{...rawStationVisit.dashboard,destination:{name:'Rivers Hub',bodyId:null,systemAddress:'668059324240760'}},
})),null,'Missing Destination.Body must remain unresolved');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  currentBody:{name:'Rivers Hub',bodyId:90,bodyType:'Station'},
  dashboard:{...rawStationVisit.dashboard,bodyName:'Rivers Hub',destination:{name:'Rivers Hub',bodyId:90,systemAddress:'668059324240760'}},
})),null,'A station reported as the current Body must never become its own host');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  dashboard:{...rawStationVisit.dashboard,destination:{name:'Rivers Hub',bodyId:61,systemAddress:'999'}},
})),null,'Destination system mismatch must block host resolution');

assert.ok(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  currentBody:{name:'NGC 2546 Sector UZ-G d10-16 A',bodyId:0,bodyType:'Star'},
  dashboard:{...rawStationVisit.dashboard,bodyName:'NGC 2546 Sector UZ-G d10-16 A',destination:{name:'Rivers Hub',bodyId:0,systemAddress:'668059324240760'}},
})),'A fixed station orbiting a star remains resolvable');

assert.equal(deriveStationHostCandidate(normalizeScoutFacilityVisit({
  ...rawStationVisit,
  stationType:'MegaShip',
})),null,'Mobile megaships must never receive an automatic host');

const visitStore=new Map();
const visitEnv={DAILY_ORDERS:{
  async get(key){return visitStore.has(key)?JSON.parse(visitStore.get(key)):null;},
  async put(key,value){visitStore.set(key,value);},
}};
const visitWrite=await recordScoutFacilityVisit(visitEnv,rawStationVisit);
assert.equal(visitWrite.stored,true);
const duplicateVisitWrite=await recordScoutFacilityVisit(visitEnv,rawStationVisit);
assert.equal(duplicateVisitWrite.stored,false);
const savedVisits=await readScoutFacilityVisits(visitEnv,'668059324240760');
assert.equal(savedVisits.visits.length,1);
assert.equal(savedVisits.visits[0].context.SupercruiseExit.bodyType,'Station');
assert.doesNotMatch(JSON.stringify(savedVisits),/commander|cargo|credits|materials|missions/i,'Raw host evidence must remain sanitized');


const orrerySystem=JSON.parse(readFileSync('data/orrery/ngc-2546-uz-g-d10-16.json','utf8'));
const targetFacility=orrerySystem.locations.find(item=>String(item.marketId)==='4374918915');
assert.ok(targetFacility,'Expected 10-16 settlement fixture must exist');
assert.equal(targetFacility.latitude,null);
const targetBody=orrerySystem.bodies.find(item=>item.id===targetFacility.bodyId);
assert.ok(targetBody&&Number.isInteger(targetBody.bodyId));
const observedAt=new Date(Date.now()-60000).toISOString();
const rawFacilityObservation={
  event:'ApproachSettlement',
  system:orrerySystem.name,
  systemAddress:String(orrerySystem.id64),
  facilityName:targetFacility.name,
  marketId:String(targetFacility.marketId),
  bodyId:targetBody.bodyId,
  bodyName:targetBody.name,
  latitude:21.123456,
  longitude:-44.654321,
  timestamp:observedAt,
};
const normalizedFacility=normalizeScoutFacilityObservation(rawFacilityObservation);
assert.equal(normalizedFacility.systemId64,String(orrerySystem.id64),'64-bit system address stays exact decimal text');
assert.equal(normalizedFacility.marketId,String(targetFacility.marketId));
assert.equal(normalizedFacility.bodyJournalId,targetBody.bodyId);
assert.equal(normalizedFacility.source,'Mongrel Scout / EDMC');

const facilityStore=new Map();
const facilityEnv={DAILY_ORDERS:{
  async get(key){return facilityStore.has(key)?JSON.parse(facilityStore.get(key)):null;},
  async put(key,value){facilityStore.set(key,value);},
}};
const firstFacilityWrite=await recordScoutFacilityObservation(facilityEnv,rawFacilityObservation);
assert.equal(firstFacilityWrite.stored,true);
const olderFacilityWrite=await recordScoutFacilityObservation(facilityEnv,{...rawFacilityObservation,timestamp:new Date(Date.parse(observedAt)-60000).toISOString(),latitude:1});
assert.equal(olderFacilityWrite.stored,false,'Older facility coordinates cannot replace a newer Scout observation');
const facilityEnvelope=await readScoutFacilityObservationPayload(facilityEnv,String(orrerySystem.id64));
assert.equal(facilityEnvelope.observations.length,1);
assert.equal(facilityEnvelope.observations[0].latitude,21.123456);
assert.doesNotMatch(JSON.stringify(facilityEnvelope),/scoutToken|ownerId|commander/i,'Public facility feed must not expose Scout identity');

const facilityOverlay=applyFacilityObservationPayload(orrerySystem,facilityEnvelope);
assert.equal(facilityOverlay.applied,1);
const upgraded=facilityOverlay.system.locations.find(item=>item.id===targetFacility.id);
assert.equal(upgraded.bodyId,targetFacility.bodyId);
assert.equal(upgraded.latitude,21.123456);
assert.equal(upgraded.longitude,-44.654321);
assert.equal(upgraded.coordinatesKnown,true);
assert.equal(upgraded.positionObservation.event,'ApproachSettlement');
assert.equal(upgraded.source.reference,targetFacility.source.reference,'Scout placement must preserve imported facility provenance');

const unplacedStation=orrerySystem.locations.find(item=>item.name==='Rivers Hub');
assert.ok(unplacedStation&&unplacedStation.bodyId===null,'Rivers Hub fixture should start unplaced');
const hostOnlyRaw={
  event:'StationHost',
  kind:'facility_host',
  system:orrerySystem.name,
  systemAddress:String(orrerySystem.id64),
  facilityName:unplacedStation.name,
  marketId:String(unplacedStation.marketId),
  bodyName:targetBody.name,
  timestamp:observedAt,
};
const normalizedHostOnly=normalizeScoutFacilityObservation(hostOnlyRaw);
assert.equal(normalizedHostOnly.hostOnly,true);
assert.equal(normalizedHostOnly.bodyJournalId,null);
assert.equal(normalizedHostOnly.bodyName,targetBody.name);
const hostOnlyEnvelope={
  schemaVersion:1,
  systemId64:String(orrerySystem.id64),
  observations:[{
    event:'StationHost',
    hostOnly:true,
    marketId:String(unplacedStation.marketId),
    facilityName:unplacedStation.name,
    bodyJournalId:null,
    bodyName:targetBody.name,
    latitude:null,
    longitude:null,
    observedAt,
    source:'Mongrel Scout / EDMC',
  }],
};
const hostOverlay=applyFacilityObservationPayload(orrerySystem,hostOnlyEnvelope);
assert.equal(hostOverlay.applied,1,'Host-only Scout observation should place an unassociated orbital station');
const hostUpgraded=hostOverlay.system.locations.find(item=>item.id===unplacedStation.id);
assert.equal(hostUpgraded.bodyId,targetBody.id);
assert.equal(hostUpgraded.latitude,null);
assert.equal(hostUpgraded.longitude,null);
assert.equal(hostUpgraded.coordinatesKnown,false);
assert.equal(hostUpgraded.positionKnown,true);
assert.equal(hostUpgraded.positionObservation.event,'StationHost');

const riversStation=orrerySystem.locations.find(item=>item.name==='Rivers Hub');
assert.ok(riversStation&&riversStation.bodyId===null);
const riversEstimate=estimateHostBody(orrerySystem,riversStation);
assert.equal(riversEstimate?.body?.bodyId,92,'Rivers Hub should strongly estimate body 12 h');
assert.ok(riversEstimate.confidenceScore>=0.78);
const estimatedRivers=applyHostEstimates(orrerySystem,[{
  marketId:String(riversStation.marketId),
  stationName:riversStation.name,
  observedAt:'2026-10-03T02:31:24Z',
}]);
assert.equal(estimatedRivers.applied,1);
const riversPlaced=estimatedRivers.system.locations.find(item=>item.id===riversStation.id);
assert.equal(riversPlaced.bodyId,'body-92');
assert.equal(riversPlaced.positionObservation.status,'estimated');
assert.equal(riversPlaced.positionObservation.event,'StationHostEstimate');

const ambiguousStation=orrerySystem.locations.find(item=>item.name==='Arkwright Vista');
assert.ok(ambiguousStation&&ambiguousStation.bodyId===null);
assert.equal(estimateHostBody(orrerySystem,ambiguousStation),null,'Tied nearby moons must remain unresolved');

const overrideRaw={
  systemId64:String(orrerySystem.id64),
  marketId:String(riversStation.marketId),
  facilityName:riversStation.name,
  bodyJournalId:87,
  bodyName:orrerySystem.bodies.find(item=>item.bodyId===87).name,
};
const normalizedOverride=normalizeFacilityHostOverride(overrideRaw,{updatedAt:'2026-10-03T03:00:00Z',updatedBy:'Officer'});
assert.equal(normalizedOverride.bodyJournalId,87);
const corrected=applyHostOverrides(estimatedRivers.system,[{
  marketId:String(riversStation.marketId),
  facilityName:riversStation.name,
  bodyJournalId:87,
  bodyName:normalizedOverride.bodyName,
  updatedAt:'2026-10-03T03:00:00Z',
}]);
assert.equal(corrected.applied,1);
const correctedRivers=corrected.system.locations.find(item=>item.id===riversStation.id);
assert.equal(correctedRivers.bodyId,'body-87');
assert.equal(correctedRivers.positionObservation.status,'verified');
assert.equal(correctedRivers.positionObservation.event,'StationHostOverride');

const overrideStore=new Map();
const overrideEnv={DAILY_ORDERS:{
  async get(key){return overrideStore.has(key)?JSON.parse(overrideStore.get(key)):null;},
  async put(key,value){overrideStore.set(key,value);},
}};
const overrideWrite=await recordFacilityHostOverride(overrideEnv,overrideRaw,{updatedAt:'2026-10-03T03:00:00Z',updatedBy:'Officer'});
assert.equal(overrideWrite.stored,true);
const overridePayload=await readFacilityHostOverridePayload(overrideEnv,String(orrerySystem.id64));
assert.equal(overridePayload.overrides.length,1);
assert.equal(overridePayload.overrides[0].verified,true);


const wrongBody=orrerySystem.bodies.find(item=>item.kind!=='barycentre'&&item.id!==targetFacility.bodyId);
const conflictEnvelope={...facilityEnvelope,observations:[{...facilityEnvelope.observations[0],bodyJournalId:wrongBody.bodyId,bodyName:wrongBody.name}]};
const conflicted=applyFacilityObservationPayload(orrerySystem,conflictEnvelope);
assert.equal(conflicted.applied,0,'A Scout body mismatch must not move an imported facility');
assert.equal(conflicted.system.locations.find(item=>item.id===targetFacility.id).latitude,null);
assert.throws(()=>applyFacilityObservationPayload(orrerySystem,{...facilityEnvelope,systemId64:'999'}),/system\/schema mismatch/);

const publicFacilityApi=readFileSync('functions/api/orrery/facility-observations.js','utf8');
for(const pattern of [/systemId64/,/readScoutFacilityObservationPayload/,/readScoutFacilityVisits/,/readFacilityHostOverridePayload/,/stationVisits/,/hostOverrides/,/headers\(5\)/,/public, max-age=\$\{maxAge\}/])assert.match(publicFacilityApi,pattern);
const hostOverrideApi=readFileSync('functions/api/orrery/host-override.js','utf8');
for(const pattern of [/readSession/,/officer/,/site_admin/,/orrery-host-editor/,/recordFacilityHostOverride/])assert.match(hostOverrideApi,pattern);
const orreryApp=readFileSync('js/orrery/app.js','utf8');
for(const pattern of [/Host confidence/,/Estimated/,/Verified/,/buildHostEditor/,/api\/orrery\/host-override/,/Confirm host/])assert.match(orreryApp,pattern);
console.log('✓ Scout station visits retain raw evidence, reject edge-case guesses, and only promote verified hosts');


const bgsApi=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
for(const pattern of [
  /SCOUT_SNAPSHOTS_KEY/,
  /readScoutSnapshots/,
  /normalizeScoutFactions/,
  /scoutConflictScore/,
  /scoutPresenceRow/,
  /activeSnapshotSource: activeSource/,
  /scoutActiveCount/,
  /directSnapshotSourceLabel/,
  /Frontier CAPI/,
])assert.match(bgsApi,pattern);

const bgsFactory=new Function(
  'resolveSystemWorkCycle',
  'validatedConflictRows',
  bgsApi.replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'')+
  '; return {buildPayload,DEFAULTS,SYSTEM_DEFAULTS};'
);
const bgs=bgsFactory(resolveSystemWorkCycle,validatedConflictRows);
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

const frontierSource=readFileSync('lib/frontier.js','utf8');
assert.match(frontierSource,/boardSnapshots:newestBoardSnapshots/,'Frontier journal parser must return faction-board snapshots');
assert.match(frontierSource,/journalBoardSnapshot/,'Frontier journal parser must recognize Location/FSDJump/CarrierJump faction boards');
const frontierSyncSource=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(frontierSyncSource,/mergeFrontierBoardSnapshots/,'Frontier sync must merge direct faction boards into BGS snapshots');
assert.match(frontierSyncSource,/Frontier CAPI Journal/,'Frontier direct BGS snapshots must retain source identity');

const memberPage=readFileSync('member/index.html','utf8');
for(const pattern of [/Elite Connection & Scout/,/data-frontier-card-connect/,/Connect Elite Account/,/Scout & Setup/,/Read README/,/View Rewards Owed/,/rewards\/#outstanding-rewards/,/member-dashboard\.js\?v=\d+/])assert.match(memberPage,pattern);
const memberUi=readFileSync('js/member-dashboard.js','utf8');
for(const pattern of [/Live Scout \(EDMC\)/,/Live Scout installation & refresh instructions/,/Recent verified activity/,/data-frontier-activity-count/,/Read README/,/Plugins → Open/,/MongrelScout FOLDER/,/jump out and back in/,/Market updated:/,/Trader's Outpost/,/data-frontier-card-connect/,/Frontier \+ EDMC/])assert.match(memberUi,pattern);
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
for(const pattern of [/wolf-scout-source-chip/,/Active board/,/Refresh with Scout:/,/Frontier CAPI/,/jump out and back in/,/activeSnapshotSource === 'scout'/,/window\.WolfBgsRefresh/,/window\.WolfBgsGetSystems/,/parsedTime/])assert.match(baseClient,pattern);
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
for(const pattern of [/Plugins → Open/,/actual plugin folder/,/MongrelScout FOLDER/,/whole folder, not the individual files/,/top-level \*\*README\.md\*\*/,/galactic X\/Y\/Z coordinates/,/straight-line distance/,/market data/i,/actual station or port/i,/Market updated: <station>/,/ApproachSettlement/,/Facility mapped: <facility>/,/latitude and longitude/i,/Local HUD \/ voice bridge/,/127\.0\.0\.1:43857/,/docking\.granted/,/CarrierStats/,/relationship: owner/,/not uploaded/i])assert.match(scoutReadme,pattern);
assert.doesNotMatch(scoutReadme,/included `load\.py`/);

for(const path of ['functions/api/operations/scout-tokens.js','functions/api/operations/scout-ingest.js','functions/api/operations/wolf-bgs.js']){
  const source=readFileSync(path,'utf8').replace(/^import[^\n]+\n/gm,'').replace(/\bexport\s+/g,'');
  new Function(source);
}

console.log('✓ Mongrel Scout cloud uplink, local HUD event contract, privacy boundary, token security, and BGS integration are wired');
