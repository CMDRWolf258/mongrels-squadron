# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-23_

## Read this first

**AI / developer handoff:** read this file, then inspect the current repository before changing anything. The repository is the source of truth. If this document, memory, an old chat, screenshots, or release notes conflict with current code, **current code wins**.

Never reuse remembered file SHAs. Fetch the current target file immediately before modifying it and use the current SHA.

This is an architecture/handoff guide, not a changelog. Update it after meaningful workflow, permission, storage, integration, navigation, Pathway, campaign, or project-direction changes.

---

## Project identity

- **Squadron:** Regiment of Imperial Mongrels
- **Commander / Site Admin:** CMDR Wolf258 (Wolf)
- **Official home:** Diaba
- **Repository:** `CMDRWolf258/mongrels-squadron`
- **Production:** `https://mongrels-squadron.pages.dev/`
- **Hosting/runtime:** Cloudflare Pages + Pages Functions + KV-backed server features
- **Theme:** black/charcoal with restrained cyan/blue military/HUD styling
- **Navigation convention:** use **CARRIERS**, not Fleet

The site is both a public squadron presence and a private operational platform: recruitment, Discord integration, member auth, Mission Control/BGS, projects, carriers, trading, PvP, profiles/roster, guides, gallery, Ask the Mongrels, Start Here, and My Pathway.

---

## Development behavior

### Website vs Discord

- **Website = structured source of truth** for applications, profiles, projects, tasking, status, Pathway preferences/progress, campaign state, specialty-training state, and admin workflows.
- **Discord = identity/community + communication + notifications + immediate coordination.**

Do not duplicate structured website workflows into Discord unless there is a clear reason.

### Device support

Wolf uses desktop, phone, and iPad. Member/admin tools must remain practical on all three.

### Implementation rules

- Prefer direct GitHub implementation; Wolf usually does not want manual whole-file replacement.
- Keep progress updates short during multi-step work.
- GitHub commit success does **not** prove Cloudflare deployment. Do not call a feature live/validated unless production is actually checked or Wolf confirms it.
- Avoid base64 image workflows unless truly necessary; prefer normal repo assets.
- Preserve one authoritative state model per domain instead of creating parallel copies of the same data.
- Wolf often reviews a batch of recent features later rather than stopping development after every addition.

---

## Automated smoke tests

Primary files:
- `scripts/smoke-test.mjs`
- `scripts/smoke-exobiology.mjs`
- `scripts/smoke-pve.mjs`
- `scripts/smoke-pvp.mjs`
- `scripts/smoke-operations.mjs`
- `scripts/smoke-colonization.mjs`
- `.github/workflows/site-smoke-tests.yml`

The workflow runs on pull requests and normal pushes to `main`; commits that only refresh `data/live-bgs.json` are ignored. It can also be run manually.

Current regression coverage includes:
- all shared full-Pathway provider catalogs covered by the main suite remain structurally valid;
- Exploration provider, Assistant context, mount/client wiring, and generic-card suppression;
- Exobiology’s five-route catalog, beginner first task, three-sample genetic loop, Assistant context, shared-provider registration, My Pathway mount/client, and duplicate-card suppression;
- PvE Combat’s five-route catalog, beginner first task, legal WANTED-target lesson, measurable three-kill beginner capstone, Conflict Zone → Daily Orders handoff, Assistant context, shared-provider registration, My Pathway mount/client, and duplicate-card suppression;
- PvP’s five-route catalog, Open/no-combat-logging beginner doctrine, legitimate in-game escape training, Assistant context, provider registration, My Pathway mount/client, and duplicate-card suppression;
- Operations’ five-route catalog, Runner-to-extraction beginner loop, mixed ship/on-foot preparation, phase-transition training, visible naming, Assistant context, provider registration, My Pathway mount/client, and duplicate-card suppression;
- Colonization’s five-route catalog, beginner no-ownership rule, live-project construction-support loop, System Architect claim/shadow and primary-port decisions, Assistant context, provider registration, My Pathway mount/client, duplicate-card suppression, and public Activities-hub status;
- cross-path Engineering Prep mappings point only to real current Trade/Mining tasks and tracked Engineering facts;
- Engineering campaign fact-completed dependency propagation;
- Improve Shields later/persistent Lei/Dweller access reuse;
- Improve Jump Range reuse of First Engineering Win Scout/Felicity/G2 progress;
- Improve Speed & Mobility reuse of Felicity access/reputation;
- Improve Power Distributor reuse of The Dweller reputation;
- Improve Power & Heat reuse of Felicity/higher-grade Power Plant access and its no-engineering/G1/G2/experimental/G3 stopping points;
- Improve Weapon Package package-first flow, multiple stopping points, and family-specific Engineer-access guardrail;
- Community Goal Hauler Prep’s 14 unique steps and survive-and-deliver doctrine;
- Ask the Mongrels query-selected Pathway/campaign/specialty/cross-path context;
- critical Cloudflare Function modules import cleanly and retain `headers()` / `reply()` helpers;
- critical pages/assets are present and wired.

Notable successful runs:
- #5 — Assistant Pathway intent wording
- #13 — Jump Range cross-campaign reuse
- #20 — Mobility/Felicity reuse
- #28 — Community Goal Hauler Prep
- #40 — cross-path Trade/Mining Engineering Prep
- #47 — Power Distributor / The Dweller reuse
- #54 — Power & Heat / higher-grade Power Plant access reuse
- #61 — Weapon Package package-first flow and family-specific Engineer guardrail
- #69 — Exploration full provider and wiring
- #80 — dedicated Exobiology full-Pathway regression suite
- #81 — Exobiology public Activities-hub cleanup with the complete smoke workflow still green
- #91 — dedicated PvE Combat full-Pathway regression suite
- #102 — dedicated PvP full-Pathway regression suite
- #115 — dedicated Operations full-Pathway regression suite and naming guard
- **#126 — dedicated Colonization full-Pathway regression suite**

