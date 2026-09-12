# Mongrels Squadron Site v36 — Safari Login + Header Fixes

This release addresses three issues reported during cross-device testing:

- Adds a server-side two-step OAuth completion handoff so the secure session cookie is verified before the member page loads. This avoids relying on cached state or frontend retry timing, and is intended to make first-time Safari/iPad sign-in reliable.
- Prevents page-wide horizontal overflow on tablet layouts and makes the header collapse sooner.
- Keeps the Member Login / authenticated identity control readable at narrower desktop widths instead of collapsing it to an unexplained cyan dot.

New backend endpoint: `functions/api/auth/complete.js`.

Recommended: upload the full package contents so the new function, CSS, JS, and v36 cache-busting references all deploy together.
