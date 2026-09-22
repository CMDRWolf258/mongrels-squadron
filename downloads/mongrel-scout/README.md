# Mongrel Scout EDMC Plugin

Mongrel Scout sends a sanitized BGS snapshot directly to Wolf BGS Control whenever Elite Dangerous writes a full local faction board for a system containing the Regiment of Imperial Mongrels.

## Install

1. Install and run the current Elite Dangerous Market Connector (EDMC).
2. Download **MongrelScout.zip** from Wolf BGS Control and unzip it.
3. In EDMC open **File → Settings → Plugins → Open**.
4. Copy the extracted **MongrelScout** folder into EDMC's plugins folder. The included `load.py` is the plugin program; you do not need to open or edit it.
5. Restart EDMC.
6. In **Settings → Mongrel Scout**, paste the one-time scout token Wolf gives you.
7. Leave **Enable Mongrel Scout** checked.

After that, just play Elite. Jumping into a Mongrel system is enough when the journal event contains its faction board. Scout is event-driven, not a continuous poller: if you are already sitting in a system and need a fresh post-tick board, jump out and back in so Elite writes a new FSDJump faction board.

## What is transmitted

Only the current system's BGS fields from `FSDJump`, `Location`, or `CarrierJump`:
- system name/address, controller, security and population when present;
- faction names, influence, active/pending/recovering states and happiness;
- local conflict type/status, participants, stakes and WonDays score;
- the journal event timestamp.

The plugin deliberately does **not** transmit the commander's name, cargo, credits, ship/loadout, materials, missions, or general route/history. Systems without the Regiment of Imperial Mongrels are ignored locally and never uploaded.

## Scout workflow

Start EDMC before or with Elite Dangerous, confirm **Mongrel Scout: Armed**, then fly the assigned systems. After a successful direct update the EDMC status line changes to **Updated <system>**.

The direct endpoint is authenticated with an individually revocable scout token. Scout access is controlled server-side, so Wolf can change a scout between **Restricted** and **Trusted** access—or change a Restricted Scout's allowed systems—without issuing a new token.

- **Restricted Scout:** only systems explicitly assigned by Wolf are accepted.
- **Trusted Scout:** any Mongrel system is accepted.
- All scout tokens have a server-side limit of 120 upload attempts per hour.
- If EDMC says **Not assigned: <system>**, that system is outside the token's current Restricted Scout permissions.
- If EDMC says **Token rejected**, ask Wolf for a replacement token.
