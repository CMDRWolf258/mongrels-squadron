import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSystem, surfaceVector, buildLayout, getRecords, filterRecords, joinLocations } from '../lib/orrery-model.js';
import { applyLocationPayload, loadLocationProvider } from '../lib/orrery-locations.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const copy = value => structuredClone(value);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} !== ${expected}`);
const ids = records => records.map(record => record.id).sort();
const fixture = {
  schemaVersion:1, id:'fixture', name:'Fixture system', id64:'123456789',
  bodies:[
    { id:'star', bodyId:0, name:'Fixture primary', kind:'star', parentId:null, radiusKm:700000, orbit:null, materials:[], rings:[] },
    { id:'pair', bodyId:19, name:'Pair centre', kind:'barycentre', parentId:'star', orbit:{ semiMajorAxisAu:null, periodDays:null, inclinationDeg:null }, rings:[] },
    { id:'planet', bodyId:20, name:'Atlas', kind:'planet', parentId:'pair', radiusKm:6000, orbit:{ semiMajorAxisAu:1, periodDays:300, inclinationDeg:35 }, materials:[{ name:'Iron', percentage:20 }], rings:[{ id:'ring', name:'Atlas A ring', type:'Rocky', innerRadiusKm:8000, outerRadiusKm:14000 }] },
    { id:'moon', bodyId:38, name:'Beacon', kind:'moon', parentId:'planet', radiusKm:700, orbit:{ semiMajorAxisAu:0.01, periodDays:3, inclinationDeg:90 }, materials:[{ name:'Nickel', percentage:15 }], rings:[] },
    { id:'submoon', bodyId:47, name:'Needle', kind:'moon', parentId:'moon', radiusKm:300, orbit:{ semiMajorAxisAu:0.001, periodDays:1, inclinationDeg:-15 }, materials:[], rings:[] },
  ],
  locations:[
    { id:'station', name:'Waypoint station', kind:'station', bodyId:'submoon', commodities:[], notes:'Refuel before mining.' },
    { id:'surface', name:'Mongrel field record', kind:'surface-deposit', bodyId:'planet', latitude:12, longitude:-34, commodities:['Cobalt'], notes:'Verified terrain note.', source:{ reference:'authoritative-fixture:surface' } },
    { id:'hotspot', name:'Prospector hotspot', kind:'ring-hotspot', bodyId:'planet', ringId:'ring', commodities:['Platinum'] },
    { id:'custom', name:'Pack rendezvous', kind:'custom', bodyId:'moon', commodities:[], notes:'Meet above the moon.' },
    { id:'unplaced', name:'Unknown association', kind:'installation', bodyId:null, latitude:null, longitude:null, commodities:[] },
  ],
};

assert.equal(validateSystem(fixture), fixture);
assert.equal(validateSystem(copy(fixture)).bodies.find(body => body.id === 'pair').orbit.semiMajorAxisAu, null, 'Unknown barycentre elements stay null');
const invalid = (mutate, pattern) => { const data = copy(fixture); mutate(data); assert.throws(() => validateSystem(data), pattern); };
invalid(data => data.bodies.push(copy(data.bodies[0])), /Duplicate/);
invalid(data => { data.bodies[2].parentId = 'missing'; }, /Missing parent/);
invalid(data => { data.bodies.reverse(); data.bodies.find(body => body.id === 'pair').parentId = 'missing'; }, /Missing parent/);
invalid(data => { data.bodies[1].parentId = 'submoon'; }, /Cyclic/);
invalid(data => { data.bodies[2].parentId = 'planet'; }, /Cyclic/);
invalid(data => { data.bodies[2].orbit.semiMajorAxisAu = -1; }, /Invalid orbit/);
invalid(data => { data.bodies[2].orbit.inclinationDeg = Infinity; }, /Invalid orbit/);
invalid(data => { data.locations[1].commodities = [42]; }, /Invalid commodities/);
invalid(data => { data.locations[0].bodyId = 'missing'; }, /Missing location body/);
invalid(data => { data.locations[2].ringId = 'missing'; }, /ring/);
invalid(data => { data.locations[2].bodyId = 'moon'; }, /ring/);
invalid(data => { data.locations[0].id = 'ring'; }, /Duplicate/);
invalid(data => { data.locations[0].kind = 'fictional'; }, /Invalid location/);
for (const [field, value] of [['latitude',91], ['latitude',-91], ['longitude',181], ['longitude',-181], ['latitude',NaN], ['longitude',Infinity], ['latitude','12']]) {
  invalid(data => { data.locations[1][field] = value; }, /Invalid coordinates/);
}
invalid(data => { data.locations[1].longitude = null; }, /Invalid coordinates/);
invalid(data => { data.locations[1].bodyId = null; }, /Invalid coordinates/);
const extremes = copy(fixture); extremes.locations[1].latitude = 90; extremes.locations[1].longitude = -180;
validateSystem(extremes);
console.log('✓ Orrery rejects broken graphs, references and coordinates while accepting unknown associations');

