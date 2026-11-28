## Mongrel HUD 0.18.38 — Station directory and external navigation targets

Hides temporary construction-site/depot and system colonisation ship records from passive system directories and orbital maps (including nested body stations), without changing construction logistics, market sourcing, or Raven design matching for completed facilities. Navigation Target requests the selected external system's Spansh report separately from the current directory, using Scout destination identity, the existing bounded cache and refresh limits. Displays reported population, primary star, security, allegiance, government, controlling faction, economy, power and body/facility counts. Stale/unavailable data is explicitly labelled; switching destinations cannot display the previous report. Pins and local body/station targets retain existing behavior. Scout unchanged; live iPad and destination telemetry verification required.

## Mongrel HUD 0.18.37 — Orbital outpost imagery

Restores the orbital outpost photo fallback removed in 0.18.36. Exact Raven design still wins. Reported orbital outpost subtype selects its corresponding reference; otherwise choose a labelled economy-based or general outpost reference, never claim the actual design is known. Unidentified surface sites retain schematics. No Scout changes.

## Mongrel HUD 0.18.36 — Exact Raven facility designs

Enriches Spansh station records from Raven Colonial's public v2 system-design endpoint (completed sites only), with the documented completed-project endpoint as a fallback if unavailable. Matches market IDs first and unique same-system names only when IDs/host bodies do not conflict. Preserves explicit build types and records the source; excludes planned, mock, uncertain and demolished designs. Removes arbitrary generic surface settlement/outpost/hub/installation photos. Broad orbital starport class photos remain labelled representative. Data Display reports how many Raven designs matched or whether lookup failed. No writes to Raven, no new Scout release. Live Raven response not independently verified in development; regression fixtures match published API client schema.

## Mongrel HUD 0.18.35 — Raven facility imagery

Automatically displays real in-game reference screenshots from Raven Colonial's credited visual-identification catalog (109 verified filenames in SRVSurvey docs/colony). Exact reported build types or matching Raven project names/system select the corresponding variant; otherwise a clearly labelled representative class image is selected. Images are retrieved by the paired Windows companion from a fixed HTTPS allowlist with a bounded memory cache and private browser caching, rather than repackaged or fetched directly by the iPad. Credits remain visible with a Raven source link. Local screenshot overrides take precedence; unsupported facility classes and failed fetches retain schematics. Carrier and construction depot photos are not in the Raven catalog and are not mislabelled. Scout unchanged.

## Mongrel HUD 0.18.34 — Interchangeable Data Display modules

Each of four existing panel slots now supports an independent information module, persisted in layouts and named profiles. Selecting an already assigned module swaps it into the chosen slot. Legacy layouts migrate to their existing native modules. Native directory/target/contact/operations controls are moved intact, retaining IDs and behavior. Standalone factions, station and body directories, cartography, ship systems, cargo manifest, exploration, route, Colonization Logistics and Fleet Carrier modules reuse current reported Scout/HUD data. New Colonization and Fleet Carrier profile presets. Colonization shows selected projects, reported remaining materials, ship/carrier inventory, collection/delivery estimates; unknown quantities stay unknown. Carrier uses the existing owner-carrier phase and journey data and retains estimate labels. Pinning finds the slot containing Navigation Target (restoring it if needed). Facility screenshot catalog is not bundled in this release; local screenshot assignment remains available. Scout unchanged.

## Mongrel HUD 0.18.33 — Data Display intelligence and profiles

Corrects Spansh economy dictionaries to direct percentage strengths, including totals above 100%; explicit journal Proportion fields convert ×100. Independent bars retain raw values. Shows reported body raw material abundances, parent-body hierarchy, body report timestamp and station faction state. Adds collapsible orbital map, service/pad/type station filtering, material/economy/service text search, saved named display profiles and built-in Hauling/BGS/Exploration/Combat arrangements, first-panel placement. Station photo support accepts a local image per exact reported facility type, downsizes it to JPEG and stores it on the tablet; schematics remain the fallback. No bundled in-game screenshot collection yet. Scout unchanged.

## Mongrel HUD 0.18.32 — Configurable Data Display

