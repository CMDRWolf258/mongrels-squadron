# Wolf BGS Control — Architecture Context

_Last updated: 2026-09-18_

Read `PROJECT_CONTEXT.md` first. Repository code is authoritative if this file, memory, old chats, or screenshots disagree.

## Purpose and authority

Wolf BGS Control is a site-admin-only command deck for CMDR Wolf258. It is intentionally separate from member-facing Mission Control.

Core model:

> Programmed logic handles monitoring, prioritization, balancing and clerical reasoning; Advanced Intelligence may suggest changes; Wolf remains the final authority; members receive simple structured Daily Orders only after Wolf explicitly queues and publishes reviewed live-system previews.

Live-system previews can now be explicitly added to a **Publish Queue** and published by Wolf. Nothing auto-publishes, and Mandalore is hard-blocked from the queue.

## Primary files

- `/wolf-bgs/index.html`
- `css/wolf-bgs.css`
- `css/wolf-bgs-rules.css`
- `css/wolf-bgs-sliders.css`
- `css/wolf-bgs-order-preview.css`
- `css/wolf-bgs-conflicts.css`
- `css/wolf-bgs-publish.css`
- `css/wolf-bgs-lab.css`
- `css/wolf-bgs-screenshot.css`
- `js/wolf-bgs-inheritance.js`
- `js/wolf-bgs.js`
- `js/wolf-bgs-rules.js`
- `js/wolf-bgs-sliders.js`
- `js/wolf-bgs-order-preview.js`
- `js/wolf-bgs-conflicts.js`
- `js/wolf-bgs-contribution-options.js`
- `js/wolf-bgs-publish.js`
- `js/wolf-bgs-lab.js`
- `js/wolf-bgs-screenshot.js`
- `functions/api/operations/wolf-bgs.js`
- `functions/api/operations/wolf-bgs-write.js`
- `functions/api/operations/wolf-bgs-rules.js`
- `functions/api/operations/wolf-bgs-sliders.js`
- `functions/api/operations/wolf-bgs-economy-rules.js`
- `functions/api/operations/wolf-bgs-conflicts.js`
- `functions/api/operations/wolf-bgs-screenshot.js`
- `scripts/enrich_bgs_boards.py`
- `data/live-bgs-boards.json`
- `scripts/smoke-wolf-bgs.mjs`
- `scripts/smoke-wolf-bgs-contribution-options.mjs`
- `scripts/smoke-wolf-bgs-screenshot.mjs`

All private APIs require `session.access === 'site_admin'`; hiding UI is never treated as authorization.

## Storage

All current BGS Control state uses the existing `DAILY_ORDERS` KV binding.

- Core Control Room key: `wolf-bgs-control-v1`
- Automation Rules / faction strategy / balancing calibration: `wolf-bgs-rules-v1`
- Economy/Security objectives: `wolf-bgs-slider-objectives-v1`
- Economy bucket / exploration workload doctrine: `wolf-bgs-economy-rules-v1`
- Explicit live-system conflict pairing/objective config: `wolf-bgs-conflicts-v1`

The **Mandalore BGS Lab is intentionally not stored in `DAILY_ORDERS`**. Its synthetic board/strategy/slider/calibration values and conflict pairing live only in browser `localStorage`, so the test system cannot become part of the live Mongrel footprint or Daily Orders.

Core system settings use sparse overrides. Blank/default-valued per-system fields inherit current System Defaults dynamically instead of storing copied defaults.

`Reset to Defaults` removes the system-configuration override layer but preserves favorites, notes, manual faction/status snapshots, faction strategy, Economy/Security objectives, balancing calibration, conflict setup, and reporting/history data.

## Full faction-board ingestion

`data/live-bgs.json` remains the authoritative Mongrel-presence discovery feed.

Complete faction boards are enriched separately into `data/live-bgs-boards.json` by `scripts/enrich_bgs_boards.py` using EliteHub Vault / EDDN. The board snapshot retains faction name, influence, active/current state, pending state, recovering state and source update time.

Keeping full boards separate is deliberate: a temporary board-enrichment failure must not wipe out Mongrel-presence discovery. The two-hour updater retains prior good board data where possible and uses safe pacing/retry behavior for EliteHub rate limits.

Manual snapshots remain a fallback and are timestamped. The newest complete trusted snapshot wins; the UI must never pretend a Mongrel-only fallback row is a complete faction board.

The current board source does **not** expose a reliable conflict-opponent identifier. Conflict pairing therefore uses conflict type plus influence geometry conservatively and falls back to manual confirmation whenever more than one pairing remains plausible.

## System list and target UX

- 20 systems/page by default.
- Default sort: Mongrel influence high → low.
- Search, quick views, custom filters, Favorites-first and Lowest-five watch.
- `Reset Filters` clears view state only; it never clears saved Favorites or system data.
- Faction board rows sort influence high → low, name alphabetical for ties.
- Collapsed cards show a subtle target-band marker; expanded Strategy shows a fuller 0–100% influence target bar.
- Global Automation Defaults and System Defaults are separate concepts.
- Tablet/iPad layout must keep native form controls inside their grid columns.

## Whole-board faction intent

Automation is deliberately not Mongrel-only. Every faction can be given an intent.

Current terms:

- **Flexible / available** — automation may use the faction when strategically safe. This replaces the ambiguous old `No action` meaning.
- **Avoid interaction** — do not intentionally support or suppress this faction.
- **Support / raise** — positive work is desired until any configured ceiling/goal is satisfied.
- **Suppress / lower** — the faction should lose relative influence. The current safe automation method is positive redistribution to another eligible faction; automatic direct negative work is disabled.
- **Maintain / hold** — this is an actual stability objective, not “whatever”.
- **Protect from Retreat** — prioritize support when Retreat risk is relevant.
- **Allow Retreat** — avoid positive work that would rescue the faction unless Wolf changes the objective.

Non-Mongrel factions may also have target min/max and a control objective: none / prefer control / avoid control / allow either.

For Mongrels, System Strategy remains the authoritative target band so the site does not create duplicate sources of truth.

## Economy and Security objectives

Economy and Security are first-class faction objectives, separate from influence intent.

- Economy: Ignore / Raise / Hold / Lower.
- Security: Ignore / Raise / Hold / Lower / Locked / not actionable.

The important doctrine is **balance, do not automatically block**:

- Being near an influence ceiling does not by itself stop desired Economy/Security work.
- Positive slider work may proceed while the Order Preview generates compensating support for eligible other factions.
- `Avoid interaction` remains a real blocking conflict.
- `Allow Retreat` also blocks positive slider work unless explicitly changed.
- `Maintain / hold` or `Suppress / lower` can coexist with positive slider work only if counter-support is generated.
- Security `Locked / not actionable` never generates Security work.
- Economy/Security `Hold` produces no deliberate large slider workload unless a higher-priority objective requires one.
- Economy/Security `Lower` does not automatically generate hostile/negative work; the preview warns that manual planning is required.

### Economy action selection

Economy Raise is a decision tree, not a synonym for trade:

1. If the faction already needs positive mission INF for an influence objective, prefer **economic missions** so one workload serves Influence + Economy.
2. If there is no aligned positive mission-INF task, **profitable trade** is the primary measurable Economy workload.
3. High/Critical priority may add trade even when economic mission-INF is already present, because stronger Economy pressure is intentional.
4. When diversification is enabled and more than one operator is preferred, add an exploration-data bucket at the configured urgency tier.
5. Exploration is supplementary; it does not receive an invented INF conversion and does not replace the calibrated trade counterweight formula.

### Exploration workload doctrine

Exploration data is intentionally smaller than trade because acquiring fresh valuable scans becomes progressively less convenient as nearby bodies are exhausted.

Default per-CMDR tiers:

- **Routine:** 2M Cr exploration data.
- **Strong:** 5M Cr exploration data.
- **Emergency ceiling:** 10M Cr exploration data.

Normal/Low systems use Routine; High uses Strong; Critical may use the Emergency ceiling. Normal automation never exceeds the configured 5M Strong tier unless the system is Critical. Exobiology is not treated as this BGS bucket.

Exploration and trade remain asset-dependent actions. Automated asset ownership/service discovery is deliberately deferred. The preview therefore marks a manual asset check: trade should use an appropriate market owned by the target faction, and exploration data should be sold at a target-faction-owned asset with Universal Cartographics.

### Security action selection

Bounty vouchers remain the primary measurable Security Raise workload. If the faction already has mission-INF work, the preview prefers security/combat-aligned mission choices where practical so one task can serve both objectives.

## Influence / control-push contribution variety

