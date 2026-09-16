import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { AX_ROUTES } from '../lib/pathway-ax.js';
import { BGS_ROUTES } from '../lib/pathway-bgs.js';
import { MINING_ROUTES } from '../lib/pathway-mining.js';
import { TRADE_ROUTES } from '../lib/pathway-trade.js';
import { CARRIER_LOGISTICS_ROUTES } from '../lib/pathway-carrier-logistics.js';
import { ENGINEERING_ROUTES } from '../lib/pathway-engineering.js';
import {
  createEmptyEngineeringCampaignState,
  startEngineeringCampaign,
  setEngineeringFact,
  buildEngineeringCampaignView,
} from '../lib/engineering-campaign.js';
import { ENGINEERING_TRACKED_FACTS } from '../lib/engineering-campaign-data.js';
import {
  SHIELD_CAMPAIGN_FACTS,
  buildShieldEngineeringDependencyNodes,
} from '../lib/engineering-campaign-shields.js';
import {
  buildJumpRangeEngineeringDependencyNodes,
} from '../lib/engineering-campaign-jump-range.js';
import {
  buildMobilityEngineeringDependencyNodes,
} from '../lib/engineering-campaign-mobility.js';
import {
  buildDistributorEngineeringDependencyNodes,
} from '../lib/engineering-campaign-distributor.js';
import {
  POWER_THERMAL_CAMPAIGN_FACTS,
  buildPowerThermalEngineeringDependencyNodes,
} from '../lib/engineering-campaign-power-thermal.js';
import {
  CROSS_PATH_ENGINEERING_PREP,
  engineeringPrepForTask,
} from '../lib/pathway-engineering-prep.js';
import { CROSS_PATH_ENGINEERING_TRACKED_FACTS } from '../lib/pathway-engineering-prep-facts.js';
import {
  CG_HAULER_PREP,
  createCgHaulerPrepState,
  setCgHaulerTaskStatus,
  buildCgHaulerPrepView,
} from '../lib/pathway-cg-hauler-prep.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

const providers = [
  ['Anti-Xeno', AX_ROUTES],
  ['BGS', BGS_ROUTES],
  ['Mining', MINING_ROUTES],
  ['Trade', TRADE_ROUTES],
  ['Carrier Logistics', CARRIER_LOGISTICS_ROUTES],
  ['Engineering', ENGINEERING_ROUTES],
];

