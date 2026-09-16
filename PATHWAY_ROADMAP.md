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
9. **PvE Combat** — Combat Foundations, Bounty Hunter, Conflict Zone Specialist, Combat Specialist, and Combat Lead/Mentor routes.
10. **PvP** — PvP Foundations, Duelist, Precision Fighter, Wing Fighter, and PvP Lead/Mentor routes.
11. **Operations** — Operations Foundations, Multi-Role Operator, Scenario Specialist, Hard Operations Specialist, and Operations Lead/Mentor routes.

Full pathways use independent `pathway-progress-v1:<owner>:<activity>` records through the shared assignment API.

### Operations naming / compatibility rule

The Elite Dangerous game feature is called **Operations** throughout the user-facing site. Do not label this feature “Surface Operations.” Operations deliberately includes ship combat, on-foot activity, rescue, and mixed-phase scenarios.

For backwards compatibility, its persisted My Pathway activity ID remains `surface`. Do not migrate or expose that internal identifier just to match the display name. The separate activity ID `operations` continues to mean **Squad Operations** / Mission Control / Daily Orders and must not be conflated with the game feature.

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

## PvE Combat — implemented full pathway

Primary files:
- `lib/pathway-pve.js`
- `js/pathway-pve.js`
- shared `functions/api/pathway/assignments.js`
- mount in `pathway/index.html`
- dedicated regression check: `scripts/smoke-pve.mjs`

Current routes:

### Combat Foundations — Scan, Fight, Cash In
Beginner complete-loop route:
- prepare one rebuy-safe combat ship rather than requiring a meta hull;
- confirm legal WANTED targets before opening fire where local law applies;
- practice active SYS/ENG/WEP pip management;
- choose favorable fights instead of attacking everything on the scanner;
- win a controlled bounty fight;
- practice disengagement before the ship forces the decision;
- return and redeem bounty vouchers;
- graduate with a short independent session of at least three legal NPC bounty kills.

### Bounty Hunter — Pips, Position, Pressure
Developing route:
- record an honest session baseline;
- make fire groups agree with weapon jobs;
- practice proactive pip rhythm across multiple fights;
- improve useful time-on-target through positioning;
- use subsystem targeting only when it solves a real problem;
- manage a sustained bounty session rather than one perfect duel;
- change the measured bottleneck and re-run.

### Conflict Zone Specialist — Survive the Battle
Developing/Experienced route:
- audit a ship for sustained CZ pressure rather than assuming a bounty build is sufficient;
- complete a controlled CZ run for the intended side;
- choose targets that help the local battle and friendly pressure;
- maintain enough awareness to respond to changing battlefield priorities;
- step up difficulty deliberately rather than jumping straight to maximum pressure;
- practice focus fire, separation awareness, and recovery with another Mongrel;
- when CZ combat supports BGS/squad work, verify Daily Orders before assuming a win or turn-in helps the current objective.

### Combat Specialist — Diagnose, Adapt, Sustain
Experienced route:
- choose a repeatable hard-fight benchmark;
- separate theoretical DPS from real applied damage;
- identify how the ship actually loses fights;
- use subsystem pressure as a fight-control tool rather than a ritual;
- change only the measured build/technique limitation;
- re-test under comparable pressure;
- complete a higher-threat PvE capstone or make a disciplined withdrawal with a repeatable lesson.

### Combat Lead — Coordinate, Recover, Teach
Veteran/Mentor route:
- plan an operation with a real combat objective and stop condition;
- brief target calls, focus-fire expectations, separation and exits;
- lead a wing session and adapt once;
- recover a pressured wingmate or degraded fight before it becomes a chain of rebuys;
- make another PvE pilot more independent;
- debrief the operation and preserve one concrete next adjustment.

**Boundary:** PvE Combat teaches NPC combat and squad combat operations. PvP is a separate full Pathway because human-opponent range control, prediction, matchup knowledge, Open survival, and organized player combat require a different progression.

