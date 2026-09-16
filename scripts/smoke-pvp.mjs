import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  PVP_ROUTES,
  eligiblePvpRoutes,
  getPvpRoute,
} from '../lib/pathway-pvp.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

assert.equal(PVP_ROUTES.length, 5, 'PvP should expose five development routes');
assert.equal(new Set(PVP_ROUTES.map(route => route.id)).size, 5, 'PvP contains duplicate route IDs');
for (const route of PVP_ROUTES) {
  assert.ok(route.title, `${route.id} is missing a title`);
  assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${route.id} has no tasks`);
  assert.equal(new Set(route.tasks.map(task => task.id)).size, route.tasks.length, `${route.id} contains duplicate task IDs`);
  for (const task of route.tasks) {
    assert.ok(task.title, `${route.id}/${task.id} is missing a title`);
    assert.ok(task.objective, `${route.id}/${task.id} is missing an objective`);
  }
}
assert.deepEqual(eligiblePvpRoutes('new'), ['pvp-foundations'], 'Beginner PvP should start with PvP Foundations only');
assert.equal(getPvpRoute('pvp-foundations')?.tasks?.[0]?.id, 'pvp-foundations-rules', 'Beginner PvP first assignment changed unexpectedly');
assert.match(getPvpRoute('pvp-foundations')?.tasks?.find(task => task.id === 'pvp-foundations-rules')?.objective || '', /Open Play/i, 'Beginner PvP lost Open Play doctrine');
assert.match(getPvpRoute('pvp-foundations')?.tasks?.find(task => task.id === 'pvp-foundations-escape')?.objective || '', /normal game mechanics/i, 'Beginner PvP lost legitimate escape training');
assert.match(getPvpRoute('pvp-foundations')?.tasks?.find(task => task.id === 'pvp-foundations-graduate')?.objective || '', /1v1|hostile-contact/i, 'Beginner PvP graduation lost its controlled-fight capstone');
console.log('✓ PvP route catalog and beginner conduct/survival guardrails are structurally sound');

assert.equal(assistantPathwayIntent('What is my PvP assignment?'), true, 'Assistant missed PvP pathway intent');
const records = new Map([
  ['pathway-preferences-v1:pvp-smoke-user', {
    interests:['pvp'],
    improve:['pvp'],
    experience:{ pvp:'new' },
    playStyle:'group',
    currentGoal:'Become comfortable fighting other Commanders in Open.',
  }],
]);
const assistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return records.get(key) ?? null; } } },
  { sub:'pvp-smoke-user', access:'member', displayName:'PvP Smoke Commander' },
  'What is my PvP assignment?',
);
assert.equal(assistant?.assignments?.[0]?.activity, 'pvp', 'Assistant missed the PvP full pathway');
assert.equal(assistant.assignments[0].route?.id, 'pvp-foundations', 'Assistant did not select PvP Foundations for a beginner');
assert.equal(assistant.assignments[0].currentTask?.id, 'pvp-foundations-rules', 'Assistant returned the wrong first PvP assignment');
console.log('✓ Ask the Mongrels can read the PvP full pathway');

for (const path of [
  'lib/pathway-pvp.js',
  'js/pathway-pvp.js',
  'pathway/index.html',
  'functions/api/pathway/assignments.js',
  'lib/assistant-pathway-context.js',
]) {
  assert.ok(existsSync(path), `PvP critical file is missing: ${path}`);
}

const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-pvp-pathway/, 'My Pathway is missing the PvP full-route mount');
assert.match(pathwayHtml, /pathway-pvp\.js/, 'My Pathway is not loading the PvP pathway client');
const fullRoutesSource = readFileSync('js/pathway-full-routes.js', 'utf8');
assert.match(fullRoutesSource, /\['PvP'/, 'Generic-card suppression is not aware of PvP');
const assignmentsSource = readFileSync('functions/api/pathway/assignments.js', 'utf8');
assert.match(assignmentsSource, /pathway-pvp/, 'Shared assignment API is not importing PvP');
assert.match(assignmentsSource, /seedVersion:'pvp-v1'/, 'Shared assignment API is missing the PvP provider');
console.log('✓ PvP provider, UI mount, client, Assistant context, and duplicate-card handling are wired');

console.log('\nAll PvP smoke checks passed.');
