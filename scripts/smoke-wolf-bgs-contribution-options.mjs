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
  /INFLUENCE \/ BOUNTIES/,
  /OPTIONAL/,
  /RECOMMENDED/,
  /data-wolf-contribution-options/,
]) assert.match(source,pattern);

assert.doesNotMatch(source,/INFLUENCE \/ MINING MISSIONS/,'Mining mission options should not clutter the generated contribution list');
assert.doesNotMatch(source,/Direct sale of mined commodities is not counted here/,'Removed mining guidance should not remain in generated contribution options');
assert.doesNotMatch(source,/sell mined commodities.*BGS influence/i,'Direct mined-commodity sales must not be presented as BGS influence work');

const page=readFileSync('wolf-bgs/index.html','utf8');
assert.match(page,/wolf-bgs-contribution-options\.js\?v=2/,'Wolf BGS page must load the current contribution variety layer directly');
assert.match(page,/wolf-bgs-lab\.js\?v=2/,'Lab cache version should remain current');
assert.ok(page.indexOf('wolf-bgs-conflicts.js') < page.indexOf('wolf-bgs-contribution-options.js'),'Contribution options must load after conflict logic');
assert.ok(page.indexOf('wolf-bgs-contribution-options.js') < page.indexOf('wolf-bgs-lab.js'),'Contribution options must load before lab interception');

const lab=readFileSync('js/wolf-bgs-lab.js','utf8');
assert.match(lab,/data-wolf-contribution-options|wolfContributionOptions/,'Contribution layer loader marker is missing');

console.log('✓ Wolf BGS contribution variety, control-push escalation, optional exploration/bounty choices, and mining-option removal are structurally sound');