Smoke tests are a regression safety net, **not** a browser or production test.

---

## Authentication / authority

Discord OAuth is implemented in `lib/auth.js` and `/api/auth/*`.

Access tiers:
1. Public
2. Member
3. Officer
4. Site Admin — intentionally Wolf-only

Important rules:
- `ADMIN_USER_ID` resolves to `site_admin`.
- `OFFICER_ROLE_IDS` drives Officer access.
- `MEMBER_ROLE_ID` drives Member access.
- Authenticated Discord server users without Member role may still have `access:no_access` with `membershipVerified:true` for applicant flows.
- Sessions use signed `mongrels_session` cookies.
- UI hiding is never a substitute for server authorization.
- Never expose Discord secrets, session secrets, API keys, or hidden IDs.

Important KV bindings:
- **`PROJECTS`** — applications, profiles, onboarding, Pathway preferences/progress, Start Here tasks, Engineering campaigns/facts, CG Hauler specialty state, and related member state.
- **`DAILY_ORDERS`** — private Mission Control/BGS strategy/configuration.

Do not create a new KV namespace casually when an existing binding is appropriate.


### Mission Control Daily Orders and reporting

Member-facing Daily Orders live under `/operations/#daily-orders`.

Primary files:
- `js/daily-orders.js` — authenticated order loading and Officer/Site Admin editor.
- `js/daily-orders-v2.js` — compact member rendering grouped into expandable system cards.
- `css/mission-control-orders-v2.css` — member card/reporting layout.
- `functions/api/operations/orders.js` — private current-order document.
- `functions/api/operations/order-reports.js` — member structured reporting and squad aggregation.
- `scripts/smoke-daily-orders.mjs` — focused regression coverage.
- `js/wolf-bgs-publish.js` + `css/wolf-bgs-publish.css` — site-admin reviewed-preview queue and explicit BGS Control → Daily Orders publisher.

Current member UX:
- collapsed system cards show system, priority/basic task context and squad progress;
- expanded cards keep full briefing/orders beside the relevant report block on desktop and stack reporting immediately below on narrower layouts;
- INF reporting uses +2/+3/+4/+5 reward counters;
- bounty-voucher, profitable-trade and exploration-data orders use a shared M Cr reporter with direct numeric entry plus quick −5/−1/+1/+5/+10 controls;
- trade reporting records **profit**, not gross cargo sale value; exploration reporting records the Universal Cartographics sale value; bounty reporting records vouchers actually redeemed for the ordered faction;
- War/Civil War reporting uses Low/Medium/High CZ wins, optional failure details, Solo/Wing mode and Combat Bonds redeemed;
- one shared wing CZ instance is one result regardless of participant count;
- an individual wingmate disconnecting/leaving is not a failed CZ if at least one Mongrel remains and the shared instance is won;
- failed/abandoned or full-instance-disconnected CZs subtract their difficulty weight from net squad CZ progress;
- current starting CZ weights are Low 1.0, Medium 1.3, High 1.6;
- Blitz can exceed its nominal benchmark and remains visibly open rather than becoming a stop condition.


BGS Control publishing:
- generated live-system tasks carry explicit kind/faction/amount metadata through the base preview, conflict layer and contribution-options layer;
- Wolf explicitly queues reviewed system previews; generating or changing a preview never publishes by itself;
- queued snapshots show when the underlying preview changed and can be refreshed before publishing;
- one confirmed publish replaces the current Daily Orders set and deliberately starts a new `cycleId`;
- published orders carry `source:"wolf-bgs"`, faction, kind and reporting metadata into Mission Control;
- Mandalore is always excluded from the publish queue;
- the existing Officer/Site Admin Daily Orders editor remains a manual fallback and preserves the structured metadata on edits.

Report storage uses the existing `DAILY_ORDERS` binding. The current order document has a `cycleId`; member reports are stored per cycle + order + Discord user so simultaneous CMDR reports do not overwrite one another. Officer edits preserve the current cycle; a publisher that omits the current cycle ID begins a new progress bucket. Old report keys remain available for later history/calibration work.

---

## Navigation / information architecture

Canonical navigation behavior:
- `js/site.js`
- `css/navigation-v2.css`

Public groups:
- Start Here
- Activities
- Command
- Resources
- Community
- Join Us
- logo = Home

Authenticated member menu:
- My Pathway
- Member Portal
- My Profile
- Sign Out

Responsive behavior:
- **>=1281px:** normal desktop navigation
- **1061–1280px:** compressed but fully visible navigation
- **<=1060px:** compact `MENU` drawer

Compact drawer uses **focus mode**: one open top-level group hides siblings, owns the scrollable drawer, and keeps its summary sticky. Closing it restores the root list.

Legacy:
- `js/navigation-v2.js` is only a compatibility shim;
- canonical behavior belongs to `js/site.js`.

The latest 1061–1280 tablet/iPad compression is implemented but not yet production-validated by Wolf.

---

## Ask the Mongrels

Primary files:
- `functions/api/assistant/index.js`
- `lib/assistant-context.js`
- `lib/assistant-pathway-context.js`
- `js/mongrel-assistant.js`

