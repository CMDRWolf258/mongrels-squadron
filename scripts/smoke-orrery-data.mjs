import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeEDSMSystem } from './import-orrery-edsm.mjs';
import { applyLocationPayload } from '../lib/orrery-locations.js';

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
assert.equal(locations.get("King's Mountain View").bodyId, 'body-51', 'Existing archive explicitly associates this facility with the unique Earth-like world');
assert.match(locations.get("King's Mountain View").associationSource.url, /\/bafb1a2c2fdc7a24801082f8d69ed233759b77df\/system.html$/);
assert.equal(locations.get("King's Mountain View").type, 'Planetary Outpost', 'Host recovery does not silently correct a conflicting source type');
assert.equal(data.locations.filter(location => !location.bodyId).length, 9);
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
const legacyPlanImported = normalizeEDSMSystem(fixtureBodies,{...fixtureStations,stations:[{id:902,name:'Saturn Ascending',type:'Outpost',body:null}]},'2026-10-02');
assert.equal(legacyPlanImported.locations[0].bodyId,'body-20','The default 10-16 import retains its verified legacy association');
assert.match(legacyPlanImported.locations[0].associationSource.reference,/^sources\/.+\.png$/);
const archiveBodies = {...fixtureBodies,bodies:[...fixtureBodies.bodies,{id:151,bodyId:51,name:`${data.name} 8`,type:'Planet',subType:'Earth-like world',parents:[{Star:0}]}]};
const archiveStation = {id:722440,marketId:4374964995,name:"King's Mountain View",type:'Planetary Outpost',body:null};
const archiveImport = (bodyRows=archiveBodies,station=archiveStation) => normalizeEDSMSystem(bodyRows,{...fixtureStations,stations:[station]},'2026-10-02');
assert.equal(archiveImport().locations[0].bodyId,'body-51','Explicit archive host survives a repeat import');
assert.equal(archiveImport().locations[0].latitude,null,'Archive does not supply measured coordinates');
assert.equal(archiveImport(archiveBodies,{...archiveStation,marketId:999}).locations[0].bodyId,null,'Name alone cannot establish the archive association');
assert.equal(archiveImport({...archiveBodies,bodies:[...archiveBodies.bodies,{...archiveBodies.bodies.at(-1),id:152,bodyId:52,name:`${data.name} 9`}]}).locations[0].bodyId,null,'Ambiguous body descriptions remain unplaced');
assert.equal(archiveImport(archiveBodies,{...archiveStation,body:{id:101,name:`${data.name} 4`}}).locations[0].bodyId,'body-20','Direct provider evidence takes precedence over the archive');
const archiveOtherSystem = {name:'Independent archive fixture',id:'independent-archive-fixture'};
assert.equal(normalizeEDSMSystem({...archiveBodies,name:archiveOtherSystem.name,id64:'999',bodies:archiveBodies.bodies.map(body=>({...body,name:body.name.replace(data.name,archiveOtherSystem.name)}))},{name:archiveOtherSystem.name,stations:[archiveStation]},'2026-10-02',[],archiveOtherSystem).locations[0].bodyId,null,'10-16 archive cannot establish a host in another system');
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

