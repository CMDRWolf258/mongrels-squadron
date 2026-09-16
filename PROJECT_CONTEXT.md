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

- **Website = structured source of truth** for applications, profiles, projects, tasking, status, Pathway preferences/progress, campaign state, and admin workflows.
- **Discord = identity/community + communication + notifications + immediate coordination.**

Do not duplicate structured website workflows into Discord unless there is a clear reason.

### Mobile / tablet

Wolf uses desktop, phone, and iPad. Member/admin tools must remain practical on all three.

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

Never expose secrets such as `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, API keys, or hidden IDs.

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

### Desktop / tablet / compact behavior

**>= 1281px:** normal full desktop navigation.

**1061–1280px:** keep the **full visible navigation** rather than collapsing everything into `MENU`. This tablet-width mode deliberately compresses nonessential spacing: smaller logo, hidden brand subtitle, tighter nav padding/letter spacing, and a narrower authenticated member control. Wolf prefers having the main nav choices visible on iPad when they can reasonably fit.

**<= 1060px:** use the compact `MENU` drawer.

The compact drawer uses **focus mode**: when one top-level group is open, sibling top-level links/groups disappear, the active group owns the drawer, the drawer remains scrollable, and the active summary stays sticky. Closing the group restores the root list. Wolf previously reported this compact behavior was doing okay.

The latest 1061–1280 tablet-compression layout is implemented but **not yet production-validated** by Wolf.

Legacy cleanup:
- `js/navigation-v2.js` is only a compatibility shim; canonical behavior belongs to `js/site.js`.
- `css/hubs.css` no longer owns the old grouped-nav prototype CSS.

---

## Ask the Mongrels

Primary files:
- `functions/api/assistant/index.js`
- `lib/assistant-context.js`
- `js/mongrel-assistant.js`

The assistant is read-only. It uses current squad/site data where available and curated Elite knowledge where appropriate. It must never claim it changed, posted, scheduled, registered, or edited anything.

### Website-navigation help

Navigation help is **not carrier-specific anymore**.

`lib/assistant-context.js` contains a query-selective `NAVIGATION_DESTINATIONS` map and returns only the most relevant `modules.siteNavigation` entries for a question. This avoids injecting the whole site map into every AI request while giving the model authoritative visible click paths.

Current mapped destinations include major operational/help surfaces such as:
- Carrier Coordination / Carrier Registry
- Projects & Events
- Daily Orders / Mission Control
- Member Portal / My Pathway / My Profile
- PvP Bounty Board
- Trader's Outpost
- Squadron Roster
- Rules & ROE
- Ship Catalogue
- Engineering / Mining / BGS guides
- Reference Database / Field Manual / Glossary
- Start Here
- Recruitment

When a user asks where to **find, open, create, post, or navigate to** something:
- use `modules.siteNavigation` when present;
- describe the exact visible desktop/tablet path;
- give the compact `MENU` path when useful;
- mention a Member Portal alternate when it materially helps;
- never invent menu labels.

Example for carrier loading:
- desktop/tablet: **Command → Carrier Coordination**;
- compact: **MENU → Command → Carrier Coordination**;
- member alternate: **member button → Member Portal → Carrier Coordination → Open Carrier Board**;
- create: **New Coordination Post → Activity: Loading**.

### Direct navigation buttons / deep links

The model does **not** invent arbitrary URLs in prose. The server returns trusted `{label, href}` navigation objects and `js/mongrel-assistant.js` renders them as clickable **Related** buttons.

Prefer exact section anchors when available. Current useful anchors include:
- `/operations/#daily-orders`
- `/projects/#project-list`
- `/carriers/#carrier-directory`
- `/carriers/#carrier-coordination`
- `/pvp/#bounty-board`
- `/about/#squad-rules`
- Member Portal card anchors such as `/member/#carrier-coordination`

This means a question like “Where can I create a carrier loading event?” can provide a **Carrier Coordination** button that lands directly on that section rather than merely opening the top of the Carriers page.

