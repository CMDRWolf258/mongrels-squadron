"""Offline multi-system mining regression: local-only storage and legacy isolation.

No Tk, running HUD, EDMC, network or Cloudflare access required.
"""
from __future__ import annotations
import ast
import json
import math
import re
import threading
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

file = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-hud" / "mongrel_hud.py"
tree = ast.parse(file.read_text(encoding="utf-8"))
wanted = {
    "local_mining_scope", "local_mining_point", "short_body_name",
    "body_type_for_short_name", "great_circle_nav",
}
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in wanted]
assert {x.name for x in functions} == wanted
classes = [x for x in tree.body if isinstance(x, ast.ClassDef) and x.name == "MongrelHudApp"]
assert len(classes) == 1
method_names = {
    "_in_ten16", "sites_for_current_body", "centers_for_current_body",
    "mining_locations_for_current_body", "active_location_signal",
    "select_location", "active_center", "deposits_for_active_location",
    "select_site", "active_site", "_nav_to_point", "location_nav",
    "deposit_nav", "surface_nav", "_mining_selection", "_select_mining",
    "_next_local_mining_id_locked", "set_site_center", "report_deposit",
    "mining_commodity_choices",
}
methods = [x for x in classes[0].body if isinstance(x, ast.FunctionDef) and x.name in method_names]
assert {x.name for x in methods} == method_names
container = ast.ClassDef(name="Harness", bases=[], keywords=[], body=methods, decorator_list=[])
scope = {
    "Any": Any, "math": math, "re": re,
    "threading": threading, "datetime": datetime, "timezone": timezone,
    "TEN16_ID64": "560820275507",
    "TEN16_SYSTEM": "NGC 2546 Sector UZ-G d10-16",
    "SURFACE_MINING_COMMODITIES": ("Platinum", "Gold", "Diamonds", "LTD"),
}
exec(compile(ast.fix_missing_locations(ast.Module(
    body=[*functions, container], type_ignores=[],
)), str(file), "exec"), scope)
Harness = scope["Harness"]

# Any attempt to invoke the central Scout endpoint off-system would be a
# dangerous false save: the ten16 archive is not verified multi-system ready.
def no_network(*args, **kwargs):
    raise AssertionError("off-system local mining MUST NOT contact central 10-16 service")
scope["request_scout_json"] = no_network


class Store:
    def __init__(self, path):
        self.path = path
        self.lock = threading.RLock()
        self.data = json.loads(path.read_text()) if path.exists() else {}
    def save(self):
        self.path.write_text(json.dumps(self.data), encoding="utf-8")


def scene(system_id="12345678901234567", name="Icy Test", body="Icy Test A 2 a",
          lat=12.0, lon=-45.0):
    return {
        "system": {"name": name, "address": system_id},
        "status": {
            "bodyName": body, "latitude": lat, "longitude": lon,
            "heading": 72.0, "planetRadius": 1000000.0,
        },
    }


def make(store, state):
    app = Harness()
    app.store = store
    app.current = state
    app.scout_state = lambda: app.current
    app.mining_lock = threading.RLock()
    app.mining_sites = []
    app.mining_centers = []
    return app


def raises(err, fn, *args):
    try:
        fn(*args)
    except ValueError as exc:
        assert str(exc) == err, (err, str(exc))
        return
    raise AssertionError(f"Expected {err}")


