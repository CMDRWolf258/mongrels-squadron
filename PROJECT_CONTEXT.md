# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-15_

## Read this first

**AI / developer handoff:** Before making changes, read this file and inspect the current repository. The repository is the source of truth. If this document, memory, an old chat, a screenshot, or release notes conflict with current code, **current code wins**.

Never reuse remembered file SHAs. Fetch the current file before modifying it.

This is an architecture/handoff guide, not a changelog or duplicate of the codebase. Update it after meaningful workflow, permission, storage, integration, or project-direction changes.

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

The site is both a public squadron presence and a private operational platform: recruitment, Discord integration, member auth, Mission Control/BGS, projects, carriers, trading, PvP, profiles/roster, guides, gallery, and Ask the Mongrels all live here.

---

## Product architecture

### Website vs Discord

- **Website = structured source of truth** for applications, profiles, projects, tasking, status, and admin workflows.
- **Discord = identity/community + communication + notifications + immediate coordination.**

Do not duplicate structured website workflows into Discord unless there is a clear reason.

### Visibility behavior

Completed authenticated workflows should usually show a clear completed/status state rather than disappearing entirely.

### Mobile/tablet

Wolf travels often and uses desktop, phone, and iPad. Admin/member tools must remain practical on smaller screens.

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
- **`PROJECTS`** — applications, member profiles, Discord onboarding state, recruitment DM/alert state, new-member onboarding state, and other structured project data.
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

---

## Validation status

Confirmed live before the latest hardening pass:
- custom Applicant/Guest Discord buttons work;
- Applicant ↔ Guest switching works;
- Applicant one-time DM works;
- Discord Interactions endpoint works;
- The High Council test alert works;
- application submission alerts are wired;
- Site Admin Lab is accessible to Wolf.

**Implemented but still awaiting live end-to-end validation after deployment:**
- automatic Member-role provisioning on approval;
- acceptance DM production path;
- in-game application verification gate;
- Accepted/Declined terminal state rules;
- decline DM/applicant message;
- reapplication archive + reopen + DM;
- new-member onboarding checklist.

Do not label these latest items “validated” until Wolf tests them or a real applicant completes the flow.