### Mission Control system filtering

The assistant does not receive all Mission Control systems on every request. `selectMissionControlForAssistant()` deliberately sends a query-filtered subset to limit prompt size.

Important guardrail: **an empty filtered subset does not mean Mission Control has no systems.** The returned object now includes `selection.mode`, `returnedCount`, `totalSystemRows`, `activePresenceCount`, `truncated`, and an explicit note explaining that distinction.

Faction-presence wording such as “what systems our faction is in,” “which systems,” “where are we present,” “territory,” and “footprint” should select up to 30 active-presence systems while preserving the authoritative total from Mission Control metadata. Never tell the user the live system list is empty merely because the query filter returned zero rows.

High-value future improvement: include current Pathway assignment/progress in Assistant context so it can answer “how do I do this task?” without becoming the authority for completion.

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

Storage:
- `PROJECTS`
- prefix `start-daily-v1:` + local date + Discord owner ID

Rules:
- personalized tasks require Member / Officer / Site Admin;
- categories come from My Pathway preferences but daily tasks **never change Pathway progress**;
- task kinds: Activity Task, Challenge, Squad Opportunity;
- maximum 3 reveals per category per local calendar day, server-authoritative;
- all revealed choices remain saved for the day and display in a carousel;
- BGS/Squad Operations may inject a live Mission Control opportunity, but authoritative Daily Orders must be checked before acting.

Wolf validated the daily-task cards/carousel visually.

---

## My Pathway — core model

Primary shared files:
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

### Activity-collapse UX

The right-hand **Your Pathway** area uses compact expandable categories. Full pathway activities are native `<details>` groups, and generic selected activities are also rendered as compact disclosures.

Full-route categories:
- Anti-Xeno
- Background Simulation
- Mining
- Trade & Hauling
- Carrier Logistics
- Engineering & Shipbuilding

Rules:
- collapsed by default;
- click the category header to expand/collapse;
- do not add separate Open/Close buttons unless needed;
- multiple categories may remain open;
- each full-route renderer owns its own loading/visibility/content. Do **not** add a second controller that forcibly shows route roots.

A temporary collapse implementation exposed an API failure; the real root cause was an accidentally removed shared `reply()` helper in `functions/api/pathway/assignments.js`. That helper was restored, and Wolf confirmed the full Pathway loading was fixed. Preserve it.

### Lasting design rule

Beginner assignments should generally **teach through actions before analysis**:

> **Do → observe → compare → understand → optimize → lead/teach**

Avoid hiding several concepts or hours of prerequisite work inside one early assignment.

---

## Shared full-pathway engine

`functions/api/pathway/assignments.js` hosts provider/progress behavior.

Current full providers:
1. Anti-Xeno — `ax-v2`
2. BGS — `bgs-v1`
3. Mining — `mining-v1`
4. Trade & Hauling — `trade-v2`
5. Carrier Logistics — `carrier-logistics-v1`
6. Engineering & Shipbuilding — `engineering-v1`

Each provider keeps independent per-activity progress in `PROJECTS`.

### Engineering Give Me Another Route

Engineering route cycling should stay at the Commander's selected experience level rather than dropping to lower-band material:
- Beginner → Engineering Foundations only
- Developing → Role Builder, Engineer Network
- Experienced → Ship Architect, Combat Systems, Role Builder
- Veteran / Mentor → Engineering Mentor, Ship Architect

Lower-band progress remains stored and can be revisited by changing the saved Engineering experience level.

---

## Pathway route references

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
- Efficient Miner — Find Bottleneck
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

---

## Engineering Campaign Planner

Framework files:
- `lib/engineering-campaign.js`
- `lib/engineering-campaign-data.js`
- `lib/engineering-campaign-shields.js`
- `functions/api/pathway/engineering-campaign.js`
- `js/engineering-campaign-planner.js`
- `css/engineering-campaign-planner.css`

