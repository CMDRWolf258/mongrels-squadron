# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-16_

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

## Product architecture / development behavior

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

### Automated smoke tests

Primary files:
- `scripts/smoke-test.mjs`
- `.github/workflows/site-smoke-tests.yml`

The Node smoke suite runs on pull requests and normal pushes to `main`; commits that only refresh `data/live-bgs.json` are ignored. It can also be run manually.

Current checks include:
- all six full Pathway provider catalogs remain structurally valid;
- cross-path Engineering Prep mappings point only to real current Trade/Mining tasks and tracked Engineering facts;
- Engineering campaign fact-completed dependency propagation works;
- Improve Shields honors later/persistent Lei/Dweller access instead of forcing historical counters;
- Improve Jump Range reuses First Engineering Win Scout/Felicity/G2 progress;
- Improve Speed & Mobility reuses existing Felicity access/reputation;
- Improve Power Distributor reuses The Dweller reputation proved by Improve Shields / Lei referral progress;
- Improve Power & Heat reuses existing Felicity/higher-grade Power Plant access and preserves its no-engineering/G1/G2/experimental/G3 stopping points;
- **Improve Weapon Package preserves layout-only/G2/experimental/full-package/G3 stopping points and deliberately refuses to auto-clear weapon Engineer access from a generic saved Engineer fact;**
- Community Goal Hauler Prep keeps 14 unique steps and the survive-and-deliver doctrine;
- Ask the Mongrels can read query-selected Pathway/campaign/specialty/cross-path-prep context;
- critical Cloudflare Function modules import cleanly and retain `headers()` / `reply()` helpers;
- critical pages/assets are present and wired.

Notable successful runs:
- #5 — Assistant Pathway intent wording;
- #13 — Jump Range cross-campaign reuse;
- #20 — Mobility/Felicity reuse;
- #28 — Community Goal Hauler Prep;
- #40 — cross-path Trade/Mining Engineering Prep;
- #47 — Power Distributor / The Dweller reuse;
- #54 — Power & Heat / Felicity and higher-grade Power Plant access reuse;
- **#61 — Weapon Package package-first flow, family-specific Engineer guardrail, Assistant context, and page wiring.**

The smoke suite is a regression safety net, **not** a browser or production test.

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
- **>=1281px:** normal desktop navigation;
- **1061–1280px:** compressed but fully visible navigation; smaller logo, hidden brand subtitle, tighter spacing;
- **<=1060px:** compact `MENU` drawer.

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
- desktop/tablet: **Command → Carrier Coordination**;
- compact: **MENU → Command → Carrier Coordination**;
- member alternate: member button → Member Portal → Carrier Coordination → Open Carrier Board;
- create: New Coordination Post → Activity: Loading.

### Mission Control Assistant filtering

Mission Control system data is query-filtered before being sent to the Assistant. An empty filtered subset does **not** mean Mission Control has no systems. Preserve authoritative totals and the selector metadata.

Faction-presence wording such as “what systems our faction is in,” “where are we present,” “territory,” and “footprint” should return an active-presence subset while preserving the authoritative total.

### Personalized My Pathway context

`lib/assistant-pathway-context.js` gives query-selective, read-only access to the authenticated member's own Pathway data.

Recognized concepts include:
- current Pathway assignment/task/step;
- Engineering Campaign Planner;
- Improve Shields;
- Improve Jump Range;
- Improve Speed & Mobility / Thrusters;
- Improve Power Distributor / distributor / capacitor campaign wording;
- Improve Power & Heat / Power Plant / thermal campaign wording;
- **Improve Weapon Package / hardpoint package / relevant weapon-family wording;**
- Engineering Prep / cross-path Engineering questions;
- CG Hauler / hostile-hauling/interdiction/escape-drill wording.

When selected, `modules.pathway` can contain:
- selected activities, priority, experience, play style, and current goal;
- relevant full-route assignment progress/current task;
- optional Engineering Prep attached to the current Trade/Mining task;
- active Engineering campaign goal/ship/progress/next step/stopping-point state;
- query-selected Community Goal Hauler Prep state.

Rules:
- only read the signed-in member's own state from `PROJECTS`;
- My Pathway/Campaign Planner/specialty UI remain authoritative;
- Assistant may explain but never write completion;
- CG Hauler state is loaded only for clearly relevant wording;
- preserve query selectivity to control prompt size/monthly AI usage.

