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
from pathlib import Path
from typing import Any, Mapping

SURVEY_EVENTS = frozenset({
    "FSDJump", "Location", "CarrierJump", "FSSDiscoveryScan",
    "FSSAllBodiesFound", "Scan", "SAAScanComplete", "FSSBodySignals",
    "SAASignalsFound", "SellExplorationData", "MultiSellExplorationData",
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
MODEL = "community-formula-odyssey-provisional-v2"


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
    """Community-derived estimate; excludes honk and full-system bonuses.

    Terraformable bonus is only a *maximum approximation* and can vary
    significantly in the game, particularly for water worlds.
    """
    star = body.get("starType")
    mass = _number(body.get("stellarMass") if star else body.get("massEM"))
    if mass is None or mass <= 0:
        return None
    if star:
        kind = _text(star).upper()
        k = 22628 if kind in {"N", "H"} else 14057 if kind.startswith("D") else 1200
        base = k + mass * k / 66.25
    else:
        planet = _text(body.get("planetClass"))
        k, terraform_k = PLANET_K.get(planet, (300, 93328 if planet == "Rocky body" else 0))
        if planet == "Earthlike body" or body.get("terraformState") == "Terraformable":
            k += terraform_k
        base = k * (1 + Q * mass ** 0.2)
    first = body.get("wasDiscovered") is False
    first_mapped = body.get("wasMapped") is False
    if mapped:
        if first and first_mapped:
            base *= 3.699622554
        elif first_mapped:
            base *= 8.0956
        else:
            base *= 3.3333333333
        base += max(base * 0.3, 555)
        if efficient:
            base *= 1.25
    if first:
        base *= 2.6
    return max(500, round(base))


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

    def apply(self, commander: str, event: Mapping[str, Any], fallback_system: str = "",
              fallback_address: Any = None, *, historic: bool = False) -> dict[str, Any] | None:
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
            if not address:
                return self._snapshot(conn, commander, active)
            system = self._load(conn, "systems", commander, address)
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
            if kind in {"Scan", "SAAScanComplete", "FSSBodySignals", "SAASignalsFound"}:
                raw_id = event.get("BodyID")
                body_id = _text(raw_id) if raw_id is not None else ""
                if body_id:
                    body = self._load(conn, "bodies", commander, address, body_id)
                    body["bodyId"] = body_id
                    body["systemAddress"] = address
                    body["name"] = _text(event.get("BodyName")) or body.get("name", "")
                    if kind == "Scan":
                        for src, dest in (
                            ("PlanetClass", "planetClass"), ("StarType", "starType"),
                            ("TerraformState", "terraformState"), ("DistanceFromArrivalLS", "distanceLs"),
                            ("MassEM", "massEM"), ("StellarMass", "stellarMass"),
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
                    else:
                        signals = event.get("Signals")
                        if isinstance(signals, list):
                            body["signals"] = [
                                {"type": _text(s.get("Type_Localised") or s.get("Type")),
                                 "count": _int(s.get("Count"))}
                                for s in signals if isinstance(s, Mapping)
                            ]
                    self._save(conn, "bodies", commander, address, body, body_id)
                    revalue_systems.add(address)
            self._save(conn, "systems", commander, address, system)
            for touched in revalue_systems:
                self._revalue_system(conn, commander, touched)
            # Bulk historical replay must not calculate an all-system HUD
            # snapshot on every journal line; one snapshot after import is
            # sufficient and avoids work scaling quadratically with history.
            if historic:
                return {"imported": True}
            return self._snapshot(conn, commander, active or address)

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
        return {
            "schemaVersion": 1,
            "source": "frontier_journal_local",
            "commander": commander,
            "system": current or None,
            "discoveryStatus": discovery,
            "intelligence": current.get("intelligence") if current else None,
            "knownBodies": len(bodies),
            "personallyScannedBodies": sum(bool(b.get("personallyScanned")) for b in bodies),
            "personallyMappedBodies": sum(bool(b.get("personallyMapped")) for b in bodies),
            "potentialFirstBodies": len(firsts),
            "currentSystemKnownEstimates": sum(known_current),
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

