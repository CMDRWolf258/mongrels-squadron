# System Orrery prototype

The public `/orrery/` page explores NGC 2546 Sector UZ-G d10-16 and Diaba with a true 3D camera, selectable celestial bodies and known installations. 10-16 remains the default system. The page uses the site's existing dark/cyan theme and shared navigation. The Orrery remains public and adds no new Cloudflare binding or build step; verified Mongrel Scout facility observations reuse the existing `DAILY_ORDERS` binding.

## Architecture

- `orrery/index.html` and `css/orrery.css` provide the responsive workspace, object directory, search/filter controls, information panel and WebGL fallback.
- `js/orrery/app.js` loads the system catalog, manages selection and filters, and renders operational details.
- `js/orrery/renderer.js` renders the data with pinned local Three.js and OrbitControls in `vendor/three/`. The renderer does not own or edit gameplay records.
- `js/orrery/body-materials.js` creates deterministic, local-only procedural surface, atmosphere, star-glow and ring materials from the selected body's sourced classification/environment fields. These visuals are representative rather than reconstructed Elite surface maps and add no network request.
- `js/orrery/camera.js` chooses a touch orbit pivot from projected body positions at rotation gesture boundaries. It leaves two-finger pan/zoom and desktop controls to the vendored OrbitControls.
- `lib/orrery-model.js` supplies validation, deterministic visual layout, latitude/longitude projection, searchable records and stable-ID location joins. It is shared by the browser and offline tests.
- `lib/orrery-locations.js` loads a configured reusable canonical location provider and maps journal body IDs/ring names to the selected system without changing the provider's source identity.
- `lib/orrery-facility-observations.js` overlays sanitized Mongrel Scout `ApproachSettlement` observations onto existing imported facilities by Market ID + exact system identity. It can upgrade schematic/unplaced surface facilities to verified latitude/longitude placement without creating new facility identities or overwriting existing exact source coordinates.
- `lib/scout-facility-observations.js`, `/api/operations/scout-ingest`, and `/api/orrery/facility-observations` store and expose only the public facility-placement facts needed by the Orrery.
- `data/orrery/systems.json` registers available system documents. `data/orrery/ngc-2546-uz-g-d10-16.json` is the dated initial snapshot and `data/orrery/diaba.json` supplies the second system; their field meanings, import process and provenance are documented in `data/orrery/README.md`.
- `scripts/import-orrery-edsm.mjs` normalizes EDSM bodies/stations and matching Spansh body records into the shared schema. Optional paired `--system-name` and `--system-id` arguments select another system and its output filename; omitting them retains the 10-16 import default.

Diaba uses the same importer, model, renderer and camera as 10-16. Its imported snapshot contains one star, three planets, eleven moons, one planetary ring, two stellar asteroid belts and 38 facilities. EDSM provides 28 facilities; Spansh adds ten named facilities absent from EDSM and supplements missing host associations by market ID. Thirty-five facilities have known host bodies, ten have EDSM surface-coordinate pairs, and three carriers remain unplaced. There are no imported Diaba ring-hotspot or surface-resource records. Its catalog entry has no curated location provider and does not fetch the personal 10-16 site.

Future systems such as NGC 2546 Sector OQ-H b38-0 should be added by supplying a document with the same schema and registering it in the catalog. Renderer code must remain independent of system names, body numbers and installation names. The existing screenshot association supplement is restricted to the exact 10-16 system identity and is not applied to Diaba or other imports.

## Controls and visual scale

Drag with the left mouse button or one finger to orbit. Use the wheel or a two-finger gesture to zoom; right-drag or two fingers also pan. Camera buttons provide overview, zoom and pan without requiring gestures. Select an object in the scene or directory, then focus its host body to inspect a local moon system.

When one-finger touch rotation starts, the body closest to the screen centre becomes the orbit pivot if its projected centre falls within a circle with radius 10% of the viewport's shorter dimension. This uses screen proximity, not distance from the camera or selected-object state. Stars, planets and moons qualify; rings, installations, invisible barycentres and bodies behind the camera or outside the view do not. Equally centred bodies prefer the foreground depth. Acquiring a body centres the view on that body without moving the camera; the pivot stays fixed for the rotation gesture rather than switching between bodies while dragging.

