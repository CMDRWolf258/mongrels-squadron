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

It is event-driven. There is nothing you need to "run" inside the plugin after setup.

**Live trade-profit progress (v1.12.4):** Scout tracks purchase-origin quantities **locally** and batches eligible profitable sales at ordinary station markets into Mission Control within the existing 8-second activity upload window. When Scout was not running for a purchase, it can reconstruct purchase origins from recent local Frontier journals on the next live sale. Recovery requires a known ship-cargo starting point, the same Commander, a unique matching sale, continuous journal history and reconciled cargo quantities; ambiguous or incomplete evidence remains excluded. Historic purchases and sales are **not uploaded**. Mined cargo, carrier-bought cargo, black-market/stolen sales and unverifiable or mixed-origin cargo remain ineligible; use Frontier **Sync Activity** if journal recovery cannot verify a transaction. No cargo inventory or purchase history is uploaded.

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

## Privacy

Scout does **not** upload your full journal, Commander name, cargo inventory, credit balance, ship build, materials, or general route history.

It only sends the squad data it is designed to report, such as BGS snapshots, public station-market data, facility-placement facts, and selected mission/bounty/colonization/**eligible trade-sale** results used by Mongrel tools. Local purchase-origin tracking stays on the PC and is never uploaded.

## Need help?

Use the setup guide on the Member Portal:
https://mongrels-squadron.pages.dev/member/#mongrel-scout-setup

If that does not solve it, post the exact status message you see in EDMC so we know where the problem is.

---

Developer/engineering details are intentionally kept out of this README. They are preserved in the repository at:

`downloads/mongrel-scout/TECHNICAL_NOTES.md`
