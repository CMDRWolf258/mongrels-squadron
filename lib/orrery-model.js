// Pure data/layout functions: shared by the browser, import checks and smoke tests.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const kinds = new Set(['star', 'planet', 'moon', 'barycentre']);
const locationKinds = new Set(['station', 'settlement', 'installation', 'carrier', 'surface-deposit', 'ring-hotspot', 'custom']);

export function validateSystem(system) {
  if (system?.schemaVersion !== 1 || !system.id || !system.name || !Array.isArray(system.bodies) || !system.bodies.length) throw new Error('Invalid Orrery system');
  const bodies = new Map(), ids = new Set(), rings = new Map();
  const claim = id => { if (!id || ids.has(id)) throw new Error(`Duplicate or missing ID: ${id}`); ids.add(id); };
  for (const body of system.bodies) {
    claim(body.id);
    if (!body.name || !kinds.has(body.kind)) throw new Error(`Invalid body: ${body.id}`);
    if (body.materials != null && (!Array.isArray(body.materials) || body.materials.some(material => typeof material?.name !== 'string' || !material.name.trim()))) throw new Error(`Invalid materials: ${body.id}`);
    bodies.set(body.id, body);
    for (const ring of body.rings || []) { claim(ring.id); rings.set(ring.id, body.id); }
  }
  for (const body of system.bodies) if (body.parentId != null && !bodies.has(body.parentId)) throw new Error(`Missing parent: ${body.id}`);
  for (const body of system.bodies) {
    const ancestors = new Set([body.id]);
    let parent = body.parentId;
    while (parent != null) {
      if (ancestors.has(parent)) throw new Error(`Cyclic hierarchy: ${body.id}`);
      ancestors.add(parent); parent = bodies.get(parent).parentId;
    }
    for (const key of ['semiMajorAxisAu', 'periodDays']) {
      const value = body.orbit?.[key];
      if (value != null && (!finite(value) || value < 0)) throw new Error(`Invalid orbit: ${body.id}`);
    }
    for (const key of ['inclinationDeg', 'argOfPeriapsisDeg', 'eccentricity']) {
      const value = body.orbit?.[key];
      if (value != null && !finite(value)) throw new Error(`Invalid orbit: ${body.id}`);
    }
  }
  for (const location of system.locations || []) {
    claim(location.id);
    if (!location.name || !locationKinds.has(location.kind)) throw new Error(`Invalid location: ${location.id}`);
    if (location.commodities != null && (!Array.isArray(location.commodities) || location.commodities.some(value => typeof value !== 'string' || !value.trim()))) throw new Error(`Invalid commodities: ${location.id}`);
    if (location.resourceTags != null && (!Array.isArray(location.resourceTags) || location.resourceTags.some(value => typeof value !== 'string' || !value.trim()))) throw new Error(`Invalid resource tags: ${location.id}`);
    if (location.bodyId != null && !bodies.has(location.bodyId)) throw new Error(`Missing location body: ${location.id}`);
    if (location.ringId != null && rings.get(location.ringId) !== location.bodyId) throw new Error(`Missing or mismatched ring: ${location.id}`);
    const hasLat = location.latitude != null, hasLon = location.longitude != null;
    if (hasLat !== hasLon || (hasLat && (!location.bodyId || !finite(location.latitude) || Math.abs(location.latitude) > 90 || !finite(location.longitude) || Math.abs(location.longitude) > 180))) throw new Error(`Invalid coordinates: ${location.id}`);
  }
  return system;
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value ^= value >>> 16; value = Math.imul(value, 0x85ebca6b); value ^= value >>> 13;
  return value >>> 0;
}
export function surfaceVector(latitude, longitude, radius = 1) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon)];
}

