# Wolf BGS Control — Architecture Context

_Last updated: 2026-09-17_

This file records the architecture and product direction for the Wolf-only BGS Control Room. Read `PROJECT_CONTEXT.md` first; repository code remains authoritative.

## Purpose

Wolf BGS Control is a site-admin-only command deck for CMDR Wolf258, the squad's primary BGS strategist. It is intentionally distinct from member-facing Mission Control and officer Daily Orders editing.

Core principle:

> Programmed BGS logic performs monitoring, prioritization and clerical work; Wolf retains strategic authority; members receive simple orders and low-friction reporting.

## Current implementation

Primary files:
- `/wolf-bgs/index.html`
- `css/wolf-bgs.css`
- `css/wolf-bgs-rules.css`
- `css/wolf-bgs-sliders.css`
- `css/wolf-bgs-screenshot.css`
- `js/wolf-bgs.js`
- `js/wolf-bgs-inheritance.js`
- `js/wolf-bgs-rules.js`
- `js/wolf-bgs-sliders.js`
- `js/wolf-bgs-screenshot.js`
- `functions/api/operations/wolf-bgs.js`
- `functions/api/operations/wolf-bgs-write.js`
- `functions/api/operations/wolf-bgs-rules.js`
- `functions/api/operations/wolf-bgs-sliders.js`
- `functions/api/operations/wolf-bgs-screenshot.js`
- `scripts/enrich_bgs_boards.py`
- `data/live-bgs-boards.json`
- `scripts/smoke-wolf-bgs.mjs`
- `scripts/smoke-wolf-bgs-screenshot.mjs`
- `.github/workflows/update-bgs.yml`

Access:
- Server APIs require `session.access === 'site_admin'`.
- UI hiding is not treated as authorization.

Storage:
- Existing `DAILY_ORDERS` KV binding.
- Core Control Room key: `wolf-bgs-control-v1`.
- Automation Rules key: `wolf-bgs-rules-v1`.
- Economy/Security objective key: `wolf-bgs-slider-objectives-v1`.
- Core key stores global automation defaults, System Defaults, sparse per-system settings/favorites, and manual system/faction snapshots.
- Rules key stores programmed workload/safety rules and per-system whole-board faction strategy.
- Economy/Security objective storage is separate from factual board snapshots and influence strategy.
- Screenshot images are not persisted by Wolf Control; they are interpreted for the current request and only extracted review data is returned to the browser.

## Control-deck list UX

The current Mongrel footprint is shown as compact expandable system cards.

List controls:
- default **20 results per page** with selectable page size;
- default sorting is **Mongrel influence high → low**;
- search by system name;
- alternate sort by influence low→high, system name, priority, or data freshness;
- quick views for Favorites, attention, stale, controlled, and not controlled;
- **Custom filter** exposes Priority, State text, Pending text, control status, and flags such as Favorite, Retreat risk, Conflict, Stale, Custom Settings, and Automation Off;
- optional **Favorites first** checkbox pins all favorite systems above the normal sorted/filtered list without changing the selected sort inside each group;
- optional **Keep lowest 5 on page** checkbox reserves the final five page slots for the five lowest Mongrel influences across the entire active footprint. These cards receive a LOW 5 WATCH marker;
- **Reset Filters** restores the baseline list view: blank search, All systems, Influence high→low, 20/page, watch toggles off, and cleared custom-filter fields. It does not remove saved favorites.

Each system has a Wolf-only clickable favorite star. Favorites are navigation/visibility aids and do not by themselves change Daily Orders or BGS automation priority.

The collapsed system header shows the same unified **Priority** field edited inside the Strategy section. The previous separate `Strategic Importance` concept was removed as redundant.

Faction rows inside the expanded System Status & Faction Board are displayed by influence high→low, using faction name as a stable alphabetical tie-breaker.

## Influence target visualization

When a Mongrel target band exists:
- collapsed system cards show a very subtle influence marker with the target window shaded behind it;
- expanded Strategy shows a larger Mission-Control-style 0–100% influence bar with current position and target min/max.

No target meter is shown when no target band exists, avoiding extra visual clutter.

## Prototype global automation defaults

Global Automation Defaults govern cycle/reporting mechanics rather than individual strategic objectives:
- Default scheduled system tick: 19:00 local browser/Control Room display time (intended starting point: 7:00 PM Central for Wolf).
- Maximum data age: 8 hours.
- Tick-watch buffer: 90 minutes.
- Late-report grace: 3 hours.
- Maximum Daily Orders systems: 6.
- Default rollover policy: Safety Only.
- Require post-tick data for normal orders: true.
- Emergency orders with stale data: false by default.

