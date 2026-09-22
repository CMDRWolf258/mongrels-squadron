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

### Agreed Daily Orders reward defaults — 2026-09-20

Reward accounting is **member + logical order + Daily Orders cycle scoped**. The squad's operational target and the member's personal reward cap are separate concepts.

Critical rule:
- **Reaching the squad order goal never closes reward eligibility by itself.**
- Each member may continue performing qualifying verified work against that same order until that member reaches the order's personal reward cap.
- Reward caps are independent for each published logical order. Work credited to Order A never consumes Order B's cap, even when both orders use the same activity type or are in the same system.
- Example: two separate bounty orders with 20M operational goals each use the default 30M personal cap each, so one member can earn up to **60M Cr total** across the two orders.
- Order revisions that preserve the logical order identity also preserve the member's already-earned reward/progress and cap consumption.

Default rules:

**Profitable trade**
- Verification unit: qualifying realized **profit**, never gross sale revenue.
- Reward-eligible trade must be traceable to commodities **purchased from a normal NPC station/settlement market**. Mined commodities do not qualify because mined sales do not create ordinary trade BGS influence/economy effect.
- Commodities **bought from a Fleet Carrier market do not qualify** for the normal trade reward path. Carrier-market repricing must never manufacture rewardable profit.
- Direct **transfer** of station-bought cargo into/out of a Fleet Carrier hold is allowed: storage/transport does not by itself break provenance because the original normal-station purchase remains the source.
- If Scout cannot prove purchase provenance, the sale remains visible as wallet profit but is excluded from automatic Daily Order matching/reward preview until provenance can be established.
- Each complete **10M Cr profit block** earns **10M Cr reward**.
- Partial blocks do not create a partial reward by default. Example: 19.9M verified profit = one 10M block; 20M = two blocks.
- Personal cap: **30M Cr reward per order**.
- Fleet Carrier market sales are not qualifying BGS trade and must not feed this reward path.

**Mission INF**
- Verification unit: actual affected-system/faction INF from `MissionCompleted.FactionEffects`.
- Each **1 INF** earns **1M Cr reward** through the order's operational INF goal.
- Verified personal INF beyond the order goal earns **0.5M Cr per INF**.
- Personal reward cap: **the larger of the order goal expressed in M Cr at the default 1M/INF rate, or 30M Cr**.
- Therefore a 20-INF order pays the first 20 INF at 1M/INF, then permits another 10M of reward at 0.5M/INF before the 30M cap is reached. A 40-INF order has a 40M cap; reaching 40 INF already reaches that cap.
- The post-goal reduced rate is personal reward accounting; it does not change Mission Control's squad progress total.

**Bounty vouchers**
- Verification unit: qualifying **redeemed** bounty vouchers, not kill-time bounty awards.
- Each **1M Cr redeemed** earns **1M Cr reward**.
- Personal reward cap: **the larger of the order's bounty goal or 30M Cr**.
- A 20M bounty order therefore remains reward-eligible after the squad reaches 20M; each member may earn up to 30M from that order.
- `Bounty` journal events are supporting evidence only. `RedeemVoucher` is the reward trigger.
- Fleet Carrier voucher redemption does not qualify for faction BGS reward credit.

**Manual/special rewards**
- Do not add manual-reward fields to every system card.
- Use one central **Reward Administration / Payout Console**.
- Manual entries must be additive ledger transactions, never direct balance edits.
- Required fields: authenticated member identity, positive or negative amount, reason, creating officer/site-admin and timestamp; optional related order/job/system reference.
- Corrections use negative ledger entries so the audit history remains intact.

Implementation baseline:
- `lib/reward-rules.js` owns normalized defaults and entitlement math.
- Reward defaults are stored separately in `DAILY_ORDERS` under `reward-settings-v1` and edited centrally in Wolf BGS Control.
- Automated issuance should calculate a member's **total entitlement for the order** from verified cumulative contribution, compare it to reward already issued for that member/order, and issue only the positive delta. This makes repeated Frontier syncs and parser retries idempotent.

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


## Integrated Daily Order identity + verified activity backbone

_Implemented 2026-09-20._

The first Automation → Orders → Scout → Rewards integration layer is now live in code.

### Stable logical order identity

- Daily Orders now carry a `logicalKey`, stable `id`, `revision`, `createdAt`, and `revisedAt`.
- Logical identity is derived from source + system + faction + activity/kind + semantic task wording, with numeric workload targets removed from the semantic key.
- A target revision such as 20 INF → 30 INF therefore remains the same logical order and keeps the same order ID.
- Materially different work becomes a new logical order.
- Manual Mission Control editing preferentially preserves an existing explicit order ID.

### Wolf publish reconciliation

- Wolf BGS Control publishing no longer needs to replace the entire Daily Orders set or start a fresh reporting cycle for routine updates.
- The publisher sends `publishMode: reconcile` plus the queued system list.
- Only queued systems are reconciled. Published orders for unrelated systems remain untouched.
- Within a reconciled system, surviving logical tasks preserve their ID/history, removed tasks stop being actionable, and new tasks receive new IDs.
- The current cycle ID and cycle start are preserved during reconciliation.
- The API rejects a reconciliation that would exceed the 24-order limit instead of silently dropping unrelated orders.

### Verified Frontier activity matcher

`lib/order-activity.js` now deterministically matches normalized Frontier Scout events to active Daily Orders using:
- reporting/activity type;
- system;
- faction;
- event timestamp versus order/cycle start.

Currently matched machine-verifiable activity:
- mission INF → affected system + affected faction from `MissionCompleted.FactionEffects`;
- redeemed bounty vouchers → system + per-faction `Factions[]` split;
- profitable trade → system + station-owning faction + verified realized profit;
- exploration sale → system + station-owning faction, with Fleet Carrier sales already excluded upstream.

One journal event is not blindly applied to every superficially similar order. If more than one active order is equally eligible for the same contribution component, the matcher marks it **ambiguous** instead of double-crediting it. Distinct faction portions of one voucher redemption may match distinct faction orders.

