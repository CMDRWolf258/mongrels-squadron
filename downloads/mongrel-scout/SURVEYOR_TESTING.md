# Mongrel Surveyor — owner-only live acceptance build

**TEST BUILD, NOT A SQUAD RELEASE.** Scout 1.13.14 and HUD 0.17.22 are
isolated GitHub Actions artifacts. They are not published by the normal
MongrelHUD updater or the live Mongrel Tools Scout download.

## Install on Serenity

1. Close EDMC and MongrelHUD. Leave your existing production Scout/HUD downloads and auto-updater untouched. Make a backup of your current EDMC
   `MongrelScout` plugin folder (Scout 1.13.8) and the current HUD
   installation folder (HUD 0.17.15). Keep both backup copies outside
   their active program folders.
2. Download **both** test artifacts from the *Surveyor private test builds*
   GitHub Actions run. Each Actions artifact contains a ZIP. Extract the
   inner ZIP (do not try to point EDMC at the ZIP itself).
3. Replace the EDMC plugin folder with the **MongrelScout** folder from
   the extracted Scout ZIP. Keep your EDMC config/token unchanged.
4. Extract the test HUD into its **own** folder, separate from the normal
   HUD executable. Run this test executable only after closing your
   normal HUD, so they do not compete for the local controller port.
5. Start EDMC, then test HUD. Check Scout **1.13.14** and HUD **0.17.22**.
   Open the existing paired iPad HUD controller, then find
   **Mongrel Surveyor** in Overlay Layout. It starts hidden; switch it
   ON and choose Surface or Navigation (or both) as desired.
6. In EDMC Settings > Plugins > Mongrel Scout, leave the separate
   **Surveyor community enrichment** checkbox OFF unless you explicitly
   want read-only system lookups from EDSM/Spansh.

Do **not** press the HUD's normal **Update HUD** while testing: that
uses the separate production channel and could replace the test build.

## First test pass

- Confirm the private local exploration ledger starts/imports existing
  journals without freezing Elite/EDMC. Historical import never uploads
  old cartographics sales to Daily Orders.
- Do a jump/honk/FSS scan; confirm system and body counts change on the
  Surveyor panel. Use DSS on a scanned unmapped candidate, confirm it
  drops from the mapping advisor.
- Check the 3 top DSS targets, missing-distance labels, estimates-only
  wording and visibility/text-size controls on iPad and Windows.
- If you sell Universal Cartographics data, note the actual credit
  receipt and compare with Surveyor's *estimates*; do not assume the
  model is calibrated. Test the existing Scout + Frontier reconciliation.
- Briefly exercise core cargo, trade, mining navigation, route clipboard,
  BGS and carrier/voice functions. Longer CPU/storage and 8-hour
  endurance checks can follow once the initial pass is stable.

## Data boundaries and rollback

The Surveyor ledger is local and persisted under
`%LOCALAPPDATA%\\MongrelScout\\surveyor.sqlite3` on Windows; it is
outside the replaceable plugin directory. Do not delete it to roll back.
The ledger is per-Commander. Normal Scout uploads continue to work,
but no personal scan lists/discovery records or unsold estimates enter
Cloudflare. Community lookups are opt-in, cached and external.

To roll back, close HUD and EDMC, restore your backed-up Scout 1.13.8
plugin folder, and start your normal HUD 0.17.15 executable. No cloud
schema migrations or website rollback are required.

Record any anomalies with: exact Scout/HUD version, system/body, which
journal action triggered it, and a screenshot of the HUD/iPad screen.
Do not share tokens or raw account credentials.

## Expedition control acceptance (TEST only)

Open **Surveyor · Expedition Control** on the paired iPad. The **Current System** figure
is the observed scan estimate, including possibly sold historical data. **Expedition** starts
at zero when you press **Start Exploration** and counts new eligible FSS scans and incremental
DSS mapping gains only. **Already Explored** marks a current-system cutoff and hides any
expedition credits recorded there before that button; future new scans/maps still count.
**Undo Exclusion** restores the hidden credited work without removing the local scans.
**End Expedition** closes the accounting session. All selections persist locally in SQLite;
no new server polling or telemetry uploads were added.

Live verification: Start, scan a new body, mark this system already explored, scan/map
another body, undo, and restart EDMC/HUD. Compare figures and confirm other Scout/HUD
functions continue normally. Estimates are not proof of unsold Cartographics data.