Hide individual panels using a separate minus button; restore in the Layout menu, select any visible panel as primary, and reset to four. Three panels use a full-height primary left and two right-hand panels; two use full-height columns; one fills the display. Temporary expand/collapse is independent of the stored arrangement. Panel visibility, primary, directory and Operations selections are remembered per browser origin using local storage. Station/body detail windows can pin a directory selection to Navigation Target without sending game input; Follow Target resumes live selection; pins clear on system changes and missing refreshed records are labelled cached. Scout unchanged. Actual iPad sizing requires live verification.

## Mongrel HUD 0.18.31 — Data Display detail polish

Expand and collapse controls are now 72 × 48 CSS pixels (previously 36 × 32). Preserves the four-quadrant viewport grid. Adds searchable station/body directory with original record indices, faction state colors and controlling-faction accent, distinct Orbis/Ocellus and Coriolis/Dodecahedral schematic illustrations, categorized station services, color-matched economy legend, improved station detail layout, Cargo operations mode with manifest and mission needs, cargo/fuel gauges, and own-ship standby information when no contact is selected. All data remains reported by existing Scout/Spansh sources; artwork is illustrative. Scout unchanged.

## Mongrel HUD 0.18.30 — Data Display layout refinement

Fixed viewport-height two-by-two layout with independent scroll areas, expand/restore buttons, compact system banner, default faction directory, compact planet metrics and clean signal labels, shortened ring names, rings depicted only when reported, economy composition strip and radar standby graphics. Missing fields are hidden rather than repeated dashes. Existing Spansh/Scout data path unchanged. Actual iPad sizing remains to be verified. Scout unchanged.

## Mongrel HUD 0.18.29 — Data Display

Adds a read-only four-quadrant iPad display (system directory, navigation target, ship contact, operations). Spansh system dump is requested only from the active paired data tab using the existing verified HTTPS reader, with five-minute caching, 30-second manual refresh minimum, and explicit failure/cache status. Directory includes reported factions, stations (including body-hosted stations) and bodies. Tap a station/body for a detail modal with embedded type schematic, available economy composition and services; missing values are not inferred. Local Scout target/status telemetry remains separate from community data. Operations modes: Auto, Ship, Exploration, Route. Scout unchanged. Community schema and actual iPad rendering require live verification; schematics are illustrative, not official screenshots.

## Mongrel HUD 0.18.28 — iPad cockpit layout and responsive controls

Navigation now presents a descending vertical throttle column beside a physical D-pad and cockpit panel/tab buttons, with adjacent flight and ship system groups on wide displays and responsive rearrangement on narrow screens. Camera and Combat use grouped backlit controls; edit mode retains binding details. The PC caches the last imported active bindings until explicit sync or reopening the deck; manual edits persist. Rapid taps use a four-pending-command FIFO with 500 ms expiry and stop on context changes or delivery failure. Direction and previous/next tab buttons repeat while held after 350 ms, at most one in-flight repeat, nominal 125 ms interval limited by input duration and network. Release/cancel/blur/offline stops further repeats; a chord already sent may finish. Other actions remain single-tap. No multi-action macros. Scout unchanged; live iPad/Elite verification required.

## Mongrel HUD 0.18.27 — Cockpit navigation keyboard fix

Recognizes Elite's UpArrow, DownArrow, LeftArrow and RightArrow binding names and explicitly sends dedicated navigation cluster scan codes with the extended-key flag, distinct from numpad equivalents. Dedicated navigation keys use a slightly longer 150 ms tap; normal keyboard input is unchanged. Existing mappings and Scout are unchanged. Live in-game validation is required.

## Mongrel HUD 0.18.26 — Ship Control Panel (first test build)

The paired iPad controller now has a separate Control Panel tab with Navigation, Camera and Combat profiles. Active local Elite keyboard bindings are read from StartPreset and .binds XML files, never modified. Sync reads again; manual keyboard chord overrides are saved locally and resettable. Only individual mapped actions are sent, with foreground executable verification and short scan-code presses. Unmapped/HOTAS-only actions remain disabled until a keyboard binding is set. Docking and autodock/launch menu actions are manual taps; no automated sequences. Windows/game delivery and actual active presets need live testing. Scout unchanged.

## Mongrel HUD 0.18.25 — Dim unavailable commodities

