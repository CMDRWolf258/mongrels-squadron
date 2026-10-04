import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validatedConflictObservation, validatedConflictRows } from '../lib/bgs-conflict-validation.js';

const critical = [
  'wolf-bgs/index.html', 'css/wolf-bgs.css', 'css/wolf-bgs-rules.css', 'css/wolf-bgs-sliders.css', 'css/wolf-bgs-order-preview.css', 'css/wolf-bgs-conflicts.css', 'css/wolf-bgs-conflict-lab-v2.css', 'css/wolf-bgs-publish.css', 'css/wolf-bgs-reports.css', 'css/wolf-bgs-lab.css',
  'js/wolf-bgs-inheritance.js', 'js/wolf-bgs.js', 'js/wolf-bgs-rules.js', 'js/wolf-bgs-sliders.js', 'js/wolf-bgs-order-preview.js', 'js/wolf-bgs-conflicts.js', 'js/wolf-bgs-contribution-options.js', 'js/wolf-bgs-conflict-lab-v2.js', 'js/wolf-bgs-publish.js', 'js/wolf-bgs-reports.js', 'js/wolf-bgs-lab.js',
  'functions/api/operations/wolf-bgs.js', 'functions/api/operations/wolf-bgs-write.js', 'functions/api/operations/wolf-bgs-rules.js', 'functions/api/operations/wolf-bgs-sliders.js', 'functions/api/operations/wolf-bgs-economy-rules.js', 'functions/api/operations/wolf-bgs-conflicts.js', 'lib/bgs-conflict-validation.js',
  'scripts/enrich_bgs_boards.py', 'data/live-bgs-boards.json',
];
for (const path of critical) assert.ok(existsSync(path), `Wolf BGS Control critical file is missing: ${path}`);

const page = readFileSync('wolf-bgs/index.html','utf8');
for (const pattern of [/Wolf BGS Control/,/data-global-form/,/data-system-list/,/data-system-defaults-form/,/data-page-size/,/data-favorites-first/,/data-lowest-five-watch/,/wolf-time-input/,/data-faction-alert-list/,/data-alert-ack-button/,/data-queue-selector-summary/,/data-active-board-view/]) assert.match(page,pattern);
assert.match(page,/<option value="20" selected>20<\/option>/,'Results-per-page default should be 20');
assert.match(page,/<option value="influence-desc" selected>Influence high → low<\/option>/,'Influence high-to-low should be default');
assert.match(page,/wolf-bgs-order-preview\.css/,'Order Preview stylesheet is not loaded');
assert.match(page,/wolf-bgs-order-preview\.js\?v=6/,'Order Preview cache version should be v6');
assert.match(page,/wolf-bgs-conflicts\.js\?v=12/,'Conflict client cache version should be v12');
assert.match(page,/wolf-bgs-conflict-lab-v2\.js\?v=5/,'Conflict prototype cache version should be v5');
assert.match(page,/wolf-bgs-conflict-lab-v2\.css\?v=4/,'Conflict prototype stylesheet cache version should be v4');
assert.match(page,/BGS Lab — Mandalore/,'Mandalore BGS Lab is missing');
assert.match(page,/data-bgs-lab="true"/,'Mandalore must be marked as an isolated lab card');
assert.match(page,/NO DAILY ORDERS/,'Lab must explicitly state that it cannot publish Daily Orders');
assert.match(page,/data-lab-scenario="dual"/,'Dual-conflict lab scenario is missing');
assert.match(page,/data-lab-scenario="ambiguous"/,'Ambiguous four-way conflict lab scenario anchor is missing');
assert.match(page,/wolf-bgs-conflicts\.js/,'Conflict client is not loaded');
assert.match(page,/wolf-bgs-lab\.js/,'Lab client is not loaded');
assert.match(page,/wolf-bgs-conflict-lab-v2\.js/,'Conflict v2 lab client is not loaded');
assert.match(page,/wolf-bgs-conflict-lab-v2\.css/,'Conflict v2 lab stylesheet is not loaded');
assert.match(page,/wolf-bgs-publish\.css/,'Daily Orders publisher stylesheet is not loaded');
assert.match(page,/wolf-bgs-publish\.js/,'Daily Orders publisher client is not loaded');
assert.match(page,/wolf-bgs-reports\.css/,'Report manager stylesheet is not loaded');
assert.match(page,/wolf-bgs-reports\.js/,'Report manager client is not loaded');
assert.ok(page.indexOf('wolf-bgs-rules.js') < page.indexOf('wolf-bgs-sliders.js'),'Slider client must load after rules');
assert.ok(page.indexOf('wolf-bgs-sliders.js') < page.indexOf('wolf-bgs-order-preview.js'),'Order Preview must load after slider controls');
assert.ok(page.indexOf('wolf-bgs-order-preview.js') < page.indexOf('wolf-bgs-conflicts.js'),'Conflict layer must post-process the deterministic Order Preview');
assert.ok(page.indexOf('wolf-bgs-conflicts.js') < page.indexOf('wolf-bgs-lab.js'),'Lab interception must load after conflict controls');

