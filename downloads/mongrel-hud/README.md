# Mongrel HUD

**Short version:** put it on the Windows PC that runs Elite, start **MongrelHUD.exe**, then use your iPad or browser as the controller.

You do **not** install anything on the iPad.

Current downloads:
https://mongrels-squadron.pages.dev/member/#mongrel-tools

## Route Director controls and display (HUD 0.17.7)

On the paired controller open **HUD CONTROL → ROUTE DIRECTOR**. Paste the route ID provided by ChatGPT (or leave it blank to load the most recent calculated route), click **LOAD ROUTE**, then **START NAVIGATION** and confirm. **STOP NAVIGATION** disables further clipboard changes after the next Scout refresh. Scout 1.13.0 or newer and a Site Admin-bound Scout token are required. No iPad installation is needed. When Scout receives an explicitly activated Spansh route, the existing Own Ship overlay shows **NAV NEXT** and a waypoint counter. The local EDMC Scout process performs clipboard copying when the next listed waypoint is reached; the HUD itself does not control the game's Galaxy Map. Route previews do not touch the clipboard, and all other overlays retain their current behavior.

## Navigation profile (proposed next HUD release)

**NAVIGATION** is a third HUD profile alongside Combat and Surface Mining.
It keeps the current profiles, windows, scales and personal panel assignments
intact. The Navigation screen provides:

- **Plot Neutron Route:** specify a destination and efficiency using the
  current live Scout system and ship jump range. Press **Check Route Result**
  to retrieve Spansh's completed route. Neither operation activates navigation.
- **Route Director:** Load, review, explicitly Start/Stop. Shows the **entire**
  saved waypoint list in a scrollable flight plan with the next and completed
  stops highlighted. The PC clipboard is modified only after Start.
- **Scout Network:** shows Scout job coverage and paid scouting tasks from the
  existing Scout site feed, with a link to the full member Scout Board. No new
  recurring cloud polling was added.
- **Independent PC instruments:** Route Director (next target/progress),
  Upcoming Waypoints (six next replots), Waypoint Signal (brief flashing
  indication only on a *confirmed* neutron waypoint index advance), Fuel
  Status (current reported fuel/range), and Scout Network (board snapshot).
  Each can be resized, hidden, dragged and assigned to any of the three
  profiles. The full itinerary belongs on the iPad, not in an oversized overlay.

**Fuel-aware Galaxy routing (HUD 0.17.7, Scout 1.13.0)** is a separate
optional Route Type inside Navigation. The original Neutron replot-point
planner stays unchanged. Galaxy calls Spansh's Generic/Galaxy Plotter with
Scout's journal-derived FSD physics, the selected destination, cargo mass
and an explicitly confirmed full tank and installed fuel scoop. No full
Loadout, modules list, commander identity or personal journal is uploaded.
The private Owner Scout Link does transfer whitelisted ship physics through
our site to Spansh when you explicitly plot a Galaxy route.

The Spansh result must contain a valid exact-jump sequence and a fuel ledger.
The full flight plan identifies each real jump and any upstream
`must_refuel` stars. When Scout confirms arrival at a planned fuel stop, it
temporarily holds the next Windows clipboard destination until Elite's
Status.json reports a newly observed, full main tank. A manual Copy Next
cannot bypass that hold. Source-system, fuel level, scoop, cargo and FSD
physics are rechecked at activation. These are planning aids: always verify
available fuel and jump eligibility in Elite before flying.

No new periodic cloud reads are required; planning and result checks happen
only on deliberate iPad interaction.


## Route reliability improvements (HUD 0.17.7 / Scout 1.13.0)

The Navigation profile includes **COPY NEXT TO SERENITY** and **REPLOT FROM
HERE**. Copy Next repeats only the current confirmed waypoint name on the
Windows PC clipboard, even if automatic copying is disabled. Replot uses your
current Scout-reported system and the original destination, but creates only
a *preview*; activating another route still requires explicit confirmation.

Scout saves a small waypoint checkpoint in the local EDMC settings. After
restarting EDMC between replots, an active route resumes from the last
verified waypoint if the route ID, ship and activation match. On arrival at
the final listed destination it shows **Destination Reached**, stops
automatically copying targets and sends one owner-authorized completion
receipt to clear the cloud-active route. A short-lived local completion
indicator remains visible. Failed completion synchronization never
triggers additional clipboard changes.

The route readout displays estimated remaining Spansh jumps only when all
upstream leg estimates exist; these are NOT actual hyperspace-leg guarantees.
Neither the current planner nor these controls predict fuel stops.

## Before you start

You need:

