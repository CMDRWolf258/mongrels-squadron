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
  /INFLUENCE \/ TRADE/,
  /INFLUENCE \/ EXPLORATION/,
  /INFLUENCE \/ MINING MISSIONS/,
  /INFLUENCE \/ BOUNTIES/,
  /OPTIONAL/,
  /RECOMMENDED/,
  /mission-INF target, not extra INF/,
  /Direct sale of mined commodities is not counted here as BGS influence\/economy work/,
  /wolf-conflict-preview-banner/,
]) assert.match(source,pattern);

assert.doesNotMatch(source,/sell mined commodities.*BGS influence/i,'Direct mined-commodity sales must not be presented as BGS influence work');

const lab=readFileSync('js/wolf-bgs-lab.js','utf8');
assert.match(lab,/wolf-bgs-contribution-options\.js\?v=1/,'Wolf BGS lab bootstrap must load the contribution variety layer');
assert.match(lab,/data-wolf-contribution-options|wolfContributionOptions/,'Contribution layer loader marker is missing');

console.log('✓ Wolf BGS contribution variety, control-push escalation, optional activity choices, and mining-mission safety are structurally sound');