`js/wolf-bgs-contribution-options.js` post-processes the deterministic preview to give members useful **activity choice** when a faction is intentionally being raised. Mission INF remains the primary, calibrated influence workload; alternate buckets are not blindly added as if their effects were perfectly additive.

Trigger conditions:

- the faction is below its configured target floor; or
- the faction has `Support / raise` intent and is still below its ceiling;
- active War / Civil War / Election participants are excluded and remain governed by conflict logic.

Control intent can come from either:

- faction-level `Prefer control`; or
- the Mongrel system policy `Gain Mongrel control`.

When the desired faction is not the current controller, the preview compares its influence to the controller:

- a **comfortable influence raise** keeps secondary contribution routes optional;
- a **control push** is considered strong when the controller gap is at least about 3 percentage points or the system is High/Critical priority;
- an **urgent control push** is the Critical case or roughly a 7-point-or-larger controller gap.

Contribution doctrine:

- **Mission INF** remains the primary target and existing same-faction INF requirements still use the max-not-sum rule.
- **Profitable trade** is offered even when Economy is not explicitly set to Raise. It is optional during a comfortable raise and recommended during a strong control push. Use a target-faction-owned market and useful supply/demand; keep the trade profitable.
- **Exploration data** is offered as another route using the configured 2M / 5M / 10M urgency tiers. Routine raises keep it optional; urgent control pushes can recommend it as an additional bucket. Sell at a target-faction-owned asset with Universal Cartographics.
- **Bounty vouchers** may be offered as an optional combat route only when Security is `Ignore` or `Raise`; do not present this alternate when Security is intended to Hold/Lower or when conflict logic applies.
- **Mining is not generated as an alternate contribution card.** It was removed from the current contribution layer so published/reportable work stays focused on the established mission-INF, trade, exploration, bounty, and conflict routes.

The purpose of these alternate routes is not to maximize the number of mandatory tasks. It is to let members contribute through game loops they enjoy while preserving a clear distinction between **primary required work**, **recommended extra pressure**, and **optional alternate contribution**.

## Automation Rules Library and CMDR workload doctrine

The rules layer is operational doctrine, not a claim to know Frontier's hidden formula.

Current workload controls include:

- normal mission INF per participating CMDR;
- stretch mission INF per participating CMDR;
- bounty MCr per CMDR;
- trade-profit MCr per CMDR;
- exploration routine / strong / emergency MCr per CMDR;
- preferred participating CMDR count;
- diversification preference;
- solo-CMDR guard against multiplying one pilot's workload to replace missing operators.

Operational doctrine:

- several CMDRs doing moderate useful work is preferred to one CMDR grinding far beyond a useful range;
- exact independent per-CMDR soft-cap behavior is treated as unconfirmed;
- mission `INF` always means mission influence reward pips/ticks, never faction percentage points;
- direct negative work is disabled in programmed automation until Wolf explicitly approves validated recipes.

Safety controls include Retreat warning/emergency and Expansion early warning.

## Influence-balancing calibration

The first global Security balancing baseline is intentionally explicit and editable:

> **20M bounty vouchers → 15 mission INF of counter-support**

This is a chosen operational starting recipe, not a Frontier conversion formula.

Rules also store:

- bounty baseline workload MCr;
- bounty counterweight INF;
- trade baseline workload MCr;
- trade counterweight INF (initially uncalibrated / null rather than invented);
- balance-trigger headroom in percentage points;
- maximum counterweight factions (1 or 2).

Each system can store independent calibration adjustments for both bounty/Security and trade/Economy balancing:

- percentage adjustment;
- flat INF adjustment.

Formula concept:

1. Scale global counterweight by requested workload / baseline workload.
2. Apply system percentage adjustment.
3. Apply system flat-INF adjustment.
4. Clamp final mission INF to zero or higher.

Example: global 20M → 15 INF, Diaba `-10 INF` flat adjustment produces a 5-INF starting counterweight for a 20M bounty order. A `-66.7%` adjustment can express approximately the same calibration proportionally and scale with larger workloads.

Calibration is stored separately from ordinary System Settings because it represents learned system behavior and should survive `Reset to Defaults`. It has its own Reset Calibration action.

## Whole-board counterweight selection

When positive slider work needs balancing, the Order Preview searches the rest of the board rather than automatically stopping the primary objective.

Candidate logic currently:

- exclude the source faction;
- exclude `Avoid interaction`, `Suppress / lower`, and `Allow Retreat` candidates;
- exclude active War / Civil War / Election candidates from normal counter-support because conflict participants are not treated as ordinary influence recipients;
- exclude candidates at/above their configured ceiling;
- without a configured ceiling, avoid candidates at/above the Expansion early-warning threshold;
- `Maintain / hold` candidates are only eligible when they are below their own target floor;
- avoid using an `Avoid control` candidate when it is already close to a controller crossover;
- rank Retreat rescue and explicit Support needs above Flexible candidates;
- Flexible / available remains a legitimate fallback counterweight when it has safe headroom.

The engine prefers one counterweight faction. It may split across two when the top candidate is itself very close to its configured ceiling. This split is a conservative operational heuristic, not a claim to predict exact percentage movement from mission INF.

Counterweight remains calibrated in mission INF. If the selected counterweight faction also has Economy Raise, the mission task prefers economic missions; if it has Security Raise, it prefers security/combat-aligned missions. This lets one mission workload help two configured goals without inventing a trade/exploration/bounty-to-INF formula.

If Security and Economy create overlapping counterweight requirements for the same recipient, the engine keeps the **higher** mission-INF requirement instead of adding them blindly. This deliberately avoids assuming the side effects are perfectly additive.

If no safe counterweight exists, the preview raises a warning rather than inventing a recipient.

## Conflict logic v1

Conflict handling now has its own configuration/pairing layer in `js/wolf-bgs-conflicts.js` and `wolf-bgs-conflicts-v1`.

### Participant lock

Any faction whose **active** state contains War, Civil War, or Election is treated as an active conflict participant.

- Active participants remain excluded from ordinary counterweight selection by the base Order Preview.
- The conflict layer additionally removes ordinary generated mission/trade/bounty/exploration work that references an active participant.
- Normal balancing math sourced from an active participant is removed from the rendered preview.
- This participant lock applies even when opponent pairing is unresolved. Safety does not depend on successful pairing.
- Pending conflict states are displayed for awareness but are not treated as active participant locks yet.

### Pair resolver

The live faction-board source does not currently identify opponents, so pairing is intentionally conservative:

- exactly **two** active factions of the same conflict type → auto-pair because the opponent relationship is unambiguous;
- two War factions plus two Election factions → each two-faction type group resolves independently;
- when **four or six factions share the same conflict type**, the resolver tests influence pairings using a **±3 percentage-point tolerance**;
- a multi-pair same-type group auto-resolves only when exactly **one complete pairing** satisfies that tolerance;
- if zero complete pairings fit, or more than one pairing fits, the resolver refuses to guess and requires manual confirmation;
- manual pairing is allowed outside the ±3-point auto-pair tolerance, but the UI warns about the larger influence gap so the exception is explicit;
- one unmatched active participant → unresolved warning;
- explicit saved pairings are validated against current active state/type;
- a faction cannot be assigned to two conflict pairs;
- up to three simultaneous pairs are supported because a seven-faction board can contain at most three disjoint two-faction conflicts.

This allows realistic rare same-type multi-conflict boards to pair automatically when influence geometry clearly identifies the opponents while preserving a hard manual fallback for ambiguous four-way cases.

### Conflict objective and generated work

Each resolved pair can be set to:

- **Monitor / no winner** — participant lock remains, but no winner-specific task is generated;
- **Win for faction A**;
- **Win for faction B**.

For War/Civil War winner objectives, the preview generates Conflict Zone + Combat Bond guidance for the selected winner. **Exact CZ-win workload per CMDR is intentionally not yet quantified**; Mandalore is intended to calibrate that operational target before it becomes publishable doctrine.

For Election winner objectives, the preview uses the existing normal mission-INF workload as an operational target and directs non-combat/economic mission work for the intended winner, with trade/exploration as supplementary options where useful.

Conflict-specific tasks are injected into the preview after the ordinary deterministic plan is rendered. A reviewed live-system conflict task can enter the Publish Queue; current live Conflict Logic v1 may still publish a CZ reporter without a quantified target until Conflict v2 doctrine is promoted from Mandalore.

Future conflict work still needed:

- conflict day/score tracking;
- validated per-CMDR CZ workload targets and stretch thresholds;
- explicit post-conflict asset-transfer handling;
- pending-conflict pre-stage doctrine;
- historical calibration from issued conflict work → following conflict score/tick.