The Assistant is **read-only**. It may explain current member state but must never claim to mark Pathway/campaign/specialty progress complete or to change squad/site data.

### Navigation help

`lib/assistant-context.js` owns a query-selective navigation map. Current destinations include Carrier Coordination/Registry, Projects, Daily Orders/Mission Control, Member Portal/My Pathway/Profile, PvP Bounty Board, Trader's Outpost, Roster, Rules, Ship Catalogue, Engineering/Mining/BGS guides, Reference/Field Manual/Glossary, Start Here, and Recruitment.

Use trusted server `{label,href}` values for Related buttons; the model should not invent arbitrary links.

Useful anchors include:
- `/operations/#daily-orders`
- `/projects/#project-list`
- `/carriers/#carrier-directory`
- `/carriers/#carrier-coordination`
- `/pvp/#bounty-board`
- `/about/#squad-rules`

Carrier-loading navigation convention:
- desktop/tablet: **Command → Carrier Coordination**
- compact: **MENU → Command → Carrier Coordination**
- member alternate: Member Portal → Carrier Coordination → Open Carrier Board
- create: New Coordination Post → Activity: Loading

### Mission Control filtering

Mission Control system data is query-filtered before being sent to the Assistant. An empty filtered subset does **not** mean Mission Control has no systems. Preserve authoritative totals and selector metadata.

Faction-presence wording such as “what systems our faction is in,” “where are we present,” “territory,” and “footprint” should return an active-presence subset while preserving the authoritative total.

### Personalized My Pathway context

`lib/assistant-pathway-context.js` gives query-selective, read-only access to the authenticated member's own Pathway data.

Recognized concepts include:
- current Pathway assignment/task/step;
- PvE Combat assignment/task/step, including PvE, NPC combat, bounty-hunting and Conflict Zone wording;
- PvP assignment/task/step, including duel, player-combat, Open-combat, wing-PvP, and fixed-weapon-practice wording;
- **Operations** assignment/task/step, including Operation Runner, Merc Coin, Hard Operation, scenario-choice, and multi-role wording;
- **Colonization** assignment/task/step, including colony/colonisation, construction, primary-port, colony-build, and system-claim wording;
- Exploration assignment/task/step, including survey/deep-space/neutron-route wording;
- Exobiology assignment/task/step, including exobio, bio survey, Genetic Sampler, Vista Genomics, biological signal, and biological heatmap wording;
- Engineering Campaign Planner and all six current Engineering campaign goals;
- Engineering Prep / cross-path Engineering questions;
- Community Goal Hauler / hostile-hauling/interdiction/escape-drill wording.

When selected, `modules.pathway` can contain:
- selected activities, priority, experience, play style, and current goal;
- relevant full-route assignment progress/current task, including PvE Combat, PvP, Operations, Colonization, Exploration, and Exobiology;
- optional Engineering Prep attached to the current Trade/Mining task;
- active Engineering campaign goal/ship/progress/next step/stopping-point state;
- query-selected Community Goal Hauler Prep state.

Rules:
- only read the signed-in member's own state from `PROJECTS`;
- My Pathway/Campaign Planner/specialty UI remain authoritative;
- Assistant may explain but never write completion;
- CG Hauler state is loaded only for clearly relevant wording;
- preserve query selectivity to control prompt size/monthly AI usage.

### Operations naming boundary

The Elite Dangerous feature is **Operations**. Its persisted My Pathway ID remains `surface` only for backwards compatibility with saved preferences/progress. The separate ID `operations` means **Squad Operations** / Mission Control / Daily Orders. Keep query matching specific enough that the two concepts do not collapse into one another.

---

## Start Here

`/start/` answers: **“What is one useful thing I can do next?”** It is intentionally lower-overwhelm than My Pathway.

Primary files:
- `start/index.html`
- `js/start-tasks.js`
- `css/start-tasks.css`
- `functions/api/start/tasks.js`
- `lib/start-tasks.js`

Storage:
- `PROJECTS`
- `start-daily-v1:<local date>:<ownerId>`

Rules:
- Member/Officer/Site Admin only;
- categories derive from Pathway preferences;
- daily tasks never change Pathway progress;
- task types: Activity Task, Challenge, Squad Opportunity;
- maximum 3 reveals/category/local day, server-authoritative;
- revealed choices remain saved in the daily carousel;
- BGS/Squad Operations may include Mission Control opportunities but Daily Orders remain authoritative.

Wolf visually validated the daily-task cards/carousel.

---

## My Pathway — core model

Primary files:
- `pathway/index.html`
- `css/pathway.css`
- `css/pathway-activity-sections.css`
- `js/pathway.js`
- `js/pathway-full-routes.js`
- `functions/api/pathway/preferences.js`
- `functions/api/pathway/assignments.js`

Storage:
- preferences: `pathway-preferences-v1:<ownerId>`
- progress: `pathway-progress-v1:<ownerId>:<activity>`

Experience values:
- `new` → Beginner
- `some` → Developing
- `comfortable` → Experienced
- `experienced` → Veteran / Mentor

Task statuses:
- Complete
- Already Know / Have This
- Skip for Now
- pending/reopen

Only Complete and Already Know earn progress. Skip does not; skipped work resurfaces after untouched pending work is exhausted.

Assignment types:
- Learn
- Build
- Demonstrate
- Challenge
- Wing / Team
- Teach / Mentor

### Activity collapse UX

