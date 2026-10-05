// Consumables (potions, totems, tokens), outfitter gear, enchants and
// crafting recipes.
//
// Effect format used across the game (see stats.js):
//   { stat: { add: n } }   flat addition (luck, capacity, …) or +fraction for
//                          multiplier stats (sizeBoost, modBoost, sellBoost, items)
//   { stat: { pct: n } }   percentage bonus, summed then applied once
//   { stat: { mult: n } }  multiplicative (events, totems, debuffs)

export const STAT_KEYS = [
  'luck', 'capacity', 'shakeStrength', 'shakeSpeed', 'digStrength', 'digSpeed',
  'sizeBoost', 'modBoost', 'sellBoost', 'items', 'walkSpeed',
];

// Potions — cash prices scale with your progress (see game.priceOf)
export const POTIONS = [
  { id: 'luck1',    name: 'Luck Potion',            cost: { cash: 25000 },  dur: 300, color: '#3ddc84', effects: { luck: { pct: 0.25 } }, desc: '+25% Luck' },
  { id: 'cap1',     name: 'Capacity Potion',        cost: { cash: 20000 },  dur: 300, color: '#ffb74d', effects: { capacity: { pct: 0.3 } }, desc: '+30% Capacity' },
  { id: 'swift',    name: 'Swiftness Tonic',        cost: { cash: 15000 },  dur: 300, color: '#ffe14d', effects: { shakeSpeed: { pct: 0.3 } }, desc: '+30% Shake Speed' },
  { id: 'brew',     name: "Digger's Brew",          cost: { cash: 15000 },  dur: 300, color: '#c98b4a', effects: { digStrength: { pct: 0.4 } }, desc: '+40% Dig Strength' },
  { id: 'clarity',  name: 'Clarity Elixir',         cost: { cash: 50000 },  dur: 600, color: '#9be7ff', effects: {}, cleanse: true, desc: 'Immune to hazards & debuffs' },
  { id: 'luck2',    name: 'Greater Luck Potion',    cost: { shards: 20 },   dur: 600, color: '#00e676', effects: { luck: { pct: 0.6 } }, desc: '+60% Luck' },
  { id: 'cap2',     name: 'Greater Capacity Potion',cost: { shards: 15 },   dur: 600, color: '#ff9800', effects: { capacity: { pct: 0.75 } }, desc: '+75% Capacity' },
  { id: 'haste',    name: 'Haste Elixir',           cost: { shards: 10 },   dur: 600, color: '#ff7043', effects: { digSpeed: { pct: 0.3 }, walkSpeed: { pct: 0.3 } }, desc: '+30% Dig & Walk Speed' },
  { id: 'giant',    name: "Giant's Draught",        cost: { shards: 25 },   dur: 600, color: '#26c6da', effects: { sizeBoost: { add: 0.5 } }, desc: '+50% Size' },
  { id: 'mutation', name: 'Mutation Serum',         cost: { shards: 30 },   dur: 600, color: '#d500f9', effects: { modBoost: { add: 1 } }, desc: '+100% Modifier chance' },
  { id: 'midas',    name: 'Midas Tonic',            cost: { shards: 20 },   dur: 900, color: '#ffd600', effects: { sellBoost: { add: 0.3 } }, desc: '+30% Sell value' },
  { id: 'luck3',    name: 'Supreme Luck Potion',    cost: { shards: 60 },   dur: 600, color: '#00ffb3', effects: { luck: { pct: 1.5 } }, desc: '+150% Luck' },
];

// Totems are placed at your current shore and only work there.
// Other "players" (bots) place them too — stand in their circle!
export const TOTEMS = [
  { id: 'luckTotem',     name: 'Luck Totem',       cost: { shards: 40 }, dur: 600, color: '#3ddc84', effects: { luck: { mult: 2 } }, desc: '2× Luck at this shore' },
  { id: 'strengthTotem', name: 'Strength Totem',   cost: { shards: 25 }, dur: 600, color: '#ff7043', effects: { digSpeed: { mult: 2 }, digStrength: { mult: 1.5 } }, desc: '2× Dig Speed, 1.5× Dig Strength' },
  { id: 'midasTotem',    name: 'Midas Totem',      cost: { shards: 30 }, dur: 600, color: '#ffd600', effects: { sellBoost: { mult: 1.5 } }, desc: '1.5× Sell value' },
  { id: 'mutationTotem', name: 'Mutation Totem',   cost: { shards: 35 }, dur: 600, color: '#d500f9', effects: { modBoost: { mult: 2 } }, desc: '2× Modifier chance' },
  { id: 'giantTotem',    name: 'Giant Totem',      cost: { shards: 35 }, dur: 600, color: '#26c6da', effects: { sizeBoost: { mult: 1.5 } }, desc: '1.5× Size' },
  { id: 'friendTotem',   name: 'Friendship Totem', cost: { shards: 30 }, dur: 600, color: '#ff80ab', effects: {}, friendship: true, desc: '1.2× Luck +0.15× per player here (max 3×)' },
];