Frontier Scout status now returns `verifiedOrders` totals and annotates recent events with their current order matches. The Member Portal shows a **VERIFIED DAILY ORDER MATCHES** section when machine-verifiable work is attached to active published orders.

No reward credits are issued by this matcher yet. This layer intentionally stops at verified contribution attribution so matching can be observed and tested before the durable payout ledger begins creating squad debt.

## Read-only reward integration surfaces — 2026-09-20

Further integration was intentionally built without enabling automatic debt creation.

- Mission Control now fetches Frontier Scout status alongside order/report data and shows **SCOUT VERIFIED** contribution on the matching order when available.
- That strip also shows the configured **reward preview / personal cap** for eligible INF, bounty and trade orders. It remains explicitly preview-only.
- Manual Mission Control reports remain visible separately as **You reported**, preventing machine verification from being confused with self-reporting during the transition.
- The Member Portal now has a **Rewards & Credits Owed** card backed by `/api/rewards/status`. It shows real durable ledger debt/history; while issuance is disabled it correctly remains zero/empty.
- Wolf BGS Control now has a **Payout Console Preview** backed by `/api/rewards/admin`, showing total owed, total paid, and balances grouped by authenticated member. It is read-only.
- The payout ledger storage format is active, but no verified activity automatically appends entries yet.
- Manual adjustment and Mark Paid actions remain intentionally disabled until matching and ledger presentation are validated.

Trade verification was also tightened: only provenance-verified station-bought cargo can match a trade order. Mined cargo, Fleet Carrier market purchases and unknown purchase provenance remain visible as transaction history but do not feed automatic trade reward matching.

## Dynamic Frontier Scout scope + dated journal reconciliation — 2026-09-20\n\nFrontier Scout is no longer architecturally limited to 10-16.\n\n### Dynamic order-system scope\n\n- The active published Daily Orders document is now the source of Frontier verification scope.\n- Scout derives the unique set of active system-scoped order systems automatically; no member configuration is required.\n- If tomorrow's published orders cover Diaba, Miwae and 10-16, one Frontier sync checks those systems automatically.\n- When no system-scoped Daily Orders are active, Scout skips the Frontier journal request instead of querying CAPI unnecessarily.\n- The Member Portal now displays **Active order systems** and the sync action is named **Sync Order Activity** rather than the former 10-16 test wording.\n\n### Multi-system mission handling\n\n- Journal parsing pre-builds a SystemAddress → system-name map from the fetched journal plus addresses learned on earlier syncs.\n- `MissionCompleted.FactionEffects[].Influence[]` is matched by its affected `SystemAddress`, so one mission completion may safely contain effects for multiple ordered systems.\n- Each normalized mission effect now retains its own affected system. The order matcher uses that per-effect system rather than assuming the physical hand-in system.\n\n### Dated Frontier reconciliation\n\n- Frontier CAPI's dated `/journal/YYYY/MM/DD` endpoint is used for historical recovery.\n- A normal sync requests the current journal. When the active order cycle began on an earlier UTC date, Scout may additionally request **at most one unreconciled historical day per sync**.\n- Fully retrieved (`200`) or confirmed empty (`204`) historical dates are recorded on the Frontier account so subsequent syncs do not repeatedly request them.\n- Partial (`206`) historical dates are not marked complete and remain eligible for a later retry.\n- Historical lookback is intentionally bounded and incremental to avoid treating CAPI as a real-time/high-frequency service.\n- Yesterday + today may be parsed together so legitimate station-purchase provenance can cross midnight.\n- Older non-contiguous backfill days are parsed separately from today; trade provenance is never allowed to jump across an unseen intervening day. Missions, bounties and other independently verifiable events can still be recovered from those older dates.\n- A previously provenance-verified trade sale is not downgraded merely because a later current-day-only parse can no longer see its historical purchase.\n\n### Attribution boundary\n\n- Journal event timestamps remain the authority for when work occurred; sync/retrieval time does not move work into a different order cycle.\n- Current Scout matching remains read-only with respect to reward debt. Dynamic scope and historical recovery feed the existing verified-order/reward-preview layer but still do not append automatic Owed ledger entries.\n\n## Verification Review dry-run audit — 2026-09-20

Wolf BGS Control now has a read-only **Verification Review** layer before automatic reward debt is enabled.

- `/api/rewards/verification` is officer/site-admin only and lists Frontier-connected members through safe public account fields; encrypted Frontier tokens are never returned.
- The review joins Frontier Scout activity to the member's authenticated Discord user ID, the same identity used by Daily Order reports. Commander/display names are presentation only, not the join key.
- For each member + active logical order, the review shows Scout-verified contribution, the member's existing manual Mission Control total, the difference, and the configured reward preview/cap.
- Manual reports with no current Scout match are explicitly shown as **Manual-only** rather than silently discarded.
- Frontier verification components that are genuinely ambiguous or unmatched inside the current cycle are surfaced as review flags. Unsupported/no-component events are not inflated into false unmatched warnings.
- Summary counts show Frontier-connected CMDRs, verified member/order matches, ambiguous components and unmatched components.
- This remains entirely read-only. The review does not modify manual reports, verified activity, reward balances or payout ledger entries.

Activation principle remains: use this comparison surface to validate real-world matching first, then enable idempotent automatic Owed-entry creation only after discrepancies are understood.

## Publish Queue exact-order review — 2026-09-20

- Wolf BGS Control's Publish Queue now renders the actual frozen task snapshots stored in the queue, not only queued system names.
- Each queued system has **VIEW ORDERS / HIDE ORDERS** controls.
- Expanded review shows every queued order's activity type, faction, target, status, generated instruction and detailed briefing text.
- Preview warnings are shown inside the same expanded queued-system card.
- The review explicitly labels the content **QUEUED SNAPSHOT** because these are the exact task objects waiting behind Publish Daily Orders, not a newly regenerated preview.
- Removing a queued system still removes the entire system candidate; individual-order editing/removal inside the queue is not enabled yet.

