"""Per-carrier voice isolation: legacy Pneuma, Canine, published visitor, restart."""
import sys, types, tempfile
from pathlib import Path
sys.modules.setdefault("tkinter",types.ModuleType("tkinter"))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"downloads"/"mongrel-hud"))
import mongrel_hud as hud

hud.MongrelHudApp._mining_sync_loop=lambda self:None
hud.MongrelHudApp._voice_loop=lambda self:None
hud.MongrelHudApp._ambient_voice_loop=lambda self:None
hud.MongrelHudApp._voice_catalog_worker=lambda self:None

with tempfile.TemporaryDirectory() as dirname:
    store=hud.LocalStore(Path(dirname)/"state.json")
    app=hud.MongrelHudApp(store,"<html></html>")
    pneuma_id="123456789"
    site=[
        {"id":"pneuma-id","marketId":pneuma_id,"name":"Pneuma",
         "callsign":"ABC-123","relationship":"owner","ownershipType":"personal","personality":"personal"},
        {"id":"squad-carrier-r1mm","name":"Canine Catalyst","callsign":"R1MM",
         "relationship":"owner","ownershipType":"squad","personality":"mongrels"},
        {"id":"other-id","marketId":"999998888","name":"Friendly Carrier",
         "callsign":"XYZ-123","relationship":"squadmate","ownershipType":"personal","personality":"personal"},
    ]
    source={
        "commander":"Wolf258",
        "ownerCarrier":{"carrierId":pneuma_id,"name":"Pneuma","callsign":"ABC-123"},
        "siteFeed":{
            "carriers":site,
            "carrierDialogue":{
                "other-id":{"settings":{"ambientEnabled":True},
                    "voicePreferences":{"roles":{"atc":{"voiceProvider":"kokoro","voiceId":"af_heart"},
                        "announcement":{"voiceProvider":"winrt","voiceId":"Ava"}},
                        "cues":{"docking.granted":{"enabled":True,"minDelay":8,"maxDelay":9,"cooldown":45}},
                        "concourseVoices":[{"voiceProvider":"kokoro","voiceId":"af_bella","enabled":True}] }},
                "squad-carrier-r1mm":{"voicePreferences":{"roles":{"atc":{"voiceProvider":"kokoro","voiceId":"af_bella"}}}},
            }
        }
    }
    app.snapshot=hud.ScoutSnapshot(source,True,"")
    pneuma_key="registry:pneuma-id"
    canine_key="registry:squad-carrier-r1mm"
    other_key="registry:other-id"
    with store.lock:
        legacy=hud.normalized_voice_settings({"volume":64,
            "roles":{"atc":{"voiceProvider":"kokoro","voiceId":"af_heart"}},
            "cues":{"docking.granted":{"minDelay":3,"maxDelay":3,"cooldown":12}}})
        store.data["voice"]=legacy
        store.save()

    # Migrate existing owner's voice unchanged. A new squad carrier gets its
    # own published default rather than inheriting Pneuma's custom voice.
    assert app.voice_settings_snapshot(pneuma_key)["volume"]==64
    assert app.voice_settings_snapshot(pneuma_key)["roles"]["atc"]["voiceId"]=="af_heart"
    assert app.voice_settings_snapshot(canine_key)["volume"]==75
    assert app.voice_settings_snapshot(canine_key)["roles"]["atc"]["voiceId"]=="af_bella"
    assert app.voice_settings_snapshot(other_key)["cues"]["docking.granted"]["cooldown"]==45
    assert app.voice_settings_snapshot(other_key)["roles"]["atc"]["voiceId"]=="af_heart"
    assert app.voice_settings_snapshot(other_key)["concourseVoices"][0]["voiceId"]=="af_bella"

    # iPad updates to Canine must not alter Pneuma or the site owner's voice.
    updated=app.set_voice_settings({"carrierKey":canine_key,"volume":70,
        "roles":{"atc":{"voiceProvider":"kokoro","voiceId":"am_adam","voiceName":"Adam"}},
        "cues":{"docking.granted":{"minDelay":16,"maxDelay":18,"cooldown":24}}})
    assert updated["volume"]==70
    assert updated["roles"]["atc"]["voiceId"]=="am_adam"
    assert updated["cues"]["docking.granted"]["minDelay"]==16
    assert app.voice_settings_snapshot(pneuma_key)["volume"]==64
    assert app.voice_settings_snapshot(other_key)["cues"]["docking.granted"]["minDelay"]==8
    with store.lock:
        assert store.data["voice"]["volume"]==64,"Canine may not overwrite legacy Pneuma state"

    # Editing visiting carrier locally is an explicit override, not an edit to
    # the owner's public settings. Other commanders still get published defaults.
    app.set_voice_settings({"carrierKey":other_key,"cues":{"docking.granted":{"cooldown":22}}})
    assert app.voice_settings_snapshot(other_key)["cues"]["docking.granted"]["cooldown"]==22
    assert source["siteFeed"]["carrierDialogue"]["other-id"]["voicePreferences"]["cues"]["docking.granted"]["cooldown"]==45
    options=app._voice_profile_options()
    assert {pneuma_key,canine_key,other_key}.issubset({row["key"] for row in options})
    assert app._carrier_voice_profile_key(site[2])==other_key

    # Rebuilding the HUD state must preserve the independent, local voice sets.
    stored=hud.LocalStore(Path(dirname)/"state.json")
    restarted=hud.MongrelHudApp(stored,"<html></html>")
    restarted.snapshot=hud.ScoutSnapshot(source,True,"")
    assert restarted.voice_settings_snapshot(canine_key)["roles"]["atc"]["voiceId"]=="am_adam"
    assert restarted.voice_settings_snapshot(other_key)["cues"]["docking.granted"]["cooldown"]==22
    assert restarted.voice_settings_snapshot(pneuma_key)["volume"]==64
    try:
        app.set_voice_settings({"carrierKey":"registry:unauthorized","volume":100})
        raise AssertionError("Arbitrary carrier key was accepted")
    except ValueError as exc:
        assert str(exc)=="unknown_voice_carrier"

print("✓ Per-carrier legacy migration, published visitor defaults, independent local overrides, restart, and invalid ID guard passed")
