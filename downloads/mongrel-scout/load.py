from __future__ import annotations

import json
import re
import secrets
import threading
import time
import tkinter as tk
from collections import deque
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Mapping, MutableMapping, Optional
from urllib.parse import parse_qs, urlencode, urlparse

import myNotebook as nb
import timeout_session
from config import config

try:
    from monitor import monitor
except Exception:  # EDMC supplies this; fallback keeps settings usable if import changes.
    monitor = None

PLUGIN_NAME = "Mongrel Scout"
PLUGIN_VERSION = "1.12.2"
VERSION = PLUGIN_VERSION
MONGREL = "Regiment of Imperial Mongrels"
DEFAULT_ENDPOINT = "https://mongrels-squadron.pages.dev/api/operations/scout-ingest"
DEFAULT_ACTIVITY_ENDPOINT = "https://mongrels-squadron.pages.dev/api/operations/scout-activity"
ACTIVITY_BATCH_DELAY_SECONDS = 8.0
ACTIVITY_RETRY_SECONDS = 30.0
ACTIVITY_BATCH_MAX = 24
HUD_BRIDGE_HOST = "127.0.0.1"
HUD_BRIDGE_PORT = 43857
HUD_BRIDGE_VERSION = 9
HUD_EVENT_LIMIT = 256
HUD_SITE_FEED_REFRESH_SECONDS = 30.0
HUD_SITE_FEED_SAFETY_REFRESH_SECONDS = 600.0
HUD_MINING_REPORT_ENDPOINT = "https://ten16-archive.pages.dev/api/hud/mining-report"
HUD_MINING_CENTER_ENDPOINT = "https://ten16-archive.pages.dev/api/hud/mining-center"
HUD_MINING_DATA_ENDPOINT = "https://ten16-archive.pages.dev/api/mining"
HUD_MINING_CENTERS_ENDPOINT = "https://ten16-archive.pages.dev/api/mining-centers"
FSD_GRADE_BY_CLASS = {1: "E", 2: "D", 3: "C", 4: "B", 5: "A"}
FSD_POWER_CONSTANT = {2: 2.00, 3: 2.15, 4: 2.30, 5: 2.45, 6: 2.60, 7: 2.75, 8: 2.90}
FSD_RATING_CONSTANT = {
    "standard": {"E": 11.0, "D": 10.0, "C": 8.0, "B": 10.0, "A": 12.0},
    "sco": {"E": 8.0, "D": 12.0, "C": 12.0, "B": 12.0, "A": 13.0},
    "mkii": {"A": 11.0},
}
FSD_MAX_FUEL = {
    "standard": {
        "2E": 0.60, "2D": 0.60, "2C": 0.60, "2B": 0.80, "2A": 0.90,
        "3E": 1.20, "3D": 1.20, "3C": 1.20, "3B": 1.50, "3A": 1.80,
        "4E": 2.00, "4D": 2.00, "4C": 2.00, "4B": 2.50, "4A": 3.00,
        "5E": 3.30, "5D": 3.30, "5C": 3.30, "5B": 4.10, "5A": 5.00,
        "6E": 5.30, "6D": 5.30, "6C": 5.30, "6B": 6.60, "6A": 8.00,
        "7E": 8.50, "7D": 8.50, "7C": 8.50, "7B": 10.60, "7A": 12.80,
        "8E": 13.60, "8D": 13.60, "8C": 13.60, "8B": 17.00, "8A": 20.40,
    },
    "sco": {
        "2E": 0.60, "2D": 0.90, "2C": 0.90, "2B": 0.90, "2A": 1.00,
        "3E": 1.20, "3D": 1.80, "3C": 1.80, "3B": 1.80, "3A": 1.90,
        "4E": 2.00, "4D": 3.00, "4C": 3.00, "4B": 3.00, "4A": 3.20,
        "5E": 3.30, "5D": 5.00, "5C": 5.00, "5B": 5.00, "5A": 5.20,
        "6E": 5.30, "6D": 8.00, "6C": 8.00, "6B": 8.00, "6A": 8.30,
        "7E": 8.50, "7D": 12.80, "7C": 12.80, "7B": 12.80, "7A": 13.10,
        "8E": 13.80, "8D": 20.40, "8C": 20.40, "8B": 20.40, "8A": 20.70,
    },
    "mkii": {"8A": 6.80},
}
FSD_OPTIMAL_MASS = {
    "standard": {
        "2E": 48.0, "2D": 54.0, "2C": 60.0, "2B": 75.0, "2A": 90.0,
        "3E": 80.0, "3D": 90.0, "3C": 100.0, "3B": 125.0, "3A": 150.0,
        "4E": 280.0, "4D": 315.0, "4C": 350.0, "4B": 438.0, "4A": 525.0,
        "5E": 560.0, "5D": 630.0, "5C": 700.0, "5B": 875.0, "5A": 1050.0,
        "6E": 960.0, "6D": 1080.0, "6C": 1200.0, "6B": 1500.0, "6A": 1800.0,
        "7E": 1440.0, "7D": 1620.0, "7C": 1800.0, "7B": 2250.0, "7A": 2700.0,
        "8E": 2800.0, "8D": 4200.0, "8C": 4200.0, "8B": 4200.0, "8A": 4670.0,
    },
    "sco": {
        "2E": 60.0, "2D": 90.0, "2C": 90.0, "2B": 90.0, "2A": 100.0,
        "3E": 100.0, "3D": 150.0, "3C": 150.0, "3B": 150.0, "3A": 167.0,
        "4E": 350.0, "4D": 525.0, "4C": 525.0, "4B": 525.0, "4A": 585.0,
        "5E": 700.0, "5D": 1050.0, "5C": 1050.0, "5B": 1050.0, "5A": 1175.0,
        "6E": 1200.0, "6D": 1800.0, "6C": 1800.0, "6B": 1800.0, "6A": 2000.0,
        "7E": 1800.0, "7D": 2700.0, "7C": 2700.0, "7B": 2700.0, "7A": 3000.0,
        "8E": 1800.0, "8D": 2700.0, "8C": 2700.0, "8B": 2700.0, "8A": 3000.0,
    },
    "mkii": {"8A": 4670.0},
}
GUARDIAN_FSD_BOOST = {1: 4.00, 2: 6.00, 3: 7.75, 4: 9.25, 5: 10.50}
HUD_EVENT_TYPES = {
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

KEY_VERSION = "MongrelScoutConfigVersion"
KEY_ENABLED = "MongrelScoutEnabled"
KEY_TOKEN = "MongrelScoutToken"
KEY_ENDPOINT = "MongrelScoutEndpoint"
KEY_OWNER_CARRIER = "MongrelScoutOwnerCarrier"
KEY_LAST_SYSTEM = "MongrelScoutLastSystem"
KEY_LAST_SYSTEM_ADDRESS = "MongrelScoutLastSystemAddress"
KEY_CARGO_MISSIONS = "MongrelScoutCargoMissionCache"
KEY_CARGO_PRIORITY = "MongrelScoutCargoPriorityFaction"
KEY_ACTIVITY_MISSION_ORIGINS = "MongrelScoutActivityMissionOrigins"

_status_label: Optional[tk.Label] = None
_enabled_var: Optional[tk.IntVar] = None
_token_var: Optional[tk.StringVar] = None
_endpoint_var: Optional[tk.StringVar] = None
_send_lock = threading.Lock()
_status_lock = threading.Lock()
_pending_status = ""
_last_system_name = ""
_last_system_address: Any = None
_last_star_pos: Any = None
_cargo_missions_lock = threading.RLock()
_cargo_missions: dict[str, dict[str, dict[str, Any]]] = {}
_activity_lock = threading.RLock()
_activity_pending: list[dict[str, Any]] = []
_activity_pending_fingerprints: set[str] = set()
_activity_flush_scheduled = False
_activity_mission_origins: dict[str, dict[str, Any]] = {}
_dashboard_context_lock = threading.Lock()
_dashboard_context: dict[str, Any] = {
    "timestamp": "",
    "bodyName": "",
    "hasLatLong": False,
    "latitude": None,
    "longitude": None,
    "planetRadius": None,
    "destinationName": "",
    "destinationBodyId": None,
    "destinationSystem": None,
    "lastDestination": None,
}
_journal_context_lock = threading.Lock()
_journal_context: dict[str, Any] = {
    "ApproachBody": None,
    "LeaveBody": None,
    "SupercruiseEntry": None,
    "SupercruiseExit": None,
}
_session = timeout_session.new_session(timeout=8)
_hud_condition = threading.Condition()
_hud_session_id = secrets.token_hex(8)
_hud_events: deque[dict[str, Any]] = deque(maxlen=HUD_EVENT_LIMIT)
_hud_state: dict[str, Any] = {
    "bridgeVersion": HUD_BRIDGE_VERSION,
    "pluginVersion": PLUGIN_VERSION,
    "sessionId": _hud_session_id,
    "siteFeed": None,
    "siteFeedStatus": {"ok": False, "updatedAt": None, "error": "not_started"},
    "seq": 0,
    "commander": "",
    "system": None,
    "station": None,
    "docking": None,
    "supercruise": None,
    "instanceDestination": None,
    "ownerCarrier": None,
    "lastFacility": None,
    "status": None,
    "ship": {"name": "", "ident": "", "type": "", "maxJumpRange": None, "currentJumpRange": None, "unladenMass": None, "cargoCapacity": None, "fuelCapacity": None, "jumpModel": None, "currentMass": None, "hullHealth": None, "shieldsUp": None, "timestamp": None},
    "cargo": {"vessel": "Ship", "used": 0, "capacity": None, "free": None, "limpets": 0, "items": [], "stolenItems": [], "missionNeeds": [], "updatedAt": None},
    "target": None,
    "lastEvent": None,
    "updatedAt": None,
}
_hud_seq = 0
_hud_server: Optional[ThreadingHTTPServer] = None
_hud_thread: Optional[threading.Thread] = None
_hud_error = ""
_hud_site_feed_thread: Optional[threading.Thread] = None
_hud_site_feed_stop = threading.Event()


def plugin_start3(plugin_dir: str) -> str:
    """EDMC plugin entry point."""
    if config.get_int(KEY_VERSION) < 1:
        config.set(KEY_VERSION, 1)
        config.set(KEY_ENABLED, 1)
        config.set(KEY_ENDPOINT, DEFAULT_ENDPOINT)
    _restore_owner_carrier()
    _restore_last_system_context()
    _restore_cargo_missions()
    _restore_activity_mission_origins()
    if config.get_bool(KEY_ENABLED):
        _start_hud_bridge()
        _start_hud_site_feed()
    return PLUGIN_NAME


def plugin_app(parent: tk.Frame) -> tk.Frame:
    """Small status line in the EDMC main window."""
    global _status_label
    frame = tk.Frame(parent)
    tk.Label(frame, text="Mongrel Scout:").grid(row=0, column=0, sticky=tk.W)
    _status_label = tk.Label(frame, text=_initial_status())
    _status_label.grid(row=0, column=1, sticky=tk.W, padx=(6, 0))
    _status_label.bind("<<MongrelScoutStatus>>", _on_status_event)
    return frame


def plugin_prefs(parent: nb.Notebook, cmdr: str, is_beta: bool) -> Optional[tk.Frame]:
    """Settings tab shown inside EDMC."""
    global _enabled_var, _token_var, _endpoint_var

    _enabled_var = tk.IntVar(value=1 if config.get_bool(KEY_ENABLED) else 0)
    _token_var = tk.StringVar(value=config.get_str(KEY_TOKEN) or "")
    _endpoint_var = tk.StringVar(value=config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT)

    frame = nb.Frame(parent)
    frame.columnconfigure(1, weight=1)

    nb.Label(frame, text="Direct BGS + market scout uplink").grid(row=0, column=0, columnspan=2, sticky=tk.W, pady=(4, 8))
    nb.Checkbutton(frame, text="Enable Mongrel Scout", variable=_enabled_var).grid(row=1, column=0, columnspan=2, sticky=tk.W)

    nb.Label(frame, text="Scout token").grid(row=2, column=0, sticky=tk.W, pady=(8, 0))
    token_entry = tk.Entry(frame, textvariable=_token_var, show="•", width=52)
    token_entry.grid(row=2, column=1, sticky=tk.EW, padx=(8, 0), pady=(8, 0))

    nb.Label(frame, text="Endpoint").grid(row=3, column=0, sticky=tk.W, pady=(8, 0))
    endpoint_entry = tk.Entry(frame, textvariable=_endpoint_var, width=52)
    endpoint_entry.grid(row=3, column=1, sticky=tk.EW, padx=(8, 0), pady=(8, 0))

    privacy = (
        "BGS fields are sent from FSDJump / Location / CarrierJump only when the "
        "Regiment of Imperial Mongrels is present. When Elite supplies a Market event, "
        "Scout also sends that station's market ID, commodity prices, supply and demand "
        "for direct Trader's Outpost freshness. ApproachSettlement events also send the public "
        "facility market ID, host body ID/name, latitude and longitude so the System Orrery can "
        "replace schematic surface markers with verified positions. System coordinates support distance sorting. "
        "Orbital station visits send sanitized station context: station/market identity, Elite's selected "
        "Destination fields, EDMC's current Body fields, the live dashboard BodyName, and only the latest "
        "relevant ApproachBody/LeaveBody/Supercruise context, plus Status.json's surface-position flag/coordinates "
        "at the visit so newly colonized stations misreported by the journal can be distinguished from real surface ports. "
        "The server stores those facts and only promotes "
        "a host association when independent signals agree; Scout does not guess from proximity. Docking, "
        "station/carrier, travel and CarrierStats triggers are also normalized for the local HUD/voice bridge "
        "on 127.0.0.1. Commander name may "
        "exist in that local-only bridge state for future owner/squad greetings, but Commander name, "
        "cargo inventory, credit balance, ship build, materials, and general travel history are not transmitted. "
        "For near-real-time Mission Control and Colonization progress, Scout batches only selected journal results: "
        "MissionCompleted faction/influence effects, RedeemVoucher bounty/combat-bond redemptions, "
        "ColonisationContribution deliveries, and ColonisationConstructionDepot progress. Mission acceptance context "
        "used to resolve source faction/system stays local except for the minimal origin fields attached to the completed "
        "mission result. These activity batches are event-driven rather than continuously polled. "
        "For the optional local HUD, Scout also uses its bound machine token to fetch a compact read-only "
        "Mission Control / Trader / Scout Board leadership feed and to send explicit alert acknowledgements. "
        "Surface Mining can also use the token to submit explicit deposit reports to the curated 10-16 mining archive; "
        "the token itself is never exposed through the local HUD bridge. Personal HUD notes stay local on the PC."
    )
    nb.Label(frame, text=privacy, wraplength=520, justify=tk.LEFT).grid(
        row=4, column=0, columnspan=2, sticky=tk.W, pady=(10, 4)
    )
    return frame


def prefs_changed(cmdr: str, is_beta: bool) -> None:
    """Save plugin settings when EDMC Settings closes."""
    if _enabled_var is not None:
        config.set(KEY_ENABLED, int(_enabled_var.get()))
    if _token_var is not None:
        config.set(KEY_TOKEN, _token_var.get().strip())
    if _endpoint_var is not None:
        endpoint = _endpoint_var.get().strip() or DEFAULT_ENDPOINT
        config.set(KEY_ENDPOINT, endpoint)
    if config.get_bool(KEY_ENABLED):
        _start_hud_bridge()
        _start_hud_site_feed()
    else:
        _stop_hud_site_feed()
        _stop_hud_bridge()
    _set_status(_initial_status())


def dashboard_entry(cmdr: str, is_beta: bool, entry: Mapping[str, Any]) -> None:
    """Track a small sanitized Status.json context for later station-host resolution."""
    if is_beta or not config.get_bool(KEY_ENABLED):
        return None

    destination = entry.get("Destination")
    destination_name = ""
    destination_body_id: Optional[int] = None
    destination_system: Any = None
    if isinstance(destination, Mapping):
        destination_name = str(destination.get("Name_Localised") or destination.get("Name") or "").strip()
        destination_body_id = _optional_int(destination.get("Body"))
        destination_system = _decimal_text(destination.get("System"))

    snapshot = {
        "name": destination_name,
        "bodyId": destination_body_id,
        "systemAddress": destination_system,
        "observedAt": str(entry.get("timestamp") or "").strip(),
    }
    flags = _optional_int(entry.get("Flags")) or 0
    with _dashboard_context_lock:
        _dashboard_context["timestamp"] = str(entry.get("timestamp") or "").strip()
        _dashboard_context["bodyName"] = str(entry.get("BodyName") or "").strip()
        _dashboard_context["hasLatLong"] = bool(flags & (1 << 21))
        _dashboard_context["latitude"] = _optional_float(entry.get("Latitude"))
        _dashboard_context["longitude"] = _optional_float(entry.get("Longitude"))
        _dashboard_context["planetRadius"] = _optional_float(entry.get("PlanetRadius"))
        _dashboard_context["destinationName"] = destination_name
        _dashboard_context["destinationBodyId"] = destination_body_id
        _dashboard_context["destinationSystem"] = destination_system
        if destination_name:
            _dashboard_context["lastDestination"] = snapshot
    _update_hud_status(cmdr, entry)
    return None


def _update_hud_status(cmdr: str, entry: Mapping[str, Any]) -> None:
    """Expose a minimal local Status.json snapshot for the HUD companion."""
    flags = _optional_int(entry.get("Flags")) or 0
    destination = entry.get("Destination")
    destination_payload = None
    if isinstance(destination, Mapping):
        destination_payload = {
            "name": str(destination.get("Name_Localised") or destination.get("Name") or "").strip(),
            "bodyId": _optional_int(destination.get("Body")),
            "systemAddress": _decimal_text(destination.get("System")),
        }
    pips_raw = entry.get("Pips")
    pips = None
    if isinstance(pips_raw, (list, tuple)) and len(pips_raw) >= 3:
        parsed_pips = [_optional_float(value) for value in pips_raw[:3]]
        if all(value is not None for value in parsed_pips):
            pips = [float(value) / 2.0 for value in parsed_pips]

    fuel_main = None
    fuel_reserve = None
    fuel = entry.get("Fuel")
    if isinstance(fuel, Mapping):
        fuel_main = _optional_float(fuel.get("FuelMain"))
        fuel_reserve = _optional_float(fuel.get("FuelReservoir"))

    flags2 = _optional_int(entry.get("Flags2")) or 0
    status = {
        "timestamp": str(entry.get("timestamp") or "").strip(),
        "flags": flags,
        "flags2": flags2,
        "onFoot": bool(flags2 & (1 << 0)),
        "onFootInStation": bool(flags2 & (1 << 3)),
        "onFootOnPlanet": bool(flags2 & (1 << 4)),
        "onFootInHangar": bool(flags2 & (1 << 13)),
        "onFootSocialSpace": bool(flags2 & (1 << 14)),
        "onFootExterior": bool(flags2 & (1 << 15)),
        "bodyName": str(entry.get("BodyName") or "").strip(),
        "latitude": _optional_float(entry.get("Latitude")),
        "longitude": _optional_float(entry.get("Longitude")),
        "altitude": _optional_float(entry.get("Altitude")),
        "heading": _optional_float(entry.get("Heading")),
        "planetRadius": _optional_float(entry.get("PlanetRadius")),
        "shieldsUp": bool(flags & (1 << 3)),
        "hardpointsDeployed": bool(flags & (1 << 6)),
        "silentRunning": bool(flags & (1 << 10)),
        "massLocked": bool(flags & (1 << 16)),
        "lowFuel": bool(flags & (1 << 19)),
        "overheating": bool(flags & (1 << 20)),
        "hasLatLong": bool(flags & (1 << 21)),
        "inDanger": bool(flags & (1 << 22)),
        "inSrv": bool(flags & (1 << 26)),
        "legalState": str(entry.get("LegalState") or "").strip(),
        "pips": pips,
        "fuelMain": fuel_main,
        "fuelReserve": fuel_reserve,
        "cargo": _optional_int(entry.get("Cargo")),
        "fireGroup": _optional_int(entry.get("FireGroup")),
        "destination": destination_payload,
    }
    with _hud_condition:
        _hud_state["bridgeVersion"] = HUD_BRIDGE_VERSION
        _hud_state["pluginVersion"] = PLUGIN_VERSION
        _hud_state["commander"] = str(cmdr or "").strip() or _hud_state.get("commander", "")
        _hud_state["status"] = status
        ship = _hud_state.get("ship")
        if not isinstance(ship, dict):
            ship = {"hullHealth": None}
            _hud_state["ship"] = ship
        ship["shieldsUp"] = status["shieldsUp"]
        ship["timestamp"] = status["timestamp"]
        _update_current_jump_range_locked(ship, status)
        _hud_state["updatedAt"] = status["timestamp"] or _hud_state.get("updatedAt")
        _hud_condition.notify_all()


def journal_entry(
    cmdr: str,
    is_beta: bool,
    system: str,
    station: str,
    entry: MutableMapping[str, Any],
    state: Mapping[str, Any],
) -> str | None:
    """Send a sanitized BGS snapshot when the game supplies a full local faction board."""
    if is_beta or not config.get_bool(KEY_ENABLED):
        return None

    if monitor is not None:
        try:
            if not monitor.is_live_galaxy():
                return None
        except Exception:
            pass

    event = str(entry.get("event") or "")
    _update_hud_system_context(system, entry, state)
    if event == "MissionAccepted":
        _remember_activity_mission_origin(entry, system, station, state)
    if event in {"FSDJump", "Location", "CarrierJump"}:
        _remember_location(entry, system)
    if event in {"ApproachBody", "LeaveBody", "SupercruiseEntry", "SupercruiseExit"}:
        _remember_journal_context(entry, system)

    # HUD/voice triggers remain local. Seed current ship/cargo facts from EDMC state,
    # update the local-only mission calculator, then publish the event.
    _update_hud_ship_from_edmc_state(state)
    _update_cargo_missions_from_journal(cmdr, entry)
    _update_hud_cargo_from_edmc_state(cmdr, state, entry.get("timestamp"))
    _publish_hud_event(cmdr, system, station, entry)

    token = (config.get_str(KEY_TOKEN) or "").strip()

    activity_payload = _build_realtime_activity_payload(entry, state, system, station)
    if activity_payload is not None and token:
        _queue_realtime_activity(activity_payload)

    if event in {"DockingRequested", "Docked"}:
        visit_payload = _build_station_visit_payload(entry, state, system, station)
        if visit_payload is not None:
            if not token:
                _set_status("Needs scout token")
                return None
            endpoint = (config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT).strip()
            _set_status(f"Recording station context: {visit_payload['stationName']}…")
            threading.Thread(
                target=_send_snapshot,
                args=(endpoint, token, visit_payload),
                name="MongrelScoutStationVisitUpload",
                daemon=True,
            ).start()

    if event == "ApproachSettlement":
        if not token:
            _set_status("Needs scout token")
            return None
        payload = _build_facility_payload(entry, system)
        if payload is None:
            return None
        endpoint = (config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT).strip()
        _set_status(f"Mapping facility: {payload['facilityName']}…")
        threading.Thread(
            target=_send_snapshot,
            args=(endpoint, token, payload),
            name="MongrelScoutFacilityUpload",
            daemon=True,
        ).start()
        return None

    if event == "Market":
        if not token:
            _set_status("Needs scout token")
            return None
        payload = _build_market_payload(entry, system, station)
        if payload is None:
            return None
        endpoint = (config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT).strip()
        _set_status(f"Sending market: {payload['stationName']}…")
        threading.Thread(
            target=_send_snapshot,
            args=(endpoint, token, payload),
            name="MongrelScoutMarketUpload",
            daemon=True,
        ).start()
        return None

    if event not in {"FSDJump", "Location", "CarrierJump"}:
        return None

    factions = entry.get("Factions")
    if not isinstance(factions, list) or not _contains_mongrels(factions):
        return None

    if not token:
        _set_status("Needs scout token")
        return None

    endpoint = (config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT).strip()
    payload = _build_payload(entry, system)
    if payload is None:
        return None

    _set_status(f"Sending {payload['system']}…")
    threading.Thread(
        target=_send_snapshot,
        args=(endpoint, token, payload),
        name="MongrelScoutUpload",
        daemon=True,
    ).start()
    return None




def _update_hud_system_context(
    fallback_system: str,
    entry: Mapping[str, Any],
    state: Mapping[str, Any],
) -> None:
    """Keep the local HUD's current system seeded even when the journal event itself is not a HUD trigger."""
    global _last_system_name, _last_system_address

    name = str(
        entry.get("StarSystem")
        or state.get("SystemName")
        or fallback_system
        or _last_system_name
        or ""
    ).strip()
    address = _decimal_text(
        entry.get(
            "SystemAddress",
            state.get("SystemAddress", _last_system_address),
        )
    )
    if not name:
        return

    _last_system_name = name
    if address:
        _last_system_address = address

    try:
        config.set(KEY_LAST_SYSTEM, name)
        if address:
            config.set(KEY_LAST_SYSTEM_ADDRESS, address)
    except Exception:
        pass

    with _hud_condition:
        previous = _hud_state.get("system")
        previous_address = previous.get("address") if isinstance(previous, Mapping) else None
        _hud_state["system"] = {
            "name": name,
            "address": address or previous_address,
        }
        _hud_condition.notify_all()


def _restore_last_system_context() -> None:
    """Restore local-only current-system context across Scout/EDMC restarts."""
    global _last_system_name, _last_system_address
    try:
        name = str(config.get_str(KEY_LAST_SYSTEM) or "").strip()
        address = _decimal_text(config.get_str(KEY_LAST_SYSTEM_ADDRESS) or "")
    except Exception:
        return
    if not name:
        return
    _last_system_name = name
    _last_system_address = address
    with _hud_condition:
        _hud_state["system"] = {"name": name, "address": address}


def _update_hud_ship_from_edmc_state(state: Mapping[str, Any]) -> None:
    """Seed stable local ship identity/range facts from EDMC's current state."""
    if not isinstance(state, Mapping):
        return
    with _hud_condition:
        ship = _hud_state.get("ship")
        if not isinstance(ship, dict):
            ship = {}
            _hud_state["ship"] = ship
        updates = {
            "name": str(state.get("ShipName") or "").strip(),
            "ident": str(state.get("ShipIdent") or "").strip(),
            "type": str(state.get("ShipType") or "").strip(),
            "maxJumpRange": _optional_float(state.get("MaxJumpRange")),
            "unladenMass": _optional_float(state.get("UnladenMass")),
            "cargoCapacity": _optional_int(state.get("CargoCapacity")),
        }
        fuel_capacity = state.get("FuelCapacity")
        if isinstance(fuel_capacity, Mapping):
            updates["fuelCapacity"] = _optional_float(fuel_capacity.get("Main"))
        for key, value in updates.items():
            if value is not None and (not isinstance(value, str) or value):
                ship[key] = value
        cached_modules = state.get("Modules")
        if isinstance(cached_modules, Mapping):
            jump_model = _extract_jump_model({"Modules": cached_modules})
            if jump_model:
                ship["jumpModel"] = jump_model
        status = _hud_state.get("status")
        if isinstance(status, Mapping):
            _update_current_jump_range_locked(ship, status)
        _hud_condition.notify_all()


def cmdr_data(data: Any, is_beta: bool) -> None:
    """Use Frontier CAPI as a trustworthy hull-health seed when available."""
    if is_beta or not config.get_bool(KEY_ENABLED):
        return None
    try:
        ship_data = data.get("ship") if data is not None else None
    except Exception:
        ship_data = None
    if not isinstance(ship_data, Mapping):
        return None
    health = ship_data.get("health")
    hull = _normalize_auto_percent(health.get("hull")) if isinstance(health, Mapping) else None
    with _hud_condition:
        ship = _hud_state.get("ship")
        if not isinstance(ship, dict):
            ship = {}
            _hud_state["ship"] = ship
        if hull is not None:
            ship["hullHealth"] = hull
        name = str(ship_data.get("shipName") or "").strip()
        if name:
            ship["name"] = name
        ship["timestamp"] = str(getattr(data, "query_time", "") or ship.get("timestamp") or "")
        _hud_condition.notify_all()
    return None


def plugin_stop() -> None:
    """Stop the local HUD services when EDMC unloads the plugin."""
    _stop_hud_site_feed()
    _stop_hud_bridge()


class _HudBridgeHandler(BaseHTTPRequestHandler):
    """Loopback-only read API for the future Mongrel HUD/voice companion."""

    server_version = "MongrelScoutHUD/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/v1/health":
            with _hud_condition:
                payload = {
                    "ok": True,
                    "bridgeVersion": HUD_BRIDGE_VERSION,
                    "pluginVersion": PLUGIN_VERSION,
                    "sessionId": _hud_session_id,
                    "host": HUD_BRIDGE_HOST,
                    "port": HUD_BRIDGE_PORT,
                    "latestSeq": _hud_seq,
                }
            self._write_json(payload)
            return

        if parsed.path == "/v1/state":
            self._write_json(_hud_state_snapshot())
            return

        if parsed.path == "/v1/events":
            params = parse_qs(parsed.query)
            try:
                after = max(0, int((params.get("after") or ["0"])[0]))
            except (TypeError, ValueError):
                after = 0
            try:
                wait_seconds = float((params.get("wait") or ["0"])[0])
            except (TypeError, ValueError):
                wait_seconds = 0.0
            wait_seconds = max(0.0, min(25.0, wait_seconds))
            payload = _hud_events_after(after, wait_seconds)
            self._write_json(payload)
            return

        if parsed.path in {"/v1/mining/data", "/v1/mining/centers"}:
            endpoint = HUD_MINING_DATA_ENDPOINT if parsed.path.endswith("/data") else HUD_MINING_CENTERS_ENDPOINT
            result = _fetch_hud_mining_resource(endpoint)
            self._write_json(result, status=_hud_proxy_status(result))
            return

        self._write_json({"ok": False, "error": "not_found"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/v1/site-feed/ack", "/v1/mining/report", "/v1/mining/center", "/v1/cargo-priority"}:
            self._write_json({"ok": False, "error": "not_found"}, status=404)
            return
        try:
            length = min(max(0, int(self.headers.get("Content-Length", "0"))), 16384)
        except Exception:
            length = 0
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            self._write_json({"ok": False, "error": "invalid_json"}, status=400)
            return
        if not isinstance(body, Mapping):
            self._write_json({"ok": False, "error": "invalid_json"}, status=400)
            return

        if parsed.path in {"/v1/mining/report", "/v1/mining/center"}:
            endpoint = HUD_MINING_REPORT_ENDPOINT if parsed.path.endswith("/report") else HUD_MINING_CENTER_ENDPOINT
            result = _submit_hud_mining_request(endpoint, body)
            self._write_json(result, status=_hud_proxy_status(result))
            return

        if parsed.path == "/v1/cargo-priority":
            try:
                result = _set_hud_cargo_priority(str(body.get("faction") or "auto"))
                self._write_json({"ok": True, "cargo": result})
            except ValueError as exc:
                self._write_json({"ok": False, "error": str(exc)}, status=400)
            return

        action = str(body.get("action") or "ack").strip().lower()
        requested = body.get("alertIds") if action == "ack-all" else [body.get("alertId")]
        ids = []
        if isinstance(requested, list):
            for value in requested[:40]:
                alert_id = str(value or "").strip()[:500]
                if alert_id and alert_id not in ids:
                    ids.append(alert_id)
        with _hud_condition:
            feed = _hud_state.get("siteFeed")
            rows = feed.get("alerts") if isinstance(feed, Mapping) and isinstance(feed.get("alerts"), list) else []
            known = {str(row.get("id") or "") for row in rows if isinstance(row, Mapping)}
        ids = [value for value in ids if value in known]
        if not ids:
            self._write_json({"ok": False, "error": "alert_not_current"}, status=409)
            return
        result = _ack_hud_site_alerts(ids, action)
        self._write_json(result, status=_hud_proxy_status(result))

    def log_message(self, format: str, *args: Any) -> None:
        # Keep EDMC's log clean during high-frequency overlay polling.
        return

    def _write_json(self, payload: Mapping[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        # Intentionally no Access-Control-Allow-Origin header. The bridge is for
        # a local companion, not arbitrary web pages.
        self.end_headers()
        self.wfile.write(body)



def _hud_site_feed_endpoint() -> str:
    configured = (config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT).strip()
    parsed = urlparse(configured)
    if not parsed.scheme or not parsed.netloc:
        parsed = urlparse(DEFAULT_ENDPOINT)
    base = f"{parsed.scheme}://{parsed.netloc}/api/hud/feed"
    with _hud_condition:
        owner = _hud_state.get("ownerCarrier")
        owner = dict(owner) if isinstance(owner, Mapping) else {}
    params = {}
    carrier_id = _decimal_text(owner.get("carrierId"))
    callsign = str(owner.get("callsign") or "").strip()
    name = str(owner.get("name") or "").strip()
    if carrier_id:
        params["ownerCarrierId"] = carrier_id
    if callsign:
        params["ownerCarrierCallsign"] = callsign
    if name:
        params["ownerCarrierName"] = name
    return base + (("?" + urlencode(params)) if params else "")


def _hud_site_manifest_endpoint() -> str:
    configured = (config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT).strip()
    parsed = urlparse(configured)
    if not parsed.scheme or not parsed.netloc:
        parsed = urlparse(DEFAULT_ENDPOINT)
    return f"{parsed.scheme}://{parsed.netloc}/api/hud/manifest"


def _site_feed_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": f"{_session.headers.get('User-Agent', 'EDMarketConnector')} MongrelScout/{PLUGIN_VERSION}",
    }


def _public_hud_endpoint(endpoint: str) -> str:
    """Expose only a public origin/path, never URL credentials or query values."""
    try:
        parsed = urlparse(endpoint)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return ""
        host = parsed.hostname
        if ":" in host:
            host = f"[{host}]"
        if parsed.port:
            host += f":{parsed.port}"
        path = re.sub(r"mscout_[A-Za-z0-9_-]+", "[redacted]", parsed.path or "/")
        return f"{parsed.scheme}://{host}{path}"[:300]
    except (TypeError, ValueError):
        return ""


def _hud_error_code(value: Any) -> str:
    # Cloud responses may contain HTML, database details, or reflected input.
    # Only the API's short machine error vocabulary crosses the local bridge.
    if not isinstance(value, str) or "mscout_" in value:
        return ""
    return value if re.fullmatch(r"[a-z][a-z0-9_.:-]{0,119}", value) else ""


def _hud_response_details(response: Any, endpoint: str) -> tuple[Any, dict[str, Any]]:
    try:
        payload = response.json()
        response_format = "json"
    except Exception:
        payload = None
        content_type = str(getattr(response, "headers", {}).get("Content-Type", "")).lower()
        response_format = "invalid_json" if "json" in content_type else "html" if "html" in content_type else "text" if "text/" in content_type else "unknown"
    headers = getattr(response, "headers", {})
    ray = str(headers.get("CF-Ray", "") or headers.get("cf-ray", ""))
    request_id = ray if re.fullmatch(r"[A-Fa-f0-9]{12,32}(?:-[A-Za-z0-9]{2,8})?", ray) else ""
    status = int(response.status_code)
    error_code = _hud_error_code(payload.get("error")) if isinstance(payload, Mapping) else ""
    cloudflare_code = payload.get("error_code") if isinstance(payload, Mapping) else None
    cloudflare_label = {1101: "Worker exception", 1102: "Worker resource limit"}.get(cloudflare_code) if isinstance(cloudflare_code, int) else None
    if not error_code and cloudflare_label:
        error_code = str(cloudflare_code)
    detail = f"HTTP {status}" + (f" · Cloudflare {cloudflare_code} ({cloudflare_label})" if cloudflare_label else f" · {error_code}" if error_code else "")
    details = {
        "endpoint": _public_hud_endpoint(endpoint),
        "upstreamStatus": status,
        "requestId": request_id,
        "responseFormat": response_format,
        "errorCode": error_code,
        "detail": detail,
    }
    return payload, details


def _hud_http_failure(details: Mapping[str, Any], error: str = "") -> dict[str, Any]:
    code = _hud_error_code(error) or _hud_error_code(details.get("errorCode")) or f"http_{details.get('upstreamStatus')}"
    return {**details, "ok": False, "error": code}


def _hud_transport_failure(endpoint: str, exc: Exception, *, mining_read: bool = False) -> dict[str, Any]:
    category = type(exc).__name__
    # Exception messages can include a URL, proxy credentials, or request data.
    # The exception category is enough to distinguish timeout/TLS/connection errors.
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,79}", category):
        category = "NetworkError"
    return {
        "ok": False,
        "error": f"network:{category}" if mining_read else "network",
        "errorCode": "network",
        "endpoint": _public_hud_endpoint(endpoint),
        "upstreamStatus": None,
        "requestId": "",
        "responseFormat": "",
        "detail": f"Connection failed ({category})",
    }


def _hud_proxy_status(result: Mapping[str, Any]) -> int:
    if result.get("ok"):
        return 200
    status = result.get("upstreamStatus")
    if isinstance(status, int) and 400 <= status <= 599:
        return status
    error = str(result.get("error") or "")
    if error == "scout_token_missing":
        return 401
    if error in {"site_admin_required", "hud_owner_not_bound"}:
        return 403
    if error in {
        "unsupported_system", "commodity_required", "body_required", "invalid_body_type",
        "invalid_signal", "invalid_latitude", "invalid_longitude", "invalid_rig_count",
        "invalid_planet_radius",
    }:
        return 400
    return 502


def _set_site_feed_status(*, ok: bool, error: str = "", details: Optional[Mapping[str, Any]] = None) -> None:
    with _hud_condition:
        _hud_state["siteFeedStatus"] = {
            **(dict(details) if details else {}),
            "ok": bool(ok),
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "error": str(error or "")[:160],
        }
        _hud_condition.notify_all()


def _refresh_hud_site_feed_once() -> bool:
    endpoint = _hud_site_feed_endpoint()
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        _set_site_feed_status(ok=False, error="scout_token_missing", details={"endpoint": _public_hud_endpoint(endpoint), "detail": "Scout token is unavailable"})
        return False
    try:
        response = _session.get(endpoint, headers=_site_feed_headers(token))
        payload, details = _hud_response_details(response, endpoint)
        if not (200 <= response.status_code < 300):
            failure = _hud_http_failure(details)
            _set_site_feed_status(ok=False, error=failure["error"], details=details)
            return False
        if not isinstance(payload, Mapping) or payload.get("ok") is not True:
            _set_site_feed_status(ok=False, error="invalid_hud_feed", details={**details, "detail": f"HTTP {response.status_code} · invalid HUD feed ({details['responseFormat']})"})
            return False
        with _hud_condition:
            _hud_state["siteFeed"] = dict(payload)
            _hud_state["siteFeedStatus"] = {
                **details,
                "ok": True,
                "updatedAt": str(payload.get("generatedAt") or "").strip() or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "error": "",
            }
            _hud_condition.notify_all()
        return True
    except Exception as exc:
        failure = _hud_transport_failure(endpoint, exc)
        _set_site_feed_status(ok=False, error=failure["error"], details=failure)
        return False


def _refresh_hud_site_manifest_once() -> dict[str, Any]:
    endpoint = _hud_site_manifest_endpoint()
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return {
            "ok": False,
            "error": "scout_token_missing",
            "endpoint": _public_hud_endpoint(endpoint),
            "detail": "Scout token is unavailable",
        }
    try:
        response = _session.get(endpoint, headers=_site_feed_headers(token))
        payload, details = _hud_response_details(response, endpoint)
        if not (200 <= response.status_code < 300):
            return _hud_http_failure(details)
        if (
            not isinstance(payload, Mapping)
            or payload.get("ok") is not True
            or not isinstance(payload.get("channels"), Mapping)
        ):
            return {
                **details,
                "ok": False,
                "error": "invalid_hud_manifest",
                "detail": f"HTTP {response.status_code} · invalid HUD manifest ({details['responseFormat']})",
            }
        return {**details, "ok": True, "manifest": dict(payload)}
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc)


def _hud_manifest_signature(payload: Mapping[str, Any]) -> str:
    channels = payload.get("channels")
    if not isinstance(channels, Mapping):
        return ""
    viewer = payload.get("viewer")
    viewer_token = str(viewer.get("token") or "") if isinstance(viewer, Mapping) else ""
    normalized = {
        "version": int(payload.get("version") or 0),
        "channels": {str(key): str(value or "") for key, value in channels.items()},
        "viewer": viewer_token,
    }
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"))


def _hud_site_feed_loop() -> None:
    last_manifest_signature = ""
    last_full_refresh = 0.0
    last_feed_endpoint = ""

    while not _hud_site_feed_stop.is_set():
        now = time.monotonic()
        current_feed_endpoint = _hud_site_feed_endpoint()
        full_due = (
            last_full_refresh <= 0
            or current_feed_endpoint != last_feed_endpoint
            or now - last_full_refresh >= HUD_SITE_FEED_SAFETY_REFRESH_SECONDS
        )
        manifest_result: Optional[dict[str, Any]] = None
        manifest_signature = ""

        if not full_due:
            manifest_result = _refresh_hud_site_manifest_once()
            if manifest_result.get("ok"):
                manifest = manifest_result.get("manifest")
                manifest_signature = _hud_manifest_signature(manifest) if isinstance(manifest, Mapping) else ""
                if not manifest_signature or not last_manifest_signature or manifest_signature != last_manifest_signature:
                    full_due = True
            else:
                # Compatibility fallback: a missing/broken manifest must never
                # prevent the legacy full feed from continuing to refresh.
                full_due = True

        if full_due:
            if _refresh_hud_site_feed_once():
                last_full_refresh = time.monotonic()
                last_feed_endpoint = _hud_site_feed_endpoint()
                baseline = _refresh_hud_site_manifest_once()
                if baseline.get("ok"):
                    manifest = baseline.get("manifest")
                    baseline_signature = _hud_manifest_signature(manifest) if isinstance(manifest, Mapping) else ""
                    if baseline_signature:
                        last_manifest_signature = baseline_signature
        elif manifest_signature:
            last_manifest_signature = manifest_signature

        if _hud_site_feed_stop.wait(HUD_SITE_FEED_REFRESH_SECONDS):
            break


def _start_hud_site_feed() -> None:
    global _hud_site_feed_thread
    if _hud_site_feed_thread is not None and _hud_site_feed_thread.is_alive():
        return
    _hud_site_feed_stop.clear()
    thread = threading.Thread(target=_hud_site_feed_loop, name="MongrelScoutHudSiteFeed", daemon=True)
    _hud_site_feed_thread = thread
    thread.start()


def _stop_hud_site_feed() -> None:
    global _hud_site_feed_thread
    _hud_site_feed_stop.set()
    _hud_site_feed_thread = None


def _mark_site_alerts_acknowledged(ids: list[str], acknowledged_at: str = "") -> None:
    wanted = set(ids)
    with _hud_condition:
        feed = _hud_state.get("siteFeed")
        if not isinstance(feed, dict):
            return
        alerts = feed.get("alerts")
        if not isinstance(alerts, list):
            return
        for row in alerts:
            if isinstance(row, dict) and str(row.get("id") or "") in wanted:
                row["acknowledged"] = True
                row["acknowledgedAt"] = acknowledged_at or row.get("acknowledgedAt")
        feed["unacknowledgedCount"] = sum(
            1 for row in alerts if isinstance(row, Mapping) and not bool(row.get("acknowledged"))
        )
        _hud_condition.notify_all()


def _ack_hud_site_alerts(ids: list[str], action: str = "ack") -> dict[str, Any]:
    endpoint = _hud_site_feed_endpoint()
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return {"ok": False, "error": "scout_token_missing", "endpoint": _public_hud_endpoint(endpoint), "detail": "Scout token is unavailable"}
    payload: dict[str, Any] = {"action": "ack-all" if action == "ack-all" else "ack"}
    if action == "ack-all":
        payload["alertIds"] = ids
    else:
        payload["alertId"] = ids[0]
    try:
        response = _session.post(endpoint, json=payload, headers=_site_feed_headers(token))
        result, details = _hud_response_details(response, endpoint)
        if not (200 <= response.status_code < 300) or not isinstance(result, Mapping) or result.get("ok") is not True:
            return _hud_http_failure(details)
        acknowledged = [str(value) for value in result.get("acknowledged", ids) if str(value)]
        _mark_site_alerts_acknowledged(acknowledged, str(result.get("acknowledgedAt") or ""))
        return {**details, "ok": True, "acknowledged": acknowledged, "acknowledgedAt": result.get("acknowledgedAt")}
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc)


def _fetch_hud_mining_resource(endpoint: str) -> dict[str, Any]:
    """Fetch public mining navigation data through EDMC's trusted HTTPS session."""
    try:
        response = _session.get(
            endpoint,
            headers={
                "Accept": "application/json",
                "Cache-Control": "no-cache",
                "User-Agent": f"{_session.headers.get('User-Agent', 'EDMarketConnector')} MongrelScout/{PLUGIN_VERSION}",
            },
        )
        payload, details = _hud_response_details(response, endpoint)
        if not (200 <= response.status_code < 300):
            return _hud_http_failure(details, f"http_{response.status_code}")
        if not isinstance(payload, list):
            return {**details, "ok": False, "error": "invalid_mining_payload", "detail": f"HTTP {response.status_code} · invalid mining payload ({details['responseFormat']})"}
        return {**details, "ok": True, "data": payload}
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc, mining_read=True)


