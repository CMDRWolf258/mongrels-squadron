import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const html=readFileSync(new URL('../guides/ax/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/ax-guide.css',import.meta.url),'utf8');
const hub=readFileSync(new URL('../guides/index.html',import.meta.url),'utf8');

for (const id of ['survive','scouts','interceptors','cycle','hazards','weapons','flight','swarm','solo-wing','emergencies','progression','history','sources']) {
  assert.match(html,new RegExp('id="'+id+'"'),'guide section missing: '+id);
  if(id!=='sources')assert.match(html,new RegExp('href="#'+id+'"'),'toc link missing: '+id);
}
assert.match(hub,/href="ax\/"/,'the field manual hub must link to the new guide');
assert.match(html,/Thargoid Scouts/);
assert.match(html,/Cyclops/);
assert.match(html,/Hydra/);
assert.match(html,/Solo &amp; Wing Doctrine/);
assert.match(html,/Emergency Quick Reference/);
assert.match(html,/Spires, Titans/);
assert.match(html,/No Build Prescriptions/);
assert.match(html,/cold orbit/i);
assert.match(html,/class="ax-diagram"/,'cold orbit diagram must be present');
assert.ok((html.match(/<details class="ax-depth">/g)||[]).length>=6,'advanced material should be expandable');
assert.ok((html.match(/<table /g)||[]).length>=3,'comparison and emergency tables expected');
assert.ok(!/<script[^>]*>[\s\S]*?fetch\(/.test(html),'do not add direct API requests from the guide');
assert.match(html,/css\/ax-guide\.css/);
assert.match(css,/@media\(max-width:620px\)/,'mobile styles required');
assert.match(css,/\.ax-depth/,'expandable styles required');
assert.ok(existsSync(new URL('../assets/images/gallery/interceptor-fight.webp',import.meta.url)),'existing squad asset must exist');
assert.ok(existsSync(new URL('../js/site.js',import.meta.url)),'shared site script must exist');
assert.ok(existsSync(new URL('../js/mongrel-assistant.js',import.meta.url)),'shared assistant script must exist');
console.log('AX Field Manual structure, content and static-layout checks passed.');
