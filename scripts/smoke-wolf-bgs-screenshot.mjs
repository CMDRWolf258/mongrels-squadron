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
assert.match(client, /MAX_IMAGES = 3/, 'Screenshot set maximum is missing');
assert.match(client, /multiple hidden/, 'Multi-file picker support is missing');
assert.match(client, /Each Ctrl\+V or drop adds to the current set/, 'Clipboard-first accumulation guidance is missing');
assert.match(client, /addFiles\(card, images\)/, 'Repeated clipboard pastes do not accumulate into the set');
assert.match(client, /Interpret Screenshot Set/, 'Explicit screenshot-set interpretation action is missing');
assert.match(client, /data-screenshot-remove/, 'Individual screenshot removal is missing');
assert.match(client, /Apply Matched Influence to Form/, 'Review-first Apply action is missing');
assert.match(client, /readyToApply/, 'Completeness gate is missing from the importer');
assert.match(client, /does not submit or save the snapshot/i, 'Importer must clearly state that applying does not save BGS data');
assert.match(client, /matchedKnownFaction/, 'Importer is not limiting automatic application to matched known factions');
assert.doesNotMatch(client, /submit-status/, 'Screenshot importer must not directly submit BGS status');

const api = readFileSync('functions/api/operations/wolf-bgs-screenshot.js', 'utf8');
assert.match(api, /session\.access !== 'site_admin'/, 'Screenshot interpretation API is not site-admin restricted');
assert.match(api, /X-Mongrels-Request/, 'Screenshot API lacks same-origin request validation');
assert.match(api, /MAX_IMAGE_BYTES = 8 \* 1024 \* 1024/, 'Per-screenshot size cap is missing');
assert.match(api, /MAX_IMAGES = 3/, 'Screenshot-set maximum is missing server-side');
assert.match(api, /getAll\('images'\)/, 'Server is not accepting screenshot sets');
assert.match(api, /imageDataUrls\.map/, 'All screenshots are not being sent to the vision model together');
assert.match(api, /observedInfluences/, 'Repeated-faction observation comparison is missing');
assert.match(api, /Conflicting repeated readings detected/, 'Repeated-faction disagreement warning is missing');
assert.match(api, /does not yet cover every known faction/, 'Known-board completeness validation is missing');
assert.match(api, /readyToApply/, 'Server-side apply-readiness gate is missing');
assert.match(api, /approximately 100%/, 'Influence-total validation warning is missing');
assert.match(api, /image\/png/, 'PNG screenshots are not accepted');
assert.match(api, /image\/jpeg/, 'JPEG screenshots are not accepted');
assert.match(api, /image\/webp/, 'WebP screenshots are not accepted');
assert.match(api, /type:'input_image'/, 'OpenAI vision image input is not wired');
assert.match(api, /matchedKnownFaction/, 'Known-faction matching is missing');
assert.match(api, /Do not estimate graphical Economy\/Security slider positions/, 'Phase-one importer must not pretend graphical slider positions are precise');

const module = await import('../functions/api/operations/wolf-bgs-screenshot.js');
assert.equal(typeof module.onRequestPost, 'function', 'Screenshot interpretation API POST handler did not import');

console.log('✓ Wolf BGS screenshot importer accepts clipboard-first image sets, merges overlapping faction rows, gates incomplete boards, and remains review-first');
