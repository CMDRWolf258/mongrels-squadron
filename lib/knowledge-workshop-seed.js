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
  }
];
