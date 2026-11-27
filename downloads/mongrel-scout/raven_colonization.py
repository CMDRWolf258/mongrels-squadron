"""Raven Colonial API adapter and construction cart calculations.

Network reads are isolated from the EDMC journal callback and HUD render loop.
Raven is authoritative; all quantities are outstanding tonnes, not original BOM.
"""
from __future__ import annotations

import json
import hashlib
import os
import sqlite3
from pathlib import Path
import re
from collections import defaultdict, deque
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

API_ROOT = "https://ravencolonial.net"
MAX_RESPONSE = 4 * 1024 * 1024
CATEGORIES = {
    "Chemicals": ("Liquid Oxygen", "Water", "Hydrogen Fuel", "Mineral Oil"),
    "Foods": ("Food Cartridges", "Fruit and Vegetables", "Animal Meat", "Grain", "Fish", "Algae", "Synthetic Meat"),
    "Industrial Materials": ("Ceramic Composites", "Insulating Membrane", "Polymers", "Semiconductors", "Superconductors", "Meta-Alloys"),
    "Machinery": ("Power Generators", "Water Purifiers", "Building Fabricators", "Crop Harvesters", "Marine Equipment", "Microbial Furnaces", "Mineral Extractors", "Modular Terminals", "Robotics", "Thermal Cooling Units"),
    "Medicines": ("Basic Medicines", "Combat Stabilisers", "Advanced Medicines", "Performance Enhancers", "Progenitor Cells"),
    "Metals": ("Aluminium", "Copper", "Steel", "Titanium", "Beryllium", "Cobalt", "Gallium", "Indium", "Lithium", "Tantalum", "Thallium", "Uranium"),
    "Technology": ("Computer Components", "H.E. Suits", "Medical Diagnostic Equipment", "Advanced Catalysers", "Animal Monitors", "Aquaponic Systems", "Auto-Fabricators", "Bioreducing Lichen", "Land Enrichment Systems", "Resonating Separators"),
}
def commodity_key(value):
    text = str(value or "").strip().strip("$;")
    return re.sub(r"[^a-z0-9]", "", re.sub(r"_name$", "", text, flags=re.I).lower())

LABELS = {commodity_key(name): (category, name) for category, names in CATEGORIES.items() for name in names}
# Journal symbols that are not a direct spelling of their English market labels.
LABELS.update({"fruitandvegetables": ("Foods", "Fruit and Vegetables"),
               "hesuits": ("Technology", "H.E. Suits")})
def quantity(value):
    if isinstance(value, bool):
        raise ValueError("invalid_quantity")
    if isinstance(value, int) or isinstance(value, str) and re.fullmatch(r"-?\d+", value):
        return max(0, int(value))
    raise ValueError("invalid_quantity")

def cargo_map(value):
    if not isinstance(value, dict):
        raise ValueError("invalid_cargo_map")
    out = {}
    for name, count in value.items():
        key = commodity_key(name)
        if not key or key in out:
            raise ValueError("invalid_commodity_key")
        out[key] = quantity(count)
    return out

def project_view(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get("buildId"), str) or not raw["buildId"]:
        raise ValueError("invalid_project")
    links = raw.get("linkedFC")
    if links is None:
        links = []
    if not isinstance(links, list):
        raise ValueError("invalid_carrier_links")
    carriers = []
    for link in links:
        if not isinstance(link, dict) or not re.fullmatch(r"\d{1,20}", str(link.get("marketId") or "")):
            raise ValueError("invalid_carrier_link")
        market = str(link["marketId"])
        if market not in carriers:
            carriers.append(market)
    return {"id": raw["buildId"], "name": str(raw.get("buildName") or raw["buildId"]),
            "system": str(raw.get("systemName") or ""), "marketId": str(raw.get("marketId") or ""),
            "complete": raw.get("complete") is True, "need": cargo_map(raw.get("commodities")),
            "carriers": carriers}

class RavenSyncError(RuntimeError):
    """An explicitly sanitized error safe to display on the paired controller."""


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

