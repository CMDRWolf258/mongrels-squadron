# Regiment of Imperial Mongrels — v65

Mission Control usability pass: paginated All Systems, automatic default influence bands, stronger Retreat warnings, and a collapsible member playbook.

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
