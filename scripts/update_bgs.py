#!/usr/bin/env python3
"""Refresh public Mongrel BGS snapshots from EliteBGS.

Strategic targets stay in data/systems.json. This script only writes observed
public game data to data/live-bgs.json. Existing live values are retained when
an upstream request fails, so a temporary API outage does not blank the site.
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "systems.json"
LIVE_PATH = ROOT / "data" / "live-bgs.json"
FACTION_NAME = "Regiment of Imperial Mongrels"
API_BASE = "https://elitebgs.app/api/ebgs/v5/systems"
USER_AGENT = "MongrelsSquadronSite-BGS/1.0 (+GitHub Pages)"


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch_json(url: str, attempts: int = 3) -> Any:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # upstream/network errors are expected occasionally
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"request failed after {attempts} attempts: {last_error}")


def iter_dicts(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_dicts(child)


def norm(value: Any) -> str:
    return str(value or "").strip().casefold()


def get_first(mapping: dict[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        if key in mapping and mapping[key] not in (None, "", []):
            return mapping[key]
    return None


def faction_name_from(obj: dict[str, Any]) -> str | None:
    value = get_first(obj, ("faction_name", "factionName", "name"))
    if isinstance(value, str):
        return value
    faction = obj.get("faction")
    if isinstance(faction, str):
        return faction
    if isinstance(faction, dict):
        nested = get_first(faction, ("name", "faction_name", "factionName"))
        return nested if isinstance(nested, str) else None
    return None


def find_faction_record(payload: Any, faction_name: str) -> dict[str, Any] | None:
    target = norm(faction_name)
    candidates: list[tuple[int, dict[str, Any]]] = []
    for obj in iter_dicts(payload):
        if norm(faction_name_from(obj)) != target:
            continue
        score = 0
        for key in ("influence", "state", "active_states", "activeStates", "updated_at", "updatedAt"):
            if key in obj:
                score += 1
        candidates.append((score, obj))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


def number(value: Any) -> float | None:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    # EliteBGS influence is normally 0..1. Accept percent-shaped responses too.
    if 0 <= n <= 1:
        n *= 100
    return round(n, 2)


def state_names(value: Any) -> list[str]:
    if value in (None, "", []):
        return []
    if isinstance(value, str):
        return [] if norm(value) in {"none", "$faction_state_none;"} else [value]
    if isinstance(value, dict):
        name = get_first(value, ("name", "state", "state_name", "stateName"))
        return [str(name)] if name else []
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(state_names(item))
        # preserve order, remove duplicates
        return list(dict.fromkeys(result))
    return []


def controller_name(system_doc: dict[str, Any]) -> str | None:
    raw = get_first(
        system_doc,
        (
            "controlling_minor_faction",
            "controllingMinorFaction",
            "controlling_faction",
            "controllingFaction",
            "faction",
        ),
    )
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        value = get_first(raw, ("name", "faction_name", "factionName"))
        return str(value) if value else None
    return None


def newest_timestamp(payload: Any) -> str | None:
    values: list[str] = []
    for obj in iter_dicts(payload):
        value = get_first(obj, ("updated_at", "updatedAt", "timestamp", "date"))
        if isinstance(value, str):
            values.append(value)
    # ISO timestamps sort lexically when consistently formatted; this is only display metadata.
    return max(values) if values else None


def choose_system_doc(payload: Any, system_name: str) -> dict[str, Any] | None:
    docs = payload.get("docs") if isinstance(payload, dict) else None
    if not isinstance(docs, list):
        docs = payload if isinstance(payload, list) else []
    exact = [d for d in docs if isinstance(d, dict) and norm(d.get("name")) == norm(system_name)]
    if exact:
        return exact[0]
    return next((d for d in docs if isinstance(d, dict)), None)


def fetch_system(system_name: str) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {
            "name": system_name,
            "factionDetails": "true",
            "count": "1",
        }
    )
    payload = fetch_json(f"{API_BASE}?{query}")
    system_doc = choose_system_doc(payload, system_name)
    if not system_doc:
        raise RuntimeError("system was not returned by EliteBGS")

    faction = find_faction_record(system_doc, FACTION_NAME)
    if not faction:
        raise RuntimeError(f"{FACTION_NAME} was not found in the system response")

    influence = number(get_first(faction, ("influence", "influence_pct", "influencePct")))
    if influence is None:
        raise RuntimeError("faction influence was missing from the response")

    active = state_names(get_first(faction, ("active_states", "activeStates")))
    if not active:
        active = state_names(get_first(faction, ("state", "faction_state", "factionState")))

    pending = state_names(get_first(faction, ("pending_states", "pendingStates")))
    recovering = state_names(get_first(faction, ("recovering_states", "recoveringStates")))

    controller = controller_name(system_doc)
    if not controller:
        flag = get_first(faction, ("is_controlling_faction", "isControllingFaction", "controlling"))
        if flag is True:
            controller = FACTION_NAME

    security = get_first(system_doc, ("security", "security_level", "securityLevel"))
    population = get_first(system_doc, ("population",))

    return {
        "name": system_name,
        "influence": influence,
        "controlled": norm(controller) == norm(FACTION_NAME) if controller else None,
        "control": controller,
        "state": ", ".join(active) if active else "None",
        "activeStates": active,
        "pendingStates": pending,
        "recoveringStates": recovering,
        "security": security,
        "population": population,
        "sourceUpdated": newest_timestamp(system_doc),
        "source": "EliteBGS",
        "ok": True,
    }


def main() -> int:
    config = load_json(CONFIG_PATH, {})
    existing = load_json(LIVE_PATH, {"systems": []})
    old_by_name = {
        row.get("name"): row
        for row in existing.get("systems", [])
        if isinstance(row, dict) and row.get("name")
    }

    names = [row.get("name") for row in config.get("systems", []) if isinstance(row, dict) and row.get("name")]
    refreshed: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for name in names:
        try:
            row = fetch_system(name)
            row["fetchedAt"] = iso(utc_now())
            refreshed.append(row)
            print(f"OK  {name}: {row['influence']:.2f}%")
        except Exception as exc:
            print(f"ERR {name}: {exc}")
            errors.append({"name": name, "error": str(exc)})
            previous = old_by_name.get(name)
            if previous:
                stale = dict(previous)
                stale["ok"] = False
                stale["stale"] = True
                refreshed.append(stale)

    now = utc_now()
    output = {
        "generatedAt": iso(now),
        "source": "EliteBGS",
        "faction": FACTION_NAME,
        "refreshInterval": "Every 2 hours",
        "successfulSystems": sum(1 for row in refreshed if row.get("ok") is True),
        "requestedSystems": len(names),
        "errors": errors,
        "systems": refreshed,
    }
    LIVE_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Do not fail the workflow simply because the upstream service is temporarily down.
    # We still commit metadata/stale flags and the website keeps the last good snapshot.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
