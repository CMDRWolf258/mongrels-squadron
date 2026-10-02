# Orrery data

The catalog in `systems.json` registers two snapshots using schema version 1. 10-16 remains the default; Diaba is selectable through the same page, model and renderer. Core celestial/facility imports and optional curated locations are separate layers.

## 10-16 snapshot

`ngc-2546-uz-g-d10-16.json` is a dated prototype snapshot, separate from live BGS strategy. It contains 45 physical celestial bodies, four shared orbital centres, 36 facilities reported by EDSM, and 36 commodity survey records representing 79 hotspot signals across 12 rings. Parent relationships come from EDSM's journal-derived `parents` chains, including the `Null` barycentres shared by 4/5, 6 d/6 e, 7/8, and 9/10. The moons of moons 12 b a and 12 g a retain their immediate parents.

The snapshot records [EDSM bodies](https://www.edsm.net/api-system-v1/bodies?systemName=NGC%202546%20Sector%20UZ-G%20d10-16) and [EDSM stations](https://www.edsm.net/api-system-v1/stations?systemName=NGC%202546%20Sector%20UZ-G%20d10-16) provenance and each source record's update time. Field meanings follow the [EDSM API documentation](https://www.edsm.net/en_GB/api-system-v1). Body IDs are journal body IDs; station IDs are namespaced EDSM station IDs. Distances to arrival are snapshot values and can vary with orbital motion.

Matching [Spansh body records](https://spansh.co.uk/system/560820275507) supply ring commodity signal counts and station associations joined by verified market ID. The JSON records preserve each ring's survey timestamp: several surveys are from October 2025, while others were refreshed in September 2026. Hotspot counts identify commodities and rings; they do not establish exact hotspot positions, overlaps or current mining yield. Body-level Planetary Mining Location counts do not identify deposit coordinates or commodities.

For station names that exactly match EDSM records, body associations absent from both public providers are supplemented by the user-supplied Mongrel SRVSurvey plan screenshots in the ChatGPT project's read-only `sources/` directory. Each supplemented record names its particular screenshot in `associationSource`. The screenshots have no capture date. They establish body association only; proposed NATO-named facilities are excluded, and construction/completion state is not inferred from them. Of the 36 facilities, 27 now have a body association (seven direct EDSM, 17 Spansh, two screenshot associations and one existing personal-archive association); nine remain unplaced.

The existing personal archive explicitly places King's Mountain View at the Earth-like world in its [Strategic Locations description](https://github.com/CMDRWolf258/cmdrwolf258.github.io/blob/bafb1a2c2fdc7a24801082f8d69ed233759b77df/system.html). The imported system has one Earth-like world: 8, journal body 51. This host-only recovery is identified by EDSM station ID 722440 and market ID 4374964995, gated to 10-16, and retained by the importer only when direct EDSM/Spansh/plan associations are absent and that world is unambiguous. Coordinates remain null. EDSM calls the facility a Planetary Outpost while the archive describes a starport; its source type is retained and this discrepancy is disclosed rather than silently corrected.

Arkwright Vista, Aryabhata Prominence, Rival Monkeys Foundry, Boltzmann Vision, Orbital Construction Site: Kirkwood Relay, Rivers Hub, TZV-18X, W0W-G2V and V5F-7HW remain unplaced. The checked snapshot and encoded plan associations, current repository BGS/gallery records, and existing personal archive/market/mining records provide no verified host for them. The original read-only plan images are referenced by the project but are unavailable in this local workspace; they have not been re-inspected. Arrival distances, similar names and supply-chain references do not establish a host. See [PLACEMENT-AUDIT.md](PLACEMENT-AUDIT.md) for the four-category audit and source limits.

## Diaba snapshot

`diaba.json` records system address `2558022062802` using [EDSM bodies](https://www.edsm.net/api-system-v1/bodies?systemName=Diaba), [EDSM stations](https://www.edsm.net/api-system-v1/stations?systemName=Diaba) and matching [Spansh body records](https://spansh.co.uk/system/2558022062802), captured on 2026-10-02. The normalized snapshot uses the batch retrieval timestamp `2026-10-02T20:36:48Z`. [Offline fixtures](../fixtures/orrery/diaba/README.md) retain the source responses and capture-time details.

The snapshot contains 15 physical bodies: one star, three planets and eleven moons. Their journal-derived immediate-parent hierarchy contains no shared barycentres. Diaba 3 has one ring, and the primary star has two asteroid belts. Source orbital elements, radii, composition, signals and update times are retained; unknown fields remain null.

The 38 facilities comprise all 28 EDSM station records and ten additional named facilities in Spansh body records. Facilities are joined by verified market ID, with EDSM's richer records retained where both providers report a facility. Thirty-five have a host-body association; the remaining three are fleet carriers listed without scene markers. Ten recognized surface facilities retain latitude/longitude pairs reported directly by EDSM. Other host-associated markers remain schematic. Spansh-only facilities retain the body record's timestamp in `source.recordUpdatedAt`; `sourceUpdatedAt` remains null when no station-specific update time is published.

EDSM attaches latitude/longitude to Niijima Station while identifying it as a Coriolis Starport. The importer retains the known Diaba 1 a association but excludes these anomalous surface fields from its normalized coordinates. The raw fixture preserves them for review. Unnamed Spansh landmarks are not joined to named facilities or promoted to resource sites without a verified identity.

No ring commodity signals, ring hotspots or verified surface-resource deposits are present in this Diaba snapshot. Body materials and signal counts do not establish mineable sites. Diaba has no `locationProvider` in the catalog and no curated resource dataset; its core data does not depend on the personal 10-16 site, mining store or screenshot plan.

## Schema conventions

- `bodies[].parentId` always identifies the immediate parent node. `kind` distinguishes stars, planets, moons and invisible barycentres.
- Physical orbit values retain source units: astronomical units, days and degrees. A null value means unknown. The four 10-16 barycentres have no published orbital elements or arrival distance in this API; `displayDistanceHintLs` averages their children's snapshot arrival distances solely for schematic display spacing.
- Rings and asteroid belts retain their inner/outer radii in kilometres. `materials` holds engineering raw-material percentages; these are not mineable commodity deposits or guaranteed surface sites.
- `locations[].bodyId` is the associated hierarchy node or null. Null locations remain searchable/listed but have no scene marker. `positionKnown` means a body association exists; it does not assert a measured station orbit or surface position. `coordinatesKnown` is false unless exact coordinates are supplied.
- Recognized EDSM surface facility types (`Odyssey Settlement`, `Planetary Outpost`, `Planetary Port`) may retain complete finite latitude/longitude pairs on a verified EDSM host body. Orbital-station coordinate fields are excluded. EDSM facility IDs use `edsm-station-`; additional Spansh facilities use `spansh-station-` plus their market ID. Source records and association provenance remain separate.
- Surface deposits should supply latitude and longitude in degrees, commodities, notes and provenance. Ring hotspots should reference an existing `ringId`, commodities and provenance. The imported records are aggregate surveys with `hotspotCount` and `positionPrecision:"ring"`; any marker only represents the ring association. Unknown coordinates stay null; no fallback coordinates should be saved as measured facts.
- Custom locations should use stable IDs and the same body/ring references. A source may contain a public `url` or a reference to the original private record.

## Refreshing the snapshot

Run `node --experimental-default-type=module scripts/import-orrery-edsm.mjs` from the repository root to fetch new 10-16 EDSM snapshots plus matching Spansh body surveys. Review the resulting data diff before committing: carriers move, construction progresses, and source records can be incomplete or stale. The existing committed 10-16 snapshot is unchanged by the Diaba addition.

Select another system by supplying both its exact source name and catalog ID. Without an explicit `--output`, the importer writes `data/orrery/<system-id>.json`:

```text
node --experimental-default-type=module scripts/import-orrery-edsm.mjs --system-name Diaba --system-id diaba
```

For an offline reproducible import, use saved raw API responses:

```text
node --experimental-default-type=module scripts/import-orrery-edsm.mjs --bodies bodies.json --stations stations.json --spansh-bodies spansh-bodies.json --retrieved-at 2026-10-02T04:35:21.585Z
```

To reproduce Diaba from the checked-in captures without fetching either provider:

```text
node --experimental-default-type=module scripts/import-orrery-edsm.mjs --system-name Diaba --system-id diaba --bodies data/fixtures/orrery/diaba/edsm-bodies.json --stations data/fixtures/orrery/diaba/edsm-stations.json --spansh-bodies data/fixtures/orrery/diaba/spansh-bodies.json --retrieved-at 2026-10-02T20:36:48Z --output data/orrery/diaba.json
```

The Spansh input is an array of `{id64:"decimal body address",record:<raw body response record>}` wrappers. Body addresses must stay decimal strings because they exceed JavaScript's safe integer range. The importer validates matching system addresses, system/body names, hierarchy IDs and the resulting shared schema, creates missing shared-centre nodes, and leaves unknown location associations unplaced. Its legacy screenshot supplement is gated by the exact 10-16 name, catalog ID and system address. An offline import without `--spansh-bodies` intentionally produces EDSM-only data; it must not be used to overwrite the combined snapshot accidentally. Tests use local fixtures/data and do not fetch community services.

## Existing Mongrel surface resources

The user's surface-resource records remain in the personal 10-16 site's existing D1 mining store and approval/edit workflow. Its existing `/api/mining?format=poi` response supplies a reusable canonical location document with stable record IDs, system/body/ring references, exact or unknown coordinates, commodities/tags, original notes and provenance. The Orrery joins this layer at runtime, without using the personal site for general system data or maintaining a second edited copy. See [../../CURATED_POIS.md](../../CURATED_POIS.md) for the transport-independent schema and deployment ordering.

The 10-16 core snapshot continues to contain no curated surface coordinates. It retains independently sourced Spansh ring survey counts. Diaba's sourced facility coordinates describe facilities, not surface-resource deposits. Provider failure leaves imported core data usable and is disclosed in data coverage; unknown coordinates are never replaced with guessed values. The local `resource-locations.json` file is an empty interface example only.

Diaba demonstrates adding a second system through the reusable import and catalog path. Adding a further system such as NGC 2546 Sector OQ-H b38-0 should mean supplying another document with the same schema and adding it to the system registry. An optional canonical POI provider may be configured independently when verified curated data exists. The renderer must not depend on system names or body numbers.