for (const [latitude, longitude, expected] of [
  [0,0,[1,0,0]], [0,90,[0,0,-1]], [0,-90,[0,0,1]], [0,180,[-1,0,0]], [90,0,[0,1,0]], [-90,0,[0,-1,0]],
]) surfaceVector(latitude, longitude).forEach((value, index) => near(value, expected[index], `Surface vector ${latitude}/${longitude} axis ${index}`));
near(Math.hypot(...surfaceVector(12,-34,3)), 3, 'Surface vectors preserve requested radius');

const original = JSON.stringify(fixture);
const layout = buildLayout(fixture);
assert.deepEqual(buildLayout(fixture), layout, 'Layout is deterministic across calls');
const reordered = copy(fixture); reordered.bodies.reverse();
for (const [id, entry] of layout) assert.deepEqual(buildLayout(reordered).get(id), entry, `Layout does not depend on source order: ${id}`);
for (const body of fixture.bodies) {
  const entry = layout.get(body.id);
  assert.ok(entry.position.every(Number.isFinite), `Finite position: ${body.id}`);
  assert.ok(entry.radius > 0 && Number.isFinite(entry.extent), `Finite visual size: ${body.id}`);
  if (!body.parentId) continue;
  const parent = layout.get(body.parentId).position;
  near(entry.position[0] - parent[0], entry.orbitRadius * Math.cos(entry.phase), `${body.id} parent-relative X`);
  near(entry.position[1] - parent[1], -entry.orbitRadius * Math.sin(entry.phase) * Math.sin(entry.inclination), `${body.id} inclined Y`);
  near(entry.position[2] - parent[2], entry.orbitRadius * Math.sin(entry.phase) * Math.cos(entry.inclination), `${body.id} inclined Z`);
  near(Math.hypot(...entry.position.map((value,index) => value-parent[index])), entry.orbitRadius, `${body.id} orbit length`);
}
assert.notEqual(layout.get('moon').position[1], layout.get('planet').position[1], 'Inclination places bodies outside a flat plane');
near(layout.get('moon').position[2], layout.get('planet').position[2], 'A 90° inclined orbit lies in its parent-relative XY plane');
assert.equal(JSON.stringify(fixture), original, 'Layout does not mutate source data');
console.log('✓ Orrery surface coordinates and deterministic parent-relative inclined layout are sound');

assert.equal(getRecords(fixture).length, 11, 'Every body, ring and location has a searchable record');
assert.deepEqual(ids(filterRecords(fixture, { kind:'bodies' })), ['moon','planet','star','submoon']);
assert.deepEqual(ids(filterRecords(fixture, { kind:'facilities' })), ['station','unplaced']);
assert.deepEqual(ids(filterRecords(fixture, { kind:'ring-hotspot', resource:'platinum' })), ['hotspot']);
assert.deepEqual(ids(filterRecords(fixture, { resource:'Iron' })), ['planet'], 'Body raw materials are distinct from site commodities');
assert.deepEqual(filterRecords(fixture, { kind:'surface-deposit', resource:'Iron' }), [], 'Body composition cannot imply a mineable commodity deposit');
assert.deepEqual(ids(filterRecords(fixture, { resource:'Cobalt' })), ['surface']);
assert.deepEqual(ids(filterRecords(fixture, { query:'  atlas  ' })), ['custom','hotspot','moon','planet','ring','station','submoon','surface'], 'Searching a parent finds objects in its descendant hierarchy');
assert.deepEqual(ids(filterRecords(fixture, { query:'atlas refuel', kind:'facilities' })), ['station'], 'Search combines ancestor, notes and object type');
assert.deepEqual(ids(filterRecords(fixture, { query:'platinum atlas' })), ['hotspot']);
assert.deepEqual(filterRecords(fixture, { query:'no-such-object' }), []);

