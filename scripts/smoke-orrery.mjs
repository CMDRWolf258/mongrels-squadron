import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSystem, surfaceVector, buildLayout, getRecords, filterRecords, joinLocations, classifyLocationPlacement, buildLocationLayout, buildRingLayout } from '../lib/orrery-model.js';
import { applyLocationPayload, loadLocationProvider } from '../lib/orrery-locations.js';
import { bodyVisualProfile, ringVisualProfile, visualSeed } from '../js/orrery/body-materials.js';

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

const visualSamples = [
  [{ id:'earth', kind:'planet', subType:'Earth-like world', atmosphere:'Suitable for water-based life', temperatureK:290 }, 'earthlike'],
  [{ id:'gas', kind:'planet', subType:'Class III gas giant', atmosphere:'No atmosphere', temperatureK:390 }, 'gas'],
  [{ id:'ice', kind:'moon', subType:'Icy body', atmosphere:'No atmosphere', temperatureK:120 }, 'icy'],
  [{ id:'metal', kind:'planet', subType:'High metal content world', atmosphere:'Hot thick Carbon dioxide-rich', temperatureK:900 }, 'metal'],
  [{ id:'star-visual', kind:'star', subType:'F (White) Star', temperatureK:6500 }, 'star'],
];
for (const [body, category] of visualSamples) {
  const first = bodyVisualProfile(body), second = bodyVisualProfile(structuredClone(body));
  assert.equal(first.category, category, `Visual profile recognizes ${category}`);
  assert.deepEqual(first, second, `Visual profile for ${category} is deterministic`);
  assert.ok(Number.isInteger(first.baseColor) && first.baseColor >= 0 && first.baseColor <= 0xffffff);
}
assert.equal(bodyVisualProfile(visualSamples[3][0]).hasAtmosphere, true, 'Known atmosphere adds an atmosphere shell profile');
assert.equal(bodyVisualProfile(visualSamples[2][0]).hasAtmosphere, false, 'No-atmosphere body does not receive an atmosphere shell');
assert.equal(visualSeed('stable-body'), visualSeed('stable-body'), 'Visual seeds are stable');
assert.notEqual(visualSeed('stable-body'), visualSeed('different-body'), 'Different body IDs normally receive different visual seeds');
assert.ok(ringVisualProfile({ type:'Icy' }).baseColor !== ringVisualProfile({ type:'Rocky' }).baseColor, 'Ring composition changes procedural ring palette');
console.log('✓ Orrery visual profiles are deterministic, body-informed and atmosphere-aware');
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
assert.match(html, /id="orrery-presets"/, 'Orrery exposes layer presets');
assert.match(html, /id="orrery-hierarchy"/, 'Orrery exposes a structural hierarchy navigator');
assert.match(html, /id="orrery-breadcrumb"/, 'Orrery exposes a shareable local-view breadcrumb');
const controller = read('js/orrery/app.js');
assert.match(controller, /systems\.json/, 'Controller uses the system catalog');
assert.match(controller, /orrery-model\.js/, 'Controller uses the shared model');
assert.match(controller, /orrery-locations\.js/, 'Controller uses the reusable canonical provider');
for (const token of ['LAYER_PRESETS','enterLocalView','exitLocalView','renderHierarchy','renderBreadcrumb','localFocusBodyId','treeExpanded']) assert.ok(controller.includes(token), `Orrery functionality controller missing: ${token}`);
assert.match(controller, /view:state\.layerPreset/, 'Layer preset persists in the Orrery URL');
assert.match(controller, /focus:state\.localFocusBodyId/, 'Local focus persists in the Orrery URL');
const renderer = read('js/orrery/renderer.js');
assert.match(renderer, /from ['"]\.\.\/\.\.\/vendor\/three\/three\.module\.js['"]/, 'Three.js is pinned locally');
assert.match(renderer, /from ['"]\.\.\/\.\.\/vendor\/three\/OrbitControls\.js['"]/, 'Camera controls are pinned locally');
assert.match(renderer, /body-materials\.js/, 'Renderer uses the isolated procedural body-material layer');
assert.match(renderer, /createBodyVisual/, 'Renderer creates procedural body surfaces');
assert.match(renderer, /createRingMaterial/, 'Renderer creates procedural ring materials');
assert.match(renderer, /PointLight/, 'Catalogued stars provide the primary directional lighting cue');
assert.match(renderer, /ACESFilmicToneMapping/, 'Orrery uses restrained tone mapping for procedural body contrast');
assert.match(renderer, /depthTest:false/, 'Location markers remain visually legible over procedural body materials');
assert.match(renderer, /frontFacing/, 'Exact surface markers still hide on the far side of their host body');
assert.match(renderer, /setFocusedVisual/, 'Renderer promotes only the focused body to high detail');
assert.match(renderer, /detailController\?\.setFocused/, 'Focused-body detail is explicitly enabled and released');
for (const token of ['setLayerPreset','setLocalFocus','presetAllows','localFactor','rebuildLocalSets','applyVisibility']) assert.ok(renderer.includes(token), `Orrery renderer functionality missing: ${token}`);
assert.match(renderer, /localAncestorIds/, 'Local focus retains faint ancestor context');
assert.match(renderer, /surface-deposit.*ring-hotspot/s, 'Mining preset includes both surface and ring mining layers');
const bodyMaterials = read('js/orrery/body-materials.js');
for (const token of ['CanvasTexture','DataTexture','ShaderMaterial','earthlike','gas','icy','metal','atmosphereColor','createGlowTexture','ringVisualProfile','createSphericalFractal','createNormalTexture','createCloudTexture','detailController','setVisualOpacity']) assert.ok(bodyMaterials.includes(token), `Procedural body material feature missing: ${token}`);
assert.match(bodyMaterials, /quality === 'focus'[\s\S]*width:384/, 'Focused bodies promote to a bounded high-detail texture');
assert.match(bodyMaterials, /disposeMaps\(focusedMaps\)/, 'Focused high-detail maps are released when no longer needed');
assert.match(bodyMaterials, /Rings are navigation features[\s\S]*MeshBasicMaterial/, 'Procedural rings remain unlit and visible independent of star angle');
assert.doesNotMatch(bodyMaterials, /fetch\(|https?:\/\//, 'Procedural body rendering must not add network dependencies');
const orreryCss = read('css/orrery.css');
for (const selector of ['.orrery-layer-bar','.orrery-hierarchy-panel','.orrery-tree-row','.orrery-breadcrumb','.orrery-local-badge']) assert.ok(orreryCss.includes(selector), `Orrery functionality style missing: ${selector}`);
for (const file of ['vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/OrbitControls.js','vendor/three/LICENSE']) assert.ok(existsSync(resolve(root,file)), `Missing local dependency: ${file}`);
assert.doesNotMatch(read('vendor/three/OrbitControls.js'), /from ['"]three['"]/, 'OrbitControls resolves its local Three.js dependency');
console.log('✓ Orrery catalog, page, modules and local WebGL dependencies are wired');
// Test the actual placement offsets consumed by the renderer, including joined
// canonical locations, without needing WebGL or substituting source coordinates.
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const ordered = map => [...map].sort(([a], [b]) => a.localeCompare(b));
for (const system of [fixture, withCanonical, ...systems.map(entry => JSON.parse(read(`data/orrery/${entry.file}`)))]) {
  const before = JSON.stringify(system), bodyLayout = buildLayout(system);
  const places = buildLocationLayout(system, bodyLayout);
  const reversed = copy(system); reversed.locations.reverse();
  assert.deepEqual(ordered(buildLocationLayout(reversed)), ordered(places), 'Input reordering does not scatter facilities or ring POIs');
  for (const location of system.locations) {
    const placement = classifyLocationPlacement(location), entry = places.get(location.id);
    if (placement === 'unplaced') {
      assert.equal(entry, undefined, 'Unplaced locations receive no display position');
      assert.ok(getRecords(system).some(record => record.id === location.id), 'Unplaced records remain listed');
      continue;
    }
    assert.equal(entry.placement, placement);
    const value = bodyLayout.get(location.bodyId);
    if (placement === 'surface') {
      assert.deepEqual(entry.offset, surfaceVector(location.latitude, location.longitude, value.radius + entry.markerRadius * 1.1), 'Measured sites retain their exact latitude/longitude direction');
      assert.equal(entry.laneRadius, undefined, 'Measured positions never join a schematic lane');
    } else if (placement === 'ring') {
      const body = system.bodies.find(body => body.id === location.bodyId);
      const band = buildRingLayout(body, value).get(location.ringId);
      const [x, y, z] = entry.offset, i = value.inclination;
      const alongPlane = -y * Math.sin(i) + z * Math.cos(i);
      const normal = y * Math.cos(i) + z * Math.sin(i);
      near(Math.hypot(x, alongPlane), (band.inner + band.outer) / 2, 'POI stays midway in its own annulus');
      near(normal, entry.markerRadius * 0.6, 'Ring marker shares its ring orientation');
    } else {
      near(Math.hypot(...entry.offset), entry.laneRadius, 'Host markers share a clean circular lane');
      const body = system.bodies.find(body => body.id === location.bodyId);
      const outer = Math.max(value.radius, ...[...buildRingLayout(body, value).values()].map(band => band.outer));
      assert.ok(entry.laneRadius - entry.markerRadius > outer, 'Schematic facilities clear their host and its rings');
    }
  }
  const schematic = system.locations.filter(location => ['host', 'ring'].includes(classifyLocationPlacement(location)));
  for (const [index, a] of schematic.entries()) for (const b of schematic.slice(index + 1)) {
    if (a.bodyId !== b.bodyId) continue;
    const ap = places.get(a.id), bp = places.get(b.id);
    assert.ok(distance(ap.offset, bp.offset) > (ap.markerRadius + bp.markerRadius) * 1.5, 'Schematic markers around the same host remain distinguishable');
  }
  for (const body of system.bodies) {
    let previousOuter = 0;
    for (const band of buildRingLayout(body, bodyLayout.get(body.id)).values()) {
      assert.ok(band.inner > previousOuter, 'Different ring associations have separate visual annuli');
      previousOuter = band.outer;
    }
  }
  assert.equal(JSON.stringify(system), before, 'Display layout leaves resources, source coordinates and associations unchanged');
}
const crowded = copy(fixture);
crowded.locations.push(...Array.from({length:37}, (_, index) => ({id:`crowded-${String(index).padStart(2, '0')}`, name:`Unknown-position facility ${index}`, kind:'station', bodyId:'planet', latitude:null, longitude:null})));
const crowdedPlaces = buildLocationLayout(crowded);
assert.equal(new Set(crowded.locations.filter(location => location.id.startsWith('crowded-')).map(location => crowdedPlaces.get(location.id).lane)).size, 4, 'Dense hosts use spaced lanes');
for (const [index, a] of crowded.locations.entries()) for (const b of crowded.locations.slice(index + 1)) {
  if (!a.id.startsWith('crowded-') || !b.id.startsWith('crowded-')) continue;
  const ap = crowdedPlaces.get(a.id), bp = crowdedPlaces.get(b.id);
  assert.ok(distance(ap.offset, bp.offset) > 3 * ap.markerRadius, 'Dense lane markers do not overlap');
}
const baselinePlaces = buildLocationLayout(fixture);
const extraExact = copy(fixture);
extraExact.locations.push({id:'extra-measured', name:'Measured addition', kind:'surface-deposit', bodyId:'submoon', latitude:0, longitude:0});
assert.deepEqual(buildLocationLayout(extraExact).get('station'), baselinePlaces.get('station'), 'Surface additions do not change a facility slot');
const extraRing = copy(fixture);
extraRing.locations.push({id:'extra-ring', name:'Ring addition', kind:'ring-hotspot', bodyId:'planet', ringId:'ring'});
assert.deepEqual(buildLocationLayout(extraRing).get('station'), baselinePlaces.get('station'), 'Ring additions do not change a facility slot');
assert.ok(filterRecords(fixture, {query:'Unknown association'}).some(record => record.id === 'unplaced'), 'Unplaced facilities remain searchable');
console.log('✓ Measured, host, ring and unplaced locations retain evidence and deterministic, separated display placement');
console.log('All Orrery smoke checks passed.');
