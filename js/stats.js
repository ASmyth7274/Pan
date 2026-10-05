// Effective stat computation. Every source contributes effects in the form
//   { stat: { add, pct, mult } }
// and each stat resolves as: (base + Σadd) × (1 + Σpct) × Πmult.
// Parts are kept so the UI can show a full breakdown.
import { PAN, SHOVEL } from './data/gear.js';
import { ENCHANT, RECIPE, POTION, TOTEM, TOKEN, OUTFIT, STAT_KEYS } from './data/items.js';
import { SHORE, HAZARDS } from './data/shores.js';
import { MINERAL } from './data/minerals.js';
import { tierOf, modOf } from './data/rarity.js';
import { clamp } from './util.js';

const MULT_STATS = new Set(['sizeBoost', 'modBoost', 'sellBoost', 'items', 'walkSpeed']);

// How crafted equipment stats apply
const EQUIP_KIND = {
  luck: 'add', capacity: 'add', shakeStrength: 'add', digStrength: 'add',
  shakeSpeed: 'pct', digSpeed: 'pct', sizeBoost: 'add', modBoost: 'add', sellBoost: 'add',
};

// Museum: weight factor rewards heavier specimens (sqrt, clamped)
export function museumBoost(item) {
  const m = MINERAL[item.m];
  if (!m) return [];
  const t = tierOf(m.tier);
  const wf = clamp(Math.sqrt(item.kg / m.kg), 0.5, 3);
  const out = [{ stat: m.stat, v: t.museum * wf }];
  const mod = modOf(item.mod);
  if (mod) {
    const v = t.modMuseum * (1 + Math.log10(mod.mult) * 0.5);
    if (mod.museum === 'all') {
      for (const s of ['luck', 'capacity', 'shakeStrength', 'shakeSpeed', 'digStrength', 'digSpeed']) out.push({ stat: s, v: v * 0.5 });
    } else out.push({ stat: mod.museum, v });
  }
  return out;
}

export function museumEffects(state) {
  const effects = {};
  for (const it of state.museum.items) {
    if (!it) continue;
    for (const { stat, v } of museumBoost(it)) {
      const kind = MULT_STATS.has(stat) ? 'add' : 'pct';
      effects[stat] ||= {};
      effects[stat][kind] = (effects[stat][kind] || 0) + v;
    }
  }
  return effects;
}

function hazardProtected(state, hazardId, buffs) {
  const hz = HAZARDS[hazardId];
  if (!hz) return true;
  if (state.outfits.includes(hz.counter)) return true;
  const pan = PAN[state.pan];
  if (pan?.immune?.includes(hazardId)) return true;
  if (buffs.some((b) => POTION[b.id]?.cleanse)) return true;
  return false;
}

export function shoreCompletion(state, shore) {
  let have = 0, total = 0;
  for (const list of Object.values(shore.pools)) {
    for (const { id } of list) {
      total++;
      if (state.index[id]) have++;
    }
  }
  return { have, total, done: total > 0 && have >= total };
}

/**
 * ctx: { state, shoreId, events: [{def, shore}], botTotems: [{id, shore, owner}],
 *        playersHere: number }
 */
