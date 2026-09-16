# Mongrels My Pathway — Development Roadmap

This file records current Pathway direction and specialty concepts that should survive chat/context changes. Current repository code remains authoritative for implemented behavior.

## Current full pathways

1. **Anti-Xeno** — Scout School, Interceptor development, Guardian specialization, and Hellhound veteran/mentor work.
2. **Background Simulation** — foundations through strategic planning, tick diagnosis, campaign leadership, and mentoring.
3. **Mining** — laser foundations, efficiency, advanced extraction, Rhino surface operations, specialist work, and lead/mentor routes.
4. **Trade & Hauling** — action-first beginner progression, Route Runner, Medium-Pad Specialist, Strategic Hauler, Market Specialist, and Logistics Lead.
5. **Carrier Logistics** — Carrier Foundations, Carrier Crew, Cargo Coordinator, Movement Planner, and Carrier Logistics Lead.
6. **Engineering & Shipbuilding** — Engineering Foundations, Engineer Network, Role Builder, Combat Systems, Ship Architect, and Engineering Mentor routes.
7. **Exploration** — Foundations, Surveyor, Deep-Space Navigator, Discovery Specialist, and Expedition Lead/Mentor routes.
8. **Exobiology** — First Bio Survey, Field Surveyor, Efficient Naturalist, Target Specialist, and Expedition Bio Lead/Mentor routes.

Full pathways use independent `pathway-progress-v1:<owner>:<activity>` records through the shared assignment API.

## Pathway design rules

- Beginners should generally **do before they analyze**.
- Prefer one primary lesson per assignment.
- Good progression pattern: **do → observe → compare → understand → optimize → lead/teach**.
- Assignments state what to accomplish without spelling out every hidden prerequisite.
- Research is part of learning; Ask the Mongrels and other members are the fallback when a Commander gets stuck.
- `Already Know / Have This` earns credit; `Skip for Now` does not.
- Veterans should receive diagnosis, leadership, wing/team responsibility, and teaching—not just larger numbers.
- Ownership or wealth should not be an artificial gate when the same skill can be demonstrated by working with another Mongrel.
- Large prerequisite grinds should be decomposed into small milestones with deliberate stopping points and regular payoff/testing.
- Specialty/scenario paths should normally live inside the most relevant core Pathway instead of becoming unnecessary top-level categories.

## Engineering — current status

Engineering now has a mature enough internal structure that campaign expansion is intentionally paused while broader Pathway coverage catches up.

### First Engineering Win

Optional Start Here onboarding using a small Felicity/FSD improvement. Current implementation contains **18 small steps**, including Deciat/Open safety preparation, a G2 Increased Range stopping point, a separate experimental job, and a test/replot payoff.

### Campaign Planner

Six audited campaigns are implemented:
1. Improve Shields
2. Improve Jump Range
3. Improve Speed & Mobility
4. Improve Power Distributor
5. Improve Power & Heat
6. Improve Weapon Package

Campaign principles:
- improve one measured problem at a time;
- reuse shared Engineer-access facts instead of making members repeat old prerequisites;
- plan/gather only the next useful grade rather than defaulting to G5;
- test the result before doing more;
- allow no-engineering/G1/G2/G3 stopping points when they solve the actual problem;
- keep weapon Engineer access family-specific rather than pretending one generic unlock covers every hardpoint family.

A whole-ship / Ship Architect campaign remains a later candidate after broader Pathway coverage exists.

### Cross-path Engineering Prep

Current shared numeric facts include:
- `trade.markets-visited-distinct`
- `trade.black-markets-used-distinct`
- `mining.ore-mined-total-tonnes`

Trade and Mining can expose optional Engineering Prep when the activity genuinely contributes to those facts. The Commander records what actually happened; ordinary Pathway completion never guesses unique markets, black markets, tonnage, or similar prerequisites.

## Exploration — implemented full pathway

Primary files:
- `lib/pathway-exploration.js`
- `js/pathway-exploration.js`
- shared `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`

Current routes:

### Exploration Foundations — Leave, Survey, Return
Beginner complete-loop route:
- prepare a rebuy-safe ship;
- plan a short route;
- use Discovery Scanner/FSS deliberately;
- choose bodies worth DSS mapping;
- practice fuel/heat/star/landing safety;
- return and sell the data;
- make one evidence-based build/workflow improvement;
- repeat the complete loop independently.

### Surveyor — Read the Route, Not Just the Destination
Developing route:
- record an honest survey baseline;
- compare route-planning approaches;
- create practical FSS and mapping decision rules;
- keep reusable field notes;
- rerun after changing one survey habit and compare the result.

