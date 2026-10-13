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

Version `mongrel-habitats-2026-10-stage2-v1` covers **23 species across five
genera** (Stratum, Aleoida, Osseus, Clypeus, Electricae). This is a deliberately
small, auditable habitat rule set. It is *not yet* a replacement for the breadth
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
