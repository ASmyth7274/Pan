// Real-time schedules shared by everything on the "server": day/night,
// scheduled events and the travelling merchant. Seeded from wall-clock
// slots so they stay consistent across reloads.
import { EVENTS, EVENT, QUIET_WEIGHT } from './data/events.js';
import { ENCHANTS } from './data/items.js';
import { mulberry32, clamp, smooth } from './util.js';

export const DAY_MS = 12 * 60 * 1000; // one full day/night cycle
export const EVENT_SLOT_MS = 6 * 60 * 1000;
export const EVENT_DELAY_MS = 25 * 1000; // calm gap at the start of a slot
export const MERCHANT_SLOT_MS = 15 * 60 * 1000;
export const MERCHANT_STAY_MS = 5 * 60 * 1000;

// phase 0..1: 0-.55 day, .55-.63 dusk, .63-.92 night, .92-1 dawn
export function dayInfo(t) {
  const phase = (t % DAY_MS) / DAY_MS;
  let light;
  if (phase < 0.55) light = 1;
  else if (phase < 0.63) light = 1 - smooth((phase - 0.55) / 0.08);
  else if (phase < 0.92) light = 0;
  else light = smooth((phase - 0.92) / 0.08);
  // dusk/dawn tint strength (peaks at the transitions)
  const dusk = phase >= 0.5 && phase < 0.68 ? Math.sin(clamp((phase - 0.5) / 0.18, 0, 1) * Math.PI)
    : phase >= 0.88 ? Math.sin(clamp((phase - 0.88) / 0.12, 0, 1) * Math.PI) * 0.8 : 0;
  // sun travels across the day portion; moon across the night portion
  const sunT = phase < 0.6 ? phase / 0.6 : phase > 0.95 ? (phase - 1) / 0.6 : -1;
  const moonT = phase >= 0.6 && phase <= 0.97 ? (phase - 0.6) / 0.37 : -1;
  return { phase, light, dusk, isNight: light < 0.35, sunT, moonT };
}

function slotRng(slot, salt) {
  return mulberry32((slot * 2654435761 + salt) >>> 0);
}

function pickEvent(r) {
  let total = QUIET_WEIGHT;
  for (const e of EVENTS) total += e.weight;
  let x = r() * total;
  for (const e of EVENTS) {
    x -= e.weight;
    if (x <= 0) return e;
  }
  return null;
}

// The scheduled event for the slot containing time t (may be inactive yet).
export function slotEvent(slot, shoresUnlocked) {
  const r = slotRng(slot, 911);
  const def = pickEvent(r);
  if (!def) return null;
  const start = slot * EVENT_SLOT_MS + EVENT_DELAY_MS;
  const ev = { id: def.id, def, start, end: start + def.dur * 1000, scheduled: true };
  if (def.rift) {
    const pool = shoresUnlocked && shoresUnlocked.length ? shoresUnlocked : ['rubble'];
    ev.shore = pool[Math.floor(r() * pool.length)];
  }
  return ev;
}

export function currentScheduledEvent(t, shoresUnlocked) {
  const slot = Math.floor(t / EVENT_SLOT_MS);
  const ev = slotEvent(slot, shoresUnlocked);
  if (ev && t >= ev.start && t < ev.end) return ev;
  return null;
}

export function nextScheduledEvent(t, shoresUnlocked) {
  let slot = Math.floor(t / EVENT_SLOT_MS);
  for (let i = 0; i < 6; i++, slot++) {
    const ev = slotEvent(slot, shoresUnlocked);
    if (ev && ev.start > t) return ev;
  }
  return null;
}

// ── Travelling merchant ────────────────────────────────────────────────
export function merchantInfo(t) {
  const slot = Math.floor(t / MERCHANT_SLOT_MS);
  const start = slot * MERCHANT_SLOT_MS;
  const present = t - start < MERCHANT_STAY_MS;
  return {
    slot,
    present,
    leavesAt: start + MERCHANT_STAY_MS,
    nextAt: present ? start + MERCHANT_SLOT_MS : start + MERCHANT_SLOT_MS,
  };
}

// Stock is a list of { id, cost: {cash|shards}, scale: bool }.
// Cash prices get scaled by the player's progress in game.priceOf.
export function merchantStock(slot) {
  const r = slotRng(slot, 4242);
  const offers = [];
  const pool = [
    { id: 'meteorFragment', cost: { shards: 25 }, w: 10 },
    { id: 'rapidsToken', cost: { shards: 12 }, w: 7 },
    { id: 'solarToken', cost: { shards: 18 }, w: 7 },
    { id: 'riftToken', cost: { shards: 45 }, w: 4 },
    { id: 'enchantScroll', cost: { shards: 30 }, w: 8 },
    { id: 'reforgeToken', cost: { shards: 35 }, w: 5 },
    { id: 'luckyClover', cost: { cash: 120000 }, w: 8 },
    { id: 'backpack', cost: { cash: 80000 }, w: 6 },
    { id: 'book', w: 14 },
  ];
  const used = new Set();
  while (offers.length < 4) {
    let total = 0;
    for (const p of pool) if (!used.has(p.id) || p.id === 'book') total += p.w;
    let x = r() * total;
    let chosen = pool[0];
    for (const p of pool) {
      if (used.has(p.id) && p.id !== 'book') continue;
      x -= p.w;
      if (x <= 0) { chosen = p; break; }
    }
    if (chosen.id === 'book') {
      // rarer enchants are less likely and pricier
      let tw = 0;
      for (const e of ENCHANTS) tw += Math.sqrt(e.weight);
      let y = r() * tw;
      let ench = ENCHANTS[0];
      for (const e of ENCHANTS) { y -= Math.sqrt(e.weight); if (y <= 0) { ench = e; break; } }
      const id = 'book:' + ench.id;
      if (used.has(id)) continue;
      used.add(id);
      offers.push({ id, cost: { shards: Math.round(20 + 260 / Math.sqrt(ench.weight)) }, qty: 1 });
    } else {
      used.add(chosen.id);
      offers.push({ id: chosen.id, cost: chosen.cost, qty: chosen.id === 'backpack' ? 1 : 1 + Math.floor(r() * 2) });
    }
  }
  return offers;
}

export function eventDef(id) {
  return EVENT[id];
}
