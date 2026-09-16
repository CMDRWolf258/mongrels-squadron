# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-16_

## Read this first

**AI / developer handoff:** Read this file, then inspect the current repository before changing anything. The repository is the source of truth. If this document, memory, an old chat, screenshots, or release notes conflict with current code, **current code wins**.

Never reuse remembered file SHAs. Fetch the current target file immediately before modifying it and use the current SHA.

This is an architecture/handoff guide, not a changelog. Update it after meaningful workflow, permission, storage, integration, navigation, Pathway, or project-direction changes.

---

## Project identity

- **Squadron:** Regiment of Imperial Mongrels
- **Commander / Site Admin:** CMDR Wolf258 (Wolf)
- **Official home:** Diaba
- **Repository:** `CMDRWolf258/mongrels-squadron`
- **Production:** `https://mongrels-squadron.pages.dev/`
- **Hosting/runtime:** Cloudflare Pages + Pages Functions + KV-backed server features
- **Theme:** black/charcoal with cyan/blue; restrained military/HUD styling
- **Navigation convention:** use **CARRIERS**, not Fleet

The site is both a public squadron presence and a private operational platform: recruitment, Discord integration, member auth, Mission Control/BGS, projects, carriers, trading, PvP, profiles/roster, guides, gallery, Ask the Mongrels, Start Here, and My Pathway.

---

## Product architecture

### Website vs Discord

- **Website = structured source of truth** for applications, profiles, projects, tasking, status, pathway preferences/progress, campaign state, and admin workflows.
- **Discord = identity/community + communication + notifications + immediate coordination.**

Do not duplicate structured website workflows into Discord unless there is a clear reason.

### Mobile/tablet

Wolf travels often and uses desktop, phone, and iPad. Admin/member tools must remain practical on smaller screens.

### Development behavior

- Prefer direct GitHub implementation; Wolf usually does not want manual whole-file replacement.
- Keep progress updates short during multi-step work.
- GitHub commit success does **not** prove Cloudflare deployment. Do not call a feature live/validated unless production is actually checked or Wolf confirms it.
- Avoid base64 image workflows unless truly necessary; prefer normal repo assets.

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

