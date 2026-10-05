// Quests, achievements, daily rewards and codes.
//
// Goal types (see game.track):
//   dig, perfect, pan, sell, earn, museum, craft, enchant, potion, totem,
//   sluice, chat, streak            → counters (n)
//   find {m}, findTier {tier}, findMod {mod?}, findKg {kg, m?}, findAt {shore, tier}
//   own {id} (pan/shovel/outfit), travel {shore}, level {n} → state checks
//
// Rewards: { cash, shards, items: { consumableId: count }, xp }

export const NPCS = [
  {
    id: 'pete', name: 'Old Pete', shore: 'rubble', color: '#c98b4a', hat: 'cowboy',
    quests: [
      { id: 'pete1', title: 'First Dig', text: 'Hold DIG and release in the gold zone. Dig 5 times.', goal: { type: 'dig', n: 5 }, reward: { cash: 50 } },
      { id: 'pete2', title: 'Swish Swish', text: 'Your pan is full! Hold PAN to shake it in the water.', goal: { type: 'pan', n: 1 }, reward: { cash: 50 } },
      { id: 'pete3', title: 'Cash In', text: 'Open your Bag and sell 3 minerals.', goal: { type: 'sell', n: 3 }, reward: { cash: 100 } },
      { id: 'pete4', title: 'An Upgrade', text: 'Buy the Plastic Pan from the Shop.', goal: { type: 'own', id: 'pan:plastic' }, reward: { shards: 5 } },
      { id: 'pete5', title: 'Perfectionist', text: 'Release DIG in the gold zone for 5 Perfect digs.', goal: { type: 'perfect', n: 5 }, reward: { cash: 200, items: { luck1: 1 } } },
      { id: 'pete6', title: 'Gold Fever', text: 'Find 3 Gold.', goal: { type: 'find', m: 'gold', n: 3 }, reward: { cash: 300 } },
      { id: 'pete7', title: 'Sturdy Tools', text: 'Buy the Iron Shovel.', goal: { type: 'own', id: 'shovel:iron' }, reward: { cash: 500 } },
      { id: 'pete8', title: 'Onward!', text: 'Unlock and travel to Fortune River on the Map.', goal: { type: 'travel', shore: 'fortune' }, reward: { shards: 10 } },
    ],
  },
  {
    id: 'goldie', name: 'Mayor Goldie', shore: 'fortune', color: '#ffd447', hat: 'tophat',
    quests: [
      { id: 'goldie1', title: 'Town Business', text: 'Earn $10K from selling minerals.', goal: { type: 'earn', n: 10000 }, reward: { cash: 2000 } },
      { id: 'goldie2', title: 'Platinum Standard', text: 'Find 5 Platinum.', goal: { type: 'find', m: 'platinum', n: 5 }, reward: { items: { cap1: 1 } } },
      { id: 'goldie3', title: 'Something Shiny', text: 'Find 3 minerals with a modifier.', goal: { type: 'findMod', n: 3 }, reward: { shards: 10 } },
      { id: 'goldie4', title: 'Rare Taste', text: 'Find 3 Rare (or better) minerals.', goal: { type: 'findTier', tier: 'rare', n: 3 }, reward: { cash: 8000 } },
      { id: 'goldie5', title: 'Metal Head', text: 'Buy the Metal Pan.', goal: { type: 'own', id: 'pan:metal' }, reward: { shards: 15 } },
      { id: 'goldie6', title: "Curator's Request", text: 'Display a mineral in the Museum (unlocks at Lv 5).', goal: { type: 'museum', n: 1 }, reward: { cash: 10000 } },
      { id: 'goldie7', title: 'Heavy Hitter', text: 'Find any mineral weighing 0.5kg or more.', goal: { type: 'findKg', kg: 0.5, n: 1 }, reward: { items: { luck1: 2 } } },
    ],
  },
  {
    id: 'shelly', name: 'Captain Shelly', shore: 'sunset', color: '#4fc3f7', hat: 'captain',
    quests: [
      { id: 'shelly1', title: 'Beachcomber', text: 'Find 10 Seashells.', goal: { type: 'find', m: 'seashell', n: 10 }, reward: { cash: 15000 } },
      { id: 'shelly2', title: 'Pearl Diver', text: 'Find a Pearl.', goal: { type: 'find', m: 'pearl', n: 1 }, reward: { shards: 15 } },
      { id: 'shelly3', title: 'Tidal Fortune', text: 'Earn $100K from selling.', goal: { type: 'earn', n: 100000 }, reward: { cash: 25000 } },
      { id: 'shelly4', title: 'Golden Glow', text: 'Find a Golden Pearl.', goal: { type: 'find', m: 'goldenpearl', n: 1 }, reward: { items: { luck2: 1 } } },
    ],
  },
  {
    id: 'morga', name: 'Swamp Witch Morga', shore: 'swamp', color: '#7cb342', hat: 'witch',
    quests: [
      { id: 'morga1', title: 'Breathe Easy', text: 'Buy a Gas Mask from the Outfitter.', goal: { type: 'own', id: 'outfit:gasmask' }, reward: { cash: 20000 } },
      { id: 'morga2', title: 'Bog Business', text: 'Find 10 Bog Iron.', goal: { type: 'find', m: 'bogiron', n: 10 }, reward: { items: { haste: 1 } } },
      { id: 'morga3', title: 'Lights in the Mist', text: "Find a Will-o'-Wisp (more common at night).", goal: { type: 'find', m: 'wisp', n: 1 }, reward: { shards: 20 } },
      { id: 'morga4', title: 'Mutant', text: 'Find an Irradiated mineral.', goal: { type: 'findMod', mod: 'irradiated', n: 1 }, reward: { items: { mutation: 1 } } },
    ],
  },
  {
    id: 'quartz', name: 'Dr. Quartz', shore: 'caverns', color: '#7c4dff', hat: 'hardhat',
    quests: [
      { id: 'quartz1', title: "Enchanter's Stone", text: 'Find an Aurorite.', goal: { type: 'find', m: 'aurorite', n: 1 }, reward: { shards: 25 } },
      { id: 'quartz2', title: 'Spellbound', text: 'Enchant your pan at the Enchanting Altar.', goal: { type: 'enchant', n: 1 }, reward: { cash: 500000 } },
      { id: 'quartz3', title: 'Deep Blue', text: 'Find 3 Sapphires.', goal: { type: 'find', m: 'sapphire', n: 3 }, reward: { items: { cap2: 1 } } },
      { id: 'quartz4', title: 'Crafty', text: 'Craft 2 pieces of equipment.', goal: { type: 'craft', n: 2 }, reward: { shards: 20 } },
    ],
  },
  {
    id: 'rashid', name: 'Nomad Rashid', shore: 'desert', color: '#ffb74d', hat: 'turban',
    quests: [
      { id: 'rashid1', title: 'Shade', text: 'Buy a Sun Hat from the Outfitter.', goal: { type: 'own', id: 'outfit:sunhat' }, reward: { cash: 500000 } },
      { id: 'rashid2', title: "Pharaoh's Ransom", text: "Find a Pharaoh's Coin.", goal: { type: 'find', m: 'pharaohcoin', n: 1 }, reward: { items: { midas: 1 } } },
      { id: 'rashid3', title: 'Desert Riches', text: 'Earn $5M from selling.', goal: { type: 'earn', n: 5e6 }, reward: { shards: 30 } },
    ],
  },
  {
    id: 'ranger', name: 'Ranger Frost', shore: 'frost', color: '#90caf9', hat: 'beanie',
    quests: [
      { id: 'ranger1', title: 'Warm Hands', text: 'Buy Thermal Gloves from the Outfitter.', goal: { type: 'own', id: 'outfit:thermalgloves' }, reward: { cash: 2e6 } },
      { id: 'ranger2', title: 'Mythril Rush', text: 'Find 3 Mythril.', goal: { type: 'find', m: 'mythril', n: 3 }, reward: { shards: 30 } },
      { id: 'ranger3', title: 'Frozen in Time', text: 'Find a Cryonic Artifact.', goal: { type: 'find', m: 'cryonic', n: 1 }, reward: { items: { luckTotem: 1 } } },
    ],
  },
  {
    id: 'vera', name: 'Vulcan Vera', shore: 'caldera', color: '#ff7043', hat: 'hardhat',
    quests: [
      { id: 'vera1', title: 'Fireproof', text: 'Buy a Heat Suit (or own the Dragonflame Pan).', goal: { type: 'own', id: 'outfit:heatsuit' }, reward: { cash: 1e7 } },
      { id: 'vera2', title: 'Here Be Dragons', text: 'Find a Dragon Bone.', goal: { type: 'find', m: 'dragonbone', n: 1 }, reward: { shards: 40 } },
      { id: 'vera3', title: 'Molten Heart', text: 'Find a Legendary (or better) at Caldera Shore.', goal: { type: 'findAt', shore: 'caldera', tier: 'legendary', n: 1 }, reward: { items: { luck3: 1 } } },
    ],
  },
  {
    id: 'bones', name: 'Professor Bones', shore: 'fossil', color: '#d7ccc8', hat: 'safari',
    quests: [
      { id: 'bones1', title: 'Dig Site', text: 'Find 10 Ammonites.', goal: { type: 'find', m: 'ammonite', n: 10 }, reward: { cash: 5e7 } },
      { id: 'bones2', title: 'Ancient History', text: 'Find an Ancient mineral.', goal: { type: 'findMod', mod: 'ancient', n: 1 }, reward: { items: { giant: 1 } } },
      { id: 'bones3', title: 'Jaws', text: 'Find a Megalodon Tooth.', goal: { type: 'find', m: 'megatooth', n: 1 }, reward: { shards: 50 } },
    ],
  },
  {
    id: 'ivy', name: 'Explorer Ivy', shore: 'grotto', color: '#66bb6a', hat: 'safari',
    quests: [
      { id: 'ivy1', title: 'No Bites', text: 'Buy Bug Spray from the Outfitter.', goal: { type: 'own', id: 'outfit:bugspray' }, reward: { cash: 1.5e8 } },
      { id: 'ivy2', title: 'Idol Worship', text: 'Find a Golden Idol.', goal: { type: 'find', m: 'goldenidol', n: 1 }, reward: { shards: 60 } },
    ],
  },
  {
    id: 'orion', name: 'Astronomer Orion', shore: 'meteor', color: '#b388ff', hat: 'wizard',
    quests: [
      { id: 'orion1', title: 'Stargazer', text: 'Find 5 Starshine.', goal: { type: 'find', m: 'starshine', n: 5 }, reward: { items: { meteorFragment: 1 } } },
      { id: 'orion2', title: 'Close Encounter', text: 'Find a Starforged mineral.', goal: { type: 'findMod', mod: 'starforged', n: 1 }, reward: { shards: 75 } },
    ],
  },
  {
    id: 'watcher', name: 'The Watcher', shore: 'void', color: '#7b2cbf', hat: 'hood',
    quests: [
      { id: 'watcher1', title: 'Into the Dark', text: 'Buy a Void Lantern from the Outfitter.', goal: { type: 'own', id: 'outfit:voidlantern' }, reward: { cash: 5e9 } },
      { id: 'watcher2', title: 'Heart of Darkness', text: 'Find a Voidheart.', goal: { type: 'find', m: 'voidheart', n: 1 }, reward: { shards: 100 } },
    ],
  },
  {
    id: 'aurelia', name: 'Seraph Aurelia', shore: 'celestial', color: '#fff59d', hat: 'halo',
    quests: [
      { id: 'aurelia1', title: 'Ascension', text: 'Find 10 Cloudstone.', goal: { type: 'find', m: 'cloudstone', n: 10 }, reward: { cash: 5e10 } },
      { id: 'aurelia2', title: 'Divine Light', text: 'Find a Mythic (or better) at Celestial Shore.', goal: { type: 'findAt', shore: 'celestial', tier: 'mythic', n: 1 }, reward: { shards: 200 } },
    ],
  },
];

