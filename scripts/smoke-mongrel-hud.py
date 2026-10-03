from __future__ import annotations

import importlib.util
import json
import sys
import types
from pathlib import Path


class StubConfig:
    def __init__(self) -> None:
        self.values = {
            "MongrelScoutEnabled": 1,
            "MongrelScoutToken": "mscout_test",
            "MongrelScoutEndpoint": "https://example.invalid/scout",
        }

    def get_int(self, key: str) -> int:
        return int(self.values.get(key, 0) or 0)

    def get_bool(self, key: str) -> bool:
        return bool(self.values.get(key, 0))

    def get_str(self, key: str) -> str:
        value = self.values.get(key, "")
        return value if isinstance(value, str) else str(value)

    def set(self, key: str, value) -> None:
        self.values[key] = value


class DummySession:
    headers = {"User-Agent": "SmokeTest"}

    def post(self, *args, **kwargs):
        raise AssertionError("HUD smoke must not perform cloud network I/O")


tk = types.ModuleType("tkinter")
for name in ("Label", "IntVar", "StringVar", "Frame"):
    setattr(tk, name, type(name, (), {}))
tk.W = "w"
sys.modules["tkinter"] = tk

nb = types.ModuleType("myNotebook")
sys.modules["myNotebook"] = nb

timeout_session = types.ModuleType("timeout_session")
timeout_session.new_session = lambda timeout=8: DummySession()
sys.modules["timeout_session"] = timeout_session

config_module = types.ModuleType("config")
config_module.config = StubConfig()
sys.modules["config"] = config_module

monitor_module = types.ModuleType("monitor")
monitor_module.monitor = types.SimpleNamespace(is_live_galaxy=lambda: True)
sys.modules["monitor"] = monitor_module

root = Path(__file__).resolve().parents[1]
plugin_path = root / "downloads" / "mongrel-scout" / "load.py"
spec = importlib.util.spec_from_file_location("mongrel_scout_smoke", plugin_path)
assert spec and spec.loader
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)

assert plugin.PLUGIN_VERSION == "1.5.1"
assert plugin.HUD_BRIDGE_HOST == "127.0.0.1"
assert plugin.HUD_BRIDGE_PORT == 43857
assert plugin.HUD_EVENT_LIMIT == 256
assert plugin.HUD_BRIDGE_VERSION == 2

expected_types = {
    "DockingRequested": "docking.requested",
    "DockingGranted": "docking.granted",
    "DockingDenied": "docking.denied",
    "DockingCancelled": "docking.cancelled",
    "DockingTimeout": "docking.timeout",
    "Docked": "docking.docked",
    "Undocked": "docking.undocked",
    "Location": "location.current",
    "CarrierJump": "carrier.jump",
    "CarrierStats": "carrier.stats",
    "FSDJump": "travel.fsd_jump",
    "SupercruiseEntry": "travel.supercruise_entry",
    "SupercruiseExit": "travel.supercruise_exit",
    "ApproachSettlement": "facility.approach",
    "ShipTargeted": "combat.target",
    "HullDamage": "ship.hull",
    "Loadout": "ship.loadout",
}
assert plugin.HUD_EVENT_TYPES == expected_types

carrier_stats = {
    "event": "CarrierStats",
    "timestamp": "2026-10-02T22:00:00Z",
    "CarrierID": 3701258240,
    "Callsign": "ABC-123",
    "Name": "Pneuma",
    "DockingAccess": "SquadronFriends",
}
plugin._publish_hud_event("Wolf258", "Diaba", "", carrier_stats)
state = plugin._hud_state_snapshot()
assert state["ownerCarrier"]["carrierId"] == "3701258240"
assert state["ownerCarrier"]["name"] == "Pneuma"
assert json.loads(config_module.config.get_str(plugin.KEY_OWNER_CARRIER))["carrierId"] == "3701258240"

