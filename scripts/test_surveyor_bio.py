"""Offline organic-journal acceptance tests. No Frontier, EDMC or web required."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-scout" / "surveyor.py"
spec = importlib.util.spec_from_file_location("mongrel_surveyor_bio_test", source)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Surveyor = module.Surveyor


def event(name, when, **details):
    return {"event": name, "timestamp": when, **details}


ADDRESS = 1234567890123456789
SYSTEM = "Bio Test"
BODY = SYSTEM + " 2"
GENUS = "$Codex_Ent_Stratum_Genus_Name;"
SPECIES = "$Codex_Ent_Stratum_07_Name;"
TIME = "2026-10-13T10:00:00Z"

with tempfile.TemporaryDirectory() as folder:
    survey = Surveyor(Path(folder) / "surveyor.db")
    survey.apply("Wolf", event("FSDJump", TIME, SystemAddress=ADDRESS, StarSystem=SYSTEM))
    survey.apply("Wolf", event("Scan", TIME, SystemAddress=ADDRESS, BodyID=2, BodyName=BODY,
                               PlanetClass="High metal content body", MassEM=0.2,
                               WasDiscovered=False, ScanType="Detailed"))
    # FSS only proves a signal; it cannot prove a genus or a particular species.
    signals = [{"Type": "$SAA_SignalType_Biological;", "Type_Localised": "Biological", "Count": 1}]
    snap = survey.apply("Wolf", event("FSSBodySignals", TIME, SystemAddress=ADDRESS,
                                       BodyID=2, BodyName=BODY, Signals=signals))
    opportunity = snap["exobiology"]["biologicalBodies"][0]
    assert opportunity["signals"] == 1
    assert opportunity["possibleStratum"] is True
    assert opportunity["confirmedStratumGenus"] is False
    assert opportunity["sampledSpecies"] == []

    # DSS reports genus, but never identifies the specific species.
    snap = survey.apply("Wolf", event("SAASignalsFound", TIME, SystemAddress=ADDRESS,
        BodyID=2, BodyName=BODY, Signals=signals,
        Genuses=[{"Genus": GENUS, "Genus_Localised": "Stratum"}]))
    opp = snap["exobiology"]["biologicalBodies"][0]
    assert opp["confirmedStratumGenus"] is True
    assert opp["possibleStratum"] is False
    assert opp["confirmedGenuses"][0]["id"] == GENUS
    assert opp["sampledSpecies"] == []
    assert opp["identification"] == "dss_genuses_confirmed"

    def organic(kind, when):
        return event("ScanOrganic", when, SystemAddress=ADDRESS, Body=2, ScanType=kind,
                     Genus=GENUS, Genus_Localised="Stratum",
                     Species=SPECIES, Species_Localised="Stratum Tectonicas",
                     Variant="$Codex_Ent_Stratum_07_A_Name;",
                     Variant_Localised="Stratum Tectonicas - Green")

    pos = {"systemAddress": str(ADDRESS), "bodyName": BODY, "hasLatLong": True,
           "onFootOnPlanet": True, "latitude": 12.3, "longitude": -45.6,
           "planetRadius": 800000, "timestamp": "2026-10-13T10:01:00Z"}
    first = organic("Log", "2026-10-13T10:01:02Z")
    snap = survey.apply("Wolf", first, position=pos)
    record = snap["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]
    assert record["samples"] == 1 and record["completed"] is False
    assert record["samplePositions"][0]["latitude"] == 12.3
    assert record["geneticDistanceMeters"] == 500
    assert survey.apply("Wolf", first, position=pos) is None
    assert len(survey.snapshot("Wolf")["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]["samplePositions"]) == 1

    # Mismatched body & old Status.json must never be fabricated as live positions.
    bad = dict(pos, bodyName="Another body")
    snap = survey.apply("Wolf", organic("Sample", "2026-10-13T10:03:02Z"), position=bad)
    record = snap["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]
    assert record["samples"] == 2 and len(record["samplePositions"]) == 1
    stale = dict(pos, timestamp=TIME)
    snap = survey.apply("Wolf", organic("Analyse", "2026-10-13T10:05:02Z"), position=stale)
    record = snap["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]
    assert record["samples"] == 3 and record["completed"] is True
    assert len(record["samplePositions"]) == 1
    assert record["estimatedBaseValue"] == 19010800
    assert snap["exobiology"]["currentSystemCompletedEstimate"] == 19010800
    assert snap["exobiology"]["outstandingEstimate"] is None
    assert snap["expedition"]["estimate"] == 0  # bio != Universal Cartographics

    # Frontier organic sales lack originating system/body; preserve cash accurately,
    # never clear a completed record by a guessed species -> system association.
    sold = event("SellOrganicData", "2026-10-13T12:00:00Z",
        BioData=[{"Genus": GENUS, "Genus_Localised": "Stratum", "Species": SPECIES,
                  "Species_Localised": "Stratum Tectonicas", "Value": 19010800,
                  "Bonus": 76043200}])
    snap = survey.apply("Wolf", sold)
    assert snap["exobiology"]["confirmedSalesLifetime"] == 95054000
    assert snap["exobiology"]["confirmedBaseLifetime"] == 19010800
    assert snap["exobiology"]["confirmedBonusLifetime"] == 76043200
    assert snap["exobiology"]["saleEvents"] == 1
    assert survey.apply("Wolf", sold) is None
    assert survey.snapshot("Wolf")["exobiology"]["saleEvents"] == 1

    # Historical Vista sales are still valid when there is no active system.
    other = Surveyor(Path(folder) / "other.db")
    old = dict(sold, timestamp="2022-12-07T14:44:28Z")
    old_snap = other.apply("Other", old, historic=True)
    assert old_snap["exobiology"]["confirmedSalesLifetime"] == 95054000
    assert other.snapshot("Other")["exobiology"]["confirmedSalesLifetime"] == 95054000
    assert other.snapshot("Wolf")["exobiology"]["confirmedSalesLifetime"] == 0
    assert Surveyor(Path(folder) / "surveyor.db").snapshot("Wolf")["exobiology"]["confirmedSalesLifetime"] == 95054000

print("Mongrel Surveyor organic tests PASSED (signals, genus, scans, position, sales, dedupe, restart)")
