import { validateSystem, getRecords, filterRecords, classifyLocationPlacement, locationPlacementText } from '../../lib/orrery-model.js';
import { loadLocationProvider } from '../../lib/orrery-locations.js';

const $ = id => document.getElementById(`orrery-${id}`);
const state = { system:null, records:new Map(), renderer:null, selectedId:null, catalog:null, loadVersion:0, rendererVersion:0 };
const initial = new URLSearchParams(location.search);
const friendlyKind = kind => ({ 'surface-deposit':'Surface deposit', 'ring-hotspot':'Ring hotspot', barycentre:'Shared orbital centre', carrier:'Fleet carrier' }[kind] || kind.charAt(0).toUpperCase() + kind.slice(1));
const number = (value, unit = '', digits = 2) => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits:digits })}${unit ? ` ${unit}` : ''}` : 'Unknown';
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
function action(text, callback, className = 'orrery-button') { const button = node('button', text, className); button.type = 'button'; button.addEventListener('click', callback); return button; }
function safeLink(text, url) {
  try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) return node('span', text); }
  catch { return node('span', text); }
  const link = node('a', text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function filters() { return { query:$('search').value, kind:$('kind').value, resource:$('resource').value }; }
function saveUrl() {
  const url = new URL(location.href), f = filters();
  for (const [key, value] of Object.entries({ system:state.system.id, object:state.selectedId, q:f.query, kind:f.kind === 'all' ? null : f.kind, resource:f.resource === 'all' ? null : f.resource })) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
}

function renderResults() {
  if (!state.system) return;
  const f = filters(), matches = filterRecords(state.system, f), root = $('results');
  root.replaceChildren();
  for (const record of matches) {
    const title = record.recordType === 'body' ? record.shortName || record.name : record.name;
    const button = action('', () => select(record.id, true), 'orrery-object');
    button.dataset.objectId = record.id;
    button.setAttribute('aria-pressed', String(record.id === state.selectedId));
    const host = state.system.bodies.find(body => body.id === record.bodyId);
    button.append(node('strong', title), node('small', `${friendlyKind(record.kind)}${record.recordType === 'body' ? ` · ${record.subType || ''}` : host ? ` · ${host.shortName || host.name}` : ' · Host unknown'}`));
    if (record.recordType === 'location') {
      const placement = classifyLocationPlacement(record);
      button.dataset.placement = placement;
      button.append(node('small', locationPlacementText[placement]));
    }
    root.append(button);
  }
  if (!matches.length) root.append(node('p', 'No known records match these filters. Data coverage is incomplete; clear filters to see all objects.', 'orrery-empty'));
  $('count').textContent = `${matches.length} / ${getRecords(state.system).filter(record => record.kind !== 'barycentre').length} objects`;
  const active = !!f.query.trim() || f.kind !== 'all' || f.resource !== 'all';
  const bodyIds = new Set(matches.map(record => record.bodyId).filter(Boolean)), locationIds = new Set(matches.filter(record => record.recordType === 'location').map(record => record.id));
  state.renderer?.setFilters({ bodyIds:active ? bodyIds : null, locationIds:active ? locationIds : null });
}

function renderDetails(record) {
  const root = $('details'); root.replaceChildren();
  root.append(node('p', friendlyKind(record.kind), 'orrery-kicker'), node('h3', record.recordType === 'body' ? record.shortName || record.name : record.name));
  root.append(node('p', record.recordType === 'body' ? record.subType || 'Orbital hierarchy node' : record.type || friendlyKind(record.kind)));
  const focusable = record.recordType === 'body' || record.bodyId;
  const actions = node('div', null, 'orrery-detail-actions');
  if (focusable) actions.append(action('Focus in 3D', () => { state.renderer?.focus(record.id); if (!state.renderer) $('status').textContent = '3D unavailable · directory remains usable'; }));
  if (record.latitude != null && record.longitude != null) actions.append(action('Copy coordinates', async () => {
    try { await navigator.clipboard.writeText(`${record.latitude}, ${record.longitude}`); $('status').textContent = 'Coordinates copied'; }
    catch { $('status').textContent = `Coordinates: ${record.latitude}, ${record.longitude}`; }
  }));
  root.append(actions);
  const dl = node('dl');
  const pair = (label, value) => { dl.append(node('dt', label), node('dd', value)); };
  const host = state.system.bodies.find(body => body.id === (record.recordType === 'body' ? record.parentId : record.bodyId));
  if (host) pair(record.recordType === 'body' ? 'Orbits' : 'Host body', host.shortName || host.name);
  if (record.recordType === 'body') {
    pair('Arrival distance', number(record.distanceToArrivalLs, 'ls', 0)); pair('Radius', number(record.radiusKm, 'km', 0));
    if (record.kind !== 'star' && record.kind !== 'barycentre') { pair('Landable', record.isLandable ? 'Yes' : 'No'); pair('Gravity', number(record.gravity, 'g')); }
    pair('Temperature', number(record.temperatureK, 'K', 0));
    if (record.orbit?.periodDays != null) pair('Orbital period', number(record.orbit.periodDays, 'days'));
    if (record.orbit?.semiMajorAxisAu != null) pair('Semi-major axis', number(record.orbit.semiMajorAxisAu, 'AU', 4));
  } else if (record.recordType === 'ring') {
    pair('Type', record.type || 'Unknown'); pair('Inner radius', number(record.innerRadiusKm, 'km', 0)); pair('Outer radius', number(record.outerRadiusKm, 'km', 0));
  } else {
    pair('Arrival distance', number(record.distanceToArrivalLs, 'ls', 0));
    pair('Map placement', locationPlacementText[classifyLocationPlacement(record)]);
    if (record.hotspotCount != null) pair('Surveyed signals', number(record.hotspotCount, '', 0));
    if (record.surfaceMining?.signal != null) pair('Mining location signal', String(record.surfaceMining.signal));
    if (record.surfaceMining?.rigs != null) pair('Mining rigs', String(record.surfaceMining.rigs));
    if (typeof record.surfaceMining?.preferred === 'boolean') pair('Preferred site', record.surfaceMining.preferred ? 'Yes' : 'No');
    if (record.surfaceMining?.bodyType) pair('Recorded body type', record.surfaceMining.bodyType);
    if (record.materialAmount != null) pair('Reported material amount', String(record.materialAmount));
    if (record.materialUpdatedAt) pair('Material report updated', record.materialUpdatedAt);
    if (record.economy) pair('Economy', record.economy);
    if (record.controllingFaction) pair('Faction', record.controllingFaction);
    if (record.latitude != null) { pair('Latitude', number(record.latitude, '°', 6)); pair('Longitude', number(record.longitude, '°', 6)); }
    else pair('Coordinates', 'Unknown');
    if (record.ringId) pair('Ring', state.records.get(record.ringId)?.name || record.ringId);
  }
  root.append(dl);
  if (record.notes) root.append(node('p', record.notes));
  if (record.recordType === 'location' && ['host', 'ring'].includes(classifyLocationPlacement(record))) root.append(node('p', 'The amber diamond marks an association only. Dashed lanes arrange host markers for readability; they do not establish an actual orbit or surface position. Use the in-game navigation panel for this destination’s actual position.'));
  if (record.recordType === 'body' && record.kind === 'barycentre') root.append(node('p', 'Shared parent preserved from the real hierarchy. Orbital elements for this centre are unreported; display placement is schematic.'));
  if (record.materials?.length) {
    root.append(node('h4', 'Engineering raw materials'));
    const materials = node('div', null, 'orrery-materials');
    for (const material of record.materials) materials.append(action(`${material.name} ${number(material.percentage, '%')}`, () => { $('resource').value = material.name; renderResults(); saveUrl(); }, ''));
    root.append(materials, node('p', 'Body composition does not identify a commodity deposit or a surveyed mining site.'));
  }
  if (record.commodities?.length) root.append(node('h4', 'Known commodities'), node('p', record.commodities.join(', ')));
  if (record.resourceTags?.length) root.append(node('h4', 'Resource tags'), node('p', record.resourceTags.join(', ')));
  if (record.services?.length) root.append(node('h4', 'Reported services'), node('p', record.services.join(' · ')));
  const related = record.recordType === 'body' ? [
    ...state.system.bodies.filter(body => body.parentId === record.id),
    ...(record.rings || []),
    ...state.system.locations.filter(location => location.bodyId === record.id),
  ] : host ? [host] : [];
  if (related.length) {
    root.append(node('h4', record.recordType === 'body' ? 'Moons, rings & locations' : 'Host body'));
    const list = node('div', null, 'orrery-detail-links');
    for (const item of related) list.append(action(item.shortName || item.name, () => select(item.id, true), ''));
    root.append(list);
  }
  if (record.belts?.length) { root.append(node('h4', 'Asteroid belts')); for (const belt of record.belts) root.append(node('p', `${belt.name} · ${belt.type}`)); }
  if (record.sourceUpdatedAt) root.append(node('p', `Source record updated: ${record.sourceUpdatedAt} UTC. Snapshot data can lag the game.`));
  const source = record.source;
  if (source?.url) root.append(safeLink(`Source: ${source.name || 'EDSM'} ↗`, source.url));
  if (source?.reference) root.append(node('p', `${source.name || 'Source'} · ${source.reference}`));
  if (!source?.url && (record.recordType === 'body' || record.recordType === 'ring')) root.append(safeLink('EDSM body catalogue ↗', `https://www.edsm.net/en/system/bodies/id/${state.system.edsmId}`));
  if (record.associationSource) root.append(node('p', `Host association: ${record.associationSource.name || 'Mongrel reference'}${record.associationSource.reference ? ` · ${record.associationSource.reference.split('/').pop()}` : ''}`));
  if (record.associationSource?.url) root.append(safeLink('Host association source ↗', record.associationSource.url));
}

