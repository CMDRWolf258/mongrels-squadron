import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const critical = [
  'wolf-bgs/index.html', 'css/wolf-bgs.css', 'css/wolf-bgs-rules.css', 'css/wolf-bgs-sliders.css', 'css/wolf-bgs-order-preview.css', 'css/wolf-bgs-conflicts.css', 'css/wolf-bgs-conflict-lab-v2.css', 'css/wolf-bgs-publish.css', 'css/wolf-bgs-lab.css',
  'js/wolf-bgs-inheritance.js', 'js/wolf-bgs.js', 'js/wolf-bgs-rules.js', 'js/wolf-bgs-sliders.js', 'js/wolf-bgs-order-preview.js', 'js/wolf-bgs-conflicts.js', 'js/wolf-bgs-contribution-options.js', 'js/wolf-bgs-conflict-lab-v2.js', 'js/wolf-bgs-publish.js', 'js/wolf-bgs-lab.js',
  'functions/api/operations/wolf-bgs.js', 'functions/api/operations/wolf-bgs-write.js', 'functions/api/operations/wolf-bgs-rules.js', 'functions/api/operations/wolf-bgs-sliders.js', 'functions/api/operations/wolf-bgs-economy-rules.js', 'functions/api/operations/wolf-bgs-conflicts.js',
  'scripts/enrich_bgs_boards.py', 'data/live-bgs-boards.json',
];
for (const path of critical) assert.ok(existsSync(path), `Wolf BGS Control critical file is missing: ${path}`);

const page = readFileSync('wolf-bgs/index.html','utf8');
for (const pattern of [/Wolf BGS Control/,/data-global-form/,/data-system-list/,/data-system-defaults-form/,/data-page-size/,/data-favorites-first/,/data-lowest-five-watch/,/wolf-time-input/]) assert.match(page,pattern);
assert.match(page,/<option value="20" selected>20<\/option>/,'Results-per-page default should be 20');
assert.match(page,/<option value="influence-desc" selected>Influence high → low<\/option>/,'Influence high-to-low should be default');
assert.match(page,/wolf-bgs-order-preview\.css/,'Order Preview stylesheet is not loaded');
assert.match(page,/wolf-bgs-order-preview\.js\?v=4/,'Order Preview cache version should be v4');
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
assert.ok(page.indexOf('wolf-bgs-rules.js') < page.indexOf('wolf-bgs-sliders.js'),'Slider client must load after rules');
assert.ok(page.indexOf('wolf-bgs-sliders.js') < page.indexOf('wolf-bgs-order-preview.js'),'Order Preview must load after slider controls');
assert.ok(page.indexOf('wolf-bgs-order-preview.js') < page.indexOf('wolf-bgs-conflicts.js'),'Conflict layer must post-process the deterministic Order Preview');
assert.ok(page.indexOf('wolf-bgs-conflicts.js') < page.indexOf('wolf-bgs-lab.js'),'Lab interception must load after conflict controls');

const baseClient=readFileSync('js/wolf-bgs.js','utf8');
for (const pattern of [/submit-status/,/save-system/,/save-global/,/save-system-defaults/,/toggle-favorite/,/Programmed Automation/,/Advanced Intelligence Suggestion/,/data-faction-row/]) assert.match(baseClient,pattern);

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
  /Overlapping same-faction counterweight needs keep the higher INF workload/,/data-order-kind/,/data-order-faction/,/data-order-amount/,
]) assert.match(orderClient,pattern);
assert.doesNotMatch(orderClient,/exobiology.*task/i,'Exobiology must not be generated as a BGS task');