class RavenClient:
    def __init__(self, key=""):
        self.key = str(key or "").strip()
        self.opener = build_opener(_NoRedirect())

    def request(self, path, method="GET", body=None, missing=None):
        if not path.startswith("/api/"):
            raise ValueError("invalid_raven_path")
        headers = {"Accept": "application/json", "User-Agent": "MongrelScout/colonization"}
        if self.key and (method != "GET" or path == "/api/cmdr/"):
            headers["rcc-key"] = self.key
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, separators=(",", ":")).encode()
        req = Request(API_ROOT + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=10) as reply:
                raw = reply.read(MAX_RESPONSE + 1)
                if len(raw) > MAX_RESPONSE:
                    raise ValueError("raven_response_too_large")
                if not raw.strip():
                    return None
                if path.endswith("/primary"):
                    try:
                        return json.loads(raw)
                    except (ValueError, UnicodeError):
                        return raw.decode("utf-8").strip()
                if method != "GET":
                    return True
                return json.loads(raw)
        except HTTPError as exc:
            if exc.code == 404 and missing is not None:
                return missing
            # Never include the URL, response body, commander name or API key.
            raise RavenSyncError(f"HTTP {exc.code}") from None
        except (URLError, TimeoutError, OSError):
            raise RavenSyncError("Network or TLS connection failed") from None
        except (ValueError, UnicodeError):
            raise RavenSyncError("Invalid response format") from None

    def snapshot(self, commander):
        path = "/api/cmdr/" + quote(commander, safe="")
        def read(stage, suffix, missing=None):
            try:
                return self.request(path + suffix, missing=missing)
            except RavenSyncError as exc:
                raise RavenSyncError(f"{stage}: {exc}") from None
        raw = read("Active projects", "/active", [])
        if not isinstance(raw, list):
            raise RavenSyncError("Active projects: unexpected response format")
        try:
            projects = [project_view(p) for p in raw if not (isinstance(p, dict) and p.get("complete") is True)]
        except (ValueError, TypeError, KeyError):
            raise RavenSyncError("Active projects: invalid project data") from None
        ids = [p["id"] for p in projects]
        if len(set(ids)) != len(ids):
            raise RavenSyncError("Active projects: duplicate project IDs")
        primary = read("Primary project", "/primary", "")
        if primary is not None and not isinstance(primary, str):
            raise RavenSyncError("Primary project: unexpected response format")
        primary = str(primary or "").strip()
        # Mirror SRVSurvey: ignore a primary that is no longer active.
        if primary not in ids:
            primary = ""
        hidden = read("Hidden projects", "/hiddenIDs", [])
        if hidden is None:
            hidden = []
        if not isinstance(hidden, list) or any(not isinstance(x, str) for x in hidden):
            raise RavenSyncError("Hidden projects: unexpected response format")
        stocks = {}
        for market in sorted({fc for p in projects for fc in p["carriers"]}):
            try:
                fc = self.request("/api/fc/" + market)
                if not isinstance(fc, dict) or str(fc.get("marketId") or market) != market:
                    raise ValueError("invalid_carrier")
                stocks[market] = cargo_map(fc.get("cargo"))
            except Exception:
                stocks[market] = None
        return {"projects": projects, "primary": primary, "hidden": hidden, "stocks": stocks,
                "updatedAt": datetime.now(timezone.utc).isoformat()}

def _carrier_coverage(projects, stocks, commodity):
    """Maximum eligible coverage; a shared carrier cannot satisfy two builds twice."""
    graph = defaultdict(dict)
    source, sink = ("source",), ("sink",)
    def edge(a, b, cap):
        graph[a][b] = cap
        graph[b].setdefault(a, 0)
    unknown = False
    total = sum(p["need"].get(commodity, 0) for p in projects)
    carriers = {fc for p in projects if p["need"].get(commodity, 0) for fc in p["carriers"]}
    stock_total = 0
    for fc in sorted(carriers):
        inventory = stocks.get(fc)
        if inventory is None:
            unknown = True
            continue
        available = inventory.get(commodity, 0)
        stock_total += available
        edge(source, ("fc", fc), available)
    for p in projects:
        need = p["need"].get(commodity, 0)
        if not need:
            continue
        node = ("project", p["id"])
        edge(node, sink, need)
        for fc in p["carriers"]:
            if stocks.get(fc) is not None:
                edge(("fc", fc), node, total)
    flow = 0
    while True:
        prev = {source: None}
        q = deque([source])
        while q and sink not in prev:
            a = q.popleft()
            for b, capacity in graph[a].items():
                if capacity > 0 and b not in prev:
                    prev[b] = a
                    q.append(b)
        if sink not in prev:
            break
        b, amount = sink, total
        while b != source:
            a = prev[b]
            amount = min(amount, graph[a][b])
            b = a
        b = sink
        while b != source:
            a = prev[b]
            graph[a][b] -= amount
            graph[b][a] += amount
            b = a
        flow += amount
    return stock_total, flow, unknown