const replacement = { ...fixture.locations[1], notes:'Updated authoritative field note.' };
const added = { id:'new-note', name:'New note', kind:'custom', bodyId:'planet', commodities:[] };
const joined = joinLocations(fixture, [replacement, added, added]);
assert.equal(joined.locations.length, fixture.locations.length + 1, 'Joining by stable ID does not duplicate records');
assert.equal(joined.locations.find(location => location.id === 'surface').notes, replacement.notes);
assert.equal(joined.locations.find(location => location.id === 'surface').source.reference, 'authoritative-fixture:surface', 'Joining preserves source identity');
assert.equal(new Set(joined.locations.map(location => location.id)).size, joined.locations.length);
assert.equal(JSON.stringify(fixture), original, 'Joining does not mutate the system snapshot');
assert.throws(() => joinLocations(fixture, [{ ...added, bodyId:'missing' }]), /Missing location body/);
console.log('✓ Orrery hierarchy search, resource filtering and authoritative location joins are sound');

const payload = {
  schemaVersion:1, systemId64:fixture.id64,
  locations:[
    { id:'personal-site-ore-1', name:'Canonical deposit', kind:'surface-deposit', bodyJournalId:20, latitude:12.3456, longitude:-78.9012, commodities:['Cobalt'], notes:'Original personal-site field notes.', source:{ url:'https://example.test/elite/sites/personal-site-ore-1' } },
    { id:'personal-site-ring-1', name:'Canonical hotspot', kind:'ring-hotspot', bodyJournalId:20, ringName:'Atlas A ring', commodities:['Platinum'], source:{ reference:'personal-site-ring-1' } },
    { id:'personal-site-note-1', name:'Canonical note', kind:'custom', bodyJournalId:38, commodities:[], notes:'Coordinates not surveyed.' },
  ],
};
const payloadOriginal = JSON.stringify(payload);
const withCanonical = applyLocationPayload(fixture, payload);
const deposit = withCanonical.locations.find(location => location.canonicalId === 'personal-site-ore-1');
assert.equal(deposit.id, 'canonical:personal-site-ore-1');
assert.equal(deposit.bodyId, 'planet', 'Canonical journal body ID resolves through the selected system');
assert.equal(deposit.latitude, 12.3456);
assert.equal(deposit.longitude, -78.9012);
assert.equal(deposit.coordinatesKnown, true);
assert.equal(deposit.notes, payload.locations[0].notes);
assert.deepEqual(deposit.source, payload.locations[0].source, 'Canonical provenance remains intact');
assert.equal(withCanonical.locations.find(location => location.canonicalId === 'personal-site-ring-1').ringId, 'ring');
const unknownCoordinates = withCanonical.locations.find(location => location.canonicalId === 'personal-site-note-1');
assert.equal(unknownCoordinates.latitude, null, 'No fallback coordinate is invented');
assert.equal(unknownCoordinates.longitude, null, 'No fallback coordinate is invented');
assert.equal(unknownCoordinates.coordinatesKnown, false);
assert.equal(applyLocationPayload(withCanonical, payload).locations.length, withCanonical.locations.length, 'Repeated provider loads replace original IDs without duplication');
assert.equal(applyLocationPayload(fixture, { schemaVersion:1, systemId64:fixture.id64, locations:[] }).locations.length, fixture.locations.length, 'An empty canonical dataset is valid');
assert.equal(JSON.stringify(fixture), original);
assert.equal(JSON.stringify(payload), payloadOriginal, 'Adapter does not edit provider-owned records');
const invalidPayload = (mutate, pattern) => { const data = copy(payload); mutate(data); assert.throws(() => applyLocationPayload(fixture, data), pattern); };
invalidPayload(data => { data.systemId64 = 'another-system'; }, /system\/schema mismatch/);
invalidPayload(data => { data.schemaVersion = 2; }, /system\/schema mismatch/);
invalidPayload(data => { data.locations[0].bodyJournalId = 999; }, /body unavailable/);
invalidPayload(data => { data.locations[0].bodyJournalId = 19; }, /body unavailable/);
invalidPayload(data => { data.locations[0].bodyJournalId = '20'; }, /journal body ID/);
invalidPayload(data => { data.locations[1].ringName = 'Unknown ring'; }, /ring unavailable/);
invalidPayload(data => { delete data.locations[1].ringName; }, /ring reference/);
invalidPayload(data => { data.locations[0].latitude = 91; }, /Invalid coordinates/);
invalidPayload(data => { delete data.locations[0].longitude; }, /Invalid coordinates/);
invalidPayload(data => { data.locations.push(copy(data.locations[0])); }, /Duplicate/);
invalidPayload(data => { data.locations[0].commodities = [42]; }, /commodities/);
invalidPayload(data => { data.locations[0].commodities = 'Cobalt'; }, /commodities/);
let requests = 0;
const abort = new AbortController();
const loaded = await loadLocationProvider(fixture, 'https://example.test/elite/locations', {
  signal:abort.signal,
  fetcher:async (url, options) => {
    requests++;
    assert.equal(url, 'https://example.test/elite/locations');
    assert.equal(options.signal, abort.signal);
    assert.equal(options.headers.Accept, 'application/json');
    return { ok:true, async json() { return payload; } };
  },
});
assert.equal(requests, 1);
assert.equal(loaded.locations.length, withCanonical.locations.length);
await assert.rejects(loadLocationProvider(fixture, '/missing', { fetcher:async () => ({ ok:false, status:503 }) }), /unavailable \(503\)/);
await assert.rejects(loadLocationProvider(fixture, '/bad-system', { fetcher:async () => ({ ok:true, async json() { return { ...payload, systemId64:'wrong' }; } }) }), /system\/schema mismatch/);
console.log('✓ Orrery canonical provider validates identities and coordinates without duplicating or inventing records');

