# Mongrel HUD Prototype

This is the first local HUD/controller prototype for the Mongrels. It is intentionally small enough to flight-test before the visual layout is locked down.

## Requirements

- Windows PC running Elite Dangerous.
- EDMC with **Mongrel Scout v1.5.0 or newer** installed and enabled.
- Python 3 for Windows for this prototype. After the flight-test phase the companion can be packaged as a standalone executable so Python is no longer required.
- iPad and PC on the same private/home LAN for the controller.

## Start

1. Install/update Mongrel Scout and restart EDMC.
2. Extract this ZIP anywhere convenient.
3. Double-click **run.bat**.
4. The PC window shows the local iPad address and a six-digit pairing PIN.
5. Open that address on the iPad and enter the PIN.
6. If Windows Firewall asks, permit the companion on **Private networks only**.

The transparent overlay is top-most and click-through on Windows. Use the small PC control window to show/hide it or generate a new pairing PIN.

## Profiles

### Combat

The first pass keeps information visible when cockpit head movement pushes Elite's normal HUD out of view:

- your own shield **UP/DOWN** state and last reported hull percentage;
- current target hull/shield percentage when Elite reports it;
- Wanted/legal status and bounty when the completed target scan reports one;
- current targeted subsystem;
- a **last seen module** list that remembers subsystem health as you manually view modules. The age is shown because cached module values are not guaranteed current.

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