The right-hand **Your Pathway** area uses compact `<details>` sections. Current full-route categories are:
- PvE Combat
- PvP
- Operations
- Colonization
- Anti-Xeno
- Background Simulation
- Mining
- Trade & Hauling
- Carrier Logistics
- Engineering & Shipbuilding
- Exploration
- Exobiology

Rules:
- collapsed by default;
- category header controls expansion;
- multiple categories may remain open;
- each route renderer owns its own loading/visibility/content;
- `js/pathway-full-routes.js` suppresses the old generic preview card whenever a matching full-route section is visible;
- do not introduce another controller that forcibly shows route roots.

A previous regression was caused by accidentally removing shared `headers()` / `reply()` helpers from `functions/api/pathway/assignments.js`; smoke tests guard them.

Lasting beginner design rule:
> **Do → observe → compare → understand → optimize → lead/teach**

Avoid hiding hours of prerequisite work inside one early assignment.

---

## Full Pathway providers

`functions/api/pathway/assignments.js` hosts shared provider/progress behavior.

Current full providers:
1. Anti-Xeno — `ax-v2`
2. BGS — `bgs-v1`
3. Mining — `mining-v1`
4. Trade & Hauling — `trade-v2`
5. Carrier Logistics — `carrier-logistics-v1`
6. Engineering & Shipbuilding — `engineering-v1`
7. Exploration — `exploration-v1`
8. Exobiology — `exobiology-v1`
9. PvE Combat — `pve-v1`
10. PvP — `pvp-v1`
11. Operations — `operations-v1` (persisted activity ID remains `surface`)
12. **Colonization — `colonization-v1`**

### Anti-Xeno
- Scout School — Vulture
- Interceptor Academy — Chieftain
- Interceptor Hunter — Basilisk
- Guardian Systems — AX Specialist
- Hellhound Development — Hunt, Lead, Teach

### BGS
- Foundations — Read Before You Push
- Operator — Execute With Precision
- Strategist — Shape the Board
- Lead/Mentor — Plan, Calibrate, Teach

Critical doctrine: mission **INF = mission influence reward ticks/pips, not faction influence percentage**. Mission Control remains authoritative for live squad BGS instructions.

### Mining
- Mining Foundations — First Full Loop
- Efficient Miner — Find the Bottleneck
- Advanced Extraction — Core/Subsurface/Surface
- Rhino Field Operations
- Mining Specialist — Scout/Compare/Support
- Mining Lead — Survey/Coordinate/Teach

### Trade & Hauling v2
- Trade Foundations — Build, Haul, Discover
- Route Runner — Learn What Makes a Route Good
- Medium-Pad Specialist — Access Over Raw Capacity
- Strategic Hauler — Move What the Pack Needs
- Market Specialist — Verify, Benchmark, Adapt
- Logistics Lead — Plan, Coordinate, Teach

Trade participates in carrier loading/unloading, but carrier ownership/movement/tritium/jump planning/staging belong to Carrier Logistics.

### Carrier Logistics
- Carrier Foundations — Join the Operation
- Carrier Crew — Load, Move, Unload
- Cargo Coordinator — Stage, Measure, Control
- Movement Planner — Jumps, Tritium, Timing
- Carrier Logistics Lead — Plan, Recover, Teach

Carrier ownership is optional.

### Engineering & Shipbuilding
- Engineering Foundations — Improve One Ship
- Engineer Network — Unlock, Gather, Pin
- Role Builder — Make the Whole Ship Agree
- Combat Systems — Weapons, Defense, Core Tradeoffs
- Ship Architect — Diagnose, Test, Refine
- Engineering Mentor — Review, Explain, Teach

Engineering route cycling stays within the selected experience band:
- Beginner → Foundations only
- Developing → Role Builder / Engineer Network
- Experienced → Ship Architect / Combat Systems / Role Builder
- Veteran → Mentor / Ship Architect

### Exploration

Primary files:
- `lib/pathway-exploration.js`
- `js/pathway-exploration.js`
- shared provider registration in `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`

Routes:
- **Exploration Foundations — Leave, Survey, Return**
- **Surveyor — Read the Route, Not Just the Destination**
- **Deep-Space Navigator — Range, Neutrons & Recovery**
- **Discovery Specialist — Scout With a Purpose**
- **Expedition Lead — Plan, Recover, Teach**

Progression moves from the safe complete exploration loop through survey efficiency, neutron/remote recovery, purposeful discovery/scouting, and expedition leadership/mentoring.

**Boundary:** Exploration supports travel/discovery and may encounter biological signals, but it does not absorb Exobiology.

### Exobiology

Primary files:
- `lib/pathway-exobiology.js`
- `js/pathway-exobiology.js`
- shared provider registration in `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`
- focused regression suite: `scripts/smoke-exobiology.mjs`

Routes:
- **First Bio Survey — Find, Sample, Sell**
- **Field Surveyor — Read Terrain & Signals**
- **Efficient Naturalist — Find the Time Sink**
- **Target Specialist — Hunt Biology With a Purpose**
- **Expedition Bio Lead — Survey, Coordinate, Teach**

Progression intent:
- Beginner learns the complete loop: practical ship + Artemis/Genetic Sampler → select a landable bio body → DSS heatmap + terrain → visual field search → three genetically distinct accepted samples → surface safety → Vista Genomics sale → repeat independently.
- Field Surveyor develops heatmap/terrain judgement, repeatable search patterns, species-dependent sample-spacing judgement, movement-mode choices, and multi-species management.
- Efficient Naturalist measures the whole stop, uses a biological-detour rule, improves landing choice, optimizes the complete three-sample sequence, and learns when to relocate or abandon a poor search.
- Target Specialist uses candidate intelligence, ground-truths predictions, documents repeatable field reports, adapts after evidence, and turns findings into squad-useful reconnaissance.
- Veteran/Mentor route focuses on survey objectives, group roles, adaptation, report quality control, mentoring, and debrief.