## Order Preview / Generator

Each expanded system can mount a dedicated **Order Preview / Generator** below the faction/slider/conflict configuration.

It is deterministic and reads current on-screen values, including unsaved edits, so Wolf can test scenarios before committing configuration. The preview itself does not publish on generation; Wolf must explicitly add a live-system preview to the Publish Queue and then confirm a whole Daily Orders publish.

The preview can produce:

- Mongrel support when below target floor;
- positive work for explicitly supported non-Mongrel factions;
- contribution-variety alternatives for deliberate influence raises, including optional/recommended trade, exploration, bounty work, and mining missions where safe;
- explicit control-push escalation when a preferred-control faction is behind the current controller;
- positive-redistribution work to suppress/lower a faction without automatic hostile actions;
- Retreat rescue workloads;
- redistribution/counter-support when Mongrels or another maintained faction is above target;
- Security work via bounty-voucher workload plus mission-type preference where useful;
- Economy work via aligned economic mission INF, profitable trade and exploration diversification;
- balancing mission INF for eligible counterweight factions;
- conflict participant locking plus winner-specific War/Civil War/Election tasks when a pair/objective is resolved;
- manual asset-verification notes for trade/exploration;
- stop/review conditions;
- safety/candidate explanations;
- visible balancing arithmetic.

Overlapping mission-INF needs for the same faction are merged using the higher required workload rather than blindly summed. Example: if a faction already needs 25 INF for its own Support objective and the Security counterweight calculation asks for 15 INF, the preview keeps a 25-INF task because that work also satisfies the smaller counterweight need.

The preview remains a review surface. Live systems with **Allow into Daily Orders** enabled and at least one generated task receive an **Add to Publish Queue** control. Queued previews are snapshots; if the live preview changes afterward the control becomes **Refresh Queued Preview** so stale queued work is visible before publication.


## Daily Orders publish bridge

`js/wolf-bgs-publish.js` connects reviewed Wolf BGS Control output to member-facing Mission Control without creating a second order store.

Workflow:

1. Generate/review a live-system Order Preview.
2. The generator, conflict layer and contribution-options layer expose structured task metadata on each rendered task: kind, faction, amount, optional/recommended state and conflict type where relevant.
3. Wolf presses **Add to Publish Queue** on the systems intended for the next cycle.
4. The queue shows system/task/warning counts and enforces the configured maximum Daily Order systems plus the current 24-order API ceiling.
5. **Publish Daily Orders** requires an explicit confirmation and writes one complete replacement order set through the existing authenticated `/api/operations/orders` endpoint.
6. The publish intentionally omits the old `cycleId`, so the server creates a **new reporting cycle**. Existing historical report records remain stored, but members start at zero progress for the new set.
7. Mission Control receives explicit `faction`, `kind`, `source:"wolf-bgs"` and reporting metadata rather than relying on text inference.

Safety boundaries:

- Nothing auto-publishes merely because settings change or a preview regenerates.
- `Allow into Daily Orders` must be enabled for a live system to enter the queue.
- Mandalore / `data-bgs-lab="true"` is excluded from the publisher regardless of its generated preview.
- Preview warnings do not silently block Wolf's authority, but the final confirmation states how many warnings remain.
- Failed publish requests leave the previous member Daily Orders set in place.
- Officer/Site Admin manual Daily Orders editing remains available and preserves structured BGS metadata and the current cycle when editing an already-published set.

## Mandalore BGS Lab

A dedicated synthetic system named **Mandalore** sits at the bottom of Wolf BGS Control.

Purpose:

- test target bands, influence geometry, faction intent, Economy/Security objectives, balancing calibration and conflict behavior without touching a real system;
- compare how different control settings change the generated preview;
- deliberately create malformed/ambiguous boards to test safety behavior.

Isolation rules:

- Mandalore is not present in `data/live-bgs.json` or `data/live-bgs-boards.json`;
- it is not part of the live system list, presence count, ranking, Lowest-five watch, favorites, or Daily Orders eligibility;
- lab data auto-saves only in local browser storage;
- generated faction-strategy, slider and calibration Save actions are intercepted so they do not write Mandalore into production KV settings;
- Conflict Configuration recognizes the lab marker and stores pairing locally rather than through the live conflict API;
- switching built-in lab scenarios clears prior lab conflict pairing so stale manual choices cannot make a scenario appear to auto-resolve;
- System Status influence values, System Strategy values, and normal Faction Strategy controls remain editable without the lab hydration layer snapping them back;
- the System Status board displays a live total and tells Wolf exactly how much influence to add or remove to reach 100%;
- screenshot import is suppressed inside the lab.

Built-in scenario presets:

- **Balanced Board** — ordinary seven-faction baseline;
- **Slider Pressure** — Mongrels near the configured ceiling for Economy/Security balancing tests;
- **Two Conflicts** — one War pair plus one Election pair, allowing automatic independent pairing;
- **4-Way Auto Pair** — four War factions arranged as two unique influence-compatible pairs inside the ±3-point tolerance;
- **4-Way Ambiguous** — four War factions at matching influence, deliberately creating multiple valid pairings and forcing manual confirmation.

## Screenshot import

Screenshot Import is review-first and does not make an image authoritative by itself.

Current workflow supports a **set of up to three screenshots**:

- repeated Ctrl+V / paste adds another screenshot;
- repeated drag/drop adds another screenshot;
- multi-file picker is optional;
- thumbnails can be removed individually;
- all selected screenshots are interpreted together as one system observation;
- overlapping faction rows are merged;
- conflicting repeated readings are flagged instead of guessed;
- partial sets cannot be applied until all known board factions are covered and combined influence is approximately 100%;
- Apply only populates matched influence form fields;
- Wolf must still press `Submit Status` to create the authoritative manual snapshot.

This supports the old ship-status-panel workflow where multiple screenshots are required and the newer Squadron faction screen where one screenshot may contain the full board.

Graphical Economy/Security slider estimation is intentionally deferred until enough real screenshots exist to calibrate that feature safely.

## Automation authority layers

1. **Programmed BGS Logic — authoritative automation**
   - explicit rules, objectives, target bands, balancing and workload calculations;
   - every workload should be explainable;
   - no hidden AI changes.

2. **Advanced Intelligence Suggestion — advisory**
   - historical calibration, anomaly detection and suggested parameter changes;
   - may propose, never silently replace programmed rules.

3. **Wolf Override — final authority**
   - approve/edit/reject generated work;
   - force include/exclude systems/tasks;
   - create custom workloads or exceptions.


## Member Daily Orders reporting — first implementation

Mission Control now has the structured member-reporting layer fed by the explicit Wolf BGS publish bridge.

Member Daily Orders are grouped by **system** into compact expandable cards. Inside each system, every published order is rendered as one unified task/report console. The layout uses a compact briefing strip across the top and a full-width report area directly underneath, eliminating side-column dead space. The briefing makes the target faction and workload the dominant information (the full "Regiment of Imperial Mongrels" is displayed operationally as **MONGRELS**) followed by one short execution-only instruction. Wolf-level Stop / Review thresholds and other strategy math are intentionally omitted from Mission Control and remain in Wolf BGS Control. System copy lives in the system header, redundant ACTIVE badges are removed, and collapsed system headers now use their center space for a concise FOCUS / SUPPORT summary derived from required published tasks. High-priority systems render an explicit **HIGH PRIORITY** badge rather than a tiny metadata tag, with order count beside it. Every system header uses the shared accordion affordance **VIEW ORDERS ▾** when closed and **HIDE ORDERS ▴** when open; the entire row gains hover/focus feedback so current and future system cards clearly read as expandable controls. INF reporting uses wide minus/count/plus controls with larger touch targets; desktop uses four reward controls across one row and narrower layouts shift to two columns. The report-entry area clusters controls on the left and isolates a draft-total/Submit panel on the right. A subtle Reset action clears the current unsubmitted INF or credit draft to zero. Credit workloads use a compact value + `M Cr` field beside quick-adjust buttons instead of stretching the amount field across the full card. Empty report-status space is collapsed so taller controls do not materially increase the normal card footprint. Generic "Published from Wolf BGS Control" leadership notes are hidden for the current cycle and no longer written by future Wolf BGS publishes; custom leadership notes remain available. Mission Control briefing typography now uses a softer differentiated palette without changing layout dimensions: faction names use muted cyan, workload amounts use warm ivory, execution copy uses blue-gray, report headings use pale cyan/steel, and tiny metadata is subdued so the page is easier on the eyes and the hierarchy is more distinct.