export const NPC = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const QUEST = {};
for (const npc of NPCS) for (const q of npc.quests) QUEST[q.id] = { ...q, npc: npc.id };

// Daily quest templates; `scale` lets cash goals follow your progress.
export const DAILY_TEMPLATES = [
  { id: 'd_pan', title: 'Pan Marathon', goal: (r) => ({ type: 'pan', n: 25 + Math.floor(r() * 4) * 10 }) },
  { id: 'd_perfect', title: 'Precision Work', goal: (r) => ({ type: 'perfect', n: 20 + Math.floor(r() * 4) * 10 }) },
  { id: 'd_rare', title: 'Rare Hunt', goal: (r) => ({ type: 'findTier', tier: 'rare', n: 5 + Math.floor(r() * 3) * 3 }) },
  { id: 'd_epic', title: 'Epic Hunt', goal: (r) => ({ type: 'findTier', tier: 'epic', n: 2 + Math.floor(r() * 3) }) },
  { id: 'd_mod', title: 'Mutation Station', goal: (r) => ({ type: 'findMod', n: 4 + Math.floor(r() * 4) }) },
  { id: 'd_earn', title: 'Payday', goal: (r, scale) => ({ type: 'earn', n: Math.max(5000, Math.round(scale * (0.5 + r() * 0.5))) }) },
  { id: 'd_sell', title: 'Clear the Bag', goal: (r) => ({ type: 'sell', n: 50 + Math.floor(r() * 4) * 25 }) },
  { id: 'd_streak', title: 'Hot Streak', goal: (r) => ({ type: 'streak', n: 8 + Math.floor(r() * 3) * 3 }) },
  { id: 'd_dig', title: 'Groundbreaker', goal: (r) => ({ type: 'dig', n: 100 + Math.floor(r() * 4) * 50 }) },
];