def cart_view(snapshot, cargo, market=None, *, source="raven", selected=(), construction=False):
    """Build a JSON-safe cart using Scout's current corrected ship cargo."""
    projects = snapshot.get("projects", [])
    primary = snapshot.get("primary")
    chosen = set(selected) if source == "manual" else ({primary} if primary else {p["id"] for p in projects} - set(snapshot.get("hidden", [])))
    projects = [p for p in projects if p["id"] in chosen]
    stocks = snapshot.get("stocks", {})
    hold_known = isinstance(cargo, dict) and bool(cargo.get("updatedAt"))
    hold = {}
    if hold_known:
        for row in cargo.get("items", []):
            key = commodity_key(row.get("key"))
            # Mission-reserved commodities cannot be promised to construction.
            amount = max(0, quantity(row.get("count", 0)) - quantity(row.get("missionCount", 0)))
            hold[key] = hold.get(key, 0) + amount
    need = defaultdict(int)
    for p in projects:
        for key, amount in p["need"].items():
            if amount > 0:
                need[key] += amount
    rows = []
    show_fc = any(p["carriers"] for p in projects)
    for key, amount in need.items():
        category, name = LABELS.get(key, ("Other", key))
        info = market.get(key) if market is not None else None
        if info:
            category, name = info.get("category") or category, info.get("name") or name
        in_ship = hold.get(key, 0)
        fc, covered, unknown = _carrier_coverage(projects, stocks, key)
        rows.append({"key": key, "name": name, "category": category, "need": amount,
                     "ship": in_ship if hold_known else None, "carrier": fc if not unknown else None,
                     "carrierKnownStock": fc, "carrierUnknown": unknown,
                     "available": None if market is None else bool(info and info.get("supply", 0) > 0),
                     "marketOrder": info.get("order") if info else None,
                     "fulfilled": hold_known and in_ship >= amount,
                     "toCollect": max(0, amount - covered - in_ship)})
    category_order = {name: i for i, name in enumerate(CATEGORIES)}
    if construction:
        rows.sort(key=lambda r: r["name"].casefold())
    else:
        rows.sort(key=lambda r: (category_order.get(r["category"], 99), r["category"].casefold(),
                                 r["name"].casefold(), r["key"]))
    remaining = sum(r["need"] for r in rows)
    collect = sum(r["toCollect"] for r in rows)
    incomplete_inventory = not hold_known or any(r["carrierUnknown"] for r in rows)
    cap = cargo.get("capacity") if isinstance(cargo, dict) else None
    capacity = cap if type(cap) is int and cap > 0 else None
    trips = lambda n: (n + capacity - 1) // capacity if capacity else (0 if n == 0 else None)
    return {"projects": [{"id": p["id"], "name": p["name"], "system": p["system"]} for p in projects],
            "availableProjects": [{"id": p["id"], "name": p["name"], "system": p["system"]} for p in snapshot.get("projects", [])],
            "primary": primary, "rows": rows, "showShip": any((r["ship"] or 0) > 0 for r in rows),
            "showCarrier": show_fc, "remaining": remaining, "toCollect": None if incomplete_inventory else collect,
            "collectionTrips": None if incomplete_inventory else trips(collect), "deliveryTrips": trips(remaining),
            "capacity": capacity, "construction": construction, "marketKnown": market is not None,
            "holdKnown": hold_known, "updatedAt": snapshot.get("updatedAt")}


