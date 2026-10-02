import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyLocationPayload, loadLocationProvider } from '../lib/orrery-locations.js';
import { filterRecords } from '../lib/orrery-model.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const core = JSON.parse(await read('data/orrery/ngc-2546-uz-g-d10-16.json'));
const coreBefore = structuredClone(core);
const record = {
  id:`ten16-mining:${core.id64}:fixture-41`, legacySiteId:41,
  name:'Curated fixture location', kind:'surface-deposit', bodyJournalId:null, bodyName:'9a',
  latitude:12.34567891, longitude:-78.90123456,
  commodities:['Cobalt'], resourceTags:['Rhino'], notes:'Exact original field note.',
  source:{name:'Curated field records',url:'https://example.test/mining',reference:'site:41',type:'curated'},
  sourceUpdatedAt:'2026-10-01T12:00:00Z',
  surfaceMining:{signal:2,rigs:6,preferred:true,bodyType:'moon'},
  materialAmount:'high',materialUpdatedAt:'2026-10-01 11:00:00',
};
const envelope = locations => ({schemaVersion:1,systemId64:core.id64,systemName:core.name,locations});
const payload = envelope([record]);
const payloadBefore = structuredClone(payload);
const joined = applyLocationPayload(core, payload);
const poi = joined.locations.find(item => item.canonicalId === record.id);
assert.equal(poi.bodyId,'body-57','9a is body 9 a, not journal body 9');
assert.equal(poi.id,`canonical:${record.id}`);
for (const field of ['canonicalId','legacySiteId','latitude','longitude','notes','source','sourceUpdatedAt','surfaceMining','materialAmount','materialUpdatedAt','commodities','resourceTags']) {
  assert.deepEqual(poi[field], field === 'canonicalId' ? record.id : record[field], `Original ${field} is retained`);
}
assert.deepEqual(payload,payloadBefore,'Provider-owned records are not edited');
assert.deepEqual(core,coreBefore,'Core snapshot is not edited');
assert.deepEqual(joined.bodies,core.bodies,'All stars, planets, moons, rings and hierarchy remain imported data');
assert.deepEqual(joined.sources,core.sources,'Core provenance is unchanged');
assert.deepEqual(joined.locations.slice(0,core.locations.length),core.locations,'Facilities and imported ring surveys are unchanged');
assert.equal(applyLocationPayload(joined,payload).locations.length,joined.locations.length,'Canonical IDs replace records without duplication');
assert.deepEqual(filterRecords(joined,{kind:'surface-deposit',resource:'Rhino'}).map(x=>x.canonicalId),[record.id]);
assert.deepEqual(filterRecords(joined,{query:'Rhino field note',kind:'surface-deposit'}).map(x=>x.canonicalId),[record.id]);
assert.equal(filterRecords(joined,{kind:'surface-deposit',resource:'Iron'}).length,0,'Body composition does not become a curated deposit');

for (const [name,journal] of [['6d',37],['12ba',83],['12ga',90],['9',54],[' 9 \t A ',57],[`${core.name} 9 a`,57]]) {
  const result = applyLocationPayload(core,envelope([{...record,bodyName:name,latitude:null,longitude:null}]));
  const location = result.locations.at(-1);
  assert.equal(location.bodyId,`body-${journal}`,`Exact compact body designation: ${name}`);
  assert.equal(location.latitude,null); assert.equal(location.longitude,null);
  assert.equal(location.coordinatesKnown,false,'No coordinates are substituted');
}
for (const body of core.bodies.filter(item=>item.kind!=='barycentre')) {
  const location = applyLocationPayload(core,envelope([{...record,bodyName:body.shortName,latitude:null,longitude:null}])).locations.at(-1);
  assert.equal(location.bodyId,body.id,`All imported short names resolve exactly: ${body.shortName}`);
}
const journal = applyLocationPayload(core,envelope([{...record,bodyJournalId:20,bodyName:'4'}])).locations.at(-1);
assert.equal(journal.bodyId,'body-20','Journal IDs take precedence when supplied');
assert.equal(applyLocationPayload(core,envelope([{...record,bodyJournalId:20,bodyName:null}])).locations.at(-1).bodyId,'body-20','Journal IDs work without names');
const custom = {...record,id:'mongrels:custom:fixture',kind:'custom',bodyName:null,latitude:null,longitude:null};
const unplaced = applyLocationPayload(core,envelope([custom])).locations.at(-1);
assert.equal(unplaced.bodyId,null); assert.equal(unplaced.positionKnown,false);
assert.equal(unplaced.coordinatesKnown,false,'System-level custom POIs stay unplaced');
const ringBody = core.bodies.find(body=>body.rings.length);
const ring = applyLocationPayload(core,envelope([{...custom,kind:'ring-hotspot',bodyJournalId:ringBody.bodyId,ringName:ringBody.rings[0].name}])).locations.at(-1);
assert.equal(ring.ringId,ringBody.rings[0].id,'Optional ring associations use the imported ring');

