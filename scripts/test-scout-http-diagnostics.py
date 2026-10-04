"""Regression tests for cloud status/error preservation at the Scout bridge.

Uses isolated EDMC configuration and HTTPS fixtures; never accesses real tokens,
the running bridge, or central data.
"""
from __future__ import annotations

import importlib.util
import io
import json
import sys
import types
from pathlib import Path


class Config:
    values = {"MongrelScoutToken": "mscout_fixture_only", "MongrelScoutEndpoint": "https://example.invalid/api/operations/scout-ingest"}
    def get_str(self, key): return str(self.values.get(key, ""))
    def get_int(self, key): return int(self.values.get(key, 0))
    def get_bool(self, key): return bool(self.values.get(key, 0))
    def set(self, key, value): self.values[key] = value


class Response:
    def __init__(self, status, payload, content_type="application/json", ray="abcdef0123456789-DFW"):
        self.status_code, self.payload = status, payload
        self.headers = {"Content-Type": content_type, "CF-Ray": ray}
    def json(self):
        if isinstance(self.payload, Exception): raise self.payload
        return self.payload


class Session:
    headers = {"User-Agent": "ScoutDiagnosticsRegression"}
    response = None
    calls = None
    def get(self, *args, **kwargs):
        if self.calls is not None: self.calls.append(args[0])
        if isinstance(self.response, Exception): raise self.response
        return self.response
    def post(self, *args, **kwargs): return self.get(*args, **kwargs)


session = Session()
tk = types.ModuleType("tkinter")
for name in ("Label", "IntVar", "StringVar", "Frame"):
    setattr(tk, name, type(name, (), {}))
sys.modules["tkinter"] = tk
sys.modules["myNotebook"] = types.ModuleType("myNotebook")
sys.modules["timeout_session"] = types.SimpleNamespace(new_session=lambda timeout=8: session)
sys.modules["config"] = types.SimpleNamespace(config=Config())
sys.modules["monitor"] = types.SimpleNamespace(monitor=None)
path = Path(__file__).resolve().parents[1] / "downloads/mongrel-scout/load.py"
spec = importlib.util.spec_from_file_location("scout_diagnostics_test", path)
scout = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(scout)

canonical = "https://ten16-archive.pages.dev"
assert scout.HUD_MINING_DATA_ENDPOINT == canonical + "/api/mining"
assert scout.HUD_MINING_CENTERS_ENDPOINT == canonical + "/api/mining-centers"
assert scout.HUD_MINING_REPORT_ENDPOINT == canonical + "/api/hud/mining-report"
assert scout.HUD_MINING_CENTER_ENDPOINT == canonical + "/api/hud/mining-center"
assert scout.DEFAULT_ENDPOINT == "https://mongrels-squadron.pages.dev/api/operations/scout-ingest"
assert scout._hud_site_feed_endpoint() == "https://example.invalid/api/hud/feed"

endpoint = "https://example.invalid/api/mining-centers"
session.response = Response(500, {"error": "mining_centers_unavailable", "privateBody": "private SQL details"})
result = scout._fetch_hud_mining_resource(endpoint)
assert result["error"] == "http_500"  # Existing mining-read error vocabulary remains usable.
assert result["errorCode"] == "mining_centers_unavailable"
assert result["upstreamStatus"] == 500
assert result["requestId"] == "abcdef0123456789-DFW"
assert result["responseFormat"] == "json"
assert result["endpoint"] == endpoint
assert "private SQL" not in json.dumps(result)
assert scout._hud_proxy_status(result) == 500  # The deployed failing boundary must survive the proxy.


class Handler:
    def __init__(self, path, payload=None):
        self.path = path
        body = json.dumps(payload or {}).encode()
        self.headers = {"Content-Length": str(len(body))}
        self.rfile = io.BytesIO(body)
        self.result = None
    def _write_json(self, payload, status=200): self.result = (status, payload)


for route, expected in [("/v1/mining/data", scout.HUD_MINING_DATA_ENDPOINT), ("/v1/mining/centers", scout.HUD_MINING_CENTERS_ENDPOINT)]:
    session.calls = []
    session.response = Response(200, [])
    handler = Handler(route)
    scout._HudBridgeHandler.do_GET(handler)
    assert session.calls == [expected] and handler.result[0] == 200
    session.response = TimeoutError("fixture outage")
    session.calls = []
    scout._HudBridgeHandler.do_GET(handler)
    assert session.calls == [expected]  # No second authority / remote Worker fallback.
    assert handler.result[0] == 502
for route, expected in [("/v1/mining/report", scout.HUD_MINING_REPORT_ENDPOINT), ("/v1/mining/center", scout.HUD_MINING_CENTER_ENDPOINT)]:
    session.calls = []
    session.response = Response(200, {"ok": True})
    handler = Handler(route, {"signal": 1})
    scout._HudBridgeHandler.do_POST(handler)
    assert session.calls == [expected] and handler.result[0] == 200