with tempfile.TemporaryDirectory() as temp:
    path = Path(temp) / "hud-data.json"
    store = Store(path)
    app = make(store, scene())
    assert scope["local_mining_scope"](app.current)["key"].startswith("12345678901234567:")
    assert app.sites_for_current_body() == []
    assert app.centers_for_current_body() == []
    assert app.active_location_signal() is None

    # Saving a center and deposit is persistent, but local ONLY.
    c = app.set_site_center(1)
    assert c["storage"] == "local_only"
    assert c["systemAddress"] == "12345678901234567"
    assert c["body"] == "Icy Test A 2 a"
    assert app.active_location_signal() == 1
    assert len(app.mining_locations_for_current_body()) == 1
    d = app.report_deposit("Low Temperature Diamonds", 6, "Near ridge", 1)
    assert d["status"] == "saved_local" and d["storage"] == "local_only"
    assert d["site"]["commodity"] == "Low Temperature Diamonds"
    assert d["site"]["rigs"] == 6
    assert app.active_site()["id"] == d["site"]["id"]
    assert len(app.deposits_for_active_location()) == 1
    assert app.location_nav()["targetType"] == "center"
    assert app.deposit_nav()["targetType"] == "deposit"
    assert "Low Temperature Diamonds" in app.mining_commodity_choices()[0]

    # Repeated center submissions update in place, don't double count.
    app.current["status"]["latitude"] = 12.05
    c2 = app.set_site_center(1)
    assert c2["id"] == c["id"] and c2["latitude"] == 12.05
    assert len(store.data["localMiningCenters"]) == 1

    # Near same-commodity/signal submission is stored only locally and flagged
    # for later dedup review; never silently reported as centrally queued.
    app.current["status"]["latitude"] = 12.00005
    d2 = app.report_deposit("Low Temperature Diamonds", 4, "", 1)
    assert d2["status"] == "duplicate_review_local"
    assert d2["site"]["needsReview"] is True
    assert len(store.data["localMiningDeposits"]) == 2

    # Different commodity at same spot isn't a duplicate.
    distinct = app.report_deposit("Bromellite", 2, "ice", 1)
    assert distinct["status"] == "saved_local"

    # Same signal and body display name in a second ID64 must stay separate.
    other = scene(system_id="88888888888888888")
    app.current = other
    assert app.sites_for_current_body() == []
    assert app.centers_for_current_body() == []
    assert app.active_location_signal() is None
    app.set_site_center(1)
    other_result = app.report_deposit("Bromellite", 3, "other system", 1)
    assert other_result["status"] == "saved_local"
    assert len(app.sites_for_current_body()) == 1
    assert app.active_site()["id"] == other_result["site"]["id"]
    assert app.active_site()["id"] != d["site"]["id"]

    # Another body in same system with identical Signal #1 must also isolate.
    app.current = scene(system_id="88888888888888888", body="Icy Test A 2 b")
    assert not app.sites_for_current_body()
    assert not app.centers_for_current_body()
    app.set_site_center(1)
    app.report_deposit("Diamonds", 1, "moon", 1)
    assert [r["commodity"] for r in app.sites_for_current_body()] == ["Diamonds"]

    # A restart retains all locally recorded bodies and independent selections.
    restarted = make(Store(path), scene())
    assert len(restarted.sites_for_current_body()) == 3
    assert restarted.active_location_signal() == 1
    assert restarted.active_site() is not None
    restarted.current = other
    assert len(restarted.sites_for_current_body()) == 1

    # Reject guessed/stale or missing identities without any writes.
    count = len(restarted.store.data["localMiningDeposits"])
    restarted.current = scene(system_id="", name="Icy Test")
    raises("surface_body_identity_unavailable", restarted.report_deposit, "LTD", 3, "", 1)
    restarted.current = scene(body="Wrong System A 2 a")
    raises("surface_body_identity_unavailable", restarted.set_site_center, 1)
    restarted.current = scene(lat=92)
    raises("surface_position_unavailable", restarted.report_deposit, "LTD", 3, "", 1)
    assert len(restarted.store.data["localMiningDeposits"]) == count

    # 10-16 read and selection behavior ignores all local entries.
    ten16 = scene(system_id="560820275507", name="NGC 2546 Sector UZ-G d10-16",
                  body="NGC 2546 Sector UZ-G d10-16 3")
    restarted.current = ten16
    assert restarted.sites_for_current_body() == []
    assert restarted.centers_for_current_body() == []
    assert restarted.active_location_signal() is None
    assert restarted._in_ten16(ten16)
    # Off-system scoped selections cannot replace old 10-16 selection key.
    assert "activeMiningLocationSignal" not in restarted.store.data

print("Multi-system local mining persistence, identity isolation, duplicate review, compass, legacy 10-16 guard PASSED")