const invalid = (changes,pattern) => assert.throws(()=>applyLocationPayload(core,envelope([{...record,...changes}])),pattern);
invalid({bodyJournalId:'57'},/journal body ID/);
invalid({bodyJournalId:999},/body unavailable/);
invalid({bodyJournalId:19},/body unavailable/);
invalid({bodyJournalId:20,bodyName:'9a'},/references disagree/);
invalid({bodyJournalId:20,bodyName:42},/references disagree/);
invalid({bodyName:'9-a'},/body name unavailable/);
invalid({bodyName:'not-a-body'},/body name unavailable/);
invalid({bodyName:''},/body name/);
invalid({bodyName:null},/body reference/);
invalid({bodyName:'4 / 5 barycentre'},/body name unavailable/);
invalid({resourceTags:[42]},/resource tags/);
invalid({resourceTags:'Rhino'},/resource tags/);
invalid({latitude:90.001},/Invalid coordinates/);
invalid({longitude:-180.001},/Invalid coordinates/);
invalid({longitude:null},/Invalid coordinates/);
invalid({kind:'custom',bodyName:null},/Invalid coordinates/);
invalid({ringName:'Unknown ring'},/ring unavailable/);
const ambiguous = structuredClone(core);
ambiguous.bodies.push({...structuredClone(core.bodies.find(body=>body.bodyId===57)),id:'fixture-body',bodyId:997,name:'Fixture duplicate designation',shortName:'9a'});
assert.throws(()=>applyLocationPayload(ambiguous,payload),/ambiguous/,'Ambiguous body names are rejected, never guessed');
assert.throws(()=>applyLocationPayload(core,{...payload,systemId64:'another-system'}),/system\/schema mismatch/);
assert.throws(()=>applyLocationPayload(core,{...payload,systemId64:Number(core.id64)}),/system\/schema mismatch/,'System addresses remain exact decimal strings');
assert.throws(()=>applyLocationPayload(core,envelope([record,record])),/Duplicate/);

const offlineLoaded = await loadLocationProvider(core,'https://example.test/api/mining?format=poi',{
  fetcher:async()=>({ok:true,json:async()=>payload}),
});
assert.deepEqual(offlineLoaded,joined,'Existing API and static JSON use the same transport-independent document');
const catalog = JSON.parse(await read('data/orrery/systems.json'));
assert.equal(catalog.systems.find(item=>item.id===core.id).locationProvider.url,'https://ten16-archive.pages.dev/api/mining?format=poi');
const controller = await read('js/orrery/app.js');
for(const field of ['signal','rigs','preferred','bodyType']) assert.ok(controller.includes(`surfaceMining?.${field}`),`Public mining ${field} is displayed`);
for(const field of ['materialAmount','materialUpdatedAt','source?.reference','resourceTags']) assert.ok(controller.includes(field),`Public ${field} is displayed`);
console.log('Curated POI checks passed: exact body joins, canonical identities, coordinates, metadata, resources and unchanged core data.');
