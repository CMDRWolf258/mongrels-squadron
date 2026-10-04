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

assert hud.APP_VERSION=="0.6.6"
assert hud.SCOUT_STATE_URL=="http://127.0.0.1:43857/v1/state"
assert hud.CONTROLLER_PORT==43858
assert hud.HUD_RENDER_SCALE>=1.15
assert hud.HUD_MUTED=="#a9c8d3"
nav=hud.great_circle_nav(0,0,0,1,6371000,0)
assert 111000<nav["distance"]<111400
assert 89<nav["bearing"]<91
assert hud.format_distance(5910)=="5.91 km"
assert "RIGHT" in hud.relative_text(20)

assert hud.match_module_name("FR4ME SHIFT DRlVE")=="Frame Shift Drive"
assert hud.match_module_name("HEATSINK LAUNCHER")=="Heatsink Launcher"
stitched=hud.stitch_module_frames([
    ["Cargo Hatch","Drive","Mine Launcher","Mine Launcher","Mine Launcher","Heatsink Launcher","Chaff Launcher"],
    ["Mine Launcher","Heatsink Launcher","Chaff Launcher","Power Plant","Frame Shift Drive","Shield Cell Bank"],
])
assert stitched.count("Mine Launcher")==3
upward=hud.stitch_module_frames([
    ["Power Plant","Frame Shift Drive","Shield Cell Bank"],
    ["Drive","Mine Launcher","Power Plant","Frame Shift Drive"],
    ["Cargo Hatch","Drive","Mine Launcher"],
])
assert upward==["Cargo Hatch","Drive","Mine Launcher","Power Plant","Frame Shift Drive","Shield Cell Bank"]
groups=hud.tactical_module_groups(stitched)
assert groups["offense"][0]=={"name":"Mine Launcher","count":3}
assert groups["defense"][-1]=={"name":"Shield Cell Bank","count":1}

