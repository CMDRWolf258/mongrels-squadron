"""Expedition acceptance: deliberate start, old-data exclusion, fresh journal gains.

All fixtures are local SQLite; tests never contact EDMC, Cloudflare or Frontier.
"""
from __future__ import annotations
import importlib.util
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-scout"
spec = importlib.util.spec_from_file_location("test_surveyor_expedition_core", root / "surveyor.py")
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def event(kind, when, **kwargs):
    return {"event": kind, "timestamp": when, **kwargs}

def stamp(minutes):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")

with tempfile.TemporaryDirectory() as temp:
    db = Path(temp) / "expedition.sqlite3"
    survey = module.Surveyor(db)
    cmdr, other, address = "Wolf258", "Another Commander", "12345889987654321"
    assert survey.snapshot(cmdr)["expedition"]["active"] is False
    try:
        survey.control(cmdr, "mark_existing")
        raise AssertionError("No expedition must reject marking")
    except ValueError as ex:
        assert str(ex) == "expedition_not_active"

    # System and body observed before the user presses Start Exploration.
    survey.apply(cmdr, event("FSDJump", stamp(-60), SystemAddress=address, StarSystem="Old system"))
    old_scan = event("Scan", stamp(-50), SystemAddress=address,
        BodyID=1, BodyName="Old system 1", ScanType="Detailed",
        PlanetClass="High metal content body", MassEM=0.5,
        WasMapped=False, WasDiscovered=False)
    survey.apply(cmdr, old_scan)
    known = survey.snapshot(cmdr)
    assert known["currentSystemEstimate"] > 0
    assert known["expedition"]["estimate"] == 0
    started = survey.control(cmdr, "start")
    assert started["expedition"]["active"] is True
    assert started["expedition"]["estimate"] == 0  # historical not imported into expedition
    again = survey.control(cmdr, "start")
    assert again["expedition"]["startedAt"] == started["expedition"]["startedAt"]

    # Repeating an old body Scan is not a new discovery, despite newer timestamp.
    survey.apply(cmdr, dict(old_scan, timestamp=stamp(2)))
    assert survey.snapshot(cmdr)["expedition"]["estimate"] == 0

    # A new scan adds its observed provisional value after Start.
    new_scan = event("Scan", stamp(3), SystemAddress=address,
        BodyID=2, BodyName="Old system 2", ScanType="Detailed",
        PlanetClass="Water world", MassEM=1.2,
        WasMapped=False, WasDiscovered=False)
    survey.apply(cmdr, new_scan)
    after_scan = survey.snapshot(cmdr)
    first_gain = after_scan["expedition"]["estimate"]
    assert first_gain > 0
    assert after_scan["expedition"]["countedScans"] == 1

    # Mark the current system: old expedition contribution excluded immediately.
    marked = survey.control(cmdr, "mark_existing")
    assert marked["expedition"]["estimate"] == 0, marked["expedition"]
    assert marked["expedition"]["existingDataExcluded"] is True
    repeated = survey.control(cmdr, "mark_existing")
    assert repeated["expedition"]["estimate"] == 0  # repeated click is safe
    assert survey.snapshot(cmdr)["personallyScannedBodies"] == 2

    # New FSS/DSS work AFTER marking MUST STILL count.
    third_scan = event("Scan", stamp(4), SystemAddress=address,
        BodyID=3, BodyName="Old system 3", ScanType="Detailed",
        PlanetClass="Water world", MassEM=1.3,
        WasMapped=False, WasDiscovered=False)
    survey.apply(cmdr, third_scan)
    now = survey.snapshot(cmdr)
    assert now["expedition"]["estimate"] > 0
    assert now["expedition"]["countedScans"] == 1

    # DSS mapping previously scanned data credits only the *increment*.
    before_map = now["expedition"]["estimate"]
    survey.apply(cmdr, event("SAAScanComplete", stamp(5),
        SystemAddress=address, BodyID=1, BodyName="Old system 1",
        ProbesUsed=5, EfficiencyTarget=7))
    after_map = survey.snapshot(cmdr)
    expected = after_map["currentSystemEstimate"] - now["currentSystemEstimate"]
    assert after_map["expedition"]["estimate"] == before_map + expected
    assert after_map["expedition"]["countedMaps"] == 1
    assert after_map["personallyMappedBodies"] == 1

    # Replays may be delivered multiple ways; never pay twice.
    survey.apply(cmdr, event("SAAScanComplete", stamp(5),
        SystemAddress=address, BodyID=1, BodyName="Old system 1",
        ProbesUsed=5, EfficiencyTarget=7))
    assert survey.snapshot(cmdr)["expedition"]["estimate"] == after_map["expedition"]["estimate"]
    restored = module.Surveyor(db).snapshot(cmdr)
    assert restored["expedition"]["estimate"] == after_map["expedition"]["estimate"]
    assert restored["expedition"]["existingDataExcluded"] is True
    assert module.Surveyor(db).snapshot(other)["expedition"]["active"] is False

    # Undo exclusion restores the credit made before marking; scans never deleted.
    undone = survey.control(cmdr, "undo_existing")
    assert undone["expedition"]["estimate"] == after_map["expedition"]["estimate"] + first_gain
    assert undone["expedition"]["existingDataExcluded"] is False

    # Three different Frontier system quotes are references, never a global
    # increase applied indiscriminately to new scans or expedition credit.
    original_value = survey.snapshot(cmdr)["currentSystemEstimate"]
    original_credit = survey.snapshot(cmdr)["expedition"]["estimate"]
    first_comparison = survey.record_carto_reference(cmdr, 32267, "Old system")
    assert first_comparison["cartographicsComparison"]["references"] == 1
    assert first_comparison["currentSystemEstimate"] == original_value
    for ordinal in (2, 3):
        new_address = str(12345889987654321 + ordinal)
        name = f"Comparison system {ordinal}"
        survey.apply(cmdr, event("FSDJump", stamp(10 + ordinal),
            StarSystem=name, SystemAddress=new_address))
        survey.apply(cmdr, event("Scan", stamp(15 + ordinal), SystemAddress=new_address,
            BodyID=1, BodyName=f"{name} 1", ScanType="Detailed",
            PlanetClass="Icy body", MassEM=0.2, WasDiscovered=False))
        survey.record_carto_reference(cmdr, 70000 * ordinal, name)
    survey.apply(cmdr, event("FSDJump", stamp(30),
        StarSystem="Old system", SystemAddress=address))
    compared = survey.snapshot(cmdr)
    assert compared["cartographicsComparison"]["references"] == 3
    assert compared["cartographicsComparison"]["calibrationReady"] is False
    assert compared["cartographicsComparison"]["diagnosticMedianRatio"] is not None
    assert compared["currentSystemEstimate"] == original_value
    assert compared["currentSystemBaseEstimate"] == original_value
    assert compared["expedition"]["estimate"] >= original_credit

    survey.control(cmdr, "end")
    assert survey.snapshot(cmdr)["expedition"]["active"] is False
    restarted = survey.control(cmdr, "start")
    assert restarted["expedition"]["estimate"] == 0
    assert restarted["currentSystemEstimate"] == after_map["currentSystemEstimate"]
    assert module.Surveyor(db).snapshot(cmdr)["expedition"]["active"] is True

print("Surveyor expedition: start/end, no historic credit, re-scans, fresh FSS/DSS, cutoff, undo, restart, isolation PASSED")
