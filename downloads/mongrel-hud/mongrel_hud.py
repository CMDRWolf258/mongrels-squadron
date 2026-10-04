from __future__ import annotations

import ctypes
from ctypes import wintypes
import difflib
import hashlib
import json
import math
import os
import re
import secrets
import shutil
import socket
import subprocess
import tarfile
import sys
import threading
import time
import tkinter as tk
import urllib.error
import urllib.request
import wave
import zipfile
from array import array
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


try:
    import numpy as np
    from PIL import ImageEnhance, ImageGrab, ImageOps
    from rapidocr_onnxruntime import RapidOCR
    OCR_AVAILABLE = True
except Exception:
    np = None
    ImageEnhance = None
    ImageGrab = None
    ImageOps = None
    RapidOCR = None
    OCR_AVAILABLE = False

try:
    from zeroconf import ServiceInfo, Zeroconf
    MDNS_AVAILABLE = True
except Exception:
    ServiceInfo = None
    Zeroconf = None
    MDNS_AVAILABLE = False

APP_VERSION = "0.13.0"
SCOUT_STATE_URL = "http://127.0.0.1:43857/v1/state"
SCOUT_EVENTS_URL = "http://127.0.0.1:43857/v1/events"
SCOUT_ALERT_ACK_URL = "http://127.0.0.1:43857/v1/site-feed/ack"
SCOUT_MINING_REPORT_URL = "http://127.0.0.1:43857/v1/mining/report"
SCOUT_MINING_CENTER_URL = "http://127.0.0.1:43857/v1/mining/center"
MINING_DATA_URL = "http://127.0.0.1:43857/v1/mining/data"
MINING_CENTERS_URL = "http://127.0.0.1:43857/v1/mining/centers"
TEN16_SYSTEM = "NGC 2546 Sector UZ-G d10-16"
TEN16_ID64 = "560820275507"
MINING_REFRESH_SECONDS = 60.0
SURFACE_MINING_COMMODITIES = (
    "Alexandrite",
    "Deuterium",
    "Diamonds",
    "Gold",
    "Grandidierite",
    "Helium",
    "Iridium",
    "Jadeite",
    "LTD",
    "Monazite",
    "Olivine",
    "Osmium",
    "Palladium",
    "Periclase Dunite",
    "Platinum",
    "Quartz Pyroxenite",
    "Rhodplumsite",
    "Ruby",
    "Sapphire",
    "Serendibite",
    "Tantalum",
    "Thorium",
    "Thortveitite",
    "Uraninite",
)
CONTROLLER_HOST = "0.0.0.0"
CONTROLLER_PORT = 43858
CONTROLLER_HOSTNAME = "mongrel-hud.local"
CONTROLLER_STABLE_URL = f"http://{CONTROLLER_HOSTNAME}:{CONTROLLER_PORT}"
PAIRING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
MAX_TRUSTED_CONTROLLER_TOKENS = 8
UPDATE_RELEASE_API = "https://api.github.com/repos/CMDRWolf258/mongrels-squadron/releases/tags/mongrel-hud-latest"
UPDATE_ASSET_NAME = "MongrelHUD-Windows.zip"
UPDATE_DOWNLOAD_PREFIX = "https://github.com/CMDRWolf258/mongrels-squadron/releases/download/"
POLL_SECONDS = 0.20

TARGET_SCAN_DURATION = 2.1
TARGET_SCAN_FRAMES = 7
TARGET_SCAN_RECENT_LIMIT = 4
TARGET_CAPTURE_REGION = (0.16, 0.25, 0.70, 0.985)
HUD_CYAN = "#8ce7ff"
HUD_WHITE = "#f7fdff"
HUD_MUTED = "#a9c8d3"
HUD_DIM = "#355664"
HUD_SHADOW = "#071319"
HUD_RENDER_SCALE = 1.18
HUD_RED = "#ff4d55"
HUD_AMBER = "#ffb229"
HUD_GREEN = "#67e39a"
HUD_BLUE = "#55aef7"

TACTICAL_MODULES = {
    "Pulse Laser": "offense",
    "Burst Laser": "offense",
    "Beam Laser": "offense",
    "Multi-Cannon": "offense",
    "Cannon": "offense",
    "Fragment Cannon": "offense",
    "Rail Gun": "offense",
    "Plasma Accelerator": "offense",
    "Missile Rack": "offense",
    "Seeker Missile Rack": "offense",
    "Pack-Hound Missile Rack": "offense",
    "Mine Launcher": "offense",
    "Torpedo Pylon": "offense",
    "Shock Cannon": "offense",
    "Enzyme Missile Rack": "offense",
    "Advanced Multi-Cannon": "offense",
    "Advanced Missile Rack": "offense",
    "AX Multi-Cannon": "offense",
    "AX Missile Rack": "offense",
    "Guardian Gauss Cannon": "offense",
    "Guardian Plasma Charger": "offense",
    "Guardian Shard Cannon": "offense",
    "Cytoscrambler": "offense",
    "Enforcer Cannon": "offense",
    "Imperial Hammer": "offense",
    "Pacifier Frag-Cannon": "offense",
    "Retributor": "offense",
    "Shield Generator": "defense",
    "Prismatic Shield Generator": "defense",
    "Bi-Weave Shield Generator": "defense",
    "Shield Cell Bank": "defense",
    "Shield Booster": "defense",
    "Chaff Launcher": "defense",
    "Point Defence": "defense",
    "Heatsink Launcher": "defense",
    "Heat Sink Launcher": "defense",
    "Electronic Countermeasure": "defense",
    "ECM": "defense",
    "Hull Reinforcement Package": "defense",
    "Module Reinforcement Package": "defense",
    "Guardian Shield Reinforcement Package": "defense",
    "Fighter Hangar": "special",
    "FSD Interdictor": "special",
    "Hatch Breaker Limpet Controller": "special",
    "Manifest Scanner": "special",
    "Kill Warrant Scanner": "special",
    "Frame Shift Wake Scanner": "special",
    "Wake Scanner": "special",
    "Pulse Wave Analyser": "special",
    "Mining Laser": "special",
    "Abrasion Blaster": "special",
    "Seismic Charge Launcher": "special",
    "Sub-Surface Displacement Missile": "special",
    "Collector Limpet Controller": "special",
    "Prospector Limpet Controller": "special",
    "Repair Limpet Controller": "special",
    "Fuel Transfer Limpet Controller": "special",
    "Research Limpet Controller": "special",
    "Recon Limpet Controller": "special",
}

CORE_MODULES = (
    "Cargo Hatch",
    "Drive",
    "Thrusters",
    "Power Plant",
    "Frame Shift Drive",
    "Life Support",
    "Power Distributor",
    "Sensors",
    "Shield Generator",
    "Fuel Tank",
    "Cargo Rack",
    "Docking Computer",
    "Advanced Docking Computer",
    "Supercruise Assist",
    "Auto Field-Maintenance Unit",
    "Fuel Scoop",
    "Planetary Vehicle Hangar",
    "Detailed Surface Scanner",
    "Discovery Scanner",
    "Refinery",
)
MODULE_VOCABULARY = tuple(dict.fromkeys((*CORE_MODULES, *TACTICAL_MODULES.keys())))
MODULE_LOOKUP = {" ".join(name.upper().replace("-", " ").split()): name for name in MODULE_VOCABULARY}

PANEL_IDS = ("own", "target", "subsystems", "bounties", "cargo", "surface", "miningintel", "mission", "trade", "scoutboard", "scoutnearby", "alerts", "orderalerts", "notes")
VALID_PROFILES = ("combat", "surface")
PANEL_TITLES = {
    "own": "OWN SHIP",
    "target": "TARGET",
    "subsystems": "TARGET LOADOUT",
    "bounties": "BOUNTIES",
    "cargo": "CARGO",
    "surface": "SURFACE NAVIGATION",
    "miningintel": "MINING INTEL",
    "mission": "MISSION CONTROL",
    "trade": "TRADER'S OUTPOST",
    "scoutboard": "SCOUT BOARD",
    "scoutnearby": "NEAREST SCOUT JOBS",
    "alerts": "FACTION ALERTS",
    "orderalerts": "DAILY ORDER CHANGES",
    "notes": "NOTES",
}


VOICE_PROVIDER_SYSTEM = "system"
VOICE_PROVIDER_WINRT = "winrt"
VOICE_PROVIDER_KOKORO = "kokoro"
VOICE_PROVIDER_LABELS = {
    VOICE_PROVIDER_SYSTEM: "Windows Legacy (System.Speech)",
    VOICE_PROVIDER_WINRT: "Windows Modern (WinRT)",
    VOICE_PROVIDER_KOKORO: "Local Neural · Kokoro",
}
VOICE_PROVIDER_IDS = frozenset(VOICE_PROVIDER_LABELS)

KOKORO_PACK_ID = "kokoro-multi-lang-v1_0"
KOKORO_PACK_DOWNLOAD_BYTES = 374_712_769
KOKORO_ENGINE_VERSION = "1.13.8"
KOKORO_ENGINE_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-win-x64-shared-MT-Release.tar.bz2"
KOKORO_ENGINE_SHA256 = "6dffdc715a4465b989446a6105265d2cb345e7101591a17d35534b6758f6e8df"
KOKORO_ENGINE_BYTES = 24_805_859
KOKORO_MODEL_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2"
KOKORO_MODEL_SHA256 = "c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298"
KOKORO_MODEL_BYTES = 349_906_910
KOKORO_ENGLISH_VOICES = (
    ("af_alloy", 0, "Alloy", "Female", "en-US"),
    ("af_aoede", 1, "Aoede", "Female", "en-US"),
    ("af_bella", 2, "Bella", "Female", "en-US"),
    ("af_heart", 3, "Heart", "Female", "en-US"),
    ("af_jessica", 4, "Jessica", "Female", "en-US"),
    ("af_kore", 5, "Kore", "Female", "en-US"),
    ("af_nicole", 6, "Nicole", "Female", "en-US"),
    ("af_nova", 7, "Nova", "Female", "en-US"),
    ("af_river", 8, "River", "Female", "en-US"),
    ("af_sarah", 9, "Sarah", "Female", "en-US"),
    ("af_sky", 10, "Sky", "Female", "en-US"),
    ("am_adam", 11, "Adam", "Male", "en-US"),
    ("am_echo", 12, "Echo", "Male", "en-US"),
    ("am_eric", 13, "Eric", "Male", "en-US"),
    ("am_fenrir", 14, "Fenrir", "Male", "en-US"),
    ("am_liam", 15, "Liam", "Male", "en-US"),
    ("am_michael", 16, "Michael", "Male", "en-US"),
    ("am_onyx", 17, "Onyx", "Male", "en-US"),
    ("am_puck", 18, "Puck", "Male", "en-US"),
    ("am_santa", 19, "Santa", "Male", "en-US"),
    ("bf_alice", 20, "Alice", "Female", "en-GB"),
    ("bf_emma", 21, "Emma", "Female", "en-GB"),
    ("bf_isabella", 22, "Isabella", "Female", "en-GB"),
    ("bf_lily", 23, "Lily", "Female", "en-GB"),
    ("bm_daniel", 24, "Daniel", "Male", "en-GB"),
    ("bm_fable", 25, "Fable", "Male", "en-GB"),
    ("bm_george", 26, "George", "Male", "en-GB"),
    ("bm_lewis", 27, "Lewis", "Male", "en-GB"),
)
KOKORO_VOICE_SIDS = {key: sid for key, sid, _name, _gender, _culture in KOKORO_ENGLISH_VOICES}


CARRIER_VOICE_CUES: dict[str, dict[str, Any]] = {
    "docking.requested": {"label": "Docking request", "enabled": False, "minDelay": 7.0, "maxDelay": 10.0, "cooldown": 20.0, "phrase": "Docking request transmitted to {carrier}."},
    "docking.granted": {"label": "Docking granted", "enabled": True, "minDelay": 5.0, "maxDelay": 7.0, "cooldown": 20.0, "phrase": "Docking clearance confirmed. Proceed to {pad}."},
    "docking.docked": {"label": "Docked / welcome", "enabled": True, "minDelay": 3.0, "maxDelay": 5.0, "cooldown": 20.0, "phrase": "Welcome aboard {carrier}, Commander."},
    "docking.undocked": {"label": "Undocked / departure", "enabled": True, "minDelay": 4.0, "maxDelay": 6.0, "cooldown": 20.0, "phrase": "Departure complete. Clear of {carrier}. Safe flying, Commander."},
    "carrier.jump_request": {"label": "Jump scheduled", "enabled": True, "minDelay": 3.0, "maxDelay": 5.0, "cooldown": 30.0, "phrase": "{carrier} jump plotted for {destination}. Departure sequence scheduled."},
    "carrier.countdown_10": {"label": "10-minute departure", "enabled": True, "minDelay": 0.0, "maxDelay": 0.0, "cooldown": 30.0, "leadSeconds": 600.0, "phrase": "{carrier} departure in {minutes} minutes. All Commanders should conclude surface and flight operations."},
    "carrier.countdown_5": {"label": "5-minute departure", "enabled": True, "minDelay": 0.0, "maxDelay": 0.0, "cooldown": 30.0, "leadSeconds": 300.0, "phrase": "{carrier} departure in {minutes} minutes. All personnel and vessels prepare for jump."},
    "carrier.jump_cancelled": {"label": "Jump cancelled", "enabled": True, "minDelay": 2.0, "maxDelay": 3.0, "cooldown": 30.0, "phrase": "Carrier jump cancelled. Flight operations returning to normal."},
    "carrier.jump": {"label": "Jump complete", "enabled": True, "minDelay": 8.0, "maxDelay": 11.0, "cooldown": 30.0, "phrase": "{carrier} has arrived in {destination}. Jump complete."},
    "carrier.cooldown_ready": {"label": "Ready for next jump", "enabled": True, "minDelay": 0.0, "maxDelay": 0.0, "cooldown": 30.0, "offsetSeconds": 180.0, "phrase": "{carrier} jump cooldown complete. Carrier is ready to plot the next jump."},
}


def default_voice_settings() -> dict[str, Any]:
    return {
        "enabled": True,
        "carrierPa": True,
        "volume": 75,
        "rate": 0,
        "voiceProvider": VOICE_PROVIDER_SYSTEM,
        "voiceId": "",
        "voiceName": "",
        "cues": {key: dict(value) for key, value in CARRIER_VOICE_CUES.items()},
    }


def normalized_voice_settings(value: Any) -> dict[str, Any]:
    defaults = default_voice_settings()
    raw = value if isinstance(value, dict) else {}
    try:
        volume = int(raw.get("volume", defaults["volume"]))
    except (TypeError, ValueError):
        volume = int(defaults["volume"])
    try:
        rate = int(raw.get("rate", defaults["rate"]))
    except (TypeError, ValueError):
        rate = int(defaults["rate"])
    voice_name = " ".join(str(raw.get("voiceName") or "").split())[:160]
    voice_provider = str(raw.get("voiceProvider") or VOICE_PROVIDER_SYSTEM).strip().lower()
    if voice_provider not in VOICE_PROVIDER_IDS:
        voice_provider = VOICE_PROVIDER_SYSTEM
    voice_id = " ".join(str(raw.get("voiceId") or "").split())[:512]
    # 0.11.x stored only voiceName; migrate legacy selections without changing them.
    if voice_provider == VOICE_PROVIDER_SYSTEM and not voice_id and voice_name:
        voice_id = voice_name
    out = {
        "enabled": bool(raw.get("enabled", defaults["enabled"])),
        "carrierPa": bool(raw.get("carrierPa", defaults["carrierPa"])),
        "volume": max(0, min(100, volume)),
        "rate": max(-3, min(3, rate)),
        "voiceProvider": voice_provider,
        "voiceId": voice_id,
        "voiceName": voice_name,
        "cues": {},
    }
    raw_cues = raw.get("cues") if isinstance(raw.get("cues"), dict) else {}
    for cue, base in CARRIER_VOICE_CUES.items():
        row = raw_cues.get(cue) if isinstance(raw_cues.get(cue), dict) else {}
        try:
            minimum = float(row.get("minDelay", base["minDelay"]))
        except (TypeError, ValueError):
            minimum = float(base["minDelay"])
        try:
            maximum = float(row.get("maxDelay", base["maxDelay"]))
        except (TypeError, ValueError):
            maximum = float(base["maxDelay"])
        try:
            cooldown = float(row.get("cooldown", base["cooldown"]))
        except (TypeError, ValueError):
            cooldown = float(base["cooldown"])
        minimum = max(0.0, min(60.0, minimum))
        maximum = max(minimum, min(60.0, maximum))
        phrase = str(row.get("phrase") if "phrase" in row else base.get("phrase") or "")
        phrase = " ".join(phrase.replace("\r", " ").replace("\n", " ").split())[:600]
        if not phrase:
            phrase = str(base.get("phrase") or "")
        cue_row = {
            "label": base["label"],
            "enabled": bool(row.get("enabled", base["enabled"])),
            "minDelay": round(minimum, 1),
            "maxDelay": round(maximum, 1),
            "cooldown": round(max(0.0, min(300.0, cooldown)), 1),
            "phrase": phrase,
            "defaultPhrase": str(base.get("phrase") or ""),
        }
        if "leadSeconds" in base:
            cue_row["leadSeconds"] = float(base["leadSeconds"])
        if "offsetSeconds" in base:
            try:
                offset = float(row.get("offsetSeconds", base["offsetSeconds"]))
            except (TypeError, ValueError):
                offset = float(base["offsetSeconds"])
            cue_row["offsetSeconds"] = round(max(0.0, min(900.0, offset)), 1)
        out["cues"][cue] = cue_row
    return out


def public_endpoint(value: Any) -> str:
    try:
        parsed = urlparse(str(value or ""))
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


def safe_error_code(value: Any) -> str:
    return value if isinstance(value, str) and "mscout_" not in value and re.fullmatch(r"[a-z0-9][a-z0-9_.:-]{0,119}", value) else ""


def scout_diagnostics(payload: Any, endpoint: str, bridge_status: int | None, fallback: str, response_format: str = "json") -> dict[str, Any]:
    fields = payload if isinstance(payload, dict) else {}
    upstream = fields.get("upstreamStatus")
    upstream = upstream if type(upstream) is int and 100 <= upstream <= 599 else None
    error_code = safe_error_code(fields.get("errorCode")) or safe_error_code(fields.get("error")) or fallback
    request_id = fields.get("requestId")
    request_id = request_id if isinstance(request_id, str) and "mscout_" not in request_id and re.fullmatch(r"[A-Za-z0-9_-]{1,100}", request_id) else ""
    format_value = fields.get("responseFormat")
    format_value = format_value if format_value in {"json", "invalid_json", "html", "text", "unknown", ""} else response_format
    parts = []
    if bridge_status is not None:
        parts.append(f"Scout HTTP {bridge_status}")
    if upstream is not None:
        parts.append(f"upstream HTTP {upstream}")
    if error_code:
        parts.append(f"Cloudflare {error_code}" if error_code in {"1101", "1102"} else error_code)
    # Never copy raw response bodies or exception messages into diagnostics.
    return {
        "bridgeEndpoint": public_endpoint(endpoint),
        "bridgeStatus": bridge_status,
        "endpoint": public_endpoint(fields.get("endpoint")) or public_endpoint(endpoint),
        "upstreamStatus": upstream,
        "errorCode": error_code,
        "requestId": request_id,
        "responseFormat": format_value,
        "detail": " · ".join(parts) if parts else "Connection failed",
    }


class HudRequestError(Exception):
    def __init__(self, diagnostics: dict[str, Any], status: int = 502):
        self.diagnostics = diagnostics
        self.status = status if 400 <= status <= 599 else 502
        self.error_code = str(diagnostics.get("errorCode") or "scout_request_failed")
        super().__init__(str(diagnostics.get("detail") or self.error_code))


def request_scout_json(request: Any, error_code: str, timeout: float = 10.0) -> dict[str, Any]:
    endpoint = request.full_url if isinstance(request, urllib.request.Request) else str(request)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = int(getattr(response, "status", 200) or 200)
            try:
                payload = json.load(response)
            except (ValueError, UnicodeError) as exc:
                diagnostics = scout_diagnostics(None, endpoint, status, "invalid_scout_json", "invalid_json")
                raise HudRequestError(diagnostics) from exc
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read(16384).decode("utf-8"))
            response_format = "json"
        except (ValueError, UnicodeError, OSError):
            payload = None
            content_type = str(exc.headers.get("Content-Type", "") if exc.headers else "").lower()
            response_format = "invalid_json" if "json" in content_type else "html" if "html" in content_type else "text" if "text/" in content_type else "unknown"
        diagnostics = scout_diagnostics(payload, endpoint, exc.code, error_code, response_format)
        raise HudRequestError(diagnostics, exc.code) from exc
    except HudRequestError:
        raise
    except Exception as exc:
        reason = exc.reason if isinstance(exc, urllib.error.URLError) else exc
        category = type(reason).__name__
        category = category if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,79}", category) else "NetworkError"
        diagnostics = scout_diagnostics(None, endpoint, None, f"network:{category}", "")
        diagnostics["detail"] = f"Connection failed ({category})"
        raise HudRequestError(diagnostics) from exc
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        diagnostics = scout_diagnostics(payload, endpoint, status, error_code)
        upstream = diagnostics.get("upstreamStatus")
        raise HudRequestError(diagnostics, upstream if isinstance(upstream, int) else 502)
    return payload


