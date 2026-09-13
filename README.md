# Regiment of Imperial Mongrels — v44 Operations Usability Batch

This package rolls the latest Operations and homepage polish into one deployment.

## Included
- Daily Orders moved directly below the Operations summary so members see today's tasking first.
- Operations shortcut order changed to Overview → Daily Orders → Priority Systems → Watch List → All Systems → Resources.
- Removed the two explanatory Operations cards that duplicated the public/private sections.
- Operations summary now shows Priority Systems, Systems Needing Attention, Active Orders, and Data Updated.
- Active Orders remains hidden (`—`) for signed-out visitors and is populated only after authenticated Daily Orders load.
- Systems Needing Attention counts systems outside their target influence range or currently on the Watch List.
- Copy-system controls added to Priority Systems, Watch List, All Systems, and retained on Daily Orders tasks.
- Home-page four-block status strip removed; the direct Daily Orders / Join / Discord actions remain.
- Home → Daily Orders and Operations shortcut anchors now land the briefing immediately beneath the sticky headers across desktop/tablet/phone.
- Progressive navigation from v43 retained.
- Officer editor now warns before discarding unpublished changes or navigating away with unsaved edits.
- Publish Orders remains the clear primary action; other editor controls remain secondary.

## Deployment
Upload/replace the full package in the GitHub repository and allow Cloudflare Pages to redeploy.

No new Cloudflare variables, secrets, KV namespaces, or Discord settings are required for v44.
