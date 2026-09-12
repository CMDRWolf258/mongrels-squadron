# Regiment of Imperial Mongrels — v41

Daily Orders presentation fixes:

- Restores visible line breaks from the Daily Orders editor in briefing text, task details, and leadership notes.
- Gives the desktop **Edit Orders** button an explicit cyan-on-dark style so it no longer renders nearly black under desktop browser button defaults.
- Retains the v40 secure Officer/Site Admin editor and private KV-backed orders storage.
- Asset query versions bumped to `v=41` to reduce stale CSS/JS caching.


## v42 — Consistent controls + multiline text
- Applied explicit readable colors to every `.btn` button so desktop browser defaults cannot make controls look black-on-black.
- Added a reusable `btn-secondary` treatment used by Edit Orders, Add Order, and Clear Published Orders.
- Ensured the unmodified Publish Orders `.btn` also has an explicit readable foreground/background.
- Preserved officer-authored line breaks in briefing summaries, leadership notes, and task details.
- Bumped front-end asset query versions to v42 to reduce stale-cache problems.