Never expose secrets such as:
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`

Important KV bindings:
- **`PROJECTS`** — applications, profiles, Discord onboarding, member onboarding, My Pathway preferences/progress, Start Here daily tasks, Engineering campaigns/facts, and related structured state.
- **`DAILY_ORDERS`** — private Mission Control/BGS strategy/configuration.

Do not create a new KV namespace casually when an existing binding is appropriate.

---

## Navigation / information architecture

Canonical grouped navigation is owned by:
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

### Compact/mobile focus mode

The compact drawer had a persistent issue where opening Activities could appear already scrolled down. The accepted solution is **focus mode**: when one top-level group is open, other top-level links/groups disappear, the active group owns the drawer, the drawer scrolls as a whole, and the active summary remains sticky. Closing the group restores the root list.

Wolf reported this behavior was doing okay after the fix, so treat it as provisionally validated.

Legacy cleanup:
- `js/navigation-v2.js` is now only a compatibility shim; canonical behavior belongs to `js/site.js`.
- `css/hubs.css` no longer owns the old grouped-nav prototype CSS.
- `activities/index.html` may still contain an obsolete legacy `navigation-v2.js` reference; removing remaining references is low-priority cleanup after stability is confirmed.

---

## Start Here

`/start/` answers: **“What is one useful thing I can do next?”** It is intentionally lower-overwhelm than My Pathway.

### Personalized daily tasks

Primary files:
- `start/index.html`
- `js/start-tasks.js`
- `css/start-tasks.css`
- `functions/api/start/tasks.js`
- `lib/start-tasks.js`

API:
- `/api/start/tasks`

Storage:
- `PROJECTS`
- prefix `start-daily-v1:` + local date + Discord owner ID

Rules:
- public page, but personalized tasks require Member / Officer / Site Admin.
- categories come from My Pathway preferences but daily tasks **never change Pathway progress**.
- task kinds: Activity Task, Challenge, Squad Opportunity.
- maximum **3 reveals per category per local calendar day**, server-authoritative.
- all revealed options stay saved for that day and display in a carousel; one at a time with previous/next controls and `N / count`.
- Wolf validated the daily-task cards/carousel visually.
- BGS/Squad Operations may inject a live Mission Control opportunity; it always directs the user to authoritative Daily Orders before acting.

---

## My Pathway — core model

Primary shared files:
- `pathway/index.html`
- `css/pathway.css`
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

Do **not** add another global experience band just to give Engineering more room. Engineering gets extra internal campaign layers instead.

Task statuses:
- Complete
- Already Know / Have This
- Skip for Now
- pending/reopen

Only Complete and Already Know earn progress credit. Skip for Now does not; skipped work resurfaces after untouched pending work is exhausted.

Assignment types:
- Learn
- Build
- Demonstrate
- Challenge
- Wing / Team
- Teach / Mentor

### Lasting Pathway design rule

Beginner assignments should generally **teach through actions before analysis**.

Preferred progression:

> **Do → observe → compare → understand → optimize → lead/teach**

Use one primary concept/capability per early assignment when practical. Avoid turning beginner tasks into multi-variable mini-textbooks. AX is the reference roadmap style: discrete concrete capabilities with visible progression.

---

## Shared full-pathway engine

`functions/api/pathway/assignments.js` hosts the provider registry and shared progress behavior.

Current full pathway providers:
1. Anti-Xeno — seed `ax-v2`
2. BGS — seed `bgs-v1`
3. Mining — seed `mining-v1`
4. Trade & Hauling — seed `trade-v2`
5. Carrier Logistics — seed `carrier-logistics-v1`
6. Engineering & Shipbuilding — seed `engineering-v1`

Each provider keeps independent per-activity progress in `PROJECTS`.

`js/pathway-full-routes.js` removes old generic recommendation cards for activities that now have full route engines.

---

## Anti-Xeno pathway

Reference-standard route families:
- Scout School — Vulture
- Interceptor Academy — Chieftain
- Interceptor Hunter — Basilisk
- Guardian Systems — AX Specialist
- Hellhound Development — Hunt, Lead, Teach

Hellhound work includes Medusa, AXCZ/wing work, engagement leadership, helping a less-experienced Mongrel through a first Interceptor without carrying them, build review, Hydra wing contribution, diagnosis, and teach-back.

---

## BGS pathway

Primary route families:
- Foundations — Read Before You Push
- Operator — Execute With Precision
- Strategist — Shape the Board
- Lead/Mentor — Plan, Calibrate, Teach

Critical doctrine:
- mission **INF = mission influence reward ticks/pips, not faction influence percentage**.
- read the whole faction board and issuer/target/destination/reward.
- bounty vouchers ≠ combat bonds.
- control ≠ asset ownership.
- match the lever to the objective.
- use quantified orders and stop conditions.
- use post-tick feedback.

Mission Control is member-only and remains authoritative for live squad BGS instructions.

---

## Mining pathway

Route families:
- Mining Foundations — First Full Loop
- Efficient Miner — Find Bottleneck
- Advanced Extraction — Core/Subsurface/Surface
- Rhino Field Operations
- Mining Specialist — Scout/Compare/Support
- Mining Lead — Survey/Coordinate/Teach

Grounded in the Mining Field Manual and Rhino workflow, not a separate duplicated knowledge base.

---

## Trade & Hauling pathway — v2

Trade was rewritten after Wolf identified that early tasks were combining too many concepts.

Current route families:
- Trade Foundations — Build, Haul, Discover
- Route Runner — Learn What Makes a Route Good
- Medium-Pad Specialist — Access Over Raw Capacity
- Strategic Hauler — Move What the Pack Needs
- Market Specialist — Verify, Benchmark, Adapt
- Logistics Lead — Plan, Coordinate, Teach

Beginner progression intentionally starts with a simple hauler, a cheap low-margin haul, finding/buying/selling Silver, comparing payouts, an outpost trade, choosing another commodity, then completing a profitable trade without instructions.

Trade seed is `trade-v2`. Materially rewritten beginner/developing task IDs use `-v2` so stale completions do not falsely credit new lessons.

Trade participates in carrier load/unload work, but **carrier ownership, movement, tritium, jump planning, staging, and carrier-operation leadership belong to Carrier Logistics**.

---

## Carrier Logistics pathway

Route families:
- Carrier Foundations — Join the Operation
- Carrier Crew — Load, Move, Unload
- Cargo Coordinator — Stage, Measure, Control
- Movement Planner — Jumps, Tritium, Timing
- Carrier Logistics Lead — Plan, Recover, Teach

Carrier ownership is not required. Skills that can be demonstrated alongside another Mongrel carrier owner should not be gated by wealth/ownership.

---

## Engineering & Shipbuilding pathway

Full route families:
- Engineering Foundations — Improve One Ship
- Engineer Network — Unlock, Gather, Pin
- Role Builder — Make the Whole Ship Agree
- Combat Systems — Weapons, Defense, Core Tradeoffs
- Ship Architect — Diagnose, Test, Refine
- Engineering Mentor — Review, Explain, Teach

### Engineering pacing rule

Engineering is unusually grind-heavy and dangerous for new-player retention. Never hide a multi-hour or multi-day prerequisite chain inside one innocent-looking assignment.

Large goals should be decomposed into small milestones with frequent stopping points and visible payoff. Partial improvement is valid; G5 is not the only meaningful definition of success.

### Engineering Campaign Planner

Framework files:
- `lib/engineering-campaign.js`
- `lib/engineering-campaign-data.js`
- `functions/api/pathway/engineering-campaign.js`

Storage:
- `PROJECTS`
- prefix `engineering-campaign-v1:<ownerId>`

Model:
1. **Goal** — what the Commander wants to improve.
2. **Current/shared facts** — engineer access, cumulative prerequisites, etc.
3. **Dependency plan** — data-driven chain between current state and next useful stopping point.
4. **Next Engineering assignment** — one manageable step.
5. **Background Prep** — optional Engineering progress that another pathway can expose without hijacking that pathway.

Campaign history can be paused/reused. Shared facts live separately from a single campaign so prior work can satisfy future goals. Facts keep provenance (`manual` today; future trusted import/sync can use server-owned provenance without replacing the model).

Current goal catalog includes shields, jump range, mobility, distributor, power/thermal, weapons, and whole-ship role build.

### Cumulative prerequisite tracking

Requirements such as “trade at 50 markets” are numeric facts, not binary Complete buttons.

Current tracked counters include:
- `trade.markets-visited-distinct`
- `trade.black-markets-used-distinct`

API supports:
- adding actual progress (`+3`, not pretending a suggested 5 was completed);
- correcting the cumulative total;
- provenance that leaves room for future sync/import.

Manual precise tracking is the practical v1. Frontier/telemetry automation may be investigated later, but the campaign must remain useful without it.

---

## First Engineering Win — default gentle onboarding

First Engineering Win is an optional automatic onboarding layer designed to open the door to Engineering even if a new member never selects Engineering as a Pathway interest.

Purpose:
- reduce apprehension around Engineering;
- deliver one obvious quality-of-life improvement that nearly every play style benefits from;
- teach that partial engineering is useful;
- create curiosity rather than force a grind.

Default goal:
- take an FSD to **G2 Increased Range**;
- add the appropriate range-focused experimental (normally Mass Manager; small-drive edge cases can differ deliberately);
- replot a familiar trip and feel the travel improvement.

Implementation:
- `lib/engineering-campaign-data.js` defines the audited starter sequence.
- `/api/pathway/engineering-campaign` returns `firstEngineeringWin` state.
- `js/first-engineering-win.js` renders the Start Here card.
- `css/first-engineering-win.css` styles it.
- `start/index.html` hosts it.

UX:
- signed-in members see **one current step at a time**, not the full chain.
- progress meter shows overall progress.
- `Done / Already Did This` advances one step.
- **Undo Previous Step** reopens only the most recently completed step; this is available during normal progression and immediately after the final completion screen.
- `Hide this starter` dismisses the optional onboarding.
- once completed or dismissed, it stops nagging the member.

Current sequence is deliberately many small cards (~17) rather than a few hidden-grind tasks. It covers choosing a ship, baseline, Scout check/earn-if-needed, current Meta-Alloy sourcing, one Meta-Alloy, G1→G2 material planning, targeted gathering, Deciat safety, Felicity unlock/reputation, G1, complete G2 stopping point, experimental planning/materials, experimental, and payoff test.

### Felicity / Deciat safety

Felicity Farseer path currently assumes:
- Exploration rank Scout or higher to meet her;
- 1 Meta-Alloy to unlock;
- Increased Range FSD capability through the needed grades.

Before the Meta-Alloy delivery, the starter has a dedicated **Prepare for Deciat** safety step. Deciat is treated as a known Open-player traffic/ganking hotspot because Felicity attracts newer Commanders carrying unlock cargo.

The safety step covers:
- rebuy;
- selling exploration data the Commander does not want to risk;
- high wake vs low wake;
- preselecting an escape system;
- avoiding unnecessary lingering with Meta-Alloy aboard;
- explicitly asking a Mongrel for escort/experienced wingmate if desired.

This is a small survival-awareness lesson, not full PvP training.

Meta-Alloy source guidance uses current market data rather than blindly hard-coding Maia; Darnielle’s Progress is the traditional reference but supply should be checked.

The G1/G2 plan uses current blueprint recipes and acknowledges deterministic engineering rolls since the 2024 rebalance while allowing engineer reputation to affect number of rolls. Mass Manager is deliberately a separate mini-project after the G2 stopping point.

---

## Specialty / scenario pathways — future layer

Specialty pathways intentionally combine several core competencies around a scenario instead of replacing core activity pathways.

### Community Goal Hauler Prep — queued

First planned cross-discipline scenario pathway.

Concept:
- start with the player’s **existing cargo ship**, not a required meta hull;
- balance cargo, speed, shields/hull, utilities, power, engineering, and survival;
- teach the hauler’s win condition: **survive and deliver**, not kill the attacker;
- practice interdiction/escape decisions, pip/boost discipline, high wake vs low wake;
- use controlled mock hostile deliveries with Mongrel PvPers;
- include Mongrel escort request/rendezvous/comms/contingency planning;
- capstone can be a real Community Goal or simulated hostile logistics operation.

Likely prerequisites/signals: Trade plus some Engineering knowledge. PvP experience should help but should not be mandatory.

---

## Other likely future core pathways

Still likely candidates:
- Exploration
- Exobiology
- PvE Combat
- PvP
- Surface Operations
- Colonization
- Squadron Operations
- Powerplay when doctrine is mature enough

Do not automatically build all of these. Inspect current authoritative site content first and continue applying the action-first philosophy.

---

## Recruitment / Discord integration

Use the existing Discord app/bot **Imperial Mongrels Website** rather than adding another general-purpose bot.

Recruitment requires both:
1. Mongrels website application; and
2. Elite Dangerous Squadron application to **Regiment of Imperial Mongrels [R1MM]**.

The website cannot accept the in-game application itself. After leadership accepts it in Elite, the applicant must return to Squadrons and confirm/join.

Application statuses:
- draft
- submitted
- under_review
- accepted
- declined

Important safety:
- Accepted/Declined are terminal in normal review.
- Reapplication is an explicit action from Declined.
- Member Discord role assignment must succeed before the website marks an application Accepted.
- private officer notes never become applicant-facing decline text.

New accepted members may receive `/member/` onboarding. Site Admin Lab lives at `/discord-onboarding/` and is Wolf-only.

---

## Mission Control / BGS conventions

Mission Control is member-only with refreshable faction/system data and private strategy.

Operational guidance should be quantified where possible: bounty-credit targets, mission INF targets, faction support/avoid, and stop conditions.

**INF means mission Influence reward ticks/pips, not faction influence percentage points.**

Before changing BGS thresholds/defaults, inspect current code and migration/version logic. Do not rely on old remembered values.

---

## Ask the Mongrels

The assistant uses curated site/squad knowledge and can provide stable general Elite knowledge when appropriate. It currently does not own Pathway progression state.

Pathway should tell the Commander what to accomplish without explaining every hidden prerequisite; Ask the Mongrels is the help layer when they get stuck.

High-value future improvement: include the member’s current Pathway assignment/progress in Assistant context so it can answer “how do I do this task?” without becoming the authority for completion.

---

## Validation status

Validated/accepted by Wolf:
- original AX beginner routes were useful;
- Start Here random-task cards/carousel look good;
- compact navigation focus-mode fix was doing okay after the final change;
- First Engineering Win Start Here card looks good on Wolf’s phone;
- First Engineering Win **Undo Previous Step** control works/looked good on Wolf’s phone. This validates the surface/reversal behavior, not a full in-game completion of all ~17 Engineering steps.

Implemented but **do not call production-validated unless Wolf confirms or live checks succeed**:
- Trade v2 route rewrite;
- Carrier Logistics full pathway;
- Engineering & Shipbuilding full pathway;
- Engineering Campaign Planner framework;
- numeric Engineering prerequisite-counter API;
- full in-game/end-to-end completion of the First Engineering Win audited sequence;
- assorted latest recruitment/onboarding hardening described by current code.

Production deployment can lag GitHub commits. Always distinguish “committed” from “confirmed live.”