When that central circle contains no body, rotation keeps a pivot in empty space along the view-centre axis at the current orbit distance. Two-finger gestures never acquire a body: native pinch zoom changes camera-to-pivot distance, while pan moves camera and pivot together. There is no short-distance compression or per-frame target replacement to reduce pan travel. After a pinch or pan, the next one-finger rotation can acquire a newly centred body. Explicit Focus still anchors the chosen object; Overview restores the wide camera.

Desktop mouse orbit, wheel zoom and pan retain the original OrbitControls behavior and speeds. Touch zoom stays centred; `zoomToCursor` remains disabled because the vendored controls mix page and client coordinates during touch cursor zoom on a scrolled page. Rotation, zoom and pan speeds are unchanged on all devices.

Body sizes and orbital spacing are compressed for legibility. The real immediate-parent hierarchy is retained, including shared barycentres and moons of moons. Source orbital elements remain available in the information panel; rendered positions use deterministic schematic phases and are not live ephemerides. Invisible barycentres preserve relationships without appearing as selectable celestial bodies.

Body appearance is also deterministic but intentionally not photographic source data. Body subtype, temperature and atmosphere select a procedural profile. Rocky/metallic/icy surfaces use seam-free multi-scale spherical noise plus a separate generated normal map; gas giants use warped multi-frequency latitude bands and seeded storm variation; Earth-like/water bodies use a separate procedural cloud shell; atmospheric bodies use a view-dependent limb/Fresnel haze; stars use a textured luminous surface/corona and act as the main scene-light direction; and rings use seeded composition-aware unlit banding so navigation rings remain visible regardless of star angle. The body's stable ID seeds the variation so a body keeps the same appearance between page loads. Overview textures remain deliberately small for mobile performance. Only the currently focused body is temporarily promoted to a 384×192 surface/relief/cloud set, which is released when focus moves elsewhere. No screenshot-derived surface geography is claimed, and future calibrated/custom body textures can replace a procedural profile without changing layout or source records.

Location placement is classified as exact surface coordinates, host association with unknown position, ring association, or completely unplaced. Green spheres retain the sourced latitude/longitude direction with a small marker-height lift. Amber diamonds with unknown positions are sorted by stable location ID into evenly spaced host lanes (up to twelve markers per lane), outside the body and its rings. Dashed amber lanes appear for the selected host and follow the orbital-path toggle. They are display guides, not measured orbital radii or a claim that an unknown-position surface site is in orbit. The complete location set is laid out before filtering so filters do not move markers.

Ring POIs are spaced around their own annulus in the same inclined plane as the ring. Adjacent displayed ring bands have a gap to avoid ambiguous associations. Both ring and host marker labels say “schematic”; directory rows and details state the evidence category. Surface markers are never redistributed to avoid overlap. Overlapping labels are suppressed using their actual rendered dimensions, retaining the selected label. Locations with unknown body associations remain searchable and selectable in the directory without a scene marker. Null coordinates and orbital elements remain unknown rather than being converted to measured values.

The controls and details stack on narrow screens, while the 3D viewport captures touch gestures only within its own area. The surrounding page remains scrollable. WebGL initialization failure leaves the object directory and information panel usable.

## Resource records and Mongrel data

Body `materials` describe engineering raw-material percentages. They do not establish a mining commodity, surface deposit or ring hotspot. Location `commodities` drive resource filters for known surface deposits and ring hotspots. Search includes object names, types, notes, resources and their body hierarchy.

Surface deposits use stable location IDs, body references, sourced latitude/longitude and commodities. Ring hotspots reference a ring on their host body and carry commodities/provenance. Custom points of interest and notes use the same location model. The schema supports these records without claiming that incomplete source coverage is complete.

Known Mongrel surface sites remain authoritative in the personal 10-16 site's existing D1 mining store and approval/edit workflow. For 10-16, the Orrery reads its public POI representation at `https://ten16-archive.pages.dev/api/mining?format=poi`, which exposes current curated locations independently of the personal site's full system data. No second mining database or edited coordinate copy is introduced. General celestial and facility data for every system continue to come from the normal EDSM/Spansh importer. Diaba currently has no curated resource dataset; an empty optional layer does not prevent its core snapshot from loading. See [CURATED_POIS.md](CURATED_POIS.md) for the shared contract and paired deployment requirements.

