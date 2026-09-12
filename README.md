# The Mongrels Squadron Site — v5 Operations

This build adds the first functional shell for the Operations / BGS section.

## Changed files
- `operations/index.html`
- `css/global.css`
- `js/operations.js` (new)
- `data/systems.json` (expanded schema, currently empty)

The Operations page is data-ready but intentionally contains no invented live BGS values. Priority cards and the systems table will populate from `data/systems.json` when real data is added.

A future private Daily Orders area is visibly reserved for authenticated members, and an external Squad Tools card reserves a place for the member-built PvP statistics project.

## v6 additions
- Added a dedicated PvP section to the main navigation.
- Moved the PvP Combat Statistics launch point out of Operations.
- Added a data-driven in-game Bounty Board using `data/bounties.json` and `js/pvp.js`.
- Reserved a future authenticated member workflow for posting and managing bounties.
