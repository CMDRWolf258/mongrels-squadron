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

assert len(module.BIO_HABITAT_RULES) == 60
assert len(module.BIO_HABITAT_SOURCES) == 10
assert "stage4" in module.BIO_HABITAT_VERSION
assert len({row[0] for row in module.BIO_HABITAT_RULES}) == 10
assert all(f"{genus} {species}" in module.BIO_REFERENCE_VALUES for genus,species,*_ in module.BIO_HABITAT_RULES)
assert module.BIO_REFERENCE_VALUES["Bacterium Informem"] == 8418000
assert module.BIO_REFERENCE_VALUES["Bacterium Alcyoneum"] == 1658500
assert module.BIO_REFERENCE_VALUES["Bacterium Bullaris"] == 1152500
assert module.BIO_REFERENCE_VALUES["Stratum Tectonicas"] == 19010800
assert module.BIO_REFERENCE_VALUES["Fungoida Bullarum"] == 3703200
assert module.BIO_PRICE_SOURCE == "https://ed-dsn.net/en/vista-genomics-values/"
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

# Expansion fixtures grounded in DSN's individual species atmosphere tables.
def predict_body(planet="Rocky body",atmosphere="thin Argon",temperature=189,gravity=1.5):
    return module._bio_predict({
        "planetClass":planet, "atmosphere":atmosphere,
        "surfaceTemperature":temperature, "surfaceGravity":gravity,
        "landable":True, "signals":[{"type":"Biological","count":1}],
    })["candidates"]

argon={x["species"] for x in predict_body()}
assert "Bacterium Vesicula" in argon
assert "Fungoida Bullarum" in argon
assert "Bacterium Aurasus" not in argon
co2={x["species"] for x in predict_body(atmosphere="thin Carbon dioxide")}
assert "Bacterium Aurasus" in co2 and "Cactoida Cortexum" in co2
assert "Cactoida Pullulanta" in co2 and "Fungoida Gelata" in co2
cold_co2={x["species"] for x in predict_body(atmosphere="thin Carbon dioxide",temperature=170)}
assert "Cactoida Cortexum" not in cold_co2
assert "Fungoida Gelata" not in cold_co2
water={x["species"] for x in predict_body(atmosphere="thin Water",temperature=155)}
assert "Cactoida Vermis" in water and "Fungoida Gelata" in water
ammonia={x["species"] for x in predict_body(atmosphere="thin Ammonia")}
assert "Fungoida Setisis" in ammonia
assert "Cactoida Lapis" in ammonia
dense={x["species"] for x in predict_body(atmosphere="Carbon dioxide")}
assert not dense, "A dense atmosphere must not be treated as Odyssey thin"
high_g={x["species"] for x in predict_body(atmosphere="thin Argon",gravity=4)}
assert "Fungoida Bullarum" not in high_g
assert "Bacterium Vesicula" in high_g # no unsupported Bacterium gravity ceiling
for x in predict_body():
    assert x["sourceUrl"] in module.BIO_HABITAT_SOURCES.values()
# Source-supported Tubus and Tussock habitat constraints.
def names(world,air,temp,gravity_mps2):
    return {row["species"] for row in module._bio_predict({
        "signals":[{"type":"Biological","count":1}],
        "planetClass":world,"atmosphere":air,"surfaceTemperature":temp,
        "surfaceGravity":gravity_mps2,"landable":True,
    })["candidates"]}
tubus = names("Rocky body","thin Carbon dioxide",175,1.0)
assert {"Tubus Cavas","Tubus Conifer","Tubus Compagibus"} <= tubus
assert "Tubus Sororibus" not in tubus
assert "Tussock Albata" in tubus
tubus_hmc = names("High metal content body","thin Carbon dioxide",175,1.0)
assert "Tubus Sororibus" in tubus_hmc and "Tubus Conifer" not in tubus_hmc
high_gravity = names("Rocky body","thin Carbon dioxide",175,3.0)
assert "Tubus Conifer" not in high_gravity
assert "Tussock Albata" not in high_gravity
cold = names("Rocky body","thin Carbon dioxide",150,1.0)
assert "Tussock Pennata" in cold and "Tussock Ignis" not in cold
ammonia_tubus = names("Rocky body","thin Ammonia",175,1.0)
assert "Tubus Rosarium" in ammonia_tubus
sulphur = names("Rocky body","thin Sulphur dioxide",160,1.0)
assert "Tussock Stigmasis" in sulphur
assert "Tussock Stigmasis" not in names("Icy body","thin Sulphur dioxide",160,1.0)
assert module.BIO_REFERENCE_VALUES["Tussock Stigmasis"] == 19010800
assert module.BIO_REFERENCE_VALUES["Tubus Cavas"] == 11873200
assert len({f"{genus} {species}" for genus,species,*_ in module.BIO_HABITAT_RULES}) == 60
print("Mongrel biological intelligence PASSED (10 genera / 60 rules; HMC, DSS, gravity, atmosphere, persistence)")
