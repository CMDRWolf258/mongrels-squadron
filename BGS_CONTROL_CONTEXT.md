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
- retains external-source timestamps separately so the UI can show exactly which source is newest.

System cards identify Scout-sourced data with dedicated Scout chips. Faction alerts, Queue Selector automation, Retreat handling, conflict score age, and conflict-day tracking all consume the same merged trusted snapshot, so fresh Scout observations can immediately affect the control logic.

### Security/storage
- Admin token management endpoint: `/api/operations/scout-tokens` (site-admin session + same-origin write protection).
- Scout ingest endpoint: `/api/operations/scout-ingest` (Bearer scout token; no Discord/site session required).
- Token KV key: `wolf-bgs-scout-tokens-v1`.
- Snapshot KV key: `wolf-bgs-scout-snapshots-v1`.
- Raw scout tokens are never persisted by the server.
