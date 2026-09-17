import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const path='js/wolf-bgs-contribution-options.js';
assert.ok(existsSync(path),'Contribution variety client is missing');
const source=readFileSync(path,'utf8');
new Function(source);

for(const pattern of [
  /controlObjective === 'prefer-control'/,
  /systemControlPolicy\(card\) === 'gain'/,
  /gap >= 3/,
  /gap >= 7/,
  /CONFLICT_RE\.test\(row\.state\)/,
  /INFLUENCE \/ TRADE/,
  /INFLUENCE \/ EXPLORATION/,
  /INFLUENCE \/ MINING MISSIONS/,
  /INFLUENCE \/ BOUNTIES/,
  /OPTIONAL/,
  /RECOMMENDED/,
  /mission-INF target, not extra INF/,
  /Direct sale of mined commodities is not counted here as BGS influence\/economy work/,
]) assert.match(source,pattern);

assert.doesNotMatch(source,/sell mined commodities.*BGS influence/i,'Direct mined-commodity sales must not be presented as BGS influence work');

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/wolf-bgs-contribution-options\.js\?v=1/,'Wolf BGS page must load the contribution variety layer directly');
assert.match(page,/wolf-bgs-lab\.js\?v=2/,'Lab cache version should be bumped after bootstrap changes');
assert.ok(page.indexOf('wolf-bgs-conflicts.js') < page.indexOf('wolf-bgs-contribution-options.js'),'Contribution options must load after conflict logic');
assert.ok(page.indexOf('wolf-bgs-contribution-options.js') < page.indexOf('wolf-bgs-lab.js'),'Contribution options must load before lab interception');

const lab=readFileSync('js/wolf-bgs-lab.js','utf8');
assert.match(lab,/wolf-bgs-contribution-options\.js\?v=1/,'Lab bootstrap fallback must also know the contribution layer URL');
assert.match(lab,/data-wolf-contribution-options|wolfContributionOptions/,'Contribution layer loader marker is missing');

console.log('✓ Wolf BGS contribution variety, control-push escalation, optional activity choices, and mining-mission safety are structurally sound');