## PvP — implemented full pathway

Primary files:
- `lib/pathway-pvp.js`
- `js/pathway-pvp.js`
- shared `functions/api/pathway/assignments.js`
- personalized Assistant integration in `lib/assistant-pathway-context.js`
- mount in `pathway/index.html`
- dedicated regression check: `scripts/smoke-pvp.mjs`

Current routes:

### PvP Foundations — Survive, Fight, Learn
Beginner route:
- read and understand the Mongrel Open Play and no-combat-logging standards;
- prepare one rebuy-safe PvP training ship rather than requiring a meta hull;
- practice defensive/offensive pip transitions under player pressure;
- learn to create and break firing solutions through movement;
- practice a legitimate disengagement entirely through normal game mechanics;
- complete a structured 1v1 with agreed start/stop conditions;
- separate pilot problems from build problems in the debrief;
- repeat the complete learning loop with less coaching.

### Duelist — Range, Pips & Pressure
Developing route:
- record an honest multi-round duel baseline;
- fight for the range the current weapon package actually wants;
- distinguish favorable exchanges from moments that should be reset;
- use target/subsystem information without losing basic control;
- change only one measured bottleneck before retesting;
- graduate through a measured set of at least three structured rounds.

### Precision Fighter — Aim, Prediction & Weapon Application
Developing/Experienced route:
- choose one aim-dependent package to train rather than making fixed weapons mandatory for everyone;
- stop spending shots on poor firing windows;
- improve vector reading and prediction through repeated passes;
- keep WEP, heat, ammunition, and defense sustainable while aiming;
- preserve precision under real opponent pressure;
- prove the package across complete duel rounds without letting aim practice collapse the rest of the ship.

### Wing Fighter — Focus, Comms & Mutual Support
Experienced route:
- understand the ship's role, strength, and limitation inside a wing;
- practice concise target/status/disengagement calls;
- acquire and maintain pressure on the called target;
- execute coordinated target switches for a stated tactical reason;
- support a wingmate under focus rather than drifting into isolated private duels;
- complete and debrief a structured small-group fight with agreed stop/disengagement conditions.

### PvP Lead — Plan, Command, Teach
Veteran/Mentor route:
- design a training/combat session around one clear objective;
- brief conduct, roles, comms, start/stop conditions, and disengagement before launch;
- lead the session and make at least one evidence-based adaptation;
- review another pilot's build without simply prescribing the mentor's preferred ship;
- make another Commander more independent in one specific PvP skill;
- publish a debrief that preserves the lesson rather than only the score.

Core PvP doctrine carried through the Pathway:
- Open Play is the squad standard;
- Solo/Private Group must not be used to avoid player opposition;
- combat logging is not an escape technique;
- a beginner's first objective is composure, legitimate survival, and learning—not owning an FDL or winning every fight;
- controlled squadmate practice is preferred for first repetitions before expecting a new pilot to learn through random hostile encounters.

## Operations — implemented full pathway

Primary files:
- `lib/pathway-operations.js`
- `js/pathway-operations.js`
- shared `functions/api/pathway/assignments.js`
- visible catalog label in `functions/api/pathway/preferences.js`
- personalized Assistant integration in `lib/assistant-pathway-context.js`
- mount in `pathway/index.html`
- dedicated regression check: `scripts/smoke-operations.mjs`

Current routes:

### Operations Foundations — Launch, Adapt, Extract
Beginner complete-loop route:
- understand the Operation Runner launch, respawn/redeployment, and extraction loop;
- choose a manageable first scenario based on the equipment already available;
- prepare both the ship and suit/on-foot side before the ship choice locks;
- deploy from the Runner with the first objective understood;
- handle a real phase transition such as ship → foot, foot → ship, rescue → combat, or another objective change;
- recover or explain the normal Runner recovery loop after a defeat or mistake;
- complete extraction and verify the reward/Merc Coin result;
- repeat the complete Operation with less coaching.

