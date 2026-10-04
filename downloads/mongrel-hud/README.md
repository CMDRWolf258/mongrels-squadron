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

## Cargo overlay

Mongrel HUD 0.8.0 adds an optional **Cargo** overlay. It is assigned to **Both** profiles but remains **OFF by default** so an update never rearranges an existing cockpit layout. When enabled it shows used/capacity/free tonnage, separates limpets and stolen cargo, lists the remaining normal cargo hold, and aggregates locally tracked commodity-mission requirements by commodity. For example, three Osmium missions requiring 30 + 46 + 40 tonnes are presented as one 116 t requirement, with the live hold amount and the remaining amount still needed. Mission details are supplied locally by Mongrel Scout and are not uploaded to the website.

### Surface Mining

Mongrel HUD 0.7.1 uses the curated 10-16 mining database as the source of truth.

- Mining **location centers** and individual **deposits** are separate records. The iPad can **Set / Update Center** for a Signal # from the current Elite surface position.
- Surface Navigation shows two simultaneous instruments: one compass/readout for the selected Mining Location center and one for the selected deposit.
- Mining Intel is scoped to the selected Signal # and lists its nearest deposits.
- Report Deposit uses a canonical commodity dropdown populated from the mining database, with **Other / not listed** for genuinely new commodities.
- Deposit reports capture current body, Signal #, latitude/longitude and planet radius automatically.
- A same-Signal, same-commodity report within 1 km of an existing deposit is held as a **possible duplicate** instead of silently creating another coordinate. Mining Admin shows both entries side-by-side and lets the reviewer keep either the existing or new entry.
- The local report log remains only as a troubleshooting/offline record; the curated archive is authoritative.

