#!/usr/bin/env python3
"""Refresh public Mongrel BGS snapshots from EliteHub Vault / EDDN.

Strategic targets stay in data/systems.json. This script only writes observed
public game data to data/live-bgs.json. Existing good values are retained when
Vault is unavailable or a tracked system cannot be refreshed.

The Vault API is currently in a 0.x release line, so this client discovers the
relevant GraphQL fields with schema introspection instead of hard-coding every
relationship name. That makes minor schema renames less likely to break the
site.
"""
from __future__ import annotations

import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "data" / "systems.json"
LIVE_PATH = ROOT / "data" / "live-bgs.json"
FACTION_NAME = "Regiment of Imperial Mongrels"
API_URL = "https://vault.elitehub.eu/graphql"
USER_AGENT = "MongrelsSquadronSite-BGS/2.0 (+GitHub Pages)"
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


def gql(query: str, variables: dict[str, Any] | None = None, timeout: int = 15) -> dict[str, Any]:
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
              ofType {
                kind
                name
                ofType { kind name }
              }
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


def find_system_query(schema: Schema) -> tuple[str, str]:
    fields = schema.fields(schema.query_type)
    preferred = ["systemByName", "starSystemByName"]
    for name in preferred:
        f = next((x for x in fields if x["name"] == name), None)
        if f:
            t, _ = unwrap_type(f["type"])
            return name, t or ""

    # Fallback: a query taking a `name` argument and returning a System-like type.
    for f in fields:
        arg_names = {a["name"] for a in f.get("args") or []}
        t, _ = unwrap_type(f["type"])
        if "name" in arg_names and "system" in norm(t):
            return f["name"], t or ""
    raise RuntimeError("Could not discover a system-by-name query in Vault schema")


def node_type_for_relation(schema: Schema, field: dict[str, Any]) -> tuple[str, str]:
    """Return (mode, node_type): direct/list or connection."""
    base, _ = unwrap_type(field["type"])
    if not base:
        raise RuntimeError("relation had no output type")
    edges = schema.field(base, "edges")
    if edges:
        edge_type, _ = unwrap_type(edges["type"])
        node = schema.field(edge_type or "", "node")
        node_type, _ = unwrap_type(node["type"] if node else None)
        if node_type:
            return "connection", node_type
    if is_list_ref(field["type"]):
        return "list", base
    return "direct", base


def find_presence_field(schema: Schema, system_type: str) -> tuple[dict[str, Any], str, str]:
    fields = schema.fields(system_type)
    ranked: list[tuple[int, dict[str, Any], str, str]] = []
    for f in fields:
        lname = norm(f["name"])
        if "faction" not in lname and "presence" not in lname:
            continue
        try:
            mode, node_type = node_type_for_relation(schema, f)
        except RuntimeError:
            continue
        node_names = {norm(x["name"]) for x in schema.fields(node_type)}
        score = 0
        if "presence" in lname:
            score += 8
        if "faction" in lname:
            score += 4
        if any("influence" in n for n in node_names):
            score += 10
        if any(n == "faction" or "faction" in n for n in node_names):
            score += 6
        if score:
            ranked.append((score, f, mode, node_type))
    if not ranked:
        raise RuntimeError(f"Could not discover faction-presence relation on {system_type}")
    _, f, mode, node_type = max(ranked, key=lambda x: x[0])
    return f, mode, node_type


def scalar_field_names(schema: Schema, type_name: str, needles: tuple[str, ...]) -> list[str]:
    out: list[str] = []
    for f in schema.fields(type_name):
        base, _ = unwrap_type(f["type"])
        kind = schema.kind(base)
        if kind in {"SCALAR", "ENUM"} and any(n in norm(f["name"]) for n in needles):
            out.append(f["name"])
    return out


def object_name_selection(schema: Schema, field: dict[str, Any]) -> str | None:
    base, _ = unwrap_type(field["type"])
    if schema.field(base or "", "name"):
        return f"{field['name']} {{ name }}"
    return None


