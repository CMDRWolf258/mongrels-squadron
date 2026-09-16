# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-15_

## Read this first

**AI / developer handoff:** Before making changes, read this file and inspect the current repository. The repository is the source of truth. If this document, memory, an old chat, a screenshot, or release notes conflict with current code, **current code wins**.

Never reuse remembered file SHAs. Fetch the current file before modifying it.

This is an architecture/handoff guide, not a changelog or duplicate of the codebase. Update it after meaningful workflow, permission, storage, integration, navigation, or project-direction changes.

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

The site is both a public squadron presence and a private operational platform: recruitment, Discord integration, member auth, Mission Control/BGS, projects, carriers, trading, PvP, profiles/roster, guides, gallery, Ask the Mongrels, and My Pathway all live here.

---

## Product architecture

### Website vs Discord

- **Website = structured source of truth** for applications, profiles, projects, tasking, status, pathway preferences, and admin workflows.
- **Discord = identity/community + communication + notifications + immediate coordination.**

Do not duplicate structured website workflows into Discord unless there is a clear reason.

### Visibility behavior

Completed authenticated workflows should usually show a clear completed/status state rather than disappearing entirely.

### Mobile/tablet

Wolf travels often and uses desktop, phone, and iPad. Admin/member tools must remain practical on smaller screens.

---

## Navigation / information architecture

The site has reached the point where adding more top-level links would make it harder to use. Future growth uses **progressive disclosure** rather than continuing to widen the main menu.

Current public navigation model:
- **Start Here** — low-overwhelm route for new, returning, or casual Commanders
- **Activities** — browse Elite by what the player wants to do
- **Command** — Mission Control, Daily Orders, projects, carrier coordination, squad operations
- **Resources** — Field Manual, Engineering, Ship Catalogue, reference, glossary, Ask the Mongrels
- **Community** — About, roster/profiles, gallery, Discord/community links
- **Join Us** — recruitment
- Mongrels logo acts as Home
- authenticated member identity/access remains separate from the public navigation

### Current site-wide navigation system

Primary files:
- `js/site.js`
- `css/navigation-v2.css`
- `start/index.html`
- `activities/index.html`
- `css/hubs.css`

Current behavior:
- `js/site.js` is the single source of truth for the grouped menu and replaces the legacy header link list at runtime on pages that expose the normal `[data-nav]` header.
- It derives the repository/site root from the page's brand/Home link so nested pages can reuse the same menu definition.
- Desktop uses compact top-level groups with click-open mega panels.
- Mobile/tablet uses the same semantic groups as stacked accordions inside the menu drawer.
- Opening one navigation group closes sibling groups; outside-click and Escape dismiss open groups.
- Compact/mobile drawer resets its own scroll position when opened; expanding a group brings that group heading back into view so long menus do not appear clipped above the viewport.
- Existing static legacy links remain useful as no-JavaScript fallback markup on older pages.
- Home exposes Start Here and Activities cards as natural entry points.
- `/start/` and `/activities/` remain the dedicated information-architecture hubs.

The grouped-navigation direction was approved by Wolf after the initial two-page prototype, and the source has now been rolled out site-wide through `js/site.js`. **Production behavior still needs live desktop/mobile validation after deployment.**

### Authenticated member menu

When `/api/auth/session` reports an authenticated user, the old Member Login chip becomes a compact personal menu containing:
- **My Pathway**
- Member Portal
- My Profile
- Sign Out

This keeps personalized/private destinations prominent without adding them to the public top-level menu. Discord display/access names inserted into this control must be HTML-escaped.

### Start Here philosophy

`/start/` is not another giant beginner manual. It should answer: **“What is one useful thing I can do next?”**

Current tracks:
- New to Elite
- Know the Basics
- Experienced Commander

Rules:
- no rigid progression gates;
- players can skip anything they already know;
- challenges should feel useful, not like homework;
- detailed guides remain available when the player wants depth.

### Activities philosophy

`/activities/` organizes information around user intent rather than internal site structure. A player should not need to know whether something technically lives under Guides, Ships, Projects, or Command before finding it.

Current families:
- Combat — PvE, PvP, AX, Surface Operations
- Industry & Logistics — Mining, Trade, Carriers, Engineering
- Exploration & Discovery — Exploration, Exobiology, Expeditions
- Galaxy & Frontier — BGS, Colonization, Powerplay, current squad tasking

The hub should expose both live material and clearly marked planned gaps without pretending unfinished content exists.