export const ACHIEVEMENTS = [
  { id: 'a_pan10', title: 'Panhandler', text: 'Pan 10 times', stat: 'pans', n: 10, shards: 5 },
  { id: 'a_pan100', title: 'Sediment Sifter', text: 'Pan 100 times', stat: 'pans', n: 100, shards: 10 },
  { id: 'a_pan1000', title: 'River Regular', text: 'Pan 1,000 times', stat: 'pans', n: 1000, shards: 25 },
  { id: 'a_pan5000', title: 'Pan Master', text: 'Pan 5,000 times', stat: 'pans', n: 5000, shards: 60 },
  { id: 'a_pan20000', title: 'Legendary Panner', text: 'Pan 20,000 times', stat: 'pans', n: 20000, shards: 150 },
  { id: 'a_perf50', title: 'Steady Hands', text: '50 Perfect digs', stat: 'perfectDigs', n: 50, shards: 5 },
  { id: 'a_perf500', title: 'Precision Digger', text: '500 Perfect digs', stat: 'perfectDigs', n: 500, shards: 20 },
  { id: 'a_perf5000', title: 'Surgeon', text: '5,000 Perfect digs', stat: 'perfectDigs', n: 5000, shards: 60 },
  { id: 'a_streak10', title: 'On Fire', text: 'Perfect streak of 10', stat: 'bestStreak', n: 10, shards: 10 },
  { id: 'a_streak25', title: 'Unstoppable', text: 'Perfect streak of 25', stat: 'bestStreak', n: 25, shards: 25 },
  { id: 'a_streak50', title: 'Machine', text: 'Perfect streak of 50', stat: 'bestStreak', n: 50, shards: 50 },
  { id: 'a_rare', title: 'Rare Find', text: 'Find a Rare mineral', stat: 'tier_rare', n: 1, shards: 5 },
  { id: 'a_epic', title: 'Epic Haul', text: 'Find an Epic mineral', stat: 'tier_epic', n: 1, shards: 10 },
  { id: 'a_leg', title: 'Legend', text: 'Find a Legendary mineral', stat: 'tier_legendary', n: 1, shards: 25 },
  { id: 'a_myth', title: 'Mythic Hunter', text: 'Find a Mythic mineral', stat: 'tier_mythic', n: 1, shards: 60 },
  { id: 'a_exo', title: 'Exotic Collector', text: 'Find an Exotic mineral', stat: 'tier_exotic', n: 1, shards: 150 },
  { id: 'a_cel', title: 'Touched by the Heavens', text: 'Find a Celestial mineral', stat: 'tier_celestial', n: 1, shards: 500 },
  { id: 'a_mod', title: 'Mutant Finder', text: 'Find a modified mineral', stat: 'modsFound', n: 1, shards: 5 },
  { id: 'a_mod100', title: 'Mutation Expert', text: 'Find 100 modified minerals', stat: 'modsFound', n: 100, shards: 25 },
  { id: 'a_voidtorn', title: 'Voidtouched', text: 'Find a Voidtorn mineral', stat: 'mod_voidtorn', n: 1, shards: 50 },
  { id: 'a_prismatic', title: 'Prismatic!', text: 'Find a Prismatic mineral', stat: 'mod_prismatic', n: 1, shards: 200 },
  { id: 'a_huge', title: 'Big One', text: 'Find a HUGE mineral', stat: 'huge', n: 1, shards: 10 },
  { id: 'a_colossal', title: 'Colossal!', text: 'Find a COLOSSAL mineral', stat: 'colossal', n: 1, shards: 40 },
  { id: 'a_cash4', title: 'Penny Pincher', text: 'Earn $10K total', stat: 'earned', n: 1e4, shards: 5 },
  { id: 'a_cash6', title: 'Millionaire', text: 'Earn $1M total', stat: 'earned', n: 1e6, shards: 15 },
  { id: 'a_cash8', title: 'Tycoon', text: 'Earn $100M total', stat: 'earned', n: 1e8, shards: 30 },
  { id: 'a_cash10', title: 'Mogul', text: 'Earn $10B total', stat: 'earned', n: 1e10, shards: 60 },
  { id: 'a_cash12', title: 'Trillionaire', text: 'Earn $1T total', stat: 'earned', n: 1e12, shards: 150 },
  { id: 'a_shore3', title: 'Explorer', text: 'Unlock 3 shores', stat: 'shores', n: 3, shards: 10 },
  { id: 'a_shore7', title: 'Voyager', text: 'Unlock 7 shores', stat: 'shores', n: 7, shards: 30 },
  { id: 'a_shore13', title: 'World Traveller', text: 'Unlock every shore', stat: 'shores', n: 13, shards: 100 },
  { id: 'a_idx25', title: 'Collector', text: 'Discover 25% of minerals', stat: 'indexPct', n: 25, shards: 15 },
  { id: 'a_idx50', title: 'Archivist', text: 'Discover 50% of minerals', stat: 'indexPct', n: 50, shards: 40 },
  { id: 'a_idx75', title: 'Scholar', text: 'Discover 75% of minerals', stat: 'indexPct', n: 75, shards: 80 },
  { id: 'a_idx100', title: 'Completionist', text: 'Discover every mineral', stat: 'indexPct', n: 100, shards: 300 },
  { id: 'a_mus3', title: 'Exhibitor', text: 'Display 3 minerals in the Museum', stat: 'museumCount', n: 3, shards: 10 },
  { id: 'a_mus12', title: 'Curator', text: 'Fill all 12 Museum pedestals', stat: 'museumCount', n: 12, shards: 75 },
  { id: 'a_rb1', title: 'Reborn', text: 'Rebirth once', stat: 'rebirths', n: 1, shards: 50 },
  { id: 'a_rb3', title: 'Ascendant', text: 'Rebirth 3 times', stat: 'rebirths', n: 3, shards: 100 },
  { id: 'a_rb5', title: 'Eternal Prospector', text: 'Rebirth 5 times', stat: 'rebirths', n: 5, shards: 200 },
  { id: 'a_craft', title: 'Artisan', text: 'Craft equipment', stat: 'crafts', n: 1, shards: 5 },
  { id: 'a_enchant', title: 'Enchanter', text: 'Enchant a pan', stat: 'enchants', n: 1, shards: 10 },
  { id: 'a_sluice', title: 'Automation', text: 'Collect from a sluice', stat: 'sluiceCollects', n: 1, shards: 5 },
  { id: 'a_totem', title: 'Totem Pole', text: 'Place a totem', stat: 'totems', n: 1, shards: 5 },
  { id: 'a_chat', title: 'Social Butterfly', text: 'Say hi in chat', stat: 'chats', n: 1, shards: 3 },
];

export const DAILY_LOGIN = [
  { shards: 5 },
  { items: { luck1: 2 } },
  { shards: 10 },
  { items: { cap2: 1, swift: 1 } },
  { shards: 15 },
  { items: { meteorFragment: 1 } },
  { shards: 30, items: { luckTotem: 1 } },
];

export const CODES = {
  PANNING: { shards: 20 },
  GOLDFEVER: { items: { luck1: 3 } },
  METEOR: { items: { meteorFragment: 1 } },
  RELEASE: { shards: 30, items: { luckTotem: 1 } },
  SHINY: { items: { mutation: 1 } },
  PROSPECTOR: { items: { luck2: 1, cap2: 1 } },
};
