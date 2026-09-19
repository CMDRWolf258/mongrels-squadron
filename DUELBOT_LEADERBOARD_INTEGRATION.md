# DuelBot Leaderboard Integration

## Purpose

The Mongrels PvP page consumes DuelBot's version-1 leaderboard contract through a protected Cloudflare Pages Function. Human visitors authenticate only with the Mongrels site's existing Discord session. The browser never receives the DuelBot integration credential.

## Data flow

```text
Member browser
  -> GET /api/pvp/leaderboard
  -> Mongrels Cloudflare Pages Function validates member session
  -> server-side GET to DuelBot
  -> Authorization: Bearer <Cloudflare secret>
  -> v1 leaderboard JSON
  -> schema normalization
  -> sanitized JSON returned to browser
```

## Cloudflare configuration required before live testing

Configure these values for the Pages project:

- `DUELBOT_LEADERBOARD_URL` — DuelBot's leaderboard API endpoint.
- `DUELBOT_API_TOKEN` — the rotated shared integration credential. This must be stored as a Cloudflare secret, never committed to GitHub or exposed to browser code.

The credential supplied in the original contract should be treated as exposed and replaced before production use.

## Access boundary

`/api/pvp/leaderboard` accepts only authenticated Mongrels sessions with access level `member`, `officer`, or `site_admin`.

The browser calls only the Mongrels endpoint. It does not call DuelBot directly and cannot read the integration secret.

## Contract validation

The site currently accepts only `schema_version: 1` and requires the nine documented categories in the documented order:

1. `most_logged_duels`
2. `most_wins`
3. `longest_win_streak`
4. `highest_win_percentage`
5. `most_losses`
6. `longest_losing_streak`
7. `overall_winningest_ship`
8. `top_victory_hardpoints`
9. `most_pending_duels`

Malformed payloads, missing categories, changed ordering, unsupported schema versions, invalid values, and invalid timestamps are rejected instead of being rendered.

The supplied sample is stored at `data/fixtures/duelbot-leaderboard-v1.json` for contract smoke testing only. It is not used as live fallback data.

## Browser behavior

The PvP page:

- shows a members-only sign-in state when no valid Mongrels session exists;
- displays all nine DuelBot categories in a responsive grid;
- shows every tied result rather than selecting one winner;
- renders percentages, the winning ship, and the ordered top-three hardpoints according to their distinct entry formats;
- displays DuelBot's `generated_at` time and data age;
- offers manual refresh;
- quietly refreshes at most once every ten minutes while the page is visible;
- leaves the rest of the PvP page usable if DuelBot is unavailable.

## Error handling

The Mongrels proxy intentionally does not pass DuelBot's raw error body to the browser.

- Missing Mongrels login -> 401 `authentication_required`
- Insufficient Mongrels access -> 403 `member_access_required`
- Missing local endpoint/secret configuration -> 503 `duelbot_integration_not_configured`
- DuelBot 503 / timeout / network failure -> 503 `duelbot_unavailable`
- DuelBot rejects the integration credential -> 502 `duelbot_authentication_failed`
- Other upstream failure -> 502 `duelbot_upstream_error`
- Invalid JSON or version-1 contract violation -> 502 `duelbot_invalid_response`

## End-to-end activation checklist

1. Finish branch smoke tests using the supplied v1 fixture.
2. Rotate the original shared credential.
3. Store the replacement as `DUELBOT_API_TOKEN` in Cloudflare.
4. Set `DUELBOT_LEADERBOARD_URL` to the agreed DuelBot endpoint.
5. Have DuelBot enable its integration kill switch.
6. Sign in as a Mongrel member and load the PvP page.
7. Compare all nine live categories against DuelBot's own Leaderboard button.
8. Verify a forced DuelBot 503 produces only the graceful unavailable state.
9. Verify a deliberately wrong token produces no secret leakage and a clean upstream-authentication failure.
