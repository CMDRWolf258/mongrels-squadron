# Mongrel Exobiology — archived owner test procedure

**Superseded by the normal production Scout 1.14.0 / HUD 0.18.0 downloads.**
This file is preserved only to document how the isolated pre-release packages
were tested. For installation now, use Mongrel Tools on the squad website,
`downloads/mongrel-scout/README.md`, and
`downloads/mongrel-hud/README.md`; do not use the old expiring test artifacts.

## Original staging instructions (historical)

# Mongrel Exobiology — coordinated owner test package

**STAGING / OWNER-ONLY — NOT THE PUBLIC SCOUT/HUD RELEASE.**

These two packages are built together from the *same repository commit* by
GitHub Actions > **Surveyor private test builds** > **Run workflow**.
Use the downloaded artifacts labelled
`MongrelScout-Exobiology-TEST` and `MongrelHUD-Exobiology-TEST`.
Internal development source versions at the time this plan was written:
Scout `1.13.16`, HUD `0.17.23`. Check the artifact's commit SHA, not
only the visible version label, before attempting to reproduce a bug.

## Important: don't install a new package after every merged PR

This is a staged development test build. The normal site download,
normal HUD auto-updater and EDMC plugin installation are unchanged.
Do NOT use the normal in-HUD **Update HUD** while testing the staged
executable; it is a separate release channel.

After GitHub Actions validates both build jobs, install them **together**
on the PC where Elite, EDMC and EDDiscovery normally run. An iPad only
opens that PC's paired controller web page; it should not download a
Windows HUD executable or an EDMC plugin.

## First owner test procedure (after we agree a build is ready)

1. Close EDMC and the normal MongrelHUD. Back up the active EDMC
   `MongrelScout` plugin folder and current HUD installation folder.
   Do **not** delete the existing persistent database at
   `%LOCALAPPDATA%\\MongrelScout\\surveyor.sqlite3`.
2. Extract the Scout artifact ZIP, and place the resulting
   `MongrelScout` directory in EDMC's plugins directory. The ZIP includes
   all current Scout dependencies, **including `mission_sync.py`**,
   the Surveyor modules and third-party license notices.
3. Extract the HUD test artifact to a *separate folder* from production.
   Run `MongrelHUD.exe` only after the normal HUD is fully closed;
   both use the same local port. Use the iPad controller already paired
   to that PC. No additional external biological application is required.
4. Enter the **Exploration** HUD profile. On iPad, open Surveyor >
   Biological Intelligence and enable its own panel if hidden. Its
   existing size/profile controls remain independent of other overlays.
5. Check one jump/honk/FSS/DSS sequence. A biological signal should
   create a candidate set. A confirmed DSS genus should filter possible
   species without claiming an actual species was discovered.
6. On a biological surface, verify the first, second and final
   Organic Sampling Tool samples show 1/3, 2/3 and 3/3. Sample spacing
   is displayed only if Scout has a fresh **same-body, same-system**
   on-foot position. When sufficient distance is measured, it is
   *not* evidence of another specimen being present.
7. If practical, check confirmed Vista Genomics earnings after selling
   samples. Those credits are separate from Universal Cartographics
   and never attributed to an invented origin world.
8. Spot-check cargo mission needs (especially switching between
   Serenity and laptop), trade/BGS, mining compass, carrier comms,
   original DSS and route instruments. They must work unchanged.

The model currently predicts only **60 curated species across 10 genera**.
Remaining flora types, galaxy-region/nebula conditions, parent-star
conditions and volcanic dependencies are unmodeled; **no prediction
does not mean no biological life**.

## Rollback

Close EDMC and the staged HUD, restore the backed-up `MongrelScout`
directory, and run the normal HUD again. The Scout SQLite ledger is
outside the plugin folder; do not remove it.

Only the existing local Scout state endpoint
`http://127.0.0.1:43857/v1/state` delivers exobiology to HUD. This
feature adds no additional website/Cloudflare reads or journal uploads.
If diagnosing a problem, use version + commit SHA, journal event type
and a screenshot; never share Scout auth tokens.
