import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const path of [
  'wolf-bgs/index.html',
  'css/wolf-bgs.css',
  'js/wolf-bgs.js',
  'functions/api/operations/wolf-bgs.js',
]) {
  assert.ok(existsSync(path), `Wolf BGS Control critical file is missing: ${path}`);
}

const page = readFileSync('wolf-bgs/index.html', 'utf8');
assert.match(page, /Wolf BGS Control/, 'Control Room title is missing');
assert.match(page, /data-global-form/, 'Global automation form is missing');
assert.match(page, /data-system-list/, 'System control deck mount is missing');
assert.match(page, /js\/wolf-bgs\.js/, 'Control Room client is not loaded');
assert.match(page, /css\/wolf-bgs\.css/, 'Control Room stylesheet is not loaded');

const client = readFileSync('js/wolf-bgs.js', 'utf8');
assert.match(client, /submit-status/, 'Manual status submission is not wired');
assert.match(client, /save-system/, 'Per-system settings save is not wired');
assert.match(client, /save-global/, 'Global defaults save is not wired');
assert.match(client, /Programmed Automation/, 'Programmed automation explanation area is missing');
assert.match(client, /Advanced Intelligence Suggestion/, 'Advisory intelligence area is missing');
assert.match(client, /data-faction-row/, 'Editable faction-board rows are missing');

const apiSource = readFileSync('functions/api/operations/wolf-bgs.js', 'utf8');
assert.match(apiSource, /session\.access !== 'site_admin'/, 'Wolf BGS API is not site-admin restricted');
assert.match(apiSource, /wolf-bgs-control-v1/, 'Wolf BGS private KV key is missing');
assert.match(apiSource, /X-Mongrels-Request/, 'Wolf BGS write requests lack same-origin request marker validation');
assert.match(apiSource, /manualSnapshots/, 'Manual system snapshots are not persisted');
assert.match(apiSource, /systemSettings/, 'Per-system automation settings are not persisted');
assert.match(apiSource, /defaultTick: '19:00'/, 'Prototype default tick should begin at 19:00 Central/local UI time');
assert.match(apiSource, /maxDailySystems: 6/, 'Daily Orders system-cap default should begin at six');

const module = await import('../functions/api/operations/wolf-bgs.js');
assert.equal(typeof module.onRequestGet, 'function', 'Wolf BGS API GET handler did not import');
assert.equal(typeof module.onRequestPut, 'function', 'Wolf BGS API PUT handler did not import');

console.log('✓ Wolf BGS Control page, client, private API, editable faction board, and automation-control shell are structurally sound');
