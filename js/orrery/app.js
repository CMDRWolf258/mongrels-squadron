import { validateSystem, getRecords, filterRecords, classifyLocationPlacement, locationPlacementText } from '../../lib/orrery-model.js';
import { loadLocationProvider } from '../../lib/orrery-locations.js';
import { loadFacilityObservationProvider } from '../../lib/orrery-facility-observations.js?v=7';

const $ = id => document.getElementById(`orrery-${id}`);
const state = { system:null, records:new Map(), renderer:null, selectedId:null, catalog:null, loadVersion:0, rendererVersion:0, viewer:null, layerPreset:'everything', localFocusBodyId:null, treeExpanded:new Set() };
const initial = new URLSearchParams(location.search);
const LAYER_PRESETS = {
  navigation:{ label:'Navigation', help:'Bodies, rings, facilities and custom navigation POIs.' },
  mining:{ label:'Mining', help:'Bodies, rings, surface deposits and ring hotspots.' },
  facilities:{ label:'Facilities', help:'Bodies and stations, settlements, installations and carriers.' },
  everything:{ label:'Everything', help:'All mapped layers visible.' },
};
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
  if (!state.system) return;
  const url = new URL(location.href), f = filters();
  for (const [key, value] of Object.entries({
    system:state.system.id,
    object:state.selectedId,
    q:f.query,
    kind:f.kind === 'all' ? null : f.kind,
    resource:f.resource === 'all' ? null : f.resource,
    view:state.layerPreset === 'everything' ? null : state.layerPreset,
    focus:state.localFocusBodyId,
  })) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
}

function recordBodyId(record) {
  if (!record) return null;
  if (record.recordType === 'body') return record.id;
  return record.bodyId || null;
}

function bodyAncestorPath(bodyId) {
  if (!state.system || !bodyId) return [];
  const bodies = new Map(state.system.bodies.map(body => [body.id, body]));
  const path = [];
  let cursor = bodies.get(bodyId);
  while (cursor) {
    if (cursor.kind !== 'barycentre') path.unshift(cursor);
    cursor = cursor.parentId ? bodies.get(cursor.parentId) : null;
  }
  return path;
}

function localBodySet(bodyId) {
  const result = new Set();
  if (!state.system || !bodyId) return result;
  const children = new Map();
  for (const body of state.system.bodies) {
    const list = children.get(body.parentId ?? null) || [];
    list.push(body);
    children.set(body.parentId ?? null, list);
  }
  const visit = id => {
    const body = state.system.bodies.find(item => item.id === id);
    if (!body) return;
    if (body.kind !== 'barycentre') result.add(body.id);
    for (const child of children.get(id) || []) visit(child.id);
  };
  visit(bodyId);
  return result;
}

function recordIsInLocalFocus(record) {
  if (!state.localFocusBodyId) return true;
  const bodies = localBodySet(state.localFocusBodyId);
  return bodies.has(recordBodyId(record));
}

function setLayerPreset(name, { save = true } = {}) {
  state.layerPreset = LAYER_PRESETS[name] ? name : 'everything';
  for (const button of $('presets').querySelectorAll('[data-preset]')) {
    button.setAttribute('aria-pressed', String(button.dataset.preset === state.layerPreset));
  }
  $('preset-help').textContent = LAYER_PRESETS[state.layerPreset].help;
  state.renderer?.setLayerPreset(state.layerPreset);
  if (save) saveUrl();
}

function exitLocalView({ resetCamera = false, save = true } = {}) {
  state.localFocusBodyId = null;
  state.renderer?.setLocalFocus(null);
  if (resetCamera) state.renderer?.reset();
  renderHierarchy();
  renderBreadcrumb(state.records.get(state.selectedId));
  if (save) saveUrl();
}

