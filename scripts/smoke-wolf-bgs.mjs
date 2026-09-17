import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const critical = [
  'wolf-bgs/index.html', 'css/wolf-bgs.css', 'css/wolf-bgs-rules.css', 'css/wolf-bgs-sliders.css', 'css/wolf-bgs-order-preview.css',
  'js/wolf-bgs-inheritance.js', 'js/wolf-bgs.js', 'js/wolf-bgs-rules.js', 'js/wolf-bgs-sliders.js', 'js/wolf-bgs-order-preview.js',
  'functions/api/operations/wolf-bgs.js', 'functions/api/operations/wolf-bgs-write.js', 'functions/api/operations/wolf-bgs-rules.js', 'functions/api/operations/wolf-bgs-sliders.js', 'functions/api/operations/wolf-bgs-economy-rules.js',
  'scripts/enrich_bgs_boards.py', 'data/live-bgs-boards.json',
];
for (const path of critical) assert.ok(existsSync(path), `Wolf BGS Control critical file is missing: ${path}`);

const page = readFileSync('wolf-bgs/index.html','utf8');
for (const pattern of [/Wolf BGS Control/,/data-global-form/,/data-system-list/,/data-system-defaults-form/,/data-page-size/,/data-favorites-first/,/data-lowest-five-watch/,/wolf-time-input/]) assert.match(page,pattern);
assert.match(page,/<option value="20" selected>20<\/option>/,'Results-per-page default should be 20');
assert.match(page,/<option value="influence-desc" selected>Influence high → low<\/option>/,'Influence high-to-low should be default');
assert.match(page,/wolf-bgs-order-preview\.css/,'Order Preview stylesheet is not loaded');
assert.match(page,/wolf-bgs-order-preview\.js\?v=3/,'Order Preview cache version should be v3');
assert.ok(page.indexOf('wolf-bgs-rules.js') < page.indexOf('wolf-bgs-sliders.js'),'Slider client must load after rules');
assert.ok(page.indexOf('wolf-bgs-sliders.js') < page.indexOf('wolf-bgs-order-preview.js'),'Order Preview must load after slider controls');

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
  /Order Preview \/ Generator/,/PREVIEW ONLY/,/Publish disabled/,/Generate \/ Refresh Preview/,
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
  /Overlapping same-faction counterweight needs keep the higher INF workload/,
]) assert.match(orderClient,pattern);
assert.doesNotMatch(orderClient,/exobiology.*task/i,'Exobiology must not be generated as a BGS task');

// Parse browser clients without executing DOM-dependent code.
new Function(rulesClient);
new Function(slidersClient);
new Function(orderClient);

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

const rulesModule=await import('../functions/api/operations/wolf-bgs-rules.js');
assert.equal(typeof rulesModule.onRequestGet,'function');
assert.equal(typeof rulesModule.onRequestPut,'function');
const economyModule=await import('../functions/api/operations/wolf-bgs-economy-rules.js');
assert.equal(typeof economyModule.onRequestGet,'function');
assert.equal(typeof economyModule.onRequestPut,'function');
const slidersModule=await import('../functions/api/operations/wolf-bgs-sliders.js');
assert.equal(typeof slidersModule.onRequestGet,'function');
assert.equal(typeof slidersModule.onRequestPut,'function');
const mainModule=await import('../functions/api/operations/wolf-bgs.js');
assert.equal(typeof mainModule.onRequestGet,'function');
assert.equal(typeof mainModule.onRequestPut,'function');

console.log('✓ Wolf BGS Control exploration tiers, Economy bucket selection, smart counterweight mission preferences, positive-redistribution suppression, negative-work safety, balance-dont-block logic, per-system calibration, and private APIs are structurally sound');
