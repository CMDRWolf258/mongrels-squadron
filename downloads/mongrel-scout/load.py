from __future__ import annotations

import json
import threading
import tkinter as tk
from typing import Any, Mapping, MutableMapping, Optional

import myNotebook as nb
import timeout_session
from config import config

try:
    from monitor import monitor
except Exception:  # EDMC supplies this; fallback keeps settings usable if import changes.
    monitor = None

PLUGIN_NAME = "Mongrel Scout"
PLUGIN_VERSION = "1.3.0"
VERSION = PLUGIN_VERSION
MONGREL = "Regiment of Imperial Mongrels"
DEFAULT_ENDPOINT = "https://mongrels-squadron.pages.dev/api/operations/scout-ingest"

KEY_VERSION = "MongrelScoutConfigVersion"
KEY_ENABLED = "MongrelScoutEnabled"
KEY_TOKEN = "MongrelScoutToken"
KEY_ENDPOINT = "MongrelScoutEndpoint"

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


def plugin_start3(plugin_dir: str) -> str:
    """EDMC plugin entry point."""
    if config.get_int(KEY_VERSION) < 1:
        config.set(KEY_VERSION, 1)
        config.set(KEY_ENABLED, 1)
        config.set(KEY_ENDPOINT, DEFAULT_ENDPOINT)
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
        "Commander name, cargo, credits, ship build, materials, missions, and general travel "
        "history are not transmitted."
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