def _submit_hud_mining_request(endpoint: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return {"ok": False, "error": "scout_token_missing", "endpoint": _public_hud_endpoint(endpoint), "detail": "Scout token is unavailable"}
    try:
        response = _session.post(
            endpoint,
            json=dict(payload),
            headers={**_site_feed_headers(token), "Content-Type": "application/json"},
        )
        result, details = _hud_response_details(response, endpoint)
        if not (200 <= response.status_code < 300) or not isinstance(result, Mapping) or result.get("ok") is not True:
            error = _hud_error_code(result.get("message")) if isinstance(result, Mapping) else ""
            return _hud_http_failure(details, str(details.get("errorCode") or error))
        return {**dict(result), **details}
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc)


def _start_hud_bridge() -> None:
    global _hud_server, _hud_thread, _hud_error
    if _hud_server is not None:
        return
    try:
        server = ThreadingHTTPServer((HUD_BRIDGE_HOST, HUD_BRIDGE_PORT), _HudBridgeHandler)
        server.daemon_threads = True
        thread = threading.Thread(
            target=server.serve_forever,
            name="MongrelScoutHudBridge",
            daemon=True,
        )
        _hud_server = server
        _hud_thread = thread
        _hud_error = ""
        thread.start()
    except OSError as error:
        _hud_server = None
        _hud_thread = None
        _hud_error = str(error)