### My Pathway — Pathway v2 / AX live model

**My Pathway** is a personalized lens over the same canonical site content, not a duplicate knowledge base.

Primary files:
- `pathway/index.html`
- `js/pathway.js`
- `css/pathway.css`
- `functions/api/pathway/preferences.js`
- `functions/api/pathway/assignments.js`
- `lib/pathway-ax.js`

APIs:
- `/api/pathway/preferences`
- `/api/pathway/assignments`

Storage:
- `PROJECTS`
- per-user preferences prefix: `pathway-preferences-v1:`
- per-user persistent assignment progress prefix: `pathway-progress-v1:`

Privacy/authority:
- Member / Officer / Site Admin only.
- Each member may read/write only their own pathway preferences/progress.
- Preferences are intentionally separate from the roster/profile record even though both are linked by Discord user ID. Public/member-directory identity and private development confidence/goals are different concerns.

Current pathway inputs:
- activities/interests the Commander enjoys;
- areas they want to improve;
- experience per selected activity stored as `new`, `some`, `comfortable`, `experienced`;
- visible experience-band labels are **Beginner**, **Developing**, **Experienced**, **Veteran / Mentor**;
- preferred play style: solo, group, or either;
- optional current personal goal.

Current behavior:
- deterministic recommendation preview generated from selections;
- “want to improve” receives priority emphasis;
- related canonical site content is linked rather than duplicated;
- no content is locked;
- members can change preferences whenever interests or confidence change;
- full pathways can store per-task **Complete**, **Already Know / Have This**, **Skip for Now**, and reopen state;
- assignment types are **Learn**, **Build**, **Demonstrate**, **Challenge**, **Wing / Team**, and **Teach / Mentor**;
- experience changes the nature of work, not merely difficulty: beginners acquire capability, developing pilots practice, experienced pilots demonstrate breadth/mastery, veterans receive advanced challenges plus leadership/teaching work.

Pathway philosophy:
- deterministic structured progression, not opaque AI-generated progression;
- assignments should usually state **what to accomplish**, not spell out every prerequisite or click-by-click step;
- hidden research is intentional learning: e.g. being told to fit/acquire a module may require the Commander to learn where it comes from and how it works;
- Ask the Mongrels is the safety net when a Commander gets stuck, but should not secretly own progression state;
- never lock the rest of the site or force experienced Commanders through beginner tasks;
- **Already Know / Have This** exists specifically so qualified pilots can bypass material they already mastered;
- veteran progression should include mastery, wing responsibility, leadership, diagnosis, and teaching — not just accumulating more modules or kills;
- future pathways should mix personal development goals with relevant live squad opportunities when useful.

AX is the first complete Pathway model. Current AX route families include:
- **Scout School — Vulture** — beginner Scout entry route;
- **Interceptor Academy — Chieftain** — beginner/developing engineering, Guardian, flight, and first-Cyclops route;
- **Interceptor Hunter — Basilisk** — repeatable Cyclops competence, Basilisk knowledge, swarm technique, Basilisk kill, wing combat;
- **Guardian Systems — AX Specialist** — independent Guardian fieldwork, alternate Guardian weapon/build knowledge, anti-Guardian planning, adaptive combat;
- **Hellhound Development — Hunt, Lead, Teach** — veteran challenges including Medusa, wing AXCZ work, wing leadership, helping a Mongrel through a first Interceptor, build review, Hydra wing contribution, and teach-back. Completing this route does **not** automatically grant a squad rank/role.

Current AX route selection is experience-appropriate; veteran selections no longer route members through the beginner Scout curriculum by default. Existing route/task IDs were preserved where possible so stored progress survives Pathway v2.

**Next full pathway candidate: BGS.** The intent is to prove the same engine works for a strategic/squad-operations activity after AX proves the multi-experience model in combat.

---

## Authentication / authority

Authentication is Discord OAuth in `lib/auth.js` and `/api/auth/*`.

OAuth scopes:
- `identify`
- `guilds.members.read`

Access tiers:
1. Public
2. Member
3. Officer
4. Site Admin — intentionally Wolf-only

Important behavior:
- `ADMIN_USER_ID` resolves to `site_admin`.
- `OFFICER_ROLE_IDS` drives Officer access.
- `MEMBER_ROLE_ID` drives Member access.
- Discord server members without Member role may still authenticate with `access: no_access` and `membershipVerified: true`; this is required for Applicants.
- Sessions are signed server-side in `mongrels_session`.
- UI hiding is never a substitute for server-side authorization.

