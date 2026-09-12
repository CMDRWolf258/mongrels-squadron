# Mongrels Squadron Site v39 — Daily Orders Cleanup

This build cleans up the authenticated Daily Orders experience.

## Changes
- Fixes native `hidden` panels being overridden by component display rules.
- Signed-out visitors see only the protected/locked Daily Orders panel.
- Signed-in members see only the secure briefing panel.
- Replaces the large temporary access-check panel with a compact loading indicator.
- Removes the temporary officer-management development note until editing controls are actually available.
- Bumps static asset cache version to v39.

Upload the full package to the repository and allow Cloudflare Pages to redeploy.
