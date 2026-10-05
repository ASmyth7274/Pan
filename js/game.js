// Game: owns the save state and all rules. The UI and renderer read from it
// and call its actions; it emits events for anything that changes.
import { Emitter, clamp, uid, mulberry32, hashStr, todayKey, fmtCash, fmtKg, weightedPick, pick } from './util.js';
import { saveState } from './state.js';
import { computeStats, shoreCompletion } from './stats.js';
import { rollPan, rollSluiceItem, baseValue, itemXp, tierRank } from './loot.js';
import { dayInfo, currentScheduledEvent, nextScheduledEvent, merchantInfo, merchantStock } from './worldclock.js';
import { PANS, PAN, SHOVELS, SHOVEL, SLUICE, PAN_INDEX } from './data/gear.js';
import { SHORES, SHORE, HAZARDS } from './data/shores.js';
import { MINERAL, MINERALS } from './data/minerals.js';
import { TIERS, TIER_INDEX, tierOf, modOf } from './data/rarity.js';
import { EVENT } from './data/events.js';
import { POTION, TOTEM, TOKEN, OUTFIT, ENCHANTS, ENCHANT, RECIPE, consumableDef } from './data/items.js';
import { NPCS, NPC, DAILY_TEMPLATES, ACHIEVEMENTS, DAILY_LOGIN, CODES } from './data/quests.js';
import {
  xpToNext, FEATURES, isUnlocked, scaledCash, bagUpgradeCost, BAG_UPGRADE_SLOTS, BAG_UPGRADE_MAX,
  museumSlotCost, ringSlotCost, RING_SLOTS_MAX, sluiceSlotCost, SLUICE_SLOTS_MAX, reforgeCost,
  rebirthCost, REBIRTH_LEVEL,
} from './progression.js';
import { MUSEUM_MAX } from './state.js';

export const GRADES = {
  perfect: { name: 'PERFECT!', q: 1, mult: 1.25, color: '#ffd54f' },
  great:   { name: 'Great!',   q: 0.85, mult: 1.1, color: '#69f0ae' },
  good:    { name: 'Good',     q: 0.7, mult: 1, color: '#81d4fa' },
  okay:    { name: 'Okay',     q: 0.55, mult: 0.85, color: '#cfd8dc' },
  weak:    { name: 'Weak',     q: 0.4, mult: 0.6, color: '#ff8a80' },
};
export const NEEDLE_SPEED = 1.15; // sweeps per second
export const MAX_GLINTS = 5;
const AUTOSAVE_S = 12;
const OFFLINE_CAP_S = 8 * 3600;

export class Game extends Emitter {
  constructor(state) {
    super();
    this.s = state;
    this.now = Date.now();
    this.bots = null;
    this.statsCache = null;
    this.statsAge = 99;
    this.events = [];
    this.eventKeys = new Set();
    this.chatLog = [];
    this.saveTimer = 0;
    this.phase = 'dig';
    this.walk = null;
    this.dig = { charging: false, needle: 0, dir: 1, zone: 0.78, cooldown: 0, held: 0, autoTarget: null, swing: 0 };
    this.pan = { shaking: false, glint: null, nextGlint: 1.4, t: 0, autoCatch: null };
    this.lastFind = null;
    this.merchantSlotSeen = -1;
    this.pendingWalk = null;
    this.dayCheck = 0;
    this.rng = Math.random;
    this.ensureQuestState();
    this.ensureDaily();
    // a pan that was full when the game closed goes straight to panning
    if (this.s.pending.sed > 0 && this.s.pending.sed >= this.stats().capacity - 1e-6) this.phase = 'pan';
  }

  // ── stats & context ─────────────────────────────────────────────────
  get shore() { return SHORE[this.s.shore] || SHORES[0]; }

  invalidate() { this.statsAge = 99; }

  stats() {
    if (!this.statsCache || this.statsAge > 0.25) {
      this.statsCache = computeStats({
        state: this.s,
        shoreId: this.s.shore,
        events: this.events,
        botTotems: this.bots ? this.bots.totemsList() : [],
        playersHere: this.bots ? this.bots.countAt(this.s.shore) : 0,
      });
      this.statsAge = 0;
    }
    return this.statsCache.values;
  }
  fullStats() { this.stats(); return this.statsCache; }

  day() { return dayInfo(this.now); }
  isNight() { return this.day().isNight || this.events.some((e) => e.def.night); }

  // ── main update ─────────────────────────────────────────────────────
  update(dt) {
    this.now = Date.now();
    this.statsAge += dt;
    this.s.stats.playtime += dt;
    this.tickTimers(dt);
    this.updateEvents();
    this.updateMinigame(dt);
    if (this.s.auto) this.updateAuto(dt);
    this.tickSluices(false);
    this.checkMerchant();
    this.dayCheck += dt;
    if (this.dayCheck > 5) { this.dayCheck = 0; this.ensureDaily(); }
    this.saveTimer += dt;
    if (this.saveTimer > AUTOSAVE_S) this.save();
  }

  save() {
    this.saveTimer = 0;
    if (this.bots) this.s.bots = this.bots.serialize();
    saveState(this.s);
  }

