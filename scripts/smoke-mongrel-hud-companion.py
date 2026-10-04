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

assert hud.APP_VERSION=="0.10.1"
assert hud.SCOUT_STATE_URL=="http://127.0.0.1:43857/v1/state"
assert hud.CONTROLLER_PORT==43858
assert hud.CONTROLLER_HOSTNAME=="mongrel-hud.local"
assert hud.CONTROLLER_STABLE_URL=="http://mongrel-hud.local:43858"
assert hud.PAIRING_COOKIE_MAX_AGE>=60*60*24*180
assert hud.version_tuple("0.10.1")==(0,10,1)
assert hud.version_tuple("v1.2.3")==(1,2,3)
release=hud.update_from_release_payload({
    "name":"Mongrel HUD Windows v0.10.1",
    "assets":[{"name":"MongrelHUD-Windows.zip","browser_download_url":"https://github.com/CMDRWolf258/mongrels-squadron/releases/download/mongrel-hud-latest/MongrelHUD-Windows.zip","digest":"sha256:"+"a"*64,"size":123456789}],
})
assert release["version"]=="0.10.1" and release["digest"]=="sha256:"+"a"*64
assert hud.version_tuple(release["version"])>hud.version_tuple(hud.APP_VERSION)
try:
    hud.update_from_release_payload({"name":"Mongrel HUD Windows v0.10.1","assets":[{"name":"MongrelHUD-Windows.zip","browser_download_url":"https://evil.invalid/MongrelHUD-Windows.zip","digest":"sha256:"+"a"*64}]})
    raise AssertionError("Untrusted update download URL was accepted")
except ValueError as exc:
    assert str(exc)=="release_download_url_rejected"
try:
    hud.update_from_release_payload({"name":"Mongrel HUD Windows v0.10.1","assets":[{"name":"MongrelHUD-Windows.zip","browser_download_url":"https://github.com/CMDRWolf258/mongrels-squadron/releases/download/mongrel-hud-latest/MongrelHUD-Windows.zip","digest":""}]})
    raise AssertionError("Release without SHA-256 digest was accepted")
