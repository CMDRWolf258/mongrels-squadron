from __future__ import annotations

import importlib.util
import json
import sys
import types
from pathlib import Path
from tempfile import TemporaryDirectory


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

assert plugin.PLUGIN_VERSION == "1.12.3"
assert plugin.HUD_BRIDGE_HOST == "127.0.0.1"
assert plugin.HUD_BRIDGE_PORT == 43857
assert plugin.HUD_EVENT_LIMIT == 256
assert plugin.HUD_SITE_FEED_REFRESH_SECONDS == 30.0
assert plugin.HUD_MINING_REPORT_ENDPOINT == "https://ten16-archive.pages.dev/api/hud/mining-report"
assert plugin.HUD_MINING_CENTER_ENDPOINT == "https://ten16-archive.pages.dev/api/hud/mining-center"
assert plugin.HUD_MINING_DATA_ENDPOINT == "https://ten16-archive.pages.dev/api/mining"
assert plugin.HUD_MINING_CENTERS_ENDPOINT == "https://ten16-archive.pages.dev/api/mining-centers"
assert plugin.HUD_BRIDGE_VERSION == 9
assert plugin.KEY_LAST_SYSTEM == "MongrelScoutLastSystem"
assert plugin.KEY_LAST_SYSTEM_ADDRESS == "MongrelScoutLastSystemAddress"
assert plugin.KEY_CARGO_MISSIONS == "MongrelScoutCargoMissionCache"
assert plugin.KEY_CARGO_PRIORITY == "MongrelScoutCargoPriorityFaction"

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
    "CarrierJumpRequest": "carrier.jump_request",
    "CarrierJumpCancelled": "carrier.jump_cancelled",
    "CarrierStats": "carrier.stats",
    "FSDJump": "travel.fsd_jump",
    "SupercruiseEntry": "travel.supercruise_entry",
    "SupercruiseExit": "travel.supercruise_exit",
    "SupercruiseDestinationDrop": "travel.destination_drop",
    "Disembark": "player.disembark",
    "Embark": "player.embark",
    "ApproachSettlement": "facility.approach",
    "ShipTargeted": "combat.target",
    "HullDamage": "ship.hull",
    "Loadout": "ship.loadout",
    "Bounty": "bounty.awarded",
    "RedeemVoucher": "bounty.redeemed",
    "Died": "ship.died",
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
    "Altitude":14.0,"Heading":42.0,"PlanetRadius":1234567.0,"Pips":[4,2,6],"Fuel":{"FuelMain":27.5,"FuelReservoir":0.8},"Cargo":12,"FireGroup":3,
    "Destination":{"System":668059324240760,"Body":77,"Name":"Surface Signal #10"},
})
state = plugin._hud_state_snapshot()
assert state["status"]["shieldsUp"] is True
assert state["status"]["hasLatLong"] is True
assert state["status"]["inSrv"] is True
assert state["status"]["latitude"] == -22.7738
assert state["status"]["pips"] == [2.0, 1.0, 3.0]
assert state["status"]["fuelMain"] == 27.5
assert state["status"]["cargo"] == 12
assert state["status"]["fuelReserve"] == 0.8
assert "siteFeed" in state and "siteFeedStatus" in state
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
plugin._publish_hud_event("Wolf258","NGC 2546 Sector UZ-G d10-16","",{
    "event":"Loadout","timestamp":"2026-10-02T22:04:22Z","Ship":"cutter","ShipName":"Honey Badger","ShipIdent":"MONGRL",
    "UnladenMass":1000.0,"MaxJumpRange":31.127644,"CargoCapacity":512,"FuelCapacity":{"Main":64.0,"Reserve":1.0},
    "Modules":[
        {"Slot":"FrameShiftDrive","Item":"int_hyperdrive_size6_class5","Engineering":{"Modifiers":[{"Label":"FSDOptimalMass","Value":1800.0,"OriginalValue":1800.0}]}},
        {"Slot":"Slot01_Size5","Item":"int_guardianfsdbooster_size5_class1"}
    ]
})
ship_state=plugin._hud_state_snapshot()["ship"]
assert ship_state["name"]=="Honey Badger" and ship_state["maxJumpRange"]==31.127644 and ship_state["fuelCapacity"]==64.0
assert ship_state["unladenMass"]==1000.0 and ship_state["jumpModel"]["class"]==6 and ship_state["jumpModel"]["rating"]=="A"
assert 31.59 < ship_state["currentJumpRange"] < 31.61
assert ship_state["currentMass"]==1040.3 and ship_state["jumpFuelUsed"]==8.0
# EDMC's cached module dictionary can rebuild the jump model after a plugin restart.
with plugin._hud_condition:
    plugin._hud_state["ship"]["jumpModel"] = None
