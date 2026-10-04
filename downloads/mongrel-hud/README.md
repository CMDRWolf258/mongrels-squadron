# Mongrel HUD Prototype

This is the first local HUD/controller prototype for the Mongrels. It is intentionally small enough to flight-test before the visual layout is locked down.

## Requirements

- Windows PC running Elite Dangerous.
- EDMC with **Mongrel Scout v1.10.0 or newer** installed and enabled for the full carrier-PA event set.
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

## Carrier PA / local voice

Mongrel HUD 0.13.0 adds an **optional Local Neural · Kokoro** voice provider without increasing the core HUD download by hundreds of megabytes. The ordinary HUD still works with Windows Modern (WinRT) and Windows Legacy (System.Speech) voices even when the neural pack is not installed.

From the paired iPad controller, **Install Voice Pack** tells the Windows HUD to perform the installation on the PC. The PC downloads the pinned sherpa-onnx Windows x64 TTS runtime and the pinned Kokoro multilingual model into a staging area under `%LOCALAPPDATA%\MongrelHUD\voices`, verifies both SHA-256 digests, extracts and validates the required runtime/model files, and only then atomically exposes the finished pack. The controller polls live status/progress. Interrupted or failed staging data is never treated as an installed provider. **Repair** repeats the verified install; **Remove** deletes only the optional pack and falls back to the Windows system voice if Kokoro was selected.

After installation, 28 English Kokoro voices (US and UK, male and female) appear in the normal PA selector under **Local Neural · Kokoro**. Speech synthesis then runs locally/offline through `sherpa-onnx-offline-tts.exe`; generated temporary WAV files are volume-scaled locally, played synchronously, and deleted. Existing carrier phrases, placeholders, delays, countdowns, cooldown-ready timer and serial queue remain provider-neutral.

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

