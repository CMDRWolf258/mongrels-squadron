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
