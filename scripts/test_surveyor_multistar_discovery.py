"""Frontier multi-star discovery classification, live-alert migration, and empty-overlay guard."""
from __future__ import annotations
import importlib.util
import json
import sqlite3
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/"downloads/mongrel-scout/surveyor.py"
spec=importlib.util.spec_from_file_location("survey_multistar_regression",PATH)
assert spec and spec.loader
survey=importlib.util.module_from_spec(spec)
spec.loader.exec_module(survey)

name="NGC 2546 Sector FD-F b39-0"
addr=129876543219
def jump(minute=0):
    return {"event":"FSDJump","timestamp":f"2026-10-14T03:{minute:02d}:00Z",
            "StarSystem":name,"SystemAddress":addr}
def star(letter,body_id,minute,discovered=False):
    return {"event":"Scan","timestamp":f"2026-10-14T03:{minute:02d}:00Z",
            "StarSystem":name,"SystemAddress":addr,"BodyName":f"{name} {letter}",
            "BodyID":body_id,"StarType":"M","DistanceFromArrivalLS":2.55 if letter=="A" else 300.0,
            "ScanType":"AutoScan","WasDiscovered":discovered,"WasMapped":False}

# 'A' is the arriving star despite a nonzero ID; the star is not named
# exactly the same as the system. Secondary stars must remain body alerts.
with tempfile.TemporaryDirectory() as tmp:
    ledger=survey.Surveyor(Path(tmp)/"live.sqlite")
    cm="Wolf258 test"
    ledger.apply(cm,jump())
    for letter,n,i in (("B",9,1),("C",10,2)):
        result=ledger.apply(cm,star(letter,n,i))
        assert len(result["explorationAlerts"])==i
        assert result["explorationAlerts"][-1]["kind"]=="first_discovery_body"
    result=ledger.apply(cm,star("A",5,3))
    assert result["discoveryStatus"]=="potential_first_arrival_star", result["discoveryStatus"]
    assert [row["kind"] for row in result["explorationAlerts"]]==[
        "first_discovery_body","first_discovery_body","first_discovery_system"],result["explorationAlerts"]
    assert result["explorationAlerts"][-1]["name"]==name+" A"
    assert result["explorationAlerts"][-1]["id"]=="first_discovery_system:5"
    # Replays are idempotent; the same scan cannot be credited or alerted twice.
    assert ledger.apply(cm,star("A",5,3)) is None
    assert len(ledger.snapshot(cm)["explorationAlerts"])==3
    # Repair a prior version's persisted current-visit body alert without
    # scanning history again. The stored Frontier wasDiscovered evidence remains authoritative.
    with sqlite3.connect(Path(tmp)/"live.sqlite") as conn:
        row=conn.execute("SELECT info FROM systems WHERE commander=? AND address=?",
                         (cm,str(addr))).fetchone()
        info=json.loads(row[0])
        info["explorationAlerts"][-1]["kind"]="first_discovery_body"
        info["explorationAlerts"][-1]["id"]="first_discovery_body:5"
        conn.execute("UPDATE systems SET info=? WHERE commander=? AND address=?",
                     (json.dumps(info,separators=(",",":")),cm,str(addr)))
    restored=survey.Surveyor(Path(tmp)/"live.sqlite").snapshot(cm)
    assert restored["explorationAlerts"][-1]["kind"]=="first_discovery_system"
    assert restored["discoveryStatus"]=="potential_first_arrival_star"
    # Historical bodies alone cannot manufacture active cockpit alerts.
    historic=survey.Surveyor(Path(tmp)/"history.sqlite")
    historic.apply("archive",jump())
    historic.apply("archive",star("A",5,3),historic=True)
    assert historic.snapshot("archive")["explorationAlerts"]==[]
    # Leaving clears live alerts, even though the original scan remains in the ledger.
    leave=ledger.apply(cm,{"event":"FSDJump","timestamp":"2026-10-14T03:04:00Z",
        "StarSystem":"Another system","SystemAddress":129876543220})
    assert leave["explorationAlerts"]==[]
    assert ledger.snapshot(cm)["explorationAlerts"]==[]

# Discovered primary A never produces a system alert even when secondary B is new.
with tempfile.TemporaryDirectory() as tmp:
    ledger=survey.Surveyor(Path(tmp)/"found.sqlite")
    ledger.apply("test",jump())
    primary=ledger.apply("test",star("A",5,1,discovered=True))
    assert primary["discoveryStatus"]=="previously_discovered_arrival_star"
    assert primary["explorationAlerts"]==[]
    secondary=ledger.apply("test",star("B",9,2))
    assert len(secondary["explorationAlerts"])==1
    assert secondary["explorationAlerts"][0]["kind"]=="first_discovery_body"

# System name suffixes do not match substrings, planets, or an unrelated secondary star.
assert survey._primary_arrival_star({"starType":"M","bodyId":"7","name":name+" A"},name)
assert survey._primary_arrival_star({"starType":"M","bodyId":"0","name":name+" A"},name)
for body in ({"starType":"M","bodyId":"7","name":name+" B"},
             {"starType":"M","bodyId":"8","name":name+" AB"},
             {"planetClass":"High metal content body","bodyId":"5","name":name+" A 1"},
             {"starType":"M","bodyId":"6","name":name+" A 1"}):
    assert not survey._primary_arrival_star(body,name),body
# HUD should suppress a major-only overlay if the active rows contain only body firsts.
hud=(ROOT/"downloads/mongrel-hud/mongrel_hud.py").read_text(encoding="utf-8")
assert 'if panel_id == "surveyor_alert":' in hud
assert 'should_show = bool(events and any(' in hud
assert '{"first_discovery_system", "hmc_bio"} for row in events' in hud
print("Frontier multi-star A/B/C first-discovery alerts and empty-primary suppression PASSED")
