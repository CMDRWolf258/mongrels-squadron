import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  SQUADRON_COORDINATION_ACTIVITY_ID,
  SQUADRON_COORDINATION_ROUTES,
  eligibleSquadronCoordinationRoutes,
  getSquadronCoordinationRoute,
} from '../lib/pathway-squadron-coordination.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

assert.equal(SQUADRON_COORDINATION_ACTIVITY_ID, 'operations', 'Squadron Coordination must retain the legacy operations storage ID');
assert.equal(SQUADRON_COORDINATION_ROUTES.length, 5, 'Squadron Coordination should expose five development routes');
assert.equal(new Set(SQUADRON_COORDINATION_ROUTES.map(route => route.id)).size, 5, 'Squadron Coordination contains duplicate route IDs');
for (const route of SQUADRON_COORDINATION_ROUTES) {
  assert.ok(route.title, `${route.id} is missing a title`);
  assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${route.id} has no tasks`);
  assert.equal(new Set(route.tasks.map(task => task.id)).size, route.tasks.length, `${route.id} contains duplicate task IDs`);
  for (const task of route.tasks) {
    assert.ok(task.title, `${route.id}/${task.id} is missing a title`);
    assert.ok(task.objective, `${route.id}/${task.id} is missing an objective`);
  }
}
assert.deepEqual(eligibleSquadronCoordinationRoutes('new'), ['coordination-foundations'], 'Beginner Squadron Coordination should start with Foundations only');
const foundations = getSquadronCoordinationRoute('coordination-foundations');
assert.equal(foundations?.tasks?.[0]?.id, 'coordination-foundations-authority', 'Beginner Squadron Coordination first assignment changed unexpectedly');
assert.match(foundations?.sourceNote || '', /does not reteach/i, 'Coordination lost the no-duplicate-training guardrail');
assert.match(foundations?.sourceNote || '', /guided support|guided/i, 'Coordination lost guided-exposure behavior for members with few other selected Pathways');
assert.match(foundations?.tasks?.find(task => task.id === 'coordination-foundations-lane')?.objective || '', /capability|sample/i, 'Coordination lost capability-aware lane selection');
console.log('✓ Squadron Coordination route catalog and no-duplicate-training guardrails are structurally sound');

assert.equal(assistantPathwayIntent('What is my Squadron Coordination assignment?'), true, 'Assistant missed Squadron Coordination pathway intent');
const records = new Map([
  ['pathway-preferences-v1:coordination-smoke-user', {
    interests:['operations'],
    improve:['operations'],
    experience:{ operations:'new' },
    playStyle:'group',
    currentGoal:'Become useful in coordinated squad work.',
  }],
]);
const assistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return records.get(key) ?? null; } } },
  { sub:'coordination-smoke-user', access:'member', displayName:'Coordination Smoke Commander' },
  'What is my Squadron Coordination assignment?',
);
assert.equal(assistant?.assignments?.[0]?.activity, 'operations', 'Assistant missed the Squadron Coordination full pathway');
assert.equal(assistant?.assignments?.[0]?.label, 'Squadron Coordination', 'Assistant exposed the stale Squad Operations label');
assert.equal(assistant.assignments[0].route?.id, 'coordination-foundations', 'Assistant did not select Coordination Foundations for a beginner');
assert.equal(assistant.assignments[0].currentTask?.id, 'coordination-foundations-authority', 'Assistant returned the wrong first Squadron Coordination assignment');
console.log('✓ Ask the Mongrels can read Squadron Coordination under the legacy operations ID');

const dualRecords = new Map([
  ['pathway-preferences-v1:operations-name-smoke-user', {
    interests:['surface','operations'],
    improve:[],
    experience:{ surface:'new', operations:'new' },
    playStyle:'group',
    currentGoal:'Keep Operations and Squadron Coordination distinct.',
  }],
]);
const operationsAssistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return dualRecords.get(key) ?? null; } } },
  { sub:'operations-name-smoke-user', access:'member', displayName:'Operations Name Smoke Commander' },
  'What is my Operations assignment?',
);
assert.equal(operationsAssistant?.assignments?.length, 1, 'Plain Operations intent should resolve to one game-feature pathway');
assert.equal(operationsAssistant.assignments[0].activity, 'surface', 'Plain Operations was confused with Squadron Coordination');
assert.equal(operationsAssistant.assignments[0].label, 'Operations', 'Game-feature Operations display name changed unexpectedly');
console.log('✓ Operations still means the in-game Runner feature while Squadron Coordination remains distinct');

for (const path of [
  'lib/pathway-squadron-coordination.js',
  'js/pathway-squadron-coordination.js',
  'pathway/index.html',
  'functions/api/pathway/preferences.js',
  'functions/api/pathway/assignments.js',
  'lib/assistant-pathway-context.js',
  'js/pathway-full-routes.js',
]) {
  assert.ok(existsSync(path), `Squadron Coordination critical file is missing: ${path}`);
}

const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-squadron-coordination-pathway/, 'My Pathway is missing the Squadron Coordination full-route mount');
assert.match(pathwayHtml, /pathway-squadron-coordination\.js/, 'My Pathway is not loading the Squadron Coordination pathway client');
const fullRoutesSource = readFileSync('js/pathway-full-routes.js', 'utf8');
assert.match(fullRoutesSource, /\['Squadron Coordination'/, 'Generic-card suppression is not aware of Squadron Coordination');
assert.match(fullRoutesSource, /function fullRouteExists\(/, 'Generic-card suppression is still waiting for full routes to become visible');
assert.doesNotMatch(fullRoutesSource, /function fullRouteIsVisible\(/, 'Legacy card suppression still contains the visibility race that can leave duplicate cards behind');
const preferencesSource = readFileSync('functions/api/pathway/preferences.js', 'utf8');
assert.match(preferencesSource, /id:'operations', label:'Squadron Coordination'/, 'Preferences catalog is not exposing the new user-facing label');
const assignmentsSource = readFileSync('functions/api/pathway/assignments.js', 'utf8');
assert.match(assignmentsSource, /pathway-squadron-coordination/, 'Shared assignment API is not importing Squadron Coordination');
assert.match(assignmentsSource, /buildCoordinationCapabilityMap/, 'Shared assignment API is missing the cross-path Capability Map');
assert.match(assignmentsSource, /creditedTasks/, 'Capability Map is not reading credited progress from other Pathways');
const clientSource = readFileSync('js/pathway-squadron-coordination.js', 'utf8');
assert.match(clientSource, /activity:'operations'/, 'Squadron Coordination client is not preserving the legacy activity ID');
assert.match(clientSource, /Capability Map/, 'Squadron Coordination client is not rendering the Capability Map');
console.log('✓ Provider, selector, UI mount, Capability Map, Assistant context, naming compatibility, and duplicate-card suppression are wired');

console.log('\nAll Squadron Coordination smoke checks passed.');
