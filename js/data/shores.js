// Shores (locations). Each has unlock requirements, an optional hazard
// (environmental debuff that gear can protect against), a mineral pool and
// a visual theme consumed by render/scene.js.

export const HAZARDS = {
  toxic:    { id: 'toxic',    name: 'Toxic Fumes',   icon: 'skull', desc: '-25% Shake Speed', effects: { shakeSpeed: { mult: 0.75 } }, counter: 'gasmask' },
  heat:     { id: 'heat',     name: 'Heatstroke',    icon: 'sun',   desc: '-25% Dig Speed', effects: { digSpeed: { mult: 0.75 } }, counter: 'sunhat' },
  frostbite:{ id: 'frostbite',name: 'Frostbite',     icon: 'snow',  desc: '-25% Shake Strength', effects: { shakeStrength: { mult: 0.75 } }, counter: 'thermalgloves' },
  scorched: { id: 'scorched', name: 'Scorched',      icon: 'flame', desc: '-20% Luck', effects: { luck: { mult: 0.8 } }, counter: 'heatsuit' },
  bugs:     { id: 'bugs',     name: 'Mosquito Swarm',icon: 'bug',   desc: '-20% Dig Strength', effects: { digStrength: { mult: 0.8 } }, counter: 'bugspray' },
  radiation:{ id: 'radiation',name: 'Radiation',     icon: 'rad',   desc: '-20% Capacity', effects: { capacity: { mult: 0.8 } }, counter: 'radsuit' },
  voidsick: { id: 'voidsick', name: 'Void Sickness', icon: 'eye',   desc: '-25% Luck, -15% Shake Speed', effects: { luck: { mult: 0.75 }, shakeSpeed: { mult: 0.85 } }, counter: 'voidlantern' },
  glare:    { id: 'glare',    name: 'Blinding Light',icon: 'sun',   desc: '-20% Shake Speed', effects: { shakeSpeed: { mult: 0.8 } }, counter: 'visor' },
};

