from __future__ import annotations

from copy import deepcopy
from typing import Any

# Experimental AX combat intelligence data for MongrelHUD.
#
# Source baseline: Anti-Xeno Initiative Wiki, reviewed 2026-10-06:
# - https://wiki.antixenoinitiative.com/en/thargoid-specs
# - https://wiki.antixenoinitiative.com/en/shields
# - https://wiki.antixenoinitiative.com/en/hearts
# - https://wiki.antixenoinitiative.com/en/special-attacks
#
# Keep this module pure/local. Static AX reference data must never require a
# network request during combat.

AX_DATA_REVIEWED_AT = "2026-10-06"
HEART_EXERTION_WINDOW_SECONDS = 45
COLD_HEAT_THRESHOLD_PERCENT = 20
LIGHTNING_ATTACH_RANGE_M = (700, 800)
SPECIAL_ATTACK_AVOID_RANGE_M = 3000
QUEUED_SHUTDOWN_ESCAPE_RANGE_M = 10000

AX_VARIANTS: dict[str, dict[str, Any]] = {
    "cyclops": {
        "id": "cyclops",
        "name": "Cyclops",
        "family": "interceptor",
        "hearts": 4,
        "topSpeedMps": 450,
        "swarmSize": 32,
        "enrageSeconds": 360,
        "shieldDecaySeconds": 95,
        "killReward": 8_000_000,
        "totalHpApprox": 800,
        "heartHpApprox": 38,
        "armorRating": 100,
        "humanWeaponResistancePercent": 99,
        "lightningSeconds": 8,
        "lightningDamageApprox": 800,
        "optimalMediumGaussHeartShots": 3,
        "exertionHullPercentByHeart": [20, 16, 12, 8],
        "tags": ["INTERCEPTOR"],
        "tacticalNotes": [
            "Lowest interceptor durability; ideal training target.",
            "EMP attempt follows destruction of the second-to-last heart.",
            "After each heart, expect lightning chase and shield phase unless kept cold/asleep.",
        ],
    },
    "basilisk": {
        "id": "basilisk",
        "name": "Basilisk",
        "family": "interceptor",
        "hearts": 5,
        "topSpeedMps": 530,
        "swarmSize": 64,
        "enrageSeconds": 420,
        "shieldDecaySeconds": 180,
        "killReward": 24_000_000,
        "totalHpApprox": 1800,
        "heartHpApprox": 70,
        "armorRating": 140,
        "humanWeaponResistancePercent": 99,
        "lightningSeconds": 10,
        "lightningDamageApprox": 1700,
        "optimalMediumGaussHeartShots": 4,
        "exertionHullPercentByHeart": [20, 16, 14, 10, 8],
        "tags": ["INTERCEPTOR", "FASTEST INTERCEPTOR"],
        "tacticalNotes": [
            "530 m/s makes normal disengagement harder; many AX ships cannot simply outrun it.",
            "Boost-passing can be required to create separation from the interceptor and swarm.",
            "EMP attempt follows destruction of the second-to-last heart.",
        ],
    },
    "medusa": {
        "id": "medusa",
        "name": "Medusa",
        "family": "interceptor",
        "hearts": 6,
        "topSpeedMps": 450,
        "swarmSize": 96,
        "enrageSeconds": 420,
        "shieldDecaySeconds": 240,
        "killReward": 40_000_000,
        "totalHpApprox": 2500,
        "heartHpApprox": 70,
        "armorRating": 170,
        "humanWeaponResistancePercent": 99,
        "lightningSeconds": 12,
        "lightningDamageApprox": 2800,
        "optimalMediumGaussHeartShots": 5,
        "exertionHullPercentByHeart": [20, 17, 15, 12, 10, 7],
        "tags": ["INTERCEPTOR", "RING SWARMS"],
        "tacticalNotes": [
            "Large 96-Thargon swarm; ring formations make flak work less forgiving.",
            "Longer four-minute passive shield decay creates a larger recovery/synthesis window.",
            "EMP attempt follows destruction of the second-to-last heart.",
        ],
    },
    "hydra": {
        "id": "hydra",
        "name": "Hydra",
        "family": "interceptor",
        "hearts": 8,
        "topSpeedMps": 450,
        "swarmSize": 128,
        "enrageSeconds": 480,
        "shieldDecaySeconds": 320,
        "killReward": 60_000_000,
        "totalHpApprox": 3200,
        "heartHpApprox": 140,
        "armorRating": 220,
        "humanWeaponResistancePercent": 99,
        "lightningSeconds": 14,
        "lightningDamageApprox": 4400,
        "optimalMediumGaussHeartShots": 13,
        "exertionHullPercentByHeart": [20, 18, 16, 14, 12, 10, 8, 6],
        "tags": ["INTERCEPTOR", "HEAVIEST COMBAT VARIANT", "RING SWARMS"],
        "tacticalNotes": [
            "Eight hearts and 128-Thargon swarm make fight-state tracking especially valuable.",
            "Five-minute-twenty-second passive shield decay is the longest standard interceptor shield phase.",
            "EMP attempt follows destruction of the second-to-last heart.",
        ],
    },
    "orthrus": {
        "id": "orthrus",
        "name": "Orthrus",
        "family": "interceptor-support",
        "hearts": 0,
        "topSpeedMps": 113,
        "swarmSize": None,
        "enrageSeconds": None,
        "shieldDecaySeconds": None,
        "killReward": 15_000_000,
        "tags": ["INTERCEPTOR", "NO HEARTS", "ANTI-GUARDIAN FIELD", "FLEES"],
        "antiGuardianField": True,
        "tacticalNotes": [
            "No heart cycle; do not use the standard interceptor phase tracker.",
            "Maintains an Anti-Guardian field while in combat.",
            "Flees when attacked rather than following the normal heart/shield loop.",
        ],
    },
    "glaive": {
        "id": "glaive",
        "name": "Glaive",
        "family": "hunter",
        "hearts": 0,
        "topSpeedMps": 750,
        "swarmSize": None,
        "enrageSeconds": None,
        "shieldDecaySeconds": 16,
        "killReward": 4_500_000,
        "totalHpApprox": 720,
        "armorRating": 100,
        "humanWeaponResistancePercent": 99,
        "shieldStrengthMjApprox": 420,
        "tags": ["HUNTER", "750 M/S", "ANTI-GUARDIAN FIELD"],
        "antiGuardianField": True,
        "tacticalNotes": [
            "Extremely fast Hunter; no interceptor heart cycle.",
            "Maintains an Anti-Guardian field while in combat.",
            "Can fire weak caustic missiles after sufficient hull damage.",
        ],
    },
    "scythe": {
        "id": "scythe",
        "name": "Scythe",
        "family": "hunter",
        "hearts": 0,
        "topSpeedMps": 500,
        "swarmSize": None,
        "enrageSeconds": None,
        "shieldDecaySeconds": None,
        "killReward": 4_500_000,
        "totalHpApprox": 810,
        "armorRating": 100,
        "humanWeaponResistancePercent": 99,
        "tags": ["HUNTER", "NO HEARTS"],
        "tacticalNotes": [
            "Hunter vessel; no interceptor heart cycle.",
            "Treat separately from Cyclops/Basilisk/Medusa/Hydra tactics.",
        ],
    },
    "scout": {
        "id": "scout",
        "name": "Thargoid Scout",
        "family": "scout",
        "hearts": 0,
        "topSpeedMps": 280,
        "swarmSize": None,
        "enrageSeconds": None,
        "shieldDecaySeconds": None,
        "killReward": 80_000,
        "totalHpApprox": 180,
        "humanWeaponResistancePercent": 77,
        "tags": ["SCOUT", "NO HEARTS"],
        "tacticalNotes": [
            "No hearts or interceptor phase loop.",
            "Human weapons are much more effective against Scouts than against Interceptors.",
        ],
    },
}

