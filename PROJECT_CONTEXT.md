# Mongrels Squadron Website — Project Context

_Last updated: 2026-09-15_

## Read this first

**AI / developer handoff:** Before making changes to this project, read this file and inspect the current repository state. The repository is the source of truth. If this document, a prior chat, memory, a screenshot, or an old release note conflicts with current code, **current code wins**.

Do not reuse remembered file SHAs. Fetch the current file before modifying it, then update using the current blob SHA.

This document is intentionally a handoff/architecture guide, not a duplicate of the codebase. Update it after meaningful architecture, permission, workflow, integration, or project-direction changes. Do not update it for every cosmetic edit.

---

## Project identity

- **Site:** Regiment of Imperial Mongrels squadron website for Elite Dangerous.
- **Repository:** `CMDRWolf258/mongrels-squadron`
- **Production:** `https://mongrels-squadron.pages.dev/`
- **Hosting:** Cloudflare Pages with Pages Functions and KV-backed server-side features.
- **Owner / Site Admin:** CMDR Wolf258 (Wolf). Site Admin is intentionally a Wolf-only authority tier.
- **Official squadron home:** Diaba.

The site is both a public squadron presence and a private operational/member platform. Public content, authenticated member tools, officer management, recruitment, Discord integration, BGS tooling, projects, carriers, trade, PvP, member profiles, guides, and the Mongrel assistant all live in the same project.

---

## Core product philosophy

### Website vs Discord

Use the **website as the source of truth for structured data and workflows**. Use **Discord for communication, identity/community, notifications, and immediate coordination**.

Examples:
- Applications live on the website; Discord announces submissions.
- Member/officer authority is resolved server-side from Discord identity/roles.
- Discord onboarding routes prospects into the website application workflow.
- Operational data and tools belong on the site; Discord can alert or point to them.

### Visibility states

When an authenticated workflow is completed, prefer showing a clear completed/status state instead of making the feature disappear.

Examples:
- Existing members visiting recruitment/application areas should see a member/preview state rather than a missing button.
- Submitted applications remain visible to the applicant with their status.

### Mobile matters

Wolf travels often and regularly uses the site from desktop, phone, and iPad. Admin/member workflows should remain usable on smaller screens and should not assume desktop-only interaction.

---

## Visual / UX baseline

- Dark black/charcoal foundation.
- Cyan/blue accent system.
- Restrained military / tactical / HUD influence; avoid turning the interface into a noisy sci-fi dashboard.
- Personal Elite Dangerous screenshots are used as hero imagery where appropriate.
- Decorative motifs stay behind readable content and are reduced on phones.
- Navigation label is **CARRIERS**, not Fleet.
- Keep layouts responsive and avoid overlapping fixed-height card/grid assumptions.

Current visual identity work is described in the README release notes, but inspect `css/global.css` and the current page markup before extending it.

---

## Authentication and authority model

Authentication is Discord OAuth, implemented in `lib/auth.js` and the `/api/auth/*` Pages Functions.

OAuth scope:
- `identify`
- `guilds.members.read`

Website access levels:
1. **Public** — no authenticated authority.
2. **Member** — authenticated Mongrel member.
3. **Officer** — member plus approved management capabilities.
4. **Site Admin** — Wolf-only website authority.

Important behavior:
- `ADMIN_USER_ID` resolves directly to `site_admin`.
- Officer access is based on `OFFICER_ROLE_IDS`.
- Member access is based on `MEMBER_ROLE_ID`.
- A Discord server member who does not yet have the full Member role can still authenticate with `access: no_access` and `membershipVerified: true`. This is intentional so Applicants can use the website application system.
- Sessions are signed server-side and stored in the `mongrels_session` cookie.

Never replace server-side authorization with UI hiding alone. Buttons/links may be hidden for UX, but privileged API routes must enforce access themselves.

---

## Secrets, variables, and bindings

### Never commit or paste secret values