// Tokens & special consumables (mostly from the Travelling Merchant)
export const TOKENS = [
  { id: 'meteorFragment', name: 'Meteor Fragment', color: '#ff80ab', desc: 'Summon a Meteor Shower for everyone (8 min)', event: 'meteor', dur: 480 },
  { id: 'rapidsToken',    name: 'Rapids Token',    color: '#4fc3f7', desc: 'Start River Rapids (6 min)', event: 'rapids', dur: 360 },
  { id: 'solarToken',     name: 'Solar Token',     color: '#ffb300', desc: 'Trigger a Solar Flare (6 min)', event: 'solar', dur: 360 },
  { id: 'riftToken',      name: 'Rift Token',      color: '#ff4f8b', desc: 'Tear open a Mythic Rift at your shore (5 min)', event: 'rift', dur: 300 },
  { id: 'enchantScroll',  name: 'Enchant Scroll',  color: '#b388ff', desc: 'Use at the Enchanting Altar instead of Aurorite' },
  { id: 'reforgeToken',   name: 'Perfect Reforge Token', color: '#ffd54f', desc: 'Reforge equipment with perfect stats' },
  { id: 'luckyClover',    name: 'Lucky Clover',    color: '#69f0ae', desc: '+100% Luck for 15 min', potion: { effects: { luck: { pct: 1 } }, dur: 900 } },
];

// Outfitter — bought once, permanent protection against a shore hazard
export const OUTFITS = [
  { id: 'gasmask',       name: 'Gas Mask',       price: 40000,  hazard: 'toxic',     color: '#7c8f5a' },
  { id: 'sunhat',        name: 'Sun Hat',        price: 6e5,    hazard: 'heat',      color: '#f4c27a' },
  { id: 'thermalgloves', name: 'Thermal Gloves', price: 2.5e6,  hazard: 'frostbite', color: '#ff7a7a' },
  { id: 'heatsuit',      name: 'Heat Suit',      price: 1.2e7,  hazard: 'scorched',  color: '#ff9800' },
  { id: 'bugspray',      name: 'Bug Spray',      price: 1.5e8,  hazard: 'bugs',      color: '#9ccc65' },
  { id: 'radsuit',       name: 'Rad Suit',       price: 6e8,    hazard: 'radiation', color: '#ffeb3b' },
  { id: 'voidlantern',   name: 'Void Lantern',   price: 3e9,    hazard: 'voidsick',  color: '#b388ff' },
  { id: 'visor',         name: 'Shaded Visor',   price: 2e10,   hazard: 'glare',     color: '#90caf9' },
];

