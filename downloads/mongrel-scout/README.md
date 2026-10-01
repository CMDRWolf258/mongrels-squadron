# Mongrel Scout EDMC Plugin

Mongrel Scout sends sanitized BGS snapshots directly to Wolf BGS Control and can also send fresh station commodity-market snapshots directly to Trader's Outpost.

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

The plugin deliberately does **not** transmit the commander's name, cargo, credits, ship/loadout, materials, missions, or general route/history. BGS snapshots are uploaded only for systems containing the Regiment of Imperial Mongrels. Market snapshots may be uploaded from any visited station because they contain public station-market information rather than Commander inventory. The server already knows which issued Scout token submitted the update, allowing verified market-scout work to be attributed later without transmitting the Commander's name in the plugin payload.

## Scout workflow

Start EDMC before or with Elite Dangerous, confirm **Mongrel Scout: Armed**, then fly the assigned systems. After a successful BGS update the EDMC status line changes to **Updated <system>**. After a market update it changes to **Market updated: <station>**.

The direct endpoint is authenticated with an individually revocable scout token. Scout access is controlled server-side, so Wolf can change a scout between **Restricted** and **Trusted** access—or change a Restricted Scout's allowed systems—without issuing a new token.

- **Restricted Scout:** only systems explicitly assigned by Wolf are accepted.
- **Trusted Scout:** any Mongrel system is accepted.
- All scout tokens have a server-side limit of 120 upload attempts per hour.
- If EDMC says **Not assigned: <system>**, that system is outside the token's current Restricted Scout permissions.
- If EDMC says **Token rejected**, ask Wolf for a replacement token.