Important guardrails:
- do not hard-code one universal colony spacing distance; it varies by organism/species, so use Genetic Sampler feedback;
- Exobiology is its own full provider even though it naturally complements Exploration;
- first-path teaching prioritizes a complete find/sample/sell loop over credits-per-hour optimization.

### PvE Combat

Primary files:
- `lib/pathway-pve.js`
- `js/pathway-pve.js`
- shared provider registration in `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`
- focused regression suite: `scripts/smoke-pve.mjs`

Routes:
- **Combat Foundations — Scan, Fight, Cash In**
- **Bounty Hunter — Pips, Position, Pressure**
- **Conflict Zone Specialist — Survive the Battle**
- **Combat Specialist — Diagnose, Adapt, Sustain**
- **Combat Lead — Coordinate, Recover, Teach**

Progression intent:
- Beginner uses a rebuy-safe ship, confirms legal WANTED targets before firing where local law applies, practices active pip management and fight selection, learns to disengage before destruction is inevitable, returns/cashes bounty vouchers, then completes a short independent three-kill bounty session.
- Bounty Hunter measures an honest session, improves fire-group logic, proactive pip rhythm, useful time-on-target, purposeful subsystem targeting, and sustained-session resource management before testing one measured change.
- Conflict Zone Specialist audits for sustained pressure, stays integrated with friendly pressure, prioritizes useful targets, maintains battlefield awareness, increases difficulty deliberately, practices wing focus/recovery, and checks **Daily Orders / Mission Control** before assuming a CZ result helps current BGS/squad strategy.
- Combat Specialist uses a repeatable difficult benchmark to separate applied damage, defensive failure, resource limits, and technique problems; changes one measured issue and retests it.
- Veteran/Mentor route focuses on objective/stop-condition planning, target calls, focus fire, recovery, mentoring, and debrief.

Important guardrails:
- no particular combat hull is mandatory; the Ship Catalogue provides Mongrel examples, not gates;
- beginner progression prioritizes control, legality, pips, target choice, survival, and return before damage optimization;
- PvE teaches NPC combat and squad combat operations. PvP is a separate Pathway because human-opponent prediction, range control, matchup knowledge, Open survival, and organized PvP require their own progression.

### PvP

Primary files:
- `lib/pathway-pvp.js`
- `js/pathway-pvp.js`
- shared provider registration in `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`
- focused regression suite: `scripts/smoke-pvp.mjs`

Routes:
- **PvP Foundations — Survive, Fight, Learn**
- **Duelist — Range, Pips & Pressure**
- **Precision Fighter — Aim, Prediction & Weapon Application**
- **Wing Fighter — Focus, Comms & Mutual Support**
- **PvP Lead — Plan, Command, Teach**

Core doctrine:
- Open Play is the squad standard;
- combat logging is not an escape technique;
- beginners use a rebuy-safe learning platform rather than being forced into one meta hull;
- controlled squadmate drills teach pips, movement, legitimate disengagement, and debrief before random hostile encounters become the main teacher;
- later progression develops range control, precision application, matchup diagnosis, focus fire, concise comms, leadership, and mentoring.

### Operations

Primary files:
- `lib/pathway-operations.js`
- `js/pathway-operations.js`
- shared provider registration in `functions/api/pathway/assignments.js`
- visible catalog label in `functions/api/pathway/preferences.js`
- personalized Assistant integration in `lib/assistant-pathway-context.js`
- mount in `pathway/index.html`
- focused regression suite: `scripts/smoke-operations.mjs`

Routes:
- **Operations Foundations — Launch, Adapt, Extract**
- **Multi-Role Operator — Ship, Foot & Transition**
- **Scenario Specialist — Pick the Right Job**
- **Hard Operations Specialist — Sustain Under Pressure**
- **Operations Lead — Brief, Adapt, Teach**

Progression intent:
- Beginner learns the complete Runner loop: choose a manageable scenario → prepare both ship and suit/on-foot capability → deploy → handle a real phase transition → recover/redeploy if needed → extract → verify reward → repeat independently.
- Multi-Role Operator develops ship-role discipline, on-foot objective discipline, explicit handoffs, redundancy, and mixed-phase bottleneck diagnosis.
- Scenario Specialist builds breadth across multiple scenario types, matches squad capability to mission demand, chooses Easy/Hard for evidence-based reasons, and ties Merc Coin or training goals to scenario choice.
- Hard Operations Specialist uses a repeatable benchmark, manages whole-run resources, keeps role discipline under pressure, identifies the first repeatable failure mode, changes one major variable, and retests or deliberately changes difficulty/scenario.
- Veteran/Mentor route plans sessions, assigns primary/secondary roles and redundancy, adapts the plan, recovers the squad, mentors another operator, and preserves useful debriefs.

Important naming / architecture guardrail:
- user-facing feature name is **Operations**, never the legacy “Surface Operations” label;
- `surface` remains the persisted activity ID only for backwards compatibility;
- `operations` remains the separate **Squad Operations** / Mission Control / Daily Orders activity;
- literal uses of “surface” in unrelated domains (surface mining, planetary surface travel, etc.) remain valid.

### Colonization

