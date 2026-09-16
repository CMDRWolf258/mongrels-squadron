import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  EXOBIOLOGY_ROUTES,
  eligibleExobiologyRoutes,
  getExobiologyRoute,
} from '../lib/pathway-exobiology.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

assert.equal(EXOBIOLOGY_ROUTES.length, 5, 'Exobiology should expose five development routes');
assert.equal(new Set(EXOBIOLOGY_ROUTES.map(route => route.id)).size, 5, 'Exobiology contains duplicate route IDs');
for (const route of EXOBIOLOGY_ROUTES) {
  assert.ok(route.title, `${route.id} is missing a title`);
  assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${route.id} has no tasks`);
  assert.equal(new Set(route.tasks.map(task => task.id)).size, route.tasks.length, `${route.id} contains duplicate task IDs`);
  for (const task of route.tasks) {
    assert.ok(task.title, `${route.id}/${task.id} is missing a title`);
    assert.ok(task.objective, `${route.id}/${task.id} is missing an objective`);
  }
}
assert.deepEqual(eligibleExobiologyRoutes('new'), ['exobiology-foundations'], 'Beginner Exobiology should start with Foundations only');
assert.equal(getExobiologyRoute('exobiology-foundations')?.tasks?.[0]?.id, 'exobiology-foundations-kit', 'Beginner Exobiology first assignment changed unexpectedly');
assert.match(getExobiologyRoute('exobiology-foundations')?.tasks?.find(task => task.id === 'exobiology-foundations-sample')?.objective || '', /three genetically distinct samples/i, 'Beginner Exobiology lost the three-sample genetic loop');
console.log('✓ Exobiology route catalog and beginner progression are structurally sound');

assert.equal(assistantPathwayIntent('What is my exobiology assignment?'), true, 'Assistant missed Exobiology pathway intent');
const records = new Map([
  ['pathway-preferences-v1:exobio-smoke-user', {
    interests:['exobiology'],
    improve:['exobiology'],
    experience:{ exobiology:'new' },
    playStyle:'either',
    currentGoal:'Learn to find, sample, and sell biological discoveries.',
  }],
]);
const assistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return records.get(key) ?? null; } } },
  { sub:'exobio-smoke-user', access:'member', displayName:'Exobio Smoke Commander' },
  'What is my exobiology assignment?',
);
assert.equal(assistant?.assignments?.[0]?.activity, 'exobiology', 'Assistant missed the Exobiology full pathway');
assert.equal(assistant.assignments[0].route?.id, 'exobiology-foundations', 'Assistant did not select Exobiology Foundations for a beginner');
assert.equal(assistant.assignments[0].currentTask?.id, 'exobiology-foundations-kit', 'Assistant returned the wrong first Exobiology assignment');
console.log('✓ Ask the Mongrels can read the Exobiology full pathway');

for (const path of [
  'lib/pathway-exobiology.js',
  'js/pathway-exobiology.js',
  'pathway/index.html',
  'functions/api/pathway/assignments.js',
  'lib/assistant-pathway-context.js',
]) {
  assert.ok(existsSync(path), `Exobiology critical file is missing: ${path}`);
}

const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-exobiology-pathway/, 'My Pathway is missing the Exobiology full-route mount');
assert.match(pathwayHtml, /pathway-exobiology\.js/, 'My Pathway is not loading the Exobiology pathway client');
const fullRoutesSource = readFileSync('js/pathway-full-routes.js', 'utf8');
assert.match(fullRoutesSource, /Exobiology/, 'Generic-card suppression is not aware of Exobiology');
const assignmentsSource = readFileSync('functions/api/pathway/assignments.js', 'utf8');
assert.match(assignmentsSource, /pathway-exobiology/, 'Shared assignment API is not importing Exobiology');
assert.match(assignmentsSource, /seedVersion:'exobiology-v1'/, 'Shared assignment API is missing the Exobiology provider');
console.log('✓ Exobiology provider, UI mount, client, and duplicate-card handling are wired');

console.log('\nAll Exobiology smoke checks passed.');
