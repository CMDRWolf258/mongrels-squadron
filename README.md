# Mongrels Squadron Site — v14 Live BGS

This version introduces the first automatic public BGS feed.

## What changed
- `data/systems.json` remains the squad's strategic configuration: target ranges, objectives, priority flags, and public notes.
- `data/live-bgs.json` stores the latest public game-data snapshot.
- `scripts/update_bgs.py` queries EliteBGS for the configured systems.
- `.github/workflows/update-bgs.yml` runs the refresh every two hours and can also be run manually.
- Operations merges live values over the strategic configuration in the browser.
- If EliteBGS is unavailable, the previous live snapshot/manual values remain usable.

## First-time GitHub setup
Upload the entire contents of this version over the repository, preserving folders. Then open **Actions → Refresh BGS data → Run workflow** to trigger the first sync.

The workflow needs repository write permission so it can commit `data/live-bgs.json`. If GitHub blocks the commit, go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and save.

GitHub Pages will redeploy after the generated data file is committed.
