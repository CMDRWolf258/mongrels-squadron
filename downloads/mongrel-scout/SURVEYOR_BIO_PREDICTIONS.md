# Mongrel Surveyor: biological intelligence (Phase 2)

This capability extends the already-connected Frontier journal / EDDiscovery Surveyor
pipeline. It does not replace our HUD, make a new standalone app, or add Cloudflare
storage/polling. Biological intelligence is derived **locally** from Frontier's
journal Scan/FSSBodySignals/SAASignalsFound/ScanOrganic data.

## Evidence tiers

1. `FSSBodySignals` biological count: confirms signals, not genus or species.
2. `Scan` conditions: filters **possible** species using the published habitat
   rules (world type, *thin* atmospheric gas, Kelvin temperature, surface gravity).
3. `SAASignalsFound.Genuses`: proves genus list; does not prove an individual
   species. Predicted candidates narrow accordingly.
4. `ScanOrganic`: observed species overrides the corresponding genus predictions.
   Progress/sale records remain the authority for completed scans and earnings.

The response is `snapshot.exobiology.biologicalBodies[].prediction`, alongside
confirmed `sampledSpecies`. Each candidate has `status` ("compatible" or
"insufficient_data"), `missing` constraints, a source URL, and a nullable
estimated base price. **"Compatible" is not "confirmed"**: even a one-candidate
prediction cannot assert that a particular organism exists. No first-footfall
or first-to-log bonus is assumed.

## Data coverage / deliberate exclusions

The initial version `mongrel-habitats-2026-10-stage2-v1` covered **23 species
across five genera**. The current version is `mongrel-habitats-2026-10-stage4-v1`,
covering **60 curated species across ten genera**. These are auditable, partial
community-reference habitat rules. It is *not yet* a replacement for the breadth
of BioInsights/EDMC-BioScan. Out-of-model genera and variants remain unknown;
a blank prediction never means the planet lacks life. Do not calculate a
confident planet payout total by summing candidates, because:
- The catalog is partial; many possible species are not represented.
- Exactly one species per genus may occur even where many pass environment rules.
- Some candidate names lack sourced prices; unknown price is `null`, not zero.
- Unverified parent-star constraints are marked `insufficient_data`.

The rule engine never substitutes system distance from arrival for distance to
a planet's **parent star** (Clypeus Speculumi). Likewise an Electricae Pluma
prediction remains conditional until verified parent-star/luminosity context
is available.

### Source and licensing provenance

Original, narrowly curated rule expressions based on publicly stated habitat
conditions, not code/data copied from GPL/AGPL BioScan, StratumFinder or
third-party bundled spreadsheets. Each candidate includes its underlying
habitat source link:
- Stratum: https://ed-dsn.net/en/stratum_en/
- Aleoida: https://ed-dsn.net/en/aleoida_en/
- Osseus: https://ed-dsn.net/en/osseus_en/
- Clypeus: https://ed-dsn.net/en/clypeus_en/
- Electricae: https://ed-dsn.net/en/electricae_en/
- Stratum reference values: https://elite-dangerous.fandom.com/wiki/Stratum
- Genus sampling ranges: https://github-wiki-see.page/m/njthomson/SrvSurvey/wiki/Organic-Scanning

No files from those projects are packaged or copied. The public URLs are for
human comparison and future validation; Scout does not fetch any of them.
The pre-existing Frontier journal records and private SQLite store remain
the sole sources of personal discoveries and payout confirmations.

## Regression and release control

`python scripts/test_surveyor_bio_predictions.py` verifies HMC Tectonicas
opportunities, misleading atmospheres/temperatures, DSS filtering,
sample-confirmed overrides, unknown planetary metrics, parent-star restrictions,
genetic separation distances and persisted snapshots. The existing journal,
BGS, mission-sync and website smoke tests must continue to pass.

**Do not publish a Scout/HUD binary or ask Wolf to install anything simply
because this backend merge passes CI.** The next phase will wire compact
Exobiology HUD panels and the paired iPad controls, with end-to-end mocked
status/journal tests and then one coordinated owner gameplay test.

## Phase 3A: expanded intelligence and HUD controls

- `mongrel-habitats-2026-10-stage3-v1`: **40 species conditions / 8 genera**.
  The three additional genus groups are Bacterium (8 models), Cactoida (5),
  Fungoida (4). Individual conditions are cross-checked against:
  - https://ed-dsn.net/en/bacterium_en/
  - https://ed-dsn.net/en/cactoida_en/
  - https://ed-dsn.net/en/fungoida_en/
