import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  PVE_ROUTES,
  eligiblePveRoutes,
  getPveRoute,
} from '../lib/pathway-pve.js';
import {
  assistantPathwayIntent,
  buildAssistantPathwayContext,
} from '../lib/assistant-pathway-context.js';

assert.equal(PVE_ROUTES.length, 5, 'PvE Combat should expose five development routes');
assert.equal(new Set(PVE_ROUTES.map(route => route.id)).size, 5, 'PvE Combat contains duplicate route IDs');
for (const route of PVE_ROUTES) {
  assert.ok(route.title, `${route.id} is missing a title`);
  assert.ok(Array.isArray(route.tasks) && route.tasks.length > 0, `${route.id} has no tasks`);
  assert.equal(new Set(route.tasks.map(task => task.id)).size, route.tasks.length, `${route.id} contains duplicate task IDs`);
  for (const task of route.tasks) {
    assert.ok(task.title, `${route.id}/${task.id} is missing a title`);
    assert.ok(task.objective, `${route.id}/${task.id} is missing an objective`);
  }
}
assert.deepEqual(eligiblePveRoutes('new'), ['pve-foundations'], 'Beginner PvE should start with Combat Foundations only');
assert.equal(getPveRoute('pve-foundations')?.tasks?.[0]?.id, 'pve-foundations-ship', 'Beginner PvE first assignment changed unexpectedly');
assert.match(getPveRoute('pve-foundations')?.tasks?.find(task => task.id === 'pve-foundations-legal-target')?.objective || '', /WANTED/i, 'Beginner PvE lost legal-target confirmation');
assert.match(getPveRoute('pve-foundations')?.tasks?.find(task => task.id === 'pve-foundations-graduate')?.objective || '', /at least three/i, 'Beginner PvE graduation lost its measurable bounty-session target');
assert.match(getPveRoute('pve-conflict-zone')?.tasks?.find(task => task.id === 'pve-cz-operations')?.link?.url || '', /daily-orders/, 'Conflict Zone squad-support step lost Daily Orders linkage');
console.log('✓ PvE Combat route catalog and beginner/CZ guardrails are structurally sound');

assert.equal(assistantPathwayIntent('What is my PvE Combat assignment?'), true, 'Assistant missed PvE Combat pathway intent');
const records = new Map([
  ['pathway-preferences-v1:pve-smoke-user', {
    interests:['pve'],
    improve:['pve'],
    experience:{ pve:'new' },
    playStyle:'either',
    currentGoal:'Learn safe bounty hunting and become useful in combat.',
  }],
]);
const assistant = await buildAssistantPathwayContext(
  { PROJECTS:{ async get(key) { return records.get(key) ?? null; } } },
  { sub:'pve-smoke-user', access:'member', displayName:'PvE Smoke Commander' },
  'What is my PvE Combat assignment?',
);
assert.equal(assistant?.assignments?.[0]?.activity, 'pve', 'Assistant missed the PvE Combat full pathway');
assert.equal(assistant.assignments[0].route?.id, 'pve-foundations', 'Assistant did not select Combat Foundations for a beginner');
assert.equal(assistant.assignments[0].currentTask?.id, 'pve-foundations-ship', 'Assistant returned the wrong first PvE assignment');
console.log('✓ Ask the Mongrels can read the PvE Combat full pathway');

for (const path of [
  'lib/pathway-pve.js',
  'js/pathway-pve.js',
  'pathway/index.html',
  'functions/api/pathway/assignments.js',
  'lib/assistant-pathway-context.js',
]) {
  assert.ok(existsSync(path), `PvE Combat critical file is missing: ${path}`);
}

const pathwayHtml = readFileSync('pathway/index.html', 'utf8');
assert.match(pathwayHtml, /data-pve-pathway/, 'My Pathway is missing the PvE Combat full-route mount');
assert.match(pathwayHtml, /pathway-pve\.js/, 'My Pathway is not loading the PvE Combat pathway client');
const fullRoutesSource = readFileSync('js/pathway-full-routes.js', 'utf8');
assert.match(fullRoutesSource, /PvE Combat/, 'Generic-card suppression is not aware of PvE Combat');
const assignmentsSource = readFileSync('functions/api/pathway/assignments.js', 'utf8');
assert.match(assignmentsSource, /pathway-pve/, 'Shared assignment API is not importing PvE Combat');
assert.match(assignmentsSource, /seedVersion:'pve-v1'/, 'Shared assignment API is missing the PvE Combat provider');
console.log('✓ PvE Combat provider, UI mount, client, and duplicate-card handling are wired');

console.log('\nAll PvE Combat smoke checks passed.');
