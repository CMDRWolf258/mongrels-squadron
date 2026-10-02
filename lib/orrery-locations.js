import { joinLocations } from './orrery-model.js';

// Shared provider contract uses Elite's system ID64 and journal body ID, never
// renderer names or guessed coordinates. Canonical records remain provider-owned.
export function applyLocationPayload(system, payload) {
  if (payload?.schemaVersion !== 1 || String(payload.systemId64) !== String(system.id64) || !Array.isArray(payload.locations)) throw new Error('Location provider system/schema mismatch');
  const ids = new Set();
  const normalized = payload.locations.map(location => {
    if (typeof location.id !== 'string' || !location.id.trim() || ids.has(location.id)) throw new Error('Duplicate or missing canonical location ID');
    ids.add(location.id);
    if (location.commodities != null && (!Array.isArray(location.commodities) || location.commodities.some(value => typeof value !== 'string' || !value.trim()))) throw new Error('Invalid canonical commodities');
    if (!Number.isInteger(location.bodyJournalId)) throw new Error('Canonical location requires a journal body ID');
    const body = system.bodies.find(item => item.bodyId === location.bodyJournalId);
    if (!body || body.kind === 'barycentre') throw new Error('Canonical location body unavailable');
    const ring = location.ringName == null ? null : (body.rings || []).find(item => item.name === location.ringName);
    if (location.ringName != null && !ring) throw new Error('Canonical ring unavailable');
    if (location.kind === 'ring-hotspot' && !ring) throw new Error('Hotspot requires a canonical ring reference');
    return {
      ...location,
      id:`canonical:${location.id}`,
      canonicalId:location.id,
      bodyId:body.id,
      ringId:ring?.id ?? null,
      latitude:location.latitude ?? null,
      longitude:location.longitude ?? null,
      positionKnown:true,
      coordinatesKnown:location.latitude != null && location.longitude != null,
      commodities:Array.isArray(location.commodities) ? location.commodities : [],
    };
  });
  return joinLocations(system, normalized);
}

export async function loadLocationProvider(system, url, { fetcher = fetch, signal } = {}) {
  const response = await fetcher(url, { signal, headers:{ Accept:'application/json' } });
  if (!response.ok) throw new Error(`Location provider unavailable (${response.status})`);
  return applyLocationPayload(system, await response.json());
}