- Volcanism-specific bacteria (Omentum, Scopulum, Verrata, Tela) are not
  declared compatible by a generic "volcanism present" test. They remain
  outside this scoped catalog until precise subclass requirements and
  geological signal data can be verified. This is a coverage gap, not a
  claim of absence from the planet.
- DSN's published Vista Genomics table now supplies explicit **base** values
  for all 40 modeled species; the catalog may contain additional sold-species
  references even if no habitat prediction is available:
  https://ed-dsn.net/en/vista-genomics-values/
  Bonus awards remain unknown until Frontier SaleOrganicData, and any
  candidate value is merely the base for *one possible species*.
- Cactoida/Fungoida require compatible thin atmosphere and (where relevant)
  gravity <=0.27g; CO2 Fungoida Gelata/Stabitis additionally need
  180-195 K, but water-atmosphere cases do not use those CO2 limits.
- HUD now has a separate **Biological Intelligence** instrument in the
  Exploration profile, using the existing panel visibility/size/profile
  system. It lists candidate species (never labelled confirmed), observed
  biological specimens with x/3 samples and confirmed genus evidence.
- Genetic spacing uses existing `great_circle_nav`, latest saved Frontier
  sample position and live on-foot Status from the **same body**. The current
  Status timestamp must be within 30 seconds and the stored planet radius
  must match within 1%. Bad/missing coordinates display **unverified**,
  never "ready to sample".
- The iPad controller includes a corresponding panel switch/size/profile
  selector, biological planet preview, evidence display, sample-spacing
  cue and confirmed Vista Genomics totals. Its body dropdown is a **preview
  only** and does not secretly retarget ship navigation.
- No new remote API, overlay polling, cloud rows, or Scout ZIP module. All
  presentation is computed from the already-refreshed localhost Scout state.
- Tests: `scripts/test_surveyor_bio_predictions.py`,
  `scripts/test_surveyor_bio_hud.py`,
  `scripts/test-surveyor-bio-controller.mjs`, plus the existing
  website/Scout/HUD regression tests.

**Not yet done:** 100%-coverage species habitat model, galaxy region and
nearby nebula restrictions, plant-colour variants, production HUD/Scout
packaging and owner live gameplay acceptance. Continue the bulk catalog with
clear attribution, then package a synchronized install only after checks.


## Phase 4: More habitat coverage, full local callback testing, staged artifacts

- Added Tubus (5 species) and Tussock (15 species) from the DSN habitat
  records, including rocky/HMC distinctions, 0.15g or 0.27g constraints,
  atmosphere and source-specific Kelvin windows:
  - https://ed-dsn.net/en/tubus_en/
  - https://ed-dsn.net/en/tussock_en/
- All 60 modeled species now have an explicit community-published Vista
  Genomics **base price** from https://ed-dsn.net/en/vista-genomics-values/.
  Values remain estimates; multiple habitat candidates must not be summed
  as if they are all real organisms.
- Frontier `Scan.Genuses` is preserved when present, as is
  `SAASignalsFound.Genuses`. An empty later genus list never erases
  previously confirmed Frontier genus evidence.
- `ScanOrganic` has a body ID but ordinarily no body name. On a previously
  unknown body, Scout may attach the current `Status.json` body name only if
  captured on foot, with matching system and a time difference <=15 seconds.
  The last organic body (distinct from last mapped/scan target) takes
  precedence in the automatic biological HUD focus.
- `Status.json` contains no system ID, so Scout now stamps each status with
  the current local system **at capture time**. It must never repurpose that
  old status after a jump by stamping it with the current system later.
  iPad and Windows genetic guidance require this bound system ID in addition
  to matching body/radius, valid latitude/longitude and fresh observation.
- `scripts/test_surveyor_bio_pipeline.py` executes actual Scout callbacks,
  Frontier-style journal/Status events, the actual SQLite Surveyor model and
  extracted real HUD GPS guidance functions. It validates first-genus
  detection, stage progression, on-foot body fallback, stale-system rejection,
  JSON bridge compatibility, and separation of Vista sales from UC.
- A deliberately isolated `workflow_dispatch` workflow builds paired
  `MongrelScout-Exobiology-TEST` and `MongrelHUD-Exobiology-TEST` artifacts
  **only after a quality gate**. Scout packaging includes `mission_sync.py`
  (previous private testing package omitted this necessary live module).
  Instructions: `downloads/mongrel-scout/EXOBIOLOGY_TESTING.md`.
  No public download, normal auto-updater or active plugin is overwritten.

Current limitations: remaining species and location-specific planet/parent-star
rules, variant conditions and authoritatively reconstructing Vista Genomics
per-body sale provenance. First-footfall bonuses remain unverified until sale.