---

## Secrets / environment / storage

Never commit or paste secret values:
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`

Important environment values include:
- `CLIENT_ID`
- `REDIRECT_URI`
- `GUILD_ID`
- `MEMBER_ROLE_ID`
- `OFFICER_ROLE_IDS`
- `ADMIN_USER_ID`
- `DISCORD_PUBLIC_KEY`
- `APPLICANT_ROLE_ID`
- `GUEST_ROLE_ID`
- `WELCOME_CHANNEL_ID`
- `RECRUITMENT_CHANNEL_ID`

Important KV bindings:
- **`PROJECTS`** — applications, member profiles, Discord onboarding state, recruitment DM/alert state, new-member onboarding state, My Pathway preferences/progress, and other structured project data.
- **`DAILY_ORDERS`** — private Mission Control/BGS strategy and related configuration.

Do not create a new KV namespace casually when an existing binding is appropriate.

---

## Discord recruitment integration

Use the existing Discord app/bot **Imperial Mongrels Website**. Do not add another general-purpose bot just to duplicate site functionality.

Safe/public Discord identifiers:
- Application public key: `4d86ba25b2e8457730d568864182cbdf9b7057bd174b6201698f650ac5206064`
- Applicant role: `1012130660187656233`
- Guest role: `1017264444553838622`
- Welcome channel: `1012755466700460163`
- Recruitment review channel / **The High Council**: `1426641891381739612`

Bot permission principle: minimum required permissions only. No Administrator.

Current role needs:
- Manage Roles
- bot role above **Member**, **Applicant**, and **Guest** for roles it must add/remove
- View Channel / Send Messages / Embed Links in channels it posts to

Discord Interactions endpoint:
- `/api/discord/interactions`

### Applicant/Guest onboarding

Applicant button:
1. adds Applicant
2. removes Guest
3. sends ephemeral confirmation
4. sends one-time Applicant DM

Guest button:
1. adds Guest
2. removes Applicant

Custom IDs:
- `mongrels_onboarding_applicant`
- `mongrels_onboarding_guest`

Applicant DM state prefix:
- `discord-applicant-welcome-v1:`

Wolf has a deliberate Site Admin testing bypass in `isEstablishedMember()` so he can test Applicant/Guest buttons despite being an established member.

---

## Recruitment requirements

Joining requires **both**:
1. the Mongrels website application; and
2. an in-game Elite Dangerous Squadron application to **Regiment of Imperial Mongrels [R1MM]**.

Beginner-facing in-game guidance currently uses:
- Right-hand Panel / Internal Panel
- Squadrons
- search **Mongrels**
- select **Regiment of Imperial Mongrels [R1MM]**
- Apply

Important post-overhaul behavior: after leadership accepts the in-game application, the applicant must return to Squadrons and **confirm the acceptance / choose Join Squadron** before in-game membership is complete.

The website cannot accept that Elite Squadron application itself.

---

## Recruitment application system

Primary files:
- `apply/index.html`
- `js/application.js`
- `css/application.css`
- `applications/index.html`
- `js/applications-admin.js`
- `functions/api/applications/index.js`
- `lib/discord-recruitment.js`

Storage:
- `PROJECTS`
- key `applications-v1`

Statuses:
- `draft`
- `submitted`
- `under_review`
- `accepted`
- `declined`

### Applicant rules

- One current application record per Discord owner ID.
- Drafts are editable/saveable.
- Website submission requires the applicant to acknowledge that the in-game Squadron application has also been submitted.
- Submitted applications lock applicant editing.
- Drafts are not shown in the officer queue.
- Full members/officers/site admin cannot submit another normal application; they get a member/preview state.
- Tone stays low-pressure: this is a squad application, not a job interview.

### Officer review / state safety

- Officers/Site Admin review submitted/non-draft applications.
- Private Officer Notes remain leadership-only.
- Applicant-facing decline text is separate from private notes.
- In-game Squadron application verification is explicitly tracked by leadership.
- Normally an application should not be approved until the matching in-game application is verified; an explicit exception path exists and is audited.
- **Accepted is terminal** in the normal review workflow.
- **Declined is terminal** unless leadership explicitly chooses **Allow Reapplication**.
- Normal review cannot casually move Accepted/Declined applications backward into Under Review.

### Acceptance behavior

On first transition to Accepted:
1. assign `MEMBER_ROLE_ID` in Discord
2. remove Applicant and Guest best-effort
3. only then mark the website application Accepted
4. record approver/time
5. send one-time acceptance DM
6. DM reminds applicant to re-authenticate for website access
7. DM reminds applicant of the final in-game **Join Squadron / Confirm** step

If Discord Member role assignment fails, the application must **not** be marked Accepted.

Acceptance DM state prefix:
- `discord-recruitment-acceptance-dm-v1:`

### Decline behavior

On Decline:
- website decision is saved even if Discord DM fails;
- applicant sees a leadership message on `/apply/`;
- a one-time Discord decline DM is attempted;
- private officer notes are not exposed to the applicant.

Decline DM state prefix:
- `discord-recruitment-decline-dm-v1:`

### Reapplication behavior

**Allow Reapplication** is only available from a Declined application.

When used:
- the declined cycle is archived into officer-visible decision history;
- a new application ID/cycle is created as Draft;
- previous answers are prefilled;
- in-game application acknowledgement/verification is reset;
- applicant can edit and resubmit;
- a Discord DM with **Continue Application** is attempted;
- the new ID allows normal submission-alert idempotency to work again.

Reapplication DM state prefix:
- `discord-recruitment-reapplication-dm-v1:`

---

## Recruitment notifications

New submission alerts go to **The High Council** through `lib/discord-recruitment.js`.

A valid application save/submission is authoritative; Discord notification failure must not invalidate it.

Submission alert idempotency prefix:
- `discord-recruitment-alert-v1:`

---

## New-member onboarding

Newly accepted members who came through the current application workflow receive a temporary checklist on `/member/` after they activate Member access.

API:
- `/api/member/onboarding`
- file: `functions/api/member/onboarding.js`

Checklist:
- Website Member access active — automatic
- Confirm final in-game Squadron acceptance / Join Squadron — member checkbox
- Create Member Profile — automatic based on `profiles-v1`
- Review current Daily Orders — member checkbox

When all items are complete, the member can dismiss the checklist.

State prefix:
- `member-onboarding-v1:`

Longtime members without a current Accepted application/accepted timestamp should not suddenly receive this checklist.

---

## Site Admin Lab

Wolf-only launch point:
- `/discord-onboarding/`

Member Portal exposes **Site Admin Lab** only for `site_admin`; APIs still enforce Site Admin server-side.

Current controls include:
- Discord integration/config status
- publish replacement Applicant/Guest selector
- test The High Council recruitment alert
- **Send Test Acceptance DM to Me**

The acceptance-DM test must not:
- assign/remove roles;
- alter an application;
- write the production one-time acceptance-DM state.

Use this page as the preferred home for future safe diagnostics/test buttons.

---

## Member Portal / profiles

`/member/` is the primary authenticated dashboard.

Major private areas include:
- My Pathway via the authenticated member menu
- Daily Orders
- Projects & Events
- Carrier Coordination
- Trader's Outpost
- Squadron Roster / Profiles
- PvP tools
- Officer Tools
- Site Admin Lab / Assistant Knowledge Gaps for Site Admin

Profiles use `PROJECTS` key:
- `profiles-v1`

Member profile creation is part of new-member onboarding.

Roster/profile data and My Pathway preferences deliberately remain separate records linked by Discord owner ID: the roster is squad-facing identity; pathway experience/goals are private personalization state.

---

## Mission Control / BGS conventions

Mission Control is member-only with live/refreshable system/faction data and private officer strategy.

Operational guidance should be concrete and quantified where possible: bounty-credit targets, mission INF targets, factions to support/avoid, and stop conditions.

**INF** means mission Influence reward ticks/pips, not faction influence percentage points.

Before changing BGS thresholds/defaults, inspect current code and strategy migration/version logic. Do not rely on old chat values.

Known deferred BGS item: a previously discussed retreat-warning default change may still need implementation; inspect current code before acting.

---

## Other major modules

- Home
- Start Here
- Activities
- My Pathway
- About / Rules
- Mission Control / Operations
- Projects & Events
- Recruitment
- Recruitment Applications
- Member Portal
- Squadron Roster / Profiles
- CARRIERS
- Trader's Outpost
- Ship Catalogue
- PvP / Bounty Board
- Gallery
- Guides / Field Manual / Mining Manual
- Ask the Mongrels
- Assistant Knowledge Gaps
- Site Admin Lab

Do not assume a feature is unfinished because it is not described here. Search the repo first.

---

## Ask the Mongrels

The site includes an AI assistant with modular knowledge and knowledge-gap logging.

Principles:
- prefer curated squad/site knowledge and current structured context;
- keep public/member boundaries intact;
- only provide member-only Mission Control context after authentication;
- use knowledge gaps to improve content instead of inventing answers;
- prefer modular additions over one giant prompt/knowledge file.

For My Pathway, the assistant may explain recommendations or help a Commander understand a goal, but deterministic structured pathway data should remain authoritative for progression state. Pathway assignments intentionally leave some acquisition/prerequisite research to the Commander, so the Assistant serves as a help layer when a member gets stuck rather than replacing the learning process.

---

## Squad rules that affect site content

- Open Play is the squad standard.
- Mongrel BGS activity must be performed in Open.
- Teamwork matters.
- Respectful conduct/fair play is expected.
- Combat logging is prohibited.
- Solo/Private Group is for limited exceptions, not avoiding player opposition during squad BGS work.

Do not silently weaken these expectations in recruitment copy.

---

## Development workflow

Before editing:
1. Read this file in a new chat/context.
2. Inspect current repo implementation.
3. Fetch every existing file to obtain the **current SHA**.
4. Treat current code as source of truth.
5. Check for existing implementation before adding duplicate functionality.

While editing:
- Prefer direct GitHub implementation; Wolf usually does not want manual whole-file replacement.
- Keep changes scoped.
- Preserve auth boundaries.
- Privileged actions require server-side checks.
- Reuse established helpers/patterns.
- Keep phone/iPad layouts in mind.
- Give short progress updates during multi-step work.

After editing:
- GitHub commit success does **not** prove Cloudflare production deployment.
- Do not claim live verification unless actually checked or Wolf confirms it.
- Test the narrowest safe operation first.

---

## Image/media workflow

Avoid base64 image embedding as a normal workflow. It has been slow and fragile for this project.

Prefer normal repository image files, efficient formats, GitHub/file workflows, and ZIP/batch workflows for many images.

---

## Known limitations / hardening

- Applicant welcome DM is one-time state-based and does not currently suppress itself based on application status.
- Discord interaction verification uses Ed25519 and has been proven by successful live button tests.
- KV idempotency is practical but not fully transactional under simultaneous races.
- Acceptance/decline/reapplication Discord messages are best-effort after the authoritative website decision where appropriate.
- Legacy MEE6/Appy pieces may remain installed until the replacement flow proves itself with real users.
- Moderated Gallery and Ship Build submission/approval workflows remain deferred.
- Site-wide grouped navigation has been implemented through `js/site.js` but still needs post-deploy browser validation across representative desktop/mobile pages.
- Some early hub markup still contains its original prototype navigation/helper; `js/site.js` now owns the canonical site-wide navigation and the old helper can be cleaned up after validation.
- My Pathway now has persistent AX task state and multi-experience AX routes. Live squad-opportunity merging is not built yet, and non-AX activities still use recommendation previews until their full route libraries are added.

---

## Validation status

Confirmed live before the latest hardening/navigation passes:
- custom Applicant/Guest Discord buttons work;
- Applicant ↔ Guest switching works;
- Applicant one-time DM works;
- Discord Interactions endpoint works;
- The High Council test alert works;
- application submission alerts are wired;
- Site Admin Lab is accessible to Wolf.

Wolf approved the **direction** of the Start Here / Activities / grouped-navigation prototype and asked to continue. This is not the same as a full live cross-device validation of the site-wide rollout.

The original two AX beginner routes were tested by Wolf and reported to work well before the Pathway v2 expansion.

**Implemented but still awaiting live end-to-end validation after deployment:**
- automatic Member-role provisioning on approval;
- acceptance DM production path;
- in-game application verification gate;
- Accepted/Declined terminal state rules;
- decline DM/applicant message;
- reapplication archive + reopen + DM;
- new-member onboarding checklist;
- Start Here hub;
- Activities hub;
- site-wide grouped desktop/mobile navigation through `js/site.js` including latest drawer scroll/spacing QoL fixes;
- authenticated member dropdown with My Pathway / Member Portal / My Profile;
- Pathway v2 experience-band labels and assignment-type UI;
- expanded AX routes for Basilisk, Guardian specialization, and Hellhound/veteran development.

Do not label these latest items “validated” until Wolf tests them or a real applicant/member completes the relevant flow.
