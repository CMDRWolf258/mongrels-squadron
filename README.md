# Mongrels Squadron Site v48 — Carrier Registry & Coordination

This release adds the first secure carrier-management batch while retaining all prior site features.

## New in v48
- Public carrier registry backed by secure Cloudflare KV storage.
- Members can register and maintain their own fleet carriers.
- Carrier callsign is required and used as the unique identity; duplicate callsigns are rejected.
- Carrier names remain editable display names.
- Manual current-location reporting includes source/freshness labels and is structured for future live automation.
- Private member carrier coordination board for relocations, loading/unloading, project support, expedition support, tritium/refuel requests, and other logistics.
- Status, priority, departure, ETA, destination, cargo target/remaining, purpose, and notes.
- Regular members can create/edit/delete only their own carrier records and coordination posts.
- Officers/Site Admin can moderate carrier records/posts and mark official squadron carriers or movements.
- System copy controls on current/destination systems.
- Member Portal previews active carrier coordination.
- Responsive PC/iPad/phone layouts.

## Cloudflare setup required
Create a KV namespace, suggested name:

`mongrels-carriers`

Then bind it to the `mongrels-squadron` Pages project:

- Type: KV namespace
- Variable name: `CARRIERS`
- KV namespace: `mongrels-carriers`

Do not manually create KV pairs. The site/API will manage them.

## Notes
This release intentionally keeps current carrier location member-reported. The data model records location source and timestamp so Frontier/EDDN-backed automation can be added in a later batch without redesigning the registry.
