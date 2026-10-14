"""Frontier Codex biological variants and unified status-roster acceptance."""
from __future__ import annotations
import importlib.util
import tempfile
from pathlib import Path

source=Path(__file__).resolve().parents[1]/"downloads"/"mongrel-scout"/"surveyor.py"
spec=importlib.util.spec_from_file_location("codex_variant_surveyor",source)
assert spec and spec.loader
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ADDR=130094812
SYS="NGC 2546 Sector LX-S c17-3"
BODY=SYS+" B 18 a"
def evt(event,n,**k):
    return {"event":event,"timestamp":f"2026-10-14T00:{n:02}:00Z",**k}
base={"event":"CodexEntry","timestamp":"2026-10-14T00:12:00Z",
      "SystemAddress":ADDR,"BodyID":3,"EntryID":1900019,
      "Category":"$Codex_Category_Biology;",
      "SubCategory":"$Codex_SubCategory_Organic_Structures;",
      "Name":"$Codex_Ent_Bacterial_004_01_Name;",
      "Name_Localised":"Bacterium Bullaris - Gold"}
assert module._bio_codex_identity(base)==("Bacterium Bullaris","Gold")
assert module._bio_codex_identity(dict(base,Name_Localised="Bacterium Bullaris – Gold"))==("Bacterium Bullaris","Gold")
assert module._bio_codex_identity(dict(base,Name_Localised="Bacterium Bullaris"))==("Bacterium Bullaris","")
assert module._bio_codex_identity(dict(base,Name_Localised="Bacterium BullarisDoppel - Gold")) is None
assert module._bio_codex_identity(dict(base,Name_Localised="Unidentified organic colony - Gold")) is None
assert module._bio_codex_identity(dict(base,Category="$Codex_Category_Geology;")) is None
with tempfile.TemporaryDirectory() as tmp:
    survey=module.Surveyor(Path(tmp)/"db.sqlite")
    survey.apply("Wolf",evt("FSDJump",0,SystemAddress=ADDR,StarSystem=SYS))
    survey.apply("Wolf",evt("Scan",1,SystemAddress=ADDR,BodyID=3,BodyName=BODY,
        PlanetClass="Icy body",Atmosphere="thin Methane atmosphere",
        Landable=True,WasFootfalled=False))
    signal=[{"Type":"$SAA_SignalType_Biological;","Type_Localised":"Biological","Count":2}]
    snap=survey.apply("Wolf",evt("SAASignalsFound",2,SystemAddress=ADDR,BodyID=3,BodyName=BODY,
        Signals=signal,
        Genuses=[{"Genus":"$Codex_Ent_Bacterial_Genus_Name;","Genus_Localised":"Bacterium"},
                 {"Genus":"$Codex_Ent_Fonticulua_Genus_Name;","Genus_Localised":"Fonticulua"}]))
    original=snap["exobiology"]["biologicalBodies"][0]["genusOverview"]
    assert len(original)==2
    assert next(row for row in original if row["genus"]=="Bacterium")["exact"] is False
    badbody=dict(base,BodyID=7,Name_Localised="Bacterium Bullaris - Gold",timestamp="2026-10-14T00:09:00Z")
    survey.apply("Wolf",badbody)
    assert next(row for row in survey.snapshot("Wolf")["exobiology"]["biologicalBodies"] if row["bodyId"]=="3")["genusOverview"][0]["exact"] is False

    snap=survey.apply("Wolf",base)
    body=next(row for row in snap["exobiology"]["biologicalBodies"] if row["bodyId"]=="3")
    bacterial=next(row for row in body["genusOverview"] if row["genus"]=="Bacterium")
    assert bacterial["species"]=="Bacterium Bullaris"
    assert bacterial["variant"]=="Gold"
    assert bacterial["sampleStatus"]=="identified"
    assert bacterial["sampleComplete"] is False
    assert bacterial["minBase"]==bacterial["maxBase"]==1152500
    assert len(body["genusOverview"])==2
    font=next(row for row in body["genusOverview"] if row["genus"]=="Fonticulua")
    assert font["exact"] is False

    # Old Scout recorded this Codex digest but skipped the non-exact name.
    # Replaying that Codex journal line must restore the same species safely.
    with survey.lock,survey._connect() as conn:
        state=survey._load(conn,"bodies","Wolf",str(ADDR),"3")
        state.pop("bioIdentified",None)
        survey._save(conn,"bodies","Wolf",str(ADDR),state,"3")
    fixed=survey.apply("Wolf",base,historic=True)
    assert fixed is not None
    restored=next(x for x in survey.snapshot("Wolf")["exobiology"]["biologicalBodies"] if x["bodyId"]=="3")
    assert next(x for x in restored["genusOverview"] if x["genus"]=="Bacterium")["species"]=="Bacterium Bullaris"

    def organic(stage,n):
        return evt("ScanOrganic",n,SystemAddress=ADDR,Body=3,ScanType=stage,
            Genus="$Codex_Ent_Bacterial_Genus_Name;",Genus_Localised="Bacterium",
            Species="$Codex_Ent_Bacterial_Bullaris_Name;",Species_Localised="Bacterium Bullaris")
    for stage,n in (("Log",15),("Sample",16),("Analyse",17)):
        snap=survey.apply("Wolf",organic(stage,n))
    body=next(x for x in snap["exobiology"]["biologicalBodies"] if x["bodyId"]=="3")
    rows=body["genusOverview"]
    assert len(rows)==2 and len(body["sampledSpecies"])==1
    complete=next(x for x in rows if x["genus"]=="Bacterium")
    assert complete["exact"] and complete["sampleStatus"]=="completed"
    assert complete["sampleComplete"] is True
    assert complete["minBase"]==1152500
    assert survey.snapshot("Wolf")["expedition"]["exobiology"]["completedSpecies"]==0
print("Bacterium Bullaris - Gold Codex, stored replay, body-specific identification, and completed-roster state PASSED")