### Deep-Space Navigator — Range, Neutrons & Recovery
Developing/Experienced route:
- audit remote failure modes;
- manage fuel margin deliberately;
- compare ordinary and neutron-assisted routing;
- practice controlled neutron boosts;
- practice the ship's real remote-repair strategy;
- complete a genuinely remote leg and return/reach a planned safe endpoint.

### Discovery Specialist — Scout With a Purpose
Experienced route:
- choose a discovery objective that changes the route;
- use galaxy tools to narrow the search without outsourcing the discovery;
- compare novelty, value, beauty, and strategic usefulness;
- document a find so another Commander can reproduce it;
- turn the result into a squad-useful recommendation;
- complete a purpose-built scouting capstone.

### Expedition Lead — Plan, Recover, Teach
Veteran/Mentor route:
- design an expedition with a real objective;
- plan rendezvous, fuel, repair, and fallbacks around the group rather than only the lead ship;
- brief participants without turning discovery into a script;
- lead and adapt the route;
- handle or simulate a recovery problem;
- make another explorer more independent;
- debrief and preserve lessons/findings.

Exploration intentionally **does not absorb Exobiology**. It may support biological discovery and long-range travel, but Exobiology has its own field-skill progression below.

## Exobiology — implemented full pathway

Primary files:
- `lib/pathway-exobiology.js`
- `js/pathway-exobiology.js`
- shared `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`
- dedicated regression check: `scripts/smoke-exobiology.mjs`

Current routes:

### First Bio Survey — Find, Sample, Sell
Beginner complete-loop route:
- prepare a practical ship + Artemis/Genetic Sampler setup;
- select a landable body with biological signals;
- use the DSS biological heatmap and terrain together;
- locate the organism without relying on a fixed coordinate;
- complete the required three genetically distinct samples while using sampler feedback for spacing;
- return from the surface safely;
- sell the data at Vista Genomics;
- repeat the full loop independently.

### Field Surveyor — Read Terrain & Signals
Developing route:
- time a normal biological search;
- compare heatmap/terrain regions before landing;
- use a repeatable search pattern;
- compare sample-spacing behavior across organisms;
- compare ship/SRV/on-foot movement where practical;
- work a multi-species body without letting one stubborn target consume the session.

### Efficient Naturalist — Find the Time Sink
Developing/Experienced route:
- measure one complete exobiology stop;
- create a deliberate biological-detour rule;
- improve landing choice before trying to move faster afterward;
- optimize the full three-sample sequence;
- intentionally abandon/relocate a bad search when evidence justifies it;
- rerun after changing the real bottleneck.

### Target Specialist — Hunt Biology With a Purpose
Experienced route:
- define a biological search objective;
- build a candidate shortlist before flying;
- ground-truth tool predictions in the field;
- create a reusable biological field report;
- adapt the search after new evidence;
- turn the result into squad-useful reconnaissance.

### Expedition Bio Lead — Survey, Coordinate, Teach
Veteran/Mentor route:
- design a biological survey with a real objective;
- divide survey work without removing discovery;
- lead and adapt the field plan;
- quality-check shared biological reports;
- make another Commander more independent in the field;
- debrief and preserve discoveries, failed assumptions, and lessons.

Exobiology and Exploration remain separate full providers even though they naturally support one another.

## Community Goal Hauler Prep — implemented Trade specialty

Community Goal Hauler Prep is nested inside Trade & Hauling and uses its own saved specialty state. The 14-step progression teaches hostile-Open logistics around the doctrine:

> **Survive and deliver. Killing the attacker is not required.**

It covers a real existing hauler, survivability, power/heat, pips/boost, high-wake vs low-wake decisions, interdiction response, controlled squadmate escape practice, approach/docking under pressure, escort/comms, contingencies, and a hostile-delivery capstone.

## Next core Pathways

Broader coverage remains the priority. Working order can change after inspecting current authoritative content, but likely next candidates are:
- **PvE Combat**
- PvP
- Surface Operations
- Colonization
- Squadron Operations
- Powerplay only when squad doctrine is mature enough to support a stable pathway

Do not automatically build every item without inspecting current site content first. Reuse the shared assignment API and normal Pathway progress model unless a real domain requirement justifies a specialty or separate state model.

## Validation direction

The main smoke suite protects shared provider/API/campaign/specialty behavior. Exobiology additionally has a small focused regression script that checks its five-route catalog, beginner flow, Assistant recognition, shared-provider registration, UI mount, and generic-card suppression. Passing CI is a regression check, **not** production/browser validation.

Wolf prefers to review large batches of recent Pathway/Engineering work rather than interrupt development after every addition. Keep committed/CI-checked work clearly distinguished from production-validated work.
