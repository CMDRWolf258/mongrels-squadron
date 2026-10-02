import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeEDSMSystem } from './import-orrery-edsm.mjs';

const data = JSON.parse(await readFile(new URL('../data/orrery/ngc-2546-uz-g-d10-16.json', import.meta.url), 'utf8'));
const bodies = new Map(data.bodies.map(body => [body.id, body]));
const locations = new Map(data.locations.map(location => [location.name, location]));
assert.equal(data.schemaVersion, 1);
assert.equal(data.id64, '560820275507');
assert.equal(bodies.size, 49);
assert.equal(data.bodies.filter(body => body.kind !== 'barycentre').length, 45);
assert.equal(data.bodies.filter(body => body.kind === 'star').length, 1);
assert.equal(data.bodies.filter(body => body.kind === 'planet').length, 12);
assert.equal(data.bodies.filter(body => body.kind === 'moon').length, 32);
assert.equal(new Set(data.locations.map(location => location.id)).size, 72);
assert.equal(data.locations.filter(location => location.kind !== 'ring-hotspot').length,36);
const hotspots = data.locations.filter(location => location.kind === 'ring-hotspot');
assert.equal(hotspots.length,36);
assert.equal(hotspots.reduce((sum,location) => sum + location.hotspotCount,0),79);
assert.equal(new Set(hotspots.map(location => location.ringId)).size,12);

// These relationships distinguish this real system from a flat planet list.
const expectedParents = {
  'body-20':'body-19', 'body-23':'body-19', 'body-19':'body-0',
  'body-37':'body-36', 'body-38':'body-36', 'body-36':'body-30',
  'body-47':'body-46', 'body-51':'body-46', 'body-46':'body-0',
  'body-54':'body-53', 'body-62':'body-53', 'body-53':'body-0',
  'body-83':'body-82', 'body-82':'body-79',
  'body-90':'body-89', 'body-89':'body-79',
};
for (const [id,parentId] of Object.entries(expectedParents)) assert.equal(bodies.get(id)?.parentId,parentId, `${id} immediate parent`);
for (const body of data.bodies) {
  const seen = new Set();
  let current = body;
  while (current) {
    assert.ok(!seen.has(current.id), `Hierarchy cycle at ${current.id}`);
    seen.add(current.id);
    if (!current.parentId) break;
    assert.ok(bodies.has(current.parentId), `Missing parent of ${current.id}`);
    current = bodies.get(current.parentId);
  }
  if (body.kind === 'barycentre') {
    assert.equal(body.distanceToArrivalLs,null);
    assert.ok(Object.values(body.orbit).every(value => value === null), 'Missing barycentre elements stay unknown');
  }
  for (const ring of [...body.rings, ...(body.belts || [])]) assert.ok(ring.innerRadiusKm > 0 && ring.outerRadiusKm > ring.innerRadiusKm, ring.name);
}