Primary files:
- `lib/pathway-colonization.js`
- `js/pathway-colonization.js`
- shared provider registration in `functions/api/pathway/assignments.js`
- personalized Assistant integration in `lib/assistant-pathway-context.js`
- mount in `pathway/index.html`
- focused regression suite: `scripts/smoke-colonization.mjs`

Routes:
- **Colonization Foundations — Join a Build, Finish a Loop**
- **Construction Operator — Supply, Stage, Close**
- **System Architect — Claim With a Purpose**
- **Colony Developer — Build a System, Not a Pile of Sites**
- **Colonization Lead — Plan, Coordinate, Teach**

Progression intent:
- Beginner joins a real current project, understands the claim/primary-port/construction loop, uses an existing suitable ship, sources only what the build still needs, contributes cargo through the correct construction interface, verifies the requirement changed, observes the next state, then repeats the support loop independently.
- Construction Operator manages accurate requirement snapshots, sensible load splitting, optional carrier staging, live multi-hauler updates, bottleneck diagnosis, and clean closeout/handoff.
- System Architect defines system purpose, evaluates the candidate system, performs or shadows the claim sequence, compares primary-port choices, drafts the first build sequence, reality-checks logistics burden, and produces an actionable squad brief.
- Colony Developer chooses one measurable development goal, records a baseline, selects one build or operational intervention, measures the result after activation, and preserves evidence/uncertainty for later decisions.
- Veteran/Mentor route plans a staged colony project, assigns logistics/scouting/construction/reporting work, tracks the live bottleneck, adapts the plan, mentors another Commander, and preserves a useful debrief.

Important guardrails:
- **ownership is not required for beginner progression**; supporting another Mongrel's active colony is a valid learning path;
- current in-game construction requirements beat old screenshots, estimates, or planned future needs;
- Fleet Carriers are optional logistics tools, not mandatory extra handling;
- primary-port and build-sequence decisions should follow the colony's actual purpose rather than prestige;
- economy/system-stat effects can be moving or partially opaque, so later development emphasizes observed results over false certainty;
- Projects & Events is the natural coordination surface for live colony work.

---

## Engineering Campaign Planner

Framework files:
- `lib/engineering-campaign.js`
- `lib/engineering-campaign-data.js`
- `lib/engineering-campaign-shields.js`
- `lib/engineering-campaign-jump-range.js`
- `lib/engineering-campaign-mobility.js`
- `lib/engineering-campaign-distributor.js`
- `lib/engineering-campaign-power-thermal.js`
- `lib/engineering-campaign-weapons.js`
- `functions/api/pathway/engineering-campaign.js`
- `js/engineering-campaign-planner.js`
- `css/engineering-campaign-planner.css`

Storage:
- `PROJECTS`
- `engineering-campaign-v1:<ownerId>`

Pacing rule: never hide a multi-hour/day prerequisite chain inside an ordinary-looking task. Partial improvement is valid. No-engineering/G1/G2/G3 can all be legitimate stopping points when the measured problem is solved.

Dependency principles:
- facts completing a node unlock downstream work exactly like manual completion;
- later/permanent access may prove earlier prerequisites were satisfied;
- never force experienced Commanders to reconstruct historical counters when a later access milestone already proves the chain;
- generic setup stops at **assess current state → choose useful stopping point → map dependencies**;
- material planning occurs only after the goal-specific module/blueprint choice is known.

Six audited campaigns are implemented:
1. **Improve Shields** — useful G2/G3 Shield Generator phase; reuses Dweller/Lei access; G2 is a valid stop.
2. **Improve Jump Range** — G2 Increased Range FSD first; reuses Felicity/First Win; experimental and G3 are separate optional jobs.
3. **Improve Speed & Mobility** — G2 Thrusters first; Felicity reuse; fly/test before experimental/G3.
4. **Improve Power Distributor** — diagnose SYS/ENG/WEP behavior; The Dweller reuse; G2/experimental/G3 stops.
5. **Improve Power & Heat** — test module priorities first; Power Plant G1/G2/experimental/G3 only if the measured problem remains.
6. **Improve Weapon Package** — treat hardpoints as one package; layout-only stop, representative G2 test slice, optional experimentals, full G2 rollout, selective G3. Engineer access is deliberately weapon-family-specific.

### Campaign Planner UI

My Pathway → Engineering hosts a collapsed **Campaign Planner** above the Prep Tracker.

Inactive state:
- compact selector for the six audited campaigns;
- asks for ship and specific problem/goal;
- visible history capped at 4;
- paused campaigns Resume;
- completed campaigns Reopen;
- Remove from History archives instead of deleting shared facts.

Active state:
- one next step at a time;
- progress meter;
- trusted resource links;
- permanent-access shortcut buttons where safe;
- counter steps open the Prep Tracker;
- compact step history with correction actions;
- Pause Campaign;
- goal-aware Take-the-Win copy.

Plain-language explanatory label is **Why this is a separate step**.

`js/engineering-campaign-planner.js` and `js/engineering-prep-tracker.js` synchronize through `mongrels:engineering-campaign-updated`.

**Development direction:** the six-campaign Engineering expansion block is intentionally paused. Do **not** continue adding Engineering campaigns by default. A whole-ship / Ship Architect campaign remains a later candidate after broader Pathway coverage exists.

---

## Engineering Prep Tracker / cross-path prep

Current numeric facts:
- `trade.markets-visited-distinct`
- `trade.black-markets-used-distinct`
- `mining.ore-mined-total-tonnes`

Visible milestones:
- 50 distinct commodity markets for Lei Cheung preparation;
- 5 distinct black markets for The Dweller preparation;
- 500 tonnes mined for Selene Jean's meeting requirement; this does **not** imply Selene is fully unlocked.

