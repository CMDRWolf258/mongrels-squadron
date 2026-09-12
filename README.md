# Mongrels Squadron Site — v34 Secure Discord Sessions

This version connects the Cloudflare Pages deployment to Discord OAuth and creates a signed, first-party website session.

## What changed

- Added Cloudflare Pages Functions:
  - `/api/auth/login`
  - `/api/auth/callback`
  - `/api/auth/session`
  - `/api/auth/logout`
- Discord OAuth uses `identify` + `guilds.members.read` only.
- Access mapping:
  - Wolf's configured Discord user ID -> Site Admin
  - configured officer roles -> Officer
  - configured member role -> Member
  - other Discord accounts -> No Website Access
- Session data is HMAC-signed with `SESSION_SECRET` and stored only in an HttpOnly, Secure, SameSite=Lax cookie.
- Discord access tokens are used only during the callback and are not stored in the browser or session cookie.
- Member Portal now has a working login/logout flow.
- Header member control displays the authenticated name + website access level.

## Cloudflare Production variables required

Normal variables:
- `CLIENT_ID`
- `REDIRECT_URI=https://mongrels-squadron.pages.dev/api/auth/callback`
- `ADMIN_USER_ID`
- `GUILD_ID`
- `MEMBER_ROLE_ID`
- `OFFICER_ROLE_IDS` (comma separated)

Secrets:
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`

## Discord Developer Portal

Keep this Redirect URI configured:

`https://mongrels-squadron.pages.dev/api/auth/callback`

The old workers.dev callback may remain temporarily as a fallback during testing.

## Deploy

Upload/commit the v34 files to the same GitHub repository connected to Cloudflare Pages. Cloudflare should automatically create a new deployment. The `functions/` directory must remain at repository root.

## First test

1. Wait for the Cloudflare Pages deployment to finish.
2. Open `https://mongrels-squadron.pages.dev/member/`.
3. Click **Sign in with Discord**.
4. Complete Discord authorization.
5. The Member Portal should show the signed-in Discord display name and the website access level.
6. Wolf's configured account should show **Site Admin**.
7. Refresh another public page and confirm the header shows `<display name> · Site Admin`.
8. Click **Sign out** and confirm the Member Portal returns to the signed-out state.

Member and Officer role mapping can be tested later when another squad member is available.
