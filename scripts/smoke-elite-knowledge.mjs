import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = path => JSON.parse(readFileSync(path,'utf8'));

const bgs=readJson('data/elite-knowledge-bgs.json');
const missions=readJson('data/elite-knowledge-crime-missions.json');
const salvage=readJson('data/elite-knowledge-salvage-piracy.json');
const assistantContext=readFileSync('lib/assistant-context.js','utf8');

const byId=(data,id)=>data.entries.find(entry=>entry.id===id);

for(const id of [
  'bgs-war-odyssey-settlement-resolution',
  'bgs-war-draw-assets-remain',
  'bgs-war-missions-need-combat-for-war-state',
]){
  assert.ok(byId(bgs,id),id+' should exist in the BGS knowledge pack');
}

const settlement=byId(bgs,'bgs-war-odyssey-settlement-resolution');
assert.match(settlement.ruleOfThumb,/win a war/i);
assert.match(settlement.ruleOfThumb,/Odyssey settlements/i);
assert.ok(settlement.details.some(row=>/nobody fights/i.test(row)),'Settlement entry should explain untouched settlements');

const abandon=byId(missions,'missions-failure-abandonment');
assert.match(abandon.ruleOfThumb,/not the same BGS action/i);
assert.match(abandon.ruleOfThumb,/does not apply the negative faction-influence effect/i);
assert.ok(abandon.details.some(row=>/expire/i.test(row)),'Mission failure entry should explain expiry as a true failure');

const massacre=byId(missions,'missions-massacre-stacking');
assert.match(massacre.ruleOfThumb,/different issuing factions/i);
assert.ok(massacre.details.some(row=>/War\/Civil War/i.test(row)),'Massacre entry should distinguish war/CZ missions');

const missing=byId(salvage,'salvage-mission-target-missing');
assert.match(missing.ruleOfThumb,/genuinely be bugged/i);
for(const phrase of ['Nav Beacon','Supercruise','Navigation panel','FSS','relog']){
  assert.ok(JSON.stringify(missing).includes(phrase),phrase+' should be covered in salvage troubleshooting');
}

assert.ok(
  assistantContext.includes("'/data/elite-knowledge-bgs.json'"),
  'Ask the Mongrels must load the expert BGS knowledge pack',
);

console.log('✓ Elite knowledge edge cases are valid, routed, and internally consistent');