def _validated_mining_center(value: Any, *, body: str | None = None, signal: int | None = None, require_central_id: bool = True) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("invalid_mining_center_response")
    center = dict(value)
    raw_id, raw_signal = center.get("id"), center.get("signal")
    valid_id = type(raw_id) is int or isinstance(raw_id, str) and raw_id.isdecimal()
    if (require_central_id and not valid_id) or (not require_central_id and raw_id is not None and not valid_id) or not (type(raw_signal) is int or isinstance(raw_signal, str) and raw_signal.isdecimal()):
        raise ValueError("invalid_mining_center_response")
    if valid_id:
        center["id"] = int(raw_id)
    center["signal"] = int(raw_signal)
    center_body = str(center.get("body") or "").strip().lower()
    if (require_central_id and center["id"] <= 0) or (valid_id and center["id"] < 0) or center["signal"] <= 0 or not re.fullmatch(r"\d+[a-z]*", center_body):
        raise ValueError("invalid_mining_center_response")
    if (body is not None and center_body != body.strip().lower()) or (signal is not None and center["signal"] != signal):
        raise ValueError("invalid_mining_center_response")
    for field, bound in (("latitude", 90), ("longitude", 180)):
        raw = center.get(field)
        if isinstance(raw, bool) or not isinstance(raw, (int, float, str)):
            raise ValueError("invalid_mining_center_response")
        try:
            number = float(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("invalid_mining_center_response") from exc
        if not math.isfinite(number) or abs(number) > bound:
            raise ValueError("invalid_mining_center_response")
        center[field] = number
    center["body"] = center_body
    center["systemName"] = str(center.get("systemName") or TEN16_SYSTEM).strip()
    center["systemAddress"] = str(center.get("systemAddress") or "").strip()
    if center["systemAddress"]:
        if center["systemAddress"] != TEN16_ID64:
            raise ValueError("invalid_mining_center_response")
        # The exact journal system address establishes the host system even
        # when an earlier report retained an outdated display name.
        center["systemName"] = TEN16_SYSTEM
    elif center["systemName"].casefold() != TEN16_SYSTEM.casefold():
        raise ValueError("invalid_mining_center_response")
    return center


def canonical_mining_center(value: Any, *, body: str | None = None, signal: int | None = None) -> dict[str, Any]:
    return _validated_mining_center(value, body=body, signal=signal)


def cached_mining_center(value: Any) -> dict[str, Any]:
    # Older saved, measured coordinates may predate a confirmed central ID.
    # Keep them only as an explicit outage fallback, never an API/save success.
    center = _validated_mining_center(value, require_central_id=False)
    center["cacheOnly"] = not (type(center.get("id")) is int and center["id"] > 0)
    return center


def default_layout() -> dict[str, Any]:
    return {
        "locked": True,
        "masterVisible": True,
        "panels": {
            "own": {"x": 40, "y": 70, "visible": True, "scale": 1.0, "profiles": ["combat"]},
            "target": {"x": 40, "y": 270, "visible": True, "scale": 1.0, "profiles": ["combat"]},
            "bounties": {"x": 40, "y": 455, "visible": True, "scale": 1.0, "profiles": ["combat"]},
            "cargo": {"x": 420, "y": 455, "visible": False, "scale": 0.9, "profiles": ["combat", "surface"]},
            "subsystems": {"x": 760, "y": 70, "visible": True, "scale": 1.0, "profiles": ["combat"]},
            "surface": {"x": 40, "y": 70, "visible": True, "scale": 1.0, "profiles": ["surface"]},
            "miningintel": {"x": 40, "y": 350, "visible": True, "scale": 0.9, "profiles": ["surface"]},
            "mission": {"x": 1260, "y": 70, "visible": True, "scale": 0.9, "profiles": ["combat", "surface"]},
            "trade": {"x": 1260, "y": 315, "visible": False, "scale": 0.9, "profiles": ["combat", "surface"]},
            "scoutboard": {"x": 1260, "y": 540, "visible": False, "scale": 0.9, "profiles": ["combat", "surface"]},
            "scoutnearby": {"x": 1260, "y": 790, "visible": False, "scale": 0.9, "profiles": ["combat", "surface"]},
            "alerts": {"x": 760, "y": 560, "visible": True, "scale": 1.0, "profiles": ["combat", "surface"]},
            "orderalerts": {"x": 760, "y": 880, "visible": True, "scale": 1.0, "profiles": ["combat", "surface"]},
            "notes": {"x": 40, "y": 650, "visible": False, "scale": 1.0, "profiles": ["combat", "surface"]},
        },
    }


def normalized_layout(value: Any) -> dict[str, Any]:
    defaults = default_layout()
    layout = value if isinstance(value, dict) else {}
    out = {
        "locked": bool(layout.get("locked", defaults["locked"])),
        "masterVisible": bool(layout.get("masterVisible", defaults["masterVisible"])),
        "panels": {},
    }
    panels = layout.get("panels") if isinstance(layout.get("panels"), dict) else {}
    for panel_id in PANEL_IDS:
        base = defaults["panels"][panel_id]
        raw = panels.get(panel_id) if isinstance(panels.get(panel_id), dict) else {}
        try:
            scale = float(raw.get("scale", base["scale"]))
        except (TypeError, ValueError):
            scale = float(base["scale"])
        try:
            x = int(raw.get("x", base["x"]))
        except (TypeError, ValueError):
            x = int(base["x"])
        try:
            y = int(raw.get("y", base["y"]))
        except (TypeError, ValueError):
            y = int(base["y"])
        raw_profiles = raw.get("profiles")
        if isinstance(raw_profiles, list):
            profiles = [profile for profile in VALID_PROFILES if profile in raw_profiles]
        else:
            profiles = list(base.get("profiles") or VALID_PROFILES)
        if not profiles:
            profiles = list(base.get("profiles") or VALID_PROFILES)
        out["panels"][panel_id] = {
            "x": x,
            "y": y,
            "visible": bool(raw.get("visible", base["visible"])),
            "scale": max(0.75, min(1.5, scale)),
            "profiles": profiles,
        }
    return out



def resource_path(name: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / name


def local_ipv4() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("10.255.255.255", 1))
        return str(sock.getsockname()[0])
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def version_tuple(value: Any) -> tuple[int, ...]:
    text = str(value or "").strip().lstrip("vV")
    match = re.fullmatch(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?", text)
    if not match:
        return ()
    return tuple(int(part or 0) for part in match.groups())


def update_from_release_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("invalid_release_payload")
    title = str(payload.get("name") or payload.get("tag_name") or "")
    match = re.search(r"\bv?(\d+\.\d+\.\d+)\b", title, flags=re.IGNORECASE)
    version = match.group(1) if match else ""
    assets = payload.get("assets")
    assets = assets if isinstance(assets, list) else []
    asset = next((row for row in assets if isinstance(row, dict) and str(row.get("name") or "") == UPDATE_ASSET_NAME), None)
    if not version or asset is None:
        raise ValueError("release_metadata_incomplete")
    url = str(asset.get("browser_download_url") or "")
    digest = str(asset.get("digest") or "")
    if not url.startswith(UPDATE_DOWNLOAD_PREFIX):
        raise ValueError("release_download_url_rejected")
    if not re.fullmatch(r"sha256:[0-9a-fA-F]{64}", digest):
        raise ValueError("release_digest_missing")
    return {
        "version": version,
        "url": url,
        "digest": digest.lower(),
        "size": int(asset.get("size") or 0),
    }


def _powershell_quote(value: Any) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def _powershell_release_json() -> dict[str, Any]:
    if os.name != "nt":
        raise RuntimeError("windows_required")
    script = (
        "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';"
        "$headers=@{'User-Agent'='MongrelHUD-" + APP_VERSION + "'};"
        "$r=Invoke-RestMethod -UseBasicParsing -Headers $headers -Uri "
        + _powershell_quote(UPDATE_RELEASE_API)
        + ";$r|ConvertTo-Json -Depth 8 -Compress"
    )
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        capture_output=True,
        text=True,
        timeout=20,
        creationflags=flags,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("update_check_failed")
    try:
        value = json.loads(result.stdout)
    except Exception as exc:
        raise RuntimeError("update_check_invalid_json") from exc
    if not isinstance(value, dict):
        raise RuntimeError("update_check_invalid_json")
    return value


def _powershell_download(url: str, destination: Path) -> None:
    if os.name != "nt":
        raise RuntimeError("windows_required")
    if not str(url).startswith(UPDATE_DOWNLOAD_PREFIX):
        raise RuntimeError("update_download_url_rejected")
    destination.parent.mkdir(parents=True, exist_ok=True)
    script = (
        "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';"
        "Invoke-WebRequest -UseBasicParsing -Headers @{'User-Agent'='MongrelHUD-" + APP_VERSION + "'} -Uri "
        + _powershell_quote(url)
        + " -OutFile "
        + _powershell_quote(str(destination))
    )
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        capture_output=True,
        text=True,
        timeout=180,
        creationflags=flags,
        check=False,
    )
    if result.returncode != 0 or not destination.is_file():
        raise RuntimeError("update_download_failed")


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _start_mdns_service() -> tuple[Any, Any] | None:
    if not MDNS_AVAILABLE or Zeroconf is None or ServiceInfo is None:
        return None
    address = local_ipv4()
    if address == "127.0.0.1":
        return None
    zeroconf = None
    try:
        info = ServiceInfo(
            "_http._tcp.local.",
            "Mongrel HUD._http._tcp.local.",
            addresses=[socket.inet_aton(address)],
            port=CONTROLLER_PORT,
            properties={"path": "/", "version": APP_VERSION},
            server=CONTROLLER_HOSTNAME + ".",
        )
        zeroconf = Zeroconf()
        zeroconf.register_service(info)
        return zeroconf, info
    except Exception:
        try:
            zeroconf.close()
        except Exception:
            pass
        return None


def _stop_mdns_service(handle: tuple[Any, Any] | None) -> None:
    if not handle:
        return
    zeroconf, info = handle
    try:
        zeroconf.unregister_service(info)
    except Exception:
        pass
    try:
        zeroconf.close()
    except Exception:
        pass


def body_key(state: dict[str, Any]) -> str:
    status = state.get("status") or {}
    system = state.get("system") or {}
    address = str(system.get("address") or "").strip()
    body = str(status.get("bodyName") or "").strip()
    return f"{address}|{body.casefold()}" if address and body else ""


def short_body_name(state: dict[str, Any]) -> str:
    status = state.get("status") or {}
    system = state.get("system") or {}
    body = " ".join(str(status.get("bodyName") or "").split())
    system_name = " ".join(str(system.get("name") or "").split())
    if system_name and body.casefold().startswith((system_name + " ").casefold()):
        body = body[len(system_name):].strip()
    match = re.search(r"(\d+)\s*([A-Za-z]+)?$", body)
    if match:
        return f"{match.group(1)}{(match.group(2) or '').lower()}"
    return body


def body_type_for_short_name(body: str) -> str:
    value = str(body or "").strip()
    if re.fullmatch(r"\d+", value):
        return "planet"
    if re.fullmatch(r"\d+[A-Za-z]+", value):
        return "moon"
    return ""


def great_circle_nav(lat1: float, lon1: float, lat2: float, lon2: float, radius_m: float, heading: float | None = None) -> dict[str, float]:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = p2 - p1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    central = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))
    y = math.sin(dlon) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dlon)
    bearing = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    out = {"distance": max(0.0, radius_m) * central, "bearing": bearing}
    if heading is not None:
        out["relative"] = ((bearing - heading + 540.0) % 360.0) - 180.0
    return out


def format_distance(meters: float | None) -> str:
    if meters is None:
        return "—"
    if meters < 1000:
        return f"{meters:.0f} m"
    if meters < 100000:
        return f"{meters / 1000:.2f} km"
    return f"{meters / 1000:.1f} km"


def relative_text(value: float | None) -> str:
    if value is None:
        return ""
    if abs(value) <= 5:
        return "AHEAD"
    return f"{abs(value):.0f}° {'RIGHT' if value > 0 else 'LEFT'}"


def iso_age(value: str | None) -> str:
    if not value:
        return "?"
    try:
        observed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        seconds = max(0, int((datetime.now(timezone.utc) - observed).total_seconds()))
    except Exception:
        return "?"
    if seconds < 60:
        return f"{seconds}s"
    return f"{seconds // 60}m"



def normalized_module_text(value: Any) -> str:
    text = str(value or "").upper()
    for source, target in (("0", "O"), ("|", "I")):
        text = text.replace(source, target)
    text = text.replace("-", " ")
    return " ".join("".join(ch if ch.isalnum() or ch == " " else " " for ch in text).split())


def match_module_name(value: Any) -> str | None:
    text = normalized_module_text(value)
    if not text or text in {"NAME", "HEALTH", "POWER", "SUB TARGETS", "SUBTARGETS", "TARGET"}:
        return None
    exact = MODULE_LOOKUP.get(text)
    if exact:
        return exact
    contained = [canonical for key, canonical in MODULE_LOOKUP.items() if len(key) >= 5 and key in text]
    if contained:
        return max(contained, key=len)
    best_name = None
    best_score = 0.0
    for key, canonical in MODULE_LOOKUP.items():
        score = difflib.SequenceMatcher(None, text, key, autojunk=False).ratio()
        if score > best_score:
            best_score = score
            best_name = canonical
    return best_name if best_score >= 0.72 else None


def _merge_module_frame(merged: list[str], current: list[str]) -> list[str]:
    if not merged:
        return list(current)
    if not current:
        return list(merged)

    # A frame already fully represented adds nothing. Likewise, a wider frame
    # can safely replace a narrower one without multiplying modules.
    for start in range(0, max(1, len(merged) - len(current) + 1)):
        if merged[start:start + len(current)] == current:
            return list(merged)
    for start in range(0, max(1, len(current) - len(merged) + 1)):
        if current[start:start + len(merged)] == merged:
            return list(current)

    max_overlap = min(len(merged), len(current))
    for size in range(max_overlap, 0, -1):
        if merged[-size:] == current[:size]:
            return merged + current[size:]
        if current[-size:] == merged[:size]:
            return current[:-size] + merged

    # OCR can miss one line between captures, so allow a strong edge-adjacent
    # sequence match in either direction. This supports scrolling up OR down.
    forward = difflib.SequenceMatcher(None, merged[-14:], current, autojunk=False).find_longest_match(
        0, min(14, len(merged)), 0, len(current)
    )
    if forward.size >= 2 and forward.b <= 2 and forward.a + forward.size >= max(1, min(14, len(merged)) - 2):
        return merged + current[forward.b + forward.size:]

    reverse = difflib.SequenceMatcher(None, current[-14:], merged, autojunk=False).find_longest_match(
        0, min(14, len(current)), 0, len(merged)
    )
    if reverse.size >= 2 and reverse.b <= 2 and reverse.a + reverse.size >= max(1, min(14, len(current)) - 2):
        prefix_end = max(0, len(current) - 14 + reverse.a)
        return current[:prefix_end] + merged

    # No trustworthy overlap means the user's scroll outran the capture or OCR
    # changed too much. Skipping one uncertain frame is safer than inventing
    # duplicate hardpoints/modules.
    return list(merged)


def stitch_module_frames(frames: list[list[str]]) -> list[str]:
    merged: list[str] = []
    for frame in frames:
        current = [name for name in frame if name]
        if current:
            merged = _merge_module_frame(merged, current)
    return merged


def tactical_module_groups(modules: list[str]) -> dict[str, list[dict[str, Any]]]:
    groups = {"offense": [], "defense": [], "special": []}
    counters = {key: Counter() for key in groups}
    order = {key: [] for key in groups}
    for module in modules:
        category = TACTICAL_MODULES.get(module)
        if not category:
            continue
        canonical = "Heatsink Launcher" if module == "Heat Sink Launcher" else module
        if counters[category][canonical] == 0:
            order[category].append(canonical)
        counters[category][canonical] += 1
    for category in groups:
        groups[category] = [{"name": name, "count": counters[category][name]} for name in order[category]]
    return groups


class LocalStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()
        self.data: dict[str, Any] = {"profile": "combat", "sites": {}, "activeSite": None, "activeMiningLocationSignal": None, "activeMiningSiteId": None, "miningCenters": [], "deposits": [], "bounty": {"unclaimed": 0}, "eventCursor": {"sessionId": "", "seq": 0}, "layout": default_layout(), "notes": "", "missionSystem": "all", "controllerAuth": {"tokenHashes": []}, "voice": default_voice_settings(), "voiceSchedule": []}
        self.load()
        self.data["layout"] = normalized_layout(self.data.get("layout"))
        self.data["voice"] = normalized_voice_settings(self.data.get("voice"))
        auth = self.data.get("controllerAuth")
        hashes = auth.get("tokenHashes") if isinstance(auth, dict) else []
        hashes = hashes if isinstance(hashes, list) else []
        self.data["controllerAuth"] = {
            "tokenHashes": [
                value.lower() for value in hashes
                if isinstance(value, str) and re.fullmatch(r"[0-9a-fA-F]{64}", value)
            ][-MAX_TRUSTED_CONTROLLER_TOKENS:]
        }

    def load(self) -> None:
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(value, dict):
                self.data.update(value)
        except Exception:
            pass

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.path)


@dataclass
class ScoutSnapshot:
    data: dict[str, Any]
    connected: bool = False
    error: str = ""


