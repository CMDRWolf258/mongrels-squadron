# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-25_

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


### Discord channel naming / rename safety

Current decorated operational labels include:
- 🧪〡system-testing
- 📢〡announcements
- 📅〡squad-events
- 🎯〡mission-control
- 🚨〡faction-alerts
- 📡〡scout-network
- 🏗️〡colonization-jobs
- 🗃️〡colonization-archive
- 💰〡squad-payouts
- 🐺〡mongrel-pursuits
- 🛡️〡combat-escort-requests
- 📚〡training-resources
- ☕〡training-grounds
- 🏛️〡squad-structure
- 📕〡squad-rules

Rename behavior:
- system-testing, announcements, mission-control, faction-alerts, scout-network, colonization-jobs, colonization-archive, and squad-payouts are webhook-bound; renaming the Discord channel does not break the existing webhook connection.
- bot-owned/name-discovered channels must accept their decorated name plus a sensible plain fallback. Squad Events, Training Resources, Pursuits, Combat Escort, Squad Structure, and Squad Rules follow this pattern.
- do not create replacement channels solely because of a label/emoji change; preserve channel IDs/history where possible.

### Trader's Outpost / Trade Intelligence

Primary framework files:
- `trading/index.html`
- `js/trading.js`
- `css/trade-control.css`
- `functions/api/trades/index.js`
- `functions/api/trade-control/index.js`
- `functions/api/discord/interactions.js`
- `lib/trade-intelligence.js`
- `lib/trade-discord.js`
- `scripts/smoke-trade-intelligence.mjs`

Authority / storage:
- ordinary authenticated Members may continue creating and maintaining their own trade posts; Officers/Site Admin retain board moderation.
- the advanced **Trade Operations Control** at the bottom of Trader's Outpost is Officer/Site Admin only; backend authorization is authoritative.
- reuse the existing `TRADES` KV binding. The route board remains `trade-board-v1`; Trade Control configuration is `trade-control-v1`; per-user alert subscriptions use isolated `trade-alert-sub-v1:<routeId>:<discordUserId>` keys.
- do not persist a global Fresh/Aging/Stale label on a market observation. Persist its observation timestamp and classify age against the priority profile of the search/watch/card viewing it.

Priority / freshness:
- four starting profiles are **Critical, High, Standard, Low** and are Officer-configurable.
- no refresh cadence may be configured below **5 minutes**.
- initial Critical defaults: refresh 5 min, Fresh <=30 min, Aging <=90 min, Stale >90 min.
- initial Standard defaults: refresh 60 min, Fresh <=24 h, Aging <=48 h, Stale >48 h.
- profile cutoffs are scenario-specific; the same 73-minute-old observation can be Aging in a CG watch and Fresh in an ordinary route.
- monitoring priority and alert severity/delivery are separate concepts.

Discord lifecycle:
- development/test destination is **🧪〡system-testing**, channel ID `1552127291234983956`.
- intended production destination is **💰〡trader’s-outpost**, channel ID `1029221573988720722`.
- until Wolf explicitly approves launch, Trade Control remains locked to TESTING; the web UI does not expose the live switch.
- website-owned trade cards use the existing Imperial Mongrels Website bot and tracked Discord message IDs. Edits update the same message instead of posting duplicates.
- ordinary automated cards are created with Discord's suppress-notifications flag and routine edits remain non-notifying.
- each active Discord trade card has **🔔 Alert Settings**. Because a shared Discord message cannot display a different button label to each viewer, clicking it opens a personalized ephemeral panel showing **Alerts Enabled ✓** or **Alerts Disabled** with an explicit Enable/Disable action; no per-watch Discord role is created.
- threshold events should remain visible but silent in the shared trade channel; subscribed users receive the opt-in alert privately. Discord/user notification settings may still prevent delivery.
- old/closed/superseded cards should normally be compacted to short history instead of deleted.
- ordinary Discord conversation in trader’s-outpost is never treated as website data and is never modified by the website.