const baseClient=readFileSync('js/wolf-bgs.js','utf8');
for (const pattern of [/submit-status/,/save-system/,/save-global/,/save-system-defaults/,/toggle-favorite/,/toggle-queue-selector/,/queueSelected/,/populateAlerts/,/ack-alerts/,/remove-alert/,/data-remove-faction-alert/,/setBoardView/,/matchesBoardView/,/freshnessStatus/,/parsedTime/,/Active board/,/Refresh with Scout:/,/Conflict Score/,/conflictScoreText/,/conflictDayText/,/data-conflict-score-a/,/data-conflict-score-updated/,/data-conflict-day-source/,/Programmed Automation/,/Advanced Intelligence Suggestion/,/data-faction-row/]) assert.match(baseClient,pattern);

const inheritanceClient=readFileSync('js/wolf-bgs-inheritance.js','utf8');
assert.match(inheritanceClient,/wolf-bgs-write/);
assert.match(inheritanceClient,/method !== 'PUT'/);

const rulesClient=readFileSync('js/wolf-bgs-rules.js','utf8');
for (const pattern of [
  /Automation Rules Library/,/Exact independent per-CMDR caps are not treated as confirmed/i,/soloDoNotMultiply/,/preferredOperators/,
  /Flexible \/ available/,/Avoid interaction/,/Maintain \/ hold/,/Support \/ raise/,/Suppress \/ lower/,/Protect from Retreat/,
  /Bounty balance baseline|Influence balancing baseline/,/bountyBaselineMillions/,/bountyCounterInf/,/tradeCounterInf/,/triggerHeadroomPct/,
  /Reset Filters/,/Reset to Defaults/,/sortFactionRows/,/wolf-influence-micro/,/wolf-influence-meter/,/Preview only:/,
]) assert.match(rulesClient,pattern);
assert.match(rulesClient,/WolfBgsFactionIntent/,'Conflict automation must be able to read saved faction intent');
assert.match(rulesClient,/WolfBgsRefresh/,'Faction strategy changes must refresh strategy-aware alerts');
assert.doesNotMatch(rulesClient,/<option value="no-action"/,'Legacy No Action intent should not remain in the UI');

const slidersClient=readFileSync('js/wolf-bgs-sliders.js','utf8');
for (const pattern of [
  /Economy & Security Objectives/,/Balance, don't block/,/economyObjective/,/securityObjective/,/Locked \/ not actionable/,
  /balance-required/,/counter-support calculated in Order Preview/,/bountyMillionsPerCmdr/,/tradeProfitMillionsPerCmdr/,
  /Avoid interaction/,/no automatic negative-Economy recipe/i,/no automatic negative-Security recipe/i,
]) assert.match(slidersClient,pattern);
assert.doesNotMatch(slidersClient,/positive Security work is blocked by the current influence guardrail/,'Near-ceiling Security should balance, not hard-block');