## Exploration HUD refresh (TEST only)

Select the **Exploration** profile on the paired iPad. Three independently sized
and positioned instruments are shown: **Expedition Telemetry** (system value,
expedition total, local scan status), **DSS Target Director** (top three journal-
confirmed mapping recommendations plus *separately identified* community catalog
hints), and **Body Intelligence** (Elite-selected destination, else last journal
scan; catalog-only facts never imply personal discovery).

Community charts are OFF by default. The owner can explicitly enable EDSM/Spansh
on the paired iPad; only the current system name and ID64 are sent to those
providers. No additional Cloudflare polling is used. The Cartographics quote
control records observed UC quotes locally; its diagnostic comparison ratios
**never** apply a global multiplier to Surveyor or expedition credits.

Use the next TEST builds, not earlier 1.13.11/0.17.19 artifacts. This PR is
unmerged and has no production auto-updater changes.

## Discovery intel and payout feedback (Scout 1.13.14 / HUD 0.17.22)

The Exploration profile instruments draw only **one** title each. System telemetry
shows Frontier journal first-arrival signals and clearly separates FSS counts
from journal body counts when those disagree. The DSS Director calls attention to
valuable *unmapped-at-scan* targets. Body Intelligence shows the current Elite
body target or last saved actual journal body, with previous-discovery/mapping
flags from your Scan events.

Community Charts remain opt-in. EDSM and Spansh responses show **community
reported**, never *definitively first discovered* or *first mapped*. No listing
means **unverified**, not undiscovered. The paired iPad includes a collapsible
Discovery Report listing local journal body flags alongside community body
records. If community data was enabled with an older test build, press **Refresh
This System** once to refresh the cached report.

The payout model now matches the journal names `Sudarsky class I/II gas giant`
with the corresponding high-value categories; earlier builds incorrectly used
the generic low-value coefficient. Changes recalculate from the existing private
ledger. Cartographics quotes and EDDiscovery screenshots are *comparisons*, not
proof of an exact payout. No global multiplier is applied.

## EDDiscovery interoperability (under automated development)

Surveyor now has an **optional read-only local EDDiscovery bridge**. EDDiscovery
19+ already supports a built-in Web Server, enabled under EDDiscovery Settings.
On the paired HUD controller, enter that Web Server's configured port under
**EDDiscovery · Local Historical Scans** and explicitly select **Link EDDiscovery**.
Do not open Windows firewall access to the iPad/LAN solely for this connection;
Scout talks to `127.0.0.1` on Serenity.

The adapter makes one bounded WebSocket `EDDJSON` `scandata` request when entering
a system, with no extra dependencies, no recurring Cloudflare reads, and no
new uploads. It retains EDDiscovery's own estimated values and prior body
scan/map history in a separate **historical read-only** slot, not Frontier
journal events or expedition credits. A value for a body previously sold is
still *historical* and never automatically counted as new earnings.

EDDiscovery's local response must contain matching system identity evidence;
if it cannot be verified, Scout does not borrow possibly unrelated body data.
The controller shows **Server unavailable** versus **System not verified**
instead of silently reporting an empty database. Unlink immediately disables
future local requests. The link is fully optional for CMDRs without EDD.

This is still an isolated PR #200 development feature, **not approved production**.
The WebSocket protocol has an offline mock-server test covering framing,
identity isolation, persisted history, and no credited earnings. We have not
yet verified the full live connection against Serenity's EDDiscovery settings.

Reference:
- EDDiscovery Web Server: https://github.com/EDDiscovery/EDDiscovery/wiki/2.8-EDD-Web-Server-%28Roccat-Style-Grid%29
- Native scan request: https://github.com/EDDiscovery/EDDiscovery/blob/master/EDDiscovery/WebServer/EDDWebScandata.cs
- Apache-2.0 EDDiscovery valuation reference: `THIRD_PARTY_NOTICES.md`

## Isolated EDDiscovery link acceptance package

This build uniquely identifies the optional read-only EDDiscovery localhost
history bridge as Scout 1.13.14-TEST and HUD 0.17.22-TEST. Do not confuse it
with the previous 1.13.13/0.17.21 build, which lacks the new local EDD link.