def build_query_parts(schema: Schema, system_type: str, presence_field: dict[str, Any], mode: str, node_type: str) -> tuple[str, dict[str, str]]:
    node_fields = schema.fields(node_type)
    node_names = {f["name"]: f for f in node_fields}

    faction_field = next((f for f in node_fields if norm(f["name"]) == "faction"), None)
    if not faction_field:
        faction_field = next((f for f in node_fields if "faction" in norm(f["name"]) and schema.kind(unwrap_type(f["type"])[0]) == "OBJECT"), None)
    if not faction_field:
        raise RuntimeError(f"Could not discover faction object on {node_type}")

    influence_field = next((f for f in node_fields if "influence" in norm(f["name"]) and schema.kind(unwrap_type(f["type"])[0]) in {"SCALAR", "ENUM"}), None)
    if not influence_field:
        raise RuntimeError(f"Could not discover influence field on {node_type}")

    node_select = [f"{faction_field['name']} {{ name }}", influence_field["name"]]

    # Include scalar/enum state and freshness fields if present.
    for name in scalar_field_names(schema, node_type, ("state", "updated", "timestamp", "date", "happiness")):
        if name not in node_select:
            node_select.append(name)

    # Include state objects/collections that expose a name field.
    for f in node_fields:
        if "state" not in norm(f["name"]):
            continue
        selection = object_name_selection(schema, f)
        if selection:
            node_select.append(selection)

    node_body = " ".join(dict.fromkeys(node_select))
    if mode == "connection":
        presence_select = f"{presence_field['name']} {{ edges {{ node {{ {node_body} }} }} }}"
    elif mode == "list":
        presence_select = f"{presence_field['name']} {{ {node_body} }}"
    else:
        presence_select = f"{presence_field['name']} {{ {node_body} }}"

    system_select = ["name", presence_select]
    meta: dict[str, str] = {
        "presence": presence_field["name"],
        "mode": mode,
        "faction": faction_field["name"],
        "influence": influence_field["name"],
    }

    # Controller, security, population, and freshness metadata when available.
    for f in schema.fields(system_type):
        lname = norm(f["name"])
        base, _ = unwrap_type(f["type"])
        kind = schema.kind(base)
        if "controlling" in lname and "faction" in lname and kind == "OBJECT" and schema.field(base or "", "name"):
            system_select.append(f"{f['name']} {{ name }}")
            meta["controller"] = f["name"]
            break
    for semantic, needles in {
        "security": ("security",),
        "population": ("population",),
        "updated": ("updated", "timestamp", "date"),
    }.items():
        candidates = scalar_field_names(schema, system_type, needles)
        if candidates:
            system_select.append(candidates[0])
            meta[semantic] = candidates[0]

    return " ".join(dict.fromkeys(system_select)), meta


def extract_nodes(system: dict[str, Any], relation_name: str, mode: str) -> list[dict[str, Any]]:
    value = system.get(relation_name)
    if mode == "connection":
        edges = value.get("edges", []) if isinstance(value, dict) else []
        return [e.get("node") for e in edges if isinstance(e, dict) and isinstance(e.get("node"), dict)]
    if mode == "list":
        return [x for x in (value or []) if isinstance(x, dict)]
    return [value] if isinstance(value, dict) else []


