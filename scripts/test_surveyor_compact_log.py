"""Discovery-log ordering, compact body labels, controls, and live journal counts."""
from __future__ import annotations
import ast
import importlib.util
import tempfile
import threading
import time
import types
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HUD = ROOT / "downloads/mongrel-hud/mongrel_hud.py"
SCOUT = ROOT / "downloads/mongrel-scout/surveyor.py"
ast_tree = ast.parse(HUD.read_text(encoding="utf-8"))
needed = {"_survey_log_body_label", "_survey_alert_entries", "_render_surveyor_log_canvas",
          "discovery_log_limit", "set_discovery_log_limit"}
methods = [node for item in ast_tree.body if isinstance(item, ast.ClassDef)
           for node in item.body if isinstance(node, ast.FunctionDef) and node.name in needed]
assert {m.name for m in methods} == needed
for method in methods:
    method.decorator_list = []
scope = {"Any": Any, "time": time, "tk": types.SimpleNamespace(Canvas=object),
         "HUD_GREEN": "green", "HUD_AMBER": "amber", "HUD_CYAN": "cyan",
         "HUD_DIM": "dim", "HUD_WHITE": "white", "HUD_MUTED": "muted"}
exec(compile(ast.Module(body=methods, type_ignores=[]), str(HUD), "exec"), scope)

class Store:
    def __init__(self):
        self.lock = threading.RLock()
        self.data = {}
    def save(self):
        self.data["saved"] = self.data.get("saved", 0) + 1

class FakeHud:
    def __init__(self, survey):
        self.survey = survey
        self.lines = []
        self.store = Store()
    def scout_state(self):
        return {"exploration": self.survey}
    def _draw_title(self, canvas, title, scale, width, color=None):
        self.lines.append(title)
        return 30
    def _draw_text(self, canvas, x, y, string, scale, size, color, *args):
        self.lines.append(str(string))
    def clip_line(self, val, length):
        return str(val)[:length]

for name in needed:
    setattr(FakeHud, name, staticmethod(scope[name]) if name == "_survey_log_body_label" else scope[name])

class Canvas:
    def create_line(self, *args, **kwargs):
        pass

system_name = "NGC 2546 Sector QO-P c19-1"
spec = importlib.util.spec_from_file_location("survey_log_fixture", SCOUT)
assert spec and spec.loader
surveyor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(surveyor)