granted = {
    "event": "DockingGranted",
    "timestamp": "2026-10-02T22:01:00Z",
    "StarSystem": "Diaba",
    "SystemAddress": 123456789012345678,
    "StationName": "Pneuma",
    "StationType": "FleetCarrier",
    "MarketID": 3701258240,
    "LandingPad": 12,
}
normalized = plugin._normalize_hud_event("Wolf258", "Diaba", "", granted)
assert normalized is not None
assert normalized["type"] == "docking.granted"
assert normalized["relationship"] == "owner"
assert normalized["landingPad"] == 12
assert normalized["systemAddress"] == "123456789012345678"

plugin._publish_hud_event("Wolf258", "Diaba", "", granted)
state = plugin._hud_state_snapshot()
assert state["docking"]["status"] == "granted"
assert state["docking"]["station"]["relationship"] == "owner"
assert state["docking"]["station"]["marketId"] == "3701258240"

plugin._publish_hud_event(
    "Wolf258",
    "Diaba",
    "Pneuma",
    {
        "event": "Docked",
        "timestamp": "2026-10-02T22:02:00Z",
        "StarSystem": "Diaba",
        "SystemAddress": 123456789012345678,
        "StationName": "Pneuma",
        "StationType": "FleetCarrier",
        "MarketID": 3701258240,
    },
)
state = plugin._hud_state_snapshot()
assert state["station"]["name"] == "Pneuma"
assert state["station"]["relationship"] == "owner"

plugin._publish_hud_event(
    "Wolf258",
    "Diaba",
    "",
    {
        "event": "FSDJump",
        "timestamp": "2026-10-02T22:03:00Z",
        "StarSystem": "NGC 2546 Sector UZ-G d10-16",
        "SystemAddress": 987654321098765432,
    },
)
state = plugin._hud_state_snapshot()
assert state["system"]["name"] == "NGC 2546 Sector UZ-G d10-16"
assert state["system"]["address"] == "987654321098765432"
assert state["supercruise"] is True

plugin._publish_hud_event(
    "Wolf258",
    "NGC 2546 Sector UZ-G d10-16",
    "",
    {
        "event": "SupercruiseExit",
        "timestamp": "2026-10-02T22:04:00Z",
        "StarSystem": "NGC 2546 Sector UZ-G d10-16",
        "SystemAddress": 987654321098765432,
        "Body": "NGC 2546 Sector UZ-G d10-16 6 d",
        "BodyID": 37,
        "BodyType": "Planet",
    },
)
state = plugin._hud_state_snapshot()
assert state["supercruise"] is False

latest = plugin._hud_events_after(0, 0)
assert latest["latestSeq"] == 5
assert [row["type"] for row in latest["events"]] == [
    "carrier.stats",
    "docking.granted",
    "docking.docked",
    "travel.fsd_jump",
    "travel.supercruise_exit",
]
assert all(row["commander"] == "Wolf258" for row in latest["events"])
assert plugin._hud_events_after(4, 0)["events"][0]["type"] == "travel.supercruise_exit"

# Dashboard status feeds surface position and own-shield state without entering the event queue.
seq_before_status = plugin._hud_events_after(0, 0)["latestSeq"]
plugin.dashboard_entry("Wolf258", False, {
    "timestamp":"2026-10-02T22:04:10Z","Flags":(1<<3)|(1<<21)|(1<<26),"Flags2":0,
    "BodyName":"NGC 2546 Sector UZ-G d10-16 7 b","Latitude":-22.7738,"Longitude":-98.8161,
    "Altitude":14.0,"Heading":42.0,"PlanetRadius":1234567.0,
    "Destination":{"System":668059324240760,"Body":77,"Name":"Surface Signal #10"},
})
state = plugin._hud_state_snapshot()
assert state["status"]["shieldsUp"] is True
assert state["status"]["hasLatLong"] is True
assert state["status"]["inSrv"] is True
assert state["status"]["latitude"] == -22.7738
assert plugin._hud_events_after(0, 0)["latestSeq"] == seq_before_status