_VARIANT_ALIASES = {
    "cyclops": ("cyclops",),
    "basilisk": ("basilisk",),
    "medusa": ("medusa",),
    "hydra": ("hydra",),
    "orthrus": ("orthrus",),
    "glaive": ("glaive",),
    "scythe": ("scythe",),
    "scout": ("thargoid scout", "marauder", "berserker", "regenerator", "inciter"),
}


def variant_ids() -> tuple[str, ...]:
    return tuple(AX_VARIANTS)


def variant_spec(variant: Any) -> dict[str, Any] | None:
    key = str(variant or "").strip().casefold()
    value = AX_VARIANTS.get(key)
    return deepcopy(value) if value else None


def resolve_ax_variant(target: Any, override: Any = "auto") -> dict[str, Any] | None:
    forced = str(override or "auto").strip().casefold()
    if forced and forced != "auto":
        return variant_spec(forced)

    if not isinstance(target, dict):
        return None

    values = [
        target.get("variant"),
        target.get("pilotName"),
        target.get("ship"),
        target.get("faction"),
        target.get("subsystem", {}).get("name") if isinstance(target.get("subsystem"), dict) else None,
    ]
    haystack = " | ".join(str(value or "").casefold() for value in values if value)
    if not haystack:
        return None

    for variant, aliases in _VARIANT_ALIASES.items():
        if any(alias in haystack for alias in aliases):
            return variant_spec(variant)

    if "thargoid" not in haystack:
        return None

    # We know it is AX, but not enough to invent a variant.
    if "interceptor" in haystack:
        return {
            "id": "interceptor-unknown",
            "name": "Unknown Interceptor",
            "family": "interceptor",
            "hearts": None,
            "tags": ["INTERCEPTOR", "VARIANT UNKNOWN"],
            "tacticalNotes": ["Complete a Xeno Scanner read or choose a manual variant before using heart/timer guidance."],
        }
    return {
        "id": "thargoid-unknown",
        "name": "Unknown Thargoid",
        "family": "unknown",
        "hearts": None,
        "tags": ["THARGOID", "VARIANT UNKNOWN"],
        "tacticalNotes": ["Target recognized as Thargoid, but the vessel type is not yet known."],
    }


