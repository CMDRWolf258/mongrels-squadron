"""Exercise Surveyor HUD text without starting Windows or any network service."""
from __future__ import annotations

import ast
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "downloads/mongrel-hud/mongrel_hud.py"
tree = ast.parse(path.read_text(encoding="utf-8"))
methods = [
    item for cls in tree.body if isinstance(cls, ast.ClassDef)
    for item in cls.body if isinstance(item, ast.FunctionDef)
    and item.name == "surveyor_panel_text"
]
assert len(methods) == 1
# Compile only the pure presentation method to avoid Windows GUI imports.
scope = {}
exec(compile(ast.Module(body=methods, type_ignores=[]), str(path), "exec"), scope)


class FakeHud:
    def __init__(self, value):
        self.value = value

    def scout_state(self):
        return self.value

    def clip_line(self, value, limit):
        value = str(value)
        return value if len(value) <= limit else value[:limit-1] + "…"


FakeHud.surveyor_panel_text = scope["surveyor_panel_text"]

advisor = {
    "source": "commander_frontier_journal_only",
    "eligibleCount": 2, "unvaluedScans": 1,
    "targets": [
        {"rank": 1, "name": "Example A 4", "tier": "high",
         "dssGainMin": 240000, "dssGainMax": 300000, "distanceLs": 390.7,
         "reasons": ["Potential first mapping"]},
        {"rank": 2, "name": "Example A 3", "tier": "medium",
         "dssGainMin": 90000, "dssGainMax": 112500, "distanceLs": None,
         "reasons": ["Distance unconfirmed"]},
    ],
}
state = {"exploration": {
    "system": {"name": "Example", "bodyCount": 5},
    "discoveryStatus": "new_body_candidates",
    "knownBodies": 3, "personallyScannedBodies": 3,
    "personallyMappedBodies": 0, "potentialFirstBodies": 1,
    "unsoldEstimate": 300000,
    "additionalMappingPotentialMin": 330000,
    "additionalMappingPotentialMax": 412500,
    "mappingAdvisor": advisor,
    "unsoldEstimateStatus": "incomplete_sale_reconciliation",
}}
text = FakeHud(state).surveyor_panel_text()
assert "DSS MAPPING ADVISOR" in text
assert "#1 Example A 4" in text and "391 LS" in text, text
assert "+240,000–300,000 CR" in text, text
assert "#2 Example A 3" in text and "distance ?" in text, text
assert "NOT ETA" in text and "ESTIMATES ONLY" in text
assert "may include already-sold" in text
assert "COMMUNITY CANDIDATES" not in text

state["exploration"]["mappingAdvisor"] = {"eligibleCount": 0, "unvaluedScans": 1, "targets": []}
text = FakeHud(state).surveyor_panel_text()
assert "Unpriced worlds found" in text and "#1" not in text

state["exploration"]["mappingAdvisor"] = {"eligibleCount": 0, "unvaluedScans": 0, "targets": []}
text = FakeHud(state).surveyor_panel_text()
assert "continue FSS scanning" in text

state["exploration"] = None
text = FakeHud(state).surveyor_panel_text()
assert "Awaiting Scout exploration journal data" in text

print("Surveyor HUD mapping advisor displays verified gain, distance uncertainty and empty-state PASSED")