Colonization Logistics now uses a dedicated dark neutral gray for explicitly unavailable commodity rows, including all displayed quantities. Available and unknown commodities, fulfilled rows, headings and other HUD panels retain their existing colors. Scout is unchanged.

## Mongrel HUD 0.18.24 — Minimum-stop commodity collection

Commodity Sourcing recommends the smallest verified station set among returned market candidates, accounting for required tonnage and split supply; bounded searches explicitly identify when optimality is not proven. The collection section shows allocated quantities and any unavailable stock, followed by separately sorted alternative stations. Distances round upward to whole light-seconds and two decimal places for light-years. Scout is unchanged.

## Mongrel HUD 0.18.23 — Verified sourcing HTTPS

The standalone Windows package includes certifi's CA bundle and truststore's native Windows certificate validation. Commodity Sourcing uses Windows/OS roots plus the bundled public CA roots, with native Windows chain building only on missing-issuer errors. Hostname and certificate verification are always required; expired, wrong-host and revoked certificates are not bypassed. Reports now include the certificate verification code and reason. Windows packaging checks the actual frozen executable and runs a live public Spansh probe (probe availability is reported separately). No Scout update required.

## Mongrel HUD 0.18.22 — Spansh commodity sourcing

Commodity Sourcing now uses the Spansh station search POST endpoint instead of Ardent Insight or EDData. It retains project, current and custom reference systems, all-material and single-material searches, age and landing pad filters, five-minute local caching, and explicit PC clipboard copying. The search omits market age filters for Any and continues to verify HTTPS certificates. The provider returns bounded nearby station candidates rather than an exhaustive galaxy-wide list. No Scout update required.

## Mongrel HUD 0.18.21 — Sourcing references and provider recovery

Commodity Sourcing lists all active project systems available from Scout, supports a custom reference with Paste from PC, and offers Any report age (subject to provider retention). Search reference does not alter selected Raven material requirements. Ardent failures fall back to EDData with provider attribution and a clear 14-day provider limit. Errors distinguish failed lookups from successful empty results and report HTTP, DNS, connection and response problems. Scout 1.14.11 is unchanged.

## Mongrel HUD 0.18.20 — Commodity Sourcing

Adds an iPad-only, on-demand Ardent Insight search below Colonization Logistics. Search current or selected project systems, all outstanding or a single material, with radius, landing pad and age filters. Group results by station, sort locally and copy systems to the PC clipboard. Nearby candidates are bounded and community-reported; missing or failed queries are disclosed. Direct PC requests and a five-minute in-memory cache avoid squad Cloudflare traffic. Scout 1.14.11 remains compatible.

## Mongrel HUD 0.18.19 — Colonization Logistics

Renames Colonization Cart to Colonization Logistics and displays facility names followed by their Raven build type in parentheses. The overlay measures complete labels to avoid truncation and retains its right edge. Pair with Scout 1.14.10 for the type data.

## Mongrel HUD 0.18.18 — Stable colonization warning footer

Stale data, Raven connection errors, and uncertain reporting warnings now occupy two permanently reserved rows below the construction cart totals. These warnings cannot shift the commodity rows or resize the overlay when they appear or clear. The paired iPad already shows warnings below its project list. Scout 1.14.8 is unchanged.

## Mongrel HUD 0.18.17 — Steady colonization cart

Automatic Raven refreshes no longer interrupt the controller list or desktop cart. Manual refresh feedback appears below the project list and clears after five seconds; connection and reporting warnings remain visible at the bottom. The cart preserves its right edge when ship/carrier columns appear or disappear. Existing positions migrate on the first visible render; unlock the overlay and drag once to set a new right edge. Scout 1.14.8 is unchanged. Raven reads and reports go directly from Scout to Raven, not via the squad site.

## Mongrel HUD 0.18.16 — Raven controller sizing

Larger touch-friendly visibility and build-selection dropdowns, full-width Refresh Raven button, and readable sync diagnostics. Update Scout to 1.14.8 alongside HUD.

## Mongrel HUD 0.18.15 — Raven Colonial Cart