def _stop_hud_bridge() -> None:
    global _hud_server, _hud_thread
    server = _hud_server
    _hud_server = None
    _hud_thread = None
    if server is None:
        return
    try:
        server.shutdown()
        server.server_close()
    except Exception:
        pass


def _hud_state_snapshot() -> dict[str, Any]:
    with _hud_condition:
        snapshot = json.loads(json.dumps(_hud_state))
    cargo = snapshot.get("cargo")
    if isinstance(cargo, dict):
        cargo.pop("_allocation", None)
    return snapshot


def _hud_events_after(after: int, wait_seconds: float) -> dict[str, Any]:
    deadline = time.monotonic() + wait_seconds
    with _hud_condition:
        while _hud_seq <= after and wait_seconds > 0:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            _hud_condition.wait(timeout=remaining)
        events = [event for event in _hud_events if int(event.get("seq") or 0) > after]
        return {
            "bridgeVersion": HUD_BRIDGE_VERSION,
            "pluginVersion": PLUGIN_VERSION,
            "sessionId": _hud_session_id,
            "after": after,
            "latestSeq": _hud_seq,
            "events": json.loads(json.dumps(events)),
        }


def _publish_hud_event(
    cmdr: str,
    fallback_system: str,
    fallback_station: str,
    entry: Mapping[str, Any],
) -> None:
    normalized = _normalize_hud_event(cmdr, fallback_system, fallback_station, entry)
    if normalized is None:
        return
    global _hud_seq
    with _hud_condition:
        _hud_seq += 1
        normalized["seq"] = _hud_seq
        normalized["sessionId"] = _hud_session_id
        _hud_events.append(normalized)
        _update_hud_state_locked(normalized)
        _hud_condition.notify_all()


