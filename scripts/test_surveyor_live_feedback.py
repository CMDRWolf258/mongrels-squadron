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

# Live cockpit alerts use only current Frontier events. Historical replay,
# community chart entries and EDDiscovery archives never synthesize alerts.
with tempfile.TemporaryDirectory() as directory:
    ledger=surveyor.Surveyor(Path(directory)/"alert.sqlite")
    cm,sysaddr="Live Alert Tester",123456789777
    def feed(kind,minute,bodyid=None,**kw):
        data={"event":kind,"timestamp":f"2026-10-13T00:{minute:02d}:00Z","SystemAddress":sysaddr}
        if bodyid is not None: data["BodyID"]=bodyid
        data.update(kw)
        return ledger.apply(cm,data)
    first=feed("FSDJump",0,StarSystem="Fresh Test System")
    assert first["explorationAlerts"]==[]
    first=feed("Scan",1,0,BodyName="Fresh Test System",StarType="K",
               WasDiscovered=False,ScanType="AutoScan")
    assert len(first["explorationAlerts"])==1
    assert first["explorationAlerts"][0]["kind"]=="first_discovery_system"
    # Signal records may arrive BEFORE the detailed FSS Scan.
    signals=[{"Type":"$SAA_SignalType_Biological;","Count":2}]
    early=feed("FSSBodySignals",2,3,BodyName="Fresh Test System 3",Signals=signals)
    assert len(early["explorationAlerts"])==1
    hmc=feed("Scan",3,3,BodyName="Fresh Test System 3",
             PlanetClass="High metal content body",WasDiscovered=True,WasMapped=False,
             ScanType="Detailed")
    assert len(hmc["explorationAlerts"])==2
    biological=next(a for a in hmc["explorationAlerts"] if a["kind"]=="hmc_bio")
    assert biological["biologicalSignals"]==2
    assert not biological["speciesConfirmed"] and not biological["isFirstFootfallConfirmed"]
    again=feed("SAASignalsFound",4,3,BodyName="Fresh Test System 3",Signals=signals)
    assert len(again["explorationAlerts"])==2, "Repeated biology must not spam alerts"
    # Same signal on a different planet class must not trigger HMC.
    feed("Scan",5,4,BodyName="Fresh Test System 4",PlanetClass="Icy body",
         WasDiscovered=True,ScanType="Detailed")
    icy=feed("FSSBodySignals",6,4,BodyName="Fresh Test System 4",Signals=signals)
    assert len(icy["explorationAlerts"])==2
    # Conversely, a live signal arriving AFTER an HMC Scan must trigger.
    feed("Scan",7,5,BodyName="Fresh Test System 5",PlanetClass="High metal content body",
         WasDiscovered=False,ScanType="Detailed")
    later=feed("FSSBodySignals",8,5,BodyName="Fresh Test System 5",
               Signals=[{"Type_Localised":"Biological","Count":1}])
    assert any(x["kind"]=="first_discovery_body" and x["bodyId"]=="5" for x in later["explorationAlerts"])
    assert any(x["kind"]=="hmc_bio" and x["bodyId"]=="5" for x in later["explorationAlerts"])
    assert len(later["explorationAlerts"])==4
    assert ledger.snapshot(cm)["explorationAlerts"]==later["explorationAlerts"]
    # Restart retains the current visit's alerts, a new arrival clears them.
    restarted=surveyor.Surveyor(Path(directory)/"alert.sqlite")
    assert len(restarted.snapshot(cm)["explorationAlerts"])==4
    leave=feed("FSDJump",9,StarSystem="Another Test System",SystemAddress=123456789778)
    assert leave["explorationAlerts"]==[]
    # Live scan where data was already imported is not a new first-claim alert.
    historic_cmd="Historical Replay Tester"
    historic_ledger=surveyor.Surveyor(Path(directory)/"alert.sqlite")
    historic_ledger.apply(historic_cmd,{"event":"FSDJump","timestamp":"2026-10-13T00:00:00Z",
                                        "StarSystem":"Archived First","SystemAddress":123454321})
    historic_ledger.apply(historic_cmd,{"event":"Scan","timestamp":"2026-10-12T22:01:00Z",
                                        "SystemAddress":123454321,"BodyID":2,
                                        "BodyName":"Archived First 2","PlanetClass":"High metal content body",
                                        "WasDiscovered":False,"ScanType":"Detailed"},historic=True)
    historic_ledger.apply(historic_cmd,{"event":"FSSBodySignals","timestamp":"2026-10-12T22:02:00Z",
                                        "SystemAddress":123454321,"BodyID":2,
                                        "Signals":signals},historic=True)
    assert historic_ledger.snapshot(historic_cmd)["explorationAlerts"]==[]
    assert historic_ledger.snapshot(historic_cmd)["expedition"]["active"] is False
    # HUD's new exploration-only alert instrument is self-contained.
    class AlertCanvas(Canvas):
        def create_rectangle(self,*args,**kwargs): pass
    p=Panel({"exploration":later})
    p._survey_alert_entries=types.MethodType(hud.MongrelHudApp._survey_alert_entries,p)
    p._survey_primary_alert=types.MethodType(hud.MongrelHudApp._survey_primary_alert,p)
    w,h=hud.MongrelHudApp._render_surveyor_alert_canvas(p,AlertCanvas(),1.0,True)
    assert w>400 and h>100
    assert p.titles==["EXPLORATION ALERTS"],p.titles
    assert any("FIRST DISCOVERY · SYSTEM" in x for x in p.lines)
    assert not any("FIRST DISCOVERY · BODY" in x for x in p.lines)
    # The secondary window retains every existing first-body/HMC alert.
    log=Panel({"exploration":later})
    log._survey_alert_entries=types.MethodType(hud.MongrelHudApp._survey_alert_entries,log)
    lw,lh=hud.MongrelHudApp._render_surveyor_log_canvas(log,AlertCanvas(),1.0,True)
    assert lw>300 and lh>180
    assert log.titles==["EXPLORATION DISCOVERY LOG"]
    assert any("FIRST DISCOVERY · BODY" in x for x in log.lines)
    assert sum("HMC + BIO" in x for x in log.lines)==2
    assert any("Fresh Test System 3 · 2 BIO" in x for x in log.lines)
    assert {"surveyor_alert","surveyor_log"}.issubset(hud.PANEL_IDS)
    for panel_name in ("surveyor_alert","surveyor_log"):
        assert "exploration" in hud.default_layout()["panels"][panel_name]["profiles"]

print("Surveyor feedback title, count, status and gas-giant regressions PASSED")
