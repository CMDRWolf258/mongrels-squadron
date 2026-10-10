# Mongrel Route Director (draft, stacked on Scout Link PR #183)

**Goal:** remove routine setup for neutron plotting. From ChatGPT: "Plot a neutron route to Diaba" → source and ship range from live Scout → real Spansh route preview → explicit activation → local Windows clipboard automatically contains next waypoint after each confirmed waypoint.

## Workflow

1. On the active EDMC computer, enable the opt-in `Share minimal ship status with my private ChatGPT Scout Link` under MongrelScout settings. Confirm current ship snapshot in the Site Admin diagnostic endpoint.
2. On Cloudflare Pages set **both** `SCOUT_CHATGPT_LINK_ENABLED=true` and `SCOUT_CHATGPT_ROUTE_ENABLED=true` after code review/merge.
3. In a ChatGPT client supporting personal remote MCP plugins, authorize the Scout Link server via the existing Site Admin Discord account. The OAuth consent explicitly notes that route activation can cause local PC clipboard copying.
4. ChatGPT calls `plot_neutron_route` with the destination system. The service reads the latest fresh Scout snapshot and selects a conservative fixed range (97% of the lesser current/full-fuel-zero-cargo range), x6 neutron for the Mk II FSD or x4 for ordinary FSD.
5. Spansh accepts a `POST https://spansh.co.uk/api/route` request and returns an asynchronous job ID. ChatGPT calls `get_neutron_route` to retrieve and present actual ordered waypoints from `GET https://spansh.co.uk/api/results/{job}`.
6. **Preview is strictly inactive**. Only following explicit user approval does ChatGPT invoke `activate_neutron_navigation`; the backend checks current system and ship before activating. `stop_neutron_navigation` cancels.
7. At the next normal HUD manifest/feed refresh (no new polling loop), Scout receives the owner-only route, and places the first next-waypoint system name into the Windows clipboard. After an `FSDJump` to the *next waypoint* on the route, Scout advances once and replaces the clipboard with the following waypoint.
8. The Own Ship HUD overlay shows `NAV NEXT` and route progress whenever navigation is active. You just paste the clipboard into Elite's Galaxy Map when required. Elite itself is never controlled by this integration.

## Neutron waypoint contract (correction, October 9, 2026)

**Waypoints are not hyperspace jumps.** Spansh Neutron Plotter returns the ordered
systems where the pilot should replot in Elite's Galaxy Map. A route with 18
waypoints is not an 18-jump route: Elite can calculate several ordinary jumps
between two successive waypoints. This is intentional and well suited to the
commander's paste-next-neutron-stop workflow.

- Preserve every stop in Spansh's ordered response, including non-neutron
  bridge/final stops. Do **not** drop stops simply because `neutron=false`.
- Scout copies the next supplied waypoint's **system name only**, after the
  pilot explicitly activates the route. Elite computes intermediate legs.
- An `FSDJump` into a system not equal to the next waypoint does **not**
  advance the route or overwrite the clipboard. Only arriving at the next
  ordered waypoint advances one position; each target is copied once.
- `waypointCount` includes the source and final destination when provided.
  `navigationTargetCount` excludes the source. Neither is an actual-jump count.
- Keep optional Spansh row fields `jumps` (normalized as
  `estimatedJumpsFromPrevious`), `distance`, `distance_to_arrival` and
  `distance_remaining`. Sum available per-leg jump estimates into
  `estimatedTotalJumps` only when **every** route leg provides a valid count.
  Unknown counts remain `null`, not zero or the waypoint count.
- If the source is omitted from Spansh's response, prepend it only as local
  progress context. Do not create speculative intermediate jumps.
- A canceled route must not copy pending waypoint changes. Restarting the
  same route must allow its initial next waypoint to be copied again.
- Navigation preview and result retrieval have **no** local clipboard effect;
  do not activate navigation during CI or the pre-merge review.

**Fuel-safety limitation:** A fixed-range Neutron Plotter route does not model
all fuel usage. Spansh warns that ships in the 10–20 LY range may enter systems
they cannot leave without sufficient boost. Especially for heavy freighters,
verify scoop opportunities and Galaxy Map reachability before jumping.