def state_names_from_node(node: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for key, value in node.items():
        if "state" not in norm(key) or value in (None, "", [], {}):
            continue
        if isinstance(value, str):
            if norm(value) not in {"none", "$faction_state_none;"}:
                result.append(value)
        elif isinstance(value, dict):
            if isinstance(value.get("name"), str):
                result.append(value["name"])
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and isinstance(item.get("name"), str):
                    result.append(item["name"])
                elif isinstance(item, str):
                    result.append(item)
    return list(dict.fromkeys(result))


def source_updated_from(system: dict[str, Any], node: dict[str, Any], meta: dict[str, str]) -> str | None:
    candidates: list[str] = []
    if meta.get("updated") and isinstance(system.get(meta["updated"]), str):
        candidates.append(system[meta["updated"]])
    for key, value in node.items():
        if any(n in norm(key) for n in ("updated", "timestamp", "date")) and isinstance(value, str):
            candidates.append(value)
    return max(candidates) if candidates else None


def main() -> int:
    config = load_json(CONFIG_PATH, {})
    existing = load_json(LIVE_PATH, {"systems": []})
    old_by_name = {
        row.get("name"): row
        for row in existing.get("systems", [])
        if isinstance(row, dict) and row.get("name")
    }
    names = [row.get("name") for row in config.get("systems", []) if isinstance(row, dict) and row.get("name")]

    print("Discovering EliteHub Vault GraphQL schema...", flush=True)
    try:
        schema_data = gql(INTROSPECTION, timeout=20)
        schema = Schema(schema_data)
        query_name, system_type = find_system_query(schema)
        presence_field, mode, node_type = find_presence_field(schema, system_type)
        selection, meta = build_query_parts(schema, system_type, presence_field, mode, node_type)
        print(f"SCHEMA system query: {query_name} -> {system_type}", flush=True)
        print(f"SCHEMA faction relation: {presence_field['name']} ({mode}, node {node_type})", flush=True)
        print(f"SCHEMA influence field: {meta['influence']}", flush=True)
    except Exception as exc:
        print(f"SCHEMA ERR: {exc}", flush=True)
        output = dict(existing) if isinstance(existing, dict) else {"systems": []}
        output.update({
            "generatedAt": iso(utc_now()),
            "source": "EliteHub Vault / EDDN",
            "faction": FACTION_NAME,
            "refreshInterval": "Every 2 hours",
            "successfulSystems": 0,
            "requestedSystems": len(names),
            "errors": [{"name": "schema", "error": str(exc)}],
        })
        # Keep any previous systems untouched.
        LIVE_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return 0

    query = f"query MongrelsSystem($name: String!) {{ {query_name}(name: $name) {{ {selection} }} }}"

    def fetch_one(name: str) -> dict[str, Any]:
        data = gql(query, {"name": name}, timeout=12)
        system = data.get(query_name)
        if not isinstance(system, dict):
            raise RuntimeError("system was not returned by Vault")
        nodes = extract_nodes(system, meta["presence"], meta["mode"])
        target = None
        for node in nodes:
            faction = node.get(meta["faction"])
            fname = faction.get("name") if isinstance(faction, dict) else faction
            if norm(fname) == norm(FACTION_NAME):
                target = node
                break
        if not target:
            raise RuntimeError(f"{FACTION_NAME} was not found in the system response")
        influence = number(target.get(meta["influence"]))
        if influence is None:
            raise RuntimeError("faction influence was missing from the response")
        controller = None
        if meta.get("controller"):
            obj = system.get(meta["controller"])
            controller = obj.get("name") if isinstance(obj, dict) else obj
        states = state_names_from_node(target)
        return {
            "name": name,
            "influence": influence,
            "controlled": norm(controller) == norm(FACTION_NAME) if controller else None,
            "control": controller,
            "state": ", ".join(states) if states else "None",
            "activeStates": states,
            "pendingStates": [],
            "recoveringStates": [],
            "security": system.get(meta.get("security")) if meta.get("security") else None,
            "population": system.get(meta.get("population")) if meta.get("population") else None,
            "sourceUpdated": source_updated_from(system, target, meta),
            "source": "EliteHub Vault / EDDN",
            "ok": True,
        }

    print(f"Refreshing {len(names)} systems from EliteHub Vault...", flush=True)
    results_by_name: dict[str, dict[str, Any]] = {}
    errors: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=min(6, max(1, len(names)))) as pool:
        futures = {}
        for name in names:
            print(f"START {name}", flush=True)
            futures[pool.submit(fetch_one, name)] = name
        for future in as_completed(futures):
            name = futures[future]
            try:
                row = future.result()
                row["fetchedAt"] = iso(utc_now())
                row["stale"] = False
                results_by_name[name] = row
                print(f"OK    {name}: {row['influence']:.2f}%", flush=True)
            except Exception as exc:
                print(f"ERR   {name}: {exc}", flush=True)
                errors.append({"name": name, "error": str(exc)})
                previous = old_by_name.get(name)
                if previous:
                    stale = dict(previous)
                    stale["ok"] = False
                    stale["stale"] = True
                    results_by_name[name] = stale

    refreshed = [results_by_name[name] for name in names if name in results_by_name]
    output = {
        "generatedAt": iso(utc_now()),
        "source": "EliteHub Vault / EDDN",
        "faction": FACTION_NAME,
        "refreshInterval": "Every 2 hours",
        "successfulSystems": sum(1 for row in refreshed if row.get("ok") is True),
        "requestedSystems": len(names),
        "errors": errors,
        "systems": refreshed,
    }
    LIVE_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
