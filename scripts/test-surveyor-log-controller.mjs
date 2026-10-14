// Validate the Exploration-only discovery-log depth picker and local save handler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../downloads/mongrel-hud/controller.html',import.meta.url),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline);
new vm.Script(inline);
const section=html.slice(html.indexOf('<section id="explorationPanel"'),
                         html.indexOf('<h2>OVERLAY LAYOUT</h2>'));
assert.match(section,/id="surveyorLogSettings"/);
assert.match(section,/id="surveyorLogLimit"/);
for(const value of ['5','10','15','all'])
  assert.ok(section.includes('<option value="'+value+'">'));
assert.equal((html.match(/id="surveyorLogLimit"/g)||[]).length,1);
assert.match(inline,/state\.discoveryLogLimit/);
const start=inline.indexOf('el("surveyorLogLimit").onchange=async function(){');
const end=inline.indexOf('el("overlayMaster").onclick=',start);
assert.ok(start>=0&&end>start);
const nodes={surveyorLogLimit:{value:'15'},surveyorLogNotice:{textContent:''}};
const apiCalls=[];
const scope={
  el(id){return nodes[id]??={value:'',textContent:''}},
  state:{discoveryLogLimit:'10'},
  async mutate(path,body){
    apiCalls.push({path,body});
    return {ok:true,discoveryLogLimit:body.limit};
  },
  setText(node,value){node.textContent=value},
  renderSurveyorControls(){throw Error('Only called on failed save')}
};
vm.createContext(scope);
vm.runInContext(inline.slice(start,end),scope);
await nodes.surveyorLogLimit.onchange();
assert.deepEqual(apiCalls,[{path:'/api/discovery-log-limit',body:{limit:'15'}}]);
assert.equal(scope.state.discoveryLogLimit,'15');
assert.match(nodes.surveyorLogNotice.textContent,/Showing 15 recent body discoveries/);
nodes.surveyorLogLimit.value='all';
await nodes.surveyorLogLimit.onchange();
assert.equal(scope.state.discoveryLogLimit,'all');
assert.match(nodes.surveyorLogNotice.textContent,/all recorded/);
console.log('Exploration log iPad setting, placement, save response and script parsing PASSED');
