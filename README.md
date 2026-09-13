# Regiment of Imperial Mongrels — v59

Expanded Elite engineering knowledge library + public Guides.

## Elite Knowledge Library
- Expanded `data/elite-knowledge.json` from the v58 pilot to 31 curated entries.
- Added broader weapon experimentals, including Thermal Vent, Emissive Munitions, Scramble Spectrum, Phasing Sequence, Plasma Slug, Super Penetrator, Dispersal Field, Target Lock Breaker, Screening Shell, and Thermal Conduit.
- Added core-module engineering guidance for FSD/SCO drives, Dirty Drives, Power Plant choices, Power Distributor choices, Sensors, and Life Support.
- Added deeper defensive notes for armour, shield resistance planning, and Module Reinforcement Packages.
- Expanded Assistant keyword routing so these subjects retrieve only the most relevant local knowledge entries.
- Assistant now links covered engineering questions to the public Guides when useful.

## Public Guides
- Added `/guides/` as a public Field Manual / Engineering Library.
- Added Guides to the primary site navigation.
- Guide layout supports two levels of detail: fast starter rules plus expandable veteran notes.
- Initial guides cover Engineering Fundamentals, general combat engineering, travel/utility engineering, weapon experimentals, defensive engineering, and core modules.
- The Ships Engineering Desk now links directly into the guide library.
- Guides and Ask the Mongrels intentionally share the same underlying recommendations so the site does not maintain two conflicting bodies of advice.

## Reference policy
- Entries are original Mongrel summaries, not copied articles.
- Primary reference links currently point to INARA's blueprint and experimental-effect databases.
- Knowledge is marked reviewed 2026-09-13 and should be refreshed when Frontier changes engineering or module behavior.
- No live web-search tool is enabled in this release; ordinary covered engineering questions continue to use the inexpensive local knowledge path.

## Setup
No new Cloudflare variables, secrets, KV namespaces, or bindings are required.

Upload the complete package and allow Cloudflare Pages to redeploy.
