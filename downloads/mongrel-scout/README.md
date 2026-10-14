## Scout 1.14.3 — Production Surveyor / Exobiology integration

**Released through the normal Mongrel Scout website download.** This is the
stable follow-up to the owner-only Exobiology test builds. Install the complete
`MongrelScout` folder from **MongrelScout.zip** on each Elite/EDMC computer;
the plugin folder contains its own Surveyor, EDDiscovery bridge and private
mission-sync modules. Scout is **not** updated automatically by HUD.

- **Exploration:** Frontier FSS/DSS/cartographic body records, first discovery
  estimates, mapping advisor, local historical journal and optional EDDiscovery
  reference. Asteroid-belt cluster scans do not inflate the system body count.
- **Exobiology:** all DSS-confirmed genera, partial source-attributed habitat
  predictions, **96 published Vista Genomics base values**, genus value ranges,
  species/variant confirmation from biological Codex entries or ScanOrganic,
  active three-part sampling, genetic distance in ship/SRV/on-foot when
  position evidence is valid, and saved completed species.
- **Expeditions:** separate biological completed-sample estimates, conditional
  first-logged bonus projections and confirmed Vista sales alongside cartographic
  data. First footfall is not proof of first-logged eligibility. Sales lack
  guaranteed originating-body attribution.
- **Privacy and costs:** Surveyor history and biology stay local on each PC.
  No new Cloudflare database, journal upload or recurring site-read dependency;
  the original cross-PC *cargo mission requirements* sync is unchanged.
- **Compatibility:** pair with Mongrel HUD **0.18.3** or later for the unified
  biological roster, Body Intelligence atmosphere label, and the in-flight
  displays. Previously saved Surveyor data is preserved and revalued in place.

**Upgrade:** Close EDMC; back up the existing MongrelScout folder; unzip the
new website package and replace the entire plugin folder; restart EDMC.
Do **not** delete `%LOCALAPPDATA%\\MongrelScout\\surveyor.sqlite3` or
existing EDMC configuration. HUD is a separate Windows download/update.
See the older notes below for the original mission sync design.

### Previous Scout 1.13.16 — Private cross-PC mission cargo synchronization

Scout automatically synchronizes active cargo mission requirements and delivery
progress between your computers, using your existing Commander-bound Scout
token. The current Elite `Missions` list on each PC decides which mission IDs
are eligible for restoration; terminal mission events prevent an old laptop from
reviving completed missions. Changes are queued locally during outages and
retried. Only mission IDs, commodity requirements, faction, destination and
delivery progress are shared privately. Ship cargo, raw journals and trade
purchase provenance remain local. There is no additional BGS credit.

**First time on both PCs:** update Scout to 1.13.16, sign in to Elite normally
on each computer, and allow a few moments for the active mission list to
reconcile. A mission whose original acceptance was logged on the first
computer is automatically transferred when that computer has connected at
least once with the new version. HUD 0.17.23 is compatible and needs no update.

### Previous Scout 1.13.15 — Surveyor exploration integration

Scout 1.13.15 adds Mongrel Surveyor's local exploration records, EDDiscovery historical scan integration, the Discovery Report's estimated credit values, the DSS mapping advisor, and live first-discovery / high-metal-content biological-signal HUD alerts. Historical exploration values are identified separately and do **not** count as new expedition earnings. Biological signal counts do not identify the species or prove first footfall.

The optional EDDiscovery connection and Surveyor display settings are available on the paired HUD controller. To use the new HUD exploration alerts, also update Mongrel HUD to a version supporting Surveyor (0.17.23 or newer). Scout continues to handle existing trade, mining, cargo, BGS, routing and carrier events.

### Previous Scout 1.13.8 — Rapid consecutive trade-sale reconciliation

When a station-market sale arrives before EDMC refreshes the Cargo count for
its preceding sale, Scout now retains verified station-purchase origin for the
immediately following sale only when the exact preceding pre/post inventory,
commodity, station, market, and timestamp agree (within 15 seconds). Genuine
unexplained cargo changes, unverified transfers, and carrier-market purchases
remain excluded. This change does not replay earlier trades or alter the server
reward rules.

### Previous Scout 1.13.6 — Verifiable personal carrier storage in trade BGS

Station-bought commodities temporarily stored in the **owner's personal
fleet carrier hold** and transferred back to the ship retain their station
purchase provenance. The plugin tracks those FIFO lots by Commander, verified
owned carrier MarketID and commodity in local EDMC configuration, including
across restarts and multiple days. The event's `tocarrier`/`toship`
direction is required; carrier market purchases, mined stock, foreign/unknown
carrier identity, missing amounts or unknown inventory remain ineligible.