def _normalize_hud_event(
    cmdr: str,
    fallback_system: str,
    fallback_station: str,
    entry: Mapping[str, Any],
) -> Optional[dict[str, Any]]:
    journal_event = str(entry.get("event") or "").strip()
    event_type = HUD_EVENT_TYPES.get(journal_event)
    if not event_type:
        return None

    if journal_event == "CarrierStats":
        carrier = _carrier_identity(entry)
        if carrier:
            _save_owner_carrier(carrier)
    elif journal_event == "CarrierJumpRequest":
        carrier_id = _decimal_text(entry.get("CarrierID"))
        carrier = None
        if carrier_id:
            with _hud_condition:
                previous = _hud_state.get("ownerCarrier")
                previous = dict(previous) if isinstance(previous, Mapping) else {}
            if str(previous.get("carrierId") or "") != carrier_id:
                previous = {}
            carrier = {
                "carrierId": carrier_id,
                "callsign": str(previous.get("callsign") or "").strip(),
                "name": str(previous.get("name") or "").strip(),
                "dockingAccess": str(previous.get("dockingAccess") or "").strip(),
                "updatedAt": str(entry.get("timestamp") or "").strip(),
            }
            _save_owner_carrier(carrier)
    else:
        carrier = None

    system_name = str(entry.get("StarSystem") or fallback_system or _last_system_name or "").strip()
    system_address = _decimal_text(entry.get("SystemAddress", _last_system_address))
    station_name = str(entry.get("StationName") or fallback_station or "").strip()
    station_type = str(entry.get("StationType") or "").strip()
    market_id = _decimal_text(entry.get("MarketID"))

    if journal_event == "ApproachSettlement":
        station_name = str(entry.get("Name_Localised") or entry.get("Name") or station_name).strip()
    elif journal_event == "CarrierStats" and carrier:
        station_name = carrier.get("name") or carrier.get("callsign") or station_name
        station_type = "Fleet Carrier"
        market_id = carrier.get("carrierId")

    payload: dict[str, Any] = {
        "type": event_type,
        "journalEvent": journal_event,
        "timestamp": str(entry.get("timestamp") or "").strip(),
        "commander": str(cmdr or "").strip(),
        "system": system_name,
        "systemAddress": system_address,
        "stationName": station_name,
        "stationType": station_type,
        "marketId": market_id,
    }

    if market_id:
        payload["relationship"] = _relationship_for_market(market_id)

    if journal_event == "DockingGranted":
        landing_pad = _optional_int(entry.get("LandingPad"))
        if landing_pad is not None:
            payload["landingPad"] = landing_pad

    if journal_event == "DockingDenied":
        reason = str(entry.get("Reason") or "").strip()
        if reason:
            payload["reason"] = reason

    if journal_event in {"CarrierJumpRequest", "CarrierJumpCancelled"}:
        carrier_id = _decimal_text(entry.get("CarrierID"))
        if carrier_id:
            payload["carrierId"] = carrier_id
            if _relationship_for_market(carrier_id) == "owner" or journal_event == "CarrierJumpRequest":
                payload["relationship"] = "owner"
        if journal_event == "CarrierJumpRequest":
            destination_system = str(entry.get("SystemName") or "").strip()
            departure_time = str(entry.get("DepartureTime") or "").strip()
            body_name = str(entry.get("Body") or "").strip()
            body_id = _optional_int(entry.get("BodyID"))
            if destination_system:
                payload["destinationSystem"] = destination_system
            if departure_time:
                payload["departureTime"] = departure_time
            if body_name:
                payload["bodyName"] = body_name
            if body_id is not None:
                payload["bodyId"] = body_id

    if journal_event == "Location":
        payload["docked"] = bool(entry.get("Docked"))
        payload["onFoot"] = bool(entry.get("OnFoot"))

    if journal_event in {"Disembark", "Embark"}:
        payload["onStation"] = bool(entry.get("OnStation"))
        payload["onPlanet"] = bool(entry.get("OnPlanet"))

    if journal_event == "ShipTargeted":
        locked = bool(entry.get("TargetLocked"))
        payload["targetLocked"] = locked
        if locked:
            payload["ship"] = str(entry.get("Ship_Localised") or entry.get("Ship") or "").strip()
            payload["pilotName"] = str(entry.get("PilotName_Localised") or entry.get("PilotName") or "").strip()
            payload["pilotRank"] = str(entry.get("PilotRank") or "").strip()
            payload["scanStage"] = _optional_int(entry.get("ScanStage"))
            payload["shieldHealth"] = _normalize_percent(entry.get("ShieldHealth"))
            payload["hullHealth"] = _normalize_percent(entry.get("HullHealth"))
            payload["faction"] = str(entry.get("Faction") or "").strip()
            payload["legalStatus"] = str(entry.get("LegalStatus") or "").strip()
            payload["bounty"] = _optional_int(entry.get("Bounty"))
            payload["subsystemName"] = str(entry.get("Subsystem_Localised") or entry.get("Subsystem") or entry.get("SubSystem_Localised") or entry.get("SubSystem") or "").strip()
            payload["subsystemHealth"] = _normalize_percent(entry.get("SubsystemHealth") if entry.get("SubsystemHealth") is not None else entry.get("SubSystemHealth"))

    if journal_event == "HullDamage":
        payload["hullHealth"] = _normalize_percent(entry.get("Health"), fraction=True)
    elif journal_event == "Loadout":
        payload["hullHealth"] = _normalize_percent(entry.get("HullHealth"), fraction=True)
        payload["shipName"] = str(entry.get("ShipName") or "").strip()
        payload["shipIdent"] = str(entry.get("ShipIdent") or "").strip()
        payload["shipType"] = str(entry.get("Ship_Localised") or entry.get("Ship") or "").strip()
        payload["maxJumpRange"] = _optional_float(entry.get("MaxJumpRange"))
        payload["unladenMass"] = _optional_float(entry.get("UnladenMass"))
        payload["cargoCapacity"] = _optional_int(entry.get("CargoCapacity"))
        fuel_capacity = entry.get("FuelCapacity")
        if isinstance(fuel_capacity, Mapping):
            payload["fuelCapacity"] = _optional_float(fuel_capacity.get("Main"))
        jump_model = _extract_jump_model(entry)
        if jump_model:
            payload["jumpModel"] = jump_model

    if journal_event == "Bounty":
        payload["totalReward"] = _optional_int(entry.get("TotalReward"))
        payload["target"] = str(entry.get("Target_Localised") or entry.get("Target") or "").strip()
        payload["pilotName"] = str(entry.get("PilotName_Localised") or entry.get("PilotName") or "").strip()

    if journal_event == "RedeemVoucher":
        if str(entry.get("Type") or "").strip().casefold() != "bounty":
            return None
        payload["amount"] = _optional_int(entry.get("Amount"))

    if journal_event == "SupercruiseDestinationDrop":
        destination_type = str(entry.get("Type") or "").strip()
        if destination_type:
            payload["destinationType"] = destination_type

    if journal_event in {"SupercruiseExit", "ApproachSettlement"}:
        body_name = str(entry.get("BodyName") or entry.get("Body") or "").strip()
        body_id = _optional_int(entry.get("BodyID"))
        if body_name:
            payload["bodyName"] = body_name
        if body_id is not None:
            payload["bodyId"] = body_id

    if journal_event == "SupercruiseExit":
        body_type = str(entry.get("BodyType") or "").strip()
        if body_type:
            payload["bodyType"] = body_type

    if journal_event == "ApproachSettlement":
        latitude = _optional_float(entry.get("Latitude"))
        longitude = _optional_float(entry.get("Longitude"))
        if latitude is not None and -90.0 <= latitude <= 90.0:
            payload["latitude"] = latitude
        if longitude is not None and -180.0 <= longitude <= 180.0:
            payload["longitude"] = longitude

    if carrier:
        payload["carrier"] = carrier
        payload["relationship"] = "owner"

    return payload