All are configurable from Wolf Control. Tablet/iPad layout keeps the global form in two columns where practical while explicitly constraining grid children and unit fields so Safari-native inputs cannot overlap the neighboring column.

## System Defaults and reset behavior

A clearly separate expandable **System Defaults** card lives below the system list.

These defaults govern normal strategy/automation behavior for systems without a custom system setting:
- Priority: Normal.
- Control Policy: **Maintain existing control state**.
  - If Mongrels already control the system, future automation should preserve that control unless overridden.
  - If Mongrels do not control the system, this default does not instruct automation to take control.
- Optional target influence min/max.
- Preferred/avoided states.
- Retreat protection.
- Expansion avoidance.
- Daily Orders eligibility.
- automatic order generation.
- emergency priority override.
- reactions to Retreat, conflict, Expansion, influence-band and state changes.

Per-system settings use sparse overrides. A value that is blank or explicitly returned to the active System Default does not remain frozen as a copied value; it inherits the current default dynamically. Changing System Defaults therefore affects only fields/systems still inheriting those defaults.

**Reset to Defaults** removes that system's custom configuration overrides and returns it to inherited System Defaults. The reset intentionally preserves:
- favorite status;
- system notes;
- manual faction/status snapshots;
- faction-board strategy stored in the Automation Rules layer;
- Economy/Security objectives stored in their own layer;
- reporting/history data.

The reset requires explicit confirmation.

## Per-system control model

Every current Mongrel-presence system appears as a compact expandable card. Controls include:
- unified Priority: Critical / High / Normal / Low;
- control policy: Maintain Existing / Gain Control / Allow Intentional Transfer / No Control Objective;
- target influence min/max;
- preferred/avoided states;
- Retreat protection;
- Expansion avoidance;
- Daily Orders eligibility;
- automatic order generation;
- emergency priority override;
- response toggles for Retreat, conflict, Expansion, target-band and state changes;
- custom tick time;
- custom freshness threshold;
- rollover policy;
- notes;
- favorite star for quick filtering/pinning.

Settings are changed only after **Save System Settings**, except the favorite star which is an intentional quick-control action and saves immediately with a fresh system-settings timestamp. A full edit history is not required.

## Full faction-board ingestion

The original `data/live-bgs.json` remains the authoritative Mongrel-presence discovery feed. It tracks the Regiment of Imperial Mongrels presence plus useful system metadata.

Complete faction boards are enriched independently into:
- `data/live-bgs-boards.json`
- generated by `scripts/enrich_bgs_boards.py`

The enrichment flow:
1. resolves the Mongrel faction in EliteHub Vault;
2. obtains current Mongrel system IDs from Vault faction-state rows;
3. fetches every faction-state row for each active Mongrel system;
4. retains faction name, influence, active/current states, pending states, recovering states, and source update timestamp;
5. writes complete boards separately from the presence feed.

The BGS refresh workflow runs the normal presence updater first, then the board enrichment. The board snapshot is separate deliberately: a temporary full-board failure must not make the existing Mongrel presence feed disappear or falsely retire systems. The enrichment file also preserves prior good board rows on incomplete/failed refreshes where possible.

The workflow continues on the existing two-hour schedule and can also run manually. It also runs when BGS updater/workflow code changes so new ingestion logic can be exercised immediately.

## Source/manual freshness behavior

The expanded card contains an editable faction board with rows for:
- faction name;
- influence;
- current/active state;
- pending state;
- recovering state;
- data origin.

Wolf can add/remove faction rows, set the controller and notes, then use **Submit Status**. Manual status submission is intentionally separate from saving system automation/strategy settings.

Manual status gets a fresh server timestamp and actor identity. The UI shows:
- External Source Update Time;
- Manual Update Time;
- Active Snapshot time/source;
- whether a complete external board is available and how many factions it contains.

Trust model:
- newest complete manual snapshot wins when it is newer than the external board;
- a newer complete external board supersedes the older manual snapshot;
- when full-board ingestion is unavailable, the Mongrel presence row still supplies a source fallback and Wolf can submit a complete manual board.

The Control Room must never imply a board is complete when only the Mongrel presence row is available.

## Screenshot import — review-first manual-data accelerator

Each expanded system card can mount a Wolf-only **Screenshot Import** panel immediately after the factual faction board.