### Multi-Role Operator — Ship, Foot & Transition
Developing route:
- identify the largest mixed-phase bottleneck;
- map one scenario into ship, on-foot, support, and transition jobs;
- fly the assigned ship role rather than chasing personal score;
- perform the assigned on-foot/objective role rather than turning every phase into a firefight;
- practice a clean role handoff;
- remove one critical single point of failure through redundancy;
- change one measured transition bottleneck and retest.

### Scenario Specialist — Pick the Right Job
Developing/Experienced route:
- complete at least three different scenarios, including ship-heavy/mixed and on-foot/rescue-heavy work;
- identify the real squad capability each scenario demands;
- choose Easy or Hard for a stated reason rather than treating Hard as the automatic goal;
- define Merc Coin/reward or training goals before grinding;
- build a reusable scenario-selection rule based on squad size, equipment, preferred activity, risk, and goal;
- choose a real squad's scenario and compare the result with the pre-launch reasoning.

### Hard Operations Specialist — Sustain Under Pressure
Experienced route:
- choose a repeatable Hard benchmark that exposes a real weakness;
- change only the ship/suit systems that address the measured problem;
- manage ship and on-foot resources across the whole run;
- maintain role discipline under pressure;
- identify the first repeatable failure mode rather than only the dramatic final event;
- make one major correction and retest, including deliberately stepping down or changing scenario when the original choice was the mistake.

### Operations Lead — Brief, Adapt, Teach
Veteran/Mentor route:
- plan a session around a clear purpose such as onboarding, breadth, Merc Coin, Hard progression, or role training;
- assign primary roles, secondary coverage, and redundancy before the Runner jumps;
- lead the run and adapt once when reality disagrees with the brief;
- recover/reorganize the squad when a Commander is defeated, disconnected, separated, or under-equipped;
- make another operator more independent in one specific skill;
- preserve a concise debrief with context and uncertainty for balance-sensitive observations.

Core Operations principles:
- the feature is not an on-foot-only activity;
- the Runner and full select → prepare → deploy → adapt → extract loop matter as much as any one combat phase;
- scenario choice should reflect the real squad and session goal;
- Easy and Hard are tools, not status labels;
- leadership emphasizes role coverage, redundancy, recovery, and teaching rather than personal score.

## Community Goal Hauler Prep — implemented Trade specialty

Community Goal Hauler Prep is nested inside Trade & Hauling and uses its own saved specialty state. The 14-step progression teaches hostile-Open logistics around the doctrine:

> **Survive and deliver. Killing the attacker is not required.**

It covers a real existing hauler, survivability, power/heat, pips/boost, high-wake vs low-wake decisions, interdiction response, controlled squadmate escape practice, approach/docking under pressure, escort/comms, contingencies, and a hostile-delivery capstone.

## Next core Pathways

Broader coverage remains the priority. Working order can change after inspecting current authoritative content, but likely next candidates are:
- **Colonization**
- Squadron Operations
- Powerplay only when squad doctrine is mature enough to support a stable pathway

Do not automatically build every item without inspecting current site content first. Reuse the shared assignment API and normal Pathway progress model unless a real domain requirement justifies a specialty or separate state model.

## Validation direction

The main smoke suite protects shared provider/API/campaign/specialty behavior. Exobiology, PvE Combat, PvP, and Operations additionally have focused regression scripts that protect their five-route catalogs, beginner flows, Assistant recognition, shared-provider registration, UI mounts, and generic-card suppression. PvE also guards the legal-target beginner lesson and the Conflict Zone → Daily Orders operational handoff. PvP additionally guards Open-play/no-combat-logging doctrine and legitimate escape training. Operations additionally guards the Runner-to-extraction loop, mixed ship/on-foot preparation and phase transitions, and the visible Operations naming rule. Passing CI is a regression check, **not** production/browser validation.

Wolf prefers to review large batches of recent Pathway/Engineering work rather than interrupt development after every addition. Keep committed/CI-checked work clearly distinguished from production-validated work.