Install with Scout 1.14.7. In EDMC preferences, enable the Raven cart and enter your Raven API key locally. On the paired iPad HUD page use **Colonization Cart** to select Continuous (default), Automatic or Off, follow Raven or choose projects locally, and press **Refresh Raven**. The game overlay shows remaining materials, current ship and linked carrier columns when relevant, market availability and estimated collection/delivery trips. Existing Cargo mission overlay and saved layouts are preserved. Raven is the authoritative construction planner. Reporting is separately opt-in in Scout; disable other Raven reporters before enabling it.

## Mongrel HUD 0.18.14 — Recover scans taken before starting an expedition

In the paired iPad **Exploration → Surveyor · Expedition Control**, expand **Include Previous Scans**. Check the journal-confirmed bodies scanned within 24 hours before the expedition started, then press **Include Selected Scans**. The updated Scout local ledger handles the estimates, avoiding double counting and leaving earlier exclusions alone. The new control requires **Scout 1.14.6** and HUD **0.18.14** on the same Elite PC. No EDDiscovery historical credits are added automatically.

## Mongrel HUD 0.18.13 — Correct carrier route selection and stale job protection

Fixes an iPad Fleet Carrier plotter issue where a previously completed (or active) saved journey would override a newer Spansh route's on-screen Jump Plan, making it appear that **10-16 → the Bubble** was plotting the systems from an older itinerary.

The displayed Jump Plan is now keyed to the **selected Route ID plus the departure and destination fields**. Entering new systems immediately hides incompatible old waypoints; submitting a new plot clears the old visible list without deleting your previous saved route or progress. A newly returned job must match the requested source/destination. **CHECK / LOAD RESULT** now sends the current source and destination to Windows HUD; its backend verifies these fields *before* replacing the saved route, and the iPad checks that the job ID and endpoints match too. If you accidentally check an old route ID, the screen explains that it belongs to a different system pair and tells you to plot a new route. The copy-to-PC button uses exactly the route displayed on screen, not an older route hidden in memory.

Saved-route restoration now respects fields typed or pasted while the restore request was outstanding and, where both an older ready archive and a newer pending job are stored, selects the pending job's actual systems rather than the older archive's. Older active route pause/end controls remain accessible while plotting a replacement. No change to the Spansh API, Carrier Route Director status/cooldown, voice, pad-lockdown estimates or Scout plugin. Previous completed journeys and local route archives remain intact. **HUD 0.18.13**, **Scout 1.14.5**.

## Mongrel HUD 0.18.12 — Clear Fleet Carrier STATUS heading

The Fleet Carrier Director overlay now renders **STATUS** as a small, muted heading with the current carrier state directly beneath it in larger, color-coded text. Example: `STATUS` on its own line, then `ESTIMATED READY · VERIFY CARRIER`. This also applies when no carrier route is active but standalone owner-carrier journal activity is observed. All scheduled, lockdown, in-transit, cooldown, cancelled and ready messages continue working; only typography and vertical spacing have changed. The live phase calculations, countdowns, voice cues, route persistence, iPad controller and Scout are unchanged. HUD **0.18.12**; Scout **1.14.5** remains compatible.

## Mongrel HUD 0.18.11 — Live carrier status and pad lockdown

The **Fleet Carrier Director** now shows **STATUS** rather than a stale cooldown line. Carrier activity is tracked in the persisted Windows HUD state independently of any Spansh journey: even after a prior route is marked complete (e.g. 2/2), a new owner-carrier `CarrierJumpRequest` immediately shows **JUMP PLOTTED** and its scheduled departure countdown; the next destination label switches to the current carrier target. The current phase advances through **PAD LOCKDOWN**, **IN TRANSIT (EST.)**, **CARRIER COOLDOWN (EST.)**, and **ESTIMATED READY**, unless a matching `CarrierJump` supplies confirmed arrival/cooldown times. A matching `CarrierJumpCancelled` replaces the status with **JUMP CANCELLED**. Ship `FSDJump` and other carriers never update it. The iPad carrier controls show the same phase irrespective of whether a route is active.