Phase-one workflow:
1. Wolf drops, pastes, or chooses a PNG/JPEG/WebP screenshot up to 8 MB.
2. The browser sends it to `functions/api/operations/wolf-bgs-screenshot.js` with the current system name and current editable faction names/influences for reference.
3. The server uses the existing OpenAI API key and Responses API image input to extract visible faction names and influence percentages. Image text is treated as untrusted data, not instructions.
4. Returned rows are matched against known current factions where possible and carry a confidence score.
5. The review panel shows current influence, detected influence, delta, confidence, total detected influence, unmatched names, and warnings.
6. If two or more readable rows do not total approximately 100%, the importer warns rather than pretending the extraction is trustworthy.
7. **Apply Matched Influence to Form** changes only matched influence inputs in the editable faction board.
8. The importer never invokes `submit-status`; Wolf still reviews the resulting form and explicitly presses **Submit Status** before the manual snapshot becomes authoritative.

Additional safety rules:
- unmatched faction names are not auto-applied;
- low-confidence rows are visibly flagged;
- a reported different system name is warned about;
- file type/size are validated on both client and server;
- the endpoint is site-admin-only and uses the same same-origin request marker as Wolf Control;
- screenshot API usage is counted against the existing AI usage budgets;
- screenshot bytes are not persisted in Control Room storage.

Phase one intentionally does **not** estimate graphical Economy/Security slider marker positions. That is a later vision-calibration feature and should be stored as approximate observations rather than fabricated exact game percentages.

## Automation Rules Library v1

The first programmed-rules layer is now separate from the cycle/freshness defaults. It is explicitly a configurable operational doctrine layer rather than a claim to know Frontier's hidden BGS formula.

Initial workload controls:
- Mission INF per participating CMDR — normal goal;
- Mission INF per participating CMDR — stretch guidance;
- bounty voucher MCr per CMDR;
- profitable trade MCr per CMDR;
- exploration-data MCr per CMDR;
- preferred number of participating CMDRs for an objective;
- diversify useful BGS buckets when practical;
- do not multiply a solo CMDR's workload to replace missing operators.

Initial safety controls:
- Retreat warning influence;
- Retreat emergency influence;
- Expansion early-warning influence.

### Diminishing-return doctrine

The Rules Library encodes the following as operational doctrine, not a confirmed hidden game formula:
- several participating CMDRs doing useful moderate work is preferred to one CMDR grinding one bucket far beyond its useful range;
- useful work should be spread across available positive/negative BGS levers where appropriate;
- a single CMDR should not automatically receive three times the work merely because the preferred operator count is three;
- exact independent per-CMDR soft-cap behavior remains **unconfirmed** and must not be presented as a known Frontier mechanic.

This distinction is important for future empirical calibration: commander contribution counts, issued workloads, completed reports, and following-tick outcomes can be compared without pretending a hidden cap is already known.

## Whole-board faction strategy

Automation is intentionally **not Mongrel-only**.

Every faction on a system board can receive a programmed intent:
- No action;
- Support / raise;
- Suppress / lower;
- Maintain / hold;
- Protect from Retreat;
- Allow Retreat.

Non-Mongrel factions can also receive:
- target influence min/max;
- control objective: no objective / prefer control / avoid control / allow either.

For the Regiment of Imperial Mongrels, the authoritative influence band remains the existing System Strategy target min/max to avoid duplicate sources of truth. The whole-board strategy layer can still carry the Mongrel intent/control objective.

This model allows a future generated order to say, for example, “complete 25 INF for Wolf 258 Dynasty” when that is the configured board objective instead of assuming all positive BGS work must support Mongrels.

Faction Strategy is saved separately from manual faction-board status. Resetting faction strategy does not edit the factual board snapshot; resetting System Settings does not erase faction strategy.

## Economy and Security objectives

Economy and Security are first-class faction objectives rather than being inferred from influence intent.

For every faction on a current board, Wolf can independently configure:
- **Economy:** Ignore / Raise / Hold / Lower.
- **Security:** Ignore / Raise / Hold / Lower / Locked / not actionable.

These objectives live in their own storage layer and are intentionally separate from factual faction status and influence strategy.

Influence guardrails coordinate the two layers:
- if a faction is at/above its configured influence ceiling, positive slider work is paused rather than silently pushing influence higher;
- if a faction is below its influence floor, positive Economy/Security work can also serve the influence objective;
- if a faction is configured for suppression, positive slider work is blocked until Wolf changes the influence plan;
- when influence is being held, the automation prefers modest workloads and low-INF reward choices rather than assuming Economy/Security can move with zero influence effect.