function checkRouteCatalog(label, routes) {
  assert.ok(Array.isArray(routes) && routes.length > 0, `${label} route catalog is empty`);
  const routeIds = new Set();
  for (const route of routes) {
    assert.ok(route && typeof route === 'object', `${label} contains an invalid route`);
    assert.ok(route.id, `${label} route is missing an id`);
    assert.ok(!routeIds.has(route.id), `${label} has duplicate route id ${route.id}`);
    routeIds.add(route.id);
    assert.ok(route.title, `${label}/${route.id} is missing a title`);
    assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${label}/${route.id} has no tasks`);

    const taskIds = new Set();
    for (const task of route.tasks) {
      assert.ok(task?.id, `${label}/${route.id} contains a task without an id`);
      assert.ok(!taskIds.has(task.id), `${label}/${route.id} has duplicate task id ${task.id}`);
      taskIds.add(task.id);
      assert.ok(task.title, `${label}/${route.id}/${task.id} is missing a title`);
      assert.ok(task.objective, `${label}/${route.id}/${task.id} is missing an objective`);
    }
  }
}

for (const [label, routes] of providers) checkRouteCatalog(label, routes);
console.log(`✓ validated ${providers.length} Pathway provider catalogs`);

// Cross-path Engineering prep must only point at real current Pathway tasks and
// counters the Engineering API knows how to store. This prevents a route rewrite
// from leaving behind a dead prep button or a silently invalid fact ID.
const prepTaskIds = {
  trade:new Set(TRADE_ROUTES.flatMap(route => route.tasks.map(task => task.id))),
  mining:new Set(MINING_ROUTES.flatMap(route => route.tasks.map(task => task.id))),
};
const trackedPrepFacts = {
  ...ENGINEERING_TRACKED_FACTS,
  ...CROSS_PATH_ENGINEERING_TRACKED_FACTS,
};
for (const [activity, tasks] of Object.entries(CROSS_PATH_ENGINEERING_PREP)) {
  assert.ok(prepTaskIds[activity], `cross-path Engineering prep uses unsupported activity ${activity}`);
  for (const [taskId, opportunities] of Object.entries(tasks)) {
    assert.ok(prepTaskIds[activity].has(taskId), `cross-path Engineering prep references missing ${activity} task ${taskId}`);
    assert.ok(Array.isArray(opportunities) && opportunities.length > 0, `${activity}/${taskId} has no Engineering prep opportunity`);
    for (const opportunity of opportunities) {
      assert.ok(trackedPrepFacts[opportunity.factId], `${activity}/${taskId} references untracked Engineering fact ${opportunity.factId}`);
      assert.ok(Number(opportunity.maxContribution) > 0, `${activity}/${taskId} has no positive prep contribution limit`);
    }
  }
}
assert.equal(engineeringPrepForTask('trade', 'trade-foundations-cheap-haul-v2')[0]?.factId, 'trade.markets-visited-distinct', 'Trade cross-path prep lost Lei Cheung market tracking');
assert.equal(engineeringPrepForTask('mining', 'mining-efficient-baseline')[0]?.factId, 'mining.ore-mined-total-tonnes', 'Mining cross-path prep lost Selene Jean mined-tonnage tracking');
assert.equal(CROSS_PATH_ENGINEERING_TRACKED_FACTS['mining.ore-mined-total-tonnes']?.kind, 'counter', 'Selene Jean mining prep is not a tracked counter');
console.log('✓ cross-path Engineering prep maps real Trade/Mining work to tracked facts');

// Exercise the campaign engine's fact-completed dependency behavior. This guards
// against a regression where a shared fact could mark its own node complete but
// fail to unlock downstream work.
let state = createEmptyEngineeringCampaignState('smoke-user');
state = startEngineeringCampaign(state, {
  goalId:'shields',
  shipName:'Smoke Test Ship',
  targetNotes:'Verify campaign dependency behavior.',
}, '2026-09-16T12:00:00.000Z');

state = setEngineeringFact(state, 'smoke.fact', true, 'smoke', '2026-09-16T12:01:00.000Z');
const dependencyView = buildEngineeringCampaignView(state, [
  {
    id:'smoke.fact-node',
    kind:'prepare',
    title:'Fact-completed prerequisite',
    objective:'Smoke test prerequisite.',
    dependsOn:[],
    factCompletion:{ factId:'smoke.fact', operator:'truthy', target:true },
  },
  {
    id:'smoke.downstream',
    kind:'task',
    title:'Downstream task',
    objective:'Smoke test downstream task.',
    dependsOn:['smoke.fact-node'],
  },
]);
const factNode = dependencyView.nodes.find(node => node.id === 'smoke.fact-node');
const downstreamNode = dependencyView.nodes.find(node => node.id === 'smoke.downstream');
assert.equal(factNode?.status, 'complete', 'fact-completed campaign node did not complete');
assert.equal(downstreamNode?.dependenciesMet, true, 'fact-completed node did not unlock its downstream dependency');
console.log('✓ Engineering campaign fact dependency propagation works');

// A later permanent-access fact should supersede old unlock counters in the
// Improve Shields campaign. Veteran Commanders must not need to invent old
// market totals merely to prove an Engineer they already have.
state = setEngineeringFact(
  state,
  SHIELD_CAMPAIGN_FACTS.leiUnlocked,
  true,
  'smoke',
  '2026-09-16T12:02:00.000Z',
);
const activeCampaign = state.campaigns[state.activeCampaignId];
const shieldNodes = buildShieldEngineeringDependencyNodes({ campaign:activeCampaign, facts:state.facts });
for (const nodeId of ['shields.dweller.black-markets', 'shields.dweller.unlock', 'shields.dweller.referral', 'shields.lei.markets']) {
  const node = shieldNodes.find(item => item.id === nodeId);
  assert.ok(node, `Improve Shields is missing expected node ${nodeId}`);
  assert.equal(node.factCompletion?.factId, SHIELD_CAMPAIGN_FACTS.leiUnlocked, `${nodeId} does not honor existing Lei Cheung access`);
}
console.log('✓ Improve Shields honors existing Lei Cheung access');

// Improve Jump Range must reuse permanent access already recorded by First
// Engineering Win. This proves the second campaign actually benefits from prior
// site progress instead of merely being another isolated checklist.
let jumpState = createEmptyEngineeringCampaignState('jump-smoke-user');
jumpState = startEngineeringCampaign(jumpState, {
  goalId:'jump-range',
  shipName:'Jump Smoke Ship',
  targetNotes:'Reduce normal travel jumps.',
}, '2026-09-16T12:10:00.000Z');
jumpState = setEngineeringFact(jumpState, 'first-win.fsd.scout-ready', true, 'smoke', '2026-09-16T12:11:00.000Z');
jumpState = setEngineeringFact(jumpState, 'first-win.fsd.engineer-access-ready', true, 'smoke', '2026-09-16T12:12:00.000Z');
jumpState = setEngineeringFact(jumpState, 'first-win.fsd.g2-access-ready', true, 'smoke', '2026-09-16T12:13:00.000Z');
const jumpCampaign = jumpState.campaigns[jumpState.activeCampaignId];
const jumpNodes = buildJumpRangeEngineeringDependencyNodes({ campaign:jumpCampaign, facts:jumpState.facts });
const jumpView = buildEngineeringCampaignView(jumpState, jumpNodes);
for (const nodeId of [
  'jump-range.felicity.scout',
  'jump-range.felicity.meta-alloy',
  'jump-range.felicity.deciat-safety',
  'jump-range.felicity.unlock',
  'jump-range.felicity.g2-access',
]) {
  const node = jumpView.nodes.find(item => item.id === nodeId);
  assert.ok(node, `Improve Jump Range is missing expected node ${nodeId}`);
  assert.equal(node.status, 'complete', `${nodeId} did not reuse First Engineering Win access`);
}
assert.ok(jumpView.nodes.some(node => node.id === 'jump-range.test.g2' && node.meta?.readyToFinish), 'Improve Jump Range has no G2 stopping point');
assert.ok(jumpView.nodes.some(node => node.id === 'jump-range.experimental.test' && node.meta?.readyToFinish), 'Improve Jump Range has no experimental stopping point');
console.log('✓ Improve Jump Range reuses First Engineering Win access and preserves stopping points');

// Improve Speed & Mobility should reuse the same Felicity access/reputation that
// the FSD work already established. Engineer reputation is shared even though the
// older stored fact names mention the FSD specifically.
let mobilityState = createEmptyEngineeringCampaignState('mobility-smoke-user');
mobilityState = startEngineeringCampaign(mobilityState, {
  goalId:'mobility',
  shipName:'Mobility Smoke Ship',
  targetNotes:'Improve boost speed and handling.',
}, '2026-09-16T12:20:00.000Z');
mobilityState = setEngineeringFact(mobilityState, 'first-win.fsd.scout-ready', true, 'smoke', '2026-09-16T12:21:00.000Z');
mobilityState = setEngineeringFact(mobilityState, 'first-win.fsd.engineer-access-ready', true, 'smoke', '2026-09-16T12:22:00.000Z');
mobilityState = setEngineeringFact(mobilityState, 'first-win.fsd.g2-access-ready', true, 'smoke', '2026-09-16T12:23:00.000Z');
const mobilityCampaign = mobilityState.campaigns[mobilityState.activeCampaignId];
const mobilityNodes = buildMobilityEngineeringDependencyNodes({ campaign:mobilityCampaign, facts:mobilityState.facts });
const mobilityView = buildEngineeringCampaignView(mobilityState, mobilityNodes);
for (const nodeId of [
  'mobility.felicity.scout',
  'mobility.felicity.meta-alloy',
  'mobility.felicity.deciat-safety',
  'mobility.felicity.unlock',
  'mobility.felicity.g2-access',
]) {
  const node = mobilityView.nodes.find(item => item.id === nodeId);
  assert.ok(node, `Improve Speed & Mobility is missing expected node ${nodeId}`);
  assert.equal(node.status, 'complete', `${nodeId} did not reuse existing Felicity access`);
}
assert.ok(mobilityView.nodes.some(node => node.id === 'mobility.test.g2' && node.meta?.readyToFinish), 'Improve Speed & Mobility has no G2 stopping point');
assert.ok(mobilityView.nodes.some(node => node.id === 'mobility.experimental.test' && node.meta?.readyToFinish), 'Improve Speed & Mobility has no experimental stopping point');
console.log('✓ Improve Speed & Mobility reuses Felicity access and preserves stopping points');

// Improve Power Distributor should reuse The Dweller reputation established by
// Improve Shields. A recorded Lei referral means The Dweller was already in the
// G3–G4 band, so the black-market, unlock, G2 and G3 gates must all clear.
let distributorState = createEmptyEngineeringCampaignState('distributor-smoke-user');
distributorState = startEngineeringCampaign(distributorState, {
  goalId:'distributor',
  shipName:'Distributor Smoke Ship',
  targetNotes:'Keep WEP from drying out without losing boost cadence.',
}, '2026-09-16T12:25:00.000Z');
distributorState = setEngineeringFact(distributorState, SHIELD_CAMPAIGN_FACTS.leiReferralReady, true, 'smoke', '2026-09-16T12:26:00.000Z');
const distributorCampaign = distributorState.campaigns[distributorState.activeCampaignId];
const distributorNodes = buildDistributorEngineeringDependencyNodes({ campaign:distributorCampaign, facts:distributorState.facts });
const distributorView = buildEngineeringCampaignView(distributorState, distributorNodes);
for (const nodeId of [
  'distributor.dweller.black-markets',
  'distributor.dweller.unlock',
  'distributor.dweller.g2-access',
  'distributor.dweller.g3-access',
]) {
  const node = distributorView.nodes.find(item => item.id === nodeId);
  assert.ok(node, `Improve Power Distributor is missing expected node ${nodeId}`);
  assert.equal(node.status, 'complete', `${nodeId} did not reuse existing The Dweller reputation`);
}
assert.ok(distributorView.nodes.some(node => node.id === 'distributor.test.g2' && node.meta?.readyToFinish), 'Improve Power Distributor has no G2 stopping point');
assert.ok(distributorView.nodes.some(node => node.id === 'distributor.experimental.test' && node.meta?.readyToFinish), 'Improve Power Distributor has no experimental stopping point');
assert.ok(distributorView.nodes.some(node => node.id === 'distributor.test.g3' && node.meta?.readyToFinish), 'Improve Power Distributor has no G3 stopping point');
console.log('✓ Improve Power Distributor reuses The Dweller progress and preserves stopping points');

// Improve Power & Heat must reuse Felicity access for its small G1 phase and let
// a known higher-grade Power Plant capability supersede both Felicity and later
// G2/G3 access gates. The priority audit is also a legitimate no-engineering win.
let powerThermalState = createEmptyEngineeringCampaignState('power-thermal-smoke-user');
powerThermalState = startEngineeringCampaign(powerThermalState, {
  goalId:'power-thermal',
  shipName:'Thermal Smoke Ship',
  targetNotes:'Fix deployed power and sustained heat without unnecessary overcharge.',
}, '2026-09-16T12:27:00.000Z');
powerThermalState = setEngineeringFact(powerThermalState, 'first-win.fsd.scout-ready', true, 'smoke', '2026-09-16T12:28:00.000Z');
powerThermalState = setEngineeringFact(powerThermalState, 'first-win.fsd.engineer-access-ready', true, 'smoke', '2026-09-16T12:29:00.000Z');
powerThermalState = setEngineeringFact(powerThermalState, POWER_THERMAL_CAMPAIGN_FACTS.powerPlantG3Ready, true, 'smoke', '2026-09-16T12:30:00.000Z');
const powerThermalCampaign = powerThermalState.campaigns[powerThermalState.activeCampaignId];
const powerThermalNodes = buildPowerThermalEngineeringDependencyNodes({ campaign:powerThermalCampaign, facts:powerThermalState.facts });
const powerThermalView = buildEngineeringCampaignView(powerThermalState, powerThermalNodes);
for (const nodeId of [
  'power-thermal.felicity.scout',
  'power-thermal.felicity.meta-alloy',
  'power-thermal.felicity.deciat-safety',
  'power-thermal.felicity.unlock',
  'power-thermal.g2-access',
  'power-thermal.g3-access',
]) {
  const node = powerThermalView.nodes.find(item => item.id === nodeId);
  assert.ok(node, `Improve Power & Heat is missing expected node ${nodeId}`);
  assert.equal(node.status, 'complete', `${nodeId} did not reuse existing Engineer access`);
}
for (const nodeId of ['power-thermal.priority-test','power-thermal.test.g1','power-thermal.test.g2','power-thermal.experimental.test','power-thermal.test.g3']) {
  assert.ok(powerThermalView.nodes.some(node => node.id === nodeId && node.meta?.readyToFinish), `Improve Power & Heat lost stopping point ${nodeId}`);
}
console.log('✓ Improve Power & Heat reuses Engineer access and preserves no-engineering/G1/G2/experimental/G3 stopping points');

// Community Goal Hauler Prep is an independent Trade specialty, not another full
// Pathway provider. Keep the sequence compact, unique, and status semantics aligned
// with the main Pathway model: complete/known earn credit; skip does not.
assert.equal(CG_HAULER_PREP.steps.length, 14, 'Community Goal Hauler Prep should contain 14 training steps');
assert.equal(new Set(CG_HAULER_PREP.steps.map(step => step.id)).size, CG_HAULER_PREP.steps.length, 'Community Goal Hauler Prep contains duplicate task IDs');
let cgState = createCgHaulerPrepState('cg-smoke-user');
cgState = setCgHaulerTaskStatus(cgState, 'cg-hauler.choose-ship', 'complete', '2026-09-16T12:30:00.000Z');
cgState = setCgHaulerTaskStatus(cgState, 'cg-hauler.baseline', 'known', '2026-09-16T12:31:00.000Z');
cgState = setCgHaulerTaskStatus(cgState, 'cg-hauler.win-condition', 'skipped', '2026-09-16T12:32:00.000Z');
const cgView = buildCgHaulerPrepView(cgState);
assert.equal(cgView.progress.completed, 2, 'Community Goal Hauler Prep credited a skipped task');
assert.equal(cgView.current?.id, 'cg-hauler.survivability-pass', 'Community Goal Hauler Prep did not continue to untouched pending work before revisiting skipped work');
assert.match(cgView.doctrine, /survive and deliver/i, 'Community Goal Hauler Prep lost its logistics-first win condition');
console.log('✓ Community Goal Hauler Prep specialty progression is structurally sound');

// The assistant should only receive personalized Pathway data when the member's
// question actually refers to their assignment/progress. Exercise the selector
// and a small in-memory PROJECTS binding so this bridge is covered by CI.
assert.equal(assistantPathwayIntent('How do I do my current task?'), true, 'assistant missed Pathway intent');
assert.equal(assistantPathwayIntent('What is my jump range campaign step?'), true, 'assistant missed Jump Range campaign intent');
assert.equal(assistantPathwayIntent('What is my mobility campaign step?'), true, 'assistant missed Mobility campaign intent');
assert.equal(assistantPathwayIntent('What is my power distributor campaign step?'), true, 'assistant missed Power Distributor campaign intent');
assert.equal(assistantPathwayIntent('What is my power and heat campaign step?'), true, 'assistant missed Power and Heat campaign intent');
assert.equal(assistantPathwayIntent('What is my CG hauler prep task?'), true, 'assistant missed CG Hauler Prep intent');
assert.equal(assistantPathwayIntent('Does my current trade task help engineering?'), true, 'assistant missed cross-path Engineering prep intent');
assert.equal(assistantPathwayIntent('Where is the carrier registry?'), false, 'assistant Pathway intent is too broad');
const kvRecords = new Map([
  ['pathway-preferences-v1:smoke-user', {
    interests:['engineering'],
    improve:['engineering'],
    experience:{ engineering:'comfortable' },
    playStyle:'either',
    currentGoal:'Improve the test ship shields.',
  }],
  ['engineering-campaign-v1:smoke-user', state],
]);
const mockProjects = {
  async get(key) { return kvRecords.get(key) ?? null; },
};
const assistantPathway = await buildAssistantPathwayContext(
  { PROJECTS:mockProjects },
  { sub:'smoke-user', access:'member', displayName:'Smoke Commander' },
  'What is my current engineering step?',
);
assert.ok(assistantPathway, 'assistant did not build personalized Pathway context');
assert.equal(assistantPathway.assignments.length, 1, 'assistant did not return the selected Engineering assignment');
assert.equal(assistantPathway.assignments[0].activity, 'engineering', 'assistant returned the wrong Pathway activity');
assert.equal(assistantPathway.engineeringCampaign?.active, true, 'assistant missed the active Engineering campaign');
assert.ok(assistantPathway.engineeringCampaign?.nextStep?.title, 'assistant Engineering campaign context has no next step');

const distributorKvRecords = new Map([
  ['pathway-preferences-v1:distributor-smoke-user', {
    interests:['engineering'],
    improve:['engineering'],
    experience:{ engineering:'comfortable' },
    playStyle:'either',
    currentGoal:'Improve distributor sustain.',
  }],
  ['engineering-campaign-v1:distributor-smoke-user', distributorState],
]);
const distributorAssistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return distributorKvRecords.get(key) ?? null; } } },
  { sub:'distributor-smoke-user', access:'member', displayName:'Distributor Smoke Commander' },
  'What is my power distributor campaign step?',
);
assert.equal(distributorAssistant?.engineeringCampaign?.goal, 'Improve Power Distributor', 'assistant missed the Power Distributor campaign goal');
assert.ok(distributorAssistant?.engineeringCampaign?.nextStep?.title, 'assistant Power Distributor context has no next step');

const powerThermalKvRecords = new Map([
  ['pathway-preferences-v1:power-thermal-smoke-user', {
    interests:['engineering'],
    improve:['engineering'],
    experience:{ engineering:'comfortable' },
    playStyle:'either',
    currentGoal:'Fix a power and heat problem.',
  }],
  ['engineering-campaign-v1:power-thermal-smoke-user', powerThermalState],
]);
const powerThermalAssistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return powerThermalKvRecords.get(key) ?? null; } } },
  { sub:'power-thermal-smoke-user', access:'member', displayName:'Thermal Smoke Commander' },
  'What is my power and heat campaign step?',
);
assert.equal(powerThermalAssistant?.engineeringCampaign?.goal, 'Improve Power & Heat', 'assistant missed the Power & Heat campaign goal');
assert.ok(powerThermalAssistant?.engineeringCampaign?.nextStep?.title, 'assistant Power & Heat context has no next step');

const prepKvRecords = new Map([
  ['pathway-preferences-v1:prep-smoke-user', {
    interests:['trade'],
    improve:['trade'],
    experience:{ trade:'new' },
    playStyle:'either',
    currentGoal:'Learn Trade while preparing future Engineers.',
  }],
  ['pathway-progress-v1:prep-smoke-user:trade', {
    ownerId:'prep-smoke-user',
    selectedRoute:'trade-foundations',
    routes:{
      'trade-foundations':{
        taskStates:{ 'trade-foundations-build-v2':'complete' },
        startedAt:'2026-09-16T12:40:00.000Z',
        updatedAt:'2026-09-16T12:40:00.000Z',
      },
    },
  }],
]);
const prepAssistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return prepKvRecords.get(key) ?? null; } } },
  { sub:'prep-smoke-user', access:'member', displayName:'Prep Smoke Commander' },
  'Does my current trade task help engineering?',
);
assert.equal(prepAssistant?.assignments?.[0]?.currentTask?.id, 'trade-foundations-cheap-haul-v2', 'assistant did not resolve the expected Trade task for cross-path prep');
assert.equal(prepAssistant.assignments[0].currentTask.engineeringPrep?.[0]?.factId, 'trade.markets-visited-distinct', 'assistant missed the current Trade task Engineering prep opportunity');

const cgKvRecords = new Map([
  ['pathway-preferences-v1:cg-smoke-user', {
    interests:['trade'],
    improve:['trade'],
    experience:{ trade:'some' },
    playStyle:'group',
    currentGoal:'Prepare for hostile Community Goal hauling.',
  }],
  ['specialty-cg-hauler-v1:cg-smoke-user', cgState],
]);
const cgAssistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return cgKvRecords.get(key) ?? null; } } },
  { sub:'cg-smoke-user', access:'member', displayName:'CG Smoke Commander' },
  'What is my CG hauler prep task?',
);
assert.ok(cgAssistant?.specialties?.communityGoalHaulerPrep, 'assistant missed Community Goal Hauler Prep specialty context');
assert.equal(cgAssistant.specialties.communityGoalHaulerPrep.currentTask?.id, 'cg-hauler.survivability-pass', 'assistant returned the wrong CG Hauler Prep current task');
console.log('✓ Ask the Mongrels can read Pathway, campaign, specialty, and cross-path prep context');

// Import the critical Cloudflare Pages Function modules. This catches syntax and
// broken-import failures before Cloudflare sees the commit.
const apiModules = [
  '../functions/api/pathway/preferences.js',
  '../functions/api/pathway/assignments.js',
  '../functions/api/pathway/engineering-campaign.js',
  '../functions/api/pathway/cg-hauler-prep.js',
  '../functions/api/assistant/index.js',
];
for (const path of apiModules) {
  const module = await import(path);
  assert.equal(typeof module.onRequestGet, 'function', `${path} is missing onRequestGet`);
  assert.equal(typeof module.onRequestPost, 'function', `${path} is missing onRequestPost`);
}
console.log('✓ critical API modules import cleanly');

// Guard the shared response helpers that were accidentally removed once and
// caused every full-route assignment request to fail.
for (const path of [
  'functions/api/pathway/preferences.js',
  'functions/api/pathway/assignments.js',
  'functions/api/pathway/engineering-campaign.js',
  'functions/api/pathway/cg-hauler-prep.js',
  'functions/api/assistant/index.js',
]) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, /function\s+headers\s*\(/, `${path} is missing headers()`);
  assert.match(source, /function\s+reply\s*\(/, `${path} is missing reply()`);
}
console.log('✓ critical API response helpers are present');

// Verify a few high-value entry pages and Pathway assets are still present and
// wired. These are intentionally shallow smoke checks, not browser tests.
for (const path of [
  'index.html',
  'start/index.html',
  'pathway/index.html',
  'member/index.html',
  'operations/index.html',
  'carriers/index.html',
  'lib/engineering-campaign-jump-range.js',
  'lib/engineering-campaign-mobility.js',
  'lib/engineering-campaign-distributor.js',
  'lib/engineering-campaign-power-thermal.js',
  'lib/pathway-engineering-prep.js',
  'lib/pathway-engineering-prep-facts.js',
  'lib/pathway-cg-hauler-prep.js',
  'js/engineering-campaign-planner.js',
  'js/engineering-prep-tracker.js',
  'js/pathway-engineering-prep.js',
  'js/cg-hauler-prep.js',
  'css/engineering-campaign-planner.css',
  'css/cg-hauler-prep.css',
]) {
  assert.ok(existsSync(path), `critical site file is missing: ${path}`);
}
const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-engineering-campaign-planner/, 'My Pathway is missing the Engineering Campaign Planner mount');
assert.match(pathwayHtml, /engineering-campaign-planner\.js/, 'My Pathway is not loading the Campaign Planner script');
assert.match(pathwayHtml, /engineering-prep-tracker\.js/, 'My Pathway is not loading the Engineering Prep Tracker script');
assert.match(pathwayHtml, /pathway-engineering-prep\.js/, 'My Pathway is not loading the cross-path Engineering Prep helper');
assert.match(pathwayHtml, /data-cg-hauler-prep/, 'My Pathway is missing the Community Goal Hauler Prep mount');
assert.match(pathwayHtml, /cg-hauler-prep\.js/, 'My Pathway is not loading the Community Goal Hauler Prep script');
assert.match(pathwayHtml, /cg-hauler-prep\.css/, 'My Pathway is not loading the Community Goal Hauler Prep stylesheet');
const plannerSource = readFileSync('js/engineering-campaign-planner.js', 'utf8');
assert.match(plannerSource, /jump-range/, 'Campaign Planner is not exposing Improve Jump Range');
assert.match(plannerSource, /mobility/, 'Campaign Planner is not exposing Improve Speed & Mobility');
assert.match(plannerSource, /distributor/, 'Campaign Planner is not exposing Improve Power Distributor');
assert.match(plannerSource, /power-thermal/, 'Campaign Planner is not exposing Improve Power & Heat');
const tradeSource = readFileSync('js/pathway-trade.js', 'utf8');
const miningSource = readFileSync('js/pathway-mining.js', 'utf8');
assert.match(tradeSource, /MongrelEngineeringPrep/, 'Trade Pathway is not rendering cross-path Engineering prep');
assert.match(miningSource, /MongrelEngineeringPrep/, 'Mining Pathway is not rendering cross-path Engineering prep');
console.log('✓ critical pages, Engineering assets, CG Hauler specialty, and cross-path prep are wired');

console.log('\nAll Mongrels site smoke checks passed.');