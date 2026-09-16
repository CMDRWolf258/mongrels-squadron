import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  OPERATIONS_ROUTES,
  eligibleOperationsRoutes,
  getOperationsRoute,
} from '../lib/pathway-operations.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

assert.equal(OPERATIONS_ROUTES.length, 5, 'Operations should expose five development routes');
assert.equal(new Set(OPERATIONS_ROUTES.map(route => route.id)).size, 5, 'Operations contains duplicate route IDs');
for (const route of OPERATIONS_ROUTES) {
  assert.ok(route.title, `${route.id} is missing a title`);
  assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${route.id} has no tasks`);
  assert.equal(new Set(route.tasks.map(task => task.id)).size, route.tasks.length, `${route.id} contains duplicate task IDs`);
  for (const task of route.tasks) {
    assert.ok(task.title, `${route.id}/${task.id} is missing a title`);
    assert.ok(task.objective, `${route.id}/${task.id} is missing an objective`);
  }
}
assert.deepEqual(eligibleOperationsRoutes('new'), ['operations-foundations'], 'Beginner Operations should start with Operations Foundations only');
assert.equal(getOperationsRoute('operations-foundations')?.tasks?.[0]?.id, 'operations-foundations-loop', 'Beginner Operations first assignment changed unexpectedly');
assert.match(getOperationsRoute('operations-foundations')?.tasks?.find(task => task.id === 'operations-foundations-loop')?.objective || '', /Operation Runner|Runner/i, 'Beginner Operations lost Runner workflow training');
assert.match(getOperationsRoute('operations-foundations')?.tasks?.find(task => task.id === 'operations-foundations-loadout')?.objective || '', /ship and suit|ship.*suit/i, 'Beginner Operations lost mixed ship/on-foot preparation');
assert.match(getOperationsRoute('operations-foundations')?.tasks?.find(task => task.id === 'operations-foundations-transition')?.objective || '', /ship to foot|foot to ship|rescue to combat/i, 'Beginner Operations lost phase-transition training');
assert.match(getOperationsRoute('operations-foundations')?.tasks?.find(task => task.id === 'operations-foundations-extract')?.objective || '', /extraction|reward/i, 'Beginner Operations lost extraction/reward completion');
console.log('✓ Operations route catalog and mixed-phase beginner guardrails are structurally sound');

assert.equal(assistantPathwayIntent('What is my Operations assignment?'), true, 'Assistant missed Operations pathway intent');
assert.equal(assistantPathwayIntent('What should I do with the Operation Runner?'), true, 'Assistant missed Operation Runner intent');
const records = new Map([
  ['pathway-preferences-v1:operations-smoke-user', {
    interests:['surface'],
    improve:['surface'],
    experience:{ surface:'new' },
    playStyle:'group',
    currentGoal:'Learn Operations from the Runner through extraction.',
  }],
]);
const assistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return records.get(key) ?? null; } } },
  { sub:'operations-smoke-user', access:'member', displayName:'Operations Smoke Commander' },
  'What is my Operations assignment?',
);
assert.equal(assistant?.assignments?.[0]?.activity, 'surface', 'Assistant missed the Operations full pathway');
assert.equal(assistant.assignments[0].label, 'Operations', 'Assistant exposed the legacy Surface Operations label');
assert.equal(assistant.assignments[0].route?.id, 'operations-foundations', 'Assistant did not select Operations Foundations for a beginner');
assert.equal(assistant.assignments[0].currentTask?.id, 'operations-foundations-loop', 'Assistant returned the wrong first Operations assignment');
console.log('✓ Ask the Mongrels can read the Operations full pathway');

for (const path of [
  'lib/pathway-operations.js',
  'js/pathway-operations.js',
  'pathway/index.html',
  'functions/api/pathway/assignments.js',
  'functions/api/pathway/preferences.js',
  'lib/assistant-pathway-context.js',
  'activities/index.html',
]) {
  assert.ok(existsSync(path), `Operations critical file is missing: ${path}`);
}

const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-operations-pathway/, 'My Pathway is missing the Operations full-route mount');
assert.match(pathwayHtml, /pathway-operations\.js/, 'My Pathway is not loading the Operations pathway client');
const fullRoutesSource = readFileSync('js/pathway-full-routes.js', 'utf8');
assert.match(fullRoutesSource, /\['Operations'/, 'Generic-card suppression is not aware of Operations');
const assignmentsSource = readFileSync('functions/api/pathway/assignments.js', 'utf8');
assert.match(assignmentsSource, /pathway-operations/, 'Shared assignment API is not importing Operations');
assert.match(assignmentsSource, /seedVersion:'operations-v1'/, 'Shared assignment API is missing the Operations provider');
const preferencesSource = readFileSync('functions/api/pathway/preferences.js', 'utf8');
assert.match(preferencesSource, /id:'surface', label:'Operations'/, 'Pathway catalog does not expose the Operations name');
assert.doesNotMatch(preferencesSource, /Surface Operations/, 'Pathway catalog still exposes the legacy Surface Operations name');
const activitiesSource = readFileSync('activities/index.html', 'utf8');
assert.match(activitiesSource, /<h3>Operations<\/h3>/, 'Activities hub is missing the Operations card');
assert.match(activitiesSource, /Pathway Available/, 'Activities hub does not mark Operations pathway availability');
assert.doesNotMatch(activitiesSource, /Surface Operations/, 'Activities hub still exposes the legacy Surface Operations name');
console.log('✓ Operations provider, naming, UI mount, client, Assistant context, and duplicate-card handling are wired');

console.log('\nAll Operations smoke checks passed.');