Current workload references reuse the Automation Rules Library's per-CMDR trade-profit and bounty guidance. Lowering Economy/Security is recorded as an objective but remains advisory until validated negative-slider recipes are encoded.

Security can be marked **Locked / not actionable** for cases such as factions whose Security slider cannot be meaningfully manipulated. Automatic government/ethos detection is not assumed until the ingestion layer has reliable government data.

The Programmed Automation preview displays this slider layer alongside influence strategy. It remains preview-only and does not publish Daily Orders.

## Automation architecture

Three visibly separated layers:

1. **Programmed BGS Logic — authoritative automation**
   - Explicit configurable rules and workloads.
   - Must expose where amounts such as bounty targets come from.
   - Expected levers include mission INF, bounty vouchers, trade profit, exploration data, conflict work and deliberate negative work.
   - Whole-board faction intent determines which faction should receive support/suppression when needed.
   - Economy/Security objectives are evaluated separately from influence and are constrained by the faction's influence guardrail.
   - Explanation panel should show rule fired, base amount, modifiers, final task, priority and stop condition.

2. **Advanced Intelligence Suggestion — advisory**
   - Historical calibration, anomaly detection and AI suggestions.
   - Never silently replaces programmed logic.
   - Wolf may apply or ignore suggestions.

3. **Wolf Override — ultimate authority**
   - Approve/edit/reject generated work.
   - Create custom order amounts/logic.
   - Force include/exclude/hold systems and tasks.

The current Programmed Automation card gives a **preview-only** deterministic explanation from the target band, saved faction intent, and Economy/Security objectives. It does **not** publish Daily Orders yet.

## Planned Control Room sections beyond the current shell

Planned additions include:
- full Order Preview / Generator with “Why did automation do this?” explanation;
- separate Advanced Intelligence Suggestions;
- ranked Daily Orders Queue;
- current-cycle Reporting Dashboard;
- recent ~14-cycle history;
- Tick & Data Monitor;
- Exceptions / Overrides summary;
- command-level Health / Attention summary;
- “What changed since last cycle?” change digest;
- optional graphical Economy/Security screenshot interpretation after enough examples exist to calibrate the visual positions safely.

## Daily Orders direction

Daily Orders should become a live priority queue rather than static prose.

Sorting groups:
1. systems with unmet active orders;
2. systems whose orders are met;
3. systems with zero orders for the cycle.

Within groups, emergency/operational priority can supersede long-term strategic priority. 10-16 can remain the highest normal strategic priority while still dropping below systems with actual work when it has no orders.

When an order target is met, the system should visibly mark **ORDERS MET** and move below every system with unmet work while staying above systems with no orders.

Maximum initial Daily Orders systems: 6. They are operational priorities, not necessarily the six standing strategic-priority systems. Emergencies such as unwanted Retreat can displace normal priorities.

## Member reporting direction

Reporting UI should be generated from structured order data so members see only relevant controls.

Example:
- Order: 15–20M trade profit for Mongrels in 10-16.
- Member sees an amount field and quick +/- buttons appropriate to that order, then Submit.
- Identity comes from authenticated session; no Commander-name field.

Reports should retain individual commander contributions, not just a mutable squad total. This supports accountability and future empirical calibration/diminishing-return research.

Daily Orders should show live squad progress and stop guidance. Previous-cycle totals should be available in an expandable read-only snapshot at the bottom of the member section, including Commander names.

Wolf Control should provide easy access to at least the last 14 operational cycles while retaining underlying history longer for analysis.

## Tick/cycle direction

Do not assume one authoritative galaxy-wide tick resets every system simultaneously.

- EDCD TickDetector (`tick.edcd.io`) can be treated as a global informational signal, not a per-system authoritative boundary.
- Each system inherits the global default tick unless Wolf sets a custom time.
- Scheduled tick creates the next operational cycle.
- Data freshness is tracked independently from cycle timing.
- Status may be CURRENT / PRE-TICK / STALE as cycle logic is implemented.
- Rollover policies: Strict, Safety Only, Carry Forward.
- Manual confirmation/override can be added later.

A system with data older than its configured threshold should normally issue no automated orders. Safety exceptions may be configurable for Retreat/conflict/emergency situations.

## Future history/calibration model

Operational cycles should eventually connect:
- starting board snapshot;
- Daily Orders issued;
- individual Commander reports;
- whether task targets were met;
- ending/following-tick board snapshot;
- resulting influence/state/conflict changes.

This history is intended to build a Mongrel-specific empirical calibration layer without pretending to reverse-engineer Frontier's hidden BGS formula.