Market-data direction:
- the framework deliberately separates market observations, priority profiles, watches/searches, route cards, trigger state, and Discord delivery.
- authenticated Members now have **Live Market Intelligence → Commodity Search** on Trader's Outpost. The browser calls the Mongrels backend only; it never queries public galaxy sources directly.
- the interactive search primary is **Spansh station search** through `lib/trade-market.js` and `/api/trade-market/search`. The backend sends one station-index query with reference system, radius, commodity market-side filters, supply/demand, price, station/carrier types, and an exact market-update timestamp range, then normalizes returned station-market rows into the Mongrel observation model.
- Spansh market results are locally filtered again for exact pad, carrier, freshness, price, and volume semantics, then sorted for Best Price / Nearest / Freshest / Highest Volume. The interactive candidate page is capped; if Spansh reports more matches than the returned candidate page, the UI must mark the result as partial rather than imply exhaustive galaxy ranking.
- the member results UI keeps up to 100 normalized matches from one search, displays **10 results per page**, and can re-sort the already-returned dataset instantly by Best Price, Nearest System, Freshest Data, Highest Supply/Demand, or Shortest Arrival without running another live market query.
- **EDData is no longer the blocking interactive market search source** after repeated production timeouts during Gold/Diaba testing. It remains available for lightweight commodity-catalog data and as a future secondary/cache-feeding source.
- if the live source is temporarily unavailable and matching same-reference-system observations already exist in the Mongrel cache, the backend may return those with an explicit cache-fallback warning.
- every successful search normalizes returned records and merges them into the existing `TRADES` KV under per-commodity `trade-market-observations-v1:<commodity>` records (capped working cache). Source health is stored under `trade-market-health-v1` and appears in Officer Trade Control.
- the commodity picker catalog is fetched server-side from Spansh’s station `field_values/marketplace` vocabulary and cached in `TRADES` under `trade-market-commodities-v1`; this intentionally puts ordinary and **rare commodities in the same selector** using Spansh’s exact display spellings. EDData remains a catalog fallback only. Catalog failure does not block a typed exact-name search. No new Cloudflare binding is required.
- the member Commodity field is a custom searchable combobox: focus/click opens the list, typing filters exact/prefix/contains matches, keyboard arrows + Enter select, Escape closes, and submit validates against the loaded catalog to reduce spelling mistakes.
- MongrelScout/EDMC observations can later update the same normalized observation model and supersede older public observations.
- **Saved Watches are now enabled for Officers/Site Admin only.** After any successful Commodity Search—including a zero-match search—leadership can use **Save as Watch** to persist the full normalized search query, priority, Discord-publish preference, creator, and lifecycle state in the existing `TRADES` KV under `trade-watches-v1`. Regular Members cannot create/manage watches through the UI or API.
- The Save/Edit Watch dialog exposes the watch criteria directly before persistence: name, commodity, buy/sell side, reference system, radius, price threshold, minimum supply/demand, pad, Fleet Carrier mode, exact max data age, monitoring priority, preferred ranking, and Discord-publish preference. Officers can therefore tighten/loosen thresholds without rerunning the source search first.
- Officer Trade Control lists saved watches and supports **Edit**, **Run Now**, **Load Search**, **Pause/Resume**, and **Remove**. Edit updates the existing watch in place instead of creating a duplicate; query changes reset evaluation state/current-best data so automation starts cleanly from the new criteria.
- **Scheduled Watch evaluation is enabled.** GitHub Actions wakes the protected internal endpoint every five minutes (offset from the top of the hour); the endpoint evaluates only active watches whose current priority profile is due. Current default cadence is Critical 5m / High 15m / Standard 60m / Low 360m and remains Officer-configurable through Trade Control with a 5-minute floor.
- evaluator batch defaults: up to 6 due watches per wake, processed two at a time, with an 8-second live-market timeout per watch. Deferred watches remain due for a later wake. The endpoint uses `TRADE_WATCH_CRON_TOKEN` with `SCOUT_DISCORD_CRON_TOKEN` as the existing-secret fallback.
- each successful evaluation stores last attempt/success, next nominal due time, match count, current preferred market, source/partial state, and a meaningful transition baseline. Recorded transition types are **baseline**, **condition_met**, **condition_cleared**, and **best_market_changed**. A failed lookup records an error but preserves the previous successful best-market snapshot.
- evaluator writes are optimistic: if an Officer edits/pauses a watch while its external lookup is running, the stale result is not applied to the changed watch.
- saved Watch cards show last check, next due, match count, current best market, errors/warnings, and last meaningful transition; Officer **Run Now** forces an immediate one-watch evaluation for validation.
- **Automated Watch Discord cards are enabled in the current testing channel.** Active Watches with Discord publishing enabled own one silent website-managed card in the configured Trade channel. Routine evaluations edit that same card in place with criteria, match count, current-best market, freshness/priority context, and watcher count. Paused / website-only / removed Watches are compacted rather than leaving stale interactive cards.
- Watch cards use the existing per-item **Alert Me** subscription system. Discord interactions recognize both ordinary Trade posts and saved Watches. The private settings response clearly shows **Alerts Enabled ✓** when subscribed. Removing a Watch clears its alert subscriptions.
- meaningful Watch transitions create a separate **silent channel alert** and DM only the members subscribed to that specific Watch. Alertable transitions are **condition_met**, **condition_cleared**, and **best_market_changed**. Baseline creation and routine same-market refreshes never alert. Transition detection returns a new event only once, preventing repeated alerts on unchanged evaluator passes.
- Watch Discord automation remains routed to **🧪〡system-testing** until Wolf explicitly changes Trade Control to production. **not yet enabled:** BGS enrichment, automatic best-source promotion beyond the saved ranking rule, or MongrelScout market writes.
- future market-source changes must not require Trader's Outpost UI/card code to know whether an observation came from Spansh, EDData, MongrelScout, or another adapter.

