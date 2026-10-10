# Mongrel Surveyor — owner-only live acceptance build

**TEST BUILD, NOT A SQUAD RELEASE.** Scout 1.13.4 and HUD 0.17.12 are
isolated GitHub Actions artifacts. They are not published by the normal
MongrelHUD updater or the live Mongrel Tools Scout download.

## Install on Serenity

1. Close EDMC and MongrelHUD. Make a backup of your current EDMC
   `MongrelScout` plugin folder (Scout 1.13.3) and the current HUD
   installation folder (HUD 0.17.11). Keep both backup copies outside
   their active program folders.
2. Download **both** test artifacts from the *Surveyor private test builds*
   GitHub Actions run. Each Actions artifact contains a ZIP. Extract the
   inner ZIP (do not try to point EDMC at the ZIP itself).
3. Replace the EDMC plugin folder with the **MongrelScout** folder from
   the extracted Scout ZIP. Keep your EDMC config/token unchanged.
4. Extract the test HUD into its **own** folder, separate from the normal
   HUD executable. Run this test executable only after closing your
   normal HUD, so they do not compete for the local controller port.
5. Start EDMC, then test HUD. Check Scout **1.13.4** and HUD **0.17.12**.
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

To roll back, close HUD and EDMC, restore your backed-up Scout 1.13.3
plugin folder, and start your normal HUD 0.17.11 executable. No cloud
schema migrations or website rollback are required.

Record any anomalies with: exact Scout/HUD version, system/body, which
journal action triggered it, and a screenshot of the HUD/iPad screen.
Do not share tokens or raw account credentials.
