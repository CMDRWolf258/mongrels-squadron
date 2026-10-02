# Diaba offline source captures

These fixtures reproduce `data/orrery/diaba.json` with the shared importer and supply offline regression coverage. They describe Diaba, system address `2558022062802`, and were captured on 2026-10-02. Tests and offline import make no network requests.

- `edsm-bodies.json`: unchanged [EDSM bodies response](https://www.edsm.net/api-system-v1/bodies?systemName=Diaba), retrieved at `2026-10-02T20:34:17.7437388Z`.
- `edsm-stations.json`: unchanged [EDSM stations response](https://www.edsm.net/api-system-v1/stations?systemName=Diaba), retrieved at `2026-10-02T20:34:18.6857019Z`.
- `spansh-bodies.json`: 15 `{id64:"decimal body address",record:<raw body record>}` wrappers assembled from the [Spansh system index](https://spansh.co.uk/api/system/2558022062802) and its individual `https://spansh.co.uk/api/body/<id64>` responses. The system index was retrieved at `2026-10-02T20:35:59.3558861Z`; individual body responses were retrieved from `2026-10-02T20:36:38.9337722Z` through `2026-10-02T20:36:48.6359922Z`. Wrappers were assembled at `2026-10-02T20:37:29.2262897Z`. Large address fields are retained as decimal strings to prevent JavaScript integer rounding. These capture timestamps record completed downloads; source record update/survey times are separate and remain in the records.

The normalized snapshot uses the fixed batch retrieval timestamp `2026-10-02T20:36:48Z`. Reproduce it from the repository root:

```text
node --experimental-default-type=module scripts/import-orrery-edsm.mjs --system-name Diaba --system-id diaba --bodies data/fixtures/orrery/diaba/edsm-bodies.json --stations data/fixtures/orrery/diaba/edsm-stations.json --spansh-bodies data/fixtures/orrery/diaba/spansh-bodies.json --retrieved-at 2026-10-02T20:36:48Z --output data/orrery/diaba.json
```

Coverage is 15 physical bodies (one star, three planets, eleven moons), no shared barycentres, one ring on Diaba 3, two stellar asteroid belts and 38 facilities. EDSM supplies 28 facilities; ten additional named facilities come from Spansh body records, deduplicated against EDSM by market ID. Thirty-five have known host bodies, ten recognized surface facilities have EDSM coordinate pairs, and three carriers remain unplaced. Source coverage is a dated report, not a guarantee of current in-game facility status.

The raw station response retains latitude/longitude attached to Niijima Station, a Coriolis Starport. Normalization preserves its Diaba 1 a association but excludes those fields from measured surface coordinates. Unnamed Spansh landmarks are not assumed to identify particular facilities or resource deposits. No Diaba ring commodity signals, hotspot records, surface deposits or curated mining locations are inferred. Unknown station-specific update times remain null; Spansh body update times are qualified as `source.recordUpdatedAt` in additional facility records.

Diaba uses no screenshot supplement or personal 10-16 mining source. Its catalog entry has no `locationProvider`; a separate canonical provider can be configured later if verified curated data becomes available. See [the data guide](../../../orrery/README.md) for schema conventions and source authority.