## Publish Queue compact review refinement — 2026-09-20

- Expanded queued systems now show only one larger instruction line per queued order; metadata/detail duplication was removed from the queue.
- The queue header still carries system, queue source, task count, priority and warning count for quick scanning.
- The queued system name is now clickable. It focuses that exact system in the normal System Control Deck, opens its full card and scrolls to it, even if filters/pagination previously hid it.
- Full order rationale, faction-board context and warnings remain on the normal system card rather than being duplicated in Publish Queue.


## Faction Alert flash + Publish Queue interaction correction — 2026-09-20

- Conflict acknowledgement persists through pending → active for the same conflict episode. Becoming active does **not** create a second alert after Wolf already acknowledged it.
- The master Faction Alert's active state is intended to flash continuously until acknowledged. The CSS exception that could leave it bright red but non-flashing under `prefers-reduced-motion` was removed for this critical command warning.
- Publish Queue background synchronization no longer rewrites the queued-system DOM unless the actual queued snapshot changes.
- VIEW ORDERS / HIDE ORDERS continues to toggle only the existing row in place; routine board refreshes should no longer replace the button during a click.

## Publish Queue Mission Control change detection — 2026-09-20

- Publish Queue now compares each queued system's frozen task snapshot against the **currently published Mission Control Daily Orders** for that system.
- Comparison uses the same logical-order identity semantics as server reconciliation: stable logical tasks survive numeric target revisions; fundamentally different tasks are treated as new/replaced.
- Queue rows classify the pending result as **NEW**, **CHANGED**, **REPLACED**, **REMOVE**, or **UNCHANGED**.
- Numeric reporting-target revisions show a compact before → after delta in the expanded one-line order review.
- Systems with material differences are highlighted; removals/replacements carry **REMOVES ORDERS** treatment.
- Automation-driven queue replacement after fresh BGS data carries **FRESH DATA** when the queued plan materially changed.
- A dedicated amber **ORDER CHANGES** annunciator flashes for unreviewed material differences. Pure source/timestamp refreshes do not trigger it when the operational plan is unchanged.
- Acknowledging Order Changes marks the current change signatures reviewed but never publishes or modifies Mission Control.
- Review signatures are persisted server-side under authenticated site-admin control, so the same revision stays reviewed across reloads/devices. If the queued plan or published baseline changes materially, the signature changes and the alert re-arms.
- Publish confirmation now summarizes added, changed, replaced, removed and unchanged tasks versus Mission Control, and explicitly notes remaining unreviewed systems.
- The Mission Control comparison baseline refreshes on page load and again when returning to a stale tab, so changes made elsewhere do not leave the queue comparison indefinitely stale.

## Lazy-loaded reward admin panels — 2026-09-21

- Reward Administration, Verification Review, and Payout Console Preview no longer fetch/build their hidden data at initial BGS Control page load.
- Each panel expands first using native `<details>` behavior, then begins its data work after two animation frames so the browser can paint the open state immediately.
- Each panel loads once per page session; subsequent open/close actions do not refetch or rebuild the content.
- Rapid open/close before the delayed load begins cancels the unnecessary load.
- This change is performance-only and does not alter panel appearance or reward behavior.

## Verification Review freshness correction — 2026-09-21

- The first lazy-load implementation kept Verification Review cached for the entire page session, which could hide manual Daily Order reports submitted after the first validation load.
- Verification Review now uses a 5-second freshness window. Opening it remains instantaneous; stale validation data refreshes only after the panel paints open.
- Returning focus/visibility to BGS Control refreshes an already-open stale Verification Review.
- Manual report API shape was verified as compatible with the comparison join (`ownerId + orderId`, `score`); this correction is about UI freshness rather than report storage.

## Verification Review visual audit states — 2026-09-21

- Verification rows now have explicit visual states for pre-automation auditing:
  - **MISMATCH** — Scout verification and a manual report both exist but differ; row is strongly highlighted.
  - **MATCHED** — Scout verification and manual report agree within a small numeric tolerance.
  - **SCOUT ONLY** — verified Frontier evidence exists but no manual report exists; `Reported —` is shown instead of misleading zero.
  - **MANUAL ONLY** — a manual report exists with no current Scout match.
- Long verification text now wraps instead of truncating so the verified/reported/difference values are readable without hovering.
- This is presentation-only; it does not alter verification, manual report storage, or reward calculations.

## Testing-quality pass — 2026-09-21

- Verification Review now includes an explicit Refresh Verification button, Last Checked timestamp, current cycle context, active-order count, and compact MATCHED / MISMATCH / SCOUT ONLY / MANUAL ONLY totals.
- Mission Control report progress now updates from the mutation response instead of waiting on a follow-up KV read. The report API also explicitly merges the just-written report into POST/PATCH summaries and excludes a just-deleted report from DELETE summaries, avoiding Cloudflare KV propagation races.
- BGS Control collapsed system-card influence target meters now render before first expansion. Effective target min/max are carried on the always-mounted details element so lazy body parking no longer hides the target band from the header meter.
- Obsolete Publish Queue detail CSS for the old snapshot label/order-copy/warning-list view was removed.
- Frontier Scout diagnostic/privacy wording now refers to active Daily Order systems instead of the old 10-16/configured-single-system wording.
- Reward issuance remains disabled; all Verification Review changes are read-only testing/audit improvements.

## Colonization Jobs test framework — 2026-09-21

- Added a separate persistent Colonization Jobs layer, independent from Daily Orders and reward-ledger issuance.
- Job definition supports:
  - system-wide scope (any construction depot in one system),
  - specific-build scope via construction `MarketID`, with a manual display/build name,
  - optional commodity filter,
  - squad target tonnage,
  - reward block tonnage + reward M Cr per complete block,
  - optional personal reward cap,
  - active/completed lifecycle and creation/completion timestamps.