Treat at least these as secrets:
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`

Do not place secret values in GitHub, public JavaScript, project documentation, screenshots, or chat messages.

### Important environment configuration

Common environment variables used by the current architecture include:
- `CLIENT_ID`
- `REDIRECT_URI`
- `GUILD_ID`
- `MEMBER_ROLE_ID`
- `OFFICER_ROLE_IDS`
- `ADMIN_USER_ID`
- `DISCORD_PUBLIC_KEY` (optional override; public/non-secret)
- `APPLICANT_ROLE_ID` (optional override)
- `GUEST_ROLE_ID` (optional override)
- `WELCOME_CHANNEL_ID` (optional override)
- `RECRUITMENT_CHANNEL_ID` (optional override)

### KV bindings

Confirmed important bindings:
- **`PROJECTS`** — reused by several current structured features, including applications, member profiles, Discord onboarding state, one-time Applicant DM state, onboarding bundle state, and recruitment alert idempotency state.
- **`DAILY_ORDERS`** — includes private Mission Control/BGS strategy state and operating-band configuration.

Do not add a new KV namespace casually. Reuse existing bindings when the data shape/scale is appropriate; split storage only when there is a clear operational reason.

---

## Discord recruitment integration

The project uses the existing Discord bot/application **Imperial Mongrels Website**. Do not introduce another general-purpose bot just to duplicate functionality.

### Safe-to-commit Discord identifiers

These are IDs/public data, not secrets:

- Discord application public key: `4d86ba25b2e8457730d568864182cbdf9b7057bd174b6201698f650ac5206064`
- Applicant role: `1012130660187656233`
- Guest role: `1017264444553838622`
- Welcome channel: `1012755466700460163`
- Recruitment review channel — **The High Council**: `1426641891381739612`

Defaults live in `lib/discord-onboarding.js` and `lib/discord-recruitment.js`, with environment-variable overrides supported.

### Bot permission philosophy

Use minimum required permissions. Do **not** grant Administrator merely to make an integration easy.

For the current recruitment flow the bot needs, as applicable:
- View Channel
- Send Messages
- Embed Links
- Manage Roles

The bot role must sit above Applicant and Guest for role assignment/removal.

### Current onboarding flow

Public flow:

**Join Discord → Welcome → choose Applicant or Guest**

Applicant path:
1. User clicks the custom `🐺 Applicant` button.
2. Bot adds Applicant.
3. Bot removes Guest if present.
4. Bot sends an ephemeral confirmation.
5. Bot sends a **one-time** Applicant welcome DM containing application/rules links.
6. Applicant completes the website application.

Guest path:
1. User clicks `🤝 Guest`.
2. Bot adds Guest.
3. Bot removes Applicant if present.

The selector custom IDs are:
- `mongrels_onboarding_applicant`
- `mongrels_onboarding_guest`

Discord Interactions endpoint:
- `/api/discord/interactions`

The website can publish the bot-owned selector/Ready-to-Apply bundle to `#welcome` from the Site Admin tool.

### Applicant DM anti-spam behavior

`sendApplicantWelcomeOnce()` stores per-user state in `PROJECTS` under prefix:
- `discord-applicant-welcome-v1:`

Behavior:
- successful DM is sent once per user;
- role switching does not resend it;
- pending state reduces immediate click races;
- failed sends enter a retry cooldown.

Current limitation: the DM helper does **not** check the applicant's current website application status before sending. It relies on one-time DM state only.

### Wolf testing bypass

`isEstablishedMember()` deliberately treats the Site Admin user as testable before checking Member/Officer roles, so Wolf can exercise Applicant/Guest buttons while already being an established Mongrel. Do not remove this casually; it exists for admin testing.

---

## Recruitment application system

Primary files:
- `apply/index.html`
- `js/application.js`
- `css/application.css`
- `applications/index.html`
- `js/applications-admin.js`
- `functions/api/applications/index.js`

Storage:
- `PROJECTS` KV
- key: `applications-v1`

Application lifecycle:
- `draft`
- `submitted`
- `under_review`
- `accepted`
- `declined`

Rules:
- One application per Discord owner ID.
- Drafts can be saved repeatedly.
- Submission locks applicant editing.
- Drafts are private and excluded from officer review lists.
- Officers and Site Admin can review submitted/non-draft applications.
- Officer notes are private.
- Full members/officers/site admin cannot submit a new application; they receive a member/preview experience instead.
- Acceptance does **not** automatically promote Discord roles in v1; final membership-role handling remains manual unless intentionally changed later.

