"""Offline, mocked community intelligence tests (no HTTP)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "downloads" / "mongrel-scout" / "surveyor_intel.py"
spec = importlib.util.spec_from_file_location("surveyor_intel_tests", FILE)
assert spec is not None and spec.loader is not None
intel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intel)

system_name, address = "Test System", "12345678901234567890"
spansh = {"system": {
    "name": system_name, "id64": int(address), "bodyCount": 3,
    "bodies": [
        {"name": "Test System", "type": "Star", "subType": "G (White-Yellow) Star", "distanceToArrival": 0},
        {"name": "Test System A 2", "type": "Planet", "subType": "Water world", "distanceToArrival": 452.4},
    ],
}}
edsm = {
    "name": system_name, "id64": int(address),
    "bodies": [
        {"name": "Test System A 2", "type": "Planet", "subType": "Water world", "distanceToArrival": 452.4},
        {"name": "Test System A 3", "type": "Planet", "subType": "High metal content world", "distanceToArrival": 600},
    ],
}
merged = intel.combine_intelligence(system_name, address, spansh, edsm)
assert merged["providers"] == ["Spansh", "EDSM"]
assert merged["catalogedBodies"] == 3  # Cross-provider deduplication
assert len(merged["highlights"]) == 2
assert merged["claimEvidence"] is False
assert not any("commander" in str(value).lower() for value in merged.values())

# Wrong id64 is rejected even when name matches.
different = {"system": {**spansh["system"], "id64": 42}}
assert intel.combine_intelligence(system_name, address, different, None)["catalogedBodies"] == 0
assert intel.combine_intelligence(system_name, address, None, None)["status"] == "not_in_queried_catalogs"
assert intel.combine_intelligence(system_name, address, None, None)["claimEvidence"] is False

calls = []
def fake_request(url):
    calls.append(url)
    if "spansh.co.uk" in url:
        return spansh
    return edsm

result, failed = intel.query(system_name, address, fake_request)
assert not failed and result["catalogedBodies"] == 3
assert len(calls) == 2 and address in calls[0] and "Test%20System" in calls[1]
assert all(c.startswith("https://") for c in calls)

def partial_failure(url):
    if "spansh.co.uk" in url:
        raise ConnectionError("offline")
    return edsm

result, failed = intel.query(system_name, address, partial_failure)
assert failed and result["providers"] == ["EDSM"]
assert result["partialProviderFailure"] is True

def all_fail(url):
    raise TimeoutError("offline")
result, failed = intel.query(system_name, address, all_fail)
assert failed and result["status"] == "providers_unavailable"
assert result["claimEvidence"] is False

print("Mongrel Surveyor community intelligence tests PASSED (merge, identity, privacy, outage)")