session.response = Response(500, {"error": "mining_centers_unavailable"})
handler = Handler("/v1/mining/centers")
scout._HudBridgeHandler.do_GET(handler)
assert handler.result[0] == 500
assert handler.result[1]["upstreamStatus"] == 500

session.response = Response(403, {"ok": False, "error": "site_admin_required"})
handler = Handler("/v1/mining/center", {"signal": 1})
scout._HudBridgeHandler.do_POST(handler)
assert handler.result[0] == 403
assert handler.result[1]["error"] == "site_admin_required"

session.response = Response(200, {"ok": True, "generatedAt": "2026-10-04T17:00:00Z", "mission": {}, "trade": {}, "scout": {}, "alerts": [{"id": "fixture-alert"}]})
assert scout._refresh_hud_site_feed_once() is True
previous_feed = scout._hud_state_snapshot()["siteFeed"]
for code, error in [(401, "invalid_scout_token"), (403, "hud_owner_not_bound"), (503, "hud_feed_unavailable")]:
    session.response = Response(code, {"ok": False, "error": error})
    assert scout._refresh_hud_site_feed_once() is False
    state = scout._hud_state_snapshot()
    assert state["siteFeed"] == previous_feed
    assert state["siteFeedStatus"]["error"] == error
    assert state["siteFeedStatus"]["upstreamStatus"] == code
    assert state["siteFeedStatus"]["requestId"] == "abcdef0123456789-DFW"
    assert state["siteFeedStatus"]["detail"] == f"HTTP {code} · {error}"

session.response = Response(502, ValueError("private HTML body"), "text/html")
assert scout._refresh_hud_site_feed_once() is False
status = scout._hud_state_snapshot()["siteFeedStatus"]
assert status["error"] == "http_502" and status["responseFormat"] == "html"
assert "private HTML" not in json.dumps(status)

for code, label in [(1101, "Worker exception"), (1102, "Worker resource limit")]:
    session.response = Response(503, {"error_code": code, "title": "private reflected body", "detail": "private upstream details"})
    assert scout._refresh_hud_site_feed_once() is False
    status = scout._hud_state_snapshot()["siteFeedStatus"]
    assert status["error"] == "http_503"  # Preserve the existing fallback error code.
    assert status["errorCode"] == str(code) and status["upstreamStatus"] == 503
    assert status["detail"] == f"HTTP 503 · Cloudflare {code} ({label})"
    assert "private" not in json.dumps(status)

for payload in [[], None, "private response", 42]:
    session.response = Response(503, payload)
    for operation in [lambda: scout._ack_hud_site_alerts(["fixture-alert"]), lambda: scout._submit_hud_mining_request(endpoint, {"signal": 1})]:
        result = operation()
        assert result["error"] == "http_503"
        assert result["upstreamStatus"] == 503 and result["responseFormat"] == "json"
        assert scout._hud_proxy_status(result) == 503
    session.response = Response(200, payload)
    assert scout._refresh_hud_site_feed_once() is False
    assert scout._hud_state_snapshot()["siteFeedStatus"]["error"] == "invalid_hud_feed"

session.response = Response(200, ValueError("malformed private JSON"))
assert scout._refresh_hud_site_feed_once() is False
assert scout._hud_state_snapshot()["siteFeedStatus"]["responseFormat"] == "invalid_json"

session.response = Response(401, {"error": "invalid_scout_token"})
handler = Handler("/v1/site-feed/ack", {"alertId": "fixture-alert"})
scout._HudBridgeHandler.do_POST(handler)
assert handler.result[0] == 401 and handler.result[1]["error"] == "invalid_scout_token"

secret = "mscout_never_expose_this"
secret_url = f"https://user:password@example.invalid/api/mining-centers?token={secret}#fragment"
session.response = TimeoutError(f"private failure URL {secret_url}")
result = scout._fetch_hud_mining_resource(secret_url)
assert result["error"] == "network:TimeoutError"
assert result["detail"] == "Connection failed (TimeoutError)"
assert result["endpoint"] == endpoint
assert result["upstreamStatus"] is None
for private in [secret, "password", "token=", "private failure"]:
    assert private not in json.dumps(result)
session.response = Response(500, {"error": f"invalid_{secret}", "message": secret}, ray=secret)
result = scout._submit_hud_mining_request(secret_url, {})
assert result["error"] == "http_500" and not result["requestId"]
assert secret not in json.dumps(result)

scout.config.values["MongrelScoutToken"] = ""
assert scout._refresh_hud_site_feed_once() is False
assert scout._hud_state_snapshot()["siteFeedStatus"]["error"] == "scout_token_missing"
assert scout._hud_proxy_status(scout._submit_hud_mining_request(endpoint, {})) == 401
print("Scout HTTP diagnostics regression passed: statuses, error codes, JSON/HTML/schema failures, request IDs, stale feed retention, and secret redaction")