- a Windows PC running Elite Dangerous
- **Mongrel Scout** installed and running in EDMC on that same PC
- your iPad/phone on the same home/private network if you want to use the remote controller

The HUD runs on the Elite PC because the overlay has to appear over the game and it talks to Scout through a local connection.

## Surface Mining system browser (HUD 0.17.7)

In the **Surface Mining** iPad HUD control profile, the new **Mining Database
· System Browser** lets you select from saved systems or type/paste part of
a system name or ID64 to see matching saved-system suggestions. Once selected,
it lists known mining deposits and any center-only signals; filters can be
combined for **commodity**, **planet/moon**, and **minimum mining rig count**
(including 7+). Results show coordinates and clearly label local-only versus
approved/shared data. Your selected browsing system is saved on the Windows
HUD PC and survives restarts.

**Browsing itself does not change Elite's real location, the active
deposit/center compass, or where new reports are saved.** Expand a deposit
search result and tap **Navigate** to deliberately set the HUD's deposit
compass. If that mining signal has a saved center, the second compass points
to the center at the same time. Center-only signals have their own Navigate
button; choosing one does not invent a deposit waypoint.

For a result on another body or system, Navigate shows **Destination Queued**.
The current active compass remains untouched until the Frontier journal
confirms both the correct system ID64 and planetary body; then the new
selection activates. The active waypoint and any pending destination persist
in the HUD PC's local state file across restarts. If the shared archive is
temporarily unreachable, the specifically selected, validated deposit and
center coordinates remain locally pinned for navigation. A later manual
signal/deposit selection cancels the browser navigation preference. The
existing "Locations on this body", "Set center" and "Report Deposit" controls
still follow actual Frontier position rather than the browsed system.

The controller uses local filtering after retrieving the selected system's
records: **typing triggers no Cloudflare requests**. The directory is
requested only when opening the Surface Mining profile or explicitly tapping
Refresh, cached for one hour. Shared system reads are user-selected and
cached for ten minutes. Those additional archive calls remain disabled until
the separate `ten16-archive` multi-system backend is verified, backed up
and deployed; the development build currently browses saved local records
and already loaded legacy 10-16 entries.

## Surface mining in other systems (development preview)

The multi-system mining update is currently in **draft PR #182**, not the
downloadable HUD release. When it is tested and included in a future HUD
build, commanders will be able to save **mining location centers and individual
deposit coordinates in other systems** using their existing iPad controls.

- In **10-16**, the original curated central mining archive and its deposit
  review process continue to work exactly as before.
- **Outside 10-16**, deposits are stored **on your own Windows PC only** in
  `%LOCALAPPDATA%\MongrelHUD\state.json`. They survive normal HUD restarts
  and app updates as long as the local state file is retained.
- The HUD requires the Frontier **system ID64**, the exact **full body name**,
  and measured surface latitude/longitude before saving. It never assigns
  a deposit to a guessed system or to a generic short body label.
- Each system/body keeps separate signal numbers, locations, selected deposit
  and compass target. The same Signal #1 on two icy moons will not mix.
- A report close to a previous deposit of the same commodity on the same
  signal is **flagged for local duplicate review**, not uploaded to the
  shared queue. Local reports display **NOT SQUAD SYNCED**.
- You should back up your local `state.json` if you need these coordinates
  before shared multi-system storage is available. Do not delete the file
  during app cleanup or reinstallation.

**This is not yet squad-wide mining storage.** The existing
`ten16-archive.pages.dev` backend still needs a separately reviewed
multi-system schema/API update, data migration and secure ID64/body-keyed
read-write tests. We intentionally do not send other-system records to that
legacy endpoint until it can safely store them.

## Install and start

1. Download **MongrelHUD-Windows.zip** from the Mongrels site.
2. Unzip it somewhere convenient on your Elite PC.
3. Double-click **MongrelHUD.exe**.
4. If Windows Firewall asks, allow it on **Private networks**.
5. The small HUD control window will show a local address and a six-digit pairing PIN.
6. On your iPad or phone, open the address shown in that window.
7. Enter the PIN.
8. Use the controller to turn overlays on/off and arrange them.

The stable controller address is usually:

`http://mongrel-hud.local:43858/`

If that does not open, use the numbered local IP address shown in the HUD window instead.

## Moving and resizing overlays

The HUD normally runs in **LOCKED** mode so the overlay panels do not steal mouse clicks from Elite.

To arrange things:

1. On the controller, choose **UNLOCK LAYOUT**.
2. Move the HUD panels on the PC.
3. Adjust panel size as needed.
4. Choose **LOCK LAYOUT** when you are done.

Your panel positions, visibility and sizes are saved locally.

