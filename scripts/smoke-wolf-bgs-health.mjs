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
  /wolf-bgs-body-parked/,
  /details\.wolf-system-card/,
  /card\.addEventListener\('toggle'/,
  /delete card\.dataset\.rulesEnhanced/,
  /wolf-bgs-lazy-mount/,
  /subtree:false/,
  /window\.WolfBgsHealth/,
]) assert.match(source, pattern);

assert.doesNotMatch(source, /observe\(list,\s*\{\s*childList:true,\s*subtree:true\s*\}\)/, 'Performance guard should not observe the full system-card subtree');

console.log('✓ Wolf BGS Control Room health panel and lazy collapsed-card parking are structurally sound');