A separate **PAD LOCKDOWN IN** countdown counts to `DepartureTime - 3 minutes 20 seconds` (community documented default). When the threshold is reached, HUD displays **PADS LOCKED · NO DOCKING**; during transit it remains locked; after the estimated/confirmed arrival, that pad warning clears. Because there is no guaranteed pad-lockdown journal event, pad status remains explicitly *estimated*, even if the clock is synchronized. A scheduled departure does not prove the jump occurred, mark route waypoints complete, or schedule a carrier jump. The existing 4-minute minute-rounded cooldown and brief green ready flash remain unchanged. Live status survives HUD restarts because it shares `%LOCALAPPDATA%\MongrelHUD\state.json` with route tracking.

HUD 0.18.11 only; Scout remains 1.14.5. During live testing, compare T-minus 03:20 with Carrier Management to calibrate lockdown if necessary.

## Mongrel HUD 0.18.10 — Fleet Carrier jump plans survive HUD updates

Fleet Carrier routes that have reached **CHECK / LOAD RESULT → ready** are now automatically saved as complete, validated waypoint manifests in the existing Windows `%LOCALAPPDATA%\MongrelHUD\state.json` file. They are loaded automatically into the iPad Navigation plotter whenever the paired HUD controller starts, even after the Windows executable is updated and after the original Spansh cloud route-job expires (normally 24 hours). No replot, new job ID, manual import, or START ROUTE required to retain a *ready preview*. Values including capacity, tank/cargo Tritium and the full route jump list are saved. The previously implemented **START ROUTE** journey progress remains stored independently and is **never reset** by a replacement preview.

New `/api/carrier-saved-route` is **paired-controller-only** and reads solely the local Windows file; the full route is fetched once per iPad page load, not on each 1-second HUD state poll. An in-progress Spansh route request's ID and endpoints are also saved, so after an update the user can press **CHECK / LOAD RESULT** without having to replot, provided that upstream job has not expired. Launching a new pending route does not erase the last fully loaded plan. When a new ready result is checked, it replaces the previously saved *preview*; the active journey is not replaced.

**Migrating a route from an older HUD:** On HUD 0.18.8 or 0.18.9, use **START ROUTE** for the loaded route *before updating* to retain it as a persistent active journey; otherwise record its route ID before restarting and load it in 0.18.10 while the 24h Spansh job exists. Older releases did not save ready previews. The HUD installer already preserves the local state file, so only HUD 0.18.10 is needed. This saves routes **per PC**, not across Serenity and the travel laptop or to Cloudflare. Existing ship/neutron route storage is unchanged; completed carrier tracking, overlay and cooldown settings are preserved.

## Mongrel HUD 0.18.9 — Carrier schedule-based cooldown and voice outside the carrier

For an active Fleet Carrier journey, the existing `CarrierJumpRequest` event supplies **DepartureTime**, a server-scheduled UTC departure timestamp (not confirmation of actual departure or arrival). The iPad and Fleet Carrier Director overlay now show a **scheduled departure countdown**, an approximate 75-second transit state, **estimated cooldown countdown**, and clearly labeled **ESTIMATED READY · VERIFY CARRIER** after the minute-aligned cooldown. The estimate uses the given DepartureTime whether departure was scheduled 16 minutes or 90 minutes ahead; it never assumes a fixed 16-minute preparation period. The prediction does **not mark a waypoint complete**. Late server changes without a new journal event remain unknowable; after two hours past an unverified ready time the overlay reports an unverified arrival instead of promising readiness.

`CarrierJumpCancelled` by the matching carrier removes the schedule and its voice readiness cue. A newer matching `CarrierJumpRequest` replaces the prediction. An actual matching `CarrierJump` (usually only observed when aboard the carrier) replaces the estimate with a confirmed minute-aligned cooldown and advances only the next matching stop. The owner's already configured carrier voice cue is now also scheduled at the estimated ready time from DepartureTime even if the commander is flying elsewhere; the spoken phrase explicitly says **estimated**, and a later confirmed arrival reschedules the cue using verified timing. As before, the voice must be enabled and HUD/EDMC must be running to receive the journal event. No new polling and no fake carrier progress.

The estimate assumes ~75 seconds from the scheduled departure to arrival, aligned to the next whole-minute using the existing four-minute cooldown rule. A time such as 10:34:00 departure predicts ~10:35:15 arrival and 10:39:00 ready. This approximation needs comparison with an actual live carrier jump to calibrate; it is not authoritative server telemetry. **HUD 0.18.9** only; Scout remains **1.14.5**.