function enterLocalView(bodyId, { focusCamera = true, save = true } = {}) {
  const body = state.records.get(bodyId);
  if (!body || body.recordType !== 'body' || body.kind === 'star' || body.kind === 'barycentre') {
    exitLocalView({ resetCamera:false, save });
    if (focusCamera && body) state.renderer?.focus(body.id);
    return;
  }
  state.localFocusBodyId = bodyId;
  for (const item of bodyAncestorPath(bodyId)) state.treeExpanded.add(item.id);
  state.treeExpanded.add(bodyId);
  state.renderer?.setLocalFocus(bodyId);
  if (focusCamera) state.renderer?.focus(bodyId);
  renderHierarchy();
  renderBreadcrumb(state.records.get(state.selectedId));
  $('status').textContent = `Local view: ${body.shortName || body.name}`;
  if (save) saveUrl();
}

function renderBreadcrumb(record) {
  const root = $('breadcrumb');
  root.replaceChildren();
  if (!state.system) return;
  const systemButton = action(state.system.name, () => {
    exitLocalView({ resetCamera:true });
    const star = state.system.bodies.find(body => body.kind === 'star');
    if (star) select(star.id, false);
  }, 'orrery-crumb');
  root.append(systemButton);
  const bodyId = recordBodyId(record);
  const path = bodyAncestorPath(bodyId);
  for (const body of path) {
    root.append(node('span', '›', 'orrery-crumb-sep'));
    const button = action(body.shortName || body.name, () => {
      select(body.id, true);
      if (body.kind !== 'star') enterLocalView(body.id, { focusCamera:false });
      else exitLocalView({ resetCamera:false });
    }, 'orrery-crumb');
    if (body.id === state.localFocusBodyId) button.classList.add('is-local');
    root.append(button);
  }
  if (record?.recordType === 'ring' || record?.recordType === 'location') {
    const ring = record.recordType === 'ring' ? record : record.ringId ? state.records.get(record.ringId) : null;
    if (ring) {
      root.append(node('span', '›', 'orrery-crumb-sep'));
      if (record.recordType === 'ring') root.append(node('span', ring.name.replace(state.system.name, '').trim() || ring.name, 'orrery-crumb-current'));
      else root.append(action(ring.name.replace(state.system.name, '').trim() || ring.name, () => select(ring.id, true), 'orrery-crumb'));
    }
    if (record.recordType === 'location') {
      root.append(node('span', '›', 'orrery-crumb-sep'));
      root.append(node('span', record.name, 'orrery-crumb-current'));
    }
  }
  if (state.localFocusBodyId) root.append(node('span', 'LOCAL', 'orrery-local-badge'));
}

function hierarchyChildrenMap() {
  const map = new Map();
  for (const body of state.system?.bodies || []) {
    const list = map.get(body.parentId ?? null) || [];
    list.push(body);
    map.set(body.parentId ?? null, list);
  }
  for (const list of map.values()) list.sort((a,b) => (a.bodyId ?? 0) - (b.bodyId ?? 0) || a.id.localeCompare(b.id));
  return map;
}

