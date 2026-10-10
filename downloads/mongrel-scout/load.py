from __future__ import annotations

import json
import math
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
PLUGIN_VERSION = "1.13.3"
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
SCOUT_LINK_INGEST_ENDPOINT = "https://mongrels-squadron.pages.dev/api/scout-link/ingest"
SCOUT_LINK_MIN_INTERVAL_SECONDS = 120.0
HUD_MINING_REPORT_ENDPOINT = "https://ten16-archive.pages.dev/api/hud/mining-report"
HUD_MINING_CENTER_ENDPOINT = "https://ten16-archive.pages.dev/api/hud/mining-center"
HUD_ROUTE_CONTROL_PATH = "/api/hud/route"
HUD_MINING_DATA_ENDPOINT = "https://ten16-archive.pages.dev/api/mining"
HUD_MINING_CENTERS_ENDPOINT = "https://ten16-archive.pages.dev/api/mining-centers"
HUD_MINING_SYSTEMS_ENDPOINT = "https://ten16-archive.pages.dev/api/mining-systems"
HUD_MINING_HEALTH_ENDPOINT = "https://ten16-archive.pages.dev/api/hud/mining-multi-health"
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
KEY_SCOUT_LINK_ENABLED = "MongrelScoutChatGPTLinkEnabled"
KEY_NAV_AUTO_COPY = "MongrelScoutRouteAutoCopy"
KEY_NAV_CHECKPOINT = "MongrelScoutRouteCheckpoint"
KEY_NAV_COMPLETED = "MongrelScoutRouteLastCompletion"
KEY_CARGO_MISSIONS = "MongrelScoutCargoMissionCache"
KEY_CARGO_PRIORITY = "MongrelScoutCargoPriorityFaction"
KEY_ACTIVITY_MISSION_ORIGINS = "MongrelScoutActivityMissionOrigins"
KEY_ACTIVITY_TRADE_PROVENANCE = "MongrelScoutActivityTradeProvenance"

