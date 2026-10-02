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

Overview gestures retain their existing response. Beside a visible nearby body, touch navigation replaces an outdated distant pivot with a local point along the current view, preserving camera position and orientation. This also happens when a pinch becomes a one-finger orbit. A close focused view retains its existing pivot, and distant or fully offscreen selections do not redirect the camera. Local mouse-wheel zoom follows the cursor; touch zoom stays centred to avoid page-scroll coordinate offsets. Rotation, zoom and pan speeds remain unchanged.

Body sizes and orbital spacing are compressed for legibility. The real immediate-parent hierarchy is retained, including shared barycentres and moons of moons. Source orbital elements remain available in the information panel; rendered positions use deterministic schematic phases and are not live ephemerides. Invisible barycentres preserve relationships without appearing as selectable celestial bodies.

Installation markers identify associated host bodies. Their display positions are schematic unless a sourced surface latitude/longitude exists. Locations with unknown body associations remain searchable and selectable in the directory without a scene marker. Null coordinates and orbital elements remain unknown rather than being converted to measured values.

The controls and details stack on narrow screens, while the 3D viewport captures touch gestures only within its own area. The surrounding page remains scrollable. WebGL initialization failure leaves the object directory and information panel usable.

## Resource records and Mongrel data

Body `materials` describe engineering raw-material percentages. They do not establish a mining commodity, surface deposit or ring hotspot. Location `commodities` drive resource filters for known surface deposits and ring hotspots. Search includes object names, types, notes, resources and their body hierarchy.

Surface deposits use stable location IDs, body references, sourced latitude/longitude and commodities. Ring hotspots reference a ring on their host body and carry commodities/provenance. Custom points of interest and notes use the same location model. The schema supports these records without claiming that incomplete source coverage is complete.

Known Mongrel surface sites are maintained on Wolf's separate personal Elite site. That site remains authoritative. The provider interface is shared, so it can later consume those records rather than introduce a second mining database or editing workflow. Until the canonical endpoint is configured, `resource-locations.json` supplies an explicitly empty provider response; the prototype does not substitute coordinates or invent commodity hotspots.

Each system catalog entry may declare `locationProvider.url`, resolved relative to `data/orrery/` for a local response or supplied as the canonical HTTPS service URL. The endpoint supplies `{ schemaVersion:1, systemId64:"…", locations:[…] }`. A location carries an original stable `id`, `name`, `kind`, `bodyJournalId`, optional exact `ringName`, verified `latitude`/`longitude` when known, `commodities`, `notes` and `source`. The adapter maps bodies/rings, retains `canonicalId`, and namespaces joined IDs as `canonical:<id>` so canonical locations cannot collide with snapshot IDs.

Provider results must match the selected system, reference existing bodies/rings, and pass coordinate validation. Unknown coordinates remain null; no display coordinate is promoted to measured data. Providers preserve their established access and publication rules; private records must not be copied into a public snapshot. Provider failure leaves the system snapshot usable and is disclosed in data coverage.

## Validation and scope

Run the existing site smoke workflow plus:

```text
node --experimental-default-type=module scripts/smoke-orrery.mjs
node --experimental-default-type=module scripts/smoke-orrery-data.mjs
node --experimental-default-type=module scripts/smoke-orrery-camera.mjs
```

The model suite checks graph integrity, null barycentres, invalid references/coordinates, deterministic inclined parent-relative layouts, search/resource filtering, stable-ID joins, page wiring and local dependencies. The data suite checks the real 10-16 body hierarchy, known associations, provenance and offline importer behavior. The camera suite exercises the vendored PerspectiveCamera and OrbitControls with synthetic DOM events: unchanged overview gestures, local pivots without camera jumps, damping, pinch transitions, scrolled-page touch, cursor wheel zoom, ignored wheel events and cleanup. These suites make no network requests; camera checks do not require WebGL and complement browser verification.

Browser checks should exercise orbit/zoom/pan, click/tap selection, directory search, filters, body focus, WebGL failure/retry, and desktop/tablet/phone layouts. CI success is distinct from browser verification and confirmed Cloudflare production deployment.

Live orbital simulation, a location editor, connection to the personal site's canonical endpoint, additional systems and navigation coordinates for unknown installations are future work. Changes to existing operational workflows, data authority or access rules require deliberate review rather than being implied by renderer development.
