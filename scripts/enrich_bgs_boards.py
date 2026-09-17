#!/usr/bin/env python3
"""Enrich Mongrel BGS data with complete faction boards from EliteHub Vault / EDDN.

The existing update_bgs.py remains the authoritative Mongrel-presence updater. This
script independently resolves the Mongrel faction's current system UUIDs, then fetches
all faction-state rows for each active Mongrel system and writes them to a separate
snapshot. Keeping board data separate means a temporary board-enrichment failure can
preserve the last known full board without interfering with presence discovery.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LIVE_PATH = ROOT / "data" / "live-bgs.json"
BOARD_PATH = ROOT / "data" / "live-bgs-boards.json"
FACTION_NAME = "Regiment of Imperial Mongrels"
API_URL = "https://vault.elitehub.eu/graphql"
USER_AGENT = "MongrelsSquadronSite-BGS-Boards/1.1 (+Cloudflare Pages)"
API_KEY = os.getenv("ELITEHUB_VAULT_API_KEY", "").strip()
PRESENCE_PAGE_SIZE = 40
BOARD_BATCH_SIZE = 8
MAX_FACTIONS_PER_SYSTEM = 12
BOARD_REQUEST_PAUSE_SECONDS = 1.5
RATE_LIMIT_BACKOFF_SECONDS = (20, 40, 60)


class VaultRateLimitError(RuntimeError):
    """Raised only after Vault 429 retry/backoff has been exhausted."""


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def norm(value: Any) -> str:
    return str(value or "").strip().casefold()


def number(value: Any) -> float | None:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if 0 <= n <= 1:
        n *= 100
    return round(n, 2)


def states(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text or text.lower() == "none":
            return []
        # Be tolerant of legacy stringified arrays from older snapshots.
        if text.startswith("[") and text.endswith("]"):
            try:
                parsed = json.loads(text.replace("'", '"'))
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                pass
        return [part.strip() for part in text.split(",") if part.strip()]
    return []


def parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def newest_time(values: list[Any]) -> str | None:
    candidates: list[tuple[datetime, str]] = []
    for value in values:
        dt = parse_time(value)
        if dt:
            candidates.append((dt, str(value)))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


def retry_after_seconds(exc: urllib.error.HTTPError, fallback: int) -> int:
    raw = exc.headers.get("Retry-After") if exc.headers else None
    try:
        parsed = int(str(raw).strip()) if raw is not None else 0
    except (TypeError, ValueError):
        parsed = 0
    return max(fallback, parsed)


def gql(query: str, variables: dict[str, Any] | None = None, timeout: int = 25) -> dict[str, Any]:
    body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if API_KEY:
        headers["X-API-Key"] = API_KEY

    for attempt in range(len(RATE_LIMIT_BACKOFF_SECONDS) + 1):
        request = urllib.request.Request(API_URL, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if payload.get("errors"):
                message = "; ".join(str(item.get("message", item)) for item in payload["errors"])
                raise RuntimeError(f"GraphQL error: {message}")
            return payload.get("data") or {}
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read().decode("utf-8")[:500]
            except Exception:
                pass
            if exc.code == 429:
                if attempt < len(RATE_LIMIT_BACKOFF_SECONDS):
                    delay = retry_after_seconds(exc, RATE_LIMIT_BACKOFF_SECONDS[attempt])
                    print(
                        f"VAULT RATE LIMIT: waiting {delay}s before retry {attempt + 2}/{len(RATE_LIMIT_BACKOFF_SECONDS) + 1}",
                        flush=True,
                    )
                    time.sleep(delay)
                    continue
                raise VaultRateLimitError(f"Vault HTTP 429 after retries: {detail or exc.reason}") from exc
            raise RuntimeError(f"Vault HTTP {exc.code}: {detail or exc.reason}") from exc

    raise RuntimeError("Vault request retry loop exited unexpectedly")


FACTION_ID_QUERY = r"""
query MongrelFactionId($name: String!) {
  factionByName(name: $name) { id name }
}
"""

MONGREL_STATES_QUERY = r"""
query MongrelSystemIds($factionId: UUID!, $first: Int!, $after: Cursor) {
  factionStates(
    condition: { factionId: $factionId }
    orderBy: UPDATED_AT_DESC
    first: $first
    after: $after
  ) {
    edges {
      cursor
      node {
        influence
        activeStates
        pendingStates
        recoveringStates
        updatedAt
        system { id name }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
"""


def fetch_faction_id() -> str:
    data = gql(FACTION_ID_QUERY, {"name": FACTION_NAME})
    faction = data.get("factionByName")
    if not isinstance(faction, dict) or not faction.get("id"):
        raise RuntimeError(f"{FACTION_NAME} was not returned by Vault")
    return str(faction["id"])


def fetch_mongrel_states(faction_id: str) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    after: str | None = None
    page = 1
    while True:
        data = gql(
            MONGREL_STATES_QUERY,
            {"factionId": faction_id, "first": PRESENCE_PAGE_SIZE, "after": after},
        )
        connection = data.get("factionStates") or {}
        edges = connection.get("edges") if isinstance(connection, dict) else []
        batch = 0
        for edge in edges or []:
            node = edge.get("node") if isinstance(edge, dict) else None
            system = node.get("system") if isinstance(node, dict) else None
            if not isinstance(system, dict) or not system.get("id") or not system.get("name"):
                continue
            rows[norm(system["name"])] = {
                "systemId": str(system["id"]),
                "name": str(system["name"]),
                "mongrelInfluence": number(node.get("influence")),
                "mongrelActiveStates": states(node.get("activeStates")),
                "mongrelPendingStates": states(node.get("pendingStates")),
                "mongrelRecoveringStates": states(node.get("recoveringStates")),
                "mongrelUpdatedAt": node.get("updatedAt"),
            }
            batch += 1
        print(f"MONGREL PAGE {page}: {batch} systems (total {len(rows)})", flush=True)
        info = connection.get("pageInfo") if isinstance(connection, dict) else {}
        if not isinstance(info, dict) or not info.get("hasNextPage"):
            break
        next_cursor = info.get("endCursor")
        if not next_cursor or next_cursor == after:
            raise RuntimeError("Vault Mongrel-state pagination returned no usable next cursor")
        after = str(next_cursor)
        page += 1
        if page > 100:
            raise RuntimeError("Vault Mongrel-state pagination exceeded 100 pages")
    return rows


def build_board_query(batch: list[dict[str, Any]]) -> tuple[str, dict[str, str]]:
    declarations: list[str] = []
    selections: list[str] = []
    variables: dict[str, str] = {}
    for index, item in enumerate(batch):
        var = f"s{index}"
        alias = f"b{index}"
        declarations.append(f"${var}: UUID!")
        variables[var] = str(item["systemId"])
        selections.append(
            f"""{alias}: factionStates(condition: {{ systemId: ${var} }}, first: {MAX_FACTIONS_PER_SYSTEM}) {{
              nodes {{
                influence
                activeStates
                pendingStates
                recoveringStates
                updatedAt
                faction {{ name }}
              }}
            }}"""
        )
    query = "query MongrelFullBoards(" + ", ".join(declarations) + ") {\n" + "\n".join(selections) + "\n}"
    return query, variables


def normalize_board_node(node: dict[str, Any]) -> dict[str, Any] | None:
    faction = node.get("faction")
    name = faction.get("name") if isinstance(faction, dict) else None
    influence = number(node.get("influence"))
    if not name or influence is None:
        return None
    active = states(node.get("activeStates"))
    pending = states(node.get("pendingStates"))
    recovering = states(node.get("recoveringStates"))
    return {
        "name": str(name),
        "influence": influence,
        "state": ", ".join(active) if active else "None",
        "activeStates": active,
        "pendingStates": pending,
        "recoveringStates": recovering,
        "updatedAt": node.get("updatedAt"),
        "source": "EliteHub Vault / EDDN",
    }


def fetch_board_batch(batch: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    query, variables = build_board_query(batch)
    data = gql(query, variables)
    output: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(batch):
        alias = f"b{index}"
        connection = data.get(alias)
        nodes = connection.get("nodes") if isinstance(connection, dict) else []
        factions = [entry for entry in (normalize_board_node(node) for node in (nodes or [])) if entry]
        factions.sort(key=lambda row: (0 if norm(row["name"]) == norm(FACTION_NAME) else 1, row["name"].casefold()))
        output[norm(item["name"])] = {
            "name": item["name"],
            "systemId": item["systemId"],
            "updatedAt": newest_time([row.get("updatedAt") for row in factions]) or item.get("mongrelUpdatedAt"),
            "factionCount": len(factions),
            "factions": factions,
            "ok": bool(factions),
        }
    return output


def fetch_boards_adaptive(
    batch: list[dict[str, Any]],
    output: dict[str, dict[str, Any]],
    errors: list[dict[str, str]],
) -> None:
    if not batch:
        return
    try:
        output.update(fetch_board_batch(batch))
        print(f"BOARD BATCH: {len(batch)} systems", flush=True)
        time.sleep(BOARD_REQUEST_PAUSE_SECONDS)
    except VaultRateLimitError as exc:
        # Splitting a batch cannot cure an exhausted request-window limit; preserve
        # prior rows and allow the next scheduled cycle to fill any remaining gap.
        for item in batch:
            name = str(item.get("name") or "unknown")
            errors.append({"name": name, "error": str(exc)[:500]})
        print(f"BOARD RATE-LIMIT ERR: {len(batch)} systems deferred after retries", flush=True)
    except Exception as exc:
        if len(batch) == 1:
            name = str(batch[0].get("name") or "unknown")
            errors.append({"name": name, "error": str(exc)[:500]})
            print(f"BOARD ERR {name}: {exc}", flush=True)
            return
        middle = len(batch) // 2
        print(f"BOARD BATCH RETRY: splitting {len(batch)} after {exc}", flush=True)
        fetch_boards_adaptive(batch[:middle], output, errors)
        fetch_boards_adaptive(batch[middle:], output, errors)


def write_failure(existing: dict[str, Any], error: str, live_generated_at: str | None) -> int:
    now_iso = iso(utc_now())
    output = dict(existing) if isinstance(existing, dict) else {}
    output.update({
        "generatedAt": now_iso,
        "source": "EliteHub Vault / EDDN",
        "faction": FACTION_NAME,
        "sourcePresenceGeneratedAt": live_generated_at,
        "syncOk": False,
        "errors": [{"name": "vault", "error": error[:500]}],
    })
    output.setdefault("systems", {})
    BOARD_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


def main() -> int:
    live = load_json(LIVE_PATH, {"systems": []})
    existing = load_json(BOARD_PATH, {"systems": {}})
    active_rows = [
        row for row in (live.get("systems") or [])
        if isinstance(row, dict) and row.get("name") and row.get("present") is not False and not row.get("formerPresence")
    ]
    active_names = {norm(row["name"]): str(row["name"]) for row in active_rows}
    print(f"Preparing full boards for {len(active_names)} active Mongrel systems...", flush=True)

    try:
        faction_id = fetch_faction_id()
        mongrel_states = fetch_mongrel_states(faction_id)
    except Exception as exc:
        print(f"BOARD DISCOVERY ERR: {exc}", flush=True)
        return write_failure(existing, str(exc), live.get("generatedAt"))

    targets: list[dict[str, Any]] = []
    discovery_errors: list[dict[str, str]] = []
    for key, display_name in active_names.items():
        state = mongrel_states.get(key)
        if not state:
            discovery_errors.append({"name": display_name, "error": "No current Mongrel faction-state row returned by Vault"})
            continue
        targets.append(state)

    fetched: dict[str, dict[str, Any]] = {}
    errors = list(discovery_errors)
    for start in range(0, len(targets), BOARD_BATCH_SIZE):
        fetch_boards_adaptive(targets[start:start + BOARD_BATCH_SIZE], fetched, errors)

    now_iso = iso(utc_now())
    previous_systems = existing.get("systems") if isinstance(existing, dict) else {}
    if not isinstance(previous_systems, dict):
        previous_systems = {}

    merged: dict[str, dict[str, Any]] = {}
    successful = 0
    for key, display_name in active_names.items():
        board = fetched.get(key)
        if board and board.get("ok"):
            board["fetchedAt"] = now_iso
            board["lastAttemptAt"] = now_iso
            board["stale"] = False
            merged[display_name] = board
            successful += 1
            continue

        previous = previous_systems.get(display_name)
        if not previous:
            # Be tolerant of case-only naming differences in existing data.
            previous = next((value for name, value in previous_systems.items() if norm(name) == key), None)
        if isinstance(previous, dict) and previous.get("factions"):
            retained = dict(previous)
            retained.update({"name": display_name, "ok": False, "stale": True, "lastAttemptAt": now_iso})
            merged[display_name] = retained
        else:
            merged[display_name] = {
                "name": display_name,
                "systemId": (mongrel_states.get(key) or {}).get("systemId"),
                "updatedAt": None,
                "factionCount": 0,
                "factions": [],
                "ok": False,
                "stale": True,
                "fetchedAt": None,
                "lastAttemptAt": now_iso,
            }

    output = {
        "generatedAt": now_iso,
        "source": "EliteHub Vault / EDDN",
        "faction": FACTION_NAME,
        "sourcePresenceGeneratedAt": live.get("generatedAt"),
        "syncOk": successful == len(active_names),
        "successfulSystems": successful,
        "requestedSystems": len(active_names),
        "errors": errors[:50],
        "systems": merged,
    }
    BOARD_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WROTE FULL BOARDS: {successful}/{len(active_names)} systems; {len(errors)} errors", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