---

## Start Here

`/start/` answers: **“What is one useful thing I can do next?”** It is intentionally lower-overwhelm than My Pathway.

Primary personalized-task files:
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

Do not add another global experience band just for Engineering; Engineering gets deeper internal campaign layers instead.

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

The right-hand **Your Pathway** area uses compact `<details>` sections. Full-route categories are:
- Anti-Xeno
- Background Simulation
- Mining
- Trade & Hauling
- Carrier Logistics
- Engineering & Shipbuilding

Rules:
- collapsed by default;
- category header controls expansion;
- multiple categories may remain open;
- each route renderer owns its own loading/visibility/content;
- do not introduce another controller that forcibly shows route roots.

A previous regression was caused by accidentally removing shared `headers()` / `reply()` helpers from `functions/api/pathway/assignments.js`; smoke tests now guard them.

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

Route references:

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

Engineering route cycling should stay within the selected experience band:
- Beginner → Foundations only
- Developing → Role Builder / Engineer Network
- Experienced → Ship Architect / Combat Systems / Role Builder
- Veteran → Mentor / Ship Architect

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
- **`lib/engineering-campaign-weapons.js`**
- `functions/api/pathway/engineering-campaign.js`
- `js/engineering-campaign-planner.js`
- `css/engineering-campaign-planner.css`

Storage:
- `PROJECTS`
- `engineering-campaign-v1:<ownerId>`

Pacing rule: never hide a multi-hour/day prerequisite chain inside an ordinary-looking task. Partial improvement is valid. No-engineering/G1/G2/G3 can all be legitimate stopping points when the measured problem is solved.

Model:
1. Goal
2. Current/shared facts
3. Dependency plan
4. Next manageable Engineering assignment
5. Optional background prep from other Pathways

Shared facts retain provenance so future trusted sync/import can write the same facts instead of creating a parallel model.

### Dependency evaluation rule

Fact-completed nodes must unlock downstream work exactly like manually completed nodes. Later/permanent access facts may prove earlier prerequisites were already satisfied. Never force an experienced Commander to reconstruct historical counters when a later Engineer-access milestone proves the chain was completed.

Generic setup deliberately stops at **assess current state → choose useful stopping point → map dependencies**. Material planning belongs inside the goal-specific graph after the module/blueprint choice is known.

### Improve Shields — first campaign

`lib/engineering-campaign-shields.js`

Purpose: useful **G2/G3 Shield Generator** phase through Lei Cheung, not an automatic G5 shield/booster grind.

Key behavior:
- choose blueprint around ship role;
- plan/gather only G1→G2;
- use shared Dweller/Lei prerequisite counters unless later access already proves them;
- engineer G2, fly/test, optionally G3;
- later Lei access supersedes old Dweller/market gates;
- G2 is an explicit Take-the-Win point.

### Improve Jump Range — second campaign

`lib/engineering-campaign-jump-range.js`

Purpose: useful **G2 Increased Range FSD** first, with the experimental and G3 as separate optional jobs.

Key behavior:
- reuse First Engineering Win Scout/Felicity/G2 facts;
- only repeat Meta-Alloy/Deciat work if Felicity is genuinely still locked;
- engineer G2 and replot/test a familiar trip;
- optional experimental and optional G3;
- G2, G2+experimental, and G3 are Take-the-Win points;
- G4/G5 deliberately deferred.

Only permanent/account-wide access is reused; an old ship's G2 module does not auto-complete a new ship's module work.

### Improve Speed & Mobility — third campaign

`lib/engineering-campaign-mobility.js`

Purpose: useful **G2 Thrusters** first, then fly/test before experimental/G3 decisions.

Key behavior:
- record practical movement baseline;
- choose Dirty/Clean/Reinforced around the ship's problem;
- reuse Felicity access/reputation from earlier campaigns;
- compare experimentals separately using actual mass/role;
- G2, G2+experimental, and G3 are Take-the-Win points;
- G4/G5 deliberately deferred.

Legacy FSD-named Felicity G2/G3 facts are Engineer-reputation proof, not module completion.

### Improve Power Distributor — fourth campaign

`lib/engineering-campaign-distributor.js`

Purpose: diagnose **SYS / ENG / WEP** behavior, build a useful G2 Power Distributor through The Dweller, test it in the real workload, then treat the experimental and G3 as optional refinements.