except ValueError as exc:
    assert str(exc)=="release_digest_missing"

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
    # Keep the smoke deterministic/offline; production starts the 60-second mining sync thread.
    hud.MongrelHudApp._mining_sync_loop=lambda self: None
    hud.MongrelHudApp._voice_loop=lambda self: None
    store=hud.LocalStore(Path(td)/"state.json")
    app=hud.MongrelHudApp(store,"<html></html>")
    # Pairing tokens are high-entropy client secrets; only their hashes persist.
    trusted=app.register_controller_device()
    assert app.authorized_controller_token(trusted) is True
    with store.lock:
        saved_hashes=list(store.data["controllerAuth"]["tokenHashes"])
    assert trusted not in str(saved_hashes)
    old_pin=app.pin
    app.regenerate_pin()
    assert app.pin!=old_pin and app.authorized_controller_token(trusted) is True
    restarted_auth_store=hud.LocalStore(Path(td)/"state.json")
    restarted_auth_app=hud.MongrelHudApp(restarted_auth_store,"<html></html>")
    assert restarted_auth_app.authorized_controller_token(trusted) is True
    app.forget_paired_devices()
    assert app.authorized_controller_token(trusted) is False
    reloaded_after_revoke=hud.LocalStore(Path(td)/"state.json")
    revoked_app=hud.MongrelHudApp(reloaded_after_revoke,"<html></html>")
    assert revoked_app.authorized_controller_token(trusted) is False

    # Carrier PA settings are local, persistent and owner-carrier scoped.
    voice=app.voice_settings_snapshot()
    assert voice["enabled"] is True and voice["carrierPa"] is True and voice["volume"]==75
    assert voice["cues"]["docking.requested"]["enabled"] is False
    assert voice["cues"]["docking.granted"]["enabled"] is True
    voice=app.set_voice_settings({"volume":65,"cues":{"docking.granted":{"minDelay":5,"maxDelay":5,"cooldown":20},"docking.docked":{"minDelay":3,"maxDelay":3,"cooldown":20}}})
    assert voice["volume"]==65 and voice["cues"]["docking.granted"]["minDelay"]==5.0
    app.handle_voice_event({"type":"docking.granted","relationship":"unknown","marketId":"999","landingPad":12})
    assert app.voice_status_snapshot()["queued"]==0
    app.handle_voice_event({"type":"docking.granted","relationship":"owner","marketId":"123","landingPad":12})
    with app.voice_condition:
        assert len(app.voice_pending)==1
        assert app.voice_pending[0]["cue"]=="docking.granted"
        assert "pad 12" in app.voice_pending[0]["text"]
    # Docked supersedes a still-delayed clearance line so stale PA never plays.
    app.handle_voice_event({"type":"docking.docked","relationship":"owner","marketId":"123","stationName":"Pneuma"})
    with app.voice_condition:
        assert len(app.voice_pending)==1 and app.voice_pending[0]["cue"]=="docking.docked"
        assert "Welcome aboard Pneuma" in app.voice_pending[0]["text"]
    app.handle_voice_event({"type":"carrier.jump_request","relationship":"owner","carrierId":"123","destinationSystem":"Sol"})
    with app.voice_condition:
        assert any(row["cue"]=="carrier.jump_request" and "Sol" in row["text"] for row in app.voice_pending)
    app.handle_voice_event({"type":"carrier.jump_cancelled","relationship":"owner","carrierId":"123"})
    with app.voice_condition:
        assert not any(row["cue"]=="carrier.jump_request" for row in app.voice_pending)
        assert any(row["cue"]=="carrier.jump_cancelled" for row in app.voice_pending)
    persisted_voice_store=hud.LocalStore(Path(td)/"state.json")
    assert persisted_voice_store.data["voice"]["volume"]==65
    app.snapshot=hud.ScoutSnapshot({
        "system":{"name":"NGC 2546 Sector UZ-G d10-16","address":"560820275507"},
        "status":{"bodyName":"NGC 2546 Sector UZ-G d10-16 7 b","latitude":-22.7738,"longitude":-98.8161,"heading":42.0,"planetRadius":1234567.0,"shieldsUp":True,"fuelMain":27.5,"fuelReserve":0.8,"cargo":12,"pips":[2.0,1.0,3.0]},
        "ship":{"name":"Honey Badger","maxJumpRange":31.127644,"currentJumpRange":31.597581,"currentMass":1040.3,"hullHealth":87.3,"shieldsUp":True},
        "siteFeed":{"ok":True,"generatedAt":"2026-10-03T21:00:00Z","mission":{"orderCount":1,"attentionCount":1,"orders":[{"system":"Diaba","priority":"HIGH","task":"Win CZs","progress":{"current":10,"target":20,"percent":50,"unit":"CZ pts","met":False}}],"attention":[{"system":"Diaba","influence":51.2,"alerts":["Conflict active"]}]},"trade":{"activeCount":1,"routes":[{"title":"Platinum Loop","loopProfit":16500000,"state":"healthy","originSystem":"Diaba","originStation":"Niijima Station","destinationSystem":"Miwae","destinationStation":"Test Exchange","legs":[{"commodity":"Platinum","sourceSystem":"Diaba","sourceStation":"Niijima Station","destinationSystem":"Miwae","destinationStation":"Test Exchange"}]}]},"scout":{"summary":{"available":1,"claimed":0,"priority":1},"jobs":[{"system":"Miwae","status":"available","rewardMillions":10}]},"alerts":[{"id":"a1","type":"payout","severity":"high","title":"PAYOUT REQUEST · Test","detail":"100,000,000 Cr","acknowledged":False}],"unacknowledgedCount":1},"siteFeedStatus":{"ok":True,"updatedAt":"2026-10-03T21:00:00Z","error":""},
        "target":{"pilotName":"Test Target","ship":"Fer-de-Lance","shieldHealth":73.5,"hullHealth":88.0,"legalStatus":"Wanted","bounty":3842610,"subsystem":{"name":"Power Plant","health":62.0,"observedAt":"2026-10-03T06:00:00Z"},"modules":{"power plant":{"name":"Power Plant","health":62.0,"observedAt":"2026-10-03T06:00:00Z"},"beam laser":{"name":"Beam Laser","health":81.0,"observedAt":"2026-10-03T06:00:01Z"},"cargo hatch":{"name":"Cargo Hatch","health":99.0,"observedAt":"2026-10-03T06:00:02Z"}}},
    },True,"")
    with app.mining_lock:
        app.mining_sites=[
            {"id":42,"systemName":"NGC 2546 Sector UZ-G d10-16","commodity":"Periclase","body":"7b","bodyType":"moon","signal":10,"latitude":-22.7738,"longitude":-98.8161,"rigs":2,"preferred":True,"notes":"Primary test site"},
            {"id":43,"systemName":"NGC 2546 Sector UZ-G d10-16","commodity":"Periclase","body":"7b","bodyType":"moon","signal":8,"latitude":-22.9000,"longitude":-98.9000,"rigs":1,"preferred":False,"notes":""},
        ]
        app.mining_centers=[
            {"id":501,"systemName":"NGC 2546 Sector UZ-G d10-16","body":"7b","bodyType":"moon","signal":10,"latitude":-22.7738,"longitude":-98.8161,"updatedAt":"2026-10-04T05:00:00Z"},
            {"id":502,"systemName":"NGC 2546 Sector UZ-G d10-16","body":"7b","bodyType":"moon","signal":8,"latitude":-22.8800,"longitude":-98.8800,"updatedAt":"2026-10-04T05:00:00Z"},
        ]
        app.mining_status={"ok":True,"updatedAt":"2026-10-04T05:00:00Z","error":""}
    assert hud.short_body_name(app.scout_state())=="7b"
    assert len(app.sites_for_current_body())==2
    site=app.select_site("42")
    assert site["signal"]==10 and site["commodity"]=="Periclase"
    assert app.active_location_signal()==10
    nav_center=app.location_nav()
    nav_deposit=app.deposit_nav()
    assert nav_center and nav_center["targetType"]=="center" and nav_center["distance"]<0.01
    assert nav_deposit and nav_deposit["targetType"]=="deposit" and nav_deposit["distance"]<0.01
    state=app.controller_state()
    assert state["connected"] is True and state["activeSite"]["id"]==42
    assert state["activeCenter"]["signal"]==10 and state["activeLocationSignal"]==10
    assert state["miningStatus"]["ok"] is True
    # Saved centers must survive a HUD restart even if the remote center feed is temporarily unavailable.
    app.set_site_center = app.set_site_center
    assert "Periclase" in state["miningCommodities"]
    assert "Platinum" in state["miningCommodities"]
    assert state["miningCommoditiesCurrentBody"]==["Periclase"]
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
    assert "scoutnearby" in app.layout_snapshot()["panels"] and "orderalerts" in app.layout_snapshot()["panels"] and "miningintel" in app.layout_snapshot()["panels"] and "cargo" in app.layout_snapshot()["panels"]
    assert app.layout_snapshot()["panels"]["cargo"]["visible"] is False
    assert app.layout_snapshot()["panels"]["cargo"]["profiles"]==["combat","surface"]
    app.set_mission_system_filter("Diaba")
    assert app.mission_system_filter()=="Diaba"
    app.set_notes("Check tick after dinner")
    assert app.notes_text()=="Check tick after dinner"
    site_panels=app.site_panel_texts()
    assert "MISSION CONTROL" in site_panels["mission"]
    assert "Platinum Loop" in site_panels["trade"]
    assert hud.APP_VERSION=="0.10.1"
    assert "Miwae" in site_panels["scoutboard"]
    assert "PAYOUT REQUEST" in site_panels["alerts"]
    assert "10 / 20 CZ pts" in site_panels["mission"]
    app.save_panel_position("target",-120,333)
    assert app.layout_snapshot()["panels"]["target"]["x"]==-120
    app.reset_layout()
    assert app.layout_snapshot()["panels"]["target"]["x"]==40
    # Profile switching must never rewrite user panel assignments.
    before_profiles={panel:list(cfg["profiles"]) for panel,cfg in app.layout_snapshot()["panels"].items()}
    app.set_panel_settings("surface",profiles=["combat","surface"])
    app.set_panel_settings("own",profiles=["surface"])
    custom_profiles={panel:list(cfg["profiles"]) for panel,cfg in app.layout_snapshot()["panels"].items()}
    assert custom_profiles!=before_profiles
    assert app.set_profile("surface")=="surface"
    assert store.data["profile"]=="surface"
    assert {panel:list(cfg["profiles"]) for panel,cfg in app.layout_snapshot()["panels"].items()}==custom_profiles
    assert app.set_profile("combat")=="combat"
    assert {panel:list(cfg["profiles"]) for panel,cfg in app.layout_snapshot()["panels"].items()}==custom_profiles

    cached_center={"id":901,"systemName":"NGC 2546 Sector UZ-G d10-16","systemAddress":"560820275507","body":"7b","bodyType":"moon","signal":10,"latitude":-22.77,"longitude":-98.81,"updatedAt":"2026-10-04T08:00:00Z"}
    with app.mining_lock:
        app.mining_centers=[cached_center]
        cached=[dict(row) for row in app.mining_centers]
    with app.store.lock:
        app.store.data["miningCenters"]=cached
        app.store.save()
    restarted_store=hud.LocalStore(Path(td)/"state.json")
    restarted_app=hud.MongrelHudApp(restarted_store,"<html></html>")
    assert restarted_app.mining_centers and restarted_app.mining_centers[0]["signal"]==10

    class FakeRoot:
        def __init__(self): self.after_calls=0
        def after(self,ms,fn): self.after_calls+=1
    class FakeWindow:
        def __init__(self): self.withdrawn=0; self.shown=0; self.geometries=[]
        def withdraw(self): self.withdrawn+=1
        def deiconify(self): self.shown+=1
        def geometry(self,value): self.geometries.append(value)
    fake_root=FakeRoot()
    fake_window=FakeWindow()
    app.root=fake_root
    app.panel_windows={"mission":{"window":fake_window,"body":object(),"appliedLocked":None,"appliedRevision":-1}}
    app._render_panel_canvas=lambda *args,**kwargs: (_ for _ in ()).throw(RuntimeError("synthetic renderer failure"))
    applied=[]
    app._apply_panel_edit_mode=lambda panel_id,locked: applied.append((panel_id,locked))
    app.refresh_ui()
    assert fake_root.after_calls==1
    assert fake_window.shown==1
    assert app.panel_windows["mission"]["renderError"]=="synthetic renderer failure"
    assert applied==[("mission",app.layout_snapshot()["locked"])]
    app.set_master_overlay(False)
    app.refresh_ui()
    assert fake_root.after_calls==2 and fake_window.withdrawn>=1

