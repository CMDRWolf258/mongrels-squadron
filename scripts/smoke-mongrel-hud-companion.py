from __future__ import annotations
import sys
import tempfile
import types
from pathlib import Path

# GitHub's Linux runner does not ship Tk. The smoke test exercises the
# non-GUI companion core, so provide an import-only stub.
sys.modules.setdefault("tkinter", types.ModuleType("tkinter"))

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"downloads"/"mongrel-hud"))
import mongrel_hud as hud

assert hud.APP_VERSION=="0.2.0"
assert hud.SCOUT_STATE_URL=="http://127.0.0.1:43857/v1/state"
assert hud.CONTROLLER_PORT==43858
nav=hud.great_circle_nav(0,0,0,1,6371000,0)
assert 111000<nav["distance"]<111400
assert 89<nav["bearing"]<91
assert hud.format_distance(5910)=="5.91 km"
assert "RIGHT" in hud.relative_text(20)

with tempfile.TemporaryDirectory() as td:
    store=hud.LocalStore(Path(td)/"state.json")
    app=hud.MongrelHudApp(store,"<html></html>")
    app.snapshot=hud.ScoutSnapshot({
        "system":{"name":"NGC 2546 Sector UZ-G d10-16","address":"668059324240760"},
        "status":{"bodyName":"NGC 2546 Sector UZ-G d10-16 7 b","latitude":-22.7738,"longitude":-98.8161,"heading":42.0,"planetRadius":1234567.0,"shieldsUp":True,"fuelMain":27.5,"pips":[2.0,1.0,3.0]},
        "ship":{"name":"Honey Badger","maxJumpRange":31.4567,"hullHealth":87.3,"shieldsUp":True},
        "target":{"pilotName":"Test Target","ship":"Fer-de-Lance","shieldHealth":73.5,"hullHealth":88.0,"legalStatus":"Wanted","bounty":3842610,"subsystem":{"name":"Power Plant","health":62.0,"observedAt":"2026-10-03T06:00:00Z"},"modules":{"power plant":{"name":"Power Plant","health":62.0,"observedAt":"2026-10-03T06:00:00Z"},"beam laser":{"name":"Beam Laser","health":81.0,"observedAt":"2026-10-03T06:00:01Z"},"cargo hatch":{"name":"Cargo Hatch","health":99.0,"observedAt":"2026-10-03T06:00:02Z"}}},
    },True,"")
    site=app.set_site_center(10,"Periclase")
    assert site["siteNumber"]==10 and site["body"].endswith("7 b")
    assert app.surface_nav()["distance"]<0.01
    dep=app.report_deposit("Periclase",2,"Small deposits")
    assert dep["siteNumber"]==10 and dep["rigs"]==2
    state=app.controller_state()
    assert state["connected"] is True and state["activeSite"]["siteNumber"]==10
    app.process_scout_event({"type":"bounty.awarded","totalReward":842615})
    app.process_scout_event({"type":"bounty.awarded","totalReward":100000})
    app.process_scout_event({"type":"bounty.redeemed","amount":2000000})
    assert app.bounty_ledger()["unclaimed"]==0
    app.process_scout_event({"type":"bounty.awarded","totalReward":500000})
    assert app.bounty_ledger()["unclaimed"]==500000
    combat="\n".join(app.combat_lines())
    assert "HONEY BADGER" in combat and "31.46 LY" in combat and "SYS 2.0" in combat
    assert "HARDPOINTS" in combat and "CRITICAL SYSTEMS" in combat and "SECONDARY" in combat
    assert hud.MongrelHudApp.module_category("Power Plant")=="critical"
    assert hud.MongrelHudApp.module_category("Beam Laser")=="hardpoints"
    app.set_profile("surface")
    assert store.data["profile"]=="surface"

html=(ROOT/"downloads"/"mongrel-hud"/"controller.html").read_text(encoding="utf-8")
for token in ["COMBAT","SURFACE MINING","SET SITE CENTER","REPORT DEPOSIT","/api/site-center","/api/deposit"]:
    assert token in html
source=(ROOT/"downloads"/"mongrel-hud"/"mongrel_hud.py").read_text(encoding="utf-8")
assert "Access-Control-Allow-Origin" not in source
assert 'CONTROLLER_HOST = "0.0.0.0"' in source
api=(ROOT/"functions"/"api"/"downloads"/"mongrel-hud.js").read_text(encoding="utf-8")
for token in ["mongrel-hud-latest","MongrelHUD-Windows.zip","Response.redirect"]:
    assert token in api
assert "resource_path" in source and "_MEIPASS" in source
print("✓ Mongrel HUD companion profiles, surface navigation, local report flow and paired LAN boundary are wired")