### Squad Payouts Discord visibility

Channel:
- **💰〡squad-payouts** is webhook-bound through `DISCORD_SQUAD_PAYOUTS_WEBHOOK_URL`.

Public payout board behavior:
- Squad Payouts uses **two separately tracked persistent Discord messages** so the funding systems are visually and operationally distinct:
  - **💰 Squad-Funded Rewards** — Regiment treasury total, squad payout requests, and squad-funded outstanding balances;
  - **🐺 Personal Job Rewards** — individually funded work with recipient, amount, named payer, payment state, and job/reward description;
- Discord tracking state is version 2 under `discord-rewards-v1`: `summary` tracks the squad-funded message and `personalSummary` tracks the personal-job message independently.
- **Squad Treasury** totals remain squad-funded only. Personal/member-funded obligations must never inflate the Regiment treasury balance;
- **Personal Job Rewards** is explicitly labeled **Separate from the Squad Treasury** and uses a stacked recipient/amount → Paid by/Status → job-description layout for clarity;
- member-funded entries in `OWED` and `PAYMENT_SENT` states are public on the board; `PAYMENT_SENT` is shown as awaiting recipient confirmation;
- personal rewards are grouped by payer + recipient + source job so repeated verified reward entries do not create noisy duplicate lines;
- individual Discord payout-request cards remain reserved for the existing squad-funded collection-request lifecycle;
- member-funded payment actions now refresh the Discord board immediately when the payer marks **SENT** or the recipient confirms **PAID**;
- the member-funded payment authority model is unchanged: only the recorded payer can mark sent, and only the reward recipient can confirm receipt.

Rationale:
- leadership/member-funded jobs should be visible so the squad can see that personal work is being rewarded;
- payer attribution keeps personal obligations transparent without making them look like Regiment treasury debt.

Primary files:
- `lib/reward-discord.js`
- `functions/api/rewards/member-payments.js`
- `scripts/smoke-reward-discord.mjs`

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

