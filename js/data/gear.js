// Pans, shovels and sluices. Early tiers follow the Roblox original's
// stats and prices; the last few are new end-game gear.
//
// Pan passives use multiplier-stat keys (sizeBoost, modBoost, sellBoost)
// expressed as additive fractions (+0.25 = +25%).

export const PANS = [
  { id: 'rusty',      name: 'Rusty Pan',       price: 0,      luck: 1,   capacity: 5,   shakeStrength: 0.2, shakeSpeed: 0.8,  c1: '#9a6b4a', c2: '#5c3a24' },
  { id: 'plastic',    name: 'Plastic Pan',     price: 500,    luck: 1.5, capacity: 10,  shakeStrength: 0.4, shakeSpeed: 0.8,  c1: '#4fb3ff', c2: '#1b6fc2' },
  { id: 'metal',      name: 'Metal Pan',       price: 12000,  luck: 2.5, capacity: 18,  shakeStrength: 0.5, shakeSpeed: 0.85, c1: '#b8c2cc', c2: '#5d6773' },
  { id: 'silver',     name: 'Silver Pan',      price: 55000,  luck: 4,   capacity: 28,  shakeStrength: 0.8, shakeSpeed: 0.9,  c1: '#eef2f6', c2: '#8f9aa8' },
  { id: 'golden',     name: 'Golden Pan',      price: 333000, luck: 10,  capacity: 35,  shakeStrength: 1,   shakeSpeed: 0.85, c1: '#ffd447', c2: '#b8860b', passive: { sellBoost: 0.05 } },
  { id: 'magnetic',   name: 'Magnetic Pan',    price: 1e6,    luck: 15,  capacity: 50,  shakeStrength: 1.2, shakeSpeed: 0.8,  c1: '#e04848', c2: '#3a4a5c', passive: { sizeBoost: 0.25 } },
  { id: 'meteoric',   name: 'Meteoric Pan',    price: 3.5e6,  luck: 22,  capacity: 70,  shakeStrength: 2,   shakeSpeed: 1,    c1: '#7a6a9a', c2: '#2f2740', passive: { modBoost: 0.25 } },
  { id: 'diamondpan', name: 'Diamond Pan',     price: 1e7,    luck: 35,  capacity: 95,  shakeStrength: 3,   shakeSpeed: 1,    c1: '#c8f4ff', c2: '#4aa8d8', passive: { sizeBoost: 0.1, modBoost: 0.1 } },
  { id: 'aurora',     name: 'Aurora Pan',      price: 3.5e7,  luck: 50,  capacity: 125, shakeStrength: 3.5, shakeSpeed: 1.2,  c1: '#7cffcb', c2: '#8a5cff', passive: { modBoost: 0.25 } },
  { id: 'worldshaker',name: 'Worldshaker',     price: 1.25e8, luck: 70,  capacity: 150, shakeStrength: 5,   shakeSpeed: 1,    c1: '#8b6b4a', c2: '#3a2a1a', passive: { sizeBoost: 0.25 } },
  { id: 'dragonflame',name: 'Dragonflame Pan', price: 4e8,    luck: 150, capacity: 175, shakeStrength: 9,   shakeSpeed: 1.05, c1: '#ff5a1f', c2: '#7a0f0f', passive: { sizeBoost: -0.1 }, immune: ['scorched'] },
  { id: 'frostbitepan',name: 'Frostbite Pan',  price: 1.2e9,  luck: 200, capacity: 210, shakeStrength: 11,  shakeSpeed: 1.15, c1: '#bff0ff', c2: '#2a6fdb', passive: { modBoost: 0.15 }, immune: ['frostbite'] },
  { id: 'galactic',   name: 'Galactic Pan',    price: 5e9,    luck: 300, capacity: 250, shakeStrength: 14,  shakeSpeed: 1.2,  c1: '#9b5cff', c2: '#1a0f4a', passive: { modBoost: 0.3 } },
  { id: 'voidbound',  name: 'Voidbound Pan',   price: 2.5e10, luck: 500, capacity: 320, shakeStrength: 20,  shakeSpeed: 1.25, c1: '#5a189a', c2: '#10002b', passive: { sizeBoost: 0.25, modBoost: 0.25 }, immune: ['voidsick'] },
  { id: 'celestialpan',name: 'Celestial Pan',  price: 1.2e11, luck: 900, capacity: 400, shakeStrength: 30,  shakeSpeed: 1.35, c1: '#fff6c2', c2: '#9bd8ff', passive: { sizeBoost: 0.5, modBoost: 0.5, sellBoost: 0.25 }, req: { rebirths: 1 } },
];