def _update_hud_state_locked(event: Mapping[str, Any]) -> None:
    _hud_state["bridgeVersion"] = HUD_BRIDGE_VERSION
    _hud_state["pluginVersion"] = PLUGIN_VERSION
    _hud_state["seq"] = event.get("seq", _hud_state.get("seq", 0))
    _hud_state["commander"] = event.get("commander") or _hud_state.get("commander", "")
    _hud_state["lastEvent"] = {
        "type": event.get("type"),
        "journalEvent": event.get("journalEvent"),
        "timestamp": event.get("timestamp"),
        "seq": event.get("seq"),
    }
    _hud_state["updatedAt"] = event.get("timestamp") or _hud_state.get("updatedAt")

    if event.get("system"):
        _hud_state["system"] = {
            "name": event.get("system"),
            "address": event.get("systemAddress"),
        }

    event_type = str(event.get("type") or "")
    station = _station_identity(event)

    if event_type in {"ship.hull", "ship.loadout"}:
        hull_health = event.get("hullHealth")
        ship = _hud_state.get("ship")
        if not isinstance(ship, dict):
            ship = {}
            _hud_state["ship"] = ship
        if hull_health is not None:
            ship["hullHealth"] = hull_health
        if event_type == "ship.loadout":
            for source, dest in (
                ("shipName", "name"),
                ("shipIdent", "ident"),
                ("shipType", "type"),
                ("maxJumpRange", "maxJumpRange"),
                ("unladenMass", "unladenMass"),
                ("cargoCapacity", "cargoCapacity"),
                ("fuelCapacity", "fuelCapacity"),
            ):
                value = event.get(source)
                if value is not None and (not isinstance(value, str) or value):
                    ship[dest] = value
            if isinstance(event.get("jumpModel"), Mapping):
                ship["jumpModel"] = dict(event["jumpModel"])
            status = _hud_state.get("status")
            if isinstance(status, Mapping):
                _update_current_jump_range_locked(ship, status)
        ship["timestamp"] = event.get("timestamp") or ship.get("timestamp")

    if event_type == "combat.target":
        if not bool(event.get("targetLocked")):
            _hud_state["target"] = None
        else:
            current = _hud_state.get("target")
            same_target = isinstance(current, dict) and bool(current.get("locked"))
            if same_target:
                old_pilot = str(current.get("pilotName") or "").strip().casefold()
                new_pilot = str(event.get("pilotName") or "").strip().casefold()
                old_ship = str(current.get("ship") or "").strip().casefold()
                new_ship = str(event.get("ship") or "").strip().casefold()
                if old_pilot and new_pilot and old_pilot != new_pilot:
                    same_target = False
                elif old_ship and new_ship and old_ship != new_ship:
                    same_target = False
            if not same_target:
                current = {"locked": True, "modules": {}}
            for key in ("ship", "pilotName", "pilotRank", "scanStage", "shieldHealth", "hullHealth", "faction", "legalStatus", "bounty"):
                value = event.get(key)
                if value is not None and (not isinstance(value, str) or value):
                    current[key] = value
            current["locked"] = True
            current["timestamp"] = event.get("timestamp")
            subsystem_name = str(event.get("subsystemName") or "").strip()
            if subsystem_name:
                subsystem = {"name": subsystem_name, "health": event.get("subsystemHealth"), "observedAt": event.get("timestamp")}
                current["subsystem"] = subsystem
                modules = current.get("modules")
                if not isinstance(modules, dict):
                    modules = {}
                    current["modules"] = modules
                modules[subsystem_name.casefold()] = dict(subsystem)
            else:
                current["subsystem"] = None
            _hud_state["target"] = current

    if event_type in {"docking.requested", "docking.granted", "docking.denied", "docking.cancelled", "docking.timeout"}:
        _hud_state["docking"] = {
            "status": event_type.split(".", 1)[1],
            "station": station,
            "landingPad": event.get("landingPad"),
            "reason": event.get("reason"),
            "timestamp": event.get("timestamp"),
        }
        if event_type in {"docking.requested", "docking.granted"} and station and str(station.get("relationship") or "").casefold() == "owner":
            _hud_state["instanceDestination"] = {
                "marketId": station.get("marketId"),
                "name": station.get("name"),
                "type": station.get("type"),
                "relationship": "owner",
                "source": event_type,
                "timestamp": event.get("timestamp"),
            }

    if event_type == "docking.docked":
        _hud_state["station"] = station
        if station and str(station.get("relationship") or "").casefold() == "owner":
            _hud_state["instanceDestination"] = {
                "marketId": station.get("marketId"),
                "name": station.get("name"),
                "type": station.get("type"),
                "relationship": "owner",
                "source": event_type,
                "timestamp": event.get("timestamp"),
            }
        _hud_state["docking"] = {
            "status": "docked",
            "station": station,
            "timestamp": event.get("timestamp"),
        }

    if event_type == "docking.undocked":
        _hud_state["station"] = None
        _hud_state["docking"] = {
            "status": "undocked",
            "station": station,
            "timestamp": event.get("timestamp"),
        }

    if event_type == "location.current":
        if bool(event.get("docked")) and station:
            _hud_state["station"] = station
            if str(station.get("relationship") or "").casefold() == "owner":
                _hud_state["instanceDestination"] = {
                    "marketId": station.get("marketId"),
                    "name": station.get("name"),
                    "type": station.get("type"),
                    "relationship": "owner",
                    "source": event_type,
                    "timestamp": event.get("timestamp"),
                }
        elif not bool(event.get("docked")) and not bool(event.get("onFoot")):
            _hud_state["station"] = None

    if event_type in {"player.disembark", "player.embark"} and bool(event.get("onStation")) and station:
        _hud_state["station"] = station
        if str(station.get("relationship") or "").casefold() == "owner":
            _hud_state["instanceDestination"] = {
                "marketId": station.get("marketId"),
                "name": station.get("name"),
                "type": station.get("type"),
                "relationship": "owner",
                "source": event_type,
                "timestamp": event.get("timestamp"),
            }

    if event_type == "carrier.jump" and station:
        _hud_state["station"] = station

    if event_type in {"travel.fsd_jump", "travel.supercruise_entry"}:
        _hud_state["supercruise"] = True
        _hud_state["instanceDestination"] = None
    elif event_type == "travel.supercruise_exit":
        _hud_state["supercruise"] = False
    elif event_type == "travel.destination_drop":
        _hud_state["supercruise"] = False
        _hud_state["instanceDestination"] = {
            "marketId": event.get("marketId"),
            "name": event.get("stationName"),
            "type": event.get("destinationType") or event.get("stationType"),
            "relationship": event.get("relationship") or "unknown",
            "source": event_type,
            "timestamp": event.get("timestamp"),
        }

    if event_type == "facility.approach":
        _hud_state["lastFacility"] = {
            "name": event.get("stationName"),
            "marketId": event.get("marketId"),
            "bodyId": event.get("bodyId"),
            "bodyName": event.get("bodyName"),
            "latitude": event.get("latitude"),
            "longitude": event.get("longitude"),
            "timestamp": event.get("timestamp"),
        }

    if event_type in {"carrier.stats", "carrier.jump_request"} and isinstance(event.get("carrier"), Mapping):
        _hud_state["ownerCarrier"] = dict(event["carrier"])
        current_station = _hud_state.get("station")
        if isinstance(current_station, dict) and current_station.get("marketId") == event["carrier"].get("carrierId"):
            current_station["relationship"] = "owner"


