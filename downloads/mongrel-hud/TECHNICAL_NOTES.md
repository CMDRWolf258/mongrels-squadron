# Mongrel HUD — Technical Notes

> Engineering/reference material preserved from the former member-facing README. Normal users do not need this file to install or run Mongrel HUD.

# Mongrel HUD Prototype

This is the first local HUD/controller prototype for the Mongrels. It is intentionally small enough to flight-test before the visual layout is locked down.

## Requirements

- Windows PC running Elite Dangerous.
- EDMC with **Mongrel Scout v1.11.1 or newer** installed and enabled for the full carrier-identity/event set.
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

## iPad pairing, local shortcut, and updates

Mongrel HUD 0.9.0 advertises a stable local controller name at **http://mongrel-hud.local:43858**. The Member Portal includes an **Open HUD Controller** shortcut to that address. The PC and iPad must be on the same local network; the desktop window also shows the raw LAN-IP address as a fallback.

Pairing is now persistent. Enter the six-digit PIN once on a device and the HUD stores only a hash of that device's random trust token in the local HUD state file. The browser receives a one-year HttpOnly cookie, so ordinary HUD restarts and version upgrades do not require another PIN. **Pair New Device** changes only the displayed PIN and does not revoke existing devices. **Forget Paired Devices** explicitly clears all trusted controller tokens.

The desktop window shows the current HUD version and checks the rolling GitHub release in the background. When a newer build is available, **Update to x.y.z** downloads the rolling ZIP with Windows PowerShell, verifies GitHub's SHA-256 asset digest, stages the new EXE under the existing local MongrelHUD data directory, exits, replaces the running EXE, and relaunches it. Layout, notes, mining cache, trusted-device hashes, and other local state stay in the separate local state.json file and are not replaced. The updater changes only the packaged HUD executable; Mongrel Scout remains an EDMC plugin and is updated separately. Mongrel HUD 0.10.1 also forces the relaunched PyInstaller one-file EXE to start with a fresh runtime environment, preventing it from inheriting the old `_MEI` extraction directory during self-update. Mongrel HUD 0.11.1 hardens the replacement handoff for PyInstaller one-file builds: after the HUD child exits, the PowerShell helper retries backup/replacement while the wrapper process releases the EXE, verifies the installed EXE SHA-256 matches the staged build before launch, and writes `%LOCALAPPDATA%\\MongrelHUD\\update\\apply-update.log` for local diagnostics. A failed verified replacement rolls back to the previous EXE.

## Carrier Dialogue Manager / ambient carrier life

Mongrel HUD 0.16.0 moves carrier dialogue out of release-only code and into a shared website-backed library. The **Carrier Dialogue Manager** on the Carriers page is restricted to the configured Site Admin account. Dialogue is stored centrally in the carrier KV namespace and delivered to members through the existing authenticated Mongrel Scout HUD feed; ordinary HUD users never receive a write credential.

Shared lines are organized by **carrier**, **category**, and **audience**. Supported categories include docking/jump cues plus **Hangar Ambient PA**, **Concourse Ambient PA**, **Concourse Bulletin / News**, and **Concourse Advertisement**. Audiences are Everyone, Carrier Owner, Mongrel Squadron Member, and Visitor / Outsider. Each line can be enabled/disabled or assigned Common (6x), Uncommon (3x), or Rare (1x) weighting. Per-carrier ambient timing controls define independent randomized hangar and concourse announcement intervals.

The first admin load imports the existing starter personality lines into the shared library, so the manager exposes the same lines the HUD is actually drawing from. A configured pool whose lines are all disabled is silent. Removing every shared line from an event pool allows the packaged starter personality fallback to resume.

While walking on a carrier, Elite's local Status flags let Scout distinguish the hangar from the broader station/social-space interior. HUD 0.16.0 uses **Hangar PA** acoustics for `ambient.hangar`, and **Interior PA** acoustics for the concourse. Concourse playback combines enabled lines from Ambient, Bulletin/News and Advertisement categories and serializes them through the ordinary carrier voice queue.

Each HUD now provides a local **Concourse Voice Ensemble** with up to four independently selected installed voices. These voice identities remain local because members may have different Windows/Kokoro voices installed; the shared website controls the writing, audience and rarity while each PC controls how the announcement is rendered.

The Bulletin/News and Advertisement categories are intentionally usable for manual lines now and are also the extension point for a later dynamic bulletin engine. Future website-derived bulletins can be generated from approved structured sources (Newsroom, events, GalNet headlines, BGS conflict state, etc.) and injected into the same concourse path without changing the carrier identity or audio architecture. Automatic generation is not enabled in 0.16.0.

