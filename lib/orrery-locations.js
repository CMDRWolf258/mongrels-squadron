import { joinLocations } from './orrery-model.js';

// Shared POIs remain provider-owned, independently of imported celestial data.
// Legacy compact body names ("9a") differ only in whitespace from "9 a".
const bodyNameKey = value => value.toLowerCase().replace(/\s+/g, '');
function resolveBody(system, location) {
  if (location.bodyJournalId != null) {
    if (!Number.isInteger(location.bodyJournalId)) throw new Error('Canonical location requires a journal body ID');
    const body = system.bodies.find(item => item.bodyId === location.bodyJournalId);
    if (!body || body.kind === 'barycentre') throw new Error('Canonical location body unavailable');
    if (location.bodyName != null && (typeof location.bodyName !== 'string' || ![body.name,body.shortName].some(name=>typeof name === 'string' && bodyNameKey(name) === bodyNameKey(location.bodyName)))) throw new Error('Canonical body references disagree');
    return body;
  }
  if (location.bodyName != null) {
    if (typeof location.bodyName !== 'string' || !location.bodyName.trim()) throw new Error('Invalid canonical body name');
    const key = bodyNameKey(location.bodyName);
    const matches = system.bodies.filter(body => [body.name, body.shortName].some(name => typeof name === 'string' && bodyNameKey(name) === key));
    if (matches.length !== 1 || matches[0].kind === 'barycentre') throw new Error('Canonical location body name unavailable or ambiguous');
    return matches[0];
  }
  if (location.kind !== 'custom') throw new Error('Canonical location requires a body reference');
  return null;
}

export function applyLocationPayload(system, payload) {
  if (payload?.schemaVersion !== 1 || typeof payload.systemId64 !== 'string' || !/^\d+$/.test(payload.systemId64) || payload.systemId64 !== String(system.id64) || !Array.isArray(payload.locations)) throw new Error('Location provider system/schema mismatch');
  const ids = new Set();
  const normalized = payload.locations.map(location => {
    if (typeof location.id !== 'string' || !location.id.trim() || ids.has(location.id)) throw new Error('Duplicate or missing canonical location ID');
    ids.add(location.id);
    if (location.commodities != null && (!Array.isArray(location.commodities) || location.commodities.some(value => typeof value !== 'string' || !value.trim()))) throw new Error('Invalid canonical commodities');
    if (location.resourceTags != null && (!Array.isArray(location.resourceTags) || location.resourceTags.some(value => typeof value !== 'string' || !value.trim()))) throw new Error('Invalid canonical resource tags');
    const body = resolveBody(system, location);
    const ring = location.ringName == null ? null : (body?.rings || []).find(item => item.name === location.ringName);
    if (location.ringName != null && !ring) throw new Error('Canonical ring unavailable');
    if (location.kind === 'ring-hotspot' && !ring) throw new Error('Hotspot requires a canonical ring reference');
    return {
      ...location,
      id:`canonical:${location.id}`,
      canonicalId:location.id,
      bodyId:body?.id ?? null,
      ringId:ring?.id ?? null,
      latitude:location.latitude ?? null,
      longitude:location.longitude ?? null,
      positionKnown:Boolean(body),
      coordinatesKnown:location.latitude != null && location.longitude != null,
      commodities:Array.isArray(location.commodities) ? location.commodities : [],
      resourceTags:location.resourceTags || [],
    };
  });
  return joinLocations(system, normalized);
}

export async function loadLocationProvider(system, url, { fetcher = fetch, signal } = {}) {
  const response = await fetcher(url, { signal, headers:{ Accept:'application/json' } });
  if (!response.ok) throw new Error(`Location provider unavailable (${response.status})`);
  return applyLocationPayload(system, await response.json());
}