def default_ax_settings() -> dict[str, Any]:
    return {
        "variantOverride": "auto",
        "coldHeatPercent": COLD_HEAT_THRESHOLD_PERCENT,
        "orbitMinM": 900,
        "orbitMaxM": 1500,
        "lightningDangerM": LIGHTNING_ATTACH_RANGE_M[1],
        "specialAvoidM": SPECIAL_ATTACK_AVOID_RANGE_M,
        "queuedShutdownEscapeM": QUEUED_SHUTDOWN_ESCAPE_RANGE_M,
        "shipBoostMps": 0,
        "manualHeartControls": True,
        "audio": {
            "heartDown": False,
            "enrage60": False,
            "shutdownExpected": False,
            "heatHigh": False,
        },
    }


def normalize_ax_settings(value: Any) -> dict[str, Any]:
    defaults = default_ax_settings()
    src = value if isinstance(value, dict) else {}
    out = deepcopy(defaults)

    override = str(src.get("variantOverride") or "auto").strip().casefold()
    out["variantOverride"] = override if override == "auto" or override in AX_VARIANTS else "auto"

    for key, minimum, maximum in (
        ("coldHeatPercent", 5, 80),
        ("orbitMinM", 200, 5000),
        ("orbitMaxM", 300, 8000),
        ("lightningDangerM", 300, 2000),
        ("specialAvoidM", 1000, 10000),
        ("queuedShutdownEscapeM", 3000, 20000),
        ("shipBoostMps", 0, 1200),
    ):
        try:
            number = int(round(float(src.get(key, defaults[key]))))
        except (TypeError, ValueError):
            number = int(defaults[key])
        out[key] = max(minimum, min(maximum, number))

    if out["orbitMaxM"] < out["orbitMinM"]:
        out["orbitMaxM"] = out["orbitMinM"]

    out["manualHeartControls"] = src.get("manualHeartControls") is not False
    audio = src.get("audio") if isinstance(src.get("audio"), dict) else {}
    out["audio"] = {key: bool(audio.get(key, value)) for key, value in defaults["audio"].items()}
    return out


def new_encounter(variant: Any, now: float = 0.0, source: str = "manual") -> dict[str, Any]:
    spec = variant_spec(variant)
    if not spec:
        raise ValueError("unknown_ax_variant")
    hearts = int(spec.get("hearts") or 0)
    started = max(0.0, float(now or 0.0))
    return {
        "variant": spec["id"],
        "source": source if source in {"journal", "scanner", "manual", "estimated"} else "manual",
        "startedAt": started,
        "heartsTotal": hearts,
        "heartsRemaining": hearts,
        "heartsDestroyed": 0,
        "phase": "engage" if hearts else "direct",
        "heartExertedAt": None,
        "lastHeartDestroyedAt": None,
        "shieldStartedAt": None,
        "enrageStartedAt": started if hearts else None,
        "heartSplitsSeconds": [],
        "manualEvents": 0,
    }