plugin._publish_hud_event("Wolf258","NGC 2546 Sector UZ-G d10-16","",{
    "event":"ShipTargeted","timestamp":"2026-10-02T22:04:20Z","TargetLocked":True,
    "Ship":"ferdelance","Ship_Localised":"Fer-de-Lance","PilotName":"Test Target","PilotRank":"Elite","ScanStage":3,
    "ShieldHealth":73.5,"HullHealth":88.0,"LegalStatus":"Wanted","Bounty":3842610,
    "Subsystem":"int_powerplant","Subsystem_Localised":"Power Plant","SubsystemHealth":62.0,
})
state = plugin._hud_state_snapshot()
assert state["target"]["pilotName"] == "Test Target"
assert state["target"]["bounty"] == 3842610
assert state["target"]["modules"]["power plant"]["health"] == 62.0
plugin._publish_hud_event("Wolf258","NGC 2546 Sector UZ-G d10-16","",{
    "event":"ShipTargeted","timestamp":"2026-10-02T22:04:21Z","TargetLocked":True,
    "Ship":"ferdelance","Ship_Localised":"Fer-de-Lance","PilotName":"Test Target",
    "Subsystem":"int_hyperdrive","Subsystem_Localised":"Frame Shift Drive","SubsystemHealth":71.0,
})
state = plugin._hud_state_snapshot()
assert set(state["target"]["modules"]) == {"power plant","frame shift drive"}
plugin._publish_hud_event("Wolf258","NGC 2546 Sector UZ-G d10-16","",{"event":"HullDamage","timestamp":"2026-10-02T22:04:22Z","Health":0.873})
assert plugin._hud_state_snapshot()["ship"]["hullHealth"] == 87.3

# Unknown journal events do not enter the local bridge.
assert plugin._normalize_hud_event("Wolf258", "Diaba", "", {"event": "Cargo"}) is None

# Station-host telemetry preserves 64-bit system IDs exactly and survives a target clear.
plugin._last_system_address = 668059324240760
plugin.dashboard_entry(
    "Wolf258",
    False,
    {
        "timestamp": "2026-10-02T22:04:30Z",
        "BodyName": "NGC 2546 Sector UZ-G d10-16 9 a",
        "Destination": {
            "System": 668059324240760,
            "Body": 61,
            "Name": "Rivers Hub",
        },
    },
)
plugin.dashboard_entry(
    "Wolf258",
    False,
    {
        "timestamp": "2026-10-02T22:04:31Z",
        "BodyName": "NGC 2546 Sector UZ-G d10-16 9 a",
    },
)
visit = plugin._build_station_visit_payload(
    {
        "event": "DockingRequested",
        "timestamp": "2026-10-02T22:04:32Z",
        "StarSystem": "NGC 2546 Sector UZ-G d10-16",
        "SystemAddress": 668059324240760,
        "StationName": "Rivers Hub",
        "StationType": "Outpost",
        "MarketID": 4391607555,
    },
    {
        "SystemAddress": 668059324240760,
        "Body": "NGC 2546 Sector UZ-G d10-16 9 a",
        "BodyID": 61,
        "BodyType": "Planet",
    },
    "NGC 2546 Sector UZ-G d10-16",
    "Rivers Hub",
)
assert visit is not None
assert visit["kind"] == "facility_visit"
assert visit["systemAddress"] == "668059324240760"
assert visit["dashboard"]["destination"]["name"] == ""
assert visit["dashboard"]["lastDestination"]["name"] == "Rivers Hub"
assert visit["dashboard"]["lastDestination"]["systemAddress"] == "668059324240760"
assert "commander" not in visit
assert "cmdr" not in visit

# Local Commander identity never changes the existing cloud facility payload.
facility = plugin._build_facility_payload(
    {
        "event": "ApproachSettlement",
        "timestamp": "2026-10-02T22:05:00Z",
        "StarSystem": "Diaba",
        "SystemAddress": 123456789012345678,
        "Name": "Test Settlement",
        "MarketID": 123456,
        "BodyID": 7,
        "BodyName": "Diaba 2 a",
        "Latitude": 10.5,
        "Longitude": -20.25,
    },
    "Diaba",
)
assert facility is not None
assert "commander" not in facility
assert "cmdr" not in facility

print("✓ Mongrel Scout v1.5.1 local HUD bridge covers docking/travel plus combat and surface HUD state without cloud identity leakage")