Learning / resource architecture:
- **Activities** = discovery: “what do I want to do?”
- **My Pathway** = personalized progression: “what should I practice next?”
- **Mongrel Field Manual** = learning/reference umbrella at `/guides/`.
  - Guides = learn an activity / understand why.
  - Reference Database = exact mechanics and dense lookups.
  - Glossary = terminology and acronyms.
  - **Mongrel Toolbox** = curated external sites, apps, databases and specialist community tools; URL remains `/guides/resources/`.
- **Member Portal → Quick Links** is navigation to member tools, not another training/resource library.
- Resources top-level menu remains; submenu wording is **Learn & Look Up** plus **Build & Tools**.
- Command → Coordination includes Combat Escort Network.
- Do not create a separate Training Hub page unless the architecture is deliberately changed later; Discord training-resources should route into the Field Manual rather than duplicate it.

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

## Gallery Contributions / Moderation

Primary files:
- `gallery/index.html`
- `js/gallery.js`
- `css/gallery-contributions.css`
- `functions/api/gallery/index.js`
- `functions/api/gallery/image.js`
- `functions/media/gallery/[file].js`
- `lib/gallery-submissions.js`
- `scripts/smoke-gallery-submissions.mjs`

Architecture:
- The existing curated `data/gallery.json` + repo image archive remains intact.
- Authenticated Member / Officer / Site Admin users may submit screenshots from the Gallery page with drag/drop or file picker.
- Submission metadata uses the existing `PROJECTS` KV binding under `gallery-submissions-v1`; do not create a second public Gallery database.
- Image bytes reuse the existing private R2 bucket currently bound as `EVENT_IMAGES`, stored under the separate `gallery/` prefix.
- Daily upload limit is **10 submissions per Discord user per UTC day**. Approved, rejected, and still-pending submissions all count because the limit is on uploads, not publications.
- Accepted source formats: PNG, JPEG, WebP. Browser source limit: 25 MB. Files already <=8 MB upload directly; larger files are resized/compressed to WebP before the server hard 8 MB limit.
- Every submission starts `pending`. Only Officer / Site Admin may approve or reject.
- Pending images are not public media. The submitter and leadership preview them through authenticated `/api/gallery/image?key=...`.
- Public `/media/gallery/<file>` checks current submission state and only serves an R2 object when its submission is `approved`.
- Approved member submissions merge into the existing public Gallery filter/grid/lightbox at runtime; the lightbox credits the submitting CMDR.
- Gallery page order is intentionally visitor-first: hero → public image archive → member submission tools → leadership review → Site Admin published-member-image management. Do not move the upload drop zone above the public Gallery.
- Leadership review happens on the Gallery page and may correct title, caption, and up to three controlled tags before approval, with an optional review note.
- Rejected images are removed from R2 after the rejected state is persisted; the metadata record remains so the submitter can see the result and the upload still counts toward that day's limit.
- Post-approval removal is **Site Admin only**. Officers may approve/reject pending submissions but cannot remove an already-approved image. Site Admin removal first marks the record `removed` (immediately unpublishing it), then deletes its R2 object and preserves lightweight submission/review/removal history; it continues to count toward the original daily upload quota.
- Controlled Gallery tags currently include AX, BGS, Carriers, Colonization, Combat, Community, Engineering, Events, Exobiology, Exploration, Mining, Operations, PvP, Scenic, Ships, and Trade.
- Current KV/R2 concurrency is appropriate for squad scale. If the upload quota ever needs strict high-concurrency enforcement across many PoPs, move quota accounting to a serialized store rather than pretending KV is strongly consistent.

## Frontier Activity Diagnostics

Primary files:
- `functions/api/frontier/admin-events.js`
- `js/wolf-bgs-frontier-diagnostics.js`
- `css/wolf-bgs-frontier-diagnostics.css`
- `wolf-bgs/index.html`
- `scripts/smoke-frontier-diagnostics.mjs`

