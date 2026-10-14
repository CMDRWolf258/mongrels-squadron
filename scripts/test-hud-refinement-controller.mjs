// Profile layout, route selection and iPad touch controls without a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../downloads/mongrel-hud/controller.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Controller script exists');
new vm.Script(script); // Parse complete production controller JavaScript
const ids=['combatButton','surfaceButton','navigationButton','explorationButton',
  'explorationPanel','missionSystemChoices','tradeRouteChoices','tradeAllRoutes',
  'tradeCustomRoutes','clearUnclaimedBounties','browseSystemClear'];
for(const id of ids)assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' must exist once');
assert.match(script,/el\("explorationButton"\)\.classList\.toggle\("active",profile==="exploration"\)/);
assert.match(script,/el\("explorationPanel"\)\.classList\.toggle\("hidden",profile!=="exploration"\)/);
const exploration=html.slice(html.indexOf('<section id="explorationPanel"'),html.indexOf('  <div class="card">\n    <h2>OVERLAY LAYOUT'));
assert.match(exploration,/id="surveyorExpeditionCard"/);
assert.match(exploration,/id="surveyorBioCard"/);
const combat=html.slice(html.indexOf('<section id="combatPanel"'),html.indexOf('<section id="surfacePanel"'));
for(const title of ['FACTION ALERTS','LIVE TRADE PROFIT DIAGNOSTICS','DAILY ORDER CHANGES','SHIP CARGO','BOUNTIES'])
  assert.ok(combat.includes(title),title+' controls should be Combat-only');
assert.ok(!exploration.includes('SHIP CARGO'));
assert.match(html,/class="mission-system-choices"/);
assert.match(html,/min-height:62px/);
assert.match(script,/missionChoices\.map/);
assert.match(script,/data-mission-system/);
assert.match(script,/el\("browseSystemClear"\)\.onclick=function\(\)/);
assert.match(script,/el\("browseSystemInput"\)\.value="";\s*showMiningSuggestions\(\)/);
assert.match(script,/window\.confirm\("Clear this PC/);
assert.match(script,/mutate\("\/api\/bounties\/clear"/);

const start=script.indexOf('function tradeSelection(){');
const end=script.indexOf('function showLayoutStatus(',start);
assert.ok(start>=0&&end>start);
const nodes={};
function el(id){return nodes[id]??={innerHTML:'',classList:{toggle(){}}};}
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scope={state:{tradeRouteSelection:{mode:'custom',selectedIds:['r1']},
  siteFeed:{trade:{routes:[{id:'r1',title:'Chosen <Platinum>'},{id:'r2',title:'Ignored Gold'}]}}},
  el,escapeHtml,escapeAttr:escapeHtml,Set};
vm.createContext(scope);
vm.runInContext(script.slice(start,end)+'\nglobalThis.renderChoices=renderTradeRouteChoices;',scope);
scope.renderChoices();
assert.match(el('tradeRouteChoices').innerHTML,/Chosen &lt;Platinum&gt;/);
assert.doesNotMatch(el('tradeRouteChoices').innerHTML,/Chosen <Platinum>/);
assert.match(el('tradeRouteChoices').innerHTML,/data-trade-route="r1" checked/);
assert.match(el('tradeRouteChoices').innerHTML,/data-trade-route="r2"/);
assert.doesNotMatch(el('tradeRouteChoices').innerHTML,/data-trade-route="r2" checked/);
scope.state.tradeRouteSelection={mode:'all',selectedIds:[]};
scope.renderChoices();
assert.match(el('tradeRouteChoices').innerHTML,/data-trade-route="r2" checked disabled/);
console.log('HUD iPad refinements: profile scoping, touch selectors, route filtering, clear actions PASSED');
