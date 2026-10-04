# Mongrel HUD Prototype

This is the first local HUD/controller prototype for the Mongrels. It is intentionally small enough to flight-test before the visual layout is locked down.

## Requirements

- Windows PC running Elite Dangerous.
- EDMC with **Mongrel Scout v1.8.0 or newer** installed and enabled.
- No Python installation is required for the Windows build.
- iPad and PC on the same private/home LAN for the controller.

## Start

1. Install/update Mongrel Scout and restart EDMC.
2. Extract **MongrelHUD-Windows.zip** anywhere convenient.
3. Double-click **MongrelHUD.exe**.
4. The PC window shows the local iPad address and a six-digit pairing PIN.
5. Open that address on the iPad and enter the PIN.
6. If Windows Firewall or SmartScreen asks, allow the app on **Private networks only**. The current prototype is unsigned, so Windows may show an "unrecognized app" warning.

The HUD is rendered as independent top-most transparent panels rather than one large overlay window. In normal **LOCKED** mode the panels are click-through. From the iPad controller, choose **UNLOCK LAYOUT** to expose draggable panel headers on the PC, move them wherever you want, adjust each panel to 75–150% size, then lock the layout again. Panel positions, visibility and scale persist in the local state file. **Reset Layout** restores the default positions. The small PC control window remains available for show/hide, lock/unlock and pairing.

## Profiles

### Combat

The first pass keeps information visible when cockpit head movement pushes Elite's normal HUD out of view:

- your ship name, **live current normal jump range**, Frontier unladen range, current fuel/cargo/mass, SYS/ENG/WEP pips, shield **UP/DOWN** state and last reported hull percentage;
- a persistent tracked bounty ledger with a zero floor, plus this-run earnings, kill count and last bounty;
- Wanted/legal status and bounty when the completed target scan reports one;
- current targeted subsystem;
- observed subsystems grouped into stable **Hardpoints / Critical Systems / Secondary** columns. Rows stay in first-seen order so health updates do not make the list bounce around. Health and observation age remain visible because module values refresh when Elite reports them, not as a guaranteed continuous stream;
- the target shield/hull scan snapshot is kept out of the desktop overlay because it is not a reliable live damage feed.

The Combat HUD is split into independent **Own Ship**, **Target**, **Subsystems**, and **Bounties** windows. In locked mode each is borderless, transparent and click-through; only the HUD text is visible over Elite. The Surface Mining profile uses its own independently positioned panel.

No game inputs are generated. The companion is read-only with respect to Elite controls.

### Surface Mining

- **SET SITE CENTER** captures current system, body and latitude/longitude, then stores the chosen site number.
- Saved sites are filtered to the body you are currently on.
- Selecting a site shows continuous great-circle distance, absolute bearing and left/right direction using Elite's live surface position and planet radius.
- **REPORT DEPOSIT** captures system/body/coordinates and the active site automatically. You only fill in commodity, rig count and optional notes.
- Sites and deposit reports are stored locally on the PC for this prototype. They are not yet uploaded to the Mongrels site.

## Security boundary

Mongrel Scout itself remains loopback-only on **127.0.0.1:43857**. It is not exposed to the iPad or LAN.

Only this companion listens on LAN port **43858**. The controller API requires the pairing PIN, uses an HttpOnly same-site session cookie, rejects cross-origin POSTs, and deliberately emits no permissive CORS header.

This prototype uses ordinary HTTP because it is intended for a trusted private LAN. Do not port-forward 43858 or expose it directly to the internet.


## Global information panels

Mongrel HUD 0.6.0 adds **Mission Control**, **Trader's Outpost**, **Scout Board**, **Leadership Alerts**, and **Notes** as independent panels. Every panel has a profile assignment in the iPad controller, so it can be shown in Combat, Surface Mining, or both profiles. Mission Control and Leadership Alerts default to visible in both; Trader's Outpost, Scout Board and Notes are available but default off until positioned.

Scout 1.7.0 fetches the authenticated site summaries with its existing bound Scout token. The HUD companion never receives the raw token. Current faction operational alerts, active payout requests, recent material Daily Order changes, and degraded/unavailable managed trade routes become leadership alerts. Unacknowledged alerts flash on the PC overlay and can be acknowledged individually or all at once from the iPad; acknowledgements are stored by the website for the token owner.

HUD Notes are intentionally local-first. Up to 4,000 characters can be entered on the iPad controller and displayed in the Notes overlay. Notes are stored in the local Mongrel HUD state file and are not uploaded to the website in this version.


## Current jump calculator

Mongrel HUD 0.6.0 displays Scout 1.8.0's live normal jump calculation as **CURRENT JUMP** and keeps Frontier's Loadout value beside it as **UNLADEN**. The current value responds to live cargo and fuel mass and uses the fitted FSD's class/rating, SCO/standard characteristics, engineering optimal-mass modifier, maximum fuel per jump and Guardian FSD Booster. The iPad diagnostic card also shows current cargo and calculated ship mass so flight testing can compare the result against Elite directly. Synthesis and neutron/white-dwarf boosts are intentionally excluded from this normal-range value for now.


## Target loadout scanner

Mongrel HUD 0.6.0 adds an on-demand, local target-module capture workflow. Open Elite's **Target → Sub-Targets** list and tap **SCAN LOADOUT** on the iPad. The HUD samples the foreground Elite window for about two seconds while you scroll, then performs OCR locally on Serenity. No screenshot or OCR text is uploaded.

The scanner stitches overlapping frames in list order so modules visible in consecutive captures are not double-counted while genuine duplicate modules are preserved and condensed (for example, **Mine Launcher ×3**). Universal/core modules are used internally to align the scrolling list but are filtered out of the tactical display. The retained categories are **Offense**, **Defense**, and **Special**.

The four most recent successful target captures are held in memory for the current HUD session. Returning to a matching pilot/ship restores that loadout automatically. This cache intentionally does not persist across HUD restarts.