function select(id, focus = false) {
  const record = state.records.get(id); if (!record) return;
  state.selectedId = id; renderDetails(record); state.renderer?.select(id, { focus });
  for (const button of $('results').querySelectorAll('[data-object-id]')) button.setAttribute('aria-pressed', String(button.dataset.objectId === id));
  $('status').textContent = `Selected: ${record.shortName || record.name}`;
  saveUrl();
}

function showFallback(message) { $('fallback').hidden = false; $('fallback-message').textContent = message; $('status').textContent = 'Directory mode · 3D unavailable'; }
async function startRenderer() {
  const version = ++state.rendererVersion;
  state.renderer?.dispose(); state.renderer = null;
  $('fallback').hidden = true;
  try {
    const { createOrrery } = await import('./renderer.js');
    if (version !== state.rendererVersion || !state.system) return;
    state.renderer = createOrrery({ container:$('viewport'), system:state.system, onSelect:id => select(id), onError:() => {
      state.renderer?.dispose(); state.renderer = null; showFallback('WebGL was interrupted. Retry the 3D view or continue with the object directory.');
    } });
    state.renderer.setOrbits($('orbits').checked);
    state.renderer.setLabels($('labels').checked);
    $('status').textContent = '3D ready · select an object';
    renderResults();
    if (state.selectedId) state.renderer.select(state.selectedId);
  } catch { showFallback('WebGL could not start on this device. You can still search, select objects and read their details.'); }
}