// Pan enchantments. Rolled at the Enchanting Altar with Aurorite or an
// Enchant Scroll, or applied directly from an Enchant Book.
export const ENCHANTS = [
  { id: 'swift',       name: 'Swift',       weight: 22,  tier: 'common',    effects: { shakeSpeed: { pct: 0.2 } }, desc: '+20% Shake Speed' },
  { id: 'lucky',       name: 'Lucky',       weight: 18,  tier: 'common',    effects: { luck: { pct: 0.15 } }, desc: '+15% Luck' },
  { id: 'strong',      name: 'Strong',      weight: 16,  tier: 'common',    effects: { shakeStrength: { pct: 0.25 } }, desc: '+25% Shake Strength' },
  { id: 'greedy',      name: 'Greedy',      weight: 10,  tier: 'uncommon',  effects: { sellBoost: { add: 0.12 } }, desc: '+12% Sell value' },
  { id: 'gigantic',    name: 'Gigantic',    weight: 8,   tier: 'uncommon',  effects: { sizeBoost: { add: 0.2 } }, desc: '+20% Size' },
  { id: 'glowing',     name: 'Glowing',     weight: 8,   tier: 'uncommon',  effects: { modBoost: { add: 0.25 } }, desc: '+25% Modifier chance' },
  { id: 'boosting',    name: 'Boosting',    weight: 6,   tier: 'rare',      effects: { luck: { pct: 0.1 }, capacity: { pct: 0.1 }, shakeStrength: { pct: 0.1 }, shakeSpeed: { pct: 0.1 } }, desc: '+10% Luck, Capacity, Shake' },
  { id: 'destructive', name: 'Destructive', weight: 4,   tier: 'rare',      effects: { shakeStrength: { pct: 0.6 }, luck: { pct: -0.1 } }, desc: '+60% Shake Strength, -10% Luck' },
  { id: 'blessed',     name: 'Blessed',     weight: 3,   tier: 'rare',      effects: { luck: { pct: 0.35 } }, desc: '+35% Luck' },
  { id: 'midas',       name: 'Midas',       weight: 2,   tier: 'epic',      effects: { sellBoost: { add: 0.3 }, luck: { pct: 0.1 } }, desc: '+30% Sell value, +10% Luck' },
  { id: 'infernal',    name: 'Infernal',    weight: 1.5, tier: 'epic',      effects: { shakeStrength: { pct: 0.4 }, sizeBoost: { add: 0.25 } }, desc: '+40% Shake Strength, +25% Size' },
  { id: 'cosmic',      name: 'Cosmic',      weight: 0.8, tier: 'legendary', effects: { modBoost: { add: 0.5 }, luck: { pct: 0.25 } }, desc: '+50% Modifier chance, +25% Luck' },
  { id: 'divine',      name: 'Divine',      weight: 0.5, tier: 'legendary', effects: { luck: { pct: 0.6 }, capacity: { pct: 0.2 } }, desc: '+60% Luck, +20% Capacity' },
  { id: 'prismatic',   name: 'Prismatic',   weight: 0.2, tier: 'mythic',    effects: { luck: { pct: 0.3 }, capacity: { pct: 0.3 }, shakeStrength: { pct: 0.3 }, shakeSpeed: { pct: 0.3 }, sizeBoost: { add: 0.1 }, modBoost: { add: 0.1 } }, desc: '+30% to all pan stats, +10% Size & Modifiers' },
];
export const ENCHANT = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));

