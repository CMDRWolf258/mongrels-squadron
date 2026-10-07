from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "downloads" / "mongrel-hud"))

import ax_intel as ax

assert ax.AX_DATA_REVIEWED_AT == "2026-10-06"

basilisk = ax.variant_spec("basilisk")
assert basilisk
assert basilisk["hearts"] == 5
assert basilisk["topSpeedMps"] == 530
assert basilisk["swarmSize"] == 64
assert basilisk["enrageSeconds"] == 420
assert basilisk["shieldDecaySeconds"] == 180
assert basilisk["killReward"] == 24_000_000
assert basilisk["optimalMediumGaussHeartShots"] == 4
assert basilisk["exertionHullPercentByHeart"] == [20, 16, 14, 10, 8]

hydra = ax.variant_spec("hydra")
assert hydra
assert hydra["hearts"] == 8
assert hydra["swarmSize"] == 128
assert hydra["enrageSeconds"] == 480
assert hydra["shieldDecaySeconds"] == 320
assert hydra["optimalMediumGaussHeartShots"] == 13

assert ax.resolve_ax_variant({"pilotName": "Thargoid Basilisk"})["id"] == "basilisk"
assert ax.resolve_ax_variant({"ship": "Thargoid Interceptor"})["id"] == "interceptor-unknown"
assert ax.resolve_ax_variant({"ship": "Fer-de-Lance"}) is None
assert ax.resolve_ax_variant({}, "medusa")["id"] == "medusa"

settings = ax.normalize_ax_settings({
    "variantOverride": "HYDRA",
    "coldHeatPercent": 2,
    "orbitMinM": 1200,
    "orbitMaxM": 800,
    "shipBoostMps": 512,
})
assert settings["variantOverride"] == "hydra"
assert settings["coldHeatPercent"] == 5
assert settings["orbitMinM"] == 1200
assert settings["orbitMaxM"] == 1200
assert settings["shipBoostMps"] == 512

speed = ax.compare_speed(basilisk, 512)
assert speed
assert speed["canOutrun"] is False
assert speed["marginMps"] == -18
assert speed["label"] == "CANNOT OUTRUN"

encounter = ax.new_encounter("basilisk", 100.0, source="manual")
snap = ax.encounter_snapshot(encounter, 100.0)
assert snap
assert snap["heartsRemaining"] == 5
assert snap["enrageRemainingSeconds"] == 420
assert snap["nextExertionHullPercent"] == 20
assert snap["shutdownNextHeart"] is False

encounter = ax.apply_encounter_action(encounter, "heart_exerted", 150.0)
snap = ax.encounter_snapshot(encounter, 160.0)
assert snap["phase"] == "heart_exerted"
assert snap["heartWindowRemainingSeconds"] == 35

# First heart down starts the shield phase and a fresh per-heart enrage clock.
encounter = ax.apply_encounter_action(encounter, "heart_down", 170.0)
snap = ax.encounter_snapshot(encounter, 180.0)
assert snap["heartsRemaining"] == 4
assert snap["shieldRemainingSeconds"] == 170
assert snap["enrageRemainingSeconds"] == 410
assert snap["nextExertionHullPercent"] == 16

# With two hearts remaining, the next heart kill is the second-to-last heart.
encounter = ax.apply_encounter_action(encounter, "shield_down", 350.0)
encounter = ax.apply_encounter_action(encounter, "heart_exerted", 360.0)
encounter = ax.apply_encounter_action(encounter, "heart_down", 370.0)
encounter = ax.apply_encounter_action(encounter, "shield_down", 550.0)
encounter = ax.apply_encounter_action(encounter, "heart_exerted", 560.0)
encounter = ax.apply_encounter_action(encounter, "heart_down", 570.0)
snap = ax.encounter_snapshot(encounter, 571.0)
assert snap["heartsRemaining"] == 2
assert snap["shutdownNextHeart"] is True
assert snap["shutdownExpected"] is False

encounter = ax.apply_encounter_action(encounter, "shield_down", 750.0)
encounter = ax.apply_encounter_action(encounter, "heart_exerted", 760.0)
encounter = ax.apply_encounter_action(encounter, "heart_down", 770.0)
snap = ax.encounter_snapshot(encounter, 771.0)
assert snap["heartsRemaining"] == 1
assert snap["shutdownExpected"] is True

# Final heart ends the standard shield/enrage loop.
encounter = ax.apply_encounter_action(encounter, "shield_down", 950.0)
encounter = ax.apply_encounter_action(encounter, "heart_exerted", 960.0)
encounter = ax.apply_encounter_action(encounter, "heart_down", 970.0)
snap = ax.encounter_snapshot(encounter, 971.0)
assert snap["heartsRemaining"] == 0
assert snap["phase"] == "finish"
assert snap["enrageRemainingSeconds"] is None
assert snap["shieldRemainingSeconds"] is None

assert ax.variant_spec("orthrus")["hearts"] == 0
assert ax.variant_spec("glaive")["antiGuardianField"] is True
assert ax.variant_spec("glaive")["topSpeedMps"] == 750

print("✓ Experimental AX HUD reference data, manual phase state, timers and shutdown logic are coherent")