Tone requirement: this is a squad application, not a job interview. Short answers and low-pressure language are intentional.

---

## Recruitment officer notifications

When an application is successfully submitted, the website attempts to post a Discord alert to **The High Council** using `lib/discord-recruitment.js`.

The application save is authoritative. A Discord outage must **not** make an otherwise valid application submission fail.

Alert content includes:
- CMDR name
- Discord identity/mention
- Submitted status/time
- `Review Application` link to `/applications/`

Alert idempotency state is stored per application in `PROJECTS` under:
- `discord-recruitment-alert-v1:`

The helper uses pending/attempt state to reduce duplicate sends and a retry cooldown after failure. KV is eventually consistent, so this is strong practical duplicate protection rather than a transactional database guarantee.

---

## Site Admin Lab / onboarding controls

Wolf has a Site Admin-only link from the Member Portal to:
- `/discord-onboarding/`

This page began as recruitment onboarding controls but is intentionally becoming a **Site Admin Lab** for safe test buttons and diagnostics.

Current capabilities include:
- Discord recruitment backend/config status
- publish replacement Applicant/Guest selector
- test The High Council recruitment alert

Future admin-only test utilities can live here when they are useful and safe. Keep destructive actions clearly separated/labeled and require server-side Site Admin authorization plus same-origin/request markers.

---

## Member Portal

`/member/` is the authenticated dashboard and should remain the primary private launch point.

Current dashboard areas include:
- Daily Orders
- Projects & Events
- Carrier Coordination
- Trader's Outpost
- Squadron Roster
- PvP tools
- Member resources
- Officer Tools for Officer+
- Site Admin-only utilities such as Assistant Knowledge Gaps and Site Admin Lab

Site Admin-only dashboard links use `data-dashboard-site-admin` and are revealed only when the session access is `site_admin`. Privileged destination APIs must still enforce Site Admin independently.

---

## Mission Control / BGS principles

Mission Control is member-only and uses live/refreshable faction/system data plus private officer strategy.

Current strategy concepts include:
- automatic operating bands for controlled vs non-controlled Mongrel presences;
- per-system overrides;
- watch/attention handling;
- retreat warnings;
- private officer strategy stored server-side;
- live system/presence refresh with former presences retained.

Important project convention: operational BGS guidance should be concrete and quantified where possible rather than vague. Examples include explicit bounty-credit targets, mission INF targets, which factions to support/avoid, and stop conditions.

The user uses **INF** to mean mission Influence reward ticks/pips, not faction influence percentage points. Keep these distinct in BGS tools/content.

If modifying BGS thresholds or defaults, inspect the current Mission Control code and stored-strategy migration/version logic first. Do not rely on an old chat value.

---

## Other major site modules

The project is large. Current major areas include:
- Home
- About / history / rules
- Mission Control / Operations
- Projects & Events
- Recruitment
- Recruitment Applications / officer review
- Member Portal
- Squadron Roster
- Member Profiles
- CARRIERS / Carrier Coordination
- Trader's Outpost
- Ship Catalogue
- PvP tools / bounty board
- Gallery
- Guides / Field Manual / Mining Manual
- Ask the Mongrels assistant
- Assistant Knowledge Gaps
- Site Admin Lab / Discord onboarding controls

Do not assume a feature is unfinished because it is not described in this file. Search the repository first.

---

## Ask the Mongrels

The site includes an AI assistant with a modular knowledge base and knowledge-gap logging.

Guiding principles:
- Prefer curated squad/site knowledge and current structured site context.
- Keep public/member context boundaries intact.
- Member-only Mission Control context is only supplied after authentication.
- Knowledge gaps should feed future content improvements rather than encouraging invented answers.

When extending assistant knowledge, favor modular additions and current Elite Dangerous research over one giant monolithic prompt/file.

---

## Squadron rules/content conventions that affect the site

Important recruitment/squad expectations:
- Mongrels operate primarily in **Open Play**.
- Squad BGS activity must be performed in **Open**.
- Teamwork is central to the squad culture.
- Respectful conduct/fair play is expected.
- Combat logging is prohibited.
- Solo/Private Group use is limited to rare exceptions and is not a way to avoid player opposition during squad BGS work.