If the layout gets messed up, use **Reset Layout**.

## Updating the HUD

If the HUD tells you an update is available, use its **Update to x.x.x** button.

The HUD will update itself and keep your local layout/settings.

**Mongrel Scout updates separately.** Updating the HUD does not update Scout.

If you ever update manually, close the HUD, unzip the new build, and run the new **MongrelHUD.exe**. Your normal HUD settings live separately from the EXE.

## Per-carrier voice and announcement timing (HUD 0.17.1+)

The paired iPad/phone controller's **CARRIER PA** tab has a **Carrier voice and timing profile** selector. Choose **Pneuma**, **Canine Catalyst**, or another detected/registered carrier before setting ATC/announcement voices, four optional concourse speakers, cue delays, cooldowns and volume.

- **Pneuma:** your pre-upgrade local voice choices and cue delays remain unchanged.
- **Canine Catalyst:** has an independent local profile. Setting its voices or timing does not alter Pneuma.
- **Other commanders' registered carriers:** the HUD uses the owner's **published** preferences from the site (subject to installed voices). It never treats Pneuma's voice as the visitor default. If no preferences are published, normal carrier defaults apply.
- **Local overrides:** manually changing another carrier's profile changes only **your PC**. It never edits what the carrier owner publishes for other visitors.
- **Publishing for visitors:** sign in to the [Carrier Registry](https://mongrels-squadron.pages.dev/carriers/) as that carrier's owner (or Site Admin), open **Dialogue Manager**, choose the carrier, then publish voice preferences and event timing. The website shares identity/timing preferences, not voice pack files.

Voice providers are available only if installed locally; unavailable choices safely fall back to a Windows/system voice. The website and HUD continue using the existing Scout feed—no new constant polling or cloud read loop is required. Hangar/concourse ambient intervals remain independently managed in the website's **Carrier Voice Settings**.

## Voice pack

The optional neural voice pack is **not required** to use Mongrel HUD.

If you want it, use **Install Voice Pack** from the paired controller. The request is sent to the Windows HUD and the files are installed on the PC, not the iPad.

Windows system voices continue to work without the extra pack.

## Quick troubleshooting

### I cannot see any HUD panels
- Make sure the panel is enabled in the controller.
- Try **UNLOCK LAYOUT** in case the panel is off-screen or hidden behind another window.
- Use **Reset Layout** if needed.

### My iPad cannot connect
- Make sure the iPad and PC are on the same private/home network.
- Make sure Windows Firewall allowed Mongrel HUD on **Private networks**.
- Try the raw IP address shown in the HUD window instead of `mongrel-hud.local`.

### Windows says the app is unrecognized
The current HUD build is not code-signed, so Windows may show a SmartScreen warning even when you downloaded it from the official Mongrels site.

### The HUD is running but data is missing
Check that EDMC is open and **Mongrel Scout** is enabled. Scout is the HUD's local Elite-data bridge.

## Privacy

Most HUD state stays on your PC. The iPad controller talks to the HUD over your local network.

Mongrel Scout handles the separate squad-data uploads used by the website and follows its own privacy rules.

## Need the current downloads?

Open the Member Portal:
https://mongrels-squadron.pages.dev/member/#mongrel-tools

---

Developer/engineering details are intentionally kept out of this README. They are preserved in the repository at:

`downloads/mongrel-hud/TECHNICAL_NOTES.md`


### Independent carrier voice and timing profiles (HUD 0.17.1)

In the paired iPad controller open **Carrier PA → Carrier voice and timing profile**. Use **Automatic** for the carrier currently detected in Elite, or select Pneuma, Canine Catalyst, or another registered carrier to edit that carrier's ATC, announcements, concourse ensemble, PA and event delays. Edits on this screen are **local overrides saved on this PC**; they never overwrite a different carrier's selections. Existing pre-0.17.1 Pneuma voices and delays are preserved for your owner carrier.

The [website Carrier Dialogue Manager](https://mongrels-squadron.pages.dev/carriers/) now has a **Published Carrier Voice Profile** section. Carrier owners (site admins for the squad carrier) can publish preferred ATC, announcement and concourse voice identifiers, plus docking/jump timing, for visiting commanders. Visitors use the detected registered carrier's published dialogue, ambient intervals, and published voice/cue preferences by default. A visitor's explicit local override takes precedence, and voice files/audio are never sent between computers; a requested voice missing on the visiting PC falls back to a locally available system voice. **Editing the iPad's local override does not publish it to other commanders**; publish separately from the website when you want the entire squad to hear the same carrier preferences. Unregistered carriers with no published settings use neutral HUD defaults, not Pneuma's voices.

