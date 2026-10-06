# Mongrel Scout EDMC Plugin

Mongrel Scout sends sanitized BGS snapshots directly to Wolf BGS Control, fresh station commodity-market snapshots to Trader's Outpost, verified public surface-facility coordinates to the System Orrery, and a local-only event/state bridge for Mongrel HUD/voice features.

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

For **orbital stations whose host body is still unknown**, keep the station targeted as you approach it and request docking normally. Scout sends a sanitized station-visit observation containing the station/Market ID, Elite's selected destination fields, EDMC's current Body fields, the live dashboard BodyName, and only the latest relevant ApproachBody/LeaveBody/Supercruise context. **Scout itself does not choose the host.** The server stores the raw facts and automatically promotes a host only when the selected destination body, EDMC current body ID, and live dashboard body name all agree. If they disagree—such as when a nearby moon temporarily owns the ship's sphere of influence—the host stays unresolved rather than being guessed.

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
- an `ApproachSettlement` observation sends system name/address, facility name/Market ID, host body ID/name, latitude and longitude, and event time;
- an orbital `facility_visit` sends station/Market identity plus sanitized destination/body context and only the latest relevant travel-body events;
- the server may promote a host-only `StationHost` record only when independent destination/current-body/dashboard signals agree;
- host-only observations never claim an exact orbital position.

Raw orbital visit context is kept server-side for resolver improvements and is not part of the public Orrery feed. The public feed exposes only verified location facts and does not expose the Scout token, Discord account, Commander identity, or route history.

The plugin deliberately does **not** transmit the commander's name, cargo inventory, credit balance, ship/loadout, materials, or general route/history. The local HUD bridge is separate from those cloud uploads and may hold the current Commander name and docking/travel trigger state only on the local PC. BGS snapshots are uploaded only for systems containing the Regiment of Imperial Mongrels. Market snapshots may be uploaded from any visited station because they contain public station-market information rather than Commander inventory. Surface-facility observations are accepted only within the Scout token's current system access (or an active Scout claim) and are stored without Commander/token identity in the public facility record. The server already knows which issued Scout token submitted authenticated updates without requiring the Commander's name in the plugin payload.

### Realtime Mission Control and Colonization activity

Mongrel Scout 1.12.0 adds a small event-driven activity uplink. Scout does **not** upload every journal line and does not add another polling loop. It queues only four result types and waits briefly so nearby changes can share one request:

- completed mission faction/influence effects, with the minimum locally remembered mission-origin fields needed to distinguish source and secondary effects;
- redeemed bounty and combat-bond vouchers;
- colonization construction contributions, including commodity tonnage and construction-site Market ID;
- colonization construction-depot progress/resources.

These records are written to the same deduplicated activity store used by Frontier Sync, so a later Sync Elite reconciles the same event instead of counting it twice. Realtime Scout records are explicitly **provisional for rewards**: Mission Control and Colonization Jobs may display them immediately, but payout issuance waits until Frontier CAPI confirms/replaces the event.

The client batches activity for about 8 seconds, suppresses duplicate events already waiting in the same batch, retries temporary network/server failures, and otherwise falls back to the normal Frontier safety sync if realtime delivery is missed.

Mongrel Scout 1.11.5 also makes the authenticated HUD site feed change-aware. Scout still downloads a complete feed at startup, then checks a compact change manifest every 30 seconds and only requests another full feed when relevant squad data changes. A full refresh is forced at least every 10 minutes as a safety net, and any manifest error automatically falls back to the legacy full-feed refresh path. This optimization does not alter local HUD rendering, mining-compass refresh, journal/event handling, or carrier voice timing.

## Local HUD / voice bridge

Mongrel Scout v1.11.5 normalizes the Elite journal and Status.json signals used by the local Mongrel HUD/voice companion. When the local `CarrierStats` event has identified the player's own carrier, Scout also attaches that carrier's public numeric Carrier ID, callsign and carrier name to its authenticated HUD-feed refresh so the squad carrier registry can bind the member's existing registration to Elite's permanent identity. This does not upload Commander route history or ship data. This bridge is **local-only**: it listens on `127.0.0.1:43857`, does not add those docking/travel events to the website upload, and intentionally sends no CORS header for arbitrary web pages.

The local event vocabulary is:
- `docking.requested`, `docking.granted`, `docking.denied`, `docking.cancelled`, `docking.timeout`, `docking.docked`, `docking.undocked`;
- `location.current`, `travel.fsd_jump`, `travel.supercruise_entry`, `travel.supercruise_exit`, `travel.destination_drop`;
- `player.disembark`, `player.embark`;
- `carrier.jump`, `carrier.jump_request`, `carrier.jump_cancelled`, `carrier.stats`;
- `facility.approach`;
- `combat.target`, `ship.hull`, `ship.loadout`.

The bridge exposes read-only JSON endpoints for a local companion:
- `GET /v1/health` — bridge/plugin version and latest sequence;
- `GET /v1/state` — current local Commander/system/station/docking/supercruise/owner-carrier state, the most recent normal-space destination instance, and a minimal decoded on-foot/interior status snapshot;
- `POST /v1/mining/report` — explicit Surface Mining deposit report proxy; Scout adds its bound machine token and forwards the report to the curated 10-16 archive without exposing that token to the HUD companion; `POST /v1/mining/center` does the same for explicit mining location-center updates;
- `GET /v1/events?after=<seq>&wait=<seconds>` — ordered event delivery with optional long polling, capped at 25 seconds.

