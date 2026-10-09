"""Read-only community intelligence for Mongrel Surveyor.

Only system name and 64-bit address leave the user's PC. This component never
posts journals, body observations, Commander identity, or expedition earnings.
Providers are advisory: absent records NEVER prove a first discovery.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any, Callable, Mapping

USER_AGENT = "MongrelScout-Surveyor/0.1 (Elite Dangerous exploration companion)"
MAX_RESPONSE_BYTES = 2_000_000
HIGHLIGHT_CLASSES = (
    "earth-like", "earthlike", "water world", "ammonia world",
    "high metal content", "metal-rich",
)


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _number(value: Any) -> float | None:
    try:
        v = float(value)
        return v if -1e12 < v < 1e12 else None
    except (TypeError, ValueError, OverflowError):
        return None


def _address(value: Any) -> str:
    # Avoid representing Frontier's 64-bit address through Javascript floats.
    text = _text(value)
    return text if text.isascii() and text.isdecimal() and len(text) <= 20 else ""


def _parse_spansh(payload: Any, name: str, address: str) -> list[dict[str, Any]] | None:
    if not isinstance(payload, Mapping):
        return None
    system = payload.get("system", payload)
    if not isinstance(system, Mapping):
        return None
    if _address(system.get("id64")) != address:
        return None
    if _text(system.get("name")).casefold() != name.casefold():
        return None
    bodies = system.get("bodies")
    if not isinstance(bodies, list):
        return []
    return _extract_bodies(bodies)


def _parse_edsm(payload: Any, name: str, address: str) -> list[dict[str, Any]] | None:
    if not isinstance(payload, Mapping) or _text(payload.get("name")).casefold() != name.casefold():
        return None
    # Only compare ID64 where the source supplies it; EDSM body responses may
    # omit id64, but must match exact system name.
    supplied_address = payload.get("id64")
    if supplied_address is not None and _address(supplied_address) != address:
        return None
    bodies = payload.get("bodies")
    if not isinstance(bodies, list):
        return [] if payload.get("id") else None
    return _extract_bodies(bodies)


def _extract_bodies(rows: list[Any]) -> list[dict[str, Any]]:
    out = []
    for entry in rows[:300]:
        if not isinstance(entry, Mapping):
            continue
        name = _text(entry.get("name"))[:150]
        if not name:
            continue
        kind = _text(entry.get("subType") or entry.get("planetClass"))[:80]
        distance = _number(entry.get("distanceToArrival"))
        out.append({
            "name": name,
            "class": kind,
            "distanceLs": max(0.0, distance) if distance is not None else None,
        })
    return out


def combine_intelligence(system_name: str, address: str,
                         spansh: Any, edsm: Any) -> dict[str, Any]:
    """Return only publicly cataloged facts, not personal exploration progress."""
    name = _text(system_name)
    addr = _address(address)
    if not name or not addr:
        raise ValueError("invalid_system")
    a = _parse_spansh(spansh, name, addr)
    b = _parse_edsm(edsm, name, addr)
    providers = []
    all_rows: dict[str, dict[str, Any]] = {}
    for source, bodies in (("Spansh", a), ("EDSM", b)):
        if bodies is None:
            continue
        providers.append(source)
        for row in bodies:
            key = row["name"].casefold()
            if key not in all_rows:
                all_rows[key] = row
            else:
                prior = all_rows[key]
                if not prior.get("class") and row.get("class"):
                    prior["class"] = row["class"]
                if prior.get("distanceLs") is None and row.get("distanceLs") is not None:
                    prior["distanceLs"] = row["distanceLs"]
    highlights = [
        row for row in all_rows.values()
        if any(part in row["class"].casefold() for part in HIGHLIGHT_CLASSES)
    ]
    highlights.sort(key=lambda x: (x.get("distanceLs") is None, x.get("distanceLs") or 0))
    return {
        "status": "community_cataloged" if providers else "not_in_queried_catalogs",
        "providers": providers,
        "catalogedBodies": len(all_rows),
        "highlights": highlights[:8],
        "claimEvidence": False,
        "note": "Community data is incomplete and cannot establish first discovery.",
    }


def request_json(url: str) -> Any:
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("provider_response_too_large")
        return json.loads(raw.decode("utf-8"))


def query(system_name: str, address: str,
          get_json: Callable[[str], Any] = request_json) -> tuple[dict[str, Any], bool]:
    """One bounded request per source; failed sources never block the other.

    Returns (normalized intelligence, transient_failure). Failed lookups
    receive a short cooldown; legitimate empty results receive a normal TTL.
    """
    name, addr = _text(system_name), _address(address)
    if not name or not addr:
        raise ValueError("invalid_system")
    responses = [None, None]
    failures = 0
    endpoints = [
        f"https://spansh.co.uk/api/system/{addr}",
        "https://www.edsm.net/api-system-v1/bodies?systemName="
        + urllib.parse.quote(name, safe=""),
    ]
    for i, url in enumerate(endpoints):
        try:
            responses[i] = get_json(url)
        except Exception:
            failures += 1
    result = combine_intelligence(name, addr, responses[0], responses[1])
    result["partialProviderFailure"] = failures > 0
    if failures == 2:
        result["status"] = "providers_unavailable"
    return result, failures > 0