Storage:
- `PROJECTS`
- prefix `engineering-campaign-v1:<ownerId>`

Engineering pacing rule: never hide a multi-hour/day prerequisite chain inside an ordinary-looking task. Partial improvement is valid; G2/G3 can be a legitimate stopping point.

Model:
1. Goal
2. Current/shared facts
3. Dependency plan
4. Next manageable Engineering assignment
5. Optional Background Prep from other pathways

Shared facts retain provenance so future trusted sync/import can write the same fact IDs instead of creating a parallel model.

### Dependency evaluation rule

Campaign dependency readiness must treat **fact-completed nodes exactly like manually completed nodes**. `lib/engineering-campaign.js` now builds a completion map before evaluating dependencies. This is critical for adaptive campaigns: if a Commander already has an Engineer unlocked or already completed a cumulative prerequisite, downstream work should unlock automatically without requiring a fake manual completion.

Generic campaign setup deliberately stops at **assess current state → choose useful stopping point → map dependencies**. Material planning belongs inside each goal-specific graph after the actual module/blueprint choice is known.

### Improve Shields — first live goal-specific campaign

`lib/engineering-campaign-shields.js` contains the first audited goal chain. It is intentionally a **G2/G3 Shield Generator phase through Lei Cheung**, not an automatic endgame G5 shield/booster grind.

Current chain:
1. generic campaign assessment, target selection, and dependency mapping;
2. choose the Shield Generator blueprint around the ship's role rather than one universal recipe;
3. plan only the chosen blueprint's **G1 → G2** material job;
4. use 5 distinct black markets for The Dweller meeting requirement;
5. unlock The Dweller at Black Hide (500,000 Cr);
6. engineer with The Dweller only until the Lei Cheung referral appears;
7. accumulate the Lei Cheung distinct-market requirement using the existing market counter;
8. unlock Lei Cheung at Trader's Rest with 200 units of Gold;
9. open G2 shield access only as far as needed;
10. engineer the selected Shield Generator through G2;
11. **fly/test the G2 result before doing more**;
12. optionally continue to G3 only if the G2 test says the ship still needs it;
13. test G3 and end the phase.

Design rules:
- **Define the job first, then gather for the job.** Blueprint choice comes before the material plan.
- The initial material plan covers G1 → G2 only. Because exact roll count can depend on engineer reputation, the Commander can refresh the quantity after reaching Lei rather than farming G3–G5 preemptively.
- G2 is an explicit legitimate stopping point.
- After the G2 test, the UI exposes **Take the Win · Complete Campaign** even though optional G3 refinement remains.
- G5 Shield Generator and G5 Shield Booster work are deliberately deferred to later campaign phases/goals.
- The 5-black-market and market-count steps use the existing cumulative facts, so prior progress can auto-clear them.
- Permanent/access-like milestones (The Dweller unlocked, Lei referral, Lei unlocked, Lei G2/G3 access) are stored as shared Engineering facts.
- Accidental fact marks can be corrected from the campaign step history; counter corrections belong in the Prep Tracker.

### Campaign Planner UI

My Pathway → Engineering now hosts a collapsed **Campaign Planner** subsection above the Prep Tracker.

Inactive state:
- exposes the audited **Improve Shields** campaign only;
- asks for the ship and the specific shield problem/goal;
- shows paused/completed campaign history and allows paused campaigns to resume.

Active state:
- shows one next campaign step at a time;
- progress meter;
- resource links from trusted campaign data;
- permanent-access milestone button or normal Done action as appropriate;
- counter steps link/scroll to the existing Prep Tracker;
- full compact step history with Reopen / Undo Mark / Update Tracker corrections;
- Pause Campaign;
- explicit Take the Win completion at valid stopping points.

`js/engineering-campaign-planner.js` and `js/engineering-prep-tracker.js` synchronize through the `mongrels:engineering-campaign-updated` browser event so counter edits immediately refresh the active campaign without a page reload.