function renderHierarchy() {
  const root = $('hierarchy');
  root.replaceChildren();
  if (!state.system) return;
  const children = hierarchyChildrenMap();
  const current = state.localFocusBodyId ? state.records.get(state.localFocusBodyId) : null;
  $('hierarchy-current').textContent = current ? `Local: ${current.shortName || current.name}` : 'Entire system';

  const addItem = (body, depth = 0) => {
    const wrapper = node('div', null, 'orrery-tree-node');
    wrapper.dataset.bodyId = body.id;
    const row = node('div', null, 'orrery-tree-row');
    row.style.setProperty('--tree-depth', String(depth));
    const childBodies = children.get(body.id) || [];
    const hasNestedBodies = childBodies.length > 0;
    const hasExtras = (body.rings?.length || 0) + state.system.locations.filter(location => location.bodyId === body.id).length > 0;
    const expandable = hasNestedBodies || hasExtras;
    const expanded = state.treeExpanded.has(body.id);

    const toggle = action(expandable ? (expanded ? '−' : '+') : '·', () => {
      if (!expandable) return;
      if (state.treeExpanded.has(body.id)) state.treeExpanded.delete(body.id); else state.treeExpanded.add(body.id);
      renderHierarchy();
    }, 'orrery-tree-toggle');
    toggle.disabled = !expandable;
    toggle.setAttribute('aria-label', expandable ? `${expanded ? 'Collapse' : 'Expand'} ${body.shortName || body.name}` : 'No child objects');
    toggle.setAttribute('aria-expanded', String(expanded));

    const title = body.kind === 'barycentre'
      ? node('span', 'Shared orbital centre', 'orrery-tree-barycentre')
      : action(body.shortName || body.name, () => select(body.id, true), 'orrery-tree-select');
    if (body.kind !== 'barycentre') {
      title.setAttribute('aria-current', body.id === state.selectedId ? 'true' : 'false');
      title.append(node('small', body.kind === 'star' ? 'Star' : body.subType || friendlyKind(body.kind)));
    }
    row.append(toggle, title);
    if (body.kind !== 'star' && body.kind !== 'barycentre') {
      const local = action('Local', () => {
        select(body.id, false);
        enterLocalView(body.id);
      }, 'orrery-tree-local');
      local.setAttribute('aria-pressed', String(body.id === state.localFocusBodyId));
      row.append(local);
    }
    wrapper.append(row);

    if (expandable && expanded) {
      const branch = node('div', null, 'orrery-tree-children');
      for (const child of childBodies) branch.append(addItem(child, depth + 1));
      for (const ring of body.rings || []) {
        const row = action('', () => select(ring.id, true), 'orrery-tree-leaf');
        row.style.setProperty('--tree-depth', String(depth + 1));
        row.append(node('span', '◌', 'orrery-tree-icon'), node('strong', ring.name.replace(state.system.name, '').trim() || ring.name), node('small', `${ring.type || 'Unknown'} ring`));
        row.setAttribute('aria-current', ring.id === state.selectedId ? 'true' : 'false');
        branch.append(row);
      }
      const locations = state.system.locations.filter(location => location.bodyId === body.id).sort((a,b) => a.name.localeCompare(b.name));
      for (const location of locations) {
        const row = action('', () => select(location.id, true), 'orrery-tree-leaf');
        row.style.setProperty('--tree-depth', String(depth + 1));
        row.append(node('span', location.kind === 'surface-deposit' ? '◆' : location.kind === 'ring-hotspot' ? '◇' : '•', 'orrery-tree-icon'), node('strong', location.name), node('small', friendlyKind(location.kind)));
        row.setAttribute('aria-current', location.id === state.selectedId ? 'true' : 'false');
        branch.append(row);
      }
      wrapper.append(branch);
    }
    return wrapper;
  };

  for (const body of children.get(null) || []) {
    state.treeExpanded.add(body.id);
    root.append(addItem(body, 0));
  }
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
      if(record.positionObservation?.status==='estimated')button.append(node('small','Host confidence · Estimated'));
      else if(record.positionObservation?.status==='verified')button.append(node('small','Host confidence · Verified'));
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
  const localBodyId = record.recordType === 'body' ? record.id : record.bodyId;
  const localBody = state.records.get(localBodyId);
  if (localBody && localBody.recordType === 'body' && !['star','barycentre'].includes(localBody.kind)) {
    if (state.localFocusBodyId === localBodyId) actions.append(action('Exit local view', () => exitLocalView({ resetCamera:false })));
    else actions.append(action('Local view', () => enterLocalView(localBodyId)));
  }
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
    const placement = classifyLocationPlacement(record);
    pair('Map placement', locationPlacementText[placement]);
    if (placement === 'unplaced') root.append(node('p', 'Host unknown — this facility remains searchable, but the Orrery will not invent a 3D marker until Scout or an officer can establish its host.', 'orrery-placement-note'));
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
    if (record.positionObservation?.source) pair('Placement source', record.positionObservation.source);
    if (record.positionObservation?.status) pair('Host confidence', record.positionObservation.status === 'estimated' ? 'Estimated' : record.positionObservation.status === 'confirmed' ? 'Confirmed current placement' : record.positionObservation.status === 'unresolved' ? 'Unresolved' : 'Verified');
    if (record.positionObservation?.confidenceScore != null) pair('Estimate confidence', `${Math.round(record.positionObservation.confidenceScore * 100)}%`);
    if (record.positionObservation?.observedAt) {
      const observed = new Date(record.positionObservation.observedAt);
      pair('Position observed', Number.isFinite(observed.getTime()) ? observed.toLocaleString() : record.positionObservation.observedAt);
    }
    if (record.ringId) pair('Ring', state.records.get(record.ringId)?.name || record.ringId);
  }
  root.append(dl);
  if (record.positionObservation?.event === 'ApproachSettlement') root.append(node('p', 'Exact surface placement was upgraded from a verified Mongrel Scout ApproachSettlement observation. Imported source notes below may describe the older snapshot before this visit.'));
  else if (record.positionObservation?.event === 'MobileStationVisit') root.append(node('p', 'Last observed placement from Mongrel Scout. Mobile carriers and megaships can move, so this is a dated observation rather than a permanent host assignment.'));
  else if (record.positionObservation?.event === 'MobileStationOverride') root.append(node('p', 'Temporary current placement confirmed by Mongrel leadership. A newer good Scout placement can replace it automatically.'));
  else if (record.positionObservation?.event === 'StationHostEstimate') root.append(node('p', 'Host body is an automated geometric estimate based on arrival distance and a strong runner-up margin. Officers can confirm or correct it below.'));
  else if (record.positionObservation?.event === 'StationHostOverride') root.append(node('p', 'Host body was confirmed or corrected by Mongrel leadership.'));
  if (record.discoveredByScout) root.append(node('p', 'This facility was observed by Mongrel Scout after the imported station snapshot and was added dynamically to the Orrery.'));
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
  if (canManageHosts() && record.recordType === 'location' && record.marketId && record.latitude == null && record.longitude == null && ['station','settlement','installation'].includes(record.kind)) {
    root.append(buildHostEditor(record));
  } else if (canManageHosts() && record.recordType === 'location' && record.marketId && record.kind === 'carrier') {
    root.append(buildCarrierPlacementEditor(record));
  }
}