## Carrier PA / local voice

Mongrel HUD 0.15.0 adds carrier identity, relationship and personality routing on top of the 0.14.x voice/acoustic engine. The paired controller no longer hard-codes Pneuma: it shows the relevant carrier and whether it is **Your Carrier**, a **Squadmate Carrier**, an **Official Squad Carrier**, or an unknown **Visiting Carrier**.

Registered carriers are supplied through the authenticated HUD feed. Scout 1.11.1 can bind a member's existing registry entry to Elite's numeric Carrier/Market ID after `CarrierStats` reveals it; callsign matching remains the fallback. The HUD uses that identity to distinguish owner, squadmate and generic visitor contexts. Official carriers can carry the shared **Imperial Mongrels** personality, while ordinary registered carriers can use **Personal Carrier** or **Professional Carrier** personalities. Individual TTS provider/voice, local-comms texture, rate and volume remain local preferences on each member's PC.

The carrier registry page now includes a shared **HUD Personality** field. Leadership can assign the Imperial Mongrels personality to official squad carriers. The first 0.15.0 dialogue library intentionally begins with small owner/squadmate/visitor docking and departure pools plus anti-repeat memory; it is the foundation for much larger announcement libraries without changing the identity-routing architecture. Editing a cue phrase in the local controller remains a hard local override; leaving it at the default lets the personality pool choose variants.

Spoken procedural system names are shortened for carrier dialogue. HIP names remain intact; long generated names use their final coded token (for example `b34-2` or `d10-16`). The user's NGC 2546 Sector UZ-G d10-16 project has the explicit spoken alias **10-16**.

Mongrel HUD 0.14.0 separates Pneuma speech into two persistent roles: **Announcements** and **ATC**. Each role can independently select any installed System.Speech, WinRT, or Kokoro voice. Existing 0.13.x single-voice settings migrate into both roles, so upgrading does not discard the selected voice; the ATC role can then be changed independently from the iPad.

The acoustic environment is selected independently of the speaker. **Remote radio** is the default even when the Commander is merely in Pneuma's system. It changes to **Local carrier comms** only when Scout can prove the Commander is in Pneuma's normal-space instance from the carrier Market ID (targeted supercruise drop or owner-carrier docking context). Walking inside the carrier uses **Carrier interior PA**, while the hangar uses the larger **Carrier hangar PA** profile. The iPad controller also provides a manual acoustic preview selector so either role can be auditioned in every room without moving the ship.

All three speech providers now synthesize to a temporary local PCM16 WAV before playback. Remote radio uses a communications-band filter plus gentle saturation/compression; local comms stays essentially clean; the two PA profiles add short early reflections, with the hangar using longer/larger reflections. Final volume, synchronous playback and cleanup remain local to the PC.

Mongrel HUD 0.13.0 adds an **optional Local Neural · Kokoro** voice provider without increasing the core HUD download by hundreds of megabytes. The ordinary HUD still works with Windows Modern (WinRT) and Windows Legacy (System.Speech) voices even when the neural pack is not installed.

From the paired iPad controller, **Install Voice Pack** tells the Windows HUD to perform the installation on the PC. The PC downloads the pinned sherpa-onnx Windows x64 TTS runtime and the pinned Kokoro multilingual model into a staging area under `%LOCALAPPDATA%\MongrelHUD\voices`, verifies both SHA-256 digests, extracts and validates the required runtime/model files, and only then atomically exposes the finished pack. The controller polls live status/progress. Interrupted or failed staging data is never treated as an installed provider. **Repair** repeats the verified install; **Remove** deletes only the optional pack and falls back to the Windows system voice if Kokoro was selected.

After installation, 28 English Kokoro voices (US and UK, male and female) appear in both carrier voice selectors under **Local Neural · Kokoro**. Speech synthesis then runs locally/offline through `sherpa-onnx-offline-tts.exe`; generated temporary WAV files are volume-scaled locally, played synchronously, and deleted. Existing carrier phrases, placeholders, delays, countdowns, cooldown-ready timer and serial queue remain provider-neutral.

Pinned optional-pack assets for 0.13.0:
- sherpa-onnx runtime: v1.13.8, Windows x64 shared MT TTS build, 24,805,859 bytes, SHA-256 `6dffdc715a4465b989446a6105265d2cb345e7101591a17d35534b6758f6e8df`
- Kokoro model: `kokoro-multi-lang-v1_0`, 349,906,910 bytes, SHA-256 `c5f7e2d2caf082bc1d20fb70334a61d99d20b484500aad32e7cf84c128ea3298`