def apply_encounter_action(encounter: Any, action: Any, now: float) -> dict[str, Any]:
    if not isinstance(encounter, dict):
        raise ValueError("ax_encounter_required")
    out = deepcopy(encounter)
    spec = variant_spec(out.get("variant"))
    if not spec:
        raise ValueError("unknown_ax_variant")
    when = max(0.0, float(now or 0.0))
    action_id = str(action or "").strip().casefold()
    hearts_total = int(out.get("heartsTotal") or spec.get("hearts") or 0)
    hearts_remaining = max(0, min(hearts_total, int(out.get("heartsRemaining") or 0)))

    if action_id == "heart_exerted":
        if hearts_remaining <= 0:
            raise ValueError("no_ax_hearts_remaining")
        out["phase"] = "heart_exerted"
        out["heartExertedAt"] = when
    elif action_id == "heart_down":
        if hearts_remaining <= 0:
            raise ValueError("no_ax_hearts_remaining")
        split_start = out.get("lastHeartDestroyedAt")
        if not isinstance(split_start, (int, float)):
            split_start = out.get("startedAt")
        splits = [max(0.0, float(value)) for value in (out.get("heartSplitsSeconds") or []) if isinstance(value, (int, float))]
        if isinstance(split_start, (int, float)):
            splits.append(round(max(0.0, when - float(split_start)), 3))
        out["heartSplitsSeconds"] = splits[-hearts_total:]
        hearts_remaining -= 1
        out["heartsRemaining"] = hearts_remaining
        out["heartsDestroyed"] = hearts_total - hearts_remaining
        out["lastHeartDestroyedAt"] = when
        out["heartExertedAt"] = None
        if hearts_remaining > 0:
            out["phase"] = "shield"
            out["shieldStartedAt"] = when
            # A completed heart starts the next heart-cycle deadline.
            out["enrageStartedAt"] = when
        else:
            out["phase"] = "finish"
            out["shieldStartedAt"] = None
            out["enrageStartedAt"] = None
    elif action_id == "shield_up":
        out["phase"] = "shield"
        out["shieldStartedAt"] = when
    elif action_id == "shield_down":
        out["phase"] = "exert"
        out["shieldStartedAt"] = None
    elif action_id == "reset":
        return new_encounter(spec["id"], when, source="manual")
    else:
        raise ValueError("invalid_ax_action")

    out["manualEvents"] = int(out.get("manualEvents") or 0) + 1
    return out


def encounter_snapshot(encounter: Any, now: float) -> dict[str, Any] | None:
    if not isinstance(encounter, dict):
        return None
    spec = variant_spec(encounter.get("variant"))
    if not spec:
        return None
    current = max(0.0, float(now or 0.0))
    hearts_total = int(encounter.get("heartsTotal") or spec.get("hearts") or 0)
    hearts_remaining = max(0, min(hearts_total, int(encounter.get("heartsRemaining") or 0)))
    hearts_destroyed = hearts_total - hearts_remaining

    def remaining(start: Any, duration: Any) -> int | None:
        if not isinstance(start, (int, float)) or not isinstance(duration, (int, float)):
            return None
        return max(0, int(round(float(start) + float(duration) - current)))

    shield_remaining = remaining(encounter.get("shieldStartedAt"), spec.get("shieldDecaySeconds"))
    enrage_remaining = remaining(encounter.get("enrageStartedAt"), spec.get("enrageSeconds"))
    heart_window_remaining = remaining(encounter.get("heartExertedAt"), HEART_EXERTION_WINDOW_SECONDS)

    shutdown_expected = bool(
        hearts_total >= 2
        and hearts_remaining == 1
        and str(encounter.get("phase") or "") == "shield"
    )
    shutdown_next_heart = bool(hearts_total >= 2 and hearts_remaining == 2)

    exertion_index = hearts_destroyed
    exertion_values = spec.get("exertionHullPercentByHeart")
    exertion_percent = None
    if isinstance(exertion_values, list) and exertion_index < len(exertion_values):
        exertion_percent = exertion_values[exertion_index]

    return {
        "variant": spec["id"],
        "name": spec["name"],
        "family": spec.get("family"),
        "source": encounter.get("source") or "manual",
        "phase": encounter.get("phase") or "engage",
        "heartsTotal": hearts_total,
        "heartsRemaining": hearts_remaining,
        "heartsDestroyed": hearts_destroyed,
        "shieldRemainingSeconds": shield_remaining,
        "enrageRemainingSeconds": enrage_remaining,
        "heartWindowRemainingSeconds": heart_window_remaining,
        "shutdownExpected": shutdown_expected,
        "shutdownNextHeart": shutdown_next_heart,
        "nextExertionHullPercent": exertion_percent,
        "elapsedSeconds": max(0, int(round(current - float(encounter.get("startedAt") or current)))),
        "heartSplitsSeconds": [round(float(value), 3) for value in encounter.get("heartSplitsSeconds") or [] if isinstance(value, (int, float))],
        "spec": spec,
    }


def compare_speed(spec: Any, ship_boost_mps: Any) -> dict[str, Any] | None:
    if not isinstance(spec, dict):
        return None
    target_speed = spec.get("topSpeedMps")
    try:
        target = float(target_speed)
        ship = float(ship_boost_mps)
    except (TypeError, ValueError):
        return None
    margin = ship - target
    return {
        "targetMps": round(target),
        "shipMps": round(ship),
        "marginMps": round(margin),
        "canOutrun": margin > 0,
        "label": "OUTRUN" if margin > 0 else "CANNOT OUTRUN",
    }


def format_seconds(value: Any) -> str:
    if not isinstance(value, (int, float)):
        return "—"
    total = max(0, int(round(float(value))))
    return f"{total // 60}:{total % 60:02d}"