// A second-system fixture deliberately reuses legacy station names and journal
// IDs. Only its own matching public records may establish body associations.
const secondSystem = { name:'Independent fixture', id:'independent-fixture' };
const secondBodies = {
  name:secondSystem.name, id:999, id64:'123456789123',
  bodies:[
    { id:200, bodyId:0, name:secondSystem.name, type:'Star', parents:null },
    { id:201, bodyId:20, name:`${secondSystem.name} 1`, type:'Planet', parents:[{Null:19},{Star:0}], distanceToArrival:208, semiMajorAxis:0.00319, rings:[{name:`${secondSystem.name} 1 A Ring`,type:'Rocky',innerRadius:100,outerRadius:200}], materials:{Iron:19} },
    { id:202, bodyId:23, name:`${secondSystem.name} 2`, type:'Planet', parents:[{Null:19},{Star:0}], distanceToArrival:206 },
    { id:203, bodyId:24, name:`${secondSystem.name} 1 a`, type:'Planet', parents:[{Planet:20},{Null:19},{Star:0}], updateTime:'2026-09-24 05:00:00' },
    { id:204, bodyId:25, name:`${secondSystem.name} 1 a a`, type:'Planet', parents:[{Planet:24},{Planet:20},{Null:19},{Star:0}] },
    { id:205, bodyId:90, name:`${secondSystem.name} 3`, type:'Planet', parents:[{Star:0}] },
  ],
};
const secondStations = {
  name:secondSystem.name, id64:secondBodies.id64,
  stations:[
    { id:910, name:'Direct fixture', type:'Odyssey Settlement', body:{id:203,name:`${secondSystem.name} 1 a`}, marketId:9100, updateTime:{information:'2026-09-25 01:00:00'} },
    { id:911, name:'Spansh fixture', type:'Outpost', body:null, marketId:9110 },
    { id:912, name:'Saturn Ascending', type:'Outpost', body:null, distanceToArrival:208 },
    { id:913, name:'Eon Blue Apocalypse', type:'Orbis Starport', body:null },
    { id:914, name:'Spansh fixture', type:'Outpost', body:null, marketId:9990 },
  ],
};
const exactBodyAddress = '720576501199554867';
const secondSpansh = [{ id64:exactBodyAddress, record:{
  system_name:secondSystem.name, body_id:20, name:`${secondSystem.name} 1`,
  stations:[{name:'Direct fixture',market_id:9100},{name:'Spansh fixture',market_id:9110}],
  rings:[{name:`${secondSystem.name} 1 A Ring`,signals:[{name:'Platinum',count:2}],signals_updated_at:'2026-09-24T05:04:01Z'}],
  signals:[{name:'Planetary Mining Location',count:17}], signals_updated_at:'2026-09-24T05:00:00Z',
} }];
const secondOriginal = structuredClone([secondBodies,secondStations,secondSpansh,secondSystem]);
const importSecond = (bodyRows=secondBodies, stationRows=secondStations, surveyRows=secondSpansh, system=secondSystem) => normalizeEDSMSystem(bodyRows,stationRows,'2026-10-02T04:24:09.943Z',surveyRows,system);
const secondImported = importSecond();
assert.deepEqual([secondBodies,secondStations,secondSpansh,secondSystem],secondOriginal,'Import must not mutate any second-system source or configuration');
assert.equal(secondImported.id,secondSystem.id);
assert.equal(secondImported.name,secondSystem.name);
assert.equal(secondImported.id64,secondBodies.id64);
const secondNodes = new Map(secondImported.bodies.map(body => [body.id,body]));
const secondPlaces = new Map(secondImported.locations.map(location => [location.id,location]));
assert.equal(secondNodes.size,7);
for (const [id,parentId] of Object.entries({'body-19':'body-0','body-20':'body-19','body-23':'body-19','body-24':'body-20','body-25':'body-24'})) assert.equal(secondNodes.get(id).parentId,parentId,`${id} retains its second-system immediate parent`);
assert.equal(secondNodes.get('body-24').kind,'moon');
assert.equal(secondNodes.get('body-25').kind,'moon');
assert.equal(secondNodes.get('body-20').orbit.semiMajorAxisAu,0.00319);
assert.equal(secondNodes.get('body-24').sourceUpdatedAt,'2026-09-24 05:00:00');
assert.equal(secondNodes.get('body-0').radiusKm,null,'Unknown stellar radius remains unknown');
assert.equal(secondNodes.get('body-19').distanceToArrivalLs,null);
assert.ok(Object.values(secondNodes.get('body-19').orbit).every(value => value === null));
assert.ok(Object.values(secondNodes.get('body-25').orbit).every(value => value === null));
assert.equal(secondPlaces.get('edsm-station-910').bodyId,'body-24','Direct EDSM association takes precedence over a conflicting Spansh host');
assert.equal(secondPlaces.get('edsm-station-910').associationSource,undefined);
assert.equal(secondPlaces.get('edsm-station-910').sourceUpdatedAt,'2026-09-25 01:00:00');
assert.equal(secondPlaces.get('edsm-station-911').bodyId,'body-20','A verified market ID associates a second-system facility');
assert.equal(secondPlaces.get('edsm-station-911').associationSource.url,`https://spansh.co.uk/api/body/${exactBodyAddress}`,'Unsafe-size body addresses retain every decimal digit');
for (const id of ['edsm-station-912','edsm-station-913','edsm-station-914']) {
  assert.equal(secondPlaces.get(id).bodyId,null,'Legacy names, arrival distance and unmatched market IDs do not place another system’s facilities');
  assert.equal(secondPlaces.get(id).associationSource,undefined);
}
assert.doesNotMatch(secondPlaces.get('edsm-station-913').notes,/supplied Mongrel plan|active build/);
assert.ok(secondImported.sources.every(source => !source.reference && !/SRVSurvey|ten16|10-16/.test(JSON.stringify(source))),'Second-system provenance must be independent of the personal website and legacy plans');
assert.match(secondImported.sources.find(source => source.name === 'EDSM celestial bodies API').url,/systemName=Independent%20fixture$/);
assert.match(secondPlaces.get('edsm-station-911').source.url,/systemName=Independent%20fixture$/);
const secondHotspot = secondImported.locations.find(location => location.kind === 'ring-hotspot');
assert.equal(secondHotspot.name,'Platinum hotspots · 1 A Ring');
assert.equal(secondHotspot.ringId,'body-20-ring-1');
assert.equal(secondHotspot.hotspotCount,2);
assert.equal(secondHotspot.sourceUpdatedAt,'2026-09-24T05:04:01Z');
assert.equal(secondHotspot.source.url,`https://spansh.co.uk/api/body/${exactBodyAddress}`);
for (const location of secondImported.locations) {
  assert.equal(location.latitude,null);
  assert.equal(location.longitude,null);
  assert.equal(location.coordinatesKnown,false);
  assert.equal(location.positionKnown,Boolean(location.bodyId));
  if (location.kind !== 'ring-hotspot') assert.deepEqual(location.commodities,[]);
}
assert.equal(secondImported.locations.filter(location => location.kind === 'surface-deposit').length,0);
assert.throws(() => importSecond({...secondBodies,name:'Wrong system'}),/system name/);
assert.throws(() => importSecond(secondBodies,{...secondStations,name:'Wrong system'}),/system name/);
assert.throws(() => importSecond(secondBodies,{...secondStations,id64:'123456789124'}),/address mismatch/);
assert.throws(() => importSecond(secondBodies,secondStations,[],{name:secondSystem.name,id:'../invalid'}),/catalog ID/);
assert.throws(() => importSecond(secondBodies,secondStations,[{...secondSpansh[0],id64:Number(exactBodyAddress)}]),/decimal string/);
assert.throws(() => importSecond(secondBodies,secondStations,[{...secondSpansh[0],id64:'720576501199554867x'}]),/decimal string/);
assert.throws(() => importSecond(secondBodies,secondStations,[{...secondSpansh[0],record:{...secondSpansh[0].record,system_name:data.name}}]),/Spansh body does not match/);
assert.throws(() => importSecond(secondBodies,secondStations,[{...secondSpansh[0],record:{...secondSpansh[0].record,name:'Wrong body'}}]),/Spansh body name/);
assert.throws(() => importSecond({...secondBodies,bodies:secondBodies.bodies.map(body => body.bodyId === 20 ? {...body,parents:[{Planet:25}]} : body)},secondStations,[]),/Cyclic hierarchy/);