- BGS Control now has a lazy-loaded `Colonization Jobs · Test Console` where Site Admin can create jobs, view squad progress, inspect per-CMDR verified tonnage/reward preview, complete/delete jobs, refresh data, and reuse observed construction MarketIDs.
- Frontier journal parser now retains `ColonisationContribution` as normalized `colonization_contribution` evidence with system, MarketID, exact total tons, and per-commodity amounts.
- Active Colonization Job systems are added to Frontier journal verification scope even when no Daily Order targets that system.
- Frontier summaries now expose colonization tonnage/contribution counts; Member Scout UI shows `Colonization Delivered` and labels these events in recent activity.
- Colonization job matching is member + job + job verification window. Specific-build jobs additionally require exact MarketID; commodity-scoped jobs count only the named commodity from a multi-commodity contribution event.
- Reward math is preview-only: complete blocks = floor(verified tons / block tons); preview reward = blocks × reward per block, optionally capped by the job's personal cap.
- Squad target is an operational goal, not an automatic personal reward cap. Jobs do not auto-close when the squad target is reached.
- Completing a job freezes its verification window at completion time. Reopening is intentionally not exposed in the test UI yet because pause/reopen intervals need an explicit verification-window model before they can be made payout-safe.
- Automatic reward debt creation remains OFF. Colonization payouts are not connected to the ledger yet.
- Sample logic test passed: a 6,000 t MarketID-specific contribution against a 5,000 t / 100M block rule produced 1 completed block and 100M preview; a Titanium-only version correctly counted only 4,784 t from the same mixed-material contribution.

## Construction site auto-discovery — 2026-09-21

- Specific-build Colonization Jobs no longer expect Wolf to manually know a construction MarketID.
- Frontier parser now captures `ColonisationConstructionDepot` while docked in an active verification system, retaining:
  - system + station context,
  - MarketID,
  - construction progress / complete / failed flags,
  - per-commodity required/provided/payment values.
- Repeated depot events are deduplicated by system address + MarketID so the stored Frontier evidence keeps the latest observation instead of filling the event store every ~15 seconds.
- BGS Control `Observed Construction MarketIDs` now acts as a site picker: it presents station/build context and progress, while the internal MarketID is auto-filled into the specific-build job form via `Use This Site`.
- Intended workflow: put the system in Frontier verification scope, dock at the construction depot, Sync Activity, then choose the discovered site. A contribution is no longer required just to discover its MarketID.
- The specific-build form keeps the internal site ID read-only; users should not need to look up or type it manually.

## Specific-build no-ID workflow — 2026-09-21

- Specific-build Colonization Jobs may now be created without a MarketID. They render as **AWAITING SITE** and still add their system to Frontier verification scope.
- While unbound, a specific-build job cannot match colonization contribution tonnage, so no delivery preview can be falsely attributed before the site is identified.
- After the commander docks at the intended construction depot and Sync Activity captures `ColonisationConstructionDepot`, BGS Control lists the discovered site by station/system/progress.
- `Use This Site` automatically binds the site to the one pending active specific-build job in that system. If there are multiple pending jobs in the same system, it avoids guessing and instead pre-fills the new-job form for deliberate selection.
- MarketID remains internal/read-only in the form. The intended operator workflow no longer requires manual lookup of a MarketID.

## Colonization site-binding correction — 2026-09-21

- Active specific-build Colonization Jobs with a bound construction site now expose **Change Site** in BGS Control.
- Change Site clears only the internal MarketID binding and returns the job to **AWAITING SITE**. It preserves the job ID, title/build name, system, target, reward rules, start timestamp, and other configuration.
- While AWAITING SITE, the job matches no colonization contribution tonnage.
- Selecting the correct discovered site rebinds the existing job. Because reward issuance is still OFF, verification tonnage and reward preview are recalculated safely against the corrected MarketID.
- Completed jobs do not expose Change Site. Once real ledger issuance is enabled, any post-payment site correction should use an audited correction/version flow rather than silently rewriting paid history.

## Colony Architect Registry + claim tracking — 2026-09-21

- Added persistent `colony-architects-v1` registry for manual colony-system ↔ CMDR architect pairing.
- Architect pair records store system, optional system address, commander, optional linked Frontier owner ID, source (`manual` or explicitly `claim_confirmed`), optional claim evidence reference, notes, and audit timestamps.
- Pairing changes keep a compact audit history (`paired`, `updated`, `unpaired`) so corrections do not silently erase prior assignments.
- Added Site Admin API `/api/operations/colony-architects` and lazy-loaded BGS Control panel **Colony Architect Registry**.
- Registry UI supports manual system/CMDR pairing, editing, unpairing, connected-CMDR/system suggestions, and explicit confirmation of captured claim evidence.
- Architect registry is informational only. It does **not** restrict Colonization Job creation or management.
- Frontier parser now captures `ColonisationSystemClaim` and `ColonisationSystemClaimRelease` globally for the authenticated CMDR, even when the claimed system is outside Daily Order / Colonization Job verification scope.
- Claim events retain system, SystemAddress, timestamp, event type, and are attributed to the Frontier-connected CMDR by account ownership rather than by journal self-report.
- Frontier manual Sync Activity now remains available even when there are no active Daily Order / Colonization Job systems, specifically so claim tracking still works.
- Historical reconciliation falls back to the existing 3-day lookback for claim tracking when no active order/job provides an earlier verification start.
- Member Frontier Scout now shows a `System Claims Seen` KPI and friendly claim/release activity labels.
- Registry compares latest captured claim evidence with manual pairings and flags MATCH / CONFLICT / RELEASED without auto-overwriting the manual registry.
- Claim parser was validated against the observed journal shape: `ColonisationSystemClaim` / `ColonisationSystemClaimRelease` with `StarSystem` and `SystemAddress`; unrelated non-target journal activity remained excluded when no verification systems were active.

## Colonization site-picker polish — 2026-09-21

