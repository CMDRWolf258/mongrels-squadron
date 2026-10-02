# Orrery data

`ngc-2546-uz-g-d10-16.json` is a dated prototype snapshot, separate from live BGS strategy. It contains 45 physical celestial bodies, four shared orbital centres, 36 facilities reported by EDSM, and 36 commodity survey records representing 79 hotspot signals across 12 rings. Parent relationships come from EDSM's journal-derived `parents` chains, including the `Null` barycentres shared by 4/5, 6 d/6 e, 7/8, and 9/10. The moons of moons 12 b a and 12 g a retain their immediate parents.

The snapshot records [EDSM bodies](https://www.edsm.net/api-system-v1/bodies?systemName=NGC%202546%20Sector%20UZ-G%20d10-16) and [EDSM stations](https://www.edsm.net/api-system-v1/stations?systemName=NGC%202546%20Sector%20UZ-G%20d10-16) provenance and each source record's update time. Field meanings follow the [EDSM API documentation](https://www.edsm.net/en_GB/api-system-v1). Body IDs are journal body IDs; station IDs are namespaced EDSM station IDs. Distances to arrival are snapshot values and can vary with orbital motion.

Matching [Spansh body records](https://spansh.co.uk/system/560820275507) supply ring commodity signal counts and station associations joined by verified market ID. The JSON records preserve each ring's survey timestamp: several surveys are from October 2025, while others were refreshed in September 2026. Hotspot counts identify commodities and rings; they do not establish exact hotspot positions, overlaps or current mining yield. Body-level Planetary Mining Location counts do not identify deposit coordinates or commodities.

For station names that exactly match EDSM records, body associations absent from both public providers are supplemented by the user-supplied Mongrel SRVSurvey plan screenshots in the ChatGPT project's read-only `sources/` directory. Each supplemented record names its particular screenshot in `associationSource`. The screenshots have no capture date. They establish body association only; proposed NATO-named facilities are excluded, and construction/completion state is not inferred from them. Of the 36 facilities, 26 have a body association (seven direct EDSM, 17 Spansh and two screenshot associations); ten remain unplaced.

## Schema conventions

- `bodies[].parentId` always identifies the immediate parent node. `kind` distinguishes stars, planets, moons and invisible barycentres.
- Physical orbit values retain source units: astronomical units, days and degrees. A null value means unknown. The four barycentres have no published orbital elements or arrival distance in this API; `displayDistanceHintLs` averages their children's snapshot arrival distances solely for schematic display spacing.
- Rings and asteroid belts retain their inner/outer radii in kilometres. `materials` holds engineering raw-material percentages; these are not mineable commodity deposits or guaranteed surface sites.
- `locations[].bodyId` is the associated hierarchy node or null. Null locations remain searchable/listed but have no scene marker. `positionKnown` means a body association exists; it does not assert a measured station orbit or surface position. `coordinatesKnown` is false unless exact coordinates are supplied.
- Surface deposits should supply latitude and longitude in degrees, commodities, notes and provenance. Ring hotspots should reference an existing `ringId`, commodities and provenance. The imported records are aggregate surveys with `hotspotCount` and `positionPrecision:"ring"`; any marker only represents the ring association. Unknown coordinates stay null; no fallback coordinates should be saved as measured facts.
- Custom locations should use stable IDs and the same body/ring references. A source may contain a public `url` or a reference to the original private record.

## Refreshing the snapshot

Run `node scripts/import-orrery-edsm.mjs` from the repository root to fetch new EDSM snapshots plus matching Spansh body surveys. Review the resulting data diff before committing: carriers move, construction progresses, and source records can be incomplete or stale.

For an offline reproducible import, use saved raw API responses:

```text
node scripts/import-orrery-edsm.mjs --bodies bodies.json --stations stations.json --spansh-bodies spansh-bodies.json --retrieved-at 2026-10-02T04:35:21.585Z
```

The Spansh input is an array of `{id64:"decimal body address",record:<raw body response record>}` wrappers. Body addresses must stay strings because they exceed JavaScript's safe integer range. The importer validates system/body names and hierarchy IDs, creates missing shared-centre nodes, and leaves unknown location associations unplaced. An offline import without `--spansh-bodies` intentionally produces EDSM-only data; it must not be used to overwrite the combined snapshot accidentally. Tests use local fixtures/data and do not fetch community services.

## Existing Mongrel surface resources

The user's surface-resource records remain in the personal 10-16 site's existing D1 mining store and approval/edit workflow. Its existing `/api/mining?format=poi` response supplies a reusable canonical location document with stable record IDs, system/body/ring references, exact or unknown coordinates, commodities/tags, original notes and provenance. The Orrery joins this layer at runtime, without using the personal site for general system data or maintaining a second edited copy. See [../../CURATED_POIS.md](../../CURATED_POIS.md) for the transport-independent schema and deployment ordering.

This core snapshot continues to contain no curated surface coordinates. It retains independently sourced Spansh ring survey counts. Provider failure leaves imported core data usable and is disclosed in data coverage; unknown coordinates are never replaced with guessed values. The local `resource-locations.json` file is an empty interface example only.

Adding Diaba or NGC 2546 Sector OQ-H b38-0 should mean supplying another document with the same schema and adding it to the system registry. The renderer must not depend on the 10-16 names or body numbers.