const orderClient=readFileSync('js/wolf-bgs-order-preview.js','utf8');
for (const pattern of [
  /Order Preview \/ Generator/,/REVIEW/,/Generate \/ Refresh Preview/,/explicitly queued and published/,
  /System balancing calibration/,/bountyPercentAdjustment/,/bountyFlatInfAdjustment/,/tradePercentAdjustment/,/tradeFlatInfAdjustment/,
  /balanceMath/,/candidateList/,/allocateCounterweight/,/maxCounterweightFactions/,/triggerHeadroomPct/,
  /Flexible \/ available/,/Avoid interaction/,/Maintain \/ hold/,/Allow Retreat/,
  /active .*conflict|active \$\{row\.state\}/,/Avoid control and close to controller crossover/,
  /Math\.max\(task\.amount,amount\)/,/Mission INF means mission reward influence pips\/ticks/,
  /wolf-bgs-economy-rules/,/explorationRoutineMillionsPerCmdr/,/explorationStrongMillionsPerCmdr/,/explorationEmergencyMillionsPerCmdr/,
  /Routine 2M · strong 5M · emergency ceiling 10M/,/kind:'exploration'/,/ECONOMY \/ EXPLORATION/,
  /Prefer economic missions where practical/,/Prefer security\/combat-aligned missions where practical/,
  /automated negative-work actions are disabled/,/Suppress \/ lower .*positive redistribution/,
  /Manual asset check: sell at a station\/asset owned by/,/asset ownership is not yet verified by automation/,
  /Overlapping same-faction counterweight needs keep the higher INF workload/,/Retreat is pending for the Mongrels/,/emergency auto-queueing/,/data-order-kind/,/data-order-faction/,/data-order-amount/,
]) assert.match(orderClient,pattern);
assert.doesNotMatch(orderClient,/exobiology.*task/i,'Exobiology must not be generated as a BGS task');

const conflictClient=readFileSync('js/wolf-bgs-conflicts.js','utf8');
assert.match(conflictClient,/conflictPendingDay/,'Conflict day selector should preserve an unsaved selection during card refreshes');
for(const pattern of [/CZ_TARGETS = \{ routine:3, contested:6, heavy:15, blitz:25 \}/,/ELECTION_TARGETS = \{ routine:6, contested:15, heavy:40, blitz:60 \}/,/workloadForPair/,/syncPressure/,/observe-conflict-scores/,/BLITZ — win for faction A/,/HEAVY LOCK/,/pairTimelineState/,/conflictPairTimelines/,/Conflict days are tracked separately for each pair/,/factionA,factionB,day/]) assert.match(conflictClient,pattern);
assert.match(baseClient,/data-conflict-scores=/,'All conflict-pair scores must be exposed to adaptive pressure automation');
assert.match(baseClient,/data-conflict-pair-timelines=/,'Pair-specific conflict timelines must be exposed to the conflict UI');
const conflictApi=readFileSync('functions/api/operations/wolf-bgs-conflicts.js','utf8');
for(const pattern of [/pressureStates/,/observe-conflict-scores/,/advancePressure/,/Opponent reached 3 wins while observed/,/Two observed conflict days without an opponent win/,/blitz:Boolean/]) assert.match(conflictApi,pattern);

for(const pattern of [
  /wolf-bgs-conflicts/,/Conflict Configuration/,/Low = \$\{CZ_POINTS\.low\}/,/conflictType/,/civil-war/,/election/,/war/,
  /INFLUENCE_PAIR_TOLERANCE = 3/,/findInfluenceMatchings/,/multiple influence-compatible pairings fit/,
  /manual confirmation overrides the ±\$\{INFLUENCE_PAIR_TOLERANCE\}/,/Unpaired active participants/,
  /ordinary influence\/counterweight work/,/Adaptive conflict doctrine/,/Election: Routine 6/,
  /wolf-conflict-preview-task/,/Conflict lock active/,/Conflict score/,/CONFLICT TIMELINES/,/WolfBgsConflictLabOrder/,/labConflictTaskMarkup/,/Earn \$\{esc\(amount\)\} CZ points/,/data-order-amount="\$\{esc\(amount\)\}"/,/saveConflictDay/,/clearConflictDay/,/DAY 7\+/,/4-day minimum/,/data\.conflictScoreA|dataset\.conflictScoreA/,/conflictScoreUpdated/,/dataset\.bgsLab/,
]) assert.match(conflictClient,pattern);
assert.match(conflictClient,/Pending conflict prepared/,'Pending conflicts must expose pre-activation strategy preparation');
assert.match(conflictClient,/objectiveFromStrategy/,'Support\/raise faction strategy must drive automatic conflict winner selection');
assert.match(conflictClient,/pair\.phase==='active'/,'Only active conflicts may generate actionable conflict tasks');
assert.match(conflictClient,/automaticPending/,'Pending conflict participants must be auto-paired when unambiguous');
assert.match(conflictClient,/participantNames\.some\(name=>text\.includes\(name\)\)/,'Conflict participants must be removed from ordinary preview tasks');
assert.match(conflictClient,/\[data-faction="influence"\]/,'Influence changes must trigger conflict re-pairing');