with tempfile.TemporaryDirectory() as tmp:
    scout = surveyor.Surveyor(Path(tmp) / "survey.sqlite")
    cm = "Wolf258 test"
    addr = 987654321098
    scout.apply(cm, {"event":"FSDJump", "timestamp":"2026-10-14T01:00:00Z",
                     "SystemAddress":addr, "StarSystem":system_name})
    scout.apply(cm, {"event":"Scan","timestamp":"2026-10-14T01:00:01Z",
                     "BodyID":0,"BodyName":system_name+" A","SystemAddress":addr,
                     "StarType":"M","ScanType":"AutoScan","WasDiscovered":False})
    for i in range(1, 41):
        scout.apply(cm, {"event":"Scan", "timestamp":f"2026-10-14T01:00:{i+1:02d}Z",
                         "SystemAddress":addr,"BodyID":i,
                         "BodyName":f"{system_name} A {i}",
                         "PlanetClass":"High metal content body",
                         "ScanType":"Detailed","WasDiscovered":False})
    observation=scout.snapshot(cm)
    assert len(observation["explorationAlerts"]) == 41
    assert observation["explorationAlertCounts"]["first_discovery_body"] == 40
    assert observation["explorationAlertCounts"]["first_discovery_system"] == 1
    # FSS repeats must not duplicate counted discoveries.
    scout.apply(cm, {"event":"Scan", "timestamp":"2026-10-14T01:02:01Z",
                     "BodyID":40,"BodyName":system_name+" A 40",
                     "SystemAddress":addr,"PlanetClass":"High metal content body",
                     "ScanType":"Detailed","WasDiscovered":False})
    assert scout.snapshot(cm)["explorationAlertCounts"]["first_discovery_body"] == 40
    restarted = surveyor.Surveyor(Path(tmp) / "survey.sqlite").snapshot(cm)
    assert restarted["explorationAlertCounts"]["first_discovery_body"] == 40
    hud = FakeHud(restarted)
    assert hud.discovery_log_limit() == "10"
    assert hud._survey_log_body_label(system_name+" C A B 2",system_name) == "C A B 2"
    assert hud._survey_log_body_label("Other system X",system_name) == "Other system X"
    size = hud._render_surveyor_log_canvas(Canvas(), 1, True)
    drawn = " | ".join(hud.lines)
    assert 455 <= size[0] <= 470 and size[1] < 450, size
    assert "41 EVENTS" in drawn
    assert "PRIORITY DISCOVERIES" in drawn
    assert "FIRST DISCOVERY · SYSTEM CANDIDATE" in drawn
    assert "FIRST BODY DISCOVERIES" in drawn
    assert "LATEST 10 / 40" in drawn
    assert "+30 OLDER BODY DISCOVERIES · COLLAPSED" in drawn
    assert "A 40" in hud.lines and "A 31" in hud.lines
    assert "A 30" not in hud.lines
    assert hud.lines.index("FIRST DISCOVERY · SYSTEM CANDIDATE") < hud.lines.index("FIRST BODY DISCOVERIES")
    # Custom visibility does not change Frontier persistence or reorder alerts.
    for limit, visible, hidden in (("5",5,35),("15",15,25),("all",40,0)):
        hud.set_discovery_log_limit(limit)
        hud.lines.clear()
        w,h=hud._render_surveyor_log_canvas(Canvas(),1,True)
        drawn = " | ".join(hud.lines)
        assert f"LATEST {visible} / 40" in drawn, (limit,drawn)
        if hidden:
            assert f"+{hidden} OLDER BODY DISCOVERIES · COLLAPSED" in drawn
        else:
            assert "COLLAPSED" not in drawn
        assert "41 EVENTS" in drawn
    try:
        hud.set_discovery_log_limit("0")
        raise AssertionError("Must reject invalid log limit")
    except ValueError:
        pass
    # Next live arrival clears the count, not historical scans or sales.
    scout.apply(cm, {"event":"FSDJump","timestamp":"2026-10-14T01:03:00Z",
                     "SystemAddress":addr+1,"StarSystem":"New system"})
    cleared=scout.snapshot(cm)
    assert cleared["explorationAlertCounts"] == {}
    assert cleared["explorationAlerts"] == []

# Pinned HMC biology and first-system alert remain visible regardless of recent-body limit.
fake={"system":{"address":"4","name":system_name}, "explorationAlerts":[
    {"id":"first_discovery_system:0","kind":"first_discovery_system","name":system_name+" A"},
    {"id":"first_discovery_body:2","kind":"first_discovery_body","name":system_name+" A 2"},
    {"id":"hmc_bio:3","kind":"hmc_bio","name":system_name+" A 3","biologicalSignals":4},
],"explorationAlertCounts":{"first_discovery_body":2,"first_discovery_system":1,"hmc_bio":1}}
hud=FakeHud(fake)
hud.set_discovery_log_limit("5")
hud._render_surveyor_log_canvas(Canvas(),1,True)
out=" | ".join(hud.lines)
assert "HMC + BIO SIGNALS" in out and "A 3 · 4 BIO" in out
assert "LATEST 1 / 2" in out and "+1 OLDER BODY DISCOVERIES · COLLAPSED" in out
assert "4 EVENTS" in out
source=HUD.read_text(encoding="utf-8")
assert "RECOMMENDATIONS ARE PROVISIONAL · NOT ETA" not in source
assert "SALES NOT RECONCILED TO SAMPLE ORIGIN · DO NOT ADD" not in source
assert 'path == "/api/discovery-log-limit"' in source
assert '"discoveryLogLimit": self.discovery_log_limit()' in source
print("Discovery log: 40-body journal, priority, latest limits, count, restart and clean HUD PASSED")