## Mongrel HUD 0.18.8 — Fleet Carrier Director, progress and cooldown overlay

New **START ROUTE / PAUSE / RESUME / END ROUTE** controls on the Navigation Fleet Carrier plotter. Starting a loaded Spansh route marks the departure system complete. The entire route and its completed index are saved in the current Windows HUD's local store, beyond the one-day Spansh job lifetime; reloads and HUD restarts preserve progress. The iPad Jump Plan shows a green completed row/check, the highlighted next stop, remaining jumps/LY/estimated Tritium and a large **MARK ARRIVED** checkbox for only the next stop. Prior stops cannot be re-completed or skipped by accidental taps.

The existing Scout event stream feeds verified **CarrierJump** arrivals when the commander is **aboard the same registered owner carrier** and its system matches the next planned hop. Regular FSDJump (e.g. the Caspian Explorer), jump *requests*, unrelated carriers, duplicates or out-of-order arrivals never advance the route. This journal event normally is **not generated when the commander is away from the carrier**; in that case manually confirm arrival. Online monitoring does not invent progress from a scheduled departure time. A manually confirmed stop uses the time of the tap for its **approximate** cooldown, explicitly labeled approximate; late/offline confirmations can be inaccurate.

The cooldown uses the game's minute-aligned 4-minute rule: completion at **10:34:15 → ready 10:38:00**. Both the iPad status and a new independently movable **Fleet Carrier Director** overlay show a live countdown, then green **COOLDOWN COMPLETE · READY TO JUMP**, briefly flashing green on transition before remaining steady. The overlay defaults visible in Navigation but is assignable to Combat, Surface Mining, Exploration or all four profiles through the collapsed Overlay Options selector, just like existing windows. The overlay makes no carrier jump requests; it also shows next system, remaining jumps/LY and estimated Tritium.

This initial persistent journey is **per Windows HUD installation**, not cloud-synchronized between Serenity and the travel laptop. Carrier fuel from Spansh is estimated; the tracker does not claim to know the actual tank/cargo inventory. Scout **1.14.5** is sufficient; HUD **0.18.8** is required.

## Mongrel HUD 0.18.7 — Navigation layout and per-stop Carrier clipboard copy

The paired iPad Navigation profile now groups the **Neutron/Galaxy ship plotter and Route Director together**, with the independent **Fleet Carrier Route Plotter · Spansh** beneath. The ship plotter uses balanced Route Type / Efficiency fields and a full-width Destination + Paste from PC field rather than the inherited 100px column. Existing route calculations are unchanged.

Fleet Carrier plotting now explicitly prompts **CHECK / LOAD RESULT** after a successful submission; it does not imply that the screen is automatically waiting for a background load. On load, a clearer **Route Summary · Fuel Estimates** shows total jumps, distance and estimated Tritium consumption as three large metrics, followed by restock/inventory notes. Jump lines show departure/arrival, leg distance and estimated fuel usage.

Each carrier stop has a **COPY TO PC** button that writes exactly that stop's system name to the Windows clipboard on the PC running the paired HUD. You can paste it into Elite with Ctrl+V. The write occurs only after an explicit tap, uses the existing paired/same-origin LAN control, validates the system name and does not send clipboard data to the website or Scout. It does **not** schedule jumps or activate Route Director. When using both laptop and Serenity, open the numbered LAN address of the PC whose clipboard you want to control. No Scout upgrade needed beyond 1.14.5.

## Mongrel HUD 0.18.6 — Compact overlay controls + balanced Fleet Carrier plotter

The paired iPad HUD Control screen now has a **collapsed OVERLAY OPTIONS** drawer immediately below the Combat / Surface Mining / Navigation / Exploration profile selector. Expand it to manage the existing global overlay visibility, size, profile assignments, and lock/reset commands, together with the five Navigation instruments; collapse it again to reclaim vertical space. All original panel IDs and persisted layout configuration are retained. The drawer is available no matter which HUD profile is selected.

