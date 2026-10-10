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
      {id:'brom-6',body:'Icy Test A 2 a',commodity:'Bromellite',rigs:6,signal:1,latitude:12.3,longitude:44.2,storage:'shared'},
      {id:'gold-3',body:'Icy Test B 2 a',commodity:'Gold',rigs:3,signal:2,latitude:10,longitude:20,storage:'local_only',notes:'<img src=x onerror=alert(1)>'},
      {id:'brom-2',body:'Icy Test A 2 a',commodity:'Bromellite',rigs:2,signal:3,latitude:14,longitude:40,storage:'local_only'},
    ],centers:[
      {id:'center-4',body:'Icy Test C 1',signal:4,latitude:4,longitude:2,storage:'shared'},
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
  assert.match(all.html,/SHARE DEPOSIT WITH SQUAD/);
  assert.match(all.html,/data-browse-share="deposit"/);
  assert.match(script,/\/api\/mining-browser\/share/);
  assert.match(script,/Your local record will remain on Serenity/);
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
  assert.doesNotMatch(all.html,/data-browse-share="center"/,"Shared center must not be republished");
  assert.match(script,/Publish this saved/);
  assert.match(all.html,/NAVIGATE/);
  assert.match(all.html,/<details/);
  assert.match(all.html,/<summary>/);
  assert.doesNotMatch(all.html,/<img src=x/,'Source notes must remain HTML-escaped');
  assert.match(script,/\/api\/mining-browser\/navigate/);
  assert.doesNotMatch(pick('async function navigateMiningSearchResult','function populateMiningFilters'),/\/api\/site-select|\/api\/location-select/,
    'Browser Navigate must use the verified ID64+row-ID endpoint, not raw legacy selection');
});

test('Report Deposit is above the long saved-deposit and system-browser sections',()=>{
  const section=html.slice(html.indexOf('<section id="surfacePanel"'),html.indexOf('</section>',html.indexOf('<section id="surfacePanel"')));
  assert.ok(section.indexOf('<h2>REPORT DEPOSIT</h2>')<section.indexOf('<h2>DEPOSITS IN SELECTED LOCATION</h2>'));
  assert.ok(section.indexOf('<h2>REPORT DEPOSIT</h2>')<section.indexOf('<h2>MINING DATABASE · SYSTEM BROWSER</h2>'));
});

test('Saved deposits collapse by commodity and preserve expansion across refreshes',()=>{
  const node={innerHTML:'',querySelectorAll(){return []}};
  const scope={el(id){return id==='sites'?node:{value:'',classList:{add(){},remove(){}}}},
    escapeHtml,escapeAttr:escapeHtml,savedDepositScope:'',savedDepositOpen:{}};
  vm.createContext(scope);
  vm.runInContext(pick('function renderSavedDepositGroups','function browserMatches')+'this.renderSavedDepositGroups=renderSavedDepositGroups;',scope);
  const rows=[
    {id:'a',commodity:'Gold',rigs:3,latitude:12.3,longitude:42.4,signal:13},
    {id:'b',commodity:'Gold',rigs:4,latitude:12.4,longitude:42.5,signal:13},
    {id:'c',commodity:'Monazite & more',rigs:6,latitude:12.5,longitude:42.6,signal:13}
  ];
  scope.renderSavedDepositGroups(rows,13,{id:'a'},'sys|body|13');
  assert.match(node.innerHTML,/Gold · 2 deposits/);
  assert.match(node.innerHTML,/Monazite &amp; more · 1 deposit/);
  assert.match(node.innerHTML,/data-site="a"/);
  assert.match(node.innerHTML,/site-btn active/);
  assert.doesNotMatch(node.innerHTML,/data-deposit-group="Gold" open/);
  node.querySelectorAll=selector=>selector==='details[data-deposit-group]'?[{getAttribute:()=> 'Gold',open:true}]:[];
  scope.renderSavedDepositGroups(rows,13,{id:'a'},'sys|body|13');
  assert.match(node.innerHTML,/data-deposit-group="Gold" open/,'expanded Gold group should survive polling');
  scope.renderSavedDepositGroups(rows,13,{id:'a'},'sys|other-body|13');
  assert.doesNotMatch(node.innerHTML,/data-deposit-group="Gold" open/,'switching bodies starts collapsed');
});

test('saved system browser collapses individual deposits into commodity groups with accurate filtered counts',()=>{
  const all=run();
  assert.match(all.html,/data-browse-group="commodity:Bromellite"/);
  assert.match(all.html,/Bromellite · 2 deposits/);
  assert.match(all.html,/data-browse-group="commodity:Gold"/);
  assert.match(all.html,/Gold · 1 deposit/);
  assert.match(all.html,/data-browse-group="center-only"/);
  assert.match(all.html,/Centers without deposits · 1/);
  assert.doesNotMatch(all.html,/data-browse-group="commodity:Gold" open/);
  assert.match(all.html,/data-browse-item="deposit:gold-3"/);
  assert.match(all.html,/data-browse-share-id="gold-3"/);
  const only=run('Bromellite','',6);
  assert.match(only.html,/Bromellite · 1 deposit/);
  assert.doesNotMatch(only.html,/data-browse-group="commodity:Gold"/);
  assert.doesNotMatch(only.html,/data-browse-group="center-only"/);
  const none=run('Gold','Icy Test A 2 a',0);
  assert.doesNotMatch(none.html,/data-browse-group="commodity:/);
});

test('browser accordion and individual row stay expanded after refresh and reset for another system',()=>{
  const browser=el('browseResults'),query=browser.querySelectorAll;
  try{
    run();
    browser.querySelectorAll=selector=>selector==='details[data-browse-group]'?[
      {getAttribute:()=> 'commodity:Gold',open:true}
    ]:selector==='details[data-browse-item]'?[
      {getAttribute:()=> 'deposit:gold-3',open:true}
    ]:[];
    const same=run();
    assert.match(same.html,/data-browse-group="commodity:Gold" open/);
    assert.match(same.html,/data-browse-item="deposit:gold-3" open/);
    context.miningBrowser.selected='888';
    const switched=run();
    assert.doesNotMatch(switched.html,/data-browse-group="commodity:Gold" open/);
    assert.doesNotMatch(switched.html,/data-browse-item="deposit:gold-3" open/);
  } finally {
    browser.querySelectorAll=query;
    context.miningBrowser.selected='123';
    run();
  }
});

test('commodity headers escape untrusted names without changing report/sharing endpoints',()=>{
  const rows=context.miningBrowser.data.deposits;
  rows.push({id:'untrusted',body:'Icy Test A 2 a',commodity:'Rare <img src=x onerror=alert(1)>',rigs:2,signal:7,storage:'local_only'});
  try{
    const all=run();
    assert.match(all.html,/Rare &lt;img src=x onerror=alert\(1\)&gt; · 1 deposit/);
    assert.doesNotMatch(all.html,/<img src=x/);
    assert.match(all.html,/data-browse-share-id="untrusted"/);
    assert.match(all.html,/data-browse-navigate="deposit"/);
  } finally {rows.pop();run()}
});
