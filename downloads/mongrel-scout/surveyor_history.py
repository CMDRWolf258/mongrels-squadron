"""Bounded, local-only Frontier journal import for Mongrel Surveyor.

Never submits history to Cloudflare or Scout's activity uploader. Journal
observations are deduplicated by Surveyor's persistent SQLite event digest.
Older journal events cannot change the live system pointer.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

MAX_FILES = 32
MAX_BYTES = 32 * 1024 * 1024
MAX_LINES = 120_000


def import_recent_journals(surveyor: Any, commander: str, journal_dir: str | Path) -> dict[str, Any]:
    """Replay recent complete journal lines for exactly one CMDR.

    A Commander/LoadGame identity and an explicit system-address context are
    required in each journal. The result contains only counts, never private
    names, journal content, paths, or detailed body records.
    """
    stats: dict[str, Any] = {
        "status": "not_started", "files": 0, "processed": 0,
        "duplicates": 0, "skipped": 0, "limited": False,
    }
    if not commander or not journal_dir:
        stats["status"] = "journal_folder_unavailable"
        return stats
    try:
        all_paths = sorted(
            (p for p in Path(journal_dir).expanduser().glob("Journal*.log") if p.is_file()),
            key=lambda p: p.name,  # Frontier journal names include the start timestamp
        )
        stats["limited"] = len(all_paths) > MAX_FILES
        files = all_paths[-MAX_FILES:]
        sizes = [p.stat().st_size for p in files]
        while files and sum(sizes) > MAX_BYTES:
            files.pop(0)
            sizes.pop(0)
            stats["limited"] = True
    except (OSError, ValueError):
        stats["status"] = "journal_folder_unavailable"
        return stats

    if not files:
        stats["status"] = "no_journals_in_window"
        return stats

    expected = commander.strip().casefold()
    total_lines = 0
    # Every journal file requires its own CMDR identity. Do not inherit the
    # previous file's system context: sessions can switch commanders.
    for file in files:
        file_commander = ""
        address = ""
        system_name = ""
        try:
            with file.open("r", encoding="utf-8", errors="replace") as stream:
                for line in stream:
                    total_lines += 1
                    if total_lines > MAX_LINES:
                        stats["limited"] = True
                        stats["status"] = "partial"
                        return stats
                    if '"event"' not in line:
                        continue
                    try:
                        event = json.loads(line)
                    except (ValueError, UnicodeError):
                        stats["skipped"] += 1
                        continue
                    if not isinstance(event, dict):
                        continue
                    kind = str(event.get("event") or "")
                    if kind in {"Commander", "LoadGame"}:
                        value = event.get("Name") if kind == "Commander" else event.get("Commander")
                        file_commander = str(value or "").strip().casefold()
                        address, system_name = "", ""
                        continue
                    if file_commander != expected:
                        continue
                    if kind in {"Location", "FSDJump", "CarrierJump"}:
                        raw_address = event.get("SystemAddress")
                        if raw_address is not None and str(raw_address).isdigit():
                            address = str(raw_address)
                            system_name = str(event.get("StarSystem") or system_name)
                    if kind not in surveyor.SURVEY_EVENTS:
                        continue
                    # No guesswork: many Scan/FSS records do not carry
                    # SystemAddress; they need a prior explicit location.
                    event_address = event.get("SystemAddress")
                    resolved = str(event_address) if event_address is not None else address
                    if not resolved or not resolved.isdigit():
                        stats["skipped"] += 1
                        continue
                    try:
                        snapshot = surveyor.apply(
                            commander, event, fallback_system=system_name,
                            fallback_address=resolved, historic=True,
                        )
                        if snapshot is None:
                            stats["duplicates"] += 1
                        else:
                            stats["processed"] += 1
                    except (OSError, ValueError, TypeError):
                        stats["skipped"] += 1
            stats["files"] += 1
        except (OSError, UnicodeError):
            stats["skipped"] += 1
            stats["limited"] = True
    stats["status"] = "partial" if stats["limited"] or stats["skipped"] else "completed"
    return stats