Behavior:
- Wolf BGS Control → Verification Review includes a **Site Admin-only Stored Frontier Activity** diagnostic panel.
- The panel reads the production Frontier event store (`frontier-bgs-events:<userId>`) and is intentionally read-only.
- Connected CMDR selector shows each account's last successful Sync time; the selected member summary also shows latest journal-event timestamp, last known system, and total stored-event count.
- Recent stored events are shown independently of Daily Order and reward state. A stored event can exist with **No Daily Order Match**, which proves Scout collected it even if it did not attach to an active order or generate a reward.
- Trade rows expose commodity, tons, sale value, profit, average purchase price, cargo provenance, BGS trade eligibility, explicit eligibility reason, system, station, station faction, and any Daily Order match.
- Diagnostics currently returns up to 300 most-recent stored events for the selected connected member; client filters by activity type and system.
- Only `site_admin` may call `/api/frontier/admin-events`; there are no write methods on this endpoint.
- Important diagnostic distinction: **stored Frontier evidence → order match → reward obligation** are three separate stages. Never infer missing stored evidence solely from a missing reward or verification row.

## Scout Board refresh resilience

Primary client/API:
- `js/scout-jobs.js`
- `functions/api/operations/scout-jobs.js`

Behavior:
- Scout Board performs background refreshes, but a transient GET failure must **never replace an already-rendered good board with an unavailable/empty state**.
- The last successful payload remains visible and the status line reports that live refresh is delayed.
- Automatic polling uses recursive `setTimeout` with a single in-flight request guard and short failure backoff instead of overlapping `setInterval` requests.
- GET requests use a 20-second client timeout.
- Frontier account lookup is non-critical for Scout Board rendering; if it fails, the API falls back to the authenticated session identity rather than failing the board request.
- If the initial request itself fails and no good payload exists yet, the normal Scout Board unavailable state is still shown.

## Announcements images / R2

Primary files:
- `functions/api/announcements/index.js`
- `functions/api/announcements/image.js`
- `functions/media/announcements/[file].js`
- `lib/announcement-images.js`
- `lib/announcements-discord.js`
- `js/announcements.js`
- `css/announcements.css`

Behavior:
- Site Admin may attach one optional image to each announcement through drag/drop or file browse.
- PNG/JPEG/WebP sources up to 25 MB are accepted by the browser; files over the 8 MB server limit are resized to max 2400 px and compressed to WebP before upload.
- Reuse existing private R2 binding `EVENT_IMAGES`; announcement objects use the `announcements/` prefix. No new Cloudflare resource is required.
- Draft image previews are authenticated through `/api/announcements/image?key=...` and are not exposed through the public media route.
- Published or archived announcement images are served through `/media/announcements/<file>` only when the R2 key is attached to an announcement in published/archived state. This public URL is required for Discord embed image rendering.
- Replacing/removing a saved image deletes the old managed R2 object after the announcement record is updated. Deleting a draft cleans its saved image. Abandoning a newly uploaded unsaved image attempts to delete the temporary R2 object.
- Published announcement edits continue editing the same tracked Discord webhook message; the embed image is added, replaced, or removed with the same edit.
- Website announcement cards display the attached image with `object-fit:contain` so banners and screenshots are not aggressively cropped.

## Combat Escort Network

Primary files:
- `escort/index.html`
- `js/combat-escort.js`
- `css/combat-escort.css`
- `lib/combat-escort.js`
- `lib/combat-escort-discord.js`
- `functions/api/combat-escort/index.js`
- shared Discord interaction endpoint: `functions/api/discord/interactions.js`
- focused regression suite: `scripts/smoke-combat-escort.mjs`

Storage / authority:
- Existing `PROJECTS` KV is reused under `combat-escort-requests-v1`; no new Cloudflare resource is required.
- The website record is authoritative. Discord delivery/update failure never rolls back a saved request or member response.
- Member/Officer/Site Admin may create requests.
- Request owner, Officer, or Site Admin may Complete or Cancel an open request.
- Request owners cannot volunteer as their own escort.

Request fields:
- title
- system
- optional destination / area
- timing
- urgency: Routine / Priority / Immediate
- objective
- optional notes
- responder state

Responder lifecycle:
- `I Can Help` → `available`
- `On My Way` → `on_my_way`
- `Stand Down` removes that member's response
- Complete/Cancelled requests retain history but no longer accept responses.