class MongrelHudApp:
    def __init__(self, store: LocalStore, controller_html: str):
        self.store = store
        self.controller_html = controller_html
        self.lock = threading.RLock()
        self.snapshot = ScoutSnapshot({})
        self.pin = f"{secrets.randbelow(1000000):06d}"
        self.overlay_visible = True
        self.root: tk.Tk | None = None
        self.panel_windows: dict[str, dict[str, Any]] = {}
        self.layout_revision = 0
        self.status_label: tk.Label | None = None
        self.profile_label: tk.Label | None = None
        self.pin_label: tk.Label | None = None
        self.paired_label: tk.Label | None = None
        self.update_label: tk.Label | None = None
        self.update_button: tk.Button | None = None
        self.update_lock = threading.RLock()
        self.update_status: dict[str, Any] = {"checking": False, "installing": False, "available": False, "version": None, "url": None, "digest": None, "error": ""}
        self.exit_for_update = threading.Event()
        self.voice_condition = threading.Condition()
        self.voice_pending: list[dict[str, Any]] = []
        self.voice_last_scheduled: dict[str, float] = {}
        self.voice_runtime: dict[str, Any] = {"speaking": False, "lastCue": "", "lastText": "", "lastSpokenAt": "", "lastError": ""}
        self.voice_catalog: list[dict[str, str]] = []
        self.voice_catalog_error = ""
        self.voice_catalog_errors: dict[str, str] = {}
        self.voice_pack_lock = threading.RLock()
        self.voice_pack_status: dict[str, Any] = {
            "pack": "Kokoro",
            "installed": False,
            "active": False,
            "action": "",
            "phase": "checking",
            "progress": 0,
            "message": "Checking local neural voice pack…",
            "error": "",
            "downloadBytes": KOKORO_PACK_DOWNLOAD_BYTES,
            "installedBytes": 0,
        }
        self.run_bounty = 0
        self.run_kills = 0
        self.last_bounty = 0
        self.ocr_lock = threading.RLock()
        self.ocr_engine: Any = None
        self.ocr_status = {"available": OCR_AVAILABLE, "ready": False, "error": "" if OCR_AVAILABLE else "ocr_unavailable"}
        self.target_scan_status = {"active": False, "phase": "idle", "progress": 0, "message": "Ready", "error": ""}
        self.recent_targets: list[dict[str, Any]] = []
        self.restored_target_until = 0.0
        self.wanted_flash_until = 0.0
        self._wanted_flash_key = ""
        self._last_target_identity = ""
        self.mining_lock = threading.RLock()
        self.mining_sites: list[dict[str, Any]] = []
        with self.store.lock:
            cached_centers = self.store.data.get("miningCenters")
            cached_centers = cached_centers if isinstance(cached_centers, list) else []
        self.mining_centers: list[dict[str, Any]] = []
        for row in cached_centers:
            try:
                self.mining_centers.append(cached_mining_center(row))
            except ValueError:
                continue
        self.mining_centers_source = "cache" if self.mining_centers else "unavailable"
        self.mining_status = {"ok": False, "updatedAt": None, "error": "not_started"}
        threading.Thread(target=self._warm_ocr, name="MongrelHudOcrWarmup", daemon=True).start()
        threading.Thread(target=self._mining_sync_loop, name="MongrelHudMiningSync", daemon=True).start()
        self._restore_scheduled_voice()
        self._refresh_voice_pack_status()
        threading.Thread(target=self._voice_catalog_worker, name="MongrelHudVoiceCatalog", daemon=True).start()
        threading.Thread(target=self._voice_loop, name="MongrelHudVoice", daemon=True).start()

    def scout_state(self) -> dict[str, Any]:
        with self.lock:
            return json.loads(json.dumps(self.snapshot.data))

    def poll_scout(self) -> None:
        while True:
            try:
                with urllib.request.urlopen(SCOUT_STATE_URL, timeout=1.0) as response:
                    data = json.load(response)
                with self.lock:
                    self.snapshot = ScoutSnapshot(data, True, "")
                try:
                    self.poll_scout_events(data)
                except Exception:
                    pass
            except Exception as exc:
                with self.lock:
                    self.snapshot.connected = False
                    self.snapshot.error = str(exc)
            time.sleep(POLL_SECONDS)

    def poll_scout_events(self, state: dict[str, Any]) -> None:
        session_id = str(state.get("sessionId") or "")
        if not session_id:
            return
        with self.store.lock:
            cursor = self.store.data.get("eventCursor")
            if not isinstance(cursor, dict):
                cursor = {"sessionId": "", "seq": 0}
            after = int(cursor.get("seq") or 0) if str(cursor.get("sessionId") or "") == session_id else 0
        url = f"{SCOUT_EVENTS_URL}?after={after}&wait=0"
        with urllib.request.urlopen(url, timeout=1.0) as response:
            payload = json.load(response)
        events = payload.get("events") or []
        for event in events:
            if isinstance(event, dict):
                self.process_scout_event(event)
        latest = int(payload.get("latestSeq") or after)
        with self.store.lock:
            self.store.data["eventCursor"] = {"sessionId": session_id, "seq": latest}
            self.store.save()

    def process_scout_event(self, event: dict[str, Any]) -> None:
        event_type = str(event.get("type") or "")
        if event_type == "bounty.awarded":
            amount = max(0, int(event.get("totalReward") or 0))
            if amount <= 0:
                return
            self.run_bounty += amount
            self.run_kills += 1
            self.last_bounty = amount
            with self.store.lock:
                ledger = self.store.data.setdefault("bounty", {"unclaimed": 0})
                ledger["unclaimed"] = max(0, int(ledger.get("unclaimed") or 0) + amount)
                self.store.save()
        elif event_type == "bounty.redeemed":
            amount = max(0, int(event.get("amount") or 0))
            with self.store.lock:
                ledger = self.store.data.setdefault("bounty", {"unclaimed": 0})
                ledger["unclaimed"] = max(0, int(ledger.get("unclaimed") or 0) - amount)
                self.store.save()
        elif event_type == "ship.died":
            with self.store.lock:
                ledger = self.store.data.setdefault("bounty", {"unclaimed": 0})
                ledger["unclaimed"] = 0
                self.store.save()
        self.handle_voice_event(event)


    def voice_settings_snapshot(self) -> dict[str, Any]:
        with self.store.lock:
            return json.loads(json.dumps(normalized_voice_settings(self.store.data.get("voice"))))

    def voice_catalog_snapshot(self) -> list[dict[str, str]]:
        with self.lock:
            return json.loads(json.dumps(self.voice_catalog))

    def voice_status_snapshot(self) -> dict[str, Any]:
        with self.voice_condition:
            status = dict(self.voice_runtime)
            status["queued"] = len(self.voice_pending)
        with self.store.lock:
            schedule = self.store.data.get("voiceSchedule")
            status["scheduled"] = len(schedule) if isinstance(schedule, list) else 0
        with self.lock:
            status["catalogError"] = self.voice_catalog_error
            status["catalogErrors"] = dict(self.voice_catalog_errors)
        return status

    def set_voice_settings(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("voice_settings_required")
        with self.store.lock:
            current = normalized_voice_settings(self.store.data.get("voice"))
            for key in ("enabled", "carrierPa", "volume", "rate", "voiceProvider", "voiceId", "voiceName"):
                if key in value:
                    current[key] = value[key]
            cue_updates = value.get("cues")
            if isinstance(cue_updates, dict):
                merged_cues = current.get("cues") if isinstance(current.get("cues"), dict) else {}
                for cue, update in cue_updates.items():
                    if cue not in CARRIER_VOICE_CUES or not isinstance(update, dict):
                        continue
                    row = dict(merged_cues.get(cue) or CARRIER_VOICE_CUES[cue])
                    for key in ("enabled", "minDelay", "maxDelay", "cooldown", "phrase", "offsetSeconds"):
                        if key in update:
                            row[key] = update[key]
                    merged_cues[cue] = row
                current["cues"] = merged_cues
            normalized = normalized_voice_settings(current)
            self.store.data["voice"] = normalized
            self.store.save()
        if not normalized["enabled"] or not normalized["carrierPa"]:
            with self.voice_condition:
                self.voice_pending = [row for row in self.voice_pending if bool(row.get("persistentId"))]
                self.voice_condition.notify_all()
        return self.voice_settings_snapshot()

    def _owner_carrier_for_voice(self) -> dict[str, Any]:
        state = self.scout_state()
        owner = state.get("ownerCarrier")
        return dict(owner) if isinstance(owner, dict) else {}

    def _is_owner_carrier_event(self, event: dict[str, Any]) -> bool:
        if str(event.get("relationship") or "").casefold() == "owner":
            return True
        owner = self._owner_carrier_for_voice()
        owner_id = str(owner.get("carrierId") or "")
        event_id = str(event.get("carrierId") or event.get("marketId") or "")
        return bool(owner_id and event_id and secrets.compare_digest(owner_id, event_id))

    def _carrier_voice_name(self, event: dict[str, Any]) -> str:
        stored_name = " ".join(str(event.get("carrierName") or "").split())
        if stored_name:
            return stored_name
        carrier = event.get("carrier")
        if isinstance(carrier, dict):
            name = " ".join(str(carrier.get("name") or "").split())
            if name:
                return name
        owner = self._owner_carrier_for_voice()
        name = " ".join(str(owner.get("name") or "").split())
        if name:
            return name
        station = " ".join(str(event.get("stationName") or "").split())
        return station or "the carrier"

    def _voice_text_for_event(self, cue: str, event: dict[str, Any]) -> str:
        settings = self.voice_settings_snapshot()
        row = (settings.get("cues") or {}).get(cue) or {}
        phrase = str(row.get("phrase") or CARRIER_VOICE_CUES.get(cue, {}).get("phrase") or "")
        if not phrase:
            return ""
        pad = event.get("landingPad")
        pad_text = f"pad {int(pad)}" if isinstance(pad, int) else "your assigned pad"
        destination = " ".join(str(event.get("destinationSystem") or event.get("system") or "").split()) or "your destination"
        minutes = event.get("minutes")
        if not isinstance(minutes, (int, float)):
            lead = CARRIER_VOICE_CUES.get(cue, {}).get("leadSeconds")
            minutes = int(round(float(lead) / 60.0)) if isinstance(lead, (int, float)) else ""
        replacements = {
            "{carrier}": self._carrier_voice_name(event),
            "{destination}": destination,
            "{pad}": pad_text,
            "{minutes}": str(int(minutes)) if isinstance(minutes, (int, float)) else str(minutes or ""),
        }
        text = phrase
        for token, replacement in replacements.items():
            text = text.replace(token, replacement)
        return " ".join(text.split())[:600]

    @staticmethod
    def _parse_voice_time(value: Any) -> datetime | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _voice_schedule_context(event: dict[str, Any]) -> dict[str, Any]:
        allowed = ("relationship", "carrierId", "marketId", "stationName", "destinationSystem", "system", "landingPad", "minutes", "carrierName")
        out = {key: event.get(key) for key in allowed if event.get(key) is not None}
        return out

    def _persist_scheduled_voice(self, schedule_id: str, cue: str, fire_at: datetime, event: dict[str, Any]) -> None:
        row = {
            "id": schedule_id,
            "cue": cue,
            "fireAt": fire_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "event": self._voice_schedule_context(event),
        }
        with self.store.lock:
            schedule = self.store.data.get("voiceSchedule")
            schedule = list(schedule) if isinstance(schedule, list) else []
            schedule = [item for item in schedule if isinstance(item, dict) and str(item.get("id") or "") != schedule_id and str(item.get("cue") or "") != cue]
            schedule.append(row)
            self.store.data["voiceSchedule"] = schedule[-16:]
            self.store.save()

    def _remove_persisted_voice(self, *, schedule_id: str = "", cues: set[str] | None = None) -> None:
        with self.store.lock:
            schedule = self.store.data.get("voiceSchedule")
            schedule = list(schedule) if isinstance(schedule, list) else []
            filtered = []
            for row in schedule:
                if not isinstance(row, dict):
                    continue
                if schedule_id and str(row.get("id") or "") == schedule_id:
                    continue
                if cues and str(row.get("cue") or "") in cues:
                    continue
                filtered.append(row)
            if filtered != schedule:
                self.store.data["voiceSchedule"] = filtered
                self.store.save()

    def _restore_scheduled_voice(self) -> None:
        with self.store.lock:
            schedule = self.store.data.get("voiceSchedule")
            schedule = list(schedule) if isinstance(schedule, list) else []
        now = datetime.now(timezone.utc)
        keep: list[dict[str, Any]] = []
        for row in schedule:
            if not isinstance(row, dict):
                continue
            cue = str(row.get("cue") or "")
            fire_at = self._parse_voice_time(row.get("fireAt"))
            event = row.get("event") if isinstance(row.get("event"), dict) else {}
            schedule_id = str(row.get("id") or "")
            if cue not in CARRIER_VOICE_CUES or fire_at is None or fire_at <= now or not schedule_id:
                continue
            self._queue_scheduled_voice(cue, event, fire_at, persist=False, schedule_id=schedule_id)
            keep.append(row)
        if keep != schedule:
            with self.store.lock:
                self.store.data["voiceSchedule"] = keep
                self.store.save()

    def _queue_scheduled_voice(self, cue: str, event: dict[str, Any], fire_at: datetime, *, persist: bool = True, schedule_id: str = "") -> bool:
        settings = self.voice_settings_snapshot()
        row = (settings.get("cues") or {}).get(cue) or {}
        if cue not in CARRIER_VOICE_CUES or not row.get("enabled"):
            return False
        now_utc = datetime.now(timezone.utc)
        seconds = (fire_at.astimezone(timezone.utc) - now_utc).total_seconds()
        if seconds <= 0.5:
            return False
        if not schedule_id:
            schedule_id = f"{cue}:{int(fire_at.timestamp())}"
        if persist:
            self._persist_scheduled_voice(schedule_id, cue, fire_at, event)
        with self.voice_condition:
            self.voice_pending = [item for item in self.voice_pending if str(item.get("cue") or "") != cue]
            self.voice_pending.append({
                "cue": cue,
                "event": self._voice_schedule_context(event),
                "due": time.monotonic() + seconds,
                "persistentId": schedule_id,
            })
            self.voice_pending.sort(key=lambda item: float(item.get("due") or 0.0))
            self.voice_condition.notify_all()
        return True

    def _queue_configured_voice(self, cue: str, event: dict[str, Any]) -> bool:
        settings = self.voice_settings_snapshot()
        if not settings.get("enabled") or not settings.get("carrierPa"):
            return False
        row = (settings.get("cues") or {}).get(cue) or {}
        if not row.get("enabled"):
            return False
        now = time.monotonic()
        cooldown = max(0.0, float(row.get("cooldown") or 0.0))
        with self.voice_condition:
            previous = float(self.voice_last_scheduled.get(cue) or 0.0)
            if previous and now - previous < cooldown:
                return False
            minimum = max(0.0, float(row.get("minDelay") or 0.0))
            maximum = max(minimum, float(row.get("maxDelay") or minimum))
            fraction = secrets.randbelow(1_000_001) / 1_000_000.0 if maximum > minimum else 0.0
            self.voice_last_scheduled[cue] = now
            self.voice_pending.append({
                "cue": cue,
                "event": self._voice_schedule_context(event),
                "due": now + minimum + ((maximum - minimum) * fraction),
            })
            self.voice_pending.sort(key=lambda item: float(item.get("due") or 0.0))
            self.voice_condition.notify_all()
        return True

    def _cancel_voice_cues(self, *cues: str) -> None:
        wanted = {str(cue) for cue in cues if cue}
        if not wanted:
            return
        with self.voice_condition:
            self.voice_pending = [row for row in self.voice_pending if str(row.get("cue") or "") not in wanted]
            self.voice_condition.notify_all()
        self._remove_persisted_voice(cues=wanted)

    def _schedule_departure_countdowns(self, event: dict[str, Any]) -> None:
        departure = self._parse_voice_time(event.get("departureTime"))
        if departure is None:
            return
        base_event = self._voice_schedule_context(event)
        base_event["carrierName"] = self._carrier_voice_name(event)
        for cue in ("carrier.countdown_10", "carrier.countdown_5"):
            base = CARRIER_VOICE_CUES[cue]
            lead = float(base.get("leadSeconds") or 0.0)
            context = dict(base_event)
            context["minutes"] = int(round(lead / 60.0))
            fire_at = datetime.fromtimestamp(departure.timestamp() - lead, tz=timezone.utc)
            self._queue_scheduled_voice(cue, context, fire_at)

    def _schedule_cooldown_ready(self, event: dict[str, Any]) -> None:
        settings = self.voice_settings_snapshot()
        row = (settings.get("cues") or {}).get("carrier.cooldown_ready") or {}
        if not settings.get("enabled") or not settings.get("carrierPa") or not row.get("enabled"):
            return
        delay = max(0.0, min(900.0, float(row.get("offsetSeconds") or 0.0)))
        context = self._voice_schedule_context(event)
        context["carrierName"] = self._carrier_voice_name(event)
        fire_at = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + delay, tz=timezone.utc)
        self._queue_scheduled_voice("carrier.cooldown_ready", context, fire_at)

    def handle_voice_event(self, event: dict[str, Any]) -> None:
        cue = str(event.get("type") or "")
        if cue not in CARRIER_VOICE_CUES:
            if cue in {"docking.denied", "docking.cancelled", "docking.timeout"}:
                self._cancel_voice_cues("docking.requested", "docking.granted")
            return
        if cue in {"carrier.countdown_10", "carrier.countdown_5", "carrier.cooldown_ready"}:
            return
        if not self._is_owner_carrier_event(event):
            return

        if cue == "docking.granted":
            self._cancel_voice_cues("docking.requested")
        elif cue == "docking.docked":
            self._cancel_voice_cues("docking.requested", "docking.granted")
        elif cue == "docking.undocked":
            self._cancel_voice_cues("docking.docked")
        elif cue == "carrier.jump_request":
            self._cancel_voice_cues("carrier.jump_request", "carrier.countdown_10", "carrier.countdown_5", "carrier.cooldown_ready")
            self._schedule_departure_countdowns(event)
        elif cue == "carrier.jump_cancelled":
            self._cancel_voice_cues("carrier.jump_request", "carrier.countdown_10", "carrier.countdown_5")
        elif cue == "carrier.jump":
            self._cancel_voice_cues("carrier.jump_request", "carrier.countdown_10", "carrier.countdown_5")
            self._schedule_cooldown_ready(event)

        self._queue_configured_voice(cue, event)

    def queue_voice_test(self) -> dict[str, Any]:
        settings = self.voice_settings_snapshot()
        carrier = self._owner_carrier_for_voice()
        name = " ".join(str(carrier.get("name") or "").split()) or "Pneuma"
        with self.voice_condition:
            self.voice_pending.append({
                "cue": "test",
                "text": f"{name} public address test. Audio link online.",
                "due": time.monotonic(),
                "force": True,
            })
            self.voice_pending.sort(key=lambda item: float(item.get("due") or 0.0))
            self.voice_condition.notify_all()
        return self.voice_status_snapshot()

    def queue_voice_cue_test(self, cue: str) -> dict[str, Any]:
        if cue not in CARRIER_VOICE_CUES:
            raise ValueError("voice_cue_invalid")
        carrier = self._owner_carrier_for_voice()
        name = " ".join(str(carrier.get("name") or "").split()) or "Pneuma"
        event = {
            "relationship": "owner",
            "carrierName": name,
            "destinationSystem": "destination system",
            "system": "destination system",
            "landingPad": 12,
        }
        lead = CARRIER_VOICE_CUES[cue].get("leadSeconds")
        if isinstance(lead, (int, float)):
            event["minutes"] = int(round(float(lead) / 60.0))
        with self.voice_condition:
            self.voice_pending.append({
                "cue": cue,
                "event": event,
                "due": time.monotonic(),
                "force": True,
            })
            self.voice_pending.sort(key=lambda item: float(item.get("due") or 0.0))
            self.voice_condition.notify_all()
        return self.voice_status_snapshot()

    def _voice_pack_root(self) -> Path:
        return self.store.path.parent / "voices"

    def _kokoro_install_root(self) -> Path:
        return self._voice_pack_root() / "kokoro"

    @staticmethod
    def _directory_size(root: Path) -> int:
        total = 0
        if not root.exists():
            return 0
        for path in root.rglob("*"):
            try:
                if path.is_file():
                    total += path.stat().st_size
            except OSError:
                continue
        return total

    @staticmethod
    def _find_kokoro_paths(root: Path) -> dict[str, Path] | None:
        if not root.exists():
            return None
        exe = next(root.rglob("sherpa-onnx-offline-tts.exe"), None)
        model_root = None
        for model in root.rglob("model.onnx"):
            parent = model.parent
            if (parent / "voices.bin").is_file() and (parent / "tokens.txt").is_file() and (parent / "espeak-ng-data").is_dir():
                model_root = parent
                break
        if exe is None or model_root is None:
            return None
        lexicon = model_root / "lexicon-us-en.txt"
        if not lexicon.is_file():
            return None
        return {
            "exe": exe,
            "model": model_root / "model.onnx",
            "voices": model_root / "voices.bin",
            "tokens": model_root / "tokens.txt",
            "dataDir": model_root / "espeak-ng-data",
            "lexicon": lexicon,
        }

    def _kokoro_paths(self) -> dict[str, Path] | None:
        return self._find_kokoro_paths(self._kokoro_install_root())

    def _refresh_voice_pack_status(self) -> None:
        installed = self._kokoro_paths() is not None
        with self.voice_pack_lock:
            if self.voice_pack_status.get("active"):
                return
            self.voice_pack_status.update({
                "installed": installed,
                "active": False,
                "action": "",
                "phase": "ready" if installed else "not_installed",
                "progress": 100 if installed else 0,
                "message": "Kokoro local neural voices ready." if installed else "Kokoro voice pack is optional and not installed.",
                "error": "",
                "downloadBytes": KOKORO_PACK_DOWNLOAD_BYTES,
                "installedBytes": self._directory_size(self._kokoro_install_root()) if installed else 0,
            })

    def voice_pack_status_snapshot(self) -> dict[str, Any]:
        with self.voice_pack_lock:
            return json.loads(json.dumps(self.voice_pack_status))

    def _set_voice_pack_status(self, **changes: Any) -> None:
        with self.voice_pack_lock:
            self.voice_pack_status.update(changes)

    @staticmethod
    def _safe_extract_tar(archive: Path, destination: Path) -> None:
        destination.mkdir(parents=True, exist_ok=True)
        root = destination.resolve()
        with tarfile.open(archive, "r:bz2") as bundle:
            for member in bundle.getmembers():
                target = (destination / member.name).resolve()
                if target != root and root not in target.parents:
                    raise RuntimeError("voice_pack_archive_path_invalid")
            bundle.extractall(destination, filter="data")

    def _download_voice_asset(self, url: str, destination: Path, expected_bytes: int, completed_before: int, total_bytes: int) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.unlink(missing_ok=True)
        script = (
            "$ErrorActionPreference='Stop';"
            "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;"
            "Add-Type -AssemblyName System.Net.Http;"
            "$client=New-Object System.Net.Http.HttpClient;"
            "$client.Timeout=[TimeSpan]::FromMinutes(30);"
            "$response=$client.GetAsync(" + _powershell_quote(url) + ",[System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult();"
            "$response.EnsureSuccessStatusCode();"
            "$stream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();"
            "$file=[IO.File]::Open(" + _powershell_quote(str(destination)) + ",[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::Read);"
            "$buffer=New-Object byte[] 1048576;"
            "$total=[Int64]0;"
            "try{while(($read=$stream.Read($buffer,0,$buffer.Length)) -gt 0){$file.Write($buffer,0,$read);$total+=$read;Write-Output ('BYTES:'+$total)}}"
            "finally{$file.Dispose();$stream.Dispose();$response.Dispose();$client.Dispose()}"
        )
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        process = subprocess.Popen(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=flags,
        )
        assert process.stdout is not None
        for line in process.stdout:
            if not line.startswith("BYTES:"):
                continue
            try:
                downloaded = max(0, min(expected_bytes, int(line.split(":", 1)[1].strip())))
            except (TypeError, ValueError):
                continue
            total_downloaded = completed_before + downloaded
            progress = 5 + int(70 * min(1.0, total_downloaded / max(1, total_bytes)))
            self._set_voice_pack_status(progress=progress)
        stderr = process.stderr.read().strip() if process.stderr is not None else ""
        code = process.wait(timeout=30)
        if code != 0:
            raise RuntimeError("voice_pack_download_failed")
        if not destination.is_file() or destination.stat().st_size != expected_bytes:
            raise RuntimeError("voice_pack_download_size_mismatch")

    def start_voice_pack_install(self, *, repair: bool = False) -> dict[str, Any]:
        if os.name != "nt":
            raise ValueError("windows_voice_pack_required")
        with self.voice_pack_lock:
            if self.voice_pack_status.get("active"):
                raise ValueError("voice_pack_busy")
            installed = self._kokoro_paths() is not None
            if installed and not repair:
                return self.voice_pack_status_snapshot()
            self.voice_pack_status.update({
                "installed": installed,
                "active": True,
                "action": "repair" if repair else "install",
                "phase": "starting",
                "progress": 1,
                "message": "Preparing Kokoro local neural voice pack…",
                "error": "",
                "downloadBytes": KOKORO_PACK_DOWNLOAD_BYTES,
            })
        threading.Thread(
            target=self._install_kokoro_worker,
            args=(repair,),
            name="MongrelHudKokoroInstall",
            daemon=True,
        ).start()
        return self.voice_pack_status_snapshot()

    def _install_kokoro_worker(self, repair: bool) -> None:
        voices_root = self._voice_pack_root()
        stage = voices_root / ".kokoro-install"
        final = self._kokoro_install_root()
        backup = voices_root / ".kokoro-old"
        try:
            voices_root.mkdir(parents=True, exist_ok=True)
            shutil.rmtree(stage, ignore_errors=True)
            shutil.rmtree(backup, ignore_errors=True)
            archives = stage / "archives"
            runtime_dir = stage / "runtime"
            model_dir = stage / "model"
            archives.mkdir(parents=True, exist_ok=True)
            runtime_archive = archives / "sherpa-onnx-runtime.tar.bz2"
            model_archive = archives / "kokoro-model.tar.bz2"

            self._set_voice_pack_status(phase="downloading_runtime", progress=5, message="Downloading local TTS engine…")
            self._download_voice_asset(
                KOKORO_ENGINE_URL,
                runtime_archive,
                KOKORO_ENGINE_BYTES,
                0,
                KOKORO_ENGINE_BYTES + KOKORO_MODEL_BYTES,
            )
            if _file_sha256(runtime_archive).casefold() != KOKORO_ENGINE_SHA256:
                raise RuntimeError("voice_pack_runtime_hash_mismatch")

            self._set_voice_pack_status(phase="downloading_model", progress=9, message="Downloading Kokoro neural voice model…")
            self._download_voice_asset(
                KOKORO_MODEL_URL,
                model_archive,
                KOKORO_MODEL_BYTES,
                KOKORO_ENGINE_BYTES,
                KOKORO_ENGINE_BYTES + KOKORO_MODEL_BYTES,
            )
            if _file_sha256(model_archive).casefold() != KOKORO_MODEL_SHA256:
                raise RuntimeError("voice_pack_model_hash_mismatch")

            self._set_voice_pack_status(phase="extracting_runtime", progress=78, message="Extracting local TTS engine…")
            self._safe_extract_tar(runtime_archive, runtime_dir)
            self._set_voice_pack_status(phase="extracting_model", progress=86, message="Extracting Kokoro neural voices…")
            self._safe_extract_tar(model_archive, model_dir)
            runtime_archive.unlink(missing_ok=True)
            model_archive.unlink(missing_ok=True)
            shutil.rmtree(archives, ignore_errors=True)

            self._set_voice_pack_status(phase="validating", progress=94, message="Validating local neural voice pack…")
            paths = self._find_kokoro_paths(stage)
            if paths is None:
                raise RuntimeError("voice_pack_files_missing")
            manifest = {
                "pack": "Kokoro",
                "packId": KOKORO_PACK_ID,
                "engineVersion": KOKORO_ENGINE_VERSION,
                "installedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "engineSha256": KOKORO_ENGINE_SHA256,
                "modelSha256": KOKORO_MODEL_SHA256,
            }
            (stage / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

            self._set_voice_pack_status(phase="installing", progress=97, message="Installing Kokoro local neural voices…")
            if final.exists():
                final.replace(backup)
            try:
                stage.replace(final)
                if self._kokoro_paths() is None:
                    raise RuntimeError("voice_pack_install_validation_failed")
            except Exception:
                if final.exists():
                    shutil.rmtree(final, ignore_errors=True)
                if backup.exists():
                    backup.replace(final)
                raise
            shutil.rmtree(backup, ignore_errors=True)

            self._voice_catalog_worker()
            self._set_voice_pack_status(
                installed=True,
                active=False,
                action="",
                phase="ready",
                progress=100,
                message="Kokoro local neural voices ready.",
                error="",
                installedBytes=self._directory_size(final),
            )
        except Exception as exc:
            shutil.rmtree(stage, ignore_errors=True)
            if backup.exists() and not final.exists():
                try:
                    backup.replace(final)
                except Exception:
                    pass
            self._voice_catalog_worker()
            self._set_voice_pack_status(
                installed=self._kokoro_paths() is not None,
                active=False,
                action="",
                phase="error",
                progress=0,
                message="Kokoro voice pack install failed.",
                error=str(exc).strip() or type(exc).__name__,
            )

    def remove_voice_pack(self) -> dict[str, Any]:
        with self.voice_pack_lock:
            if self.voice_pack_status.get("active"):
                raise ValueError("voice_pack_busy")
            self.voice_pack_status.update({
                "active": True,
                "action": "remove",
                "phase": "removing",
                "message": "Removing Kokoro local neural voice pack…",
                "error": "",
            })
        try:
            shutil.rmtree(self._kokoro_install_root(), ignore_errors=False)
        except FileNotFoundError:
            pass
        except Exception as exc:
            self._set_voice_pack_status(active=False, action="", phase="error", error=str(exc).strip() or type(exc).__name__, message="Could not remove Kokoro voice pack.")
            return self.voice_pack_status_snapshot()

        with self.store.lock:
            voice = normalized_voice_settings(self.store.data.get("voice"))
            if voice.get("voiceProvider") == VOICE_PROVIDER_KOKORO:
                voice["voiceProvider"] = VOICE_PROVIDER_SYSTEM
                voice["voiceId"] = ""
                voice["voiceName"] = ""
                self.store.data["voice"] = normalized_voice_settings(voice)
                self.store.save()
        self._voice_catalog_worker()
        self._set_voice_pack_status(
            installed=False,
            active=False,
            action="",
            phase="not_installed",
            progress=0,
            message="Kokoro voice pack is optional and not installed.",
            error="",
            installedBytes=0,
        )
        return self.voice_pack_status_snapshot()

    def _kokoro_voice_catalog(self) -> list[dict[str, str]]:
        if self._kokoro_paths() is None:
            return []
        return [
            {
                "provider": VOICE_PROVIDER_KOKORO,
                "providerLabel": VOICE_PROVIDER_LABELS[VOICE_PROVIDER_KOKORO],
                "id": key,
                "name": name,
                "culture": culture,
                "gender": gender,
                "age": "",
                "description": f"Kokoro local neural voice · {key}",
            }
            for key, _sid, name, gender, culture in KOKORO_ENGLISH_VOICES
        ]

    @staticmethod
    def _system_speech_voice_catalog() -> list[dict[str, str]]:
        if os.name != "nt":
            return []
        script = (
            "$ErrorActionPreference='Stop';"
            "$OutputEncoding=[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
            "Add-Type -AssemblyName System.Speech;"
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
            "$rows=@($s.GetInstalledVoices()|ForEach-Object{$v=$_.VoiceInfo;[PSCustomObject]@{id=$v.Name;name=$v.Name;culture=$v.Culture.Name;gender=$v.Gender.ToString();age=$v.Age.ToString()}});"
            "$s.Dispose();$rows|ConvertTo-Json -Compress"
        )
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=flags,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError("system_speech_catalog_failed")
        raw = result.stdout.strip()
        if not raw:
            return []
        try:
            payload = json.loads(raw)
        except Exception as exc:
            raise RuntimeError("system_speech_catalog_invalid_json") from exc
        rows = payload if isinstance(payload, list) else [payload] if isinstance(payload, dict) else []
        out: list[dict[str, str]] = []
        seen = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            name = " ".join(str(row.get("name") or "").split())[:160]
            voice_id = " ".join(str(row.get("id") or name).split())[:512]
            key = (VOICE_PROVIDER_SYSTEM, voice_id.casefold())
            if not name or not voice_id or key in seen:
                continue
            seen.add(key)
            out.append({
                "provider": VOICE_PROVIDER_SYSTEM,
                "providerLabel": VOICE_PROVIDER_LABELS[VOICE_PROVIDER_SYSTEM],
                "id": voice_id,
                "name": name,
                "culture": " ".join(str(row.get("culture") or "").split())[:32],
                "gender": " ".join(str(row.get("gender") or "").split())[:32],
                "age": " ".join(str(row.get("age") or "").split())[:32],
                "description": "",
            })
        return sorted(out, key=lambda row: row["name"].casefold())

    @staticmethod
    def _winrt_voice_catalog() -> list[dict[str, str]]:
        if os.name != "nt":
            return []
        script = (
            "$ErrorActionPreference='Stop';"
            "$OutputEncoding=[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
            "[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]>$null;"
            "$rows=@([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices|ForEach-Object{"
            "[PSCustomObject]@{id=$_.Id;name=$_.DisplayName;culture=$_.Language;gender=$_.Gender.ToString();description=$_.Description}"
            "});$rows|ConvertTo-Json -Compress"
        )
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=flags,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError("winrt_voice_catalog_failed")
        raw = result.stdout.strip()
        if not raw:
            return []
        try:
            payload = json.loads(raw)
        except Exception as exc:
            raise RuntimeError("winrt_voice_catalog_invalid_json") from exc
        rows = payload if isinstance(payload, list) else [payload] if isinstance(payload, dict) else []
        out: list[dict[str, str]] = []
        seen = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            voice_id = " ".join(str(row.get("id") or "").split())[:512]
            name = " ".join(str(row.get("name") or "").split())[:160]
            key = (VOICE_PROVIDER_WINRT, voice_id.casefold())
            if not voice_id or not name or key in seen:
                continue
            seen.add(key)
            out.append({
                "provider": VOICE_PROVIDER_WINRT,
                "providerLabel": VOICE_PROVIDER_LABELS[VOICE_PROVIDER_WINRT],
                "id": voice_id,
                "name": name,
                "culture": " ".join(str(row.get("culture") or "").split())[:32],
                "gender": " ".join(str(row.get("gender") or "").split())[:32],
                "age": "",
                "description": " ".join(str(row.get("description") or "").split())[:240],
            })
        return sorted(out, key=lambda row: row["name"].casefold())

    def _voice_catalog_worker(self) -> None:
        catalog: list[dict[str, str]] = []
        errors: dict[str, str] = {}
        for provider, loader in (
            (VOICE_PROVIDER_KOKORO, self._kokoro_voice_catalog),
            (VOICE_PROVIDER_WINRT, self._winrt_voice_catalog),
            (VOICE_PROVIDER_SYSTEM, self._system_speech_voice_catalog),
        ):
            try:
                catalog.extend(loader())
            except Exception as exc:
                errors[provider] = str(exc).strip() or type(exc).__name__
        provider_order = {
            VOICE_PROVIDER_KOKORO: 0,
            VOICE_PROVIDER_WINRT: 1,
            VOICE_PROVIDER_SYSTEM: 2,
        }
        catalog.sort(key=lambda row: (
            provider_order.get(str(row.get("provider") or ""), 99),
            str(row.get("name") or "").casefold(),
        ))
        with self.lock:
            self.voice_catalog = catalog
            self.voice_catalog_errors = errors
            self.voice_catalog_error = " · ".join(f"{provider}:{error}" for provider, error in sorted(errors.items()))

    @staticmethod
    def _speak_system_speech(text: str, volume: int, rate: int, voice_id: str = "") -> None:
        if os.name != "nt":
            raise RuntimeError("windows_speech_required")
        safe_text = " ".join(str(text or "").split())[:600]
        selected = " ".join(str(voice_id or "").split())[:512]
        if not safe_text:
            return
        select = "$s.SelectVoice(" + _powershell_quote(selected) + ");" if selected else ""
        script = (
            "$ErrorActionPreference='Stop';"
            "Add-Type -AssemblyName System.Speech;"
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
            + select
            + f"$s.Volume={max(0, min(100, int(volume)))};"
            + f"$s.Rate={max(-3, min(3, int(rate)))};"
            + "$s.Speak(" + _powershell_quote(safe_text) + ");"
            + "$s.Dispose();"
        )
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
            capture_output=True,
            text=True,
            timeout=90,
            creationflags=flags,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError("system_speech_failed")

    @staticmethod
    def _speak_winrt(text: str, volume: int, rate: int, voice_id: str) -> None:
        if os.name != "nt":
            raise RuntimeError("windows_speech_required")
        safe_text = " ".join(str(text or "").split())[:600]
        selected = " ".join(str(voice_id or "").split())[:512]
        if not safe_text:
            return
        if not selected:
            raise RuntimeError("winrt_voice_required")
        volume_value = max(0.0, min(1.0, int(volume) / 100.0))
        rate_value = max(0.5, min(6.0, 1.18 ** max(-3, min(3, int(rate)))))
        script = (
            "$ErrorActionPreference='Stop';"
            "Add-Type -AssemblyName System.Runtime.WindowsRuntime;"
            "[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]>$null;"
            "[Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]>$null;"
            "function Await-WinRt($Operation,[Type]$ResultType){"
            "$method=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1}|Select-Object -First 1;"
            "if(-not $method){throw 'winrt_astask_unavailable'};"
            "$task=$method.MakeGenericMethod($ResultType).Invoke($null,@($Operation));"
            "$task.GetAwaiter().GetResult()"
            "};"
            "$s=New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer;"
            "$voice=[Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices|Where-Object{$_.Id -eq " + _powershell_quote(selected) + "}|Select-Object -First 1;"
            "if(-not $voice){throw 'winrt_voice_not_found'};"
            "$s.Voice=$voice;"
            + f"$s.Options.AudioVolume={volume_value:.4f};"
            + f"$s.Options.SpeakingRate={rate_value:.4f};"
            + "$stream=Await-WinRt ($s.SynthesizeTextToStreamAsync(" + _powershell_quote(safe_text) + ")) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]);"
            "$path=[IO.Path]::Combine([IO.Path]::GetTempPath(),('MongrelHUD-voice-'+[Guid]::NewGuid().ToString('N')+'.wav'));"
            "try{"
            "$net=[System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream);"
            "$file=[IO.File]::Create($path);"
            "try{$net.CopyTo($file)}finally{$file.Dispose();$net.Dispose()};"
            "$player=New-Object System.Media.SoundPlayer $path;"
            "try{$player.PlaySync()}finally{$player.Dispose()}"
            "}finally{"
            "try{$stream.Dispose()}catch{};"
            "try{$s.Dispose()}catch{};"
            "Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue"
            "}"
        )
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
            capture_output=True,
            text=True,
            timeout=90,
            creationflags=flags,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError("winrt_speech_failed")

    @staticmethod
    def _scale_pcm16_wav_volume(path: Path, volume: int) -> None:
        level = max(0.0, min(1.0, int(volume) / 100.0))
        if level >= 0.999:
            return
        with wave.open(str(path), "rb") as reader:
            params = reader.getparams()
            if params.sampwidth != 2:
                raise RuntimeError("kokoro_wav_format_unsupported")
            frames = reader.readframes(params.nframes)
        samples = array("h")
        samples.frombytes(frames)
        if sys.byteorder != "little":
            samples.byteswap()
        if level <= 0.0:
            samples = array("h", [0] * len(samples))
        else:
            for idx, sample in enumerate(samples):
                samples[idx] = max(-32768, min(32767, int(sample * level)))
        if sys.byteorder != "little":
            samples.byteswap()
        temp = path.with_suffix(".volume.wav")
        with wave.open(str(temp), "wb") as writer:
            writer.setparams(params)
            writer.writeframes(samples.tobytes())
        temp.replace(path)

    def _speak_kokoro(self, text: str, volume: int, rate: int, voice_id: str) -> None:
        if os.name != "nt":
            raise RuntimeError("windows_speech_required")
        paths = self._kokoro_paths()
        if paths is None:
            raise RuntimeError("kokoro_voice_pack_not_installed")
        key = " ".join(str(voice_id or "").split())[:80]
        sid = KOKORO_VOICE_SIDS.get(key)
        if sid is None:
            raise RuntimeError("kokoro_voice_not_found")
        safe_text = " ".join(str(text or "").split())[:600]
        if not safe_text:
            return
        speed = max(0.65, min(1.55, 1.15 ** max(-3, min(3, int(rate)))))
        temp_dir = self.store.path.parent / "voice-temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        output = temp_dir / f"kokoro-{secrets.token_hex(8)}.wav"
        args = [
            str(paths["exe"]),
            f"--kokoro-model={paths['model']}",
            f"--kokoro-voices={paths['voices']}",
            f"--kokoro-tokens={paths['tokens']}",
            f"--kokoro-data-dir={paths['dataDir']}",
            f"--kokoro-lexicon={paths['lexicon']}",
            "--num-threads=4",
            f"--sid={sid}",
            f"--speed={speed:.4f}",
            f"--output-filename={output}",
            safe_text,
        ]
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            result = subprocess.run(
                args,
                cwd=str(paths["exe"].parent),
                capture_output=True,
                text=True,
                timeout=120,
                creationflags=flags,
                check=False,
            )
            if result.returncode != 0 or not output.is_file() or output.stat().st_size < 44:
                raise RuntimeError("kokoro_speech_failed")
            self._scale_pcm16_wav_volume(output, volume)
            import winsound
            winsound.PlaySound(str(output), winsound.SND_FILENAME)
        finally:
            output.unlink(missing_ok=True)

    def _speak_voice_provider(self, provider: str, text: str, volume: int, rate: int, voice_id: str = "") -> None:
        provider = str(provider or VOICE_PROVIDER_SYSTEM).strip().lower()
        if provider == VOICE_PROVIDER_KOKORO:
            self._speak_kokoro(text, volume, rate, voice_id)
            return
        if provider == VOICE_PROVIDER_WINRT:
            self._speak_winrt(text, volume, rate, voice_id)
            return
        if provider == VOICE_PROVIDER_SYSTEM:
            self._speak_system_speech(text, volume, rate, voice_id)
            return
        raise RuntimeError("voice_provider_unsupported")

    def _voice_loop(self) -> None:
        while True:
            item = None
            with self.voice_condition:
                while not self.voice_pending:
                    self.voice_condition.wait(timeout=5.0)
                if not self.voice_pending:
                    continue
                now = time.monotonic()
                due = float(self.voice_pending[0].get("due") or now)
                if due > now:
                    self.voice_condition.wait(timeout=min(5.0, due - now))
                    continue
                item = self.voice_pending.pop(0)
                self.voice_runtime["speaking"] = True
                self.voice_runtime["lastError"] = ""
            schedule_id = str(item.get("persistentId") or "")
            if schedule_id:
                self._remove_persisted_voice(schedule_id=schedule_id)
            settings = self.voice_settings_snapshot()
            cue = str(item.get("cue") or "")
            force = bool(item.get("force"))
            row = (settings.get("cues") or {}).get(cue) or {}
            if not force and (not settings.get("enabled") or not settings.get("carrierPa") or not row.get("enabled", True)):
                with self.voice_condition:
                    self.voice_runtime["speaking"] = False
                    self.voice_condition.notify_all()
                continue
            event = item.get("event") if isinstance(item.get("event"), dict) else {}
            text = str(item.get("text") or "") if cue == "test" else self._voice_text_for_event(cue, event)
            if not text:
                with self.voice_condition:
                    self.voice_runtime["speaking"] = False
                    self.voice_condition.notify_all()
                continue
            try:
                self._speak_voice_provider(
                    str(settings.get("voiceProvider") or VOICE_PROVIDER_SYSTEM),
                    text,
                    int(settings.get("volume") if settings.get("volume") is not None else 75),
                    int(settings.get("rate") or 0),
                    str(settings.get("voiceId") or settings.get("voiceName") or ""),
                )
                with self.voice_condition:
                    self.voice_runtime.update({
                        "lastCue": cue,
                        "lastText": text,
                        "lastSpokenAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                        "lastError": "",
                    })
            except Exception as exc:
                with self.voice_condition:
                    self.voice_runtime["lastError"] = str(exc).strip() or type(exc).__name__
            finally:
                with self.voice_condition:
                    self.voice_runtime["speaking"] = False
                    self.voice_condition.notify_all()

    @staticmethod
    def target_identity(target: dict[str, Any] | None) -> str:
        if not isinstance(target, dict):
            return ""
        pilot = " ".join(str(target.get("pilotName") or "").split()).casefold()
        ship = " ".join(str(target.get("ship") or "").split()).casefold()
        faction = " ".join(str(target.get("faction") or "").split()).casefold()
        if pilot:
            return "|".join((pilot, ship))
        if ship:
            return "|".join((ship, faction))
        return ""

    @staticmethod
    def _same_target_capture(row: dict[str, Any], target_key: str, target: dict[str, Any]) -> bool:
        if str(row.get("key") or "") == target_key:
            return True
        old_pilot = " ".join(str(row.get("pilotName") or "").split()).casefold()
        new_pilot = " ".join(str(target.get("pilotName") or "").split()).casefold()
        old_ship = " ".join(str(row.get("ship") or "").split()).casefold()
        new_ship = " ".join(str(target.get("ship") or "").split()).casefold()
        return bool(old_pilot and new_pilot and old_pilot == new_pilot and old_ship == new_ship)

    def _warm_ocr(self) -> None:
        if not OCR_AVAILABLE or RapidOCR is None:
            return
        try:
            engine = RapidOCR()
            with self.ocr_lock:
                self.ocr_engine = engine
                self.ocr_status = {"available": True, "ready": True, "error": ""}
        except Exception as exc:
            with self.ocr_lock:
                self.ocr_status = {"available": True, "ready": False, "error": f"ocr_init_failed:{type(exc).__name__}"}

    def _ocr_engine_ready(self) -> Any:
        with self.ocr_lock:
            engine = self.ocr_engine
        if engine is not None:
            return engine
        self._warm_ocr()
        with self.ocr_lock:
            return self.ocr_engine

    @staticmethod
    def _foreground_capture() -> Any:
        if os.name != "nt" or ImageGrab is None:
            raise RuntimeError("screen_capture_unavailable")
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd:
            raise RuntimeError("foreground_window_unavailable")
        rect = wintypes.RECT()
        if not ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            raise RuntimeError("foreground_window_rect_failed")
        if rect.right <= rect.left or rect.bottom <= rect.top:
            raise RuntimeError("foreground_window_rect_invalid")
        image = ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom), all_screens=True)
        width, height = image.size
        left = max(0, min(width - 1, round(width * TARGET_CAPTURE_REGION[0])))
        top = max(0, min(height - 1, round(height * TARGET_CAPTURE_REGION[1])))
        right = max(left + 1, min(width, round(width * TARGET_CAPTURE_REGION[2])))
        bottom = max(top + 1, min(height, round(height * TARGET_CAPTURE_REGION[3])))
        crop = image.crop((left, top, right, bottom))
        if crop.width > 1600:
            ratio = 1600.0 / crop.width
            crop = crop.resize((1600, max(1, round(crop.height * ratio))))
        if ImageOps is not None and ImageEnhance is not None:
            crop = ImageOps.autocontrast(ImageOps.grayscale(crop))
            crop = ImageEnhance.Contrast(crop).enhance(1.6).convert("RGB")
        return crop

    def _ocr_modules_from_image(self, image: Any, engine: Any) -> list[str]:
        if np is None:
            return []
        result, _elapsed = engine(np.array(image))
        rows = result or []
        detected: list[tuple[float, float, str]] = []
        for row in rows:
            try:
                box, text, score = row
                if float(score) < 0.32:
                    continue
                name = match_module_name(text)
                if not name:
                    continue
                ys = [float(point[1]) for point in box]
                xs = [float(point[0]) for point in box]
                detected.append((sum(ys) / len(ys), sum(xs) / len(xs), name))
            except Exception:
                continue
        detected.sort(key=lambda item: (item[0], item[1]))
        out: list[str] = []
        last_y = None
        last_name = None
        for y, _x, name in detected:
            if name == last_name and last_y is not None and abs(y - last_y) < 8:
                continue
            out.append(name)
            last_y, last_name = y, name
        return out

    def target_intel(self, target: dict[str, Any] | None = None) -> dict[str, Any] | None:
        current = target if isinstance(target, dict) else (self.scout_state().get("target") or {})
        key = self.target_identity(current)
        if not key:
            return None
        with self.lock:
            for row in self.recent_targets:
                if row.get("key") == key:
                    return json.loads(json.dumps(row))
        return None

    def recent_target_snapshot(self) -> list[dict[str, Any]]:
        with self.lock:
            return json.loads(json.dumps(self.recent_targets))

    def scan_status_snapshot(self) -> dict[str, Any]:
        with self.lock, self.ocr_lock:
            status = dict(self.target_scan_status)
            status["ocr"] = dict(self.ocr_status)
            return status

    def start_target_scan(self) -> dict[str, Any]:
        state = self.scout_state()
        target = state.get("target") if isinstance(state.get("target"), dict) else {}
        key = self.target_identity(target)
        if not key:
            raise ValueError("target_required")
        with self.lock:
            if self.target_scan_status.get("active"):
                raise ValueError("target_scan_active")
            self.target_scan_status = {
                "active": True,
                "phase": "capturing",
                "progress": 0,
                "message": "SCANNING — SCROLL NOW",
                "error": "",
                "targetKey": key,
                "pilotName": str(target.get("pilotName") or ""),
                "ship": str(target.get("ship") or ""),
                "startedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
        threading.Thread(target=self._run_target_scan, args=(key, dict(target)), name="MongrelHudTargetScan", daemon=True).start()
        return self.scan_status_snapshot()

    def _run_target_scan(self, target_key: str, target: dict[str, Any]) -> None:
        try:
            engine = self._ocr_engine_ready()
            if engine is None:
                raise RuntimeError(self.ocr_status.get("error") or "ocr_unavailable")
            frames: list[Any] = []
            # Give the Tk loop one repaint so local overlay windows are hidden
            # before the first foreground capture.
            time.sleep(0.22)
            started = time.monotonic()
            for index in range(TARGET_SCAN_FRAMES):
                frames.append(self._foreground_capture())
                with self.lock:
                    self.target_scan_status["progress"] = round(((index + 1) / TARGET_SCAN_FRAMES) * 70)
                next_at = started + ((index + 1) * TARGET_SCAN_DURATION / TARGET_SCAN_FRAMES)
                remaining = next_at - time.monotonic()
                if remaining > 0:
                    time.sleep(remaining)
            with self.lock:
                self.target_scan_status.update({"phase": "reading", "progress": 72, "message": "READING LOADOUT"})
            recognized_frames: list[list[str]] = []
            for index, frame in enumerate(frames):
                modules = self._ocr_modules_from_image(frame, engine)
                if modules:
                    recognized_frames.append(modules)
                with self.lock:
                    self.target_scan_status["progress"] = 72 + round(((index + 1) / max(1, len(frames))) * 25)
            stitched = stitch_module_frames(recognized_frames)
            groups = tactical_module_groups(stitched)
            tactical_count = sum(item["count"] for values in groups.values() for item in values)
            if not stitched:
                raise RuntimeError("no_module_text_found")
            row = {
                "key": target_key,
                "pilotName": str(target.get("pilotName") or ""),
                "ship": str(target.get("ship") or ""),
                "faction": str(target.get("faction") or ""),
                "capturedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "allModules": stitched,
                "groups": groups,
                "moduleCount": len(stitched),
                "tacticalCount": tactical_count,
                "framesRead": len(recognized_frames),
            }
            with self.lock:
                # A new scan is a replacement for this target, never an additive
                # pass. Soft pilot+ship matching also covers a journal identity
                # becoming more complete between scans.
                self.recent_targets = [
                    item for item in self.recent_targets
                    if not self._same_target_capture(item, target_key, target)
                ]
                self.recent_targets.insert(0, row)
                self.recent_targets = self.recent_targets[:TARGET_SCAN_RECENT_LIMIT]
                self.target_scan_status = {
                    "active": False,
                    "phase": "complete",
                    "progress": 100,
                    "message": f"{tactical_count} TACTICAL MODULES" if tactical_count else "LOADOUT CAPTURED · NO TACTICAL MODULES",
                    "error": "",
                    "targetKey": target_key,
                    "completedAt": row["capturedAt"],
                    "moduleCount": len(stitched),
                    "tacticalCount": tactical_count,
                }
        except Exception as exc:
            with self.lock:
                self.target_scan_status = {
                    "active": False,
                    "phase": "error",
                    "progress": 0,
                    "message": "LOADOUT SCAN FAILED",
                    "error": str(exc)[:120],
                    "targetKey": target_key,
                }

    def bounty_ledger(self) -> dict[str, int]:
        with self.store.lock:
            ledger = self.store.data.get("bounty") or {}
            unclaimed = max(0, int(ledger.get("unclaimed") or 0))
        return {
            "unclaimed": unclaimed,
            "runEarned": max(0, int(self.run_bounty)),
            "runKills": max(0, int(self.run_kills)),
            "last": max(0, int(self.last_bounty)),
        }

    def layout_snapshot(self) -> dict[str, Any]:
        with self.store.lock:
            return json.loads(json.dumps(normalized_layout(self.store.data.get("layout"))))

    def set_layout_locked(self, locked: bool) -> dict[str, Any]:
        with self.store.lock:
            layout = normalized_layout(self.store.data.get("layout"))
            layout["locked"] = bool(locked)
            self.store.data["layout"] = layout
            self.store.save()
        with self.lock:
            self.layout_revision += 1
        return self.layout_snapshot()

    def set_master_overlay(self, visible: bool) -> dict[str, Any]:
        with self.store.lock:
            layout = normalized_layout(self.store.data.get("layout"))
            layout["masterVisible"] = bool(visible)
            self.store.data["layout"] = layout
            self.store.save()
        with self.lock:
            self.layout_revision += 1
        return self.layout_snapshot()

    def set_panel_settings(self, panel_id: str, *, visible: Any = None, scale: Any = None, profiles: Any = None) -> dict[str, Any]:
        if panel_id not in PANEL_IDS:
            raise ValueError("invalid_panel")
        with self.store.lock:
            layout = normalized_layout(self.store.data.get("layout"))
            panel = layout["panels"][panel_id]
            if visible is not None:
                panel["visible"] = bool(visible)
            if scale is not None:
                try:
                    parsed = float(scale)
                except (TypeError, ValueError):
                    raise ValueError("invalid_scale")
                if not 0.75 <= parsed <= 1.5:
                    raise ValueError("invalid_scale")
                panel["scale"] = round(parsed, 2)
            if profiles is not None:
                if not isinstance(profiles, list):
                    raise ValueError("invalid_profiles")
                selected = [profile for profile in VALID_PROFILES if profile in profiles]
                if not selected:
                    raise ValueError("invalid_profiles")
                panel["profiles"] = selected
            self.store.data["layout"] = layout
            self.store.save()
        with self.lock:
            self.layout_revision += 1
        return self.layout_snapshot()

    def reset_layout(self) -> dict[str, Any]:
        with self.store.lock:
            current = normalized_layout(self.store.data.get("layout"))
            reset = default_layout()
            reset["locked"] = current["locked"]
            reset["masterVisible"] = current["masterVisible"]
            self.store.data["layout"] = reset
            self.store.save()
        with self.lock:
            self.layout_revision += 1
        return self.layout_snapshot()

    def save_panel_position(self, panel_id: str, x: int, y: int) -> None:
        if panel_id not in PANEL_IDS:
            return
        with self.store.lock:
            layout = normalized_layout(self.store.data.get("layout"))
            layout["panels"][panel_id]["x"] = int(x)
            layout["panels"][panel_id]["y"] = int(y)
            self.store.data["layout"] = layout
            self.store.save()

    def notes_text(self) -> str:
        with self.store.lock:
            return str(self.store.data.get("notes") or "")

    def set_notes(self, value: str) -> str:
        text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")[:4000]
        with self.store.lock:
            self.store.data["notes"] = text
            self.store.save()
        return text

    def mission_system_filter(self) -> str:
        with self.store.lock:
            value = str(self.store.data.get("missionSystem") or "all").strip()
        return value or "all"

    def set_mission_system_filter(self, value: str) -> str:
        selected = " ".join(str(value or "all").split())[:140] or "all"
        with self.store.lock:
            self.store.data["missionSystem"] = selected
            self.store.save()
        return selected

    def acknowledge_alerts(self, alert_ids: list[str]) -> dict[str, Any]:
        ids: list[str] = []
        for value in alert_ids[:40]:
            alert_id = str(value or "").strip()[:500]
            if alert_id and alert_id not in ids:
                ids.append(alert_id)
        if not ids:
            raise ValueError("alert_id_required")
        payload: dict[str, Any] = {"action": "ack" if len(ids) == 1 else "ack-all"}
        if len(ids) == 1:
            payload["alertId"] = ids[0]
        else:
            payload["alertIds"] = ids
        request = urllib.request.Request(
            SCOUT_ALERT_ACK_URL,
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        result = request_scout_json(request, "alert_ack_failed")
        return result

    def set_profile(self, profile: str) -> str:
        if profile not in {"combat", "surface"}:
            raise ValueError("invalid_profile")
        with self.store.lock:
            self.store.data["profile"] = profile
            self.store.save()
        return profile

    def _load_mining_bridge_payload(self, url: str, invalid_error: str) -> list[dict[str, Any]]:
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "Cache-Control": "no-cache",
                "User-Agent": f"MongrelHUD/{APP_VERSION}",
            },
            method="GET",
        )
        envelope = request_scout_json(request, invalid_error, timeout=8.0)
        payload = envelope.get("data")
        if not isinstance(payload, list):
            raise HudRequestError(scout_diagnostics(envelope, url, 200, invalid_error))
        return payload

    def _refresh_mining_data_once(self) -> bool:
        deposit_error = ""
        center_error = ""
        deposit_ok = False
        center_ok = False
        deposit_diagnostics = None
        center_diagnostics = None

        try:
            payload = self._load_mining_bridge_payload(MINING_DATA_URL, "invalid_mining_payload")
            rows: list[dict[str, Any]] = []
            for raw in payload:
                if not isinstance(raw, dict):
                    continue
                try:
                    site_id = int(raw.get("id"))
                    signal = int(raw.get("signal"))
                except (TypeError, ValueError):
                    continue
                lat = raw.get("latitude")
                lon = raw.get("longitude")
                rows.append({
                    "id": site_id,
                    "systemName": str(raw.get("systemName") or TEN16_SYSTEM).strip(),
                    "systemAddress": str(raw.get("systemAddress") or "").strip(),
                    "commodity": str(raw.get("commodity") or "").strip(),
                    "body": str(raw.get("body") or "").strip().lower(),
                    "bodyType": str(raw.get("bodyType") or "").strip().lower(),
                    "signal": signal,
                    "latitude": float(lat) if isinstance(lat, (int, float)) else None,
                    "longitude": float(lon) if isinstance(lon, (int, float)) else None,
                    "rigs": int(raw.get("rigs")) if isinstance(raw.get("rigs"), (int, float)) else None,
                    "preferred": bool(raw.get("preferred")),
                    "notes": str(raw.get("notes") or "").strip(),
                })
            with self.mining_lock:
                self.mining_sites = rows
            deposit_ok = True
        except Exception as exc:
            deposit_diagnostics = exc.diagnostics if isinstance(exc, HudRequestError) else scout_diagnostics(None, MINING_DATA_URL, None, "invalid_mining_payload")
            deposit_error = deposit_diagnostics["detail"][:160]

        try:
            center_payload = self._load_mining_bridge_payload(MINING_CENTERS_URL, "invalid_mining_centers_payload")
            centers: list[dict[str, Any]] = []
            for raw in center_payload:
                try:
                    center = canonical_mining_center(raw)
                except ValueError as exc:
                    raise HudRequestError(scout_diagnostics(None, MINING_CENTERS_URL, 200, "invalid_mining_center_response")) from exc
                centers.append({
                    "id": center["id"],
                    "systemName": center["systemName"],
                    "systemAddress": center["systemAddress"],
                    "body": center["body"],
                    "bodyType": str(raw.get("bodyType") or "").strip().lower(),
                    "signal": center["signal"],
                    "latitude": center["latitude"],
                    "longitude": center["longitude"],
                    "updatedAt": raw.get("updatedAt"),
                })
            with self.mining_lock:
                self.mining_centers = centers
                self.mining_centers_source = "central"
                cached_centers = [dict(row) for row in centers]
            with self.store.lock:
                self.store.data["miningCenters"] = cached_centers
                self.store.save()
            center_ok = True
        except Exception as exc:
            center_diagnostics = exc.diagnostics if isinstance(exc, HudRequestError) else scout_diagnostics(None, MINING_CENTERS_URL, None, "invalid_mining_centers_payload")
            center_error = center_diagnostics["detail"][:160]
            with self.mining_lock:
                self.mining_centers_source = "cache" if self.mining_centers else "unavailable"

        errors = []
        if deposit_error:
            errors.append("deposits:" + deposit_error)
        if center_error:
            errors.append("centers:" + center_error)
        with self.mining_lock:
            self.mining_status = {
                "ok": deposit_ok and center_ok,
                "depositsOk": deposit_ok,
                "centersOk": center_ok,
                "centersSource": self.mining_centers_source,
                "depositsDiagnostics": deposit_diagnostics,
                "centersDiagnostics": center_diagnostics,
                "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "error": " · ".join(errors)[:220],
            }
        return deposit_ok or center_ok

    def _mining_sync_loop(self) -> None:
        while True:
            self._refresh_mining_data_once()
            time.sleep(MINING_REFRESH_SECONDS)

    def mining_status_snapshot(self) -> dict[str, Any]:
        with self.mining_lock:
            return {
                **self.mining_status,
                "centersSource": self.mining_centers_source,
                "centersCacheUnverified": self.mining_centers_source == "cache" and any(row.get("cacheOnly") for row in self.mining_centers),
            }

    def _in_ten16(self, state: dict[str, Any] | None = None) -> bool:
        current = state if isinstance(state, dict) else self.scout_state()
        system = current.get("system") or {}
        return (
            str(system.get("name") or "").strip().casefold() == TEN16_SYSTEM.casefold()
            or str(system.get("address") or "").strip() == TEN16_ID64
        )

    def sites_for_current_body(self) -> list[dict[str, Any]]:
        state = self.scout_state()
        if not self._in_ten16(state):
            return []
        body = short_body_name(state).casefold()
        system = state.get("system") or {}
        system_name = str(system.get("name") or "").strip().casefold()
        if not body or not system_name:
            return []
        with self.mining_lock:
            rows = [
                dict(row)
                for row in self.mining_sites
                if str(row.get("systemName") or TEN16_SYSTEM).strip().casefold() == system_name
                and str(row.get("body") or "").casefold() == body
                and isinstance(row.get("latitude"), (int, float))
                and isinstance(row.get("longitude"), (int, float))
            ]
        return sorted(
            rows,
            key=lambda row: (
                int(row.get("signal") or 0),
                not bool(row.get("preferred")),
                -(int(row.get("rigs")) if isinstance(row.get("rigs"), int) else -1),
                str(row.get("commodity") or "").casefold(),
                int(row.get("id") or 0),
            ),
        )

    def centers_for_current_body(self) -> list[dict[str, Any]]:
        state = self.scout_state()
        if not self._in_ten16(state):
            return []
        body = short_body_name(state).casefold()
        system = state.get("system") or {}
        system_name = str(system.get("name") or "").strip().casefold()
        if not body or not system_name:
            return []
        with self.mining_lock:
            rows = [
                dict(row)
                for row in self.mining_centers
                if str(row.get("systemName") or TEN16_SYSTEM).strip().casefold() == system_name
                and str(row.get("body") or "").casefold() == body
            ]
        return sorted(rows, key=lambda row: int(row.get("signal") or 0))

    def mining_locations_for_current_body(self) -> list[dict[str, Any]]:
        deposits = self.sites_for_current_body()
        centers = {int(row.get("signal") or 0): row for row in self.centers_for_current_body()}
        signals = sorted({int(row.get("signal") or 0) for row in deposits if int(row.get("signal") or 0) > 0} | set(centers))
        out = []
        for signal in signals:
            signal_deposits = [row for row in deposits if int(row.get("signal") or 0) == signal]
            commodities = sorted({str(row.get("commodity") or "").strip() for row in signal_deposits if str(row.get("commodity") or "").strip()})
            out.append({
                "signal": signal,
                "center": dict(centers[signal]) if signal in centers else None,
                "depositCount": len(signal_deposits),
                "commodities": commodities,
            })
        return out

    def active_location_signal(self) -> int | None:
        locations = self.mining_locations_for_current_body()
        if not locations:
            return None
        valid = {int(row["signal"]) for row in locations}
        with self.store.lock:
            raw = self.store.data.get("activeMiningLocationSignal")
        try:
            selected = int(raw)
        except (TypeError, ValueError):
            selected = 0
        if selected in valid:
            return selected
        if len(valid) == 1:
            selected = next(iter(valid))
            with self.store.lock:
                self.store.data["activeMiningLocationSignal"] = selected
                self.store.save()
            return selected
        return None

    def select_location(self, signal: int) -> dict[str, Any]:
        wanted = int(signal)
        locations = self.mining_locations_for_current_body()
        location = next((row for row in locations if int(row.get("signal") or 0) == wanted), None)
        if not location:
            # Allow setting a brand-new center before a deposit has ever been recorded.
            if wanted < 1:
                raise ValueError("mining_location_not_found")
            location = {"signal": wanted, "center": None, "depositCount": 0, "commodities": []}
        with self.store.lock:
            self.store.data["activeMiningLocationSignal"] = wanted
            active_id = self.store.data.get("activeMiningSiteId")
            if active_id:
                current = next((row for row in self.sites_for_current_body() if int(row.get("id") or 0) == int(active_id)), None)
                if not current or int(current.get("signal") or 0) != wanted:
                    self.store.data["activeMiningSiteId"] = None
            self.store.save()
        return dict(location)

    def active_center(self) -> dict[str, Any] | None:
        signal = self.active_location_signal()
        if signal is None:
            return None
        center = next((row for row in self.centers_for_current_body() if int(row.get("signal") or 0) == signal), None)
        return dict(center) if center else None

    def deposits_for_active_location(self) -> list[dict[str, Any]]:
        signal = self.active_location_signal()
        if signal is None:
            return []
        return [row for row in self.sites_for_current_body() if int(row.get("signal") or 0) == signal]

    def select_site(self, site_id: str) -> dict[str, Any]:
        try:
            wanted = int(site_id)
        except (TypeError, ValueError):
            raise ValueError("site_not_found")
        site = next((row for row in self.sites_for_current_body() if int(row.get("id") or 0) == wanted), None)
        if not site:
            raise ValueError("site_not_found")
        with self.store.lock:
            self.store.data["activeMiningLocationSignal"] = int(site.get("signal") or 0)
            self.store.data["activeMiningSiteId"] = wanted
            self.store.save()
        return dict(site)

    def active_site(self) -> dict[str, Any] | None:
        deposits = self.deposits_for_active_location()
        if not deposits:
            return None
        with self.store.lock:
            raw = self.store.data.get("activeMiningSiteId")
        try:
            wanted = int(raw)
        except (TypeError, ValueError):
            wanted = 0
        site = next((row for row in deposits if int(row.get("id") or 0) == wanted), None)
        if site:
            return dict(site)
        if len(deposits) == 1:
            site = dict(deposits[0])
            with self.store.lock:
                self.store.data["activeMiningSiteId"] = int(site["id"])
                self.store.save()
            return site
        return None

    def _nav_to_point(self, latitude: float, longitude: float, target: dict[str, Any], target_type: str) -> dict[str, Any] | None:
        state = self.scout_state()
        status = state.get("status") or {}
        lat, lon, radius = status.get("latitude"), status.get("longitude"), status.get("planetRadius")
        if lat is None or lon is None or radius is None:
            return None
        nav = great_circle_nav(
            float(lat), float(lon), float(latitude), float(longitude), float(radius), status.get("heading")
        )
        return {**nav, "target": target, "targetType": target_type}

    def location_nav(self) -> dict[str, Any] | None:
        center = self.active_center()
        if not center:
            return None
        return self._nav_to_point(center["latitude"], center["longitude"], center, "center")

    def deposit_nav(self) -> dict[str, Any] | None:
        site = self.active_site()
        if not site:
            return None
        return self._nav_to_point(site["latitude"], site["longitude"], site, "deposit")

    def surface_nav(self) -> dict[str, Any] | None:
        # Backward-compatible alias for integrations that still expect one target.
        return self.deposit_nav() or self.location_nav()

    def set_site_center(self, site_number: int, commodity: str = "") -> dict[str, Any]:
        signal = int(site_number)
        if signal < 1:
            raise ValueError("invalid_signal")
        state = self.scout_state()
        if not self._in_ten16(state):
            raise ValueError("unsupported_system")
        status = state.get("status") or {}
        system = state.get("system") or {}
        lat, lon = status.get("latitude"), status.get("longitude")
        body = short_body_name(state)
        if lat is None or lon is None or not body:
            raise ValueError("surface_position_unavailable")
        payload = {
            "system": str(system.get("name") or ""),
            "systemAddress": str(system.get("address") or ""),
            "body": body,
            "bodyType": body_type_for_short_name(body),
            "signal": signal,
            "latitude": float(lat),
            "longitude": float(lon),
        }
        request = urllib.request.Request(
            SCOUT_MINING_CENTER_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        result = request_scout_json(request, "mining_center_save_failed")
        try:
            saved_center = canonical_mining_center(result.get("center"), body=body, signal=signal)
        except ValueError as exc:
            diagnostics = scout_diagnostics(result, SCOUT_MINING_CENTER_URL, 200, "invalid_mining_center_response")
            diagnostics["errorCode"] = "invalid_mining_center_response"
            diagnostics["detail"] += " · canonical center missing or invalid"
            raise HudRequestError(diagnostics) from exc
        with self.mining_lock:
            self.mining_centers = [
                row for row in self.mining_centers
                if not (
                    str(row.get("body") or "").casefold() == saved_center["body"].casefold()
                    and int(row.get("signal") or 0) == signal
                )
            ]
            self.mining_centers.append(saved_center)
            cached_centers = [dict(row) for row in self.mining_centers]
        with self.store.lock:
            self.store.data["activeMiningLocationSignal"] = signal
            self.store.data["miningCenters"] = cached_centers
            self.store.save()
        # Refresh in the background path, but the just-saved center is already
        # available to the compass immediately.
        return saved_center

    def report_deposit(self, commodity: str, rigs: int, notes: str, signal: int = 0) -> dict[str, Any]:
        commodity = commodity.strip()
        if not commodity:
            raise ValueError("commodity_required")
        if not 0 <= int(rigs) <= 100:
            raise ValueError("invalid_rig_count")
        state = self.scout_state()
        if not self._in_ten16(state):
            raise ValueError("unsupported_system")
        status = state.get("status") or {}
        system = state.get("system") or {}
        lat, lon = status.get("latitude"), status.get("longitude")
        radius = status.get("planetRadius")
        body = short_body_name(state)
        if lat is None or lon is None or not body:
            raise ValueError("surface_position_unavailable")
        chosen_signal = int(signal or self.active_location_signal() or 0)
        if chosen_signal < 1:
            raise ValueError("signal_required")
        payload = {
            "system": str(system.get("name") or ""),
            "systemAddress": str(system.get("address") or ""),
            "body": body,
            "bodyType": body_type_for_short_name(body),
            "signal": chosen_signal,
            "latitude": float(lat),
            "longitude": float(lon),
            "planetRadius": float(radius) if isinstance(radius, (int, float)) else None,
            "commodity": commodity,
            "rigs": int(rigs),
            "notes": notes.strip(),
        }
        request = urllib.request.Request(
            SCOUT_MINING_REPORT_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        result = request_scout_json(request, "mining_report_failed")
        with self.store.lock:
            log = self.store.data.setdefault("deposits", [])
            log.append({**payload, "remoteStatus": result.get("status"), "reportedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")})
            self.store.data["deposits"] = log[-100:]
            self.store.data["activeMiningLocationSignal"] = chosen_signal
            self.store.save()
        self._refresh_mining_data_once()
        return {
            "ok": True,
            "status": result.get("status"),
            "site": result.get("site"),
            "duplicate": result.get("duplicate"),
            "reportId": result.get("reportId"),
            "message": result.get("message") or "Mining deposit saved.",
            "latitude": float(lat),
            "longitude": float(lon),
            "signal": chosen_signal,
        }

    def mining_commodity_choices(self) -> tuple[list[str], list[str]]:
        state = self.scout_state()
        system = state.get("system") or {}
        system_name = str(system.get("name") or "").strip().casefold()
        body = short_body_name(state).casefold()

        with self.mining_lock:
            known_all = {
                str(row.get("commodity") or "").strip()
                for row in self.mining_sites
                if str(row.get("commodity") or "").strip()
            }
            body_known = {
                str(row.get("commodity") or "").strip()
                for row in self.mining_sites
                if str(row.get("commodity") or "").strip()
                and system_name
                and body
                and str(row.get("systemName") or TEN16_SYSTEM).strip().casefold() == system_name
                and str(row.get("body") or "").strip().casefold() == body
            }

        all_choices = sorted(
            set(SURFACE_MINING_COMMODITIES) | known_all,
            key=str.casefold,
        )
        current_body = sorted(body_known, key=str.casefold)
        return current_body, all_choices

    def controller_state(self) -> dict[str, Any]:
        state = self.scout_state()
        with self.lock:
            connected = self.snapshot.connected
        with self.store.lock:
            profile = self.store.data.get("profile", "combat")
        current_body_commodities, mining_commodities = self.mining_commodity_choices()
        return {
            "ok": True,
            "version": APP_VERSION,
            "connected": connected,
            "profile": profile,
            "scout": state,
            "sites": self.sites_for_current_body(),
            "miningLocations": self.mining_locations_for_current_body(),
            "activeLocationSignal": self.active_location_signal(),
            "activeCenter": self.active_center(),
            "activeSite": self.active_site(),
            "locationNav": self.location_nav(),
            "depositNav": self.deposit_nav(),
            "surfaceNav": self.surface_nav(),
            "miningStatus": self.mining_status_snapshot(),
            "miningCommoditiesCurrentBody": current_body_commodities,
            "miningCommodities": mining_commodities,
            "bounty": self.bounty_ledger(),
            "layout": self.layout_snapshot(),
            "notes": self.notes_text(),
            "missionSystem": self.mission_system_filter(),
            "voice": self.voice_settings_snapshot(),
            "voiceStatus": self.voice_status_snapshot(),
            "voiceCatalog": self.voice_catalog_snapshot(),
            "voicePack": self.voice_pack_status_snapshot(),
            "siteFeed": state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else None,
            "siteFeedStatus": state.get("siteFeedStatus") if isinstance(state.get("siteFeedStatus"), dict) else None,
            "renderErrors": [
                {"panel": panel_id, "errorType": str(info.get("renderErrorType"))}
                for panel_id, info in self.panel_windows.copy().items()
                if panel_id in PANEL_IDS and isinstance(info.get("renderErrorType"), str)
                and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,79}", info["renderErrorType"])
                and "mscout_" not in info["renderErrorType"]
            ],
            "targetScan": self.scan_status_snapshot(),
            "targetIntel": self.target_intel(state.get("target") if isinstance(state.get("target"), dict) else None),
            "recentTargets": self.recent_target_snapshot(),
        }

    @staticmethod
    def module_category(name: str) -> str:
        exact = TACTICAL_MODULES.get(str(name or ""))
        if exact:
            return exact
        matched = match_module_name(name)
        return TACTICAL_MODULES.get(matched or "", "core")

    def module_groups(self, target: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
        groups = {"offense": [], "defense": [], "special": []}
        modules = target.get("modules") or {}
        if not isinstance(modules, dict):
            return groups
        counts: dict[str, Counter] = {key: Counter() for key in groups}
        order: dict[str, list[str]] = {key: [] for key in groups}
        for module in modules.values():
            if not isinstance(module, dict):
                continue
            raw_name = str(module.get("name") or "")
            matched = match_module_name(raw_name) or raw_name
            category = self.module_category(matched)
            if category not in groups:
                continue
            canonical = "Heatsink Launcher" if matched == "Heat Sink Launcher" else matched
            if counts[category][canonical] == 0:
                order[category].append(canonical)
            counts[category][canonical] += 1
        for category in groups:
            groups[category] = [{"name": name, "count": counts[category][name]} for name in order[category]]
        return groups

    def tactical_groups_for_target(self, target: dict[str, Any] | None = None) -> dict[str, list[dict[str, Any]]]:
        current = target if isinstance(target, dict) else (self.scout_state().get("target") or {})
        intel = self.target_intel(current)
        if isinstance(intel, dict) and isinstance(intel.get("groups"), dict):
            return {
                "offense": list(intel["groups"].get("offense") or []),
                "defense": list(intel["groups"].get("defense") or []),
                "special": list(intel["groups"].get("special") or []),
            }
        return self.module_groups(current if isinstance(current, dict) else {})

    @staticmethod
    def tactical_lines(groups: dict[str, list[dict[str, Any]]]) -> list[str]:
        lines: list[str] = []
        for key, title in (("offense", "OFFENSE"), ("defense", "DEFENSE"), ("special", "SPECIAL")):
            rows = groups.get(key) or []
            if not rows:
                continue
            if lines:
                lines.append("")
            lines.append(title)
            for row in rows:
                name = str(row.get("name") or "Module")
                count = max(1, int(row.get("count") or 1))
                lines.append(name + (f" ×{count}" if count > 1 else ""))
        return lines

    def combat_panel_texts(self) -> dict[str, str]:
        state = self.scout_state()
        own = state.get("ship") or {}
        status = state.get("status") or {}
        target = state.get("target") or {}
        ledger = self.bounty_ledger()

        shields = own.get("shieldsUp")
        own_shield = "UP" if shields is True else "DOWN" if shields is False else "—"
        own_hull = own.get("hullHealth")
        hull_text = f"{own_hull:.0f}%" if isinstance(own_hull, (int, float)) else "—"
        ship_name = str(own.get("name") or own.get("type") or "YOUR SHIP").strip()
        current_jump = own.get("currentJumpRange")
        current_jump_text = f"{current_jump:.2f} LY" if isinstance(current_jump, (int, float)) else "—"
        unladen_jump = own.get("maxJumpRange")
        unladen_jump_text = f"{unladen_jump:.2f} LY" if isinstance(unladen_jump, (int, float)) else "—"
        fuel_main = status.get("fuelMain")
        fuel_reserve = status.get("fuelReserve")
        total_fuel = None
        if isinstance(fuel_main, (int, float)):
            total_fuel = float(fuel_main) + (float(fuel_reserve) if isinstance(fuel_reserve, (int, float)) else 0.0)
        fuel_text = f"{total_fuel:.1f} t" if isinstance(total_fuel, (int, float)) else "—"
        cargo = status.get("cargo")
        cargo_text = f"{int(cargo)} t" if isinstance(cargo, (int, float)) else "—"
        current_mass = own.get("currentMass")
        mass_text = f"{current_mass:.1f} t" if isinstance(current_mass, (int, float)) else "—"
        pips = status.get("pips")
        pip_text = "—"
        if isinstance(pips, list) and len(pips) >= 3:
            pip_text = f"SYS {pips[0]:.1f}  ENG {pips[1]:.1f}  WEP {pips[2]:.1f}"
        own_lines = [
            ship_name.upper(),
            f"SHIELDS {own_shield:<4}   HULL {hull_text:>4}",
            f"CURRENT JUMP {current_jump_text}",
            f"UNLADEN {unladen_jump_text}   FUEL {fuel_text}",
            f"CARGO {cargo_text}   MASS {mass_text}",
            pip_text,
        ]
        warnings = []
        for key, label in (("massLocked", "MASS LOCK"), ("silentRunning", "SILENT"), ("lowFuel", "LOW FUEL"), ("overheating", "OVERHEAT")):
            if status.get(key):
                warnings.append(label)
        if warnings:
            own_lines.append(" · ".join(warnings))

        bounty_text = "\n".join([
            "BOUNTIES",
            f"UNCLAIMED  {ledger['unclaimed']:>12,} CR",
            f"THIS RUN   {ledger['runEarned']:>12,} CR",
            f"KILLS      {ledger['runKills']:>12}",
            f"LAST       {ledger['last']:>12,} CR",
        ])

        if target:
            name = str(target.get("pilotName") or target.get("ship") or "TARGET")
            target_ship = str(target.get("ship") or "")
            target_lines = ["TARGET", f"{name}  {target_ship}".strip()]
            legal = str(target.get("legalStatus") or "").upper()
            bounty = target.get("bounty")
            legal_line = legal
            if isinstance(bounty, int) and bounty > 0:
                legal_line = (legal_line + "   " if legal_line else "") + f"{bounty:,} CR"
            if legal_line:
                target_lines.append(legal_line)
            subsystem = target.get("subsystem") or {}
            if subsystem.get("name"):
                target_lines += ["", f"SELECTED  {str(subsystem['name'])}"]
            target_text = "\n".join(target_lines)
        else:
            target_text = "TARGET\nNO TARGET"

        groups = self.tactical_groups_for_target(target)
        subsystem_lines = ["TARGET LOADOUT"]
        tactical = self.tactical_lines(groups)
        if tactical:
            subsystem_lines.extend(tactical)
        else:
            subsystem_lines.append("No tactical loadout captured.")

        return {
            "own": "\n".join(own_lines),
            "target": target_text,
            "subsystems": "\n".join(subsystem_lines),
            "bounties": bounty_text,
        }

    def combat_lines(self) -> list[str]:
        state = self.scout_state()
        own = state.get("ship") or {}
        status = state.get("status") or {}
        target = state.get("target") or {}
        ledger = self.bounty_ledger()
        shields = own.get("shieldsUp")
        own_shield = "UP" if shields is True else "DOWN" if shields is False else "—"
        own_hull = own.get("hullHealth")
        hull_text = f"{own_hull:.0f}%" if isinstance(own_hull, (int, float)) else "—"
        ship_name = str(own.get("name") or own.get("type") or "YOUR SHIP").strip()
        current_jump = own.get("currentJumpRange")
        current_jump_text = f"{current_jump:.2f} LY" if isinstance(current_jump, (int, float)) else "—"
        unladen_jump = own.get("maxJumpRange")
        unladen_jump_text = f"{unladen_jump:.2f} LY" if isinstance(unladen_jump, (int, float)) else "—"
        fuel_main = status.get("fuelMain")
        fuel_reserve = status.get("fuelReserve")
        total_fuel = float(fuel_main) + (float(fuel_reserve) if isinstance(fuel_reserve, (int, float)) else 0.0) if isinstance(fuel_main, (int, float)) else None
        fuel_text = f"{total_fuel:.1f} t" if isinstance(total_fuel, (int, float)) else "—"
        cargo = status.get("cargo")
        cargo_text = f"{int(cargo)} t" if isinstance(cargo, (int, float)) else "—"
        current_mass = own.get("currentMass")
        mass_text = f"{current_mass:.1f} t" if isinstance(current_mass, (int, float)) else "—"
        pips = status.get("pips")
        pip_text = "—"
        if isinstance(pips, list) and len(pips) >= 3:
            pip_text = f"SYS {pips[0]:.1f}  ENG {pips[1]:.1f}  WEP {pips[2]:.1f}"
        lines = ["COMBAT", f"{ship_name.upper()}   CURRENT {current_jump_text}   UNLADEN {unladen_jump_text}", f"FUEL {fuel_text}   CARGO {cargo_text}   MASS {mass_text}", f"SHIELDS {own_shield:<4}   HULL {hull_text:>4}   PIPS {pip_text}"]
        warnings = []
        for key, label in (("massLocked", "MASS LOCK"), ("silentRunning", "SILENT"), ("lowFuel", "LOW FUEL"), ("overheating", "OVERHEAT")):
            if status.get(key):
                warnings.append(label)
        if warnings:
            lines.append("STATUS   " + " · ".join(warnings))
        lines += ["", f"BOUNTIES   UNCLAIMED {ledger['unclaimed']:,} CR   THIS RUN {ledger['runEarned']:,} CR   KILLS {ledger['runKills']}   LAST {ledger['last']:,} CR"]
        if not target:
            return lines + ["", "NO TARGET"]
        name = str(target.get("pilotName") or target.get("ship") or "TARGET")
        target_ship = str(target.get("ship") or "")
        legal = str(target.get("legalStatus") or "").upper()
        bounty = target.get("bounty")
        target_bits = [f"{name}  {target_ship}".strip()]
        if legal:
            target_bits.append(legal)
        if isinstance(bounty, int) and bounty > 0:
            target_bits.append(f"{bounty:,} CR")
        lines += ["", "TARGET   " + "   ".join(target_bits)]
        subsystem = target.get("subsystem") or {}
        if subsystem.get("name"):
            lines.append(f"SELECTED  {str(subsystem['name'])}")
        groups = self.tactical_groups_for_target(target)
        tactical = self.tactical_lines(groups)
        if tactical:
            lines += ["", "TARGET LOADOUT", *tactical]
        return lines

    def surface_lines(self) -> list[str]:
        state = self.scout_state()
        status = state.get("status") or {}
        system = state.get("system") or {}
        lines = ["SURFACE MINING", str(system.get("name") or "—"), str(status.get("bodyName") or "—")]
        nav = self.surface_nav()
        if nav:
            # Navigation targets were generalized from the legacy "site" field
            # to "target" when location centers were added. Accept both shapes
            # so the shared text renderer cannot blank unrelated panels such as
            # Bounties and Notes while a surface target is active.
            site = nav.get("target") if isinstance(nav.get("target"), dict) else nav.get("site")
            site = site if isinstance(site, dict) else {}
            label = f"SIGNAL #{site.get('signal')}" if site.get("signal") else "ACTIVE SURFACE TARGET"
            if site.get("commodity"):
                label += f" · {site['commodity']}"
            lines += ["", label, f"{format_distance(nav['distance'])}   {nav['bearing']:.0f}°   {relative_text(nav.get('relative'))}"]
        else:
            lines += ["", "NO ACTIVE SITE ON THIS BODY"]
        lat, lon = status.get("latitude"), status.get("longitude")
        if lat is not None and lon is not None:
            lines += ["", f"{float(lat):.6f}, {float(lon):.6f}"]
        return lines

    @staticmethod
    def compact_credits(value: Any) -> str:
        try:
            amount = max(0.0, float(value))
        except (TypeError, ValueError):
            return "0"
        if amount >= 1_000_000_000:
            return f"{amount / 1_000_000_000:.1f}B"
        if amount >= 1_000_000:
            return f"{amount / 1_000_000:.1f}M"
        if amount >= 1_000:
            return f"{amount / 1_000:.0f}K"
        return f"{amount:.0f}"

    @staticmethod
    def clip_line(value: Any, length: int = 72) -> str:
        text = " ".join(str(value or "").split())
        return text if len(text) <= length else text[: max(1, length - 1)] + "…"

    def site_panel_texts(self) -> dict[str, str]:
        state = self.scout_state()
        feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        feed_status = state.get("siteFeedStatus") if isinstance(state.get("siteFeedStatus"), dict) else {}
        if not feed:
            reason = str(feed_status.get("error") or "waiting").replace("_", " ").upper()
            waiting = f"SITE FEED\n{reason}"
            return {
                "mission": waiting,
                "trade": waiting,
                "scoutboard": waiting,
                "alerts": "LEADERSHIP ALERTS\nWAITING FOR SITE FEED",
            }

        mission = feed.get("mission") if isinstance(feed.get("mission"), dict) else {}
        mission_lines = [
            "MISSION CONTROL",
            f"ORDERS {int(mission.get('orderCount') or 0)}   ATTENTION {int(mission.get('attentionCount') or 0)}",
        ]
        orders = mission.get("orders") if isinstance(mission.get("orders"), list) else []
        for row in orders[:5]:
            if not isinstance(row, dict):
                continue
            prefix = str(row.get("priority") or "").upper()
            label = f"{row.get('system') or 'Squad-wide'} · {row.get('task') or 'Operational task'}"
            mission_lines.append(self.clip_line((prefix + "  " if prefix else "") + label, 78))
            progress = row.get("progress") if isinstance(row.get("progress"), dict) else {}
            target_value = progress.get("target")
            current_value = progress.get("current")
            if isinstance(target_value, (int, float)) and isinstance(current_value, (int, float)):
                mission_lines.append(f"  {current_value:g} / {target_value:g} {progress.get('unit') or ''} · {float(progress.get('percent') or 0):.0f}%")
        attention = mission.get("attention") if isinstance(mission.get("attention"), list) else []
        if attention:
            mission_lines.extend(["", "WATCH"])
            for row in attention[:4]:
                if not isinstance(row, dict):
                    continue
                influence = row.get("influence")
                inf = f" {float(influence):.1f}%" if isinstance(influence, (int, float)) else ""
                alerts = row.get("alerts") if isinstance(row.get("alerts"), list) else []
                detail = alerts[0] if alerts else row.get("objective") or ""
                mission_lines.append(self.clip_line(f"{row.get('system') or 'System'}{inf} · {detail}", 78))

        trade = feed.get("trade") if isinstance(feed.get("trade"), dict) else {}
        trade_lines = ["TRADER'S OUTPOST", f"ACTIVE {int(trade.get('activeCount') or 0)}"]
        routes = trade.get("routes") if isinstance(trade.get("routes"), list) else []
        for row in routes[:6]:
            if not isinstance(row, dict):
                continue
            state_text = str(row.get("state") or "").upper()
            profit = row.get("loopProfit") or row.get("profitPerTon") or 0
            suffix = f" · {self.compact_credits(profit)} CR"
            if state_text and state_text != "HEALTHY":
                suffix += f" · {state_text}"
            trade_lines.append(self.clip_line(f"{row.get('title') or 'Trade Route'}{suffix}", 78))

        scout = feed.get("scout") if isinstance(feed.get("scout"), dict) else {}
        summary = scout.get("summary") if isinstance(scout.get("summary"), dict) else {}
        scout_lines = [
            "SCOUT BOARD",
            f"AVAILABLE {int(summary.get('available') or 0)}   CLAIMED {int(summary.get('claimed') or 0)}   PRIORITY {int(summary.get('priority') or 0)}",
        ]
        jobs = scout.get("jobs") if isinstance(scout.get("jobs"), list) else []
        for row in jobs[:6]:
            if not isinstance(row, dict):
                continue
            reward = float(row.get("rewardMillions") or 0)
            status = str(row.get("status") or "").upper()
            line = f"{row.get('system') or 'System'} · {status}"
            if reward > 0:
                line += f" · {reward:g}M"
            if row.get("claimMine"):
                line += " · YOUR CLAIM"
            elif row.get("claimCommander"):
                line += f" · {row.get('claimCommander')}"
            scout_lines.append(self.clip_line(line, 78))

        alert_rows = [row for row in (feed.get("alerts") if isinstance(feed.get("alerts"), list) else []) if isinstance(row, dict)]
        unacked = [row for row in alert_rows if not bool(row.get("acknowledged"))]
        if alert_rows:
            alert_lines = [f"LEADERSHIP ALERTS · {len(unacked)} UNACKNOWLEDGED · {len(alert_rows)} ACTIVE"]
            for row in alert_rows[:6]:
                state_label = "ACK" if row.get("acknowledged") else "NEW"
                alert_lines.append(self.clip_line(f"{state_label} · {str(row.get('type') or '').upper()} · {row.get('title') or 'Alert'}", 78))
                if row.get("detail"):
                    alert_lines.append("  " + self.clip_line(row.get("detail"), 74))
        else:
            alert_lines = ["LEADERSHIP ALERTS", "CLEAR"]

        return {
            "mission": "\n".join(mission_lines),
            "trade": "\n".join(trade_lines),
            "scoutboard": "\n".join(scout_lines),
            "alerts": "\n".join(alert_lines),
        }

    def panel_texts(self) -> dict[str, str]:
        panels = self.combat_panel_texts()
        panels["surface"] = "\n".join(self.surface_lines())
        panels.update(self.site_panel_texts())
        notes = self.notes_text().strip()
        panels["notes"] = "NOTES\n" + (notes if notes else "No notes.")
        return panels

    @staticmethod
    def _panel_font(scale: float, size: int, bold: bool = False) -> tuple[Any, ...]:
        # Canvas text became too thin/small on wide high-resolution displays in 0.6.0.
        # Keep the technical Consolas look, but give small tactical text a readable floor
        # and use bold weight for the compact labels/details that must remain glanceable.
        weight = "bold" if bold or size <= 11 else "normal"
        return ("Consolas", max(10, round(size * scale)), weight)

    @staticmethod
    def _alert_color(row: dict[str, Any]) -> str:
        indicator = str(row.get("indicator") or "").lower()
        if indicator == "red":
            return HUD_RED
        if indicator == "amber":
            return HUD_AMBER
        if indicator == "cyan":
            return HUD_CYAN
        return HUD_WHITE

    def _target_transients(self, target: dict[str, Any]) -> None:
        key = self.target_identity(target)
        if key != self._last_target_identity:
            self._last_target_identity = key
            self._wanted_flash_key = ""
            if key and self.target_intel(target):
                self.restored_target_until = time.monotonic() + 1.8
        if key and str(target.get("legalStatus") or "").casefold() == "wanted" and self._wanted_flash_key != key:
            self._wanted_flash_key = key
            self.wanted_flash_until = time.monotonic() + 3.0

    def _draw_title(self, canvas: tk.Canvas, title: str, scale: float, width: int, color: str = HUD_CYAN) -> float:
        y = 8 * scale
        self._draw_text(canvas, 8 * scale, y, title, scale, 15, color, True)
        line_y = y + 23 * scale
        canvas.create_line(8 * scale, line_y, width - 8 * scale, line_y, fill=HUD_DIM, width=max(1, round(scale)))
        return line_y + 8 * scale

    def _draw_text(self, canvas: tk.Canvas, x: float, y: float, text: Any, scale: float, size: int = 11, color: str = HUD_WHITE, bold: bool = False, anchor: str = "nw", width: float | None = None) -> int:
        kwargs: dict[str, Any] = {"text": str(text), "anchor": anchor, "fill": color, "font": self._panel_font(scale, size, bold)}
        if width is not None:
            kwargs["width"] = width
        # Windows transparent-color mode makes the cockpit/background visible
        # directly behind the HUD. A thin near-black halo keeps small cyan/white
        # text readable over bright stars, planet limbs and orange cockpit art
        # without adding opaque panel boxes.
        halo = max(1, round(scale * 0.85))
        shadow_kwargs = dict(kwargs)
        shadow_kwargs["fill"] = HUD_SHADOW
        for dx, dy in ((-halo, 0), (halo, 0), (0, -halo), (0, halo)):
            canvas.create_text(x + dx, y + dy, **shadow_kwargs)
        return canvas.create_text(x, y, **kwargs)

    def _draw_progress(self, canvas: tk.Canvas, x: float, y: float, width: float, percent: float, scale: float, color: str = HUD_CYAN) -> None:
        height = max(5, round(7 * scale))
        pct = max(0.0, min(100.0, float(percent)))
        canvas.create_rectangle(x, y, x + width, y + height, outline=HUD_DIM, width=max(1, round(scale)))
        if pct > 0:
            canvas.create_rectangle(x + 1, y + 1, x + 1 + max(0, width - 2) * pct / 100.0, y + height - 1, outline="", fill=color)

    def _draw_nav_compass(self, canvas: tk.Canvas, cx: float, cy: float, radius: float, nav: dict[str, Any], scale: float) -> None:
        canvas.create_oval(cx - radius, cy - radius, cx + radius, cy + radius, outline=HUD_DIM, width=max(1, round(1.5 * scale)))
        inner = radius * 0.72
        canvas.create_oval(cx - inner, cy - inner, cx + inner, cy + inner, outline=HUD_DIM, width=max(1, round(scale)))
        for degrees in range(0, 360, 45):
            angle = math.radians(degrees)
            outer_x = cx + math.sin(angle) * radius
            outer_y = cy - math.cos(angle) * radius
            inner_x = cx + math.sin(angle) * (radius - 7 * scale)
            inner_y = cy - math.cos(angle) * (radius - 7 * scale)
            canvas.create_line(inner_x, inner_y, outer_x, outer_y, fill=HUD_MUTED, width=max(1, round(scale)))
        self._draw_text(canvas, cx, cy - radius - 3 * scale, "AHEAD", scale, 7, HUD_MUTED, True, "s")

        relative = nav.get("relative")
        if isinstance(relative, (int, float)):
            angle = math.radians(float(relative))
            mode = "REL"
        else:
            angle = math.radians(float(nav.get("bearing") or 0.0))
            mode = "N-UP"
        tip_x = cx + math.sin(angle) * (radius - 10 * scale)
        tip_y = cy - math.cos(angle) * (radius - 10 * scale)
        tail_x = cx - math.sin(angle) * (radius * 0.23)
        tail_y = cy + math.cos(angle) * (radius * 0.23)
        wing = 7 * scale
        perp_x = math.cos(angle) * wing
        perp_y = math.sin(angle) * wing
        canvas.create_polygon(
            tip_x, tip_y,
            tail_x + perp_x, tail_y + perp_y,
            tail_x - perp_x, tail_y - perp_y,
            fill=HUD_CYAN,
            outline=HUD_SHADOW,
            width=max(1, round(scale)),
        )
        canvas.create_oval(cx - 3 * scale, cy - 3 * scale, cx + 3 * scale, cy + 3 * scale, fill=HUD_WHITE, outline=HUD_SHADOW)
        self._draw_text(canvas, cx, cy + radius + 5 * scale, mode, scale, 7, HUD_MUTED, True, "n")

    def _render_surface_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        status = state.get("status") or {}
        system = state.get("system") or {}
        width = round(720 * scale)
        y = self._draw_title(canvas, "SURFACE NAVIGATION", scale, width)

        body = short_body_name(state) or str(status.get("bodyName") or "—")
        self._draw_text(canvas, 8 * scale, y, body.upper(), scale, 13, HUD_WHITE, True)
        self._draw_text(canvas, width - 8 * scale, y, self.clip_line(system.get("name") or "—", 42), scale, 8, HUD_MUTED, True, "ne")
        y += 24 * scale

        if not self._in_ten16(state):
            self._draw_text(canvas, 8 * scale, y, "CURATED MINING NAV AVAILABLE IN 10-16", scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

        signal = self.active_location_signal()
        if signal is None:
            locations = self.mining_locations_for_current_body()
            message = f"SELECT A MINING LOCATION · {len(locations)} KNOWN" if locations else "SELECT OR CREATE A MINING LOCATION"
            self._draw_text(canvas, 8 * scale, y, message, scale, 10, HUD_AMBER, True)
            return width, round(y + 30 * scale)

        location_nav = self.location_nav()
        deposit_nav = self.deposit_nav()
        center = self.active_center()
        deposit = self.active_site()
        column_width = width / 2
        block_top = y

        def draw_target_block(x0: float, title: str, nav: dict[str, Any] | None, target: dict[str, Any] | None, empty: str) -> float:
            local_y = block_top
            self._draw_text(canvas, x0 + 8 * scale, local_y, title, scale, 9, HUD_CYAN, True)
            local_y += 20 * scale
            if not nav or not target:
                self._draw_text(canvas, x0 + 8 * scale, local_y, empty, scale, 10, HUD_AMBER, True)
                return local_y + 28 * scale

            compass_cx = x0 + column_width - 64 * scale
            compass_cy = local_y + 46 * scale
            self._draw_nav_compass(canvas, compass_cx, compass_cy, 42 * scale, nav, scale)

            self._draw_text(canvas, x0 + 8 * scale, local_y, "RANGE", scale, 8, HUD_MUTED, True)
            self._draw_text(canvas, x0 + 75 * scale, local_y, format_distance(nav.get("distance")), scale, 10, HUD_WHITE, True)
            local_y += 19 * scale
            self._draw_text(canvas, x0 + 8 * scale, local_y, "BEARING", scale, 8, HUD_MUTED, True)
            self._draw_text(canvas, x0 + 75 * scale, local_y, f"{float(nav.get('bearing') or 0):.0f}°", scale, 10, HUD_CYAN, True)
            local_y += 19 * scale
            self._draw_text(canvas, x0 + 8 * scale, local_y, "TURN", scale, 8, HUD_MUTED, True)
            self._draw_text(canvas, x0 + 75 * scale, local_y, relative_text(nav.get("relative")) or "—", scale, 10, HUD_CYAN, True)
            local_y += 23 * scale
            self._draw_text(
                canvas,
                x0 + 8 * scale,
                local_y,
                f"{float(target['latitude']):.6f}, {float(target['longitude']):.6f}",
                scale,
                8,
                HUD_MUTED,
                True,
            )
            return max(local_y + 16 * scale, compass_cy + 50 * scale)

        center_title = f"LOCATION CENTER · SIGNAL #{signal}"
        left_bottom = draw_target_block(0, center_title, location_nav, center, "CENTER NOT SET")

        deposit_title = "SELECTED DEPOSIT"
        if deposit:
            deposit_title += f" · {str(deposit.get('commodity') or 'MINERAL').upper()}"
            if isinstance(deposit.get("rigs"), int):
                deposit_title += f" · {int(deposit['rigs'])}R"
        right_bottom = draw_target_block(column_width, deposit_title, deposit_nav, deposit, "NO DEPOSIT SELECTED")

        y = max(left_bottom, right_bottom) + 8 * scale
        canvas.create_line(column_width, block_top, column_width, y - 4 * scale, fill=HUD_DIM, width=max(1, round(scale)))

        heading = status.get("heading")
        lat, lon = status.get("latitude"), status.get("longitude")
        if isinstance(heading, (int, float)):
            self._draw_text(canvas, 8 * scale, y, f"CURRENT HEADING  {float(heading):.0f}°", scale, 8, HUD_MUTED, True)
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            self._draw_text(canvas, width - 8 * scale, y, f"CURRENT  {float(lat):.6f}, {float(lon):.6f}", scale, 8, HUD_MUTED, True, "ne")
        y += 17 * scale
        return width, round(y + 6 * scale)

    def _render_miningintel_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        status = state.get("status") or {}
        width = round(470 * scale)
        y = self._draw_title(canvas, "MINING INTEL", scale, width)

        signal = self.active_location_signal()
        sites = self.deposits_for_active_location() if signal is not None else []
        if not sites:
            message = (f"NO DEPOSITS SAVED FOR SIGNAL #{signal}" if signal is not None else "SELECT A MINING LOCATION") if self._in_ten16(state) else "AVAILABLE IN 10-16"
            self._draw_text(canvas, 8 * scale, y, message, scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

        lat, lon, radius = status.get("latitude"), status.get("longitude"), status.get("planetRadius")
        active = self.active_site()
        active_id = int(active.get("id") or 0) if isinstance(active, dict) else 0
        ranked: list[tuple[float | None, dict[str, Any]]] = []
        for site in sites:
            distance = None
            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and isinstance(radius, (int, float)):
                nav = great_circle_nav(float(lat), float(lon), float(site["latitude"]), float(site["longitude"]), float(radius))
                distance = float(nav["distance"])
            ranked.append((distance, site))
        ranked.sort(key=lambda item: (
            item[0] is None,
            item[0] if item[0] is not None else float("inf"),
            not bool(item[1].get("preferred")),
            -int(item[1].get("rigs") or 0),
        ))

        self._draw_text(canvas, 8 * scale, y, f"SIGNAL #{signal} · {len(sites)} DEPOSIT{'S' if len(sites) != 1 else ''}", scale, 9, HUD_WHITE, True)
        self._draw_text(canvas, width - 8 * scale, y, "NEAREST 5", scale, 8, HUD_MUTED, True, "ne")
        y += 22 * scale

        for distance, site in ranked[:5]:
            selected = int(site.get("id") or 0) == active_id
            marker = "TARGET" if selected else ("PRIMARY" if site.get("preferred") else "")
            commodity = str(site.get("commodity") or "Mining spot")
            signal = int(site.get("signal") or 0)
            rigs = site.get("rigs")
            left = f"#{signal} · {commodity}"
            if isinstance(rigs, int):
                left += f" · {rigs}R"
            self._draw_text(canvas, 8 * scale, y, self.clip_line(left, 46), scale, 10, HUD_CYAN if selected else HUD_WHITE, True)
            if distance is not None:
                self._draw_text(canvas, width - 8 * scale, y, format_distance(distance), scale, 9, HUD_CYAN if selected else HUD_MUTED, True, "ne")
            y += 17 * scale
            detail_parts = []
            if marker:
                detail_parts.append(marker)
            notes = str(site.get("notes") or "").strip()
            if notes:
                detail_parts.append(self.clip_line(notes, 58))
            if detail_parts:
                self._draw_text(canvas, 18 * scale, y, " · ".join(detail_parts), scale, 8, HUD_AMBER if selected else HUD_MUTED, selected)
                y += 15 * scale
            y += 3 * scale

        return width, round(y + 5 * scale)

    def _render_own_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        own, status = state.get("ship") or {}, state.get("status") or {}
        width = round(410 * scale)
        y = self._draw_title(canvas, "OWN SHIP", scale, width)
        ship_name = str(own.get("name") or own.get("type") or "YOUR SHIP").upper()
        self._draw_text(canvas, 8 * scale, y, ship_name, scale, 17, HUD_WHITE, True); y += 27 * scale
        current = own.get("currentJumpRange")
        current_text = f"{current:.2f} LY" if isinstance(current, (int, float)) else "—"
        unladen = own.get("maxJumpRange")
        fuel_main, fuel_reserve = status.get("fuelMain"), status.get("fuelReserve")
        total_fuel = float(fuel_main) + (float(fuel_reserve) if isinstance(fuel_reserve, (int, float)) else 0.0) if isinstance(fuel_main, (int, float)) else None
        rows = [
            ("CURRENT JUMP", current_text),
            ("UNLADEN", f"{unladen:.2f} LY" if isinstance(unladen, (int, float)) else "—"),
            ("FUEL", f"{total_fuel:.1f} t" if isinstance(total_fuel, (int, float)) else "—"),
            ("CARGO", f"{int(status.get('cargo'))} t" if isinstance(status.get("cargo"), (int, float)) else "—"),
            ("MASS", f"{own.get('currentMass'):.1f} t" if isinstance(own.get("currentMass"), (int, float)) else "—"),
        ]
        for label, value in rows:
            self._draw_text(canvas, 8 * scale, y, label, scale, 9, HUD_MUTED, True)
            self._draw_text(canvas, 138 * scale, y, value, scale, 11, HUD_WHITE, True); y += 18 * scale
        shields = own.get("shieldsUp")
        shield_text = "UP" if shields is True else "DOWN" if shields is False else "—"
        shield_color = HUD_CYAN if shields is True else HUD_RED if shields is False else HUD_MUTED
        self._draw_text(canvas, 8 * scale, y, "SHIELDS", scale, 9, HUD_MUTED, True)
        self._draw_text(canvas, 138 * scale, y, shield_text, scale, 11, shield_color, True)
        hull = own.get("hullHealth")
        if isinstance(hull, (int, float)):
            self._draw_text(canvas, 220 * scale, y, "HULL", scale, 9, HUD_MUTED, True)
            self._draw_text(canvas, 280 * scale, y, f"{hull:.0f}%", scale, 11, HUD_WHITE, True)
        y += 20 * scale
        pips = status.get("pips")
        if isinstance(pips, list) and len(pips) >= 3:
            self._draw_text(canvas, 8 * scale, y, f"SYS {pips[0]:.1f}   ENG {pips[1]:.1f}   WEP {pips[2]:.1f}", scale, 11, HUD_WHITE, True); y += 20 * scale
        warnings = [label for key, label in (("massLocked", "MASS LOCK"), ("silentRunning", "SILENT"), ("lowFuel", "LOW FUEL"), ("overheating", "OVERHEAT")) if status.get(key)]
        if warnings:
            self._draw_text(canvas, 8 * scale, y, " · ".join(warnings), scale, 10, HUD_AMBER, True); y += 20 * scale
        return width, round(y + 8 * scale)

    def _render_target_canvas(self, canvas: tk.Canvas, scale: float, flash_on: bool) -> tuple[int, int]:
        state = self.scout_state(); target = state.get("target") or {}
        self._target_transients(target if isinstance(target, dict) else {})
        width = round(420 * scale); y = self._draw_title(canvas, "TARGET", scale, width)
        if not target:
            self._draw_text(canvas, 8 * scale, y, "NO TARGET", scale, 14, HUD_MUTED, True)
            return width, round(y + 32 * scale)
        name = str(target.get("pilotName") or target.get("ship") or "TARGET")
        ship = str(target.get("ship") or "")
        self._draw_text(canvas, 8 * scale, y, name, scale, 16, HUD_WHITE, True); y += 24 * scale
        if ship and ship.casefold() not in name.casefold():
            self._draw_text(canvas, 8 * scale, y, ship.upper(), scale, 10, HUD_MUTED, True); y += 18 * scale
        legal = str(target.get("legalStatus") or "").upper()
        bounty = target.get("bounty")
        if legal:
            wanted_flashing = legal == "WANTED" and time.monotonic() < self.wanted_flash_until
            legal_color = HUD_RED if legal == "WANTED" and (not wanted_flashing or flash_on) else HUD_DIM if legal == "WANTED" else HUD_WHITE
            self._draw_text(canvas, 8 * scale, y, legal, scale, 15 if legal == "WANTED" else 11, legal_color, True)
            if isinstance(bounty, int) and bounty > 0:
                self._draw_text(canvas, width - 8 * scale, y + 2 * scale, f"{bounty:,} CR", scale, 11, HUD_WHITE, True, "ne")
            y += 24 * scale
        subsystem = target.get("subsystem") or {}
        if subsystem.get("name"):
            self._draw_text(canvas, 8 * scale, y, "SELECTED", scale, 9, HUD_MUTED, True)
            self._draw_text(canvas, 100 * scale, y, subsystem.get("name"), scale, 11, HUD_CYAN, True); y += 20 * scale
        if self.target_intel(target):
            label = "LOADOUT RESTORED" if time.monotonic() < self.restored_target_until else "LOADOUT CACHED"
            self._draw_text(canvas, 8 * scale, y, label, scale, 9, HUD_GREEN, True); y += 18 * scale
        return width, round(y + 8 * scale)

    def _render_loadout_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state(); target = state.get("target") or {}
        width = round(440 * scale); y = self._draw_title(canvas, "TARGET LOADOUT", scale, width)
        scan = self.scan_status_snapshot()
        groups = self.tactical_groups_for_target(target if isinstance(target, dict) else {})
        if not any(groups.values()):
            self._draw_text(canvas, 8 * scale, y, "NO CAPTURE FOR CURRENT TARGET", scale, 11, HUD_MUTED, True); y += 21 * scale
            self._draw_text(canvas, 8 * scale, y, "Open Target → Sub-Targets, then tap SCAN LOADOUT.", scale, 9, HUD_MUTED, False, "nw", width - 16 * scale)
            return width, round(y + 42 * scale)
        colors = {"offense": HUD_RED, "defense": HUD_CYAN, "special": HUD_AMBER}
        titles = {"offense": "OFFENSE", "defense": "DEFENSE", "special": "SPECIAL"}
        for category in ("offense", "defense", "special"):
            rows = groups.get(category) or []
            if not rows:
                continue
            self._draw_text(canvas, 8 * scale, y, titles[category], scale, 10, colors[category], True); y += 19 * scale
            for row in rows:
                count = max(1, int(row.get("count") or 1))
                label = str(row.get("name") or "Module") + (f" ×{count}" if count > 1 else "")
                self._draw_text(canvas, 20 * scale, y, label, scale, 11, HUD_WHITE, True); y += 18 * scale
            y += 5 * scale
        return width, round(y + 5 * scale)

    def site_feed_status_lines(self, state: dict[str, Any], has_section: bool) -> list[str]:
        feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        status = state.get("siteFeedStatus") if isinstance(state.get("siteFeedStatus"), dict) else {}
        with self.lock:
            connected = self.snapshot.connected
        if connected and status.get("ok") is True and has_section:
            return []
        failed = not connected or status.get("ok") is False
        label = "STALE SITE FEED" if feed and failed else "SITE FEED UNAVAILABLE" if failed else "SITE FEED WAITING"
        reason = []
        if not connected:
            reason.append("SCOUT BRIDGE OFFLINE")
        upstream = status.get("upstreamStatus")
        if type(upstream) is int and 100 <= upstream <= 599:
            reason.append(f"UPSTREAM HTTP {upstream}")
        code = safe_error_code(status.get("errorCode")) or safe_error_code(status.get("error"))
        if code:
            reason.append(f"CLOUDFLARE {code}" if code in {"1101", "1102"} else code.replace("_", " ").upper())
        elif not has_section and feed:
            reason.append("SECTION MISSING")
        elif not reason:
            reason.append("REFRESH PENDING")
        lines = [label + " · " + " · ".join(reason)]
        if feed and failed:
            lines.append("LAST GOOD FEED " + iso_age(feed.get("generatedAt") or status.get("updatedAt")) + " AGO")
        return lines

    def _draw_site_feed_status(self, canvas: tk.Canvas, scale: float, width: int, y: float, state: dict[str, Any], has_section: bool) -> float:
        for line in self.site_feed_status_lines(state, has_section):
            self._draw_text(canvas, 8 * scale, y, self.clip_line(line, 68), scale, 8, HUD_AMBER, True, "nw", width - 16 * scale)
            y += 20 * scale
        return y

    def _render_mission_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state(); feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        mission = feed.get("mission") if isinstance(feed.get("mission"), dict) else {}
        width = round(520 * scale); y = self._draw_title(canvas, "MISSION CONTROL", scale, width)
        y = self._draw_site_feed_status(canvas, scale, width, y, state, bool(mission))
        if not mission:
            return width, round(y + 8 * scale)

        all_orders = [row for row in (mission.get("orders") if isinstance(mission.get("orders"), list) else []) if isinstance(row, dict)]
        systems = [str(value or "").strip() for value in (mission.get("systems") if isinstance(mission.get("systems"), list) else []) if str(value or "").strip()]
        selected = self.mission_system_filter()
        if selected != "all" and selected not in systems:
            selected = "all"
        orders = all_orders if selected == "all" else [row for row in all_orders if str(row.get("system") or "").strip() == selected]

        self._draw_text(canvas, 8 * scale, y, f"{int(mission.get('orderCount') or 0)} ORDERS", scale, 10, HUD_WHITE, True)
        filter_label = "TOP 5 · ALL SYSTEMS" if selected == "all" else selected
        self._draw_text(canvas, width - 8 * scale, y, self.clip_line(filter_label, 34), scale, 9, HUD_CYAN, True, "ne"); y += 23 * scale

        visible = orders[:5]
        if not visible:
            self._draw_text(canvas, 8 * scale, y, "NO ORDERS FOR SELECTED SYSTEM", scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

        groups: list[tuple[str, list[dict[str, Any]]]] = []
        by_system: dict[str, list[dict[str, Any]]] = {}
        for row in visible:
            system_name = str(row.get("system") or "SQUAD-WIDE").strip() or "SQUAD-WIDE"
            if system_name not in by_system:
                by_system[system_name] = []
                groups.append((system_name, by_system[system_name]))
            by_system[system_name].append(row)

        for group_index, (system_name, rows) in enumerate(groups):
            if group_index:
                y += 4 * scale
            self._draw_text(canvas, 8 * scale, y, self.clip_line(system_name, 56), scale, 9, HUD_CYAN, True); y += 19 * scale
            for row in rows:
                priority = str(row.get("priority") or "").upper()
                priority_color = HUD_RED if priority in {"CRITICAL", "URGENT"} else HUD_AMBER if priority in {"HIGH", "PRIORITY"} else HUD_CYAN
                task = str(row.get("task") or "Operational task")
                task_id = self._draw_text(
                    canvas,
                    18 * scale,
                    y,
                    self.clip_line(task, 68),
                    scale,
                    10,
                    HUD_WHITE,
                    True,
                    "nw",
                    width - 125 * scale,
                )
                task_top = y
                if priority:
                    self._draw_text(canvas, width - 8 * scale, task_top, priority, scale, 9, priority_color, True, "ne")
                task_box = canvas.bbox(task_id)
                if task_box:
                    y = max(task_top + 19 * scale, float(task_box[3]) + 5 * scale)
                else:
                    y = task_top + 19 * scale

                progress = row.get("progress") if isinstance(row.get("progress"), dict) else {}
                target = progress.get("target"); current = progress.get("current")
                if isinstance(target, (int, float)) and target > 0 and isinstance(current, (int, float)):
                    pct = float(progress.get("percent") or 0)
                    color = HUD_GREEN if progress.get("met") else HUD_CYAN
                    self._draw_progress(canvas, 18 * scale, y, width - 175 * scale, pct, scale, color)
                    value = f"{current:g}/{target:g} {progress.get('unit') or ''}  {pct:.0f}%"
                    self._draw_text(canvas, width - 8 * scale, y - 5 * scale, value, scale, 9, color, True, "ne")
                    y += 18 * scale
                y += 6 * scale
        return width, round(y + 3 * scale)

    def _render_alert_group_canvas(self, canvas: tk.Canvas, scale: float, flash_on: bool, *, kind: str, title: str, color: str) -> tuple[int, int]:
        state = self.scout_state(); feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        alerts = [
            row for row in (feed.get("alerts") if isinstance(feed.get("alerts"), list) else [])
            if isinstance(row, dict) and str(row.get("type") or "").casefold() == kind
        ]
        width = round(540 * scale); y = self._draw_title(canvas, title, scale, width)
        unacked = [row for row in alerts if not bool(row.get("acknowledged"))]
        # The lamp means "needs attention", not merely "alerts exist".
        # No unacknowledged rows = extinguished lamp.
        lamp_color = color if (unacked and flash_on) else HUD_DIM
        radius = 7 * scale
        canvas.create_oval(8 * scale, y, 8 * scale + radius * 2, y + radius * 2, fill=lamp_color, outline=lamp_color)
        status = "CLEAR" if not alerts else f"{len(unacked)} NEW · {len(alerts)} ACTIVE"
        self._draw_text(canvas, 32 * scale, y - 2 * scale, status, scale, 11, color if alerts else HUD_GREEN, True); y += 24 * scale

        visible_alerts = alerts[:10]
        for row in visible_alerts:
            acknowledged = bool(row.get("acknowledged"))
            dot_color = color if not acknowledged else HUD_DIM
            canvas.create_oval(9 * scale, y + 4 * scale, 15 * scale, y + 10 * scale, fill=dot_color, outline=dot_color)
            title_color = HUD_WHITE if not acknowledged else HUD_MUTED
            self._draw_text(canvas, 23 * scale, y, self.clip_line(row.get("title") or "Alert", 58), scale, 10, title_color, not acknowledged)
            if acknowledged:
                self._draw_text(canvas, width - 8 * scale, y, "ACK", scale, 8, color, True, "ne")
            y += 17 * scale
            if row.get("detail"):
                self._draw_text(canvas, 23 * scale, y, self.clip_line(row.get("detail"), 68), scale, 8, HUD_MUTED, False); y += 15 * scale
            y += 4 * scale

        hidden = max(0, len(alerts) - len(visible_alerts))
        if hidden:
            self._draw_text(canvas, 23 * scale, y, f"+{hidden} MORE", scale, 8, HUD_MUTED, True); y += 16 * scale
        return width, round(y + 4 * scale)

    def _render_alerts_canvas(self, canvas: tk.Canvas, scale: float, flash_on: bool) -> tuple[int, int]:
        return self._render_alert_group_canvas(canvas, scale, flash_on, kind="faction", title="FACTION ALERTS", color=HUD_RED)

    def _render_orderalerts_canvas(self, canvas: tk.Canvas, scale: float, flash_on: bool) -> tuple[int, int]:
        return self._render_alert_group_canvas(canvas, scale, flash_on, kind="orders", title="DAILY ORDER CHANGES", color=HUD_AMBER)

    def _render_trade_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        trade = feed.get("trade") if isinstance(feed.get("trade"), dict) else {}
        width = round(610 * scale)
        y = self._draw_title(canvas, "TRADER'S OUTPOST", scale, width)
        y = self._draw_site_feed_status(canvas, scale, width, y, state, bool(trade))
        if not trade:
            return width, round(y + 8 * scale)

        routes = [row for row in (trade.get("routes") if isinstance(trade.get("routes"), list) else []) if isinstance(row, dict)]
        self._draw_text(canvas, 8 * scale, y, f"ACTIVE {int(trade.get('activeCount') or 0)}", scale, 10, HUD_WHITE, True); y += 22 * scale
        if not routes:
            self._draw_text(canvas, 8 * scale, y, "NO ACTIVE ROUTES", scale, 10, HUD_MUTED, True)
            return width, round(y + 28 * scale)

        for route in routes[:4]:
            profit = route.get("loopProfit") or route.get("profitPerTon") or 0
            state_text = str(route.get("state") or "").upper()
            title = str(route.get("title") or "Trade Route")
            title_color = HUD_AMBER if state_text in {"DEGRADED", "UNAVAILABLE"} else HUD_WHITE
            profit_text = f"{self.compact_credits(profit)} CR" if profit else ""
            right_reserve = (92 if profit_text else 8) * scale
            self._draw_text(canvas, 8 * scale, y, self.clip_line(title, 58), scale, 10, title_color, True, "nw", max(120 * scale, width - right_reserve - 12 * scale))
            if profit_text:
                self._draw_text(canvas, width - 8 * scale, y, profit_text, scale, 10, HUD_CYAN, True, "ne")
            y += 21 * scale

            legs = [leg for leg in (route.get("legs") if isinstance(route.get("legs"), list) else []) if isinstance(leg, dict)]
            if not legs:
                legs = [{
                    "commodity": route.get("commodity"),
                    "sourceSystem": route.get("originSystem"),
                    "sourceStation": route.get("originStation"),
                    "destinationSystem": route.get("destinationSystem"),
                    "destinationStation": route.get("destinationStation"),
                }]

            left_x = 28 * scale
            arrow_x = width / 2
            right_x = arrow_x + 28 * scale
            column_width = max(120 * scale, (width / 2) - 52 * scale)
            for leg_index, leg in enumerate(legs[:3], start=1):
                commodity = str(leg.get("commodity") or route.get("commodity") or "").strip()
                source_system = str(leg.get("sourceSystem") or "Source unknown").strip()
                source_station = str(leg.get("sourceStation") or "Station unknown").strip()
                destination_system = str(leg.get("destinationSystem") or "Destination unknown").strip()
                destination_station = str(leg.get("destinationStation") or "Station unknown").strip()

                prefix = f"LEG {leg_index}"
                if commodity:
                    prefix += f" · {commodity}"
                leg_profit = leg.get("tripProfit") or 0
                self._draw_text(canvas, 18 * scale, y, self.clip_line(prefix, 52), scale, 9, HUD_CYAN, True)
                if isinstance(leg_profit, (int, float)) and leg_profit > 0:
                    self._draw_text(canvas, width - 8 * scale, y, f"{self.compact_credits(leg_profit)} CR", scale, 9, HUD_CYAN, True, "ne")
                y += 18 * scale

                self._draw_text(canvas, left_x, y, self.clip_line(source_system, 34), scale, 9, HUD_WHITE, True, "nw", column_width)
                self._draw_text(canvas, arrow_x, y, "→", scale, 11, HUD_CYAN, True, "n")
                self._draw_text(canvas, right_x, y, self.clip_line(destination_system, 34), scale, 9, HUD_WHITE, True, "nw", column_width)
                y += 17 * scale

                self._draw_text(canvas, left_x, y, self.clip_line(source_station, 32), scale, 8, HUD_MUTED, False, "nw", column_width)
                self._draw_text(canvas, right_x, y, self.clip_line(destination_station, 32), scale, 8, HUD_MUTED, False, "nw", column_width)
                y += 19 * scale
            y += 6 * scale

        return width, round(y + 3 * scale)

    @staticmethod
    def _system_distance_ly(a: Any, b: Any) -> float | None:
        if not isinstance(a, list) or not isinstance(b, list) or len(a) < 3 or len(b) < 3:
            return None
        try:
            left = [float(value) for value in a[:3]]
            right = [float(value) for value in b[:3]]
        except (TypeError, ValueError):
            return None
        if not all(math.isfinite(value) for value in (*left, *right)):
            return None
        return math.sqrt(sum((left[index] - right[index]) ** 2 for index in range(3)))

    def _render_scoutboard_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        scout = feed.get("scout") if isinstance(feed.get("scout"), dict) else {}
        width = round(490 * scale)
        y = self._draw_title(canvas, "SCOUT BOARD", scale, width)
        y = self._draw_site_feed_status(canvas, scale, width, y, state, bool(scout))
        if not scout:
            return width, round(y + 8 * scale)

        summary = scout.get("summary") if isinstance(scout.get("summary"), dict) else {}
        self._draw_text(canvas, 8 * scale, y, f"AVAILABLE {int(summary.get('available') or 0)}", scale, 9, HUD_WHITE, True)
        self._draw_text(canvas, 135 * scale, y, f"CLAIMED {int(summary.get('claimed') or 0)}", scale, 9, HUD_WHITE, True)
        self._draw_text(canvas, width - 8 * scale, y, f"PRIORITY {int(summary.get('priority') or 0)}", scale, 9, HUD_AMBER, True, "ne")
        y += 23 * scale

        status_x = 398 * scale
        reward_x = width - 8 * scale
        self._draw_text(canvas, 8 * scale, y, "SYSTEM", scale, 8, HUD_MUTED, True)
        self._draw_text(canvas, status_x, y, "STATUS", scale, 8, HUD_MUTED, True, "ne")
        self._draw_text(canvas, reward_x, y, "REWARD", scale, 8, HUD_MUTED, True, "ne")
        y += 17 * scale

        jobs = [row for row in (scout.get("jobs") if isinstance(scout.get("jobs"), list) else []) if isinstance(row, dict)]
        if not jobs:
            self._draw_text(canvas, 8 * scale, y, "NO OPEN SCOUT JOBS", scale, 10, HUD_MUTED, True)
            return width, round(y + 28 * scale)

        for row in jobs[:8]:
            system = str(row.get("system") or "System")
            status = str(row.get("status") or "").replace("_", " ").upper()
            reward = float(row.get("rewardMillions") or 0)
            reward_text = f"{reward:g}M CR" if reward > 0 else "—"
            status_color = HUD_AMBER if ("PRIORITY" in status or row.get("claimMine")) else HUD_CYAN
            self._draw_text(canvas, 8 * scale, y, self.clip_line(system, 32), scale, 10, HUD_WHITE, True, "nw", 285 * scale)
            self._draw_text(canvas, status_x, y, self.clip_line(status or "OPEN", 16), scale, 9, status_color, True, "ne")
            self._draw_text(canvas, reward_x, y, reward_text, scale, 10, HUD_GREEN if reward > 0 else HUD_MUTED, True, "ne")
            y += 18 * scale

            claim = ""
            if row.get("claimMine"):
                claim = "YOUR CLAIM"
            elif row.get("claimCommander"):
                claim = f"Claimed by {row.get('claimCommander')}"
            bonus = str(row.get("bonusReason") or "").strip()
            detail = " · ".join(part for part in (claim, bonus) if part)
            if detail:
                self._draw_text(canvas, 18 * scale, y, self.clip_line(detail, 45), scale, 8, HUD_AMBER if row.get("claimMine") else HUD_MUTED, bool(row.get("claimMine")), "nw", 310 * scale)
                y += 15 * scale
            y += 4 * scale

        return width, round(y + 4 * scale)

    def _render_scoutnearby_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        scout = feed.get("scout") if isinstance(feed.get("scout"), dict) else {}
        width = round(520 * scale)
        y = self._draw_title(canvas, "NEAREST SCOUT JOBS", scale, width)
        y = self._draw_site_feed_status(canvas, scale, width, y, state, bool(scout))
        if not scout:
            return width, round(y + 8 * scale)

        origin = scout.get("origin") if isinstance(scout.get("origin"), dict) else {}
        local_system = state.get("system") if isinstance(state.get("system"), dict) else {}
        origin_coords = local_system.get("starPos") if isinstance(local_system.get("starPos"), list) else origin.get("coords")
        origin_name = str(local_system.get("name") or origin.get("system") or "").strip()
        if not isinstance(origin_coords, list):
            self._draw_text(canvas, 8 * scale, y, "CURRENT SYSTEM COORDINATES UNAVAILABLE", scale, 9, HUD_AMBER, True)
            return width, round(y + 30 * scale)

        self._draw_text(canvas, 8 * scale, y, f"FROM {self.clip_line(origin_name or 'CURRENT SYSTEM', 44)}", scale, 9, HUD_MUTED, True); y += 20 * scale
        self._draw_text(canvas, 8 * scale, y, "SYSTEM", scale, 8, HUD_MUTED, True)
        self._draw_text(canvas, 390 * scale, y, "DISTANCE", scale, 8, HUD_MUTED, True, "ne")
        self._draw_text(canvas, width - 8 * scale, y, "REWARD", scale, 8, HUD_MUTED, True, "ne"); y += 17 * scale

        ranked: list[tuple[float, dict[str, Any]]] = []
        for row in (scout.get("jobs") if isinstance(scout.get("jobs"), list) else []):
            if not isinstance(row, dict):
                continue
            distance = self._system_distance_ly(origin_coords, row.get("coords"))
            if distance is None:
                continue
            if origin_name and str(row.get("system") or "").strip().casefold() == origin_name.casefold():
                continue
            ranked.append((distance, row))
        ranked.sort(key=lambda item: (item[0], -float(item[1].get("rewardMillions") or 0), str(item[1].get("system") or "")))

        if not ranked:
            self._draw_text(canvas, 8 * scale, y, "NO DISTANCE-RANKED SCOUT JOBS", scale, 10, HUD_MUTED, True)
            return width, round(y + 28 * scale)

        for distance, row in ranked[:8]:
            reward = float(row.get("rewardMillions") or 0)
            self._draw_text(canvas, 8 * scale, y, self.clip_line(row.get("system") or "System", 36), scale, 10, HUD_WHITE, True)
            self._draw_text(canvas, 390 * scale, y, f"{distance:.2f} LY", scale, 9, HUD_CYAN, True, "ne")
            self._draw_text(canvas, width - 8 * scale, y, f"{reward:g}M CR" if reward > 0 else "—", scale, 9, HUD_GREEN if reward > 0 else HUD_MUTED, True, "ne")
            y += 19 * scale

        return width, round(y + 5 * scale)

    def _render_cargo_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state()
        cargo = state.get("cargo") if isinstance(state.get("cargo"), dict) else {}
        width = round(410 * scale)
        y = self._draw_title(canvas, "CARGO", scale, width)

        used = cargo.get("used")
        capacity = cargo.get("capacity")
        free = cargo.get("free")
        if isinstance(used, int) and isinstance(capacity, int):
            summary = f"{used:,} / {capacity:,} t"
            if isinstance(free, int):
                summary += f"  ·  {free:,} t FREE"
        elif isinstance(used, int):
            summary = f"{used:,} t"
        else:
            summary = "WAITING FOR CARGO DATA"
        self._draw_text(canvas, 8 * scale, y, summary, scale, 12, HUD_WHITE, True)
        y += 26 * scale

        mission_needs = cargo.get("missionNeeds") if isinstance(cargo.get("missionNeeds"), list) else []
        if mission_needs:
            self._draw_text(canvas, 8 * scale, y, "MISSION NEEDS", scale, 9, HUD_CYAN, True)
            y += 19 * scale
            for row in mission_needs:
                if not isinstance(row, dict):
                    continue
                name = self.clip_line(row.get("name") or row.get("key") or "Commodity", 28)
                in_hold = max(0, int(row.get("inHold") or 0))
                remaining = max(0, int(row.get("remaining") or 0))
                needed = max(0, int(row.get("stillNeeded") or 0))
                self._draw_text(canvas, 12 * scale, y, name, scale, 10, HUD_WHITE, True)
                self._draw_text(canvas, 270 * scale, y, f"{in_hold:,} / {remaining:,} t", scale, 10, HUD_WHITE, True, "ne")
                status = "READY" if needed == 0 else f"NEED {needed:,}"
                self._draw_text(canvas, width - 8 * scale, y, status, scale, 9, HUD_GREEN if needed == 0 else HUD_AMBER, True, "ne")
                y += 19 * scale
            y += 5 * scale

        limpets = max(0, int(cargo.get("limpets") or 0))
        if limpets:
            self._draw_text(canvas, 8 * scale, y, "LIMPETS", scale, 9, HUD_CYAN, True)
            self._draw_text(canvas, width - 8 * scale, y, f"{limpets:,} t", scale, 10, HUD_WHITE, True, "ne")
            y += 24 * scale

        stolen = cargo.get("stolenItems") if isinstance(cargo.get("stolenItems"), list) else []
        if stolen:
            self._draw_text(canvas, 8 * scale, y, "STOLEN CARGO", scale, 9, HUD_RED, True)
            y += 19 * scale
            for row in stolen:
                if not isinstance(row, dict):
                    continue
                self._draw_text(canvas, 12 * scale, y, self.clip_line(row.get("name") or row.get("key") or "Cargo", 34), scale, 10, HUD_WHITE, True)
                self._draw_text(canvas, width - 8 * scale, y, f"{max(0, int(row.get('count') or 0)):,} t", scale, 10, HUD_RED, True, "ne")
                y += 19 * scale
            y += 5 * scale

        items = cargo.get("items") if isinstance(cargo.get("items"), list) else []
        if items:
            self._draw_text(canvas, 8 * scale, y, "CARGO HOLD", scale, 9, HUD_CYAN, True)
            y += 19 * scale
            for row in items:
                if not isinstance(row, dict):
                    continue
                self._draw_text(canvas, 12 * scale, y, self.clip_line(row.get("name") or row.get("key") or "Cargo", 36), scale, 10, HUD_WHITE, True)
                self._draw_text(canvas, width - 8 * scale, y, f"{max(0, int(row.get('count') or 0)):,} t", scale, 10, HUD_WHITE, True, "ne")
                y += 19 * scale
        elif not mission_needs and not stolen and not limpets and isinstance(used, int) and used == 0:
            self._draw_text(canvas, 8 * scale, y, "HOLD EMPTY", scale, 10, HUD_MUTED, True)
            y += 21 * scale

        return width, round(y + 7 * scale)

    def _render_generic_canvas(self, canvas: tk.Canvas, panel_id: str, scale: float) -> tuple[int, int]:
        text = self.panel_texts().get(panel_id, "")
        lines = text.splitlines()
        title = lines[0] if lines else PANEL_TITLES.get(panel_id, panel_id.upper())
        widths = {"bounties": 350, "trade": 500, "scoutboard": 500, "notes": 500, "surface": 480}
        width = round(widths.get(panel_id, 440) * scale)
        y = self._draw_title(canvas, title, scale, width)
        for line in lines[1:]:
            if not line:
                y += 7 * scale
                continue
            color = HUD_WHITE
            bold = False
            upper = line.upper()
            if "UNCLAIMED" in upper or "NO ACTIVE SITE" in upper:
                color, bold = HUD_CYAN, True
            if any(word in upper for word in ("DEGRADED", "UNAVAILABLE", "PRIORITY", "YOUR CLAIM")):
                color, bold = HUD_AMBER, True
            self._draw_text(canvas, 8 * scale, y, line, scale, 10, color, bold, "nw", width - 16 * scale)
            y += 17 * scale
        return width, round(y + 7 * scale)

    def _render_panel_canvas(self, panel_id: str, canvas: tk.Canvas, scale: float, flash_on: bool) -> None:
        canvas.delete("all")
        if panel_id == "own":
            width, height = self._render_own_canvas(canvas, scale)
        elif panel_id == "target":
            width, height = self._render_target_canvas(canvas, scale, flash_on)
        elif panel_id == "subsystems":
            width, height = self._render_loadout_canvas(canvas, scale)
        elif panel_id == "cargo":
            width, height = self._render_cargo_canvas(canvas, scale)
        elif panel_id == "surface":
            width, height = self._render_surface_canvas(canvas, scale)
        elif panel_id == "miningintel":
            width, height = self._render_miningintel_canvas(canvas, scale)
        elif panel_id == "mission":
            width, height = self._render_mission_canvas(canvas, scale)
        elif panel_id == "trade":
            width, height = self._render_trade_canvas(canvas, scale)
        elif panel_id == "scoutboard":
            width, height = self._render_scoutboard_canvas(canvas, scale)
        elif panel_id == "scoutnearby":
            width, height = self._render_scoutnearby_canvas(canvas, scale)
        elif panel_id == "alerts":
            width, height = self._render_alerts_canvas(canvas, scale, flash_on)
        elif panel_id == "orderalerts":
            width, height = self._render_orderalerts_canvas(canvas, scale, flash_on)
        else:
            width, height = self._render_generic_canvas(canvas, panel_id, scale)
        canvas.configure(width=max(40, width), height=max(24, height))

    def _layout_revision(self) -> int:
        with self.lock:
            return self.layout_revision

    def refresh_ui(self) -> None:
        if not self.root:
            return
        if self.exit_for_update.is_set():
            try:
                self.root.destroy()
            finally:
                self.root = None
            return
        try:
            self._apply_update_status_ui()
            with self.lock:
                connected = self.snapshot.connected
                error = self.snapshot.error
            if self.status_label:
                self.status_label.config(text="Scout: CONNECTED" if connected else f"Scout: WAITING ({error[:45]})")
            with self.store.lock:
                profile = str(self.store.data.get("profile", "combat"))
            if self.profile_label:
                self.profile_label.config(text=f"Profile: {profile.upper()}")

            layout = self.layout_snapshot()
            locked = bool(layout.get("locked"))
            master_visible = bool(layout.get("masterVisible"))
            revision = self._layout_revision()
            scan_state = self.scan_status_snapshot()
            hide_for_capture = scan_state.get("phase") == "capturing"
            flash_on = int(time.monotonic() * 4) % 2 == 0
            for panel_id, info in self.panel_windows.items():
                panel_cfg = layout["panels"][panel_id]
                active_for_profile = profile in (panel_cfg.get("profiles") or [])
                should_show = master_visible and active_for_profile and bool(panel_cfg.get("visible", True)) and not hide_for_capture
                window = info["window"]
                if not should_show:
                    try:
                        window.withdraw()
                    except Exception:
                        pass
                    continue

                try:
                    window.deiconify()
                except Exception:
                    continue

                scale = float(panel_cfg.get("scale") or 1.0) * HUD_RENDER_SCALE
                try:
                    self._render_panel_canvas(panel_id, info["body"], scale, flash_on)
                    info["renderError"] = ""
                    info["renderErrorType"] = ""
                except Exception as exc:
                    # A malformed/live-data edge case in one renderer must never
                    # kill the global 200 ms HUD refresh loop or freeze controls.
                    info["renderError"] = str(exc)[:160]
                    info["renderErrorType"] = type(exc).__name__

                if info.get("appliedLocked") != locked:
                    try:
                        self._apply_panel_edit_mode(panel_id, locked)
                        info["appliedLocked"] = locked
                    except Exception:
                        pass
                if info.get("appliedRevision") != revision:
                    try:
                        window.geometry(f"+{int(panel_cfg['x'])}+{int(panel_cfg['y'])}")
                        info["appliedRevision"] = revision
                    except Exception:
                        pass
        finally:
            # Always keep the desktop HUD responsive even if an unexpected
            # renderer/data error escapes the per-panel guards above.
            if self.root:
                try:
                    self.root.after(200, self.refresh_ui)
                except Exception:
                    pass

    def toggle_overlay(self) -> None:
        layout = self.layout_snapshot()
        self.set_master_overlay(not bool(layout.get("masterVisible")))

    def toggle_layout_lock(self) -> None:
        layout = self.layout_snapshot()
        self.set_layout_locked(not bool(layout.get("locked")))

    def _set_clickthrough(self, window: tk.Toplevel, enabled: bool) -> None:
        if os.name != "nt":
            return
        try:
            window.update_idletasks()
            hwnd = ctypes.windll.user32.GetParent(window.winfo_id()) or window.winfo_id()
            style = ctypes.windll.user32.GetWindowLongW(hwnd, -20)
            transparent = 0x00000020
            layered = 0x00080000
            toolwindow = 0x00000080
            noactivate = 0x08000000
            style |= layered | toolwindow
            if enabled:
                style |= transparent | noactivate
            else:
                style &= ~transparent
                style &= ~noactivate
            ctypes.windll.user32.SetWindowLongW(hwnd, -20, style)
        except Exception:
            pass

    def _apply_panel_edit_mode(self, panel_id: str, locked: bool) -> None:
        info = self.panel_windows.get(panel_id)
        if not info:
            return
        window = info["window"]
        header = info["header"]
        frame = info["frame"]
        body = info["body"]
        if locked:
            header.pack_forget()
            frame.config(bg="black", highlightthickness=0)
        else:
            header.pack(fill="x", before=body)
            frame.config(bg="#16303b", highlightbackground="#56d7ef", highlightthickness=1)
        self._set_clickthrough(window, locked)

    def _begin_panel_drag(self, panel_id: str, event: Any) -> None:
        if self.layout_snapshot().get("locked"):
            return
        info = self.panel_windows.get(panel_id)
        if not info:
            return
        window = info["window"]
        info["dragOffset"] = (event.x_root - window.winfo_x(), event.y_root - window.winfo_y())

    def _drag_panel(self, panel_id: str, event: Any) -> None:
        if self.layout_snapshot().get("locked"):
            return
        info = self.panel_windows.get(panel_id)
        if not info:
            return
        offset = info.get("dragOffset")
        if not offset:
            return
        x = int(event.x_root - offset[0])
        y = int(event.y_root - offset[1])
        info["window"].geometry(f"+{x}+{y}")

    def _end_panel_drag(self, panel_id: str, event: Any) -> None:
        info = self.panel_windows.get(panel_id)
        if not info:
            return
        window = info["window"]
        self.save_panel_position(panel_id, window.winfo_x(), window.winfo_y())
        info["dragOffset"] = None

    def _create_panel_window(self, panel_id: str) -> None:
        if not self.root:
            return
        layout = self.layout_snapshot()
        panel_cfg = layout["panels"][panel_id]
        window = tk.Toplevel(self.root)
        window.title(f"Mongrel HUD - {PANEL_TITLES[panel_id]}")
        window.overrideredirect(True)
        window.geometry(f"+{int(panel_cfg['x'])}+{int(panel_cfg['y'])}")
        window.attributes("-topmost", True)
        window.configure(bg="black")
        try:
            window.attributes("-transparentcolor", "black")
        except tk.TclError:
            window.attributes("-alpha", 0.90)

        frame = tk.Frame(window, bg="black", highlightthickness=0)
        frame.pack(fill="both", expand=True)
        header = tk.Label(frame, text=f"  {PANEL_TITLES[panel_id]}  · DRAG TO MOVE", anchor="w", bg="#16303b", fg="#56d7ef", font=("Segoe UI", 9, "bold"), padx=5, pady=4)
        body = tk.Canvas(frame, width=320, height=100, bg="black", highlightthickness=0, bd=0)
        body.pack(fill="both", expand=True)
        self.panel_windows[panel_id] = {"window": window, "frame": frame, "header": header, "body": body, "dragOffset": None, "appliedLocked": None, "appliedRevision": -1}
        header.bind("<ButtonPress-1>", lambda event, pid=panel_id: self._begin_panel_drag(pid, event))
        header.bind("<B1-Motion>", lambda event, pid=panel_id: self._drag_panel(pid, event))
        header.bind("<ButtonRelease-1>", lambda event, pid=panel_id: self._end_panel_drag(pid, event))
        self._apply_panel_edit_mode(panel_id, bool(layout.get("locked")))

    @staticmethod
    def _token_hash(token: Any) -> str:
        return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()

    def trusted_controller_count(self) -> int:
        with self.store.lock:
            auth = self.store.data.get("controllerAuth")
            hashes = auth.get("tokenHashes") if isinstance(auth, dict) else []
            return len(hashes) if isinstance(hashes, list) else 0

    def authorized_controller_token(self, token: Any) -> bool:
        raw = str(token or "")
        if not raw:
            return False
        candidate = self._token_hash(raw)
        with self.store.lock:
            auth = self.store.data.get("controllerAuth")
            hashes = auth.get("tokenHashes") if isinstance(auth, dict) else []
            values = list(hashes) if isinstance(hashes, list) else []
        return any(secrets.compare_digest(candidate, value) for value in values)

    def register_controller_device(self) -> str:
        token = secrets.token_urlsafe(32)
        digest = self._token_hash(token)
        with self.store.lock:
            auth = self.store.data.setdefault("controllerAuth", {"tokenHashes": []})
            hashes = auth.get("tokenHashes") if isinstance(auth.get("tokenHashes"), list) else []
            hashes = [value for value in hashes if isinstance(value, str) and value != digest]
            hashes.append(digest)
            auth["tokenHashes"] = hashes[-MAX_TRUSTED_CONTROLLER_TOKENS:]
            self.store.save()
        self._refresh_pairing_label()
        return token

    def forget_paired_devices(self) -> None:
        with self.store.lock:
            self.store.data["controllerAuth"] = {"tokenHashes": []}
            self.store.save()
        self.regenerate_pin()
        self._refresh_pairing_label()

    def _refresh_pairing_label(self) -> None:
        if not self.paired_label:
            return
        count = self.trusted_controller_count()
        label = "No trusted devices" if count == 0 else f"Trusted devices: {count}"
        try:
            self.paired_label.config(text=label)
        except Exception:
            pass

    def _set_update_status(self, **changes: Any) -> None:
        with self.update_lock:
            self.update_status.update(changes)

    @staticmethod
    def _update_snapshot_is_newer(snapshot: dict[str, Any]) -> bool:
        return bool(version_tuple(snapshot.get("version")) > version_tuple(APP_VERSION))

    def _apply_update_status_ui(self) -> None:
        with self.update_lock:
            snapshot = dict(self.update_status)
        if self.update_label:
            if snapshot.get("installing"):
                text = "Downloading update…"
            elif snapshot.get("checking"):
                text = "Checking for updates…"
            elif snapshot.get("error"):
                error = str(snapshot.get("error") or "")
                text = "Update check unavailable" if error == "update_check_failed" else f"Update error: {error.replace('_', ' ')}"
            elif snapshot.get("available") and self._update_snapshot_is_newer(snapshot):
                text = f"Update available: v{snapshot.get('version')}"
            else:
                text = f"Version {APP_VERSION} · up to date"
            self.update_label.config(text=text)
        if self.update_button:
            available = bool(snapshot.get("available")) and self._update_snapshot_is_newer(snapshot)
            installing = bool(snapshot.get("installing"))
            checking = bool(snapshot.get("checking"))
            self.update_button.config(
                text=f"Update to {snapshot.get('version')}" if available else "Check for Update",
                state="disabled" if installing or checking else "normal",
            )

    def check_for_update(self, manual: bool = True) -> None:
        with self.update_lock:
            if self.update_status.get("checking") or self.update_status.get("installing"):
                return
        if os.name != "nt":
            self._set_update_status(error="windows_required", checking=False, available=False)
            return
        self._set_update_status(checking=True, error="")
        threading.Thread(target=self._check_for_update_worker, args=(manual,), name="MongrelHudUpdateCheck", daemon=True).start()

    def _check_for_update_worker(self, manual: bool) -> None:
        try:
            release = update_from_release_payload(_powershell_release_json())
            available = bool(version_tuple(release["version"]) > version_tuple(APP_VERSION))
            self._set_update_status(
                checking=False,
                available=available,
                version=release["version"],
                url=release["url"],
                digest=release["digest"],
                size=release["size"],
                error="",
            )
        except Exception as exc:
            error = str(exc).strip() or type(exc).__name__
            self._set_update_status(checking=False, available=False, error=error if manual else "update_check_failed")

    def install_available_update(self) -> None:
        with self.update_lock:
            snapshot = dict(self.update_status)
            if snapshot.get("checking") or snapshot.get("installing"):
                return
        if not snapshot.get("available") or not self._update_snapshot_is_newer(snapshot):
            self._set_update_status(available=False)
            self.check_for_update(True)
            return
        if os.name != "nt" or not getattr(sys, "frozen", False):
            self._set_update_status(error="packaged_build_required")
            return
        self._set_update_status(installing=True, error="")
        threading.Thread(target=self._install_update_worker, args=(snapshot,), name="MongrelHudUpdateInstall", daemon=True).start()

    def _install_update_worker(self, release: dict[str, Any]) -> None:
        try:
            target = Path(sys.executable).resolve()
            probe = target.parent / ".mongrel_hud_update_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)

            update_dir = self.store.path.parent / "update"
            update_dir.mkdir(parents=True, exist_ok=True)
            archive = update_dir / UPDATE_ASSET_NAME
            staged = update_dir / "MongrelHUD.new.exe"
            _powershell_download(str(release.get("url") or ""), archive)

            expected = str(release.get("digest") or "").removeprefix("sha256:")
            if not expected or not secrets.compare_digest(_file_sha256(archive), expected):
                raise RuntimeError("update_digest_mismatch")

            with zipfile.ZipFile(archive) as bundle:
                members = {Path(name).name: name for name in bundle.namelist()}
                member = members.get("MongrelHUD.exe")
                if not member:
                    raise RuntimeError("update_exe_missing")
                with bundle.open(member) as source, staged.open("wb") as destination:
                    while True:
                        chunk = source.read(1024 * 1024)
                        if not chunk:
                            break
                        destination.write(chunk)

            if staged.stat().st_size < 1_000_000:
                raise RuntimeError("update_exe_invalid")
            staged_digest = _file_sha256(staged)

            script = update_dir / "apply-update.ps1"
            log_path = update_dir / "apply-update.log"
            script.write_text(
                """param([int]$ProcessId,[string]$Target,[string]$Staged,[string]$ExpectedHash,[string]$LogPath)
$ErrorActionPreference='Stop'
function Write-UpdateLog([string]$Message) {
  try { Add-Content -LiteralPath $LogPath -Value ((Get-Date).ToString('o') + ' ' + $Message) -Encoding UTF8 } catch {}
}
function Copy-WithRetry([string]$Source,[string]$Destination,[int]$Attempts=300) {
  $last=''
  for ($i=0; $i -lt $Attempts; $i++) {
    try {
      Copy-Item -LiteralPath $Source -Destination $Destination -Force -ErrorAction Stop
      return
    } catch {
      $last=$_.Exception.Message
      Start-Sleep -Milliseconds 200
    }
  }
  throw ('copy_retry_exhausted: ' + $last)
}
try {
  if (Test-Path -LiteralPath $LogPath) { Remove-Item -LiteralPath $LogPath -Force -ErrorAction SilentlyContinue }
  Write-UpdateLog ('start pid=' + $ProcessId + ' target=' + $Target)
  for ($i=0; $i -lt 450; $i++) {
    if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 100
  }
  Write-UpdateLog 'hud child process exited; waiting for executable lock to clear'

  $actualStaged=(Get-FileHash -LiteralPath $Staged -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualStaged -ne $ExpectedHash.ToLowerInvariant()) { throw 'staged_hash_mismatch' }

  $backup=$Target + '.old'
  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue }
  Copy-WithRetry $Target $backup 300
  Write-UpdateLog 'backup created'

  Copy-WithRetry $Staged $Target 300
  $actualTarget=(Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualTarget -ne $actualStaged) { throw 'target_hash_mismatch' }
  Write-UpdateLog 'replacement verified'

  # PyInstaller onefile restarts must be forced into a fresh top-level runtime.
  $env:PYINSTALLER_RESET_ENVIRONMENT='1'
  $newProcess=Start-Process -FilePath $Target -PassThru
  Start-Sleep -Seconds 3
  if ($newProcess.HasExited) { throw ('updated_process_exited_' + $newProcess.ExitCode) }
  Write-UpdateLog ('updated HUD launched pid=' + $newProcess.Id)
  try { Remove-Item -LiteralPath $backup -Force -ErrorAction Stop } catch { Write-UpdateLog ('backup cleanup deferred: ' + $_.Exception.Message) }
  Write-UpdateLog 'success'
} catch {
  Write-UpdateLog ('failure: ' + $_.Exception.Message)
  $backup=$Target + '.old'
  if (Test-Path -LiteralPath $backup) {
    try {
      Copy-WithRetry $backup $Target 100
      Write-UpdateLog 'rollback restored previous executable'
    } catch {
      Write-UpdateLog ('rollback failed: ' + $_.Exception.Message)
    }
  }
  try {
    $env:PYINSTALLER_RESET_ENVIRONMENT='1'
    Start-Process -FilePath $Target
    Write-UpdateLog 'fallback launch attempted'
  } catch {
    Write-UpdateLog ('fallback launch failed: ' + $_.Exception.Message)
  }
}
""",
                encoding="utf-8",
            )
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            subprocess.Popen(
                [
                    "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                    "-File", str(script), str(os.getpid()), str(target), str(staged), staged_digest, str(log_path),
                ],
                creationflags=flags,
            )
            self._set_update_status(installing=True, error="")
            self.exit_for_update.set()
        except Exception as exc:
            self._set_update_status(installing=False, error=str(exc).strip() or type(exc).__name__)

    def regenerate_pin(self) -> None:
        # A new PIN is only for adding another device. Existing trusted devices
        # remain valid until "Forget Paired Devices" is used explicitly.
        self.pin = f"{secrets.randbelow(1000000):06d}"
        if self.pin_label:
            self.pin_label.config(text=f"Pairing PIN: {self.pin}")

    def start_gui(self) -> None:
        root = tk.Tk()
        self.root = root
        root.title(f"Mongrel HUD {APP_VERSION}")
        root.geometry("500x390")
        root.configure(bg="#091017")
        fg, muted, accent = "#d9edf5", "#8ca5b0", "#56d7ef"
        tk.Label(root, text="MONGREL HUD", bg="#091017", fg=accent, font=("Segoe UI", 17, "bold")).pack(anchor="w", padx=18, pady=(16, 1))
        tk.Label(root, text=f"Version {APP_VERSION}", bg="#091017", fg=muted, font=("Segoe UI", 9)).pack(anchor="w", padx=18)
        self.status_label = tk.Label(root, text="Scout: WAITING", bg="#091017", fg=fg, font=("Segoe UI", 10))
        self.status_label.pack(anchor="w", padx=18, pady=(7, 0))
        self.profile_label = tk.Label(root, text="Profile: COMBAT", bg="#091017", fg=fg, font=("Segoe UI", 10))
        self.profile_label.pack(anchor="w", padx=18, pady=(2, 0))

        tk.Label(root, text=f"iPad Controller: {CONTROLLER_STABLE_URL}", bg="#091017", fg=accent, font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=18, pady=(12, 0))
        tk.Label(root, text=f"LAN fallback: http://{local_ipv4()}:{CONTROLLER_PORT}", bg="#091017", fg=muted, font=("Segoe UI", 9)).pack(anchor="w", padx=18, pady=(1, 0))
        self.pin_label = tk.Label(root, text=f"Pairing PIN: {self.pin}", bg="#091017", fg=accent, font=("Segoe UI", 12, "bold"))
        self.pin_label.pack(anchor="w", padx=18, pady=(4, 0))
        self.paired_label = tk.Label(root, text="", bg="#091017", fg=muted, font=("Segoe UI", 9))
        self.paired_label.pack(anchor="w", padx=18, pady=(1, 7))
        self._refresh_pairing_label()

        buttons = tk.Frame(root, bg="#091017")
        buttons.pack(anchor="w", padx=18)
        tk.Button(buttons, text="Show / Hide Overlay", command=self.toggle_overlay).pack(side="left", padx=(0, 8))
        tk.Button(buttons, text="Pair New Device", command=self.regenerate_pin).pack(side="left", padx=(0, 8))
        tk.Button(buttons, text="Forget Paired Devices", command=self.forget_paired_devices).pack(side="left")
        tk.Button(root, text="Lock / Unlock Layout", command=self.toggle_layout_lock).pack(anchor="w", padx=18, pady=(10, 0))

        update_box = tk.Frame(root, bg="#091017")
        update_box.pack(fill="x", padx=18, pady=(16, 0))
        self.update_label = tk.Label(update_box, text=f"Version {APP_VERSION}", bg="#091017", fg=muted, font=("Segoe UI", 9))
        self.update_label.pack(side="left")
        self.update_button = tk.Button(update_box, text="Check for Update", command=self.install_available_update)
        self.update_button.pack(side="right")

        for panel_id in PANEL_IDS:
            self._create_panel_window(panel_id)
        root.after(1200, lambda: self.check_for_update(False))
        root.after(200, self.refresh_ui)
        root.mainloop()

def make_handler(app: MongrelHudApp):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MongrelHUD/0.1"

        def log_message(self, fmt: str, *args: Any) -> None:
            return

        def json_body(self) -> dict[str, Any]:
            try:
                length = min(int(self.headers.get("Content-Length", "0")), 65536)
                value = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                return value if isinstance(value, dict) else {}
            except Exception:
                return {}

        def authorized(self) -> bool:
            raw = self.headers.get("Cookie", "")
            jar = cookies.SimpleCookie()
            try:
                jar.load(raw)
            except Exception:
                return False
            morsel = jar.get("mongrel_hud")
            return bool(morsel and app.authorized_controller_token(morsel.value))

        def same_origin(self) -> bool:
            origin = self.headers.get("Origin")
            if not origin:
                return True
            try:
                return urlparse(origin).netloc == self.headers.get("Host", "")
            except Exception:
                return False

        def send_json(self, value: Any, status: int = 200, cookie: str | None = None) -> None:
            body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if cookie:
                self.send_header("Set-Cookie", cookie)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            if path == "/":
                body = app.controller_html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Frame-Options", "DENY")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path == "/api/state":
                if not self.authorized():
                    self.send_json({"ok": False, "error": "pair_required"}, 401)
                    return
                self.send_json(app.controller_state())
                return
            self.send_json({"ok": False, "error": "not_found"}, 404)

        def do_POST(self) -> None:
            if not self.same_origin():
                self.send_json({"ok": False, "error": "origin_rejected"}, 403)
                return
            path = urlparse(self.path).path
            body = self.json_body()
            if path == "/api/pair":
                if not secrets.compare_digest(str(body.get("pin") or ""), app.pin):
                    self.send_json({"ok": False, "error": "bad_pin"}, 403)
                    return
                token = app.register_controller_device()
                cookie = f"mongrel_hud={token}; Path=/; Max-Age={PAIRING_COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict"
                self.send_json({"ok": True}, cookie=cookie)
                return
            if not self.authorized():
                self.send_json({"ok": False, "error": "pair_required"}, 401)
                return
            try:
                if path == "/api/profile":
                    profile = app.set_profile(str(body.get("profile") or ""))
                    result = {"ok": True, "profile": profile, "layout": app.layout_snapshot()}
                elif path == "/api/layout":
                    if "locked" in body:
                        result = {"ok": True, "layout": app.set_layout_locked(bool(body.get("locked")))}
                    elif "masterVisible" in body:
                        result = {"ok": True, "layout": app.set_master_overlay(bool(body.get("masterVisible")))}
                    else:
                        raise ValueError("layout_setting_required")
                elif path == "/api/panel":
                    panel_id = str(body.get("panel") or "")
                    result = {"ok": True, "layout": app.set_panel_settings(panel_id, visible=body.get("visible") if "visible" in body else None, scale=body.get("scale") if "scale" in body else None, profiles=body.get("profiles") if "profiles" in body else None)}
                elif path == "/api/layout-reset":
                    result = {"ok": True, "layout": app.reset_layout()}
                elif path == "/api/notes":
                    result = {"ok": True, "notes": app.set_notes(str(body.get("notes") or ""))}
                elif path == "/api/voice":
                    result = {"ok": True, "voice": app.set_voice_settings(body)}
                elif path == "/api/voice-test":
                    result = {"ok": True, "voiceStatus": app.queue_voice_test()}
                elif path == "/api/voice-test-cue":
                    result = {"ok": True, "voiceStatus": app.queue_voice_cue_test(str(body.get("cue") or ""))}
                elif path == "/api/voice-pack-install":
                    result = {"ok": True, "voicePack": app.start_voice_pack_install(repair=False)}
                elif path == "/api/voice-pack-repair":
                    result = {"ok": True, "voicePack": app.start_voice_pack_install(repair=True)}
                elif path == "/api/voice-pack-remove":
                    result = {"ok": True, "voicePack": app.remove_voice_pack(), "voice": app.voice_settings_snapshot()}
                elif path == "/api/mission-filter":
                    result = {"ok": True, "missionSystem": app.set_mission_system_filter(str(body.get("system") or "all"))}
                elif path == "/api/alert-ack":
                    values = body.get("alertIds")
                    ids = values if isinstance(values, list) else [body.get("alertId")]
                    result = app.acknowledge_alerts(ids)
                elif path == "/api/target-scan":
                    result = {"ok": True, "scan": app.start_target_scan()}
                elif path == "/api/site-center":
                    result = {"ok": True, "site": app.set_site_center(int(body.get("siteNumber") or 0), str(body.get("commodity") or ""))}
                elif path == "/api/location-select":
                    result = {"ok": True, "location": app.select_location(int(body.get("signal") or 0))}
                elif path == "/api/site-select":
                    result = {"ok": True, "site": app.select_site(str(body.get("siteId") or ""))}
                elif path == "/api/deposit":
                    result = {"ok": True, "deposit": app.report_deposit(
                        str(body.get("commodity") or ""),
                        int(body.get("rigs") or 0),
                        str(body.get("notes") or ""),
                        int(body.get("signal") or 0),
                    )}
                else:
                    self.send_json({"ok": False, "error": "not_found"}, 404)
                    return
                self.send_json(result)
            except HudRequestError as exc:
                self.send_json({"ok": False, "error": exc.error_code, "detail": str(exc), "diagnostics": exc.diagnostics}, exc.status)
            except (ValueError, TypeError) as exc:
                self.send_json({"ok": False, "error": str(exc)}, 400)

    return Handler


def main() -> None:
    controller = resource_path("controller.html").read_text(encoding="utf-8")
    data_dir = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "MongrelHUD"
    app = MongrelHudApp(LocalStore(data_dir / "state.json"), controller)
    threading.Thread(target=app.poll_scout, name="MongrelHudScoutPoll", daemon=True).start()
    try:
        server = ThreadingHTTPServer((CONTROLLER_HOST, CONTROLLER_PORT), make_handler(app))
    except OSError as exc:
        raise SystemExit(f"Could not open controller port {CONTROLLER_PORT}: {exc}")
    threading.Thread(target=server.serve_forever, name="MongrelHudController", daemon=True).start()
    mdns_handle = _start_mdns_service()
    try:
        app.start_gui()
    finally:
        _stop_mdns_service(mdns_handle)
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
