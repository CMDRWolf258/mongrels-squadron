import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('js/wolf-bgs-inheritance.js', 'utf8');
new Function(source);

for (const pattern of [
  /Control Room Health/,
  /data-health-status/,
  /data-health-warm/,
  /data-health-parked/,
  /data-health-previews/,
  /const MAX_WARM_CARDS = 2/,
  /let warmLru = \[\]/,
  /function touchWarm\(card\)/,
  /function enforceWarmLimit\(activeCard\)/,
  /function evictWarmCard\(card\)/,
  /wolf-bgs-body-lru-evicted/,
  /wolf-bgs-body-deferred/,
  /card\.open = false/,
  /Opening a third system automatically collapses and parks the least-recently-used warm card/,
  /Warm cards deliberately remain attached when manually collapsed/,
  /subtree:false/,
  /warmLimit: MAX_WARM_CARDS/,
  /version: 3/,
  /window\.WolfBgsHealth/,
]) assert.match(source, pattern);

assert.doesNotMatch(source, /observe\(list,\s*\{\s*childList:true,\s*subtree:true\s*\}\)/, 'Performance guard should not observe the full system-card subtree');
assert.doesNotMatch(source, /else parkCard\(card\)/, 'A normal manual collapse must not immediately detach a warm card');

const page = readFileSync('wolf-bgs/index.html', 'utf8');
assert.match(page, /wolf-bgs-inheritance\.js\?v=3/, 'Wolf BGS page must cache-bust the two-card health bootstrap');
assert.ok(page.indexOf('wolf-bgs-inheritance.js?v=3') < page.indexOf('wolf-bgs.js?v=3'), 'Warm-cache guard must load before the main system deck renderer');

console.log('✓ Wolf BGS Control Room keeps only the two most recently used live-system cards mounted');