async function loadSystem(id, objectId) {
  const version = ++state.loadVersion;
  ++state.rendererVersion; state.renderer?.dispose(); state.renderer = null; state.system = null;
  state.records = new Map(); state.selectedId = null;
  $('details').replaceChildren(node('p', 'Loading object catalogue…', 'orrery-kicker'));
  $('status').textContent = 'Loading system…'; $('results').replaceChildren(); $('count').textContent = 'Loading…'; $('fallback').hidden = true;
  try {
    const entry = state.catalog.systems.find(item => item.id === id);
    if (!entry || !/^[a-z0-9-]+\.json$/.test(entry.file)) throw new Error('Unknown system');
    const response = await fetch(`../data/orrery/${entry.file}`); if (!response.ok) throw new Error('Data unavailable');
    let system = validateSystem(await response.json());
    let providerStatus = 'Shared resource source is not configured.';
    if (entry.locationProvider?.url) {
      try {
        const providerUrl = new URL(entry.locationProvider.url.replace('{systemId64}', encodeURIComponent(system.id64)), new URL('../data/orrery/', location.href));
        if (!['https:', 'http:'].includes(providerUrl.protocol) || (providerUrl.protocol !== 'https:' && providerUrl.origin !== location.origin)) throw new Error('Invalid provider URL');
        system = await loadLocationProvider(system, providerUrl.href, { signal:AbortSignal.timeout(6000) });
        const count = system.locations.filter(item => item.canonicalId).length;
        providerStatus = count ? `${count} location records loaded from the shared resource interface.` : 'Shared resource interface connected · no canonical location records supplied yet.';
      } catch { providerStatus = 'Shared resource source unavailable. The body catalogue and sourced snapshot locations remain usable.'; }
    }
    if (version !== state.loadVersion) return;
    state.system = system; state.records = new Map(getRecords(system).map(record => [record.id, record])); state.selectedId = null;
    $('system-name').textContent = system.name;
    const resource = $('resource').value; $('resource').replaceChildren(new Option('All resources', 'all'));
    const names = [...new Set(getRecords(system).flatMap(record => record.resources))].sort();
    for (const name of names) $('resource').append(new Option(name, name));
    $('resource').value = names.includes(resource) ? resource : 'all';
    const notes = $('source-notes'); notes.replaceChildren();
    const physical = system.bodies.filter(body => body.kind !== 'barycentre').length, placed = system.locations.filter(item => item.bodyId).length;
    notes.append(node('p', `${physical} celestial bodies · ${system.bodies.length - physical} shared orbital centres · ${system.locations.length} locations (${placed} with known host bodies). Source snapshots may be incomplete or stale.`), node('p', providerStatus));
    const sources = node('ul');
    for (const source of system.sources || []) { const li = node('li'); li.append(source.url ? safeLink(source.name, source.url) : node('span', source.name)); if (source.retrievedAt) li.append(document.createTextNode(` · Snapshot ${new Date(source.retrievedAt).toLocaleDateString()}`)); sources.append(li); }
    notes.append(sources);
    renderResults(); select(state.records.has(objectId) ? objectId : system.bodies.find(body => body.kind === 'star').id);
    await startRenderer();
  } catch {
    if (version !== state.loadVersion) return;
    showFallback('System data could not load. Check your connection and retry.'); $('results').append(node('p', 'System data unavailable. Use Retry 3D view to reload the catalogue.', 'orrery-empty')); $('count').textContent = 'Unavailable';
  }
}

