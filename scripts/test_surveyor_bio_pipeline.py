"""Offline Scout -> Surveyor -> HUD real-code integration, no Windows/EDMC/network.

Exercises the *real* Scout callback functions and real SQLite ledger, then passes
their JSON bridge payload into the HUD's pure navigation/selection functions.
This reproduces the on-foot Status.json + Frontier journal ordering.
"""
from __future__ import annotations

import ast
import importlib.util
import json
import math
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[1]
SCOUT = ROOT / "downloads" / "mongrel-scout"
HUD = ROOT / "downloads" / "mongrel-hud" / "mongrel_hud.py"
spec = importlib.util.spec_from_file_location("bio_e2e_surveyor", SCOUT / "surveyor.py")
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def extracted(path: Path, functions: set[str], scope: dict[str, Any]) -> dict[str, Any]:
    source = ast.parse(path.read_text(encoding="utf-8"))
    nodes = [n for n in source.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
             and n.name in functions]
    assert {n.name for n in nodes} == functions
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), "exec"), scope)
    return scope

def when(offset: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=offset)).strftime("%Y-%m-%dT%H:%M:%SZ")

def evt(kind, seconds=0, **fields):
    return {"event":kind, "timestamp":when(seconds), **fields}

def as_int(value):
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def as_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

class NoCloud:
    def set(self,*_):
        pass

ADDR = 1234567890123456789
SYSTEM = "Bio E2E Test"
BODY = SYSTEM+" 2"
GENUS = "$Codex_Ent_Stratum_Genus_Name;"
SPECIES = "$Codex_Ent_Stratum_07_Name;"