Within **Navigation**, the ship Neutron/Galaxy route plotter comes first, then the **Fleet Carrier Route Plotter**, followed by Route Director. The two carrier system fields use **equal width** with their own full-width Paste from PC buttons. Carrier Used Capacity, depot Tritium and cargo Tritium use a balanced three-column responsive row, stacking gracefully on narrow screens. The ship route UI, Spansh routing math, clipboard behavior and Scout plugin remain unchanged; **Scout 1.14.5** is still compatible.

## Mongrel HUD 0.18.5 — Paste a Windows system name into the iPad route fields

The Navigation controller now offers **PASTE FROM PC** beside the ship route destination and both Fleet Carrier departure/destination fields. Copy a system name with Ctrl+C on the Windows PC running HUD, then tap the matching button on the paired iPad. HUD reads the Windows CF_UNICODETEXT clipboard **only for that explicit authenticated, same-origin request**, validates a single 2–140-character Elite system-name-style string, and fills just the requested field. Invalid/multiline/URL clipboard contents return an error without exposing raw clipboard text.

There is no continuous clipboard sync, cloud upload, new pairing model, new Scout version, or background polling. The iPad must be connected to the HUD instance running on the PC where the name was copied; if two PCs both advertise `mongrel-hud.local`, use that PC's numbered LAN fallback URL instead. Pairing and existing Route Director/Spansh behavior are unchanged.

## Mongrel HUD 0.18.4 — Fleet Carrier route planning on Navigation

The paired iPad **HUD CONTROL → NAVIGATION** page now has an independent **Fleet Carrier Route Plotter · Spansh** card. Enter the carrier's **actual departure system** (not necessarily the ship's current system), destination, Carrier Management **Used Capacity** (including installed services, reserves, stored cargo), Tritium depot tank and cargo Tritium. Enable **Determine Tritium Requirements** to ask Spansh to estimate starting fuel, or disable it to route against the entered cargo Tritium stock.

**PLOT** submits a Spansh job on demand. **CHECK / LOAD RESULT** reads the exact Spansh result by ID: a full hop list, LY per leg, Tritium burned, fuel in tank, restock amounts, icy/pristine ring flags, total LY, total burn, and a basic stock comparison. All values are planning estimates, not automatic adjustments or proof that Tritium is available to buy/mine. Actual ship cargo, passenger mass and CMDR location do not replace the carrier's management capacity.

**Requires Scout 1.14.5.** No carrier jumps are scheduled or controlled; carrier previews do not activate the existing ship Route Director, change its clipboard, or overwrite its latest ship-route pointer. This first version is a controller plotter/manifest, not a new desktop overlay or automatic carrier-journey tracker. On Serenity update both the HUD executable and the EDMC Scout folder. Existing overlay layouts and profiles remain intact.

# Mongrel HUD

**Short version:** put it on the Windows PC that runs Elite, start **MongrelHUD.exe**, then use your iPad or browser as the controller.

You do **not** install anything on the iPad.

Current downloads:
https://mongrels-squadron.pages.dev/member/#mongrel-tools

## Mongrel HUD 0.18.3 — Stable Surveyor / Biological Intelligence release

Mongrel HUD **0.18.3** is the standard downloadable Windows release. It
integrates the local Scout **1.14.3** Surveyor and Exobiology state into
the existing Exploration HUD profile and paired iPad controller:

- Three specimen slots for the *single currently active* organic sample;
  old abandoned partials are not misrepresented as active progress
- One DSS biology roster: range-only genera (neutral), identified
  species/variant (cyan), genetic sample complete (green); values from the
  full locally published 96-entry catalog
- Position-matched genetic distance on foot, in an SRV/Nomad or locally in
  the ship; unsafe/missing GPS is explicitly marked unverified
- Body Intelligence atmospheric classification next to planet type
- Cartographics and Exobiology expedition estimates together, with
  clearly separated confirmed Vista sale amounts
- Updated local first-discovery, FSS coverage, journal backfill and
  EDDiscovery historical reference surfaces, with historical source labels

**Update the normal Windows HUD via the built-in update button** or the
Mongrel Tools website link. HUD self-update does not replace EDMC Scout.
For full Exploration and Exobiology support install Scout 1.14.3 on the
Elite PC as a separate plugin upgrade. The old private test packages
are no longer needed.

## Route Director controls and display (HUD 0.17.8)