function canManageHosts() {
  return ['officer','site_admin'].includes(state.viewer?.access);
}

function buildHostEditor(record) {
  const box=node('div',null,'orrery-host-editor');
  box.append(node('h4','Host body control'));
  const label=node('label');
  label.append(node('span','Confirmed host body'));
  const selectEl=node('select');
  const bodies=state.system.bodies
    .filter(body=>body.kind!=='barycentre'&&Number.isInteger(body.bodyId))
    .sort((a,b)=>a.bodyId-b.bodyId);
  for(const body of bodies)selectEl.append(new Option(body.shortName||body.name,String(body.bodyId)));
  const current=state.system.bodies.find(body=>body.id===record.bodyId);
  if(current)selectEl.value=String(current.bodyId);
  label.append(selectEl);
  const actions=node('div',null,'orrery-host-editor-actions');
  const save=action('Confirm host',async()=>{
    const body=state.system.bodies.find(item=>String(item.bodyId)===selectEl.value);
    if(!body)return;
    save.disabled=true;
    $('status').textContent=`Saving host for ${record.name}…`;
    try{
      const response=await fetch('../api/orrery/host-override',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'orrery-host-editor'},
        body:JSON.stringify({
          systemId64:String(state.system.id64),
          marketId:String(record.marketId),
          facilityName:record.name,
          bodyJournalId:body.bodyId,
          bodyName:body.name,
        }),
      });
      const data=await response.json();
      if(!response.ok||!data?.ok)throw new Error(data?.error||'save_failed');
      const systemId=state.system.id, focusId=state.localFocusBodyId;
      await loadSystem(systemId,record.id,focusId);
      $('status').textContent=`Verified host saved: ${record.name} → ${body.shortName||body.name}`;
    }catch{
      $('status').textContent='Host update failed · check sign-in and try again';
      save.disabled=false;
    }
  });
  actions.append(save);
  box.append(label,actions);
  return box;
}