plugin._update_hud_ship_from_edmc_state({
    "ShipName":"Honey Badger","ShipType":"cutter","UnladenMass":1000.0,"MaxJumpRange":31.127644,
    "CargoCapacity":512,"FuelCapacity":{"Main":64.0,"Reserve":1.0},
    "Modules":{
        "FrameShiftDrive":{"Slot":"FrameShiftDrive","Item":"int_hyperdrive_size6_class5","Engineering":{"Modifiers":[{"Label":"FSDOptimalMass","Value":1800.0}]}},
        "Slot01_Size5":{"Slot":"Slot01_Size5","Item":"int_guardianfsdbooster_size5_class1"}
    }
})
assert plugin._hud_state_snapshot()["ship"]["jumpModel"]["guardianBoost"]==10.5
assert 31.59 < plugin._hud_state_snapshot()["ship"]["currentJumpRange"] < 31.61
plugin._publish_hud_event("Wolf258","NGC 2546 Sector UZ-G d10-16","",{"event":"HullDamage","timestamp":"2026-10-02T22:04:23Z","Health":0.873})
assert plugin._hud_state_snapshot()["ship"]["hullHealth"] == 87.3
bounty_event=plugin._normalize_hud_event("Wolf258","NGC 2546 Sector UZ-G d10-16","",{"event":"Bounty","timestamp":"2026-10-02T22:04:24Z","TotalReward":842615,"Target":"python"})
assert bounty_event and bounty_event["type"]=="bounty.awarded" and bounty_event["totalReward"]==842615
redeem_event=plugin._normalize_hud_event("Wolf258","Diaba","",{"event":"RedeemVoucher","timestamp":"2026-10-02T22:04:25Z","Type":"bounty","Amount":900000})
assert redeem_event and redeem_event["type"]=="bounty.redeemed" and redeem_event["amount"]==900000
plugin.cmdr_data({"ship":{"shipName":"Honey Badger","health":{"hull":0.941}}},False)
assert plugin._hud_state_snapshot()["ship"]["hullHealth"]==94.1

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

# Local cargo state uses EDMC CargoJSON and keeps mission requirements separated
# by issuing faction while sharing the physical cargo hold only once.
for mission_id, count, faction in [
    (7001, 30, "Regiment of Imperial Mongrels"),
    (7002, 46, "Regiment of Imperial Mongrels"),
    (7003, 40, "Perez Ring Brewery"),
]:
    plugin._update_cargo_missions_from_journal("Wolf258", {
        "event": "MissionAccepted",
        "timestamp": f"2026-10-04T10:00:0{mission_id - 7001}Z",
        "MissionID": mission_id,
        "Name": "Mission_Mining_name",
        "LocalisedName": f"Mine {count} units of Osmium",
        "Commodity": "$Osmium_Name;",
        "Commodity_Localised": "Osmium",
        "Faction": faction,
        "Count": count,
        "Wing": mission_id == 7003,
    })
