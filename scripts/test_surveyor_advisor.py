"""Offline DSS-advisor ranking and journal integration regression tests."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "downloads" / "mongrel-scout" / "surveyor.py"
spec = importlib.util.spec_from_file_location("mongrel_surveyor_advisor_tests", PATH)
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def body(ident, gain, distance, *, class_name="Water world", mapped=False,
         scanned=True, star=False, recorded_mapping=None):
    return {
        "bodyId": str(ident), "name": f"Test A {ident}",
        "planetClass": class_name, "personallyScanned": scanned,
        "personallyMapped": mapped, "starType": "G" if star else None,
        "distanceLs": distance, "mappingGainMin": gain,
        "mappingGainMax": int(gain * 1.25) if gain is not None else None,
        "wasMapped": recorded_mapping,
    }


# More credits is not always a better target. Nearby worthwhile worlds
# should outrank farther, marginally higher-paying worlds.
candidates = [
    body(1, 200_000, 100), body(2, 220_000, 100_000),
    body(3, 20_000, 20), body(4, 999_000, 1, mapped=True),
    body(5, 999_000, 1, scanned=False), body(6, 999_000, 1, star=True),
    body(7, None, 100), body(8, 500_000, None),
]
original = [dict(x) for x in candidates]
advisor = mod._mapping_advisor(candidates)
assert candidates == original, "Advisor must not mutate journal-derived body views"
assert advisor["eligibleCount"] == 4, advisor
assert advisor["unvaluedScans"] == 1, advisor
assert advisor["distanceUnknownCount"] == 1
assert advisor["targets"][0]["bodyId"] == "8"  # high-value, unmeasured distance
assert [x["bodyId"] for x in advisor["targets"]].index("1") < [x["bodyId"] for x in advisor["targets"]].index("2"), advisor
assert advisor["potentialGainMin"] == 940_000
assert advisor["potentialGainMax"] == sum(x["dssGainMax"] for x in advisor["targets"])
assert all(x["rank"] == n for n, x in enumerate(advisor["targets"], 1))
assert all(x["distanceStatus"] == "unknown" if x["distanceLs"] is None
           else x["distanceStatus"] == "journal_confirmed_from_arrival"
           for x in advisor["targets"])
assert advisor["rankingBasis"].endswith("not_eta")
assert "arrival" in advisor["rankingBasis"]

# Deterministic tie-breaking independent of arrival order and repeated calls.
ties = [body(12, 100_000, 500), body(11, 100_000, 500)]
first = mod._mapping_advisor(ties)
assert [x["bodyId"] for x in first["targets"]] == ["11", "12"]
assert mod._mapping_advisor(list(reversed(ties))) == first
assert mod._mapping_advisor([body(i, 80_000, 500) for i in range(12)])["targetsTruncated"] == 4

# No personal scan means no verified recommendation, even if external
# intelligence happens to know a planet's type, mass and distance.
empty = mod._mapping_advisor([body(9, 900_000, 20, scanned=False)])
assert empty["status"] == "no_valued_unmapped_scans"
assert not empty["targets"] and empty["eligibleCount"] == 0

with tempfile.TemporaryDirectory() as temp:
    ledger = mod.Surveyor(Path(temp) / "surveyor.sqlite")
    who, address = "Wolf258", "123456789000999"
    jump = {"event": "FSDJump", "timestamp": "2026-10-09T16:00:00Z",
            "StarSystem": "Example", "SystemAddress": address}
    ledger.apply(who, jump)
    earth = {"event": "Scan", "timestamp": "2026-10-09T16:01:00Z",
             "SystemAddress": address, "BodyID": 3,
             "BodyName": "Example A 3", "PlanetClass": "Earthlike body",
             "MassEM": 1.03, "WasMapped": False, "WasDiscovered": False,
             "DistanceFromArrivalLS": 400, "ScanType": "Detailed"}
    ledger.apply(who, earth)
    beacon = {"event": "Scan", "timestamp": "2026-10-09T16:02:00Z",
              "SystemAddress": address, "BodyID": 4,
              "BodyName": "Example A 4", "PlanetClass": "Earthlike body",
              "MassEM": 1.2, "DistanceFromArrivalLS": 100,
              "ScanType": "NavBeaconDetail"}
    snap = ledger.apply(who, beacon)
    targets = snap["mappingAdvisor"]["targets"]
    assert len(targets) == 1 and targets[0]["bodyId"] == "3", targets
    assert targets[0]["firstMappingCandidate"] is True
    assert "Potential first mapping" in targets[0]["reasons"]
    assert targets[0]["distanceLs"] == 400.0
    assert targets[0]["dssGainMax"] > targets[0]["dssGainMin"] > 0

    assert ledger.apply(who, earth) is None
    assert ledger.snapshot(who)["mappingAdvisor"]["eligibleCount"] == 1
    mapped = {"event": "SAAScanComplete", "timestamp": "2026-10-09T16:03:00Z",
              "SystemAddress": address, "BodyID": 3,
              "ProbesUsed": 6, "EfficiencyTarget": 7}
    after = ledger.apply(who, mapped)
    assert after["mappingAdvisor"]["eligibleCount"] == 0, after
    assert after["mappingAdvisor"]["status"] == "no_valued_unmapped_scans"
    assert ledger.apply(who, mapped) is None
    assert ledger.snapshot(who)["mappingAdvisor"]["eligibleCount"] == 0
    reopened = mod.Surveyor(Path(temp) / "surveyor.sqlite")
    assert reopened.snapshot(who)["mappingAdvisor"]["eligibleCount"] == 0
    assert reopened.snapshot("Other CMDR")["mappingAdvisor"]["eligibleCount"] == 0

print("Surveyor DSS adviser ranking, first-map hints, unknown distances, mapped exclusion and replay PASSED")
