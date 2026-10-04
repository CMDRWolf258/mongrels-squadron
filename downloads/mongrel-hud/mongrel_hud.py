from __future__ import annotations

import ctypes
import difflib
import json
import math
import os
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

APP_VERSION = "0.6.0"
SCOUT_STATE_URL = "http://127.0.0.1:43857/v1/state"
SCOUT_EVENTS_URL = "http://127.0.0.1:43857/v1/events"
SCOUT_ALERT_ACK_URL = "http://127.0.0.1:43857/v1/site-feed/ack"
CONTROLLER_HOST = "0.0.0.0"
CONTROLLER_PORT = 43858
POLL_SECONDS = 0.20

TARGET_SCAN_DURATION = 2.1
TARGET_SCAN_FRAMES = 7
TARGET_SCAN_RECENT_LIMIT = 4
TARGET_CAPTURE_REGION = (0.16, 0.25, 0.70, 0.985)

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

PANEL_IDS = ("own", "target", "subsystems", "bounties", "surface", "mission", "trade", "scoutboard", "alerts", "notes")
VALID_PROFILES = ("combat", "surface")
PANEL_TITLES = {
    "own": "OWN SHIP",
    "target": "TARGET",
    "subsystems": "TARGET LOADOUT",
    "bounties": "BOUNTIES",
    "surface": "SURFACE MINING",
    "mission": "MISSION CONTROL",
    "trade": "TRADER'S OUTPOST",
    "scoutboard": "SCOUT BOARD",
    "alerts": "LEADERSHIP ALERTS",
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
            "mission": {"x": 1260, "y": 70, "visible": True, "scale": 0.9, "profiles": ["combat", "surface"]},
            "trade": {"x": 1260, "y": 315, "visible": False, "scale": 0.9, "profiles": ["combat", "surface"]},
            "scoutboard": {"x": 1260, "y": 540, "visible": False, "scale": 0.9, "profiles": ["combat", "surface"]},
            "alerts": {"x": 760, "y": 560, "visible": True, "scale": 1.0, "profiles": ["combat", "surface"]},
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


def stitch_module_frames(frames: list[list[str]]) -> list[str]:
    merged: list[str] = []
    for frame in frames:
        current = [name for name in frame if name]
        if not current:
            continue
        if not merged:
            merged = list(current)
            continue
        overlap = 0
        for size in range(min(len(merged), len(current)), 0, -1):
            if merged[-size:] == current[:size]:
                overlap = size
                break
        if overlap:
            merged.extend(current[overlap:])
            continue
        tail = merged[-12:]
        match = difflib.SequenceMatcher(None, tail, current, autojunk=False).find_longest_match(0, len(tail), 0, len(current))
        if match.size >= 2 and match.b <= 2 and match.a + match.size >= max(1, len(tail) - 2):
            merged.extend(current[match.b + match.size:])
        else:
            # No trustworthy overlap: retain the frame rather than silently dropping possible modules.
            merged.extend(current)
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
        self.data: dict[str, Any] = {"profile": "combat", "sites": {}, "activeSite": None, "deposits": [], "bounty": {"unclaimed": 0}, "eventCursor": {"sessionId": "", "seq": 0}, "layout": default_layout(), "notes": ""}
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
        self._last_target_identity = ""
        threading.Thread(target=self._warm_ocr, name="MongrelHudOcrWarmup", daemon=True).start()

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
        if not pilot and not ship:
            return ""
        return "|".join((pilot, ship, faction))

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
        rect = ctypes.wintypes.RECT()
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
                self.recent_targets = [item for item in self.recent_targets if item.get("key") != target_key]
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

    def set_site_center(self, site_number: int, commodity: str = "") -> dict[str, Any]:
        if not 1 <= int(site_number) <= 999:
            raise ValueError("invalid_site_number")
        state = self.scout_state()
        status = state.get("status") or {}
        system = state.get("system") or {}
        key = body_key(state)
        lat, lon = status.get("latitude"), status.get("longitude")
        body = str(status.get("bodyName") or "").strip()
        if not key or lat is None or lon is None or not body:
            raise ValueError("surface_position_unavailable")
        site_id = f"{key}|{int(site_number)}"
        site = {
            "id": site_id,
            "siteNumber": int(site_number),
            "system": str(system.get("name") or ""),
            "systemAddress": str(system.get("address") or ""),
            "body": body,
            "bodyKey": key,
            "latitude": float(lat),
            "longitude": float(lon),
            "planetRadius": status.get("planetRadius"),
            "commodity": commodity.strip(),
            "savedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        with self.store.lock:
            self.store.data.setdefault("sites", {})[site_id] = site
            self.store.data["activeSite"] = site_id
            self.store.save()
        return site

    def select_site(self, site_id: str) -> dict[str, Any]:
        with self.store.lock:
            site = self.store.data.get("sites", {}).get(site_id)
            if not isinstance(site, dict):
                raise ValueError("site_not_found")
            self.store.data["activeSite"] = site_id
            self.store.save()
            return dict(site)

    def sites_for_current_body(self) -> list[dict[str, Any]]:
        key = body_key(self.scout_state())
        with self.store.lock:
            sites = [dict(x) for x in self.store.data.get("sites", {}).values() if isinstance(x, dict) and x.get("bodyKey") == key]
        return sorted(sites, key=lambda x: int(x.get("siteNumber") or 0))

    def active_site(self) -> dict[str, Any] | None:
        with self.store.lock:
            value = self.store.data.get("sites", {}).get(self.store.data.get("activeSite"))
            return dict(value) if isinstance(value, dict) else None

    def surface_nav(self) -> dict[str, Any] | None:
        state = self.scout_state()
        status = state.get("status") or {}
        site = self.active_site()
        if not site or site.get("bodyKey") != body_key(state):
            return None
        lat, lon = status.get("latitude"), status.get("longitude")
        radius = status.get("planetRadius") or site.get("planetRadius")
        if lat is None or lon is None or radius is None:
            return None
        nav = great_circle_nav(float(lat), float(lon), float(site["latitude"]), float(site["longitude"]), float(radius), status.get("heading"))
        return {**nav, "site": site}

    def report_deposit(self, commodity: str, rigs: int, notes: str) -> dict[str, Any]:
        commodity = commodity.strip()
        if not commodity:
            raise ValueError("commodity_required")
        if not 0 <= int(rigs) <= 1000:
            raise ValueError("invalid_rig_count")
        state = self.scout_state()
        status = state.get("status") or {}
        system = state.get("system") or {}
        lat, lon = status.get("latitude"), status.get("longitude")
        if lat is None or lon is None or not status.get("bodyName"):
            raise ValueError("surface_position_unavailable")
        active = self.active_site()
        row = {
            "id": secrets.token_hex(8),
            "system": str(system.get("name") or ""),
            "systemAddress": str(system.get("address") or ""),
            "body": str(status.get("bodyName") or ""),
            "latitude": float(lat),
            "longitude": float(lon),
            "siteNumber": active.get("siteNumber") if active else None,
            "siteId": active.get("id") if active else None,
            "commodity": commodity,
            "rigs": int(rigs),
            "notes": notes.strip(),
            "reportedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        with self.store.lock:
            self.store.data.setdefault("deposits", []).append(row)
            self.store.data["deposits"] = self.store.data["deposits"][-500:]
            self.store.save()
        return row

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
            "activeSite": self.active_site(),
            "surfaceNav": self.surface_nav(),
            "bounty": self.bounty_ledger(),
            "layout": self.layout_snapshot(),
            "notes": self.notes_text(),
            "siteFeed": state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else None,
            "siteFeedStatus": state.get("siteFeedStatus") if isinstance(state.get("siteFeedStatus"), dict) else None,
            "targetScan": self.scan_status_snapshot(),
            "targetIntel": self.target_intel(state.get("target") if isinstance(state.get("target"), dict) else None),
            "recentTargets": self.recent_target_snapshot(),
        }

    @staticmethod
    def module_category(name: str) -> str:
        text = name.casefold()
        hardpoint_words = ("cannon", "laser", "rail", "plasma", "missile", "torpedo", "fragment", "multi-cannon", "multicannon", "accelerator", "launcher", "mining laser", "abrasion blaster", "seismic charge", "displacement missile")
        critical_words = ("power plant", "thruster", "drive", "frame shift", "shield generator", "power distributor", "life support", "sensor")
        if any(word in text for word in hardpoint_words) and not any(word in text for word in ("heat sink", "chaff", "shield cell")):
            return "hardpoints"
        if any(word in text for word in critical_words):
            return "critical"
        return "secondary"

    def module_groups(self, target: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
        groups = {"hardpoints": [], "critical": [], "secondary": []}
        modules = target.get("modules") or {}
        if isinstance(modules, dict):
            for module in modules.values():
                if isinstance(module, dict):
                    groups[self.module_category(str(module.get("name") or ""))].append(module)
        return groups

    @staticmethod
    def module_cell(module: dict[str, Any] | None, width: int = 34) -> str:
        if not module:
            return " " * width
        name = str(module.get("name") or "Module")
        if len(name) > 20:
            name = name[:19] + "…"
        health = module.get("health")
        hp = f"{health:.0f}%" if isinstance(health, (int, float)) else "—"
        age = iso_age(module.get("observedAt"))
        text = f"{name:<20} {hp:>4} {age:>5}"
        return text[:width].ljust(width)

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
                hp = subsystem.get("health")
                hp_text = f"{hp:.0f}%" if isinstance(hp, (int, float)) else "—"
                target_lines += ["", f"CURRENT  {str(subsystem['name']):<24} {hp_text:>4}", f"LAST SEEN {iso_age(subsystem.get('observedAt'))} AGO"]
            target_text = "\n".join(target_lines)
        else:
            target_text = "TARGET\nNO TARGET"

        groups = self.module_groups(target)
        subsystem_lines = []
        if any(groups.values()):
            width, gap = 31, "   "
            subsystem_lines.append(f"{'HARDPOINTS':<{width}}{gap}{'CRITICAL SYSTEMS':<{width}}{gap}{'SECONDARY':<{width}}")
            rows = max(len(groups["hardpoints"]), len(groups["critical"]), len(groups["secondary"]))
            for index in range(rows):
                cells = []
                for key in ("hardpoints", "critical", "secondary"):
                    module = groups[key][index] if index < len(groups[key]) else None
                    cells.append(self.module_cell(module, width))
                subsystem_lines.append(gap.join(cells))
        else:
            subsystem_lines = ["SUBSYSTEMS", "No modules observed yet."]

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
            hp = subsystem.get("health")
            hp_text = f"{hp:.0f}%" if isinstance(hp, (int, float)) else "—"
            lines.append(f"CURRENT  {str(subsystem['name']):<28} {hp_text:>4}   · {iso_age(subsystem.get('observedAt'))} ago")
        groups = self.module_groups(target)
        if any(groups.values()):
            width, gap = 34, "   "
            lines += ["", f"{'HARDPOINTS':<{width}}{gap}{'CRITICAL SYSTEMS':<{width}}{gap}{'SECONDARY':<{width}}"]
            rows = max(len(groups["hardpoints"]), len(groups["critical"]), len(groups["secondary"]))
            for index in range(rows):
                cells = []
                for key in ("hardpoints", "critical", "secondary"):
                    module = groups[key][index] if index < len(groups[key]) else None
                    cells.append(self.module_cell(module, width))
                lines.append(gap.join(cells))
        return lines

    def surface_lines(self) -> list[str]:
        state = self.scout_state()
        status = state.get("status") or {}
        system = state.get("system") or {}
        lines = ["SURFACE MINING", str(system.get("name") or "—"), str(status.get("bodyName") or "—")]
        nav = self.surface_nav()
        if nav:
            site = nav["site"]
            label = f"SITE #{site.get('siteNumber')}"
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

        alert_rows = feed.get("alerts") if isinstance(feed.get("alerts"), list) else []
        unacked = [row for row in alert_rows if isinstance(row, dict) and not bool(row.get("acknowledged"))]
        if unacked:
            alert_lines = [f"⚠ LEADERSHIP ALERTS · {len(unacked)} UNACKNOWLEDGED"]
            for row in unacked[:6]:
                alert_lines.append(self.clip_line(f"{str(row.get('type') or '').upper()} · {row.get('title') or 'Alert'}", 78))
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
        texts = self.panel_texts()
        locked = bool(layout.get("locked"))
        master_visible = bool(layout.get("masterVisible"))
        revision = self._layout_revision()
        for panel_id, info in self.panel_windows.items():
            panel_cfg = layout["panels"][panel_id]
            active_for_profile = profile in (panel_cfg.get("profiles") or [])
            should_show = master_visible and active_for_profile and bool(panel_cfg.get("visible", True))
            window = info["window"]
            if not should_show:
                window.withdraw()
                continue
            window.deiconify()
            scale = float(panel_cfg.get("scale") or 1.0)
            base_size = 11 if panel_id in {"mission", "trade", "scoutboard", "alerts", "notes"} else (12 if panel_id in {"bounties", "subsystems"} else 13)
            foreground = "#aeeeff"
            if panel_id == "alerts":
                state = self.scout_state()
                feed = state.get("siteFeed") if isinstance(state.get("siteFeed"), dict) else {}
                if int(feed.get("unacknowledgedCount") or 0) > 0:
                    foreground = "#ff5c5c" if int(time.time() * 2) % 2 == 0 else "#ffd166"
            info["body"].config(text=texts.get(panel_id, ""), fg=foreground, font=("Consolas", max(9, round(base_size * scale)), "bold"))
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
            body.config(padx=0, pady=0)
        else:
            header.pack(fill="x", before=body)
            frame.config(bg="#16303b", highlightbackground="#56d7ef", highlightthickness=1)
            body.config(padx=8, pady=7)
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
        body = tk.Label(frame, text="", justify="left", anchor="nw", bg="black", fg="#aeeeff", font=("Consolas", 13, "bold"), padx=0, pady=0)
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
                elif path == "/api/alert-ack":
                    values = body.get("alertIds")
                    ids = values if isinstance(values, list) else [body.get("alertId")]
                    result = app.acknowledge_alerts(ids)
                elif path == "/api/target-scan":
                    result = {"ok": True, "scan": app.start_target_scan()}
                elif path == "/api/site-center":
                    result = {"ok": True, "site": app.set_site_center(int(body.get("siteNumber") or 0), str(body.get("commodity") or ""))}
                elif path == "/api/site-select":
                    result = {"ok": True, "site": app.select_site(str(body.get("siteId") or ""))}
                elif path == "/api/deposit":
                    result = {"ok": True, "deposit": app.report_deposit(str(body.get("commodity") or ""), int(body.get("rigs") or 0), str(body.get("notes") or ""))}
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
