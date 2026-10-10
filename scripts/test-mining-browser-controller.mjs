import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../downloads/mongrel-hud/controller.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
for(const id of ['browseSystemInput','browseSystemSuggestions','browseCommodity','browseBody','browseRigs','browseResults','browseStatus','browseRefresh','browseNavNotice']){
  assert.match(html,new RegExp('id="'+id+'"'));
}
assert.match(html,/id="browseHealth"/);
assert.match(html,/id="browseHealthStatus"/);
assert.match(script,/\/api\/mining-browser\/health/);
assert.match(script,/Backup is NOT verified and shared off-system writes remain DISABLED/);
assert.match(script,/miningBrowser\.selected/);
assert.match(script,/\/api\/mining-browser\/catalog/);
assert.match(script,/\/api\/mining-browser\/system/);
assert.doesNotMatch(script.slice(script.indexOf('async function pickMiningSystem'),script.indexOf('async function loadMiningBrowserCatalog')),/\/api\/site-select|\/api\/location-select/);
const pick=(start,end)=>script.slice(script.indexOf(start),script.indexOf(end));
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
const elements=new Map();
function el(id){
  if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',querySelectorAll(){return []}});
  return elements.get(id);
}
const context={
  miningBrowser:{selected:'123',systems:[{systemAddress:'123',systemName:'Icy Test'}],
    data:{deposits:[
      {body:'Icy Test A 2 a',commodity:'Bromellite',rigs:6,signal:1,latitude:12.3,longitude:44.2,storage:'shared'},
      {body:'Icy Test B 2 a',commodity:'Gold',rigs:3,signal:2,latitude:10,longitude:20,storage:'local_only',notes:'<img src=x onerror=alert(1)>'},
      {body:'Icy Test A 2 a',commodity:'Bromellite',rigs:2,signal:3,latitude:14,longitude:40,storage:'local_only'},
    ],centers:[
      {body:'Icy Test C 1',signal:4,latitude:4,longitude:2,storage:'shared'},
    ]}},
  el,escapeHtml,escapeAttr:escapeHtml,
};
vm.createContext(context);
const selectionCode=pick('function browserMatches','function showMiningSuggestions');
vm.runInContext(selectionCode+'this.browserMatches=browserMatches;',context);
context.miningBrowser.systems=[{systemAddress:'123',systemName:'Icy Test'},{systemAddress:'888',systemName:'Old System One'},{systemAddress:'999',systemName:'Another System'}];
assert.equal(context.browserMatches('old sys').length,1);
assert.equal(context.browserMatches('sYsTeM').length,2);
assert.equal(context.browserMatches('888')[0].systemName,'Old System One');
assert.equal(context.browserMatches('UNKNOWN').length,0);
const resultCode=pick('function renderMiningBrowseResults','function populateMiningFilters');
vm.runInContext(resultCode+'this.renderMiningBrowseResults=renderMiningBrowseResults;',context);
const run=(commodity='',body='',rig=0)=>{
  el('browseCommodity').value=commodity;el('browseBody').value=body;el('browseRigs').value=String(rig);
  context.renderMiningBrowseResults();
  return {status:el('browseStatus').textContent,html:el('browseResults').innerHTML};
};
test('Combined commodity, body, minimum rig count are applied locally without any HTTP',()=>{
  const all=run();
  assert.match(all.status,/3 matching deposits/);
  assert.match(all.html,/CENTER ONLY/);
  assert.match(all.html,/LOCAL ONLY/);
  assert.doesNotMatch(all.html,/<img src=x/);
  const high=run('', '', 6);
  assert.match(high.status,/1 matching deposits/);
  assert.match(high.html,/Bromellite/);
  assert.doesNotMatch(high.html,/Gold/);
  const body=run('Bromellite','Icy Test A 2 a',3);
  assert.match(body.status,/1 matching deposits/);
  assert.doesNotMatch(body.html,/Signal #3/);
  const none=run('Gold','Icy Test A 2 a',0);
  assert.match(none.status,/0 matching deposits/);
});

test('result cards reveal deliberate Navigate controls for deposits and center-only signals',()=>{
  const all=run();
  assert.match(all.html,/data-browse-navigate="deposit"/);
  assert.match(all.html,/data-browse-navigate="center"/);
  assert.match(all.html,/NAVIGATE/);
  assert.match(all.html,/<details/);
  assert.match(all.html,/<summary>/);
  assert.doesNotMatch(all.html,/<img src=x/,'Source notes must remain HTML-escaped');
  assert.match(script,/\/api\/mining-browser\/navigate/);
  assert.doesNotMatch(pick('async function navigateMiningSearchResult','function populateMiningFilters'),/\/api\/site-select|\/api\/location-select/,
    'Browser Navigate must use the verified ID64+row-ID endpoint, not raw legacy selection');
});