Discord:
- One live Discord message per Escort Request; edits happen in place as responders/status change.
- Existing Imperial Mongrels Website bot and existing `/api/discord/interactions` endpoint are reused.
- Channel discovery accepts `🛡️〡combat-escort-requests`, `combat-escort-requests`, or `combat-escort-request`.
- Optional exact override: `DISCORD_COMBAT_ESCORT_CHANNEL_ID`.
- Every request card keeps persistent website shortcuts: **New Escort Request** → `/escort/#request-form` and **Open Escort Network** → `/escort/`. Open requests show these alongside responder controls; Complete/Cancelled history cards retain the two shortcuts after response controls disappear.
- One persistent **Combat Escort Network** launcher card is maintained in the Discord channel and stored under `combat-escort-discord-launcher-v1` in `PROJECTS`. It is edited/recreated instead of duplicated.
- Launcher pinning is intentionally manual. The bot maintains/edits the persistent launcher message but never changes its pin state; leadership controls whether it stays pinned.
- Cards never ping roles automatically in v1. Pursuit-based notification opt-ins remain a future layer so activity interest does not imply notification consent.
- Required channel permissions: View Channel, Send Messages, Embed Links, Read Message History. No pin-management permission is required.

Member surfaces:
- dedicated member page at `/escort/`
- Member Portal primary card + Quick Access link
- Ask the Mongrels navigation knows how to direct members to the Escort Network.

## Squad Rules / ROE Discord Integration

Purpose:
- The website `/about/#squad-rules` remains the authoritative full Rules & ROE source.
- Discord **📕〡squad-rules** gets one concise persistent summary card with **View Full Rules & ROE** linking back to the website.
- Existing legacy embeds from RIMM/Carl Bot are not managed or deleted by the website bot. Wolf may remove those manually after validating the replacement card.

Primary files:
- `lib/squad-rules-discord.js`
- `functions/api/squad-rules/index.js`
- `js/squad-rules-admin.js`
- Site Admin control lives inside the existing About → Standards & Rules of Engagement section.
- focused smoke suite: `scripts/smoke-squad-rules.mjs`

Storage:
- existing `PROJECTS` KV under `squad-rules-discord-v1`
- no new Cloudflare resources.

Discord:
- preferred channel: **📕〡squad-rules**
- plain `squad-rules` fallback accepted.
- optional explicit override: `DISCORD_SQUAD_RULES_CHANNEL_ID`
- one bot-owned message is created once and edited in place on later syncs.
- concise fields: Open Play standard, BGS Open-only rule, no combat logging, combat/ROE summary, Mongrel conduct standard.
- no pings, no interactions, no automatic pinning.
- required permissions: View Channel, Send Messages, Embed Links, Read Message History.

Authority:
- Publish / Sync is Site Admin-only in both UI and server API.
- Website remains authoritative even if Discord sync fails.
- Bot never searches for or removes Carl Bot / RIMM legacy messages.

---

## Training Resources Discord Integration

Purpose:
- Discord **📚〡training-resources** is an index/doorway into the existing website learning system, not a duplicate content library.
- The existing Discord conversation channel is **☕〡training-grounds** and is intentionally reused for questions, mentoring, builds, screenshots, troubleshooting, and member-to-member help. The integration never creates, renames, clears, or replaces it.

Primary files:
- `lib/training-resources-discord.js`
- `functions/api/training-resources/index.js`
- `js/training-resources-admin.js`
- Site Admin control lives on `/guides/`
- focused smoke suite: `scripts/smoke-training-resources-discord.mjs`

Storage:
- existing `PROJECTS` KV under `training-resources-discord-v1`
- no new Cloudflare resources.

Discord channel discovery:
- resources channel: preferred **`📚〡training-resources`**; plain `training-resources` or another decorated name ending in `〡training-resources` also works
- conversation channel: preferred existing **`☕〡training-grounds`** (plain `training-grounds` or any decorated name ending in `〡training-grounds` also accepted). Legacy `training-chat` matching remains as fallback.
- optional explicit overrides: `DISCORD_TRAINING_RESOURCES_CHANNEL_ID`, `DISCORD_TRAINING_CHAT_CHANNEL_ID`

