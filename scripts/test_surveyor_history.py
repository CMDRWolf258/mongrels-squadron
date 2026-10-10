"""Local journal-history regression tests: no cloud, no EDMC, no account access."""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-scout"


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


Surveyor = load_module("surveyor_history_test_core", "surveyor.py").Surveyor
history = load_module("surveyor_history_test_importer", "surveyor_history.py")


def journal(event, time, **fields):
    return {"timestamp": time, "event": event, **fields}


def write(path, rows):
    path.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")


with tempfile.TemporaryDirectory() as tmp:
    folder = Path(tmp)
    db = folder / "ledger.sqlite3"
    cmdr = "Wolf258"
    one, two = "1234567890123456789", "88888888888888888"
    # The current system is already being tracked by live Scout. Historical
    # FSDJumps must NOT move the live HUD back to a previously visited system.
    ledger = Surveyor(db)
    ledger.apply(cmdr, journal("FSDJump", "2026-10-09T11:00:00Z",
        StarSystem="Live system", SystemAddress=two))
    files = folder / "logs"
    files.mkdir()
    old_rows = [
        journal("Fileheader", "2026-10-08T08:00:00Z"),
        journal("Commander", "2026-10-08T08:00:01Z", Name="Wolf258"),
        journal("FSDJump", "2026-10-08T08:01:00Z",
            StarSystem="Old system", SystemAddress=one),
        journal("FSSDiscoveryScan", "2026-10-08T08:02:00Z", BodyCount=2),
        journal("Scan", "2026-10-08T08:03:00Z",
            BodyID=1, BodyName="Old system 1", PlanetClass="Water world",
            MassEM=0.9, TerraformState="", WasDiscovered=True,
            WasMapped=True, ScanType="Detailed"),
        journal("SAAScanComplete", "2026-10-08T08:04:00Z",
            BodyID=1, BodyName="Old system 1", ProbesUsed=6, EfficiencyTarget=7),
    ]
    sale = journal("SellExplorationData", "2026-10-08T09:00:00Z",
        Systems=["Old system"], TotalEarnings=1000000)
    other_cmder = [
        journal("Commander", "2026-10-08T09:01:00Z", Name="Other CMDR"),
        journal("FSDJump", "2026-10-08T09:02:00Z",
            StarSystem="Intruder system", SystemAddress="4444444444444"),
        journal("Scan", "2026-10-08T09:02:10Z",
            BodyID=1, PlanetClass="Earthlike body", MassEM=1.0,
            WasDiscovered=False, ScanType="Detailed"),
    ]
    write(files / "Journal.2026-10-08T080000.01.log", old_rows + [sale] + other_cmder)
    # Distinct journal: historic scan without a new address is skipped. Its
    # data cannot be attributed to the wrong Commander or older system.
    write(files / "Journal.2026-10-08T100000.01.log", [
        journal("LoadGame", "2026-10-08T10:00:00Z", Commander="Wolf258"),
        journal("Scan", "2026-10-08T10:01:00Z",
            BodyID=22, PlanetClass="Ammonia world", MassEM=1.2),
    ])
    first = history.import_recent_journals(ledger, cmdr, files)
    assert first["processed"] == 5, first
    assert first["skipped"] >= 1, first
    assert ledger.snapshot(cmdr)["system"]["name"] == "Live system"
    assert ledger.snapshot(cmdr)["confirmedSalesLifetime"] == 1000000
    with ledger._connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM bodies WHERE commander=?", (cmdr,)).fetchone()[0]
        assert count == 1, count
    last = ledger.snapshot(cmdr)["confirmedSalesLifetime"]
    second = history.import_recent_journals(ledger, cmdr, files)
    assert second["processed"] == 0 and second["duplicates"] == first["processed"], second
    assert ledger.snapshot(cmdr)["confirmedSalesLifetime"] == last
    assert ledger.snapshot(cmdr)["system"]["address"] == two
    restarted = Surveyor(db)
    assert restarted.snapshot(cmdr)["confirmedSalesLifetime"] == 1000000

    # MultiSell.Discovered is a list of discoveries, NOT an exhaustive sold
    # system list. It can confirm an actual payout but not a body-by-body zero.
    ledger.apply(cmdr, journal("Scan", "2026-10-09T11:02:00Z",
        SystemAddress=two, BodyID=2, BodyName="Live system 2",
        PlanetClass="Water world", MassEM=1.5,
        WasDiscovered=True, WasMapped=True, ScanType="Detailed"))
    unsold_before = ledger.snapshot(cmdr)["unsoldEstimate"]
    ledger.apply(cmdr, journal("MultiSellExplorationData", "2026-10-09T11:05:00Z",
        Discovered=[{"SystemName": "Live system", "NumBodies": 1}],
        TotalEarnings=400000))
    snap = ledger.snapshot(cmdr)
    assert snap["confirmedSalesLifetime"] == 1400000
    assert snap["unsoldEstimate"] == unsold_before, snap
    assert snap["unsoldEstimateStatus"] == "incomplete_sale_reconciliation"

    # Upper/lower value estimates expose uncertainty from DSS efficiency.
    body = next(b for b in snap["bodies"] if b.get("bodyId") == "2")
    assert body["mappedValueMax"] > body["mappedValueMin"], body
    assert body["valuationConfidence"] == "community_estimate_not_sale_value"

    # Repeated scans of older completed events should never bring the stored
    # acquisition timestamp backward or double-credit sales.
    future = ledger.apply(cmdr, journal("Scan", "2026-10-09T11:07:00Z",
        SystemAddress=two, BodyID=2, MassEM=1.5, ScanType="Detailed"))
    earlier = ledger.apply(cmdr, journal("Scan", "2026-10-08T11:07:00Z",
        SystemAddress=two, BodyID=2, MassEM=1.5, ScanType="Detailed"), historic=True)
    assert earlier is not None
    with ledger._connect() as conn:
        b = ledger._load(conn, "bodies", cmdr, two, "2")
        assert b["lastDataAcquiredAt"] == "2026-10-09T11:07:00Z"

    # Identical replay never creates new sales/scan records.
    history.import_recent_journals(ledger, cmdr, files)
    assert ledger.snapshot(cmdr)["confirmedSalesLifetime"] == 1400000

print("Surveyor historic replay, duplicate safety, sale reconciliation, CMDR isolation and value ranges PASSED")