  tickTimers(dt) {
    const ms = dt * 1000;
    let changed = false;
    for (const list of [this.s.buffs, this.s.totems, this.s.serverEvents]) {
      for (const b of list) b.left -= ms;
      const before = list.length;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].left <= 0) {
          const b = list[i];
          list.splice(i, 1);
          const def = POTION[b.id] || TOTEM[b.id] || TOKEN[b.id];
          if (def && list !== this.s.serverEvents) this.toast(`${def.name} wore off`, 'info');
        }
      }
      if (list.length !== before) changed = true;
    }
    if (changed) { this.invalidate(); this.emit('buffs'); }
  }

  // ── events ──────────────────────────────────────────────────────────
  updateEvents() {
    const list = [];
    const sched = currentScheduledEvent(this.now, this.s.shores);
    if (sched) list.push({ key: `s${sched.start}`, def: sched.def, shore: sched.shore, end: sched.end, source: 'server' });
    for (const se of this.s.serverEvents) {
      list.push({ key: `p${se.u}`, def: EVENT[se.id], shore: se.shore, end: this.now + se.left, source: se.by || 'You' });
    }
    if (this.bots) for (const be of this.bots.events) {
      list.push({ key: `b${be.u}`, def: EVENT[be.id], shore: be.shore, end: be.end, source: be.by });
    }
    const keys = new Set(list.map((e) => e.key));
    let changed = keys.size !== this.eventKeys.size;
    for (const e of list) {
      if (!this.eventKeys.has(e.key)) {
        changed = true;
        this.onEventStart(e);
      }
    }
    for (const k of this.eventKeys) if (!keys.has(k)) changed = true;
    if (changed) {
      for (const old of this.events) if (!keys.has(old.key)) this.emit('eventEnd', old);
      this.events = list;
      this.eventKeys = keys;
      this.invalidate();
      this.emit('events');
    } else {
      this.events = list;
    }
  }

  onEventStart(e) {
    const where = e.def.rift ? ` at ${SHORE[e.shore]?.name || 'a shore'}` : '';
    const by = e.source !== 'server' ? ` (started by ${e.source})` : '';
    this.pushChat({ kind: 'event', text: `${e.def.name}${where} has begun!${by}`, color: e.def.color });
    this.emit('eventStart', e);
  }

  nextEvent() { return nextScheduledEvent(this.now, this.s.shores); }

  // ── minigame: digging & panning ─────────────────────────────────────
  bagFree() { return this.s.bagSize - this.s.bag.length; }

  canAct() { return !this.walk; }

  press() {
    if (this.walk) return;
    if (this.phase === 'dig') {
      if (this.dig.cooldown > 0 || this.dig.charging) return;
      if (this.bagFree() <= 0) { this.emit('bagFull'); return; }
      this.dig.charging = true;
      this.dig.needle = 0;
      this.dig.dir = 1;
      this.dig.held = 0;
      this.dig.zone = 0.62 + this.rng() * 0.28;
      this.emit('digStart');
    } else if (this.phase === 'pan') {
      if (this.bagFree() <= 0) { this.emit('bagFull'); return; }
      this.pan.shaking = true;
      this.emit('shakeStart');
    }
  }

  release() {
    if (this.dig.charging) this.resolveDig();
    else if (this.pan.shaking) {
      this.pan.shaking = false;
      if (this.pan.glint && this.pan.glint.t > 0) this.catchGlint();
      this.emit('shakeStop');
    }
  }

  gradeFor(x, zone) {
    const d = Math.abs(x - zone);
    if (d <= 0.045) return 'perfect';
    if (d <= 0.1) return 'great';
    if (d <= 0.18) return 'good';
    if (x < 0.2) return 'weak';
    return 'okay';
  }

  resolveDig() {
    const st = this.stats();
    const d = this.dig;
    d.charging = false;
    const grade = this.gradeFor(d.needle, d.zone);
    const g = GRADES[grade];
    const p = this.s.pending;
    const room = Math.max(0, st.capacity - p.sed);
    const add = Math.min(room, st.digStrength * g.mult);
    p.sed += add;
    p.total = (p.total || 0) + add;
    p.qsum += add * g.q;
    this.s.stats.digs++;
    this.track('dig', { n: 1 });
    if (grade === 'perfect') {
      this.s.streak++;
      this.s.stats.perfectDigs++;
      this.s.stats.bestStreak = Math.max(this.s.stats.bestStreak, this.s.streak);
      this.track('perfect', { n: 1 });
      this.track('streak', { n: this.s.streak });
      this.addXp(1);
    } else if (grade !== 'great') {
      this.s.streak = 0;
    }
    d.cooldown = 0.5 / st.digSpeed;
    d.swing = d.cooldown;
    this.emit('dig', { grade, add, needle: d.needle, zone: d.zone, streak: this.s.streak, full: p.sed >= st.capacity - 1e-6 });
    if (p.sed >= st.capacity - 1e-6) this.pendingWalk = 'water';
  }

  catchGlint() {
    if (!this.pan.glint) return;
    this.pan.glint = null;
    this.s.pending.glints = Math.min(MAX_GLINTS, (this.s.pending.glints || 0) + 1);
    this.emit('glint', { count: this.s.pending.glints });
  }

  updateMinigame(dt) {
    const d = this.dig;
    if (d.cooldown > 0) {
      d.cooldown -= dt;
      if (d.cooldown <= 0 && this.pendingWalk) {
        this.startWalk(this.pendingWalk);
        this.pendingWalk = null;
      }
    }
    if (d.charging) {
      d.held += dt;
      d.needle += d.dir * NEEDLE_SPEED * dt;
      if (d.needle >= 1) { d.needle = 2 - d.needle; d.dir = -1; }
      if (d.needle <= 0) { d.needle = -d.needle; d.dir = 1; }
      if (d.held > 4) this.resolveDig();
    }
    if (this.walk) {
      this.walk.t += dt;
      if (this.walk.t >= this.walk.dur) {
        const to = this.walk.to;
        this.walk = null;
        this.phase = to === 'water' ? 'pan' : 'dig';
        this.emit('phase', this.phase);
      }
    }
    if (this.phase === 'pan' && !this.walk) {
      const p = this.pan;
      if (p.glint) {
        p.glint.t -= dt;
        if (p.glint.t <= 0) p.glint = null;
      }
      if (p.shaking) {
        const st = this.stats();
        p.t += dt;
        this.s.pending.sed -= st.shakeStrength * st.shakeSpeed * 5 * dt;
        if ((this.s.pending.glints || 0) < MAX_GLINTS) {
          p.nextGlint -= dt;
          if (p.nextGlint <= 0 && !p.glint) {
            p.glint = { t: 0.8, x: this.rng(), y: this.rng() };
            p.autoCatch = this.rng() < 0.5;
            p.nextGlint = 1.3 + this.rng() * 1.4;
            this.emit('glintSpawn');
          }
        }
        if (this.s.pending.sed <= 0) this.completePan();
      }
    }
  }

  startWalk(to) {
    const st = this.stats();
    this.walk = { to, t: 0, dur: 0.6 / st.walkSpeed };
    this.phase = 'walk';
    this.emit('phase', 'walk');
  }

  completePan() {
    const st = this.stats();
    const p = this.s.pending;
    const total = p.total || st.capacity;
    const quality = clamp(p.qsum / Math.max(1e-6, total), 0.4, 1);
    const full = this.fullStats();
    const res = rollPan({
      stats: st, shore: this.shore, fill: total / st.capacity, quality, glints: p.glints || 0,
      streak: this.s.streak, isNight: this.isNight(), extra: full.extra, rng: this.rng,
    });
    this.s.pending = { sed: 0, qsum: 0, total: 0, glints: 0 };
    this.pan.shaking = false;
    this.pan.glint = null;
    this.pan.nextGlint = 1.4;
    this.s.stats.pans++;
    this.track('pan', { n: 1 });
    this.addXp(5);
    const found = this.receiveItems(res.items, 'pan');
    if (res.shards) {
      this.s.shards += res.shards;
      this.emit('shards');
    }
    this.emit('panned', { ...found, shards: res.shards, quality, luck: res.luck });
    this.startWalk('deposit');
  }

  // Adds found items to the bag (auto-sell / overflow aware)
  receiveItems(items, source) {
    const kept = [], sold = [], fresh = [];
    let soldValue = 0, xp = 0;
    const st = this.stats();
    const autoSellIdx = { none: -1, common: 0, uncommon: 1, rare: 2 }[this.s.settings.autoSell] ?? -1;
    for (const raw of items) {
      const m = MINERAL[raw.m];
      const it = { u: uid(), m: raw.m, kg: raw.kg, mod: raw.mod || null, size: raw.size || null, lock: false, t: this.now, at: this.s.shore };
      fresh.push(it);
      const tIdx = TIER_INDEX[m.tier];
      if (this.s.settings.autoLock && tIdx >= TIER_INDEX.legendary) it.lock = true;
      this.recordFind(it, source);
      xp += itemXp(it);
      const autoSell = tIdx <= autoSellIdx && !it.lock && !it.mod;
      const precious = tIdx >= TIER_INDEX.legendary || (it.mod && modOf(it.mod).mult >= 5) || it.size === 'colossal';
      let sellIt = autoSell;
      if (!sellIt && this.s.bag.length >= this.s.bagSize && !precious) {
        // bag full: make room by selling the cheapest unlocked mineral if this one is worth more
        let cheapest = null;
        for (const b of this.s.bag) if (!b.lock && (!cheapest || baseValue(b) < baseValue(cheapest))) cheapest = b;
        if (cheapest && baseValue(cheapest) < baseValue(it)) {
          this.s.bag.splice(this.s.bag.indexOf(cheapest), 1);
          soldValue += baseValue(cheapest) * st.sellBoost;
          sold.push(cheapest);
        } else sellIt = true;
      }
      if (sellIt) {
        soldValue += baseValue(it) * st.sellBoost;
        sold.push(it);
      } else {
        // precious finds are always kept, even past the bag limit
        this.s.bag.push(it);
        kept.push(it);
      }
    }
    if (sold.length) this.earn(soldValue, sold.length);
    this.addXp(xp);
    this.emit('bag');
    if (this.s.bag.some((i) => i.mod === 'cursed')) this.invalidate();
    return { items: fresh, kept, sold, soldValue };
  }

  recordFind(it, source) {
    const m = MINERAL[it.m];
    const st = this.s.stats;
    st.items++;
    st['tier_' + m.tier] = (st['tier_' + m.tier] || 0) + 1;
    if (it.mod) {
      st.modsFound++;
      st['mod_' + it.mod] = (st['mod_' + it.mod] || 0) + 1;
    }
    if (it.size === 'huge') st.huge++;
    if (it.size === 'colossal') { st.colossal++; st.huge++; }
    const idx = this.s.index[it.m];
    const isNew = !idx;
    if (!idx) this.s.index[it.m] = { n: 0, best: 0, mods: {} };
    const e = this.s.index[it.m];
    e.n++;
    e.best = Math.max(e.best, it.kg);
    if (it.mod) e.mods[it.mod] = 1;
    it.isNew = isNew;
    const value = baseValue(it);
    if (!this.s.best || value > this.s.best.value) this.s.best = { m: it.m, kg: it.kg, mod: it.mod, value };
    this.track('find', { item: it });
    const tIdx = TIER_INDEX[m.tier];
    if (isNew) this.emit('discover', it);
    if (tIdx >= TIER_INDEX.legendary || (it.mod && modOf(it.mod).mult >= 5) || it.size === 'colossal') {
      const desc = `${it.mod ? modOf(it.mod).name + ' ' : ''}${it.size === 'colossal' ? 'COLOSSAL ' : it.size === 'huge' ? 'HUGE ' : ''}${m.name} (${fmtKg(it.kg)})`;
      this.pushChat({ kind: 'announce', text: `${this.s.name} found a ${tierOf(m.tier).name} ${desc}!`, color: tierOf(m.tier).color });
      if (this.bots && source === 'pan') this.bots.reactToFind(tIdx);
    }
    this.lastFind = it;
  }

  // ── autoplay ────────────────────────────────────────────────────────
  setAuto(on) {
    if (on && !isUnlocked(this.s, 'auto')) {
      this.toast(`Auto-Prospect unlocks at level ${FEATURES.auto.level}`, 'warn');
      return;
    }
    this.s.auto = !!on;
    if (!on) this.release();
    this.emit('auto', this.s.auto);
  }

  updateAuto() {
    if (this.walk) return;
    if (this.bagFree() <= 0) {
      this.setAuto(false);
      this.toast('Bag full — Auto-Prospect paused', 'warn');
      this.emit('bagFull');
      return;
    }
    if (this.phase === 'dig') {
      const d = this.dig;
      if (!d.charging && d.cooldown <= 0) {
        this.press();
        // auto digs land around Good quality
        d.autoTarget = clamp(d.zone + (this.rng() - 0.5) * 0.3, 0.3, 0.98);
      } else if (d.charging && d.dir > 0 && d.needle >= d.autoTarget) {
        this.release();
      }
    } else if (this.phase === 'pan') {
      const p = this.pan;
      if (!p.shaking) this.press();
      else if (p.glint && p.autoCatch && p.glint.t < 0.55) {
        p.autoCatch = false;
        this.release();
        this.press();
      }
    }
  }

  // ── economy ─────────────────────────────────────────────────────────
  sellValue(item) { return baseValue(item) * this.stats().sellBoost; }

  earn(amount, count) {
    this.s.cash += amount;
    this.s.stats.earned += amount;
    this.s.stats.sold += count;
    this.track('sell', { n: count });
    this.track('earn', { n: amount });
    this.emit('cash');
  }

  sell(uids) {
    const set = new Set(uids);
    let total = 0, n = 0;
    const keep = [];
    for (const it of this.s.bag) {
      if (set.has(it.u) && !it.lock) { total += this.sellValue(it); n++; }
      else keep.push(it);
    }
    if (!n) return { n: 0, total: 0 };
    this.s.bag = keep;
    this.earn(total, n);
    this.invalidate();
    this.emit('bag');
    this.emit('sold', { n, total });
    return { n, total };
  }

  sellWhere(pred) {
    return this.sell(this.s.bag.filter((it) => !it.lock && pred(it)).map((it) => it.u));
  }

  toggleLock(u) {
    const it = this.s.bag.find((i) => i.u === u);
    if (it) { it.lock = !it.lock; this.emit('bag'); }
  }

  priceOf(cost, scaled = true) {
    if (cost.cash !== undefined) return { cash: scaled ? scaledCash(this.s, cost.cash) : cost.cash };
    return { shards: cost.shards };
  }
  canAfford(price) {
    if (price.cash !== undefined) return this.s.cash >= price.cash;
    return this.s.shards >= price.shards;
  }
  pay(price) {
    if (!this.canAfford(price)) {
      this.toast(price.cash !== undefined ? 'Not enough cash' : 'Not enough shards', 'warn');
      this.emit('denied');
      return false;
    }
    if (price.cash !== undefined) this.s.cash -= price.cash;
    else this.s.shards -= price.shards;
    this.emit('cash');
    this.emit('shards');
    return true;
  }

  // ── gear ────────────────────────────────────────────────────────────
  reqMet(req) {
    return !req || !req.rebirths || this.s.rebirths >= req.rebirths;
  }

  buyPan(id) {
    const p = PAN[id];
    if (!p || this.s.pans.includes(id)) return false;
    if (!this.reqMet(p.req)) { this.toast(`Requires Rebirth ${p.req.rebirths}`, 'warn'); return false; }
    if (!this.pay({ cash: p.price })) return false;
    this.s.pans.push(id);
    this.equipPan(id);
    this.toast(`Bought ${p.name}!`, 'good');
    this.emit('purchase', { kind: 'pan', id });
    this.evalStateGoals();
    return true;
  }
  equipPan(id) {
    if (!this.s.pans.includes(id)) return;
    this.s.pan = id;
    this.invalidate();
    this.emit('gear');
  }
  buyShovel(id) {
    const p = SHOVEL[id];
    if (!p || this.s.shovels.includes(id)) return false;
    if (!this.reqMet(p.req)) { this.toast(`Requires Rebirth ${p.req.rebirths}`, 'warn'); return false; }
    if (!this.pay({ cash: p.price })) return false;
    this.s.shovels.push(id);
    this.equipShovel(id);
    this.toast(`Bought ${p.name}!`, 'good');
    this.emit('purchase', { kind: 'shovel', id });
    this.evalStateGoals();
    return true;
  }
  equipShovel(id) {
    if (!this.s.shovels.includes(id)) return;
    this.s.shovel = id;
    this.invalidate();
    this.emit('gear');
  }
  buyOutfit(id) {
    const o = OUTFIT[id];
    if (!o || this.s.outfits.includes(id)) return false;
    if (!this.pay({ cash: o.price })) return false;
    this.s.outfits.push(id);
    this.invalidate();
    this.toast(`${o.name} acquired — immune to ${HAZARDS[o.hazard].name}`, 'good');
    this.emit('gear');
    this.emit('purchase', { kind: 'outfit', id });
    this.evalStateGoals();
    return true;
  }

  // ── consumables ─────────────────────────────────────────────────────
  buyConsumable(id, cost) {
    const price = this.priceOf(cost);
    if (!this.pay(price)) return false;
    this.s.items[id] = (this.s.items[id] || 0) + 1;
    this.emit('items');
    this.emit('purchase', { kind: 'item', id });
    return true;
  }

  useItem(id) {
    const count = this.s.items[id] || 0;
    if (count <= 0) return false;
    const def = consumableDef(id);
    if (!def) return false;
    let ok = false;
    if (POTION[id] || def.potion) {
      const dur = (def.dur || def.potion.dur) * 1000;
      const ex = this.s.buffs.find((b) => b.id === id);
      if (ex) ex.left += dur;
      else this.s.buffs.push({ id, left: dur });
      this.s.stats.potions++;
      this.track('potion', { n: 1 });
      this.toast(`${def.name} active!`, 'good');
      ok = true;
    } else if (TOTEM[id]) {
      if (!isUnlocked(this.s, 'totems')) { this.toast(`Totems unlock at level ${FEATURES.totems.level}`, 'warn'); return false; }
      const ex = this.s.totems.find((t) => t.id === id && t.shore === this.s.shore);
      if (ex) ex.left += def.dur * 1000;
      else this.s.totems.push({ id, shore: this.s.shore, left: def.dur * 1000, u: uid() });
      this.s.stats.totems++;
      this.track('totem', { n: 1 });
      this.pushChat({ kind: 'system', text: `${this.s.name} placed a ${def.name} at ${this.shore.name}`, color: def.color });
      ok = true;
    } else if (TOKEN[id]?.event) {
      const ev = EVENT[def.event];
      this.s.serverEvents.push({ id: ev.id, left: def.dur * 1000, u: uid(), shore: this.s.shore, by: this.s.name });
      ok = true;
    } else if (def.book) {
      this.applyEnchant(def.book, 'book');
      ok = true;
    } else {
      this.toast(`${def.name} is used elsewhere`, 'info');
      return false;
    }
    if (ok) {
      this.s.items[id] = count - 1;
      if (this.s.items[id] <= 0) delete this.s.items[id];
      this.invalidate();
      this.emit('items');
      this.emit('buffs');
    }
    return ok;
  }

  // ── upgrades ────────────────────────────────────────────────────────
  buyBagUpgrade() {
    if (this.s.bagUpgrades >= BAG_UPGRADE_MAX) return false;
    if (!this.pay({ cash: bagUpgradeCost(this.s.bagUpgrades) })) return false;
    this.s.bagUpgrades++;
    this.s.bagSize += BAG_UPGRADE_SLOTS;
    this.toast(`Bag expanded to ${this.s.bagSize} slots`, 'good');
    this.emit('bag');
    return true;
  }
  buyMuseumSlot() {
    if (this.s.museum.slots >= MUSEUM_MAX) return false;
    if (!this.pay({ cash: museumSlotCost(this.s.museum.slots) })) return false;
    this.s.museum.slots++;
    this.emit('museum');
    return true;
  }
  buyRingSlot() {
    const n = this.s.equipped.rings.length;
    if (n >= RING_SLOTS_MAX) return false;
    if (!this.pay({ shards: ringSlotCost(n) })) return false;
    this.s.equipped.rings.push(null);
    this.emit('equipment');
    return true;
  }
  buySluiceSlot() {
    if (this.s.sluiceSlots >= SLUICE_SLOTS_MAX) return false;
    if (!this.pay({ shards: sluiceSlotCost(this.s.sluiceSlots) })) return false;
    this.s.sluiceSlots++;
    this.emit('sluice');
    return true;
  }

  // ── travel ──────────────────────────────────────────────────────────
  shoreStatus(id) {
    const sh = SHORE[id];
    const unlocked = this.s.shores.includes(id);
    const st = this.stats();
    const needs = [];
    if (!unlocked) {
      if (sh.req.rebirths && this.s.rebirths < sh.req.rebirths) needs.push(`Rebirth ${sh.req.rebirths}`);
      if (st.toughness < sh.req.toughness) needs.push(`Toughness ${sh.req.toughness} shovel`);
      if (this.s.level < sh.req.level) needs.push(`Level ${sh.req.level}`);
    }
    return { unlocked, needs, cost: unlocked ? 0 : sh.req.cost, here: this.s.shore === id };
  }

  travel(id) {
    const sh = SHORE[id];
    if (!sh || id === this.s.shore) return false;
    const status = this.shoreStatus(id);
    if (!status.unlocked) {
      if (status.needs.length) { this.toast(`Requires ${status.needs.join(', ')}`, 'warn'); return false; }
      if (!this.pay({ cash: sh.req.cost })) return false;
      this.s.shores.push(id);
      this.toast(`Unlocked ${sh.name}!`, 'good');
    }
    if (this.dig.charging) this.dig.charging = false;
    this.pan.shaking = false;
    this.s.shore = id;
    this.ensureQuestState();
    this.invalidate();
    this.track('travel', {});
    this.evalStateGoals();
    this.emit('travel', id);
    if (this.bots) this.bots.onPlayerTravel(id);
    return true;
  }

  // ── museum ──────────────────────────────────────────────────────────
  museumPlace(slot, u) {
    if (!isUnlocked(this.s, 'museum')) { this.toast(`Museum unlocks at level ${FEATURES.museum.level}`, 'warn'); return false; }
    if (slot >= this.s.museum.slots) return false;
    const idx = this.s.bag.findIndex((i) => i.u === u);
    if (idx < 0) return false;
    const it = this.s.bag[idx];
    const dup = this.s.museum.items.findIndex((x, i) => x && x.m === it.m && i !== slot);
    if (dup >= 0) { this.toast(`A ${MINERAL[it.m].name} is already on display`, 'warn'); return false; }
    this.s.bag.splice(idx, 1);
    const prev = this.s.museum.items[slot];
    this.s.museum.items[slot] = { ...it, lock: true };
    if (prev) this.s.bag.push({ ...prev, lock: true });
    this.track('museum', { n: 1 });
    this.invalidate();
    this.emit('museum');
    this.emit('bag');
    return true;
  }
  museumRemove(slot) {
    const it = this.s.museum.items[slot];
    if (!it) return false;
    if (this.bagFree() <= 0) { this.toast('Your bag is full', 'warn'); return false; }
    this.s.museum.items[slot] = null;
    this.s.bag.push(it);
    this.invalidate();
    this.emit('museum');
    this.emit('bag');
    return true;
  }

  // ── crafting & equipment ────────────────────────────────────────────
  countAvailable(mineralId) {
    return this.s.bag.filter((i) => i.m === mineralId && !i.lock).length;
  }
  canCraft(recipe) {
    for (const [m, n] of Object.entries(recipe.needs)) if (this.countAvailable(m) < n) return false;
    return this.s.cash >= recipe.cost;
  }
  craft(id) {
    const r = RECIPE[id];
    if (!r) return null;
    if (!isUnlocked(this.s, 'crafting')) { this.toast(`Crafting unlocks at level ${FEATURES.crafting.level}`, 'warn'); return null; }
    for (const [m, n] of Object.entries(r.needs)) {
      if (this.countAvailable(m) < n) { this.toast(`Need ${n} ${MINERAL[m].name}`, 'warn'); return null; }
    }
    if (!this.pay({ cash: r.cost })) return null;
    for (const [m, n] of Object.entries(r.needs)) {
      const cands = this.s.bag.filter((i) => i.m === m && !i.lock).sort((a, b) => baseValue(a) - baseValue(b)).slice(0, n);
      const del = new Set(cands.map((c) => c.u));
      this.s.bag = this.s.bag.filter((i) => !del.has(i.u));
    }
    const item = { u: uid(), r: r.id, ...this.rollEquipStats(r, false) };
    this.s.equipment.push(item);
    this.s.stats.crafts++;
    this.track('craft', { n: 1 });
    this.emit('bag');
    this.emit('equipment');
    // auto-equip into an empty slot
    if (r.slot === 'ring') {
      const free = this.s.equipped.rings.indexOf(null);
      if (free >= 0) this.equip(item.u, free);
    } else if (!this.s.equipped[r.slot]) this.equip(item.u);
    return item;
  }
  rollEquipStats(r, perfect) {
    const stats = {};
    let qsum = 0, n = 0;
    for (const [k, [lo, hi]] of Object.entries(r.stats)) {
      const q = perfect ? 1 : Math.pow(this.rng(), 0.85);
      stats[k] = lo + (hi - lo) * q;
      qsum += q; n++;
    }
    return { stats, q: n ? qsum / n : 0 };
  }
  reforge(u, useToken) {
    const item = this.s.equipment.find((e) => e.u === u);
    if (!item) return false;
    const r = RECIPE[item.r];
    if (useToken) {
      if (!this.s.items.reforgeToken) return false;
      this.s.items.reforgeToken--;
      if (!this.s.items.reforgeToken) delete this.s.items.reforgeToken;
      this.emit('items');
    } else if (!this.pay({ cash: reforgeCost(r) })) return false;
    Object.assign(item, this.rollEquipStats(r, !!useToken));
    this.invalidate();
    this.emit('equipment');
    return true;
  }
  equip(u, ringIndex) {
    const item = this.s.equipment.find((e) => e.u === u);
    if (!item) return;
    const r = RECIPE[item.r];
    this.unequip(u, true);
    if (r.slot === 'ring') {
      let i = ringIndex ?? this.s.equipped.rings.indexOf(null);
      if (i < 0) i = 0;
      this.s.equipped.rings[i] = u;
    } else this.s.equipped[r.slot] = u;
    this.invalidate();
    this.emit('equipment');
  }
  unequip(u, silent) {
    const eq = this.s.equipped;
    if (eq.neck === u) eq.neck = null;
    if (eq.charm === u) eq.charm = null;
    eq.rings = eq.rings.map((x) => (x === u ? null : x));
    if (!silent) { this.invalidate(); this.emit('equipment'); }
  }
  isEquipped(u) {
    const eq = this.s.equipped;
    return eq.neck === u || eq.charm === u || eq.rings.includes(u);
  }
  scrapEquipment(u) {
    if (this.isEquipped(u)) this.unequip(u, true);
    this.s.equipment = this.s.equipment.filter((e) => e.u !== u);
    this.invalidate();
    this.emit('equipment');
  }

  // ── enchanting ──────────────────────────────────────────────────────
  enchantRoll(method) {
    if (!isUnlocked(this.s, 'enchant')) { this.toast(`Enchanting unlocks at level ${FEATURES.enchant.level}`, 'warn'); return null; }
    if (method === 'scroll') {
      if (!this.s.items.enchantScroll) { this.toast('No Enchant Scrolls', 'warn'); return null; }
      this.s.items.enchantScroll--;
      if (!this.s.items.enchantScroll) delete this.s.items.enchantScroll;
      this.emit('items');
    } else {
      const au = this.s.bag.filter((i) => i.m === 'aurorite').sort((a, b) => (a.lock - b.lock) || baseValue(a) - baseValue(b))[0];
      if (!au) { this.toast('You need an Aurorite (Crystal Caverns)', 'warn'); return null; }
      this.s.bag = this.s.bag.filter((i) => i.u !== au.u);
      this.emit('bag');
    }
    const e = weightedPick(ENCHANTS, (x) => x.weight, this.rng);
    this.applyEnchant(e.id, method);
    return e;
  }
  applyEnchant(id, how) {
    this.s.enchants[this.s.pan] = id;
    this.s.stats.enchants++;
    this.track('enchant', { n: 1 });
    this.invalidate();
    this.emit('gear');
    this.emit('enchant', { id, how });
  }

  // ── sluices ─────────────────────────────────────────────────────────
  buySluice(id) {
    const sl = SLUICE[id];
    if (!sl || this.s.sluices.includes(id)) return false;
    if (!isUnlocked(this.s, 'sluice')) { this.toast(`Sluices unlock at level ${FEATURES.sluice.level}`, 'warn'); return false; }
    if (!this.pay({ cash: sl.price })) return false;
    this.s.sluices.push(id);
    this.toast(`Bought ${sl.name}! Place it on a shore from the Sluices menu.`, 'good');
    this.emit('sluice');
    return true;
  }
  placeSluice(id, shoreId) {
    const sl = SLUICE[id];
    const sh = SHORE[shoreId];
    if (!sl || !sh || !this.s.sluices.includes(id)) return false;
    if (sl.toughness < sh.req.toughness) { this.toast(`${sl.name} isn't tough enough for ${sh.name}`, 'warn'); return false; }
    const existing = this.s.placed.find((p) => p.id === id);
    if (existing) {
      existing.shore = shoreId;
      existing.acc = 0;
      existing.last = this.now;
    } else {
      if (this.s.placed.length >= this.s.sluiceSlots) { this.toast('All sluice slots are in use', 'warn'); return false; }
      this.s.placed.push({ u: uid(), id, shore: shoreId, acc: 0, last: this.now, tray: [] });
    }
    this.emit('sluice');
    return true;
  }
  removeSluice(u) {
    const p = this.s.placed.find((x) => x.u === u);
    if (!p) return;
    if (p.tray.length) this.collectSluice(u);
    if (p.tray.length) { this.toast('Empty the tray first (bag full)', 'warn'); return; }
    this.s.placed = this.s.placed.filter((x) => x.u !== u);
    this.emit('sluice');
  }
  tickSluices(offline) {
    let gained = 0;
    for (const p of this.s.placed) {
      const sl = SLUICE[p.id];
      const sh = SHORE[p.shore];
      if (!sl || !sh) continue;
      let elapsed = (this.now - (p.last || this.now)) / 1000;
      p.last = this.now;
      if (elapsed <= 0) continue;
      if (offline) elapsed = Math.min(elapsed, OFFLINE_CAP_S);
      if (p.tray.length >= sl.capacity) { p.acc = 0; continue; }
      p.acc += elapsed;
      while (p.acc >= sl.interval && p.tray.length < sl.capacity) {
        p.acc -= sl.interval;
        p.tray.push(rollSluiceItem(sl, sh, this.s.rebirths, false, this.rng));
        gained++;
      }
      if (p.tray.length >= sl.capacity) p.acc = 0;
    }
    if (gained) this.emit('sluice');
    return gained;
  }
  collectSluice(u) {
    const p = this.s.placed.find((x) => x.u === u);
    if (!p || !p.tray.length) return 0;
    const room = this.bagFree();
    if (room <= 0) { this.toast('Your bag is full', 'warn'); return 0; }
    const take = p.tray.splice(0, room);
    const res = this.receiveItems(take, 'sluice');
    this.s.stats.sluiceCollects++;
    this.track('sluice', { n: take.length });
    this.emit('sluice');
    this.emit('panned', { ...res, shards: 0, sluice: true });
    return take.length;
  }

  // ── merchant ────────────────────────────────────────────────────────
  merchant() {
    const info = merchantInfo(this.now);
    if (this.s.merchant.slot !== info.slot) this.s.merchant = { slot: info.slot, bought: [] };
    return { ...info, stock: merchantStock(info.slot), bought: this.s.merchant.bought };
  }
  checkMerchant() {
    const info = merchantInfo(this.now);
    if (info.present && this.merchantSlotSeen !== info.slot) {
      if (this.merchantSlotSeen !== -1) this.pushChat({ kind: 'system', text: 'The Travelling Merchant has arrived! (5 min)', color: '#ffd54f' });
      this.merchantSlotSeen = info.slot;
      this.emit('merchant', true);
    } else if (!info.present && this.merchantSlotSeen === info.slot) {
      this.merchantSlotSeen = -2;
      this.emit('merchant', false);
    }
  }
  buyMerchant(i) {
    const m = this.merchant();
    if (!m.present) return false;
    const offer = m.stock[i];
    if (!offer) return false;
    const bought = m.bought.filter((x) => x === i).length;
    if (bought >= offer.qty) { this.toast('Sold out', 'warn'); return false; }
    const price = this.priceOf(offer.cost);
    if (!this.pay(price)) return false;
    this.s.merchant.bought.push(i);
    if (offer.id === 'backpack') {
      this.s.bagSize += 15;
      this.toast(`Traveller's Backpack: +15 bag slots (${this.s.bagSize})`, 'good');
      this.emit('bag');
    } else {
      this.s.items[offer.id] = (this.s.items[offer.id] || 0) + 1;
      this.toast(`Bought ${consumableDef(offer.id).name}`, 'good');
      this.emit('items');
    }
    this.emit('merchant', true);
    return true;
  }

  // ── xp & levels ─────────────────────────────────────────────────────
  addXp(n) {
    if (!n) return;
    this.s.xp += n;
    let leveled = false;
    while (this.s.xp >= xpToNext(this.s.level)) {
      this.s.xp -= xpToNext(this.s.level);
      this.s.level++;
      leveled = true;
      const bonus = this.s.level % 5 === 0 ? 10 : 2;
      this.s.shards += bonus;
      const unlocks = Object.entries(FEATURES).filter(([, f]) => f.level === this.s.level).map(([, f]) => f.name);
      this.emit('levelUp', { level: this.s.level, shards: bonus, unlocks });
    }
    if (leveled) {
      this.emit('shards');
      this.evalStateGoals();
    }
    this.emit('xp');
  }

  // ── quests ──────────────────────────────────────────────────────────
  ensureQuestState() {
    for (const npc of NPCS) {
      if (!this.s.quests.npc[npc.id] && this.s.shores.includes(npc.shore)) {
        this.s.quests.npc[npc.id] = { i: 0, p: 0 };
      }
    }
    this.evalStateGoals();
  }

  ensureDaily() {
    const day = todayKey(new Date(this.now));
    const d = this.s.quests.daily;
    if (d.day === day && d.list.length) return;
    const r = mulberry32(hashStr(day + this.s.name));
    let best = 0;
    for (const id of this.s.pans) best = Math.max(best, PAN[id]?.price || 0);
    const scale = Math.max(5000, best * 0.6);
    const pool = DAILY_TEMPLATES.slice();
    const list = [];
    for (let k = 0; k < 3; k++) {
      const i = Math.floor(r() * pool.length);
      const tpl = pool.splice(i, 1)[0];
      const goal = tpl.goal(r, scale);
      list.push({ id: tpl.id, title: tpl.title, goal, p: 0, claimed: false, reward: { shards: 8 + Math.floor(r() * 3) * 4, cash: Math.round(scale * 0.25) } });
    }
    this.s.quests.daily = { day, list };
    this.emit('quests');
  }

  activeQuests() {
    const out = [];
    for (const npc of NPCS) {
      const st = this.s.quests.npc[npc.id];
      if (!st) continue;
      const q = npc.quests[st.i];
      if (!q) continue;
      out.push({ npc, q, p: st.p, n: goalTarget(q.goal), done: st.p >= goalTarget(q.goal) });
    }
    return out;
  }

  // The quest shown in the HUD tracker: current shore's NPC first
  trackedQuest() {
    const list = this.activeQuests();
    return list.find((x) => x.npc.shore === this.s.shore) || list[0] || null;
  }

  track(type, data) {
    let changed = false;
    for (const npc of NPCS) {
      const st = this.s.quests.npc[npc.id];
      if (!st) continue;
      const q = npc.quests[st.i];
      if (!q) continue;
      const before = st.p;
      st.p = applyGoal(q.goal, st.p, type, data, this.s);
      if (st.p !== before) {
        changed = true;
        if (before < goalTarget(q.goal) && st.p >= goalTarget(q.goal)) this.emit('questReady', { npc, q });
      }
    }
    for (const dq of this.s.quests.daily.list) {
      if (dq.claimed) continue;
      const before = dq.p;
      dq.p = applyGoal(dq.goal, dq.p, type, data, this.s);
      if (dq.p !== before) {
        changed = true;
        if (before < goalTarget(dq.goal) && dq.p >= goalTarget(dq.goal)) this.emit('questReady', { daily: dq });
      }
    }
    if (changed) this.emit('quests');
  }

  evalStateGoals() {
    let changed = false;
    const check = (goal, p) => {
      if (goal.type === 'own') {
        const [kind, id] = goal.id.split(':');
        const has = kind === 'pan' ? this.s.pans.includes(id)
          : kind === 'shovel' ? this.s.shovels.includes(id)
            : kind === 'outfit' ? this.s.outfits.includes(id) || (id === 'heatsuit' && this.s.pans.includes('dragonflame')) : false;
        return has ? 1 : 0;
      }
      if (goal.type === 'travel') return this.s.shores.includes(goal.shore) ? 1 : 0;
      if (goal.type === 'level') return this.s.level;
      return p;
    };
    for (const npc of NPCS) {
      const st = this.s.quests.npc[npc.id];
      if (!st) continue;
      const q = npc.quests[st.i];
      if (!q) continue;
      const np = check(q.goal, st.p);
      if (np !== st.p) {
        if (st.p < goalTarget(q.goal) && np >= goalTarget(q.goal)) this.emit('questReady', { npc, q });
        st.p = np;
        changed = true;
      }
    }
    if (changed) this.emit('quests');
  }

  claimQuest(npcId) {
    const npc = NPC[npcId];
    const st = this.s.quests.npc[npcId];
    if (!npc || !st) return false;
    const q = npc.quests[st.i];
    if (!q || st.p < goalTarget(q.goal)) return false;
    this.grant(q.reward, `${npc.name}: ${q.title}`);
    st.i++;
    st.p = 0;
    this.evalStateGoals();
    this.emit('quests');
    this.emit('questClaimed', { npc, q });
    return true;
  }

  claimDaily(i) {
    const dq = this.s.quests.daily.list[i];
    if (!dq || dq.claimed || dq.p < goalTarget(dq.goal)) return false;
    dq.claimed = true;
    this.grant(dq.reward, dq.title);
    this.emit('quests');
    return true;
  }

  achievementProgress(a) {
    const st = this.s.stats;
    switch (a.stat) {
      case 'shores': return this.s.shores.length;
      case 'indexPct': return Math.floor((Object.keys(this.s.index).length / MINERALS.length) * 100);
      case 'museumCount': return this.s.museum.items.filter(Boolean).length;
      case 'rebirths': return this.s.rebirths;
      default: return st[a.stat] || 0;
    }
  }
  claimableAchievements() {
    return ACHIEVEMENTS.filter((a) => !this.s.achievements[a.id] && this.achievementProgress(a) >= a.n);
  }
  claimAchievement(id) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || this.s.achievements[id] || this.achievementProgress(a) < a.n) return false;
    this.s.achievements[id] = Date.now();
    this.grant({ shards: a.shards }, `Achievement: ${a.title}`);
    this.emit('quests');
    return true;
  }

  loginAvailable() {
    return this.s.login.last !== todayKey(new Date(this.now));
  }
  loginDay() {
    const today = new Date(this.now);
    const y = new Date(this.now - 86400000);
    const cont = this.s.login.last === todayKey(y);
    const streak = cont ? this.s.login.streak + 1 : 1;
    return { streak, reward: DAILY_LOGIN[(streak - 1) % DAILY_LOGIN.length], today: todayKey(today) };
  }
  claimLogin() {
    if (!this.loginAvailable()) return null;
    const { streak, reward, today } = this.loginDay();
    this.s.login = { last: today, streak };
    this.grant(reward, `Daily reward (day ${streak})`);
    return reward;
  }

  redeemCode(code) {
    const c = String(code || '').trim().toUpperCase();
    const reward = CODES[c];
    if (!reward) { this.toast('Invalid code', 'warn'); return false; }
    if (this.s.codes[c]) { this.toast('Code already redeemed', 'warn'); return false; }
    this.s.codes[c] = 1;
    this.grant(reward, `Code ${c}`);
    return true;
  }

  grant(reward, why) {
    const parts = [];
    if (reward.cash) { this.s.cash += reward.cash; parts.push(fmtCash(reward.cash)); this.emit('cash'); }
    if (reward.shards) { this.s.shards += reward.shards; parts.push(`${reward.shards} shards`); this.emit('shards'); }
    if (reward.items) {
      for (const [id, n] of Object.entries(reward.items)) {
        this.s.items[id] = (this.s.items[id] || 0) + n;
        parts.push(`${n}× ${consumableDef(id)?.name || id}`);
      }
      this.emit('items');
    }
    if (reward.xp) this.addXp(reward.xp);
    this.emit('reward', { why, parts, reward });
  }

  // ── rebirth ─────────────────────────────────────────────────────────
  rebirthInfo() {
    const cost = rebirthCost(this.s.rebirths);
    return {
      cost, level: REBIRTH_LEVEL,
      can: this.s.cash >= cost && this.s.level >= REBIRTH_LEVEL,
      next: { luck: 1 + 0.5 * (this.s.rebirths + 1), sell: 1 + 0.25 * (this.s.rebirths + 1) },
    };
  }
  rebirth() {
    const info = this.rebirthInfo();
    if (!info.can) return false;
    const s = this.s;
    s.rebirths++;
    s.cash = 0;
    s.pans = ['rusty']; s.pan = 'rusty';
    s.shovels = ['rusty']; s.shovel = 'rusty';
    s.enchants = {};
    s.shores = ['rubble']; s.shore = 'rubble';
    s.bag = s.bag.filter((i) => i.lock);
    s.totems = [];
    s.sluices = []; s.placed = [];
    s.outfits = [];
    s.bagSize = 30; s.bagUpgrades = 0;
    s.pending = { sed: 0, qsum: 0, total: 0, glints: 0 };
    s.quests.npc = {};
    s.sluiceSlots = Math.max(s.sluiceSlots, Math.min(SLUICE_SLOTS_MAX, 1 + s.rebirths));
    this.phase = 'dig';
    this.ensureQuestState();
    this.invalidate();
    this.pushChat({ kind: 'announce', text: `${s.name} has been reborn! (Rebirth ${s.rebirths})`, color: '#fff59d' });
    this.emit('rebirth', s.rebirths);
    for (const ev of ['cash', 'bag', 'gear', 'travel', 'quests', 'sluice']) this.emit(ev, s.shore);
    this.save();
    return true;
  }

  // ── chat & toasts ───────────────────────────────────────────────────
  pushChat(msg) {
    const m = { t: this.now, ...msg };
    this.chatLog.push(m);
    if (this.chatLog.length > 120) this.chatLog.splice(0, this.chatLog.length - 120);
    this.emit('chat', m);
  }
  say(text) {
    text = String(text || '').trim().slice(0, 120);
    if (!text) return;
    this.pushChat({ kind: 'player', who: this.s.name, text, color: '#ffffff', me: true });
    this.s.stats.chats++;
    this.track('chat', { n: 1 });
    if (this.bots) this.bots.onPlayerChat(text);
  }
  toast(text, kind = 'info') { this.emit('toast', { text, kind }); }

  // ── offline progress (called once on load) ──────────────────────────
  catchUp() {
    const away = (Date.now() - (this.s.lastSeen || Date.now())) / 1000;
    this.now = Date.now();
    const gained = this.tickSluices(true);
    return { away, gained };
  }

  // Helpers for UI
  itemValue(it) { return this.sellValue(it); }
  bagValue() { return this.s.bag.reduce((a, it) => a + (it.lock ? 0 : this.sellValue(it)), 0); }
  nextPan() { return PANS.find((p) => !this.s.pans.includes(p.id)); }
  nextShovel() { return SHOVELS.find((p) => !this.s.shovels.includes(p.id)); }
  bestPanIndex() { return Math.max(...this.s.pans.map((id) => PAN_INDEX[id] ?? 0)); }
  shoreCompletion(id) { return shoreCompletion(this.s, SHORE[id]); }
  tierOfItem(it) { return TIERS[tierRank(it)]; }
}

