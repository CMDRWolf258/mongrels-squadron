# Regiment of Imperial Mongrels — v57

Mobile/iPad assistant and Safari polish batch.

## Changes
- Phones now open the Mongrel Assistant on a dedicated `/assistant/` page instead of a fixed overlay.
- The dedicated phone page keeps the same Discord session, 48-hour history, usage budget, suggested prompts, and AI backend.
- Desktop keeps the existing floating assistant.
- iPad/tablet keeps the overlay, but no longer follows Safari visualViewport keyboard measurements.
- Dark root backgrounds reduce white flashes during Safari rubber-band/overscroll.
- Assistant launcher uses safe-area-aware fixed offsets and compositor anchoring to reduce iPad drift while browser chrome expands/collapses.
- No new Cloudflare variables, secrets, KV namespaces, or bindings are required.

Upload the complete package and allow Cloudflare Pages to redeploy.