- Renamed `Observed Construction MarketIDs` to **Observed Construction Sites** and `Observed Build IDs` to **Observed Sites**; normal UI no longer asks the operator to think in MarketIDs.
- Discovered-site rows now understand active specific-build bindings in the same system:
  - the linked build shows a disabled green **CURRENT SITE** indicator,
  - with one active bound job and no awaiting job, alternate builds show **SWITCH TO THIS SITE** and can rebind that job after confirmation,
  - with one AWAITING SITE job, candidate builds show **LINK THIS SITE**,
  - otherwise the generic **USE THIS SITE** behavior remains available for deliberate/new-job selection.
- Switching a bound job keeps the existing job and recalculates verified tonnage/reward preview against the new MarketID.
- Empty-state copy now reflects depot discovery rather than requiring a contribution event.

## Published-order removal detection fix — 2026-09-21

- Live Order Removal test exposed a gap: when fresh conditions caused an auto-managed system's generated preview to drop to zero tasks, `autoSyncCard()` deleted the system from the local Publish Queue before comparing it with still-published Mission Control orders. The removal therefore produced no PLAN CHANGED / REMOVE / REMOVES ORDERS indication.
- Auto-managed systems that still have published Mission Control orders now keep a zero-task `removal` candidate when their current preview has no actionable tasks.
- The existing plan diff can therefore compare `published tasks → []` and surface REMOVE rows, REMOVES ORDERS, and the ORDER CHANGES annunciator.
- Removal candidates reconcile with `reconcileSystems:[system]` and `orders:[]`, which the Daily Orders API already supports; publishing removes that system's actionable orders while preserving unrelated systems.
- Loading or refreshing the published-order baseline now calls `syncAll()` so published-only removals are detected immediately even if the baseline request resolves after initial page setup.
- Explicit Queue Selector deselection still means hold the system out of automatic reconciliation; it removes a selector/removal candidate instead of treating deselection itself as an order-removal instruction.
- Publish Queue source label for this state is `AUTO · ORDER REMOVAL` with removal styling.
- `wolf-bgs-publish.js?v=15`, `wolf-bgs-publish.css?v=8`.

## Durable Daily Order publication history — 2026-09-21

- Added `lib/order-history.js` and central write-ahead publication archiving for every Daily Orders PUT/DELETE, regardless of whether the change originates in Wolf BGS Control or another authorized Daily Orders editor.
- Each publication gets its own KV record under `order-history:` with:
  - publication ID, action (`reconcile`, `replace`, `delete`), actor, timestamps, cycle IDs and reconcile-system scope,
  - complete normalized BEFORE and AFTER Daily Order snapshots,
  - SHA-256 hashes for both snapshots,
  - order-level change rows (`added`, `revised`, `removed`, `unchanged`) and counts.
- Publication sequence is write-ahead:
  1. persist PREPARED history with full before/after payload,
  2. mutate the live `current` Daily Orders document,
  3. finalize the history record as APPLIED.
- If the live mutation fails, the prepared history record is marked FAILED where possible. If finalization fails after a successful live publish, the PREPARED record still preserves the full before/after payload for recovery.
- Existing live orders are automatically captured as the BEFORE snapshot on the first archived publication after deployment, so the system does not need a destructive migration/bootstrap.
- Added Site Admin read-only endpoint `/api/operations/order-history` and lazy-loaded BGS Control **Daily Order History** panel.
- History UI shows publication state, actor/time, cycle/publication IDs, hashes, reconcile scope, material changes, target deltas, and the complete resulting active-order snapshot.
- BGS Control publication success now surfaces archive-finalization warnings and refreshes the history panel automatically when open.
- Archive change logic was locally validated for target revision, single-order removal, and full-order removal cases.
- Reward issuance remains OFF. This archive is provenance infrastructure for the upcoming dry-run reward engine; no balances or ledger entries are created here.

## Reward engine true DRY RUN — 2026-09-21

- Added read-only `/api/rewards/dry-run` and `lib/reward-dry-run.js`. Engine mode is hard-coded `dry_run`; endpoint has no ledger-write path and returns `writeCapability:false`, `liveIssuanceSupported:false`, `automaticLedgerWrites:false`.
- Dry run uses Frontier Scout matches from the current Daily Order cycle and current reward rules to calculate exact verified reward entitlement.
- `matchVerifiedActivity()` now carries stable Frontier `sourceEventIds` into each per-order verified total.
- Each potential verified-order obligation is scoped by member + cycle + logical order and includes:
  - current order ID/logical key/revision,
  - verified contribution and unit,
  - entitlement credits, already-ledgered verified credits, incremental delta,
  - Frontier evidence IDs + evidence digest,
  - exact archived publication provenance (publication ID, after-snapshot hash, archived revision),
  - frozen reward-rule snapshot + reward-rule digest,
  - deterministic proposed ledger entry ID.
- Proposed entry IDs are keyed by member + cycle + logical order + evidence digest + reward-rule digest. This supports future append-only incremental issuance: new evidence produces a new deterministic ID while repeated evaluation of identical evidence/rules produces the same ID.
- Existing verified-order ledger credits for the same member/cycle/logical order are subtracted from entitlement. Fully satisfied obligations are `DUPLICATE SUPPRESSED`; existing credit greater than entitlement is flagged as an over-issued blocker rather than creating negative debt silently.
- Live-readiness blockers currently include missing cycle, logical identity, current order, Frontier evidence, archive provenance, exact archive revision, or over-issued existing ledger state.
- Reward ledger schema advanced to v2 provenance fields: source order revision, publication ID, archive hash, evidence digest, reward-rule digest, reward type/contribution/unit, and reward rule snapshot.
- BGS Control `Payout Console Preview` is now **Reward Engine · DRY RUN** with:
  - would-create credits, ready/blocked obligation counts, duplicate suppression, total entitlement, blocked value,
  - per-CMDR exact obligations, evidence-event count, order revision, publication provenance, deterministic entry ID, blockers,
  - the actual stored reward ledger shown separately underneath for side-by-side proof that dry run writes nothing.
