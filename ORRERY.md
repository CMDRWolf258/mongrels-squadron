# System Orrery prototype

The public `/orrery/` page explores NGC 2546 Sector UZ-G d10-16 with a true 3D camera, selectable celestial bodies and known installations. It uses the site's existing dark/cyan theme and shared navigation. The prototype adds no server binding, authentication requirement or build step.

## Architecture

- `orrery/index.html` and `css/orrery.css` provide the responsive workspace, object directory, search/filter controls, information panel and WebGL fallback.
- `js/orrery/app.js` loads the system catalog, manages selection and filters, and renders operational details.
- `js/orrery/renderer.js` renders the data with pinned local Three.js and OrbitControls in `vendor/three/`. The renderer does not own or edit gameplay records.
- `lib/orrery-model.js` supplies validation, deterministic visual layout, latitude/longitude projection, searchable records and stable-ID location joins. It is shared by the browser and offline tests.
- `lib/orrery-locations.js` loads a configured reusable canonical location provider and maps journal body IDs/ring names to the selected system without changing the provider's source identity.
- `data/orrery/systems.json` registers available system documents. `data/orrery/ngc-2546-uz-g-d10-16.json` is the dated initial snapshot; its field meanings, import process and provenance are documented in `data/orrery/README.md`.

Future systems such as Diaba or NGC 2546 Sector OQ-H b38-0 should be added by supplying a document with the same schema and registering it in the catalog. Renderer code must remain independent of system names, body numbers and installation names.

## Controls and visual scale

Drag with the left mouse button or one finger to orbit. Use the wheel or a two-finger gesture to zoom; right-drag or two fingers also pan. Camera buttons provide overview, zoom and pan without requiring gestures. Select an object in the scene or directory, then focus its host body to inspect a local moon system.

Body sizes and orbital spacing are compressed for legibility. The real immediate-parent hierarchy is retained, including shared barycentres and moons of moons. Source orbital elements remain available in the information panel; rendered positions use deterministic schematic phases and are not live ephemerides. Invisible barycentres preserve relationships without appearing as selectable celestial bodies.

Installation markers identify associated host bodies. Their display positions are schematic unless a sourced surface latitude/longitude exists. Locations with unknown body associations remain searchable and selectable in the directory without a scene marker. Null coordinates and orbital elements remain unknown rather than being converted to measured values.

The controls and details stack on narrow screens, while the 3D viewport captures touch gestures only within its own area. The surrounding page remains scrollable. WebGL initialization failure leaves the object directory and information panel usable.

## Resource records and Mongrel data

Body `materials` describe engineering raw-material percentages. They do not establish a mining commodity, surface deposit or ring hotspot. Location `commodities` drive resource filters for known surface deposits and ring hotspots. Search includes object names, types, notes, resources and their body hierarchy.

Surface deposits use stable location IDs, body references, sourced latitude/longitude and commodities. Ring hotspots reference a ring on their host body and carry commodities/provenance. Custom points of interest and notes use the same location model. The schema supports these records without claiming that incomplete source coverage is complete.

Known Mongrel surface sites remain authoritative in the personal 10-16 site's existing D1 mining store and approval/edit workflow. The Orrery reads its public POI representation at `https://ten16-archive.pages.dev/api/mining?format=poi`, which exposes current curated locations independently of the personal site's full system data. No second mining database or edited coordinate copy is introduced. General celestial and facility data continue to come from the normal EDSM/Spansh importer. See [CURATED_POIS.md](CURATED_POIS.md) for the shared contract and paired deployment requirements.

Each system catalog entry may declare `locationProvider.url`, resolved relative to `data/orrery/` for a local response or supplied as a canonical HTTPS URL. APIs and static files use `{ schemaVersion:1, systemId64:"…", locations:[…] }`. A location carries an original stable `id`, `name`, `kind`, a journal body ID or exact full/short body name, optional exact ring name, verified coordinates when known, commodities/resource tags, notes and provenance. The adapter ignores case/whitespace in body-name comparison only; a designation such as `9a` is not a journal integer. It retains `canonicalId` and namespaces joined IDs as `canonical:<id>`. System-level custom POIs can remain unplaced. Future systems may use any provider with this schema, independently of the personal site.

Provider results must match the selected system, reference existing bodies/rings, and pass coordinate validation. Unknown coordinates remain null; no display coordinate is promoted to measured data. Providers preserve their established access and publication rules; private records must not be copied into a public snapshot. Provider failure leaves the system snapshot usable and is disclosed in data coverage.

## Validation and scope

Run the existing site smoke workflow plus:

```text
node --experimental-default-type=module scripts/smoke-orrery.mjs
node --experimental-default-type=module scripts/smoke-orrery-data.mjs
node --experimental-default-type=module scripts/smoke-curated-pois.mjs
```

The model suite checks graph integrity, null barycentres, invalid references/coordinates, deterministic inclined parent-relative layouts, search/resource filtering, stable-ID joins, page wiring and local dependencies. The data suite checks the real 10-16 body hierarchy, known associations, provenance and offline importer behavior. The curated POI suite checks exact body joins, null/precise coordinates, metadata preservation, tags and unchanged core data. These suites make no network requests.

Browser checks should exercise orbit/zoom/pan, click/tap selection, directory search, filters, body focus, WebGL failure/retry, and desktop/tablet/phone layouts. CI success is distinct from browser verification and confirmed Cloudflare production deployment.

Live orbital simulation, a new location editor, additional systems and navigation coordinates for unknown installations are future work. Curated mining edits continue through the personal site's established workflow. Changes to other operational workflows, data authority or access rules require deliberate review rather than being implied by renderer development.
