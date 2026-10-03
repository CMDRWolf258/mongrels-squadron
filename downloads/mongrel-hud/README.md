# Mongrel HUD Prototype

This is the first local HUD/controller prototype for the Mongrels. It is intentionally small enough to flight-test before the visual layout is locked down.

## Requirements

- Windows PC running Elite Dangerous.
- EDMC with **Mongrel Scout v1.6.0 or newer** installed and enabled.
- No Python installation is required for the Windows build.
- iPad and PC on the same private/home LAN for the controller.

## Start

1. Install/update Mongrel Scout and restart EDMC.
2. Extract **MongrelHUD-Windows.zip** anywhere convenient.
3. Double-click **MongrelHUD.exe**.
4. The PC window shows the local iPad address and a six-digit pairing PIN.
5. Open that address on the iPad and enter the PIN.
6. If Windows Firewall or SmartScreen asks, allow the app on **Private networks only**. The current prototype is unsigned, so Windows may show an "unrecognized app" warning.

The transparent overlay is top-most and click-through on Windows. Use the small PC control window to show/hide it or generate a new pairing PIN.

## Profiles

### Combat

The first pass keeps information visible when cockpit head movement pushes Elite's normal HUD out of view:

- your ship name, max jump range, current fuel, SYS/ENG/WEP pips, shield **UP/DOWN** state and last reported hull percentage;
- a persistent tracked bounty ledger with a zero floor, plus this-run earnings, kill count and last bounty;
- Wanted/legal status and bounty when the completed target scan reports one;
- current targeted subsystem;
- observed subsystems grouped into stable **Hardpoints / Critical Systems / Secondary** columns. Rows stay in first-seen order so health updates do not make the list bounce around. Health and observation age remain visible because module values refresh when Elite reports them, not as a guaranteed continuous stream;
- the target shield/hull scan snapshot is kept out of the desktop overlay because it is not a reliable live damage feed.

The desktop overlay is now borderless, transparent and click-through; only the HUD text is visible over Elite.

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