_status_label: Optional[tk.Label] = None
_enabled_var: Optional[tk.IntVar] = None
_token_var: Optional[tk.StringVar] = None
_endpoint_var: Optional[tk.StringVar] = None
_scout_link_var: Optional[tk.IntVar] = None
_nav_auto_copy_var: Optional[tk.IntVar] = None
_nav_id = ""
_nav_index = 0
_nav_copied = ""
_nav_pending = ""
_nav_completion_pending = ""
_scout_link_send_lock = threading.Lock()
_scout_link_last_sent = 0.0
_scout_link_last_attempt = 0.0
_scout_link_last_signature = ""
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
_activity_trade_sale_ordinals: dict[str, int] = {}
_activity_exploration_sale_ordinals: dict[str, int] = {}
_activity_flush_scheduled = False
_activity_mission_origins: dict[str, dict[str, Any]] = {}
_activity_trade_lots: dict[str, dict[str, list[dict[str, Any]]]] = {}
_activity_trade_station: dict[str, Any] = {}
_activity_trade_commander = ""
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
    "ship": {"name": "", "ident": "", "type": "", "maxJumpRange": None, "currentJumpRange": None, "unladenMass": None, "cargoCapacity": None, "fuelCapacity": None, "fuelReserveCapacity": None, "fuelScoopInstalled": None, "jumpModel": None, "currentMass": None, "hullHealth": None, "shieldsUp": None, "timestamp": None},
    "tradeActivity": {"status": "waiting", "reason": "no_sale_observed", "timestamp": None},
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
    _restore_activity_trade_provenance()
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
    global _enabled_var, _token_var, _endpoint_var, _scout_link_var, _nav_auto_copy_var

    _enabled_var = tk.IntVar(value=1 if config.get_bool(KEY_ENABLED) else 0)
    _token_var = tk.StringVar(value=config.get_str(KEY_TOKEN) or "")
    _endpoint_var = tk.StringVar(value=config.get_str(KEY_ENDPOINT) or DEFAULT_ENDPOINT)
    _scout_link_var = tk.IntVar(value=1 if config.get_bool(KEY_SCOUT_LINK_ENABLED) else 0)
    _nav_auto_copy_var = tk.IntVar(value=1 if config.get_int(KEY_NAV_AUTO_COPY) != -1 else 0)

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

    nb.Checkbutton(frame, text="Share minimal ship status with my private ChatGPT Scout Link (opt-in)", variable=_scout_link_var).grid(row=4, column=0, columnspan=2, sticky=tk.W, pady=(10, 2))

    nb.Checkbutton(frame, text="Automatically copy next system after confirmed route waypoint (default on)", variable=_nav_auto_copy_var).grid(row=5, column=0, columnspan=2, sticky=tk.W, pady=(2, 2))

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
        "the token itself is never exposed through the local HUD bridge. Personal HUD notes stay local on the PC. "
        "Optional ChatGPT Scout Link publishes only system, ship name/type, jump model, fuel and cargo totals, "
        "jump range, and timestamps to a private admin-only snapshot; it does not publish your full loadout, "
        "journal, coordinates, trade activity, or mission inventory. Disable the checkbox to stop publishing."
    )
    nb.Label(frame, text=privacy, wraplength=520, justify=tk.LEFT).grid(
        row=6, column=0, columnspan=2, sticky=tk.W, pady=(10, 4)
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
    if _scout_link_var is not None:
        config.set(KEY_SCOUT_LINK_ENABLED, int(_scout_link_var.get()))
    if _nav_auto_copy_var is not None:
        config.set(KEY_NAV_AUTO_COPY, 1 if _nav_auto_copy_var.get() else -1)
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
    if _nav_id and bool((_hud_state.get("navigation") or {}).get("refuelPending")):
        _refresh_route_navigation()


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

    # On-demand recovery only when the live ledger cannot prove the sale's origin.
    # This never uploads or queues historical journal events themselves.
    if event == "MarketSell":
        _restore_trade_origin_for_sale(cmdr, entry, state)
    trade_sale = _observe_activity_trade(cmdr, entry, state, system, station)
    activity_payload = _build_realtime_activity_payload(entry, state, system, station, trade_sale)
    if event == "MarketSell":
        _update_trade_activity_status(entry, trade_sale, activity_payload, bool(token))
    if event == "MarketSell" and activity_payload is not None:
        # Assign an occurrence before queuing so identical eight-second-batch
        # sale chunks do not collapse into one pending payload.
        activity_payload["saleOrdinal"] = _next_trade_sale_ordinal(cmdr, activity_payload)
    if event in {"SellExplorationData", "MultiSellExplorationData"} and activity_payload is not None:
        activity_payload["saleOrdinal"] = _next_exploration_sale_ordinal(cmdr, activity_payload)
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
        incoming_name = str(state.get("ShipName") or "").strip()
        incoming_ident = str(state.get("ShipIdent") or "").strip()
        if (incoming_name and ship.get("name") and incoming_name.casefold()!=str(ship.get("name")).casefold()) or (
                incoming_ident and ship.get("ident") and incoming_ident.casefold()!=str(ship.get("ident")).casefold()):
            # Never use the previous ship's FSD/tank/fuel scoop for a new hull.
            for key in ("jumpModel","fuelReserveCapacity","fuelScoopInstalled","fuelCapacity"):
                ship.pop(key,None)
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
            updates["fuelReserveCapacity"] = _optional_float(fuel_capacity.get("Reserve"))
        for key, value in updates.items():
            if value is not None and (not isinstance(value, str) or value):
                ship[key] = value
        cached_modules = state.get("Modules")
        if isinstance(cached_modules, Mapping):
            ship["fuelScoopInstalled"] = _fuel_scoop_installed({"Modules": cached_modules})
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

        if parsed.path == "/v1/route":
            route_id = str((parse_qs(parsed.query).get("routeId") or [""])[0])[:90]
            result = _hud_route_control("read", route_id)
            self._write_json(result, status=_hud_proxy_status(result))
            return

        if parsed.path == "/v1/mining/health":
            result = _fetch_hud_mining_health()
            self._write_json(result, status=_hud_proxy_status(result))
            return

        if parsed.path == "/v1/mining/systems":
            result = _fetch_hud_mining_directory(HUD_MINING_SYSTEMS_ENDPOINT)
            self._write_json(result, status=_hud_proxy_status(result))
            return

        if parsed.path in {"/v1/mining/data", "/v1/mining/centers"}:
            endpoint = HUD_MINING_DATA_ENDPOINT if parsed.path.endswith("/data") else HUD_MINING_CENTERS_ENDPOINT
            requested = parse_qs(parsed.query).get("systemAddress", [])
            if requested:
                address = str(requested[0] or "").strip()
                # Never forward arbitrary query strings or allow external URLs.
                # Current 10-16 clients retain their unchanged URLs.
                if not re.fullmatch(r"[0-9]{1,20}", address):
                    self._write_json({"ok": False, "error": "invalid_system_address"}, status=400)
                    return
                endpoint += "?" + urlencode({"systemAddress": address})
            result = _fetch_hud_mining_resource(endpoint)
            self._write_json(result, status=_hud_proxy_status(result))
            return

        self._write_json({"ok": False, "error": "not_found"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/v1/site-feed/ack", "/v1/mining/report", "/v1/mining/center", "/v1/cargo-priority", "/v1/route"}:
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

        if parsed.path == "/v1/route":
            # A cross-origin browser cannot supply this custom header without
            # a CORS preflight, which our loopback bridge does not permit.
            # Only the paired HUD's local Python proxy sends this route action.
            if (self.headers.get("X-Mongrel-HUD-Route-Action") != "1"
                or "application/json" not in self.headers.get("Content-Type", "").lower()
                or self.headers.get("Origin")):
                self._write_json({"ok": False, "error": "route_local_control_required"}, status=403)
                return
            action = str(body.get("action") or "")
            route_id = str(body.get("routeId") or "")[:90]
            result = _hud_route_control(action, route_id,
                                        destination=str(body.get("destination") or "")[:140],
                                        efficiency=body.get("efficiency", 60),
                                        mode=str(body.get("mode") or "neutron")[:20],
                                        system=str(body.get("system") or "")[:140],
                                        ship=str(body.get("ship") or "")[:140])
            self._write_json(result, status=_hud_proxy_status(result))
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


def _hud_route_control(action: str, route_id: str = "", *, destination: str = "", efficiency: Any = 60, mode: str = "neutron", system: str = "", ship: str = "") -> dict[str, Any]:
    """On-demand route controls via the already paired HUD and Scout token.

    No new background polling. Never return the token or private site errors
    to iPad, and never accept an arbitrary upstream HTTP origin.
    """
    if action == "copy":
        # The paired HUD explicitly requests this on Serenity. No cloud write.
        return _refresh_route_navigation(force_copy=True)
    endpoint = _hud_site_manifest_endpoint().rsplit("/", 1)[0] + "/route"
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return {"ok": False, "error": "scout_token_missing"}
    if action not in {"read", "start", "stop", "plot", "check", "complete"}:
        return {"ok": False, "error": "invalid_action"}
    if action in {"read", "start", "check"} and route_id and not re.fullmatch(r"[0-9a-f-]{24,64}", route_id, re.I):
        return {"ok": False, "error": "invalid_route_id"}
    if action in {"start", "check"} and not route_id:
        return {"ok": False, "error": "route_id_required"}
    headers = _site_feed_headers(token)
    try:
        if action == "read":
            response = _session.get(endpoint, params={"routeId": route_id} if route_id else None,
                                    headers=headers, timeout=10)
        else:
            payload = {"action": action, "routeId": route_id}
            if action == "plot":
                payload["destination"] = destination
                payload["efficiency"] = efficiency
                payload["mode"] = mode
            if action == "complete":
                payload.update({"system": system, "ship": ship})
            response = _session.post(endpoint, json=payload, headers=headers, timeout=20)
        payload, details = _hud_response_details(response, endpoint)
        if not (200 <= response.status_code < 300):
            return _hud_http_failure(details)
        if not isinstance(payload, Mapping) or payload.get("ok") is not True:
            return _hud_http_failure(details, "invalid_route_response")
        if action in {"start", "stop", "complete"}:
            # One on-demand refresh, not a polling loop. Do not delay the HUD
            # acknowledgement while Cloudflare's feed is being fetched.
            # The normal manifest refresh still handles KV propagation.
            threading.Thread(
                target=_refresh_hud_site_feed_once,
                name="MongrelScoutRouteRefresh", daemon=True,
            ).start()
        return dict(payload)
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc)


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
        _refresh_route_navigation()
        return True
    except Exception as exc:
        failure = _hud_transport_failure(endpoint, exc)
        _set_site_feed_status(ok=False, error=failure["error"], details=failure)
        return False


def _route_checkpoint() -> dict[str, Any]:
    try:
        data = json.loads(config.get_str(KEY_NAV_CHECKPOINT) or "{}")
        return data if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}


def _save_route_checkpoint(route: Mapping[str, Any], ship: str, index: int, system: str) -> None:
    # Persist only confirmed waypoint progress. No route geometry, journal, or
    # location history is uploaded or written to the checkpoint.
    config.set(KEY_NAV_CHECKPOINT, json.dumps({
        "routeId": str(route.get("id") or ""),
        "activation": str(route.get("activatedAt") or ""),
        "ship": ship, "index": index, "waypoint": system,
        "arrivedAt": str((_hud_state.get("lastEvent") or {}).get("timestamp") or ""),
    }, separators=(",", ":")))


def _last_route_completion() -> dict[str, Any] | None:
    try:
        completion = json.loads(config.get_str(KEY_NAV_COMPLETED) or "{}")
        if isinstance(completion, dict) and 0 <= time.time() - float(completion.get("timestamp") or 0) < 600:
            return completion
    except (ValueError, TypeError, OverflowError):
        pass
    return None


def _complete_route_remote(route_id: str, ship: str, system: str) -> None:
    # One event-driven request on arrival. A failed request never affects
    # local completion or the existing Scout clipboard behavior.
    _hud_route_control("complete", route_id, system=system, ship=ship)


def _refresh_route_navigation(force_copy: bool = False) -> dict[str, Any]:
    """Advance ONLY on the next confirmed waypoint; preserve progress on EDMC
    restart; explicitly re-copy without writing to Cloudflare.

    The checkpoint is keyed by route ID + activation + ship. A copied system
    is still a Galaxy Map target, never an instruction to operate Elite.
    """
    global _nav_id, _nav_index, _nav_copied, _nav_pending, _nav_completion_pending
    with _hud_condition:
        feed = _hud_state.get("siteFeed")
        route = feed.get("navigationRoute") if isinstance(feed, Mapping) else None
        current = str((_hud_state.get("system") or {}).get("name") or "").strip()
        ship = str((_hud_state.get("ship") or {}).get("name") or "").strip()
        if not isinstance(route, Mapping) or not route.get("autoCopy"):
            # Do not erase a saved checkpoint just because the cloud feed has
            # not loaded on startup. Clear it only after a real inactive feed.
            if isinstance(feed, Mapping):
                if _nav_id or _route_checkpoint():
                    config.set(KEY_NAV_CHECKPOINT, "")
                _nav_id, _nav_index, _nav_copied, _nav_pending = "", 0, "", ""
                _nav_completion_pending = ""
            completed = _last_route_completion()
            _hud_state["navigation"] = ({"active": False, "completed": True, **completed}
                                          if completed else None)
            return {"ok": False, "error": "route_not_active"} if force_copy else {"ok": True}
        route_id = str(route.get("id") or "")
        waypoints = route.get("waypoints")
        if not route_id or not isinstance(waypoints, list) or len(waypoints) > 512 or not waypoints:
            return {"ok": False, "error": "route_invalid"}
        if str(route.get("ship") or "").casefold() != ship.casefold() or not current:
            _hud_state["navigation"] = {"active": False, "reason": "ship_or_location_unavailable"}
            return {"ok": False, "error": "ship_or_location_unavailable"}
        names = [str(w.get("system") or "").strip() if isinstance(w, Mapping) else "" for w in waypoints]
        if not all(names):
            return {"ok": False, "error": "route_invalid"}
        if _nav_id != route_id:
            saved = _route_checkpoint()
            valid = (
                saved.get("routeId") == route_id
                and saved.get("activation") == str(route.get("activatedAt") or "")
                and str(saved.get("ship") or "").casefold() == ship.casefold()
                and type(saved.get("index")) is int
                and 0 <= saved["index"] < len(names)
                and saved.get("waypoint") == names[saved["index"]]
            )
            if valid:
                start = saved["index"]
            else:
                start = next((i for i, name in enumerate(names) if name.casefold() == current.casefold()), -1)
            if start < 0:
                _hud_state["navigation"] = {
                    "active": False, "reason": "off_route_without_checkpoint", "routeId": route_id,
                }
                return {"ok": False, "error": "route_off_route_replot_required"}
            _nav_id, _nav_index, _nav_copied, _nav_pending = route_id, start, "", ""
            config.set(KEY_NAV_COMPLETED, "")
            _save_route_checkpoint(route, ship, start, names[start])
        if _nav_index + 1 < len(names) and names[_nav_index + 1].casefold() == current.casefold():
            _nav_index += 1
            _save_route_checkpoint(route, ship, _nav_index, names[_nav_index])
        next_system = names[_nav_index + 1] if _nav_index + 1 < len(names) else ""
        completed = not next_system and current.casefold() == names[-1].casefold()
        remaining = len(names) - _nav_index - 1
        exact = str(route.get("routeType") or "") == "galaxy_exact_jumps"
        fuel_stop = exact and isinstance(waypoints[_nav_index], Mapping) and waypoints[_nav_index].get("fuelStop") is True
        current_fuel = _optional_float((_hud_state.get("status") or {}).get("fuelMain"))
        full_fuel = _optional_float((_hud_state.get("ship") or {}).get("fuelCapacity"))
        # A planned Spansh refuel stop assumes departure with a full tank.
        # Don't silently copy the next jump until Status.json confirms it.
        arrival_stamp = str(_route_checkpoint().get("arrivedAt") or "")
        status_stamp = str((_hud_state.get("status") or {}).get("timestamp") or "")
        # A pre-arrival Status.json can still show full fuel. Require a NEW
        # post-arrival observation before unlocking a scheduled scoop stop.
        # Frontier journal and Status.json use UTC ISO timestamps.
        fresh_fuel_observation = bool(arrival_stamp and status_stamp
            and status_stamp.replace("Z","+00:00") > arrival_stamp.replace("Z","+00:00"))
        refuel_pending = bool(fuel_stop and (
            current_fuel is None or full_fuel is None
            or current_fuel < full_fuel - 0.05
            or not fresh_fuel_observation
        ))
        future_jumps = [
            row.get("estimatedJumpsFromPrevious") if isinstance(row, Mapping) else None
            for row in waypoints[_nav_index + 1:]
        ]
        remaining_jumps = (sum(future_jumps) if future_jumps
                           and all(type(n) is int and n >= 0 for n in future_jumps) else None)
        progress = {
            "active": bool(next_system), "completed": completed,
            "routeId": route_id, "destination": str(route.get("destination") or ""),
            "waypointIndex": _nav_index, "waypointCount": len(names),
            "completedTargets": _nav_index,
            "remainingTargets": remaining,
            "navigationTargetCount": max(0, len(names) - 1),
            "routeType": str(route.get("routeType") or "neutron_replot_waypoints"),
            "estimatedTotalJumps": route.get("estimatedTotalJumps"),
            "estimatedRemainingJumps": remaining_jumps,
            "currentSystem": current,
            "previousWaypoint": names[_nav_index],
            "nextSystem": next_system,
            "autoCopyEnabled": config.get_int(KEY_NAV_AUTO_COPY) != -1,
            "refuelPending": refuel_pending,
            "scheduledFuelStops": sum(isinstance(w, Mapping) and w.get("fuelStop") is True for w in waypoints) if exact else None,
            "nextFuelStop": next((str(w.get("system") or "") for w in waypoints[_nav_index + 1:] if isinstance(w, Mapping) and w.get("fuelStop") is True), "") if exact else "",
        }
        _hud_state["navigation"] = progress
        _hud_condition.notify_all()
        if completed:
            if _nav_completion_pending != route_id:
                _nav_completion_pending = route_id
                completion = {
                    "routeId": route_id, "destination": progress["destination"],
                    "waypointIndex": _nav_index, "waypointCount": len(names),
                    "completedTargets": _nav_index, "remainingTargets": 0,
                    "timestamp": time.time(),
                }
                config.set(KEY_NAV_COMPLETED, json.dumps(completion, separators=(",", ":")))
                threading.Thread(
                    target=_complete_route_remote,
                    args=(route_id, ship, current),
                    name="MongrelScoutRouteCompleted", daemon=True,
                ).start()
            return {"ok": False, "error": "route_complete"} if force_copy else {"ok": True, "completed": True}
        if refuel_pending:
            return {"ok": False, "error": "refuel_before_next_jump"} if force_copy else {"ok": True, "refuelPending": True}
        marker = f"{route_id}:{_nav_index}:{next_system}"
        if force_copy:
            # A paired user's explicit press may re-copy the current waypoint.
            # It does not automatically change the saved route or waypoint index.
            _nav_copied = ""
        if ((config.get_int(KEY_NAV_AUTO_COPY) == -1 and not force_copy)
                or marker in {_nav_copied, _nav_pending}):
            return {"ok": False, "error": "copy_already_pending"} if force_copy else {"ok": True}
        _nav_pending = marker

    widget = _status_label
    if widget is None:
        with _hud_condition:
            if _nav_pending == marker:
                _nav_pending = ""
        return {"ok": False, "error": "clipboard_unavailable"}

    def _copy() -> None:
        global _nav_copied, _nav_pending
        try:
            with _hud_condition:
                feed = _hud_state.get("siteFeed")
                active = feed.get("navigationRoute") if isinstance(feed, Mapping) else None
                current_ship = str((_hud_state.get("ship") or {}).get("name") or "").strip()
                if (not isinstance(active, Mapping)
                        or not active.get("autoCopy")
                        or str(active.get("id") or "") != route_id
                        or current_ship.casefold() != ship.casefold()
                        or (config.get_int(KEY_NAV_AUTO_COPY) == -1 and not force_copy)
                        or _nav_index >= len(names) - 1
                        or marker != f"{route_id}:{_nav_index}:{next_system}"):
                    return
            widget.clipboard_clear()
            widget.clipboard_append(next_system)
            widget.update_idletasks()
            with _hud_condition:
                _nav_copied = marker
        except (tk.TclError, RuntimeError):
            pass
        finally:
            with _hud_condition:
                if _nav_pending == marker:
                    _nav_pending = ""

    try:
        widget.after(0, _copy)
    except (tk.TclError, RuntimeError):
        with _hud_condition:
            if _nav_pending == marker:
                _nav_pending = ""
        return {"ok": False, "error": "clipboard_unavailable"}
    return {"ok": True, "queued": True, "nextSystem": next_system}


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

        _schedule_optional_scout_link_upload()

        if _hud_site_feed_stop.wait(HUD_SITE_FEED_REFRESH_SECONDS):
            break


def _scout_link_payload() -> Optional[dict[str, Any]]:
    """Minimal whitelist: never serialize the local HUD state or full journal."""
    with _hud_condition:
        ship = dict(_hud_state.get("ship") or {})
        status = dict(_hud_state.get("status") or {})
        system = dict(_hud_state.get("system") or {})
    if not ship.get("name") or not system.get("name") or not isinstance(ship.get("jumpModel"), Mapping):
        return None
    observed_at = str(status.get("timestamp") or ship.get("timestamp") or "").strip()
    if not observed_at:
        return None
    try:
        from datetime import datetime, timezone
        observed = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        if observed.tzinfo is None or abs((datetime.now(timezone.utc) - observed).total_seconds()) > 600:
            return None
    except (ValueError, TypeError, OverflowError):
        return None
    model = ship["jumpModel"]
    return {
        "version": 1,
        "observedAt": observed_at,
        "system": str(system["name"]),
        "ship": str(ship["name"]),
        "shipType": str(ship.get("type") or ""),
        "currentJumpRange": ship.get("currentJumpRange"),
        "fuel": status.get("fuelMain"),
        "fuelCapacity": ship.get("fuelCapacity"),
        "fuelReserveCapacity": ship.get("fuelReserveCapacity"),
        "fuelScoopInstalled": ship.get("fuelScoopInstalled"),
        "cargo": status.get("cargo"),
        "unladenMass": ship.get("unladenMass"),
        "jumpModel": {
            "kind": model.get("kind"),
            "optimalMass": model.get("optimalMass"),
            "maxFuelPerJump": model.get("maxFuelPerJump"),
            "ratingConstant": model.get("ratingConstant"),
            "powerConstant": model.get("powerConstant"),
            "guardianBoost": model.get("guardianBoost"),
        },
    }


def _schedule_optional_scout_link_upload() -> None:
    global _scout_link_last_sent, _scout_link_last_attempt, _scout_link_last_signature
    if not config.get_bool(KEY_SCOUT_LINK_ENABLED):
        return
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return
    payload = _scout_link_payload()
    if payload is None:
        return
    # Throttle separately from the existing HUD polling. No extra site reads.
    # Retry at the next ordinary HUD loop on error; never block its refresh.
    signature = json.dumps(
        {key: value for key, value in payload.items() if key != "observedAt"},
        sort_keys=True, separators=(",", ":"),
    )
    now = time.monotonic()
    if not _scout_link_send_lock.acquire(blocking=False):
        return
    if now - _scout_link_last_attempt < 60.0:
        _scout_link_send_lock.release()
        return
    _scout_link_last_attempt = now
    if signature == _scout_link_last_signature and now - _scout_link_last_sent < SCOUT_LINK_MIN_INTERVAL_SECONDS:
        _scout_link_send_lock.release()
        return

    def _send() -> None:
        global _scout_link_last_sent, _scout_link_last_signature
        try:
            if not config.get_bool(KEY_SCOUT_LINK_ENABLED):
                return
            # Independent HTTP session: do not interfere with the normal HUD feed.
            link_session = timeout_session.new_session(timeout=6)
            response = link_session.post(
                SCOUT_LINK_INGEST_ENDPOINT,
                json=payload,
                headers={**_site_feed_headers(token), "Content-Type": "application/json"},
                timeout=6,
            )
            if response.ok:
                reply = response.json()
                if isinstance(reply, Mapping) and reply.get("ok") is True:
                    _scout_link_last_sent = time.monotonic()
                    _scout_link_last_signature = signature
        except Exception:
            # Optional telemetry must not interfere with HUD/Scout activity.
            pass
        finally:
            _scout_link_send_lock.release()

    threading.Thread(target=_send, name="MongrelScoutChatGPTLink", daemon=True).start()


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


def _fetch_hud_mining_health() -> dict[str, Any]:
    """One explicit owner request: no D1 writes, refresh loop or fallback data."""
    endpoint = HUD_MINING_HEALTH_ENDPOINT
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return {"ok": False, "error": "scout_token_missing"}
    try:
        response = _session.get(endpoint, headers=_site_feed_headers(token), timeout=12)
        payload, details = _hud_response_details(response, endpoint)
        if not 200 <= response.status_code < 300:
            return _hud_http_failure(details, str(payload.get("error") or "") if isinstance(payload, Mapping) else "")
        if not isinstance(payload, Mapping) or payload.get("ok") is not True:
            return {"ok": False, "error": "invalid_mining_health_response"}
        return {
            "ok": True,
            "dbBound": payload.get("dbBound") is True,
            "legacyReady": payload.get("legacyReady") is True,
            "multiSchemaReady": payload.get("multiSchemaReady") is True,
            "sharedOffSystemReady": payload.get("sharedOffSystemReady") is True,
            "backupVerified": None,
            "checkedAt": str(payload.get("checkedAt") or ""),
        }
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc)