Do not silently weaken these rules in recruitment copy or application expectations.

---

## Development workflow — important

### Before editing

1. Read this file when entering from a new chat/context.
2. Inspect the current repository implementation relevant to the task.
3. Fetch every existing file that will be modified and use its **current SHA**.
4. Treat the repository as the source of truth.
5. Check whether the requested behavior already exists before adding a duplicate feature.

### While editing

- Prefer direct GitHub implementation; Wolf generally does not want to manually replace whole files.
- Keep changes scoped and understandable.
- Preserve existing auth/permission boundaries.
- Use server-side checks for privileged actions.
- Reuse established patterns/helpers rather than creating parallel implementations.
- Keep mobile/tablet behavior in mind.
- For multi-step work, give short progress updates rather than disappearing into a long opaque process.

### After editing

- Do not claim production deployment is verified unless it was actually checked or Wolf confirms it.
- GitHub commit success means the source changed; Cloudflare deployment is a separate step.
- When adding integrations, test the narrowest safe operation first (for example, a harmless Discord test alert before relying on a live workflow).

---

## Image / media workflow

Avoid base64 image embedding/encoding as a normal workflow. It has been slow, fragile, and unpleasant for this project.

Prefer:
- normal repository image files;
- efficient image formats (WebP/PNG/JPEG as appropriate);
- direct GitHub/file workflows;
- ZIP/batch workflows when many images need to be added.

Do not reintroduce base64 blobs into HTML/CSS unless there is a very specific reason and Wolf explicitly accepts the tradeoff.

---

## Discord / bot design rules

- Prefer the existing **Imperial Mongrels Website** bot for site-specific Discord actions.
- Prefer webhooks for simple one-way notifications when a bot interaction is not needed.
- Avoid adding overlapping general-purpose bots.
- Reverse/slash-command workflows are not a priority unless there is a clear use case.
- Role assignment on recruitment acceptance is currently manual.
- Keep bot permissions minimal.

Existing unrelated/legacy bots may still be present in the server. Do not turn a focused website task into a whole-server bot cleanup unless Wolf explicitly asks.

---

## Known technical debt / future hardening

Items worth remembering, but not automatically changing without a reason:

- Applicant welcome DM is one-time state-based and does not currently suppress itself based on submitted/accepted application status.
- Discord interaction signature verification is implemented with Ed25519; current production verification has been proven by successful button usage.
- Recruitment/onboarding idempotency is KV-based and therefore not fully transactional under simultaneous races.
- Recruitment acceptance role promotion remains manual.
- The Site Admin Lab can grow into a broader diagnostics/test console.
- Moderated Gallery and Ship Build submission/approval workflows were intentionally deferred in earlier releases.
- A future Discord/server cleanup may reduce redundant legacy bots, but it is not part of normal website feature work.

---

## Current validated recruitment state

As of this document update:
- Custom Imperial Mongrels Website Applicant/Guest buttons are working in Discord.
- Applicant ↔ Guest role switching works.
- Applicant one-time DM anti-spam behavior has been tested successfully.
- Discord Interactions endpoint is connected and operational.
- The High Council test alert works.
- Application submission alerts are wired to The High Council.
- `/discord-onboarding/` works as a Site Admin-only control/test page.
- Member Portal includes a Wolf-only **Site Admin Lab** link.

Do not assume these are broken merely because an older MEE6/Appy flow still appears in historical notes. Inspect current Discord/site behavior and code.

---

## How to maintain this document

Update `PROJECT_CONTEXT.md` when any of these change materially:
- hosting/runtime architecture;
- auth/access model;
- important Cloudflare bindings;
- Discord bot/integration architecture;
- recruitment/application workflow;
- major site modules;
- durable design/content conventions;
- development workflow expectations;
- major known limitations or deferred architecture decisions.

Do **not** turn this into a changelog. The README/repository history already serve that purpose.

When starting a new ChatGPT session, the ideal handoff prompt is simply:

> We're continuing the Mongrels website. Read `PROJECT_CONTEXT.md` and inspect the current repo before making changes.