with tempfile.TemporaryDirectory() as td:
    store=hud.LocalStore(Path(td)/"state.json")
    app=hud.MongrelHudApp(store,"<html></html>")
    app.snapshot=hud.ScoutSnapshot({
        "system":{"name":"NGC 2546 Sector UZ-G d10-16","address":"668059324240760"},
        "status":{"bodyName":"NGC 2546 Sector UZ-G d10-16 7 b","latitude":-22.7738,"longitude":-98.8161,"heading":42.0,"planetRadius":1234567.0,"shieldsUp":True,"fuelMain":27.5,"fuelReserve":0.8,"cargo":12,"pips":[2.0,1.0,3.0]},
        "ship":{"name":"Honey Badger","maxJumpRange":31.127644,"currentJumpRange":31.597581,"currentMass":1040.3,"hullHealth":87.3,"shieldsUp":True},
        "siteFeed":{"ok":True,"generatedAt":"2026-10-03T21:00:00Z","mission":{"orderCount":1,"attentionCount":1,"orders":[{"system":"Diaba","priority":"HIGH","task":"Win CZs","progress":{"current":10,"target":20,"percent":50,"unit":"CZ pts","met":False}}],"attention":[{"system":"Diaba","influence":51.2,"alerts":["Conflict active"]}]},"trade":{"activeCount":1,"routes":[{"title":"Platinum Loop","loopProfit":16500000,"state":"healthy","originSystem":"Diaba","originStation":"Niijima Station","destinationSystem":"Miwae","destinationStation":"Test Exchange","legs":[{"commodity":"Platinum","sourceSystem":"Diaba","sourceStation":"Niijima Station","destinationSystem":"Miwae","destinationStation":"Test Exchange"}]}]},"scout":{"summary":{"available":1,"claimed":0,"priority":1},"jobs":[{"system":"Miwae","status":"available","rewardMillions":10}]},"alerts":[{"id":"a1","type":"payout","severity":"high","title":"PAYOUT REQUEST · Test","detail":"100,000,000 Cr","acknowledged":False}],"unacknowledgedCount":1},"siteFeedStatus":{"ok":True,"updatedAt":"2026-10-03T21:00:00Z","error":""},
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
    assert "HONEY BADGER" in combat and "CURRENT 31.60 LY" in combat and "UNLADEN 31.13 LY" in combat and "MASS 1040.3 t" in combat and "SYS 2.0" in combat
    assert "TARGET LOADOUT" in combat
    assert "CRITICAL SYSTEMS" not in combat
    assert hud.MongrelHudApp.module_category("Power Plant")=="core"
    assert hud.MongrelHudApp.module_category("Beam Laser")=="offense"
    assert hud.MongrelHudApp.module_category("Shield Cell Bank")=="defense"
    layout=app.layout_snapshot()
    assert layout["locked"] is True and set(layout["panels"])==set(hud.PANEL_IDS)
    app.set_layout_locked(False)
    assert app.layout_snapshot()["locked"] is False
    app.set_panel_settings("subsystems",visible=False,scale=1.25,profiles=["combat","surface"])
    assert app.layout_snapshot()["panels"]["subsystems"]["visible"] is False
    assert app.layout_snapshot()["panels"]["subsystems"]["scale"]==1.25
    assert app.layout_snapshot()["panels"]["subsystems"]["profiles"]==["combat","surface"]
    assert "scoutnearby" in app.layout_snapshot()["panels"] and "orderalerts" in app.layout_snapshot()["panels"]
    app.set_mission_system_filter("Diaba")
    assert app.mission_system_filter()=="Diaba"
    app.set_notes("Check tick after dinner")
    assert app.notes_text()=="Check tick after dinner"
    site_panels=app.site_panel_texts()
    assert "MISSION CONTROL" in site_panels["mission"]
    assert "Platinum Loop" in site_panels["trade"]
    assert hud.APP_VERSION=="0.6.6"
    assert "Miwae" in site_panels["scoutboard"]
    assert "PAYOUT REQUEST" in site_panels["alerts"]
    assert "10 / 20 CZ pts" in site_panels["mission"]
    app.save_panel_position("target",-120,333)
    assert app.layout_snapshot()["panels"]["target"]["x"]==-120
    app.reset_layout()
    assert app.layout_snapshot()["panels"]["target"]["x"]==40
    app.set_profile("surface")
    assert store.data["profile"]=="surface"

html=(ROOT/"downloads"/"mongrel-hud"/"controller.html").read_text(encoding="utf-8")
for token in ["COMBAT","SURFACE MINING","TARGET LOADOUT SCANNER","SCAN LOADOUT","recentTargetIntel","/api/target-scan","Current jump","Unladen (Frontier)","ownCurrentJump","ownMass","Mission Control","Trader's Outpost","Scout Board","Nearest Scout Jobs","Faction Alerts","Daily Order Changes","HUD NOTES","UNLOCK LAYOUT","RESET LAYOUT","data-panel-scale","data-panel-profile","value=\"0.8\"","80%","value=\"0.85\"","85%","/api/layout","/api/panel","/api/layout-reset","/api/notes","/api/alert-ack","SET SITE CENTER","REPORT DEPOSIT","/api/site-center","/api/deposit"]:
    assert token in html
source=(ROOT/"downloads"/"mongrel-hud"/"mongrel_hud.py").read_text(encoding="utf-8")
assert "Access-Control-Allow-Origin" not in source
assert 'CONTROLLER_HOST = "0.0.0.0"' in source
api=(ROOT/"functions"/"api"/"downloads"/"mongrel-hud.js").read_text(encoding="utf-8")
for token in ["mongrel-hud-latest","MongrelHUD-Windows.zip","Response.redirect"]:
    assert token in api
assert "resource_path" in source and "_MEIPASS" in source
assert "panel_windows" in source and "_create_panel_window" in source and "_set_clickthrough" in source
assert "tk.Canvas" in source and "_render_mission_canvas" in source and "_render_trade_canvas" in source and "_render_alerts_canvas" in source and "_render_loadout_canvas" in source
assert '("CURRENT JUMP", current_text)' in source
assert "HUD_SHADOW" in source and "shadow_kwargs" in source
assert "_render_scoutboard_canvas" in source and "_render_scoutnearby_canvas" in source
assert 'status_x = 398 * scale' in source and 'width = round(490 * scale)' in source
assert '"TOP 5 · ALL SYSTEMS"' in source and 'groups: list[tuple[str, list[dict[str, Any]]]]' in source
assert 'self._draw_text(canvas, arrow_x, y, "→"' in source
assert "_render_orderalerts_canvas" in source and 'kind="faction"' in source and 'kind="orders"' in source
assert 'lamp_color = color if (unacked and flash_on) else HUD_DIM' in source
assert 'profit_text = f"{self.compact_credits(profit)} CR"' in source
assert 'leg_profit = leg.get("tripProfit") or 0' in source
assert "visible_alerts = alerts[:10]" in source
assert "SCOUT_ALERT_ACK_URL" in source and "site_panel_texts" in source and "set_notes" in source and "/api/mission-filter" in source
assert "RapidOCR" in source and "TARGET_SCAN_DURATION" in source and "recent_targets" in source and "stitch_module_frames" in source
print("✓ Mongrel HUD companion profiles, surface navigation, local report flow and paired LAN boundary are wired")