const importCoordinates = (type, coordinates, bodyReference=secondStations.stations[0].body) => importSecond(secondBodies,{
  ...secondStations,
  stations:[{...secondStations.stations[0],type,body:{...bodyReference,...coordinates}}],
},[]).locations[0];
for (const type of ['Odyssey Settlement','Planetary Outpost','Planetary Port']) {
  const surface = importCoordinates(type,{latitude:0,longitude:-73.1234567});
  assert.equal(surface.latitude,0,'A sourced equatorial coordinate is retained');
  assert.equal(surface.longitude,-73.1234567,'Surface source precision is not rounded');
  assert.equal(surface.coordinatesKnown,true);
  assert.equal(surface.positionKnown,true);
  assert.equal(surface.sourceUpdatedAt,'2026-09-25 01:00:00');
  assert.match(surface.notes,/Surface coordinates are reported by the EDSM station snapshot/);
}
const orbital = importCoordinates('Orbis Starport',{latitude:23.4567,longitude:78.9123});
assert.equal(orbital.bodyId,'body-24');
assert.equal(orbital.latitude,null,'Orbital coordinate fields do not establish a measured surface position');
assert.equal(orbital.longitude,null);
assert.equal(orbital.coordinatesKnown,false);
assert.match(orbital.notes,/coordinate fields for this non-surface facility/);
for (const coordinates of [{latitude:23.4567},{longitude:78.9123},{latitude:'23.4567',longitude:78.9123}]) {
  const partial = importCoordinates('Odyssey Settlement',coordinates);
  assert.equal(partial.latitude,null,'Incomplete or nonnumeric coordinate pairs remain unknown');
  assert.equal(partial.longitude,null);
  assert.equal(partial.coordinatesKnown,false);
}
const unassociatedSurface = importCoordinates('Odyssey Settlement',{latitude:23.4567,longitude:78.9123},{id:999,name:'Unknown body'});
assert.equal(unassociatedSurface.bodyId,null,'Coordinates alone cannot establish a host body');
assert.equal(unassociatedSurface.latitude,null);
assert.equal(unassociatedSurface.longitude,null);
for (const coordinates of [{latitude:91,longitude:0},{latitude:0,longitude:181}]) assert.throws(() => importCoordinates('Odyssey Settlement',coordinates),/Invalid coordinates/);

