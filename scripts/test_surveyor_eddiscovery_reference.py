"""Golden exploration valuation benchmarks against EDDiscovery's Apache-2.0 model.

Uses locally known EDDiscovery examples and stable source formula invariants.
No internet, Frontier journal replay or EDDiscovery installation required.
"""
from __future__ import annotations
from pathlib import Path
import importlib.util

source = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-scout" / "surveyor.py"
spec = importlib.util.spec_from_file_location("surveyor_reference",source)
assert spec and spec.loader
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)

# User's EDDiscovery screenshot (2026-10-13):
# OY-P c19-2 water world #1, candidate for terraforming, mass 1.9029 EM.
# EDD current mapped value 4,653,384 CR; displayed mass is rounded to 4dp.
water = {"planetClass":"Water world","massEM":1.9029,
         "terraformState":"Candidate for terraforming",
         "wasDiscovered":False,"wasMapped":False}
assert model._value(water,False,False) == 774029, model._value(water,False,False)
assert abs(model._value(water,True,True) - 4653384) <= 15, model._value(water,True,True)
assert 297700 <= model._value({**water,"wasDiscovered":True},False,False) <= 297709

# Frontier's Sudarsky naming must resolve identically to EDDiscovery's table.
for roman in ("I","II"):
    expected = {"planetClass":f"Class {roman} gas giant","massEM":300,
                "wasDiscovered":False,"wasMapped":False}
    journal = {**expected,"planetClass":f"Sudarsky class {roman} gas giant"}
    for ismap in (False,True):
        for efficient in (False,True):
            assert model._value(expected,ismap,efficient)==model._value(journal,ismap,efficient)
    assert model._value(journal,False,False) > model._value(
        {**journal,"planetClass":"Icy body"},False,False)
# Historical/older journals often omit mass and/or first flags.
assert model._value({"planetClass":"Icy body"},False,False)==500
assert model._value({"starType":"K"},False,False)==1218
assert model._value({"starType":"K","wasDiscovered":False},False,False)==3167
# EDDiscovery's rare PR31 first-discovered=false, prior mapped=true corner case.
weird={"planetClass":"Water world","massEM":1.2,
       "wasDiscovered":False,"wasMapped":True}
base=model._value({**weird,"wasDiscovered":True},False,False)
assert model._value(weird,False,False)>base
assert model._value(weird,True,True)<model._value(
    {**weird,"wasMapped":False},True,True)
print("EDDiscovery-equivalent valuation: screenshot ELW/WW case, Sudarsky classes, missing mass and PR31 flags PASSED")
