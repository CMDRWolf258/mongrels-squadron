# MongrelHUD Trigger Registry

Experimental reference for PR #158. This registry separates what Elite can expose locally from what MongrelHUD should actually alert on.

## Test checklists

- [Solo AX telemetry test](./ax-telemetry-test-solo-checklist.md)
- [Wing / multi-Interceptor AX telemetry test](./ax-telemetry-test-wing-checklist.md)

## Policy

- **Observable is not the same as actionable.** Scout may record or normalize a trigger without surfacing it to the pilot.
- **Normal HUD feed stays curated.** Do not publish every Journal event into the production `/v1/events` queue.
- **Raw research capture is opt-in and local-only.** When AX telemetry capture is enabled, Scout writes raw Journal entries and raw Status.json updates to a JSONL file under `%LOCALAPPDATA%\MongrelHUD\telemetry` (or the user's home directory when LOCALAPPDATA is unavailable).
- **No Cloudflare/API traffic is added by telemetry capture.**
- **Consequences do not need redundant alerts.** Example: `SystemsShutdown` is useful evidence for AX research, but the normal AX status bar should not announce that the ship has already shut down.
- **Unknown AX cues stay unknown.** Do not label a detector automatic until a live capture proves a reliable source.

## Confidence labels

- **DIRECT** — Elite explicitly emits the state/event.
- **DERIVED** — reliable transition/inference from direct local data.
- **TEST** — documented-looking path exists, but AX behavior must be confirmed live.
- **ESTIMATED** — timer/model derived from manual or known fight-state inputs.
- **UNKNOWN** — no reliable telemetry source proven yet.

## Combat / AX

| Trigger | Elite source | Confidence | Production HUD policy |
| --- | --- | --- | --- |
| Shields up/down | Status.json / ShieldState | DIRECT | Useful state, alert only when tactically relevant |
| Flight Assist | Status.json flag | DIRECT | State only |
| Hardpoints deployed | Status.json flag | DIRECT | State only |
| Silent running | Status.json flag | DIRECT | State only |
| Mass locked | Status.json flag | DIRECT | Context only |
| FSD charging/cooldown | Status.json flags | DIRECT | Context only |
| Being interdicted | Status.json / Interdicted | DIRECT | Useful alert |
| Thargoid interdiction | Interdicted.IsThargoid | DIRECT | Useful AX alert |
| In danger | Status.json flag transition | DERIVED | Context only unless a profile wants it |
| Overheating >100% | Status.json / HeatWarning | DIRECT | Useful warning |
| Heat damage | HeatDamage | DIRECT | Useful warning |
| Hull threshold damage | HullDamage | DIRECT | Useful warning |
| Cockpit breached | CockpitBreached | DIRECT | Critical warning |
| Under attack | UnderAttack | DIRECT | Usually redundant in combat; profile-dependent |
| Target acquired/lost | ShipTargeted | DIRECT / TEST AX | Target card |
| Target hull/shield | ShipTargeted | DIRECT / TEST AX | Target card |
| Target subsystem | ShipTargeted.SubSystem | DIRECT / TEST AX | High-value AX experiment |
| Target subsystem health | ShipTargeted.SubSystemHealth | DIRECT / TEST AX | High-value AX experiment |
| Forced systems shutdown | SystemsShutdown | DIRECT | **Silent telemetry only** for AX |
| Heart exerted | Unknown / possible target-state change | TEST | Alert if proven |
| Heart destroyed | Unknown / possible target-state change | TEST | Alert if proven |
| Energy surge precursor | No proven direct source | UNKNOWN | Keep predicted/manual until proven |
| Incoming caustic missile | No proven direct source | UNKNOWN | Detector/manual only until proven |
| Lightning attack | No proven direct source | UNKNOWN | Detector/manual only until proven |
| Swarm launch/down | No proven direct source | UNKNOWN | Research marker |
| Enrage | Fight timer | ESTIMATED | Useful countdown |
| Numeric heat below 20% | No documented local numeric source | UNKNOWN | Do not claim |
| Exact target range | No proven source | UNKNOWN | Do not claim |
| Exact ship speed | No proven source | UNKNOWN | Manual/reference comparison only |

## Surface / mining

| Trigger | Elite source | Confidence | Production HUD policy |
| --- | --- | --- | --- |
| Latitude/longitude | Status.json | DIRECT | Navigation |
| Altitude/heading | Status.json | DIRECT | Navigation |
| Touchdown/liftoff | Journal | DIRECT | Context |
| Destination | Status.json | DIRECT | Navigation |
| FSD target | FSDTarget | DIRECT | Navigation |
| Route | NavRoute.json | DIRECT | Navigation |
| Ring hotspot signals | SAASignalsFound | DIRECT | Mining intelligence |
| Prospector result | ProspectedAsteroid | DIRECT | High-value mining trigger |
| Material percentages | ProspectedAsteroid | DIRECT | High-value mining trigger |
| Motherlode | ProspectedAsteroid | DIRECT | High-value mining trigger |
| Asteroid cracked | AsteroidCracked | DIRECT | Useful mining phase cue |
| Limpet launched/type | LaunchDrone | DIRECT | Optional counter/state |
| Commodity refined | MiningRefined | DIRECT | Useful mined-tonnage counter |
| Ship/SRV/carrier cargo transfer | CargoTransfer | DIRECT | Cargo state |

## Ship / navigation / carrier

| Trigger | Elite source | Confidence | Production HUD policy |
| --- | --- | --- | --- |
| Pips | Status.json | DIRECT | State |
| Fire group | Status.json | DIRECT | State |
| GUI focus | Status.json | DIRECT | Context/declutter possibilities |
| Combat/analysis mode | Status.json flag | DIRECT | Context |
| Night vision | Status.json flag | DIRECT | State |
| Main ship/fighter/SRV | Status.json flags | DIRECT | Profile/context |
| Docking request/grant/deny | Journal | DIRECT | Useful station/carrier flow |
| Landing pad | DockingGranted | DIRECT | Useful |
| Carrier jump request | CarrierJumpRequest | DIRECT | Voice/schedule |
| Carrier jump/cancel | Journal | DIRECT | Voice/status |
| AFMU repair | AfmuRepairs | DIRECT | Optional |
| Repair limpet | RepairDrone | DIRECT | Optional |
| Synthesis | Synthesis | DIRECT | Optional |
| Wing join/leave | Wing events | DIRECT | Optional future wing HUD |

## AX telemetry capture

Capture is intentionally separate from the production event queue.

When enabled, Scout records:

- every raw Journal entry received by the plugin;
- every raw Status.json update received by `dashboard_entry()`;
- timestamped manual markers;
- capture start/stop records.

The iPad AX controller supplies research markers for:

- ENERGY SURGE
- EMP HIT
- CAUSTIC MISSILE
- LIGHTNING
- SWARM LAUNCH
- SWARM DOWN

Existing prototype controls also write markers while capture is active:

- HEART EXERTED
- HEART DOWN
- SHIELD UP
- SHIELD DOWN

This lets a Hellhound flight generate a single timestamp-aligned JSONL session that can be compared against visible/audio events without changing the normal production alert policy.

## Multi-interceptor validation protocol

Do not trust the prototype heart counter as authoritative during this test; PR #158 still has one active AX encounter slot.

Suggested wing sequence:

1. Start AX telemetry capture before engaging.
2. Target the first interceptor and tap **TARGET A** once the target card is populated.
3. Target a second interceptor and tap **TARGET B**; use **TARGET C** if useful.
4. Leave A untargeted and have another pilot destroy one of A's hearts. Tap **OFF-TARGET HEART DOWN** when the heart is visibly confirmed destroyed; this marker does **not** mutate the HUD counter.
5. Reacquire A and tap **TARGET A** again.
6. Repeat once with two interceptors of the same variant if practical, because identical Cyclops/Basilisk/etc. contacts are the hardest identity case.
7. Stop capture after the encounter.

The resulting capture should answer whether raw or normalized `ShipTargeted` data contains any stable per-vessel discriminator, whether target subsystem state re-synchronizes after reacquisition, and whether off-target heart loss becomes observable when the vessel is selected again.
