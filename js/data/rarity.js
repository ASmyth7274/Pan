// Rarity tiers and mineral modifiers.
//
// Tier rolls happen rarest-first: chance(tier) = min(cap, base * luck^exp).
// Higher tiers scale linearly with luck (like the Roblox original, where
// 500 luck is 10x the rare odds of 50 luck); low tiers scale sub-linearly
// so commons never fully disappear.

export const TIERS = [
  { id: 'common',    name: 'Common',    short: 'C', color: '#b9c3d1', glow: '#dfe6ef', base: 1,       exp: 0,    cap: 1,     xp: 3,     museum: 0.010, modMuseum: 0.01 },
  { id: 'uncommon',  name: 'Uncommon',  short: 'U', color: '#5fd66f', glow: '#a6f5ae', base: 1 / 7,   exp: 0.5,  cap: 0.5,   xp: 8,     museum: 0.015, modMuseum: 0.01 },
  { id: 'rare',      name: 'Rare',      short: 'R', color: '#3fa7ff', glow: '#9ed3ff', base: 1 / 50,  exp: 0.75, cap: 0.35,  xp: 20,    museum: 0.025, modMuseum: 0.01 },
  { id: 'epic',      name: 'Epic',      short: 'E', color: '#b76dff', glow: '#dcb8ff', base: 1 / 400, exp: 0.9,  cap: 0.2,   xp: 50,    museum: 0.04,  modMuseum: 0.02 },
  { id: 'legendary', name: 'Legendary', short: 'L', color: '#ffb321', glow: '#ffe09a', base: 1 / 5e3, exp: 1,    cap: 0.1,   xp: 150,   museum: 0.06,  modMuseum: 0.03 },
  { id: 'mythic',    name: 'Mythic',    short: 'M', color: '#ff4f8b', glow: '#ffa8c6', base: 1 / 1e5, exp: 1,    cap: 0.05,  xp: 600,   museum: 0.10,  modMuseum: 0.05 },
  { id: 'exotic',    name: 'Exotic',    short: 'X', color: '#19e6d2', glow: '#a5fff6', base: 1 / 2.5e6, exp: 1,  cap: 0.02,  xp: 3000,  museum: 0.16,  modMuseum: 0.10 },
  { id: 'celestial', name: 'Celestial', short: 'S', color: '#fff3a8', glow: '#ffffff', base: 1 / 5e7, exp: 1,    cap: 0.01,  xp: 20000, museum: 0.25,  modMuseum: 0.15 },
];

export const TIER_INDEX = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));
export const tierOf = (id) => TIERS[TIER_INDEX[id]];

// Mineral modifiers ("mutations"). Rolled rarest-first, max one per mineral.
// `where` limits natural spawning to certain shores; `events` lists events
// that enable or boost it (see events.js). `museum` is the stat the modifier
// adds when the mineral is displayed in the museum.
export const MODIFIERS = [
  { id: 'prismatic',   name: 'Prismatic',   mult: 15,  chance: 1 / 25000, color: '#ffffff', rainbow: true, museum: 'all' },
  { id: 'voidtorn',    name: 'Voidtorn',    mult: 10,  chance: 1 / 400,   color: '#a35cff', where: ['void'], museum: 'luck' },
  { id: 'starforged',  name: 'Starforged',  mult: 6,   chance: 1 / 300,   color: '#ffd6ff', where: ['meteor', 'celestial'], museum: 'luck' },
  { id: 'cursed',      name: 'Cursed',      mult: 5,   chance: 1 / 1500,  color: '#9b30ff', museum: 'sellBoost', cursed: true },
  { id: 'ancient',     name: 'Ancient',     mult: 4,   chance: 1 / 120,   color: '#e2bf83', where: ['fossil', 'grotto'], museum: 'sizeBoost' },
  { id: 'iridescent',  name: 'Iridescent',  mult: 3.5, chance: 1 / 600,   color: '#9ff0ff', rainbow: true, museum: 'luck' },
  { id: 'electrified', name: 'Electrified', mult: 3,   chance: 0,         color: '#fff35c', museum: 'shakeSpeed' },
  { id: 'irradiated',  name: 'Irradiated',  mult: 2.5, chance: 1 / 220,   color: '#7cff4f', museum: 'modBoost', boostAt: { swamp: 4 } },
  { id: 'scorching',   name: 'Scorching',   mult: 2,   chance: 1 / 40,    color: '#ff7a1a', where: ['desert', 'caldera'], museum: 'digStrength' },
  { id: 'frozen',      name: 'Frozen',      mult: 1.8, chance: 1 / 40,    color: '#9fe8ff', where: ['frost'], museum: 'capacity' },
  { id: 'glowing',     name: 'Glowing',     mult: 1.6, chance: 1 / 55,    color: '#b6ff9e', museum: 'luck' },
  { id: 'pure',        name: 'Pure',        mult: 1.35, chance: 1 / 30,   color: '#e0ffff', museum: 'digSpeed' },
  { id: 'shiny',       name: 'Shiny',       mult: 1.2, chance: 1 / 14,    color: '#fff6a6', museum: 'shakeStrength' },
];

export const MOD_INDEX = Object.fromEntries(MODIFIERS.map((m, i) => [m.id, i]));
export const modOf = (id) => (id ? MODIFIERS[MOD_INDEX[id]] : null);

// Size classes relative to the mineral's expected weight
export const SIZE_CLASSES = [
  { min: 7, id: 'colossal', name: 'COLOSSAL', color: '#ff5ad1' },
  { min: 3, id: 'huge', name: 'HUGE', color: '#ffb321' },
];
