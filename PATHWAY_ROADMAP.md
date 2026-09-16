# Mongrels My Pathway — Development Roadmap

This file records current Pathway direction and specialty concepts that should survive chat/context changes. Current repository code remains authoritative for implemented behavior.

## Current full pathways

1. **Anti-Xeno** — complete multi-experience route model; includes Scout School, Interceptor development, Guardian specialization, and Hellhound veteran/mentor work.
2. **Background Simulation** — foundations through strategic planning, tick diagnosis, campaign leadership, and mentoring.
3. **Mining** — laser foundations, efficiency, advanced extraction, Rhino surface operations, specialist work, and lead/mentor routes.
4. **Trade & Hauling** — action-first beginner progression, Route Runner, Medium-Pad Specialist, Strategic Hauler, Market Specialist, and Logistics Lead.
5. **Carrier Logistics** — Carrier Foundations, Carrier Crew, Cargo Coordinator, Movement Planner, and Carrier Logistics Lead.
6. **Engineering & Shipbuilding** — action-first Engineering Foundations, Engineer Network, Role Builder, Combat Systems, Ship Architect, and Engineering Mentor routes.

Full pathways use independent `pathway-progress-v1:<owner>:<activity>` records through the shared assignment API.

## Pathway design rules

- Beginners should generally **do before they analyze**.
- Prefer one primary lesson per assignment.
- Good progression pattern: **do → observe → compare → understand → optimize → lead/teach**.
- Assignments state what to accomplish without spelling out every hidden prerequisite.
- Research is part of learning; Ask the Mongrels and other members are the fallback when a Commander gets stuck.
- `Already Know / Have This` earns credit; `Skip for Now` does not.
- Veterans should receive diagnosis, leadership, wing/team responsibility, and teaching—not just larger numbers.
- Ownership or wealth should not be an artificial gate when the same skill can be demonstrated by working with another Mongrel. Carrier Movement Planner, for example, does not require owning a fleet carrier.
- Engineering beginners should improve **one ship they already use**, one problem at a time, before full-build optimization or theory-heavy tradeoff work is introduced.
- Engineering is unusually grind-heavy. Large unlocks/material goals should be decomposed into small milestones with deliberate stopping points and regular payoff/testing so a member is not left staring at one multi-day task.

## Engineering Campaign Planner — framework in progress

Engineering needs more structure than a normal static activity route because two Commanders pursuing the same upgrade may have completely different engineer access, prerequisite progress, materials, and existing module grades.

The intended model is a hybrid:

1. **Engineering Goal** — the outcome the Commander wants, such as stronger shields, more jump range, better mobility, distributor performance, power/thermal improvement, weapon-package improvement, or finishing a role build.
2. **Engineering Campaign** — a data-driven dependency plan that works backward from that goal and selects the next manageable Engineering assignment.
3. **Background Prep Opportunities** — optional tasks surfaced while the Commander is already doing another activity. These may advance shared Engineering facts/prerequisites but **must never award or block progress in the other pathway**.

Examples of the intended behavior:
- A large cumulative unlock requirement such as many market visits should be represented as one tracked prerequisite with small chunks (for example, five more useful market visits at a time) rather than one giant task.
- Trade may offer an optional Engineering Prep opportunity that advances a market-visit counter while the Commander is trading anyway.
- Mining, exploration, missions, combat, or other activities may eventually advance compatible engineer prerequisites when it is natural to do so.
- The Engineering campaign remains the authoritative owner of Engineering progress; other pathways only expose optional preparation opportunities.

### Current framework files

- `lib/engineering-campaign.js` — campaign state schema, goal catalog, fact/provenance model, generic setup nodes, dependency evaluation contract, and background-prep output.
- `lib/engineering-campaign-data.js` — separate data seam for audited engineer unlock chains and goal-specific dependency nodes.
- `functions/api/pathway/engineering-campaign.js` — authenticated member API and `PROJECTS` persistence.

Storage:
- `PROJECTS`
- prefix: `engineering-campaign-v1:<ownerId>`

Framework principles:
- Goal history can survive switching or pausing campaigns.
- Shared Engineering facts are stored separately from one campaign so prior work can satisfy future goals.
- Facts retain provenance (`manual` now; future server-owned/import sources can be added later).
- Dependency nodes can complete manually or from facts such as counters/boolean unlock state.
- Counter nodes can expose a `chunkSize` and one or more `backgroundActivities` so large prerequisites can become bite-size optional prep.
- Goal-specific engineer data is deliberately separated from the planner engine so unlock changes/corrections do not require migrating stored campaign state.
- The first framework is intentionally **behind the current Engineering UI**. Do not replace the Engineering route users already like until the dependency database and campaign UX are mature enough.
- No new global experience band has been added yet. Engineering gets extra breathing room through internal campaign layers rather than forcing AX/BGS/Mining/Trade/etc. to adopt another level unnecessarily.

### Engineering content/data work still required

Before the campaign planner becomes the main user-facing Engineering experience:
- audit current engineer unlock chains and grade capabilities;
- encode prerequisites as small dependency nodes;
- identify which prerequisites are safe/natural to expose as background prep in Trade, Mining, Exploration, combat, missions, etc.;
- add Inara/resource links for engineering planning and material requirements;
- design a simple way for the Commander to record current engineer access, relevant prerequisite counters, and current module grade;
- decide which state can later be imported/synced versus what remains manual;
- add targeted material-planning steps so Commanders gather for a defined upgrade/stopping grade instead of generic stockpile grinds;
- alternate prerequisite work with actual engineering/test flights whenever possible so the player regularly feels payoff.

## Queued core pathways

Likely next candidates include:
- Exploration
- Exobiology
- PvE Combat
- PvP
- Surface Operations
- Colonization
- Squadron Operations
- Powerplay when the squad doctrine is mature enough to support a stable pathway

## Specialty / scenario pathways

Specialty pathways intentionally combine several core skill areas around a real operating environment. They should not replace the core pathways; they test whether a Commander can combine those skills under realistic conditions.

### Community Goal Hauler Prep — queued

**Concept:** prepare ordinary Mongrel haulers to survive and contribute effectively in a hostile Open-play Community Goal rather than treating the CG like routine point-A-to-B trading.

Design direction:
- Start with **the Commander's existing cargo ship**, not a required meta hull.
- Teach the Commander to rethink the build around a balance of **cargo capacity, speed, shields/hull, utility, power, and survival**.
- Ask whether existing engineering is appropriate for a hostile logistics environment and what should change.
- Introduce PvP survival concepts only after the ship has been prepared.
- Teach that the hauler's win condition is usually **survive and deliver**, not kill the attacker.
- Practice interdiction/escape decisions and pip/boost discipline.
- Explicitly teach **high wake vs. low wake**, including when jumping to another system is safer than trying to return to supercruise in the contested system.
- Use mock hostile deliveries with Mongrel PvP pilots acting as attackers so the hauler can practice under controlled pressure.
- Include a run using a **Mongrel escort** and teach rendezvous/comms/escort coordination.
- Reinforce that a Squadron member entering known hostile territory should use the squad: check who is online, request escort/help, coordinate a rendezvous, and plan contingency systems rather than repeatedly dying alone and blaming hostile players.
- Capstone: successfully participate in a real Community Goal or simulated hostile logistics operation and deliver cargo under credible player-threat conditions.

Potential prerequisite signals: Trade & Hauling plus some Engineering/Shipbuilding knowledge. PvP experience should help but should not be mandatory; this pathway is meant to teach haulers how to survive PvP pressure, not turn them into PvP duelists.