const unionSurveys = structuredClone(secondSpansh);
unionSurveys[0].record.updated_at = '2026-09-26T01:00:00Z';
unionSurveys[0].record.stations.push(
  {name:'A less complete duplicate',market_id:9100},
  {name:'Only in Spansh',market_id:9150,services:['Repair'],distance_to_arrival:123},
  {name:'Only in Spansh',market_id:9150,services:['Repair'],distance_to_arrival:123},
  {name:'Surveyed settlement',market_id:9160,type:'Settlement',updated_at:'2026-09-25T01:00:00Z'},
  {name:'Invalid market reference',market_id:'9170'},
);
const unionOriginal = structuredClone(unionSurveys);
const unionImported = importSecond(secondBodies,secondStations,unionSurveys);
assert.deepEqual(unionSurveys,unionOriginal,'Facility union leaves Spansh source records unchanged');
assert.equal(unionImported.locations.length,secondImported.locations.length + 2,'Facility union deduplicates matching market IDs');
assert.equal(unionImported.locations.filter(location => location.marketId === 9100).length,1);
assert.equal(unionImported.locations.find(location => location.marketId === 9100).id,'edsm-station-910');
assert.equal(unionImported.locations.find(location => location.marketId === 9100).name,'Direct fixture','The richer EDSM facility is retained even when Spansh names differ');
const spanshOnly = unionImported.locations.find(location => location.id === 'spansh-station-9150');
assert.equal(spanshOnly.bodyId,'body-20');
assert.equal(spanshOnly.kind,'station');
assert.equal(spanshOnly.type,'Unknown installation type','A facility’s unknown source type is not inferred from its name');
assert.equal(spanshOnly.latitude,null);
assert.equal(spanshOnly.longitude,null);
assert.equal(spanshOnly.coordinatesKnown,false);
assert.equal(spanshOnly.sourceUpdatedAt,null,'Body-record update time is not a facility update timestamp');
assert.equal(spanshOnly.source.recordUpdatedAt,'2026-09-26T01:00:00Z');
assert.equal(spanshOnly.source.url,`https://spansh.co.uk/api/body/${exactBodyAddress}`);
assert.equal(spanshOnly.distanceToArrivalLs,123);
assert.deepEqual(spanshOnly.services,['Repair']);
assert.equal(unionImported.locations.find(location => location.marketId === 9160).kind,'settlement');
assert.equal(unionImported.locations.find(location => location.marketId === 9160).sourceUpdatedAt,'2026-09-25T01:00:00Z');
assert.ok(!unionImported.locations.some(location => location.name === 'Invalid market reference'));
const conflictingHost = {id64:'720576501199554868',record:{system_name:secondSystem.name,body_id:23,name:`${secondSystem.name} 2`,stations:[{name:'Spansh fixture',market_id:9110}]}};
assert.throws(() => importSecond(secondBodies,secondStations,[...secondSpansh,conflictingHost]),/Conflicting Spansh station host/);

