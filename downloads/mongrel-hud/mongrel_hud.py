from __future__ import annotations

import ctypes
from ctypes import wintypes
import difflib
import json
import math
import os
import re
import secrets
import socket
import sys
import threading
import time
import tkinter as tk
import urllib.request
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

APP_VERSION = "0.7.2"
SCOUT_STATE_URL = "http://127.0.0.1:43857/v1/state"
SCOUT_EVENTS_URL = "http://127.0.0.1:43857/v1/events"
SCOUT_ALERT_ACK_URL = "http://127.0.0.1:43857/v1/site-feed/ack"
SCOUT_MINING_REPORT_URL = "http://127.0.0.1:43857/v1/mining/report"
SCOUT_MINING_CENTER_URL = "http://127.0.0.1:43857/v1/mining/center"
MINING_DATA_URL = "https://ten16-archive.pages.dev/api/mining"
MINING_CENTERS_URL = "https://ten16-archive.pages.dev/api/mining-centers"
TEN16_SYSTEM = "NGC 2546 Sector UZ-G d10-16"
TEN16_ID64 = "560820275507"
MINING_REFRESH_SECONDS = 60.0
CONTROLLER_HOST = "0.0.0.0"
CONTROLLER_PORT = 43858
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

PANEL_IDS = ("own", "target", "subsystems", "bounties", "surface", "miningintel", "mission", "trade", "scoutboard", "scoutnearby", "alerts", "orderalerts", "notes")
VALID_PROFILES = ("combat", "surface")
PANEL_TITLES = {
    "own": "OWN SHIP",
    "target": "TARGET",
    "subsystems": "TARGET LOADOUT",
    "bounties": "BOUNTIES",
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


def default_layout() -> dict[str, Any]:
    return {
        "locked": True,
        "masterVisible": True,
        "panels": {
            "own": {"x": 40, "y": 70, "visible": True, "scale": 1.0, "profiles": ["combat"]},
            "target": {"x": 40, "y": 270, "visible": True, "scale": 1.0, "profiles": ["combat"]},
            "bounties": {"x": 40, "y": 455, "visible": True, "scale": 1.0, "profiles": ["combat"]},
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
        self.data: dict[str, Any] = {"profile": "combat", "sites": {}, "activeSite": None, "activeMiningLocationSignal": None, "activeMiningSiteId": None, "deposits": [], "bounty": {"unclaimed": 0}, "eventCursor": {"sessionId": "", "seq": 0}, "layout": default_layout(), "notes": "", "missionSystem": "all"}
        self.load()
        self.data["layout"] = normalized_layout(self.data.get("layout"))

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
        self.session = secrets.token_urlsafe(32)
        self.overlay_visible = True
        self.root: tk.Tk | None = None
        self.panel_windows: dict[str, dict[str, Any]] = {}
        self.layout_revision = 0
        self.status_label: tk.Label | None = None
        self.profile_label: tk.Label | None = None
        self.pin_label: tk.Label | None = None
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
        self.mining_centers: list[dict[str, Any]] = []
        self.mining_status = {"ok": False, "updatedAt": None, "error": "not_started"}
        threading.Thread(target=self._warm_ocr, name="MongrelHudOcrWarmup", daemon=True).start()
        threading.Thread(target=self._mining_sync_loop, name="MongrelHudMiningSync", daemon=True).start()

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
        try:
            with urllib.request.urlopen(request, timeout=10.0) as response:
                result = json.load(response)
        except Exception as exc:
            raise ValueError("alert_ack_failed") from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise ValueError(str(result.get("error") if isinstance(result, dict) else "alert_ack_failed"))
        return result

    def set_profile(self, profile: str) -> None:
        if profile not in {"combat", "surface"}:
            raise ValueError("invalid_profile")
        with self.store.lock:
            self.store.data["profile"] = profile
            self.store.save()

    def _refresh_mining_data_once(self) -> bool:
        headers = {
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": f"MongrelHUD/{APP_VERSION}",
        }
        deposit_error = ""
        center_error = ""
        deposit_ok = False
        center_ok = False

        try:
            with urllib.request.urlopen(
                urllib.request.Request(MINING_DATA_URL, headers=headers, method="GET"),
                timeout=6.0,
            ) as response:
                payload = json.load(response)
            if not isinstance(payload, list):
                raise ValueError("invalid_mining_payload")

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
            deposit_error = str(exc)[:120]

        try:
            with urllib.request.urlopen(
                urllib.request.Request(MINING_CENTERS_URL, headers=headers, method="GET"),
                timeout=6.0,
            ) as response:
                center_payload = json.load(response)
            if not isinstance(center_payload, list):
                raise ValueError("invalid_mining_centers_payload")

            centers: list[dict[str, Any]] = []
            for raw in center_payload:
                if not isinstance(raw, dict):
                    continue
                try:
                    center_id = int(raw.get("id"))
                    signal = int(raw.get("signal"))
                    lat = float(raw.get("latitude"))
                    lon = float(raw.get("longitude"))
                except (TypeError, ValueError):
                    continue
                centers.append({
                    "id": center_id,
                    "body": str(raw.get("body") or "").strip().lower(),
                    "bodyType": str(raw.get("bodyType") or "").strip().lower(),
                    "signal": signal,
                    "latitude": lat,
                    "longitude": lon,
                    "updatedAt": raw.get("updatedAt"),
                })
            with self.mining_lock:
                self.mining_centers = centers
            center_ok = True
        except Exception as exc:
            center_error = str(exc)[:120]

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
            return dict(self.mining_status)

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
        if not body:
            return []
        with self.mining_lock:
            rows = [
                dict(row)
                for row in self.mining_sites
                if str(row.get("body") or "").casefold() == body
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
        if not body:
            return []
        with self.mining_lock:
            rows = [dict(row) for row in self.mining_centers if str(row.get("body") or "").casefold() == body]
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
        try:
            with urllib.request.urlopen(request, timeout=10.0) as response:
                result = json.load(response)
        except Exception as exc:
            raise ValueError("mining_center_save_failed") from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise ValueError(str(result.get("error") if isinstance(result, dict) else "mining_center_save_failed"))
        saved_center = result.get("center") if isinstance(result.get("center"), dict) else {
            "id": 0,
            "signal": signal,
            "latitude": float(lat),
            "longitude": float(lon),
            "body": body,
            "bodyType": body_type_for_short_name(body),
            "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        saved_center = dict(saved_center)
        saved_center["body"] = str(saved_center.get("body") or body).strip().lower()
        saved_center["signal"] = int(saved_center.get("signal") or signal)
        saved_center["latitude"] = float(saved_center.get("latitude", lat))
        saved_center["longitude"] = float(saved_center.get("longitude", lon))
        with self.mining_lock:
            self.mining_centers = [
                row for row in self.mining_centers
                if not (
                    str(row.get("body") or "").casefold() == saved_center["body"].casefold()
                    and int(row.get("signal") or 0) == signal
                )
            ]
            self.mining_centers.append(saved_center)
        with self.store.lock:
            self.store.data["activeMiningLocationSignal"] = signal
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
        try:
            with urllib.request.urlopen(request, timeout=10.0) as response:
                result = json.load(response)
        except Exception as exc:
            raise ValueError("mining_report_failed") from exc
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise ValueError(str(result.get("error") if isinstance(result, dict) else "mining_report_failed"))
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

    def controller_state(self) -> dict[str, Any]:
        state = self.scout_state()
        with self.lock:
            connected = self.snapshot.connected
        with self.store.lock:
            profile = self.store.data.get("profile", "combat")
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
            "miningCommodities": sorted({
                str(row.get("commodity") or "").strip()
                for row in self.mining_sites
                if str(row.get("commodity") or "").strip()
            }, key=str.casefold),
            "bounty": self.bounty_ledger(),
            "layout": self.layout_snapshot(),
            "notes": self.notes_text(),
            "missionSystem": self.mission_system_filter(),
            "siteFeed": state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else None,
            "siteFeedStatus": state.get("siteFeedStatus") if isinstance(state.get("siteFeedStatus"), dict) else None,
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
            site = nav["site"]
            label = f"SIGNAL #{site.get('signal')}"
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

    def _render_mission_canvas(self, canvas: tk.Canvas, scale: float) -> tuple[int, int]:
        state = self.scout_state(); feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
        mission = feed.get("mission") if isinstance(feed.get("mission"), dict) else {}
        width = round(520 * scale); y = self._draw_title(canvas, "MISSION CONTROL", scale, width)
        if not mission:
            self._draw_text(canvas, 8 * scale, y, "WAITING FOR SITE FEED", scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

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
        if not trade:
            self._draw_text(canvas, 8 * scale, y, "WAITING FOR SITE FEED", scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

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
        if not scout:
            self._draw_text(canvas, 8 * scale, y, "WAITING FOR SITE FEED", scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

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
        if not scout:
            self._draw_text(canvas, 8 * scale, y, "WAITING FOR SITE FEED", scale, 10, HUD_MUTED, True)
            return width, round(y + 30 * scale)

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
                window.withdraw()
                continue
            window.deiconify()
            scale = float(panel_cfg.get("scale") or 1.0) * HUD_RENDER_SCALE
            self._render_panel_canvas(panel_id, info["body"], scale, flash_on)
            if info.get("appliedLocked") != locked:
                self._apply_panel_edit_mode(panel_id, locked)
                info["appliedLocked"] = locked
            if info.get("appliedRevision") != revision:
                window.geometry(f"+{int(panel_cfg['x'])}+{int(panel_cfg['y'])}")
                info["appliedRevision"] = revision
        self.root.after(200, self.refresh_ui)

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

    def regenerate_pin(self) -> None:
        self.pin = f"{secrets.randbelow(1000000):06d}"
        self.session = secrets.token_urlsafe(32)
        if self.pin_label:
            self.pin_label.config(text=f"Pairing PIN: {self.pin}")

    def start_gui(self) -> None:
        root = tk.Tk()
        self.root = root
        root.title("Mongrel HUD")
        root.geometry("460x285")
        root.configure(bg="#091017")
        fg, muted, accent = "#d9edf5", "#8ca5b0", "#56d7ef"
        tk.Label(root, text="MONGREL HUD", bg="#091017", fg=accent, font=("Segoe UI", 17, "bold")).pack(anchor="w", padx=18, pady=(16, 4))
        self.status_label = tk.Label(root, text="Scout: WAITING", bg="#091017", fg=fg, font=("Segoe UI", 10))
        self.status_label.pack(anchor="w", padx=18)
        self.profile_label = tk.Label(root, text="Profile: COMBAT", bg="#091017", fg=fg, font=("Segoe UI", 10))
        self.profile_label.pack(anchor="w", padx=18, pady=(2, 0))
        tk.Label(root, text=f"iPad: http://{local_ipv4()}:{CONTROLLER_PORT}", bg="#091017", fg=muted, font=("Segoe UI", 10)).pack(anchor="w", padx=18, pady=(10, 0))
        self.pin_label = tk.Label(root, text=f"Pairing PIN: {self.pin}", bg="#091017", fg=accent, font=("Segoe UI", 12, "bold"))
        self.pin_label.pack(anchor="w", padx=18, pady=(2, 8))
        buttons = tk.Frame(root, bg="#091017")
        buttons.pack(anchor="w", padx=18)
        tk.Button(buttons, text="Show / Hide Overlay", command=self.toggle_overlay).pack(side="left", padx=(0, 8))
        tk.Button(buttons, text="New Pairing PIN", command=self.regenerate_pin).pack(side="left")
        tk.Button(root, text="Lock / Unlock Layout", command=self.toggle_layout_lock).pack(anchor="w", padx=18, pady=(10, 0))

        for panel_id in PANEL_IDS:
            self._create_panel_window(panel_id)
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
            return bool(morsel and secrets.compare_digest(morsel.value, app.session))

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
                cookie = f"mongrel_hud={app.session}; Path=/; HttpOnly; SameSite=Strict"
                self.send_json({"ok": True}, cookie=cookie)
                return
            if not self.authorized():
                self.send_json({"ok": False, "error": "pair_required"}, 401)
                return
            try:
                if path == "/api/profile":
                    app.set_profile(str(body.get("profile") or ""))
                    result = {"ok": True}
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
    try:
        app.start_gui()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
