"""Pure HUD exobiology renderer + navigation tests, without Windows or network."""
from __future__ import annotations

import ast
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

source = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-hud" / "mongrel_hud.py"
tree = ast.parse(source.read_text(encoding="utf-8"))
needed = {"great_circle_nav", "format_distance", "bio_focus_body", "bio_genetic_guidance"}
funcs = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in needed]
assert {node.name for node in funcs} == needed
renderers = [node for item in tree.body if isinstance(item, ast.ClassDef) for node in item.body
             if isinstance(node, ast.FunctionDef) and node.name == "_render_exobiology_canvas"]
assert len(renderers) == 1
scope = {"Any": Any, "math": math, "datetime": datetime, "timezone": timezone,
         "HUD_CYAN":"cyan", "HUD_WHITE":"white", "HUD_AMBER":"amber", "HUD_GREEN":"green",
         "HUD_MUTED":"muted", "HUD_DIM":"dim"}
exec(compile(ast.Module(body=funcs + renderers, type_ignores=[]), str(source), "exec"), scope)

now = datetime.now(timezone.utc)
ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
old = (now-timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
body = {
    "bodyId": "2", "bodyName": "Exobiology Test 2",
    "signals": 2, "confirmedGenuses": [{"name":"Stratum", "id":"$Stratum;"}],
    "prediction": {"candidateCount": 1, "candidates": [
        {"species":"Stratum Tectonicas","estimatedBase":19010800,"status":"compatible","missing":[]}
    ]},
    "sampledSpecies": [{"species": "Stratum Tectonicas", "samples": 1,
        "completed": False, "geneticDistanceMeters": 500, "lastScanAt": ts,
        "samplePositions": [{"latitude":0,"longitude":0,"radius":1000000}]}],
}
survey = {"system":{"address":"42"}, "exobiology":{"biologicalBodies":[body]}}
status = {"timestamp":ts, "onFootOnPlanet":True, "hasLatLong":True, "systemAddress":"42",
    "bodyName":"Exobiology Test 2","latitude":0,"longitude":0,"planetRadius":1000000}
assert scope["bio_focus_body"](survey,status) is body
near = scope["bio_genetic_guidance"](survey,dict(status,longitude=0.01))
assert near["status"] == "move_farther" and 150 < near["distanceMeters"] < 200,near
assert 300 < near["remainingMeters"] < 350,near
far = scope["bio_genetic_guidance"](survey,dict(status,longitude=0.04))
assert far["status"] == "genetic_distance_met" and far["remainingMeters"] == 0,far
for vehicle in (dict(status,onFootOnPlanet=False,longitude=0.04),
                dict(status,onFootOnPlanet=False,inSrv=True,longitude=0.04)):
    measured=scope["bio_genetic_guidance"](survey,vehicle)
    assert measured["status"]=="genetic_distance_met", measured
for invalid in [
    dict(status,bodyName="Different world"),
    dict(status,hasLatLong=False),
    dict(status,timestamp=old),
    dict(status,planetRadius=500000),
    dict(status,latitude=999),
    dict(status,systemAddress="9000"),
    dict(status,systemAddress=""),
]:
    unverified = scope["bio_genetic_guidance"](survey,invalid)
    assert unverified["status"] == "distance_unavailable",unverified
assert scope["bio_genetic_guidance"]({},status)["status"] == "no_biological_body"
empty = {"system":{"address":"42"},"exobiology":{"biologicalBodies":[dict(body,sampledSpecies=[])]}}
assert scope["bio_genetic_guidance"](empty,status)["status"] == "no_active_sample"
# The compass distance is always measured against a *known* source sample,
# not a generated waypoint; candidates alone cannot produce a ready cue.
no_position = {"system":{"address":"42"},"exobiology":{"biologicalBodies":[
    dict(body,sampledSpecies=[dict(body["sampledSpecies"][0],samplePositions=[])])]}
}
assert scope["bio_genetic_guidance"](no_position,status)["status"] == "distance_unavailable"
# Current surface context cannot override a newer Frontier organic sampling
# focus recorded for another body in the active system.
another=dict(body,bodyId="5",bodyName="Exobiology Test 5",
             sampledSpecies=[dict(body["sampledSpecies"][0],species="Tubus Conifer")])
focused={"system":{"address":"42","lastSurveyedBodyId":"5","lastOrganicBodyId":"2"},
         "exobiology":{"biologicalBodies":[another,body]}}
assert scope["bio_focus_body"](focused,dict(status,onFootOnPlanet=False)) is body
# Matching body name but stale/cross-system Status is insufficient proof.
wrong_system=dict(status,systemAddress="9000")
assert scope["bio_focus_body"](focused,wrong_system) is body

class FakeCanvas:
    def create_line(self,*args,**kwargs):
        pass
    def create_rectangle(self,*args,**kwargs):
        pass

class FakeHud:
    def __init__(self, content):
        self.content = content
        self.lines = []
    def scout_state(self):
        return self.content
    def _draw_title(self,canvas,title,scale,width):
        self.lines.append(title)
        return 40
    def _draw_text(self,canvas,x,y,text,scale,font,color,*args):
        self.lines.append(str(text))
    def clip_line(self,value,count):
        return str(value)[:count]

FakeHud._render_exobiology_canvas = scope["_render_exobiology_canvas"]
body["sampledSpecies"][0].update({
    "firstLoggedBonusEstimate":76043200,
    "firstLoggedTotalEstimate":95054000,
    "footfallStatus":"first_footfall_indicated",
    "estimatedBaseValue":19010800,
})
hud = FakeHud({"exploration":survey, "status":dict(status,longitude=0.04)})
dimensions = hud._render_exobiology_canvas(FakeCanvas(),1)
text = " ".join(hud.lines)
assert dimensions[0] > 450 and dimensions[1] > 100
assert "BIOLOGICAL INTELLIGENCE" in text
assert "GENETIC DISTANCE" in text or "DISTANCE MET" in text
assert "19,010,800" in text
assert "DSS BIOLOGY" in text or "POSSIBLE GENERA" in text
assert "POSSIBLE FIRST-LOG TOTAL" in text and "95,054,000" in text, text
assert "ACTIVE SPECIMEN" in text
print("Biological HUD samples, source positions, uncertainty and rendering PASSED")