export function computeStats(ctx) {
  const { state } = ctx;
  const shoreId = ctx.shoreId || state.shore;
  const shore = SHORE[shoreId];
  const sources = [];
  const pan = PAN[state.pan] || PAN.rusty;
  const shovel = SHOVEL[state.shovel] || SHOVEL.rusty;

  sources.push({
    src: pan.name, kind: 'gear', effects: {
      luck: { add: pan.luck }, capacity: { add: pan.capacity },
      shakeStrength: { add: pan.shakeStrength }, shakeSpeed: { add: pan.shakeSpeed },
      ...Object.fromEntries(Object.entries(pan.passive || {}).map(([k, v]) => [k, { add: v }])),
    },
  });
  sources.push({ src: shovel.name, kind: 'gear', effects: { digStrength: { add: shovel.digStrength }, digSpeed: { add: shovel.digSpeed } } });

  const ench = ENCHANT[state.enchants[state.pan]];
  if (ench) sources.push({ src: `${ench.name} enchant`, kind: 'enchant', effects: ench.effects });

  // Equipment
  const eq = state.equipped;
  const equippedIds = [eq.neck, eq.charm, ...eq.rings].filter(Boolean);
  for (const u of equippedIds) {
    const item = state.equipment.find((e) => e.u === u);
    if (!item) continue;
    const r = RECIPE[item.r];
    const effects = {};
    for (const [k, v] of Object.entries(item.stats)) effects[k] = { [EQUIP_KIND[k] || 'add']: v };
    sources.push({ src: r ? r.name : 'Equipment', kind: 'equipment', effects });
  }

  // Museum
  const mus = museumEffects(state);
  if (Object.keys(mus).length) sources.push({ src: 'Museum', kind: 'museum', effects: mus });

  // Collection rewards: +5% luck per completed shore index
  let completed = 0;
  for (const id of state.shores) {
    const s = SHORE[id];
    if (s && shoreCompletion(state, s).done) completed++;
  }
  if (completed) sources.push({ src: `Collections (${completed})`, kind: 'perk', effects: { luck: { pct: 0.05 * completed } } });

  // Rebirths
  if (state.rebirths > 0) {
    sources.push({
      src: `Rebirth ${state.rebirths}`, kind: 'perk', effects: {
        luck: { mult: 1 + 0.5 * state.rebirths }, sellBoost: { mult: 1 + 0.25 * state.rebirths },
      },
    });
  }

  // Potions & clover
  const buffs = state.buffs || [];
  for (const b of buffs) {
    const def = POTION[b.id] || TOKEN[b.id];
    const effects = def?.effects || def?.potion?.effects;
    if (effects && Object.keys(effects).length) sources.push({ src: def.name, kind: 'potion', effects });
  }

  // Totems at this shore (yours + other players')
  const totems = [
    ...(state.totems || []).map((t) => ({ ...t, owner: 'You' })),
    ...(ctx.botTotems || []),
  ].filter((t) => t.shore === shoreId);
  const seenTotem = new Set();
  for (const t of totems) {
    const def = TOTEM[t.id];
    if (!def || seenTotem.has(t.id)) continue; // same totem type doesn't stack
    seenTotem.add(t.id);
    let effects = def.effects;
    if (def.friendship) {
      const n = Math.max(0, ctx.playersHere || 0);
      effects = { luck: { mult: Math.min(3, 1.2 + 0.15 * n) } };
    }
    sources.push({ src: `${def.name} (${t.owner})`, kind: 'totem', effects });
  }

  // Events
  const extra = { enableMods: {}, modMult: {}, tierMult: {}, celestial: false, shardMult: 1 };
  const seenEvents = new Set();
  for (const ev of ctx.events || []) {
    const d = ev.def;
    // the same event running twice (e.g. a fragment during a shower) doesn't stack
    const key = d.rift ? `${d.id}:${ev.shore}` : d.id;
    if (!d || seenEvents.has(key)) continue;
    seenEvents.add(key);
    if (d.effects) sources.push({ src: d.name, kind: 'event', effects: d.effects });
    mergeExtra(extra, d);
    if (d.at) {
      const applies = d.at.rift ? ev.shore === shoreId : shore?.tags?.includes(d.at.tag);
      if (applies) {
        if (d.at.effects) sources.push({ src: `${d.name} (here)`, kind: 'event', effects: d.at.effects });
        mergeExtra(extra, d.at);
      }
    }
  }

  // Hazards & curses (debuffs)
  const cleanse = buffs.some((b) => POTION[b.id]?.cleanse);
  let hazard = null;
  if (shore?.hazard) {
    const hz = HAZARDS[shore.hazard];
    const prot = hazardProtected(state, shore.hazard, buffs);
    hazard = { ...hz, protected: prot };
    if (!prot) sources.push({ src: hz.name, kind: 'debuff', effects: hz.effects });
  }
  const cursedCount = state.bag.reduce((n, it) => n + (it.mod === 'cursed' ? 1 : 0), 0);
  if (cursedCount && !cleanse) {
    sources.push({ src: `Haunted (${cursedCount} cursed)`, kind: 'debuff', effects: { luck: { mult: Math.max(0.5, 1 - 0.1 * cursedCount) } } });
  }

  // Resolve
  const values = {};
  const parts = {};
  for (const k of STAT_KEYS) {
    const base = MULT_STATS.has(k) ? 1 : 0;
    let add = 0, pct = 0, mult = 1;
    const p = [];
    for (const s of sources) {
      const e = s.effects[k];
      if (!e) continue;
      if (e.add) { add += e.add; p.push({ src: s.src, kind: s.kind, op: 'add', v: e.add }); }
      if (e.pct) { pct += e.pct; p.push({ src: s.src, kind: s.kind, op: 'pct', v: e.pct }); }
      if (e.mult && e.mult !== 1) { mult *= e.mult; p.push({ src: s.src, kind: s.kind, op: 'mult', v: e.mult }); }
    }
    values[k] = (base + add) * Math.max(0.05, 1 + pct) * mult;
    parts[k] = p;
  }
  values.luck = Math.max(0.1, values.luck);
  values.capacity = Math.max(1, values.capacity);
  values.shakeStrength = Math.max(0.05, values.shakeStrength);
  values.shakeSpeed = Math.max(0.1, values.shakeSpeed);
  values.digStrength = Math.max(0.1, values.digStrength);
  values.digSpeed = Math.max(0.1, values.digSpeed);
  values.sizeBoost = Math.max(0.1, values.sizeBoost);
  values.modBoost = Math.max(0, values.modBoost);
  values.sellBoost = Math.max(0.1, values.sellBoost);
  values.items = Math.max(0.25, values.items);
  values.walkSpeed = Math.max(0.3, values.walkSpeed);
  values.toughness = shovel.toughness;

  return { values, parts, sources, hazard, cleanse, extra };
}

function mergeExtra(extra, d) {
  if (d.enableMods) for (const [k, v] of Object.entries(d.enableMods)) extra.enableMods[k] = Math.max(extra.enableMods[k] || 0, v);
  if (d.modMult) for (const [k, v] of Object.entries(d.modMult)) extra.modMult[k] = (extra.modMult[k] || 1) * v;
  if (d.tierMult) for (const [k, v] of Object.entries(d.tierMult)) extra.tierMult[k] = (extra.tierMult[k] || 1) * v;
  if (d.celestial) extra.celestial = true;
  if (d.shardMult) extra.shardMult *= d.shardMult;
}

export { MULT_STATS, OUTFIT };