Current report types:
- **Mission INF:** +2 / +3 / +4 / +5 reward counters; the member taps the reward received while turning missions in and may correct the draft with minus controls before Submit.
- **Bounty vouchers:** report M Cr actually redeemed for the ordered faction.
- **Profitable trade:** report M Cr of qualifying **profit**, not gross cargo sale value.
- **Exploration data:** report M Cr of Universal Cartographics sale value delivered to the ordered faction's appropriate asset.
- Credit-based reporters share a compact direct-entry + quick-adjust UI (−5M / −1M / +1M / +5M / +10M) so the member can report exact-ish totals without excessive tapping.
- **War/Civil War CZ work:** Low / Medium / High victory counters; failed/abandoned and full-instance-disconnect results are available in a normally collapsed failure section; Combat Bonds use a simple redeemed toggle.
- **Wing rule:** one shared CZ instance is one BGS result. Only one wing member reports that instance. A wingmate dropping/leaving is not a failure if at least one Mongrel remains and the shared CZ is won.
- **Net progress:** successful CZs add their point weight; failed/abandoned or full-instance-disconnected CZs subtract the same starting difficulty weight. Current starting weights are Low 1.0, Medium 1.3, High 1.6. These are Mongrel operational weights, not claimed Frontier formulas.
- **Blitz:** its configured benchmark is displayed but reaching it does not close the order; the member view remains OPEN / continue pushing.

The current private order document carries a `cycleId` and optional normalized reporting metadata. Reporting now stores **individual submissions** in `DAILY_ORDERS` under the active cycle instead of folding every submission into one ever-growing CMDR/order record. Squad and personal totals are recomputed from those submissions. Members can expand **MY SUBMITTED REPORTS** under an order, load one of their own reports back into the same controls, **Save Changes**, or delete it; totals recalculate immediately. Older aggregate records remain readable as a combined prior total and can still be corrected/deleted. Wolf BGS Control now includes a **CURRENT CYCLE REPORTS** manager that lists every CMDR's reports and allows officer/site-admin edit or delete across the active cycle, including exact INF reward counts, credit values, and detailed CZ fields.

## Live Daily Orders reconciliation / per-system republish concept (pre-implementation)

_Added 2026-09-19. This is agreed product doctrine to preserve before the publisher/reporting redesign._

Daily Orders should be **revisable by system throughout the day** as better BGS data arrives. A publish is not a frozen all-day snapshot and fresh data for one system must not reset unrelated systems.

### Fresh-data flow

- When a newer trusted snapshot arrives for a live system (Scout, EliteHub/EDDN, or an authoritative manual update), BGS Control should immediately re-evaluate that system and generate a fresh deterministic Order Preview.
- If the system has its **Queue Selector** enabled, the refreshed preview should automatically replace that system's older queued candidate rather than creating a duplicate.
- Wolf still retains final publishing authority. Fresh data may update the queue automatically, but Mission Control changes only when Wolf explicitly publishes.
- Wolf should be able to publish at any time of day and push the newest reviewed plan for the affected system without replacing/resetting unrelated Daily Orders.

### Per-system replacement semantics

Publishing an updated system should reconcile that system's currently published tasks against the newly generated task set:

- **Unchanged logical task** → keep the existing task/report identity and all submitted progress.
- **Same logical task, target increased** → preserve progress and update only the goal. Example: an existing 20-INF task with 12 INF reported becomes a 30-INF task with **12 / 30** progress.
- **Same logical task, target decreased** → preserve progress and lower the goal. If existing progress already meets/exceeds the new target, the task is immediately shown as met/complete.
- **Task no longer required by fresh data** → remove it from the member's current actionable orders. Existing reports remain attached to that task's original reporting history/cycle; they are not moved to another task.
- **New task introduced** → add it without disturbing progress on the system's surviving tasks or on any other system.
- **Fundamentally changed task** (different faction/objective/work type rather than merely a changed amount) → treat it as a new logical order rather than carrying old progress into unrelated work.

The reconciliation key should be based on stable logical identity (at minimum system + faction + task kind + relevant objective/conflict identity), not rendered text or list position.

### Reporting identity and revisions

The current global full-replacement/new-`cycleId` publish model is not sufficient for this design and will need to be replaced.

Future reporting should distinguish:
- the **logical order identity** whose progress can survive revisions;
- the **published revision/version** of that order;
- the **originating reporting cycle/BGS-day context** for historical attribution.

Updating the target of the same logical order must not zero member progress or manufacture a new unrelated reporting bucket.

Removing/replacing an order must never reassign historical submissions to the newer order. Reports remain tied to the order/cycle in which the work was actually issued, including late reports submitted after an order has expired.

### Interaction with tick transitions

Fresh post-tick data may cause major plan changes:
- an INF task may disappear because the new influence result no longer requires it;
- a surviving task may receive a larger/smaller target;
- a conflict/tie task may close or change side/pressure;
- new work may appear.

The member-facing Daily Orders page should therefore always reflect the **latest published revision**, while preserving valid progress on surviving logical tasks. Tick/order-expiry rules still determine whether an older task is actionable or reporting-only while Wolf has not yet published the newly generated post-tick plan.

### Intended operator experience

The desired workflow is:

> **Fresh system data arrives → BGS Control immediately regenerates that system → Queue-Selected system's queued preview is replaced → Wolf reviews when convenient → Publish updates only that system's Daily Orders → unchanged tasks retain progress; obsolete tasks disappear; changed goals retain existing progress.**

This makes Mission Control a continuously refinable operational board rather than a once-per-day static document, while preserving Wolf's explicit publish authority.


## Publish Queue change-review / diff concept (pre-implementation)

_Added 2026-09-19. This extends the live per-system reconciliation doctrine. The Publish Queue should become a review surface for changed operational plans, not merely a list of system names._

### Change annunciator

- BGS Control should have a highly visible **Order Changes / Queue Changes annunciator** modeled on the existing Faction Alert behavior.
- A materially changed queued plan caused by fresh trusted data should light and flash the annunciator until Wolf acknowledges/reviews the change.
- This alert is separate from Faction Alerts: it means **the proposed Daily Orders changed**, not merely that a faction state changed.
- The annunciator should show a compact count of systems and/or tasks with unreviewed changes.
- Acknowledging the annunciator should only mark the changes reviewed; it must not publish them and must not remove queue entries.

### Queue rows need order summaries

Each queued system should show more than the system name. The collapsed row should include a compact summary of the orders currently held inside it, for example:
- faction / task kind / target;
- optional status such as High Priority, conflict pressure, or timer/cutoff when relevant;
- current published progress where useful for understanding the effect of a target change.

The goal is for Wolf to understand the proposed plan without opening every system.

### Diff states

When fresh data changes a queued system, compare the newly generated plan with both:
1. the previously queued/reviewed candidate; and
2. the currently published Mission Control orders for that system.

Use clear task-level change labels:
- **NEW** — task will be added.
- **CHANGED** — same logical task survives but its target/instructions changed.
- **UNCHANGED** — task remains logically the same; progress will be preserved.
- **REMOVE** — currently published task is no longer generated and will be removed if this update is published.
- **REPLACED** — an old logical task is being removed and a fundamentally different one added; do not carry progress between them.

Changed tasks should be visually emphasized. Unchanged tasks should remain visible but subdued so the actual delta is obvious.

### Before → after presentation

For numerical changes, show the important delta directly rather than requiring Wolf to compare two cards manually.

Examples:
- **INF target: 20 → 30** · current progress **12 / 20 → 12 / 30**
- **CZ pressure: Contested 6 → Heavy 15**
- **Bounty target: 20M → 30M**
- **REMOVE: 15 INF for Faction X** · fresh board no longer requires influence support

The queue should explicitly communicate that surviving logical tasks retain their submitted progress.

### Removals must be impossible to miss

Publishing can remove work that members are currently seeing, so removals need their own strong review treatment.

- A queued system with one or more removals should carry a visible **REMOVES ORDERS** warning/badge.
- The expanded queue row must list every task that will disappear from current Daily Orders.
- Immediately before Publish, the confirmation/review summary should include counts such as **2 added · 1 changed · 1 removed · 3 unchanged**.
- Wolf should be able to inspect the removed task and its existing progress before publishing.
- Removing a task from current Daily Orders must preserve its historical reports/original cycle; it only stops being part of the latest actionable published plan.

### Fresh-data replacement in Queue Selector systems

