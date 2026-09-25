// Classic Elite Dangerous rare-trade commodities.
// Source baseline: EDDiscovery FrontierData InaraRares list, normalized here for Trader's Outpost behavior.
// These are the unique-source rare goods for which a user-selected search radius should not hide the source.
const RARE_COMMODITY_NAMES=[
  "Apa Vietii",
  "Aepyornis Egg",
  "Aganippe Rush",
  "Alacarakmo Skin Art",
  "Albino Quechua Mammoth Meat",
  "Altairian Skin",
  "Alya Body Soap",
  "Anduliga Fire Works",
  "Any Na Coffee",
  "Arouca Conventual Sweets",
  "AZ Cancri Formula 42",
  "Azure Milk",
  "Baltah'sine Vacuum Krill",
  "Banki Amphibious Leather",
  "Bast Snake Gin",
  "Belalans Ray Leather",
  "Borasetani Pathogenetics",
  "Buckyball Beer Mats",
  "Burnham Bile Distillate",
  "CD-75 Kitten Brand Coffee",
  "Centauri Mega Gin",
  "Ceremonial Heike Tea",
  "Ceti Rabbits",
  "Chameleon Cloth",
  "Chateau de Aegaeon",
  "Cherbones Blood Crystals",
  "Chi Eridani Marine Paste",
  "Coquim Spongiform Victuals",
  "Crom Silver Fesh",
  "Crystalline Spheres",
  "Damna Carapaces",
  "Delta Phoenicis Palms",
  "Deuringas Truffles",
  "Diso Ma Corn",
  "Eden Apples Of Aerial",
  "Eleu Thermals",
  "Eranin Pearl Whisky",
  "Eshu Umbrellas",
  "Esuseku Caviar",
  "Ethgreze Tea Buds",
  "Fujin Tea",
  "Galactic Travel Guide",
  "Geawen Dance Dust",
  "Gerasian Gueuze Beer",
  "Giant Irukama Snails",
  "Giant Verrix",
  "Gilya Signature Weapons",
  "Goman Yaupon Coffee",
  "Haiden Black Brew",
  "Havasupai Dream Catcher",
  "Helvetitj Pearls",
  "HIP 10175 Bush Meat",
  "HIP 118311 Swarm",
  "HIP Organophosphates",
  "HIP Proto-Squid",
  "Holva Duelling Blades",
  "Honesty Pills",
  "HR 7221 Wheat",
  "Indi Bourbon",
  "Jaques Quinentian Still",
  "Jaradharre Puzzle Box",
  "Jaroua Rice",
  "Jotun Mookah",
  "Kachirigin Filter Leeches",
  "Kamitra Cigars",
  "Kamorin Historic Weapons",
  "Karetii Couture",
  "Karsuki Locusts",
  "Kinago Violins",
  "Kongga Ale",
  "Koro Kung Pellets",
  "Lavian Brandy",
  "Leathery Eggs",
  "Leestian Evil Juice",
  "Live Hecate Sea Worms",
  "LTT Hyper Sweet",
  "Lucan Onionhead",
  "Master Chefs",
  "Mechucos High Tea",
  "Medb Starlube",
  "Mokojing Beast Feast",
  "Momus Bog Spaniel",
  "Motrona Experience Jelly",
  "Mukusubii Chitin-os",
  "Mulachi Giant Fungus",
  "Neritus Berries",
  "Ngadandari Fire Opals",
  "Nguna Modern Antiques",
  "Njangari Saddles",
  "Non Euclidian Exotanks",
  "Ochoeng Chillies",
  "Onionhead",
  "Onionhead Alpha Strain",
  "Onionhead Beta Strain",
  "Ophiuch Exino Artefacts",
  "Orrerian Vicious Brew",
  "Pantaa Prayer Sticks",
  "Pavonis Ear Grubs",
  "Personal Gifts",
  "Rajukru Multi-Stoves",
  "Rapa Bao Snake Skins",
  "Rusani Old Smokey",
  "Sanuma Decorative Meat",
  "Saxon Wine",
  "Shan's Charis Orchid",
  "Soontill Relics",
  "Sothis Crystalline Gold",
  "Tanmark Tranquil Tea",
  "Tarach Spice",
  "Tauri Chimes",
  "Terra Mater Blood Bores",
  "The Hutton Mug",
  "The Waters of Shintara",
  "Thrutis Cream",
  "Tiegfries Synth Silk",
  "Tiolce Waste2Paste Units",
  "Toxandji Virocide",
  "Ultra-Compact Processor Prototypes",
  "Uszaian Tree Grub",
  "Utgaroar Millennial Eggs",
  "Uzumoku Low-G Wings",
  "V Herculis Body Rub",
  "Vanayequi Ceratomorpha Fur",
  "Vega Slimweed",
  "Vidavantian Lace",
  "Void Extract Coffee",
  "Volkhab Bee Drones",
  "Wheemete Wheat Cakes",
  "Witchhaul Kobe Beef",
  "Wolf Fesh",
  "Wulpa Hyperbore Systems",
  "Wuthielo Ku Froth",
  "Xihe Biomorphic Companions",
  "Yaso Kondi Leaf",
  "Zeessze Ant Grub Glue",
  "Lyrae Weed",
  "Chateau De Aegaeon",
  "The Waters Of Shintara",
  "Baked Greebles",
  "Hip Organophosphates",
  "Harma Silver Sea Rum",
  "Earth Relics"
];

const RARE_ALIAS_GROUPS=[
  ['Soontill Relics','Soontil Relics'],
];
const RARE_ALIASES=RARE_ALIAS_GROUPS.flatMap(group=>group.slice(1));
const RARE_KEYS=new Set([...RARE_COMMODITY_NAMES,...RARE_ALIASES].map(normalizeRareCommodityName));
const RARE_ALIAS_MAP=new Map();
for(const group of RARE_ALIAS_GROUPS){
  const canonical=group[0];
  for(const name of group)RARE_ALIAS_MAP.set(normalizeRareCommodityName(name),{canonical,names:[...group]});
}
const RARE_SOURCE_MAP=new Map([
  [normalizeRareCommodityName('Soontill Relics'),{
    commodity:'Soontill Relics',
    systemName:'Ngurii',
    stationName:'Cheranovsky City',
  }],
]);


export function isRareTradeCommodity(value){
  return RARE_KEYS.has(normalizeRareCommodityName(value));
}

export function rareCommodityNames(){
  return [...RARE_COMMODITY_NAMES];
}

export function rareTradeCommoditySearchNames(value){
  const key=normalizeRareCommodityName(value);
  const group=RARE_ALIAS_MAP.get(key);
  return group?[...group.names]:[String(value??'').trim()].filter(Boolean);
}

export function rareTradeCommodityCanonicalName(value){
  const key=normalizeRareCommodityName(value);
  return RARE_ALIAS_MAP.get(key)?.canonical||String(value??'').trim();
}

export function rareTradeCommoditySource(value){
  const canonical=rareTradeCommodityCanonicalName(value);
  const source=RARE_SOURCE_MAP.get(normalizeRareCommodityName(canonical));
  return source?{...source}:null;
}

export function normalizeRareCommodityName(value){
  return String(value??'')
    .trim()
    .toLowerCase()
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'');
}