def _fetch_hud_mining_directory(endpoint: str) -> dict[str, Any]:
    """Directory read only when HUD explicitly opens/refreshes mining browser."""
    try:
        response = _session.get(
            endpoint,
            headers={"Accept": "application/json", "User-Agent": "MongrelScout/mining-directory"},
            timeout=8,
        )
        payload, details = _hud_response_details(response, endpoint)
        if not 200 <= response.status_code < 300:
            return _hud_http_failure(details, f"http_{response.status_code}")
        if not isinstance(payload, Mapping) or payload.get("ok") is not True or not isinstance(payload.get("systems"), list):
            return {**details, "ok": False, "error": "invalid_mining_directory"}
        return {"ok": True, "systems": payload["systems"][:1000]}
    except Exception as exc:
        return _hud_transport_failure(endpoint, exc, mining_read=True)


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
    if str(entry.get("event") or "") == "FSDJump":
        _refresh_route_navigation()


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
            payload["fuelReserveCapacity"] = _optional_float(fuel_capacity.get("Reserve"))
        payload["fuelScoopInstalled"] = _fuel_scoop_installed(entry)
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
                ("fuelReserveCapacity", "fuelReserveCapacity"),
                ("fuelScoopInstalled", "fuelScoopInstalled"),
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


def _fuel_scoop_installed(entry: Mapping[str, Any]) -> Optional[bool]:
    modules = entry.get("Modules")
    if isinstance(modules, Mapping):
        modules = list(modules.values())
    if not isinstance(modules, list):
        return None
    return any(isinstance(m, Mapping) and "fuelscoop" in str(m.get("Item") or "").casefold()
               for m in modules)


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


