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

assert hud.APP_VERSION=="0.17.6"
assert hud.SCOUT_STATE_URL=="http://127.0.0.1:43857/v1/state"
assert hud.CONTROLLER_PORT==43858
assert hud.CONTROLLER_HOSTNAME=="mongrel-hud.local"
assert hud.CONTROLLER_STABLE_URL=="http://mongrel-hud.local:43858"
assert hud.PAIRING_COOKIE_MAX_AGE>=60*60*24*180
assert hud.version_tuple("0.16.0")==(0,16,0)
assert hud.version_tuple("v1.2.3")==(1,2,3)
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.15.0"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.0"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.5"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.6"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.7"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.8"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.9"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.16.10"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.17.0"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.17.6"}) is False
assert hud.MongrelHudApp._update_snapshot_is_newer({"version":"0.17.7"}) is True
release=hud.update_from_release_payload({
    "name":"Mongrel HUD Windows v0.17.7",
    "assets":[{"name":"MongrelHUD-Windows.zip","browser_download_url":"https://github.com/CMDRWolf258/mongrels-squadron/releases/download/mongrel-hud-latest/MongrelHUD-Windows.zip","digest":"sha256:"+"a"*64,"size":123456789}],
})
assert release["version"]=="0.17.7" and release["digest"]=="sha256:"+"a"*64
assert hud.version_tuple(release["version"])>hud.version_tuple(hud.APP_VERSION)
try:
    hud.update_from_release_payload({"name":"Mongrel HUD Windows v0.16.1","assets":[{"name":"MongrelHUD-Windows.zip","browser_download_url":"https://evil.invalid/MongrelHUD-Windows.zip","digest":"sha256:"+"a"*64}]})
    raise AssertionError("Untrusted update download URL was accepted")
except ValueError as exc:
    assert str(exc)=="release_download_url_rejected"
try:
    hud.update_from_release_payload({"name":"Mongrel HUD Windows v0.16.1","assets":[{"name":"MongrelHUD-Windows.zip","browser_download_url":"https://github.com/CMDRWolf258/mongrels-squadron/releases/download/mongrel-hud-latest/MongrelHUD-Windows.zip","digest":""}]})
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

# Non-overlapping pauses and repeated passes must not discard tactical modules
# or inflate counts when the same section is shown again.
evidence_frames=[
    ["Cargo Hatch","Beam Laser","Beam Laser","Chaff Launcher"],
    ["Power Plant","Frame Shift Drive","Shield Cell Bank","FSD Interdictor"],
    ["Cargo Hatch","Beam Laser","Beam Laser","Chaff Launcher"],
]
evidence_stitched=hud.stitch_module_frames(evidence_frames)
assert "Shield Cell Bank" not in evidence_stitched
evidence_groups=hud.tactical_module_groups(evidence_stitched,evidence_frames)
assert {"name":"Beam Laser","count":2} in evidence_groups["offense"]
assert {"name":"Chaff Launcher","count":1} in evidence_groups["defense"]
assert {"name":"Shield Cell Bank","count":1} in evidence_groups["defense"]
assert {"name":"FSD Interdictor","count":1} in evidence_groups["special"]

