from __future__ import annotations

import json
import re
import secrets
import threading
import time
import tkinter as tk
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Mapping, MutableMapping, Optional
from urllib.parse import parse_qs, urlparse

import myNotebook as nb
import timeout_session
from config import config

try:
    from monitor import monitor
except Exception:  # EDMC supplies this; fallback keeps settings usable if import changes.
    monitor = None

PLUGIN_NAME = "Mongrel Scout"
PLUGIN_VERSION = "1.8.0"
VERSION = PLUGIN_VERSION
MONGREL = "Regiment of Imperial Mongrels"
DEFAULT_ENDPOINT = "https://mongrels-squadron.pages.dev/api/operations/scout-ingest"
HUD_BRIDGE_HOST = "127.0.0.1"
HUD_BRIDGE_PORT = 43857
HUD_BRIDGE_VERSION = 5
HUD_EVENT_LIMIT = 256
HUD_SITE_FEED_REFRESH_SECONDS = 30.0
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
    "CarrierStats": "carrier.stats",
    "FSDJump": "travel.fsd_jump",
    "SupercruiseEntry": "travel.supercruise_entry",
    "SupercruiseExit": "travel.supercruise_exit",
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
_dashboard_context_lock = threading.Lock()
_dashboard_context: dict[str, Any] = {
    "timestamp": "",
    "bodyName": "",
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
    "ownerCarrier": None,
    "lastFacility": None,
    "status": None,
    "ship": {"name": "", "ident": "", "type": "", "maxJumpRange": None, "currentJumpRange": None, "unladenMass": None, "cargoCapacity": None, "fuelCapacity": None, "jumpModel": None, "currentMass": None, "hullHealth": None, "shieldsUp": None, "timestamp": None},
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
        "relevant ApproachBody/LeaveBody/Supercruise context. The server stores those facts and only promotes "
        "a host association when independent signals agree; Scout does not guess from proximity. Docking, "
        "station/carrier, travel and CarrierStats triggers are also normalized for the local HUD/voice bridge "
        "on 127.0.0.1. Commander name may "
        "exist in that local-only bridge state for future owner/squad greetings, but Commander name, "
        "cargo, credits, ship build, materials, missions, and general travel history are not transmitted. "
        "For the optional local HUD, Scout also uses its bound machine token to fetch a compact read-only "
        "Mission Control / Trader / Scout Board leadership feed and to send explicit alert acknowledgements. "
        "The token itself is never exposed through the local HUD bridge; personal HUD notes stay local on the PC."
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
    with _dashboard_context_lock:
        _dashboard_context["timestamp"] = str(entry.get("timestamp") or "").strip()
        _dashboard_context["bodyName"] = str(entry.get("BodyName") or "").strip()
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

    status = {
        "timestamp": str(entry.get("timestamp") or "").strip(),
        "flags": flags,
        "flags2": _optional_int(entry.get("Flags2")) or 0,
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
    if event in {"FSDJump", "Location", "CarrierJump"}:
        _remember_location(entry, system)
    if event in {"ApproachBody", "LeaveBody", "SupercruiseEntry", "SupercruiseExit"}:
        _remember_journal_context(entry, system)

    # HUD/voice triggers remain local. Seed current ship facts from EDMC state, then publish the event.
    _update_hud_ship_from_edmc_state(state)
    _publish_hud_event(cmdr, system, station, entry)

    token = (config.get_str(KEY_TOKEN) or "").strip()

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

        self._write_json({"ok": False, "error": "not_found"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/v1/site-feed/ack":
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
        self._write_json(result, status=200 if result.get("ok") else 502)

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
    return f"{parsed.scheme}://{parsed.netloc}/api/hud/feed"


def _site_feed_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": f"{_session.headers.get('User-Agent', 'EDMarketConnector')} MongrelScout/{PLUGIN_VERSION}",
    }


def _set_site_feed_status(*, ok: bool, error: str = "") -> None:
    with _hud_condition:
        _hud_state["siteFeedStatus"] = {
            "ok": bool(ok),
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "error": str(error or "")[:160],
        }
        _hud_condition.notify_all()


def _refresh_hud_site_feed_once() -> bool:
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        _set_site_feed_status(ok=False, error="scout_token_missing")
        return False
    try:
        response = _session.get(_hud_site_feed_endpoint(), headers=_site_feed_headers(token))
        if not (200 <= response.status_code < 300):
            try:
                error = str(response.json().get("error") or f"http_{response.status_code}")
            except Exception:
                error = f"http_{response.status_code}"
            _set_site_feed_status(ok=False, error=error)
            return False
        payload = response.json()
        if not isinstance(payload, Mapping) or payload.get("ok") is not True:
            _set_site_feed_status(ok=False, error="invalid_hud_feed")
            return False
        with _hud_condition:
            _hud_state["siteFeed"] = dict(payload)
            _hud_state["siteFeedStatus"] = {
                "ok": True,
                "updatedAt": str(payload.get("generatedAt") or "").strip() or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "error": "",
            }
            _hud_condition.notify_all()
        return True
    except Exception:
        _set_site_feed_status(ok=False, error="network")
        return False


def _hud_site_feed_loop() -> None:
    while not _hud_site_feed_stop.is_set():
        _refresh_hud_site_feed_once()
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
    token = (config.get_str(KEY_TOKEN) or "").strip()
    if not token:
        return {"ok": False, "error": "scout_token_missing"}
    payload: dict[str, Any] = {"action": "ack-all" if action == "ack-all" else "ack"}
    if action == "ack-all":
        payload["alertIds"] = ids
    else:
        payload["alertId"] = ids[0]
    try:
        response = _session.post(_hud_site_feed_endpoint(), json=payload, headers=_site_feed_headers(token))
        try:
            result = response.json()
        except Exception:
            result = {}
        if not (200 <= response.status_code < 300) or not isinstance(result, Mapping) or result.get("ok") is not True:
            return {"ok": False, "error": str(result.get("error") or f"http_{response.status_code}")}
        acknowledged = [str(value) for value in result.get("acknowledged", ids) if str(value)]
        _mark_site_alerts_acknowledged(acknowledged, str(result.get("acknowledgedAt") or ""))
        return {"ok": True, "acknowledged": acknowledged, "acknowledgedAt": result.get("acknowledgedAt")}
    except Exception:
        return {"ok": False, "error": "network"}


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
        return json.loads(json.dumps(_hud_state))


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

    if journal_event == "Location":
        payload["docked"] = bool(entry.get("Docked"))

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

    if event_type == "docking.docked":
        _hud_state["station"] = station
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
        elif not bool(event.get("docked")):
            _hud_state["station"] = None

    if event_type == "carrier.jump" and station:
        _hud_state["station"] = station

    if event_type in {"travel.fsd_jump", "travel.supercruise_entry"}:
        _hud_state["supercruise"] = True
    elif event_type == "travel.supercruise_exit":
        _hud_state["supercruise"] = False

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

    if event_type == "carrier.stats" and isinstance(event.get("carrier"), Mapping):
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
    modules = entry.get("Modules")
    if not isinstance(modules, list):
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
    if not station_name or station_type.casefold() in {"fleetcarrier", "fleet carrier"}:
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
                _set_status(f"Upload failed ({response.status_code})")
        except Exception:
            _set_status("Upload failed — network")


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
