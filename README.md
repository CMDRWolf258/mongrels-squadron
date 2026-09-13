# Mongrels Squadron Site v51

## Major additions
- Trader's Outpost member posting system with owner-only editing for Members and Officer/Admin moderation.
- Strategic hauling and profit routes remain visually separated.
- Trade cards include freshness, expiration, system copy buttons, owner attribution, pad size, distance, quantity, and optional profit figures.
- Member Portal now previews active trade opportunities.
- PvP Combat Calendar now reads PvP events directly from Projects & Events.
- Officers/Site Admin can launch a prefilled PvP Event form from the PvP page.
- Events now support UTC time and PvP event type (Training, Organized Fight, Tournament, Wing PvP, Open Play Patrol, Other).
- Member Portal bounty rewards are more prominent.
- Favicon crop has slightly more top breathing room.

## Cloudflare setup required
Create a KV namespace, for example:

`mongrels-trades`

Then add it to the `mongrels-squadron` Pages project as a KV namespace binding:

- Variable name: `TRADES`
- Namespace: `mongrels-trades`

Do not manually add KV pairs; the site creates them.

Existing PROJECTS, BOUNTIES, CARRIERS, and DAILY_ORDERS bindings remain unchanged.