export function goalTarget(goal) {
  if (goal.type === 'own' || goal.type === 'travel') return 1;
  return goal.n || 1;
}

function applyGoal(goal, p, type, data, state) {
  const g = goal;
  switch (g.type) {
    case 'dig': case 'perfect': case 'pan': case 'sell': case 'earn': case 'museum':
    case 'craft': case 'enchant': case 'potion': case 'totem': case 'sluice': case 'chat':
      return type === g.type ? p + (data.n || 1) : p;
    case 'streak':
      return type === 'streak' ? Math.max(p, data.n) : p;
    case 'find':
      return type === 'find' && data.item.m === g.m ? p + 1 : p;
    case 'findTier':
      return type === 'find' && TIER_INDEX[MINERAL[data.item.m].tier] >= TIER_INDEX[g.tier] ? p + 1 : p;
    case 'findMod':
      return type === 'find' && data.item.mod && (!g.mod || data.item.mod === g.mod) ? p + 1 : p;
    case 'findKg':
      return type === 'find' && data.item.kg >= g.kg && (!g.m || data.item.m === g.m) ? p + 1 : p;
    case 'findAt':
      return type === 'find' && state.shore === g.shore && TIER_INDEX[MINERAL[data.item.m].tier] >= TIER_INDEX[g.tier] ? p + 1 : p;
    default:
      return p;
  }
}

export { pick };