- When a Queue-Selected system receives fresh trusted data, BGS Control should regenerate it immediately and replace its older auto-queued candidate in place.
- The queue row should then show a **FRESH DATA — PLAN CHANGED** indication and the task-level diff.
- If the fresh data produces no material change, the queue should not create a false alert merely because the source timestamp changed.
- A material change means the operational result changed: task added/removed/replaced, target amount changed, objective/faction/work type changed, conflict pressure changed, cutoff materially changed, or another member-facing instruction changed.

### Review state

Each queued revision should carry a simple review state:
- **NEW / UNREVIEWED CHANGE** — flashes/feeds the annunciator.
- **REVIEWED** — Wolf has inspected/acknowledged the current revision.
- If newer data changes the plan again after review, it returns to **UNREVIEWED CHANGE**.

Publishing remains an explicit Wolf action. Review/acknowledgement never auto-publishes.

### Intended operator view

A useful collapsed queue row should feel approximately like:

> **NGC 2546 Sector UZ-G d10-16** · **PLAN CHANGED**
> 30 INF for Consortium **20 → 30** · 12 reported
> ~~20M Bounties for Mongrels~~ **REMOVE**
> + 6 CZ pts for Perez **NEW**

The exact visual design can change, but the queue must make the delta understandable in a few seconds and must clearly preview anything publication will remove.


## Member Rewards / credit ledger concept (pre-implementation)

_Added 2026-09-20. Brainstorming baseline for a future squad reward system. Values and exact UI are not locked yet._

### Core model

Create a reward ledger that tracks **credits the squad owes a member**, rather than pretending the website itself transfers in-game credits.

Each reward transaction should preserve:
- member / CMDR identity;
- credit amount;
- reason / source activity;
- source task/order/job ID where applicable;
- earned timestamp;
- reward status;
- payout/settlement timestamp and officer who marked it paid;
- enough provenance to prevent the same qualifying event from being rewarded twice.

Suggested lifecycle:
**Available job → claimed/assigned → verified completion → reward earned/owed → paid in game → settled/history.**

### Member view

Members should have a compact **Rewards / Credits Owed** area showing:
- total currently owed;
- each unpaid reward and why it was earned;
- recent paid rewards/history;
- available reward jobs they may claim, when applicable.

The language should make clear that the displayed balance is an **in-game payout ledger**, not stored website currency.

### Public / squad visibility

A squad-facing reward activity area can show who earned what and why, for example:
**CMDR Example · 5M CR · Scouted Miwae · Earned today**.

Exact privacy/detail controls can be decided later, but the concept is to make useful contributions visible and rewards transparent.

### Wolf / officer payout console

Wolf needs an administrative payout view that answers:
- who is currently owed credits;
- total owed per member;
- why each amount is owed;
- which individual reward entries make up the balance;
- what has already been paid;
- ability to mark one reward or a member's selected rewards **PAID** after transferring credits in game.

Marking paid settles the ledger entry; it must not erase its history.

### Automated reward rules

Rewards should usually be created automatically from **verified system events**, not merely from a member pressing a claim/report button.

A reward rule needs at least:
- qualifying action/event;
- reward amount;
- repeat policy/cooldown;
- verification source;
- eligibility/assignment rules;
- stable deduplication key.

Automation should be idempotent: processing the same Scout observation, order report, or completion event twice must not issue two rewards.

### Example: one-time Scout bounty

Wolf posts:
**Scout NGC 2546 Sector X — 5M CR**

Flow:
1. Member claims/selects the Scout job.
2. The job becomes assigned according to its assignment policy.
3. Mongrel Scout receives a qualifying fresh observation for that system attributable to that member/token.
4. Backend verifies that the observation satisfies the job's freshness/completion requirements.
5. The job completes and a **5M CR owed** ledger entry is created automatically.
6. That job instance cannot reward again.
7. Wolf later transfers the credits in game and marks the ledger entry paid.

A member clicking **claimed** is not itself proof of completion.

### Repeatable Scout jobs

A Scout reward can optionally be recurring, for example **5M once every 24 hours**.

- Completion opens the next eligible window only after the configured cooldown.
- The 24-hour period should be anchored to a verified rewarded completion (or another deliberately chosen schedule), not to repeated page visits/claims.
- Each eligible completion gets a unique reward-instance key so retries/duplicate observations cannot pay twice.
- The UI should show when the job becomes eligible again.
- We should later decide whether recurring jobs are open to any eligible member each window or remain assigned to one member until released.

### Attribution requirement for Scout rewards

Current Mongrel Scout observations intentionally do not send a commander name. Reward automation therefore needs a privacy-conscious attribution mechanism.

Preferred concept: associate the **Scout token ID** server-side with the member who owns it. The observation/reward engine can attribute qualifying scouting to that authenticated token/member without adding CMDR identity to the ordinary public BGS observation payload or exposing it in system data.

This requires care for shared tokens/devices and should be designed before Scout rewards go live.

### Rewarding Daily Orders

Daily Orders can also feed rewards, but the system should avoid incentives that encourage spammy low-value reports.

Potential model:
- reward **verified contribution units** reported against an active order;
- apply per-order/per-cycle caps or milestone thresholds;
- tie the reward to the same logical order/cycle identity used by Mission Control reporting;
- preserve reward attribution when an order target is revised;
- work reported after an order expires can only qualify if it was legitimately completed before cutoff under the expired-order reporting rules;
- removed/replaced orders retain any reward already earned from valid historical work.

Examples worth testing later:
- fixed completion bounty for satisfying a claimed special order;
- milestone reward after X verified INF contribution;
- CZ contribution reward based on accepted CZ points;
- daily participation reward with a cap rather than paying indefinitely per report;
- officer-created bonus/bounty for unusual one-off work.

Exact rates should remain configurable rather than hard-coded.

### Daily Orders verification philosophy

Daily Orders rewards should be deliberately **low-friction and capped**. Members are already spending their play time doing squad work; the reward system should not routinely require them to stop, collect screenshots/video, upload evidence, and wait for Wolf to audit it.

There is no assumption that the next day's BGS board can prove an individual member performed a specific action. Board movement is useful corroborating context, but many players/actions can contribute to the same result and hidden BGS mechanics prevent clean individual attribution.

Preferred evidence hierarchy:
1. **Machine-verifiable telemetry** when available — for example Scout observations attributable server-side to a member token, or future EDMC/journal-derived events that can be safely and narrowly verified.
2. **System-recorded Mission Control reports** for ordinary Daily Orders, subject to configured per-member/per-order/per-cycle reward caps.
3. **Aggregate plausibility checks** from the following BGS board as anomaly detection/context, not automatic proof or rejection of one member's report.
4. **Manual evidence** such as screenshots/video only for exceptional high-value rewards, disputes, unusual achievements, or suspicious cases — not normal daily participation.

The default should therefore be **trust with bounded exposure**, not full forensic verification. A false ordinary report can only earn up to the configured cap, keeping the incentive for abuse small while avoiding a burdensome audit process for legitimate members.

Potential safeguards to test:
- per-member reward cap per Daily Orders cycle/day;
- per-task reward ceiling even when the published workload later increases;
- minimum meaningful contribution threshold before any reward is earned;
- diminishing or milestone-based rewards instead of unlimited pay-per-unit;
- no duplicate reward for editing/resubmitting the same contribution;
- report timestamps/order eligibility enforced server-side;
- anomaly flagging when reports are grossly inconsistent with plausible aggregate outcomes, without automatically accusing or withholding normal rewards;
- officer review only above a configurable high-value threshold.

Future EDMC/Scout integration may allow more Daily Orders actions to become machine-verifiable from journal events. Any such expansion should remain narrowly scoped to useful verification data and preserve the existing privacy-first Scout philosophy.

### Journal telemetry investigation for reward verification

Research against Frontier's Player Journal documentation shows that the existing EDMC/Scout path could verify substantially more Daily Orders work without screenshots, provided members explicitly opt into the additional narrow telemetry.