The in-memory event queue retains the newest 256 normalized events. No raw journal dump is exposed.

Scout 1.11.1 adds carrier acoustic-context signals for HUD 0.14.0. `SupercruiseDestinationDrop` records the targeted destination Market ID, and that normal-space instance marker is cleared on a new supercruise entry or FSD jump. Owner-carrier docking, `Disembark`, and `Embark` provide additional Market-ID anchors. The local Status snapshot also decodes Elite's `Flags2` states for on-foot-in-station, hangar, social-space, exterior and planet context. These signals remain local and are not uploaded to the squad website.

`CarrierStats` is used locally to learn the current Commander's own Fleet Carrier identity (Carrier ID, callsign, name and docking access). `CarrierJumpRequest` also establishes/persists the owner Carrier ID because only the owner schedules that carrier jump; if richer `CarrierStats` identity is already known, its name/callsign are retained. That owner-carrier identity is persisted in EDMC's local configuration so later docking and carrier-jump events can be labeled `relationship: owner` even after EDMC restarts. It is **not uploaded** by this v1.4.3 bridge. Other carriers remain `relationship: unknown` until a future squad carrier registry provides a trusted mapping.

The local bridge may include the current Commander name because owner/squadmate greetings need to know who is flying, but that identity stays on the PC. For the HUD companion it also keeps a minimal local `Status.json` snapshot (surface body/coordinates/heading, shield-up state and selected destination), own-ship hull updates, sanitized `ShipTargeted` combat fields, and a local ship-cargo summary sourced from EDMC's `CargoJSON` / `Cargo` state. Commodity mission requirements observed in `MissionAccepted` are cached locally, including the issuing faction when Elite provides it, and removed/updated by mission lifecycle and `CargoDepot` progress events. If Elite later reports an active MissionID that is missing from Scout's cache, Scout 1.11.5 now searches recent local Journal files for that mission's original `MissionAccepted` record and restores its commodity, quantity, faction, destination, and any `CargoDepot` progress. This recovery stays entirely on the local PC and adds no network requests. The HUD can therefore group required commodities by faction while counting the physical cargo hold only once. Scout 1.11.5 adds a local **Next Run** faction priority: mission-tagged cargo is always reserved to its exact MissionID first, while ordinary interchangeable cargo is allocated to the selected faction before the other active factions. `Auto` uses the earliest active faction without hard-coding Mongrels. The selection is stored locally and automatically falls back to Auto when that faction no longer has an active cargo mission; older cached missions without faction data appear as `Faction Unknown` until they leave the mission list. Cargo and mission details are never added to Scout cloud uploads. The existing cloud payload privacy boundary is unchanged.

## Scout workflow

Start EDMC before or with Elite Dangerous, confirm **Mongrel Scout: Armed**, then fly the assigned systems. After a successful BGS update the EDMC status line changes to **Updated <system>**. After a market update it changes to **Market updated: <station>**. After a verified settlement observation it changes to **Facility mapped: <facility>**. Orbital visits report **Station context recorded: <station>** when evidence is retained but unresolved, or **Host verified: <station> → <body>** when all host signals agree.

The direct endpoint is authenticated with an individually revocable scout token. Scout access is controlled server-side, so Wolf can change a scout between **Restricted** and **Trusted** access—or change a Restricted Scout's allowed systems—without issuing a new token.

- **Restricted Scout:** only systems explicitly assigned by Wolf are accepted.
- **Trusted Scout:** any Mongrel system is accepted.
- All scout tokens have a server-side limit of 120 upload attempts per hour.
- If EDMC says **Not assigned: <system>**, that system is outside the token's current Restricted Scout permissions.
- If EDMC says **Token rejected**, ask Wolf for a replacement token.


## HUD leadership feed

When a Scout token is bound to a website account, Scout 1.8.0 also refreshes a compact authenticated HUD feed containing Mission Control, Trader's Outpost, Scout Board and permitted leadership-alert summaries. The feed is exposed only through Scout's loopback HUD bridge; the raw Scout token is never returned to the HUD companion or iPad. Alert acknowledgements made in Mongrel HUD are forwarded through the same loopback boundary and stored by the website for that token owner.


## Live current jump range

Scout 1.8.0 calculates a local **current normal jump range** for Mongrel HUD from Elite's own loadout and Status data. The calculation uses the installed standard/SCO FSD class and rating, engineered FSD optimal mass when reported, maximum fuel per jump, Guardian FSD Booster range, unladen ship mass, current cargo, and current main + reserve fuel. It uses the same published FSD equation used by established Elite tools rather than a per-ship fitted percentage. Temporary synthesis and neutron/white-dwarf boosts are intentionally excluded from this normal-range value for now. The ship/loadout inputs remain local to the HUD bridge and are not added to Scout's cloud BGS payload.


### HUD current-system context

Scout 1.8.5 keeps the current EDMC system context in the local HUD bridge on every journal callback and restores the last known local system across Scout/EDMC restarts. This avoids the HUD showing an unknown system when Scout is restarted while already landed or driving on a surface.


### Mining feed proxy

Scout 1.8.5 proxies `GET /v1/mining/data` and `GET /v1/mining/centers` through EDMC's HTTPS session. Mongrel HUD reads those localhost routes instead of opening HTTPS directly from the packaged Windows executable, avoiding local certificate-store failures while keeping the curated archive authoritative.
