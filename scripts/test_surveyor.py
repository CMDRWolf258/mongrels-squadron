"""Offline journal replay and restart tests for the Surveyor local ledger.

Run: python scripts/test_surveyor.py
No EDMC installation, network, or Cloudflare account is required.
"""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "downloads" / "mongrel-scout" / "surveyor.py"
spec = importlib.util.spec_from_file_location("mongrel_surveyor_test", MODULE)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Surveyor = module.Surveyor


def fixture(event: str, timestamp: str, **kwargs):
    return {"event": event, "timestamp": timestamp, **kwargs}


with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / "exploration.sqlite3"
    ledger = Surveyor(path)
    name = "Test CMDR"
    address = 1234567890123456789  # Exercise safe string ID64 handling.
    arrival = fixture("FSDJump", "2026-10-08T10:00:00Z",
                      StarSystem="Test System", SystemAddress=address)
    assert ledger.apply(name, arrival, "Test System")["system"]["address"] == str(address)
    honk = fixture("FSSDiscoveryScan", "2026-10-08T10:01:00Z", BodyCount=3)
    assert ledger.apply(name, honk, "Test System")["system"]["bodyCount"] == 3

    star = fixture("Scan", "2026-10-08T10:02:00Z", SystemAddress=address,
                   BodyID=0, BodyName="Test System", StarType="G",
                   StellarMass=1.0, WasDiscovered=False, WasMapped=False,
                   ScanType="AutoScan")
    snap = ledger.apply(name, star)
    assert snap["discoveryStatus"] == "potential_first_arrival_star"
    assert snap["potentialFirstBodies"] == 1

    water = fixture("Scan", "2026-10-08T10:03:00Z", SystemAddress=address,
                    BodyID=2, BodyName="Test System 2", PlanetClass="Water world",
                    MassEM=0.9, TerraformState="", WasDiscovered=True,
                    WasMapped=True, ScanType="Detailed")
    snap = ledger.apply(name, water)
    before = snap["unsoldEstimate"]
    assert before > 0, snap
    target = next(b for b in snap["bodies"] if b["bodyId"] == "2")
    assert target["mappingStatus"] == "previously_mapped", target
    assert target["currentValue"] > 0 and target["mappedValue"] > target["currentValue"]
    assert target["mappingGain"] == target["mappedValue"] - target["currentValue"]
    # Identical journal replays must neither create entries nor increase projected credits.
    assert ledger.apply(name, water) is None
    assert ledger.snapshot(name)["unsoldEstimate"] == before

    mapped = fixture("SAAScanComplete", "2026-10-08T10:05:00Z",
                     SystemAddress=address, BodyID=2, BodyName="Test System 2",
                     ProbesUsed=6, EfficiencyTarget=8)
    snap = ledger.apply(name, mapped)
    target = next(b for b in snap["bodies"] if b["bodyId"] == "2")
    assert target["personallyMapped"] and target["mappingGain"] is None
    assert snap["unsoldEstimate"] > before
    mapped_total = snap["unsoldEstimate"]
    assert ledger.apply(name, mapped) is None
    assert ledger.snapshot(name)["unsoldEstimate"] == mapped_total

    # System switches cannot erase the expedition's accumulated estimates.
    second_address = 987654321098765432
    second = fixture("FSDJump", "2026-10-08T11:00:00Z",
                     StarSystem="Next System", SystemAddress=second_address)
    snap = ledger.apply(name, second)
    assert snap["system"]["name"] == "Next System"
    assert snap["unsoldEstimate"] == mapped_total
    next_star = fixture("Scan", "2026-10-08T11:01:00Z",
                        SystemAddress=second_address, BodyID=0,
                        BodyName="Next System", StarType="K",
                        StellarMass=0.7, WasDiscovered=True, ScanType="AutoScan")
    snap = ledger.apply(name, next_star)
    assert snap["discoveryStatus"] == "previously_discovered_arrival_star"
    assert snap["unsoldEstimate"] > mapped_total

    # Exact, known system sale clears its estimated unsold portion; actual sale is distinct.
    sale = fixture("SellExplorationData", "2026-10-08T12:00:00Z",
                   Systems=["Test System"], TotalEarnings=481002)
    snap = ledger.apply(name, sale)
    assert snap["confirmedSalesLifetime"] == 481002
    assert 0 < snap["unsoldEstimate"] < mapped_total
    assert snap["unsoldEstimateStatus"] == "partial_sale_reconciliation"
    assert ledger.apply(name, sale) is None
    assert ledger.snapshot(name)["confirmedSalesLifetime"] == 481002

    # Restart on the same SQLite store preserves all cross-system and sales totals.
    restarted = Surveyor(path)
    assert restarted.snapshot(name)["unsoldEstimate"] == snap["unsoldEstimate"]
    assert restarted.snapshot(name)["confirmedSalesLifetime"] == 481002

    # Catalog-only/NavBeaconDetail records must not accrue personal scan credits.
    beacon = fixture("Scan", "2026-10-08T12:05:00Z",
                     SystemAddress=second_address, BodyID=5,
                     BodyName="Next System 5", PlanetClass="Earthlike body",
                     MassEM=1.0, ScanType="NavBeaconDetail")
    ledger.apply(name, beacon)
    assert ledger.snapshot(name)["unsoldEstimate"] == snap["unsoldEstimate"]

    # Other commanders sharing the same PC must not inherit another person's balance.
    assert restarted.snapshot("Other CMDR")["unsoldEstimate"] is None
    assert restarted.snapshot("Other CMDR")["confirmedSalesLifetime"] == 0
print("Mongrel Surveyor journal replay tests PASSED (dedupe, mapping, sales, restart, commander isolation)")