On the paired controller open **HUD CONTROL → ROUTE DIRECTOR**. Paste the route ID provided by ChatGPT (or leave it blank to load the most recent calculated route), click **LOAD ROUTE**, then **START NAVIGATION** and confirm. **STOP NAVIGATION** disables further clipboard changes after the next Scout refresh. Scout 1.13.1 or newer and a Site Admin-bound Scout token are required. No iPad installation is needed. When Scout receives an explicitly activated Spansh route, the existing Own Ship overlay shows **NAV NEXT** and a waypoint counter. The local EDMC Scout process performs clipboard copying when the next listed waypoint is reached; the HUD itself does not control the game's Galaxy Map. Route previews do not touch the clipboard, and all other overlays retain their current behavior.

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


## Route reliability improvements (HUD 0.17.8 / Scout 1.13.1)

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

## Shared mining database health (HUD 0.17.8 / Scout 1.13.1)

On the Surface Mining iPad tab, tap **CHECK SHARED MINING DATABASE** to
run a one-time owner-authorized read-only check of the live 10-16 archive
D1 database. It reports whether the existing 10-16 and new multi-system
tables exist. This check never initializes tables, modifies reports,
enables shared syncing, or performs recurring Cloudflare reads.

Even when both sets of tables exist, an external production D1 backup
remains an independent release prerequisite. Off-system reports are still
**LOCAL ONLY** until that backup is verified and remote write enablement
is separately approved.

## Shared off-system mining pilot (HUD 0.17.9)

After the owner verified the `ten16-mining` D1 binding, additive multi-system
tables, Time Travel recovery, and the 208,548-byte separate SQL backup, the
Surface Mining **System Browser** now supports cached **read-only shared**
off-system mining records (directory at most once per hour, selected system
records cached ten minutes). The original 10-16 feed stays separate.

**REPORT DEPOSIT** and **SET CENTER** outside 10-16 still save locally ONLY.
To publish a particular saved off-system record, open that system in the
browser and explicitly press **SHARE DEPOSIT WITH SQUAD** or
**SHARE CENTER WITH SQUAD**. A confirmation shows system/body/signal.
The HUD sends only the saved, EDMC-verified record through the existing Scout
authenticated mining proxy and archives the server acknowledgment. Local
records survive network errors. Published reports show SQUAD SHARED only after
the server confirms approval; pending and duplicate reviews are labeled
accordingly, and the existing Site Admin rules still apply to centers.

This is a **manual pilot**, not automatic synchronization and not a bulk upload.
Do a single real-record live trial before opening rollout to members. No new
recurring Cloudflare polling and no change to Combat, Navigation or carrier
features.

## Before you start

You need:

- a Windows PC running Elite Dangerous
- **Mongrel Scout** installed and running in EDMC on that same PC
- your iPad/phone on the same home/private network if you want to use the remote controller

The HUD runs on the Elite PC because the overlay has to appear over the game and it talks to Scout through a local connection.

## Surface Mining system browser (HUD 0.17.8)

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


## Compact Surface Mining controls (HUD 0.17.10)

The Surface Mining iPad controller puts **REPORT DEPOSIT** ahead of the
saved-deposit listing and the larger system browser. Saved deposits in the
current mining location appear in collapsed groups by commodity, showing
how many records exist in each category. Expanding a commodity reveals
the original deposit buttons and their unchanged selection/compass actions.
An expanded group stays open during normal controller polling and resets
when the current system, body or selected signal changes. This is a UI-only
update; the Scout version, upload authorization, and shared database read
cadence do not change.

## Saved system browser commodity groups (HUD 0.17.11)

The Surface Mining **Mining Database · System Browser** now collapses saved
system deposits under commodity headings with counts (for example,
**Gold · 12 deposits**), instead of showing a full flat list. Tap a commodity,
then tap a saved deposit to reveal the existing Navigate and (where allowed)
Share With Squad controls. Center-only locations have their own collapsed
section. The commodity/body/min-rig filters still apply to the displayed
records, and expanded groups and records stay open when a published record
refreshes the current system. Switching systems resets expansion. The
previously added **Deposits in Selected Location** grouping and prominent
**Report Deposit** form remain unchanged. No mining uploads, cloud polling,
or Scout behavior changes.