// Equipment recipes. Stats roll uniformly in [min, max]; the roll quality
// becomes a grade (C → S). Flat stats for luck/capacity/strength,
// fractions for percentage stats.
export const RECIPES = [
  { id: 'copperband',   name: 'Copper Band',        slot: 'ring',  cost: 1000,   needs: { copper: 6 }, stats: { digStrength: [0.3, 1] } },
  { id: 'goldring',     name: 'Gold Ring',          slot: 'ring',  cost: 2500,   needs: { gold: 5 }, stats: { luck: [0.5, 1.5] } },
  { id: 'silverchain',  name: 'Silver Chain',       slot: 'neck',  cost: 4000,   needs: { silver: 6, quartz: 2 }, stats: { shakeSpeed: [0.03, 0.08] } },
  { id: 'gardenglove',  name: 'Garden Glove',       slot: 'charm', cost: 8000,   needs: { pyrite: 5, copper: 3 }, stats: { digStrength: [0.5, 1.5], capacity: [1, 4] } },
  { id: 'amethystpend', name: 'Amethyst Pendant',   slot: 'neck',  cost: 15000,  needs: { amethyst: 3, silver: 4 }, stats: { luck: [1, 3], sellBoost: [0.02, 0.08] } },
  { id: 'titaniumring', name: 'Titanium Ring',      slot: 'ring',  cost: 40000,  needs: { titanium: 5 }, stats: { capacity: [3, 10] } },
  { id: 'rubyring',     name: 'Ruby Ring',          slot: 'ring',  cost: 90000,  needs: { ruby: 2, platinum: 5 }, stats: { luck: [2, 5], sizeBoost: [0.03, 0.1] } },
  { id: 'pearlneck',    name: 'Pearl Necklace',     slot: 'neck',  cost: 150000, needs: { pearl: 4, seashell: 6 }, stats: { sellBoost: [0.05, 0.15], capacity: [2, 8] } },
  { id: 'horseshoe',    name: 'Lucky Horseshoe',    slot: 'charm', cost: 250000, needs: { emerald: 1, hematite: 6 }, stats: { luck: [3, 8] } },
  { id: 'sapphirering', name: 'Sapphire Ring',      slot: 'ring',  cost: 6e5,    needs: { sapphire: 2, azuralite: 3 }, stats: { shakeStrength: [0.3, 1], modBoost: [0.03, 0.08] } },
  { id: 'moonring',     name: 'Moon Ring',          slot: 'ring',  cost: 1.5e6,  needs: { moonstone: 2, iridium: 2 }, stats: { digSpeed: [0.05, 0.12], luck: [3, 8], shakeSpeed: [0.03, 0.08] } },
  { id: 'scarabcharm',  name: 'Scarab Charm',       slot: 'charm', cost: 4e6,    needs: { scarabamber: 3, pharaohcoin: 1 }, stats: { sellBoost: [0.08, 0.2], luck: [4, 10] } },
  { id: 'frostpendant', name: 'Frost Pendant',      slot: 'neck',  cost: 1e7,    needs: { glacierite: 3, aquamarine: 2 }, stats: { shakeStrength: [0.5, 1.5], capacity: [5, 15] } },
  { id: 'dragonfang',   name: 'Dragon Fang Necklace', slot: 'neck', cost: 6e7,   needs: { dragonbone: 1, fireopal: 3 }, stats: { luck: [15, 30], sizeBoost: [0.1, 0.2] } },
  { id: 'fossilcharm',  name: 'Fossil Charm',       slot: 'charm', cost: 1.5e8,  needs: { ammonite: 6, megatooth: 2 }, stats: { modBoost: [0.1, 0.2], capacity: [10, 25] } },
  { id: 'jungleband',   name: 'Jungle Band',        slot: 'ring',  cost: 6e8,    needs: { lifestone: 2, templegold: 4 }, stats: { capacity: [20, 50], digStrength: [5, 10] } },
  { id: 'starring',     name: 'Star Ring',          slot: 'ring',  cost: 3e9,    needs: { starshine: 2, meteorite: 8 }, stats: { luck: [20, 45], modBoost: [0.05, 0.15] } },
  { id: 'voidring',     name: 'Void Ring',          slot: 'ring',  cost: 3e10,   needs: { voidheart: 1, riftglass: 4 }, stats: { luck: [60, 120], shakeSpeed: [0.05, 0.1], digSpeed: [0.05, 0.1] } },
  { id: 'halo',         name: 'Seraph Halo',        slot: 'neck',  cost: 5e11,   needs: { seraphite: 1, angelite: 4 }, stats: { luck: [150, 300], sellBoost: [0.1, 0.25] } },
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const POTION = Object.fromEntries(POTIONS.map((p) => [p.id, p]));
export const TOTEM = Object.fromEntries(TOTEMS.map((p) => [p.id, p]));
export const TOKEN = Object.fromEntries(TOKENS.map((p) => [p.id, p]));
export const OUTFIT = Object.fromEntries(OUTFITS.map((p) => [p.id, p]));

// Anything that can sit in the consumables bag
export function consumableDef(id) {
  return POTION[id] || TOTEM[id] || TOKEN[id] || (id.startsWith('book:') ? bookDef(id) : null);
}
export function bookDef(id) {
  const e = ENCHANT[id.slice(5)];
  return e ? { id, name: `${e.name} Enchant Book`, color: '#b388ff', desc: `Apply ${e.name} to your pan: ${e.desc}`, book: e.id } : null;
}

// Stat display metadata (icons are names from ui/icons.js)
export const STAT_META = {
  luck:          { name: 'Luck',           icon: 'clover', color: '#3ddc84' },
  capacity:      { name: 'Capacity',       icon: 'pan',    color: '#ffb74d' },
  shakeStrength: { name: 'Shake Strength', icon: 'wave',   color: '#4fc3f7' },
  shakeSpeed:    { name: 'Shake Speed',    icon: 'bolt',   color: '#ffe14d' },
  digStrength:   { name: 'Dig Strength',   icon: 'shovel', color: '#d7a26b' },
  digSpeed:      { name: 'Dig Speed',      icon: 'speed',  color: '#ff8a65' },
  sizeBoost:     { name: 'Size Boost',     icon: 'expand', color: '#26c6da', mult: true },
  modBoost:      { name: 'Modifier Boost', icon: 'sparkle',color: '#d58bff', mult: true },
  sellBoost:     { name: 'Sell Boost',     icon: 'coin',   color: '#ffd54f', mult: true },
  items:         { name: 'Items per Pan',  icon: 'gem',    color: '#90caf9', mult: true },
  walkSpeed:     { name: 'Walk Speed',     icon: 'boot',   color: '#bcaaa4' },
  toughness:     { name: 'Toughness',      icon: 'shield', color: '#b0bec5' },
};