Each system catalog entry may declare `locationProvider.url`, resolved relative to `data/orrery/` for a local response or supplied as a canonical HTTPS URL. APIs and static files use `{ schemaVersion:1, systemId64:"…", locations:[…] }`. A location carries an original stable `id`, `name`, `kind`, a journal body ID or exact full/short body name, optional exact ring name, verified coordinates when known, commodities/resource tags, notes and provenance. The adapter ignores case/whitespace in body-name comparison only; a designation such as `9a` is not a journal integer. It retains `canonicalId` and namespaces joined IDs as `canonical:<id>`. System-level custom POIs can remain unplaced. Future systems may use any provider with this schema, independently of the personal site.

Provider results must match the selected system, reference existing bodies/rings, and pass coordinate validation. Unknown coordinates remain null; no display coordinate is promoted to measured data. Providers preserve their established access and publication rules; private records must not be copied into a public snapshot. Provider failure leaves the system snapshot usable and is disclosed in data coverage.

### Mongrel Scout facility placement

Mongrel Scout v1.3.0 listens for Elite's `ApproachSettlement` journal event. Elite supplies the settlement name, Market ID, system address, body ID/name, latitude and longitude for that event. Scout transmits those public location facts plus the journal timestamp; it does not add Commander name, ship, cargo, credits, materials, missions or route history.

Facility observations are authenticated through the existing Scout token and accepted only when the token is allowed to scout that system (or has an active Scout claim). They do not complete ordinary Scout Jobs or issue rewards. Storage uses per-system keys under the existing `DAILY_ORDERS` namespace and retains the newest observation per Market ID. Public Orrery reads expose only Market ID, facility name, body identity, coordinates, observation time and source label—never Scout/token/member identity.

At load time the Orrery matches an observation to exactly one imported facility by Market ID and verifies the selected system and journal body ID. A known imported host must agree with the observed body; conflicts are ignored rather than guessed. Existing exact imported coordinates are not silently replaced. A verified observation therefore upgrades only a schematic/unplaced matching surface facility to exact placement. The imported EDSM/Spansh facility record remains the facility identity/provenance; `positionObservation` records the separate Scout placement provenance. A missing/unavailable facility-observation API never prevents the core Orrery or curated POI layer from loading.

## Validation and scope

Run the existing site smoke workflow plus:

```text
node --experimental-default-type=module scripts/smoke-orrery.mjs
node --experimental-default-type=module scripts/smoke-orrery-data.mjs
node --experimental-default-type=module scripts/smoke-orrery-camera.mjs
node --experimental-default-type=module scripts/smoke-curated-pois.mjs
```

The model suite checks graph integrity, null barycentres, invalid references/coordinates, deterministic inclined parent-relative layouts, search/resource filtering, stable-ID joins, page wiring and local dependencies. The data suite checks the real 10-16 and Diaba body hierarchies, known and unknown associations, provenance, catalog registration and offline importer behavior. The curated POI suite checks exact body joins, null/precise coordinates, metadata preservation, tags and unchanged core data. The camera suite exercises the vendored PerspectiveCamera and OrbitControls with synthetic DOM events: desktop mouse comparisons, wide empty-space gestures, screen-centre body choice and foreground ties, portrait/landscape thresholds, empty-space fallback, stable gesture pivots, native two-finger travel with pinch enabled, camera/pivot pan translation, natural body-relative zoom, pinch-to-orbit transitions, scrolled-page touch, explicit Focus and Overview, distance limits, hybrid mouse/touch switching, disabled controls and cleanup. These suites make no network requests; camera checks do not require WebGL and complement browser verification. Physical iPad Safari testing is the acceptance check for touch behavior; synthetic events cannot establish that acceptance.

Browser checks should exercise system switching, orbit/zoom/pan, click/tap selection, directory search, filters, body focus, WebGL failure/retry, and desktop/tablet/phone layouts for both Diaba and 10-16. CI success is distinct from browser verification and confirmed Cloudflare production deployment.

Live orbital simulation, a new location editor, additional systems and orbital/navigation coordinates for non-surface installations are future work. Curated mining edits continue through the personal site's established workflow. Changes to other operational workflows, data authority or access rules require deliberate review rather than being implied by renderer development.
