# Regiment of Imperial Mongrels — v68

Current package includes all prior releases through v67 plus the v68 Member Experience / Roster v2 update.

## All Systems pagination
- All Systems now shows **15 systems per page by default** instead of rendering the entire Mongrel footprint at once.
- Members can switch the page size to 15, 25, 50, or 100 rows.
- Search, filters, and sorting operate on the complete matching result set; pagination is applied afterward.
- Previous/Next controls show the current page plus the visible row range and total matching systems.
- Changing search/filter/sort/page size returns the list to page 1.

## Automatic operating bands
Officer / Site Admin strategy controls now include persistent default target ranges:
- **Mongrel-controlled systems:** 40–65% influence
- **Non-controlled Mongrel presences:** 15–65% influence
- **Retreat warning:** below 5% influence

These values live in the existing private BGS strategy record in `DAILY_ORDERS` KV and can be changed later from Mission Control without a GitHub edit. No new binding is required.

A system-specific target remains an override. Leaving the target fields blank means that system inherits the appropriate controlled/non-controlled default band. Existing manual bands (such as 10-16's 40–55% target) remain intact.

This also fixes the prior UI behavior where blank/null target values could be interpreted by the browser as `0`, producing misleading `0–0%` target messages.

## Retreat warning
- Active Mongrel presences below the configured Retreat-warning threshold receive a stronger red `RETREAT WARNING` treatment in All Systems.
- They automatically enter the Watch / Attention view.
- The threshold is editable in Officer Controls and defaults to **below 5%**.
- An actual active/pending Retreat state also triggers the same operational warning path.

## Collapsible Member BGS Playbook
The large playbook no longer occupies the page by default.
- **General Positive Daily Levers** is one collapsed section containing the workload benchmark table.
- Each strategy recipe (Raise a faction, Lower a faction, Avoid Expansion, Save Retreat, Force Retreat, War/Civil War, Election) is its own collapsed section.
- Members can open only the reference they need while working.

## Existing v64 privacy/live-data behavior remains
- Mission Control remains fully Member-only.
- Officer strategy remains server-side/private.
- All Systems remains auto-populated by the EDDN/Vault-backed refresh.
- New presences appear automatically; former presences are retained.
- Ask the Mongrels continues to receive member-only Mission Control context only after authentication.

## Setup
No new Cloudflare variables, secrets, KV namespaces, or bindings are required.

Upload the complete package and let Cloudflare Pages redeploy. Existing v64 strategy data is automatically normalized to the v65 default-band structure when read; defaults are saved to KV the next time an Officer/Site Admin saves Private Strategy.


## v66 — Mining Field Manual + Mission Control polish
- Added a full Mining Field Manual covering laser, core, subsurface, asteroid surface deposits, selling/logistics, and Rhino surface mining.
- Added current Rhino guidance: 72 t cargo, Planetary Mining Locations, scanner/refinery loop, up to six active rigs in current field demonstrations, 12-chunk maximum rig output after 4.4.1.1, and uncertainty labels for still-evolving mechanics.
- Added surface-site scouting methodology with coordinates, rig count, terrain, clusters, repeatability, and logistics.
- Expanded the shared Elite Knowledge Base and Glossary with mining/Rhino entries and enabled Ask the Mongrels retrieval/linking for mining questions.
- Mission Control: pagination now returns to the All Systems section header, colonization-related Expansion tags below 67% no longer create an Expansion Risk warning, and the BGS playbook is nested under one Choose Your Task disclosure.


## v67 — Member Profiles & Squadron Roster

- Added private Discord-authenticated `/members/` squadron roster.
- Added `/profile/` member detail pages with self-service profile editing.
- Members can publish CMDR name, tagline, bio, home system, specialties, preferred activities, availability/contact note, carrier info, and up to six showcased ships.
- Privacy controls allow members to hide their directory entry, Discord display name, bio, carrier data, or ship showcase.
- Squadron rank and leadership-role fields are Officer/Site Admin managed on the backend; members cannot self-promote by editing request payloads.
- Officers/Site Admin can edit member profiles for moderation and rank/leadership maintenance.
- Profile pages automatically show contribution counts from existing Projects, Trader's Outpost, PvP bounties, and registered carriers where available. Registered carrier cards are derived from the existing carrier registry.
- Added Squadron Roster access to the Member Portal and Officer Tools.
- Ask the Mongrels can now answer member-directory/specialty questions from directory-visible profiles without receiving Discord IDs or hidden profile data.
- Profiles reuse the existing `PROJECTS` KV binding under the separate `profiles-v1` key, so no new Cloudflare binding or namespace is required. A dedicated KV/D1 store can be introduced later if the directory becomes large or needs richer history/querying.


## v68 — Member Experience / Roster v2

- Rebuilt Profile Visibility as bound checkbox/label rows so controls stay aligned on desktop, iPad, and phones.
- Replaced oversized activity pills with compact tags.
- Converted Specialties and Preferred Activities from free-form text into controlled selections so roster filtering and cross-links are reliable.
- Added structured availability status: Available to Help, Looking for Group, Busy, Away, or no status.
- Added roster filters for specialty, activity, availability, leadership, carrier owners, and members available to help.
- Specialties and activities are clickable and return to the roster filtered to matching CMDRs.
- Added profile-completion guidance for members with sparse profiles.
- Added clearer leadership badges and a responsive profile action bar.
- Contribution links now use the profile's opaque site ID rather than exposing Discord IDs. Projects & Events, Trader's Outpost, PvP Bounties, and the Carrier Registry can open filtered to the selected CMDR.
- Member-context filtering is resolved server-side against the private profile store; public carrier/trade endpoints only honor a profile filter for authenticated squad members.
- Added mobile/tablet cleanup for the editor, tags, action bar, roster filters, and linked-member filter banners.
- Moderated Gallery and Ship Build submissions remain intentionally deferred for a dedicated approval-workflow release.

No new Cloudflare variables, bindings, or KV namespaces are required. Existing profiles remain compatible; specialties/activities are normalized to the controlled lists when the profile is next saved.