- Payout console refreshes manually, after Daily Order publication/history changes, and when returning to the page while open.
- Local dry-run simulation validated: exact archived 5-INF obligation produced 5M ready entitlement; 3M prior verified ledger credit reduced the delta to 2M; missing archive provenance blocked issuance; repeated identical evidence produced the same deterministic entry ID.
- Colonization rewards remain on their separate preview framework for now. They will join the unified dry-run engine after overlapping-job arbitration is defined.

## Member Rewards paid-history paging — 2026-09-21

Paid reward history no longer grows into one unbounded member-page list.

- The Rewards account loads the newest **12 payout batches** initially.
- Multiple reward entries settled in one in-game transfer remain grouped inside one expandable payout batch.
- If older history exists, the member sees **LOAD OLDER PAYOUTS** rather than page-number navigation.
- Each click fetches the next 12 payout batches and appends them in chronological order.
- The UI shows **Showing X of Y payout batches** so members know how much history remains.
- Outstanding rewards are not paged or truncated; the member status response returns all currently OWED entries.
- Lifetime Paid remains calculated across the complete ledger, not just the visible history page.
- Paid history is fetched through a member-authenticated endpoint bound to the signed-in Discord account; members cannot request another member's history.

## Member Rewards account / payout requests — 2026-09-21

Added a dedicated member-facing **Rewards** account at `/rewards/` plus a compact Mission Control preview.

- The Rewards page is member-authenticated and shows only the signed-in member's own ledger.
- The account combines every reward source into one balance: BGS, Colonization, future scouting jobs, manual adjustments, special jobs, and future reward programs.
- Top-level account figures show **Available Balance**, outstanding entry count, lifetime paid total, and payout-request status.
- Outstanding entries are grouped by source with reason, verified contribution when available, approval time, and amount.
- Paid history is grouped by payment batch when possible.
- Members can **REQUEST PAYOUT** without changing or creating debt. The request is only a collection signal to leadership.
- A payout request snapshots the currently owed entry IDs and total. Rewards earned after the request are shown separately and can be included by updating the request.
- Members can cancel an active payout request without affecting what is owed.
- The admin Payment Console surfaces **PAYOUT REQUESTED** on that CMDR and prioritizes requested CMDRs in the ledger list.
- Partial settlement keeps a payout request active until every ledger entry included in that request has been paid. Once the requested entries are settled, the request is marked fulfilled even if newer rewards remain owed.
- Mission Control now has a compact **MY REWARDS** preview with available balance, outstanding count, payout state, and a direct link to the full Rewards account.
- The reward ledger now preserves `scouting_job` as a first-class kind in preparation for verified scouting rewards.

### Faction Alert blink repair
- The active Faction Alert master button still uses the red `wolf-master-alert-flash` warning cycle.
- The prior `prefers-reduced-motion` override was suppressing the blink entirely on systems/browsers reporting reduced motion, leaving the button illuminated but static.
- Reduced-motion mode now removes nonessential transitions but keeps the critical warning as a slower 1.6-second stepped light flash. This is a color/light-state warning, not positional motion.
- `wolf-bgs.css` cache version advanced so the repaired animation is not hidden by a stale stylesheet.

## Reward payment console / settlement batches — 2026-09-21

Added the operator-facing payment side of the real Reward Ledger.

- Actual ledger activity is grouped by **CMDR** in expandable accordion rows.
- Outstanding ledger entries have checkboxes so multiple debts for one CMDR can be paid in one in-game transfer.
- Selection is hard-limited to **one CMDR at a time**. Once a CMDR has selected entries, other CMDR payment controls are disabled until the selection is cleared.
- Each CMDR group includes **SELECT ALL OWED**, per-entry reason/source/contribution/owed timestamp/approver details, current outstanding total, and recent paid history.
- A sticky selection bar shows the selected CMDR, selected entry count, and **TOTAL SELECTED** for quick reference while making the in-game credit transfer.
- **CONFIRM PAYMENT** is site-admin only and requires an explicit confirmation that the in-game transfer has already been completed.
- Payment confirmation is batch-based and server-validated:
  - all selected entries must still exist and still be OWED;
  - all selected entries must belong to the same owner/CMDR;
  - the server recomputes the selected total and compares it to the amount shown to the operator;
  - batches are capped at 100 entries;
  - same-origin request validation is required.
- Payment batches use a durable **PREPARED → APPLIED / FAILED** write-ahead record. A failed partial batch stores the entry IDs already updated so recovery never depends on guessing.
- Successful settlement marks the selected ledger entries **PAID** and records paid timestamp, paying admin, payment batch ID, and confirmation audit metadata.
- A client-generated payment request ID makes a successfully applied batch safe against a lost-response retry: the same request can return its existing APPLIED result rather than creating a second batch.
- No automatic payment behavior exists. The system only records settlement after a site admin confirms the in-game transfer was completed.

## Controlled Reward Ledger issue — 2026-09-21

The Reward Engine now has an explicit **READY → OWED ledger** action while automatic issuance remains OFF.

- Only a **site admin** can issue a READY obligation at this stage.
- The client never sends a ledger entry payload. It sends only the deterministic obligation ID plus the amount/evidence/rule digests that were displayed.
- The server re-runs the full unified Reward Engine against current Daily Order history, Colonization history, Frontier evidence, reward settings, and the actual ledger before allowing a write.
- The write is rejected if the obligation disappeared, became BLOCKED, changed amount, changed evidence, changed reward rules, or is otherwise stale.
- A successful action creates exactly one real ledger entry with status **OWED**. It does **not** mark any in-game credit transfer as paid.
- Ledger creation is deterministic/idempotent: clicking the same obligation twice cannot create duplicate debt.
- Approval audit fields are stored on the ledger entry: source obligation ID, approval mode, approved timestamp, and approving admin.
- The BGS Control button is deliberately labeled **CREATE OWED ENTRY** and requires a confirmation explaining that no in-game payment is being recorded.
- After creation, the Reward Engine refreshes against the real ledger; the same entitlement should become **DUPLICATE SUPPRESSED** / zero remaining delta until new verified contribution increases entitlement.
- DRY RUN and the controlled issue endpoint now share one server-side unified reward-engine evaluation path to prevent logic drift.
- Automatic reward ledger writes remain OFF. Batch issue is not enabled.

