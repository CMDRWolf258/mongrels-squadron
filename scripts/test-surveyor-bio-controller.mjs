// Standalone iPad biological-intelligence render tests (no browser/server).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../downloads/mongrel-hud/controller.html',import.meta.url),'utf8');
assert.ok(html.includes('data-panel-visible="surveyor_bio"'));
assert.ok(html.includes('data-panel-scale="surveyor_bio"'));
assert.ok(html.includes('data-panel-profile="surveyor_bio"'));
assert.ok(html.includes('id="surveyorBioBody"'));
const start=html.indexOf('var bioPreviewSystem = "";');
const end=html.indexOf('function renderSurveyorControls(){',start);
assert.ok(start>0&&end>start, 'bio survey renderer is independently testable');
const code=html.slice(start,end);
const nodes={};
const el=id=>(nodes[id]??={innerHTML:"",textContent:"",value:""});
const state={scout:{status:{onFootOnPlanet:false,bodyName:""}}};
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setText=(node,text)=>{node.textContent=String(text)};
const scope={el,escapeHtml,setText,state,Date,Number,Array,String,Math};
vm.createContext(scope);
vm.runInContext(code+'\nglobalThis.renderBioSurvey=renderBioSurvey;',scope);
const scan={system:{address:"999"},exobiology:{habitatRuleCount:40,confirmedSalesLifetime:1234,saleEvents:1,biologicalBodies:[{
  bodyId:"3",bodyName:'<test world>',
  signals:1,confirmedGenuses:[{name:"Stratum"}],
  prediction:{candidateCount:1,candidates:[
    {species:'<Stratum Tectonicas>',estimatedBase:19010800,status:"compatible",missing:[]}
  ]},sampledSpecies:[{species:"Stratum Tectonicas",samples:1,completed:false,lastScanAt:"2026-10-13T00:00:00Z",geneticDistanceMeters:500,samplePositions:[]}]
}]}};
scope.renderBioSurvey(scan);
assert.match(el("surveyorBioStatus").textContent,/DSS GENUS VERIFIED/);
assert.match(el("surveyorBioCandidates").innerHTML,/&lt;Stratum Tectonicas&gt;/);
assert.doesNotMatch(el("surveyorBioCandidates").innerHTML,/<Stratum Tectonicas>/);
assert.match(el("surveyorBioCandidates").innerHTML,/NOT CONFIRMED/);
assert.match(el("surveyorBioGenetics").textContent,/Range unverified/);
assert.match(el("surveyorBioSales").textContent,/1,234 CR/);
scope.renderBioSurvey({system:{address:"1000"},exobiology:{biologicalBodies:[]}});
assert.match(el("surveyorBioStatus").textContent,/NO FRONTIER BIO SIGNALS/);
assert.doesNotMatch(el("surveyorBioStatus").textContent,/test world/);
console.log("iPad Surveyor biological controls and HTML escaping PASSED");
