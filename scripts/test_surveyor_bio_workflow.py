"""DSS roster, composition Codex, active-only samples and expedition bio accounting."""
from __future__ import annotations
import importlib.util
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "downloads/mongrel-scout/surveyor.py"
spec = importlib.util.spec_from_file_location("surveyor_bio_workflow_test", source)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

ADDR=135791113
SYSTEM="Bio workflow"
BODY=SYSTEM+" 8"
GENERA=["Fungoida","Osseus","Stratum","Tussock","Bacterium"]
def stamp(n):
    return (datetime.now(timezone.utc)+timedelta(minutes=n)).strftime("%Y-%m-%dT%H:%M:%SZ")
def evt(kind,n,**kwargs):
    return {"event":kind,"timestamp":stamp(n),**kwargs}
def organic(kind,n,genus,species,identity):
    return evt("ScanOrganic",n,SystemAddress=ADDR,Body=8,ScanType=kind,
        Genus=f"$Codex_{genus};",Genus_Localised=genus,
        Species=f"$Codex_{identity};",Species_Localised=species)
def biological(snapshot):
    return snapshot["exobiology"]["biologicalBodies"][0]

with tempfile.TemporaryDirectory() as tmp:
    s=module.Surveyor(Path(tmp)/"expedition.sqlite")
    s.apply("Wolf",evt("FSDJump",-8,SystemAddress=ADDR,StarSystem=SYSTEM))
    s.apply("Wolf",evt("Scan",-7,SystemAddress=ADDR,BodyID=8,BodyName=BODY,
        PlanetClass="Rocky body",Landable=True,Atmosphere="thin Carbon dioxide atmosphere",
        Volcanism="No volcanism",SurfaceGravity=1.0,SurfaceTemperature=190,
        WasFootfalled=False))
    signals=[{"Type":"$SAA_SignalType_Biological;","Type_Localised":"Biological","Count":5}]
    s.apply("Wolf",evt("SAASignalsFound",-6,SystemAddress=ADDR,BodyID=8,
        BodyName=BODY,Signals=signals,
        Genuses=[{"Genus":f"$Codex_{g};","Genus_Localised":g} for g in GENERA]))
    base=biological(s.snapshot("Wolf"))
    overview=base["genusOverview"]
    assert [g["genus"] for g in overview]==sorted(GENERA)
    fung=next(g for g in overview if g["genus"]=="Fungoida")
    assert fung["exact"] is False and fung["minBase"]==2680300 and fung["maxBase"]==3330300
    assert all(g["genus"] in GENERA for g in overview) and len(overview)==5

    # Composition/Codex exact id only with correct BodyID, Biology, model name.
    bad=evt("CodexEntry",-5,SystemAddress=ADDR,BodyID=8,Category="$Codex_Category_Geology;",
            Name_Localised="Fungoida Gelata")
    s.apply("Wolf",bad)
    assert next(g for g in biological(s.snapshot("Wolf"))["genusOverview"] if g["genus"]=="Fungoida")["exact"] is False
    codex=evt("CodexEntry",-4,SystemAddress=ADDR,BodyID=8,Category="$Codex_Category_Biology;",
              Name_Localised="Fungoida Gelata")
    s.apply("Wolf",codex)
    spotted=next(g for g in biological(s.snapshot("Wolf"))["genusOverview"] if g["genus"]=="Fungoida")
    assert spotted["exact"] is True and spotted["species"]=="Fungoida Gelata"
    assert spotted["minBase"]==spotted["maxBase"]==3330300
    assert s.apply("Wolf",codex) is None

    # Historical scans and Codex identification cannot earn new expedition CR.
    assert s.snapshot("Wolf")["expedition"]["exobiology"]["estimatedBase"]==0
    start=s.control("Wolf","start")
    assert start["expedition"]["exobiology"]["completedSpecies"]==0
    s.apply("Wolf",evt("Disembark",1,SystemAddress=ADDR,BodyID=8,Body=BODY,OnPlanet=True))
    first=biological(s.apply("Wolf",organic("Log",2,"Osseus","Osseus Fractus","O1")))
    assert first["activeSpeciesId"]=="$Codex_O1;"
    assert len(first["sampledSpecies"])==1 and first["sampledSpecies"][0]["samples"]==1
    second=biological(s.apply("Wolf",organic("Sample",3,"Osseus","Osseus Fractus","O1")))
    assert second["sampledSpecies"][0]["samples"]==2

    # Switching samples discards the earlier partial, but never completed data.
    switch=biological(s.apply("Wolf",organic("Log",4,"Stratum","Stratum Excutitus","S1")))
    assert switch["activeSpeciesId"]=="$Codex_S1;"
    assert [x["species"] for x in switch["sampledSpecies"]]==["Stratum Excutitus"]
    assert switch["sampledSpecies"][0]["samples"]==1
    s.apply("Wolf",organic("Sample",5,"Stratum","Stratum Excutitus","S1"))
    complete=biological(s.apply("Wolf",organic("Analyse",6,"Stratum","Stratum Excutitus","S1")))
    assert complete["activeSpeciesId"]==""
    assert len(complete["sampledSpecies"])==1 and complete["sampledSpecies"][0]["completed"]
    assert s.snapshot("Wolf")["expedition"]["exobiology"]["estimatedBase"]==2448900
    assert s.snapshot("Wolf")["expedition"]["exobiology"]["completedSpecies"]==1

    s.apply("Wolf",organic("Log",7,"Osseus","Osseus Fractus","O1"))
    s.apply("Wolf",organic("Sample",8,"Osseus","Osseus Fractus","O1"))
    final=s.apply("Wolf",organic("Analyse",9,"Osseus","Osseus Fractus","O1"))
    body=biological(final)
    assert body["activeSpeciesId"]==""
    assert len(body["sampledSpecies"])==2 and all(x["completed"] for x in body["sampledSpecies"])
    bio=final["expedition"]["exobiology"]
    assert bio["completedSpecies"]==2 and bio["estimatedBase"]==6476700,bio
    assert bio["potentialFirstLoggedBonus"]==4*6476700
    assert bio["potentialTotal"]==5*6476700
    assert s.apply("Wolf",organic("Analyse",9,"Osseus","Osseus Fractus","O1")) is None
    assert s.snapshot("Wolf")["expedition"]["exobiology"]["completedSpecies"]==2

    sale=evt("SellOrganicData",10,BioData=[
        {"Species_Localised":"Stratum Excutitus","Value":2448900,"Bonus":9795600}])
    snap=s.apply("Wolf",sale)
    bio=snap["expedition"]["exobiology"]
    assert bio["confirmedVistaSales"]==12244500
    assert bio["estimatedBase"]==6476700
    assert s.apply("Wolf",sale) is None
    assert s.snapshot("Wolf")["expedition"]["exobiology"]["confirmedVistaSales"]==12244500
    assert module.Surveyor(Path(tmp)/"expedition.sqlite").snapshot("Wolf")["expedition"]["exobiology"]["estimatedBase"]==6476700
    assert s.snapshot("Other")["expedition"]["exobiology"]["completedSpecies"]==0

    s.control("Wolf","end")
    fresh=s.control("Wolf","start")["expedition"]["exobiology"]
    assert fresh["completedSpecies"]==0 and fresh["estimatedBase"]==0
    assert fresh["confirmedVistaSales"]==0

print("Exobiology specimen lifecycle, DSS roster, Codex exact species, expedition ledger and sales PASSED")