## Mission Control Scout-first reporting UI — 2026-09-22

Mission Control now treats Scout/Frontier verification as the primary reporting path while preserving manual entry as a backup.

- The compact order progress, manual aggregate, and SCOUT VERIFIED status remain visible without opening anything.
- The large manual INF/CZ/credit entry controls are collapsed by default under **MANUAL REPORTING**.
- The collapsed row explicitly says **Backup entry if Scout misses activity** and shows whether the member already has manual reports for that order.
- Existing manual reporting, report history, corrections, and late-report behavior are unchanged; expanding the row exposes the same controls.
- Tick visibility was increased: the rolling-cycle countdown is larger, per-system countdowns are larger, and the per-order **TICK IN / TRANSITION** pill is easier to read.
- This is a presentation change only; it does not alter Scout verification, reward eligibility, work-cycle boundaries, or manual report accounting.

## Per-system Daily Order work cycles and clocks — 2026-09-22

Daily Order progress now follows the BGS tick model instead of carrying forever under one publication cycle.

- There is **no squad-wide midnight/fixed-local reset**. Each order resolves its work cycle from its system's configured BGS tick.
- Timing comes from Wolf BGS Control: per-system `customTick` when present, otherwise the global reference tick (currently **19:00 CT / 7:00 PM Central**), plus the configured transition window and late-report grace. Admin tick inputs are Central-time wall clocks; runtime converts them to UTC instants using `America/Chicago` so CST/CDT is handled automatically.
- Current defaults remain **90 minutes transition** and **3 hours late-report grace**.
- The scheduled work cycle remains on the old bucket through the transition window. After the transition window ends, the next request resolves a new deterministic per-system work-cycle ID and current progress starts from zero.
- Existing order definitions carry forward; **manual report totals and Frontier-verified current progress do not**.
- Legacy manual reports without a work-cycle ID are classified by their original report timestamp against recent system work-cycle windows, so an old 5/25 INF report cannot appear in today's progress merely because the order definition is unchanged.
- New manual reports store their exact `workCycleId`, start and end timestamps while retaining the existing publication-cycle storage prefix. This avoids multiplying KV LIST prefixes per active system.
- Frontier matching is bounded by each order's work-cycle start/end. Mission Control shows current-cycle verified progress only.
- Reward Engine separately evaluates the current plus **7 prior work cycles**, with deterministic per-work-cycle source IDs, so current progress can reset without silently discarding recent unissued verified reward evidence.
- Mission Control now shows a rolling-cycle overview plus per-system estimated tick in **UTC and the member's browser/device local time**. High/normal-risk order cards get a live countdown; low/optional orders may omit the per-order timer.
- During the configured transition window, clocks switch to **TRANSITION** and count down to the fresh progress bucket.
- The order publication cycle remains distinct from the per-system work cycle: publication history still proves what the order said; the work cycle proves which BGS day the contribution belongs to.

## Daily Order legacy baseline / event-time guard — 2026-09-21

Added the same migration safety concept used by Colonization to Daily Orders.

- If the current Daily Order cycle predates durable Order History and has no archived publication, the system creates a one-time **APPLIED legacy baseline** snapshot for that cycle.
- Baseline creation is idempotent and occurs before a legacy current cycle can be published/reconciled/deleted, and can also initialize from the Reward Engine or Daily Order History view.
- The baseline anchors the exact current order definitions **from the baseline timestamp forward**. It does not invent earlier publication history.
- Reward Engine provenance now stays attached to the **origin publication of the exact order revision**, rather than a later unchanged snapshot that happens to contain the same revision.
- Verified Daily Order evidence is partitioned at the revision-provenance boundary:
  - evidence before a legacy baseline remains visible as **BLOCKED · contribution predates the durable Daily Order baseline**;
  - evidence after the baseline can independently become **READY** under the anchored definition;
  - evidence predating a later non-legacy order revision is conservatively BLOCKED as a revision-time mismatch instead of being silently reattributed;
  - evidence without a provable event timestamp is BLOCKED.
- Pre-baseline diagnostic obligations never create a planned ledger entry.
- Existing historical work therefore remains visible for audit while new work can use the same current orders without being permanently contaminated by legacy evidence.
- Daily Order History labels the migration record **BASELINE** and explains the historical boundary.
- Automatic reward ledger writes remain OFF.

## Colonization Reward Engine DRY RUN integration — 2026-09-21

Colonization rewards now participate in the same unified Reward Engine preview as Daily Orders while **all ledger writes remain OFF**.

- Each Frontier `ColonisationContribution` is evaluated against the Colonization Job revision that was effective at the event timestamp, rather than blindly using today's job definition.
- The first discovery/binding of a specific construction site can identify cargo delivered after the job started but before its MarketID was known. That later binding is used only to identify the site; the contribution still keeps the reward rules from the event-time job revision.
- A later real site switch is not backdated across the prior bound period.
- Overlap arbitration is re-run against the effective historical job definitions for each event, preserving specific-build > system-wide, commodity-specific > unrestricted, and equal-specificity BLOCKED behavior.
- Reward provenance records both archived rule-revision origins and construction-site binding provenance.
- Pre-baseline legacy contributions are valued for visibility but remain BLOCKED because the exact pre-baseline job definition cannot be proven.
- Missing job/binding provenance and equal-specificity overlap are BLOCKED rather than guessed.
- If verified cargo spans genuinely different payout rules (block size, block reward, or personal cap), the obligation is BLOCKED pending an explicit rule-transition policy instead of silently mixing incompatible rules.
- Ready Colonization obligations use deterministic IDs and future ledger provenance fields keyed to member + job + Frontier evidence + frozen reward rules.
- Existing Colonization ledger credit for the same member/job will produce incremental delta or DUPLICATE SUPPRESSED behavior once live issuance is eventually enabled.
- The Reward Engine panel now identifies **DAILY ORDERS + COLONIZATION**, exposes both order and colony archive counts, and labels Colonization blockers distinctly.
- Automatic Colonization payout issuance remains OFF; this stage is observation/proof only.

