# Mongrels Squadron Site v49 — Live Carrier Locations + Favicon

This release adds EDDN-backed carrier location syncing and the Mongrels crest as the browser-tab/site icon while retaining all v48 carrier registry and coordination features.

## New in v49
- Registered fleet carriers are looked up by their permanent callsign against EDData's EDDN-backed station data when the Carrier board loads.
- Location checks are throttled per carrier (15-minute lookup window) and processed in small batches.
- Newer telemetry can automatically update Current System.
- A newer member-entered correction is never overwritten by older telemetry.
- Carrier location cards now show source, age, and Fresh / Aging / Stale status.
- Manual Current System remains available as a fallback/correction.
- Planned destination, departure/ETA, cargo requests, and purpose remain manual because they represent player intent rather than telemetry.
- Mongrels crest favicon added across every page, plus Apple touch icon assets.
- Asset cache version bumped to v49.

## Existing Cloudflare setup
No new Cloudflare binding or secret is required. This release continues to use the existing:

- KV binding: `CARRIERS`
- Namespace: `mongrels-carriers`

The live lookup is performed server-side by the existing Pages Function, so no third-party API key is exposed in browser JavaScript.

## Location-source behavior
- `EDDN / EDData`: current system came from community telemetry.
- `Member reported`: current system was manually entered or corrected by a member.
- If a manual correction is newer than available telemetry, the manual value stays in place until newer telemetry arrives.
- Telemetry can be stale if the carrier has not been reported to EDDN recently; the UI shows the age/freshness rather than presenting old data as guaranteed live.

## Favicon note
Browsers cache favicons aggressively. If the old/no icon remains after deployment, close/reopen the tab or browser; it may take a short while for the new icon to refresh.
