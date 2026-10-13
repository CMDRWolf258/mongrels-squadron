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
  ]},genusOverview:[{genus:"<Stratum Tectonicas>",exact:false,minBase:19010800,maxBase:19010800}],sampledSpecies:[{species:"Stratum Tectonicas",samples:1,completed:false,lastScanAt:"2026-10-13T00:00:00Z",geneticDistanceMeters:500,samplePositions:[]}]
}]}};
scope.renderBioSurvey(scan);
assert.match(el("surveyorBioStatus").textContent,/DSS GENUS VERIFIED/);
assert.match(el("surveyorBioCandidates").innerHTML,/&lt;Stratum Tectonicas&gt;/);
assert.doesNotMatch(el("surveyorBioCandidates").innerHTML,/<Stratum Tectonicas>/);
assert.match(el("surveyorBioCandidates").innerHTML,/ACTIVE GENETIC SAMPLE/);
assert.match(el("surveyorBioCandidates").innerHTML,/bio-sample-slots/);
assert.match(el("surveyorBioCandidates").innerHTML,/bio-sample-slot filled/);
assert.match(el("surveyorBioGenetics").textContent,/Range unverified/);
assert.match(el("surveyorBioSales").textContent,/1,234 CR/);
// An iPad controller may show an old Status after a system jump. Never
// calculate genetic spacing unless Scout tagged that fix to this system.
const sample=scan.exobiology.biologicalBodies[0].sampledSpecies[0];
sample.samplePositions=[{latitude:0,longitude:0,radius:1000000}];
scope.state.scout.status={
  timestamp:new Date().toISOString(),onFootOnPlanet:true,hasLatLong:true,
  bodyName:"<test world>",latitude:0,longitude:0.06,planetRadius:1000000,
  systemAddress:"old-system"
};
scope.renderBioSurvey(scan);
assert.match(el("surveyorBioGenetics").textContent,/Range unverified/);
scope.state.scout.status.systemAddress="999";
scope.state.scout.status.onFootOnPlanet=false; // In ship or Nomad
scan.exobiology.biologicalBodies[0].sampledSpecies[0].estimatedBaseValue=1949000;
scan.exobiology.biologicalBodies[0].sampledSpecies[0].footfallStatus="first_footfall_indicated";
scope.renderBioSurvey(scan);
assert.match(el("surveyorBioCandidates").innerHTML,/POSSIBLE FIRST-LOG TOTAL ~9,745,000 CR/);
assert.match(el("surveyorBioGenetics").textContent,/GENETIC DISTANCE MET/);
scope.renderBioSurvey({system:{address:"1000"},exobiology:{biologicalBodies:[]}});
assert.match(el("surveyorBioStatus").textContent,/NO FRONTIER BIO SIGNALS/);
assert.doesNotMatch(el("surveyorBioStatus").textContent,/test world/);
console.log("iPad Surveyor biological controls and HTML escaping PASSED");