### Engineering Prep Tracker

Current tracked numeric facts:
- `trade.markets-visited-distinct`
- `trade.black-markets-used-distinct`

Current visible prep milestones:
- 50 distinct commodity markets for Lei Cheung preparation
- 5 distinct black markets for The Dweller preparation

UI is a collapsed **Engineering Prep Tracker** inside My Pathway → Engineering. Each counter shows status/progress; **Update Progress** expands all manual write controls:
- quick adds
- exact amount completed
- Set / Correct Total

Exact add records only what the Commander actually did; Correct Total replaces the cumulative number.

Cross-path rule: optional Engineering Prep may accelerate Engineering but must never award/block completion in Trade, Mining, etc.

---

## First Engineering Win

Optional default onboarding on Start Here. It can appear even if Engineering is not selected in Pathway preferences and stops nagging after completion/dismissal.

Default target:
- FSD G2 Increased Range
- then a range-focused experimental as a separate small job
- test the payoff on a familiar trip

Implementation:
- `lib/engineering-campaign-data.js`
- `/api/pathway/engineering-campaign`
- `js/first-engineering-win.js`
- `css/first-engineering-win.css`
- `start/index.html`

Current code contains **18 small steps**. Do not describe it as 17 unless current code changes.

UX:
- one current step at a time;
- progress meter;
- Done / Already Did This;
- **Undo Previous Step** reverses only the most recently completed step, including from the final completion card;
- Hide this starter dismisses it.

The Felicity path includes a dedicated Deciat/Open safety step: rebuy, protect valuable exploration data, understand high vs low wake, preselect an escape system, avoid lingering with Meta-Alloy aboard, and ask Mongrels for escort/wing support if desired.

Wolf validated the First Engineering Win card and Undo behavior on phone, but not a full end-to-end in-game completion of all 18 steps.

---

## Specialty / future pathways

Queued specialty concept: **Community Goal Hauler Prep** — existing cargo ship, survivability, pips/boost, high wake vs low wake, controlled hostile delivery practice, escort coordination, and eventual hostile-logistics capstone. Win condition is survive/deliver, not kill the attacker.

Likely future core pathways:
- Exploration
- Exobiology
- PvE Combat
- PvP
- Surface Operations
- Colonization
- Squadron Operations
- Powerplay when doctrine is mature enough

Do not automatically build all of these; inspect current authoritative site content first.

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

Accepted/Declined are terminal in normal review; reapplication is explicit. Discord Member role assignment must succeed before website acceptance is finalized. Private officer notes never become applicant-facing decline text.

---

## Validation status

Validated / accepted by Wolf:
- original AX beginner route direction;
- Start Here random-task cards/carousel;
- compact navigation focus mode;
- full My Pathway assignment loading after restoring the shared assignments API response helper;
- First Engineering Win card on phone;
- First Engineering Win Undo Previous Step on phone;
- Engineering Prep Tracker integrated styling/correction concept before latest decluttering pass.

Implemented but **not yet production-validated unless Wolf confirms/live checks succeed**:
- first live **Improve Shields** Engineering Campaign Planner UI and goal chain;
- fact-completed dependency propagation in the Engineering campaign engine;
- Campaign Planner ↔ Prep Tracker live browser synchronization;
- 1061–1280px compressed full-navigation tablet/iPad layout;
- generalized Ask the Mongrels navigation paths and direct section buttons;
- Mission Control assistant faction-presence selection / filtered-subset guardrail;
- latest direct Carrier Coordination / Member Portal anchors;
- Trade v2 route rewrite;
- Carrier Logistics full pathway;
- Engineering & Shipbuilding full pathway;
- numeric Engineering prerequisite tracker latest Update Progress layout;
- Engineering route filtering for Give Me Another Route;
- latest collapsible My Pathway category UX;
- full end-to-end First Engineering Win in-game sequence.

Production deployment can lag GitHub commits. Always distinguish **committed** from **confirmed live**.