export const SHOVELS = [
  { id: 'rusty',       name: 'Rusty Shovel',      price: 0,      digStrength: 1,   digSpeed: 0.8,  toughness: 1, c1: '#9a6b4a', c2: '#6b4a2a' },
  { id: 'iron',        name: 'Iron Shovel',       price: 3000,   digStrength: 2,   digSpeed: 0.8,  toughness: 1, c1: '#9aa4b0', c2: '#6b4a2a' },
  { id: 'steel',       name: 'Steel Shovel',      price: 25000,  digStrength: 3,   digSpeed: 0.85, toughness: 2, c1: '#c9d3de', c2: '#4a3a2a' },
  { id: 'silvershovel',name: 'Silver Shovel',     price: 75000,  digStrength: 4,   digSpeed: 1.1,  toughness: 2, c1: '#f0f4f8', c2: '#3a3a4a' },
  { id: 'reinforced',  name: 'Reinforced Shovel', price: 135000, digStrength: 5,   digSpeed: 0.9,  toughness: 3, c1: '#7d8a99', c2: '#2a2a2a' },
  { id: 'excavator',   name: 'The Excavator',     price: 320000, digStrength: 7,   digSpeed: 0.7,  toughness: 3, c1: '#ffb300', c2: '#333333' },
  { id: 'goldenshovel',name: 'Golden Shovel',     price: 1.333e6,digStrength: 8,   digSpeed: 1,    toughness: 3, c1: '#ffd447', c2: '#8b5a2b' },
  { id: 'meteoricshovel',name: 'Meteoric Shovel', price: 4e6,    digStrength: 7,   digSpeed: 1.5,  toughness: 4, c1: '#8a7aaa', c2: '#2f2740' },
  { id: 'diamondshovel',name: 'Diamond Shovel',   price: 1.25e7, digStrength: 12,  digSpeed: 1,    toughness: 4, c1: '#c8f4ff', c2: '#3a5a7a' },
  { id: 'divine',      name: 'Divine Shovel',     price: 4e7,    digStrength: 16,  digSpeed: 1.1,  toughness: 5, c1: '#fff3b0', c2: '#c9a227' },
  { id: 'earthbreaker',name: 'Earthbreaker',      price: 1.25e8, digStrength: 25,  digSpeed: 1,    toughness: 5, c1: '#8b6b4a', c2: '#2a1a0a' },
  { id: 'dragonshovel',name: 'Dragonflame Shovel',price: 4e8,    digStrength: 50,  digSpeed: 0.6,  toughness: 5, c1: '#ff5a1f', c2: '#5a0a0a' },
  { id: 'fossilized',  name: 'Fossilized Shovel', price: 1e9,    digStrength: 40,  digSpeed: 1,    toughness: 6, c1: '#e8dcc0', c2: '#6b5a40' },
  { id: 'galacticshovel',name: 'Galactic Shovel', price: 2e9,    digStrength: 60,  digSpeed: 0.8,  toughness: 6, c1: '#9b5cff', c2: '#1a0f4a' },
  { id: 'icebreaker',  name: 'Icebreaker',        price: 1e10,   digStrength: 60,  digSpeed: 1.15, toughness: 7, c1: '#bff0ff', c2: '#1c3f8c' },
  { id: 'lifetouched', name: 'Lifetouched Shovel',price: 8e10,   digStrength: 100, digSpeed: 1,    toughness: 7, c1: '#86ff1a', c2: '#1b5e20' },
  { id: 'starfall',    name: 'Starfall Shovel',   price: 2.5e11, digStrength: 160, digSpeed: 1.2,  toughness: 8, c1: '#fff6c2', c2: '#6a5acd', req: { rebirths: 1 } },
];

// Sluices sift passively (even while you're offline). One item every
// `interval` seconds until the tray (capacity) is full.
export const SLUICES = [
  { id: 'wooden',  name: 'Wooden Sluice',  price: 25000, luck: 1,   capacity: 12,  interval: 90, toughness: 1, c1: '#a0723f' },
  { id: 'ironsl',  name: 'Iron Sluice',    price: 3e5,   luck: 4,   capacity: 20,  interval: 75, toughness: 2, c1: '#9aa4b0' },
  { id: 'steelsl', name: 'Steel Sluice',   price: 3e6,   luck: 12,  capacity: 30,  interval: 60, toughness: 3, c1: '#c9d3de' },
  { id: 'goldsl',  name: 'Golden Sluice',  price: 2.5e7, luck: 30,  capacity: 45,  interval: 50, toughness: 4, c1: '#ffd447' },
  { id: 'diamondsl',name: 'Diamond Sluice',price: 2.5e8, luck: 80,  capacity: 60,  interval: 40, toughness: 5, c1: '#c8f4ff' },
  { id: 'meteorsl',name: 'Meteoric Sluice',price: 3e9,   luck: 200, capacity: 80,  interval: 32, toughness: 6, c1: '#8a7aaa' },
  { id: 'voidsl',  name: 'Void Sluice',    price: 4e10,  luck: 500, capacity: 120, interval: 25, toughness: 7, c1: '#5a189a' },
];

export const PAN = Object.fromEntries(PANS.map((p) => [p.id, p]));
export const SHOVEL = Object.fromEntries(SHOVELS.map((p) => [p.id, p]));
export const SLUICE = Object.fromEntries(SLUICES.map((p) => [p.id, p]));
export const PAN_INDEX = Object.fromEntries(PANS.map((p, i) => [p.id, i]));
export const SHOVEL_INDEX = Object.fromEntries(SHOVELS.map((p, i) => [p.id, i]));
