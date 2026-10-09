# Mongrel Scout Link — admin-only read-only ChatGPT connection

**Status:** Draft, OFF by default. No production rollout, credential changes, or Scout installer update is implied by this branch.

## Purpose

Expose a small, timestamped Elite Dangerous ship snapshot already available to MongrelScout (and previously only to MongrelHUD) through a read-only remote MCP tool for a personal ChatGPT plugin. This is NOT a second AI service or an OpenAI API integration.

**Device workflow:** The iPad operates alongside Serenity's HUD controller; while traveling, the laptop running Elite/Scout is the active telemetry source. Only one active Scout machine should publish during initial testing; the latest accepted observation is displayed with its timestamp and freshness.

## Data flow

1. On the active Elite PC, EDMC MongrelScout continues receiving Frontier Loadout journal events and Status.json. Existing local HUD bridge, site feed, and BGS operations are unchanged.
2. In **EDMC → Settings → Mongrel Scout**, the commander explicitly enables **Share minimal ship status with my private ChatGPT Scout Link**. The default is disabled. This setting is independent of normal Scout enablement.
3. The existing Scout HUD-site-feed loop schedules a separate non-blocking HTTPS POST of **only** the normalized minimal ship fields to `/api/scout-link/ingest`, with its existing Scout bearer token. There is no added cloud polling. Repeated identical data is throttled; errors retry with backoff without blocking the HUD feed.
4. Cloudflare accepts the upload only when `SCOUT_CHATGPT_LINK_ENABLED=true`, storage is configured, and that Scout token is currently associated with `ADMIN_USER_ID`. It rejects stale/invalid inputs, persists only the whitelist in existing `DAILY_ORDERS` KV, and expires the snapshot after 24 hours.
5. A website Site Admin can inspect `GET /api/scout-link/ship` with their existing Discord site session; ordinary members, officers, and the public cannot read it.
6. A remote MCP endpoint, `POST /api/scout-link/mcp`, advertises only the read-only `get_current_ship` tool. Access requires an OAuth bearer token that was issued only after the website's **exact Site Admin Discord session** approves access. Tokens have one-hour lifetime; scoped refresh tokens are rotatable. Both the whole link and its OAuth issuance are disabled when the feature flag is off.

## Shipped data whitelist

- Current system name
- Ship name/type
- Current jump range calculated locally by Scout
- Full-main-fuel / zero-cargo jump range projected on the backend using the **same journal engineering constants** and `UnladenMass` (clearly distinct from Elite's `MaxJumpRange`)
- Main fuel amount and capacity, aggregate cargo tonnes, `UnladenMass`
- FSD kind and Guardian booster LY
- Observed and received timestamps with `fresh` and `ageSeconds`

**Not sent:** full journal, complete module loadout, materials, ship IDs, Commander ID, credits, mission manifest, trade details, navigation histories, planetary coordinates, website passwords or session cookies, and any Scout authentication token to ChatGPT.

Cloudflare receives the Scout token in an HTTPS Authorization header only for validating the upload, exactly as it does for existing Scout requests. Tokens are not persisted in the ship snapshot and are not forwarded to ChatGPT.

## Required website setting

After review/merge, set a Cloudflare Pages environment variable on the Mongrels site:

`SCOUT_CHATGPT_LINK_ENABLED = true`

The feature is otherwise off; unknown or missing value is off. Existing `DAILY_ORDERS` KV, `SESSION_SECRET`, `ADMIN_USER_ID`, and website Discord auth remain required. No new OpenAI API key or paid AI backend is needed for this read-only plugin.

**Safe rollback:** Change `SCOUT_CHATGPT_LINK_ENABLED` to `false` (or remove it), redeploy configuration if required, and/or uncheck the local Scout opt-in. Cloudflare automatically expires stored telemetry. To invalidate issued OAuth tokens immediately, turn off the feature flag; token checks fail closed.

## Connect a personal ChatGPT plugin (after production deployment)

1. Install the Scout version built from this PR on **Serenity**, leaving the existing HUD installation alone. Open Elite and verify MongrelHUD continues to display ship status.
2. In EDMC Scout settings enable the optional checkbox. Verify upload by opening `https://mongrels-squadron.pages.dev/api/scout-link/ship` **while logged in as Site Admin**. The page should return a JSON snapshot with `fresh:true`. If the page is stale or absent, check the ship/status data and live service flag.
3. In ChatGPT on a **supported web interface**, open Plugins → Add (+) → **Add custom MCP server**. Use `https://mongrels-squadron.pages.dev/api/scout-link/mcp`. Select OAuth where prompted.
4. Approve the read-only consent prompt after the browser signs you into the Mongrels site as Site Admin through Discord. Do not paste Scout tokens or other credentials into chat.
5. Install/enable the newly created personal plugin. In a new text chat, use `@Mongrel Scout Link` or select the plugin and ask: **"Get my current ship from MongrelScout; read back the system, jump range, fuel, and the observation age."**
6. Compare against HUD. Test failure modes: stop EDMC (fresh should turn false), disable opt-in (uploads cease), try access logged out or as a member (403), remove the server flag (404).

The user must explicitly approve the ChatGPT OAuth connection; code cannot silently install a plugin or grant access.

## Platform caveats / validation gate

- ChatGPT plugin/MCP availability varies by plan, client and account policy. Current OpenAI help documentation says some custom MCP app experiences are **web-only**; verify in ChatGPT web before treating iPad native voice as supported. This build does not modify ChatGPT's voice system and makes no promises about plugin access from Live voice mode.
- A Cloudflare Pages staging preview cannot automatically receive Scout posts because the optional publisher targets the production `mongrels-squadron.pages.dev` URL. Test the server endpoints with controlled fixtures/CI before any production opt-in.
- This is a minimal first version of OAuth for a **single, specifically identified ChatGPT client**. The accepted client identifier is `https://chatgpt.com/oauth/client.json`, with the corresponding stable callback URL. A different callback-ID-specific client metadata URL or a client requiring dynamic registration may need another review pass.
- Cloudflare KV operations are eventually consistent. For production OAuth hardening, verify authorization-code and refresh-token **single-use/rotation under concurrency** (KV `get` then `delete` is not a transactional consume). Consider D1/DO for atomic token redemption before exposing to broader users.
- The remote MCP endpoint is limited to `initialize`, `ping`, `tools/list`, and a single `tools/call`. No site write actions, Windows control, direct route-planning calls, or HTTP tunnel are exposed.

## Non-regression

- Scout uploads BGS, mission, colonization, trade, market data using existing endpoints; neither normalization nor timing is modified.
- HUD receives its state from the unchanged local `127.0.0.1:43857` bridge.
- The new link cannot submit navigation targets, change HUD controls, or direct Elite.
- No new polling reads are introduced on the Cloudflare backend; upload writes happen only while opted in.
- Site smoke-test workflow includes `scripts/smoke-scout-chatgpt-link.mjs` and still compiles the Scout Python module.

## Source references

- `downloads/mongrel-scout/load.py`
- `lib/scout-link.js`
- `lib/scout-link-oauth.js`
- `functions/api/scout-link/{ingest,ship,mcp}.js`
- `functions/api/scout-link/oauth/{authorize,token}.js`
- `functions/.well-known/oauth-*.js`

### Deferred next features

Potential additions only after the first ship reading is verified: per-device identity (Serenity vs travel laptop), optional ship snapshot purge, additional BGS read-only tools, route-planner adapters, and voice availability testing. No writes or continuous status streaming in this phase.
