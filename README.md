# Regiment of Imperial Mongrels — v64

Mission Control privacy + automatic full faction footprint + private BGS playbook.

## Mission Control is now member-only
- `/operations/` is now a public login doorway only until the viewer has an authenticated Mongrels member session.
- Priority Systems, Watch List, All Systems, summary counts, Daily Orders, BGS targets, and operational resources are hidden from signed-out visitors.
- The protection is not only CSS: Mission Control data is returned through `/api/operations/systems`, which requires Member / Officer / Site Admin access.
- Ask the Mongrels no longer loads Mission Control strategy/system context for unauthenticated/public context.

## Private strategy storage
- Strategic targets, priority flags, desired states, watch notes, and objectives are no longer shipped in public `data/systems.json`.
- v64 uses the already-configured `DAILY_ORDERS` KV namespace with a separate key: `bgs-strategy-v1`.
- On the first authenticated Mission Control load, the v63 strategy seed is written into that private KV key automatically. Officers/Site Admin can then maintain strategy through the new in-page **Manage Private Strategy** editor, so future focus changes never need to be committed to public JSON.
- `data/systems.json` remains only as a harmless compatibility marker and contains no system names or targets.
- No new Cloudflare KV namespace or binding is required.

## Automatic All Systems population
- `scripts/update_bgs.py` now writes every Mongrel faction-presence row returned by EliteHub Vault / EDDN instead of filtering down to the manually configured priority systems.
- New faction presences therefore appear automatically after a BGS refresh.
- Systems that disappear from the faction-presence feed are retained as `Former Presence` records instead of silently vanishing.
- A defensive completeness check prevents a badly truncated upstream result from marking hundreds of systems as former presences.
- All Systems now supports search plus filters for Priority, Watch/Attention, Controlled, Not Controlled, Below/Above Target, Conflict, Expansion Watch, Retreat Watch, Stale/Aging, and Former Presence.
- Freshness labels distinguish Fresh, Aging, Stale, Unknown, and Former Presence data.

## Private Member BGS Playbook
- Quantified daily workload benchmarks were removed from the public BGS Field Manual and public Elite Knowledge JSON.
- Authenticated Mission Control now contains the private workload table for mission INF, bounty vouchers, exploration data, and profitable trade.
- Added member quick-reference recipes for raising/lowering influence, avoiding Expansion, saving/forcing Retreat, War/Civil War, and Elections.
- The public BGS guide still teaches mechanics and general strategy, but points members to Mission Control for squad operational tasking.
- Ask the Mongrels can use the private operational playbook only for authenticated member conversations.

## BGS refresh after deployment
The package contains the previous placeholder snapshot. After uploading v64, run the existing GitHub Action **Refresh BGS data** once (or wait for the two-hour schedule). The first successful v64 run should populate the complete Mongrel faction footprint instead of only the previously tracked six systems.

## Setup
No new Cloudflare variables, secrets, KV namespaces, or bindings are required.

Upload the complete package, allow Cloudflare Pages to redeploy, then:
1. Run **Refresh BGS data** in GitHub Actions once.
2. Open Mission Control while signed in; this seeds the private strategy key into the existing `DAILY_ORDERS` KV namespace.
3. Confirm All Systems count, Priority Systems, Watch List, and the Member BGS Playbook.
4. As Site Admin, open **Manage Private Strategy** and confirm the six migrated priority systems are present; future priority/target edits can be saved there without touching GitHub.
5. Open Mission Control in a signed-out/private browser window and confirm that only the member login gate is visible.

### Historical privacy note
Prior releases intentionally published Priority/Watch data, so old Git commits and previously deployed copies may still contain those historical values. v64 stops publishing new strategy changes. If the GitHub repository itself is public and you eventually want historical values removed as well, that is a separate repository-history/privacy cleanup rather than a site-code change.
