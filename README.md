# Mongrels Squadron Site — v40 Officer Daily Orders Editor

This build adds secure Officer/Site Admin management for private Daily Orders.

## New behavior
- Members: read-only private Daily Orders.
- Officers: read + publish/clear Daily Orders.
- Site Admin (Wolf): read + publish/clear Daily Orders.
- Public visitors: locked placeholder only.
- Orders are stored in a Cloudflare KV namespace, not in GitHub or a public JSON file.

## Required Cloudflare setup
Before publishing orders, create a Cloudflare KV namespace and bind it to this Pages project:

1. Cloudflare Dashboard -> Storage & databases -> KV -> Create namespace.
2. Suggested namespace name: `mongrels-daily-orders`.
3. Open Workers & Pages -> `mongrels-squadron` -> Settings -> Bindings.
4. Add a KV namespace binding.
5. Variable/binding name MUST be: `DAILY_ORDERS`
6. Select the `mongrels-daily-orders` namespace.
7. Save and redeploy the Pages project if Cloudflare requests it.

The site will continue to load normally before the binding exists, but the editor cannot publish until `DAILY_ORDERS` is configured.

## Security
- GET requires Member, Officer, or Site Admin session.
- PUT/DELETE require Officer or Site Admin.
- Management requests are same-origin validated and require a custom request marker.
- Data responses use no-store/private caching headers.
