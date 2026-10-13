"""Private cross-PC cargo mission synchronization for Mongrel Scout.

Never blocks EDMC journal callback; only whitelisted mission requirement rows
leave the PC. Frontier's live Missions Active IDs gate restores on that PC.
No raw journals, ship cargo, provenance or exploration records are sent.
"""
from __future__ import annotations

import json
import threading
import time
from typing import Any, Callable, Mapping
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ENDPOINT = "https://mongrels-squadron.pages.dev/api/operations/scout-mission-sync"
POLL_SECONDS = 240
RETRY_SECONDS = 60
MAX_PENDING = 192
MAX_BATCH = 24


def stamp(value: Any) -> str:
    """Frontier's ISO UTC stamps compare lexicographically after normalizing."""
    from datetime import datetime, timezone
    try:
        d = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        if d.tzinfo is None:
            return ""
        return d.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except (ValueError, TypeError, OverflowError):
        return ""


def mission_id(value: Any) -> int | None:
    try:
        v = int(value)
        return v if 1 <= v <= 9007199254740991 else None
    except (TypeError, ValueError, OverflowError):
        return None


def key(commander: Any) -> str:
    return " ".join(str(commander or "").split()).casefold()


class MissionSync:
    def __init__(self, token: Callable[[], str],
                 restore_pending: Callable[[], str],
                 persist_pending: Callable[[str], None],
                 local_rows: Callable[[str], list[dict]],
                 apply_remote: Callable[[str, list[dict], set[str]], None],
                 endpoint: str = ENDPOINT):
        self.token = token
        self.persist_pending = persist_pending
        self.local_rows = local_rows
        self.apply_remote = apply_remote
        self.endpoint = endpoint
        self.lock = threading.RLock()
        self.wake = threading.Event()
        self.stop_event = threading.Event()
        self.worker: threading.Thread | None = None
        self.active: dict[str, set[str]] = {}
        self.pull_needed: set[str] = set()
        try:
            raw = json.loads(restore_pending() or "{}")
        except (ValueError, TypeError):
            raw = {}
        self.pending = {k:v for k,v in raw.items()
                        if isinstance(k,str) and isinstance(v,dict)
                        and v.get("kind") in {"upsert","closed"}
                        and isinstance(v.get("commander"),str)
                        and isinstance(v.get("occurredAt"),str)} if isinstance(raw,dict) else {}

    def _save_locked(self) -> None:
        self.persist_pending(json.dumps(self.pending, separators=(",", ":"), ensure_ascii=False))

    def start(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        self.stop_event.clear()
        self.worker = threading.Thread(target=self._loop, name="MongrelScoutMissionSync", daemon=True)
        self.worker.start()
        if self.pending:
            self.wake.set()  # Flush durable events after EDMC restart.

    def stop(self) -> None:
        self.stop_event.set()
        self.wake.set()

    def _queue(self, commander: str, kind: str, mid: int,
               observed_at: str, mission: dict | None = None) -> bool:
        when = stamp(observed_at)
        if not when:
            return False
        op = {"commander":commander,"kind":kind,"missionId":mid,"occurredAt":when}
        if kind == "upsert":
            if not isinstance(mission, dict):
                return False
            op["mission"] = dict(mission)
            op["mission"]["missionId"] = mid
            op["mission"]["updatedAt"] = when
            op["mission"]["acceptedAt"] = stamp(mission.get("acceptedAt")) or when
        unique = commander+"\0"+str(mid)
        old = self.pending.get(unique)
        if old and old.get("kind") == "closed":
            return False
        if old and kind != "closed" and stamp(old.get("occurredAt")) > when:
            return False
        if old == op:
            return False
        self.pending[unique] = op
        # Mission records are bounded; keep terminal events ahead of old upserts.
        if len(self.pending) > MAX_PENDING:
            ordered = sorted(self.pending, key=lambda item: (
                self.pending[item]["kind"]=="closed", self.pending[item].get("occurredAt","")))
            for drop in ordered[:len(self.pending)-MAX_PENDING]:
                self.pending.pop(drop, None)
        self._save_locked()
        return True

    def observe(self, commander: str, event: Mapping[str, Any], rows: list[dict]) -> None:
        commander = key(commander)
        if not commander:
            return
        name = str(event.get("event") or "")
        now = stamp(event.get("timestamp"))
        if not now:
            return
        with self.lock:
            if name == "Missions":
                values = event.get("Active")
                if not isinstance(values,list):
                    return
                active = {str(mid) for row in values if isinstance(row, Mapping)
                          for mid in [mission_id(row.get("MissionID"))] if mid is not None}
                self.active[commander] = active
                # Seed previously accepted missions when this PC has their
                # original journal records, including after a Scout update.
                for row in rows:
                    mid = mission_id(row.get("missionId"))
                    if mid is not None and str(mid) in active:
                        self._queue(commander,"upsert",mid,
                                    row.get("updatedAt") or row.get("acceptedAt") or now,row)
                self.pull_needed.add(commander)
                self.wake.set()
                return
            mid = mission_id(event.get("MissionID"))
            if mid is None:
                return
            if name in {"MissionCompleted","MissionFailed","MissionAbandoned"}:
                if commander in self.active:
                    self.active[commander].discard(str(mid))
                if self._queue(commander,"closed",mid,now):
                    self.wake.set()
                return
            if name == "MissionAccepted":
                if commander in self.active:
                    self.active[commander].add(str(mid))
            if name not in {"MissionAccepted","CargoDepot"}:
                return
            row = next((x for x in rows if mission_id(x.get("missionId"))==mid),None)
            if row and self._queue(commander,"upsert",mid,now,row):
                self.wake.set()

    def is_active(self, commander: str, mid: int) -> bool:
        with self.lock:
            return str(mid) in self.active.get(key(commander),set())

    def _request(self, method: str, commander: str, token: str,
                 operations: list[dict] | None = None) -> dict:
        from urllib.error import HTTPError, URLError
        url=self.endpoint
        data=None
        if method=="GET":
            url+="?"+urlencode({"commander":commander})
        else:
            data=json.dumps({"version":1,"commander":commander,
                             "operations":operations or []},separators=(",",":")).encode("utf-8")
        req=Request(url,data=data,method=method,headers={
            "Authorization":"Bearer "+token,
            "Accept":"application/json",
            "Content-Type":"application/json",
            "User-Agent":"MongrelScout/MissionSync-1",
        })
        with urlopen(req,timeout=6) as response:
            body=json.load(response)
        if not isinstance(body,dict) or body.get("ok") is not True:
            raise ValueError("mission_sync_invalid_response")
        return body

    def sync_once(self) -> bool:
        """One bounded I/O iteration; never called from EDMC's journal thread."""
        token=str(self.token() or "").strip()
        if not token:
            return False
        successful=True
        with self.lock:
            groups: dict[str,list[tuple[str,dict]]] = {}
            for ident,op in self.pending.items():
                groups.setdefault(op["commander"],[]).append((ident,dict(op)))
            commanders=set(self.active)
            pulls=set(self.pull_needed)
        for commander,batch in groups.items():
            selected=batch[:MAX_BATCH]
            try:
                result=self._request("POST",commander,token,
                                    [{k:v for k,v in op.items() if k!="commander"} for _,op in selected])
                if result.get("accepted")!=len(selected):
                    raise ValueError("mission_sync_partial_ack")
                with self.lock:
                    for ident,original in selected:
                        if self.pending.get(ident)==original:
                            del self.pending[ident]
                    self._save_locked()
                pulls.add(commander)
            except Exception:
                successful=False
        for commander in commanders & pulls:
            with self.lock:
                active=set(self.active.get(commander,set()))
            try:
                result=self._request("GET",commander,token)
                missions=result.get("missions")
                if not isinstance(missions,list):
                    raise ValueError("mission_sync_malformed_data")
                if active:
                    self.apply_remote(commander,missions[:128],active)
                with self.lock:
                    self.pull_needed.discard(commander)
            except Exception:
                successful=False
        with self.lock:
            if self.pending and successful:
                self.wake.set()  # Drain additional batches without a long delay.
        return successful

    def _loop(self) -> None:
        while not self.stop_event.is_set():
            due=self.wake.wait(POLL_SECONDS)
            self.wake.clear()
            if self.stop_event.is_set():
                break
            # Every active Commander gets an occasional safety reconciliation;
            # never poll the website every 30-second HUD feed cycle.
            with self.lock:
                if not due:
                    self.pull_needed.update(self.active)
            if not self.sync_once():
                if not self.stop_event.wait(RETRY_SECONDS):
                    self.wake.set()  # Keep retrying offline edits without busy polling.