High-value journal events:
- **MissionCompleted** — strongest source for mission INF verification. It includes MissionID, issuing faction and `FactionEffects`; influence effects include the affected `SystemAddress` and a plus-indicator value such as `++++`. This potentially allows exact automated attribution of mission-INF units to the intended faction/system and deduplication by MissionID.
- **MissionAccepted / MissionFailed / MissionAbandoned** — useful supporting lifecycle events. Accepted includes faction, MissionID, expected Influence tier, destination/target information and mission type; completion remains the preferred reward trigger.
- **Bounty** — records each awarded kill bounty, paying faction(s), victim faction, total reward and whether credit was shared. Useful for activity evidence, but BGS orders currently measure bounty vouchers claimed, so **RedeemVoucher** is the stronger completion event.
- **RedeemVoucher** — records redemption of Bounty/CombatBond vouchers, net amount and faction information. This is promising for automatically verifying bounty-credit and combat-bond Daily Orders.
- **FactionKillBond** — records CZ participation rewards with awarding faction, victim faction and reward. Useful for confirming the member fought for the intended side, but it does not by itself encode the current Mission Control Low/Medium/High CZ-win result.
- **MarketSell** — records commodity, quantity, sale price, total sale and average purchase price plus MarketID. Combined with current station/system context, it can verify trade delivery and calculate transaction profit. It does not directly state BGS influence produced by the sale.
- **SellExplorationData** — records systems sold, discovered bodies, base value, bonus and total earnings. Combined with the station/system context at sale, it can verify exploration-data turn-ins and value, though it does not directly state BGS influence.
- **MiningRefined** — records each unit of mined commodity refined. Combined with MarketSell, this can distinguish mined cargo from ordinary trade in many reward scenarios, though provenance/accounting rules would need care.
- **CargoDepot** — provides MissionID and delivery progress for wing cargo missions, useful as supporting evidence; MissionCompleted is still the clean completion/reward trigger.
- **Location / FSDJump** — already useful for Scout. They include SystemAddress, local faction/state/conflict information and can establish system context for nearby journal events.

Important limitation: journal telemetry can prove that a documented game event occurred, but not every event directly proves its hidden BGS effect. Reward rules should verify the **observable action we ordered** (for example, 20M bounty vouchers redeemed for the intended faction, or +4 mission INF from FactionEffects) rather than claim to measure Frontier's hidden influence calculation.

### Recommended verification tiers from journal research

**Excellent candidates for automatic rewards**
- Mission INF from `MissionCompleted.FactionEffects[].Influence[]`, keyed by MissionID + affected SystemAddress/faction.
- Bounty voucher credits from `RedeemVoucher`, with faction and amount.
- Combat-bond redemption from `RedeemVoucher(Type=CombatBond)`.
- Scout freshness from the existing Location/FSDJump/CarrierJump snapshot path.
- Specific trade-delivery/value goals from `MarketSell` when station/system context is known.

**Useful but needs supporting logic**
- Exploration-data value sold at an intended station/system.
- Mined-commodity sales using `MiningRefined` plus cargo/sale correlation.
- CZ participation/side from `FactionKillBond`.
- Wing cargo progress from `CargoDepot`.

**Not automatically solved by the journal alone**
- A reliable Low/Medium/High **CZ victory** count matching the site's current weighted CZ reporting model. FactionKillBond proves participation/kills, not necessarily the final CZ victory/intensity.
- Exact hidden BGS impact of ordinary trade, exploration or bounty activity.
- Attribution of a next-day influence change to one individual player.

### Privacy-first implementation direction

Do not turn Mongrel Scout into a general raw-journal uploader. If reward verification is implemented, the EDMC plugin should locally filter journal events and transmit only a small normalized **verification event** needed by enabled squad features, for example:
`memberToken + eventType + eventId/MissionID + timestamp + SystemAddress + faction + quantity/value`.

Raw journal lines, commander travel history, credits/balance, ship/loadout and unrelated gameplay should remain excluded unless a future feature has a separately justified need. Member documentation should clearly state which reward-verification events are sent and why.

### Anti-abuse / accounting safeguards

- Server-side reward issuance only; client UI never decides that credits were earned.
- Stable event/job/order identifiers for deduplication.
- One-time jobs can settle only once.
- Recurring jobs enforce their cooldown/window server-side.
- Manual officer adjustments should create auditable ledger entries rather than silently editing balances.
- Negative/correction entries should be possible if an award must be reversed while retaining history.
- Payment status is separate from earned status: earning creates a debt; Wolf marking paid settles it.
- If multiple members legitimately contribute to one job, the rule must explicitly say whether the reward is first-completion, shared, per-member, or manually allocated.

### Likely relationship to existing systems

This should integrate with:
- **Mongrel Scout** for verified scouting completion;
- **Daily Orders / Mission Control reports** for BGS contribution rewards;
- **order/cycle identity** so revisions do not duplicate or lose rewards;
- **member authentication / Discord identity** for ownership;
- a future **Reward Jobs** panel for claimable assignments;
- an officer **Payout Console** for settlement.

The reward ledger should be its own durable subsystem. Daily Orders, Scout, and special jobs generate reward events into it; they should not each maintain separate balances.


## Next product stages

The next major stages after validating the Mandalore lab and conflict-pair behavior are:

- conflict score/day tracking and CZ workload calibration;
- ranked Daily Orders queue;
- richer ranked queue/review controls beyond the first explicit live-system publish bridge;
- change Wolf BGS Daily Orders publishing from full replacement to **append/merge behavior by default**: publishing System B/C after System A should leave A in Mission Control unless Wolf explicitly removes/replaces it; a deliberate "start new cycle / replace all" action should remain separate;
- richer member activity/history views and admin report correction tools;
- current-cycle reporting dashboard;
- ~14-cycle operator/history view;
- Tick & Data Monitor;
- exceptions/override summary;
- change digest;
- historical calibration suggestions using starting board → issued orders → CMDR reports → following board.

Daily Orders should eventually rank unmet work above met work, and met work above systems with no current orders. Emergency operational priority may temporarily outrank long-term strategic priority.

History is intended to build Mongrel-specific empirical calibration without pretending to reverse-engineer Frontier's hidden formula.

Mission Control visual hierarchy note: workload titles/amounts (for example `25 INF` and `20M Cr Bounties`) use a soft periwinkle treatment with no glow, deliberately separating the workload from faction cyan, action cyan, muted body text, and amber priority states.


## Queue Selector and Faction Alerts

Wolf BGS Control now separates broad monitoring from routine queue authorization.

- **Every Mongrel system remains monitored.**
- Each live system card has a compact **Q Queue Selector** beside the Favorite star. Queue Selector state is stored per system and is not a System Default.
- The System List shows one global **QUEUE SELECTORS · N systems** counter instead of repeating the count on every card. Clicking it filters the list to selected systems.
- Selected systems are treated as operational systems and are kept on the first operational page so their lazy cards can be evaluated without requiring Wolf to hunt across pagination.
- Turning a Queue Selector on immediately causes that system to be evaluated. If the deterministic Order Preview has actionable work, the system is auto-added to the Publish Queue.
- Turning a Queue Selector off removes routine work that was auto-queued because of the selector. A manually queued snapshot is preserved.
- Pending **Retreat** is the emergency exception: Retreat work may auto-queue even when the Queue Selector is off. Retreat never transitions into an active Retreat state; when pending Retreat clears, that alert episode is resolved.
- Auto-queued entries are visibly sourced as **AUTO · QUEUE SELECTOR** or **AUTO · RETREAT**; explicit Wolf additions are **MANUAL**.
- Removing an auto-queued candidate suppresses that exact current preview so it is not immediately re-added. A materially changed preview may queue again. Publishing also suppresses the just-published preview so selected systems do not instantly refill the queue with the same work.
- Existing hard limits remain: more than the configured system limit (currently 6 by default) or more than 24 tasks disables Publish rather than silently choosing which systems to discard.
- Final **Publish Daily Orders** remains explicit Wolf authority. The existing full-replacement/new-cycle publishing behavior is still unchanged and the planned append/merge publishing redesign remains future work.

Because the Control Room lazily parks collapsed system bodies for iPad/DOM health, the publisher now performs hidden sequential hydration of Queue-Selected and pending-Retreat cards, waits for the deterministic preview, queues actionable work, then collapses the card again. This keeps automation compatible with the two-card warm cache without visibly expanding every selected system.

A **Faction Alerts** panel near the top of BGS Control records newly detected major Mongrel state episodes:
- pending Retreat;
- War / Civil War / Election conflict changes;
- Bust;
- Civil Unrest.

Alerts are episode-based rather than repeating permanent state badges. The Faction Alerts box now has a large 3D red **FACTION ALERT** master annunciator styled like a flight-deck warning button:
- a newly detected visible alert lights the annunciator and makes it flash red;
- pressing **ACKNOWLEDGE** marks all currently visible new alert episodes reviewed and extinguishes the warning light;
- acknowledgement does **not** remove any alert row;
- acknowledged rows remain available as quick reference and are visibly marked ACKNOWLEDGED;
- the annunciator remains extinguished until another genuinely new alert episode is detected;
- reduced-motion clients receive the same lit warning state without animation.