const readJSON = async path => JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const diaba = await readJSON('data/orrery/diaba.json');
const [diabaBodies,diabaStations,diabaSurveys,catalog] = await Promise.all([
  readJSON('data/fixtures/orrery/diaba/edsm-bodies.json'),
  readJSON('data/fixtures/orrery/diaba/edsm-stations.json'),
  readJSON('data/fixtures/orrery/diaba/spansh-bodies.json'),
  readJSON('data/orrery/systems.json'),
]);
const diabaOriginal = structuredClone([diabaBodies,diabaStations,diabaSurveys]);
const reimportedDiaba = normalizeEDSMSystem(diabaBodies,diabaStations,diaba.sources[0].retrievedAt,diabaSurveys,{name:'Diaba',id:'diaba'});
assert.deepEqual(reimportedDiaba,diaba,'The checked-in Diaba snapshot is reproduced exactly by the reusable importer and public source fixtures');
assert.deepEqual([diabaBodies,diabaStations,diabaSurveys],diabaOriginal,'Real source snapshots remain read-only during import');
assert.equal(diaba.id64,'2558022062802');
assert.equal(diaba.bodies.length,15);
for (const [kind,count] of Object.entries({star:1,planet:3,moon:11,barycentre:0})) assert.equal(diaba.bodies.filter(body => body.kind === kind).length,count,`Diaba ${kind} coverage`);
assert.equal(diaba.bodies.flatMap(body => body.rings).length,1);
assert.equal(diaba.bodies.flatMap(body => body.belts).length,2);
const diabaNodes = new Map(diaba.bodies.map(body => [body.id,body]));
assert.equal(diabaNodes.get('body-20').name,'Diaba 1 f a');
assert.equal(diabaNodes.get('body-20').parentId,'body-19','Diaba’s moon of a moon retains its immediate host');
assert.equal(diabaNodes.get('body-19').parentId,'body-13');
assert.equal(diabaNodes.get('body-13').parentId,'body-0');
assert.equal(diabaNodes.get('body-20').orbit.eccentricity,null,'An unpublished orbital element stays unknown');
assert.ok(Object.values(diabaNodes.get('body-0').orbit).every(value => value === null));
assert.equal(diaba.locations.length,38);
assert.equal(diaba.locations.filter(location => location.id.startsWith('edsm-station-')).length,28);
assert.equal(diaba.locations.filter(location => location.id.startsWith('spansh-station-')).length,10);
assert.equal(new Set(diaba.locations.map(location => location.marketId)).size,38,'The two providers produce one facility per market identity');
assert.equal(diaba.locations.filter(location => location.bodyId).length,35);
const unplacedDiaba = diaba.locations.filter(location => !location.bodyId);
assert.equal(unplacedDiaba.length,3);
assert.ok(unplacedDiaba.every(location => location.kind === 'carrier'),'Unknown carrier hosts remain unplaced');
assert.equal(diaba.locations.filter(location => location.coordinatesKnown).length,10);
assert.equal(diaba.locations.filter(location => ['ring-hotspot','surface-deposit'].includes(location.kind)).length,0,'Ring presence and material composition do not establish resource sites');
for (const location of diaba.locations) {
  assert.equal(location.positionKnown,Boolean(location.bodyId));
  assert.deepEqual(location.commodities,[]);
  if (location.bodyId) assert.ok(diabaNodes.has(location.bodyId));
  if (location.coordinatesKnown) {
    assert.ok(['Odyssey Settlement','Planetary Outpost','Planetary Port'].includes(location.type));
    assert.ok(Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90);
    assert.ok(Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180);
  } else {
    assert.equal(location.latitude,null);
    assert.equal(location.longitude,null);
  }
  if (location.id.startsWith('spansh-station-')) {
    assert.equal(location.sourceUpdatedAt,null);
    assert.ok(location.source.recordUpdatedAt);
    assert.match(location.source.url,/^https:\/\/spansh.co.uk\/api\/body\/\d+$/);
  }
}
const pryors = diaba.locations.find(location => location.name === 'Pryor Keep');
assert.equal(pryors.bodyId,'body-21');
assert.equal(pryors.latitude,40.201);
assert.equal(pryors.longitude,-37.974);
const niijima = diaba.locations.find(location => location.name === 'Niijima Station');
assert.equal(niijima.bodyId,'body-14');
assert.equal(niijima.coordinatesKnown,false,'Orbital facilities keep host association without using anomalous source coordinates');
const stephenson = diaba.locations.find(location => location.name === 'Stephenson Base');
assert.equal(stephenson.bodyId,'body-15');
assert.equal(stephenson.type,'Unknown installation type');
assert.equal(diaba.locations.find(location => location.name === 'Osuigwe Agricultural Exchange').kind,'settlement');
assert.ok(diaba.sources.every(source => !source.reference && !/SRVSurvey|ten16|10-16/.test(JSON.stringify(source))));
assert.equal(catalog.defaultSystemId,data.id,'The existing default system remains 10-16');
assert.equal(catalog.systems.find(system => system.id === data.id).locationProvider.url,'https://ten16-archive.pages.dev/api/mining?format=poi');
assert.equal(catalog.systems.find(system => system.id === diaba.id).file,'diaba.json');
assert.equal(catalog.systems.find(system => system.id === diaba.id).locationProvider,undefined,'Diaba has no dependency on the personal 10-16 provider');
assert.deepEqual(applyLocationPayload(diaba,{schemaVersion:1,systemId64:diaba.id64,locations:[]}),diaba,'An optional empty Diaba curated layer preserves imported core data');
console.log('Orrery data smoke checks passed: real hierarchy, provenance, unknown positions and reusable offline imports.');
