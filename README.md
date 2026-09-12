# The Regiment of Imperial Mongrels — v38

## Secure Daily Orders

This release turns the Operations Daily Orders area into a real protected member feature.

### What changed
- New protected endpoint: `/api/operations/orders`
- Endpoint requires a valid first-party Mongrels session
- Only `member`, `officer`, and `site_admin` access levels can retrieve orders
- Public visitors receive no private order payload
- Operations page automatically swaps between locked, loading, and authenticated briefing states
- Officer/Site Admin viewers are identified as management-capable, with editing controls reserved for the next phase
- Responses are explicitly `no-store` / private to avoid caching sensitive tasking

### Private order storage
The endpoint reads an optional Cloudflare Production secret named:

`DAILY_ORDERS_JSON`

If it is not configured, authenticated members will simply see “No Daily Orders Posted.” This is intentional and lets us verify access control before publishing real tasking.

Example schema for later use:

```json
{
  "title": "Squadron Daily Orders",
  "briefing": "Current operational focus for this BGS cycle.",
  "updatedAt": "Sep 12, 2026",
  "orders": [
    {
      "priority": "Primary",
      "task": "Example task",
      "detail": "Example detail and stop condition.",
      "status": "Active"
    }
  ],
  "officerNote": "Optional note visible to authenticated members."
}
```

Do not place real private orders in a public repository file. Store them in Cloudflare until the officer editing/database phase is added.
