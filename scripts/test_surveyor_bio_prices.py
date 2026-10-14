"""Complete published Vista price table independently of habitat-prediction coverage.

Also verifies that older completed samples/expedition credits with unknown
stored amounts are revalued from the updated local catalog without replaying
Frontier journals or changing confirmed historical Vista sale records.
"""
from __future__ import annotations

import importlib.util
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "downloads/mongrel-scout/surveyor.py"
spec = importlib.util.spec_from_file_location("surveyor_complete_vista_prices", source)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert len(module.BIO_REFERENCE_VALUES) == 96, len(module.BIO_REFERENCE_VALUES)
assert len(module.BIO_HABITAT_RULES) == 61, "Prices must not depend on habitat model coverage"
assert module.BIO_PRICE_SOURCE == "https://ed-dsn.net/en/vista-genomics-values/"
expected_new = {
    "Amphora plant": 1628800, "Anemone": 1499900, "Bacterium Omentum": 4638900,
    "Bacterium Scopulum": 4934500, "Bacterium Verrata": 3897000,
    "Bacterium Volu": 7774700, "Bark Mounds": 1471900, "Brain Tree": 1593700,
    "Concha Aureolas": 7774700, "Concha Biconcavis": 19010800,
    "Concha Labiata": 2352400, "Concha Renibus": 4572400,
    "Crystalline Shards": 1628800, "Electricae Radialem": 6284600,
    "Fonticulua Campestris": 1000000, "Fonticulua Digitos": 1804100,
    "Fonticulua Fluctus": 20000000, "Fonticulua Lapida": 3111000,
    "Fonticulua Segmentatus": 19010800, "Fonticulua Upupam": 5727600,
    "Frutexa Acus": 7774700, "Frutexa Collum": 1639800, "Frutexa Fera": 1632500,
    "Frutexa Flabellum": 1808900, "Frutexa Flammasis": 10326000,
    "Frutexa Metallicum": 1632500, "Frutexa Sponsae": 5988000,
    "Fumerola Aquatis": 6284600, "Fumerola Carbosis": 6284600,
    "Fumerola Extremus": 16202800, "Fumerola Nitris": 7500900,
    "Recepta Conditivus": 14313700, "Recepta Deltahedronix": 16202800,
    "Recepta Umbrux": 12934900, "Sinuous Tubers": 1514500,
}
assert len(expected_new) == 35
assert all(module.BIO_REFERENCE_VALUES.get(name) == price for name, price in expected_new.items())
assert module.BIO_REFERENCE_VALUES["Stratum Tectonicas"] == 19010800
assert module.BIO_REFERENCE_VALUES["Osseus Fractus"] == 4027800

def stamp(delta):
    return (datetime.now(timezone.utc)+timedelta(minutes=delta)).strftime("%Y-%m-%dT%H:%M:%SZ")

def evt(kind, delta, **fields):
    return {"event":kind, "timestamp":stamp(delta), **fields}

address=786542349
system="Price Coverage System"
bodyname=system+" 2"
with tempfile.TemporaryDirectory() as temp:
    survey = module.Surveyor(Path(temp)/"ledger.sqlite3")
    survey.apply("Wolf",evt("FSDJump",-15,SystemAddress=address,StarSystem=system))
    survey.apply("Wolf",evt("Scan",-12,SystemAddress=address,BodyID=2,BodyName=bodyname,
        PlanetClass="Icy body",Landable=True,Atmosphere="thin Methane atmosphere",
        SurfaceTemperature=100,SurfaceGravity=1.0))
    snap=survey.apply("Wolf",evt("SAASignalsFound",-10,SystemAddress=address,
        BodyID=2,BodyName=bodyname,
        Signals=[{"Type":"$SAA_SignalType_Biological;","Type_Localised":"Biological","Count":2}],
        Genuses=[{"Genus":"$Codex_Fonticulua;","Genus_Localised":"Fonticulua"},
                 {"Genus":"$Codex_Bacterium;","Genus_Localised":"Bacterium"}]))
    body=snap["exobiology"]["biologicalBodies"][0]
    font=next(row for row in body["genusOverview"] if row["genus"]=="Fonticulua")
    assert not font["exact"] and font["rangeCoverage"]=="unfiltered_published_genus",font
    assert (font["minBase"],font["maxBase"]) == (1000000,20000000),font
    assert len(body["genusOverview"]) == 2
    assert all(r["genus"] in {"Bacterium","Fonticulua"} for r in body["genusOverview"])

    start=survey.control("Wolf","start")
    assert start["expedition"]["exobiology"]["completedSpecies"]==0
    args=dict(SystemAddress=address,Body=2,
        Genus="$Codex_Fonticulua_Genus_Name;",Genus_Localised="Fonticulua",
        Species="$Codex_Fonticulua_Digitos_Name;",Species_Localised="Fonticulua Digitos")
    survey.apply("Wolf",evt("ScanOrganic",1,ScanType="Log",**args))
    survey.apply("Wolf",evt("ScanOrganic",2,ScanType="Sample",**args))
    snap=survey.apply("Wolf",evt("ScanOrganic",3,ScanType="Analyse",**args))
    organism=snap["exobiology"]["biologicalBodies"][0]
    rec=organism["sampledSpecies"][0]
    assert rec["completed"] and rec["estimatedBaseValue"]==1804100
    font=next(row for row in organism["genusOverview"] if row["genus"]=="Fonticulua")
    assert font["exact"] and font["minBase"]==font["maxBase"]==1804100
    assert snap["expedition"]["exobiology"]["estimatedBase"]==1804100

    # Simulate a price-unknown sample from the PREVIOUS installed Scout.
    with survey.lock,survey._connect() as conn:
        stored=survey._load(conn,"bodies","Wolf",str(address),"2")
        specimen=stored["bioSamples"]["$Codex_Fonticulua_Digitos_Name;"]
        specimen["estimatedBaseValue"]=None
        specimen["valuationSource"]="unknown"
        survey._save(conn,"bodies","Wolf",str(address),stored,"2")
        conn.execute("UPDATE expedition_bio_credits SET base=NULL WHERE body_id='2'")
    recovered=module.Surveyor(Path(temp)/"ledger.sqlite3").snapshot("Wolf")
    sample=recovered["exobiology"]["biologicalBodies"][0]["sampledSpecies"][0]
    assert sample["estimatedBaseValue"]==1804100
    assert sample["valuationSource"]==module.BIO_REFERENCE_MODEL
    assert recovered["expedition"]["exobiology"]["estimatedBase"]==1804100
    assert recovered["expedition"]["exobiology"]["uncertainValues"]==0
    assert recovered["expedition"]["exobiology"]["completedSpecies"]==1
    assert recovered["exobiology"]["confirmedSalesLifetime"]==0
    assert recovered["expedition"]["exobiology"]["confirmedVistaSales"]==0

print("Published 96-species Vista catalog, Fonticulua DSS ranges, sampling and old-price backfill PASSED")
