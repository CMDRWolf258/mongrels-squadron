import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  COLONIZATION_ROUTES,
  eligibleColonizationRoutes,
  getColonizationRoute,
} from '../lib/pathway-colonization.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

assert.equal(COLONIZATION_ROUTES.length, 5, 'Colonization should expose five development routes');
assert.equal(new Set(COLONIZATION_ROUTES.map(route => route.id)).size, 5, 'Colonization contains duplicate route IDs');
for (const route of COLONIZATION_ROUTES) {
  assert.ok(route.title, `${route.id} is missing a title`);
  assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${route.id} has no tasks`);
  assert.equal(new Set(route.tasks.map(task => task.id)).size, route.tasks.length, `${route.id} contains duplicate task IDs`);
  for (const task of route.tasks) {
    assert.ok(task.title, `${route.id}/${task.id} is missing a title`);
    assert.ok(task.objective, `${route.id}/${task.id} is missing an objective`);
  }
}
assert.deepEqual(eligibleColonizationRoutes('new'), ['colonization-foundations'], 'Beginner Colonization should start with Foundations only');
const foundations = getColonizationRoute('colonization-foundations');
assert.equal(foundations?.tasks?.[0]?.id, 'colonization-foundations-find', 'Beginner Colonization first assignment changed unexpectedly');
assert.match(foundations?.sourceNote || '', /Ownership is not required/i, 'Beginner Colonization lost the no-ownership gate guardrail');
assert.match(foundations?.tasks?.find(task => task.id === 'colonization-foundations-deliver')?.objective || '', /contribute|construction/i, 'Beginner Colonization lost the real construction-delivery loop');
assert.match(foundations?.tasks?.find(task => task.id === 'colonization-foundations-graduate')?.objective || '', /verify|contribution/i, 'Beginner Colonization graduation no longer verifies useful contribution');
const architect = getColonizationRoute('colonization-system-architect');
assert.match(architect?.tasks?.find(task => task.id === 'colonization-architect-claim')?.objective || '', /shadow|claim/i, 'System Architect route lost claim/shadow learning');
assert.match(architect?.tasks?.find(task => task.id === 'colonization-architect-primary')?.objective || '', /primary-port|primary port/i, 'System Architect route lost primary-port decision training');
console.log('✓ Colonization route catalog, beginner support loop, and ownership guardrails are structurally sound');

assert.equal(assistantPathwayIntent('What is my Colonization assignment?'), true, 'Assistant missed Colonization pathway intent');
const records = new Map([
  ['pathway-preferences-v1:colonization-smoke-user', {
    interests:['colonization'],
    improve:['colonization'],
    experience:{ colonization:'new' },
    playStyle:'either',
    currentGoal:'Become useful on squad colony projects.',
  }],
]);
const assistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return records.get(key) ?? null; } } },
  { sub:'colonization-smoke-user', access:'member', displayName:'Colonization Smoke Commander' },
  'What is my Colonization assignment?',
);
assert.equal(assistant?.assignments?.[0]?.activity, 'colonization', 'Assistant missed the Colonization full pathway');
assert.equal(assistant.assignments[0].route?.id, 'colonization-foundations', 'Assistant did not select Colonization Foundations for a beginner');
assert.equal(assistant.assignments[0].currentTask?.id, 'colonization-foundations-find', 'Assistant returned the wrong first Colonization assignment');
console.log('✓ Ask the Mongrels can read the Colonization full pathway');

for (const path of [
  'lib/pathway-colonization.js',
  'js/pathway-colonization.js',
  'pathway/index.html',
  'functions/api/pathway/assignments.js',
  'lib/assistant-pathway-context.js',
  'activities/index.html',
]) {
  assert.ok(existsSync(path), `Colonization critical file is missing: ${path}`);
}

const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-colonization-pathway/, 'My Pathway is missing the Colonization full-route mount');
assert.match(pathwayHtml, /pathway-colonization\.js/, 'My Pathway is not loading the Colonization pathway client');
const fullRoutesSource = readFileSync('js/pathway-full-routes.js', 'utf8');
assert.match(fullRoutesSource, /\['Colonization'/, 'Generic-card suppression is not aware of Colonization');
const assignmentsSource = readFileSync('functions/api/pathway/assignments.js', 'utf8');
assert.match(assignmentsSource, /pathway-colonization/, 'Shared assignment API is not importing Colonization');
assert.match(assignmentsSource, /seedVersion:'colonization-v1'/, 'Shared assignment API is missing the Colonization provider');
const activitiesHtml = readFileSync('activities/index.html', 'utf8');
assert.match(activitiesHtml, /Pathway Available[\s\S]{0,300}<h3>Colonization<\/h3>/, 'Activities hub does not mark Colonization as Pathway Available');
assert.match(activitiesHtml, /<h3>Colonization<\/h3>[\s\S]{0,900}Progress · My Pathway/, 'Activities hub Colonization card is missing the Progress · My Pathway link');
console.log('✓ Colonization provider, UI mount, public hub, client, Assistant context, and duplicate-card handling are wired');

console.log('\nAll Colonization smoke checks passed.');
