"""Raven Colonial API adapter and construction cart calculations.

Network reads are isolated from the EDMC journal callback and HUD render loop.
Raven is authoritative; all quantities are outstanding tonnes, not original BOM.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict, deque
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError

API_ROOT = "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net"
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
        if self.key:
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
                return json.loads(raw)
        except HTTPError as exc:
            if exc.code == 404 and missing is not None:
                return missing
            raise

    def snapshot(self, commander):
        path = "/api/cmdr/" + quote(commander, safe="")
        raw = self.request(path + "/active", missing=[])
        if not isinstance(raw, list):
            raise ValueError("invalid_active_projects")
        projects = [project_view(p) for p in raw]
        projects = [p for p in projects if not p["complete"]]
        ids = [p["id"] for p in projects]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate_project")
        primary = self.request(path + "/primary", missing="")
        if primary is not None and not isinstance(primary, str):
            raise ValueError("invalid_primary")
        primary = str(primary or "").strip()
        # A missing primary means all active projects; an unknown nonempty
        # primary is not silently widened to every project.
        if primary and primary not in ids:
            raise ValueError("primary_not_active")
        stocks = {}
        for market in sorted({fc for p in projects for fc in p["carriers"]}):
            try:
                fc = self.request("/api/fc/" + market)
                if not isinstance(fc, dict) or str(fc.get("marketId") or market) != market:
                    raise ValueError("invalid_carrier")
                stocks[market] = cargo_map(fc.get("cargo"))
            except Exception:
                stocks[market] = None
        return {"projects": projects, "primary": primary, "stocks": stocks,
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
    chosen = set(selected) if source == "manual" else ({primary} if primary else {p["id"] for p in projects})
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
        rows.sort(key=lambda r: (category_order.get(r["category"], 99), r["category"].casefold(), r["name"].casefold()))
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
