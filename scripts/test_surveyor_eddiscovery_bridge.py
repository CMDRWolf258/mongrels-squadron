"""EDDiscovery native WebSocket bridge offline tests.

Fake loopback EDDiscovery server returns a documented scan response; no EDD
installation, HTTP API, Cloudflare or live Elite journal required.
"""
from __future__ import annotations
import importlib.util
import base64
import hashlib
import json
import socket
import threading
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/"downloads"/"mongrel-scout"
def load(filename,name):
    spec=importlib.util.spec_from_file_location(name,ROOT/filename)
    assert spec and spec.loader
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
bridge=load("surveyor_edd_bridge.py","edd_bridge")
surveyor=load("surveyor.py","surveyor_edd_core")
NAME="NGC 2546 Sector OY-P c19-2"
ADDRESS="1234567890123456789"
reply={"responsetype":"scandata","entry":9,"Count":3,"Bodies":[
    {"NodeType":"star","FullName":NAME,"BodyID":0,
     "Scan":{"IsWebSourced":False,"SystemAddress":int(ADDRESS),
             "BodyName":NAME,"StarTypeText":"Orange K class star","EstimatedValue":3148,
             "WasDiscovered":False}},
    {"NodeType":"planet","FullName":NAME+" 1","BodyID":1,
     "Scan":{"IsWebSourced":False,"SystemAddress":int(ADDRESS),
             "BodyName":NAME+" 1","PlanetTypeText":"Water world",
             "EstimatedValue":4653384,"Mapped":True,
             "WasDiscovered":False,"WasMapped":False}},
    {"NodeType":"planet","FullName":NAME+" 2","BodyID":2,
     "Scan":{"IsWebSourced":True,"SystemAddress":int(ADDRESS),
             "BodyName":NAME+" 2","EstimatedValue":9999999999}},
]}
historic=bridge.normalize_scan_response(reply,NAME,ADDRESS)
assert historic["bodyCount"]==2
assert historic["estimatedHistoricalValue"]==4656532
assert historic["bodies"][1]["personallyMapped"] is True
assert historic["bodies"][1]["wasDiscovered"] is False
assert not historic["includedInExpeditionEarnings"]
wrong=json.loads(json.dumps(reply))
wrong["Bodies"][0]["Scan"]["SystemAddress"]=42
try:
    bridge.normalize_scan_response(wrong,NAME,ADDRESS)
    raise AssertionError("different system ID must fail")
except ValueError as exc:
    assert "mismatch" in str(exc)

# Native WebSocket handshake and framed JSON response, entirely localhost.
listener=socket.socket()
listener.bind(("127.0.0.1",0))
listener.listen(1)
port=listener.getsockname()[1]
failures=[]
def fake_edd_server():
    try:
        connection,_=listener.accept()
        with connection:
            incoming=b""
            while b"\r\n\r\n" not in incoming:
                incoming+=connection.recv(4096)
            text=incoming.decode("ascii")
            key=next(x.split(":",1)[1].strip() for x in text.split("\r\n")
                     if x.lower().startswith("sec-websocket-key:"))
            accept=base64.b64encode(hashlib.sha1(
                (key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
            connection.sendall((
                "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                "Connection: Upgrade\r\nSec-WebSocket-Protocol: EDDJSON\r\n"
                f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
            opcode,final,payload=bridge._read_frame(connection)
            assert opcode==1 and final
            request=json.loads(payload)
            assert request=={"requesttype":"scandata","entry":-1,"edsm":False,"spansh":False}
            serialized=json.dumps(reply).encode()
            # Server-to-client frames are unmasked.
            head=b"\x81"+(bytes([len(serialized)]) if len(serialized)<126 else
                b"\x7e"+len(serialized).to_bytes(2,"big"))
            connection.sendall(head+serialized)
    except Exception as exc:
        failures.append(exc)
    finally:
        listener.close()
th=threading.Thread(target=fake_edd_server)
th.start()
received=bridge.request_current_scans(port,timeout=5)
th.join(5)
assert not failures,failures
assert received["responsetype"]=="scandata"

with tempfile.TemporaryDirectory() as folder:
    ledger=surveyor.Surveyor(Path(folder)/"surveyor.sqlite3")
    cm="Wolf258"
    ledger.apply(cm,{"event":"FSDJump","timestamp":"2026-10-12T01:00:00Z",
                     "SystemAddress":int(ADDRESS),"StarSystem":NAME})
    ledger.control(cm,"start")
    before=ledger.snapshot(cm)
    assert before["expedition"]["estimate"]==0
    after=ledger.set_eddiscovery_history(cm,NAME,ADDRESS,historic)
    assert after["eddiscoveryHistory"]["estimatedHistoricalValue"]==4656532
    assert after["personallyScannedBodies"]==0
    assert after["currentSystemEstimate"] is None
    assert after["expedition"]["estimate"]==0
    again=surveyor.Surveyor(Path(folder)/"surveyor.sqlite3").snapshot(cm)
    assert again["eddiscoveryHistory"]["bodyCount"]==2
    assert again["expedition"]["estimate"]==0
    assert surveyor.Surveyor(Path(folder)/"surveyor.sqlite3").snapshot("Other CMDR")["eddiscoveryHistory"] is None
# Body Intelligence must display archived EDD data instead of a blank panel.
import sys,types
sys.modules.setdefault("tkinter",types.ModuleType("tkinter"))
sys.path.insert(0,str(ROOT.parent/"mongrel-hud"))
import mongrel_hud as hud
class DummyCanvas:
    def create_line(self,*args,**kwargs): pass
class DummyPanel:
    def __init__(self,state):
        self.state=state
        self.labels=[]
        self.titles=[]
    def scout_state(self): return self.state
    def _draw_title(self,c,title,scale,width,color=None):
        self.titles.append(title)
        return 30 * scale
    def _draw_text(self,c,x,y,value,scale,*args): self.labels.append(str(value))
    def _draw_progress(self,*args): pass
    def clip_line(self,text,count): return str(text or "")[:count]
p=DummyPanel({"exploration":again,"status":{"destination":{}}})
w,h=hud.MongrelHudApp._render_surveyor_canvas(p,DummyCanvas(),1.0,"surveyor_body")
assert p.titles==["BODY INTELLIGENCE"]
assert any("EDDISCOVERY ARCHIVE" in line for line in p.labels),p.labels
assert any("4,653,384 CR" in line for line in p.labels),p.labels
assert any("NOT NEW EXPEDITION CREDIT" in line for line in p.labels),p.labels
print("EDD bridge: WebSocket handshake, historic mapped bodies, safe accounting, Commander isolation and HUD fallback PASSED")