function buildCarrierPlacementEditor(record) {
  const box=node('div',null,'orrery-host-editor');
  box.append(
    node('h4','Current carrier placement'),
    node('p','Temporary placement only. A newer good Scout observation can replace it automatically.')
  );
  const label=node('label');
  label.append(node('span','Currently near body'));
  const selectEl=node('select');
  const bodies=state.system.bodies
    .filter(body=>body.kind!=='barycentre'&&Number.isInteger(body.bodyId))
    .sort((a,b)=>a.bodyId-b.bodyId);
  for(const body of bodies)selectEl.append(new Option(body.shortName||body.name,String(body.bodyId)));
  const current=state.system.bodies.find(body=>body.id===record.bodyId);
  if(current)selectEl.value=String(current.bodyId);
  label.append(selectEl);
  const actions=node('div',null,'orrery-host-editor-actions');
  const save=action('Set current placement',async()=>{
    const body=state.system.bodies.find(item=>String(item.bodyId)===selectEl.value);
    if(!body)return;
    save.disabled=true;
    $('status').textContent=`Saving current placement for ${record.name}…`;
    try{
      const response=await fetch('../api/orrery/host-override',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Mongrels-Request':'orrery-host-editor'},
        body:JSON.stringify({
          systemId64:String(state.system.id64),
          marketId:String(record.marketId),
          facilityName:record.name,
          bodyJournalId:body.bodyId,
          bodyName:body.name,
          placementMode:'temporary_mobile',
        }),
      });
      const data=await response.json();
      if(!response.ok||!data?.ok)throw new Error(data?.error||'save_failed');
      const systemId=state.system.id, focusId=state.localFocusBodyId;
      await loadSystem(systemId,record.id,focusId);
      $('status').textContent=`Current carrier placement saved: ${record.name} → ${body.shortName||body.name}`;
    }catch{
      $('status').textContent='Carrier placement update failed · check sign-in and try again';
      save.disabled=false;
    }
  });
  actions.append(save);
  box.append(label,actions);
  return box;
}

function select(id, focus = false) {
  const record = state.records.get(id); if (!record) return;
  if (state.localFocusBodyId && !recordIsInLocalFocus(record)) exitLocalView({ resetCamera:false, save:false });
  state.selectedId = id;
  renderDetails(record);
  state.renderer?.select(id, { focus });
  for (const button of $('results').querySelectorAll('[data-object-id]')) button.setAttribute('aria-pressed', String(button.dataset.objectId === id));
  renderHierarchy();
  renderBreadcrumb(record);
  const placement = record.recordType === 'location' ? classifyLocationPlacement(record) : null;
  $('status').textContent = placement === 'unplaced'
    ? `Selected: ${record.shortName || record.name} · host unknown — no 3D marker yet`
    : `Selected: ${record.shortName || record.name}`;
  saveUrl();
}