Persistent card:
- one bot-owned message maintained in place by message/channel ID.
- links to Mongrel Field Manual, My Pathway, Reference Database, Mongrel Toolbox, Ship Catalogue, Glossary, Ask the Mongrels, and **Training Grounds** when discoverable.
- website remains the organized source of truth; Discord remains discovery + conversation.
- link-only buttons; no Discord interaction handler required.
- no automatic channel creation and no automatic pin management. Leadership may pin the index manually.
- required permissions in training-resources: View Channel, Send Messages, Embed Links, Read Message History.

Admin:
- Site Admin sees a hidden-by-default **Publish / Sync Discord Card** control on the Mongrel Field Manual page.
- regular members/public visitors do not see the control.

## Mongrel Pursuits

Primary files:
- `pursuits/index.html`
- `js/pursuits.js`
- `css/pursuits.css`
- `lib/mongrel-pursuits.js`
- `lib/mongrel-pursuits-discord.js`
- `functions/api/pursuits/index.js`
- `functions/api/discord/interactions.js`
- `functions/api/profiles/index.js`
- `scripts/smoke-pursuits.mjs`

Concept:
- **Mongrel Pursuits** answers “what Elite activities do you enjoy, specialize in, or want to participate in with other Mongrels?”
- Pursuits are interests, not duties, rank, authority, leadership appointments, or Specialist Corps status.
- Discord channel target: `🐺〡mongrel-pursuits`; plain `mongrel-pursuits` is accepted as a fallback. Optional explicit override: `DISCORD_MONGREL_PURSUITS_CHANNEL_ID`. The old `job-selection` channel is not discovered, renamed, edited, or otherwise managed by this feature.
- Current catalog has 16 pursuits grouped under Squad & Strategic, Combat, Industry & Logistics, and Discovery & Community.

Storage / synchronization:
- Existing `PROJECTS` KV is reused under `mongrel-pursuits-v1`; no new Cloudflare resource is required.
- Website and Discord use one canonical per-member selection record keyed by Discord user ID.
- If a member has no Pursuits record yet, the website may derive an initial selection from legacy Member Profile activity labels without writing on GET.
- Saving Pursuits updates the member's `profiles-v1` activity labels when a profile exists. The Profile editor no longer edits activities independently.
- Creating a new profile imports existing canonical Pursuit selections when available.
- Roster/profile presentation labels member activities as **Mongrel Pursuits** and the roster remains filterable by them.

Discord:
- Existing Imperial Mongrels Website bot and existing `/api/discord/interactions` endpoint are reused.
- Site Admin **Publish / Sync Discord Card** initializes one persistent selector message and creates any missing unhoisted/non-mentionable Discord roles named `Pursuit · <label>`.
- The persistent Discord selector uses custom ID `mongrels_pursuits_select`. Members choose every pursuit they want active; submitting replaces the current selection because a static Discord select menu cannot show per-user default choices.
- Discord selections write the same website record, mirror activities to the member profile when present, and add/remove the managed Pursuit roles.
- Website saves also attempt to add/remove the matching Discord roles.
- Website selection remains authoritative and saved even when Discord role synchronization fails; Discord errors do not roll back the member's Pursuits.
- Bot permissions needed for full Discord setup: View Channel, Send Messages, Embed Links, Read Message History, and Manage Roles. The bot's Discord role must be above the generated Pursuit roles. Manage Channels is not required because Pursuits never renames channels.

Current v1 deliberately excludes Trainer/Mentor or leadership-style roles because those imply qualification/authority rather than simple activity interest. Add approval-controlled capability roles later as a separate layer if desired.

## Squad Structure / Discord sync