with tempfile.TemporaryDirectory() as folder:
    ledger = module.Surveyor(Path(folder)/"surveyor.sqlite3")
    state = {"commander":"Wolf", "status":None, "system":None,
             "exploration":None,"explorationStatus":None,"ship":{}}
    callbacks = extracted(SCOUT/"load.py", {
        "_update_hud_system_context","_update_hud_status","_observe_surveyor",
    }, {
        "Mapping":Mapping,"_hud_state":state,"_hud_condition":threading.Condition(),
        "_last_system_name":"","_last_system_address":"","config":NoCloud(),
        "KEY_LAST_SYSTEM":"unused","KEY_LAST_SYSTEM_ADDRESS":"unused",
        "_decimal_text":lambda x:str(x or ""),"_optional_int":as_int,
        "_optional_float":as_float,"_update_current_jump_range_locked":lambda *_:None,
        "_nav_id":None,"_refresh_route_navigation":lambda:None,
        "_get_surveyor":lambda:ledger,
    })
    huds = extracted(HUD, {"great_circle_nav","bio_focus_body","bio_genetic_guidance"},
        {"math":math,"datetime":datetime,"timezone":timezone,"Any":Any})
    assert "bio_genetic_guidance" in huds

    def journal(item, system=SYSTEM):
        callbacks["_update_hud_system_context"](system,item,{"SystemAddress":ADDR,"SystemName":system})
        callbacks["_observe_surveyor"]("Wolf",system,item,{"SystemAddress":ADDR})

    def status(body,latitude,longitude,seconds=0,system_addr=ADDR):
        # Real Status.json flags: HasLatLong=bit21, OnFootOnPlanet=Flags2 bit4.
        # The Scout adds system identity only for the organic observation.
        callbacks["_update_hud_status"]("Wolf", {
            "timestamp":when(seconds),"event":"Status",
            "Flags":(1<<21),"Flags2":(1<<4),
            "BodyName":body,"Latitude":latitude,"Longitude":longitude,
            "PlanetRadius":1000000,"Heading":12.0,
        })
        if system_addr != ADDR:
            state["system"]["address"] = str(system_addr)

    def bridge():
        assert state["explorationStatus"] == {"ok":True,"error":None}
        # Data is actually JSON-safe across the localhost Scout <-> HUD link.
        return json.loads(json.dumps(state))

    journal(evt("FSDJump",-120,StarSystem=SYSTEM,SystemAddress=ADDR))
    journal(evt("Scan",-110,BodyID=2,BodyName=BODY,SystemAddress=ADDR,
        PlanetClass="High metal content body",Atmosphere="thin Carbon dioxide",
        SurfaceTemperature=180,SurfaceGravity=1.3,Landable=True,MassEM=0.3,
        Genuses=[{"Genus":GENUS,"Genus_Localised":"Stratum"}]))
    journal(evt("FSSBodySignals",-106,BodyID=2,BodyName=BODY,SystemAddress=ADDR,
        Signals=[{"Type":"$SAA_SignalType_Biological;","Type_Localised":"Biological","Count":1}]))
    first=bridge()
    bio=first["exploration"]["exobiology"]["biologicalBodies"][0]
    assert bio["confirmedGenuses"][0]["name"] == "Stratum" # from Scan, pre-DSS
    assert bio["prediction"]["status"] == "dss_genus_filtered"
    assert bio["prediction"]["candidateCount"] == 1

    # DSS blank Genuses must not erase earlier confirmed Scan genus evidence.
    journal(evt("SAASignalsFound",-103,BodyID=2,BodyName=BODY,SystemAddress=ADDR,
        Genuses=[],Signals=[{"Type":"$SAA_SignalType_Biological;","Type_Localised":"Biological","Count":1}]))
    assert bridge()["exploration"]["exobiology"]["biologicalBodies"][0]["confirmedGenuses"]

    def organic(kind,seconds,bodyid=2):
        return evt("ScanOrganic",seconds,SystemAddress=ADDR,Body=bodyid,ScanType=kind,
             Genus=GENUS,Genus_Localised="Stratum",
             Species=SPECIES,Species_Localised="Stratum Tectonicas")

    status(BODY,0,0,-40)
    journal(organic("Log",-39))
    first=bridge()
    organic_body=first["exploration"]["exobiology"]["biologicalBodies"][0]
    sample=organic_body["sampledSpecies"][0]
    assert sample["samples"]==1 and sample["samplePositions"][0]["latitude"] == 0
    assert first["exploration"]["system"]["lastOrganicBodyId"] == "2"

    status(BODY,0,0.03,-17)
    journal(organic("Sample",-16))
    second=bridge()
    assert second["exploration"]["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]["samples"]==2

    status(BODY,0,0.04,0)
    show=bridge()
    selected=huds["bio_focus_body"](show["exploration"],show["status"])
    assert selected["bodyName"]==BODY
    guide=huds["bio_genetic_guidance"](show["exploration"],show["status"])
    assert guide["status"]=="move_farther" and guide["requiredMeters"]==500,guide
    status(BODY,0,0.06,0)
    ready=huds["bio_genetic_guidance"](bridge()["exploration"],bridge()["status"])
    assert ready["status"]=="genetic_distance_met" and ready["remainingMeters"]==0,ready

    # Active return-to-journal geography cannot substitute for a different body.
    status(SYSTEM+" 7",0,0.07)
    wrong=huds["bio_genetic_guidance"](bridge()["exploration"],bridge()["status"])
    assert wrong["status"]=="distance_unavailable"

    # A Frontier organic event can precede its matching cartographic Scan:
    # the live Status may provide a body name if and ONLY IF timing/system match.
    unseen=SYSTEM+" 3"
    status(unseen,12,-54,-5)
    journal(organic("Log",-4,bodyid=3))
    snap=bridge()
    observed=next(b for b in snap["exploration"]["exobiology"]["biologicalBodies"] if b["bodyId"]=="3")
    assert observed["bodyName"]==unseen
    assert len(observed["sampledSpecies"][0]["samplePositions"])==1
    assert snap["exploration"]["system"]["lastOrganicBodyId"]=="3"
    assert huds["bio_focus_body"](snap["exploration"],snap["status"])["bodyName"]==unseen

    # Out-of-system Status must not set a fictitious body or sample location.
    # The Status fix is tagged while the HUD still believes it is elsewhere.
    state["system"]["address"]=str(ADDR+1)
    status(SYSTEM+" 4",8,22,-4,system_addr=ADDR+1)
    assert state["status"]["systemAddress"] == str(ADDR+1)
    journal(organic("Log",-3,bodyid=4))
    out=next(b for b in bridge()["exploration"]["exobiology"]["biologicalBodies"] if b["bodyId"]=="4")
    assert not out["sampledSpecies"][0].get("samplePositions")
    assert out["bodyName"]==""

    # Vista Genomics confirmation is separate from cartographics and remains
    # correctly attributed after SQLite/HUD restart.
    journal(evt("SellOrganicData",0,BioData=[{"Genus":GENUS,"Genus_Localised":"Stratum",
        "Species":SPECIES,"Species_Localised":"Stratum Tectonicas",
        "Value":19010800,"Bonus":76043200}]))
    sold=bridge()["exploration"]
    assert sold["exobiology"]["confirmedSalesLifetime"]==95054000
    assert sold["confirmedSalesLifetime"]==0
    assert module.Surveyor(Path(folder)/"surveyor.sqlite3").snapshot("Wolf")["exobiology"]["saleEvents"]==1

print("Frontier Status/Journal -> Scout callbacks -> SQLite -> HUD guidance PASSED")