## Colonization overlap arbitration — 2026-09-21

- Added deterministic arbitration for `ColonisationContribution` events before Colonization Job reward/progress calculation.
- One Frontier contribution event can now feed at most one payable Colonization Job.
- Arbitration priority is lexicographic and intentionally conservative:
  1. specific-build (`MarketID`) job beats a system-wide job,
  2. within the same scope, commodity-specific job beats unrestricted job,
  3. if multiple matching jobs remain equally specific, the event is AMBIGUOUS and credits none of them.
- Commodity-specific winners count only the selected commodity amount from a mixed-material contribution event; lower-priority unrestricted jobs receive zero payable tons for that entire event.
- Losing overlap matches are retained as `suppressed` diagnostics with candidate tonnage and winner/reason, so the UI can explain where cargo went instead of silently dropping it.
- Equal-specificity ambiguity is retained with candidate job IDs/titles and per-job potential tonnage; no deterministic tiebreaker by creation time or job ID is used for payout attribution.
- Specific-build jobs in AWAITING SITE cannot match contributions until a MarketID is bound.
- Colonization Job API now computes arbitration once per connected CMDR across all relevant jobs, then builds every job/member preview from those assignments.
- Job/member previews now expose payable tons, observed candidate tons, assigned event IDs, ambiguous event/tonnage counts, suppressed overlap event/tonnage counts, and arbitration-blocked state.
- Squad `Payable Cargo` now sums post-arbitration tons, eliminating double-counted payable progress across overlapping jobs.
- BGS Control shows **ARBITRATION BLOCKED** for equal-specificity collisions and **OVERLAP ROUTED** when a lower-priority candidate lost to a more specific job. Member rows explain ambiguous blocked tons and tons routed elsewhere.
- Global console callout reports assigned contribution events, ambiguous overlaps, and lower-priority matches routed away from duplicate credit.
- Local arbitration tests passed:
  - system-wide + specific-build + commodity-specific overlap routed a mixed 1,200t event to the commodity-specific specific-build job only (700t Titanium payable),
  - specific-build outranked the system-wide job,
  - commodity-specific outranked unrestricted within the same build,
  - two equal-specificity specific-build jobs produced zero assignment and one AMBIGUOUS event.
- Automatic colonization payout issuance remains OFF. The next reward-side step is durable Colonization Job revision/provenance followed by inclusion in the unified Reward Engine DRY RUN.

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

- Keep **19:00 Central Time (CT) as the operator-entered global reference baseline**, not as a claim that every system processes at exactly that wall-clock time. Convert it to the correct UTC instant for display/calculation, including CST/CDT daylight-saving changes.
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

> **19:00 CT reference → per-system offset → learned drift/tick window → objective-specific order cutoff → transition behavior (safe continuation or hold) → fresh post-tick confirmation → new Daily Orders**

This section is deliberately preserved as **concept/doctrine only** so the design is not lost while conflict work is paused. Before implementation, validate the exact tick-detection signals, decide initial safety-buffer defaults, and define how the member-facing Mission Control labels each transition state.


## Colonization Job durable history / revisions — 2026-09-21

Implemented the provenance layer required before Colonization rewards can join the main Reward Engine.

### Revisioned job definitions

- Every Colonization Job now has a durable `revision` and `revisionStartedAt`.
- New jobs begin at **revision 1**.
- A material change increments the revision. Material job state includes the system, system-vs-specific-build scope, MarketID/site binding, build name, commodity filter, target tons, reward-block tons, reward per block, personal cap, status, effective start/end times, title, and notes.
- Metadata-only/no-op normalization does not create a new revision.
- Site discovery/rebinding therefore becomes an auditable revision instead of silently rewriting the job that older cargo was evaluated against.

### Legacy baseline

- Existing Colonization Jobs that predate this feature receive a one-time **APPLIED baseline snapshot** when the admin Colonization console/history first loads.
- The migration is idempotent and does not alter the live job definition, Frontier events, or reward balances.
- The baseline establishes the current legacy definition as revision 1. Earlier edits that happened before durable history existed cannot be reconstructed and are explicitly treated as legacy history.

### Write-ahead job history

Every later create, update, site-binding change, status change, or delete now follows the same safety pattern used by Daily Orders:

1. Write an immutable-style **PREPARED** history record containing the complete BEFORE and AFTER job-store snapshots.
2. Store SHA-256 hashes for both snapshots plus the actor, action, target job ID, publication ID, timestamps, and ADDED / REVISED / REMOVED / UNCHANGED change summary.
3. Apply the live Colonization Job mutation.
4. Mark the history record **APPLIED** after the live change succeeds.
5. If the live write fails, mark the prepared history record **FAILED** with the failure detail.
6. If final history marking fails after the live write, the PREPARED payload remains available for recovery rather than losing provenance.

Deleting a job does **not** delete its archived revisions.

### Admin visibility

- Wolf BGS Control now includes a read-only **Colonization Job History** panel.
- It displays publication state, revision transitions, system/build scope, commodity restriction, reward rules, before/after hashes, material changes, and the resulting job snapshot.
- The live Colonization Job cards display their current revision.
- Successful job mutations notify the history panel so an open archive refreshes after changes.

### Reward safety

- **Automatic Colonization reward issuance remains OFF.**
- This history layer creates no reward debt and does not write to the reward ledger.
- The archive now provides the exact job/rule provenance needed for the next step: evaluate arbitrated `ColonisationContribution` evidence against the correct archived job revision and feed resulting obligations into the existing **DRY RUN → READY / BLOCKED / DUPLICATE SUPPRESSED** reward pipeline.
