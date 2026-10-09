# Mongrel Scout

**Short version:** install it in EDMC, paste in your Scout token, and leave it running while you play. You do **not** need to edit any files inside the plugin.

Full setup guide and current download:
https://mongrels-squadron.pages.dev/member/#mongrel-scout-setup

## What Scout does

Mongrel Scout is an EDMC plugin for the squad. It quietly sends the specific Elite data our tools need, such as:

- BGS faction-board updates
- station market prices, supply and demand
- station/facility placement information for the Orrery
- selected mission, bounty, eligible purchased-cargo trade-profit and colonization results used by Mission Control
- **Mongrel Surveyor foundation (development):** keeps a private SQLite exploration journal, scan/map history and preliminary cartographic estimates on the PC; nothing from this new history is sent to Cloudflare

It is event-driven. There is nothing you need to "run" inside the plugin after setup.

**Live trade-profit progress (v1.12.3):** Scout tracks purchase-origin quantities **locally** and batches eligible profitable sales at ordinary station markets into Mission Control within the existing 8-second activity upload window. No cargo inventory or purchase history is uploaded. Mined cargo, carrier-bought cargo, black-market/stolen sales, and sales with incomplete/unknown purchase history will **not** be credited live; use Frontier **Sync Activity** to reconcile missed or uncertain transactions. Start Scout before purchasing the cargo so the journal origin can be verified.

## Install

1. Install and open **Elite Dangerous Market Connector (EDMC)**.
2. Download **MongrelScout.zip** from the Mongrels site and unzip it.
3. In EDMC go to **File → Settings → Plugins → Open**.
4. Windows will open EDMC's real plugin folder. **Use that folder. Do not go looking under Program Files.**
5. Copy the whole extracted **MongrelScout** folder into the plugin folder.
6. Restart EDMC.
7. Open **Settings → Mongrel Scout**.
8. Paste the Scout token given to you by squad leadership.
9. Make sure **Enable Mongrel Scout** is checked.

That is it. Do not move, rename or edit the individual files inside the MongrelScout folder.

## How to know it is working

In the EDMC window, Mongrel Scout shows a short status message.

| Message | Meaning |
| --- | --- |
| **Armed** | Scout is ready and waiting for Elite events. |
| **Updated <system>** | A BGS update was accepted. |
| **Market updated: <station>** | That station's market data was sent. |
| **Facility mapped: <facility>** | Scout captured verified surface-facility coordinates. |
| **Station context recorded: <station>** | Scout saw the station, but its host body was not directly verified. |
| **Host verified: <station> → <body>** | Scout verified the station's host body. |
| **Already newer** | The server already has newer data. Nothing is wrong. |
| **Not assigned: <system>** | Your Scout token is not allowed to report that system. |
| **Token rejected** | Your token is invalid or has been revoked. Ask leadership for help. |
| **Upload failed** | Scout could not reach the Mongrels server. Check your connection first. |

For a normal BGS refresh, entering a Mongrel system can be enough when Elite writes a fresh faction board.

For **market data**, you must actually visit the station.

## Updating Scout

1. Close EDMC.
2. Download the newest **MongrelScout.zip**.
3. Unzip it.
4. Replace the old **MongrelScout** plugin folder with the new one.
5. Start EDMC again.

Your Scout token is stored in EDMC's settings and normally does not need to be entered again.

## Using Mongrel HUD too?

Mongrel HUD talks to Scout locally, so Scout should be installed, enabled and running whenever you use the HUD.


## Surveyor community intelligence (development build)

Mongrel Surveyor maintains a persistent, **local** exploration ledger of
your journal-confirmed scans, maps, possible first discoveries, and
**estimated** unsold cartographic data. Its experimental cartographic
estimates may differ from Frontier sales and are not guaranteed values.

With the **Surveyor: enrich current systems from EDSM and Spansh** checkbox
enabled (the default), Scout requests known system information directly from
those two providers as you enter systems. Only the current system name/ID is
used in these HTTPS lookups; their servers can observe the requested systems.
No Commander name, account token, journal contents, or estimated earnings are
sent to EDSM or Spansh. You can uncheck the box in EDMC's Mongrel Scout
settings at any time. Local journal tracking continues without either service.

Cached intelligence is advisory; *missing* public database entries do not
prove a first discovery, and the external body catalog never creates
personal cartographic earnings. The optional **Mongrel Surveyor** overlay
can be enabled and sized in the paired HUD layout controls. Existing panels
remain in their prior profiles/positions and the new panel defaults off.

This feature remains on a **draft development branch**, not an installed
production release. No Cloudflare exploration-history storage or
automatic squad publication is involved.

## Privacy

Scout does **not** upload your full journal, Commander name, cargo inventory, credit balance, ship build, materials, or general route history.

Surveyor's optional EDSM/Spansh requests disclose only your current system name/ID to those third parties. Disable community lookups in EDMC settings to avoid that disclosure.

It only sends the squad data it is designed to report, such as BGS snapshots, public station-market data, facility-placement facts, and selected mission/bounty/colonization/**eligible trade-sale** results used by Mongrel tools. Local purchase-origin tracking stays on the PC and is never uploaded.

## Need help?

Use the setup guide on the Member Portal:
https://mongrels-squadron.pages.dev/member/#mongrel-scout-setup

If that does not solve it, post the exact status message you see in EDMC so we know where the problem is.

---

Developer/engineering details are intentionally kept out of this README. They are preserved in the repository at:

`downloads/mongrel-scout/TECHNICAL_NOTES.md`