**Galaxy Plotter investigation:** Spansh's separate Galaxy Plotter computes
exact hops, refueling, neutron boosts and FSD injection using a ship build
(Coriolis/EDSY SLEF), cargo and fuel settings. Scout Link currently transmits
only a *minimal ship snapshot*, not a full EDSY/Coriolis build. Integrating
fuel-aware plots is a **future opt-in mode**, not a silent replacement of the
current neutron waypoint copying. First design build data access, permission
scope, fuel model validation, result limits and explicit refuel guidance.

## Sources and limits

- Spansh integration format adapted from Navl's Neutron Dancer `Router/route_manager.py` and `Router/plotters.py` (https://github.com/dwomble/EDMC-NeutronDancer).
- This initial integration uses Spansh **Neutron Plotter**: a fixed-range waypoint route that prioritizes neutron stars. It is not the full Galaxy Plotter (which can schedule individual fuel/scoop legs). Pilot must check neutron star safety, fuel availability, and in-game reachability before any jump.
- Source always comes from live Scout. User may specify a destination such as Diaba; no need to type start system or jump range.
- The Route Director will reject a stale/offline ship snapshot rather than assume Inara reflects the present ship.
- Route jobs expire from Cloudflare KV after 24 hours. An active route must match the currently reported ship, and activation is denied if the current system isn't on that actual returned route.
- Cloudflare KV is eventually consistent. Activation/stop propagation depends on the existing HUD manifest period (~30 seconds plus normal cache variation); do not promise instant clipboard cancellation on an offline machine. Disabling EDMC auto-copy is immediate locally.
- Overcharge 6× is selected only for Scout's `mkii` FSD. Route results are validated and never fabricated if Spansh fails or returns an unexpected format.
- Automatic copying only occurs on the EDMC-equipped PC, not on the iPad running ChatGPT.

## Security and non-regression

- Route tools use authenticated ChatGPT MCP OAuth with the `scout.route` scope. Explicit activation is a write to the user's *navigation route record*, not an in-game command, and should be presented as a confirmation in ChatGPT.
- Navigation delivery is owner-only and piggybacks on the existing Scout HUD feed. No general travel logs, complete module loadout or auth tokens sent to ChatGPT.
- Opt-in controls: (1) feature flags (default off), (2) Scout telemetry checkbox (default off), (3) explicit route activation, (4) local auto-copy preference (default on but can be disabled).
- Existing local HUD bridge, BGS upload, mining navigation and carrier voice workflows are unchanged.
- Per-manifest admin-only extra KV read for the active route token (at 30-second cadence while Scout is online), plus a read on full HUD feed. No extra HTTP polling schedule.
- Spansh job POST is user-requested only; results GET is called when ChatGPT retrieves pending/completed route jobs.

## Current status

- Draft PR #183 supplies Scout Link, admin OAuth and `get_current_ship`.
- This stacked draft PR provides Spansh routing, activation/cancellation, route delivery, local auto-copy, and HUD's Own Ship text.
- CI tests cover request formation, mocked job receipt, destination validation, explicit activation/cancel, stale-telemetry rejection and local waypoint copy advancement (once per waypoint and not on intermediate jumps).
- Still require live validation of Spansh API from Cloudflare, ChatGPT plugin OAuth, and actual Windows clipboard behavior while Elite is active.
- Parent PR #183 has pending OAuth replay-hardening review for KV vs atomic token redemption. Do not deploy route write tools before that review.
- Before release, bump the downloadable Scout/HUD component versions and ensure website update/installer manifests point to new builds.

## Proposed live acceptance check

With Elite, Scout and HUD running on Serenity and the backend activated:
- Plot the current opt-in ship (e.g., Albatross) from 10-16 to Diaba; check its actual loaded jump range.
- Inspect all returned waypoints and x6 classification. Preview must NOT touch the clipboard.
- Explicitly activate. First next-waypoint name should be in **Serenity's** clipboard.
- Paste into Galaxy Map, fly; once reaching a registered waypoint, paste again: clipboard should contain the next waypoint, exactly once.
- Make an intermediate non-waypoint jump; waypoint should not advance.
- Cancel; after Scout refresh, verify it no longer copies.
- Test with Scout disabled, another ship, or no fresh snapshot: refuse/flag stale rather than plot or copy.
