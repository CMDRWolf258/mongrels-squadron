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
import time
import urllib
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

file = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-hud" / "mongrel_hud.py"
tree = ast.parse(file.read_text(encoding="utf-8"))
wanted = {
    "local_mining_scope", "local_mining_point", "short_body_name",
    "body_type_for_short_name", "great_circle_nav",
    "canonical_multisystem_center",
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
    "publish_local_mining_record",
    "mining_commodity_choices", "mining_browser_catalog",
    "refresh_mining_browser_directory", "select_mining_browser_system",
    "browse_mining_system", "navigate_mining_browser_result",
    "mining_browser_navigation_status", "_mining_nav_on_current_body",
    "_mining_nav_pin_row", "_activate_pending_mining_navigation",
}
methods = [x for x in classes[0].body if isinstance(x, ast.FunctionDef) and x.name in method_names]
assert {x.name for x in methods} == method_names
container = ast.ClassDef(name="Harness", bases=[], keywords=[], body=methods, decorator_list=[])
scope = {
    "Any": Any, "math": math, "re": re, "time": time, "json": json, "urllib": urllib,
    "MULTI_MINING_REMOTE_READS_ENABLED": False,  # Isolate offline regression from new optional network reads
    "SCOUT_MINING_REPORT_URL": "http://127.0.0.1:43857/v1/mining/report",
    "SCOUT_MINING_CENTER_URL": "http://127.0.0.1:43857/v1/mining/center",
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

    # Multi-star body labels with the same short '2a' must remain separate.
    app.current = scene(system_id="88888888888888888", body="Icy Test B 2 a")
    assert not app.sites_for_current_body()
    assert not app.centers_for_current_body()
    raises("invalid_signal", app.set_site_center, 1000)
    assert app.mining_locations_for_current_body() == []

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

    # Approved shared records can be read alongside local ones once the
    # release gate is enabled; other ID64/body data must never bleed through.
    restarted.current = scene()
    restarted.mining_sites = [
        {"id": 2000000001, "systemAddress": "12345678901234567",
         "body": "icy test a 2 a", "signal": 1, "commodity": "Alexandrite",
         "latitude": 12.5, "longitude": -44.5, "rigs": 2},
        {"id": 2000000002, "systemAddress": "88888888888888888",
         "body": "icy test a 2 a", "signal": 1, "commodity": "Other-System",
         "latitude": 12.0, "longitude": -45.0, "rigs": 4},
        {"id": 2000000003, "systemAddress": "12345678901234567",
         "body": "icy test b 2 a", "signal": 1, "commodity": "Other-Star",
         "latitude": 12.0, "longitude": -45.0, "rigs": 4},
    ]
    restarted.mining_centers = [
        {"id": 2000000001, "systemAddress": "12345678901234567",
         "body": "icy test a 2 a", "signal": 1, "latitude": 12.1, "longitude": -45.0},
        {"id": 2000000002, "systemAddress": "88888888888888888",
         "body": "icy test a 2 a", "signal": 1, "latitude": 0.0, "longitude": 0.0},
    ]
    # New-system read-through data is held outside the 10-16 periodic feed.
    restarted.mining_browser_remote_cache = {
        "12345678901234567": {
            "expires": time.monotonic() + 600,
            "deposits": [restarted.mining_sites[0]],
            "centers": [restarted.mining_centers[0]],
        }
    }
    assert len(restarted.sites_for_current_body()) == 4
    assert {x["commodity"] for x in restarted.sites_for_current_body()} == {
        "Low Temperature Diamonds", "Bromellite", "Alexandrite"
    }
    assert restarted.active_center()["id"] == 2000000001
    assert restarted.centers_for_current_body()[0]["latitude"] == 12.1
    # Browser can select other logged systems without moving navigation to a
    # distant body or touching live surface selectors.
    first_nav = restarted.deposit_nav()
    catalog = restarted.mining_browser_catalog()
    names = {r["systemAddress"]: r["systemName"] for r in catalog["systems"]}
    assert "12345678901234567" in names and "88888888888888888" in names
    assert "560820275507" in names
    browsing = restarted.browse_mining_system("12345678901234567")
    assert browsing["system"]["systemName"] == "Icy Test"
    assert any(r["commodity"] == "Alexandrite" for r in browsing["deposits"])
    assert len(browsing["deposits"]) == 5
    assert any(row["commodity"] == "Other-Star" for row in browsing["deposits"])
    assert restarted.refresh_mining_browser_directory()["ok"]
    restarted.select_mining_browser_system("88888888888888888")
    assert restarted.mining_browser_catalog()["selected"] == "88888888888888888"
    assert restarted.deposit_nav() == first_nav, "Browsing must not move the compass"
    assert restarted.active_location_signal() == 1
    assert restarted.browse_mining_system("88888888888888888")["system"]["systemName"] == "Icy Test"
    raises("mining_system_not_logged", restarted.select_mining_browser_system, "99999999")
    raises("mining_system_not_logged", restarted.browse_mining_system, "99999999")
    restarted_again = make(Store(path), scene())
    assert restarted_again.mining_browser_catalog()["selected"] == "88888888888888888"
    # Searching does NOT change navigation, but clicking Navigate activates
    # the stored deposit and its center together on the current world.
    site_nav = restarted.navigate_mining_browser_result(
        "12345678901234567", "deposit", "2000000001")
    assert site_nav["navigation"]["status"] == "active", site_nav
    assert site_nav["navigation"]["centerAvailable"] is True
    assert restarted.active_site()["id"] == 2000000001
    assert restarted.active_center()["id"] == 2000000001
    assert restarted.deposit_nav()["target"]["id"] == 2000000001
    assert restarted.location_nav()["target"]["id"] == 2000000001
    # Navigation snapshot persists even if the separate shared browser cache
    # expires or the HUD is restarted offline.
    restarted.mining_browser_remote_cache = {}
    remembered = make(Store(path), scene())
    assert remembered.active_location_signal() == 1
    assert remembered.active_site()["id"] == 2000000001
    assert remembered.active_center()["id"] == 2000000001
    assert remembered.deposit_nav() is not None
    assert remembered.location_nav() is not None

    # Rejection of unlisted IDs and invalid types MUST preserve current
    # compass selection and existing browser navigation.
    raises("mining_location_not_found", remembered.navigate_mining_browser_result,
           "12345678901234567", "deposit", "42424242")
    raises("invalid_mining_navigation_type", remembered.navigate_mining_browser_result,
           "12345678901234567", "custom", "2000000001")
    assert remembered.active_site()["id"] == 2000000001

    # A center-only destination in another system must queue without changing
    # either current compass; activation waits for BOTH system and full body.
    target_center = next(row for row in remembered.store.data["localMiningCenters"]
                         if row["systemAddress"] == "88888888888888888"
                         and row["body"] == "Icy Test A 2 b")
    before = remembered.deposit_nav()
    pending = remembered.navigate_mining_browser_result(
        "88888888888888888", "center", str(target_center["id"]))
    assert pending["navigation"]["status"] == "queued"
    assert pending["navigation"]["centerAvailable"] is True
    assert remembered.deposit_nav() == before
    resumed = make(Store(path), scene())
    assert resumed.mining_browser_navigation_status()["status"] == "queued"
    assert resumed.active_site() is not None
    resumed.current = scene(system_id="88888888888888888", body="Icy Test A 2 a")
    assert resumed.mining_browser_navigation_status()["status"] == "queued"
    resumed.current = scene(system_id="88888888888888888", body="Icy Test A 2 b")
    assert resumed.active_location_signal() == 1
    assert resumed.mining_browser_navigation_status()["status"] == "active"
    assert resumed.active_center()["id"] == target_center["id"]
    assert resumed.location_nav()["target"]["id"] == target_center["id"]
    assert resumed.active_site() is None
    assert resumed.deposit_nav() is None
    # An explicit manual navigation selection cancels pending/pinned routes.
    resumed.select_location(1)
    assert resumed.mining_browser_navigation_status() is None

    # 10-16 still understands its original SHORT mining body labels and
    # navigates to saved center and site with original central IDs.
    resumed.current = scene(
        system_id="560820275507", name="NGC 2546 Sector UZ-G d10-16",
        body="NGC 2546 Sector UZ-G d10-16 3")
    resumed.mining_sites = [{
        "id": 51, "systemName": "NGC 2546 Sector UZ-G d10-16",
        "systemAddress": "560820275507", "body": "3", "signal": 13,
        "commodity": "Platinum", "latitude": 31.8870, "longitude": 28.4079, "rigs": 4,
    }]
    resumed.mining_centers = [{
        "id": 42, "systemName": "NGC 2546 Sector UZ-G d10-16",
        "systemAddress": "560820275507", "body": "3", "signal": 13,
        "latitude": 31.8800, "longitude": 28.4000,
    }]
    central = resumed.navigate_mining_browser_result("560820275507", "deposit", "51")
    assert central["navigation"]["status"] == "active", central
    assert central["navigation"]["centerAvailable"] is True
    assert resumed.active_site()["id"] == 51
    assert resumed.active_center()["id"] == 42
    assert resumed.deposit_nav() is not None
    assert resumed.location_nav() is not None

    # Strict center validation rejects substituted ID64/body and invalid coords.
    center_validator = scope["canonical_multisystem_center"] if "canonical_multisystem_center" in scope else None
    if center_validator:
        assert center_validator({"id": 2000000001,"systemAddress": "12345678901234567",
            "systemName": "Icy Test", "body": "Icy Test A 2 a", "signal": 1,
            "latitude": 10.0,"longitude": 20.0}, "12345678901234567")["id"] == 2000000001
        raises("invalid_mining_center_response", center_validator, {
            "id": 2000000001,"systemAddress": "88888888888888888",
            "systemName": "Icy Test","body":"Icy Test A 2 a",
            "signal": 1,"latitude": 10,"longitude": 20}, "12345678901234567")

# The paired controller must never represent an off-system local save as a
# successful central shared submission or a queued central duplicate review.
hud_source = file.read_text(encoding="utf-8")
scout_source = (file.parents[1] / "mongrel-scout/load.py").read_text(encoding="utf-8")
assert "MULTI_MINING_REMOTE_READS_ENABLED = True" in hud_source
# One explicit submission of an archived local deposit requires a central
# acknowledgment; it never changes the saved record if the network fails.
with tempfile.TemporaryDirectory() as temp:
    path = Path(temp) / "hud-data.json"
    app = make(Store(path), scene())
    loc = app.report_deposit("Platinum", 5, "Crater", 1)
    item = loc["site"]
    calls = []
    def successful_post(req, *args, **kwargs):
        sent = json.loads(req.data.decode("utf-8"))
        calls.append(sent)
        assert sent["body"] == "Icy Test A 2 a"
        assert sent["systemAddress"] == "12345678901234567"
        assert sent["latitude"] == 12.0
        assert sent["longitude"] == -45.0
        return {"ok": True, "status": "approved",
                "site": {**sent, "id": 2000000042, "body": sent["body"]}}
    scope["request_scout_json"] = successful_post
    assert calls == []
    # The original local report stays on Serenity throughout.
    status = app.publish_local_mining_record("deposit", str(item["id"]))
    assert status["ok"] and status["shared"]
    assert len(calls) == 1
    saved = app.store.data["localMiningDeposits"][0]
    assert saved["sharedStatus"] == "approved"
    assert saved["storage"] == "local_only"
    assert saved["sharedId"] == 2000000042
    assert app.publish_local_mining_record("deposit", str(item["id"]))["status"] == "approved"
    assert len(calls) == 1, "Already confirmed shared record must not post again"
    # No report is marked shared after an exception or a bad acknowledgment.
    second = app.report_deposit("Gold", 2, "Spire", 2)["site"]
    def failed_post(*args, **kwargs):
        raise RuntimeError("offline")
    scope["request_scout_json"] = failed_post
    try:
        app.publish_local_mining_record("deposit", str(second["id"]))
        raise AssertionError("Expected transport failure")
    except RuntimeError:
        pass
    assert not any("sharedStatus" in row for row in app.store.data["localMiningDeposits"]
                   if row["id"] == second["id"])
    def wrong_identity(req, *args, **kwargs):
        sent = json.loads(req.data.decode("utf-8"))
        return {"ok": True, "status": "approved", "site": {**sent, "systemAddress":"999", "id": 42}}
    scope["request_scout_json"] = wrong_identity
    raises("invalid_mining_share_response", app.publish_local_mining_record,
           "deposit", str(second["id"]))
    # Publishing an off-system saved report never uses the ship's current
    # coordinates nor changes the active mining compass or HUD profile.
    app.current = scene(system_id="560820275507", name="NGC 2546 Sector UZ-G d10-16",
                        body="NGC 2546 Sector UZ-G d10-16 3", lat=0, lon=0)
    raises("invalid_mining_share_type", app.publish_local_mining_record, "unknown", str(second["id"]))
    raises("mining_location_not_found", app.publish_local_mining_record, "deposit", "999999")

assert 'self._load_mining_bridge_payload(MINING_DATA_URL, "invalid_mining_payload")' in hud_source
assert 'self._load_mining_bridge_payload(MINING_CENTERS_URL, "invalid_mining_centers_payload")' in hud_source
assert 'endpoint += "?" + urlencode({"systemAddress": address})' in scout_source
controller = (file.parent / "controller.html").read_text(encoding="utf-8")
assert 'state.miningStorage==="local_only"' in controller
assert 'status==="saved_local"' in controller
assert 'status==="duplicate_review_local"' in controller
assert "NOT SQUAD SYNCED" in controller

print("Multi-system local mining persistence, identity isolation, duplicate review, compass, legacy 10-16 guard PASSED")