plugin._update_cargo_missions_from_journal("Wolf258", {
    "event": "MissionAccepted",
    "timestamp": "2026-10-04T10:00:04Z",
    "MissionID": 7100,
    "Name": "Mission_Delivery_name",
    "LocalisedName": "Deliver 100 units of Gold",
    "Commodity": "$Gold_Name;",
    "Commodity_Localised": "Gold",
    "Count": 100,
})
cargo_state = {
    "CargoCapacity": 512,
    "CargoJSON": {
        "Vessel": "Ship",
        "Inventory": [
            {"Name": "osmium", "Count": 20, "Stolen": 0, "MissionID": 7001},
            {"Name": "osmium", "Count": 51, "Stolen": 0},
            {"Name": "gold", "Count": 100, "Stolen": 0, "MissionID": 7100},
            {"Name": "drones", "Count": 29, "Stolen": 0},
            {"Name": "lowtemperaturediamond", "Count": 6, "Stolen": 6},
        ],
    },
}
cargo = plugin._build_local_cargo_state("Wolf258", cargo_state, "2026-10-04T10:01:00Z")
assert cargo is not None
assert cargo["used"] == 206 and cargo["capacity"] == 512 and cargo["free"] == 306
assert cargo["limpets"] == 29
needs = {(row["faction"], row["key"]): row for row in cargo["missionNeeds"]}
mongrel_osmium = needs[("Regiment of Imperial Mongrels", "osmium")]
perez_osmium = needs[("Perez Ring Brewery", "osmium")]
unknown_gold = needs[("Faction Unknown", "gold")]
assert mongrel_osmium["required"] == 76
assert mongrel_osmium["inHold"] == 71
assert mongrel_osmium["stillNeeded"] == 5
assert perez_osmium["required"] == 40
assert perez_osmium["inHold"] == 0
assert perez_osmium["stillNeeded"] == 40
assert mongrel_osmium["missionReservedInHold"] == 20
assert unknown_gold["inHold"] == 100 and unknown_gold["ready"] is True
assert cargo["priorityMode"] == "auto" and cargo["priorityFaction"] == ""
assert [row["faction"] for row in cargo["missionNeeds"]] == [
    "Regiment of Imperial Mongrels",
    "Perez Ring Brewery",
    "Faction Unknown",
]

# Switching Next Run reallocates only interchangeable cargo. The 20 t tagged to
# mission 7001 remains with the Mongrels while Perez receives shared Osmium first.
perez_first = plugin._apply_cargo_priority(cargo, "Perez Ring Brewery")
perez_needs = {(row["faction"], row["key"]): row for row in perez_first["missionNeeds"]}
assert perez_first["priorityFaction"] == "Perez Ring Brewery"
assert perez_needs[("Perez Ring Brewery", "osmium")]["inHold"] == 40
assert perez_needs[("Perez Ring Brewery", "osmium")]["ready"] is True
assert perez_needs[("Regiment of Imperial Mongrels", "osmium")]["missionReservedInHold"] == 20
assert perez_needs[("Regiment of Imperial Mongrels", "osmium")]["inHold"] == 31
assert perez_needs[("Regiment of Imperial Mongrels", "osmium")]["stillNeeded"] == 45
assert perez_needs[("Faction Unknown", "gold")]["inHold"] == 100

auto_again = plugin._apply_cargo_priority(perez_first, "")
assert auto_again["priorityMode"] == "auto"
assert [row["faction"] for row in auto_again["missionNeeds"]] == [
    "Regiment of Imperial Mongrels",
    "Perez Ring Brewery",
    "Faction Unknown",
]
assert cargo["stolenItems"] == [{"key": "lowtemperaturediamond", "name": "Low Temperature Diamonds", "count": 6}]
assert {row["key"]: row["count"] for row in cargo["items"]} == {"gold": 100, "osmium": 71}
assert config_module.config.get_str(plugin.KEY_CARGO_MISSIONS)

