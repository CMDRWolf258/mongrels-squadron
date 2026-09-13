# Regiment of Imperial Mongrels — v58

Elite Knowledge Base pilot + mobile assistant polish.

## Elite Knowledge Base pilot
- Added a curated local knowledge file at `data/elite-knowledge.json`.
- Initial deep-reference areas:
  - Weapon engineering / experimentals: Corrosive Shell, Incendiary Rounds, Auto Loader, Oversized, Feedback Cascade, Drag Munitions.
  - Defensive engineering: shield generators, shield boosters, Hull Reinforcement Packages.
- Assistant selects only relevant entries for each question instead of sending the whole knowledge base every time.
- Curated entries include rule-of-thumb guidance, deeper notes, common mistakes, PvE/PvP context, source names/URLs, review date, and stability metadata.
- The assistant prefers these local references over unsourced model knowledge when a covered topic is asked.
- Answers based on the local reference append a short knowledge-base source/review note.
- No live web-search tool is enabled in this version, so these answers do not incur web-search tool fees.

## Mobile/iPad polish
- Dedicated phone Assistant page is now non-scrollable at the document level; only the conversation log scrolls.
- Added a post-keyboard-dismiss reset for iOS Safari so the composer returns to its resting position after the keyboard closes.
- Simplified iPad launcher compositor behavior to reduce the small vertical drift caused by Safari browser-chrome expansion/collapse.

## Setup
No new Cloudflare variables, secrets, KV namespaces, or bindings are required.

Upload the complete package and allow Cloudflare Pages to redeploy.