def _restore_activity_trade_provenance() -> None:
    """Purchase-origin lots are private EDMC state, never cloud cargo inventory."""
    global _activity_trade_lots
    try:
        raw = config.get_str(KEY_ACTIVITY_TRADE_PROVENANCE) or "{}"
        parsed = json.loads(raw)
    except Exception:
        parsed = {}
    restored: dict[str, dict[str, list[dict[str, Any]]]] = {}
    if isinstance(parsed, Mapping):
        for commander, commodities in list(parsed.items())[-6:]:
            if not isinstance(commodities, Mapping):
                continue
            ledger: dict[str, list[dict[str, Any]]] = {}
            for commodity, lots in list(commodities.items())[-100:]:
                key = _commodity_key(commodity)
                if not key or not isinstance(lots, list):
                    continue
                valid = []
                for row in lots[:64]:
                    if not isinstance(row, Mapping):
                        continue
                    source = str(row.get("source") or "unknown")
                    count = _optional_int(row.get("count")) or 0
                    if source not in {"station_market", "carrier_market", "mined", "unknown"}:
                        source = "unknown"
                    if 0 < count <= 25000:
                        valid.append({"source": source, "count": count})
                if valid:
                    ledger[key] = valid
            if ledger:
                restored[str(commander)[:120]] = ledger
    with _activity_lock:
        _activity_trade_lots = restored