export function buildLayout(system) {
  validateSystem(system);
  const layout = new Map(), children = new Map();
  for (const body of system.bodies) {
    const radius = body.kind === 'barycentre' ? 0.25 : body.kind === 'star' ? 8 : body.kind === 'moon' ? 0.85 : Math.min(3.8, Math.max(1.5, Math.log10(Math.max(100, body.radiusKm || 3000)) - 1.5));
    layout.set(body.id, { radius, parentId:body.parentId, position:[0, 0, 0], orbitRadius:0, phase:hash(body.id) / 4294967296 * Math.PI * 2, inclination:(body.orbit?.inclinationDeg || 0) * Math.PI / 180 });
    const list = children.get(body.parentId ?? null) || []; list.push(body); children.set(body.parentId ?? null, list);
  }
  for (const [parentId, list] of children) {
    const parent = system.bodies.find(body => body.id === parentId);
    const axis = body => body.orbit?.semiMajorAxisAu ?? ((body.displayDistanceHintLs ?? body.distanceToArrivalLs) == null ? null : (body.displayDistanceHintLs ?? body.distanceToArrivalLs) / 499.004784);
    // Arrival-distance hints are only comparable for children of the star.
    // Missing local binary-centre orbital data retains journal body ordering.
    const allKnown = list.every(body => body.orbit?.semiMajorAxisAu != null);
    list.sort((a, b) => (parent?.kind === 'star' ? (axis(a) ?? 0) - (axis(b) ?? 0) : allKnown ? a.orbit.semiMajorAxisAu - b.orbit.semiMajorAxisAu : a.bodyId - b.bodyId) || a.id.localeCompare(b.id));
  }
  const measure = body => {
    const entry = layout.get(body.id);
    let cursor = entry.radius * (body.rings?.length ? 3.8 : 1.5) + 3;
    for (const child of children.get(body.id) || []) {
      const extent = measure(child);
      const next = layout.get(child.id);
      next.orbitRadius = cursor + extent;
      cursor = next.orbitRadius + extent + 3;
    }
    entry.extent = cursor;
    return cursor;
  };
  const place = (body, parentPosition) => {
    const entry = layout.get(body.id), r = entry.orbitRadius, p = entry.phase, i = entry.inclination;
    entry.position = [parentPosition[0] + r * Math.cos(p), parentPosition[1] - r * Math.sin(p) * Math.sin(i), parentPosition[2] + r * Math.sin(p) * Math.cos(i)];
    for (const child of children.get(body.id) || []) place(child, entry.position);
  };
  let rootOffset = 0;
  for (const body of children.get(null) || []) { const extent = measure(body); place(body, [rootOffset, 0, 0]); rootOffset += extent * 2; }
  return layout;
}

export function getRecords(system) {
  const bodies = system.bodies.map(body => ({ ...body, bodyId:body.id, resources:(body.materials || []).map(material => material.name), recordType:'body' }));
  const rings = system.bodies.flatMap(body => (body.rings || []).map(ring => ({ ...ring, kind:'ring', bodyId:body.id, resources:[], recordType:'ring' })));
  const locations = (system.locations || []).map(location => ({ ...location, resources:[...new Set([...(location.commodities || []), ...(location.resourceTags || [])])], recordType:'location' }));
  return [...bodies, ...rings, ...locations];
}

export function filterRecords(system, { query = '', kind = 'all', resource = 'all' } = {}) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const designation = /^(?:body\s+)?\d+(?:\s+[a-z]){0,2}$/i.test(query.trim()) ? query.trim().toLowerCase().replace(/^body\s+/, '').replace(/\s+/g, ' ') : null;
  const shortName = text => String(text || '').toLowerCase().startsWith(system.name.toLowerCase()) ? text.slice(system.name.length).trim() : text;
  const bodies = new Map(system.bodies.map(body => [body.id, body]));
  return getRecords(system).filter(record => {
    if (record.kind === 'barycentre') return false;
    if (kind === 'bodies' && record.recordType !== 'body') return false;
    if (kind === 'facilities' && !['station', 'settlement', 'installation', 'carrier'].includes(record.kind)) return false;
    if (!['all', 'bodies', 'facilities'].includes(kind) && record.kind !== kind) return false;
    const host = bodies.get(record.bodyId);
    // A body's raw materials are not hotspot commodities or commodity deposits.
    const resources = record.resources;
    if (resource !== 'all' && !resources.some(value => value.toLowerCase() === resource.toLowerCase())) return false;
    const ancestorNames = [];
    const designations = [];
    let ancestor = host;
    while (ancestor) {
      ancestorNames.push(shortName(ancestor.name));
      if (ancestor.kind !== 'barycentre') designations.push((ancestor.shortName || shortName(ancestor.name)).toLowerCase());
      ancestor = bodies.get(ancestor.parentId);
    }
    if (designation) return designations.some(value => value === designation || value.startsWith(`${designation} `));
    const haystack = [shortName(record.name), record.shortName, record.kind, record.type, record.subType, record.notes, ...ancestorNames, ...resources].filter(Boolean).join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

// Future authoritative site providers can join by stable location IDs. Never clone
// existing mining records into the system snapshot or guess their coordinates.
export function joinLocations(system, locations) {
  const merged = new Map((system.locations || []).map(location => [location.id, location]));
  for (const location of locations) merged.set(location.id, location);
  return validateSystem({ ...system, locations:[...merged.values()] });
}