Primary files:
- `about/index.html`
- `js/squad-structure.js`
- `css/squad-structure-admin.css`
- `lib/squad-structure.js`
- `lib/squad-structure-discord.js`
- `functions/api/squad-structure/index.js`
- `scripts/smoke-squad-structure.mjs`

Architecture:
- The existing About → Squad Structure section remains the public presentation, but its command/assignment/count data is now rendered from one authoritative structured model instead of hard-coded roster HTML.
- Fixed role/rank names and descriptions live in `lib/squad-structure.js`; mutable assignments and pilot-rank counts use the existing `PROJECTS` KV binding under `squad-structure-v1`.
- Defaults mirror the former hard-coded About-page structure so the public page remains useful before the first persisted edit.
- Site Admin only may edit Regiment Command holders, Captain assignments/vacancies, Field Leadership assignments, Specialist holders/focus, and Pilot Rank counts through the About-page management panel.
- Saving structure data attempts Discord sync but the website save remains authoritative even if Discord is unavailable.
- Discord uses the existing Imperial Mongrels Website bot. It auto-discovers the existing decorated channel `🏛️〡squad-structure` using `GUILD_ID`; plain `squad-structure` remains an accepted fallback. Optional `DISCORD_SQUAD_STRUCTURE_CHANNEL_ID` still overrides discovery.
- Discord presentation is one persistent bot message containing four embeds: Regiment Command; Operational Commands / Captain Corps; Field Leadership & Specialist Corps; Pilot Rank Progression. Updates edit the tracked message rather than creating duplicates, and a deleted tracked message is recreated.
- The Discord message includes a View Full Squad Structure link to `/about/#structure` and does not ping users/roles.
- Recommended Discord permissions: bot View Channel, Send Messages, Embed Links, Read Message History; members should be denied Send Messages if the channel is intended to be read-only.
- Leadership/rank assignments are controlled structure data. They are intentionally separate from the future member self-selected job/activity-role system.
- Ask the Mongrels no longer carries a hard-coded leadership roster; leadership/rank queries read the shared Squad Structure model.

## Squad Events / RSVPs

Primary files:
- `projects/index.html`
- `js/projects.js`
- `css/projects-events-v2.css`
- `functions/api/projects/index.js`
- `functions/api/projects/rsvp.js`
- `functions/api/projects/event-image.js`
- `functions/media/events/[file].js`
- `lib/event-images.js`
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
- Events may optionally store a public HTTPS `eventImageUrl`; when present it renders as a wide image on both the website event card and the Discord embed. No default image is currently forced, and blank remains a valid event presentation.
- The normal event-image workflow is now drag/drop or file picker in the Event editor. Authenticated Officers/Site Admin upload PNG/JPG/WebP through `/api/projects/event-image` into the private Cloudflare R2 binding `EVENT_IMAGES`; managed images are served publicly through `/media/events/<file>` so Discord can fetch them without making the bucket public.
- Browser uploads accept source images up to 25 MB; files already <=8 MB upload directly, while larger files are resized to a maximum 2400 px dimension and WebP-compressed before the server's hard 8 MB upload cap.
- Managed R2 images persist `eventImageKey` only for editable event records. Replacing/removing a saved managed image cleans up the prior object after save; abandoning an editor session cleans up a newly uploaded unsaved image when possible. External public HTTPS URLs remain available as an advanced fallback.
- The Discord event card uses natural Discord field spacing; the earlier zero-width spacer fields were removed after visual review because Discord rendered them too tall.
- Projects/Event KV reads explicitly use Cloudflare KV `cacheTtl:30` to reduce cross-location RSVP staleness from the previous default window.
- The Projects & Events client checks quietly every 5 seconds while visible, but only rerenders when returned board data changes; Discord-originated RSVP updates should therefore surface automatically once the 30-second KV cache can see them.
- Discord buttons use the existing Imperial Mongrels Website interaction endpoint and existing Ed25519 verification / bot token. No second Discord app is needed.
- By default the existing bot auto-discovers **📅〡squad-events** using the existing `GUILD_ID`; plain `squad-events` remains a fallback. No new Cloudflare value is required for that normal path.
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