def reporting_request(projects, commander, dock_market, system, entry):
    """Translate a live journal event into a documented Raven write.

    Never create projects, link carriers, mark completion, or guess a dock.
    Depot snapshots replace outstanding requirements; contribution only credits
    history. Carrier stock is changed solely by explicit cargo movements.
    """
    dock_market = str(dock_market or "")
    if not re.fullmatch(r"\d{1,20}", dock_market):
        return None
    event = entry.get("event")
    supplied = entry.get("MarketID")
    if supplied is not None and str(supplied) != dock_market:
        return None
    if event in ("ColonisationConstructionDepot", "ColonisationContribution"):
        if supplied is None:
            return None
        matches = [p for p in projects if p["marketId"] == dock_market
                   and (not p["system"] or p["system"].casefold() == str(system).casefold())
                   and not p["complete"]]
        if len(matches) != 1:
            return None
        project = matches[0]
        path = "/api/project/" + quote(project["id"], safe="")
        if event == "ColonisationContribution":
            contributions = entry.get("Contributions")
            if not isinstance(contributions, list) or not contributions:
                return None
            body = defaultdict(int)
            for row in contributions:
                key = commodity_key(row.get("Name"))
                amount = quantity(row.get("Amount"))
                if not key or amount <= 0:
                    raise ValueError("invalid_contribution")
                body[key] += amount
            return "POST", path + "/contribute/" + quote(commander, safe=""), dict(body)
        resources = entry.get("ResourcesRequired")
        if not isinstance(resources, list) or not resources:
            return None
        need, total = {}, 0
        for row in resources:
            key = commodity_key(row.get("Name"))
            required = quantity(row.get("RequiredAmount"))
            provided = quantity(row.get("ProvidedAmount"))
            if not key or key in need or provided > required:
                raise ValueError("invalid_depot")
            need[key] = required - provided
            total += required
        # An incomplete journal snapshot must not erase a known outstanding item.
        if not set(k for k, v in project["need"].items() if v > 0).issubset(need):
            return None
        return "PATCH", path, {"buildId": project["id"], "commodities": need,
                                "maxNeed": total, "colonisationConstructionDepot": dict(entry)}
    if not any(dock_market in p["carriers"] for p in projects if not p["complete"]):
        return None
    delta = defaultdict(int)
    if event == "CargoTransfer":
        transfers = entry.get("Transfers")
        if not isinstance(transfers, list):
            return None
        for row in transfers:
            direction = str(row.get("Direction") or "").casefold()
            if direction not in ("tocarrier", "toship"):
                continue
            key = commodity_key(row.get("Type"))
            amount = quantity(row.get("Count"))
            if key and amount:
                delta[key] += amount if direction == "tocarrier" else -amount
    elif event in ("MarketBuy", "MarketSell") and supplied is not None:
        key = commodity_key(entry.get("Type"))
        amount = quantity(entry.get("Count"))
        if key and amount:
            delta[key] += amount if event == "MarketSell" else -amount
    else:
        return None
    body = {k: v for k, v in delta.items() if v}
    return ("PATCH", "/api/fc/" + dock_market + "/cargo", body) if body else None


def preview_live_event(snapshot, commander, dock_market, system, entry):
    """Display confirmed local journal changes before Raven's write/read round trip.

    Copy only the affected project or known carrier inventory. The caller retains
    the last server snapshot separately and reconciles with a fresh read after
    reporting completes. This function never writes to Raven.
    """
    request = reporting_request(snapshot.get("projects", []), commander, dock_market, system, entry)
    if request is None:
        return snapshot
    method, path, body = request
    if path.startswith("/api/fc/") and path.endswith("/cargo"):
        market = str(dock_market)
        old = snapshot.get("stocks", {}).get(market)
        if not isinstance(old, dict):
            return snapshot
        # An inconsistent or unknown starting stock must not become a made-up balance.
        if any(old.get(key, 0) + delta < 0 for key, delta in body.items()):
            return snapshot
        stock = dict(old)
        for key, delta in body.items():
            stock[key] = stock.get(key, 0) + delta
        return {**snapshot, "stocks": {**snapshot["stocks"], market: stock}}
    if entry.get("event") == "ColonisationConstructionDepot":
        project_id = body["buildId"]
        projects = [{**p, "need": dict(body["commodities"])} if p["id"] == project_id else p
                    for p in snapshot["projects"]]
        return {**snapshot, "projects": projects}
    # Contribution events update ship cargo immediately. The authoritative
    # depot snapshot (not a guessed subtraction) supplies remaining build need.
    return snapshot


def report_live_event(client, commander, dock_market, system, entry, ledger_path=None):
    """Record before sending: ambiguous HTTP failures must never replay deltas.

    Identical journal events can be replayed by EDMC. Retain a durable fingerprint
    and fail closed rather than invent a second movement. A manual Raven inventory
    reconciliation is required after an ambiguous delivery response.
    """
    if not client.key:
        raise ValueError("raven_reporting_key_required")
    # The caller checks live session and captured dock before dispatch.
    raw = client.request("/api/cmdr/" + quote(commander, safe="") + "/active", missing=[])
    if not isinstance(raw, list):
        raise ValueError("invalid_active_projects")
    request = reporting_request([project_view(p) for p in raw], commander, dock_market, system, entry)
    if request is None:
        return "ignored"
    method, path, body = request
    fingerprint = hashlib.sha256(json.dumps([commander.casefold(), dock_market, entry],
                                           sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / ".local" / "share"))
    db = Path(ledger_path) if ledger_path else base / "MongrelScout" / "raven-reporting.sqlite3"
    db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db, timeout=5) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, status TEXT NOT NULL)")
        inserted = connection.execute("INSERT OR IGNORE INTO events VALUES (?, 'pending')", (fingerprint,)).rowcount
    if not inserted:
        return "duplicate"
    # An error after sending is ambiguous. Leave pending and surface it; do not retry.
    client.request(path, method=method, body=body)
    with sqlite3.connect(db, timeout=5) as connection:
        connection.execute("UPDATE events SET status='sent' WHERE id=?", (fingerprint,))
    return "sent"
