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
assert.match(page, /data-system-defaults-form/, 'System Defaults form is missing');
assert.match(page, /data-page-size/, 'Results-per-page selector is missing');
assert.match(page, /<option value="20" selected>20<\/option>/, 'Results-per-page default should be 20');
assert.match(page, /Influence high → low/, 'Influence high-to-low sort is missing');
assert.match(page, /Influence low → high/, 'Influence low-to-high sort is missing');
assert.match(page, /Custom filter…/, 'Custom filter view is missing');
assert.match(page, /data-custom-priority/, 'Custom Priority filter is missing');
assert.match(page, /data-custom-state/, 'Custom State filter is missing');
assert.match(page, /data-custom-pending/, 'Custom Pending filter is missing');
assert.match(page, /External Source Data/, 'External source panel is not clearly labeled');
assert.match(page, /js\/wolf-bgs\.js/, 'Control Room client is not loaded');
assert.match(page, /css\/wolf-bgs\.css/, 'Control Room stylesheet is not loaded');

const client = readFileSync('js/wolf-bgs.js', 'utf8');
assert.match(client, /submit-status/, 'Manual status submission is not wired');
assert.match(client, /save-system/, 'Per-system settings save is not wired');
assert.match(client, /save-global/, 'Global defaults save is not wired');
assert.match(client, /save-system-defaults/, 'System Defaults save is not wired');
assert.match(client, /toggle-favorite/, 'Favorite toggle is not wired');
assert.match(client, /data-favorite-toggle/, 'Favorite star control is missing');
assert.match(client, /settings\?\.priority/, 'Collapsed/header Priority is not using the unified priority field');
assert.match(client, /Programmed Automation/, 'Programmed automation explanation area is missing');
assert.match(client, /Advanced Intelligence Suggestion/, 'Advisory intelligence area is missing');
assert.match(client, /data-faction-row/, 'Editable faction-board rows are missing');

const apiSource = readFileSync('functions/api/operations/wolf-bgs.js', 'utf8');
assert.match(apiSource, /session\.access !== 'site_admin'/, 'Wolf BGS API is not site-admin restricted');
assert.match(apiSource, /wolf-bgs-control-v1/, 'Wolf BGS private KV key is missing');
assert.match(apiSource, /X-Mongrels-Request/, 'Wolf BGS write requests lack same-origin request marker validation');
assert.match(apiSource, /manualSnapshots/, 'Manual system snapshots are not persisted');
assert.match(apiSource, /systemSettings/, 'Per-system automation settings are not persisted');
assert.match(apiSource, /systemDefaults/, 'System-wide defaults are not persisted');
assert.match(apiSource, /controlPolicy: 'maintain-existing'/, 'Default control policy should preserve existing control state');
assert.match(apiSource, /defaultTick: '19:00'/, 'Prototype default tick should begin at 19:00 Central/local UI time');
assert.match(apiSource, /maxDailySystems: 6/, 'Daily Orders system-cap default should begin at six');

const css = readFileSync('css/wolf-bgs.css', 'utf8');
assert.match(css, /@media\(max-width:1280px\)/, 'Wolf Control is missing tablet/iPad responsive handling');
assert.match(css, /\.wolf-form-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/, 'Global form should reflow to two columns at tablet width');

const module = await import('../functions/api/operations/wolf-bgs.js');
assert.equal(typeof module.onRequestGet, 'function', 'Wolf BGS API GET handler did not import');
assert.equal(typeof module.onRequestPut, 'function', 'Wolf BGS API PUT handler did not import');

console.log('✓ Wolf BGS Control page, pagination, favorites, filters, System Defaults, private API, faction board, and responsive shell are structurally sound');