html=(ROOT/"downloads"/"mongrel-hud"/"controller.html").read_text(encoding="utf-8")
for token in ["COMBAT","SURFACE MINING","PNEUMA · CARRIER PA","TEST VOICE","data-voice-cue=\"docking.granted\"","data-voice-cue=\"carrier.jump\"","/api/voice","/api/voice-test","TARGET LOADOUT SCANNER","SHIP CARGO","MISSION NEEDS","STOLEN CARGO","data-panel-visible=\"cargo\"","SCAN LOADOUT","recentTargetIntel","/api/target-scan","Current jump","Unladen (Frontier)","ownCurrentJump","ownMass","Mission Control","Trader's Outpost","Scout Board","Nearest Scout Jobs","Mining Intel","Faction Alerts","Daily Order Changes","HUD NOTES","UNLOCK LAYOUT","RESET LAYOUT","data-panel-scale","data-panel-profile","value=\"0.8\"","80%","value=\"0.85\"","85%","/api/layout","/api/panel","/api/layout-reset","/api/notes","/api/alert-ack","MINING LOCATIONS ON THIS BODY","SET / UPDATE CENTER","DEPOSITS IN SELECTED LOCATION","REPORT DEPOSIT","depositCommodity","depositCommodityOther","Other / not listed","depositSignal","centerSignal","/api/location-select","/api/site-center","/api/site-select","/api/deposit"]:
    assert token in html
