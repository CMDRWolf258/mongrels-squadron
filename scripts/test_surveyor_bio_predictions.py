"""Test pure biological predictions using Frontier journal-shaped fixtures.

No network, no EDMC, and no independent app installation required.
Assertions deliberately distinguish possible species from confirmed DSS genera
and species verified by a ScanOrganic event.
"""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-scout" / "surveyor.py"
spec = importlib.util.spec_from_file_location("surveyor_bio_rules_test", source)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert len(module.BIO_HABITAT_RULES) >= 20
assert len(module.BIO_GENETIC_DISTANCES_M) == 15
assert module.BIO_GENETIC_DISTANCES_M["Aleoida"] == 150
assert module.BIO_GENETIC_DISTANCES_M["Tubus"] == 800
assert module.BIO_GENETIC_DISTANCES_M["Tussock"] == 200
assert module.BIO_GENETIC_DISTANCES_M["Stratum"] == 500

def evt(kind, time, **kw):
    return {"event": kind, "timestamp": time, **kw}

T = "2026-10-13T16:00:00Z"
ADDR = 1234567890123456789
SYSTEM = "Rule Fixture"
HMC = SYSTEM + " 2"
ROCKY = SYSTEM + " 3"
sig = [{"Type":"$SAA_SignalType_Biological;", "Type_Localised":"Biological", "Count":1}]

def candidate(snap, body_name, species):
    row = next(b for b in snap["exobiology"]["biologicalBodies"] if b["bodyName"] == body_name)
    return next((x for x in row["prediction"]["candidates"] if x["species"] == species), None), row