export const SHORES = [
  {
    id: 'rubble', name: 'Rubble Creek', blurb: 'A gentle meadow creek where every prospector starts out.',
    req: { toughness: 1, cost: 0, level: 1 }, richness: 1, sizeScale: 1, tags: ['river'],
    pool: {
      common: ['pyrite', 'copper', 'silver', ['gold', 0.7], 'quartz'],
      uncommon: ['amethyst', ['garnet', 0.8]],
      rare: ['topaz', 'jade'],
      epic: ['emerald'],
      legendary: ['creekheart'],
      mythic: ['painite'],
    },
    theme: {
      sky: { day: ['#5fb6ff', '#bfe7ff'], dusk: ['#5b4b9a', '#ffb37a'], night: ['#0b1433', '#28325e'] },
      far: { color: '#7fa8c9', height: 0.16, rough: 0.5, snow: true },
      mid: { color: '#5fae5a', type: 'hills' },
      ground: { top: '#6cc24a', body: '#9a6b3f', dark: '#6e4a2a' },
      water: { a: '#4fc3f7', b: '#1976d2', foam: '#e3f6ff', type: 'river' },
      flora: 'pine', props: ['mill'], particles: 'leaves', deposit: '#8a5a33',
    },
  },
  {
    id: 'fortune', name: 'Fortune River', blurb: 'The bustling river town. Bigger nuggets, bigger dreams.',
    req: { toughness: 1, cost: 2500, level: 3 }, richness: 1.05, sizeScale: 1.05, tags: ['river'],
    pool: {
      common: ['platinum', 'agate', 'hematite', ['riverpearl', 0.6], ['gold', 1.2]],
      uncommon: ['titanium', 'smokyquartz', ['amethyst', 0.5]],
      rare: ['ruby', 'lapis'],
      epic: ['fortunenugget', 'iridium'],
      legendary: ['diamond'],
      mythic: ['painite'],
    },
    theme: {
      sky: { day: ['#6ab8ff', '#d6efff'], dusk: ['#6a4c93', '#ff9f6b'], night: ['#0d1230', '#2e2a5a'] },
      far: { color: '#8b9fc0', height: 0.14, rough: 0.35 },
      mid: { color: '#78b26a', type: 'hills' },
      ground: { top: '#7cc957', body: '#a4774a', dark: '#71502f' },
      water: { a: '#5ac8e8', b: '#1565c0', foam: '#e6f9ff', type: 'river' },
      flora: 'oak', props: ['town'], particles: 'leaves', deposit: '#94653a',
    },
  },
  {
    id: 'sunset', name: 'Sunset Beach', blurb: 'Golden sands and tidepools full of ocean treasures.',
    req: { toughness: 2, cost: 20000, level: 6 }, richness: 1.1, sizeScale: 1, tags: ['sea'],
    pool: {
      common: ['seashell', 'sanddollar', 'coral', 'seaglass'],
      uncommon: ['pearl', 'conch'],
      rare: ['silverclam', 'abalone'],
      epic: ['goldenpearl', 'mermaidscale'],
      legendary: ['oceanheart'],
      mythic: ['krakeneye', ['painite', 0.5]],
    },
    theme: {
      sky: { day: ['#ff9a6b', '#ffe3a3'], dusk: ['#5e3b8c', '#ff7b5c'], night: ['#140f33', '#3b2350'] },
      sunLow: true,
      far: { color: '#c77d8f', height: 0.07, rough: 0.2, islands: true },
      mid: { color: '#e8c27a', type: 'dunes' },
      ground: { top: '#f4d58d', body: '#e3b866', dark: '#c08f45' },
      water: { a: '#3fc1c9', b: '#1b4f8c', foam: '#fff4e0', type: 'sea' },
      flora: 'palm', props: ['boat'], particles: 'motes', deposit: '#d9a85a',
    },
  },
  {
    id: 'swamp', name: 'Rotwood Swamp', blurb: 'Murky bayous hiding strange, glowing stones. Bring a mask.',
    req: { toughness: 2, cost: 75000, level: 9 }, richness: 1.1, sizeScale: 1.1, tags: ['swamp'], hazard: 'toxic',
    pool: {
      common: ['bogiron', 'malachite', 'sulfur', 'peridot'],
      uncommon: ['toadstone', 'witchglass'],
      rare: ['bloodstone', 'wisp'],
      epic: ['swampjade', 'moonstone'],
      legendary: ['rotamber'],
      mythic: ['plaguebloom'],
    },
    theme: {
      sky: { day: ['#8fa88a', '#d5dcb6'], dusk: ['#4c4a6e', '#c49a6c'], night: ['#0c1410', '#24301f'] },
      far: { color: '#5f7563', height: 0.1, rough: 0.3 },
      mid: { color: '#4d6b3f', type: 'hills' },
      ground: { top: '#5b7a32', body: '#5a4630', dark: '#3a2c1d' },
      water: { a: '#6b8f4e', b: '#2f4a2a', foam: '#c8d9a5', type: 'swamp' },
      flora: 'deadtree', props: ['shack'], particles: 'spores', fog: '#c9d6b8', deposit: '#5f4a2e',
    },
  },
  {
    id: 'caverns', name: 'Crystal Caverns', blurb: 'An underground lake lit by giant crystals. Home of Aurorite.',
    req: { toughness: 3, cost: 300000, level: 15 }, richness: 1.15, sizeScale: 1.1, tags: ['cave'],
    pool: {
      common: ['azurite', 'fluorite', 'calcite', 'celestite'],
      uncommon: ['azuralite', 'sapphire'],
      rare: ['geode', 'opal'],
      epic: [['aurorite', 1.6], 'starsapphire'],
      legendary: ['luminite'],
      mythic: ['prismara'],
    },
    theme: {
      cave: true,
      sky: { day: ['#120f2e', '#2a2f6b'], dusk: ['#120f2e', '#2a2f6b'], night: ['#0a0820', '#1d2150'] },
      far: { color: '#2b2f66', height: 0.2, rough: 0.6 },
      mid: { color: '#3a3f86', type: 'crystals' },
      ground: { top: '#5a5fa8', body: '#3b3d72', dark: '#25264d' },
      water: { a: '#3ee6ff', b: '#1b2a8c', foam: '#c9fbff', type: 'lake', glow: true },
      flora: 'crystal', props: [], particles: 'motes', deposit: '#4a4c8a',
    },
  },
  {
    id: 'desert', name: 'Sunscorched Desert', blurb: 'A lonely oasis among the dunes. Pharaohs lost their gold here.',
    req: { toughness: 3, cost: 1.2e6, level: 18 }, richness: 1.15, sizeScale: 1.15, tags: ['desert'], hazard: 'heat',
    pool: {
      common: ['desertrose', 'carnelian', 'turquoise', 'sunstone'],
      uncommon: ['scarabamber', 'tigerseye'],
      rare: ['pharaohcoin', 'imperialtopaz'],
      epic: ['desertglass', 'sphinxeye'],
      legendary: ['ratear'],
      mythic: ['miragediamond'],
    },
    theme: {
      sky: { day: ['#4aa3ff', '#ffe8b8'], dusk: ['#7a3e7a', '#ff9a4d'], night: ['#0e1030', '#3a2a4a'] },
      far: { color: '#d99a6c', height: 0.12, rough: 0.1, mesa: true },
      mid: { color: '#e7b874', type: 'dunes' },
      ground: { top: '#f1c983', body: '#d9a45b', dark: '#b07a39' },
      water: { a: '#38d6c9', b: '#0f6f86', foam: '#e9fffb', type: 'lake' },
      flora: 'cactus', props: ['pyramid'], particles: 'sand', deposit: '#c98f48',
    },
  },
  {
    id: 'frost', name: 'Frostbite River', blurb: 'An icy mountain river. Gloves strongly recommended.',
    req: { toughness: 4, cost: 5e6, level: 22 }, richness: 1.2, sizeScale: 1.2, tags: ['river', 'snow'], hazard: 'frostbite',
    pool: {
      common: ['blueice', 'snowobsidian', 'frostquartz', 'silverfrost'],
      uncommon: ['aquamarine', 'glacierite'],
      rare: ['mythril', 'polarpearl'],
      epic: ['cryonic', 'yetifang'],
      legendary: ['frostheart'],
      mythic: ['borealite'],
    },
    theme: {
      sky: { day: ['#8ec5ff', '#eaf6ff'], dusk: ['#5a5b9e', '#ffb3c1'], night: ['#071226', '#1c2c52'] },
      far: { color: '#c9dcf2', height: 0.22, rough: 0.7, snow: true },
      mid: { color: '#e9f3fb', type: 'hills' },
      ground: { top: '#f4f9ff', body: '#9fb3c8', dark: '#6d8197' },
      water: { a: '#7fd8ff', b: '#2a6fb0', foam: '#ffffff', type: 'river', ice: true },
      flora: 'snowpine', props: ['cabin'], particles: 'snow', deposit: '#8fa2b8',
    },
  },
  {
    id: 'caldera', name: 'Caldera Shore', blurb: 'Hot springs beneath a rumbling volcano. Dragons once nested here.',
    req: { toughness: 4, cost: 2e7, level: 26 }, richness: 1.2, sizeScale: 1.25, tags: ['volcanic'], hazard: 'scorched',
    pool: {
      common: ['obsidian', 'basalt', 'pumice', 'magmaglass'],
      uncommon: ['cinnabar', 'fireagate'],
      rare: ['fireopal', 'volcanickey'],
      epic: ['dragonbone', 'phoenixfeather'],
      legendary: ['magmacore'],
      mythic: ['inferlume'],
      exotic: ['dragonegg'],
    },
    theme: {
      sky: { day: ['#a85a4a', '#ffb07a'], dusk: ['#4a1f3a', '#ff6a3d'], night: ['#140707', '#3d1410'] },
      far: { color: '#5a2f2f', height: 0.18, rough: 0.5, volcano: true },
      mid: { color: '#3d2a2a', type: 'rocks' },
      ground: { top: '#4a3a3a', body: '#2e2323', dark: '#1d1616' },
      water: { a: '#4fd1c5', b: '#1d6b70', foam: '#e8fffd', type: 'spring', steam: true },
      flora: 'lavarock', props: ['lava'], particles: 'ash', deposit: '#3b2b2b',
    },
  },
  {
    id: 'fossil', name: 'Fossil Bay', blurb: 'Chalk cliffs crumbling with prehistoric secrets, under the old lighthouse.',
    req: { toughness: 5, cost: 8e7, level: 30 }, richness: 1.25, sizeScale: 1.3, tags: ['sea'],
    pool: {
      common: ['amber', 'ammonite', 'petrifiedwood', 'sharktooth'],
      uncommon: ['trilobite', 'ancientcoin'],
      rare: ['megatooth', 'opalfossil'],
      epic: ['raptorclaw', 'seadragonscale'],
      legendary: ['titanbone'],
      mythic: ['primamber'],
      exotic: ['leviathanpearl'],
    },
    theme: {
      sky: { day: ['#7cc2ff', '#e8f4ff'], dusk: ['#525a9e', '#ffb38a'], night: ['#0a1430', '#253158'] },
      far: { color: '#e9e2cf', height: 0.2, rough: 0.15, cliffs: true },
      mid: { color: '#d8cfb6', type: 'cliffs' },
      ground: { top: '#e8dcc0', body: '#c9b48c', dark: '#9c875f' },
      water: { a: '#4fb8d8', b: '#174d7a', foam: '#ffffff', type: 'sea' },
      flora: 'grass', props: ['lighthouse'], particles: 'motes', deposit: '#b39b6e',
    },
  },
  {
    id: 'grotto', name: 'Overgrown Grotto', blurb: 'A jungle temple behind a roaring waterfall. Bring bug spray.',
    req: { toughness: 5, cost: 3e8, level: 34 }, richness: 1.3, sizeScale: 1.3, tags: ['river', 'jungle'], hazard: 'bugs',
    pool: {
      common: ['verdite', 'mossagate', 'junglejade', 'vinecrystal'],
      uncommon: ['templegold', 'chrysoberyl'],
      rare: ['serpenteye', 'lifestone'],
      epic: ['ancientemerald', 'goldenidol'],
      legendary: ['grottoheart'],
      mythic: ['worldseed'],
      exotic: ['edendiamond'],
    },
    theme: {
      sky: { day: ['#6fcf97', '#e6ffd9'], dusk: ['#3d5a4a', '#f2c46d'], night: ['#06140c', '#163322'] },
      far: { color: '#2f7a4f', height: 0.22, rough: 0.6 },
      mid: { color: '#2e8b57', type: 'jungle' },
      ground: { top: '#4caf50', body: '#5d4630', dark: '#3b2c1e' },
      water: { a: '#3fd0b0', b: '#0f5f5a', foam: '#e0fff6', type: 'river' },
      flora: 'jungle', props: ['temple', 'waterfall'], particles: 'fireflies', deposit: '#5a4128',
    },
  },
  {
    id: 'meteor', name: 'Meteor Valley', blurb: 'A crater lake where stars fell to earth. Mildly radioactive.',
    req: { toughness: 6, cost: 1.2e9, level: 38 }, richness: 1.3, sizeScale: 1.4, tags: ['crater'], hazard: 'radiation',
    pool: {
      common: ['meteorite', 'tektite', 'moldavite', 'meteoriciron'],
      uncommon: ['stardust', 'starshine'],
      rare: ['cometshard', 'cosmicpearl'],
      epic: ['nebulite', 'palladium'],
      legendary: ['neutronium'],
      mythic: ['vortessence'],
      exotic: ['galaxite'],
    },
    theme: {
      sky: { day: ['#3b2a7a', '#c58bff'], dusk: ['#2a1a5a', '#ff7ac6'], night: ['#05031a', '#1e1250'] },
      stars: true,
      far: { color: '#4a3a8a', height: 0.15, rough: 0.4, crater: true },
      mid: { color: '#3d2f6e', type: 'rocks' },
      ground: { top: '#5b4a8f', body: '#3a2e5e', dark: '#241c3d' },
      water: { a: '#7c6cff', b: '#24186b', foam: '#e6e0ff', type: 'lake', glow: true },
      flora: 'crystal', props: ['crater'], particles: 'stars', deposit: '#4a3c75',
    },
  },
  {
    id: 'void', name: 'The Void', blurb: 'Where reality thins. Only the bravest prospectors pan these black waters.',
    req: { toughness: 7, cost: 6e9, level: 42 }, richness: 1.35, sizeScale: 1.5, tags: ['void'], hazard: 'voidsick',
    pool: {
      common: ['voidstone', 'nullshard', 'umbralglass', 'echocrystal'],
      uncommon: ['abyssalpearl', 'riftglass'],
      rare: ['darkmatter', 'singularite'],
      epic: ['voidheart', 'paradoxgem'],
      legendary: ['eternium'],
      mythic: ['oblivionopal'],
      exotic: ['voidtorndiamond'],
    },
    theme: {
      sky: { day: ['#12002b', '#4a0e78'], dusk: ['#12002b', '#4a0e78'], night: ['#05000f', '#22003d'] },
      stars: true, noSun: true,
      far: { color: '#2a0a4a', height: 0.18, rough: 0.8, floating: true },
      mid: { color: '#3c0d63', type: 'spires' },
      ground: { top: '#4b1a78', body: '#240a3d', dark: '#140524' },
      water: { a: '#3a0a6b', b: '#07000f', foam: '#d9a6ff', type: 'void', glow: true },
      flora: 'voidspire', props: ['rift'], particles: 'motes', deposit: '#2e0f4f',
    },
  },
  {
    id: 'celestial', name: 'Celestial Shore', blurb: 'A shore above the clouds. Only reborn prospectors may enter.',
    req: { toughness: 8, cost: 4e10, level: 46, rebirths: 1 }, richness: 1.4, sizeScale: 1.6, tags: ['sky'], hazard: 'glare',
    pool: {
      common: ['cloudstone', 'haloquartz', 'seraphfeather', 'skyglass'],
      uncommon: ['angelite', 'sunforged'],
      rare: ['godglass', 'aurelion'],
      epic: ['seraphite', 'starheart'],
      legendary: ['celestium'],
      mythic: ['divinium'],
      exotic: ['heavenstear'],
    },
    theme: {
      sky: { day: ['#9ad0ff', '#fff6d9'], dusk: ['#b48cff', '#ffd1a1'], night: ['#1a1446', '#5a4a9a'] },
      far: { color: '#ffffff', height: 0.12, rough: 0.3, clouds: true },
      mid: { color: '#f1f4ff', type: 'clouds' },
      ground: { top: '#ffffff', body: '#e6ebff', dark: '#c3cbef' },
      water: { a: '#bfe9ff', b: '#6aa8ff', foam: '#ffffff', type: 'lake', glow: true },
      flora: 'cloudtree', props: ['pillars'], particles: 'feathers', deposit: '#d8def7',
    },
  },
];

export const SHORE = Object.fromEntries(SHORES.map((s) => [s.id, s]));
export const SHORE_INDEX = Object.fromEntries(SHORES.map((s, i) => [s.id, i]));

// Normalised pools: { tier: [{ id, w }] }
for (const s of SHORES) {
  const norm = {};
  for (const [tier, list] of Object.entries(s.pool)) {
    norm[tier] = list.map((e) => (Array.isArray(e) ? { id: e[0], w: e[1] } : { id: e, w: 1 }));
  }
  s.pools = norm;
}

// Which shores each mineral can be found at
export const MINERAL_SHORES = {};
for (const s of SHORES) {
  for (const list of Object.values(s.pools)) {
    for (const { id } of list) {
      (MINERAL_SHORES[id] ||= []).push(s.id);
    }
  }
}