const labClient=readFileSync('js/wolf-bgs-lab.js','utf8');
for(const pattern of [
  /wolf-bgs-lab-mandalore-v1/,/wolf-bgs-lab-mandalore-conflicts-v1/,/balanced:/,/dual:/,/fourway:/,/ambiguous:/,/pressure:/,
  /30,28\.5,18,16\.5/,/24,24,24,24/,/4-Way Auto Pair/,/4-Way Ambiguous/,
  /resetConflictPairing/,/localStorage/,/data-save-faction-strategy/,/data-save-slider-objectives/,/data-save-calibration/,
  /Mandalore sandbox values saved locally only/,
]) assert.match(labClient,pattern);

// Parse browser clients without executing DOM-dependent code.
new Function(rulesClient);
new Function(slidersClient);
new Function(orderClient);
new Function(conflictClient);
new Function(labClient);
const conflictLabV2=readFileSync('js/wolf-bgs-conflict-lab-v2.js','utf8');
for(const pattern of [/Conflict Operations Prototype/,/BLITZ OVERRIDE/,/routine:3/,/contested:6/,/heavy:15/,/blitz:25/,/routine:6/,/contested:15/,/heavy:40/,/blitz:60/,/Faction A/,/Faction B/,/No winner \/ tied day/,/Current conflict day/,/First observed score/,/DAY UNKNOWN/,/AUTHORITATIVE SCORE KNOWN/,/dayKnown/,/unknownHistory/,/currentDayOptions/,/data-save-unknown-score/,/if\(!dayKnown\)return\{resolved:false/,/SCORE STALE — AUTOMATION FROZEN/,/TIED — HOLD/,/manualHistory/,/WolfBgsConflictLabOrder/,/wolf-bgs-conflict-lab-updated/,/two observed conflict days without a win/,/Low = /,/Medium = /,/High = /,/COMBAT BONDS NOT REDEEMED/,/CZ lost \/ abandoned/,/Full-instance disconnect/,/one shared CZ instance is one CZ result/,/\+2/,/\+3/,/\+4/,/\+5/,/RESOLVED — STOP CONFLICT WORK/,/HOLD \/ AVOID CONFLICT WORK/]) assert.match(conflictLabV2,pattern);
new Function(conflictLabV2);
const publishClient=readFileSync('js/wolf-bgs-publish.js','utf8');
for(const pattern of [/Publish Queue/,/Add to Publish Queue/,/Publish Daily Orders/,/daily-orders-editor/,/CURRENT Daily Orders cycle/i,/dataset\.orderKind/,/allowDailyOrders/,/Mandalore/,/maxDailySystems/,/source:'wolf-bgs'/,/reportingFor/,/autoQueueSource/,/queueSource/,/suppressedSignatures/,/evaluateOperationalCards/,/wolf-bgs-queue-selector-updated/,/queuePublishedRemoval/,/removalSnapshotForSystem/,/queueSource:'removal'/,/REMOVES ORDERS/,/RETREAT|retreat/]) assert.match(publishClient,pattern);
assert.match(publishClient,/if\(existing\?\.queueSource==='removal'\)\{\s*if\(publishedLoaded&&publishedForSystem\(system\)\.length\)return false;/,'A queued published-order removal must survive lazy card unloading');
assert.match(publishClient,/const queuedRemoval=queuePublishedRemoval\(system\)/,'Turning Q off must explicitly queue removal of already-published orders');
new Function(publishClient);

const rulesApi=readFileSync('functions/api/operations/wolf-bgs-rules.js','utf8');
for (const pattern of [
  /session\.access !== 'site_admin'/,/wolf-bgs-rules-v1/,/save-system-faction-strategies/,/save-system-calibration/,/reset-system-calibration/,
  /bountyBaselineMillions: 20/,/bountyCounterInf: 15/,/tradeCounterInf: null/,/triggerHeadroomPct: 2/,
  /systemCalibrations/,/bountyPercentAdjustment/,/bountyFlatInfAdjustment/,/tradePercentAdjustment/,/tradeFlatInfAdjustment/,
  /row\?\.intent === 'no-action' \? 'flexible'/,/avoid-interaction/,/favoritePreserved/,/exactPerCmdrCapConfirmed: false/,
]) assert.match(rulesApi,pattern);

const economyApi=readFileSync('functions/api/operations/wolf-bgs-economy-rules.js','utf8');
for(const pattern of [
  /wolf-bgs-economy-rules-v1/,/explorationRoutineMillionsPerCmdr: 2/,/explorationStrongMillionsPerCmdr: 5/,/explorationEmergencyMillionsPerCmdr: 10/,
  /negativeWorkEnabled: false/,/save-economy-rules/,/session\.access !== 'site_admin'/,/X-Mongrels-Request/,
]) assert.match(economyApi,pattern);
assert.match(economyApi,/clampNumber\(value\.explorationEmergencyMillionsPerCmdr, 0, 10/,'Exploration emergency tier must be hard-capped at 10M');

const adaptiveConflictApi=readFileSync('functions/api/operations/wolf-bgs-conflicts.js','utf8');
for(const pattern of [
  /wolf-bgs-conflicts-v1/,/save-system-conflicts/,/reset-system-conflicts/,/MAX_PAIRS = 3/,
  /win-a/,/win-b/,/monitor/,/session\.access !== 'site_admin'/,/X-Mongrels-Request/,
]) assert.match(adaptiveConflictApi,pattern);

const slidersApi=readFileSync('functions/api/operations/wolf-bgs-sliders.js','utf8');
for (const pattern of [/session\.access !== 'site_admin'/,/wolf-bgs-slider-objectives-v1/,/save-system-slider-objectives/,/reset-system-slider-objectives/,/economyObjective/,/securityObjective/,/'locked'/,/X-Mongrels-Request/]) assert.match(slidersApi,pattern);

const loneWarFactions=[
  {name:'The Consortium',state:'War',activeStates:[],pendingStates:[]},
  {name:'Wolf 258 Dynasty',state:'Boom',activeStates:['Boom'],pendingStates:[]},
];
assert.deepEqual(
  validatedConflictRows({factions:loneWarFactions,phase:'active'}),
  [],
  'A lone faction War state must not create a system conflict',
);
assert.equal(
  validatedConflictObservation({factions:loneWarFactions,conflicts:[]}),
  null,
  'A lone FactionState=War with no conflict pair must not enter conflict history',
);

const pairedWarFactions=[
  {name:'Faction One',state:'War',activeStates:['War'],pendingStates:[]},
  {name:'Faction Two',state:'War',activeStates:['War'],pendingStates:[]},
];
assert.equal(
  validatedConflictRows({factions:pairedWarFactions,phase:'active'}).length,
  2,
  'Two factions reporting the same active conflict state validate the conflict',
);

const explicitWarRows=validatedConflictRows({
  factions:loneWarFactions,
  conflicts:[{
    type:'War',
    status:'Active',
    faction1:{name:'The Consortium'},
    faction2:{name:'Faction Two'},
  }],
  phase:'active',
});
assert.equal(explicitWarRows.length,2,'An explicit Frontier Conflicts pair must validate both participants even if faction state rows are incomplete');
assert.ok(explicitWarRows.some(row=>row.name==='The Consortium'));
assert.ok(explicitWarRows.some(row=>row.name==='Faction Two'));

const resolvedClinchedWarRows=validatedConflictRows({
  factions:[
    {name:'The Consortium',state:'None',activeStates:[],pendingStates:[]},
    {name:'Perez Ring Brewery',state:'None',activeStates:[],pendingStates:[]},
  ],
  conflicts:[{
    type:'War',
    status:'Active',
    faction1:{name:'The Consortium',wonDays:3},
    faction2:{name:'Perez Ring Brewery',wonDays:0},
  }],
  phase:'active',
});
assert.equal(
  resolvedClinchedWarRows.length,
  0,
  'A clinched 3-x score must not keep a conflict active after both faction boards have left the conflict state',
);

const resolvedFlatScoutScoreRows=validatedConflictRows({
  factions:[
    {name:'The Consortium',state:'None',activeStates:[],pendingStates:[],recoveringStates:['War']},
    {name:'Perez Ring Brewery',state:'None',activeStates:[],pendingStates:['Expansion'],recoveringStates:['War']},
  ],
  conflicts:[{
    type:'War',
    status:'Active',
    faction:'The Consortium',
    opponentFaction:'Perez Ring Brewery',
    factionWonDays:3,
    opponentWonDays:0,
  }],
  phase:'active',
});
assert.equal(
  resolvedFlatScoutScoreRows.length,
  0,
  'Recovering War plus a flat 3-0 Scout score must be treated as a finished conflict',
);

const recoveringOverridesStaleExplicitRows=validatedConflictRows({
  factions:[
    {name:'Faction One',state:'None',activeStates:[],recoveringStates:['War']},
    {name:'Faction Two',state:'None',activeStates:[],recoveringStates:['War']},
  ],
  conflicts:[{
    type:'War',
    status:'Active',
    faction:'Faction One',
    opponentFaction:'Faction Two',
    factionWonDays:2,
    opponentWonDays:1,
  }],
  phase:'active',
});
assert.equal(
  recoveringOverridesStaleExplicitRows.length,
  0,
  'Recovering conflict states must close a stale explicit Active row even before score cleanup',
);

const mismatchedStates=[
  {name:'Faction One',state:'War',activeStates:['War']},
  {name:'Faction Two',state:'Election',activeStates:['Election']},
];
assert.equal(
  validatedConflictRows({factions:mismatchedStates,phase:'active'}).length,
  0,
  'Different conflict types must not be paired together',
);

const apiSource=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
assert.match(apiSource,/wolf_bgs_unavailable/,'Wolf BGS API must expose authenticated data-build failures distinctly');
assert.match(apiSource,/authenticated:true/,'Wolf BGS API must preserve authenticated state when secure data building fails');

for (const pattern of [/session\.access !== 'site_admin'/,/wolf-bgs-control-v1/,/manualSnapshots/,/systemSettings/,/systemDefaults/,/live-bgs-boards\.json/,/externalBoardComplete/,/defaultTick: '19:00'/,/freshnessMode: 'tick-cycle'/,/resolveSystemWorkCycle/,/freshnessCycle/,/maxDailySystems: 6/,/queueSelectorCount/,/queueSelected/,/alertEpisodes/,/ack-alerts/,/remove-alert/,/removedAt/,/unreviewedCount/,/retreatPending/,/refreshAlertEpisodes/,/normalizeConflictScore/,/conflictScore/,/mongrelConflict/,/conflictDayOverrides/,/conflictPairDayOverrides/,/normalizeConflictPairDayOverrides/,/conflictPairTimelinesFor/,/if\(!system\?\.activeConflict\)return out/,/set-conflict-day/,/clear-conflict-day/,/nextConfiguredTickAfter/,/configuredTicksElapsed/,/conflictTimelineFor/,/minimumDays:4/,/maximumDays:7/]) assert.match(apiSource,pattern);

const wolfPage=readFileSync('wolf-bgs/index.html','utf8');
assert.match(wolfPage,/Freshness policy/);
assert.match(wolfPage,/Current BGS cycle/);
assert.doesNotMatch(wolfPage,/Maximum data age/);
assert.match(wolfPage,/wolf-bgs\.js\?v=24/);
const wolfMainClient=readFileSync('js/wolf-bgs.js','utf8');
assert.match(wolfPage,/data-wolf-login[^>]*hidden/,'Wolf BGS login CTA must stay hidden until auth explicitly fails');
assert.match(wolfPage,/data-wolf-retry[^>]*hidden/,'Wolf BGS retry CTA must exist for authenticated service failures');
assert.match(wolfMainClient,/setGateState\('service-error'/,'Wolf BGS must distinguish service failure from signed-out state');
assert.match(wolfMainClient,/fetchWolfControlWithRetry/,'Wolf BGS must retry transient secure-service failures');
assert.match(wolfMainClient,/response\.status === 401 \|\| response\.status === 403/,'Only explicit Wolf BGS auth failures should reveal login');

assert.doesNotMatch(wolfMainClient,/Freshness <b>Current BGS cycle<\/b>/,'Cycle-window label must not imply an old board is fresh');
assert.match(wolfMainClient,/BGS cycle/);
assert.match(wolfMainClient,/Frontier CAPI/);
assert.match(wolfMainClient,/freshnessCycle/);
assert.doesNotMatch(wolfMainClient,/Custom freshness hours/);
new Function(wolfMainClient);

assert.match(apiSource,/readAlertFactionStrategies/,'Faction alerts must read saved faction strategy');
assert.match(apiSource,/relevantConflictAlert/,'Conflict alerts must be scoped to Mongrel involvement or explicit support');
assert.match(apiSource,/norm\(row\?\.intent\)==='support'/,'Only explicit Support \/ raise strategy should opt a non-Mongrel conflict into alerts');
assert.match(apiSource,/activeConflict/,'System-level conflicts must be tracked separately from Mongrel participation');
assert.match(apiSource,/validatedConflictRows/,'System conflict detection must require validated participant pairs');
assert.match(wolfMainClient,/data-conflict-active-rows/,'Validated active conflict participants must be passed to the conflict client');
assert.match(conflictClient,/validatedStateRows/,'Conflict configuration must reject lone conflict-state rows');
assert.match(conflictClient,/counts\.get\(row\.type\).*>=2/,'Client-side conflict state fallback must require at least two same-type participants');
assert.match(apiSource,/scoutConflictScores/,'Live Scout must expose scores for non-Mongrel conflict pairs');
assert.doesNotMatch(apiSource,/const conflictScore = mongrelConflict \?/,'Conflict scores must not be gated on Mongrel participation');
assert.match(conflictClient,/Conflict score/,'Conflict UI must use a system-level score label');
assert.doesNotMatch(conflictClient,/Mongrel conflict score/,'Conflict UI must not label every score as Mongrel-only');

const writeApi=readFileSync('functions/api/operations/wolf-bgs-write.js','utf8');
for (const pattern of [/normalizeSparseSettingsMap/,/normalizeSystemOverrides/,/Values equal to the old System Defaults are inheritance/,/freshnessMode: 'tick-cycle'/,/raw\.version = 3/,/session\.access !== 'site_admin'/,/toggle-queue-selector/,/queueSelected/,/ack-alerts/,/remove-alert/,/removedAt/,/alertEpisodes/,/set-conflict-day/,/clear-conflict-day/,/conflictDayOverrides/,/conflictPairDayOverrides/,/normalizeConflictPairDayOverrides/]) assert.match(writeApi,pattern);

const scoutIngest=readFileSync('functions/api/operations/scout-ingest.js','utf8');
assert.match(scoutIngest,/validatedConflictObservation/,'Live Scout conflict history must use pair validation');
const frontierSync=readFileSync('functions/api/frontier/sync.js','utf8');
assert.match(frontierSync,/validatedConflictObservation/,'Frontier CAPI conflict history must use pair validation');

const boardUpdater=readFileSync('scripts/enrich_bgs_boards.py','utf8');
assert.match(boardUpdater,/fetch_tracked_system_conflicts/,'Board updater must fetch active conflicts regardless of Mongrel participation');
assert.match(boardUpdater,/systemConflicts/,'Board updater must persist system-level conflict scores');
for (const pattern of [/factionStates/,/pendingStates/,/recoveringStates/,/live-bgs-boards\.json/,/factionConflicts/,/factionWonDays/,/opponentWonDays/,/opponentFactionId/,/fetch_mongrel_conflicts/,/conflictSyncOk/]) assert.match(boardUpdater,pattern);

const baseCss=readFileSync('css/wolf-bgs.css','utf8');
for(const pattern of [/\.wolf-master-alert-button/,/wolf-master-alert-flash/,/\.wolf-alert-remove-button/,/prefers-reduced-motion/,/\.wolf-freshness-value/,/\.wolf-conflict-score-stat/,/\.wolf-conflict-score-chip/,/\.wolf-conflict-day-chip/]) assert.match(baseCss,pattern);

const orderCss=readFileSync('css/wolf-bgs-order-preview.css','utf8');
for (const pattern of [/\.wolf-calibration-grid/,/\.wolf-order-task/,/\.wolf-order-math/,/\.wolf-order-warnings/,/\.wolf-slider-guard\.balance-required/]) assert.match(orderCss,pattern);
const conflictCss=readFileSync('css/wolf-bgs-conflicts.css','utf8');
for(const pattern of [/\.wolf-conflict-pair/,/\.wolf-conflict-preview-banner/,/\.wolf-conflict-preview-task/,/\.wolf-conflict-score-detail/,/\.wolf-conflict-timeline-panel/,/\.wolf-conflict-day-controls/,/\.wolf-conflict-day-detail/,/\.wolf-conflict-pair-timeline/,/\.wolf-conflict-pair-day-readout/]) assert.match(conflictCss,pattern);
const labCss=readFileSync('css/wolf-bgs-lab.css','utf8');
for(const pattern of [/\.wolf-bgs-lab-section/,/\.wolf-lab-card/,/\.wolf-lab-scenarios/]) assert.match(labCss,pattern);

const rulesModule=await import('../functions/api/operations/wolf-bgs-rules.js');
assert.equal(typeof rulesModule.onRequestGet,'function');
assert.equal(typeof rulesModule.onRequestPut,'function');
const economyModule=await import('../functions/api/operations/wolf-bgs-economy-rules.js');
assert.equal(typeof economyModule.onRequestGet,'function');
assert.equal(typeof economyModule.onRequestPut,'function');
const conflictModule=await import('../functions/api/operations/wolf-bgs-conflicts.js');
assert.equal(typeof conflictModule.onRequestGet,'function');
assert.equal(typeof conflictModule.onRequestPut,'function');
const slidersModule=await import('../functions/api/operations/wolf-bgs-sliders.js');
assert.equal(typeof slidersModule.onRequestGet,'function');
assert.equal(typeof slidersModule.onRequestPut,'function');
const mainModule=await import('../functions/api/operations/wolf-bgs.js');
assert.equal(typeof mainModule.onRequestGet,'function');
assert.equal(typeof mainModule.onRequestPut,'function');
assert.match(apiSource,/from '\.\.\/\.\.\/\.\.\/lib\/daily-order-cycle\.js'/,'Conflict timelines should reuse the shared Central-time tick helpers');
assert.doesNotMatch(apiSource,/Date\.UTC\(start\.getUTCFullYear\(\)/,'Conflict timeline must not reinterpret configured CT tick clocks as UTC');
assert.doesNotMatch(apiSource,/freshnessHours:/,'BGS Control API should no longer expose hour-based freshness defaults');
assert.doesNotMatch(writeApi,/freshnessHours:/,'BGS Control write API should no longer persist hour-based freshness overrides');

console.log('✓ Wolf BGS Control Mandalore lab, ±3-point influence-assisted multi-conflict pairing with manual ambiguity fallback, participant locking, conflict-specific preview work, exploration tiers, Economy bucket selection, smart counterweight mission preferences, positive-redistribution suppression, negative-work safety, per-system calibration, and private APIs are structurally sound');

const reportsClient=readFileSync('js/wolf-bgs-reports.js','utf8');
for(const pattern of [/CURRENT CYCLE REPORTS/,/admin=1/,/data-admin-edit/,/data-admin-delete/,/mutate\('PATCH'/,/mutate\('DELETE'/,/Save Changes/]) assert.match(reportsClient,pattern);
new Function(reportsClient);