const conflictClient=readFileSync('js/wolf-bgs-conflicts.js','utf8');
for(const pattern of [
  /wolf-bgs-conflicts/,/Conflict Configuration/,/conflictType/,/civil-war/,/election/,/war/,
  /INFLUENCE_PAIR_TOLERANCE = 3/,/findInfluenceMatchings/,/multiple influence-compatible pairings fit/,
  /manual confirmation overrides the ±\$\{INFLUENCE_PAIR_TOLERANCE\}/,/Unpaired active participants/,
  /ordinary influence\/counterweight work/,/Conflict Zones \+ Combat Bonds/,/non-combat\/economic mission work/,
  /wolf-conflict-preview-task/,/Conflict lock active/,/dataset\.bgsLab/,
]) assert.match(conflictClient,pattern);
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
for(const pattern of [/7-Day Progression/,/BLITZ/,/routine:3/,/contested:6/,/heavy:15/,/blitz:25/,/routine:6/,/contested:15/,/heavy:40/,/blitz:60/,/Faction A/,/Faction B/,/No winner \/ tied day/,/Current conflict day/,/Low = /,/Medium = /,/High = /,/COMBAT BONDS NOT REDEEMED/,/CZ lost \/ abandoned/,/Full-instance disconnect/,/one shared CZ instance is one CZ result/,/\+2/,/\+3/,/\+4/,/\+5/,/RESOLVED — STOP CONFLICT WORK/,/HOLD \/ AVOID CONFLICT WORK/]) assert.match(conflictLabV2,pattern);
new Function(conflictLabV2);
const publishClient=readFileSync('js/wolf-bgs-publish.js','utf8');
for(const pattern of [/Publish Queue/,/Add to Publish Queue/,/Publish Daily Orders/,/daily-orders-editor/,/new reporting cycle/i,/dataset\.orderKind/,/allowDailyOrders/,/Mandalore/,/maxDailySystems/,/source:'wolf-bgs'/,/reportingFor/]) assert.match(publishClient,pattern);
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

const conflictApi=readFileSync('functions/api/operations/wolf-bgs-conflicts.js','utf8');
for(const pattern of [
  /wolf-bgs-conflicts-v1/,/save-system-conflicts/,/reset-system-conflicts/,/MAX_PAIRS = 3/,
  /win-a/,/win-b/,/monitor/,/session\.access !== 'site_admin'/,/X-Mongrels-Request/,
]) assert.match(conflictApi,pattern);

const slidersApi=readFileSync('functions/api/operations/wolf-bgs-sliders.js','utf8');
for (const pattern of [/session\.access !== 'site_admin'/,/wolf-bgs-slider-objectives-v1/,/save-system-slider-objectives/,/reset-system-slider-objectives/,/economyObjective/,/securityObjective/,/'locked'/,/X-Mongrels-Request/]) assert.match(slidersApi,pattern);

const apiSource=readFileSync('functions/api/operations/wolf-bgs.js','utf8');
for (const pattern of [/session\.access !== 'site_admin'/,/wolf-bgs-control-v1/,/manualSnapshots/,/systemSettings/,/systemDefaults/,/live-bgs-boards\.json/,/externalBoardComplete/,/defaultTick: '19:00'/,/maxDailySystems: 6/]) assert.match(apiSource,pattern);

const writeApi=readFileSync('functions/api/operations/wolf-bgs-write.js','utf8');
for (const pattern of [/normalizeSparseSettingsMap/,/normalizeSystemOverrides/,/Values equal to the old System Defaults are inheritance/,/raw\.version = 3/,/session\.access !== 'site_admin'/]) assert.match(writeApi,pattern);

const boardUpdater=readFileSync('scripts/enrich_bgs_boards.py','utf8');
for (const pattern of [/factionStates/,/pendingStates/,/recoveringStates/,/live-bgs-boards\.json/]) assert.match(boardUpdater,pattern);

const orderCss=readFileSync('css/wolf-bgs-order-preview.css','utf8');
for (const pattern of [/\.wolf-calibration-grid/,/\.wolf-order-task/,/\.wolf-order-math/,/\.wolf-order-warnings/,/\.wolf-slider-guard\.balance-required/]) assert.match(orderCss,pattern);
const conflictCss=readFileSync('css/wolf-bgs-conflicts.css','utf8');
for(const pattern of [/\.wolf-conflict-pair/,/\.wolf-conflict-preview-banner/,/\.wolf-conflict-preview-task/]) assert.match(conflictCss,pattern);
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

console.log('✓ Wolf BGS Control Mandalore lab, ±3-point influence-assisted multi-conflict pairing with manual ambiguity fallback, participant locking, conflict-specific preview work, exploration tiers, Economy bucket selection, smart counterweight mission preferences, positive-redistribution suppression, negative-work safety, per-system calibration, and private APIs are structurally sound');