Prep Tracker supports quick adds, exact actual progress, and Set / Correct Total.

Primary cross-path files:
- `lib/pathway-engineering-prep.js`
- `lib/pathway-engineering-prep-facts.js`
- `js/pathway-engineering-prep.js`
- `functions/api/pathway/assignments.js`
- `functions/api/pathway/engineering-campaign.js`

Rules:
- relevant Trade assignments may optionally record **genuinely new** commodity markets toward Lei Cheung;
- relevant Mining assignments may optionally record **actual ore mined** toward Selene Jean;
- never auto-award unique markets, black markets, tonnage, or similar prerequisites from ordinary task completion;
- the Commander explicitly records what actually happened;
- optional Engineering prep does not complete, score, block, or modify the source Pathway assignment;
- resetting/changing the source activity route does not erase the shared Engineering fact;
- Ask the Mongrels may explain current-task overlap but remains read-only.

---

## Community Goal Hauler Prep — Trade specialty

Primary files:
- `lib/pathway-cg-hauler-prep.js`
- `functions/api/pathway/cg-hauler-prep.js`
- `js/cg-hauler-prep.js`
- `css/cg-hauler-prep.css`
- mount in `pathway/index.html`

Storage:
- `PROJECTS`
- `specialty-cg-hauler-v1:<ownerId>`

Core doctrine:
> **The win condition is survive and deliver. Killing the attacker is not required.**

This is nested inside **My Pathway → Trade & Hauling**, not a separate top-level provider.

Status semantics mirror Pathway: Complete/Already Know earn credit; Skip does not; untouched pending work comes before skipped work; specialty progress is independent of the main Trade route.

The 14-step progression moves from a real existing hauler and baseline through survivability/power/heat, pips/boost, high-vs-low-wake planning, interdiction response, controlled squadmate escape practice, busy-system awareness, pressure docking, escort/comms, contingency planning, and a hostile-delivery capstone.

---

## First Engineering Win

Optional Start Here onboarding. It can appear even if Engineering is not selected and stops nagging after completion/dismissal.

Implementation:
- `lib/engineering-campaign-data.js`
- `/api/pathway/engineering-campaign`
- `js/first-engineering-win.js`
- `css/first-engineering-win.css`
- `start/index.html`

Current code contains **18 small steps**.

Default target:
- FSD G2 Increased Range;
- range-focused experimental as a separate small job;
- replot/test a familiar trip.

UX:
- one current step;
- progress meter;
- Done / Already Did This;
- Undo Previous Step, including after final completion;
- Hide this starter.

The Felicity path includes dedicated Deciat/Open safety guidance: rebuy, protect exploration data, high vs low wake, preselected escape system, minimize Meta-Alloy exposure, optional Mongrel escort.

Wolf validated the card and Undo behavior on phone, but not the complete in-game sequence.

---

## Squadron Announcements

Primary files:
- `announcements/index.html`
- `css/announcements.css`
- `js/announcements.js`
- `functions/api/announcements/index.js`
- `lib/announcements-discord.js`
- `lib/discord-webhook.js`
- `scripts/smoke-announcements.mjs`

Architecture:
- the website is the authoritative announcement record; Discord is the delivery surface;
- announcements are member-only on the website;
- initial authoring authority is **Site Admin only**;
- storage uses the existing `PROJECTS` KV binding under `announcements-v1`;
- drafts are private to Site Admin;
- published announcements are visible to members and publish through the dedicated `DISCORD_ANNOUNCEMENTS_WEBHOOK_URL`;
- editing a published announcement updates the tracked Discord message rather than creating a duplicate;
- if the tracked Discord message was removed, a later sync may recreate it;
- archiving preserves the website record and leaves the Discord historical post intact;
- archived announcements are read-only until restored;
- changing the configured announcements webhook creates future/tracked delivery in the newly configured channel; do not assume an old-channel message can be edited by a different webhook.

This is the first feature in the broader Squad Communications direction. Future Events, Rules, Training Resources, Squadron Structure, role/job selection, and similar communication surfaces should reuse this source-of-truth + delivery pattern when appropriate rather than creating parallel Discord-only records.

## Squad Events / RSVPs

Primary files:
- `projects/index.html`
- `js/projects.js`
- `css/projects-events-v2.css`
- `functions/api/projects/index.js`
- `functions/api/projects/rsvp.js`
- `functions/api/discord/interactions.js`
- `lib/squad-events.js`
- `scripts/smoke-squad-events.mjs`

