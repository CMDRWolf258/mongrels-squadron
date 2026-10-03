# Mongrel Scout EDMC Plugin

Mongrel Scout sends sanitized BGS snapshots directly to Wolf BGS Control, fresh station commodity-market snapshots to Trader's Outpost, verified public surface-facility coordinates to the System Orrery, and a local-only event bridge for future Mongrel HUD/voice features.

## Install

1. Install and run the current Elite Dangerous Market Connector (EDMC).
2. Download **MongrelScout.zip** from the Mongrels site and unzip it. Open the top-level **README.md** first; the plugin folder itself can be treated as a black box.
3. In EDMC open **File → Settings → Plugins → Open**. **This reveals EDMC's actual plugin folder.** Use the folder EDMC opens rather than trying to find one under Program Files yourself.
4. Copy the extracted **MongrelScout FOLDER** into the plugin folder EDMC just opened. Copy the whole folder, not the individual files inside it.
5. Restart EDMC.
6. In **Settings → Mongrel Scout**, paste the one-time Scout token issued by squad leadership.
7. Leave **Enable Mongrel Scout** checked.

After installation, the EDMC plugins folder should contain a **MongrelScout** folder. You should not need to open, edit, or move individual files inside that folder.

After that, just play Elite. Jumping into a Mongrel system is enough when the journal event contains its faction board. Scout is event-driven, not a continuous poller: if you are already sitting in a system and need a fresh post-tick board, jump out and back in so Elite writes a new FSDJump faction board.

For **market data**, the scout must visit the actual station or port. When Elite/EDMC supplies the station's `Market` event with commodity rows, Mongrel Scout sends that market snapshot directly to Trader's Outpost. Merely entering the system does not refresh station prices, supply, or demand. The direct Scout snapshot is preferred over an older external-market observation when Trader's Outpost searches that station.

Market visits do not currently complete ordinary BGS Scout Jobs or issue a payout automatically. They are stored with Scout-token attribution so a separate paid market-scout job can be added cleanly if leadership chooses to use that workflow.

For **surface facilities**, simply approach the settlement normally. When Elite writes an `ApproachSettlement` journal event, Scout sends the facility's public Market ID, system address, host body ID/name, latitude, longitude, and event time. The Orrery can then match that observation to an existing imported facility and replace a schematic marker with exact surface placement automatically. You do not need to land, type coordinates, or submit a separate form. This passive facility observation does not complete a Scout Job or issue a payout.

For **orbital stations whose host body is still unknown**, keep the station targeted as you approach it. Scout reads Elite's live `Status.json` selected destination. When a `DockingRequested` or `Docked` event confirms the same station, Scout may send the selected `Destination.Body` as a host-only observation. The Orrery then attaches the station schematically to that body while leaving exact orbital position unknown. Scout does **not** use current/nearest body, sphere-of-influence, arrival distance, or the last body flown near, so close-orbiting moons cannot change the association merely because the ship passes nearer to one of them.

## What is transmitted

For BGS scouting, the current system's fields from `FSDJump`, `Location`, or `CarrierJump`:
- system name/address and galactic X/Y/Z coordinates, plus controller, security and population when present;
- faction names, influence, active/pending/recovering states and happiness;
- local conflict type/status, participants, stakes and WonDays score;
- the journal event timestamp.

System coordinates are used by the Scout Board for straight-line distance calculations between systems.

For market scouting, a station `Market` snapshot:
- system and station name, market ID, station type, and system coordinates when already known;
- commodity name/category plus buy price, sell price, supply, demand, and mean price;
- the market event timestamp.

For Orrery facility placement:
- an `ApproachSettlement` observation sends system name/address, facility name/Market ID, host body ID/name, latitude/longitude, and event time;
- a `StationHost` observation for an orbital station sends system name/address, station name/Market ID, and Elite's selected `Destination.Body` only when the selected destination name matches the docking station;
- host-only observations never claim an exact orbital position.

Facility observations store only the public location facts needed by the Orrery. The public Orrery feed does not expose the Scout token, Discord account, Commander identity, or route history.

The plugin deliberately does **not** transmit the commander's name, cargo, credits, ship/loadout, materials, missions, or general route/history. The local HUD bridge is separate from those cloud uploads and may hold the current Commander name and docking/travel trigger state only on the local PC. BGS snapshots are uploaded only for systems containing the Regiment of Imperial Mongrels. Market snapshots may be uploaded from any visited station because they contain public station-market information rather than Commander inventory. Surface-facility observations are accepted only within the Scout token's current system access (or an active Scout claim) and are stored without Commander/token identity in the public facility record. The server already knows which issued Scout token submitted authenticated updates without requiring the Commander's name in the plugin payload.

## Local HUD / voice bridge

Mongrel Scout v1.4.0 also normalizes a small set of Elite journal events for a future local Mongrel HUD/voice companion. This bridge is **local-only**: it listens on `127.0.0.1:43857`, does not add those docking/travel events to the website upload, and intentionally sends no CORS header for arbitrary web pages.

The local event vocabulary is:
- `docking.requested`, `docking.granted`, `docking.denied`, `docking.cancelled`, `docking.timeout`, `docking.docked`, `docking.undocked`;
- `location.current`, `travel.fsd_jump`, `travel.supercruise_entry`, `travel.supercruise_exit`;
- `carrier.jump`, `carrier.stats`;
- `facility.approach`.

The bridge exposes read-only JSON endpoints for a local companion:
- `GET /v1/health` — bridge/plugin version and latest sequence;
- `GET /v1/state` — current local Commander/system/station/docking/supercruise/owner-carrier state;
- `GET /v1/events?after=<seq>&wait=<seconds>` — ordered event delivery with optional long polling, capped at 25 seconds.

The in-memory event queue retains the newest 256 normalized events. No raw journal dump is exposed.

`CarrierStats` is used locally to learn the current Commander's own Fleet Carrier identity (Carrier ID, callsign, name and docking access). That owner-carrier identity is persisted in EDMC's local configuration so later docking events can be labeled `relationship: owner` even after EDMC restarts. It is **not uploaded** by this v1.4.0 bridge. Other carriers remain `relationship: unknown` until a future squad carrier registry provides a trusted mapping.

The local bridge may include the current Commander name because owner/squadmate greetings need to know who is flying, but that identity stays on the PC. The existing cloud payload privacy boundary is unchanged.

## Scout workflow

Start EDMC before or with Elite Dangerous, confirm **Mongrel Scout: Armed**, then fly the assigned systems. After a successful BGS update the EDMC status line changes to **Updated <system>**. After a market update it changes to **Market updated: <station>**. After a verified settlement observation it changes to **Facility mapped: <facility>**.

The direct endpoint is authenticated with an individually revocable scout token. Scout access is controlled server-side, so Wolf can change a scout between **Restricted** and **Trusted** access—or change a Restricted Scout's allowed systems—without issuing a new token.

- **Restricted Scout:** only systems explicitly assigned by Wolf are accepted.
- **Trusted Scout:** any Mongrel system is accepted.
- All scout tokens have a server-side limit of 120 upload attempts per hour.
- If EDMC says **Not assigned: <system>**, that system is outside the token's current Restricted Scout permissions.
- If EDMC says **Token rejected**, ask Wolf for a replacement token.
