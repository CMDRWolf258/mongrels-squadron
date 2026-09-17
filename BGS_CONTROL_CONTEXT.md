# Wolf BGS Control — Architecture Context

_Last updated: 2026-09-17_

Read `PROJECT_CONTEXT.md` first. Repository code is authoritative if this file, memory, old chats, or screenshots disagree.

## Purpose and authority

Wolf BGS Control is a site-admin-only command deck for CMDR Wolf258. It is intentionally separate from member-facing Mission Control.

Core model:

> Programmed logic handles monitoring, prioritization, balancing and clerical reasoning; Advanced Intelligence may suggest changes; Wolf remains the final authority; members eventually receive simple structured Daily Orders.

No current preview publishes Daily Orders automatically.

## Primary files

- `/wolf-bgs/index.html`
- `css/wolf-bgs.css`
- `css/wolf-bgs-rules.css`
- `css/wolf-bgs-sliders.css`
- `css/wolf-bgs-order-preview.css`
- `css/wolf-bgs-screenshot.css`
- `js/wolf-bgs-inheritance.js`
- `js/wolf-bgs.js`
- `js/wolf-bgs-rules.js`
- `js/wolf-bgs-sliders.js`
- `js/wolf-bgs-order-preview.js`
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

All private APIs require `session.access === 'site_admin'`; hiding UI is never treated as authorization.

## Storage

All current BGS Control state uses the existing `DAILY_ORDERS` KV binding.

- Core Control Room key: `wolf-bgs-control-v1`
- Automation Rules / faction strategy / balancing calibration: `wolf-bgs-rules-v1`
- Economy/Security objectives: `wolf-bgs-slider-objectives-v1`

Core system settings use sparse overrides. Blank/default-valued per-system fields inherit current System Defaults dynamically instead of storing copied defaults.

`Reset to Defaults` removes the system-configuration override layer but preserves favorites, notes, manual faction/status snapshots, faction strategy, Economy/Security objectives, balancing calibration, and reporting/history data.

## Full faction-board ingestion

`data/live-bgs.json` remains the authoritative Mongrel-presence discovery feed.

Complete faction boards are enriched separately into `data/live-bgs-boards.json` by `scripts/enrich_bgs_boards.py` using EliteHub Vault / EDDN. The board snapshot retains faction name, influence, active/current state, pending state, recovering state and source update time.

Keeping full boards separate is deliberate: a temporary board-enrichment failure must not wipe out Mongrel-presence discovery. The two-hour updater retains prior good board data where possible and uses safe pacing/retry behavior for EliteHub rate limits.

Manual snapshots remain a fallback and are timestamped. The newest complete trusted snapshot wins; the UI must never pretend a Mongrel-only fallback row is a complete faction board.

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
- **Suppress / lower** — the faction should lose relative influence; positive work for it requires compensating logic.
- **Maintain / hold** — this is an actual stability objective, not “whatever”.
- **Protect from Retreat** — prioritize support when Retreat risk is relevant.
- **Allow Retreat** — avoid positive work that would rescue the faction unless Wolf changes the objective.

Non-Mongrel factions may also have target min/max and a control objective: none / prefer control / avoid control / allow either.

For Mongrels, System Strategy remains the authoritative target band so the site does not create duplicate sources of truth.

## Economy and Security objectives

Economy and Security are first-class faction objectives, separate from influence intent.

- Economy: Ignore / Raise / Hold / Lower.
- Security: Ignore / Raise / Hold / Lower / Locked / not actionable.

The important doctrine is now **balance, do not automatically block**:

- Being near an influence ceiling does not by itself stop desired Economy/Security work.
- Positive slider work may proceed while the Order Preview generates compensating support for eligible other factions.
- `Avoid interaction` remains a real blocking conflict.
- `Allow Retreat` also blocks positive slider work unless explicitly changed.
- `Maintain / hold` or `Suppress / lower` can coexist with positive slider work only if counter-support is generated.
- Security `Locked / not actionable` never generates Security work.

Lowering Economy/Security remains advisory until validated negative-slider recipes are encoded.

## Automation Rules Library and CMDR workload doctrine

The rules layer is operational doctrine, not a claim to know Frontier's hidden formula.

Current workload controls include:

- normal mission INF per participating CMDR;
- stretch mission INF per participating CMDR;
- bounty MCr per CMDR;
- trade-profit MCr per CMDR;
- exploration-data MCr per CMDR;
- preferred participating CMDR count;
- diversification preference;
- solo-CMDR guard against multiplying one pilot's workload to replace missing operators.

Operational doctrine:

- several CMDRs doing moderate useful work is preferred to one CMDR grinding far beyond a useful range;
- exact independent per-CMDR soft-cap behavior is treated as unconfirmed;
- mission `INF` always means mission influence reward pips/ticks, never faction percentage points.

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

If no safe counterweight exists, the preview raises a warning rather than inventing a recipient.

## Order Preview / Generator

Each expanded system can mount a dedicated **Order Preview / Generator** below the faction/slider configuration.

It is deterministic and preview-only. It reads current on-screen values, including unsaved edits, so Wolf can test scenarios before committing configuration.

The preview can produce:

- Mongrel support when below target floor;
- positive work for explicitly supported non-Mongrel factions;
- Retreat rescue workloads;
- redistribution/counter-support when Mongrels or another maintained faction is above target;
- Security work via bounty-voucher workload;
- Economy work via profitable-trade workload;
- balancing mission INF for eligible counterweight factions;
- stop/review conditions;
- safety/candidate explanations;
- visible balancing arithmetic.

Overlapping mission-INF needs for the same faction are merged using the higher required workload rather than blindly summed. Example: if a faction already needs 25 INF for its own Support objective and the Security counterweight calculation asks for 15 INF, the preview keeps a 25-INF task because that work also satisfies the smaller counterweight need.

The preview clearly shows `PREVIEW ONLY` and `Publish disabled`. It does not write Daily Orders.

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

## Next product stages

The next major stages after validating Order Preview behavior are:

- ranked Daily Orders queue;
- explicit approve/edit/publish flow;
- member task/reporting controls generated from structured orders;
- current-cycle reporting dashboard;
- ~14-cycle operator/history view;
- Tick & Data Monitor;
- exceptions/override summary;
- change digest;
- historical calibration suggestions using starting board → issued orders → CMDR reports → following board.

Daily Orders should eventually rank unmet work above met work, and met work above systems with no current orders. Emergency operational priority may temporarily outrank long-term strategic priority.

History is intended to build Mongrel-specific empirical calibration without pretending to reverse-engineer Frontier's hidden formula.
