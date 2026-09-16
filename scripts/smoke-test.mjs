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
import {
  SHIELD_CAMPAIGN_FACTS,
  buildShieldEngineeringDependencyNodes,
} from '../lib/engineering-campaign-shields.js';
import {
  buildJumpRangeEngineeringDependencyNodes,
} from '../lib/engineering-campaign-jump-range.js';
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

// The assistant should only receive personalized Pathway data when the member's
// question actually refers to their assignment/progress. Exercise the selector
// and a small in-memory PROJECTS binding so this bridge is covered by CI.
assert.equal(assistantPathwayIntent('How do I do my current task?'), true, 'assistant missed Pathway intent');
assert.equal(assistantPathwayIntent('What is my jump range campaign step?'), true, 'assistant missed Jump Range campaign intent');
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
console.log('✓ Ask the Mongrels can read concise current Pathway/campaign context');

// Import the critical Cloudflare Pages Function modules. This catches syntax and
// broken-import failures before Cloudflare sees the commit.
const apiModules = [
  '../functions/api/pathway/preferences.js',
  '../functions/api/pathway/assignments.js',
  '../functions/api/pathway/engineering-campaign.js',
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
  'js/engineering-campaign-planner.js',
  'js/engineering-prep-tracker.js',
  'css/engineering-campaign-planner.css',
]) {
  assert.ok(existsSync(path), `critical site file is missing: ${path}`);
}
const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-engineering-campaign-planner/, 'My Pathway is missing the Engineering Campaign Planner mount');
assert.match(pathwayHtml, /engineering-campaign-planner\.js/, 'My Pathway is not loading the Campaign Planner script');
assert.match(pathwayHtml, /engineering-prep-tracker\.js/, 'My Pathway is not loading the Engineering Prep Tracker script');
const plannerSource = readFileSync('js/engineering-campaign-planner.js', 'utf8');
assert.match(plannerSource, /jump-range/, 'Campaign Planner is not exposing Improve Jump Range');
console.log('✓ critical pages and Engineering Pathway assets are wired');

console.log('\nAll Mongrels site smoke checks passed.');