const catalog = JSON.parse(read('data/orrery/systems.json'));
const actualSystem = JSON.parse(read('data/orrery/ngc-2546-uz-g-d10-16.json'));
const designationResults = filterRecords(actualSystem, { query:'6 d' });
assert.ok(designationResults.some(record => record.shortName === '6 d'), 'Real body designation can be found');
assert.ok(!designationResults.some(record => ['1', '12', '6 a', '6 e'].includes(record.shortName)), 'System-name digits and sibling centres do not pollute body designation search');
assert.equal(catalog.schemaVersion, 1);
const systems = catalog.systems;
assert.ok(Array.isArray(systems) && systems.length, 'System catalog supplies data documents');
assert.equal(new Set(systems.map(system => system.id)).size, systems.length, 'System catalog IDs are unique');
assert.ok(systems.some(system => system.id === catalog.defaultSystemId), 'Default system exists in the catalog');
for (const entry of systems) {
  const path = entry.file;
  assert.ok(typeof path === 'string' && !/^https?:/.test(path), 'Prototype system data is local');
  const file = resolve(root, 'data/orrery', path);
  assert.ok(file.startsWith(root + '/') || file.startsWith(root + '\\'), 'Catalog paths stay inside the repository');
  const system = JSON.parse(readFileSync(file, 'utf8'));
  validateSystem(system);
  assert.equal(system.id, entry.id, 'Catalog identity matches its data document');
  assert.ok(buildLayout(system).size === system.bodies.length, 'Complete hierarchy receives a layout');
  if (entry.locationProvider?.url && !/^https?:/.test(entry.locationProvider.url)) {
    const provider = JSON.parse(read(`data/orrery/${entry.locationProvider.url}`));
    applyLocationPayload(system, provider);
    assert.equal(provider.systemId64, system.id64, 'Configured local provider matches its system');
  }
}
const html = read('orrery/index.html');
assert.match(html, /type="module"[^>]+src="\.\.\/js\/orrery\/app\.js/, 'Orrery loads its isolated module controller');
assert.match(html, /\.\.\/css\/orrery\.css/, 'Orrery loads its scoped styles');
assert.match(html, /\.\.\/js\/site\.js/, 'Orrery uses shared navigation');
assert.match(html, /id="orrery-results"/, 'WebGL fallback retains a searchable directory');
assert.match(html, /id="orrery-fallback"/, 'WebGL failure has a visible fallback mount');
const controller = read('js/orrery/app.js');
assert.match(controller, /systems\.json/, 'Controller uses the system catalog');
assert.match(controller, /orrery-model\.js/, 'Controller uses the shared model');
assert.match(controller, /orrery-locations\.js/, 'Controller uses the reusable canonical provider');
const renderer = read('js/orrery/renderer.js');
assert.match(renderer, /from ['"]\.\.\/\.\.\/vendor\/three\/three\.module\.js['"]/, 'Three.js is pinned locally');
assert.match(renderer, /from ['"]\.\.\/\.\.\/vendor\/three\/OrbitControls\.js['"]/, 'Camera controls are pinned locally');
for (const file of ['vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/OrbitControls.js','vendor/three/LICENSE']) assert.ok(existsSync(resolve(root,file)), `Missing local dependency: ${file}`);
assert.doesNotMatch(read('vendor/three/OrbitControls.js'), /from ['"]three['"]/, 'OrbitControls resolves its local Three.js dependency');
console.log('✓ Orrery catalog, page, modules and local WebGL dependencies are wired');
console.log('All Orrery smoke checks passed.');