Alert-row actions are deliberately separate:
- **VIEW** is navigation only. It does not acknowledge or remove the alert. It opens the broader board-level filter for that alert family;
- conflict VIEW shows **all Mongrel pending and active War / Civil War / Election systems**;
- Bust and Civil Unrest VIEW show pending + active systems in that state family;
- Retreat VIEW shows pending Retreat systems;
- **REMOVE** dismisses only that alert row from the Faction Alerts box. A removed episode stays suppressed while that same underlying episode remains active; once it resolves, a future separate episode may alert normally again.

Conflict Pending → Active is one continuous episode. If the pending conflict was acknowledged with the master alert button, activation the next tick does **not** create another alert. If it was not acknowledged, the same alert remains new and updates to active. An active conflict that appears without a previously tracked pending episode is treated as a new alert. When a conflict ends, the episode resolves so a future separate conflict can alert again.


## System-card freshness and live conflict score

The collapsed live-system header now separates operational status from source freshness.

- The far-right status pill is **operational only**: Normal, Conflict, Retreat risk, or Retreat pending. A conflict no longer hides the condition of the source data.
- **Freshness** has its own dedicated header column and always shows Fresh / Stale / Unknown plus the age of the active snapshot.
- **Conflict Score** has its own header column. Active Mongrel War / Civil War / Election systems show the current daily-win score from the Mongrels' point of view, e.g. `1–0`; systems without an active Mongrel conflict show `—`.
- The expanded system topline also shows a compact Conflict score chip with the opponent name, and the Conflict Configuration detection summary repeats the score for detailed review.
- The score is not inferred from influence or locally invented. `scripts/enrich_bgs_boards.py` now ingests EliteHub Vault `factionConflicts` records, including `factionWonDays`, `opponentWonDays`, opponent, type/status/stakes, and update time.
- Conflict ingestion queries both cases where the Mongrels are stored as the primary faction and where they are stored as the opponent, then normalizes the score so the left number is always the Mongrel score.
- Conflict-score refresh is independent enough that a retained full-board snapshot can still receive a fresher conflict score. If the conflict query itself fails, the previous score is retained and marked last-known/stale instead of silently becoming a fabricated zero.
- The regular two-hour BGS refresh workflow now populates the conflict records. A successful live refresh verified real examples including Baldur at Mongrels 1–0 vs Baldur for Equality and Col 285 Sector VT-R d4-124 at Mongrels 0–1 vs Sacra Oculus in the captured Sep 19, 2026 snapshot.


## Conflict timeline and score-age tracking

BGS Control now tracks conflict day separately from conflict score and labels the provenance of the day estimate.

Authoritative operational assumptions:
- a Mongrel War / Civil War / Election observed as **Pending** is expected to become active on the **next configured BGS tick**;
- once active, a conflict is assumed to last a **minimum of 4 days and a maximum of 7 days**;
- the configured per-system tick override is used when present; otherwise the Global Automation Default tick is used;
- tick-time arithmetic is performed against the configured daily tick in UTC, matching the existing BGS tick scheduling model.

Conflict episode tracking:
- when Pending is first observed, the episode stores `pendingSeenAt` and an `expectedActiveAt` equal to the next configured tick;
- when the same episode becomes active, it remains the same alert/episode and records the first active observation;
- an episode with a Pending start can therefore show **DAY N · INFERRED** and advance automatically each configured tick;
- if the site first discovers the conflict already active and never observed its Pending start, **Conflict Day remains UNKNOWN** rather than reverse-engineering a false exact day from the score;
- an inferred/manual timeline that advances beyond Day 7 is shown as **DAY 7+ · VERIFY** instead of silently declaring the conflict resolved;
- the timeline explains whether it is before the Day-4 minimum resolution window or inside the Day 4–7 resolution window.

Manual verification:
- Conflict Configuration now contains a **Manual current day** selector for Day 1–7;
- setting a day from an in-game faction-panel check creates a manual anchor and is treated as the authoritative current day;
- that manual day then advances automatically on subsequent configured ticks;
- **USE AUTOMATION** clears the manual anchor and returns to the observed Pending-derived timeline when one exists, otherwise Day returns to UNKNOWN;
- conflict-day overrides are cleared when that conflict episode resolves or is replaced by a genuinely new conflict episode.

Score presentation:
- conflict score remains actual source data only; no score is invented from the inferred day;
- the Mongrel score is always the left-hand number;
- the card header shows the score plus compact conflict-day and source-age context;
- expanded system chips show Conflict Day and Conflict Score separately;
- Conflict Configuration repeats the day, score, opponent, and source age;
- score age is calculated from the EliteHub conflict record's own `updatedAt` timestamp rather than from the website fetch time.


## Mongrel Scout direct EDMC uplink

Wolf BGS Control now supports a first-party **Mongrel Scout** EDMarketConnector plugin so trusted CMDRs can refresh BGS data simply by flying through assigned systems.

### Scout workflow
- Wolf opens **Scout Network** in BGS Control and creates an individually named scout token.
- The raw token is displayed **once**. The server stores only its SHA-256 hash.
- The scout installs the one-file EDMC plugin from `/downloads/mongrel-scout/load.py`, pastes the token once in EDMC Settings, and leaves the plugin enabled.
- The plugin listens only to `FSDJump`, `Location`, and `CarrierJump` journal events that contain a full faction board.
- The plugin checks locally for **Regiment of Imperial Mongrels**. Non-Mongrel systems are discarded locally and never uploaded.
- When accepted, the Scout Network records the token label, last uplink time, last system, and journal-event time. Wolf can revoke one scout without affecting any other scout.
- While Wolf BGS Control is open, the Scout Network polls token activity every 30 seconds. A new scout uplink triggers a background refresh of the BGS deck so direct data appears without a page reload.

### Privacy boundary
The plugin deliberately does **not** transmit commander name, cargo, credits, ship/loadout, materials, missions, or general travel history. The direct payload contains only:
- system name/address, controller, security, population when the journal supplies them;
- faction names, influence, active/pending/recovering states, happiness;
- local conflicts: type/status, both factions, stakes, WonDays score;
- journal event timestamp.

The EDMC plugin follows the current Python 3 plugin interface (`plugin_start3`, `plugin_prefs`, `prefs_changed`, `journal_entry`), uses EDMC's supported `config` API, Live-galaxy check, `timeout_session` HTTP client, and a worker thread so network requests do not block EDMC.

### Direct-source precedence
Direct Scout snapshots are stored separately from the ordinary EliteHub/EDDN snapshot. BGS Control compares timestamps and:
- uses a newer direct Scout faction board as the trusted live board;
- keeps a newer manual Wolf snapshot authoritative over Scout/external data;
- can surface a Scout-only Mongrel system before the external presence feed has caught up;
- uses the Scout journal timestamp for freshness, not the website receive time;
- uses a newer direct journal conflict record for conflict score, always normalized with the Mongrels on the left;
- preserves a Scout-observed Pending conflict timestamp in the Scout KV history, so a later Active observation can still infer Day 1 even if Wolf BGS Control was not open during the pending phase;
- retains external-source timestamps separately so the UI can show exactly which source is newest.

System cards identify Scout-sourced data with dedicated Scout chips. Faction alerts, Queue Selector automation, Retreat handling, conflict score age, and conflict-day tracking all consume the same merged trusted snapshot, so fresh Scout observations can immediately affect the control logic.

### Security/storage
- Admin token management endpoint: `/api/operations/scout-tokens` (site-admin session + same-origin write protection).
- Scout ingest endpoint: `/api/operations/scout-ingest` (Bearer scout token; no Discord/site session required).
- Token KV key: `wolf-bgs-scout-tokens-v1`.
- Snapshot KV key: `wolf-bgs-scout-snapshots-v1`.
- Raw scout tokens are never persisted by the server.


## Mongrel Scout access-control hardening

Scout tokens now carry server-side access permissions. Changing those permissions does **not** require a new token.

- New tokens default to **Restricted Scout**.
- A Restricted Scout token must have at least one assigned system and is accepted only for those exact system names.
- **Trusted Scout** tokens may submit any system whose payload contains the Regiment of Imperial Mongrels.
- Wolf can switch Restricted ↔ Trusted or edit a Restricted Scout's assigned systems at any time through **Scout Network → EDIT ACCESS**. The scout keeps the same token and does not need to change EDMC.
- Legacy Scout tokens that predate access scopes normalize to Trusted so an existing installation is not silently broken; Wolf can downgrade one through EDIT ACCESS.
- The ingest endpoint enforces scope server-side. A restricted token submitting an unassigned system receives `403 system_not_authorized`; the EDMC plugin shows **Not assigned: <system>**.
- Every token has a KV-backed fixed-window limit of **120 upload attempts per hour**. Attempts beyond the limit receive HTTP 429 plus `Retry-After`; EDMC shows **Scout rate limit reached**.
- The rate counter is stored separately from Scout snapshots/token metadata and expires after two hours.
- The threat boundary remains deliberate: a Scout credential cannot sign into Wolf BGS Control, alter automation settings, manage tokens, or publish Mission Control orders. Its meaningful write capability is Scout BGS observations within its allowed scope. A malicious holder can still falsify BGS observations for systems their token is permitted to submit, so Restricted access is the default for new/unproven members and revocation remains the emergency cutoff.

