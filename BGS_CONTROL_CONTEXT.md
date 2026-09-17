# Wolf BGS Control — Architecture Context

_Last updated: 2026-09-16_

This file records the architecture and product direction for the Wolf-only BGS Control Room. Read `PROJECT_CONTEXT.md` first; repository code remains authoritative.

## Purpose

Wolf BGS Control is a site-admin-only command deck for CMDR Wolf258, the squad's primary BGS strategist. It is intentionally distinct from member-facing Mission Control and officer Daily Orders editing.

Core principle:

> Programmed BGS logic performs monitoring, prioritization and clerical work; Wolf retains strategic authority; members receive simple orders and low-friction reporting.

## Current prototype

Primary files:
- `/wolf-bgs/index.html`
- `css/wolf-bgs.css`
- `js/wolf-bgs.js`
- `functions/api/operations/wolf-bgs.js`
- `scripts/smoke-wolf-bgs.mjs`

Access:
- Server API requires `session.access === 'site_admin'`.
- UI hiding is not treated as authorization.

Storage:
- Existing `DAILY_ORDERS` KV binding.
- Key: `wolf-bgs-control-v1`.
- Stores global defaults, per-system settings, and manual system/faction snapshots.

## Prototype global defaults

- Default scheduled system tick: 19:00 local browser/Control Room display time (intended starting point: 7:00 PM Central for Wolf).
- Maximum data age: 8 hours.
- Tick-watch buffer: 90 minutes.
- Late-report grace: 3 hours.
- Maximum Daily Orders systems: 6.
- Default rollover policy: Safety Only.
- Require post-tick data for normal orders: true.
- Emergency orders with stale data: false by default.

All are intended to be configurable from Wolf Control.

## Per-system control model

Every current Mongrel-presence system appears as a compact expandable card. Controls include:
- strategic importance;
- desired control policy;
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
- notes.

Settings are changed only after **Save System Settings**. The latest system-settings timestamp is retained; a full edit history is not required.

## Manual status / faction board

The expanded card contains an editable faction board with rows for:
- faction name;
- influence;
- current state;
- pending state;
- recovering state;
- data origin.

Wolf can add/remove faction rows, set the controller and notes, then use **Submit Status**. Manual status submission is intentionally separate from saving system automation/strategy settings.

Manual status gets a fresh server timestamp and actor identity. The UI shows:
- Source Update Time;
- Manual Update Time;
- Active Snapshot time/source.

Newest timestamp is the current trust rule, with one important prototype limitation below.

## Current source-data limitation

`data/live-bgs.json` currently tracks the Regiment of Imperial Mongrels presence row and system-level metadata; it does **not** contain the complete faction board for every system.

Therefore the prototype:
- automatically fills the Mongrel faction row from the third-party source;
- preserves manually entered non-Mongrel rows;
- clearly labels the automated source as a partial board source;
- does not pretend the full board is automatically ingested.

A future ingestion upgrade should fetch complete faction boards and then apply the same source/manual freshness rules field-by-field or snapshot-by-snapshot.

## Automation architecture direction

Three visibly separated layers:

1. **Programmed BGS Logic — authoritative automation**
   - Explicit configurable rules and workloads.
   - Must expose where amounts such as bounty targets come from.
   - Expected levers include mission INF, bounty vouchers, trade profit, exploration data, conflict work and deliberate negative work.
   - Explanation panel should show rule fired, base amount, modifiers, final task, priority and stop condition.

2. **Advanced Intelligence Suggestion — advisory**
   - Historical calibration, anomaly detection and AI suggestions.
   - Never silently replaces programmed logic.
   - Wolf may apply or ignore suggestions.

3. **Wolf Override — ultimate authority**
   - Approve/edit/reject generated work.
   - Create custom order amounts/logic.
   - Force include/exclude/hold systems and tasks.

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
