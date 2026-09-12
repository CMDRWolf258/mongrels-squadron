#!/usr/bin/env python3
"""Refresh Mongrel BGS snapshots from EliteHub Vault / EDDN.

This version queries the *faction* first (using Vault's documented
`factionByName` root query), then reads the faction's system-presence relation.
The presence connection is fetched in small Relay-style pages so each GraphQL
request stays below Vault's anonymous query-cost ceiling.

Strategic targets remain in data/systems.json. Only observed public game data is
written to data/live-bgs.json. Previous good values are retained if a system is
missing or Vault is temporarily unavailable.
"""
from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "systems.json"
LIVE_PATH = ROOT / "data" / "live-bgs.json"
FACTION_NAME = "Regiment of Imperial Mongrels"
API_URL = "https://vault.elitehub.eu/graphql"
USER_AGENT = "MongrelsSquadronSite-BGS/3.1 (+GitHub Pages)"
API_KEY = os.getenv("ELITEHUB_VAULT_API_KEY", "").strip()


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


def gql(query: str, variables: dict[str, Any] | None = None, timeout: int = 20) -> dict[str, Any]:
    body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    request = urllib.request.Request(API_URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("errors"):
        msg = "; ".join(str(e.get("message", e)) for e in payload["errors"])
        raise RuntimeError(f"GraphQL error: {msg}")
    return payload.get("data") or {}


INTROSPECTION = r"""
query MongrelsSchema {
  __schema {
    queryType { name }
    types {
      kind
      name
      fields(includeDeprecated: true) {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType { kind name }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType { kind name }
            }
          }
        }
      }
    }
  }
}
"""


def unwrap_type(ref: dict[str, Any] | None) -> tuple[str | None, str | None]:
    cur = ref or {}
    outer = cur.get("kind")
    while cur and cur.get("kind") in {"NON_NULL", "LIST"}:
        cur = cur.get("ofType") or {}
    return cur.get("name"), outer


def is_list_ref(ref: dict[str, Any] | None) -> bool:
    cur = ref or {}
    while cur:
        if cur.get("kind") == "LIST":
            return True
        cur = cur.get("ofType") or {}
    return False


class Schema:
    def __init__(self, data: dict[str, Any]):
        schema = data["__schema"]
        self.query_type = schema["queryType"]["name"]
        self.types = {t["name"]: t for t in schema["types"] if t.get("name")}

    def fields(self, type_name: str) -> list[dict[str, Any]]:
        return self.types.get(type_name, {}).get("fields") or []

    def field(self, type_name: str, field_name: str) -> dict[str, Any] | None:
        return next((f for f in self.fields(type_name) if f.get("name") == field_name), None)

    def kind(self, type_name: str | None) -> str | None:
        return self.types.get(type_name or "", {}).get("kind")


def find_faction_query(schema: Schema) -> tuple[str, str]:
    fields = schema.fields(schema.query_type)
    # Documented Vault query; keep fallback in case it is renamed in a 0.x release.
    for preferred in ("factionByName",):
        f = next((x for x in fields if x.get("name") == preferred), None)
        if f:
            t, _ = unwrap_type(f.get("type"))
            return preferred, t or ""
    for f in fields:
        arg_names = {a.get("name") for a in f.get("args") or []}
        t, _ = unwrap_type(f.get("type"))
        if "name" in arg_names and "faction" in norm(t):
            return f["name"], t or ""
    raise RuntimeError("Could not discover Vault's faction-by-name query")


def relation_node_type(schema: Schema, field: dict[str, Any]) -> tuple[str, str]:
    base, _ = unwrap_type(field.get("type"))
    if not base:
        raise RuntimeError("relation had no output type")
    edges = schema.field(base, "edges")
    if edges:
        edge_type, _ = unwrap_type(edges.get("type"))
        node = schema.field(edge_type or "", "node")
        node_type, _ = unwrap_type(node.get("type") if node else None)
        if node_type:
            return "connection", node_type
    if is_list_ref(field.get("type")):
        return "list", base
    return "direct", base


def find_presence_relation(schema: Schema, faction_type: str) -> tuple[dict[str, Any], str, str]:
    ranked: list[tuple[int, dict[str, Any], str, str]] = []
    for f in schema.fields(faction_type):
        try:
            mode, node_type = relation_node_type(schema, f)
        except Exception:
            continue
        node_fields = schema.fields(node_type)
        names = {norm(x.get("name")) for x in node_fields}
        lname = norm(f.get("name"))

        has_influence = any("influence" in n for n in names)
        has_system = any(n == "system" or "system" in n for n in names)
        if not (has_influence and has_system):
            continue

        score = 0
        if "presence" in lname:
            score += 20
        if "system" in lname:
            score += 8
        if "faction" in lname:
            score += 4
        score += 20  # influence + system found on node
        ranked.append((score, f, mode, node_type))

    if not ranked:
        # Give us useful diagnostics in the Action output.
        candidates = []
        for f in schema.fields(faction_type):
            try:
                mode, node_type = relation_node_type(schema, f)
                child_names = [x.get("name") for x in schema.fields(node_type)]
                if child_names:
                    candidates.append(f"{f.get('name')} -> {node_type}: {','.join(child_names[:12])}")
            except Exception:
                pass
        suffix = " | ".join(candidates[:8])
        raise RuntimeError(f"Could not discover faction-presence relation on {faction_type}. Candidates: {suffix}")

    _, field, mode, node_type = max(ranked, key=lambda x: x[0])
    return field, mode, node_type


def scalar_field(schema: Schema, type_name: str, needles: tuple[str, ...]) -> str | None:
    for f in schema.fields(type_name):
        base, _ = unwrap_type(f.get("type"))
        if schema.kind(base) in {"SCALAR", "ENUM"} and any(n in norm(f.get("name")) for n in needles):
            return f["name"]
    return None


def object_field_with_name(schema: Schema, type_name: str, needles: tuple[str, ...]) -> tuple[str, str] | None:
    for f in schema.fields(type_name):
        if not any(n in norm(f.get("name")) for n in needles):
            continue
        base, _ = unwrap_type(f.get("type"))
        if base and schema.field(base, "name"):
            return f["name"], base
    return None


def relation_paging(field: dict[str, Any]) -> dict[str, bool]:
    args = {a.get("name") for a in field.get("args") or []}
    return {
        "first": "first" in args,
        "after": "after" in args,
        "limit": "limit" in args,
        "offset": "offset" in args,
    }


def relation_args(field: dict[str, Any], page_size: int = 20, use_after: bool = False) -> str:
    paging = relation_paging(field)
    parts: list[str] = []
    if paging["first"]:
        parts.append(f"first: {page_size}")
        if use_after and paging["after"]:
            parts.append("after: $after")
    elif paging["limit"]:
        parts.append(f"limit: {page_size}")
        if use_after and paging["offset"]:
            parts.append("offset: $offset")
    return f"({', '.join(parts)})" if parts else ""


def build_presence_selection(schema: Schema, relation: dict[str, Any], mode: str, node_type: str) -> tuple[str, dict[str, str]]:
    influence = scalar_field(schema, node_type, ("influence",))
    if not influence:
        raise RuntimeError(f"Could not discover influence field on {node_type}")

    sys_obj = object_field_with_name(schema, node_type, ("system",))
    if not sys_obj:
        raise RuntimeError(f"Could not discover system object on {node_type}")
    system_field, system_type = sys_obj

    node_select = [influence, f"{system_field} {{ name }}"]
    meta: dict[str, str] = {
        "relation": relation["name"],
        "mode": mode,
        "influence": influence,
        "system": system_field,
    }

    # Presence-level state/freshness fields.
    for semantic, needles in {
        "updated": ("updated", "timestamp", "date"),
        "happiness": ("happiness",),
    }.items():
        val = scalar_field(schema, node_type, needles)
        if val:
            node_select.append(val)
            meta[semantic] = val

    # State may be scalar/enum or nested object/list. Add safe scalar state first.
    state_scalar = scalar_field(schema, node_type, ("state",))
    if state_scalar:
        node_select.append(state_scalar)
        meta["state"] = state_scalar

    # System metadata, selected inside the nested system object.
    system_select = ["name"]
    controller = object_field_with_name(schema, system_type, ("controllingfaction", "controller", "controlling"))
    if controller:
        controller_field, _ = controller
        system_select.append(f"{controller_field} {{ name }}")
        meta["controller"] = controller_field
    for semantic, needles in {
        "security": ("security",),
        "population": ("population",),
        "systemUpdated": ("updated", "timestamp", "date"),
    }.items():
        val = scalar_field(schema, system_type, needles)
        if val:
            system_select.append(val)
            meta[semantic] = val

    # Replace the simple `system { name }` entry with the richer selection.
    node_select = [x for x in node_select if not x.startswith(system_field + " {")]
    node_select.append(f"{system_field} {{ {' '.join(dict.fromkeys(system_select))} }}")

    body = " ".join(dict.fromkeys(node_select))
    args = relation_args(relation, page_size=20, use_after=True)
    if mode == "connection":
        selection = f"{relation['name']}{args} {{ edges {{ node {{ {body} }} cursor }} pageInfo {{ hasNextPage endCursor }} }}"
    elif mode == "list":
        selection = f"{relation['name']}{args} {{ {body} }}"
    else:
        selection = f"{relation['name']}{args} {{ {body} }}"
    return selection, meta


def extract_nodes(faction: dict[str, Any], relation: str, mode: str) -> list[dict[str, Any]]:
    value = faction.get(relation)
    if mode == "connection":
        edges = value.get("edges", []) if isinstance(value, dict) else []
        return [e.get("node") for e in edges if isinstance(e, dict) and isinstance(e.get("node"), dict)]
    if mode == "list":
        return [x for x in (value or []) if isinstance(x, dict)]
    return [value] if isinstance(value, dict) else []


def page_info(faction: dict[str, Any], relation: str) -> dict[str, Any]:
    value = faction.get(relation)
    if not isinstance(value, dict):
        return {}
    info = value.get("pageInfo")
    return info if isinstance(info, dict) else {}


def fail_with_existing(existing: dict[str, Any], names: list[str], error: str) -> int:
    output = dict(existing) if isinstance(existing, dict) else {"systems": []}
    output.update({
        "generatedAt": iso(utc_now()),
        "source": "EliteHub Vault / EDDN",
        "faction": FACTION_NAME,
        "refreshInterval": "Every 2 hours",
        "successfulSystems": 0,
        "requestedSystems": len(names),
        "errors": [{"name": "vault", "error": error}],
    })
    LIVE_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


def main() -> int:
    config = load_json(CONFIG_PATH, {})
    existing = load_json(LIVE_PATH, {"systems": []})
    old_by_name = {
        row.get("name"): row
        for row in existing.get("systems", [])
        if isinstance(row, dict) and row.get("name")
    }
    names = [row.get("name") for row in config.get("systems", []) if isinstance(row, dict) and row.get("name")]
    tracked = {norm(n): n for n in names}

    print("Discovering EliteHub Vault faction-presence schema...", flush=True)
    try:
        schema = Schema(gql(INTROSPECTION, timeout=20))
        query_name, faction_type = find_faction_query(schema)
        relation, mode, node_type = find_presence_relation(schema, faction_type)
        selection, meta = build_presence_selection(schema, relation, mode, node_type)
        print(f"SCHEMA faction query: {query_name} -> {faction_type}", flush=True)
        print(f"SCHEMA presence relation: {relation['name']} ({mode}, node {node_type})", flush=True)
        print(f"SCHEMA influence field: {meta['influence']}", flush=True)
        print(f"SCHEMA system field: {meta['system']}", flush=True)
    except Exception as exc:
        print(f"SCHEMA ERR: {exc}", flush=True)
        return fail_with_existing(existing, names, str(exc))

    paging = relation_paging(relation)
    if meta["mode"] == "connection" and paging["first"] and paging["after"]:
        query = f"query MongrelsFaction($name: String!, $after: String) {{ {query_name}(name: $name) {{ id name {selection} }} }}"
    else:
        query = f"query MongrelsFaction($name: String!) {{ {query_name}(name: $name) {{ id name {selection} }} }}"

    print(f"Fetching known presences for {FACTION_NAME} in low-cost pages...", flush=True)
    try:
        nodes: list[dict[str, Any]] = []
        after: str | None = None
        page = 1
        # The squad currently tracks only a handful of priority systems, but the
        # faction has 200+ presences. Walk the whole connection in cheap pages so
        # any tracked system can be found without exceeding the query-cost cap.
        while True:
            variables: dict[str, Any] = {"name": FACTION_NAME}
            if "$after" in query:
                variables["after"] = after
            data = gql(query, variables, timeout=20)
            faction = data.get(query_name)
            if not isinstance(faction, dict):
                raise RuntimeError(f"{FACTION_NAME} was not returned by Vault")
            batch = extract_nodes(faction, meta["relation"], meta["mode"])
            nodes.extend(batch)
            print(f"PAGE  {page}: {len(batch)} rows (total {len(nodes)})", flush=True)

            if meta["mode"] != "connection" or "$after" not in query:
                break
            info = page_info(faction, meta["relation"])
            if not info.get("hasNextPage"):
                break
            next_cursor = info.get("endCursor")
            if not next_cursor or next_cursor == after:
                raise RuntimeError("Vault pagination reported another page but returned no usable endCursor")
            after = str(next_cursor)
            page += 1
            if page > 100:
                raise RuntimeError("Vault pagination exceeded 100 pages; stopping defensively")

        print(f"VAULT returned {len(nodes)} faction presence rows", flush=True)
    except Exception as exc:
        print(f"FETCH ERR: {exc}", flush=True)
        return fail_with_existing(existing, names, str(exc))

    found: dict[str, dict[str, Any]] = {}
    for node in nodes:
        system = node.get(meta["system"])
        if not isinstance(system, dict):
            continue
        system_name = system.get("name")
        canonical = tracked.get(norm(system_name))
        if not canonical:
            continue

        influence = number(node.get(meta["influence"]))
        if influence is None:
            continue

        controller = None
        if meta.get("controller"):
            obj = system.get(meta["controller"])
            controller = obj.get("name") if isinstance(obj, dict) else obj

        state = node.get(meta.get("state")) if meta.get("state") else None
        if not state or norm(state) in {"none", "$faction_state_none;"}:
            state = "None"

        source_updated = None
        for key in (meta.get("updated"), meta.get("systemUpdated")):
            value = (node.get(key) if key and key in node else system.get(key) if key else None)
            if isinstance(value, str):
                source_updated = max(source_updated or value, value)

        found[canonical] = {
            "name": canonical,
            "influence": influence,
            "controlled": norm(controller) == norm(FACTION_NAME) if controller else None,
            "control": controller,
            "state": str(state),
            "activeStates": [] if state == "None" else [str(state)],
            "pendingStates": [],
            "recoveringStates": [],
            "security": system.get(meta.get("security")) if meta.get("security") else None,
            "population": system.get(meta.get("population")) if meta.get("population") else None,
            "sourceUpdated": source_updated,
            "source": "EliteHub Vault / EDDN",
            "fetchedAt": iso(utc_now()),
            "stale": False,
            "ok": True,
        }

    errors: list[dict[str, str]] = []
    refreshed: list[dict[str, Any]] = []
    for name in names:
        if name in found:
            row = found[name]
            refreshed.append(row)
            print(f"OK    {name}: {row['influence']:.2f}%", flush=True)
        else:
            msg = "tracked system was not present in Vault's faction presence response"
            print(f"MISS  {name}: {msg}", flush=True)
            errors.append({"name": name, "error": msg})
            previous = old_by_name.get(name)
            if previous:
                stale = dict(previous)
                stale["ok"] = False
                stale["stale"] = True
                refreshed.append(stale)

    output = {
        "generatedAt": iso(utc_now()),
        "source": "EliteHub Vault / EDDN",
        "faction": FACTION_NAME,
        "refreshInterval": "Every 2 hours",
        "successfulSystems": sum(1 for row in refreshed if row.get("ok") is True),
        "requestedSystems": len(names),
        "vaultPresenceRows": len(nodes),
        "errors": errors,
        "systems": refreshed,
    }
    LIVE_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