Architecture:
- Squad Events reuse the existing Projects & Events `board-v1` record in `PROJECTS`; do not create a parallel event database.
- Officers / Site Admin create events through Projects & Events. Existing member Project behavior remains unchanged.
- Event statuses include Planning, Active, Paused, Cancelled, and Complete.
- Planning events remain website-only until activated.
- Active events publish a bot-owned message to the configured `DISCORD_SQUAD_EVENTS_CHANNEL_ID`.
- Event edits update the tracked Discord message instead of creating duplicates.
- Cancelled / Complete events remain in website history and keep the Discord event card, but RSVP buttons become disabled.
- A Discord-posted event cannot be hard-deleted through the ordinary Projects editor; cancel or complete it instead so communication history is preserved.
- Website and Discord both support one RSVP per Discord user: Going, Maybe, or Can’t Make It. Changing the choice replaces that member's prior RSVP.
- RSVP counts and member-name rosters are rendered on the website and Discord event card.
- Projects/Event KV reads explicitly use Cloudflare KV `cacheTtl:30` to reduce cross-location RSVP staleness from the previous default window.
- The Projects & Events client checks quietly every 5 seconds while visible, but only rerenders when returned board data changes; Discord-originated RSVP updates should therefore surface automatically once the 30-second KV cache can see them.
- Discord buttons use the existing Imperial Mongrels Website interaction endpoint and existing Ed25519 verification / bot token. No second Discord app is needed.
- By default the existing bot auto-discovers a Discord text/announcement channel named exactly `squad-events` using the existing `GUILD_ID`; no new Cloudflare value is required for that normal path.
- `DISCORD_SQUAD_EVENTS_CHANNEL_ID` remains an optional explicit override if the event channel uses a different name or discovery should be bypassed.
- The existing bot must be able to view the channel, send messages, and embed links.
- The event card uses legacy Action Row/Button message components, which remain supported by Discord; custom IDs route back to the existing `/api/discord/interactions` handler.
- The website remains authoritative; Discord is an interaction and delivery surface.

Concurrency note:
- current RSVP state is stored inside the authoritative event record in `board-v1`. This is appropriate for current squad scale, but if RSVP traffic becomes highly concurrent, migrate RSVP writes to a stronger serialized store rather than creating silent last-write-wins behavior.

## Recruitment / Discord integration

Use the existing Discord app/bot **Imperial Mongrels Website**.

Recruitment requires both:
1. website application; and
2. Elite Dangerous Squadron application to **Regiment of Imperial Mongrels [R1MM]**.

The website cannot accept the in-game application. After leadership accepts it in Elite, the applicant must confirm/join in-game.

Application statuses:
- draft
- submitted
- under_review
- accepted
- declined

Accepted/Declined are terminal in the normal workflow. Discord Member role assignment must succeed before website acceptance is finalized. Private officer notes never become applicant-facing decline text.

---

## Current roadmap

Broad core Pathway coverage is nearly complete. Colonization is now implemented, leaving:
- **Squadron Operations** — next definite full Pathway, centered on Mission Control, Daily Orders, Projects, carrier coordination, BGS execution, cross-activity support, reporting, and leadership.
- **Powerplay** — conditional final Pathway; build only when squad doctrine is mature enough to support stable teaching instead of immediate rewrites.

Do not automatically build every item without inspecting current authoritative site content first. Specialty paths should normally live inside the most relevant full Pathway unless there is a strong information-architecture reason to promote them.

Engineering campaign expansion stays paused while the site gets broader. The whole-ship / Ship Architect Engineering campaign is intentionally deferred.

---

## Validation status

Validated / accepted by Wolf or CI:
- original AX beginner route direction;
- Start Here random-task cards/carousel;
- compact navigation focus mode;
- full My Pathway assignment loading after restoring shared assignment API helpers;
- First Engineering Win card and Undo behavior on phone;
- Engineering Prep Tracker concept/styling;
- initial Improve Shields Campaign Planner review including Reopen / Remove from History wording;
- automated workflow through **run #126**, including focused Exobiology, PvE Combat, PvP, Operations, and Colonization regression suites, all six Engineering campaigns, Community Goal Hauler Prep, cross-path Engineering Prep, personalized Assistant context, API imports, and key page wiring.

Implemented but **not yet production-validated unless Wolf later confirms/live checks succeed**:
- **Exploration full Pathway** — all five routes, My Pathway UI, progress persistence, generic-card suppression, and Assistant context;
- **Exobiology full Pathway** — all five routes, My Pathway UI, progress persistence, generic-card suppression, Assistant context, and Activities-hub status;
- **PvE Combat full Pathway** — all five routes, My Pathway UI, progress persistence, generic-card suppression, Assistant context, CZ → Daily Orders operational handoff, and Activities-hub status;
- **PvP full Pathway** — all five routes, My Pathway UI, progress persistence, generic-card suppression, Assistant context, PvP-hub linkage, and focused regression coverage;
- **Operations full Pathway** — all five routes, mixed ship/on-foot beginner flow, My Pathway UI, progress persistence, generic-card suppression, Assistant context, Activities-hub status, and visible Operations naming;
- **Colonization full Pathway** — all five routes, no-ownership beginner support loop, My Pathway UI, progress persistence, generic-card suppression, Assistant context, Activities-hub status, System Architect claim/primary-port training, and focused regression coverage;
- Improve Jump Range;
- Improve Speed & Mobility;
- Improve Power Distributor;
- Improve Power & Heat;
- Improve Weapon Package;
- cross-path Engineering Prep on relevant Trade/Mining assignments;
- Community Goal Hauler Prep full progression;
- personalized Ask the Mongrels Pathway/campaign/specialty/cross-path context under real member state;
- full end-to-end Engineering campaign gameplay sequences;
- fact-completed dependency propagation / later-access prerequisite supersession under real member state;
- Campaign Planner ↔ Prep Tracker live synchronization under all campaign cases;
- 1061–1280 compressed tablet/iPad navigation;
- generalized Assistant navigation buttons;
- Mission Control faction-presence Assistant selection guardrail;
- latest direct Carrier Coordination / Member Portal anchors;
- Trade v2, Carrier Logistics, Engineering full Pathways under full production review;
- latest numeric Engineering Prep layout;
- Engineering route filtering;
- latest collapsible My Pathway category UX;
- complete First Engineering Win in-game sequence.

Production deployment can lag GitHub commits. Always distinguish **committed / CI-checked** from **confirmed live / production-validated**.
