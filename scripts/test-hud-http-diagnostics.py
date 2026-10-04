from __future__ import annotations

import io
import json
import sys
import tempfile
import types
import unittest
import urllib.error
from email.message import Message
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.modules.setdefault("tkinter", types.ModuleType("tkinter"))
sys.path.insert(0, str(ROOT / "downloads" / "mongrel-hud"))
import mongrel_hud as hud


class Response(io.BytesIO):
    def __init__(self, payload, status=200):
        super().__init__(json.dumps(payload).encode())
        self.status = status


def bridge_failure(url, status=502, upstream=500, code="cloudflare_1102"):
    headers = Message()
    headers["Content-Type"] = "application/json"
    payload = {
        "ok": False, "error": code, "errorCode": code,
        "endpoint": "https://user:private@ten16-archive.pages.dev/api/mining-centers?token=private",
        "upstreamStatus": upstream, "requestId": "a0123456789bcdef-ORD", "responseFormat": "json",
        "detail": "private database detail mscout_private_do_not_show",
    }
    return urllib.error.HTTPError(url, status, "Bad Gateway", headers, io.BytesIO(json.dumps(payload).encode()))


CENTER = {"id": 91, "body": "7b", "signal": 10, "latitude": -22.77, "longitude": -98.81, "systemName": hud.TEN16_SYSTEM, "systemAddress": hud.TEN16_ID64}
STATE = {
    "system": {"name": hud.TEN16_SYSTEM, "address": hud.TEN16_ID64, "starPos": [0, 0, 0]},
    "status": {"bodyName": hud.TEN16_SYSTEM + " 7 b", "latitude": -22.77, "longitude": -98.81, "planetRadius": 1234567},
}


class HudDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT)
        self.addCleanup(self.temp.cleanup)
        for name in ("_mining_sync_loop", "_warm_ocr"):
            mock = patch.object(hud.MongrelHudApp, name, lambda self: None)
            mock.start()
            self.addCleanup(mock.stop)
        self.app = hud.MongrelHudApp(hud.LocalStore(Path(self.temp.name) / "state.json"), "")
        self.app.snapshot = hud.ScoutSnapshot(json.loads(json.dumps(STATE)), True, "")

    def test_http_failure_retains_bridge_and_upstream_without_private_details(self):
        with patch.object(hud.urllib.request, "urlopen", side_effect=bridge_failure(hud.MINING_CENTERS_URL)):
            with self.assertRaises(hud.HudRequestError) as caught:
                self.app._load_mining_bridge_payload(hud.MINING_CENTERS_URL, "invalid_mining_centers_payload")
        diagnostics = caught.exception.diagnostics
        self.assertEqual(caught.exception.status, 502)
        self.assertEqual(diagnostics["bridgeStatus"], 502)
        self.assertEqual(diagnostics["upstreamStatus"], 500)
        self.assertEqual(diagnostics["endpoint"], "https://ten16-archive.pages.dev/api/mining-centers")
        self.assertEqual(diagnostics["requestId"], "a0123456789bcdef-ORD")
        self.assertEqual(diagnostics["responseFormat"], "json")
        self.assertEqual(diagnostics["errorCode"], "cloudflare_1102")
        self.assertIn("Scout HTTP 502", str(caught.exception))
        self.assertIn("upstream HTTP 500", str(caught.exception))
        self.assertNotIn("private", json.dumps(diagnostics))

    def test_non_json_and_transport_failures_have_safe_diagnostics(self):
        headers = Message()
        headers["Content-Type"] = "text/html"
        error = urllib.error.HTTPError(hud.MINING_CENTERS_URL, 500, "Failure", headers, io.BytesIO(b"<html>private token</html>"))
        with patch.object(hud.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(hud.HudRequestError) as caught:
                hud.request_scout_json(hud.MINING_CENTERS_URL, "center_read_failed")
        self.assertEqual(caught.exception.diagnostics["responseFormat"], "html")
        self.assertNotIn("private", str(caught.exception))
        with patch.object(hud.urllib.request, "urlopen", side_effect=urllib.error.URLError(TimeoutError("private credential"))):
            with self.assertRaises(hud.HudRequestError) as caught:
                hud.request_scout_json(hud.MINING_CENTERS_URL, "center_read_failed")
        self.assertEqual(caught.exception.diagnostics["errorCode"], "network:TimeoutError")
        self.assertNotIn("private", str(caught.exception))

    def test_controller_posts_keep_upstream_failure_status_and_diagnostics(self):
        handler_type = hud.make_handler(self.app)
        for path, body in (
            ("/api/site-center", {"siteNumber": 10}),
            ("/api/deposit", {"commodity": "Platinum", "rigs": 1, "signal": 10}),
            ("/api/alert-ack", {"alertId": "test-alert"}),
        ):
            with self.subTest(path=path):
                handler = object.__new__(handler_type)
                handler.path = path
                handler.same_origin = lambda: True
                handler.authorized = lambda: True
                handler.json_body = lambda: body
                sent = []
                handler.send_json = lambda payload, status=200: sent.append((payload, status))
                with patch.object(hud.urllib.request, "urlopen", side_effect=bridge_failure("http://127.0.0.1:43857", 403, 403, "site_admin_required")):
                    handler.do_POST()
                payload, status = sent[0]
                self.assertEqual(status, 403)
                self.assertEqual(payload["error"], "site_admin_required")
                self.assertEqual(payload["diagnostics"]["upstreamStatus"], 403)
                self.assertEqual(payload["diagnostics"]["bridgeStatus"], 403)

    def test_cache_is_fallback_and_central_success_replaces_it(self):
        self.app.mining_centers = [dict(CENTER)]
        self.app.mining_centers_source = "central"
        def failing_centers(request, **kwargs):
            if request.full_url == hud.MINING_CENTERS_URL:
                raise bridge_failure(request.full_url)
            return Response({"ok": True, "data": []})
        with patch.object(hud.urllib.request, "urlopen", side_effect=failing_centers):
            self.app._refresh_mining_data_once()
        status = self.app.mining_status_snapshot()
        self.assertEqual(status["centersSource"], "cache")
        self.assertEqual(status["centersDiagnostics"]["upstreamStatus"], 500)
        self.assertEqual(self.app.mining_centers[0]["id"], 91)
        fresh = {**CENTER, "id": 92, "latitude": -23.0}
        def healthy(request, **kwargs):
            return Response({"ok": True, "data": [fresh] if request.full_url == hud.MINING_CENTERS_URL else []})
        with patch.object(hud.urllib.request, "urlopen", side_effect=healthy):
            self.app._refresh_mining_data_once()
        self.assertEqual(self.app.mining_status_snapshot()["centersSource"], "central")
        self.assertEqual(self.app.mining_centers[0]["id"], 92)
        restarted = hud.MongrelHudApp(hud.LocalStore(self.app.store.path), "")
        self.assertEqual(restarted.mining_status_snapshot()["centersSource"], "cache")
        self.assertEqual(restarted.mining_centers[0]["id"], 92)
        restarted.mining_centers = []
        with patch.object(hud.urllib.request, "urlopen", side_effect=healthy):
            restarted._refresh_mining_data_once()
        self.assertEqual(restarted.mining_status_snapshot()["centersSource"], "central")
        self.assertEqual(restarted.mining_centers[0]["id"], 92)

    def test_missing_or_invalid_canonical_center_never_becomes_local_success(self):
        self.app.mining_centers = [dict(CENTER)]
        before_store = json.loads(json.dumps(self.app.store.data))
        invalid = [None, {**CENTER, "id": 0}, {**CENTER, "body": "8b"}, {**CENTER, "signal": 11}, {**CENTER, "latitude": float("nan")}, {**CENTER, "longitude": 181}]
        for center in invalid:
            with self.subTest(center=center):
                response = {"ok": True}
                if center is not None:
                    response["center"] = center
                with patch.object(hud.urllib.request, "urlopen", return_value=Response(response)):
                    with self.assertRaises(hud.HudRequestError) as caught:
                        self.app.set_site_center(10)
                self.assertEqual(caught.exception.error_code, "invalid_mining_center_response")
                self.assertEqual(self.app.mining_centers, [CENTER])
                self.assertEqual(self.app.store.data, before_store)
        with patch.object(hud.urllib.request, "urlopen", return_value=Response({"ok": True, "center": CENTER})):
            saved = self.app.set_site_center(10)
        self.assertEqual(saved["id"], 91)
        self.assertEqual(self.app.store.data["miningCenters"][0]["id"], 91)

    def test_saved_unverified_cache_survives_but_cannot_become_central_data(self):
        cached = {key: value for key, value in CENTER.items() if key not in {"systemName", "systemAddress"}}
        cached["id"] = 0
        no_id = {key: value for key, value in cached.items() if key != "id"}
        no_id["signal"] = 11
        legacy_sites = {"original-key": {"systemAddress": hud.TEN16_ID64, "body": hud.TEN16_SYSTEM + " 9 a", "siteNumber": 3, "latitude": 1.25, "longitude": -2.5}}
        self.app.store.data["miningCenters"] = [cached, no_id]
        self.app.store.data["sites"] = legacy_sites
        self.app.store.save()
        restarted = hud.MongrelHudApp(hud.LocalStore(self.app.store.path), "")
        restarted.snapshot = hud.ScoutSnapshot(json.loads(json.dumps(STATE)), True, "")
        self.assertEqual(len(restarted.mining_centers), 2)
        self.assertEqual(restarted.mining_centers[0]["latitude"], cached["latitude"])
        self.assertEqual(restarted.mining_centers[0]["systemName"], hud.TEN16_SYSTEM)
        self.assertEqual(restarted.mining_status_snapshot()["centersSource"], "cache")
        self.assertTrue(restarted.mining_status_snapshot()["centersCacheUnverified"])
        self.assertEqual(restarted.store.data["sites"], legacy_sites, 'Legacy records are not migrated or cleared')
        def invalid_central(request, **kwargs):
            return Response({"ok": True, "data": [cached] if request.full_url == hud.MINING_CENTERS_URL else []})
        with patch.object(hud.urllib.request, "urlopen", side_effect=invalid_central):
            restarted._refresh_mining_data_once()
        self.assertFalse(restarted.mining_status_snapshot()["centersOk"])
        self.assertEqual(restarted.mining_status_snapshot()["centersSource"], "cache")
        self.assertTrue(restarted.mining_status_snapshot()["centersCacheUnverified"])
        self.assertEqual(restarted.mining_centers[0]["id"], 0)
        self.assertEqual(restarted.store.data["sites"], legacy_sites)

    def test_known_system_address_is_authoritative_over_stale_display_name(self):
        known = {**CENTER, "systemName": "Earlier stored display name"}
        self.assertEqual(hud.canonical_mining_center(known)["systemName"], hud.TEN16_SYSTEM)
        def healthy(request, **kwargs):
            return Response({"ok": True, "data": [known] if request.full_url == hud.MINING_CENTERS_URL else []})
        with patch.object(hud.urllib.request, "urlopen", side_effect=healthy):
            self.app._refresh_mining_data_once()
        self.assertTrue(self.app.mining_status_snapshot()["centersOk"])
        self.assertEqual(self.app.centers_for_current_body()[0]["id"], CENTER["id"])
        for invalid in ({**CENTER, "systemAddress": "999"}, {**known, "systemAddress": ""}):
            with self.assertRaises(ValueError):
                hud.canonical_mining_center(invalid)

    def test_all_site_panels_show_failure_and_retained_data(self):
        self.app._draw_title = lambda canvas, title, scale, width: 0
        self.app._draw_text = lambda canvas, x, y, text, *args: canvas.lines.append(str(text)) or len(canvas.lines)
        self.app._draw_progress = lambda *args: None
        renderers = [self.app._render_mission_canvas, self.app._render_trade_canvas, self.app._render_scoutboard_canvas, self.app._render_scoutnearby_canvas]
        status = {"ok": False, "error": "cloudflare_1102", "upstreamStatus": 500}
        self.app.snapshot.data["siteFeedStatus"] = status
        for renderer in renderers:
            canvas = types.SimpleNamespace(lines=[], bbox=lambda item: None)
            renderer(canvas, 1)
            self.assertTrue(any("SITE FEED UNAVAILABLE" in text and "UPSTREAM HTTP 500" in text for text in canvas.lines))
            self.assertFalse(any("WAITING FOR SITE FEED" in text for text in canvas.lines))
        self.app.snapshot.data["siteFeed"] = {
            "generatedAt": "2026-10-04T01:00:00Z",
            "mission": {"orderCount": 1, "orders": [{"system": "Diaba", "task": "Win CZs"}]},
            "trade": {"activeCount": 1, "routes": [{"title": "Platinum Loop"}]},
            "scout": {"summary": {"available": 1}, "jobs": [{"system": "Miwae", "coords": [1, 0, 0]}]},
        }
        for renderer, expected in zip(renderers, ["Win CZs", "Platinum Loop", "Miwae", "Miwae"]):
            canvas = types.SimpleNamespace(lines=[], bbox=lambda item: None)
            renderer(canvas, 1)
            self.assertTrue(any("STALE SITE FEED" in text for text in canvas.lines))
            self.assertTrue(any("LAST GOOD FEED" in text for text in canvas.lines))
            self.assertTrue(any(expected in text for text in canvas.lines))
        self.app.snapshot.data["siteFeedStatus"] = {"ok": True}
        self.assertEqual(self.app.site_feed_status_lines(self.app.scout_state(), True), [])

    def test_render_error_snapshot_only_contains_panel_and_type(self):
        self.app.panel_windows = {"mission": {"renderError": "private mscout_token", "renderErrorType": "ValueError"}}
        errors = self.app.controller_state()["renderErrors"]
        self.assertEqual(errors, [{"panel": "mission", "errorType": "ValueError"}])
        self.assertNotIn("private", json.dumps(errors))


if __name__ == "__main__":
    unittest.main()
