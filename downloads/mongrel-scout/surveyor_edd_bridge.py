"""Read-only local EDDiscovery Web Server scan bridge.

EDDiscovery Settings > Web Server may expose a WebSocket with the "EDDJSON"
subprotocol. Its documented requesttype=scandata returns historical Scan
objects with EDD's calculated EstimatedValue. This optional connector does
not need another library, EDD plugin, public endpoint, or Cloudflare read.

Documentation: EDDiscovery/EDDiscovery WebServer/EDDWebScandata.cs and
WebSite/EDD/scandata/scanrequests.js (Apache-2.0); protocol only.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
import socket
import struct
import time
from typing import Any, Mapping

MAX_PAYLOAD = 8 * 1024 * 1024


def normalize_scan_response(reply: Mapping[str, Any], expected_system: str,
                            expected_address: str) -> dict[str, Any]:
    """Only import verified historical personal scans; never award expedition CR."""
    if reply.get("responsetype") != "scandata":
        raise ValueError("not_eddiscovery_scandata")
    rows = reply.get("Bodies")
    if not isinstance(rows, list):
        raise ValueError("edd_scan_list_missing")
    if len(rows) > 1500:
        raise ValueError("edd_scan_limit")
    expected_addr = str(expected_address).strip()
    name = expected_system.strip()
    if not name or not expected_addr.isdecimal():
        raise ValueError("expected_identity_missing")
    observed = []
    proof = False
    for body in rows:
        if not isinstance(body, Mapping):
            continue
        scan = body.get("Scan")
        if not isinstance(scan, Mapping):
            continue
        if scan.get("IsWebSourced") is True:
            continue
        full = str(body.get("FullName") or scan.get("BodyName") or "").strip()
        if not full or not (full.casefold() == name.casefold() or
                            full.casefold().startswith(name.casefold() + " ")):
            continue
        scanned_addr = scan.get("SystemAddress")
        if scanned_addr is not None:
            if str(scanned_addr) != expected_addr:
                raise ValueError("edd_system_identity_mismatch")
            proof = True
        elif str(scan.get("StarSystem") or "").casefold() == name.casefold():
            proof = True
        value = scan.get("EstimatedValue")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            value = None
        elif not 0 <= value <= 2_000_000_000:
            value = None
        mapped = scan.get("Mapped") is True
        observed.append({
            "name": full[:140],
            "bodyId": str(body.get("BodyID") or "")[:22],
            "bodyClass": str(scan.get("PlanetTypeText") or scan.get("StarTypeText") or "")[:80],
            "distanceLs": scan.get("DistanceFromArrivalLS"),
            "wasDiscovered": scan.get("WasDiscovered") if isinstance(scan.get("WasDiscovered"), bool) else None,
            "wasMapped": scan.get("WasMapped") if isinstance(scan.get("WasMapped"), bool) else None,
            "personallyMapped": mapped,
            "efficientlyMapped": scan.get("EfficientMapped") is True,
            "estimatedValue": int(value) if value is not None else None,
            "source": "EDDiscovery historical scan",
        })
    if observed and not proof:
        # Do not accidentally attach another history-cursor system to this
        # ship's current system if the user's EDDiscovery history cursor differs.
        raise ValueError("edd_system_identity_unverified")
    return {
        "source": "EDDiscovery local web server",
        "sourceSystem": name,
        "systemAddress": expected_addr,
        "bodyCount": len(observed),
        "bodies": observed,
        "estimatedHistoricalValue": sum(int(b["estimatedValue"] or 0) for b in observed),
        "verifiedSystemIdentity": proof,
        "isProofOfUnsoldData": False,
        "includedInExpeditionEarnings": False,
    }


def _recv_n(sock: socket.socket, count: int) -> bytes:
    data = bytearray()
    while len(data) < count:
        piece = sock.recv(min(65536, count-len(data)))
        if not piece:
            raise ConnectionError("edd_websocket_closed")
        data.extend(piece)
    return bytes(data)


def _send_frame(sock: socket.socket, payload: bytes, opcode: int = 1) -> None:
    if len(payload) > MAX_PAYLOAD:
        raise ValueError("edd_request_too_large")
    first = bytes([0x80 | opcode])
    length = len(payload)
    if length < 126:
        head = bytes([0x80 | length])
    elif length <= 65535:
        head = b"\xfe" + struct.pack(">H", length)
    else:
        head = b"\xff" + struct.pack(">Q", length)
    mask = os.urandom(4)
    coded = bytes(b ^ mask[i%4] for i,b in enumerate(payload))
    sock.sendall(first + head + mask + coded)


def _read_frame(sock: socket.socket) -> tuple[int, bool, bytes]:
    head = _recv_n(sock, 2)
    code, second = head
    op = code & 0x0F
    final = bool(code & 0x80)
    length = second & 0x7F
    if length == 126:
        length = struct.unpack(">H", _recv_n(sock, 2))[0]
    elif length == 127:
        length = struct.unpack(">Q", _recv_n(sock, 8))[0]
    if length > MAX_PAYLOAD:
        raise ValueError("edd_response_too_large")
    mask = _recv_n(sock, 4) if second & 0x80 else None
    data = _recv_n(sock, length)
    if mask:
        data = bytes(b ^ mask[i%4] for i,b in enumerate(data))
    return op, final, data


def request_current_scans(port: int, timeout: float = 4.0) -> dict[str, Any]:
    """One bounded read from 127.0.0.1 only. Never contact external services."""
    if isinstance(port, bool) or not isinstance(port, int) or not 1024 <= port <= 65535:
        raise ValueError("invalid_eddiscovery_port")
    key = base64.b64encode(os.urandom(16)).decode("ascii")
    request = (f"GET / HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n"
               f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
               f"Sec-WebSocket-Protocol: EDDJSON\r\n\r\n").encode("ascii")
    with socket.create_connection(("127.0.0.1", port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(request)
        header = bytearray()
        while b"\r\n\r\n" not in header:
            if len(header) > 8192:
                raise ValueError("edd_handshake_too_large")
            header.extend(_recv_n(sock, 1))
        hdr = bytes(header).decode("latin1")
        if not hdr.startswith("HTTP/1.1 101"):
            raise ConnectionError("edd_webserver_not_websocket")
        expected = base64.b64encode(hashlib.sha1(
            (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")
        ).digest()).decode("ascii")
        fields = {}
        for row in hdr.split("\r\n")[1:]:
            if ":" in row:
                k,v = row.split(":",1)
                fields[k.strip().lower()] = v.strip()
        if fields.get("sec-websocket-accept") != expected:
            raise ConnectionError("edd_websocket_handshake_invalid")
        if fields.get("sec-websocket-protocol", "").lower() != "eddjson":
            raise ConnectionError("edd_websocket_protocol_mismatch")
        _send_frame(sock, json.dumps({"requesttype":"scandata","entry":-1,
                                      "edsm":False,"spansh":False}).encode("utf-8"))
        assembled = bytearray()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            op, final, data = _read_frame(sock)
            if op == 8:
                break
            if op == 9:
                _send_frame(sock, data, opcode=10)
                continue
            if op not in (0,1):
                continue
            assembled.extend(data)
            if len(assembled) > MAX_PAYLOAD:
                raise ValueError("edd_json_too_large")
            if final:
                result = json.loads(bytes(assembled).decode("utf-8"))
                assembled.clear()
                if isinstance(result, dict) and result.get("responsetype") == "scandata":
                    return result
    raise TimeoutError("edd_scan_response_unavailable")