Rules:
- Charge Enhanced is a broad comparison, not a universal answer;
- role-specific Focused/High Capacity/Shielded choices remain valid;
- Lei referral/unlock proves enough Dweller reputation to satisfy older Distributor access gates;
- G2, G2+experimental, and G3 are Take-the-Win points;
- G4/G5 deliberately deferred.

### Improve Power & Heat — fifth campaign

`lib/engineering-campaign-power-thermal.js`

Purpose: diagnose the actual **power-budget or thermal problem** before changing the Power Plant.

Rules:
- module priorities are tested first and can be a complete no-engineering win;
- Armoured, Low Emissions, and Overcharged are chosen from the measured need;
- existing Felicity access enables a small G1 test;
- higher-grade Power Plant access is capability-based rather than forcing one Marco/Hera unlock chain;
- valid Take-the-Win points: **priority-only, G1, G2, G2+experimental, G3**;
- G4/G5 deliberately deferred.

### Improve Weapon Package — sixth campaign

`lib/engineering-campaign-weapons.js`

Purpose: treat the ship's **hardpoints as one weapon system**, not as independent modules to max one by one.

Package flow:
1. map every hardpoint, mount, current Engineering, fire group and engagement role;
2. assign package jobs such as shield pressure, hull/module damage, utility, burst/sustain, range coverage, or ammunition economy;
3. measure whole-package WEP drain, heat, deployed power, ammo, reload rhythm, range/falloff, projectile travel and convergence;
4. audit fire groups/layout/mount/range before Engineering — this is a valid layout-only Take-the-Win point;
5. choose one representative weapon family or 1–2 hardpoints as a **test slice**;
6. choose its blueprint around the package role instead of defaulting to one universal damage blueprint;
7. manually confirm a suitable G2 Engineer for that exact weapon family;
8. plan/gather only the G1→G2 test materials;
9. engineer the test slice to G2 and combat-test it inside the otherwise unchanged package;
10. optionally choose experimentals by **package function**, gather/apply them, and re-test;
11. decide what should actually roll out to the rest of the hardpoints — copying one successful test weapon everywhere is not assumed;
12. build/test the complete intended G2 package;
13. optionally confirm family-appropriate G3 access and refine only the weapons still limiting the package;
14. run the final package test and end the phase at G3 rather than silently extending to G4/G5.

Weapon-package guardrails:
- **Engineer access is deliberately manual and weapon-family-specific.** A saved “weapon Engineer” fact would be unsafe because an Engineer who handles lasers may not handle multi-cannons, plasma accelerators, or another family at the required grade.
- Current references show Tod McQuinn is a useful early path for multi-cannons/rail and some cannon/fragment work, The Dweller can cover early laser work, and Broo Tarquin takes lasers farther; other families use other Engineers. Always check current family/grade capability.
- Higher theoretical DPS is not automatically an upgrade if it damages WEP sustain, heat, ammo endurance, range application, convergence, or the ship's ability to move/defend.
- Valid Take-the-Win points: **layout-only, G2 test slice, G2+experimental test slice, full G2 package, selective G3 package**.
- G4/G5 are deliberately deferred until a later measured package limitation justifies them.

### Campaign Planner UI

My Pathway → Engineering hosts a collapsed **Campaign Planner** above the Prep Tracker.

Inactive state:
- compact selector for six audited campaigns: **Improve Shields**, **Improve Jump Range**, **Improve Speed & Mobility**, **Improve Power Distributor**, **Improve Power & Heat**, **Improve Weapon Package**;
- asks for ship and specific problem/goal;
- visible previous history capped at 4;
- paused campaigns Resume;
- completed campaigns Reopen;
- Remove from History archives instead of deleting shared facts.

Active state:
- one next step at a time;
- progress meter;
- trusted resource links;
- permanent-access shortcut buttons where safe/relevant;
- counter steps open the Prep Tracker;
- compact step history with correction actions;
- Pause Campaign;
- goal-aware Take-the-Win copy at valid stopping points.

Plain-language explanatory label is **Why this is a separate step**.

`js/engineering-campaign-planner.js` and `js/engineering-prep-tracker.js` synchronize through `mongrels:engineering-campaign-updated`.

**Development direction:** the six-campaign Engineering expansion block is now intentionally paused. Do **not** continue adding Engineering campaigns by default. The next development block should return to missing full Pathways. A whole-ship / Ship Architect campaign remains a later candidate after broader Pathway coverage exists.

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