### Installation packaging
The site now serves **MongrelScout.zip** from `/downloads/mongrel-scout.zip`. It contains a ready-made `MongrelScout/` folder with `load.py` and the README, so the member can unzip it and copy the folder directly into EDMC's Plugins directory. The raw source files remain under `/downloads/mongrel-scout/` for maintenance.


## Tick timing / order-expiry concept (pre-implementation)

_Added 2026-09-19. These are agreed brainstorming/design points to preserve before implementation. They are not yet production behavior and should be refined with observed data._

### Core timing model

- Keep **19:00 UTC as the global reference baseline**, not as a claim that every system processes at exactly 19:00.
- Continue using a **per-system tick offset** from that baseline. The offset is intended to represent the system's own expected BGS processing time.
- Keep **system tick timing separate from data-propagation timing**. If a system is expected to process at 19:35 but EliteHub/another surface does not show the new board until much later, that later appearance time must not be learned as the system tick offset.
- Individual systems may drift. BGS Control should therefore reason about an **expected tick window**, not a single second-perfect timestamp.
- The width/position of that window should eventually be informed by actual observations for that system; some inaccuracy is accepted as unavoidable.

### Operational states around a tick

The working concept is to distinguish at least:

1. **Pre-tick** — the current day's order is still considered applicable.
2. **Tick window / transition** — the system may already have processed, but a fresh post-tick board/score is not yet confirmed.
3. **Post-tick confirmed** — a trustworthy fresh observation establishes the new BGS day and normal order generation can resume from the new state.

A system entering its tick window must not be treated as equivalent to simply having stale data. "We have not seen the new board yet" is different from "the old day's work is certainly still current."

### Order expiry should be risk-based

The **safety buffer belongs to the order/objective**, not necessarily to the whole system. Different work in the same system can have different overflow risk.

Working risk classes:

- **High-risk / precision work** — examples include Tie protection, deliberate control-transfer balancing, Retreat-floor protection, and other work where spillover into the next BGS day could immediately damage the objective. These orders should disappear at or before the **earliest plausible tick** rather than waiting for the average expected tick.
- **Medium-risk work** — examples include conflict-win work and influence balancing near a target boundary. These should receive a conservative pre-tick cutoff selected according to the objective's overshoot risk.
- **Low-risk / continuation-safe work** — broad support where modest spillover into the next day is unlikely to hurt the strategy may remain available into the transition period, potentially at reduced intensity, until fresh post-tick data arrives.

Exact buffer durations are intentionally **not locked yet**. They should be tuned from real system behavior rather than invented globally.

### Tie-specific safety

Tie work is especially sensitive to overflow.

- An equal conflict score such as **0–0, 1–1, 2–2, or 3–3 already satisfies the Tie objective**.
- Once tied, there is no strategic benefit to squeezing in extra conflict work before the tick.
- Tie-related orders should therefore expire **earlier than the expected tick**, using the conservative edge of that system's tick window, so work intended for the current day is less likely to spill into the next day and accidentally create a new lead such as 2–2 becoming 2–3.
- After the cutoff, the member view should clearly say that precision conflict work is closed pending the next confirmed score rather than continuing to display an obsolete task.

### Member availability during the transition window

A post-tick transition must not automatically become a galaxy-wide "do nothing" period.

- Members may only be available during a narrow play window that overlaps the period after a likely tick but before fresh board propagation.
- If the current objective is safe to continue without knowing the exact post-tick result, BGS Control may eventually present **SAFE CONTINUATION** work.
- If the objective is precision-sensitive and a fresh result is required before more work can be considered safe, BGS Control should explicitly show **HOLD / AWAIT FRESH RESULT** instead of leaving yesterday's order active.
- This decision should be made per objective/system rather than by a single global dead period.

### Member-facing tick clocks and task timers

Daily Orders should give Mongrels situational awareness about both the system tick and each task's safe working window.

Working presentation concept:

- Each system represented in Daily Orders may show an **estimated system tick** in both **UTC** and the member's **local browser time**.
- The member's local time should come from the browser/device timezone rather than from stored profile/location data, because members may travel and the conversion needs to remain accurate automatically.
- The system header can show a compact countdown such as **Estimated tick in 1h 42m**, but it should also make uncertainty visible when appropriate (for example, **tick window begins in 28m** rather than implying second-perfect precision).
- Individual tasks may have a separate **order cutoff timer**. This timer counts down to when that specific work should stop, which may be earlier than the estimated system tick.
- A precision-sensitive task should therefore be able to show both:
  - **Estimated system tick:** e.g. 19:35 UTC / 3:35 PM local
  - **Stop this task in:** e.g. 52m
- Low-risk / continuation-safe tasks do **not** need a countdown merely for decoration. They may instead show no timer, or a quiet status such as **Safe through transition** when that is strategically valid.
- High-risk tasks such as Tie protection should make the cutoff visually prominent. When the timer expires, the task must stop looking actionable, but it may remain visible **for reporting only**.
- The expired member-facing card should use extremely short, unmistakable language such as **EXPIRED — NO MORE WORK** plus one compact line: **Report only work completed before the cutoff.**
- The work instruction itself should be visually de-emphasized after expiration so members do not mistake the card for a current task.
- The reporting controls may remain available during the allowed late-reporting window. Submitting after expiration is permitted only for work that was actually completed before the cutoff; the UI should make that condition explicit without requiring a long explanation.
- A late report should remain tied to the **same original order / cycleId** that issued the task. It must never roll into, count toward, or be silently reassigned to a newer BGS cycle.
- Once the allowed late-reporting window closes, the expired task can leave the normal member view and remain available only through history/admin reporting views.
- The **system** may also show a compact non-actionable **TRANSITION / RESULTS PENDING** state so members understand why no new task is currently available.
- Medium-risk tasks can use their own configured safety buffer.
- The countdown must be based on the task's calculated cutoff, not simply on the system's average tick time.
- When the tick window is reached without a fresh post-tick board, the system-level display should shift into a visible **TRANSITION / RESULTS PENDING** state rather than pretending the old timer/order is still authoritative.
- A fresh post-tick confirmation resets the system clock context for the new BGS day and allows newly calculated orders/timers to replace the expired ones.

The purpose of these clocks is operational awareness, not a claim that Frontier's tick is exact. Member-facing wording should therefore communicate **estimated tick / tick window / task cutoff** clearly instead of presenting a false exact deadline.

### Expired-order reporting semantics

The expiration cutoff separates **work eligibility** from **report eligibility**.

- At cutoff, the member must stop performing the task for that BGS day.
- Reporting can remain open after cutoff so delayed submissions are not lost.
- The report belongs to the order's original `cycleId` / order identity even if a newer Daily Orders cycle has already been published.
- Late-report acceptance does **not** reopen the task or extend its work window.
- Member-facing wording should stay compact and imperative: **EXPIRED — NO MORE WORK** / **Report only work completed before cutoff.**
- Future implementation should decide the default late-reporting duration and whether officers can manually reopen/extend reporting without reopening the work order itself.

### Data and detection principles

- The operational question is **"Has this system's BGS day probably closed?"**, not merely "Has an external API refreshed?"
- A later source update time must not automatically move the learned tick offset later.
- Fresh Scout/EliteHub/other observations may help confirm the post-tick state, but the exact signals that safely prove a system has processed still need validation before implementation.
- Stale or missing data must never be interpreted as evidence that opposition stopped, that a tie held, or that a new BGS day definitely did or did not occur.
- Existing per-system offsets and future observed tick history should be used to improve confidence/window estimates over time rather than pretending tick timing is perfectly deterministic.

### Implementation intent

The likely future flow is:

> **19:00 reference → per-system offset → learned drift/tick window → objective-specific order cutoff → transition behavior (safe continuation or hold) → fresh post-tick confirmation → new Daily Orders**

This section is deliberately preserved as **concept/doctrine only** so the design is not lost while conflict work is paused. Before implementation, validate the exact tick-detection signals, decide initial safety-buffer defaults, and define how the member-facing Mission Control labels each transition state.
