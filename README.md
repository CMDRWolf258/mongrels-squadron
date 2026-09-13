# Mongrels Squadron Site — v50

This batch adds the secure PvP bounty board and enlarges the Mongrels browser-tab icon.

## New PvP functionality
- Member-only in-game bounty board.
- Members can create, edit, and delete their own bounty posts.
- Officers and Site Admin can moderate any bounty.
- Filters: Active, Claimed, Complete, My Posts, All.
- Fields include Target CMDR, reward, optional system/location, status, expiration, contract terms, and proof required.
- System names include copy-to-clipboard controls.
- Member Portal now previews active bounty contracts.
- The external squadmate PvP statistics integration remains intentionally on hold.

## Cloudflare setup required
Create a KV namespace, for example:

`mongrels-bounties`

Then in **mongrels-squadron → Settings → Bindings**, add:

- Type: KV namespace
- Variable name: `BOUNTIES`
- Namespace: `mongrels-bounties`

Do not manually add KV pairs. The website writes them automatically.

## Favicon
The browser-tab icon was regenerated with a tighter crop so the Mongrels crest appears larger at favicon size. Browsers cache favicons aggressively, so an old icon may remain temporarily after deployment.