def _save_activity_trade_provenance() -> None:
    with _activity_lock:
        payload = {cmdr: dict(list(commodities.items())[-100:])
                   for cmdr, commodities in list(_activity_trade_lots.items())[-6:]}
        try:
            config.set(KEY_ACTIVITY_TRADE_PROVENANCE, json.dumps(payload, separators=(",", ":")))
        except Exception:
            pass


def _trade_inventory_count(state: Mapping[str, Any], commodity: str) -> Optional[int]:
    # EDMC's Cargo/CargoJSON is examined only locally. It is never uploaded.
    if not isinstance(state, Mapping) or not isinstance(state.get("Cargo"), Mapping) and not isinstance(state.get("CargoJSON"), Mapping):
        return None
    vessel, rows = _cargo_inventory_from_edmc_state(state)
    if str(vessel).casefold() != "ship":
        return None
    return sum(max(0, int(row.get("count") or 0)) for row in rows if row.get("key") == commodity)


def _trade_lot_total(lots: list[dict[str, Any]]) -> int:
    return sum(max(0, int(lot.get("count") or 0)) for lot in lots)


def _trade_reconcile_quantity(lots: list[dict[str, Any]], actual: Optional[int]) -> None:
    # If cargo exists outside the known purchase ledger, discard claimed provenance.
    # This favors a false negative and later Frontier verification over a false BGS credit.
    if actual is not None and _trade_lot_total(lots) != actual:
        lots[:] = [{"source": "unknown", "count": actual}] if actual > 0 else []


def _trade_add_lot(lots: list[dict[str, Any]], source: str, count: int) -> None:
    if count <= 0:
        return
    if lots and lots[-1]["source"] == source:
        lots[-1]["count"] += count
    else:
        lots.append({"source": source, "count": count})


def _trade_consume_lots(lots: list[dict[str, Any]], count: int) -> dict[str, Any]:
    remaining = count
    sources: set[str] = set()
    while remaining > 0 and lots:
        lot = lots[0]
        used = min(remaining, int(lot["count"]))
        remaining -= used
        lot["count"] -= used
        sources.add(lot["source"])
        if lot["count"] <= 0:
            lots.pop(0)
    if remaining:
        sources.add("unknown")
    source = next(iter(sources)) if len(sources) == 1 else "mixed"
    return {"source": source, "verified": remaining == 0 and source == "station_market"}


