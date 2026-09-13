# Mongrels Squadron Website — v53

## Major addition: Mongrel Assistant v1

This release adds a secure, read-only AI assistant for authenticated Mongrel members.

### What it can read
Depending on the question, the backend supplies the assistant with selected current site data:
- Daily Orders / Mission Control BGS context
- Projects & Events
- Carrier Registry and Coordination
- Trader's Outpost posts
- PvP bounty board
- published ship catalogue
- core squad rules, leadership, and site navigation

The assistant does not have any write tools in v1. It cannot publish, edit, delete, register, or change site data.

### Privacy / access
- Discord-authenticated Member, Officer, or Site Admin access is required to make AI requests.
- Anonymous visitors cannot spend API credits or access private squad data.
- The OpenAI API key remains in Cloudflare Secrets and is never sent to browser JavaScript.
- Chat history is kept only in the current browser page session in v1; this site does not save assistant conversations to KV.

## Required Cloudflare setup
Add one new Production secret to the `mongrels-squadron` Pages project:

`OPENAI_API_KEY`

Value: an OpenAI Platform API key. Do not put the key in GitHub or public JavaScript.

Optional normal Production variable:

`OPENAI_MODEL`

Default when omitted: `gpt-5.6-luna`

No new KV namespace is required for the assistant.

## OpenAI billing
OpenAI API billing is separate from ChatGPT subscriptions. API billing/credits must be configured on the OpenAI API Platform account that owns the key.

## UI
A floating `Ask the Mongrels` control appears site-wide. On small phones it collapses to a compact icon. The assistant supplies related-site shortcut chips under its answer when relevant.

## Other polish
- Slightly adjusted favicon framing to leave a little more top breathing room.
- Asset query versions bumped to v53.


## v53 — Mongrel Assistant spending guardrails

The assistant now stays disabled unless persistent AI usage storage is configured. This prevents the OpenAI API key from being used without the squad's monthly limits.

### Required Cloudflare KV binding
Create a KV namespace such as `mongrels-ai-usage`, then bind it to the `mongrels-squadron` Pages project as:

- Variable name: `AI_USAGE`
- KV namespace: `mongrels-ai-usage`

Do not manually create KV pairs. The assistant writes monthly usage records automatically.

### Default monthly limits
- Member: **$1.00**
- Officer: **$2.00**
- Site Admin: **$20.00**
- Entire site: **$30.00**
- Warning appears at **80%** of a user's allowance.

The defaults can be changed later with normal Cloudflare variables:
- `AI_MEMBER_MONTHLY_LIMIT`
- `AI_OFFICER_MONTHLY_LIMIT`
- `AI_ADMIN_MONTHLY_LIMIT`
- `AI_SITE_MONTHLY_LIMIT`

The assistant also limits request frequency to reduce accidental loops: 60/hour for Members, 120/hour for Officers, and 240/hour for Site Admin.

### Pricing used for accounting
For the default `gpt-5.6-luna` model, v53 uses $0.20 / 1M uncached input tokens, $0.02 / 1M cached input tokens, and $1.20 / 1M output tokens. If a different model is selected, configure all three pricing variables so cost accounting remains correct:
- `AI_INPUT_USD_PER_MILLION`
- `AI_CACHED_INPUT_USD_PER_MILLION`
- `AI_OUTPUT_USD_PER_MILLION`

Usage is calculated from the token usage returned by the OpenAI Responses API and stored monthly in Cloudflare KV. The site refuses new requests once a configured user/site ceiling has already been reached. Because KV is not transactional, simultaneous requests can theoretically overshoot a ceiling by a very small amount; for this low-volume squad use the practical exposure is tiny.
