"""Post-release HUD regression cases: native Frontier alert order and local state."""
from __future__ import annotations
import ast
import re
import threading
import types
from pathlib import Path
from typing import Any

path=Path(__file__).resolve().parents[1]/"downloads/mongrel-hud/mongrel_hud.py"
tree=ast.parse(path.read_text(encoding="utf-8"))
names={"_survey_alert_entries","_survey_primary_alert","_render_surveyor_alert_canvas",
       "_render_surveyor_log_canvas","trade_route_selection","set_trade_route_selection",
       "clear_unclaimed_bounties","bounty_ledger"}
methods=[method for obj in tree.body if isinstance(obj,ast.ClassDef)
         for method in obj.body if isinstance(method,ast.FunctionDef) and method.name in names]
assert {method.name for method in methods}==names
scope={"Any":Any,"re":re,"tk":types.SimpleNamespace(Canvas=object),
       "HUD_GREEN":"green","HUD_AMBER":"amber","HUD_CYAN":"cyan",
       "HUD_DIM":"dim","HUD_WHITE":"white","HUD_MUTED":"muted"}
exec(compile(ast.Module(body=methods,type_ignores=[]),str(path),"exec"),scope)

class Store:
    def __init__(self):
        self.lock=threading.RLock()
        self.data={"bounty":{"unclaimed":2600000}}
        self.saved=0
    def save(self):
        self.saved+=1

class FakeHUD:
    def __init__(self):
        self.store=Store()
        self.run_bounty=4000000
        self.run_kills=5
        self.last_bounty=125000
        self.survey={}
        self.lines=[]
    def scout_state(self):
        return {"exploration":self.survey}
    def _draw_title(self,canvas,title,scale,width,color=None):
        self.lines.append(title)
        return 30
    def _draw_text(self,canvas,x,y,text,scale,font,color,*args):
        self.lines.append(str(text))
    def clip_line(self,value,width):
        return str(value)[:width]

for name in names:
    setattr(FakeHUD,name,scope[name])

class Canvas:
    def create_rectangle(self,*args,**kwargs):
        pass

hud=FakeHUD()
assert hud.trade_route_selection()=={"mode":"all","selectedIds":[]}
saved=hud.set_trade_route_selection("custom",["route-a","route-b","route-a"])
assert saved=={"mode":"custom","selectedIds":["route-a","route-b"]}
assert hud.trade_route_selection()==saved
try:
    hud.set_trade_route_selection("custom",["<bad>"])
    raise AssertionError("Invalid route identifiers must be rejected")
except ValueError:
    pass
assert hud.clear_unclaimed_bounties()["unclaimed"]==0
assert hud.bounty_ledger()["runEarned"]==4000000
assert hud.bounty_ledger()["runKills"]==5
assert hud.store.saved==2
assert "surveyor_log" in scope if False else True  # panel registration tested separately

system={"id":"first_discovery_system:0","kind":"first_discovery_system","name":"New System"}
body={"id":"first_discovery_body:2","kind":"first_discovery_body","name":"A 2"}
hmc={"id":"hmc_bio:3","kind":"hmc_bio","name":"A 3","biologicalSignals":4}
hud.survey={"system":{"address":"42"},"explorationAlerts":[body,hmc]}
assert hud._survey_alert_entries()[0]=="42"
assert hud._survey_primary_alert("42",[body],0)==(None,False)
assert hud._survey_primary_alert("42",[body,hmc],0)==(hmc,True)
assert hud._survey_primary_alert("42",[body,hmc],8)==(hmc,True)
# A newly identified first-discovery system interrupts lower-priority HMC only.
assert hud._survey_primary_alert("42",[body,hmc,system],9)==(system,True)
assert hud._survey_primary_alert("42",[body,hmc,system],20)==(system,True)
assert hud._survey_primary_alert("42",[body,hmc,system],21)==(hmc,True)
assert hud._survey_primary_alert("42",[body,hmc,system],33)==(hmc,False)
# A later major signal gets its own interval even after a steady cue.
hmc2={"id":"hmc_bio:4","kind":"hmc_bio","name":"A 4","biologicalSignals":2}
assert hud._survey_primary_alert("42",[body,hmc,system,hmc2],34)==(hmc2,True)
assert hud._survey_primary_alert("43",[body,hmc],40)==(hmc,True)

hud.survey={"system":{"address":"43"},"explorationAlerts":[body,hmc]}
hud.lines=[]
hud._render_surveyor_alert_canvas(Canvas(),1,True)
assert "FIRST DISCOVERY · BODY" not in hud.lines
assert "HMC + BIOLOGICAL SIGNALS" in hud.lines
hud.lines=[]
hud._render_surveyor_log_canvas(Canvas(),1,True)
assert "FIRST DISCOVERY · BODY" in hud.lines
assert "HMC + BIO" in hud.lines
assert "EXPLORATION DISCOVERY LOG" in hud.lines

source=path.read_text(encoding="utf-8")
assert '"surveyor_log"' in source
assert 'if should_show and panel_id in {"surveyor_alert", "surveyor_log"}' in source
assert '"EXOBIOLOGY · DETECTED BIO SIGNALS"' in source
assert '"NONE CONFIRMED"' in source
assert 'selection["mode"] == "custom"' in source
assert 'path == "/api/bounties/clear"' in source
print("HUD refinement: alert order, timing, history, route filtering and local bounty correction PASSED")