def _recover_trade_lots_from_recent_journals(
    cmdr: str, sale: Mapping[str, Any], state: Mapping[str, Any],
) -> Optional[list[dict[str, Any]]]:
    """Recover *purchase provenance*, never replay historical sales to cloud.

    Require: same CMDR, a real empty-hold or exact inventory baseline,
    uninterrupted journal activity, a uniquely identified current sale, and
    an exact pre/post-sale cargo count. Unknown changes remain unknown.
    Bounded scan runs only on a sale whose live provenance is insufficient.
    """
    commodity = _commodity_key(sale.get("Type"))
    sale_count = _optional_int(sale.get("Count")) or 0
    stamp = str(sale.get("timestamp") or "")
    sale_total = sale.get("TotalSale")
    if not cmdr or not commodity or not stamp or sale_count <= 0 or sale_total is None:
        return None
    actual = _trade_inventory_count(state, commodity)
    if actual is None:
        return None

    journal_dir = getattr(monitor, "currentdir", None) if monitor is not None else None
    if not journal_dir:
        try:
            journal_dir = config.get_str("journaldir") or getattr(config, "default_journal_dir", "")
        except Exception:
            return None
    if not journal_dir:
        return None
    try:
        # Never read the user's full expedition or history into memory.
        # Files are chronological by Frontier's timestamped filename.
        files = sorted(
            Path(journal_dir).expanduser().glob("Journal*.log"),
            key=lambda p: p.name,  # Frontier timestamped journal filenames
        )[-20:]
        sizes = [p.stat().st_size for p in files]
        if not files or sum(sizes) > 32 * 1024 * 1024:
            return None
    except (OSError, ValueError):
        return None

    commander = _cmdr_cache_key(cmdr)
    lots: list[dict[str, Any]] = []
    baseline = False
    dock: dict[str, str] = {}
    matches = 0
    recovered: Optional[list[dict[str, Any]]] = None
    lines_seen = 0

    def matches_sale(row: Mapping[str, Any]) -> bool:
        return (
            row.get("event") == "MarketSell"
            and str(row.get("timestamp") or "") == stamp
            and _commodity_key(row.get("Type")) == commodity
            and (_optional_int(row.get("Count")) or 0) == sale_count
            and str(row.get("TotalSale")) == str(sale_total)
            and (not sale.get("MarketID") or
                 str(row.get("MarketID") or "") == str(sale.get("MarketID")))
        )

    try:
        for file in files:
            # Frontier journals can belong to different CMDRs on one PC.
            # Every file must establish its own Commander/LoadGame identity.
            file_cmdr = ""
            with file.open("r", encoding="utf-8", errors="replace") as handle:
                for line in handle:
                    lines_seen += 1
                    if lines_seen > 80000:
                        return None
                    if '"event"' not in line:
                        continue
                    try:
                        row = json.loads(line)
                    except (ValueError, UnicodeError):
                        continue  # Incomplete tail of current journal
                    if not isinstance(row, Mapping):
                        continue
                    kind = str(row.get("event") or "")
                    if kind in {"Commander", "LoadGame"}:
                        identity = str((row.get("Name") if kind == "Commander" else row.get("Commander")) or "")
                        file_cmdr = _cmdr_cache_key(identity)
                        dock = {}
                        if file_cmdr != commander:
                            baseline = False
                            lots.clear()
                        continue
                    if file_cmdr != commander:
                        continue
                    # Search all selected files for duplicate indistinguishable
                    # sale records; only a unique event can anchor this replay.
                    if matches_sale(row):
                        matches += 1
                        if matches == 1 and baseline and (
                            not dock.get("market") or not sale.get("MarketID")
                            or dock["market"] == str(sale.get("MarketID"))
                        ):
                            reconstructed = [dict(item) for item in lots]
                            pre_count = _trade_lot_total(reconstructed)
                            if pre_count >= sale_count and actual in {pre_count, pre_count - sale_count}:
                                check = [dict(item) for item in reconstructed]
                                provenance = _trade_consume_lots(check, sale_count)
                                if provenance["verified"]:
                                    recovered = reconstructed
                        continue
                    if matches:
                        continue  # Never replay future events into the candidate sale.

                    if kind in {"Docked", "Location"} and (
                        kind == "Docked" or row.get("Docked") is True
                    ):
                        dock = {
                            "station": str(row.get("StationName") or ""),
                            "system": str(row.get("StarSystem") or ""),
                            "type": str(row.get("StationType") or ""),
                            "market": str(row.get("MarketID") or ""),
                        }
                    elif kind in {"Undocked", "FSDJump", "CarrierJump"} or (
                        kind == "Location" and row.get("Docked") is False
                    ):
                        dock = {}
                    if kind == "Cargo" and str(row.get("Vessel") or "Ship").casefold() == "ship":
                        inventory = row.get("Inventory")
                        if isinstance(inventory, list):
                            observed = sum(
                                (_optional_int(item.get("Count")) or 0)
                                for item in inventory
                                if isinstance(item, Mapping)
                                and _commodity_key(item.get("Name") or item.get("Type")) == commodity
                            )
                            if observed == 0:
                                lots.clear()
                                baseline = True
                            elif _trade_lot_total(lots) != observed:
                                lots[:] = [{"source": "unknown", "count": observed}]
                                baseline = True  # Known holdings, origin unknown
                        elif _optional_int(row.get("Count")) == 0:
                            lots.clear()
                            baseline = True
                        continue
                    if not baseline:
                        continue
                    if _commodity_key(row.get("Type")) != commodity:
                        if kind == "CargoTransfer" and any(
                            isinstance(item, Mapping)
                            and _commodity_key(item.get("Type")) == commodity
                            for item in (row.get("Transfers") or [])
                        ):
                            return None  # Transfer provenance/direction is ambiguous.
                        continue
                    count = _optional_int(row.get("Count")) or (
                        1 if kind == "MiningRefined" else 0
                    )
                    if count <= 0 or count > 25000:
                        continue
                    if kind == "MarketBuy":
                        source = (
                            "station_market"
                            if dock.get("station") and dock.get("system")
                            and dock.get("type") and dock["type"].casefold() != "fleetcarrier"
                            and (not row.get("MarketID") or not dock.get("market")
                                 or str(row.get("MarketID")) == dock["market"])
                            else "carrier_market" if dock.get("type", "").casefold() == "fleetcarrier"
                            else "unknown"
                        )
                        _trade_add_lot(lots, source, count)
                    elif kind == "MiningRefined":
                        _trade_add_lot(lots, "mined", count)
                    elif kind == "MarketSell":
                        _trade_consume_lots(lots, count)
                    elif kind == "CollectCargo":
                        # Unknown cargo enters before later station purchases; preserve
                        # FIFO so the added lot cannot masquerade as purchased stock.
                        _trade_add_lot(lots, "unknown", count)
                    elif kind in {"EjectCargo", "CargoTransfer"}:
                        return None  # Insufficient provenance after unknown movement.
            # A journal segment without a CMDR identity may contain missing
            # transactions. Invalidate earlier reconstruction evidence until
            # a later trusted cargo baseline is encountered.
            if not file_cmdr and baseline and not matches:
                baseline = False
                lots.clear()
    except (OSError, UnicodeError):
        return None

    return recovered if matches == 1 else None


def _restore_trade_origin_for_sale(
    cmdr: str, entry: Mapping[str, Any], state: Mapping[str, Any],
) -> bool:
    """Repair only missing/unknown origin; never overwrite a verified live lot."""
    commodity = _commodity_key(entry.get("Type"))
    count = _optional_int(entry.get("Count")) or 0
    if not commodity or count <= 0:
        return False
    commander = _cmdr_cache_key(cmdr)
    actual = _trade_inventory_count(state, commodity)
    if actual is None:
        return False
    with _activity_lock:
        current = _activity_trade_lots.get(commander, {}).get(commodity, [])
        covered = [dict(row) for row in current]
        if _trade_lot_total(covered) >= count and _trade_consume_lots(covered, count)["verified"]:
            return False
    recovered = _recover_trade_lots_from_recent_journals(cmdr, entry, state)
    if recovered is None:
        return False
    with _activity_lock:
        current = _activity_trade_lots.setdefault(commander, {}).get(commodity, [])
        covered = [dict(row) for row in current]
        if _trade_lot_total(covered) >= count and _trade_consume_lots(covered, count)["verified"]:
            return False
        pre = _trade_lot_total(recovered)
        if actual not in {pre, pre - count}:
            return False
        _activity_trade_lots[commander][commodity] = recovered
        _save_activity_trade_provenance()
    return True


