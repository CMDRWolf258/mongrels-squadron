from __future__ import annotations

import ctypes
import json
import math
import os
import secrets
import socket
import threading
import time
import tkinter as tk
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

APP_VERSION = "0.1.0"
SCOUT_STATE_URL = "http://127.0.0.1:43857/v1/state"
CONTROLLER_HOST = "0.0.0.0"
CONTROLLER_PORT = 43858
POLL_SECONDS = 0.20


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


class LocalStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()
        self.data: dict[str, Any] = {"profile": "combat", "sites": {}, "activeSite": None, "deposits": []}
        self.load()

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
        self.overlay: tk.Toplevel | None = None
        self.overlay_label: tk.Label | None = None
        self.status_label: tk.Label | None = None
        self.profile_label: tk.Label | None = None
        self.pin_label: tk.Label | None = None

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
            except Exception as exc:
                with self.lock:
                    self.snapshot.connected = False
                    self.snapshot.error = str(exc)
            time.sleep(POLL_SECONDS)

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
        }

    def combat_lines(self) -> list[str]:
        state = self.scout_state()
        own = state.get("ship") or {}
        target = state.get("target") or {}
        shields = own.get("shieldsUp")
        own_shield = "UP" if shields is True else "DOWN" if shields is False else "—"
        own_hull = own.get("hullHealth")
        lines = ["COMBAT", f"YOU   SHIELDS {own_shield}   HULL {own_hull:.0f}%" if isinstance(own_hull, (int, float)) else f"YOU   SHIELDS {own_shield}   HULL —"]
        if not target:
            return lines + ["", "NO TARGET"]
        name = str(target.get("pilotName") or target.get("ship") or "TARGET")
        ship = str(target.get("ship") or "")
        lines += ["", f"{name}  {ship}".strip()]
        th, ts = target.get("hullHealth"), target.get("shieldHealth")
        h = f"{th:.0f}%" if isinstance(th, (int, float)) else "—"
        s = f"{ts:.0f}%" if isinstance(ts, (int, float)) else "—"
        lines.append(f"TARGET   SHIELDS {s}   HULL {h}")
        legal = str(target.get("legalStatus") or "")
        bounty = target.get("bounty")
        if legal or bounty:
            text = legal.upper()
            if isinstance(bounty, int) and bounty > 0:
                text += f"   {bounty:,} CR"
            lines.append(text.strip())
        subsystem = target.get("subsystem") or {}
        if subsystem.get("name"):
            hp = subsystem.get("health")
            lines += ["", f"CURRENT  {subsystem['name']}  {hp:.0f}%" if isinstance(hp, (int, float)) else f"CURRENT  {subsystem['name']}"]
        modules = list((target.get("modules") or {}).values())
        if modules:
            lines += ["", "LAST SEEN MODULES"]
            modules.sort(key=lambda x: str(x.get("observedAt") or ""), reverse=True)
            for module in modules[:6]:
                hp = module.get("health")
                hp_text = f"{hp:.0f}%" if isinstance(hp, (int, float)) else "—"
                lines.append(f"{module.get('name','Module')}  {hp_text}  · {iso_age(module.get('observedAt'))} ago")
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

    def overlay_text(self) -> str:
        with self.store.lock:
            profile = self.store.data.get("profile", "combat")
        return "\n".join(self.surface_lines() if profile == "surface" else self.combat_lines())

    def refresh_ui(self) -> None:
        if not self.root:
            return
        with self.lock:
            connected = self.snapshot.connected
            error = self.snapshot.error
        if self.status_label:
            self.status_label.config(text="Scout: CONNECTED" if connected else f"Scout: WAITING ({error[:45]})")
        if self.profile_label:
            with self.store.lock:
                self.profile_label.config(text=f"Profile: {str(self.store.data.get('profile','combat')).upper()}")
        if self.overlay_label:
            self.overlay_label.config(text=self.overlay_text())
        self.root.after(200, self.refresh_ui)

    def toggle_overlay(self) -> None:
        self.overlay_visible = not self.overlay_visible
        if self.overlay:
            self.overlay.deiconify() if self.overlay_visible else self.overlay.withdraw()

    def regenerate_pin(self) -> None:
        self.pin = f"{secrets.randbelow(1000000):06d}"
        self.session = secrets.token_urlsafe(32)
        if self.pin_label:
            self.pin_label.config(text=f"Pairing PIN: {self.pin}")

    def start_gui(self) -> None:
        root = tk.Tk()
        self.root = root
        root.title("Mongrel HUD")
        root.geometry("460x245")
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

        overlay = tk.Toplevel(root)
        self.overlay = overlay
        overlay.title("Mongrel HUD Overlay")
        overlay.geometry("440x430-40+70")
        overlay.attributes("-topmost", True)
        overlay.configure(bg="black")
        try:
            overlay.attributes("-transparentcolor", "black")
        except tk.TclError:
            overlay.attributes("-alpha", 0.88)
        label = tk.Label(overlay, text="", justify="left", anchor="nw", bg="black", fg="#aeeeff", font=("Consolas", 14, "bold"), padx=12, pady=10)
        self.overlay_label = label
        label.pack(fill="both", expand=True)
        overlay.update_idletasks()
        if os.name == "nt":
            try:
                hwnd = ctypes.windll.user32.GetParent(overlay.winfo_id())
                style = ctypes.windll.user32.GetWindowLongW(hwnd, -20)
                ctypes.windll.user32.SetWindowLongW(hwnd, -20, style | 0x00000020 | 0x00080000 | 0x00000080)
            except Exception:
                pass
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
    here = Path(__file__).resolve().parent
    controller = (here / "controller.html").read_text(encoding="utf-8")
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