function showFallback(message) { $('fallback').hidden = false; $('fallback-message').textContent = message; $('status').textContent = 'Directory mode · 3D unavailable'; }
async function startRenderer() {
  const version = ++state.rendererVersion;
  state.renderer?.dispose(); state.renderer = null;
  $('fallback').hidden = true;
  try {
    const { createOrrery } = await import('./renderer.js?v=3');
    if (version !== state.rendererVersion || !state.system) return;
    state.renderer = createOrrery({ container:$('viewport'), system:state.system, onSelect:id => select(id), onError:() => {
      state.renderer?.dispose(); state.renderer = null; showFallback('WebGL was interrupted. Retry the 3D view or continue with the object directory.');
    } });
    state.renderer.setOrbits($('orbits').checked);
    state.renderer.setLabels($('labels').checked);
    state.renderer.setLayerPreset(state.layerPreset);
    state.renderer.setLocalFocus(state.localFocusBodyId);
    $('status').textContent = state.localFocusBodyId ? `3D ready · local view ${state.records.get(state.localFocusBodyId)?.shortName || ''}` : '3D ready · select an object';
    renderResults();
    if (state.selectedId) state.renderer.select(state.selectedId);
  } catch { showFallback('WebGL could not start on this device. You can still search, select objects and read their details.'); }
}

async function loadSystem(id, objectId, focusId = null) {
  const version = ++state.loadVersion;
  ++state.rendererVersion; state.renderer?.dispose(); state.renderer = null; state.system = null;
  state.records = new Map(); state.selectedId = null; state.localFocusBodyId = null; state.treeExpanded = new Set();
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
    let facilityStatus = 'Mongrel Scout facility placement is not available.';
    try {
      const facilityUrl = new URL('../api/orrery/facility-observations', location.href);
      facilityUrl.searchParams.set('systemId64', String(system.id64));
      const facilityResult = await loadFacilityObservationProvider(system, facilityUrl.href, { signal:AbortSignal.timeout(4000) });
      system = facilityResult.system;
      const verified=facilityResult.verifiedApplied||0,estimated=facilityResult.estimatedApplied||0,discovered=facilityResult.discoveredApplied||0,mobile=facilityResult.mobileApplied||0;
      facilityStatus = verified || estimated || discovered || mobile
        ? [
          verified ? `${verified} verified placement${verified === 1 ? '' : 's'}` : '',
          discovered ? `${discovered} Scout-discovered facilit${discovered === 1 ? 'y' : 'ies'}` : '',
          mobile ? `${mobile} mobile placement${mobile === 1 ? '' : 's'}` : '',
          estimated ? `${estimated} estimated host${estimated === 1 ? '' : 's'}` : '',
        ].filter(Boolean).join(' · ')
        : 'Mongrel Scout facility placement connected · no verified or high-confidence estimated upgrades yet.';
    } catch { facilityStatus = 'Mongrel Scout facility placement unavailable · imported and curated locations remain usable.'; }
    if (version !== state.loadVersion) return;
    state.system = system; state.records = new Map(getRecords(system).map(record => [record.id, record])); state.selectedId = null;
    const requestedFocus = state.records.get(focusId);
    state.localFocusBodyId = requestedFocus?.recordType === 'body' && !['star','barycentre'].includes(requestedFocus.kind) ? requestedFocus.id : null;
    $('system-name').textContent = system.name;
    const resource = $('resource').value; $('resource').replaceChildren(new Option('All resources', 'all'));
    const names = [...new Set(getRecords(system).flatMap(record => record.resources))].sort();
    for (const name of names) $('resource').append(new Option(name, name));
    $('resource').value = names.includes(resource) ? resource : 'all';
    const notes = $('source-notes'); notes.replaceChildren();
    const physical = system.bodies.filter(body => body.kind !== 'barycentre').length, placed = system.locations.filter(item => item.bodyId).length;
    notes.append(node('p', `${physical} celestial bodies · ${system.bodies.length - physical} shared orbital centres · ${system.locations.length} locations (${placed} with known host bodies). Source snapshots may be incomplete or stale.`), node('p', providerStatus), node('p', facilityStatus));
    const sources = node('ul');
    for (const source of system.sources || []) { const li = node('li'); li.append(source.url ? safeLink(source.name, source.url) : node('span', source.name)); if (source.retrievedAt) li.append(document.createTextNode(` · Snapshot ${new Date(source.retrievedAt).toLocaleDateString()}`)); sources.append(li); }
    notes.append(sources);
    renderResults();
    renderHierarchy();
    const initialObjectId = state.records.has(objectId) ? objectId : state.localFocusBodyId || system.bodies.find(body => body.kind === 'star').id;
    select(initialObjectId);
    await startRenderer();
  } catch {
    if (version !== state.loadVersion) return;
    showFallback('System data could not load. Check your connection and retry.'); $('results').append(node('p', 'System data unavailable. Use Retry 3D view to reload the catalogue.', 'orrery-empty')); $('count').textContent = 'Unavailable';
  }
}

