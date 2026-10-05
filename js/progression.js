// Levels, feature unlocks and price scaling.
import { PANS, PAN_INDEX } from './data/gear.js';

export const xpToNext = (level) => Math.round(40 * Math.pow(level, 1.6) + 40);

export const FEATURES = {
  totems: { level: 4, name: 'Totems' },
  museum: { level: 5, name: 'Museum' },
  sluice: { level: 6, name: 'Sluices' },
  crafting: { level: 8, name: 'Crafting' },
  auto: { level: 10, name: 'Auto-Prospect' },
  enchant: { level: 12, name: 'Enchanting' },
};

export const isUnlocked = (state, feature) => state.level >= FEATURES[feature].level || state.rebirths > 0;

// Cash-priced consumables keep pace with your gear: max(base, 3% of the
// best pan you own).
export function scaledCash(state, base) {
  let best = 0;
  for (const id of state.pans) best = Math.max(best, PANS[PAN_INDEX[id]]?.price || 0);
  return Math.max(base, Math.round(best * 0.03 / 100) * 100);
}

export const bagUpgradeCost = (n) => Math.round(5000 * Math.pow(2.6, n));
export const BAG_UPGRADE_SLOTS = 10;
export const BAG_UPGRADE_MAX = 15;
export const museumSlotCost = (slotsOwned) => Math.round(50000 * Math.pow(4.2, slotsOwned - 3));
export const ringSlotCost = (ringSlots) => [0, 50, 150, 400][ringSlots] ?? Infinity; // shards
export const RING_SLOTS_MAX = 4;
export const sluiceSlotCost = (slots) => [0, 100, 300, 800][slots] ?? Infinity; // shards
export const SLUICE_SLOTS_MAX = 4;
export const reforgeCost = (recipe) => Math.round(recipe.cost * 0.25);

// Rebirth: cost in cash, grows ×6 each time
export const rebirthCost = (n) => Math.round(2.5e10 * Math.pow(6, n));
export const REBIRTH_LEVEL = 40;