with tempfile.TemporaryDirectory() as td:
    # Keep the smoke deterministic/offline; production starts the 60-second mining sync thread.
    hud.MongrelHudApp._mining_sync_loop=lambda self: None
    hud.MongrelHudApp._voice_loop=lambda self: None
    hud.MongrelHudApp._ambient_voice_loop=lambda self: None
    hud.MongrelHudApp._voice_catalog_worker=lambda self: None
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
    assert hud.VOICE_PROVIDER_KOKORO=="kokoro"
    assert hud.VOICE_PROVIDER_KOKORO in hud.VOICE_PROVIDER_IDS
    assert len(hud.KOKORO_ENGLISH_VOICES)==28 and hud.KOKORO_VOICE_SIDS["af_heart"]==3
    assert voice["voiceProvider"]=="system" and voice["voiceId"]=="" and voice["voiceName"]==""
    assert len(voice["concourseVoices"])==4 and voice["concourseVoices"][0]["enabled"] is True
    assert all(slot["enabled"] is False for slot in voice["concourseVoices"][1:])
    migrated=hud.normalized_voice_settings({"voiceName":"Microsoft David Desktop"})
    assert migrated["voiceProvider"]=="system" and migrated["voiceId"]=="Microsoft David Desktop"
    assert voice["cues"]["docking.requested"]["enabled"] is False
    assert voice["cues"]["docking.granted"]["enabled"] is True
    assert voice["cues"]["carrier.countdown_10"]["leadSeconds"]==600.0
    assert voice["cues"]["carrier.countdown_5"]["leadSeconds"]==300.0
    assert voice["cues"]["carrier.cooldown_ready"]["offsetSeconds"]==180.0
    # Carrier dialogue uses a member-selected spoken name while preserving the
    # actual Elite CMDR identity, and Canine Catalyst can match its squad-only ID/name.
    app.snapshot=hud.ScoutSnapshot({
        "commander":"Wolf258",
        "siteFeed":{
            "viewer":{"commander":"Wolf258","spokenName":"Wolf"},
            "carriers":[{
                "id":"squad-carrier-r1mm","marketId":"","callsign":"R1MM","name":"Canine Catalyst",
                "ownershipType":"squad","official":True,"relationship":"owner","personality":"mongrels",
            }],
        },
    },True,"")
    canine=app._carrier_profile_for_ref({"stationName":"Canine Catalyst","stationType":"SquadronCarrier"})
    assert canine is not None and canine["id"]=="squad-carrier-r1mm" and canine["registered"] is True
    canine_by_tag=app._carrier_profile_for_ref({"stationName":"Canine Catalyst R1MM","stationType":"SquadronCarrier"})
    assert canine_by_tag is not None and canine_by_tag["id"]=="squad-carrier-r1mm"
    spoken=app._render_voice_tokens("Welcome back, Commander {commander}.",{"relationship":"owner"},canine)
    assert "Commander Wolf" in spoken and "Wolf258" not in spoken
    app.snapshot=hud.ScoutSnapshot({"commander":"Wolf258"},True,"")
    fallback=app._render_voice_tokens("Welcome back, Commander {commander}.",{"relationship":"owner"})
    assert "Wolf258" in fallback
    voice=app.set_voice_settings({"volume":65,"voiceProvider":"winrt","voiceId":"HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_enUS_AvaM","voiceName":"Microsoft Ava","cues":{
        "docking.granted":{"minDelay":5,"maxDelay":5,"cooldown":20,"phrase":"Clearance confirmed for {carrier}. Proceed to {pad}."},
        "docking.docked":{"minDelay":3,"maxDelay":3,"cooldown":20},
        "carrier.cooldown_ready":{"offsetSeconds":165,"phrase":"{carrier} is ready for the next jump."},
    }})
    assert voice["volume"]==65 and voice["voiceProvider"]=="winrt" and voice["voiceName"]=="Microsoft Ava"
    assert voice["voiceId"].endswith("MSTTS_V110_enUS_AvaM")
    assert voice["cues"]["docking.granted"]["minDelay"]==5.0
    assert voice["cues"]["carrier.cooldown_ready"]["offsetSeconds"]==165.0
    assert "pad 12" in app._voice_text_for_event("docking.granted",{"relationship":"owner","carrierName":"Pneuma","landingPad":12})
    app.handle_voice_event({"type":"docking.granted","relationship":"unknown","marketId":"999","landingPad":12})
    assert app.voice_status_snapshot()["queued"]==0
    app.handle_voice_event({"type":"docking.granted","relationship":"owner","marketId":"123","stationName":"Pneuma","landingPad":12})
    with app.voice_condition:
        assert len(app.voice_pending)==1
        assert app.voice_pending[0]["cue"]=="docking.granted"
        assert "pad 12" in app._voice_text_for_event("docking.granted",app.voice_pending[0]["event"])
    # Docked supersedes a still-delayed clearance line so stale PA never plays.
    app.handle_voice_event({"type":"docking.docked","relationship":"owner","marketId":"123","stationName":"Pneuma"})
    with app.voice_condition:
        assert len(app.voice_pending)==1 and app.voice_pending[0]["cue"]=="docking.docked"
        docked_text=app._voice_text_for_event("docking.docked",app.voice_pending[0]["event"])
        assert docked_text and ("Welcome" in docked_text or "home" in docked_text.lower())

    departure=hud.datetime.fromtimestamp(hud.datetime.now(hud.timezone.utc).timestamp()+700,tz=hud.timezone.utc).isoformat().replace("+00:00","Z")
    app.handle_voice_event({"type":"carrier.jump_request","relationship":"owner","carrierId":"123","carrierName":"Pneuma","destinationSystem":"Sol","departureTime":departure})
    with app.voice_condition:
        pending={row["cue"] for row in app.voice_pending}
        assert {"carrier.jump_request","carrier.countdown_10","carrier.countdown_5"}.issubset(pending)
    with store.lock:
        scheduled={row["cue"] for row in store.data.get("voiceSchedule",[])}
    assert scheduled=={"carrier.countdown_10","carrier.countdown_5"}
    assert "10 minutes" in app._voice_text_for_event("carrier.countdown_10",{"carrierName":"Pneuma","destinationSystem":"Sol","minutes":10})
    app.handle_voice_event({"type":"carrier.jump_cancelled","relationship":"owner","carrierId":"123","carrierName":"Pneuma"})
    with app.voice_condition:
        assert not any(row["cue"] in {"carrier.jump_request","carrier.countdown_10","carrier.countdown_5"} for row in app.voice_pending)
        assert any(row["cue"]=="carrier.jump_cancelled" for row in app.voice_pending)
    with store.lock:
        assert not store.data.get("voiceSchedule")

    app.handle_voice_event({"type":"carrier.jump","relationship":"owner","carrierId":"123","carrierName":"Pneuma","system":"Sol"})
    with app.voice_condition:
        assert any(row["cue"]=="carrier.jump" for row in app.voice_pending)
        assert any(row["cue"]=="carrier.cooldown_ready" for row in app.voice_pending)
    with store.lock:
        cooldown_rows=[row for row in store.data.get("voiceSchedule",[]) if row.get("cue")=="carrier.cooldown_ready"]
    assert len(cooldown_rows)==1
    cooldown_at=app._parse_voice_time(cooldown_rows[0]["fireAt"])
    remaining=(cooldown_at-hud.datetime.now(hud.timezone.utc)).total_seconds()
    assert 160 < remaining <= 165.5
    assert app._voice_text_for_event("carrier.cooldown_ready",{"relationship":"owner","marketId":"123","stationName":"Pneuma","stationType":"Fleet Carrier","carrierName":"Pneuma"})=="Pneuma is ready for the next jump."
    # Optional Kokoro pack is discovered from the local MongrelHUD voices folder.
    pack_root=app._kokoro_install_root()
    (pack_root/"runtime"/"bundle"/"bin").mkdir(parents=True)
    (pack_root/"runtime"/"bundle"/"bin"/"sherpa-onnx-offline-tts.exe").write_bytes(b"MZ")
    model_root=pack_root/"model"/"kokoro-multi-lang-v1_0"
    (model_root/"espeak-ng-data").mkdir(parents=True)
    for filename in ("model.onnx","voices.bin","tokens.txt","lexicon-us-en.txt"):
        (model_root/filename).write_bytes(b"x")
    assert app._kokoro_paths() is not None
    app._refresh_voice_pack_status()
    assert app.voice_pack_status_snapshot()["installed"] is True
    neural=app._kokoro_voice_catalog()
    assert len(neural)==28
    assert any(row["id"]=="af_heart" and row["provider"]=="kokoro" for row in neural)
    app.set_voice_settings({"voiceProvider":"kokoro","voiceId":"af_heart","voiceName":"Heart"})
    removed=app.remove_voice_pack()
    assert removed["installed"] is False
    reset_voice=app.voice_settings_snapshot()
    assert reset_voice["voiceProvider"]=="system" and reset_voice["voiceId"]==""
    persisted_voice_store=hud.LocalStore(Path(td)/"state.json")
    assert persisted_voice_store.data["voice"]["volume"]==65
    assert persisted_voice_store.data["voice"]["voiceProvider"]=="system"
    assert persisted_voice_store.data["voice"]["voiceName"]==""
    assert any(row.get("cue")=="carrier.cooldown_ready" for row in persisted_voice_store.data["voiceSchedule"])
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
    assert hud.APP_VERSION=="0.17.6"
    assert "Miwae" in site_panels["scoutboard"]
    assert "PAYOUT REQUEST" in site_panels["alerts"]
    assert "10 / 20 CZ pts" in site_panels["mission"]
    app.save_panel_position("target",-120,333)
    assert app.layout_snapshot()["panels"]["target"]["x"]==-120
    app.reset_layout()
    assert app.layout_snapshot()["panels"]["target"]["x"]==40
    # Existing layouts preserve old Combat/Surface memberships. Navigation
    # instruments appear independently with safe visible defaults.
    navigation_panels=("navcourse","navsteps","navsignal","navfuel","navscout")
    assert set(navigation_panels).issubset(hud.PANEL_IDS)
    assert all(app.layout_snapshot()["panels"][name]["profiles"]==["navigation"] for name in navigation_panels)
    assert app.layout_snapshot()["panels"]["own"]["profiles"]==["combat"]
    assert app.layout_snapshot()["panels"]["cargo"]["profiles"]==["combat","surface"]
    assert "navigation" in hud.VALID_PROFILES
    nav_start={"active":True,"routeId":"test-route","waypointIndex":0}
    plan=[
        {"system":"Starting Point","neutron":False},
        {"system":"Neutron Arrival","neutron":True},
        {"system":"Final Destination","neutron":False},
    ]
    # Merely refreshing or making an intermediate ordinary jump must not
    # create a flashy waypoint arrival.
    app._observe_navigation_arrival(nav_start,{
        "navigation":dict(nav_start),
        "siteFeed":{"navigationRoute":{"waypoints":plan}},
    })
    assert app._arrival_for_controller() is None
    # Only a confirmed one-index advance produces a signal.
    app._observe_navigation_arrival(nav_start,{
        "navigation":{"active":True,"routeId":"test-route","waypointIndex":1},
        "siteFeed":{"navigationRoute":{"waypoints":plan}},
    })
    assert app._arrival_for_controller()["kind"]=="neutron"
    assert app._arrival_for_controller()["system"]=="Neutron Arrival"
    assert app.set_profile("navigation")=="navigation"
    assert app.controller_state()["profile"]=="navigation"
    # Unrelated overlay assignments remain unchanged on profile switches.
    assert app.layout_snapshot()["panels"]["cargo"]["profiles"]==["combat","surface"]
    app.set_profile("combat")
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
for token in ["COMBAT","SURFACE MINING","HUD CONTROL","CARRIER PA","FLEET CARRIER · COMMS","TEST ANNOUNCEMENT","voiceSelect","Windows Modern (WinRT)","LOCAL NEURAL · KOKORO","INSTALL VOICE PACK","REPAIR","REMOVE","voicePackProgress","/api/voice-pack-install","/api/voice-pack-repair","/api/voice-pack-remove","voiceProvider","providerLabel","data-voice-phrase","data-voice-cue=\"carrier.countdown_10\"","data-voice-cue=\"carrier.countdown_5\"","data-voice-cue=\"carrier.cooldown_ready\"","data-voice-offset","/api/voice","/api/voice-test","/api/voice-test-cue","/api/voice-test-concourse","voiceSelectConcourse1","voiceSelectConcourse4","CONCOURSE VOICE ENSEMBLE","TARGET LOADOUT SCANNER","SHIP CARGO","MISSION NEEDS","STOLEN CARGO","Next Run","cargoPriority","/api/cargo-priority","data-panel-visible=\"cargo\"","SCAN LOADOUT","recentTargetIntel","/api/target-scan","Current jump","Unladen (Frontier)","ownCurrentJump","ownMass","Mission Control","Trader's Outpost","Scout Board","Nearest Scout Jobs","Mining Intel","Faction Alerts","Daily Order Changes","HUD NOTES","UNLOCK LAYOUT","RESET LAYOUT","data-panel-scale","data-panel-profile","value=\"0.8\"","80%","value=\"0.85\"","85%","/api/layout","/api/panel","/api/layout-reset","/api/notes","/api/alert-ack","MINING LOCATIONS ON THIS BODY","SET / UPDATE CENTER","DEPOSITS IN SELECTED LOCATION","REPORT DEPOSIT","depositCommodity","depositCommodityOther","Other / not listed","depositSignal","centerSignal","/api/location-select","/api/site-center","/api/site-select","/api/deposit"]:
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
assert "PYINSTALLER_RESET_ENVIRONMENT" in source
assert "Copy-WithRetry" in source and "copy_retry_exhausted" in source
assert "Get-FileHash -LiteralPath $Target" in source and "target_hash_mismatch" in source
assert "apply-update.log" in source and "replacement verified" in source and "rollback restored previous executable" in source
assert "_update_snapshot_is_newer" in source
assert "CARRIER_VOICE_CUES" in source and "handle_voice_event" in source and "_voice_loop" in source
assert "_system_speech_voice_catalog" in source and "_winrt_voice_catalog" in source
assert "VOICE_PROVIDER_SYSTEM" in source and "VOICE_PROVIDER_WINRT" in source and "_speak_voice_provider" in source
assert "VOICE_PROVIDER_KOKORO" in source and "KOKORO_PACK_ID" in source and "_kokoro_voice_catalog" in source
assert "_download_voice_asset" in source and "_safe_extract_tar" in source and "voice_pack_model_hash_mismatch" in source
assert "KOKORO_ENGINE_SHA256" in source and "KOKORO_MODEL_SHA256" in source and "KOKORO_PACK_DOWNLOAD_BYTES" in source
assert "_speak_kokoro" in source and "sherpa-onnx-offline-tts.exe" in source and "--kokoro-model=" in source and "--sid=" in source
assert "_process_pcm16_wav" in source and "winsound.PlaySound" in source
assert "_ensure_voice_worker" in source and "workerAlive" in source and "lastRequestId" in source
assert hasattr(hud.MongrelHudApp,"_voice_role_for_cue")
assert hud.MongrelHudApp._voice_role_for_cue("docking.granted")=="atc"
assert hud.MongrelHudApp._voice_role_for_cue("carrier.countdown_10")=="announcement"
assert hasattr(hud.MongrelHudApp,"_voice_identity_for_role")
identity=hud.MongrelHudApp._voice_identity_for_role({"roles":{"announcement":{"voiceProvider":"kokoro","voiceId":"af_heart","voiceName":"Heart"}}},"announcement")
assert identity["voiceProvider"]=="kokoro" and identity["voiceId"]=="af_heart"
assert "SelectVoice" in source and '"voiceProvider"' in source and '"voiceId"' in source and '"voiceName"' in source
assert "SpeechSynthesizer]::AllVoices" in source and "SynthesizeTextToStreamAsync" in source
assert "AudioVolume" in source and "SpeakingRate" in source and "WindowsRuntimeStreamExtensions" in source
assert "_schedule_departure_countdowns" in source and "_schedule_cooldown_ready" in source and '"voiceSchedule"' in source
assert '"carrier.countdown_10"' in source and '"carrier.countdown_5"' in source and '"carrier.cooldown_ready"' in source
assert '"{carrier}"' in source and '"{destination}"' in source and '"{pad}"' in source and '"{minutes}"' in source
assert "System.Speech.Synthesis.SpeechSynthesizer" in source and "system_speech_failed" in source
assert "winrt_speech_failed" in source and "winrt_voice_not_found" in source
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
assert "SCOUT_CARGO_PRIORITY_URL" in source and "set_cargo_priority" in source
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
assert hud.TARGET_SCAN_DURATION==3.0 and hud.TARGET_SCAN_FRAMES==10
assert 'capture_interval = TARGET_SCAN_DURATION / max(1, TARGET_SCAN_FRAMES - 1)' in source
assert "ThreadPoolExecutor" in source and 'executor.submit(analyze_frame, index, frame)' in source
assert 'scan.get("active")' in source and 'scan.get("groups")' in source
assert "mission_quantity_right = width - 112 * scale" in source and "mission_status_right = width - 8 * scale" in source
assert "for attempt in range(6)" in source
assert "release_metadata_incomplete" in source and "release_digest_missing" in source
assert "time.sleep(1.5)" in source
assert 'if(r.scan)state.targetScan=r.scan;render();await load(true)' in html
assert 'FRAMES '+'' in html and 'SCANNING — SCROLL / PAUSE' in html
print("✓ Mongrel HUD companion profiles, surface navigation, local report flow and paired LAN boundary are wired")

assert 'mutationEpoch' in html and 'mutationPending' in html and 'async function mutate' in html
assert 'Profile switch failed' in html and 'profile active' in html
assert 'result = {"ok": True, "profile": profile, "layout": app.layout_snapshot()}' in source

assert '"miningCenters": []' in source
assert 'nav.get("target") if isinstance(nav.get("target"), dict) else nav.get("site")' in source
assert 'info["renderError"] = str(exc)[:160]' in source
assert 'finally:' in source and 'self.root.after(200, self.refresh_ui)' in source