source=(ROOT/"downloads"/"mongrel-hud"/"mongrel_hud.py").read_text(encoding="utf-8")
assert "Access-Control-Allow-Origin" not in source
assert 'CONTROLLER_HOST = "0.0.0.0"' in source
workflow=(ROOT/".github"/"workflows"/"build-mongrel-hud-windows.yml").read_text(encoding="utf-8")
assert "zeroconf" in workflow and "--collect-all zeroconf" in workflow
assert workflow.index("gh release upload") < workflow.index("gh release edit"), "Release version must be advertised only after the new asset upload completes"
api=(ROOT/"functions"/"api"/"downloads"/"mongrel-hud.js").read_text(encoding="utf-8")
for token in ["mongrel-hud-latest","MongrelHUD-Windows.zip","Response.redirect"]:
    assert token in api
assert "resource_path" in source and "_MEIPASS" in source
assert "Mongrel HUD Windows v" not in source  # release title is build metadata, not hard-coded runtime state
assert "CONTROLLER_HOSTNAME = \"mongrel-hud.local\"" in source
assert "_start_mdns_service" in source and "ServiceInfo" in source
assert "register_controller_device" in source and "authorized_controller_token" in source and "Forget Paired Devices" in source
assert "PAIRING_COOKIE_MAX_AGE" in source and "Max-Age={PAIRING_COOKIE_MAX_AGE}" in source
assert "Check for Update" in source and "_powershell_release_json" in source and "_file_sha256" in source
assert "update_digest_mismatch" in source and "MongrelHUD.new.exe" in source
assert "PYINSTALLER_RESET_ENVIRONMENT" in source and "_MEI temp directory" in source
assert "CARRIER_VOICE_CUES" in source and "handle_voice_event" in source and "_voice_loop" in source
assert "System.Speech.Synthesis.SpeechSynthesizer" in source and "windows_speech_failed" in source
assert '"carrier.jump_request"' in source and '"carrier.jump_cancelled"' in source

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
assert "SCOUT_MINING_REPORT_URL" in source and "SCOUT_MINING_CENTER_URL" in source and "MINING_DATA_URL" in source and "MINING_CENTERS_URL" in source
assert 'MINING_DATA_URL = "http://127.0.0.1:43857/v1/mining/data"' in source
assert 'MINING_CENTERS_URL = "http://127.0.0.1:43857/v1/mining/centers"' in source
assert "_load_mining_bridge_payload" in source
assert "activeMiningSiteId" in source and "activeMiningLocationSignal" in source
assert "_render_surface_canvas" in source and "_draw_nav_compass" in source and "relative = nav.get(\"relative\")" in source
assert "task_box = canvas.bbox(task_id)" in source
assert '"depositsOk": deposit_ok' in source and '"centersOk": center_ok' in source
assert 'str(row.get("systemName") or TEN16_SYSTEM)' in source
assert "SURFACE_MINING_COMMODITIES" in source and '"Platinum"' in source and '"Monazite"' in source
assert "_render_miningintel_canvas" in source and '"miningintel": "MINING INTEL"' in source
assert "_render_cargo_canvas" in source and '"cargo": "CARGO"' in source
assert "width = round(410 * scale)" in source
assert "mining_center_save_failed" in source and "signal_required" in source and '"/api/location-select"' in source
assert "LOCATION CENTER · SIGNAL #" in source and "SELECTED DEPOSIT" in source
assert 'class="mining-select"' in html and "min-height:58px" in html
assert "Known on this body" in html and "All surface mining commodities" in html
assert '<select id="rigs" class="mining-select">' in html and "7+ rigs" in html
assert 'el("rigs").value="1"' in html
assert 'SAVED ✓' in html and 'POSSIBLE DUPLICATE — QUEUED FOR REVIEW ✓' in html
assert 'el("depositCommodity").value=""' in html and 'el("notes").value=""' in html
assert 'type="button" id="overlayMaster"' in html and 'type="button" id="layoutLock"' in html
assert 'function holdRefresh' in html and 'interactionUntil' in html and 'applyLayoutResult' in html
assert 'Display control failed' in html and 'Layout lock failed' in html and 'Panel toggle failed' in html
assert "RapidOCR" in source and "TARGET_SCAN_DURATION" in source and "recent_targets" in source and "stitch_module_frames" in source
print("✓ Mongrel HUD companion profiles, surface navigation, local report flow and paired LAN boundary are wired")

assert 'mutationEpoch' in html and 'mutationPending' in html and 'async function mutate' in html
assert 'Profile switch failed' in html and 'profile active' in html
assert 'result = {"ok": True, "profile": profile, "layout": app.layout_snapshot()}' in source

assert '"miningCenters": []' in source
assert 'nav.get("target") if isinstance(nav.get("target"), dict) else nav.get("site")' in source
assert 'info["renderError"] = str(exc)[:160]' in source
assert 'finally:' in source and 'self.root.after(200, self.refresh_ui)' in source
