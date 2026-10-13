"""Replay observed gas/FSS/footfall edge cases without Elite or network."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = root/"downloads"/"mongrel-scout"/"surveyor.py"
spec = importlib.util.spec_from_file_location("surveyor_bio_live_fixes",src)
assert spec and spec.loader
survey_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(survey_module)

def evt(kind,n,**kw):
    return {"event":kind,"timestamp":f"2026-10-13T22:{n:02}:00Z",**kw}

ADDRESS=246813579
SYSTEM="NGC 2546 Sector LX-S c17-3"
BODY=SYSTEM+" B 7"
SIG=[{"Type":"$SAA_SignalType_Biological;", "Type_Localised":"Biological","Count":1}]
GENUS="$Codex_Ent_Bacterial_Genus_Name;"
SPECIES="$Codex_Ent_Bacterial_11_Name;"

assert survey_module._bio_atmosphere("thin sulfur dioxide atmosphere")==("SO2",True)
assert survey_module._bio_atmosphere("hot thin sulphur dioxide atmosphere")==("SO2",True)
assert survey_module._bio_atmosphere("SulphurDioxide")==("SO2",None)
assert survey_module._bio_atmosphere("sulphur dioxide atmosphere")==("SO2",None)
assert survey_module._bio_atmosphere("hot thick sulphur dioxide atmosphere")==("SO2",False)
assert survey_module._bio_atmosphere("None")==("",False)
assert survey_module._bio_gas_evidence({"atmosphereType":"SulphurDioxide"}) == ("SO2",None)
assert survey_module._bio_gas_evidence({"atmosphereComposition":[{"Name":"SulphurDioxide","Percent":100}]}) == ("SO2",None)
assert survey_module._bio_gas_evidence({"atmosphere":"thin unknown atmosphere","atmosphereType":"SulphurDioxide"}) == ("SO2",True)

with tempfile.TemporaryDirectory() as folder:
    survey = survey_module.Surveyor(Path(folder)/"bio.db")
    survey.apply("Wolf",evt("FSDJump",0,SystemAddress=ADDRESS,StarSystem=SYSTEM))
    survey.apply("Wolf",evt("FSSDiscoveryScan",1,SystemAddress=ADDRESS,BodyCount=31))
    # Frontier's Scan includes belt clusters that the FSS body's 31 count
    # does not. Retain ledger events, but exclude six clusters from coverage.
    for i in range(6):
        survey.apply("Wolf",evt("Scan",2,BodyID=100+i,SystemAddress=ADDRESS,
            BodyName=SYSTEM+f" A Belt Cluster {i+1}",StarType="AsteroidCluster",
            ScanType="Detailed",WasDiscovered=False))
    for i in range(30):
        survey.apply("Wolf",evt("Scan",3,BodyID=1+i,SystemAddress=ADDRESS,
            BodyName=SYSTEM+f" {i+1}",PlanetClass="Rocky body",
            ScanType="Detailed",WasDiscovered=True,Landable=False))
    before = survey.apply("Wolf",evt("FSSBodySignals",4,
        SystemAddress=ADDRESS,BodyID=50,BodyName=BODY,Signals=SIG))
    prior_bio=before["exobiology"]["biologicalBodies"][0]
    assert prior_bio["prediction"]["ruleCoverage"]=="partial"
    assert any("atmosphere_gas" in c["missing"] for c in prior_bio["prediction"]["candidates"])

    scan=survey.apply("Wolf",evt("Scan",5,SystemAddress=ADDRESS,BodyID=50,
        BodyName=BODY,PlanetClass="Rocky body",Landable=True,ScanType="Detailed",
        Atmosphere="thin sulfur dioxide atmosphere",AtmosphereType="SulphurDioxide",
        AtmosphereComposition=[{"Name":"SulphurDioxide","Percent":100}],
        Volcanism="Silicate Vapour Geysers",SurfaceGravity=1.2,
        SurfaceTemperature=190,WasFootfalled=False,WasDiscovered=False))
    after=survey.apply("Wolf",evt("SAASignalsFound",6,SystemAddress=ADDRESS,
        BodyID=50,BodyName=BODY,Signals=SIG,
        Genuses=[{"Genus":GENUS,"Genus_Localised":"Bacterium"}]))
    bio=after["exobiology"]["biologicalBodies"][0]
    got={x["species"]:x for x in bio["prediction"]["candidates"]}
    assert set(got)=={"Bacterium Cerbrus","Bacterium Tela"},got
    assert got["Bacterium Tela"]["status"]=="compatible"
    assert got["Bacterium Tela"]["estimatedBase"]==1949000
    assert not got["Bacterium Cerbrus"]["missing"]
    assert after["knownBodies"]==31,after["knownBodies"]
    assert after["personallyScannedBodies"]==31,after["personallyScannedBodies"]
    assert after["asteroidClusterScansExcluded"]==6
    assert after["potentialFirstBodies"]==1

    # Same scan can be repeated incompletely without destroying rich data.
    retained=survey.apply("Wolf",evt("Scan",7,SystemAddress=ADDRESS,BodyID=50,
        BodyName=BODY,PlanetClass="Rocky body",Atmosphere="",ScanType="AutoScan"))
    again=retained["exobiology"]["biologicalBodies"][0]
    assert {x["species"] for x in again["prediction"]["candidates"]}==set(got)

    survey.apply("Wolf",evt("Disembark",8,SystemAddress=ADDRESS,BodyID=50,
        Body=BODY,OnPlanet=True,OnStation=False))
    snap=survey.apply("Wolf",evt("ScanOrganic",9,SystemAddress=ADDRESS,
        Body=50,ScanType="Log",Genus=GENUS,Genus_Localised="Bacterium",
        Species=SPECIES,Species_Localised="Bacterium Tela"))
    sample=snap["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]
    assert sample["samples"]==1 and sample["footfallStatus"]=="first_footfall_indicated"
    assert sample["estimatedBaseValue"]==1949000
    assert sample["firstLoggedBonusEstimate"]==7796000
    assert sample["firstLoggedTotalEstimate"]==9745000
    assert sample["bonusStatus"]=="possible_first_logged_not_guaranteed"

    # No first-footfall flag means no invented first-logged earnings.
    body2=BODY+" alt"
    survey.apply("Wolf",evt("Scan",10,SystemAddress=ADDRESS,BodyID=51,
        BodyName=body2,PlanetClass="Rocky body",ScanType="Detailed",
        AtmosphereType="SulphurDioxide",Landable=True,
        Volcanism="No volcanism",WasFootfalled=True))
    alt=survey.apply("Wolf",evt("ScanOrganic",11,SystemAddress=ADDRESS,
        Body=51,ScanType="Analyse",Genus=GENUS,Genus_Localised="Bacterium",
        Species=SPECIES,Species_Localised="Bacterium Tela"))
    row=next(b for b in alt["exobiology"]["biologicalBodies"] if b["bodyId"]=="51")
    assert row["sampledSpecies"][0]["firstLoggedBonusEstimate"] is None
    assert row["footfallStatus"]=="previous_footfall_recorded"

print("Mongrel live biology fixes PASSED: sulfur atmosphere, Bacterium Tela, 6 belts, footfall payout uncertainty")
