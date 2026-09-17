import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

for (const path of [
  'wolf-bgs/index.html',
  'js/wolf-bgs.js',
  'js/wolf-bgs-screenshot.js',
  'css/wolf-bgs-screenshot.css',
  'functions/api/operations/wolf-bgs-screenshot.js',
]) {
  assert.ok(existsSync(path), `Screenshot-import critical file is missing: ${path}`);
}

const page = readFileSync('wolf-bgs/index.html', 'utf8');
assert.match(page, /wolf-bgs-screenshot\.css/, 'Screenshot importer stylesheet is not loaded');
assert.match(page, /wolf-bgs-screenshot\.js/, 'Screenshot importer client is not loaded');

const baseClient = readFileSync('js/wolf-bgs.js', 'utf8');
assert.match(baseClient, /data-submit-status/, 'Existing Submit Status workflow is missing');
assert.match(baseClient, /submit-status/, 'Submit Status is not wired to the authoritative manual-snapshot API');

const client = readFileSync('js/wolf-bgs-screenshot.js', 'utf8');
assert.match(client, /Screenshot Import/, 'Screenshot Import panel is missing');
assert.match(client, /Drop screenshot here/, 'Screenshot drag-and-drop control is missing');
assert.match(client, /paste/, 'Screenshot paste support is missing');
assert.match(client, /Interpret Screenshot/, 'Explicit screenshot interpretation action is missing');
assert.match(client, /Apply Matched Influence to Form/, 'Review-first Apply action is missing');
assert.match(client, /does not submit or save the snapshot/i, 'Importer must clearly state that applying does not save BGS data');
assert.match(client, /matchedKnownFaction/, 'Importer is not limiting automatic application to matched known factions');
assert.doesNotMatch(client, /submit-status/, 'Screenshot importer must not directly submit BGS status');

const api = readFileSync('functions/api/operations/wolf-bgs-screenshot.js', 'utf8');
assert.match(api, /session\.access !== 'site_admin'/, 'Screenshot interpretation API is not site-admin restricted');
assert.match(api, /X-Mongrels-Request/, 'Screenshot API lacks same-origin request validation');
assert.match(api, /MAX_IMAGE_BYTES = 8 \* 1024 \* 1024/, 'Screenshot size cap is missing');
assert.match(api, /image\/png/, 'PNG screenshots are not accepted');
assert.match(api, /image\/jpeg/, 'JPEG screenshots are not accepted');
assert.match(api, /image\/webp/, 'WebP screenshots are not accepted');
assert.match(api, /type:'input_image'/, 'OpenAI vision image input is not wired');
assert.match(api, /screenType/, 'Screenshot classification is missing');
assert.match(api, /confidence/, 'Per-row extraction confidence is missing');
assert.match(api, /approximately 100%/, 'Influence-total validation warning is missing');
assert.match(api, /matchedKnownFaction/, 'Known-faction matching is missing');
assert.match(api, /Do not estimate graphical Economy\/Security slider positions/, 'Phase-one importer must not pretend graphical slider positions are precise');

const module = await import('../functions/api/operations/wolf-bgs-screenshot.js');
assert.equal(typeof module.onRequestPost, 'function', 'Screenshot interpretation API POST handler did not import');

console.log('✓ Wolf BGS screenshot importer is review-first, site-admin restricted, confidence-aware, influence-validated, and structurally wired');