Only a profitable real station `MarketSell` creates a new eligible Daily
Orders contribution. No stored cargo, purchase prices, journal history or
private inventories are uploaded. Historical previously excluded sales are
not retroactively credited without separate verification. No Cloudflare
read/write increase, HUD/website schema migration or UI update required.

## Scout 1.13.5 — Live SRV cargo transfers

Confirmed Frontier `CargoTransfer` journal events now update the **ship**
cargo HUD immediately when moving ore between an SRV and the ship, even if
EDMC's `CargoJSON` remains stale until boarding. The previously displayed
ship inventory is used as the pre-transfer base. The correction remains local
until Frontier reports another complete `Cargo` snapshot for Vessel Ship;
the full snapshot is authoritative and prevents double-counting.

SRV pickups still do not count as ship cargo until transferred. Mission-bound
cargo and stolen allocations are preserved, and there are no new Cloudflare
reads or activity uploads. If Frontier does not emit CargoTransfer on
confirmation, live HUD updates cannot be inferred reliably without verifying
a separate event.

## Scout 1.13.4 — SRV mining cargo accounting

Elite Market Connector updates its shared Cargo totals for SRV CollectCargo
and EjectCargo, even though the ship cargo hold has not changed. Scout now
keeps a per-Commander, local-only SRV adjustment and removes those provisional
SRV tons from the **ship-only** cargo HUD. A genuine CargoTransfer **toShip**
increases the ship hold once, and a fresh Ship Cargo journal snapshot clears
the adjustment. CargoJSON mission-reservation and stolen-goods metadata remain
available; unrelated mission, mining, trade and BGS accounting is unchanged.
No new website reads or Cloudflare writes are required.

## Live Universal Cartographics reporting (Scout v1.13.3)

Scout now uploads verified **SellExplorationData** and **MultiSellExplorationData**
journal transactions immediately, using the TotalEarnings value and confirmed
redemption station/faction. It uploads **only** the sale amount, journal
timestamp, event type, system ID, station and faction, plus a sale occurrence
number. Discovery names, scans, mapped bodies and full journals stay local.
Unsold scans, exobiology payouts and fleet carrier sales are not counted by
this feature.

The server gives each sale exactly one event identity across Scout and the
existing Frontier sync. Frontier confirmation replaces the provisional Scout
version, not adds to it. Identical Cartographics pages redeemed in the same
second remain individually countable. Existing Daily Orders exploration
targets, faction matching and BGS rules are unchanged.

## Trade split-sale reconciliation (Scout v1.13.2)

Scout now assigns per-sale occurrence ordinals to consecutive identical MarketSell journal entries, even when multiple chunks share one timestamp, commodity, quantity and price. It retains the ordinal on retry. The shared server normalizes Scout/CAPI sale identities and replaces live provisional reports with matching Frontier confirmations instead of stacking both reports. A future Frontier sync can reconcile previously merged historical duplicate IDs and confirm genuine repeated chunks. No source purchases or cargo inventory are uploaded.

# Mongrel Scout

**Short version:** install it in EDMC, paste in your Scout token, and leave it running while you play. You do **not** need to edit any files inside the plugin.

Full setup guide and current download:
https://mongrels-squadron.pages.dev/member/#mongrel-scout-setup

## Optional ChatGPT Scout Link (v1.13.1)

The private **Scout Link** setting is **off by default**. If enabled by the player **and** by the site's feature flags, Scout sends a small ship/system snapshot so the player's own ChatGPT plugin can read an accurate jump range. It uses a separate non-blocking upload path and does not alter existing BGS/trade/HUD pipelines.

The paired HUD controller now lets the Site Admin load a ready route by ID and explicitly Start or Stop Navigation without a ChatGPT action-approval prompt. The companion **Route Director** can retrieve a Spansh neutron route from ChatGPT and, **after the player explicitly activates navigation**, automatically copy each next route waypoint into the local Windows clipboard (paste into Elite's Galaxy Map). A separate checkbox lets the player disable automatic copying. Neither feature operates the game or sends full journal files.

A disabled, disconnected or stale Scout Link does not prevent ordinary Scout operations.

Scout 1.13.1 additionally saves confirmed waypoint progress locally so
restarting EDMC between neutron systems will not lose the next replot point.
It can re-copy the current target on explicit iPad command and recognizes
verified route completion without copying a phantom waypoint.

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
