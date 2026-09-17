import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const path of [
  'wolf-bgs/index.html',
  'css/wolf-bgs.css',
  'js/wolf-bgs.js',
  'functions/api/operations/wolf-bgs.js',
  'scripts/enrich_bgs_boards.py',
  'data/live-bgs-boards.json',
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
assert.match(page, /<option value="influence-desc" selected>Influence high → low<\/option>/, 'Influence high-to-low should be the default sort');
assert.match(page, /Influence low → high/, 'Influence low-to-high sort is missing');
assert.match(page, /Custom filter…/, 'Custom filter view is missing');
assert.match(page, /data-custom-priority/, 'Custom Priority filter is missing');
assert.match(page, /data-custom-state/, 'Custom State filter is missing');
assert.match(page, /data-custom-pending/, 'Custom Pending filter is missing');
assert.match(page, /data-favorites-first/, 'Favorites-first watch checkbox is missing');
assert.match(page, /data-lowest-five-watch/, 'Lowest-five watch checkbox is missing');
assert.match(page, /External Source Data/, 'External source panel is not clearly labeled');
assert.match(page, /wolf-time-input/, 'Tablet-safe time-input class is missing');
assert.match(page, /js\/wolf-bgs\.js/, 'Control Room client is not loaded');
assert.match(page, /css\/wolf-bgs\.css/, 'Control Room stylesheet is not loaded');

const client = readFileSync('js/wolf-bgs.js', 'utf8');
assert.match(client, /submit-status/, 'Manual status submission is not wired');
assert.match(client, /save-system/, 'Per-system settings save is not wired');
assert.match(client, /save-global/, 'Global defaults save is not wired');
assert.match(client, /save-system-defaults/, 'System Defaults save is not wired');
assert.match(client, /toggle-favorite/, 'Favorite toggle is not wired');
assert.match(client, /data-favorite-toggle/, 'Favorite star control is missing');
assert.match(client, /favoritesFirst/, 'Favorites-first list behavior is not wired');
assert.match(client, /lowestFiveSystems/, 'Lowest-five global watch logic is not wired');
assert.match(client, /low-watch/, 'Lowest-five visual marker is missing');
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
assert.match(apiSource, /live-bgs-boards\.json/, 'Wolf BGS API is not consuming the full-board snapshot');
assert.match(apiSource, /externalBoardComplete/, 'Full-board completeness is not exposed to the client');
assert.match(apiSource, /controlPolicy: 'maintain-existing'/, 'Default control policy should preserve existing control state');
assert.match(apiSource, /defaultTick: '19:00'/, 'Prototype default tick should begin at 19:00 Central/local UI time');
assert.match(apiSource, /maxDailySystems: 6/, 'Daily Orders system-cap default should begin at six');

const boardUpdater = readFileSync('scripts/enrich_bgs_boards.py', 'utf8');
assert.match(boardUpdater, /factionStates/, 'Full-board updater does not query faction states');
assert.match(boardUpdater, /pendingStates/, 'Full-board updater does not retain pending states');
assert.match(boardUpdater, /recoveringStates/, 'Full-board updater does not retain recovering states');
assert.match(boardUpdater, /live-bgs-boards\.json/, 'Full-board updater is not writing the dedicated snapshot');

const css = readFileSync('css/wolf-bgs.css', 'utf8');
assert.match(css, /@media\(max-width:1280px\)/, 'Wolf Control is missing tablet/iPad responsive handling');
assert.match(css, /\.wolf-form-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/, 'Global form should reflow to two columns at tablet width');
assert.match(css, /\.wolf-time-input/, 'Time input does not have tablet clipping protection');
assert.match(css, /\.wolf-list-options/, 'Watch-option styling is missing');
assert.match(css, /\.wolf-system-card\.low-watch/, 'Lowest-five watch styling is missing');

const module = await import('../functions/api/operations/wolf-bgs.js');
assert.equal(typeof module.onRequestGet, 'function', 'Wolf BGS API GET handler did not import');
assert.equal(typeof module.onRequestPut, 'function', 'Wolf BGS API PUT handler did not import');

console.log('✓ Wolf BGS Control full-board ingestion hooks, watch modes, pagination, favorites, filters, System Defaults, private API, faction board, and responsive shell are structurally sound');
