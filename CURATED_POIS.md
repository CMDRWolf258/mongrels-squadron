# Shared curated POI documents

Curated locations are an independent layer joined with the Orrery's imported system data at runtime. They do not supply stars, planets, moons, rings, parent relationships, stations, settlements or general system data. Those remain in the normal EDSM/Spansh snapshot and importer. Body composition and ring survey counts do not imply measured surface deposits.

The contract is JSON, independent of storage and transport. A provider may be an existing API or a static file. Each document describes one system, so Diaba or NGC 2546 Sector OQ-H b38-0 can use the same interface without any dependency on the personal 10-16 website.

## Document

```json
{
  "schemaVersion": 1,
  "systemId64": "560820275507",
  "systemName": "NGC 2546 Sector UZ-G d10-16",
  "locations": []
}
```

`systemId64` is the system's decimal address stored as a string, never a JavaScript numeric body address. `systemName` is optional descriptive metadata; ID64 establishes the join. An empty location list is valid and does not assert that no undiscovered sites exist. Optional document metadata such as update time may be supplied without becoming an ephemeris timestamp.

## Location fields

| Field | Meaning |
| --- | --- |
| `id` | Required nonempty, stable provider-owned string. Namespace IDs to prevent collisions between providers; do not regenerate them from array order, coordinates or editable names. |
| `name` | Required display name. |
| `kind` | `surface-deposit`, `ring-hotspot` or `custom` for curated records. The underlying location model also supports imported facilities separately. |
| `bodyJournalId` | Preferred physical body reference: Elite's integer journal body ID. This is distinct from the body designation or renderer ID. |
| `bodyName` | Alternative exact full body name or short designation from the imported system. Comparison ignores case and whitespace only: `9a` matches `9 a`, which is journal body 57 in 10-16. No fuzzy matching or number-to-journal-ID conversion occurs. |
| `ringName` | Optional exact name of a ring on the resolved body; required for a `ring-hotspot`. No ring is invented. |
| `latitude`, `longitude` | Exact sourced numbers in degrees, or both null/absent when unknown. Valid bounds are −90…90 and −180…180. Coordinates require a known body. |
| `commodities` | Optional array of commodity names actually recorded at this location. Body composition never populates this field. |
| `resourceTags` | Optional array of additional resource/location tags. Both these tags and commodities participate in location search and resource filters. |
| `notes` | Original curated field notes. |
| `source` | Public provenance object: optional `name`, `url`, `reference`, `type`. Preserve original record references. Both source URLs and reference-only provenance appear in details. |
| `sourceUpdatedAt` | Original source record update timestamp when known. Do not substitute the time of a fetch. |

If `bodyJournalId` is supplied it establishes the body; an accompanying `bodyName` must agree. Otherwise `bodyName` must identify exactly one physical body. Unmatched names, ambiguous/conflicting references, barycentres and mismatched ring names reject the provider document and produce a coverage warning; they are never silently assigned to a nearby body. A `custom` system-level POI can omit both body references and remain searchable without a 3D marker, provided its coordinates and ring association are unknown.

The Orrery retains `canonicalId` as the provider's original `id` and uses `canonical:<id>` for the joined display record. Repeated loads replace the same ID. Provider-owned objects and core system data are not edited. Unknown coordinates remain unknown; schematic marker positions are display geometry only.

## Optional surface-mining metadata

The 10-16 provider preserves these existing public fields without making them mandatory for other systems:

- `legacySiteId`: original mining-site record identity for provenance and existing personal-site links.
- `surfaceMining.signal`: recorded Planetary Mining Location signal number.
- `surfaceMining.rigs`: recorded rig count or null.
- `surfaceMining.preferred`: whether the site is marked preferred.
- `surfaceMining.bodyType`: original planet/moon classification.
- `materialAmount`: recorded qualitative amount (`high`, `medium`, `low`, `depleted`) or null.
- `materialUpdatedAt`: original material-report timestamp or null.

These fields do not establish coordinates, yield forecasts or current availability. The adapter preserves metadata and the details panel displays it as recorded.

## 10-16 authority and deployment

The personal site's existing D1 `mining_sites` store and established submission, approval and edit workflow remain the authoritative curated records. Its existing `/api/mining` endpoint exposes the same current approved rows in this contract when requested with `?format=poi`. The ordinary response remains available to the personal site's current consumers. No records are copied into the Orrery's core snapshot and no second edited mining dataset is introduced.

The review implementation namespaces current mining row IDs as `ten16-mining:<systemId64>:<row ID>`, preserving identity through edits and list reordering. Permanent non-reuse after deletion/recreation still requires verification of the deployed D1 table definition before production acceptance. No database schema change is included or authorized by this integration; do not claim that namespacing alone prevents reused database IDs.

`data/orrery/systems.json` configures `https://ten16-archive.pages.dev/api/mining?format=poi` for 10-16. The personal-site POI representation must be deployed before the Orrery integration is accepted: an old response is rejected safely, leaving imported core data usable. Both website pull requests should be reviewed together. `data/orrery/resource-locations.json` remains an empty local example, not a backup edited copy.

Other systems may configure their own static JSON or existing provider using `locationProvider.url`, relative to `data/orrery/` or an HTTPS URL. `{systemId64}` in a provider URL is substituted from the selected core document. Cross-origin providers must permit browser reads under their existing public/access rules. Private submitter and editor identities are not part of the public POI representation.

## Validation

`scripts/smoke-curated-pois.mjs` uses offline fixtures against the real imported 10-16 hierarchy. It checks compact/full names, journal precedence, ambiguity and unknown references, exact/null coordinates, stable IDs, source and mining metadata, system-level custom POIs, optional ring joins, tag filtering, and unchanged celestial/facility data. It runs alongside the existing Orrery and site smoke suites without network calls.

Deployment checks must verify the live POI document, CORS and browser behavior separately. Smoke success does not demonstrate that the paired personal-site change is deployed.
