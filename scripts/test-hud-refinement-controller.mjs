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
const exploration=html.slice(html.indexOf('<section id="explorationPanel"'),html.indexOf('  <div class="card">\n    <h2>HUD NOTES'));
assert.match(exploration,/id="surveyorExpeditionCard"/);
assert.match(exploration,/id="surveyorBioCard"/);

// The overlay drawer is one collapsible control shared by ALL four profiles,
// positioned just below the profile selector. Both former overlay lists are
// inside it, while all persisted settings/IDs remain unique.
const profileIndex=html.indexOf('class="profiles"');
const drawerIndex=html.indexOf('id="overlayOptions"');
const navIndex=html.indexOf('<section id="navigationPanel"');
assert.ok(profileIndex>=0&&profileIndex<drawerIndex&&drawerIndex<navIndex,
  'Overlay Options must appear immediately below profile buttons, before content');
const drawer=html.slice(drawerIndex,navIndex);
assert.match(drawer,/<summary class="overlay-options-button">/);
assert.match(drawer,/OVERLAY OPTIONS/);
assert.match(drawer,/<h2>OVERLAY LAYOUT<\/h2>/);
assert.match(drawer,/<h2>NAVIGATION OVERLAYS<\/h2>/);
assert.match(drawer,/data-panel-visible="navcourse"/);
assert.match(drawer,/data-panel-visible="surveyor_bio"/);
assert.match(drawer,/id="layoutReset"/);
assert.doesNotMatch(html,/<details class="overlay-options" id="overlayOptions" open/);
assert.equal((html.match(/id="overlayOptions"/g)||[]).length,1,
  'The same collapsed drawer should serve every profile');
for (const id of ['panelControls','overlayMaster','navcourse','carrierRouteSource','carrierRouteDestination']){
 const marker=id==='navcourse'?'data-panel-visible="navcourse"':'id="'+id+'"';
 assert.equal((html.split(marker).length-1),1,id+' remains unique');
}
// Ship plotter first, Fleet Carrier plotter second, Route Director third.
const shipPlotIndex=html.indexOf('<h2>PLOT A ROUTE</h2>');
const carrierPlotIndex=html.indexOf('id="carrierRoutePlanner"');
const directorIndex=html.indexOf('id="routeDirectorCard"');
assert.ok(navIndex<shipPlotIndex&&shipPlotIndex<carrierPlotIndex&&carrierPlotIndex<directorIndex,
  'Fleet Carrier plotting must follow neutron / galaxy plotting');
const carrierFields=html.slice(carrierPlotIndex,directorIndex);
assert.match(carrierFields,/class="carrier-route-locations"/);
assert.match(carrierFields,/class="carrier-route-metrics"/);
assert.doesNotMatch(carrierFields,/class="route-plot"/,
  'Fleet Carrier must never inherit the ship plotter narrow 100px column');
assert.match(html,/\.carrier-route-locations\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
assert.match(html,/\.carrier-route-metrics\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
assert.match(html,/@media\(max-width:520px\)\{\.carrier-route-locations,\.carrier-route-metrics\{grid-template-columns:1fr\}/);

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
