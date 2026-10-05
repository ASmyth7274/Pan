// Loot rolls for panning and sluices.
import { TIERS, TIER_INDEX, MODIFIERS, tierOf, modOf, SIZE_CLASSES } from './data/rarity.js';
import { MINERAL, CELESTIAL_POOL } from './data/minerals.js';
import { gaussian, weightedPick, clamp } from './util.js';

// Dig quality (0.4–1) scales luck and size of the pan's contents.
export const qualityLuck = (q) => 0.55 + 0.6 * q * q;
export const qualitySize = (q) => 0.85 + 0.25 * q;
export const streakLuck = (streak) => 1 + Math.min(0.5, 0.03 * streak);
export const glintLuck = (glints) => 1 + 0.1 * Math.min(5, glints);
export const capFactor = (cap) => 0.6 + Math.sqrt(cap) / 12;
export const itemCountFloat = (cap) => 1 + Math.sqrt(cap) * 0.42;

// Probability that a single roll lands in each tier (rarest first) for a
// shore pool. Returns array aligned with TIERS: p[i].
export function tierChances(luck, shore, extra = {}) {
  const pools = shore.pools;
  const out = TIERS.map(() => 0);
  let remaining = 1;
  for (let i = TIERS.length - 1; i >= 1; i--) {
    const t = TIERS[i];
    const available = t.id === 'celestial' ? (extra.celestial || shore.id === 'celestial') : !!pools[t.id]?.length;
    if (!available) continue;
    const mult = extra.tierMult?.[t.id] || 1;
    const p = Math.min(1, mult * Math.min(t.cap, t.base * Math.pow(Math.max(luck, 0.01), t.exp)));
    out[i] = remaining * p;
    remaining *= 1 - p;
  }
  out[0] = remaining;
  return out;
}

function rollTier(luck, shore, extra, rng) {
  const pools = shore.pools;
  for (let i = TIERS.length - 1; i >= 1; i--) {
    const t = TIERS[i];
    const available = t.id === 'celestial' ? (extra.celestial || shore.id === 'celestial') : !!pools[t.id]?.length;
    if (!available) continue;
    const mult = extra.tierMult?.[t.id] || 1;
    const p = Math.min(1, mult * Math.min(t.cap, t.base * Math.pow(Math.max(luck, 0.01), t.exp)));
    if (rng() < p) return t.id;
  }
  return 'common';
}

function pickMineral(tier, shore, isNight, rng) {
  if (tier === 'celestial') {
    const id = CELESTIAL_POOL[Math.floor(rng() * CELESTIAL_POOL.length)];
    return MINERAL[id];
  }
  const list = shore.pools[tier] || shore.pools.common;
  const entry = weightedPick(list, (e) => {
    const m = MINERAL[e.id];
    return e.w * (isNight ? m.night : m.day);
  }, rng);
  return MINERAL[entry.id];
}

export function modChance(mod, shoreId, modBoost, extra = {}) {
  let c = mod.where && !mod.where.includes(shoreId) ? 0 : mod.chance;
  const en = extra.enableMods?.[mod.id];
  if (en) c = Math.max(c, en);
  if (!c) return 0;
  c *= (extra.modMult?.[mod.id] || 1) * (mod.boostAt?.[shoreId] || 1) * modBoost;
  return Math.min(0.5, c);
}

function rollModifier(shoreId, modBoost, extra, rng) {
  for (const mod of MODIFIERS) {
    const c = modChance(mod, shoreId, modBoost, extra);
    if (c > 0 && rng() < c) return mod.id;
  }
  return null;
}

export function rollSize(rng, sizeBoost = 1) {
  let r = Math.exp(gaussian(rng) * 0.38);
  const hugeP = 0.012 * Math.sqrt(sizeBoost);
  const x = rng();
  if (x < 0.0012 * Math.sqrt(sizeBoost)) r = 7 + rng() * 8;
  else if (x < hugeP) r = 3 + rng() * 3;
  return r;
}

export function sizeClass(sizeRoll) {
  for (const c of SIZE_CLASSES) if (sizeRoll >= c.min) return c;
  return null;
}

/**
 * Roll one mineral.
 * opts: { luck, shore, capacity, sizeBoost, modBoost, quality, isNight, extra, rng }
 */
export function rollItem(opts) {
  const { luck, shore, capacity, sizeBoost, modBoost, quality = 0.7, isNight, extra = {}, rng } = opts;
  const tier = rollTier(luck, shore, extra, rng);
  const m = pickMineral(tier, shore, isNight, rng);
  const sizeRoll = rollSize(rng, sizeBoost);
  const kg = m.kg * sizeRoll * capFactor(capacity) * (shore.sizeScale || 1) * sizeBoost * qualitySize(quality);
  const mod = rollModifier(shore.id, modBoost, extra, rng);
  const sc = sizeClass(sizeRoll);
  return { m: m.id, kg: Math.max(0.001, kg), mod, size: sc ? sc.id : null };
}

/**
 * Roll a whole pan.
 * opts: { stats (values), shore, fill (0..1), quality, glints, streak, isNight, extra, rng }
 */
export function rollPan(opts) {
  const { stats, shore, fill = 1, quality = 0.7, glints = 0, streak = 0, isNight = false, extra = {}, rng } = opts;
  const luck = stats.luck * qualityLuck(quality) * glintLuck(glints) * streakLuck(streak);
  const nf = itemCountFloat(stats.capacity) * clamp(fill, 0, 1) * (shore.richness || 1) * stats.items;
  let n = Math.floor(nf) + (rng() < nf % 1 ? 1 : 0);
  // a caught glint has a small chance to add a bonus item
  for (let g = 0; g < glints; g++) if (rng() < 0.15) n++;
  n = Math.max(1, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push(rollItem({
      luck, shore, capacity: stats.capacity, sizeBoost: stats.sizeBoost, modBoost: stats.modBoost,
      quality, isNight, extra, rng,
    }));
  }
  let shards = 0;
  const sm = extra.shardMult || 1;
  if (rng() < Math.min(0.9, 0.05 * sm)) shards = 1 + Math.floor(rng() * (sm > 1 ? 4 : 2));
  return { items, shards, luck };
}

export function rollSluiceItem(sluice, shore, rebirths, isNight, rng) {
  const luck = sluice.luck * (1 + 0.5 * rebirths);
  return rollItem({ luck, shore, capacity: 20, sizeBoost: 1, modBoost: 1, quality: 0.7, isNight, extra: {}, rng });
}

export function baseValue(item) {
  const m = MINERAL[item.m];
  const mod = modOf(item.mod);
  return m.value * item.kg * (mod ? mod.mult : 1);
}

export function itemXp(item) {
  const m = MINERAL[item.m];
  return Math.round(tierOf(m.tier).xp * (item.mod ? 1.5 : 1) * (item.size ? 1.5 : 1));
}

export function tierRank(item) {
  return TIER_INDEX[MINERAL[item.m].tier];
}
