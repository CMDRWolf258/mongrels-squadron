import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data/resources.json', 'utf8'));
const resources = Array.isArray(data.resources) ? data.resources : [];
assert.equal(resources.length, 13, 'Mongrel Toolbox should currently contain 13 active resources');

const ids = new Set(resources.map(resource => resource.id));
assert.equal(ids.size, resources.length, 'Mongrel Toolbox contains duplicate resource IDs');
for (const resource of resources) {
  assert.ok(resource.id, 'Resource missing id');
  assert.ok(resource.name, `${resource.id} missing name`);
  assert.match(resource.url || '', /^https:\/\//, `${resource.id} missing HTTPS URL`);
  assert.ok(resource.type, `${resource.id} missing type`);
  assert.ok(Array.isArray(resource.activities) && resource.activities.length, `${resource.id} missing activities`);
  assert.ok(resource.summary, `${resource.id} missing summary`);
  assert.ok(resource.mongrelUse, `${resource.id} missing Mongrel use note`);
}

for (const id of ['eddiscovery','edcopilot','srvsurvey','raven-colonial','edmc','edsm','miners-tool','axi','canonn']) {
  assert.ok(ids.has(id), `Approved Toolbox addition is missing: ${id}`);
}
assert.ok(!resources.some(resource => /cmdrs toolbox/i.test(resource.name)), 'Retired CMDRs Toolbox should not be presented as an active recommendation');

const html = readFileSync('guides/resources/index.html', 'utf8');
assert.match(html, /Mongrel Toolbox/, 'Resources page is missing Mongrel Toolbox heading');
assert.match(html, /data-resource-search/, 'Resources page is missing search control');
assert.match(html, /data-resource-activity/, 'Resources page is missing activity filter');
assert.match(html, /data-resource-type/, 'Resources page is missing type filter');
assert.match(html, /resources\.js\?v=1/, 'Resources page is not loading the Toolbox client');
assert.match(html, /resources\.css\?v=1/, 'Resources page is not loading Toolbox styles');

const client = readFileSync('js/resources.js', 'utf8');
assert.match(client, /data\/resources\.json/, 'Toolbox client is not loading structured resource data');
assert.match(client, /Mongrel use/, 'Toolbox client lost the Mongrel use guidance block');

console.log('✓ Mongrel Toolbox data, approved resources, filters, and UI wiring are intact');

const site = readFileSync('js/site.js', 'utf8');
for (const pattern of [
  /Start Here/,
  /navGroup\('Activities'/,
  /navGroup\('Command'/,
  /navGroup\('Resources'/,
  /navGroup\('Community'/,
  /Join Us/,
  /Learn & Look Up/,
  /Build & Tools/,
  /Mongrel Toolbox/,
  /Combat Escort Network/,
]) assert.match(site, pattern);
assert.doesNotMatch(site, /External Resources/);
assert.doesNotMatch(site, /Build & Ask/);

const manual = readFileSync('guides/index.html', 'utf8');
for (const pattern of [
  /<h1>Mongrel Field Manual<\/h1>/,
  />LEARN</,
  />LOOK UP</,
  />TOOLS</,
  /Mongrel Toolbox/,
  /Discover → Progress → Learn/,
  /Browse Activities/,
  /Open My Pathway/,
]) assert.match(manual, pattern);
assert.doesNotMatch(manual, />Resources<\/a>/);

for (const path of [
  'guides/reference/index.html',
  'guides/glossary/index.html',
]) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, />Toolbox<\/a>/, `${path} should expose the Mongrel Toolbox sibling destination`);
}
for (const path of [
  'guides/reference/index.html',
  'guides/glossary/index.html',
  'guides/bgs/index.html',
  'guides/engineering/index.html',
  'guides/mining/index.html',
  'guides/operations/index.html',
]) {
  const source = readFileSync(path, 'utf8');
  assert.doesNotMatch(source, />Resources<\/a>/, `${path} should not present the Toolbox as another Resources destination`);
}

const activities = readFileSync('activities/index.html', 'utf8');
for (const pattern of [
  /Learn<\/strong> for the Field Manual/,
  /Progress<\/strong> for My Pathway/,
  /Do<\/strong> for live squad activity/,
  /Build<\/strong> for ships and loadouts/,
  /Progress · My Pathway/,
  /Learn · Mining Manual/,
  /Do · Mission Control/,
]) assert.match(activities, pattern);

const member = readFileSync('member/index.html', 'utf8');
assert.match(member, /<h3>Quick Links<\/h3>/);
assert.doesNotMatch(member, /<h3>Member Resources<\/h3>/);

const assistant = readFileSync('lib/assistant-context.js', 'utf8');
for (const pattern of [
  /id:'mongrel-toolbox'/,
  /label:'Mongrel Toolbox'/,
  /Resources → Build & Tools → Mongrel Toolbox/,
  /Resources → Learn & Look Up → Mongrel Field Manual/,
  /Command → Combat Escort Network/,
]) assert.match(assistant, pattern);

console.log('✓ learning architecture is consolidated without changing top-level navigation categories');
