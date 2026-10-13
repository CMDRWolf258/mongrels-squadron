"""Mongrel Surveyor: local-only, journal-authoritative exploration ledger.

No HTTP, Frontier upload, Cloudflare reads, or dependence on MongrelHUD.
This module intentionally distinguishes the commander's observations from external
catalog intelligence. Values are *experimental estimates*, not sale guarantees.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

SURVEY_EVENTS = frozenset({
    "FSDJump", "Location", "CarrierJump", "FSSDiscoveryScan",
    "FSSAllBodiesFound", "Scan", "SAAScanComplete", "FSSBodySignals",
    "SAASignalsFound", "SellExplorationData", "MultiSellExplorationData",
    "ScanOrganic", "SellOrganicData",
})
PLANET_K = {
    "Metal rich body": (21790, 105678),
    "Ammonia world": (96932, 0),
    "Class I gas giant": (1656, 0),
    "Class II gas giant": (9654, 0),
    "High metal content body": (9654, 100677),
    "Water world": (64831, 116295),
    "Earthlike body": (64831, 116295),
}
Q = 0.56591828
MODEL = "eddiscovery-core-equivalent-3.3-plus-apache2-v1"

def _bio_signal_count(body: Mapping[str, Any]) -> int:
    """Frontier FSS/DSS journal biological counts, never a species identification."""
    result = 0
    for signal in body.get("signals") or []:
        if not isinstance(signal, Mapping):
            continue
        kind = _text(signal.get("type")).casefold()
        if "biolog" in kind:
            result += max(0, _int(signal.get("count")) or 0)
    return result


def _hmc_bio_alert(body: Mapping[str, Any]) -> bool:
    planet = _text(body.get("planetClass")).casefold().replace("-", " ")
    return planet in {"high metal content body", "high metal content world"} and _bio_signal_count(body) > 0


def _record_exploration_alert(system: dict[str, Any], kind: str, body: Mapping[str, Any],
                              timestamp: str) -> None:
    """One alert per body/kind on this visit; bounded per-system local storage."""
    body_id = _text(body.get("bodyId"))
    if not body_id:
        return
    entries = system.get("explorationAlerts")
    entries = list(entries) if isinstance(entries, list) else []
    alert_id = kind + ":" + body_id
    if any(isinstance(row, Mapping) and row.get("id") == alert_id for row in entries):
        return
    entries.append({
        "id": alert_id,
        "kind": kind,
        "bodyId": body_id,
        "name": _text(body.get("name"))[:140],
        "biologicalSignals": _bio_signal_count(body) if kind == "hmc_bio" else 0,
        "timestamp": timestamp,
        "isFirstFootfallConfirmed": False,
        "speciesConfirmed": False,
    })
    system["explorationAlerts"] = entries[-16:]



# Frontier journal schema: ScanOrganic(Log/Sample/Analyse), SAASignalsFound.Genuses,
# SellOrganicData.BioData. Source: Frontier Journal Manual v37, Odyssey sections.
# Values below are a deliberately small, individually attributable reference set,
# NOT a complete BioInsights prediction model. Unknown values remain UNKNOWN.
# 2025-26 community references: INARA biological survey reports and ED journal.
BIO_REFERENCE_VALUES = {
    "Stratum Tectonicas": 19010800,
    "Stratum Paleas": 1362000,
    "Tubus Conifer": 2415500,
    "Bacterium Aurasus": 1000000,
    "Fungoida Gelata": 3330300,
    "Cactoida Pullulanta": 3667600,
}
BIO_REFERENCE_MODEL = "community-reference-partial-2026-10"
# Only distances independently established for these genera are exposed.
BIO_GENETIC_DISTANCES_M = {"Stratum": 500, "Bacterium": 500, "Osseus": 800, "Electricae": 1000}


def _biological_name(raw: Any, local: Any = None) -> str:
    # A Frontier $Codex_ token is an identifier, not a human-readable species.
    name = _text(local)
    if name:
        return name[:120]
    value = _text(raw)
    return value[:120] if value and not value.startswith("$") else ""


def _biological_identity(event: Mapping[str, Any]) -> tuple[str, str, str, str]:
    genus_id = _text(event.get("Genus"))[:120]
    species_id = _text(event.get("Species"))[:120]
    genus = _biological_name(genus_id, event.get("Genus_Localised"))
    species = _biological_name(species_id, event.get("Species_Localised"))
    return genus_id, species_id, genus, species


def _biological_genuses(rows: Any) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    if isinstance(rows, list):
        for item in rows[:64]:
            if not isinstance(item, Mapping):
                continue
            token = _text(item.get("Genus"))[:120]
            name = _biological_name(token, item.get("Genus_Localised"))
            if token and not any(x["id"] == token for x in found):
                found.append({"id": token, "name": name})
    return found


def _biological_position(position: Any, *, body_name: str, system_address: str,
                         timestamp: str) -> dict[str, Any] | None:
    """Only attach a live on-foot Status position with matching body/system/time.

    Older journals do not contain authoritative scan coordinates. Unknown
    geometry stays unknown rather than pretending it is ready for next sample.
    """
    if not isinstance(position, Mapping) or not body_name:
        return None
    if (position.get("systemAddress") != system_address or
        _text(position.get("bodyName")).casefold() != body_name.casefold() or
        position.get("onFootOnPlanet") is not True or position.get("hasLatLong") is not True):
        return None
    try:
        t1 = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        t2 = datetime.fromisoformat(_text(position.get("timestamp")).replace("Z", "+00:00"))
        if abs((t1 - t2).total_seconds()) > 15:
            return None
    except (ValueError, TypeError, OverflowError):
        return None
    lat, lon, radius = (_number(position.get(k)) for k in ("latitude", "longitude", "planetRadius"))
    if lat is None or lon is None or radius is None or not (-90 <= lat <= 90 and -180 <= lon <= 180 and radius > 0):
        return None
    return {"latitude": lat, "longitude": lon, "radius": radius, "observedAt": _text(position.get("timestamp"))}


def _biological_apply(body: dict[str, Any], event: Mapping[str, Any],
                      position: Any, system_address: str, timestamp: str) -> None:
    genus_id, species_id, genus, species = _biological_identity(event)
    kind = _text(event.get("ScanType")).casefold()
    if not species_id or kind not in {"log", "sample", "analyse"}:
        return
    rows = body.get("bioSamples")
    rows = dict(rows) if isinstance(rows, dict) else {}
    # Species token is stable across localization changes; one species/body.
    record = dict(rows.get(species_id) or {})
    if record.get("completed") and kind != "analyse":
        return
    progress = {"log": 1, "sample": 2, "analyse": 3}[kind]
    existing = int(record.get("samples") or 0)
    if kind == "sample" and existing < 1:
        # Missing first journal sample: stage is not independently proven.
        progress = 0
    elif kind == "analyse":
        progress = 3  # completion is authoritative even if earlier events missing
    record.update({
        "genusId": genus_id, "speciesId": species_id, "genus": genus,
        "species": species, "variant": _biological_name(event.get("Variant"), event.get("Variant_Localised")),
        "samples": max(existing, progress),
        "completed": kind == "analyse" or bool(record.get("completed")),
        "lastScanAt": timestamp,
        "estimatedBaseValue": BIO_REFERENCE_VALUES.get(species),
        "valuationSource": BIO_REFERENCE_MODEL if species in BIO_REFERENCE_VALUES else "unknown",
        "geneticDistanceMeters": BIO_GENETIC_DISTANCES_M.get(genus),
    })
    place = _biological_position(position, body_name=_text(body.get("name")),
                                 system_address=system_address, timestamp=timestamp)
    if place and kind in {"log", "sample", "analyse"}:
        positions = list(record.get("samplePositions") or [])
        if len(positions) < 3:
            positions.append(place)
            record["samplePositions"] = positions
    rows[species_id] = record
    body["bioSamples"] = rows


def _biological_opportunity(body: Mapping[str, Any]) -> dict[str, Any] | None:
    count = _bio_signal_count(body)
    samples = body.get("bioSamples") if isinstance(body.get("bioSamples"), dict) else {}
    genera = body.get("biologicalGenuses") if isinstance(body.get("biologicalGenuses"), list) else []
    if not count and not genera and not samples:
        return None
    confirmed = [dict(x) for x in genera if isinstance(x, Mapping)]
    current = [dict(x) for x in samples.values() if isinstance(x, Mapping)]
    hmc = _text(body.get("planetClass")).casefold() in {"high metal content body", "high metal content world"}
    contains_stratum = any("stratum" in _text(g.get("name")).casefold() for g in confirmed)
    return {
        "bodyId": _text(body.get("bodyId")),
        "bodyName": _text(body.get("name")),
        "signals": count,
        "confirmedGenuses": confirmed,
        "sampledSpecies": current,
        "identification": "dss_genuses_confirmed" if confirmed else "species_observed" if current else "signals_only",
        "hmcBiologicalOpportunity": hmc and count > 0,
        "possibleStratum": hmc and count > 0 and not confirmed,
        "confirmedStratumGenus": contains_stratum,
        "predictionCertainty": "unresolved" if not confirmed else "genus_confirmed_species_unknown",
        "estimatedCompleteBase": sum(int(x.get("estimatedBaseValue") or 0) for x in current if x.get("completed")),
        "knownValueCoverage": sum(bool(x.get("completed") and x.get("estimatedBaseValue") is not None) for x in current),
    }


def _biological_sale_rows(event: Mapping[str, Any]) -> tuple[list[dict[str, Any]], int, int]:
    entries = event.get("BioData")
    base = bonus = 0
    rows: list[dict[str, Any]] = []
    if not isinstance(entries, list):
        return [], 0, 0
    for item in entries[:300]:
        if not isinstance(item, Mapping):
            continue
        value, extra = _int(item.get("Value")), _int(item.get("Bonus"))
        if value is None or extra is None or min(value, extra) < 0:
            continue
        _gid, sid, genus, species = _biological_identity(item)
        rows.append({"speciesId": sid, "genus": genus, "species": species,
                     "value": value, "bonus": extra})
        base += value
        bonus += extra
    return rows, base, bonus

def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _int(value: Any) -> int | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return None


def _number(value: Any) -> float | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError, OverflowError):
        return None


def _flag(event: Mapping[str, Any], field: str) -> bool | None:
    return event[field] if isinstance(event.get(field), bool) else None


def _value(body: Mapping[str, Any], mapped: bool, efficient: bool) -> int | None:
    """EDDiscovery-equivalent modern scan estimate for a journal-observed body.

    Formula and evaluation order adapted from EDDiscovery/EliteDangerousCore
    EliteDangerous/FrontierData/Enumerations/EstimatedValues.cs
    Copyright 2021-2023 EDDiscovery development team, Apache-2.0.
    https://github.com/EDDiscovery/EliteDangerousCore
    NOT a claim that the underlying body was sold or first-credited.

    EDDiscovery has version-specific historic formulas; this entry point uses
    the 3.3+ model for current expedition display, with Odyssey mapping bonus.
    Missing mass is treated as 1 Earth/solar mass as EDDiscovery does.
    """
    star = _text(body.get("starType"))
    planet = _text(body.get("planetClass"))
    if not star and not planet:
        return None
    mass = _number(body.get("stellarMass") if star else body.get("massEM"))
    mass = mass if mass is not None and mass > 0 else 1.0
    if star:
        kind = star.upper()
        if kind.startswith("D"):
            k = 14057.0
        elif kind in {"N", "H"}:
            k = 22628.0
        elif kind in {"SUPERMASSIVEBLACKHOLE", "SUPERMASSIVE BLACK HOLE"}:
            k = 33.5678
        else:
            k = 1200.0
        base = k + mass * k / 66.25
        return int(base * 2.6) if body.get("wasDiscovered") is False else int(base)

    # Frontier: "Sudarsky class I gas giant". Table: "Class I gas giant".
    canonical = planet.casefold().removeprefix("sudarsky ").strip()
    table = {
        "metal rich body": (21790.0, 65631.0),
        "metal-rich body": (21790.0, 65631.0),
        "ammonia world": (96932.0, 0.0),
        "class i gas giant": (1656.0, 0.0),
        "class ii gas giant": (9654.0, 100677.0),
        "high metal content body": (9654.0, 100677.0),
        "high metal content world": (9654.0, 100677.0),
        "water world": (64831.0, 116295.0),
        "earthlike body": (181126.0, 0.0),
        "earth-like world": (181126.0, 0.0),
    }
    k, terra_bonus = table.get(canonical, (300.0, 93328.0))
    terraform = _text(body.get("terraformState")).casefold()
    is_terraformable = terraform in {
        "terraformable", "candidate for terraforming", "candidate for terraforming.",
    }
    if is_terraformable:
        k += terra_bonus
    base = max(k * (1.0 + Q * mass**0.2), 500.0)

    if not mapped:
        return int(base * 2.6) if body.get("wasDiscovered") is False else int(base)

    # Mirrors EDDiscovery 3.3+ WasDiscovered / WasMapped evaluation, including
    # the rare condition: WasDiscovered=false, WasMapped=true (PR31).
    was_disc = body.get("wasDiscovered")
    was_map = body.get("wasMapped")
    odyssey = body.get("odysseyValueMode") is not False

    def _mapped_value(multiplier: float, first_discovery: bool = False) -> int:
        mapped_base = base * multiplier
        if odyssey:
            mapped_base += max(mapped_base * 0.3, 555.0)
        if first_discovery:
            mapped_base *= 2.6
        if efficient:
            mapped_base *= 1.25
        return int(mapped_base)

    if was_disc is False and was_map is True:
        return _mapped_value(3.3333333) if mapped else int(base)
    if was_disc is False and was_map is False:
        return _mapped_value(3.699622554, first_discovery=True)
    if was_map is False:
        return _mapped_value(8.0956)
    if was_disc is False:
        # Earlier FD flag without confirmed prior mapping state.
        return int(base * 2.6)
    return _mapped_value(3.3333333)

def _body_view(body: dict[str, Any]) -> dict[str, Any]:
    owned_scan = bool(body.get("personallyScanned"))
    owned_map = bool(body.get("personallyMapped"))
    scan = _value(body, mapped=False, efficient=False) if owned_scan else None
    efficiency = body.get("mappingEfficiency")
    is_star = bool(body.get("starType"))
    mapped_min = None if is_star else _value(body, mapped=True, efficient=False)
    mapped_max = None if is_star else _value(body, mapped=True, efficient=True)
    mapped = mapped_max if efficiency is not False else mapped_min
    # No credit is projected from an externally reported body or a navigation
    # beacon record the commander has not scanned personally.
    current = mapped if owned_map else scan
    extra = max(0, mapped - scan) if owned_scan and not owned_map and mapped is not None and scan is not None else None
    extra_min = max(0, mapped_min - scan) if owned_scan and not owned_map and mapped_min is not None and scan is not None else None
    extra_max = max(0, mapped_max - scan) if owned_scan and not owned_map and mapped_max is not None and scan is not None else None
    result = dict(body)
    result.update({
        "currentValue": current,
        "mappedValue": mapped,
        "mappingGain": extra,
        "mappingGainMin": extra_min,
        "mappingGainMax": extra_max,
        "mappedValueMin": mapped_min,
        "mappedValueMax": mapped_max,
        "valuationConfidence": "community_estimate_not_sale_value" if current is not None else "unvalued",
        "valueModel": MODEL,
        "estimated": True,
        "mappedValueAssumesEfficient": efficiency is None and not owned_map,
        "mappingStatus": "not_applicable" if is_star else "mapped_by_you" if owned_map else (
            "previously_mapped" if body.get("wasMapped") is True else
            "potential_first_mapping" if body.get("wasMapped") is False else "unknown"
        ),
    })
    return result


ADVISOR_MODEL = "journal-confirmed-mapping-gain-distance-v1"


def _mapping_advisor(bodies: list[dict[str, Any]]) -> dict[str, Any]:
    """Rank *personally scanned*, not-yet-DSS-mapped planets only.

    Score is a relative decision aid, NOT an ETA or credits-per-hour figure:
    estimated basic/efficient DSS gain with a moderate logarithmic discount
    for distance from the system's arrival star. Unknown distances are marked
    as such and never represented as measured route travel.
    """
    ranked: list[dict[str, Any]] = []
    unvalued = 0
    for body in bodies:
        # Catalog-only and NavBeaconDetail scans cannot prove this commander
        # scanned the world. Stars, completed DSS scans and unpriced bodies
        # are deliberately omitted from the ranked recommendations.
        if (
            not body.get("personallyScanned")
            or body.get("personallyMapped")
            or body.get("starType")
            or not _text(body.get("planetClass"))
        ):
            continue

        low = _int(body.get("mappingGainMin"))
        high = _int(body.get("mappingGainMax"))
        if low is None or high is None or low <= 0 or high < low:
            unvalued += 1
            continue
        distance = _number(body.get("distanceLs"))
        known_distance = distance is not None and distance >= 0
        # Travel in supercruise isn't linear in light seconds. This modest
        # discount is explicitly only a heuristic, not a trip-time model.
        travel_weight = (1.0 + 0.55 * math.log10(1 + distance / 500.0)
                         if known_distance else 1.15)
        typical_gain = (low + high) / 2
        score = typical_gain / travel_weight

        tags: list[str] = []
        if body.get("wasMapped") is False:
            tags.append("Potential first mapping")
        if body.get("terraformState") == "Terraformable":
            tags.append("Terraformable")
        if body.get("planetClass") in {"Earthlike body", "Water world", "Ammonia world"}:
            tags.append("High-value body class")
        if known_distance and distance <= 500:
            tags.append("Near arrival star")
        if not known_distance:
            tags.append("Distance unconfirmed")
        if not tags:
            tags.append("Estimated DSS gain")
        ranked.append({
            "bodyId": _text(body.get("bodyId")),
            "name": _text(body.get("name")) or "Unnamed body",
            "planetClass": _text(body.get("planetClass")),
            "distanceLs": round(distance, 1) if known_distance else None,
            "distanceStatus": "journal_confirmed_from_arrival" if known_distance else "unknown",
            "dssGainMin": low,
            "dssGainMax": high,
            "firstMappingCandidate": body.get("wasMapped") is False,
            "tier": "high" if low >= 200_000 else "medium" if low >= 50_000 else "low",
            "reasons": tags[:3],
            "_score": score,
        })

    # Stable tie-breaker ensures HUD doesn't reshuffle identically scored
    # bodies after restarts or duplicated historical journal imports.
    ranked.sort(key=lambda row: (
        -row["_score"], -row["dssGainMin"],
        row["name"].casefold(), row["bodyId"],
    ))
    total = len(ranked)
    for index, row in enumerate(ranked, 1):
        row.pop("_score", None)
        row["rank"] = index
    return {
        "model": ADVISOR_MODEL,
        "status": "ranked" if ranked else "no_valued_unmapped_scans",
        "source": "commander_frontier_journal_only",
        "rankingBasis": "provisional_dss_gain_and_arrival_distance_heuristic_not_eta",
        "eligibleCount": total,
        "unvaluedScans": unvalued,
        "distanceUnknownCount": sum(row["distanceLs"] is None for row in ranked),
        "potentialGainMin": sum(row["dssGainMin"] for row in ranked),
        "potentialGainMax": sum(row["dssGainMax"] for row in ranked),
        "targets": ranked[:8],
        "targetsTruncated": max(0, total - 8),
    }


class Surveyor:
    SURVEY_EVENTS = SURVEY_EVENTS

    def __init__(self, db_path: str | Path | None = None):
        base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / ".local" / "share"))
        self.path = Path(db_path) if db_path else base / "MongrelScout" / "surveyor.sqlite3"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self._connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS events (
                    commander TEXT NOT NULL, digest TEXT NOT NULL,
                    PRIMARY KEY(commander, digest)
                );
                CREATE TABLE IF NOT EXISTS systems (
                    commander TEXT NOT NULL, address TEXT NOT NULL,
                    info TEXT NOT NULL, PRIMARY KEY(commander, address)
                );
                CREATE TABLE IF NOT EXISTS bodies (
                    commander TEXT NOT NULL, address TEXT NOT NULL,
                    body_id TEXT NOT NULL, info TEXT NOT NULL,
                    PRIMARY KEY(commander, address, body_id)
                );
                CREATE TABLE IF NOT EXISTS meta (
                    commander TEXT PRIMARY KEY, active_address TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sales (
                    commander TEXT NOT NULL, digest TEXT NOT NULL,
                    total INTEGER NOT NULL, timestamp TEXT NOT NULL,
                    PRIMARY KEY(commander, digest)
                );
                CREATE TABLE IF NOT EXISTS expeditions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    commander TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT
                );
                CREATE INDEX IF NOT EXISTS ix_expeditions_active
                    ON expeditions(commander, ended_at);
                CREATE TABLE IF NOT EXISTS expedition_credits (
                    expedition_id INTEGER NOT NULL,
                    digest TEXT NOT NULL,
                    address TEXT NOT NULL,
                    body_id TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    PRIMARY KEY(expedition_id, digest)
                );
                CREATE TABLE IF NOT EXISTS expedition_exclusions (
                    expedition_id INTEGER NOT NULL, address TEXT NOT NULL,
                    marked_at TEXT NOT NULL, cutoff_rowid INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY(expedition_id, address)
                );
                CREATE TABLE IF NOT EXISTS bio_sales (
                    commander TEXT NOT NULL, digest TEXT NOT NULL,
                    base INTEGER NOT NULL, bonus INTEGER NOT NULL,
                    details TEXT NOT NULL, timestamp TEXT NOT NULL,
                    PRIMARY KEY(commander,digest)
                );
                CREATE TABLE IF NOT EXISTS carto_reference (
                    commander TEXT NOT NULL,
                    address TEXT NOT NULL,
                    observed_actual INTEGER NOT NULL,
                    model_estimate INTEGER NOT NULL,
                    recorded_at TEXT NOT NULL,
                    PRIMARY KEY(commander,address)
                );
            """)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=5)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _load(conn: sqlite3.Connection, table: str, cmdr: str, address: str, body_id: str | None = None) -> dict[str, Any]:
        if table == "systems":
            row = conn.execute(
                "SELECT info FROM systems WHERE commander=? AND address=?", (cmdr, address)
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT info FROM bodies WHERE commander=? AND address=? AND body_id=?",
                (cmdr, address, body_id),
            ).fetchone()
        return json.loads(row["info"]) if row else {}

    @staticmethod
    def _save(conn: sqlite3.Connection, table: str, cmdr: str, address: str, info: dict[str, Any], body_id: str | None = None) -> None:
        encoded = json.dumps(info, separators=(",", ":"), ensure_ascii=False)
        if table == "systems":
            conn.execute(
                "INSERT INTO systems VALUES (?,?,?) ON CONFLICT(commander,address) DO UPDATE SET info=excluded.info",
                (cmdr, address, encoded),
            )
        else:
            conn.execute(
                "INSERT INTO bodies VALUES (?,?,?,?) ON CONFLICT(commander,address,body_id) DO UPDATE SET info=excluded.info",
                (cmdr, address, body_id, encoded),
            )

    def _revalue_system(self, conn: sqlite3.Connection, commander: str, address: str) -> None:
        info = self._load(conn, "systems", commander, address)
        sold_at = _text(info.get("lastKnownSaleAt"))
        total = 0
        counted = 0
        for row in conn.execute(
            "SELECT info FROM bodies WHERE commander=? AND address=?", (commander, address)
        ):
            body = _body_view(json.loads(row["info"]))
            acquired_at = _text(body.get("lastDataAcquiredAt"))
            if sold_at and acquired_at and acquired_at <= sold_at:
                continue
            if body["currentValue"] is not None:
                total += body["currentValue"]
                counted += 1
        info["estimatedOutstanding"] = total
        info["valueCoverage"] = counted
        self._save(conn, "systems", commander, address, info)

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def _active_expedition(conn: sqlite3.Connection, commander: str) -> sqlite3.Row | None:
        return conn.execute(
            "SELECT id,started_at FROM expeditions WHERE commander=? AND ended_at IS NULL "
            "ORDER BY id DESC LIMIT 1", (commander,),
        ).fetchone()

    def control(self, commander: str, action: str) -> dict[str, Any]:
        """Local-only user choices. Never remove scans or modify sold records.

        'mark_existing' acts as a *time cutoff*: previously credited values for
        this system are excluded, while new scans/DSS gains remain eligible.
        """
        cmdr = _text(commander)
        if not cmdr:
            raise ValueError("commander_unavailable")
        if action not in {"start", "end", "mark_existing", "undo_existing"}:
            raise ValueError("invalid_expedition_action")
        with self.lock, self._connect() as conn:
            active = self._active_expedition(conn, cmdr)
            if action == "start":
                if active is None:
                    conn.execute(
                        "INSERT INTO expeditions(commander,started_at) VALUES (?,?)",
                        (cmdr, self._utc_now()),
                    )
            elif active is None:
                raise ValueError("expedition_not_active")
            elif action == "end":
                conn.execute(
                    "UPDATE expeditions SET ended_at=? WHERE id=?",
                    (self._utc_now(), active["id"]),
                )
            else:
                row = conn.execute(
                    "SELECT active_address FROM meta WHERE commander=?", (cmdr,),
                ).fetchone()
                address = row["active_address"] if row else ""
                if not address:
                    raise ValueError("current_system_unavailable")
                if action == "mark_existing":
                    # Preserve the earliest cutoff across repeat clicks.
                    cutoff = conn.execute(
                        "SELECT COALESCE(MAX(rowid),0) FROM expedition_credits "
                        "WHERE expedition_id=? AND address=?",
                        (active["id"], address),
                    ).fetchone()[0]
                    conn.execute(
                        "INSERT OR IGNORE INTO expedition_exclusions "
                        "(expedition_id,address,marked_at,cutoff_rowid) VALUES (?,?,?,?)",
                        (active["id"], address, self._utc_now(), cutoff),
                    )
                else:
                    conn.execute(
                        "DELETE FROM expedition_exclusions WHERE expedition_id=? AND address=?",
                        (active["id"], address),
                    )
            row = conn.execute(
                "SELECT active_address FROM meta WHERE commander=?", (cmdr,),
            ).fetchone()
            return self._snapshot(conn, cmdr, row["active_address"] if row else "")

    def _expedition_view(self, conn: sqlite3.Connection, commander: str,
                         active_address: str) -> dict[str, Any]:
        session = self._active_expedition(conn, commander)
        if session is None:
            return {
                "active": False, "startedAt": None, "estimate": 0,
                "currentSystemGain": 0, "existingDataExcluded": False,
                "countedScans": 0, "countedMaps": 0,
            }
        excluded = {
            row["address"]: (row["marked_at"], row["cutoff_rowid"])
            for row in conn.execute(
                "SELECT address,marked_at,cutoff_rowid FROM expedition_exclusions "
                "WHERE expedition_id=?", (session["id"],),
            )
        }
        total, local, scans, maps = 0, 0, 0, 0
        for row in conn.execute(
            "SELECT rowid,address,occurred_at,kind,amount FROM expedition_credits WHERE expedition_id=?",
            (session["id"],),
        ):
            # A system exclusion ignores *existing* credited work, not the
            # future Scan/SAAScanComplete journal events after the button.
            cutoff = excluded.get(row["address"])
            if cutoff and (row["rowid"] <= cutoff[1] or row["occurred_at"] < cutoff[0]):
                continue
            amount = max(0, int(row["amount"]))
            total += amount
            if row["address"] == active_address:
                local += amount
            if row["kind"] == "Scan":
                scans += 1
            elif row["kind"] == "SAAScanComplete":
                maps += 1
        return {
            "active": True, "startedAt": session["started_at"],
            "estimate": total, "currentSystemGain": local,
            "existingDataExcluded": active_address in excluded,
            "currentSystemCutoff": excluded[active_address][0] if active_address in excluded else None,
            "countedScans": scans, "countedMaps": maps,
            "valueMeaning": "estimated_new_scan_and_mapping_gains_not_guaranteed_unsold",
        }

    def apply(self, commander: str, event: Mapping[str, Any], fallback_system: str = "",
              fallback_address: Any = None, *, historic: bool = False,
              position: Any = None) -> dict[str, Any] | None:
        kind = _text(event.get("event"))
        commander = _text(commander)
        if not commander or kind not in SURVEY_EVENTS:
            return None
        serialized = json.dumps(dict(event), sort_keys=True, separators=(",", ":"), default=str)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        with self.lock, self._connect() as conn:
            inserted = conn.execute(
                "INSERT OR IGNORE INTO events(commander,digest) VALUES (?,?)", (commander, digest)
            ).rowcount
            if not inserted:
                return None
            row = conn.execute(
                "SELECT active_address FROM meta WHERE commander=?", (commander,)
            ).fetchone()
            active = row["active_address"] if row else ""
            # Explicit SystemAddress always outranks EDMC fallback context.
            address = _text(event.get("SystemAddress") or fallback_address or active)
            if kind in {"FSDJump", "Location", "CarrierJump"} and address and not historic:
                conn.execute(
                    "INSERT INTO meta VALUES (?,?) ON CONFLICT(commander) DO UPDATE SET active_address=excluded.active_address",
                    (commander, address),
                )
                active = address
            if kind == "SellOrganicData":
                rows, base, bonus = _biological_sale_rows(event)
                if rows:
                    conn.execute(
                        "INSERT OR IGNORE INTO bio_sales VALUES (?,?,?,?,?,?)",
                        (commander, digest, base, bonus,
                         json.dumps(rows, separators=(",", ":")), _text(event.get("timestamp"))),
                    )
                # A station sale has NO originating body/system address.
                # Record confirmed cash but do not guess which body to clear.
                return self._snapshot(conn, commander, active)
            if not address:
                return self._snapshot(conn, commander, active)
            system = self._load(conn, "systems", commander, address)
            # A new live arrival begins a fresh alert visit. Historical journal
            # replay must not clear or synthesize a live cockpit notification.
            if not historic and kind in {"FSDJump", "CarrierJump", "Location"}:
                system["explorationAlerts"] = []
            name = _text(event.get("StarSystem") or event.get("SystemName") or fallback_system or system.get("name"))
            if name:
                system["name"] = name
            system["address"] = address
            timestamp = _text(event.get("timestamp"))
            if timestamp and timestamp >= _text(system.get("lastObservedAt")):
                system["lastObservedAt"] = timestamp
            if kind == "FSSDiscoveryScan":
                count = _int(event.get("BodyCount"))
                if count is not None and count >= 0:
                    system["bodyCount"] = count
                system["honked"] = True
            if kind == "FSSAllBodiesFound":
                system["fssComplete"] = True
                count = _int(event.get("Count"))
                if count is not None:
                    system["bodyCount"] = count
            revalue_systems = set()
            if kind in {"SellExplorationData", "MultiSellExplorationData"}:
                amount = _int(event.get("TotalEarnings"))
                if amount is not None and amount >= 0:
                    conn.execute(
                        "INSERT INTO sales VALUES (?,?,?,?)",
                        (commander, digest, amount, timestamp),
                    )
                # SellExplorationData.Systems identifies sold systems. The
                # MultiSellExplorationData.Discovered list is *not* exhaustive;
                # it must never clear all those systems' estimated balances.
                sold_systems = event.get("Systems") if kind == "SellExplorationData" else None
                for entry in sold_systems if isinstance(sold_systems, list) else []:
                    sale_name = _text(entry.get("SystemName")) if isinstance(entry, Mapping) else _text(entry)
                    if not sale_name:
                        continue
                    for record in conn.execute("SELECT address,info FROM systems WHERE commander=?", (commander,)).fetchall():
                        previous = json.loads(record["info"])
                        if previous.get("name", "").casefold() == sale_name.casefold():
                            previous["lastKnownSaleAt"] = max(timestamp, _text(previous.get("lastKnownSaleAt")))
                            previous["salesPartiallyReconciled"] = True
                            self._save(conn, "systems", commander, record["address"], previous)
                            revalue_systems.add(record["address"])
                            if record["address"] == address:
                                system.update(previous)
            if kind in {"Scan", "SAAScanComplete", "FSSBodySignals", "SAASignalsFound", "ScanOrganic"}:
                raw_id = event.get("Body") if kind == "ScanOrganic" else event.get("BodyID")
                body_id = _text(raw_id) if raw_id is not None else ""
                if body_id:
                    body = self._load(conn, "bodies", commander, address, body_id)
                    # Determine the incremental value *before* changing this
                    # body's personal observation state. Prior scans are never
                    # counted a second time by re-scanning a known system.
                    prior = _body_view(body)
                    body["bodyId"] = body_id
                    body["systemAddress"] = address
                    body["name"] = _text(event.get("BodyName")) or body.get("name", "")
                    if kind == "Scan":
                        for src, dest in (
                            ("PlanetClass", "planetClass"), ("StarType", "starType"),
                            ("TerraformState", "terraformState"), ("DistanceFromArrivalLS", "distanceLs"),
                            ("MassEM", "massEM"), ("StellarMass", "stellarMass"),
                            ("Landable", "landable"), ("SurfaceGravity", "surfaceGravity"),
                            ("SurfaceTemperature", "surfaceTemperature"), ("Atmosphere", "atmosphere"),
                            ("Volcanism", "volcanism"),
                        ):
                            if src in event:
                                body[dest] = event[src]
                        for src, dest in (("WasDiscovered", "wasDiscovered"), ("WasMapped", "wasMapped")):
                            value = _flag(event, src)
                            if value is not None and body.get(dest) is None:
                                # Preserve the original discovery/mapping condition;
                                # repeat scans after personal mapping must not erase it.
                                body[dest] = value
                        body["scanType"] = _text(event.get("ScanType"))
                        if body["scanType"] not in {"NavBeaconDetail", "External"}:
                            body["personallyScanned"] = True
                            body["lastDataAcquiredAt"] = max(timestamp, _text(body.get("lastDataAcquiredAt")))
                    elif kind == "SAAScanComplete":
                        body["personallyMapped"] = True
                        used, target = _int(event.get("ProbesUsed")), _int(event.get("EfficiencyTarget"))
                        if used is not None and target is not None:
                            body["mappingEfficiency"] = used <= target
                        body["lastDataAcquiredAt"] = max(timestamp, _text(body.get("lastDataAcquiredAt")))
                    elif kind == "ScanOrganic":
                        _biological_apply(body, event, None if historic else position, address, timestamp)
                    else:
                        if kind == "SAASignalsFound" and isinstance(event.get("Genuses"), list):
                            body["biologicalGenuses"] = _biological_genuses(event["Genuses"])
                            body["genusSource"] = "Frontier SAASignalsFound"
                        signals = event.get("Signals")
                        if isinstance(signals, list):
                            body["signals"] = [
                                {"type": _text(s.get("Type_Localised") or s.get("Type")),
                                 "count": _int(s.get("Count"))}
                                for s in signals if isinstance(s, Mapping)
                            ]
                    self._save(conn, "bodies", commander, address, body, body_id)
                    if not historic and address == active:
                        # Flags in the new Scan event are stronger evidence than
                        # old persisted flags. Don't replay previous first claims.
                        if (kind == "Scan" and event.get("WasDiscovered") is False
                                and body.get("personallyScanned") and not prior.get("personallyScanned")):
                            first_kind = "first_discovery_system" if body.get("starType") and (
                                body_id == "0" or body.get("name") == system.get("name")) else "first_discovery_body"
                            _record_exploration_alert(system, first_kind, body, timestamp)
                        if kind in {"Scan", "FSSBodySignals", "SAASignalsFound"} and _hmc_bio_alert(body):
                            _record_exploration_alert(system, "hmc_bio", body, timestamp)
                    if not historic and kind in {"Scan", "SAAScanComplete"} and address == active:
                        system["lastSurveyedBodyId"] = body_id
                    revalue_systems.add(address)
                    session = self._active_expedition(conn, commander)
                    # Journal timestamps are Frontier UTC. Never infer earnings
                    # from historic scans older than the user-pressed start.
                    if session is not None and timestamp and timestamp > session["started_at"]:
                        after = _body_view(body)
                        amount = 0
                        if kind == "Scan" and not prior.get("personallyScanned") and after.get("personallyScanned"):
                            amount = max(0, _int(after.get("currentValue")) or 0)
                        elif kind == "SAAScanComplete" and not prior.get("personallyMapped"):
                            # Mapping old, already-scanned data earns only the
                            # *new DSS increment*, never the earlier scan value.
                            full = _int(after.get("currentValue"))
                            scan = _int(prior.get("currentValue"))
                            if scan is None and prior.get("personallyScanned"):
                                scan = _int(_value(prior, mapped=False, efficient=False))
                            if full is not None and scan is not None:
                                amount = max(0, full - scan)
                        if amount:
                            conn.execute(
                                "INSERT OR IGNORE INTO expedition_credits "
                                "(expedition_id,digest,address,body_id,occurred_at,kind,amount) "
                                "VALUES (?,?,?,?,?,?,?)",
                                (session["id"], digest, address, body_id, timestamp, kind, amount),
                            )
            self._save(conn, "systems", commander, address, system)
            for touched in revalue_systems:
                self._revalue_system(conn, commander, touched)
            # Bulk historical replay must not calculate an all-system HUD
            # snapshot on every journal line; one snapshot after import is
            # sufficient and avoids work scaling quadratically with history.
            if historic:
                return {"imported": True}
            return self._snapshot(conn, commander, active or address)

    def expire_intelligence(self, commander: str, address: str) -> None:
        """Permit a deliberate user refresh without deleting prior catalog facts."""
        with self.lock, self._connect() as conn:
            addr = _text(address)
            system = self._load(conn, "systems", _text(commander), addr)
            intel = system.get("intelligence")
            if isinstance(intel, dict):
                intel["expiresAt"] = 0
                system["intelligence"] = intel
                self._save(conn, "systems", _text(commander), addr, system)

    def cached_intelligence(self, commander: str, address: str) -> dict[str, Any] | None:
        """Cache survives restarts; expiration never destroys a previous result."""
        with self.lock, self._connect() as conn:
            system = self._load(conn, "systems", _text(commander), _text(address))
        intel = system.get("intelligence")
        return dict(intel) if isinstance(intel, dict) else None

    def set_intelligence(self, commander: str, address: str,
                         details: Mapping[str, Any], ttl_seconds: int = 43200) -> dict[str, Any]:
        """Store derived community facts, never synthesize journal scans/earnings."""
        with self.lock, self._connect() as conn:
            addr = _text(address)
            system = self._load(conn, "systems", _text(commander), addr)
            if not addr or not system:
                return self._snapshot(conn, _text(commander), addr)
            intel = dict(details)
            intel["fetchedAt"] = int(time.time())
            intel["expiresAt"] = int(time.time()) + max(600, min(86400, int(ttl_seconds)))
            system["intelligence"] = intel
            self._save(conn, "systems", _text(commander), addr, system)
            row = conn.execute("SELECT active_address FROM meta WHERE commander=?", (_text(commander),)).fetchone()
            return self._snapshot(conn, _text(commander), row["active_address"] if row else addr)

    def set_eddiscovery_history(self, commander: str, system_name: str,
                                address: str, data: Mapping[str, Any]) -> dict[str, Any]:
        """Cache EDDiscovery's *historical* personal scan record separately.

        Do not synthesize journal events, first-claim awards, or expedition
        earnings from this optional external application's prior scans.
        """
        cmdr, addr = _text(commander), _text(address)
        if not cmdr or not addr.isdecimal() or not _text(system_name):
            raise ValueError("invalid_edd_system_identity")
        if str(data.get("systemAddress") or "") != addr or not data.get("verifiedSystemIdentity"):
            raise ValueError("unverified_edd_history")
        if data.get("sourceSystem", "").casefold() != system_name.casefold():
            raise ValueError("edd_history_system_mismatch")
        with self.lock, self._connect() as conn:
            system = self._load(conn, "systems", cmdr, addr)
            if system.get("name") and _text(system["name"]).casefold() != system_name.casefold():
                raise ValueError("edd_history_current_system_mismatch")
            system["address"] = addr
            system["name"] = system_name
            # Limit local JSON size; never accept journal records or arbitrary
            # metadata through the EDDiscovery sidecar.
            limited = dict(data)
            limited["bodies"] = list(data.get("bodies") or [])[:200]
            limited["recordedAt"] = self._utc_now()
            system["eddiscoveryHistory"] = limited
            self._save(conn, "systems", cmdr, addr, system)
            row = conn.execute("SELECT active_address FROM meta WHERE commander=?",
                               (cmdr,)).fetchone()
            return self._snapshot(conn, cmdr, row["active_address"] if row else addr)

    def record_carto_reference(self, commander: str, observed_actual: Any, system_name: str = "") -> dict[str, Any]:
        """Record a manual Universal Cartographics quote as a calibration reference.

        Manual quotes never mark exploration data sold, affect expedition credit,
        or pretend to be Frontier journal payout events.
        """
        cmdr = _text(commander)
        actual = _int(observed_actual)
        if not cmdr or actual is None or not 0 <= actual <= 2_000_000_000:
            raise ValueError("invalid_carto_quote")
        with self.lock, self._connect() as conn:
            row = conn.execute(
                "SELECT active_address FROM meta WHERE commander=?", (cmdr,),
            ).fetchone()
            address = row["active_address"] if row else ""
            if system_name:
                matches = [
                    row["address"] for row in conn.execute(
                        "SELECT address,info FROM systems WHERE commander=?", (cmdr,),
                    ) if _text(json.loads(row["info"]).get("name")).casefold() == _text(system_name).casefold()
                ]
                if len(matches) != 1:
                    raise ValueError("quote_system_unavailable_or_ambiguous")
                address = matches[0]
            if not address:
                raise ValueError("current_system_unavailable")
            # Store the uncalibrated raw model, not a prior correction.
            with self._connect() as ref_conn:
                system_snap = self._snapshot(ref_conn, cmdr, address)
            model = system_snap.get("currentSystemBaseEstimate")
            if type(model) is not int or model <= 0:
                raise ValueError("system_estimate_unavailable")
            conn.execute(
                "INSERT INTO carto_reference VALUES (?,?,?,?,?) "
                "ON CONFLICT(commander,address) DO UPDATE SET "
                "observed_actual=excluded.observed_actual, model_estimate=excluded.model_estimate, "
                "recorded_at=excluded.recorded_at",
                (cmdr, address, actual, model, self._utc_now()),
            )
            return self._snapshot(conn, cmdr, address)

    def snapshot(self, commander: str) -> dict[str, Any]:
        with self.lock, self._connect() as conn:
            row = conn.execute(
                "SELECT active_address FROM meta WHERE commander=?", (_text(commander),)
            ).fetchone()
            return self._snapshot(conn, _text(commander), row["active_address"] if row else "")

    def _snapshot(self, conn: sqlite3.Connection, commander: str, active: str) -> dict[str, Any]:
        current = self._load(conn, "systems", commander, active) if active else {}
        bodies = []
        if active:
            bodies = [
                _body_view(json.loads(row["info"])) for row in conn.execute(
                    "SELECT info FROM bodies WHERE commander=? AND address=?", (commander, active)
                )
            ]
        advisor = _mapping_advisor(bodies)
        bodies.sort(key=lambda body: (-(body.get("mappingGain") or 0), body.get("name", "")))
        known_current = [b["currentValue"] for b in bodies if b["currentValue"] is not None]
        firsts = [b for b in bodies if b.get("personallyScanned") and b.get("wasDiscovered") is False]
        primary = next((b for b in bodies if b.get("starType") and
                       (b.get("bodyId") == "0" or b.get("name", "") == current.get("name"))), None)
        if primary and primary.get("wasDiscovered") is False:
            discovery = "potential_first_arrival_star"
        elif primary and primary.get("wasDiscovered") is True:
            discovery = "previously_discovered_arrival_star"
        elif firsts:
            discovery = "new_body_candidates"
        else:
            discovery = "unknown"
        estimates = conn.execute(
            "SELECT info FROM systems WHERE commander=?", (commander,)
        ).fetchall()
        unsold = sum(
            max(0, _int(json.loads(row["info"]).get("estimatedOutstanding")) or 0)
            for row in estimates
        )
        covered = sum(
            max(0, _int(json.loads(row["info"]).get("valueCoverage")) or 0)
            for row in estimates
        )
        sale_total = conn.execute(
            "SELECT COALESCE(SUM(total),0) AS total FROM sales WHERE commander=?", (commander,)
        ).fetchone()["total"]
        comparisons = conn.execute(
            "SELECT address,observed_actual,model_estimate FROM carto_reference WHERE commander=?",
            (commander,),
        ).fetchall()
        current_ref = next((row for row in comparisons if row["address"] == active), None)
        # Calibrate only after several distinct, manually entered systems.
        # One example is evidence of a gap, not a universal multiplier.
        ratios = sorted(
            max(0.5, min(3.0, row["observed_actual"] / row["model_estimate"]))
            for row in comparisons if row["model_estimate"] > 0 and row["observed_actual"] > 0
        )
        # Reference ratios are diagnostics, NOT a correction: observed
        # Frontier differences can include first discovery, full-system,
        # Powerplay and sale-context factors that vary by system.
        # Do not silently multiply unrelated worlds by a global factor.
        median_reference_ratio = ratios[len(ratios) // 2] if len(ratios) >= 3 else None
        bio_rows = [_biological_opportunity(body) for body in bodies]
        bio_rows = [row for row in bio_rows if row is not None]
        # Confirmed sale accounting is independent from UC cartographics.
        bio_sales = conn.execute(
            "SELECT COALESCE(SUM(base),0) AS base, COALESCE(SUM(bonus),0) AS bonus, "
            "COUNT(*) AS count FROM bio_sales WHERE commander=?", (commander,)
        ).fetchone()
        current_raw = sum(known_current) if known_current else None
        estimated_quote = current_raw
        return {
            "schemaVersion": 1,
            "exobiology": {
                "source": "frontier_journal_local",
                "model": BIO_REFERENCE_MODEL,
                "valueCatalogComplete": False,
                "biologicalBodies": bio_rows[:60],
                "biologicalBodiesTruncated": max(0, len(bio_rows) - 60),
                "confirmedSalesLifetime": bio_sales["base"] + bio_sales["bonus"],
                "confirmedBaseLifetime": bio_sales["base"],
                "confirmedBonusLifetime": bio_sales["bonus"],
                "saleEvents": bio_sales["count"],
                "outstandingEstimate": None,
                "outstandingStatus": "not_reconciled_by_origin",
                "currentSystemCompletedEstimate": sum(row["estimatedCompleteBase"] for row in bio_rows),
                "currentSystemValuedCompletedCount": sum(row["knownValueCoverage"] for row in bio_rows),
                "note": "Species not identified until organic journal observation; genus and signals are separate evidence. Sales lack body identity.",
            },
            "source": "frontier_journal_local",
            "commander": commander,
            "system": current or None,
            "discoveryStatus": discovery,
            "intelligence": current.get("intelligence") if current else None,
            "eddiscoveryHistory": current.get("eddiscoveryHistory") if current else None,
            "explorationAlerts": current.get("explorationAlerts", []) if current else [],
            "knownBodies": len(bodies),
            "personallyScannedBodies": sum(bool(b.get("personallyScanned")) for b in bodies),
            "personallyMappedBodies": sum(bool(b.get("personallyMapped")) for b in bodies),
            "potentialFirstBodies": len(firsts),
            "currentSystemKnownEstimates": sum(known_current),
            "currentSystemEstimate": estimated_quote,
            "currentSystemBaseEstimate": current_raw,
            "currentSystemEstimateMeaning": (
                "observed_scans_excludes_unmeasured_system_completion_and_sale_modifiers"
            ),
            "cartographicsComparison": {
                "actualQuote": current_ref["observed_actual"] if current_ref else None,
                "modelAtQuote": current_ref["model_estimate"] if current_ref else None,
                "references": len(ratios),
                "diagnosticMedianRatio": round(median_reference_ratio, 4) if median_reference_ratio else None,
                "calibrationFactor": None,
                "calibrationReady": False,
                "calibrationStatus": "reference_only_pending_bonus_model_validation",
                "note": "Manual quotes are not proof of sold data or guaranteed future payouts",
            },
            "expedition": self._expedition_view(conn, commander, active),
            "currentSystemValueCoverage": len(known_current),
            "additionalMappingPotential": sum(b.get("mappingGainMax") or 0 for b in bodies),
            "additionalMappingPotentialMin": sum(b.get("mappingGainMin") or 0 for b in bodies),
            "additionalMappingPotentialMax": sum(b.get("mappingGainMax") or 0 for b in bodies),
            "mappingAdvisor": advisor,
            "confirmedSalesLifetime": sale_total,
            "confirmedSalesBasis": "Frontier journal TotalEarnings; may include bonuses",
            "unsoldEstimate": unsold if covered else None,
            "unsoldValueCoverage": covered,
            "unsoldEstimateStatus": (
                "incomplete_sale_reconciliation" if sale_total else
                "estimated_from_scanned_journal_bodies"
            ),
            "cartographicEstimateExcludes": [
                "system_completion_bonuses", "powerplay_or_station_modifiers",
                "sale_page_effects", "unscanned_bodies",
            ],
            "valueModel": MODEL,
            "valuesAreEstimates": True,
            "bodies": bodies[:40],
            "bodyCountTruncated": max(0, len(bodies)-40),
        }