assert.equal(locations.get('Watanabe Mining Exchange').bodyId, 'body-3');
assert.equal(locations.get('Gao Base').bodyId, 'body-38');
assert.equal(locations.get('Extra Pens And Clean Sheets').bodyId, 'body-70');
assert.equal(locations.get('Hara Astrophysics Expedition').bodyId, 'body-86');
assert.equal(locations.get('Saturn Ascending').bodyId, 'body-20');
assert.equal(locations.get('Eon Blue Apocalypse').bodyId, 'body-90');
assert.equal(locations.get('Rivers Hub').bodyId, null, 'Arrival distance alone cannot establish a body association');
for (const location of data.locations) {
  assert.equal(location.positionKnown,Boolean(location.bodyId));
  if (location.bodyId) assert.ok(bodies.has(location.bodyId), `Invalid body for ${location.name}`);
  assert.equal(location.coordinatesKnown,false);
  assert.equal(location.latitude,null);
  assert.equal(location.longitude,null);
  if (location.associationSource?.reference) assert.match(location.associationSource.reference, /^sources\/.+\.png$/);
  if (location.kind === 'ring-hotspot') {
    assert.ok(bodies.get(location.bodyId).rings.some(ring => ring.id === location.ringId));
    assert.equal(location.commodities.length,1);
    assert.ok(location.hotspotCount > 0);
    assert.match(location.notes,/Exact hotspot positions and overlap geometry are unavailable/);
    assert.match(location.source.url,/^https:\/\/spansh.co.uk\/api\/body\//);
  } else {
    assert.deepEqual(location.commodities,[], 'No surface commodity deposit is invented by an API import');
    assert.match(location.source.url,/^https:\/\/www\.edsm\.net\/api-system-v1\/stations/);
  }
}
const platinum3A = hotspots.find(location => location.ringId === 'body-3-ring-1' && location.commodities.includes('Platinum'));
assert.equal(platinum3A.hotspotCount,3);
assert.equal(platinum3A.sourceUpdatedAt,'2026-09-24T05:04:01Z');

const fixtureBodies = {
  name:data.name, id:data.edsmId, id64:560820275507,
  bodies:[
    { id:100, bodyId:0, name:data.name, type:'Star', solarRadius:1, parents:null },
    { id:101, bodyId:20, name:`${data.name} 4`, type:'Planet', parents:[{Null:19},{Star:0}], distanceToArrival:208, semiMajorAxis:0.00319, rings:[{name:'Fixture ring',type:'Rocky',innerRadius:100,outerRadius:200}] },
    { id:102, bodyId:23, name:`${data.name} 5`, type:'Planet', parents:[{Null:19},{Star:0}], distanceToArrival:206 },
  ],
};
const fixtureStations = {
  name:data.name,
  stations:[
    { id:900, name:'Known fixture', type:'Odyssey Settlement', body:{id:101,name:`${data.name} 4`}, distanceToArrival:208 },
    { id:901, name:'Unknown fixture', type:'Outpost', body:null, distanceToArrival:208 },
  ],
};
const original = JSON.stringify([fixtureBodies,fixtureStations]);
const imported = normalizeEDSMSystem(fixtureBodies,fixtureStations,'2026-10-02T04:24:09.943Z');
assert.equal(JSON.stringify([fixtureBodies,fixtureStations]),original, 'Import must not mutate its reference snapshots');
assert.equal(imported.bodies.find(body => body.id === 'body-19').parentId,'body-0');
assert.equal(imported.locations[0].bodyId,'body-20');
assert.equal(imported.locations[1].bodyId,null);
assert.equal(imported.bodies.find(body => body.id === 'body-20').orbit.semiMajorAxisAu,0.00319);
assert.throws(() => normalizeEDSMSystem({...fixtureBodies,name:'Wrong system'},fixtureStations,'2026-10-02'),/system name/);
assert.throws(() => normalizeEDSMSystem({...fixtureBodies,bodies:[...fixtureBodies.bodies,fixtureBodies.bodies[0]]},fixtureStations,'2026-10-02'),/Duplicate/);
assert.throws(() => normalizeEDSMSystem({...fixtureBodies,bodies:[fixtureBodies.bodies[0],{...fixtureBodies.bodies[1],parents:[{Planet:999},{Star:0}]}]},fixtureStations,'2026-10-02'),/Missing physical parent/);
const fixtureSpansh = [{ id64:'720576501199554867',record:{ system_name:data.name,body_id:20,name:`${data.name} 4`,rings:[{name:'Fixture ring',signals:[{name:'Platinum',count:2}],signals_updated_at:'2026-09-24T05:04:01Z'}],stations:[{name:'Unknown fixture',market_id:987}],signals:[{name:'Planetary Mining Location',count:17}] } }];
const enriched = normalizeEDSMSystem(fixtureBodies,{...fixtureStations,stations:fixtureStations.stations.map(station => ({...station,marketId:station.id === 901 ? 987 : null}))},'2026-10-02',fixtureSpansh);
assert.equal(enriched.locations.find(location => location.id === 'edsm-station-901').bodyId,'body-20','Verified market ID association can place a facility');
assert.equal(enriched.locations.find(location => location.kind === 'ring-hotspot').hotspotCount,2);
assert.equal(enriched.locations.find(location => location.kind === 'ring-hotspot').latitude,null);
assert.equal(enriched.locations.filter(location => location.kind === 'surface-deposit').length,0,'A mining-location signal count is not a mapped resource deposit');
assert.throws(() => normalizeEDSMSystem(fixtureBodies,fixtureStations,'2026-10-02',[{...fixtureSpansh[0],record:{...fixtureSpansh[0].record,system_name:'Wrong system'}}]),/Spansh body does not match/);
console.log('Orrery data smoke checks passed: real hierarchy, provenance, unknown positions and offline import.');