async function init() {
  try {
    const response = await fetch('../data/orrery/systems.json'); if (!response.ok) throw new Error('Catalogue unavailable');
    state.catalog = await response.json();
    if (state.catalog.schemaVersion !== 1 || !Array.isArray(state.catalog.systems) || !state.catalog.systems.length) throw new Error('Invalid catalogue');
    $('system').replaceChildren(); for (const entry of state.catalog.systems) $('system').append(new Option(entry.name, entry.id));
    const id = state.catalog.systems.some(item => item.id === initial.get('system')) ? initial.get('system') : state.catalog.defaultSystemId;
    $('system').value = id;
    $('search').value = initial.get('q') || ''; $('kind').value = initial.get('kind') || 'all'; if (!$('kind').value) $('kind').value = 'all';
    await loadSystem(id, initial.get('object'));
    if (initial.get('resource') && [...$('resource').options].some(option => option.value === initial.get('resource'))) { $('resource').value = initial.get('resource'); renderResults(); saveUrl(); }
  } catch { showFallback('The system catalogue could not load. Check your connection and retry.'); }
}

for (const name of ['search', 'kind', 'resource']) $(name).addEventListener(name === 'search' ? 'input' : 'change', () => { renderResults(); if (state.system) saveUrl(); });
$('clear').addEventListener('click', () => { $('search').value = ''; $('kind').value = 'all'; $('resource').value = 'all'; renderResults(); if (state.system) saveUrl(); });
$('system').addEventListener('change', () => loadSystem($('system').value));
$('retry').addEventListener('click', () => state.system ? startRenderer() : state.catalog ? loadSystem($('system').value) : init());
$('reset').addEventListener('click', () => state.renderer?.reset());
$('zoom-in').addEventListener('click', () => state.renderer?.zoom(0.8)); $('zoom-out').addEventListener('click', () => state.renderer?.zoom(1.25));
for (const [name, x, y] of [['left', -40, 0], ['right', 40, 0], ['up', 0, -40], ['down', 0, 40]]) $(`pan-${name}`).addEventListener('click', () => state.renderer?.pan(x, y));
$('orbits').addEventListener('change', () => state.renderer?.setOrbits($('orbits').checked)); $('labels').addEventListener('change', () => state.renderer?.setLabels($('labels').checked));
window.addEventListener('pagehide', () => { ++state.rendererVersion; state.renderer?.dispose(); state.renderer = null; });
window.addEventListener('pageshow', event => { if (event.persisted && state.system) startRenderer(); });
init();