The provider boundary remains the extension point for future optional local voice packs; do not bundle large voice models into the core HUD EXE.


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

Mongrel HUD 0.8.0 adds an optional **Cargo** overlay. It is assigned to **Both** profiles but remains **OFF by default** so an update never rearranges an existing cockpit layout. As of HUD 0.16.5 with Scout 1.11.4, mission requirements are grouped by **issuing faction** and the iPad HUD controller includes a local **Next Run** selector. Mission-tagged cargo remains reserved to its exact mission first; ordinary interchangeable cargo is then allocated to the selected faction before the others. `Auto` uses the earliest active faction rather than always favoring Mongrels, and a completed/disappearing priority faction automatically returns the selector to Auto. The shared physical cargo hold is still counted only once across factions. Older cached missions accepted before Scout knew their issuer appear under **Faction Unknown** until completed/replaced. The overlay also shows used/capacity/free tonnage, separates limpets and stolen cargo, and lists the remaining normal cargo hold. Mission details and the Next Run preference remain local and are not uploaded to the website.

### Surface Mining

Mongrel HUD 0.7.1 uses the curated 10-16 mining database as the source of truth.

- Mining **location centers** and individual **deposits** are separate records. The iPad can **Set / Update Center** for a Signal # from the current Elite surface position.
- Surface Navigation shows two simultaneous instruments: one compass/readout for the selected Mining Location center and one for the selected deposit.
- Mining Intel is scoped to the selected Signal # and lists its nearest deposits.
- Report Deposit uses a canonical commodity dropdown populated from the mining database, with **Other / not listed** for genuinely new commodities.
- Deposit reports capture current body, Signal #, latitude/longitude and planet radius automatically.
- A same-Signal, same-commodity report within 1 km of an existing deposit is held as a **possible duplicate** instead of silently creating another coordinate. Mining Admin shows both entries side-by-side and lets the reviewer keep either the existing or new entry.
- The local report log remains only as a troubleshooting/offline record; the curated archive is authoritative.



### Preferred carrier spoken names and Canine Catalyst

HUD 0.17.0 resolves the `{commander}` dialogue token through the authenticated HUD feed's optional member `spokenName` before falling back to Elite's full CMDR name. Members can set this once in their Mongrel profile; for example, `Wolf258` can use `Wolf` without changing the actual CMDR identity.

Canine Catalyst (`R1MM`) is matched as the protected squad carrier by its registered squad identity/name as well as normal Market ID evidence. Its shared dialogue profile uses squad-command/flagship wording distinct from personal-carrier starter dialogue.


### Independent carrier voice and timing profiles (HUD 0.17.1)

In the paired iPad controller open **Carrier PA → Carrier voice and timing profile**. Use **Automatic** for the carrier currently detected in Elite, or select Pneuma, Canine Catalyst, or another registered carrier to edit that carrier's ATC, announcements, concourse ensemble, PA and event delays. Edits on this screen are **local overrides saved on this PC**; they never overwrite a different carrier's selections. Existing pre-0.17.1 Pneuma voices and delays are preserved for your owner carrier.

The [website Carrier Dialogue Manager](https://mongrels-squadron.pages.dev/carriers/) now has a **Published Carrier Voice Profile** section. Carrier owners (site admins for the squad carrier) can publish preferred ATC, announcement and concourse voice identifiers, plus docking/jump timing, for visiting commanders. Visitors use the detected registered carrier's published dialogue, ambient intervals, and published voice/cue preferences by default. A visitor's explicit local override takes precedence, and voice files/audio are never sent between computers; a requested voice missing on the visiting PC falls back to a locally available system voice. **Editing the iPad's local override does not publish it to other commanders**; publish separately from the website when you want the entire squad to hear the same carrier preferences. Unregistered carriers with no published settings use neutral HUD defaults, not Pneuma's voices.

The HUD's local `voiceProfiles` dictionary is keyed by registered carrier ID or stable callsign/market ID. The existing `voice` key remains a legacy owner-carrier fallback. Timers and event cooldown keys include carrier identity so a carrier's docking/jump events cannot suppress another's pending announcements. Published preferences arrive through the already existing `siteFeed.carrierDialogue` map, not a new polling route; no new KV namespace, per-cue cloud writes or additional Cloudflare reads are introduced by voice playback.