# Partial wing delivery reduces only that faction's outstanding requirement. The
# shared hold remains allocated once, so the same Osmium cannot make both groups ready.
plugin._update_cargo_missions_from_journal("Wolf258", {
    "event": "CargoDepot",
    "MissionID": 7003,
    "ItemsDelivered": 10,
    "TotalItemsToDeliver": 40,
})
cargo = plugin._build_local_cargo_state("Wolf258", cargo_state)
needs = {(row["faction"], row["key"]): row for row in cargo["missionNeeds"]}
assert needs[("Regiment of Imperial Mongrels", "osmium")]["stillNeeded"] == 5
assert needs[("Perez Ring Brewery", "osmium")]["remaining"] == 30
assert needs[("Perez Ring Brewery", "osmium")]["stillNeeded"] == 30

# Mission lifecycle removes completed requirements, and cached mission details survive
# a Scout restart even though Elite's startup Missions event does not repeat commodity/count.
plugin._update_cargo_missions_from_journal("Wolf258", {"event": "MissionCompleted", "MissionID": 7001})
assert 7001 not in {row["missionId"] for row in plugin._cargo_mission_rows("Wolf258")}
saved_missions = config_module.config.get_str(plugin.KEY_CARGO_MISSIONS)
with plugin._cargo_missions_lock:
    plugin._cargo_missions.clear()
plugin._restore_cargo_missions()
assert config_module.config.get_str(plugin.KEY_CARGO_MISSIONS) == saved_missions
assert {row["missionId"] for row in plugin._cargo_mission_rows("Wolf258")} == {7002, 7003, 7100}
assert {row["missionId"]: row.get("faction") for row in plugin._cargo_mission_rows("Wolf258")}[7003] == "Perez Ring Brewery"

# If Elite reports an active MissionID that Scout never cached (for example a
# mission accepted before an update), recover its original MissionAccepted
# details locally from recent journal history instead of silently omitting it.
with TemporaryDirectory() as journal_dir:
    journal_path = Path(journal_dir) / "Journal.2026-10-05T220000.01.log"
    journal_path.write_text(
        "\n".join([
            json.dumps({
                "timestamp":"2026-10-05T22:10:00Z","event":"MissionAccepted","MissionID":7999,
                "Name":"Mission_Mining_name","LocalisedName":"Mine 45 units of Osmium",
                "Commodity":"$Osmium_Name;","Commodity_Localised":"Osmium",
                "Faction":"The Consortium","Count":45,"Wing":False,
            }),
            json.dumps({
                "timestamp":"2026-10-05T22:25:00Z","event":"CargoDepot","MissionID":7999,
                "ItemsDelivered":5,"TotalItemsToDeliver":45,
            }),
        ]) + "\n",
        encoding="utf-8",
    )
    plugin.monitor.currentdir = journal_dir
    plugin._update_cargo_missions_from_journal("Wolf258", {
        "event":"Missions",
        "Active":[
            {"MissionID":7002},
            {"MissionID":7003},
            {"MissionID":7100},
            {"MissionID":7999},
        ],
    })
    recovered = {row["missionId"]: row for row in plugin._cargo_mission_rows("Wolf258")}
    assert recovered[7999]["commodity"] == "osmium"
    assert recovered[7999]["faction"] == "The Consortium"
    assert recovered[7999]["count"] == 45
    assert recovered[7999]["delivered"] == 5
    plugin.monitor.currentdir = None

# SRV Cargo.json must never overwrite the retained ship-cargo snapshot.
assert plugin._build_local_cargo_state("Wolf258", {"CargoJSON": {"Vessel": "SRV", "Inventory": [{"Name": "gold", "Count": 2, "Stolen": 0}]}}) is None

print("✓ Mongrel Scout 1.12.0 local HUD bridge covers cargo journal backfill, dynamic faction-priority cargo math, exact mission reservations, surface HUD state, and authenticated mining-report proxying")
