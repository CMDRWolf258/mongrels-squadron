import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('js/wolf-bgs-inheritance.js', 'utf8');
new Function(source);

for (const pattern of [
  /Control Room Health/,
  /data-health-status/,
  /data-health-parked/,
  /data-health-previews/,
  /parkedBodies = new WeakMap/,
  /wolf-bgs-body-deferred/,
  /details\.wolf-system-card/,
  /card\.addEventListener\('toggle'/,
  /card\.dataset\.healthHydrated = 'true'/,
  /card\.dataset\.healthHydrated === 'true'/,
  /delete card\.dataset\.rulesEnhanced/,
  /wolf-bgs-lazy-mount/,
  /Once a card has been opened, it remains mounted/,
  /subtree:false/,
  /version: 2/,
  /window\.WolfBgsHealth/,
]) assert.match(source, pattern);

assert.doesNotMatch(source, /observe\(list,\s*\{\s*childList:true,\s*subtree:true\s*\}\)/, 'Performance guard should not observe the full system-card subtree');
assert.doesNotMatch(source, /else parkCard\(card\)/, 'Closing a warmed card must not detach its body again');

const page = readFileSync('wolf-bgs/index.html', 'utf8');
assert.match(page, /wolf-bgs-inheritance\.js\?v=2/, 'Wolf BGS page must load the health bootstrap');
assert.ok(page.indexOf('wolf-bgs-inheritance.js?v=2') < page.indexOf('wolf-bgs.js?v=3'), 'Lazy card guard must load before the main system deck renderer');

console.log('✓ Wolf BGS Control Room defers cold cards and keeps opened cards mounted for a stable workflow');