def _observe_activity_trade(
    cmdr: str,
    entry: Mapping[str, Any],
    state: Mapping[str, Any],
    fallback_system: str,
    fallback_station: str,
) -> Optional[dict[str, Any]]:
    """Observe only trade origin and sale eligibility; send no cargo or purchase history."""
    global _activity_trade_commander, _activity_trade_station
    event = str(entry.get("event") or "")
    commander = _cmdr_cache_key(cmdr)
    with _activity_lock:
        if _activity_trade_commander != commander:
            _activity_trade_station = {}
            _activity_trade_commander = commander

        system = str(entry.get("StarSystem") or state.get("SystemName") or fallback_system or _last_system_name or "").strip()
        station = str(entry.get("StationName") or state.get("StationName") or fallback_station or "").strip()
        station_type = str(entry.get("StationType") or state.get("StationType") or "").strip()
        faction = _station_faction_name(entry, state)
        if event == "Docked" or event == "Location" and entry.get("Docked") is True:
            _activity_trade_station = {"system": system, "station": station, "type": station_type, "faction": faction}
        elif event in {"Undocked", "FSDJump", "CarrierJump"} or event == "Location" and entry.get("Docked") is False:
            _activity_trade_station = {}

        cached = _activity_trade_station
        if cached and cached.get("station") == station and cached.get("system") == system:
            station_type = station_type or str(cached.get("type") or "")
            faction = faction or str(cached.get("faction") or "")
        if event not in {"MarketBuy", "MarketSell", "MiningRefined", "CollectCargo", "CargoTransfer", "EjectCargo", "Cargo"}:
            return None

        ledger = _activity_trade_lots.setdefault(commander, {})
        commodity = _commodity_key(entry.get("Type"))
        if event == "Cargo":
            # Fresh cargo snapshots can reveal imports, mining, mission cargo or
            # other changes that were not journaled while Scout was online.
            if not isinstance(state.get("Cargo"), Mapping) and not isinstance(state.get("CargoJSON"), Mapping):
                return None
            vessel, rows = _cargo_inventory_from_edmc_state(state)
            if str(vessel).casefold() == "ship":
                snapshot: dict[str, int] = {}
                for row in rows:
                    key = str(row.get("key") or "")
                    snapshot[key] = snapshot.get(key, 0) + max(0, int(row.get("count") or 0))
                for key in set(ledger).union(snapshot):
                    lots = ledger.setdefault(key, [])
                    _trade_reconcile_quantity(lots, snapshot.get(key, 0))
                    if not lots:
                        ledger.pop(key, None)
                _save_activity_trade_provenance()
            return None
        if event == "CargoTransfer":
            for row in entry.get("Transfers") or []:
                if isinstance(row, Mapping):
                    key = _commodity_key(row.get("Type"))
                    if key:
                        qty = _trade_inventory_count(state, key)
                        ledger[key] = [{"source": "unknown", "count": qty}] if qty else []
                        if not ledger[key]:
                            ledger.pop(key, None)
            _save_activity_trade_provenance()
            return None
        if not commodity:
            return None
        count = _optional_int(entry.get("Count")) or (1 if event == "MiningRefined" else 0)
        if event in {"CollectCargo", "EjectCargo"}:
            qty = _trade_inventory_count(state, commodity)
            if qty is not None:
                ledger[commodity] = [{"source": "unknown", "count": qty}] if qty > 0 else []
                if not ledger[commodity]:
                    ledger.pop(commodity, None)
                _save_activity_trade_provenance()
            return None
        if count <= 0 or count > 25000:
            return None
        lots = ledger.setdefault(commodity, [])
        actual_post = _trade_inventory_count(state, commodity)
        if event == "MarketBuy":
            # EDMC Cargo can be one journal event behind. Accept either a
            # validated post-buy snapshot or a pre-buy snapshot matching the
            # already-known ledger. Anything else remains unknown origin.
            tracked_before = _trade_lot_total(lots)
            if actual_post is not None and actual_post == tracked_before:
                before = actual_post  # Cargo still reflects pre-purchase
            elif actual_post is not None and actual_post >= count:
                before = actual_post - count  # Cargo already reflects purchase
            else:
                before = None
            _trade_reconcile_quantity(lots, before)
            source = ("carrier_market" if station_type.casefold() == "fleetcarrier"
                      else "station_market" if station_type and station and system else "unknown")
            if before is None:
                source = "unknown"
            _trade_add_lot(lots, source, count)
            _save_activity_trade_provenance()
            return None
        if event == "MiningRefined":
            before = max(0, actual_post - count) if actual_post is not None and actual_post >= count else None
            _trade_reconcile_quantity(lots, before)
            _trade_add_lot(lots, "mined", count)
            _save_activity_trade_provenance()
            return None
        # Sale: EDMC Cargo may still show pre-sale holdings. Preserve the
        # verified lot when that pre-sale snapshot exactly matches our ledger;
        # otherwise require the normal post-sale quantity reconciliation.
        # A mismatch stays 'unknown' rather than manufacturing profit credit.
        tracked_before = _trade_lot_total(lots)
        before = (
            tracked_before if actual_post is not None
            and actual_post == tracked_before and tracked_before >= count
            else actual_post + count if actual_post is not None else None
        )
        _trade_reconcile_quantity(lots, before)
        source = _trade_consume_lots(lots, count)
        if not lots:
            ledger.pop(commodity, None)
        _save_activity_trade_provenance()
        return {**source, "stationFaction": faction, "stationType": station_type,
                "system": system, "station": station}


