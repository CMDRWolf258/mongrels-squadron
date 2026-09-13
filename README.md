# Mongrels Squadron Site v56 — Assistant Stability + Smart Briefings

This batch keeps the Mongrel Assistant read-only while improving mobile stability and day-to-day usefulness.

## Assistant reliability
- Fixes the iPhone/iOS keyboard-dismiss lockup seen after tapping the keyboard Done/checkmark.
- Removes `touch-action:none` from the page-wide scroll lock so the assistant itself remains tappable after keyboard transitions.
- Keeps the assistant's top edge anchored; keyboard changes reduce the internal message area instead of shifting the entire panel upward.
- Re-syncs the visual viewport after focus, blur, resize, orientation changes, and keyboard dismissal to recover from stale Safari viewport measurements.
- Keeps background page scrolling locked while the assistant is open and restores the original page position on close.

## Assistant capability/UX improvements
- Adds suggested prompts when opening an empty chat:
  - What's happening today?
  - What are today's Daily Orders?
  - Any carrier moves or loading jobs?
  - What PvP events are coming up?
- Broad daily-briefing questions now pull compact context across orders, projects/events, carriers, trades, and PvP notices.
- Stronger role/privacy filtering removes hidden ownership/user IDs from dynamic records before they reach the model.
- Explicit freshness guidance tells the assistant to call out stale/aging carrier or market data instead of presenting it as live.
- Navigation questions are answered more directly and continue to receive relevant site shortcut buttons.
- Answers are concise by default to keep the assistant fast and inexpensive.

## Existing behavior retained
- 48-hour cross-device conversation history.
- Clear Chat.
- Member/Officer/Site Admin monthly AI budgets and the $30 site ceiling.
- Read-only behavior; the assistant cannot create or edit site records.
- Officer-only Daily Orders notes remain hidden from ordinary Members.

No new Cloudflare variables, KV namespaces, bindings, or OpenAI permissions are required for v56.
