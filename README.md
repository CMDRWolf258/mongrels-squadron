# v55 — Assistant Keyboard / Viewport Fix

This release refines the Mongrel Assistant on iPhone and iPad.

- Keeps the assistant shell anchored instead of resizing/repositioning the whole panel when the keyboard opens.
- Uses a keyboard inset inside the assistant so only the conversation area gives up space.
- Pins the header/close controls and composer within the assistant.
- Hard-locks the background page while the assistant is open on touch layouts, preserving and restoring the original scroll position.
- Prevents touch/overscroll from leaking from the assistant conversation into the page behind it.
- Keeps 16px mobile text input sizing to prevent iOS focus zoom.
- Retains the 48-hour cross-device history and role-aware assistant behavior from v54.

No new Cloudflare variables or bindings are required.
