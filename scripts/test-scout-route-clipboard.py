"""Isolated local neutron waypoint auto-copy regression test, without EDMC or Windows."""
from __future__ import annotations
import importlib.util
import sys
import types
from pathlib import Path

class Config:
    values = {}
    def get_int(self,key): return self.values.get(key,0)
    def get_bool(self,key): return bool(self.get_int(key))
    def get_str(self,key): return ""
    def set(self,key,value): self.values[key] = value

config = Config()
tk = types.ModuleType("tkinter")
for name in ("Label","Frame","IntVar","StringVar"):
    setattr(tk,name,type(name,(),{}))
tk.TclError = RuntimeError
sys.modules["tkinter"] = tk
sys.modules["myNotebook"] = types.ModuleType("myNotebook")
sys.modules["timeout_session"] = types.SimpleNamespace(new_session=lambda timeout=8: object())
sys.modules["config"] = types.SimpleNamespace(config=config)
sys.modules["monitor"] = types.SimpleNamespace(monitor=None)

path=Path(__file__).resolve().parents[1]/"downloads/mongrel-scout/load.py"
spec=importlib.util.spec_from_file_location("route_clipboard_scout",path)
scout=importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(scout)

class FakeWidget:
    def __init__(self):
        self.clipboard=""
        self.copies=[]
    def after(self,wait,fn):
        assert wait==0
        fn()
    def clipboard_clear(self): self.clipboard=""
    def clipboard_append(self,value):
        self.clipboard+=value
        self.copies.append(value)
    def update_idletasks(self): pass

widget=FakeWidget()
scout._status_label=widget
route={
    "id":"route-example",
    "ship":"Leaf On the Wind",
    "destination":"Diaba",
    "autoCopy":True,
    "routeType":"neutron_replot_waypoints",
    "estimatedTotalJumps":13,
    "waypoints":[
        {"system":"NGC 2546 Sector UZ-G d10-16"},
        {"system":"TEST NEUTRON A"},
        {"system":"Diaba"},
    ],
}
scout._hud_state["ship"]={"name":"Leaf On the Wind"}
scout._hud_state["system"]={"name":"NGC 2546 Sector UZ-G d10-16"}
scout._hud_state["siteFeed"]={"navigationRoute":route}
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A"],widget.copies
assert scout._hud_state["navigation"]["nextSystem"]=="TEST NEUTRON A"
assert scout._hud_state["navigation"]["routeType"]=="neutron_replot_waypoints"
assert scout._hud_state["navigation"]["estimatedTotalJumps"]==13
assert scout._hud_state["navigation"]["navigationTargetCount"]==2

# Normal polling must never overwrite the clipboard with the same waypoint.
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A"],widget.copies

# A regular intermediate FSD jump does not mean the next neutron waypoint was reached.
scout._hud_state["system"]={"name":"INTERMEDIATE SYSTEM"}
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A"],widget.copies

# Reaching the actual target copies exactly the next navigation entry.
scout._hud_state["system"]={"name":"TEST NEUTRON A"}
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A","Diaba"],widget.copies
assert scout._hud_state["navigation"]["nextSystem"]=="Diaba"

# An arbitrary jump may not skip past the next requested waypoint.
scout._hud_state["system"]={"name":"UNPLANNED SYSTEM"}
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A","Diaba"]

# Explicit cancel immediately clears state and suppresses further copy.
scout._hud_state["siteFeed"]={"navigationRoute":None}
scout._refresh_route_navigation()
assert scout._hud_state["navigation"] is None

# Reactivating the same route must recopy the first waypoint after cancel.
scout._hud_state["system"]={"name":"NGC 2546 Sector UZ-G d10-16"}
scout._hud_state["siteFeed"]={"navigationRoute":route}
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A","Diaba","TEST NEUTRON A"],widget.copies
scout._hud_state["siteFeed"]={"navigationRoute":None}
scout._refresh_route_navigation()

# A route for the wrong ship cannot take control of clipboard.
scout._hud_state["system"]={"name":"NGC 2546 Sector UZ-G d10-16"}
scout._hud_state["ship"]={"name":"Different Ship"}
scout._hud_state["siteFeed"]={"navigationRoute":route}
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A","Diaba","TEST NEUTRON A"]
assert scout._hud_state["navigation"]["active"] is False

# Commander can disable the optional clipboard behavior in EDMC preferences.
scout._hud_state["ship"]={"name":"Leaf On the Wind"}
config.set(scout.KEY_NAV_AUTO_COPY,-1)
scout._refresh_route_navigation()
assert widget.copies==["TEST NEUTRON A","Diaba","TEST NEUTRON A"]
assert scout._hud_state["navigation"]["autoCopyEnabled"] is False

# A deferred UI copy must not fire after cancellation, even if Tk hasn't run
# the queued callback yet. This can happen during normal site feed refreshes.
class DeferredWidget(FakeWidget):
    def __init__(self):
        super().__init__()
        self.callbacks=[]
    def after(self,wait,fn):
        assert wait==0
        self.callbacks.append(fn)

deferred=DeferredWidget()
scout._status_label=deferred
config.set(scout.KEY_NAV_AUTO_COPY,0)
scout._hud_state["siteFeed"]={"navigationRoute":None}
scout._refresh_route_navigation()
scout._hud_state["siteFeed"]={"navigationRoute":route}
scout._refresh_route_navigation()
assert len(deferred.callbacks)==1
scout._hud_state["siteFeed"]={"navigationRoute":None}
scout._refresh_route_navigation()
for callback in deferred.callbacks:
    callback()
assert deferred.copies==[],deferred.copies

print("Scout neutron route clipboard progression, reactivation and cancellation checks passed")