async function init() {
  try {
    const [response,sessionResponse] = await Promise.all([
      fetch('../data/orrery/systems.json'),
      fetch('../api/auth/session').catch(()=>null),
    ]);
    if (!response.ok) throw new Error('Catalogue unavailable');
    state.catalog = await response.json();
    if(sessionResponse?.ok){
      try{state.viewer=await sessionResponse.json();}catch{state.viewer=null;}
    }
    if (state.catalog.schemaVersion !== 1 || !Array.isArray(state.catalog.systems) || !state.catalog.systems.length) throw new Error('Invalid catalogue');
    $('system').replaceChildren(); for (const entry of state.catalog.systems) $('system').append(new Option(entry.name, entry.id));
    const id = state.catalog.systems.some(item => item.id === initial.get('system')) ? initial.get('system') : state.catalog.defaultSystemId;
    $('system').value = id;
    $('search').value = initial.get('q') || ''; $('kind').value = initial.get('kind') || 'all'; if (!$('kind').value) $('kind').value = 'all';
    state.layerPreset = LAYER_PRESETS[initial.get('view')] ? initial.get('view') : 'everything';
    $('hierarchy-panel').open = window.matchMedia('(min-width: 761px)').matches;
    setLayerPreset(state.layerPreset, { save:false });
    await loadSystem(id, initial.get('object'), initial.get('focus'));
    if (initial.get('resource') && [...$('resource').options].some(option => option.value === initial.get('resource'))) { $('resource').value = initial.get('resource'); renderResults(); saveUrl(); }
  } catch { showFallback('The system catalogue could not load. Check your connection and retry.'); }
}

for (const name of ['search', 'kind', 'resource']) $(name).addEventListener(name === 'search' ? 'input' : 'change', () => { renderResults(); if (state.system) saveUrl(); });
$('clear').addEventListener('click', () => { $('search').value = ''; $('kind').value = 'all'; $('resource').value = 'all'; renderResults(); if (state.system) saveUrl(); });
$('presets').addEventListener('click', event => {
  const button = event.target.closest('[data-preset]');
  if (button) setLayerPreset(button.dataset.preset);
});
$('system').addEventListener('change', () => loadSystem($('system').value));
$('retry').addEventListener('click', () => state.system ? startRenderer() : state.catalog ? loadSystem($('system').value) : init());
$('reset').addEventListener('click', () => exitLocalView({ resetCamera:true }));
$('zoom-in').addEventListener('click', () => state.renderer?.zoom(0.8)); $('zoom-out').addEventListener('click', () => state.renderer?.zoom(1.25));
for (const [name, x, y] of [['left', -40, 0], ['right', 40, 0], ['up', 0, -40], ['down', 0, 40]]) $(`pan-${name}`).addEventListener('click', () => state.renderer?.pan(x, y));
$('orbits').addEventListener('change', () => state.renderer?.setOrbits($('orbits').checked)); $('labels').addEventListener('change', () => state.renderer?.setLabels($('labels').checked));
window.addEventListener('pagehide', () => { ++state.rendererVersion; state.renderer?.dispose(); state.renderer = null; });
window.addEventListener('pageshow', event => { if (event.persisted && state.system) startRenderer(); });
init();
