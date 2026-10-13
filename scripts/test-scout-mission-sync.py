"""No-network acceptance for cross-PC Scout mission sync and local retry queue."""
from __future__ import annotations
import importlib.util,json,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('local_mission_sync',ROOT/'downloads/mongrel-scout/mission_sync.py')
assert spec and spec.loader
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
MissionSync=module.MissionSync

def clock(minutes):
    return (datetime.now(timezone.utc)-timedelta(minutes=minutes)).isoformat().replace('+00:00','Z')
m1={"missionId":7582,"name":"Mission_Collect","localisedName":"Collect Gold",
    "commodity":"gold","commodityName":"Gold","faction":"The Consortium",
    "count":120,"delivered":0,"acceptedAt":clock(40),"updatedAt":clock(40)}
m2={**m1,"missionId":7583,"count":46}
local={"wolf258":[m1,m2]}
central={}
pending=[""]
hydrated=[]
def fake_request(method,commander,token,operations=None):
    assert token=="mscout-test"
    if method=="GET":
        return {"ok":True,"missions":[row["mission"] for row in central.values()
                                         if row.get("mission") and not row.get("closed")]}
    for op in operations or []:
        mid=str(op["missionId"])
        old=central.get(mid)
        if old and old.get("closed"):continue
        if op["kind"]=="closed":
            central[mid]={"closed":True}
        elif not old or op["occurredAt"]>=old.get("occurredAt",""):
            central[mid]=dict(op)
    return {"ok":True,"accepted":len(operations or [])}
client=MissionSync(lambda:"mscout-test",lambda:pending[0],
                   lambda data: pending.__setitem__(0,data),
                   lambda cmdr:local.get(cmdr,[]),
                   lambda cmdr,rows,ids:hydrated.append((cmdr,rows,ids)))
client._request=fake_request
event=lambda kind,when,**extras:{"event":kind,"timestamp":when,**extras}
# Laptop already has a mission cache; Frontier Active IDs prove which ones
# are still live before the upload bootstrap.
client.observe("Wolf258",event("Missions",clock(1),Active=[{"MissionID":7582},{"MissionID":7583}]),local["wolf258"])
assert len(client.pending)==2
assert client.sync_once()
assert set(central)=={"7582","7583"}
assert len(hydrated)==1 and len(hydrated[0][1])==2
assert all(str(m["missionId"]) in hydrated[0][2] for m in hydrated[0][1])
# Separate computer begins with no local journal records; receives only
# MissionIDs Elite currently marks active on this PC.
other=MissionSync(lambda:"mscout-test",lambda:"{}",lambda _:None,
                  lambda _:[],lambda cmdr,rows,ids:hydrated.append((cmdr,rows,ids)))
other._request=fake_request
other.observe("Wolf258",event("Missions",clock(0),Active=[{"MissionID":7582}]),[])
assert other.sync_once()
assert hydrated[-1][2]=={"7582"}
assert len(hydrated[-1][1])==2  # Receiver filters by its active IDs.
# Delivery and closure upload on original machine; no live cargo from cloud.
partial={**m1,"delivered":45,"updatedAt":clock(0)}
local["wolf258"]=[partial,m2]
client.observe("Wolf258",event("CargoDepot",clock(0),MissionID=7582),local["wolf258"])
assert client.sync_once()
assert central["7582"]["mission"]["delivered"]==45
client.observe("Wolf258",event("MissionCompleted",clock(0),MissionID=7582),[m2])
assert client.sync_once()
assert central["7582"]["closed"]
# Network interruption persists pending closure; restart retries the same
# event and never converts it back into an active mission.
client.observe("Wolf258",event("MissionAbandoned",clock(0),MissionID=7583),[])
assert json.loads(pending[0])
restarted=MissionSync(lambda:"mscout-test",lambda:pending[0],
                      lambda data:pending.__setitem__(0,data),
                      lambda _:[],lambda *_:None)
restarted._request=fake_request
assert restarted.sync_once()
assert central["7583"]["closed"] and restarted.pending=={}
# Incoming invalid missions remain outside transport and accounting models.
assert client.is_active("Wolf258",7582) is False
assert other.is_active("Wolf258",7582) is True
assert module.stamp("not-a-time")==""
assert module.mission_id(None) is None
print("Scout mission cross-PC client acceptance PASSED (bootstrap, active IDs, retry, tombstones)")