def _station_identity(event: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    name = str(event.get("stationName") or "").strip()
    market_id = str(event.get("marketId") or "").strip()
    station_type = str(event.get("stationType") or "").strip()
    if not name and not market_id:
        return None
    return {
        "name": name,
        "type": station_type,
        "marketId": market_id or None,
        "relationship": str(event.get("relationship") or "unknown"),
    }


def _carrier_identity(entry: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    carrier_id = _decimal_text(entry.get("CarrierID"))
    callsign = str(entry.get("Callsign") or "").strip()
    name = str(entry.get("Name") or "").strip()
    docking_access = str(entry.get("DockingAccess") or "").strip()
    if not carrier_id:
        return None
    return {
        "carrierId": carrier_id,
        "callsign": callsign,
        "name": name,
        "dockingAccess": docking_access,
        "updatedAt": str(entry.get("timestamp") or "").strip(),
    }


def _restore_owner_carrier() -> None:
    raw = config.get_str(KEY_OWNER_CARRIER) or ""
    if not raw:
        return
    try:
        value = json.loads(raw)
    except Exception:
        return
    if not isinstance(value, Mapping) or not _decimal_text(value.get("carrierId")):
        return
    with _hud_condition:
        _hud_state["ownerCarrier"] = dict(value)


def _save_owner_carrier(carrier: Mapping[str, Any]) -> None:
    try:
        config.set(KEY_OWNER_CARRIER, json.dumps(dict(carrier), separators=(",", ":")))
    except Exception:
        pass


def _relationship_for_market(market_id: str) -> str:
    owner = _hud_state.get("ownerCarrier")
    if isinstance(owner, Mapping) and str(owner.get("carrierId") or "") == str(market_id):
        return "owner"
    return "unknown"


def _cmdr_cache_key(cmdr: Any) -> str:
    return " ".join(str(cmdr or "").split()).casefold() or "_default"


def _commodity_key(value: Any) -> str:
    text = str(value or "").strip()
    if text.startswith("$") and text.endswith(";"):
        text = text[1:-1]
    text = re.sub(r"_name$", "", text, flags=re.IGNORECASE)
    return re.sub(r"[^a-z0-9]+", "", text.casefold())


def _commodity_display(value: Any, localized: Any = None) -> str:
    local = " ".join(str(localized or "").split())
    if local:
        return local
    text = str(value or "").strip()
    if text.startswith("$") and text.endswith(";"):
        text = text[1:-1]
    text = re.sub(r"_name$", "", text, flags=re.IGNORECASE)
    text = text.replace("_", " ").strip()
    special = {
        "drones": "Limpets",
        "lowtemperaturediamond": "Low Temperature Diamonds",
        "voidopals": "Void Opals",
        "alexandrite": "Alexandrite",
        "grandidierite": "Grandidierite",
        "rhodplumsite": "Rhodplumsite",
        "serendibite": "Serendibite",
        "bertrandite": "Bertrandite",
        "indite": "Indite",
        "gallite": "Gallite",
        "osmium": "Osmium",
        "platinum": "Platinum",
        "palladium": "Palladium",
        "gold": "Gold",
        "silver": "Silver",
        "tritium": "Tritium",
        "painite": "Painite",
    }
    compact = re.sub(r"[^a-z0-9]+", "", text.casefold())
    if compact in special:
        return special[compact]
    return " ".join(word.capitalize() for word in text.split()) or "Unknown Cargo"


def _normalized_cached_mission(value: Any) -> Optional[dict[str, Any]]:
    if not isinstance(value, Mapping):
        return None
    mission_id = _optional_int(value.get("missionId"))
    count = _optional_int(value.get("count"))
    delivered = _optional_int(value.get("delivered")) or 0
    commodity = _commodity_key(value.get("commodity"))
    if mission_id is None or mission_id <= 0 or count is None or count <= 0 or not commodity:
        return None
    return {
        "missionId": mission_id,
        "name": str(value.get("name") or "").strip()[:180],
        "localisedName": str(value.get("localisedName") or "").strip()[:240],
        "commodity": commodity,
        "commodityName": _commodity_display(value.get("commodityName") or value.get("commodity"), value.get("commodityName")),
        "faction": str(value.get("faction") or "").strip()[:160],
        "count": count,
        "delivered": max(0, min(count, delivered)),
        "wing": bool(value.get("wing")),
        "destinationSystem": str(value.get("destinationSystem") or "").strip()[:160],
        "destinationStation": str(value.get("destinationStation") or "").strip()[:160],
        "acceptedAt": str(value.get("acceptedAt") or "").strip()[:80],
    }


def _restore_cargo_missions() -> None:
    raw = config.get_str(KEY_CARGO_MISSIONS) or ""
    if not raw:
        return
    try:
        decoded = json.loads(raw)
    except Exception:
        return
    if not isinstance(decoded, Mapping):
        return
    restored: dict[str, dict[str, dict[str, Any]]] = {}
    for cmdr_key, rows in decoded.items():
        if not isinstance(cmdr_key, str) or not isinstance(rows, list):
            continue
        bucket: dict[str, dict[str, Any]] = {}
        for row in rows[:128]:
            mission = _normalized_cached_mission(row)
            if mission:
                bucket[str(mission["missionId"])] = mission
        if bucket:
            restored[cmdr_key[:160]] = bucket
    with _cargo_missions_lock:
        _cargo_missions.clear()
        _cargo_missions.update(restored)


def _save_cargo_missions() -> None:
    with _cargo_missions_lock:
        payload = {
            key: list(bucket.values())[:128]
            for key, bucket in _cargo_missions.items()
            if bucket
        }
    try:
        config.set(KEY_CARGO_MISSIONS, json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
    except Exception:
        pass


def _cargo_mission_rows(cmdr: Any) -> list[dict[str, Any]]:
    key = _cmdr_cache_key(cmdr)
    with _cargo_missions_lock:
        bucket = _cargo_missions.get(key) or {}
        return [dict(row) for row in bucket.values()]


def _mission_from_accept_entry(entry: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    mission_id = _optional_int(entry.get("MissionID"))
    count = _optional_int(entry.get("Count"))
    commodity = _commodity_key(entry.get("Commodity"))
    if mission_id is None or mission_id <= 0 or count is None or count <= 0 or not commodity:
        return None
    return {
        "missionId": mission_id,
        "name": str(entry.get("Name") or "").strip()[:180],
        "localisedName": str(entry.get("LocalisedName") or "").strip()[:240],
        "commodity": commodity,
        "commodityName": _commodity_display(entry.get("Commodity"), entry.get("Commodity_Localised")),
        "faction": str(entry.get("Faction") or "").strip()[:160],
        "count": count,
        "delivered": 0,
        "wing": bool(entry.get("Wing")),
        "destinationSystem": str(entry.get("DestinationSystem") or "").strip()[:160],
        "destinationStation": str(entry.get("DestinationStation") or "").strip()[:160],
        "acceptedAt": str(entry.get("timestamp") or "").strip()[:80],
    }


def _recover_cargo_missions_from_recent_journals(mission_ids: set[str]) -> dict[str, dict[str, Any]]:
    pending = {str(mid) for mid in mission_ids if str(mid)}
    if not pending:
        return {}

    journal_dir = getattr(monitor, "currentdir", None) if monitor is not None else None
    if not journal_dir:
        try:
            journal_dir = config.get_str("journaldir") or getattr(config, "default_journal_dir", "")
        except Exception:
            journal_dir = ""
    if not journal_dir:
        return {}

    try:
        paths = sorted(
            Path(journal_dir).expanduser().glob("Journal*.log"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )[:16]
    except Exception:
        return {}

    recovered: dict[str, dict[str, Any]] = {}
    latest_depot: dict[str, Mapping[str, Any]] = {}
    latest_depot_stamp: dict[str, str] = {}

    # This is local-only recovery for active missions missing from Scout's cache.
    # Search newest journals first and stop once every requested MissionID has an
    # acceptance record. No journal contents leave the PC.
    for path in paths:
        try:
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                for line in handle:
                    if "MissionID" not in line:
                        continue
                    try:
                        row = json.loads(line)
                    except Exception:
                        continue
                    if not isinstance(row, Mapping):
                        continue
                    mission_id = _optional_int(row.get("MissionID"))
                    if mission_id is None:
                        continue
                    key = str(mission_id)
                    if key not in pending:
                        continue
                    event = str(row.get("event") or "")
                    if event == "CargoDepot":
                        stamp = str(row.get("timestamp") or "")
                        if key not in latest_depot_stamp or stamp >= latest_depot_stamp[key]:
                            latest_depot[key] = row
                            latest_depot_stamp[key] = stamp
                    elif event == "MissionAccepted" and key not in recovered:
                        mission = _mission_from_accept_entry(row)
                        if mission is not None:
                            recovered[key] = mission
            if recovered.keys() >= pending:
                break
        except Exception:
            continue

    for key, mission in recovered.items():
        depot = latest_depot.get(key)
        if not depot:
            continue
        total = _optional_int(depot.get("TotalItemsToDeliver"))
        delivered = _optional_int(depot.get("ItemsDelivered"))
        if total is not None and total > 0:
            mission["count"] = total
        if delivered is not None:
            mission["delivered"] = max(0, min(int(mission.get("count") or delivered), delivered))
    return recovered


def _update_cargo_missions_from_journal(cmdr: Any, entry: Mapping[str, Any]) -> None:
    event = str(entry.get("event") or "")
    key = _cmdr_cache_key(cmdr)
    changed = False
    missing_active_ids: set[str] = set()
    active_ids: set[str] = set()
    with _cargo_missions_lock:
        bucket = _cargo_missions.setdefault(key, {})

        if event == "MissionAccepted":
            mission = _mission_from_accept_entry(entry)
            if mission is not None:
                bucket[str(mission["missionId"])] = mission
                changed = True

        elif event == "CargoDepot":
            mission_id = _optional_int(entry.get("MissionID"))
            if mission_id is not None:
                mission = bucket.get(str(mission_id))
                if mission:
                    total = _optional_int(entry.get("TotalItemsToDeliver"))
                    delivered = _optional_int(entry.get("ItemsDelivered"))
                    if total is not None and total > 0:
                        mission["count"] = total
                    if delivered is not None:
                        mission["delivered"] = max(0, min(int(mission.get("count") or delivered), delivered))
                    cargo_type = entry.get("CargoType")
                    if cargo_type and not mission.get("commodity"):
                        mission["commodity"] = _commodity_key(cargo_type)
                        mission["commodityName"] = _commodity_display(cargo_type, entry.get("CargoType_Localised"))
                    changed = True

        elif event in {"MissionCompleted", "MissionFailed", "MissionAbandoned"}:
            mission_id = _optional_int(entry.get("MissionID"))
            if mission_id is not None and bucket.pop(str(mission_id), None) is not None:
                changed = True

        elif event == "Missions":
            active = entry.get("Active")
            if isinstance(active, list):
                active_ids = {
                    str(mid)
                    for row in active
                    if isinstance(row, Mapping)
                    for mid in [_optional_int(row.get("MissionID"))]
                    if mid is not None
                }
                missing_active_ids = active_ids.difference(bucket)
                for mission_id in list(bucket):
                    if mission_id not in active_ids:
                        bucket.pop(mission_id, None)
                        changed = True

        if not bucket:
            _cargo_missions.pop(key, None)

    if missing_active_ids:
        recovered = _recover_cargo_missions_from_recent_journals(missing_active_ids)
        if recovered:
            with _cargo_missions_lock:
                bucket = _cargo_missions.setdefault(key, {})
                for mission_id, mission in recovered.items():
                    # The Missions snapshot that triggered recovery is authoritative.
                    # Only restore IDs that were active in that same snapshot and are
                    # still absent from the cache.
                    if mission_id in active_ids and mission_id not in bucket:
                        bucket[mission_id] = mission
                        changed = True

    if changed:
        _save_cargo_missions()


def _cargo_inventory_from_edmc_state(state: Mapping[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    cargo_json = state.get("CargoJSON")
    if isinstance(cargo_json, Mapping):
        vessel = str(cargo_json.get("Vessel") or "Ship").strip() or "Ship"
        raw_inventory = cargo_json.get("Inventory")
        if isinstance(raw_inventory, list):
            rows: list[dict[str, Any]] = []
            for raw in raw_inventory:
                if not isinstance(raw, Mapping):
                    continue
                count = _optional_int(raw.get("Count"))
                key = _commodity_key(raw.get("Name"))
                if count is None or count <= 0 or not key:
                    continue
                rows.append({
                    "key": key,
                    "name": _commodity_display(raw.get("Name"), raw.get("Name_Localised")),
                    "count": count,
                    "stolen": max(0, min(count, _optional_int(raw.get("Stolen")) or 0)),
                    "missionId": _optional_int(raw.get("MissionID")),
                })
            return vessel, rows

    raw_totals = state.get("Cargo")
    rows = []
    if isinstance(raw_totals, Mapping):
        for raw_name, raw_count in raw_totals.items():
            count = _optional_int(raw_count)
            key = _commodity_key(raw_name)
            if count is None or count <= 0 or not key:
                continue
            rows.append({
                "key": key,
                "name": _commodity_display(raw_name),
                "count": count,
                "stolen": 0,
                "missionId": None,
            })
    return "Ship", rows


def _build_local_cargo_state(cmdr: Any, state: Mapping[str, Any], timestamp: Any = None) -> Optional[dict[str, Any]]:
    if not isinstance(state, Mapping):
        return None
    vessel, rows = _cargo_inventory_from_edmc_state(state)
    # The feature is specifically ship cargo. Keep the most recent ship snapshot
    # while the commander is driving an SRV instead of replacing it with SRV cargo.
    if vessel.casefold() != "ship":
        return None

    aggregated: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = row["key"]
        item = aggregated.setdefault(key, {"key": key, "name": row["name"], "count": 0, "stolen": 0, "missionCount": 0})
        item["count"] += int(row["count"])
        item["stolen"] += int(row["stolen"])
        if row.get("missionId") is not None:
            item["missionCount"] += int(row["count"])
        if row.get("name") and (not item.get("name") or item["name"] == "Unknown Cargo"):
            item["name"] = row["name"]

    used = sum(int(item["count"]) for item in aggregated.values())
    capacity = _optional_int(state.get("CargoCapacity"))
    if capacity is None:
        with _hud_condition:
            ship = _hud_state.get("ship")
            capacity = _optional_int(ship.get("cargoCapacity")) if isinstance(ship, Mapping) else None
    free = max(0, capacity - used) if capacity is not None else None

    limpets = 0
    regular_items: list[dict[str, Any]] = []
    stolen_items: list[dict[str, Any]] = []
    shared_available: dict[str, int] = {}
    mission_available: dict[str, int] = {}
    for row in rows:
        key = str(row.get("key") or "")
        if not key:
            continue
        count = max(0, int(row.get("count") or 0))
        stolen = max(0, min(count, int(row.get("stolen") or 0)))
        legal_count = max(0, count - stolen)
        if key in {"drones", "limpet", "limpets"}:
            limpets += count
            continue
        mission_id = _optional_int(row.get("missionId"))
        if mission_id is None:
            shared_available[key] = shared_available.get(key, 0) + legal_count
        else:
            mission_key = str(mission_id) + "\u0000" + key
            mission_available[mission_key] = mission_available.get(mission_key, 0) + legal_count

    for item in aggregated.values():
        key = str(item["key"])
        count = max(0, int(item["count"]))
        stolen = max(0, min(count, int(item["stolen"])))
        legal_count = max(0, count - stolen)
        if key in {"drones", "limpet", "limpets"}:
            continue
        if legal_count > 0:
            regular_items.append({"key": key, "name": item["name"], "count": legal_count, "missionCount": int(item["missionCount"])})
        if stolen > 0:
            stolen_items.append({"key": key, "name": item["name"], "count": stolen})

    regular_items.sort(key=lambda row: (-int(row["count"]), str(row["name"]).casefold()))
    stolen_items.sort(key=lambda row: (-int(row["count"]), str(row["name"]).casefold()))

    # Keep requirements separate by issuing faction. Mission-tagged cargo stays
    # reserved for its exact MissionID; ordinary cargo is then allocated according
    # to the user's local Next Run priority.
    needs_by_faction_commodity: dict[str, dict[str, Any]] = {}
    for mission in _cargo_mission_rows(cmdr):
        count = max(0, int(mission.get("count") or 0))
        delivered = max(0, min(count, int(mission.get("delivered") or 0)))
        remaining = max(0, count - delivered)
        if remaining <= 0:
            continue
        key = str(mission.get("commodity") or "")
        if not key:
            continue
        faction = str(mission.get("faction") or "").strip() or "Faction Unknown"
        group_key = faction.casefold() + "\u0000" + key
        row = needs_by_faction_commodity.setdefault(group_key, {
            "key": key,
            "name": str(mission.get("commodityName") or _commodity_display(key)),
            "faction": faction,
            "required": 0,
            "delivered": 0,
            "remaining": 0,
            "missionCount": 0,
            "firstAcceptedAt": str(mission.get("acceptedAt") or ""),
            "missions": [],
        })
        row["required"] += count
        row["delivered"] += delivered
        row["remaining"] += remaining
        row["missionCount"] += 1
        accepted_at = str(mission.get("acceptedAt") or "")
        if accepted_at and (not row["firstAcceptedAt"] or accepted_at < row["firstAcceptedAt"]):
            row["firstAcceptedAt"] = accepted_at
        row["missions"].append({
            "missionId": int(mission["missionId"]),
            "required": count,
            "delivered": delivered,
            "remaining": remaining,
            "wing": bool(mission.get("wing")),
            "faction": faction,
            "destinationSystem": str(mission.get("destinationSystem") or ""),
            "destinationStation": str(mission.get("destinationStation") or ""),
            "name": str(mission.get("localisedName") or mission.get("name") or ""),
        })

    cargo = {
        "vessel": "Ship",
        "used": used,
        "capacity": capacity,
        "free": free,
        "limpets": limpets,
        "items": regular_items,
        "stolenItems": stolen_items,
        "missionNeeds": list(needs_by_faction_commodity.values()),
        "trackedMissionCount": len(_cargo_mission_rows(cmdr)),
        "updatedAt": str(timestamp or "").strip() or None,
        "_allocation": {
            "sharedAvailable": shared_available,
            "missionAvailable": mission_available,
        },
    }
    return _apply_cargo_priority(cargo, _configured_cargo_priority())


def _configured_cargo_priority() -> str:
    return " ".join(str(config.get_str(KEY_CARGO_PRIORITY) or "").split())[:160]


def _apply_cargo_priority(cargo: Mapping[str, Any], priority_faction: str = "") -> dict[str, Any]:
    result = json.loads(json.dumps(cargo))
    rows = [row for row in result.get("missionNeeds", []) if isinstance(row, dict)]
    allocation = result.get("_allocation") if isinstance(result.get("_allocation"), dict) else {}
    shared_available = {
        str(key): max(0, int(value or 0))
        for key, value in (allocation.get("sharedAvailable") or {}).items()
    }
    mission_available = {
        str(key): max(0, int(value or 0))
        for key, value in (allocation.get("missionAvailable") or {}).items()
    }

    faction_first: dict[str, str] = {}
    available_factions: list[str] = []
    for row in rows:
        faction = str(row.get("faction") or "").strip() or "Faction Unknown"
        accepted = str(row.get("firstAcceptedAt") or "")
        current = faction_first.get(faction)
        if current is None or (accepted and (not current or accepted < current)):
            faction_first[faction] = accepted
        if faction.casefold() != "faction unknown" and faction not in available_factions:
            available_factions.append(faction)

    requested = " ".join(str(priority_faction or "").split())[:160]
    selected = next((name for name in available_factions if name.casefold() == requested.casefold()), "")
    if requested and not selected:
        config.set(KEY_CARGO_PRIORITY, "")

    def faction_sort_key(name: str) -> tuple[Any, ...]:
        folded = name.casefold()
        unknown = folded == "faction unknown"
        return (
            0 if selected and folded == selected.casefold() else 1,
            1 if unknown else 0,
            faction_first.get(name) or "9999",
            folded,
        )

    faction_order = sorted(faction_first, key=faction_sort_key)
    faction_rank = {name.casefold(): index for index, name in enumerate(faction_order)}
    rows.sort(key=lambda row: (
        faction_rank.get(str(row.get("faction") or "Faction Unknown").casefold(), 999),
        str(row.get("firstAcceptedAt") or ""),
        str(row.get("name") or "").casefold(),
    ))

    # Reserve mission-specific cargo before distributing interchangeable cargo.
    for row in rows:
        key = str(row.get("key") or "")
        reserved = 0
        for mission in row.get("missions") or []:
            if not isinstance(mission, Mapping):
                continue
            mission_id = _optional_int(mission.get("missionId"))
            mission_remaining = max(0, int(mission.get("remaining") or 0))
            if mission_id is None or mission_remaining <= 0:
                continue
            mission_key = str(mission_id) + "\u0000" + key
            reserved += min(mission_remaining, max(0, int(mission_available.get(mission_key) or 0)))
        row["missionReservedInHold"] = reserved

    cargo_remaining = dict(shared_available)
    for row in rows:
        key = str(row.get("key") or "")
        remaining = max(0, int(row.get("remaining") or 0))
        reserved = min(remaining, max(0, int(row.get("missionReservedInHold") or 0)))
        shared_needed = max(0, remaining - reserved)
        available = max(0, int(cargo_remaining.get(key) or 0))
        shared_used = min(shared_needed, available)
        cargo_remaining[key] = max(0, available - shared_used)
        in_hold = reserved + shared_used
        still_needed = max(0, remaining - in_hold)
        row["inHold"] = in_hold
        row["sharedInHold"] = shared_used
        row["stillNeeded"] = still_needed
        row["ready"] = still_needed == 0
        row["nextRun"] = bool(selected and str(row.get("faction") or "").casefold() == selected.casefold())

    result["missionNeeds"] = rows
    result["availableFactions"] = sorted(available_factions, key=str.casefold)
    result["priorityFaction"] = selected
    result["priorityMode"] = "faction" if selected else "auto"
    return result


def _set_hud_cargo_priority(value: str) -> dict[str, Any]:
    requested = " ".join(str(value or "").split())[:160]
    if requested.casefold() == "auto":
        requested = ""
    with _hud_condition:
        current = _hud_state.get("cargo")
        if not isinstance(current, Mapping):
            raise ValueError("cargo_not_ready")
        available = [
            str(name)
            for name in current.get("availableFactions", [])
            if isinstance(name, str) and name.strip()
        ]
        if requested:
            matched = next((name for name in available if name.casefold() == requested.casefold()), "")
            if not matched:
                raise ValueError("cargo_priority_not_current")
            requested = matched
        config.set(KEY_CARGO_PRIORITY, requested)
        updated = _apply_cargo_priority(current, requested)
        _hud_state["cargo"] = updated
        _hud_condition.notify_all()
        public = json.loads(json.dumps(updated))
        public.pop("_allocation", None)
        return public


def _update_hud_cargo_from_edmc_state(cmdr: Any, state: Mapping[str, Any], timestamp: Any = None) -> None:
    cargo = _build_local_cargo_state(cmdr, state, timestamp)
    if cargo is None:
        return
    with _hud_condition:
        _hud_state["cargo"] = cargo
        _hud_condition.notify_all()


def _decimal_text(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    try:
        text = str(int(value))
    except (TypeError, ValueError, OverflowError):
        text = str(value).strip()
    return text if text.isdigit() else None


def _optional_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return None


def _optional_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if result == result and result not in (float("inf"), float("-inf")) else None


def _fsd_module_key(item: str) -> tuple[str, int, str] | None:
    text = str(item or "").strip().casefold()
    match = re.search(r"size(\d+)_class(\d+)", text)
    if not match:
        return None
    size = int(match.group(1))
    grade = FSD_GRADE_BY_CLASS.get(int(match.group(2)))
    if not grade:
        return None
    if "overchargebooster_mkii" in text:
        kind = "mkii"
    elif "hyperdrive_overcharge" in text:
        kind = "sco"
    elif "hyperdrive" in text:
        kind = "standard"
    else:
        return None
    return kind, size, grade


def _engineering_value(module: Mapping[str, Any], label: str) -> Optional[float]:
    engineering = module.get("Engineering")
    modifiers = engineering.get("Modifiers") if isinstance(engineering, Mapping) else None
    if not isinstance(modifiers, list):
        return None
    wanted = label.casefold()
    for modifier in modifiers:
        if not isinstance(modifier, Mapping):
            continue
        if str(modifier.get("Label") or "").strip().casefold() != wanted:
            continue
        return _optional_float(modifier.get("Value"))
    return None


def _extract_jump_model(entry: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    modules_raw = entry.get("Modules")
    if isinstance(modules_raw, Mapping):
        modules = list(modules_raw.values())
    elif isinstance(modules_raw, list):
        modules = modules_raw
    else:
        return None
    fsd_module: Optional[Mapping[str, Any]] = None
    guardian_boost = 0.0
    for module in modules:
        if not isinstance(module, Mapping):
            continue
        item = str(module.get("Item") or "").strip()
        slot = str(module.get("Slot") or "").strip().casefold()
        if fsd_module is None and (slot == "frameshiftdrive" or "hyperdrive" in item.casefold()):
            fsd_module = module
        if "guardianfsdbooster" in item.casefold():
            size_match = re.search(r"size(\d+)", item.casefold())
            if size_match:
                guardian_boost = max(guardian_boost, GUARDIAN_FSD_BOOST.get(int(size_match.group(1)), 0.0))
    if fsd_module is None:
        return None
    item = str(fsd_module.get("Item") or "").strip()
    parsed = _fsd_module_key(item)
    if not parsed:
        return None
    kind, size, grade = parsed
    key = f"{size}{grade}"
    optimal_mass = _engineering_value(fsd_module, "FSDOptimalMass")
    if optimal_mass is None:
        optimal_mass = FSD_OPTIMAL_MASS.get(kind, {}).get(key)
    max_fuel = _engineering_value(fsd_module, "MaxFuelPerJump")
    if max_fuel is None:
        max_fuel = FSD_MAX_FUEL.get(kind, {}).get(key)
    rating_constant = FSD_RATING_CONSTANT.get(kind, {}).get(grade)
    power_constant = 2.5025 if kind == "mkii" and size == 8 else FSD_POWER_CONSTANT.get(size)
    values = (optimal_mass, max_fuel, rating_constant, power_constant)
    if any(value is None or float(value) <= 0 for value in values):
        return None
    return {
        "item": item,
        "kind": kind,
        "class": size,
        "rating": grade,
        "optimalMass": float(optimal_mass),
        "maxFuelPerJump": float(max_fuel),
        "ratingConstant": float(rating_constant),
        "powerConstant": float(power_constant),
        "guardianBoost": float(guardian_boost),
    }


def _update_current_jump_range_locked(ship: MutableMapping[str, Any], status: Mapping[str, Any]) -> None:
    ship["currentJumpRange"] = None
    ship["currentMass"] = None
    ship["jumpFuelUsed"] = None
    model = ship.get("jumpModel")
    if not isinstance(model, Mapping):
        return
    unladen = _optional_float(ship.get("unladenMass"))
    fuel_main = _optional_float(status.get("fuelMain"))
    fuel_reserve = _optional_float(status.get("fuelReserve"))
    cargo = _optional_float(status.get("cargo"))
    optimal_mass = _optional_float(model.get("optimalMass"))
    max_fuel = _optional_float(model.get("maxFuelPerJump"))
    rating_constant = _optional_float(model.get("ratingConstant"))
    power_constant = _optional_float(model.get("powerConstant"))
    guardian_boost = _optional_float(model.get("guardianBoost")) or 0.0
    if None in (unladen, fuel_main, cargo, optimal_mass, max_fuel, rating_constant, power_constant):
        return
    current_fuel = max(0.0, float(fuel_main)) + max(0.0, float(fuel_reserve or 0.0))
    current_mass = float(unladen) + max(0.0, float(cargo)) + current_fuel
    if current_mass <= 0:
        return
    fuel_used = min(current_fuel, max(0.0, float(max_fuel)))
    ship["currentMass"] = round(current_mass, 6)
    ship["jumpFuelUsed"] = round(fuel_used, 6)
    ship["currentFuel"] = round(current_fuel, 6)
    ship["jumpRangeMethod"] = "elite_fsd_formula"
    if fuel_used <= 0:
        ship["currentJumpRange"] = 0.0
        return
    try:
        base_range = float(optimal_mass) / current_mass * ((fuel_used * 1000.0 / float(rating_constant)) ** (1.0 / float(power_constant)))
        ship["currentJumpRange"] = round(max(0.0, base_range + guardian_boost), 6)
    except (ArithmeticError, OverflowError, ValueError):
        ship["currentJumpRange"] = None


def _normalize_percent(value: Any, *, fraction: bool = False) -> Optional[float]:
    result = _optional_float(value)
    if result is None:
        return None
    if fraction:
        result *= 100.0
    return max(0.0, min(100.0, result))


def _normalize_auto_percent(value: Any) -> Optional[float]:
    result = _optional_float(value)
    if result is None:
        return None
    if 0.0 <= result <= 1.0:
        result *= 100.0
    return max(0.0, min(100.0, result))


def _remember_location(entry: Mapping[str, Any], fallback_system: str) -> None:
    global _last_system_name, _last_system_address, _last_star_pos
    system_name = str(entry.get("StarSystem") or fallback_system or "").strip()
    if system_name:
        _last_system_name = system_name
    if entry.get("SystemAddress") is not None:
        _last_system_address = entry.get("SystemAddress")
    star_pos = entry.get("StarPos")
    if isinstance(star_pos, (list, tuple)) and len(star_pos) >= 3:
        _last_star_pos = list(star_pos[:3])


def _context_event_snapshot(entry: Mapping[str, Any], fallback_system: str) -> dict[str, Any]:
    return {
        "event": str(entry.get("event") or "").strip(),
        "timestamp": str(entry.get("timestamp") or "").strip(),
        "system": str(entry.get("StarSystem") or fallback_system or _last_system_name or "").strip(),
        "systemAddress": _decimal_text(entry.get("SystemAddress", _last_system_address)),
        "bodyName": str(entry.get("BodyName") or entry.get("Body") or "").strip(),
        "bodyId": _optional_int(entry.get("BodyID")),
        "bodyType": str(entry.get("BodyType") or "").strip(),
    }


def _remember_journal_context(entry: Mapping[str, Any], fallback_system: str) -> None:
    event = str(entry.get("event") or "").strip()
    if event not in _journal_context:
        return
    with _journal_context_lock:
        _journal_context[event] = _context_event_snapshot(entry, fallback_system)


def _build_station_visit_payload(
    entry: Mapping[str, Any],
    state: Mapping[str, Any],
    fallback_system: str,
    fallback_station: str,
) -> Optional[dict[str, Any]]:
    station_name = str(entry.get("StationName") or fallback_station or "").strip()
    station_type = str(entry.get("StationType") or state.get("StationType") or "").strip()
    if not station_name:
        return None

    market_id = entry.get("MarketID", state.get("MarketID"))
    system_name = str(entry.get("StarSystem") or state.get("SystemName") or fallback_system or _last_system_name or "").strip()
    system_address = entry.get("SystemAddress", state.get("SystemAddress", _last_system_address))
    timestamp = str(entry.get("timestamp") or "").strip()

    market_id_text = _decimal_text(market_id)
    system_address_text = _decimal_text(system_address)
    if not market_id_text or not system_address_text or not system_name or not timestamp:
        return None

    with _dashboard_context_lock:
        dashboard = {
            "timestamp": str(_dashboard_context.get("timestamp") or "").strip(),
            "bodyName": str(_dashboard_context.get("bodyName") or "").strip(),
            "destination": {
                "name": str(_dashboard_context.get("destinationName") or "").strip(),
                "bodyId": _optional_int(_dashboard_context.get("destinationBodyId")),
                "systemAddress": _decimal_text(_dashboard_context.get("destinationSystem")),
            },
            "lastDestination": dict(_dashboard_context["lastDestination"])
            if isinstance(_dashboard_context.get("lastDestination"), Mapping)
            else None,
            "surface": {
                "hasLatLong": bool(_dashboard_context.get("hasLatLong")),
                "latitude": _optional_float(_dashboard_context.get("latitude")),
                "longitude": _optional_float(_dashboard_context.get("longitude")),
                "planetRadius": _optional_float(_dashboard_context.get("planetRadius")),
            },
        }

    with _journal_context_lock:
        journal_context = json.loads(json.dumps(_journal_context))

    current_body = {
        "name": str(state.get("Body") or "").strip(),
        "bodyId": _optional_int(state.get("BodyID")),
        "bodyType": str(state.get("BodyType") or "").strip(),
    }
    journal_body = {
        "name": str(entry.get("BodyName") or entry.get("Body") or "").strip(),
        "bodyId": _optional_int(entry.get("BodyID")),
        "bodyType": str(entry.get("BodyType") or "").strip(),
    }

    return {
        "version": 1,
        "kind": "facility_visit",
        "event": str(entry.get("event") or "").strip(),
        "timestamp": timestamp,
        "system": system_name,
        "systemName": system_name,
        "systemAddress": system_address_text,
        "stationName": station_name,
        "stationType": station_type,
        "marketId": market_id_text,
        "distanceToArrivalLs": _optional_float(
            entry.get("DistFromStarLS", state.get("DistFromStarLS", state.get("DistanceFromStarLS")))
        ),
        "currentBody": current_body,
        "journalBody": journal_body,
        "dashboard": dashboard,
        "context": journal_context,
    }

def _build_facility_payload(
    entry: Mapping[str, Any],
    fallback_system: str,
) -> Optional[dict[str, Any]]:
    system_name = str(entry.get("StarSystem") or fallback_system or _last_system_name or "").strip()
    facility_name = str(entry.get("Name_Localised") or entry.get("Name") or "").strip()
    body_name = str(entry.get("BodyName") or "").strip()
    timestamp = str(entry.get("timestamp") or "").strip()
    system_address = entry.get("SystemAddress", _last_system_address)
    market_id = entry.get("MarketID")
    body_id = entry.get("BodyID")
    latitude = entry.get("Latitude")
    longitude = entry.get("Longitude")

    try:
        system_address_text = str(int(system_address))
        market_id_text = str(int(market_id))
        body_id_value = int(body_id)
        latitude_value = float(latitude)
        longitude_value = float(longitude)
    except (TypeError, ValueError, OverflowError):
        return None

    if (
        not system_name
        or not facility_name
        or not timestamp
        or not system_address_text.isdigit()
        or not market_id_text.isdigit()
        or body_id_value < 0
        or not (-90.0 <= latitude_value <= 90.0)
        or not (-180.0 <= longitude_value <= 180.0)
    ):
        return None

    return {
        "version": 1,
        "kind": "facility",
        "event": "ApproachSettlement",
        "timestamp": timestamp,
        "system": system_name,
        "systemName": system_name,
        "systemAddress": system_address_text,
        "facilityName": facility_name,
        "marketId": market_id_text,
        "bodyId": body_id_value,
        "bodyName": body_name,
        "latitude": latitude_value,
        "longitude": longitude_value,
    }


def _build_market_payload(
    entry: Mapping[str, Any],
    fallback_system: str,
    fallback_station: str,
) -> Optional[dict[str, Any]]:
    items = entry.get("Items")
    if not isinstance(items, list) or not items:
        return None

    system_name = str(entry.get("StarSystem") or fallback_system or _last_system_name or "").strip()
    station_name = str(entry.get("StationName") or fallback_station or "").strip()
    timestamp = str(entry.get("timestamp") or "").strip()
    market_id = entry.get("MarketID")
    if not system_name or not station_name or not timestamp or market_id is None:
        return None

    commodities = []
    for row in items[:250]:
        if not isinstance(row, Mapping):
            continue
        raw_name = str(row.get("Name") or "").strip()
        local_name = str(row.get("Name_Localised") or "").strip()
        if not raw_name and not local_name:
            continue
        commodities.append(
            {
                "name": raw_name or local_name,
                "nameLocalised": local_name,
                "category": str(row.get("Category") or ""),
                "categoryLocalised": str(row.get("Category_Localised") or ""),
                "meanPrice": row.get("MeanPrice", 0),
                "buyPrice": row.get("BuyPrice", 0),
                "sellPrice": row.get("SellPrice", 0),
                "supply": row.get("Stock", 0),
                "demand": row.get("Demand", 0),
            }
        )

    if not commodities:
        return None

    return {
        "version": 1,
        "kind": "market",
        "event": "Market",
        "timestamp": timestamp,
        "system": system_name,
        "systemName": system_name,
        "systemAddress": entry.get("SystemAddress", _last_system_address),
        "starPos": entry.get("StarPos", _last_star_pos),
        "station": station_name,
        "stationName": station_name,
        "stationType": str(entry.get("StationType") or ""),
        "marketId": market_id,
        "carrierDockingAccess": str(entry.get("CarrierDockingAccess") or ""),
        "commodities": commodities,
    }


def _build_payload(entry: Mapping[str, Any], fallback_system: str) -> Optional[dict[str, Any]]:
    system_name = str(entry.get("StarSystem") or fallback_system or "").strip()
    timestamp = str(entry.get("timestamp") or "").strip()
    if not system_name or not timestamp:
        return None

    factions = []
    for row in entry.get("Factions") or []:
        if not isinstance(row, Mapping):
            continue
        name = str(row.get("Name") or "").strip()
        if not name:
            continue
        factions.append(
            {
                "name": name,
                "influence": row.get("Influence"),
                "state": str(row.get("FactionState") or "None"),
                "activeStates": _state_names(row.get("ActiveStates")),
                "pendingStates": _state_names(row.get("PendingStates")),
                "recoveringStates": _state_names(row.get("RecoveringStates")),
                "happiness": str(row.get("Happiness") or ""),
            }
        )

    conflicts = []
    for row in entry.get("Conflicts") or []:
        if not isinstance(row, Mapping):
            continue
        one = _conflict_side(row.get("Faction1"))
        two = _conflict_side(row.get("Faction2"))
        if one and two:
            conflicts.append(
                {
                    "type": str(row.get("WarType") or ""),
                    "status": str(row.get("Status") or ""),
                    "faction1": one,
                    "faction2": two,
                }
            )

    system_faction = entry.get("SystemFaction")
    if not isinstance(system_faction, Mapping):
        system_faction = {}

    return {
        "version": 1,
        "event": str(entry.get("event") or ""),
        "timestamp": timestamp,
        "system": system_name,
        "systemAddress": entry.get("SystemAddress"),
        "starPos": entry.get("StarPos"),
        "systemFaction": {
            "name": str(system_faction.get("Name") or ""),
            "state": str(system_faction.get("FactionState") or ""),
        },
        "security": str(entry.get("SystemSecurity") or ""),
        "population": entry.get("Population"),
        "factions": factions,
        "conflicts": conflicts,
    }


def _state_names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, Mapping):
            state = str(item.get("State") or "").strip()
        else:
            state = str(item or "").strip()
        if state:
            out.append(state)
    return out


def _conflict_side(value: Any) -> Optional[dict[str, Any]]:
    if not isinstance(value, Mapping):
        return None
    name = str(value.get("Name") or "").strip()
    if not name:
        return None
    return {
        "name": name,
        "stake": str(value.get("Stake") or ""),
        "wonDays": value.get("WonDays", 0),
    }


def _contains_mongrels(factions: list[Any]) -> bool:
    for row in factions:
        if isinstance(row, Mapping) and str(row.get("Name") or "").strip().casefold() == MONGREL.casefold():
            return True
    return False


def _restore_activity_mission_origins() -> None:
    global _activity_mission_origins
    try:
        raw = config.get_str(KEY_ACTIVITY_MISSION_ORIGINS) or ""
        parsed = json.loads(raw) if raw else {}
    except Exception:
        parsed = {}
    restored: dict[str, dict[str, Any]] = {}
    if isinstance(parsed, Mapping):
        for mission_id, row in list(parsed.items())[-128:]:
            if not isinstance(row, Mapping):
                continue
            origin_system = str(row.get("originSystem") or "").strip()[:140]
            if not origin_system:
                continue
            restored[str(mission_id)] = {
                "missionId": str(row.get("missionId") or mission_id),
                "acceptedAt": str(row.get("acceptedAt") or "").strip()[:80],
                "originSystem": origin_system,
                "originSystemAddress": _decimal_text(row.get("originSystemAddress")),
                "originStation": str(row.get("originStation") or "").strip()[:140],
                "sourceFaction": str(row.get("sourceFaction") or "").strip()[:120],
                "destinationSystem": str(row.get("destinationSystem") or "").strip()[:140],
                "destinationStation": str(row.get("destinationStation") or "").strip()[:140],
            }
    with _activity_lock:
        _activity_mission_origins = restored


def _save_activity_mission_origins() -> None:
    try:
        with _activity_lock:
            rows = list(_activity_mission_origins.items())
            rows.sort(key=lambda item: str(item[1].get("acceptedAt") or ""))
            compact = dict(rows[-128:])
        config.set(KEY_ACTIVITY_MISSION_ORIGINS, json.dumps(compact, separators=(",", ":")))
    except Exception:
        pass


def _remember_activity_mission_origin(
    entry: Mapping[str, Any],
    fallback_system: str,
    fallback_station: str,
    state: Mapping[str, Any],
) -> None:
    mission_id = _optional_int(entry.get("MissionID"))
    if mission_id is None:
        return
    origin_system = str(
        entry.get("StarSystem")
        or state.get("SystemName")
        or fallback_system
        or _last_system_name
        or ""
    ).strip()
    if not origin_system:
        return
    origin_address = _decimal_text(
        entry.get("SystemAddress", state.get("SystemAddress", _last_system_address))
    )
    origin_station = str(
        entry.get("StationName")
        or fallback_station
        or state.get("StationName")
        or ""
    ).strip()
    row = {
        "missionId": str(mission_id),
        "acceptedAt": str(entry.get("timestamp") or "").strip()[:80],
        "originSystem": origin_system[:140],
        "originSystemAddress": origin_address,
        "originStation": origin_station[:140],
        "sourceFaction": str(entry.get("Faction") or "").strip()[:120],
        "destinationSystem": str(entry.get("DestinationSystem") or "").strip()[:140],
        "destinationStation": str(entry.get("DestinationStation") or "").strip()[:140],
    }
    with _activity_lock:
        _activity_mission_origins[str(mission_id)] = row
        if len(_activity_mission_origins) > 160:
            oldest = sorted(
                _activity_mission_origins,
                key=lambda key: str(_activity_mission_origins[key].get("acceptedAt") or ""),
            )[:32]
            for key in oldest:
                _activity_mission_origins.pop(key, None)
    _save_activity_mission_origins()


def _station_faction_name(entry: Mapping[str, Any], state: Mapping[str, Any]) -> str:
    value = entry.get("StationFaction", state.get("StationFaction"))
    if isinstance(value, Mapping):
        value = value.get("Name")
    return str(value or "").strip()[:120]


def _activity_influence_rows(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in value[:16]:
        if not isinstance(item, Mapping):
            continue
        rows.append(
            {
                "SystemAddress": _decimal_text(item.get("SystemAddress")),
                "Influence": str(item.get("Influence") or "").strip()[:16],
            }
        )
    return rows


def _build_realtime_activity_payload(
    entry: Mapping[str, Any],
    state: Mapping[str, Any],
    fallback_system: str,
    fallback_station: str,
) -> Optional[dict[str, Any]]:
    event = str(entry.get("event") or "").strip()
    if event not in {
        "MissionCompleted",
        "RedeemVoucher",
        "ColonisationContribution",
        "ColonisationConstructionDepot",
    }:
        return None

    timestamp = str(entry.get("timestamp") or "").strip()
    system_name = str(
        entry.get("StarSystem")
        or state.get("SystemName")
        or fallback_system
        or _last_system_name
        or ""
    ).strip()
    system_address = _decimal_text(
        entry.get("SystemAddress", state.get("SystemAddress", _last_system_address))
    )
    station_name = str(entry.get("StationName") or fallback_station or state.get("StationName") or "").strip()
    station_type = str(entry.get("StationType") or state.get("StationType") or "").strip()
    if not timestamp:
        return None

    base: dict[str, Any] = {
        "event": event,
        "timestamp": timestamp,
        "system": system_name,
        "systemAddress": system_address,
        "station": station_name,
        "stationType": station_type,
        "stationFaction": _station_faction_name(entry, state),
    }

    if event == "MissionCompleted":
        mission_id = _optional_int(entry.get("MissionID"))
        if mission_id is None:
            return None
        with _activity_lock:
            origin = dict(_activity_mission_origins.get(str(mission_id)) or {})
        effects: list[dict[str, Any]] = []
        for effect in (entry.get("FactionEffects") or [])[:16]:
            if not isinstance(effect, Mapping):
                continue
            effects.append(
                {
                    "Faction": str(effect.get("Faction") or "").strip()[:120],
                    "Reputation": str(effect.get("Reputation") or "").strip()[:16],
                    "Influence": _activity_influence_rows(effect.get("Influence")),
                }
            )
        if not effects:
            return None
        return {
            **base,
            "missionId": mission_id,
            "faction": str(entry.get("Faction") or "").strip()[:120],
            "destinationSystem": str(entry.get("DestinationSystem") or "").strip()[:140],
            "missionOrigin": origin or None,
            "factionEffects": effects,
        }

    if event == "RedeemVoucher":
        voucher_type = str(entry.get("Type") or "").strip().lower()
        if voucher_type not in {"bounty", "combatbond"}:
            return None
        factions = []
        for row in (entry.get("Factions") or [])[:20]:
            if not isinstance(row, Mapping):
                continue
            factions.append(
                {
                    "Faction": str(row.get("Faction") or "").strip()[:120],
                    "Amount": row.get("Amount", 0),
                }
            )
        return {
            **base,
            "voucherType": voucher_type,
            "amount": entry.get("Amount", 0),
            "faction": str(entry.get("Faction") or "").strip()[:120],
            "factions": factions,
        }

    if event == "ColonisationContribution":
        contributions = []
        for row in (entry.get("Contributions") or [])[:64]:
            if not isinstance(row, Mapping):
                continue
            contributions.append(
                {
                    "Name": str(row.get("Name") or "").strip()[:120],
                    "Name_Localised": str(row.get("Name_Localised") or "").strip()[:120],
                    "Amount": row.get("Amount", 0),
                }
            )
        if not contributions:
            return None
        return {
            **base,
            "marketId": _decimal_text(entry.get("MarketID")),
            "contributions": contributions,
        }

    resources = []
    for row in (entry.get("ResourcesRequired") or [])[:96]:
        if not isinstance(row, Mapping):
            continue
        resources.append(
            {
                "Name": str(row.get("Name") or "").strip()[:120],
                "Name_Localised": str(row.get("Name_Localised") or "").strip()[:120],
                "RequiredAmount": row.get("RequiredAmount", 0),
                "ProvidedAmount": row.get("ProvidedAmount", 0),
                "Payment": row.get("Payment", 0),
            }
        )
    return {
        **base,
        "marketId": _decimal_text(entry.get("MarketID")),
        "constructionProgress": entry.get("ConstructionProgress", 0),
        "constructionComplete": bool(entry.get("ConstructionComplete")),
        "constructionFailed": bool(entry.get("ConstructionFailed")),
        "resourcesRequired": resources,
    }


def _activity_fingerprint(payload: Mapping[str, Any]) -> str:
    try:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    except Exception:
        return repr(payload)


def _queue_realtime_activity(payload: dict[str, Any]) -> None:
    global _activity_flush_scheduled
    fingerprint = _activity_fingerprint(payload)
    with _activity_lock:
        if fingerprint in _activity_pending_fingerprints:
            return
        _activity_pending.append(dict(payload))
        _activity_pending_fingerprints.add(fingerprint)
        if _activity_flush_scheduled:
            return
        _activity_flush_scheduled = True
    threading.Thread(
        target=_activity_flush_worker,
        name="MongrelScoutActivityBatch",
        daemon=True,
    ).start()


def _activity_endpoint(base_endpoint: str) -> str:
    value = str(base_endpoint or DEFAULT_ENDPOINT).strip()
    if not value:
        return DEFAULT_ACTIVITY_ENDPOINT
    try:
        parsed = urlparse(value)
        path = parsed.path or ""
        if path.endswith("/scout-ingest"):
            path = path[: -len("/scout-ingest")] + "/scout-activity"
            return parsed._replace(path=path, query="", fragment="").geturl()
    except Exception:
        pass
    return DEFAULT_ACTIVITY_ENDPOINT


def _activity_flush_worker() -> None:
    global _activity_flush_scheduled
    time.sleep(ACTIVITY_BATCH_DELAY_SECONDS)
    while True:
        with _activity_lock:
            if not _activity_pending:
                _activity_flush_scheduled = False
                return
            batch = [dict(row) for row in _activity_pending[:ACTIVITY_BATCH_MAX]]
            fingerprints = [_activity_fingerprint(row) for row in batch]
            del _activity_pending[: len(batch)]
            for fingerprint in fingerprints:
                _activity_pending_fingerprints.discard(fingerprint)

        token = (config.get_str(KEY_TOKEN) or "").strip()
        if not token:
            with _activity_lock:
                _activity_flush_scheduled = False
            return
        endpoint = _activity_endpoint(config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT)
        success, retryable = _send_activity_batch(endpoint, token, batch)
        if success:
            continue
        if not retryable:
            continue

        with _activity_lock:
            existing = {_activity_fingerprint(row) for row in _activity_pending}
            restore = [row for row in batch if _activity_fingerprint(row) not in existing]
            _activity_pending[0:0] = restore
            _activity_pending_fingerprints.update(_activity_fingerprint(row) for row in restore)
        time.sleep(ACTIVITY_RETRY_SECONDS)


def _send_activity_batch(endpoint: str, token: str, events: list[dict[str, Any]]) -> tuple[bool, bool]:
    if not events:
        return True, False
    payload = {
        "version": 1,
        "kind": "activity_batch",
        "events": events[:ACTIVITY_BATCH_MAX],
    }
    with _send_lock:
        try:
            response = _session.post(
                endpoint,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "User-Agent": f"{_session.headers.get('User-Agent', 'EDMarketConnector')} MongrelScout/{PLUGIN_VERSION}",
                },
            )
        except Exception:
            return False, True

    if 200 <= response.status_code < 300:
        return True, False
    try:
        detail = str(response.json().get("error") or "")
    except Exception:
        detail = ""
    if response.status_code == 401:
        _set_status("Realtime activity token rejected")
        return False, False
    if response.status_code == 403 and detail == "scout_owner_not_bound":
        _set_status("Realtime activity needs a bound Scout owner")
        return False, False
    if response.status_code == 429:
        _set_status("Scout rate limit reached")
        return False, True
    if response.status_code >= 500:
        return False, True
    _set_status(f"Realtime activity upload failed ({response.status_code})")
    return False, False


def _send_snapshot(endpoint: str, token: str, payload: dict[str, Any]) -> None:
    # EDMC recommends network work off the main Tk thread. The lock prevents
    # startup/location journal bursts from creating overlapping uploads.
    with _send_lock:
        try:
            response = _session.post(
                endpoint,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "User-Agent": f"{_session.headers.get('User-Agent', 'EDMarketConnector')} MongrelScout/{PLUGIN_VERSION}",
                },
            )
            if 200 <= response.status_code < 300:
                try:
                    result = response.json()
                except Exception:
                    result = {}
                if payload.get("kind") == "market":
                    station_name = str(payload.get("stationName") or "station")
                    if result.get("stored") is False:
                        _set_status(f"Market already newer: {station_name}")
                    else:
                        _set_status(f"Market updated: {station_name}")
                elif payload.get("kind") == "facility":
                    facility_name = str(payload.get("facilityName") or "facility")
                    if result.get("stored") is False:
                        _set_status(f"Facility already mapped: {facility_name}")
                    else:
                        _set_status(f"Facility mapped: {facility_name}")
                elif payload.get("kind") == "facility_visit":
                    station_name = str(payload.get("stationName") or "station")
                    if result.get("hostResolved") is True:
                        body_name = str(result.get("hostBodyName") or result.get("hostBodyId") or "host")
                        _set_status(f"Host verified: {station_name} → {body_name}")
                    else:
                        _set_status(f"Station context recorded: {station_name}")
                elif payload.get("kind") == "facility_host":
                    facility_name = str(payload.get("facilityName") or "station")
                    _set_status(f"Host candidate quarantined: {facility_name}")
                elif result.get("stored") is False:
                    _set_status(f"Already newer: {payload['system']}")
                else:
                    _set_status(f"Updated {payload['system']}")
                return
            try:
                detail = response.json().get("error", "")
            except Exception:
                detail = ""
            if response.status_code == 401:
                _set_status("Token rejected")
            elif response.status_code == 403 and detail == "system_not_authorized":
                _set_status(f"Not assigned: {payload['system']}")
            elif response.status_code == 429 and detail == "scout_rate_limit_reached":
                _set_status("Scout rate limit reached")
            elif response.status_code == 422 and detail == "mongrels_not_present":
                _set_status("Skipped — Mongrels absent")
            else:
                kind = str(payload.get("kind") or "bgs").strip().lower()
                label = {
                    "market": "Market upload",
                    "facility": "Facility upload",
                    "facility_visit": "Station context",
                    "facility_host": "Station host",
                    "bgs": "BGS upload",
                }.get(kind, "BGS upload")
                detail_text = str(detail or "").strip()
                suffix = f": {detail_text}" if detail_text else ""
                _set_status(f"{label} failed ({response.status_code}){suffix}")
        except Exception as exc:
            message = str(exc or "").strip()
            suffix = f": {message[:80]}" if message else ""
            _set_status(f"Upload failed — network{suffix}")


def _initial_status() -> str:
    if not config.get_bool(KEY_ENABLED):
        return "Disabled"
    if not (config.get_str(KEY_TOKEN) or "").strip():
        return "Needs scout token"
    if _hud_error:
        return "Armed · HUD bridge unavailable"
    return "Armed"


def _set_status(text: str) -> None:
    # Tk itself is not thread-safe. EDMC's plugin guide recommends event_generate()
    # to signal back to the main loop from a worker thread.
    global _pending_status
    with _status_lock:
        _pending_status = text
    label = _status_label
    if label is None:
        return
    try:
        label.event_generate("<<MongrelScoutStatus>>", when="tail")
    except Exception:
        pass


def _on_status_event(event: Any) -> None:
    label = _status_label
    if label is None:
        return
    with _status_lock:
        text = _pending_status
    if text:
        try:
            label.config(text=text)
        except Exception:
            pass
