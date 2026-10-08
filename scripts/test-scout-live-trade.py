"""Exercise Scout's real purchase-origin tracker without importing the EDMC runtime."""
from __future__ import annotations
import ast
import json
import math
import re
import threading
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Optional

path = Path(__file__).resolve().parents[1] / "downloads/mongrel-scout/load.py"
tree = ast.parse(path.read_text(encoding="utf-8"))
want = {
    "_restore_activity_trade_provenance", "_save_activity_trade_provenance",
    "_trade_inventory_count", "_trade_lot_total", "_trade_reconcile_quantity",
    "_trade_add_lot", "_trade_consume_lots", "_observe_activity_trade",
    "_build_realtime_activity_payload", "_station_faction_name",
    "_cmdr_cache_key", "_commodity_key", "_commodity_display",
    "_optional_int", "_decimal_text",
}
functions = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in want]
missing = want - {n.name for n in functions}
assert not missing, f"Missing Scout functions: {missing}"

class Config:
    def __init__(self):
        self.values = {}
    def get_str(self, key):
        return self.values.get(key, "")
    def set(self, key, value):
        self.values[key] = value

def inventory(state):
    return "Ship", [
        {"key": re.sub(r"[^a-z0-9]+", "", str(key).casefold()), "count": count}
        for key, count in (state.get("Cargo") or {}).items()
    ]

config = Config()
scope = {
    "config": config, "Mapping": Mapping, "Any": Any, "Optional": Optional,
    "json": json, "math": math, "re": re, "threading": threading,
    "_activity_lock": threading.RLock(), "_activity_trade_lots": {},
    "_activity_trade_station": {}, "_activity_trade_commander": "",
    "_last_system_name": "Diaba", "_last_system_address": 12345,
    "KEY_ACTIVITY_TRADE_PROVENANCE": "test-trade-provenance",
    "_cargo_inventory_from_edmc_state": inventory,
}
exec(compile(ast.Module(body=functions, type_ignores=[]), str(path), "exec"), scope)
observe = scope["_observe_activity_trade"]
build = scope["_build_realtime_activity_payload"]
restore = scope["_restore_activity_trade_provenance"]

def state(qty, *, station="Niijima Station", kind="Orbis"):
    return {"SystemName": "Diaba", "StationName": station, "StationType": kind,
            "StationFaction": {"Name": "Regiment of Imperial Mongrels"},
            "Cargo": {"gold": qty} if qty else {}}

def journal(event, count=None, **extra):
    out={"event":event, "timestamp":"2026-10-08T04:00:00Z",
         "Type":"$Gold_Name;", "StarSystem":"Diaba", "SystemAddress":12345}
    if count is not None: out["Count"]=count
    out.update(extra)
    return out

def track(event, cargo, cmdr="Wolf258", **extra):
    entry=journal(event, **extra)
    return observe(cmdr,entry,cargo,"Diaba",str(cargo.get("StationName") or ""))

def restart():
    scope["_activity_trade_lots"]={}
    scope["_activity_trade_station"]={}
    scope["_activity_trade_commander"]=""
    restore()

def reset():
    scope["_activity_trade_lots"]={}
    scope["_activity_trade_station"]={}
    scope["_activity_trade_commander"]=""
    config.values.clear()

# Pure station-to-station trade, including an EDMC restart between buying and selling.
reset()
assert track("MarketBuy",state(200),Count=200) is None
assert config.values.get("test-trade-provenance"),"Origin lots must persist in local EDMC config"
restart()
sale=journal("MarketSell",Count=200,Type_Localised="Gold",
             TotalSale=32_000_000, SellPrice=160_000, AvgPricePaid=125_000)
result=observe("Wolf258",sale,state(0),"Diaba","Niijima Station")
assert result["verified"] is True and result["source"]=="station_market",result
payload=build(sale,state(0),"Diaba","Niijima Station",result)
assert payload is not None and payload["total"]-payload["avgPricePaid"]*payload["count"]==7_000_000,payload
assert payload["stationFaction"]=="Regiment of Imperial Mongrels"
assert "cmdr" not in payload and "cargo" not in payload

# Unknown cargo loaded before Scout observed the buy remains unknown, FIFO.
reset()
track("MarketBuy",state(200),Count=100)
partial=track("MarketSell",state(100),Count=100)
assert partial["verified"] is False,partial
assert build(sale,state(100),"Diaba","Niijima Station",partial) is None

# Mined and carrier-bought goods must never count as BGS trade.
reset()
track("MiningRefined",state(1))
mined=track("MarketSell",state(0),Count=1)
assert mined["source"]=="mined" and not mined["verified"]
reset()
track("MarketBuy",state(100,station="Pneuma",kind="FleetCarrier"),Count=100)
carrier=track("MarketSell",state(0),Count=100)
assert carrier["source"]=="carrier_market" and not carrier["verified"]

# Transferred/collected cargo invalidates prior provenance, not falsely credits it.
reset()
track("MarketBuy",state(100),Count=100)
track("CollectCargo",state(101),Count=1)
unknown=track("MarketSell",state(1),Count=100)
assert not unknown["verified"]
reset()
track("MarketBuy",state(100),Count=100)
track("CargoTransfer",state(100),Transfers=[{"Type":"$Gold_Name;","Count":10}])
transferred=track("MarketSell",state(0),Count=100)
assert not transferred["verified"]

# A missing post-purchase cargo inventory must not create verified origin.
reset()
unseen={"SystemName":"Diaba","StationName":"Niijima Station","StationType":"Orbis",
        "StationFaction":{"Name":"Regiment of Imperial Mongrels"}}
track("MarketBuy",unseen,Count=100)
lost=track("MarketSell",unseen,Count=100)
assert lost["verified"] is False

# No cross-Commander attribution on a shared EDMC installation.
reset()
track("MarketBuy",state(100),Count=100,cmdr="Wolf258")
other=track("MarketSell",state(0),Count=100,cmdr="Other CMDR")
assert other["verified"] is False

# Bad purchase cost or black-market sales must never be uploaded.
reset()
track("MarketBuy",state(100),Count=100)
bad=track("MarketSell",state(0),Count=100)
for overrides in ({"AvgPricePaid":0}, {"BlackMarket":True}, {"StolenGoods":True}):
    assert build({**sale,**overrides},state(0),"Diaba","Niijima Station",bad) is None
print("Scout purchase-origin, restart, FIFO, mined/carrier/transfer, privacy and sale guards passed")
