// Research batches can add private review candidates here.
// Nothing in this list is trusted by Ask the Mongrels until its status is explicitly set to "approved".
export const KNOWLEDGE_WORKSHOP_SEEDS = [
  {
    id: "research-limpet-collector-fast-single-target",
    topic: "Collector Limpets: Targeted Mode Is Faster but Single-Use",
    question: "Why does my collector limpet die after bringing back only one item?",
    category: "Limpets · Collector",
    answer: "If you launch a Collector Limpet while a collectible object is targeted, you are deliberately putting it into fast single-target mode. It rushes that one item back and then expires. Launch with no collectible targeted for normal autonomous collection; it will keep making trips until its lifetime ends, it leaves range, or it gets destroyed.",
    details: [
      "The current Mongrel database already documents the single-item expiry behavior; the useful extra insight is that targeted collection is intentionally the faster retrieval mode, not simply a failure state.",
      "Targeting something that is not collectible, such as your prospector limpet, does not assign a one-item collection target.",
      "For mining or salvage clouds, use the Contacts-panel Ignore List instead of individually targeting every item you want."
    ],
    keywords: [
      "collector limpet dies after one item",
      "collector limpet expired",
      "programming limpet drone",
      "single use collector",
      "fast collector mode",
      "targeted collector",
      "untargeted collector",
      "collector ignore list"
    ],
    sourceClaim: "Frontier-forum and current community reports consistently describe two collector modes: an eligible object targeted at launch creates a faster single-object retrieval that expires after delivery; launching without an eligible collection target creates the slower autonomous multi-trip collector.",
    fieldNotes: "",
    sources: [
      {
        name: "Frontier Forums — Collector limpets fail after single use?",
        url: "https://forums.frontier.co.uk/threads/collector-limpets-fail-after-single-use.597646/",
        type: "Frontier forum",
        note: "Explains that targeted collectors retrieve one object rapidly and expire; untargeted collectors remain active."
      },
      {
        name: "Elite Dangerous Reddit — Collector limpet expired (Aug 2026)",
        url: "https://www.reddit.com/r/EliteDangerous/comments/1vwc4h4/collector_limpet_expired_getting_sick_of_hearing/",
        type: "Current community",
        note: "Recent 2026 confirmation of the same behavior and Ignore List workflow."
      }
    ],
    status: "review",
    confidence: "strong",
    stability: "stable",
    gameVersion: "Current Live · reviewed Sep 2026",
    assistantVisible: true,
    origin: "research"
  },
  {
    id: "research-limpet-blank-programmed-at-launch",
    topic: "Limpets Are Blank Drones Until the Controller Programs Them",
    question: "Do I need to buy different kinds of limpets for different controllers?",
    category: "Limpets · Basics",
    answer: "No. You carry ordinary limpets in cargo. They are blank drones until you fire a controller, which programs that limpet as a Collector, Prospector, Repair, Fuel Transfer, Hatch Breaker, Recon, Decontamination, or Research limpet.",
    details: [
      "The controller supplies the job; the cargo item itself is generic.",
      "This is why one cargo load of limpets can feed several different dedicated controllers or a Multi-Limpet Controller during the same trip.",
      "Deployed limpets are consumables and are not recovered back into cargo."
    ],
    keywords: [
      "different limpet types",
      "buy collector limpets",
      "buy prospector limpets",
      "same limpets",
      "generic limpets",
      "blank limpets",
      "how limpets are programmed"
    ],
    sourceClaim: "Current module references describe cargo-borne limpets as blank templates that are programmed by the active controller when launched.",
    fieldNotes: "",
    sources: [
      {
        name: "Elite Dangerous Wiki — Limpet Controller",
        url: "https://elite-dangerous.fandom.com/wiki/Limpet_Controller",
        type: "Reference",
        note: "Documents generic limpets being programmed by the selected controller at deployment."
      }
    ],
    status: "review",
    confidence: "strong",
    stability: "stable",
    gameVersion: "Current Live · reviewed Sep 2026",
    assistantVisible: true,
    origin: "research"
  },
  {
    id: "research-limpet-multi-shared-pool",
    topic: "Multi-Limpet Controllers Share One Active-Limpet Pool",
    question: "Why won't my multi-limpet controller launch a different limpet type?",
    category: "Limpets · Multi-Controllers",
    answer: "A Multi-Limpet Controller has one shared active-limpet limit across all of its functions. If you fill every slot with collectors, that same controller cannot launch a prospector, repair limpet, recon limpet, or other supported type until one of its active slots becomes free.",
    details: [
      "The limit is per controller, not per limpet programme.",
      "Example: an Operations controller with four active slots could run two Collectors, one Hatch Breaker and one Recon limpet — that is already full.",
      "A dedicated controller fitted alongside the multi-controller has its own separate active-limpet allowance, which is a useful way to reserve a critical function."
    ],
    keywords: [
      "multi limpet controller full",
      "cannot launch prospector",
      "cannot launch limpet",
      "shared limpet pool",
      "active limpet limit",
      "collector blocks prospector",
      "separate prospector controller"
    ],
    sourceClaim: "Current module data for Operations, Rescue and Universal controllers explicitly describes their maximum active limpets as one shared pool between supported programmes rather than a separate allowance for each function.",
    fieldNotes: "",
    sources: [
      {
        name: "Elite Dangerous Field Manual — Operations Multi Limpet Controller",
        url: "https://edfieldmanual.com/wiki/Operations_Multi_Limpet_Controller",
        type: "Current maintained reference",
        note: "Reviewed Sep 2026; documents the shared four-limpet pool."
      },
      {
        name: "Elite Dangerous Field Manual — Universal Multi Limpet Controller",
        url: "https://edfieldmanual.com/wiki/Universal_Multi_Limpet_Controller",
        type: "Current maintained reference",
        note: "Reviewed Sep 2026; documents the shared eight-limpet pool and separate dedicated-controller pools."
      }
    ],
    status: "review",
    confidence: "strong",
    stability: "stable",
    gameVersion: "Current Live · reviewed Sep 2026",
    assistantVisible: true,
    origin: "research"
  },
  {
    id: "research-limpet-standard-mining-multi-prospector-yield",
    topic: "Standard Mining Multi-Limpet: Great Collector, Compromised Prospector",
    question: "Should I use the standard Mining Multi-Limpet Controller as my prospector?",
    category: "Limpets · Mining",
    answer: "For serious mining, the standard Class 3 Mining Multi-Limpet Controller is much more attractive as extra collector capacity than as your only prospector. Its prospector function behaves at the controller's lower rating, while a dedicated A-rated Prospector gives the best asteroid yield. A common setup is therefore the Mining Multi for collectors plus a small dedicated A-rated Prospector.",
    details: [
      "The current Mongrel database already recommends A-rated prospectors; this adds the practical reason not to assume the standard Mining Multi replaces one.",
      "Community testing has repeatedly found lower mined yield from the standard C-rated Mining Multi prospector than from a dedicated A-rated Prospector.",
      "The exact impact depends on mining method and should remain tagged as community-tested rather than represented as a freshly published Frontier formula."
    ],
    keywords: [
      "mining multi prospector",
      "c rated prospector",
      "a rated prospector",
      "mining multi lower yield",
      "prospector fragment yield",
      "use multi as collector",
      "dedicated prospector"
    ],
    sourceClaim: "The standard Mining Multi-Limpet Controller is sold in lower-rated variants, and long-running EliteMiners testing reports that its prospector function produces lower mining yield than an A-rated dedicated Prospector. Recent 2026 discussion continues to report this behavior.",
    fieldNotes: "",
    sources: [
      {
        name: "INARA — Community Mining Guide",
        url: "https://inara.cz/elite/squadron-document/7746/2315/",
        type: "Mining reference",
        note: "Recommends A-rated dedicated Prospector Controllers because rating affects yield."
      },
      {
        name: "EliteMiners — Standard Mining Multi controller testing",
        url: "https://www.reddit.com/r/EliteMiners/comments/rclupc/the_new_mining_multi_limpet_is_c_rated/",
        type: "Community testing",
        note: "Reports tested lower fragment yield from the C-rated Mining Multi prospector compared with A-rated dedicated prospectors."
      },
      {
        name: "EliteMiners — Core-mining follow-up (May 2026)",
        url: "https://www.reddit.com/r/EliteMiners/comments/1tlehis/3c_multi_mining_limpet_controller_for_core_mining/",
        type: "Current community testing",
        note: "Recent player testing reports reduced refined return when using the standard multi-controller prospector during core mining."
      }
    ],
    status: "review",
    confidence: "mixed",
    stability: "patch-sensitive",
    gameVersion: "Current Live · community-tested through May 2026",
    assistantVisible: true,
    origin: "research"
  },
  {
    id: "research-limpet-type11-mk2-shared-14",
    topic: "Type-11 Mk II Mining Multi: 14 Limpets Still Share One Pool",
    question: "Why does the Type-11's Mk II Mining Multi stop me launching a prospector?",
    category: "Limpets · Type-11 Prospector",
    answer: "The Type-11's Class 5A Mk II Mining Multi-Limpet Controller can manage up to 14 active limpets, but collectors and prospectors share those 14 slots. If you launch all 14 as collectors, the controller has no room to launch a prospector until a slot frees. Keeping one slot open or fitting a separate dedicated Prospector avoids the problem.",
    details: [
      "Frontier introduced the Mk II controller with the Type-11 Prospector in September 2025 and specifically advertised increased limpet capacity plus faster collectors.",
      "Current references list 14 maximum active limpets for the Mk II controller.",
      "A separate dedicated Prospector Controller keeps prospecting independent from the Mk II controller's collector pool."
    ],
    keywords: [
      "type 11 prospector limpet",
      "type-11 mining multi",
      "mk ii mining multi",
      "14 collectors",
      "prospector won't fire",
      "type 11 prospector blocked",
      "separate prospector type 11"
    ],
    sourceClaim: "Frontier's Type-11 update introduced the Mk II Mining Multi-Limpet Controller with increased capacity and faster collectors. Current module references list fourteen shared active slots; post-release player reports consistently describe filling all fourteen with collectors as blocking a new prospector from that controller.",
    fieldNotes: "",
    sources: [
      {
        name: "Frontier / Steam — Type-11 Prospector Update Notes",
        url: "https://store.steampowered.com/news/app/359320/view/",
        type: "Frontier update note",
        note: "29 Sep 2025 notes: Size 5 Mk II Mining Multi with increased capacity and improved collector speeds."
      },
      {
        name: "Elite Dangerous Wiki — Mk II Mining Multi-Limpet Controller",
        url: "https://elite-dangerous.fandom.com/wiki/Mk_II_Mining_Multi-Limpet_Controller",
        type: "Reference",
        note: "Lists 5A module, 14 maximum active limpets and collector/prospector functions."
      },
      {
        name: "Elite Dangerous Reddit — Type-11 Prospector controller discussion",
        url: "https://www.reddit.com/r/EliteDangerous/comments/1nyhbyn/type_11_prospector_and_2_prospector_limpet/",
        type: "Community",
        note: "Explains the practical reason for retaining a dedicated Prospector when the multi-controller pool is full of collectors."
      }
    ],
    status: "review",
    confidence: "strong",
    stability: "patch-sensitive",
    gameVersion: "Type-11 Prospector era · current Live",
    assistantVisible: true,
    origin: "research"
  },
  {
    id: "research-limpet-universal-summary-stats",
    topic: "Universal Multi-Limpet Stats Can Be Misleading",
    question: "Does the Universal Multi-Limpet Controller give every limpet its displayed maximum range and lifetime?",
    category: "Limpets · Multi-Controllers",
    answer: "No. The Universal controller's module panel summarizes different limpet programmes, so its biggest displayed range or lifetime should not be assumed to apply to every function. Collector, Prospector, Repair, Recon and the other programmes keep their own operating characteristics.",
    details: [
      "The 7A controller's 9,100 m headline range is associated with its Prospector function, not every collector it launches.",
      "An 'infinite' displayed lifetime does not make Collector Limpets permanent.",
      "This same general caution applies to reading multi-controller headline stats: check the specific programme you actually intend to use."
    ],
    keywords: [
      "universal limpet range",
      "universal limpet infinite lifetime",
      "multi limpet displayed stats",
      "collector lifetime universal",
      "prospector range universal",
      "multi controller misleading stats"
    ],
    sourceClaim: "Current maintained module documentation notes that a multi-controller's summary panel combines values from different programmes; programme-specific values remain distinct.",
    fieldNotes: "",
    sources: [
      {
        name: "Elite Dangerous Field Manual — Universal Multi Limpet Controller",
        url: "https://edfieldmanual.com/wiki/Universal_Multi_Limpet_Controller",
        type: "Current maintained reference",
        note: "Reviewed 23 Sep 2026; explicitly warns against applying headline range/lifetime values to every programme."
      }
    ],
    status: "review",
    confidence: "strong",
    stability: "stable",
    gameVersion: "Current Live · reviewed Sep 2026",
    assistantVisible: true,
    origin: "research"
  },
{
    "id": "research-pvp-boost-bleeding",
    "topic": "Boost Bleeding: Use Boost to Change Vector, Not Just Go Faster",
    "question": "What is boost bleeding, and why does the other pilot turn inside me after boosting?",
    "category": "PvP · Flight Mechanics",
    "answer": "Boost is not only a forward-speed button. During a boost your maneuvering authority is temporarily much stronger, so PvP pilots combine the boost with reverse plus vertical/lateral thrust to bend their velocity vector and rotate without simply blasting straight past the target. That technique is commonly called boost bleeding.",
    "details": [
      "The practical goal is to turn the boost into vector change, strafing and orientation rather than ending every boost at maximum forward speed.",
      "A pilot who only boosts straight ahead often creates a long joust. A pilot who bleeds the boost through vertical/lateral/reverse inputs can stay close and keep the target in the firing envelope.",
      "Boost bleeding is community terminology, not a published Frontier energy-allocation formula."
    ],
    "keywords": [
      "boost bleeding",
      "boost bleed",
      "why is he turning inside me",
      "boost vector change",
      "vertical thrust boost",
      "lateral thrust boost",
      "reverse thrust boost",
      "pvp turning circles"
    ],
    "sourceClaim": "Long-running PvP guidance describes boost bleeding as combining boost with non-forward thrust so the maneuver creates more vector/orientation change and less unwanted forward separation.",
    "fieldNotes": "",
    "sources": [
      {
        "name": "INARA — New Pirate Initiative PvP Tactics",
        "url": "https://inara.cz/elite/cmdr-logbook-entry/269312/61925/",
        "type": "PvP community guide",
        "note": "Defines boost bleeding and pre-turning."
      },
      {
        "name": "E:D PvE Combat Wiki — Maneuvering and Positioning",
        "url": "https://sites.google.com/view/ed-pve-combat/tactics/advanced/maneuvering-and-positioning",
        "type": "Maintained combat reference",
        "note": "Describes boost as amplifying strafing and vector changes."
      }
    ],
    "status": "review",
    "confidence": "strong",
    "stability": "stable",
    "gameVersion": "Current Live · cross-checked Sep 2026",
    "assistantVisible": true,
    "origin": "research"
  },
  {
    "id": "research-pvp-boost-capping-gear-scoop",
    "topic": "Boost Capping: Landing Gear or Cargo Scoop as a Combat Speed Limiter",
    "question": "Why are PvP pilots deploying landing gear or the cargo scoop in the middle of a fight?",
    "category": "PvP · Flight Mechanics",
    "answer": "They are usually boost capping. After starting a boost, deploying landing gear or the cargo scoop lowers the ship's allowed speed while the boost's extra maneuvering authority is still active. That lets the pilot get the sharp boost-assisted turn or lateral movement without rocketing hundreds of metres past the opponent.",
    "details": [
      "The pilot is not trying to land or scoop cargo; they are deliberately limiting translation during a boost.",
      "Landing gear and cargo scoop prevent a new boost while deployed, so the normal sequence is boost first, then deploy the limiter during the active boost.",
      "Retracting the limiter before the boost ends can let the remaining boost accelerate the ship forward again.",
      "Cargo scoop is often preferred for fine control because it can be bound as a hold input and feathered rapidly."
    ],
    "keywords": [
      "landing gear in pvp",
      "cargo scoop in pvp",
      "boost capping",
      "scoop boost",
      "gear boost",
      "why deploy landing gear fighting",
      "stop overshooting boost"
    ],
    "sourceClaim": "Current combat references explicitly call timed cargo-scoop/landing-gear deployment 'boost capping': it limits the boost's forward separation while preserving useful maneuvering authority.",
    "fieldNotes": "",
    "sources": [
      {
        "name": "E:D PvE Combat Wiki — Maneuvering and Positioning",
        "url": "https://sites.google.com/view/ed-pve-combat/tactics/advanced/maneuvering-and-positioning",
        "type": "Maintained combat reference",
        "note": "Explicitly names cargo hatch / landing gear timing as boost capping."
      },
      {
        "name": "Elite Dangerous Reddit — Boost and landing",
        "url": "https://www.reddit.com/r/EliteDangerous/comments/1jt1ccr/",
        "type": "Community",
        "note": "2025 discussion confirms the combat use."
      },
      {
        "name": "Elite Dangerous Reddit — precise boost / cargo scoop discussion",
        "url": "https://www.reddit.com/r/EliteDangerous/comments/12edz98/",
        "type": "Community demonstration",
        "note": "Explains limiting forward boost while retaining boosted lateral/vertical authority."
      }
    ],
    "status": "review",
    "confidence": "strong",
    "stability": "stable",
    "gameVersion": "Current Live · cross-checked Sep 2026",
    "assistantVisible": true,
    "origin": "research"
  },
  {
    "id": "research-pvp-preturning",
    "topic": "Pre-Turning: Start the Turn Before the Pass Is Over",
    "question": "Why does the other pilot seem to already be behind me the instant we pass each other?",
    "category": "PvP · Positioning",
    "answer": "They may be pre-turning. Instead of waiting until you have completely passed and then starting a 180, an experienced pilot starts rotating and setting the next vector before or during the pass. If they time their boost just after yours and turn toward your committed vector, they can finish the pass already lined up to follow you.",
    "details": [
      "Waiting until the opponent is fully behind you creates a reaction delay and forces a larger recovery turn.",
      "A common PvP pattern is to watch the opponent's boost, then boost slightly after it while turning into the direction they are committing to.",
      "This is why identical ships can look very different: one pilot is reacting to the current position while the other is flying to the next position."
    ],
    "keywords": [
      "pre turning",
      "preturn",
      "anticipatory turn",
      "already behind me",
      "turn before pass",
      "follow enemy boost",
      "why he turns faster"
    ],
    "sourceClaim": "PvP guides describe pre-turning as beginning the return turn during the pass and timing a following boost after the opponent's boost to reduce lost time and maintain pressure.",
    "fieldNotes": "",
    "sources": [
      {
        "name": "INARA — New Pirate Initiative PvP Tactics",
        "url": "https://inara.cz/elite/cmdr-logbook-entry/269312/61925/",
        "type": "PvP community guide",
        "note": "Provides a step-by-step pre-turning sequence."
      },
      {
        "name": "Elite Dangerous Reddit — anticipatory turning discussion",
        "url": "https://www.reddit.com/r/EliteDangerous/comments/1n6le7h/",
        "type": "Community",
        "note": "2025 discussion identifies anticipatory turning plus scoop/gear boost control."
      }
    ],
    "status": "review",
    "confidence": "strong",
    "stability": "stable",
    "gameVersion": "Current Live · cross-checked Sep 2026",
    "assistantVisible": true,
    "origin": "research"
  },
  {
    "id": "research-pvp-rotation-vs-vector",
    "topic": "A Fast Flip Is Not the Same Thing as a Tight Turn",
    "question": "I can FA-Off flip and point at him quickly, so why am I still losing the turning fight?",
    "category": "PvP · Flight Mechanics",
    "answer": "Because pointing your nose at the target is only rotation. Your ship may still be travelling along the old vector. If you FA-Off flip without also changing that vector, you often end up sliding backwards or creating another joust. Skilled pilots combine the rotation with vertical/lateral thrust and well-timed boost so the ship's travel path curves around the opponent instead of merely facing them.",
    "details": [
      "FA-Off lets facing and travel direction separate; a perfect 180-degree flip can still leave you moving the wrong way.",
      "The pilot who looks like they are circling you is often continuously bending their velocity vector instead of repeatedly flipping and recovering.",
      "A useful mental model is: rotation puts the guns on target; vector control determines whether you stay in a dominant position."
    ],
    "keywords": [
      "fa off flip not turning",
      "rotation vs vector",
      "still sliding backwards",
      "why do i keep jousting",
      "orbit opponent",
      "vector control pvp",
      "facing target but moving away"
    ],
    "sourceClaim": "FA-Off separates orientation from translation. Community flight instruction distinguishes simply rotating the ship from actually changing its movement vector; boosted lateral/vertical thrust creates the curved path needed for close positioning.",
    "fieldNotes": "",
    "sources": [
      {
        "name": "E:D PvE Combat Wiki — Maneuvering and Positioning",
        "url": "https://sites.google.com/view/ed-pve-combat/tactics/advanced/maneuvering-and-positioning",
        "type": "Maintained combat reference",
        "note": "Explains strafing, vector change, boost bleeding and close-range geometry."
      },
      {
        "name": "Elite Dangerous Reddit — FA-Off tethering discussion",
        "url": "https://www.reddit.com/r/EliteDangerous/comments/l2i1qm/",
        "type": "Community flight instruction",
        "note": "Distinguishes faster rotation from changing the ship's vector."
      },
      {
        "name": "Elite Dangerous Reddit — FA-Off maneuvering question",
        "url": "https://www.reddit.com/r/EliteDangerous/comments/1m0ob0y/",
        "type": "Community",
        "note": "2025 discussion recommends vertical thrust through the flip to create a rounded curve."
      }
    ],
    "status": "review",
    "confidence": "strong",
    "stability": "stable",
    "gameVersion": "Current Live · cross-checked Sep 2026",
    "assistantVisible": true,
    "origin": "research"
  },
  {
    "id": "research-pvp-why-running-circles",
    "topic": "Why an Equal Ship Can Look Much More Agile in PvP",
    "question": "Why does it feel like this guy is literally running circles around me even when our ships have similar agility?",
    "category": "PvP · Positioning",
    "answer": "Raw pitch rate is only one piece of the fight. A strong PvP pilot stacks several small advantages at once: pre-turning, boost timing, vertical/lateral thrust, FA-Off vector separation, boost bleeding, and sometimes boost capping with the scoop or landing gear. The result is less overshoot and less recovery time, so they appear to turn faster even when the ship itself may not have a dramatic agility advantage.",
    "details": [
      "The losing pilot is often flying point-to-point: pass, turn 180, accelerate back. The winning pilot is flying a continuous curve around the engagement.",
      "Range control matters as much as nose authority. If the opponent keeps the fight close while you repeatedly overshoot, they get more firing time even if nominal pitch rate is similar.",
      "Do not diagnose every close-range loss as 'I need a more maneuverable ship.' Compare boost use, vector control and turn timing first."
    ],
    "keywords": [
      "running circles around me",
      "out turning me",
      "same ship turns faster",
      "pvp pilot too agile",
      "why can't i stay on target",
      "why do i keep overshooting",
      "turn fight",
      "close range pvp"
    ],
    "sourceClaim": "Current combat references emphasize positioning, strafing, boost timing and vector changes over raw turn-rate figures. PvP guidance combines boost bleeding and pre-turning to maintain dominant position and avoid repeated jousts.",
    "fieldNotes": "",
    "sources": [
      {
        "name": "INARA — New Pirate Initiative PvP Tactics",
        "url": "https://inara.cz/elite/cmdr-logbook-entry/269312/61925/",
        "type": "PvP community guide",
        "note": "Covers dominant positioning, boost bleeding and pre-turning."
      },
      {
        "name": "E:D PvE Combat Wiki — Maneuvering and Positioning",
        "url": "https://sites.google.com/view/ed-pve-combat/tactics/advanced/maneuvering-and-positioning",
        "type": "Maintained combat reference",
        "note": "Emphasizes vector changes, boost bleeding and boost capping."
      },
      {
        "name": "Elite Dangerous Reddit — PvP builds / piloting discussion",
        "url": "https://www.reddit.com/r/EliteDangerous/comments/1ekajex/",
        "type": "Community",
        "note": "Experienced replies stress FA-Off, pip control, vector matching and pre-turning."
      }
    ],
    "status": "review",
    "confidence": "strong",
    "stability": "stable",
    "gameVersion": "Current Live · cross-checked Sep 2026",
    "assistantVisible": true,
    "origin": "research"
  }
];