Prep Tracker UI supports quick adds, exact actual progress, and Set / Correct Total.

Primary cross-path files:
- `lib/pathway-engineering-prep.js`
- `lib/pathway-engineering-prep-facts.js`
- `js/pathway-engineering-prep.js`
- `functions/api/pathway/assignments.js`
- `functions/api/pathway/engineering-campaign.js`

Current cross-path behavior:
- relevant Trade assignments may optionally record **genuinely new** commodity markets toward Lei Cheung;
- relevant Mining assignments may optionally record **actual ore mined** toward Selene Jean.

Critical rules:
- never auto-award unique markets, black markets, tonnage, or similar prerequisites from ordinary task completion;
- the Commander explicitly records what actually happened;
- optional Engineering prep does not complete, score, block, or modify the Trade/Mining assignment;
- resetting/changing the activity route does not erase the shared Engineering fact;
- duplicate markets are not counted twice;
- Mining tonnage reflects ore actually mined; sold cargo may be used only as a conservative lower bound if exact mined tonnage was not tracked;
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

Current 14-step progression moves from using a real existing hauler and recording a baseline through survivability/power/heat, pips/boost, high-vs-low-wake planning, interdiction response, controlled squadmate escape practice, busy-system awareness, pressure docking, escort/comms, contingency planning, and a hostile-delivery capstone.

Use Open/PvP survival skills to support the logistics mission; PvP victory is not the objective.

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

## Future Pathways / specialties and current roadmap

Missing full Pathway coverage remains the next major development priority. Planned order can be adjusted after inspecting current content, but the working direction is:
- Exploration
- Exobiology
- PvE Combat
- PvP
- Surface Operations
- Colonization
- Squadron Operations
- Powerplay only when doctrine is mature enough

Do not automatically build every item without inspecting current authoritative site content first. Specialty paths should normally live inside the most relevant full Pathway unless there is a strong information-architecture reason to promote them.

**Current roadmap decision:** after Improve Weapon Package, pause Engineering campaign expansion and return to full Pathway coverage. The whole-ship / Ship Architect Engineering campaign is intentionally deferred until the site is broader rather than deeper in Engineering alone.

---

## Validation status

Validated / accepted by Wolf or CI:
- original AX beginner route direction;
- Start Here random-task cards/carousel;
- compact navigation focus mode;
- full My Pathway assignment loading after restoring the shared assignments API response helpers;
- First Engineering Win card and Undo behavior on phone;
- Engineering Prep Tracker concept/styling;
- initial Improve Shields Campaign Planner review including Reopen / Remove from History wording;
- automated smoke suite through **run #61**, covering all six Engineering campaigns, Community Goal Hauler Prep, cross-path Trade/Mining Engineering Prep, Assistant context, API imports, and page wiring.

Implemented but **not yet production-validated unless Wolf later confirms/live checks succeed**:
- Improve Jump Range;
- Improve Speed & Mobility;
- Improve Power Distributor;
- Improve Power & Heat;
- **Improve Weapon Package**;
- cross-path Engineering Prep on relevant Trade/Mining assignments;
- Community Goal Hauler Prep full progression;
- personalized Ask the Mongrels Pathway/campaign/specialty/cross-path context;
- full end-to-end Improve Shields in-game progression;
- full end-to-end Jump Range in-game progression;
- full end-to-end Mobility in-game progression;
- full end-to-end Power Distributor in-game progression;
- full end-to-end Power & Heat in-game progression;
- full end-to-end Weapon Package in-game progression;
- fact-completed dependency propagation / later-access prerequisite supersession under real member state;
- Campaign Planner ↔ Prep Tracker live synchronization under all campaign cases;
- 1061–1280 compressed tablet/iPad navigation;
- generalized Assistant navigation buttons;
- Mission Control faction-presence Assistant selection guardrail;
- latest direct Carrier Coordination / Member Portal anchors;
- Trade v2, Carrier Logistics, Engineering full Pathways;
- latest numeric Engineering Prep layout;
- Engineering route filtering;
- latest collapsible My Pathway category UX;
- complete First Engineering Win in-game sequence.

Wolf plans to review the recent Engineering/specialty work in detail as a **batch** rather than interrupting development after each item.

Production deployment can lag GitHub commits. Always distinguish **committed** from **confirmed live**.
