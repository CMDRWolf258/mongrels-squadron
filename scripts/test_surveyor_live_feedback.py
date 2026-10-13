"""Offline acceptance for Surveyor valuation, discovery cues and HUD titles."""
from __future__ import annotations
import importlib.util,sys,types,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("surveyor_feedback",ROOT/"downloads/mongrel-scout/surveyor.py")
assert spec and spec.loader
surveyor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(surveyor)
for roman in ("I","II"):
    row={"planetClass":f"Class {roman} gas giant","massEM":150,
         "wasDiscovered":False,"wasMapped":False}
    raw={**row,"planetClass":f"Sudarsky class {roman} gas giant"}
    assert surveyor._value(raw,False,False)==surveyor._value(row,False,False)
    assert surveyor._value(raw,True,True)==surveyor._value(row,True,True)
    assert surveyor._value(raw,False,False)>surveyor._value(
        {**raw,"planetClass":"Icy body"},False,False)

with tempfile.TemporaryDirectory() as directory:
    ledger=surveyor.Surveyor(Path(directory)/"survey.sqlite")
    cmdr,addr="Feedback Tester",1234567898765
    ledger.apply(cmdr,{"event":"FSDJump","timestamp":"2026-10-12T01:00:00Z",
                       "StarSystem":"Feedback System","SystemAddress":addr})
    ledger.apply(cmdr,{"event":"Scan","timestamp":"2026-10-12T01:01:00Z",
                       "SystemAddress":addr,"BodyName":"Feedback System 1","BodyID":1,
                       "PlanetClass":"Sudarsky class I gas giant","MassEM":150,
                       "WasDiscovered":False,"WasMapped":False,"ScanType":"Detailed"})
    ledger.set_intelligence(cmdr,str(addr),{
        "status":"community_cataloged","providers":["Spansh"],
        "catalogedBodies":1,
        "reportedBodies":[{"name":"Feedback System 1","class":"Sudarsky class I gas giant",
                           "catalogStatus":"reported","firstDiscovery":"unverified",
                           "firstMapping":"unverified"}],"highlights":[]})
    observation=ledger.snapshot(cmdr)
    assert observation["personallyScannedBodies"]==1
    assert observation["bodies"][0]["wasMapped"] is False

sys.modules.setdefault("tkinter",types.ModuleType("tkinter"))
sys.path.insert(0,str(ROOT/"downloads/mongrel-hud"))
import mongrel_hud as hud
class Canvas:
    def create_line(self,*args,**kwargs): pass
class Panel:
    def __init__(self,state):
        self.state,self.titles,self.lines=state,[],[]
    def scout_state(self): return self.state
    def _draw_title(self,c,title,scale,width,color=None):
        self.titles.append(title)
        return 28*scale
    def _draw_text(self,c,x,y,value,scale,*args):
        self.lines.append(str(value))
    def _draw_progress(self,*args): pass
    def clip_line(self,text,length): return str(text or "")[:length]
observation["system"]["bodyCount"]=1
observation["personallyScannedBodies"]=2
observation["mappingAdvisor"]={"targets":[{"rank":1,"name":"Feedback System 1",
    "planetClass":"Sudarsky class I gas giant","firstMappingCandidate":True,
    "dssGainMin":55000,"dssGainMax":80000,"distanceLs":300,"tier":"high"}],
    "eligibleCount":1}
state={"exploration":observation,"status":{
    "destination":{"bodyId":1,"systemAddress":str(addr)}}}
for panel,title in (("surveyor","MONGREL SURVEYOR"),
                    ("surveyor_dss","DSS TARGET DIRECTOR"),
                    ("surveyor_body","BODY INTELLIGENCE")):
    p=Panel(state)
    size=hud.MongrelHudApp._render_surveyor_canvas(p,Canvas(),1,panel)
    assert p.titles==[title],p.titles
    assert size[0]>250 and size[1]>50
    if panel=="surveyor":
        assert any("2 JOURNAL SCANS" in line for line in p.lines)
        assert any("COUNT DISAGREEMENT" in line for line in p.lines)
    if panel=="surveyor_dss":
        assert any("VALUABLE UNMAPPED" in line for line in p.lines)
    if panel=="surveyor_body":
        assert any("POTENTIAL FIRST DISCOVERY" in line for line in p.lines)
        assert any("POTENTIAL FIRST MAPPING" in line for line in p.lines)
print("Surveyor feedback title, count, status and gas-giant regressions PASSED")