def _build_realtime_activity_payload(
    entry: Mapping[str, Any],
    state: Mapping[str, Any],
    fallback_system: str,
    fallback_station: str,
    trade_sale: Optional[Mapping[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    event = str(entry.get("event") or "").strip()
    if event not in {
        "MissionCompleted",
        "RedeemVoucher",
        "ColonisationContribution",
        "ColonisationConstructionDepot",
        "MarketSell",
        "SellExplorationData",
        "MultiSellExplorationData",
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

    if event in {"SellExplorationData", "MultiSellExplorationData"}:
        # Sales are credited where Universal Cartographics is redeemed, not
        # where the scans originated. Do not upload scanned systems or bodies.
        amount = _optional_int(entry.get("TotalEarnings"))
        if amount is None or amount <= 0 or amount > 10**13:
            return None
        with _activity_lock:
            cached = dict(_activity_trade_station)
        if cached.get("system") == system_name and cached.get("station") == station_name:
            station_type = station_type or str(cached.get("type") or "")
            station_faction = base["stationFaction"] or str(cached.get("faction") or "")
        else:
            station_faction = base["stationFaction"]
        if not system_address or not system_name or not station_name or not station_faction or not station_type:
            return None
        if station_type.casefold() == "fleetcarrier" or station_faction.casefold() == "fleetcarrier":
            return None
        return {
            **base,
            "stationFaction": station_faction,
            "stationType": station_type,
            "amount": amount,
        }

    if event == "MarketSell":
        # Only purchases traced to a standard station market can provisionally
        # increase verified trade progress. Unknown/mined/carrier lots stay local.
        if not trade_sale or trade_sale.get("verified") is not True:
            return None
        if not system_name or not station_name or not trade_sale.get("stationFaction"):
            return None
        if str(trade_sale.get("stationType") or "").casefold() in {"", "fleetcarrier"}:
            return None
        if bool(entry.get("BlackMarket") or entry.get("StolenGoods")):
            return None
        count = _optional_int(entry.get("Count")) or 0
        try:
            total = float(entry.get("TotalSale"))
            avg_price = float(entry.get("AvgPricePaid"))
            sell_price = float(entry.get("SellPrice"))
        except (TypeError, ValueError):
            return None
        profit = total - avg_price * count
        if not all(math.isfinite(n) for n in (total, avg_price, sell_price, profit)):
            return None
        if count <= 0 or not (avg_price > 0 and total > 0 and profit > 0):
            return None
        return {
            **base,
            "stationFaction": str(trade_sale["stationFaction"])[:120],
            "stationType": str(trade_sale["stationType"])[:80],
            "commodity": _commodity_display(entry.get("Type"), entry.get("Type_Localised")),
            "count": count,
            "sellPrice": sell_price,
            "total": total,
            "avgPricePaid": avg_price,
            "tradeSource": "station_market",
            "tradeSourceVerified": True,
            "blackMarket": False,
            "stolenGoods": False,
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


def _update_trade_activity_status(
    entry: Mapping[str, Any],
    provenance: Optional[Mapping[str, Any]],
    payload: Optional[Mapping[str, Any]],
    has_token: bool,
) -> None:
    """Safe local diagnostic: no tokens, cargo inventory or purchase lots.

    Trade qualification is deliberately unchanged; a rejected sale is *not*
    converted to verified trade just to improve apparent HUD progress.
    """
    status, reason = "excluded", "unknown_origin"
    if payload is not None and not has_token:
        status, reason = "excluded", "scout_token_missing"
    elif payload is not None:
        status, reason = "queued", "awaiting_server"
    elif provenance is None:
        reason = "no_purchase_history"
    elif not provenance.get("verified"):
        reason = "purchase_origin_" + str(provenance.get("source") or "unknown")[:32]
    elif str(provenance.get("stationType") or "").casefold() in {"", "fleetcarrier"}:
        reason = "not_standard_station"
    elif not provenance.get("stationFaction"):
        reason = "station_faction_unresolved"
    elif bool(entry.get("BlackMarket") or entry.get("StolenGoods")):
        reason = "black_market_or_stolen"
    else:
        try:
            count = int(entry.get("Count") or 0)
            profit = float(entry.get("TotalSale")) - count * float(entry.get("AvgPricePaid"))
            reason = "not_profitable_or_missing_price" if not math.isfinite(profit) or profit <= 0 else "unqualified_sale"
        except (TypeError, ValueError, OverflowError):
            reason = "price_fields_missing"
    with _hud_condition:
        _hud_state["tradeActivity"] = {
            "status": status,
            "reason": reason,
            "timestamp": str(entry.get("timestamp") or ""),
            "system": str(_last_system_name or "")[:140],
            "station": str((provenance or {}).get("station") or "")[:140],
        }
        _hud_condition.notify_all()


def _record_trade_upload_result(
    batch: list[dict[str, Any]], status: str, reason: str,
    server: Optional[Mapping[str, Any]] = None,
) -> None:
    """Update last-sale status only when the batch corresponds to that sale."""
    sales = [row for row in batch if row.get("event") == "MarketSell"]
    if not sales:
        return
    latest = max((str(row.get("timestamp") or "") for row in sales), default="")
    with _hud_condition:
        trade = _hud_state.get("tradeActivity")
        if not isinstance(trade, dict) or str(trade.get("timestamp") or "") != latest:
            return
        trade.update({
            "status": status,
            "reason": reason,
            "serverNormalized": _optional_int((server or {}).get("normalized")),
            "serverRejected": _optional_int((server or {}).get("rejected")),
            "serverAdded": _optional_int((server or {}).get("added")),
            "serverUpdated": _optional_int((server or {}).get("updated")),
        })
        _hud_condition.notify_all()


def _next_trade_sale_ordinal(cmdr: str, sale: Mapping[str, Any]) -> int:
    """Ordinal among otherwise identical real-time sales, per CMDR.

    Retries re-use their original queued payload/ordinal. Bounded in memory;
    a Frontier journal sync will authoritatively reconcile older occurrences.
    """
    fingerprint = json.dumps([
        _cmdr_cache_key(cmdr), str(sale.get("timestamp") or ""),
        str(sale.get("systemAddress") or ""), str(sale.get("station") or "").casefold(),
        str(sale.get("commodity") or "").casefold(), sale.get("count"),
        sale.get("total"), sale.get("sellPrice"),
    ], separators=(",", ":"), ensure_ascii=False)
    with _activity_lock:
        ordinal = _activity_trade_sale_ordinals.get(fingerprint, 0) + 1
        _activity_trade_sale_ordinals[fingerprint] = ordinal
        if len(_activity_trade_sale_ordinals) > 256:
            _activity_trade_sale_ordinals.pop(next(iter(_activity_trade_sale_ordinals)))
    return ordinal


def _next_exploration_sale_ordinal(cmdr: str, sale: Mapping[str, Any]) -> int:
    """Separate identical same-second Cartographics pages. Retries keep the ordinal."""
    fingerprint = json.dumps([
        _cmdr_cache_key(cmdr), str(sale.get("event") or ""),
        str(sale.get("timestamp") or ""),
        str(sale.get("systemAddress") or ""),
        str(sale.get("station") or "").casefold(),
        sale.get("amount"),
    ], separators=(",", ":"), ensure_ascii=False)
    with _activity_lock:
        ordinal = _activity_exploration_sale_ordinals.get(fingerprint, 0) + 1
        _activity_exploration_sale_ordinals[fingerprint] = ordinal
        if len(_activity_exploration_sale_ordinals) > 256:
            _activity_exploration_sale_ordinals.pop(next(iter(_activity_exploration_sale_ordinals)))
    return ordinal


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
            _record_trade_upload_result(batch, "excluded", "scout_token_missing")
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
            _record_trade_upload_result(events, "retrying", "network_error")
            return False, True

    if 200 <= response.status_code < 300:
        try:
            result = response.json()
        except Exception:
            result = {}
        if not isinstance(result, Mapping):
            result = {}
        received = _optional_int(result.get("received"))
        normalized = _optional_int(result.get("normalized"))
        rejected = _optional_int(result.get("rejected"))
        if received and rejected is not None and rejected >= received and not normalized:
            _record_trade_upload_result(events, "excluded", "server_rejected", result)
            return False, False
        _record_trade_upload_result(
            events,
            "accepted" if not rejected else "partial",
            "server_processed" if not rejected else "mixed_batch_needs_review",
            result,
        )
        return True, False
    try:
        detail = str(response.json().get("error") or "")
    except Exception:
        detail = ""
    _record_trade_upload_result(events, "retrying" if response.status_code == 429 or response.status_code >= 500 else "excluded",
                                f"http_{response.status_code}")
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
