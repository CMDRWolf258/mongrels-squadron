from __future__ import annotations

import json
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
PLUGIN_VERSION = "1.4.0"
VERSION = PLUGIN_VERSION
MONGREL = "Regiment of Imperial Mongrels"
DEFAULT_ENDPOINT = "https://mongrels-squadron.pages.dev/api/operations/scout-ingest"
HUD_BRIDGE_HOST = "127.0.0.1"
HUD_BRIDGE_PORT = 43857
HUD_BRIDGE_VERSION = 1
HUD_EVENT_LIMIT = 256
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
_session = timeout_session.new_session(timeout=8)
_hud_condition = threading.Condition()
_hud_events: deque[dict[str, Any]] = deque(maxlen=HUD_EVENT_LIMIT)
_hud_state: dict[str, Any] = {
    "bridgeVersion": HUD_BRIDGE_VERSION,
    "pluginVersion": PLUGIN_VERSION,
    "seq": 0,
    "commander": "",
    "system": None,
    "station": None,
    "docking": None,
    "supercruise": None,
    "ownerCarrier": None,
    "lastFacility": None,
    "lastEvent": None,
    "updatedAt": None,
}
_hud_seq = 0
_hud_server: Optional[ThreadingHTTPServer] = None
_hud_thread: Optional[threading.Thread] = None
_hud_error = ""


def plugin_start3(plugin_dir: str) -> str:
    """EDMC plugin entry point."""
    if config.get_int(KEY_VERSION) < 1:
        config.set(KEY_VERSION, 1)
        config.set(KEY_ENABLED, 1)
        config.set(KEY_ENDPOINT, DEFAULT_ENDPOINT)
    _restore_owner_carrier()
    if config.get_bool(KEY_ENABLED):
        _start_hud_bridge()
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
        "Docking, station/carrier, travel and CarrierStats triggers are also normalized for the local "
        "HUD/voice bridge on 127.0.0.1 only; those local events are not uploaded. Commander name may "
        "exist in that local-only bridge state for future owner/squad greetings, but Commander name, "
        "cargo, credits, ship build, materials, missions, and general travel history are not transmitted."
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
    else:
        _stop_hud_bridge()
    _set_status(_initial_status())


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

    # HUD/voice triggers remain local. Publish them before any cloud-token checks.
    _publish_hud_event(cmdr, system, station, entry)

    token = (config.get_str(KEY_TOKEN) or "").strip()
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



def plugin_stop() -> None:
    """Stop the local loopback bridge when EDMC unloads the plugin."""
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