with tempfile.TemporaryDirectory() as folder:
    database = Path(folder) / "survey.sqlite3"
    scan = module.Surveyor(database)
    scan.apply("Wolf", evt("FSDJump", T, StarSystem=SYSTEM, SystemAddress=ADDR))
    no_body = scan.snapshot("Wolf")
    assert not no_body["exobiology"]["biologicalBodies"]

    # HMC + thin CO2 + suitable temperature permits Tectonicas, not guarantees it.
    scan.apply("Wolf", evt("Scan", T, SystemAddress=ADDR, BodyID=2, BodyName=HMC,
        PlanetClass="High metal content body", Landable=True,
        SurfaceTemperature=185, SurfaceGravity=1.3,
        Atmosphere="thin Carbon dioxide", MassEM=0.12, ScanType="Detailed"))
    snap = scan.apply("Wolf", evt("FSSBodySignals", T, SystemAddress=ADDR,
                                   BodyID=2, BodyName=HMC, Signals=sig))
    tectonicas, row = candidate(snap, HMC, "Stratum Tectonicas")
    assert tectonicas is not None and tectonicas["status"] == "compatible", tectonicas
    assert tectonicas["estimatedBase"] == 19010800
    assert tectonicas["sourceUrl"] == "https://ed-dsn.net/en/stratum_en/"
    assert row["prediction"]["status"] == "signal_based"
    assert row["prediction"]["valueBounds"] is None
    assert row["prediction"]["firstFootfallBonus"] == "unknown_not_claimed"
    assert row["prediction"]["ruleCoverage"] == "partial"
    assert row["prediction"]["planetEvidence"]["gravityG"] < 0.27
    # Rocky-only Stratum Araneamus cannot be predicted on HMC.
    not_on_hmc, _ = candidate(snap, HMC, "Stratum Araneamus")
    assert not_on_hmc is None

    # DSS genus confirmation restricts candidates, never proves a species.
    dss = evt("SAASignalsFound", "2026-10-13T16:00:15Z",
        SystemAddress=ADDR, BodyID=2, BodyName=HMC, Signals=sig,
        Genuses=[{"Genus":"$Codex_Ent_Stratum_Genus_Name;", "Genus_Localised":"Stratum"}])
    snap = scan.apply("Wolf", dss)
    tectonicas, row = candidate(snap, HMC, "Stratum Tectonicas")
    assert tectonicas and row["prediction"]["status"] == "dss_genus_filtered"
    assert all(x["genus"] == "Stratum" for x in row["prediction"]["candidates"])
    assert row["prediction"]["candidateCount"] == 1
    assert row["prediction"]["valueBounds"] is None

    # Actual journal observation supersedes habitat predictions.
    organic = evt("ScanOrganic", "2026-10-13T16:01:15Z",
        SystemAddress=ADDR, Body=2, ScanType="Log",
        Genus="$Codex_Ent_Stratum_Genus_Name;", Genus_Localised="Stratum",
        Species="$Codex_Ent_Stratum_07_Name;", Species_Localised="Stratum Tectonicas")
    snap = scan.apply("Wolf", organic)
    inferred, row = candidate(snap, HMC, "Stratum Tectonicas")
    assert inferred is None  # it is in sampledSpecies as authoritative data
    assert row["prediction"]["status"] == "observed_species"
    assert row["sampledSpecies"][0]["species"] == "Stratum Tectonicas"

    # Known prohibitions must beat marketing excitement.
    bad_temp = {"planetClass":"High metal content body", "atmosphere":"thin Carbon dioxide",
                "surfaceTemperature":150, "landable":True,
                "signals":[{"type":"Biological", "count":1}]}
    assert "Stratum Tectonicas" not in [
        x["species"] for x in module._bio_predict(bad_temp)["candidates"]
    ]
    wrong_gas = dict(bad_temp, surfaceTemperature=210, atmosphere="thin Argon")
    assert "Stratum Tectonicas" not in [
        x["species"] for x in module._bio_predict(wrong_gas)["candidates"]
    ]
    no_landing = dict(bad_temp, surfaceTemperature=210, landable=False)
    assert not module._bio_predict(no_landing)["candidates"]
    # Unknown atmosphere, gravity, and temperature produces provisional status.
    incomplete = {"planetClass":"High metal content body",
        "signals":[{"type":"Biological", "count":1}]}
    candidate_rows = module._bio_predict(incomplete)["candidates"]
    possible = next(x for x in candidate_rows if x["species"] == "Stratum Tectonicas")
    assert possible["status"] == "insufficient_data"
    assert set(possible["missing"]) >= {
        "atmosphere_gas", "thin_atmosphere", "surface_temperature", "landability"
    }

    # Clypeus Speculumi cannot be called fully compatible without an authoritative
    # distance to *parent* star, not merely Frontier DistanceFromArrivalLS.
    clypeus = {
        "planetClass":"Rocky body", "landable":True,
        "atmosphere":"thin Water", "surfaceTemperature":215,
        "surfaceGravity":1, "distanceLs":5000,
        "signals":[{"type":"Biological", "count":1}]
    }
    speculumi = next(x for x in module._bio_predict(clypeus)["candidates"]
                     if x["species"] == "Clypeus Speculumi")
    assert speculumi["status"] == "insufficient_data"
    assert "parent_star_distance" in speculumi["missing"]

    # Unknown/star-dependent Electricae Pluma cannot be declared definite.
    elect = {"planetClass":"Icy body", "landable":True, "atmosphere":"thin Neon",
        "surfaceGravity":1, "surfaceTemperature":100,
        "signals":[{"type":"Biological", "count":1}]}
    pluma = next(x for x in module._bio_predict(elect)["candidates"]
                 if x["species"] == "Electricae Pluma")
    assert "parent_star_luminosity" in pluma["missing"]

    # Genus against incompatible world must not be fabricated as a confirmed
    # prediction; the authoritative journal evidence is still retained.
    rocky = evt("Scan", "2026-10-13T16:02:00Z", SystemAddress=ADDR,
        BodyID=3, BodyName=ROCKY, PlanetClass="Rocky body", Landable=True,
        SurfaceTemperature=190, SurfaceGravity=1.0, Atmosphere="thin Carbon dioxide",
        MassEM=0.03, ScanType="Detailed")
    scan.apply("Wolf", rocky)
    snap = scan.apply("Wolf", evt("FSSBodySignals", "2026-10-13T16:02:12Z",
        SystemAddress=ADDR, BodyID=3, BodyName=ROCKY, Signals=sig))
    t, _ = candidate(snap, ROCKY, "Stratum Tectonicas")
    assert t is None
    osseus, _ = candidate(snap, ROCKY, "Osseus Pellebantus")
    assert osseus is not None and osseus["status"] == "compatible"

    # Restart restores all prediction inputs without journal replay.
    again = module.Surveyor(database).snapshot("Wolf")
    back, back_row = candidate(again, ROCKY, "Osseus Pellebantus")
    assert back and back_row["prediction"]["model"] == module.BIO_HABITAT_VERSION
    assert again["exobiology"]["habitatRuleCount"] == len(module.BIO_HABITAT_RULES)
    assert again["exobiology"]["distanceSource"].startswith("https://")

print("Mongrel biological intelligence PASSED (HMC, DSS, stars, exclusions, evidence, restart)")
