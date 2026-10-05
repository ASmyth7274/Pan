// Panel (sheet) renderers and their actions. Each panel returns
// { title, icon, sub, tabs, body, foot, small, static } from render().
import { icon } from './icons.js';
import { iconURL } from '../render/icons.js';
import { drawCharacter } from '../render/character.js';
import { fmtCash, fmtNum, fmtKg, fmtTime, fmtPct, fmtOdds, escapeHtml, clamp, todayKey } from '../util.js';
import { MINERAL, MINERALS } from '../data/minerals.js';
import { TIERS, TIER_INDEX, tierOf, modOf, MODIFIERS } from '../data/rarity.js';
import { SHORES, SHORE, HAZARDS, MINERAL_SHORES } from '../data/shores.js';
import { PANS, PAN, SHOVELS, SHOVEL, SLUICES, SLUICE } from '../data/gear.js';
import { POTIONS, POTION, TOTEMS, TOTEM, TOKENS, OUTFITS, OUTFIT, ENCHANTS, ENCHANT, RECIPES, RECIPE, STAT_META, consumableDef } from '../data/items.js';
import { NPCS, ACHIEVEMENTS, DAILY_LOGIN } from '../data/quests.js';
import { EVENTS } from '../data/events.js';
import { FEATURES, isUnlocked, bagUpgradeCost, BAG_UPGRADE_MAX, museumSlotCost, ringSlotCost, RING_SLOTS_MAX, sluiceSlotCost, SLUICE_SLOTS_MAX, reforgeCost, scaledCash } from '../progression.js';
import { goalTarget } from '../game.js';
import { museumBoost } from '../stats.js';
import { baseValue, tierChances } from '../loot.js';
import { exportSave, importSave, wipeSave, saveState } from '../state.js';
import { SKINS, SHIRTS, PANTS } from '../data/bots.js';
import { MUSEUM_MAX } from '../state.js';

// ── small render helpers ─────────────────────────────────────────────────
const STAT_ORDER = ['luck', 'capacity', 'shakeStrength', 'shakeSpeed', 'digStrength', 'digSpeed', 'sizeBoost', 'modBoost', 'sellBoost', 'items', 'walkSpeed'];

function fmtStatVal(k, v) {
  if (STAT_META[k]?.mult) return '×' + (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  if (k === 'shakeSpeed' || k === 'digSpeed' || k === 'walkSpeed') return (Math.round(v * 100) / 100).toString();
  return fmtNum(v);
}

function chip(k, text, extra = '') {
  const m = STAT_META[k] || { icon: 'info', color: '#ccc' };
  return `<span class="chip" style="color:${m.color}" title="${m.name || k}">${icon(m.icon)} ${text}${extra}</span>`;
}

function delta(a, b) {
  if (b === undefined || Math.abs(a - b) < 1e-9) return '';
  return a > b ? ' <span class="up">▲</span>' : ' <span class="down">▼</span>';
}

function priceHtml(price) {
  if (!price) return '';
  if (price.cash !== undefined) return `${fmtCash(price.cash)}`;
  return `${icon('shard')} ${fmtNum(price.shards)}`;
}

function buyBtn(g, price, act, attrs = '', label) {
  const can = g.canAfford(price);
  const cls = price.shards !== undefined ? 'shard' : 'gold';
  return `<button class="btn ${cls} ${can ? '' : 'cant'}" data-act="${act}" ${attrs}>${label ? label + ' ' : ''}${priceHtml(price)}</button>`;
}

function tierTag(tierId) {
  const t = tierOf(tierId);
  return `<span class="tag" style="background:${t.color}22;color:${t.color}">${t.name}</span>`;
}

function itemName(it) {
  const m = MINERAL[it.m];
  const mod = modOf(it.mod);
  return `${mod ? `<span style="color:${mod.color}">${mod.name}</span> ` : ''}${escapeHtml(m.name)}`;
}

function boostText(item) {
  return museumBoost(item).map(({ stat, v }) => `+${(v * 100).toFixed(1)}% ${STAT_META[stat]?.name || stat}`).join(', ');
}

function mineralTile(g, it, act = 'item', extra = '') {
  const m = MINERAL[it.m];
  const mod = modOf(it.mod);
  return `<button class="tile rar-${m.tier}" data-act="${act}" data-u="${it.u}" ${extra}>
    <div class="ti ricon ${m.glow ? 'glowing' : ''}"><img src="${iconURL('mineral', it.m)}" alt="${escapeHtml(m.name)}" loading="lazy"></div>
    <div class="tw">${fmtKg(it.kg)}</div>
    ${mod ? `<span class="mod-dot" style="color:${mod.color}">${mod.name}</span>` : ''}
    ${it.lock ? `<span class="lock">${icon('lock')}</span>` : ''}
    ${it.size ? `<span class="size-tag ${it.size}">${it.size.toUpperCase()}</span>` : ''}
    ${it.isNew ? '<span class="new">NEW</span>' : ''}
  </button>`;
}

function progressBar(p, n, cls = '') {
  const k = n > 0 ? clamp(p / n, 0, 1) : 0;
  return `<div class="progress ${cls}"><i style="width:${(k * 100).toFixed(1)}%"></i></div>`;
}

function rewardChips(r) {
  const out = [];
  if (r.cash) out.push(`<span class="chip gold-t">${icon('coin')} ${fmtCash(r.cash)}</span>`);
  if (r.shards) out.push(`<span class="chip shard-t">${icon('shard')} ${r.shards}</span>`);
  if (r.items) for (const [id, n] of Object.entries(r.items)) out.push(`<span class="chip">${n}× ${escapeHtml(consumableDef(id)?.name || id)}</span>`);
  return out.join('');
}

function goalText(goal) {
  switch (goal.type) {
    case 'pan': return `Pan ${goal.n} times`;
    case 'dig': return `Dig ${goal.n} times`;
    case 'perfect': return `Get ${goal.n} Perfect digs`;
    case 'findTier': return `Find ${goal.n} ${tierOf(goal.tier).name}+ minerals`;
    case 'findMod': return `Find ${goal.n} modified minerals`;
    case 'earn': return `Earn ${fmtCash(goal.n)} selling`;
    case 'sell': return `Sell ${goal.n} minerals`;
    case 'streak': return `Reach a Perfect streak of ${goal.n}`;
    default: return '';
  }
}

function sheetSub(g) {
  return `<span class="gold-t">${fmtCash(g.s.cash)}</span><span class="shard-t">${icon('shard')} ${fmtNum(g.s.shards)}</span>`;
}

function npcBadge(npc) {
  return `<div class="card-icon" style="background:${npc.color}26;color:${npc.color};font-size:26px">${icon('users')}</div>`;
}

// ── panels ───────────────────────────────────────────────────────────────
export const PANELS = {};

PANELS.bag = {
  defaultTab: 'minerals',
  render(ui, e) {
    const g = ui.g, s = g.s;
    const tabs = [
      { id: 'minerals', label: `Minerals ${s.bag.length}/${s.bagSize}` },
      { id: 'items', label: `Items`, badge: Object.values(s.items).reduce((a, b) => a + b, 0) || '' },
      { id: 'gear', label: 'Gear' },
    ];
    let body = '', foot = '';
    if (e.tab === 'items') {
      const ids = Object.keys(s.items).filter((id) => s.items[id] > 0);
      body = ids.length ? `<div class="list">${ids.map((id) => {
        const d = consumableDef(id);
        if (!d) return '';
        const kind = POTION[id] || d.potion ? 'Potion' : TOTEM[id] ? 'Totem' : id.startsWith('book:') ? 'Enchant Book' : 'Token';
        const usable = id !== 'enchantScroll' && id !== 'reforgeToken';
        return `<div class="card"><div class="card-icon"><img src="${iconURL('item', id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(d.name)} <span class="tag">×${s.items[id]}</span></div>
          <div class="card-sub">${kind} · ${escapeHtml(d.desc)}${d.dur ? ` · ${fmtTime(d.dur * 1000)}` : ''}</div></div>
          <div class="card-side">${usable ? `<button class="btn green" data-act="useItem" data-id="${id}">${TOTEM[id] ? 'Place' : id.startsWith('book:') ? 'Apply' : 'Use'}</button>` : `<span class="muted" style="font-size:12px;max-width:80px;text-align:center">${id === 'enchantScroll' ? 'Use at the Enchanting Altar' : 'Use in Crafting'}</span>`}</div></div>`;
      }).join('')}</div>` : `<div class="empty">${icon('flask')}No items yet. Buy potions & totems in the Shop, or earn them from quests.</div>`;
    } else if (e.tab === 'gear') {
      body = `<div class="section-title">Pans</div><div class="list">${s.pans.map((id) => {
        const p = PAN[id];
        const ench = ENCHANT[s.enchants[id]];
        return `<div class="card ${s.pan === id ? 'hi' : ''}"><div class="card-icon"><img src="${iconURL('pan', id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)} ${s.pan === id ? '<span class="tag gold">EQUIPPED</span>' : ''}</div>
          <div class="chips">${chip('luck', fmtNum(p.luck))}${chip('capacity', fmtNum(p.capacity))}${chip('shakeStrength', p.shakeStrength)}${chip('shakeSpeed', p.shakeSpeed)}</div>
          ${ench ? `<div class="card-sub" style="color:#d58bff">${icon('wand')} ${ench.name}: ${ench.desc}</div>` : ''}</div>
          <div class="card-side">${s.pan === id ? '' : `<button class="btn" data-act="equipPan" data-id="${id}">Equip</button>`}</div></div>`;
      }).join('')}</div>
      <div class="section-title">Shovels</div><div class="list">${s.shovels.map((id) => {
        const p = SHOVEL[id];
        return `<div class="card ${s.shovel === id ? 'hi' : ''}"><div class="card-icon"><img src="${iconURL('shovel', id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)} ${s.shovel === id ? '<span class="tag gold">EQUIPPED</span>' : ''}</div>
          <div class="chips">${chip('digStrength', p.digStrength)}${chip('digSpeed', p.digSpeed)}${chip('toughness', 'T' + p.toughness)}</div></div>
          <div class="card-side">${s.shovel === id ? '' : `<button class="btn" data-act="equipShovel" data-id="${id}">Equip</button>`}</div></div>`;
      }).join('')}</div>`;
    } else {
      let items = s.bag.slice();
      if (ui.bagFilter === 'unlocked') items = items.filter((i) => !i.lock);
      if (ui.bagFilter === 'locked') items = items.filter((i) => i.lock);
      if (ui.bagFilter === 'mods') items = items.filter((i) => i.mod);
      const sorters = {
        value: (a, b) => baseValue(b) - baseValue(a),
        rarity: (a, b) => TIER_INDEX[MINERAL[b.m].tier] - TIER_INDEX[MINERAL[a.m].tier] || baseValue(b) - baseValue(a),
        new: (a, b) => b.t - a.t,
        weight: (a, b) => b.kg - a.kg,
      };
      items.sort(sorters[ui.bagSort] || sorters.value);
      const unlockedVal = g.bagValue();
      body = `<div class="bag-tools">
          <div class="seg">${['value', 'rarity', 'new', 'weight'].map((k) => `<button class="${ui.bagSort === k ? 'on' : ''}" data-act="bagSort" data-k="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
          <div class="seg">${[['all', 'All'], ['unlocked', 'Unlocked'], ['locked', icon('lock')], ['mods', icon('sparkle')]].map(([k, l]) => `<button class="${ui.bagFilter === k ? 'on' : ''}" data-act="bagFilter" data-k="${k}">${l}</button>`).join('')}</div>
        </div>
        ${items.length ? `<div class="grid">${items.map((it) => mineralTile(g, it)).join('')}</div>` : `<div class="empty">${icon('bag')}Nothing here yet — dig and pan to find minerals!</div>`}
        <div class="note">${icon('info')} Tap a mineral to lock it, sell it, or display it in the Museum. Locked minerals are never sold by "Sell all". Legendary+ finds are locked automatically.</div>`;
      foot = `<button class="btn small" data-act="sellTier" data-t="0">Sell Commons</button>
        <button class="btn small" data-act="sellTier" data-t="1">≤ Uncommon</button>
        <button class="btn gold grow" data-act="sellAll" ${unlockedVal > 0 ? '' : 'disabled'}>Sell all ${fmtCash(unlockedVal)}</button>`;
      for (const it of s.bag) delete it.isNew;
    }
    return { title: 'Bag', icon: 'bag', sub: sheetSub(g), tabs, body, foot };
  },
};

PANELS.item = {
  render(ui, e) {
    const g = ui.g;
    const u = e.params.u;
    const it = g.s.bag.find((i) => i.u === u);
    if (!it) return { title: 'Mineral', small: true, body: '<div class="empty">This mineral is gone.</div>' };
    const m = MINERAL[it.m];
    const t = tierOf(m.tier);
    const mod = modOf(it.mod);
    const idx = g.s.index[it.m];
    const shores = (MINERAL_SHORES[it.m] || []).map((id) => SHORE[id].name).join(', ') || 'Anywhere (very rare)';
    const canMuseum = isUnlocked(g.s, 'museum');
    return {
      title: m.name, icon: 'gem', small: true, static: false,
      body: `<div class="detail rar-${m.tier}">
        <div class="di ricon"><img src="${iconURL('mineral', it.m)}" alt=""></div>
        <div class="dn">${itemName(it)}</div>
        <div class="row">${tierTag(m.tier)}${it.size ? `<span class="tag" style="background:#ffb32133;color:#ffb321">${it.size.toUpperCase()}</span>` : ''}${it.lock ? `<span class="tag gold">${icon('lock')} LOCKED</span>` : ''}</div>
        <div class="kv">
          <div><div class="k">Weight</div><div class="v">${fmtKg(it.kg)}</div></div>
          <div><div class="k">Sell value</div><div class="v gold-t">${fmtCash(g.sellValue(it))}</div></div>
          <div><div class="k">Base value</div><div class="v">${fmtCash(m.value)}/kg</div></div>
          <div><div class="k">Modifier</div><div class="v" style="color:${mod ? mod.color : 'inherit'}">${mod ? `${mod.name} ×${mod.mult}` : 'None'}</div></div>
          <div style="grid-column:1/-1"><div class="k">Museum boost</div><div class="v green-t" style="font-size:13.5px">${boostText(it)}</div></div>
          <div style="grid-column:1/-1"><div class="k">Found at</div><div class="v" style="font-size:13.5px">${escapeHtml(shores)}</div></div>
          ${idx ? `<div><div class="k">Times found</div><div class="v">${fmtNum(idx.n)}</div></div><div><div class="k">Heaviest</div><div class="v">${fmtKg(idx.best)}</div></div>` : ''}
        </div></div>`,
      foot: `<button class="btn" data-act="lock" data-u="${u}">${icon(it.lock ? 'unlock' : 'lock')} ${it.lock ? 'Unlock' : 'Lock'}</button>
        ${canMuseum ? `<button class="btn" data-act="museumQuick" data-u="${u}">${icon('museum')} Display</button>` : ''}
        <button class="btn gold grow" data-act="sellOne" data-u="${u}" ${it.lock ? 'disabled' : ''}>Sell ${fmtCash(g.sellValue(it))}</button>`,
    };
  },
};

PANELS.shop = {
  defaultTab: 'pans',
  render(ui, e) {
    const g = ui.g, s = g.s;
    const st = g.stats();
    const tabs = [
      { id: 'pans', label: 'Pans' }, { id: 'shovels', label: 'Shovels' }, { id: 'potions', label: 'Potions' },
      { id: 'totems', label: 'Totems' }, { id: 'sluices', label: 'Sluices' }, { id: 'outfitter', label: 'Outfitter' }, { id: 'upgrades', label: 'Upgrades' },
    ];
    let body = '';
    const cur = PAN[s.pan];
    if (e.tab === 'pans') {
      body = `<div class="list">${PANS.map((p) => {
        const owned = s.pans.includes(p.id);
        const locked = p.req && s.rebirths < p.req.rebirths;
        const pas = p.passive ? Object.entries(p.passive).map(([k, v]) => chip(k, `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`)).join('') : '';
        const side = owned ? (s.pan === p.id ? '<span class="tag gold">EQUIPPED</span>' : `<button class="btn" data-act="equipPan" data-id="${p.id}">Equip</button>`)
          : locked ? `<span class="tag red">Rebirth ${p.req.rebirths}</span>` : buyBtn(g, { cash: p.price }, 'buyPan', `data-id="${p.id}"`);
        return `<div class="card ${s.pan === p.id ? 'hi' : ''} ${locked ? 'dim' : ''}"><div class="card-icon"><img src="${iconURL('pan', p.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)}</div>
          <div class="chips">${chip('luck', fmtNum(p.luck), delta(p.luck, cur.luck))}${chip('capacity', fmtNum(p.capacity), delta(p.capacity, cur.capacity))}${chip('shakeStrength', p.shakeStrength, delta(p.shakeStrength, cur.shakeStrength))}${chip('shakeSpeed', p.shakeSpeed, delta(p.shakeSpeed, cur.shakeSpeed))}${pas}</div>
          ${p.immune ? `<div class="card-sub green-t">${icon('shield')} Immune to ${p.immune.map((h) => HAZARDS[h].name).join(', ')}</div>` : ''}</div>
          <div class="card-side">${side}</div></div>`;
      }).join('')}</div>`;
    } else if (e.tab === 'shovels') {
      const curS = SHOVEL[s.shovel];
      body = `<div class="list">${SHOVELS.map((p) => {
        const owned = s.shovels.includes(p.id);
        const locked = p.req && s.rebirths < p.req.rebirths;
        const opens = SHORES.filter((sh) => sh.req.toughness === p.toughness).map((sh) => sh.name);
        const side = owned ? (s.shovel === p.id ? '<span class="tag gold">EQUIPPED</span>' : `<button class="btn" data-act="equipShovel" data-id="${p.id}">Equip</button>`)
          : locked ? `<span class="tag red">Rebirth ${p.req.rebirths}</span>` : buyBtn(g, { cash: p.price }, 'buyShovel', `data-id="${p.id}"`);
        return `<div class="card ${s.shovel === p.id ? 'hi' : ''} ${locked ? 'dim' : ''}"><div class="card-icon"><img src="${iconURL('shovel', p.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)}</div>
          <div class="chips">${chip('digStrength', p.digStrength, delta(p.digStrength, curS.digStrength))}${chip('digSpeed', p.digSpeed, delta(p.digSpeed, curS.digSpeed))}${chip('toughness', 'T' + p.toughness, delta(p.toughness, curS.toughness))}</div>
          ${opens.length && p.toughness > curS.toughness ? `<div class="card-sub">Toughness ${p.toughness} opens: ${opens.join(', ')}</div>` : ''}</div>
          <div class="card-side">${side}</div></div>`;
      }).join('')}</div>`;
    } else if (e.tab === 'potions') {
      body = `<div class="note">${icon('info')} Potions stack their duration and only tick while you play. Cash prices scale with your best pan.</div><div class="list">${POTIONS.map((p) => {
        const price = g.priceOf(p.cost);
        const have = s.items[p.id] || 0;
        const active = s.buffs.find((b) => b.id === p.id);
        return `<div class="card"><div class="card-icon"><img src="${iconURL('item', p.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)} ${have ? `<span class="tag">×${have}</span>` : ''} ${active ? `<span class="tag green">${fmtTime(active.left)}</span>` : ''}</div>
          <div class="card-sub">${escapeHtml(p.desc)} · ${fmtTime(p.dur * 1000)}</div></div>
          <div class="card-side">${buyBtn(g, price, 'buyItem', `data-id="${p.id}"`)}${have ? `<button class="btn small green" data-act="useItem" data-id="${p.id}">Use</button>` : ''}</div></div>`;
      }).join('')}</div>`;
    } else if (e.tab === 'totems') {
      const locked = !isUnlocked(s, 'totems');
      body = `<div class="note">${icon('info')} Totems power up everyone standing at the shore where they're placed — including you when other players place them! ${locked ? `<b class="red-t">Unlocks at level ${FEATURES.totems.level}.</b>` : ''}</div><div class="list">${TOTEMS.map((p) => {
        const have = s.items[p.id] || 0;
        return `<div class="card ${locked ? 'dim' : ''}"><div class="card-icon"><img src="${iconURL('item', p.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)} ${have ? `<span class="tag">×${have}</span>` : ''}</div>
          <div class="card-sub">${escapeHtml(p.desc)} · ${fmtTime(p.dur * 1000)}</div></div>
          <div class="card-side">${buyBtn(g, p.cost, 'buyItem', `data-id="${p.id}"`)}${have && !locked ? `<button class="btn small green" data-act="useItem" data-id="${p.id}">Place here</button>` : ''}</div></div>`;
      }).join('')}</div>`;
    } else if (e.tab === 'sluices') {
      const locked = !isUnlocked(s, 'sluice');
      body = `<div class="note">${icon('sluice')} Sluices sift a shore for you — even while you're offline (up to 8h). ${locked ? `<b class="red-t">Unlocks at level ${FEATURES.sluice.level}.</b>` : ''} <button class="btn small" data-act="open" data-id="sluice" data-stack="1" style="margin-top:6px">Manage sluices</button></div><div class="list">${SLUICES.map((p) => {
        const owned = s.sluices.includes(p.id);
        return `<div class="card ${locked ? 'dim' : ''}"><div class="card-icon"><img src="${iconURL('sluice', p.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(p.name)}</div>
          <div class="chips">${chip('luck', p.luck)}${chip('capacity', p.capacity + ' tray')}${chip('speed', '1 / ' + p.interval + 's')}${chip('toughness', 'T' + p.toughness)}</div></div>
          <div class="card-side">${owned ? '<span class="tag green">OWNED</span>' : buyBtn(g, { cash: p.price }, 'buySluice', `data-id="${p.id}"`)}</div></div>`;
      }).join('')}</div>`;
    } else if (e.tab === 'outfitter') {
      body = `<div class="note">${icon('shield')} Some shores have hazards that weaken you. Outfits protect you permanently.</div><div class="list">${OUTFITS.map((o) => {
        const hz = HAZARDS[o.hazard];
        const shores = SHORES.filter((sh) => sh.hazard === o.hazard).map((sh) => sh.name).join(', ');
        const owned = s.outfits.includes(o.id);
        return `<div class="card"><div class="card-icon"><img src="${iconURL('outfit', o.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(o.name)}</div>
          <div class="card-sub">Protects from <b class="red-t">${hz.name}</b> (${hz.desc}) at ${escapeHtml(shores)}</div></div>
          <div class="card-side">${owned ? '<span class="tag green">OWNED</span>' : buyBtn(g, { cash: o.price }, 'buyOutfit', `data-id="${o.id}"`)}</div></div>`;
      }).join('')}</div>`;
    } else {
      const bagN = s.bagUpgrades;
      const rings = s.equipped.rings.length;
      body = `<div class="list">
        <div class="card"><div class="card-icon" style="font-size:30px;color:var(--gold)">${icon('bag')}</div><div class="card-main"><div class="card-title">Bigger Bag</div><div class="card-sub">+10 mineral slots (${s.bagSize} now) · ${bagN}/${BAG_UPGRADE_MAX}</div></div>
          <div class="card-side">${bagN >= BAG_UPGRADE_MAX ? '<span class="tag">MAX</span>' : buyBtn(g, { cash: bagUpgradeCost(bagN) }, 'buyBag')}</div></div>
        <div class="card"><div class="card-icon" style="font-size:30px;color:var(--gold)">${icon('museum')}</div><div class="card-main"><div class="card-title">Museum Pedestal</div><div class="card-sub">Display one more mineral (${s.museum.slots}/${MUSEUM_MAX})</div></div>
          <div class="card-side">${s.museum.slots >= MUSEUM_MAX ? '<span class="tag">MAX</span>' : buyBtn(g, { cash: museumSlotCost(s.museum.slots) }, 'buyMuseumSlot')}</div></div>
        <div class="card"><div class="card-icon" style="font-size:30px;color:var(--shard)">${icon('gem')}</div><div class="card-main"><div class="card-title">Ring Slot</div><div class="card-sub">Wear one more crafted ring (${rings}/${RING_SLOTS_MAX})</div></div>
          <div class="card-side">${rings >= RING_SLOTS_MAX ? '<span class="tag">MAX</span>' : buyBtn(g, { shards: ringSlotCost(rings) }, 'buyRing')}</div></div>
        <div class="card"><div class="card-icon" style="font-size:30px;color:var(--shard)">${icon('sluice')}</div><div class="card-main"><div class="card-title">Sluice Slot</div><div class="card-sub">Run one more sluice at once (${s.sluiceSlots}/${SLUICE_SLOTS_MAX})</div></div>
          <div class="card-side">${s.sluiceSlots >= SLUICE_SLOTS_MAX ? '<span class="tag">MAX</span>' : buyBtn(g, { shards: sluiceSlotCost(s.sluiceSlots) }, 'buySluiceSlot')}</div></div>
      </div>`;
    }
    return { title: 'Shop', icon: 'shop', sub: sheetSub(g), tabs, body };
  },
};

function shoreArt(sh) {
  const t = sh.theme;
  const sun = t.cave ? '#7fdbff' : t.noSun ? '#ff6fd8' : '#fff4c2';
  return `background:
    radial-gradient(circle at 78% 30%, ${sun} 0 7%, transparent 8%),
    linear-gradient(98deg, transparent 54%, ${t.water.a} 54.5%, ${t.water.b} 100%) bottom / 100% 40% no-repeat,
    linear-gradient(180deg, ${t.sky.day[0]}, ${t.sky.day[1]} 52%, ${t.far.color} 52.5%, ${t.mid.color} 62%, ${t.ground.top} 62.5%, ${t.ground.body} 100%)`;
}

PANELS.map = {
  render(ui) {
    const g = ui.g, s = g.s;
    const cards = SHORES.map((sh) => {
      const st = g.shoreStatus(sh.id);
      const players = g.bots ? g.bots.countAt(sh.id) : 0;
      const hz = sh.hazard ? HAZARDS[sh.hazard] : null;
      const prot = hz && (s.outfits.includes(hz.counter) || PAN[s.pan]?.immune?.includes(sh.hazard));
      const evs = g.events.filter((e) => (e.def.rift ? e.shore === sh.id : e.def.at?.tag && sh.tags.includes(e.def.at.tag)));
      const comp = g.shoreCompletion(sh.id);
      const preview = Object.values(sh.pools).flat().slice(0, 7).map(({ id }) => {
        const known = s.index[id];
        return `<img src="${iconURL('mineral', id)}" alt="" style="width:30px;height:30px;${known ? '' : 'filter:brightness(0) opacity(.35)'}">`;
      }).join('');
      let action;
      if (st.here) action = '<span class="tag gold">YOU ARE HERE</span>';
      else if (st.unlocked) action = `<button class="btn green" data-act="travel" data-id="${sh.id}">Travel ${icon('arrow')}</button>`;
      else if (st.needs.length) action = `<button class="btn cant" data-act="travel" data-id="${sh.id}">${icon('lock')} Locked</button>`;
      else action = buyBtn(g, { cash: sh.req.cost }, 'travel', `data-id="${sh.id}"`, 'Unlock');
      return `<div class="shore-card ${st.here ? 'here' : ''} ${!st.unlocked && st.needs.length ? 'locked' : ''}">
        <div class="shore-art" style="${shoreArt(sh)}">
          <div class="sname">${escapeHtml(sh.name)}</div>
          <div class="badges">${evs.map((e) => `<span class="tag" style="background:${e.def.color};color:#111">${icon(e.def.icon)} ${escapeHtml(e.def.name)}</span>`).join('')}<span class="tag" style="background:rgba(0,0,0,.5)">${icon('users')} ${players}</span></div>
        </div>
        <div class="shore-info">
          <div class="card-sub">${escapeHtml(sh.blurb)}</div>
          <div class="row" style="gap:2px;flex-wrap:wrap">${preview}</div>
          <div class="chips">
            ${hz ? `<span class="chip" style="color:${prot ? 'var(--green)' : 'var(--red)'}">${icon(prot ? 'shield' : 'warn')} ${hz.name}${prot ? ' (protected)' : ': ' + hz.desc}</span>` : '<span class="chip green-t">' + icon('shield') + ' No hazards</span>'}
            <span class="chip">${icon('index')} ${comp.have}/${comp.total}${comp.done ? ' ✓' : ''}</span>
            ${!st.unlocked ? `<span class="chip ${g.stats().toughness >= sh.req.toughness ? 'green-t' : 'red-t'}">${icon('shovel')} Toughness ${sh.req.toughness}</span><span class="chip ${s.level >= sh.req.level ? 'green-t' : 'red-t'}">Lv ${sh.req.level}</span>${sh.req.rebirths ? `<span class="chip ${s.rebirths >= sh.req.rebirths ? 'green-t' : 'red-t'}">Rebirth ${sh.req.rebirths}</span>` : ''}` : ''}
          </div>
          <div class="row"><span class="muted grow" style="font-size:12.5px">${st.needs.length ? 'Requires ' + st.needs.join(', ') : ''}</span>${action}</div>
        </div></div>`;
    }).join('');
    return { title: 'Map', icon: 'map', sub: sheetSub(g), body: cards };
  },
};

PANELS.quests = {
  defaultTab: 'story',
  render(ui, e) {
    const g = ui.g, s = g.s;
    const storyReady = g.activeQuests().filter((q) => q.done).length;
    const dailyReady = s.quests.daily.list.filter((d) => !d.claimed && d.p >= goalTarget(d.goal)).length + (g.loginAvailable() ? 1 : 0);
    const achReady = g.claimableAchievements().length;
    const tabs = [
      { id: 'story', label: 'Story', badge: storyReady || '' },
      { id: 'daily', label: 'Daily', badge: dailyReady || '' },
      { id: 'achievements', label: 'Achievements', badge: achReady || '' },
    ];
    let body = '';
    if (e.tab === 'daily') {
      const ld = g.loginDay();
      const avail = g.loginAvailable();
      const curDay = avail ? ld.streak : s.login.streak;
      const days = DAILY_LOGIN.map((r, i) => {
        const dayN = i + 1;
        const cyc = ((curDay - 1) % 7) + 1;
        const cls = dayN === cyc && avail ? 'today' : dayN < cyc || (dayN === cyc && !avail) ? 'done' : '';
        return `<div class="${cls}"><b>Day ${dayN}</b><br>${r.shards ? `${icon('shard')}${r.shards}` : ''}${r.items ? icon('gift') : ''}</div>`;
      }).join('');
      const tomorrow = new Date(g.now); tomorrow.setHours(24, 0, 0, 0);
      body = `<div class="card" style="flex-direction:column;align-items:stretch">
          <div class="row"><div class="card-title grow">${icon('gift')} Daily Login Reward</div>${avail ? `<button class="btn gold" data-act="claimLogin">Claim day ${ld.streak}</button>` : `<span class="muted" style="font-size:12.5px">Next in ${fmtTime(tomorrow - g.now)}</span>`}</div>
          <div class="login-days">${days}</div>
        </div>
        <div class="section-title">Today's quests <span class="r muted">New in ${fmtTime(tomorrow - g.now)}</span></div>
        <div class="list">${s.quests.daily.list.map((d, i) => {
          const n = goalTarget(d.goal);
          const done = d.p >= n;
          return `<div class="card"><div class="card-icon" style="color:var(--gold);font-size:26px">${icon(d.claimed ? 'check' : 'quests')}</div>
            <div class="card-main"><div class="card-title">${escapeHtml(d.title)}</div><div class="card-sub">${goalText(d.goal)}</div>
            ${progressBar(d.p, n, done ? 'green' : '')}<div class="chips">${rewardChips(d.reward)}<span class="chip">${fmtNum(Math.min(d.p, n))}/${fmtNum(n)}</span></div></div>
            <div class="card-side">${d.claimed ? '<span class="tag green">CLAIMED</span>' : `<button class="btn ${done ? 'gold' : 'cant'}" data-act="claimDaily" data-i="${i}" ${done ? '' : 'disabled'}>Claim</button>`}</div></div>`;
        }).join('')}</div>`;
    } else if (e.tab === 'achievements') {
      const list = ACHIEVEMENTS.map((a) => ({ a, p: g.achievementProgress(a), claimed: !!s.achievements[a.id] }));
      list.sort((x, y) => (y.p >= y.a.n && !y.claimed) - (x.p >= x.a.n && !x.claimed) || x.claimed - y.claimed || (y.p / y.a.n) - (x.p / x.a.n));
      body = `<div class="note">${icon('trophy')} ${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length} achievements · earned titles can be shown above your name (Settings).</div><div class="list">${list.map(({ a, p, claimed }) => {
        const done = p >= a.n;
        return `<div class="card ${claimed ? 'dim' : ''}"><div class="card-icon" style="color:${claimed ? 'var(--green)' : 'var(--gold)'};font-size:26px">${icon(claimed ? 'check' : 'trophy')}</div>
          <div class="card-main"><div class="card-title">${escapeHtml(a.title)}</div><div class="card-sub">${escapeHtml(a.text)}</div>
          ${claimed ? '' : progressBar(p, a.n, done ? 'green' : '')}</div>
          <div class="card-side">${claimed ? '<span class="tag green">DONE</span>' : `<button class="btn ${done ? 'shard' : 'cant'}" data-act="claimAch" data-id="${a.id}" ${done ? '' : 'disabled'}>${icon('shard')} ${a.shards}</button>`}</div></div>`;
      }).join('')}</div>`;
    } else {
      body = `<div class="list">${NPCS.map((npc) => {
        const st = s.quests.npc[npc.id];
        const shore = SHORE[npc.shore];
        if (!st) return `<div class="card dim">${npcBadge(npc)}<div class="card-main"><div class="card-title">${escapeHtml(npc.name)}</div><div class="card-sub">Unlock ${escapeHtml(shore.name)} to meet ${escapeHtml(npc.name)}.</div></div><div class="card-side">${icon('lock')}</div></div>`;
        const q = npc.quests[st.i];
        if (!q) return `<div class="card">${npcBadge(npc)}<div class="card-main"><div class="card-title">${escapeHtml(npc.name)}</div><div class="card-sub green-t">${icon('check')} All ${npc.quests.length} quests complete!</div></div></div>`;
        const n = goalTarget(q.goal);
        const done = st.p >= n;
        return `<div class="card ${done ? 'hi' : ''}">${npcBadge(npc)}
          <div class="card-main"><div class="card-title">${escapeHtml(q.title)} <span class="tag">${st.i + 1}/${npc.quests.length}</span></div>
          <div class="card-sub">${escapeHtml(npc.name)} · ${escapeHtml(shore.name)}</div>
          <div class="card-sub" style="color:var(--text)">${escapeHtml(q.text)}</div>
          ${progressBar(st.p, n, done ? 'green' : '')}
          <div class="chips">${rewardChips(q.reward)}<span class="chip">${fmtNum(Math.min(st.p, n))}/${fmtNum(n)}</span></div></div>
          <div class="card-side">${done ? `<button class="btn gold" data-act="claimQuest" data-id="${npc.id}">Claim</button>` : ''}</div></div>`;
      }).join('')}</div>`;
    }
    return { title: 'Quests', icon: 'quests', sub: sheetSub(g), tabs, body };
  },
};

PANELS.more = {
  render(ui) {
    const g = ui.g, s = g.s;
    const m = g.merchant();
    const sluiceReady = s.placed.reduce((a, p) => a + p.tray.length, 0);
    const feat = (id, ic, label, sub, req, badge) => {
      const locked = req && !isUnlocked(s, req);
      return `<button class="feature ${locked ? 'locked' : ''}" data-act="open" data-id="${id}" data-stack="1">${icon(locked ? 'lock' : ic)}<span>${label}</span><span class="fs">${locked ? `Level ${FEATURES[req].level}` : sub}</span>${badge ? `<i class="badge show">${badge}</i>` : ''}</button>`;
    };
    const body = `<div class="feature-grid">
      ${feat('museum', 'museum', 'Museum', `${s.museum.items.filter(Boolean).length}/${s.museum.slots} displayed`, 'museum')}
      ${feat('index', 'index', 'Index', `${Object.keys(s.index).length}/${MINERALS.length} found`)}
      ${feat('craft', 'anvil', 'Crafting', `${s.equipment.length} items`, 'crafting')}
      ${feat('enchant', 'wand', 'Enchanting', ENCHANT[s.enchants[s.pan]]?.name || 'No enchant', 'enchant')}
      ${feat('sluice', 'sluice', 'Sluices', sluiceReady ? `${sluiceReady} items ready` : `${s.placed.length}/${s.sluiceSlots} running`, 'sluice', sluiceReady ? sluiceReady : '')}
      ${feat('merchant', 'merchant', 'Merchant', m.present ? `Leaves ${fmtTime(m.leavesAt - g.now)}` : `Arrives ${fmtTime(m.nextAt - g.now)}`)}
      ${feat('leaderboard', 'trophy', 'Leaderboard', 'Top prospectors')}
      ${feat('stats', 'chart', 'Stats', 'Luck & boosts')}
      ${feat('rebirth', 'rebirth', 'Rebirth', s.rebirths ? `Rebirth ${s.rebirths}` : 'Start over stronger')}
      ${feat('chat', 'chat', 'Chat', 'Talk to players')}
      ${feat('events', 'meteor', 'Events', g.events.length ? g.events[0].def.name : 'Schedule')}
      ${feat('settings', 'gear', 'Settings', 'Avatar, sound, save')}
      ${feat('help', 'help', 'How to play', 'Tips & guide')}
    </div>`;
    return { title: 'More', icon: 'more', sub: sheetSub(g), body };
  },
};

PANELS.museum = {
  requires: 'museum',
  render(ui) {
    const g = ui.g, s = g.s;
    const peds = [];
    for (let i = 0; i < MUSEUM_MAX; i++) {
      const it = s.museum.items[i];
      if (i >= s.museum.slots) {
        const next = i === s.museum.slots;
        peds.push(`<div class="ped locked">${icon('lock')}<span class="muted" style="font-size:12px">${next ? 'Unlock' : 'Locked'}</span>${next ? buyBtn(g, { cash: museumSlotCost(s.museum.slots) }, 'buyMuseumSlot') : ''}</div>`);
      } else if (it) {
        const m = MINERAL[it.m];
        peds.push(`<button class="ped rar-${m.tier}" data-act="museumSlot" data-i="${i}"><div class="pi ricon"><img src="${iconURL('mineral', it.m)}" alt=""></div><div class="pn">${itemName(it)}</div><div class="muted" style="font-size:11px">${fmtKg(it.kg)}</div><div class="pb">${boostText(it)}</div><div class="base"></div></button>`);
      } else {
        peds.push(`<button class="ped empty-slot" data-act="museumPick" data-i="${i}">${icon('plus')}<span>Display a mineral</span><div class="base"></div></button>`);
      }
    }
    const totals = {};
    for (const it of s.museum.items) if (it) for (const { stat, v } of museumBoost(it)) totals[stat] = (totals[stat] || 0) + v;
    const sum = Object.entries(totals).map(([k, v]) => chip(k, `+${(v * 100).toFixed(1)}%`)).join('') || '<span class="muted">No boosts yet</span>';
    const body = `<div class="note">${icon('museum')} Displayed minerals give permanent boosts. Rarer and heavier specimens give more; modifiers add a bonus stat. One of each mineral type.</div>
      <div class="section-title">Total boosts</div><div class="chips" style="margin-bottom:10px">${sum}</div>
      <div class="pedestals">${peds.join('')}</div>`;
    return { title: 'Museum', icon: 'museum', sub: sheetSub(g), body };
  },
};

PANELS.museumPick = {
  render(ui, e) {
    const g = ui.g, s = g.s;
    const slot = Number(e.params.i);
    const shown = new Set(s.museum.items.filter(Boolean).map((x) => x.m));
    const cur = s.museum.items[slot];
    const cands = s.bag.filter((it) => !shown.has(it.m) || (cur && cur.m === it.m));
    const score = (it) => museumBoost(it).reduce((a, b) => a + b.v, 0);
    cands.sort((a, b) => score(b) - score(a));
    const body = cands.length ? `<div class="list">${cands.slice(0, 60).map((it) => {
      const m = MINERAL[it.m];
      return `<div class="card rar-${m.tier}"><div class="card-icon ricon"><img src="${iconURL('mineral', it.m)}" alt=""></div>
        <div class="card-main"><div class="card-title">${itemName(it)} ${tierTag(m.tier)}</div><div class="card-sub">${fmtKg(it.kg)}</div><div class="card-sub green-t">${boostText(it)}</div></div>
        <div class="card-side"><button class="btn gold" data-act="museumPlace" data-i="${slot}" data-u="${it.u}">Display</button></div></div>`;
    }).join('')}</div>` : `<div class="empty">${icon('gem')}No eligible minerals in your bag. Each mineral type can only be displayed once.</div>`;
    return { title: `Pedestal ${slot + 1}`, icon: 'museum', body };
  },
};

PANELS.museumSlot = {
  render(ui, e) {
    const g = ui.g;
    const i = Number(e.params.i);
    const it = g.s.museum.items[i];
    if (!it) return { title: 'Pedestal', small: true, body: '<div class="empty">Empty pedestal</div>' };
    const m = MINERAL[it.m];
    return {
      title: m.name, icon: 'museum', small: true,
      body: `<div class="detail rar-${m.tier}"><div class="di ricon"><img src="${iconURL('mineral', it.m)}" alt=""></div><div class="dn">${itemName(it)}</div>${tierTag(m.tier)}
        <div class="kv"><div><div class="k">Weight</div><div class="v">${fmtKg(it.kg)}</div></div><div><div class="k">Value</div><div class="v gold-t">${fmtCash(g.sellValue(it))}</div></div>
        <div style="grid-column:1/-1"><div class="k">Boost</div><div class="v green-t" style="font-size:14px">${boostText(it)}</div></div></div></div>`,
      foot: `<button class="btn grow" data-act="museumPick" data-i="${i}">Swap</button><button class="btn red grow" data-act="museumRemove" data-i="${i}">Take back</button>`,
    };
  },
};

PANELS.index = {
  render(ui, e) {
    const g = ui.g, s = g.s;
    const found = Object.keys(s.index).length;
    const st = g.stats();
    const full = g.fullStats();
    const sections = SHORES.map((sh) => {
      const comp = g.shoreCompletion(sh.id);
      const unlocked = s.shores.includes(sh.id);
      const chances = tierChances(st.luck, sh, full.extra);
      const tiles = [];
      TIERS.forEach((t, ti) => {
        const list = sh.pools[t.id];
        if (!list) return;
        const wsum = list.reduce((a, x) => a + x.w, 0);
        for (const { id, w } of list) {
          const m = MINERAL[id];
          const known = s.index[id];
          const p = chances[ti] * (w / wsum);
          tiles.push(`<button class="tile rar-${m.tier} ${known ? '' : 'unknown'}" data-act="mineralInfo" data-id="${id}" data-shore="${sh.id}">
            <div class="ti ricon"><img src="${iconURL('mineral', id)}" alt="" loading="lazy"></div>
            <div class="tw" style="font-size:10px;text-align:center;line-height:1.1">${known ? escapeHtml(m.name) : '???'}</div>
            <span class="mod-dot" style="color:${t.color}">${unlocked ? fmtOdds(p).replace('1 in ', '1/') : t.short}</span></button>`);
        }
      });
      return `<div class="section-title">${escapeHtml(sh.name)} <span class="r ${comp.done ? 'green-t' : ''}">${comp.have}/${comp.total}${comp.done ? ' · +5% Luck ✓' : ''}</span></div>
        ${progressBar(comp.have, comp.total, comp.done ? 'green' : '')}
        <div class="grid" style="margin-top:8px">${tiles.join('')}</div>`;
    }).join('');
    const cel = MINERALS.filter((m) => m.tier === 'celestial').map((m) => {
      const known = s.index[m.id];
      return `<button class="tile rar-celestial ${known ? '' : 'unknown'}" data-act="mineralInfo" data-id="${m.id}"><div class="ti ricon"><img src="${iconURL('mineral', m.id)}" alt=""></div><div class="tw" style="font-size:10px;text-align:center">${known ? escapeHtml(m.name) : '???'}</div></button>`;
    }).join('');
    const body = `<div class="note">${icon('index')} ${found}/${MINERALS.length} minerals discovered. Completing a shore's collection gives a permanent +5% Luck. Odds shown use your current luck.</div>
      ${sections}<div class="section-title">Celestial (any shore, ultra rare)</div><div class="grid">${cel}</div>`;
    return { title: 'Index', icon: 'index', body };
  },
};

PANELS.mineralInfo = {
  render(ui, e) {
    const g = ui.g, s = g.s;
    const m = MINERAL[e.params.id];
    const known = s.index[m.id];
    const shores = (MINERAL_SHORES[m.id] || []).map((id) => SHORE[id].name).join(', ') || 'Any shore during a Celestial Convergence, or Celestial Shore';
    const mods = known ? Object.keys(known.mods || {}).map((id) => `<span class="chip" style="color:${modOf(id).color}">${modOf(id).name}</span>`).join('') : '';
    return {
      title: known ? m.name : 'Undiscovered', icon: 'index', small: true,
      body: `<div class="detail rar-${m.tier}"><div class="di ricon"><img src="${iconURL('mineral', m.id)}" alt="" style="${known ? '' : 'filter:brightness(0) opacity(.4)'}"></div>
        <div class="dn">${known ? escapeHtml(m.name) : '???'}</div>${tierTag(m.tier)}
        <div class="kv">
          <div><div class="k">Value</div><div class="v">${known ? fmtCash(m.value) + '/kg' : '???'}</div></div>
          <div><div class="k">Typical weight</div><div class="v">${known ? fmtKg(m.kg) : '???'}</div></div>
          <div><div class="k">Times found</div><div class="v">${known ? fmtNum(known.n) : 0}</div></div>
          <div><div class="k">Heaviest</div><div class="v">${known ? fmtKg(known.best) : '—'}</div></div>
          <div style="grid-column:1/-1"><div class="k">Museum stat</div><div class="v">${STAT_META[m.stat]?.name}</div></div>
          <div style="grid-column:1/-1"><div class="k">Where</div><div class="v" style="font-size:13.5px">${escapeHtml(shores)}${m.night > 1 ? ' · more common at night' : ''}${m.day > 1 ? ' · more common by day' : ''}</div></div>
        </div>${mods ? `<div class="chips" style="justify-content:center">${mods}</div>` : ''}</div>`,
    };
  },
};

PANELS.craft = {
  requires: 'crafting',
  defaultTab: 'recipes',
  render(ui, e) {
    const g = ui.g, s = g.s;
    const tabs = [{ id: 'recipes', label: 'Recipes' }, { id: 'equipment', label: `Equipment ${s.equipment.length}` }];
    let body = '';
    const statRange = (k, [lo, hi]) => {
      const pct = STAT_META[k]?.mult || k === 'shakeSpeed' || k === 'digSpeed';
      const f = (v) => (pct ? `${Math.round(v * 100)}%` : fmtNum(v));
      return chip(k, `+${f(lo)}–${f(hi)}`);
    };
    const statVal = (k, v) => {
      const pct = STAT_META[k]?.mult || k === 'shakeSpeed' || k === 'digSpeed';
      return chip(k, pct ? `+${(v * 100).toFixed(1)}%` : `+${v < 10 ? v.toFixed(2) : fmtNum(v)}`);
    };
    if (e.tab === 'equipment') {
      const eq = s.equipped;
      const slotCard = (label, u) => {
        const it = s.equipment.find((x) => x.u === u);
        return `<div class="chip" style="height:auto;padding:6px 10px;flex-direction:column;align-items:flex-start;gap:2px"><span class="muted" style="font-size:11px">${label}</span><span>${it ? escapeHtml(RECIPE[it.r].name) : 'Empty'}</span></div>`;
      };
      body = `<div class="chips" style="margin-bottom:8px">${slotCard('Necklace', eq.neck)}${slotCard('Charm', eq.charm)}${eq.rings.map((u, i) => slotCard(`Ring ${i + 1}`, u)).join('')}
        ${eq.rings.length < RING_SLOTS_MAX ? buyBtn(g, { shards: ringSlotCost(eq.rings.length) }, 'buyRing', '', '+Ring slot') : ''}</div>
        ${s.equipment.length ? `<div class="list">${s.equipment.map((it) => {
          const r = RECIPE[it.r];
          const grade = it.q >= 0.9 ? 'S' : it.q >= 0.7 ? 'A' : it.q >= 0.45 ? 'B' : 'C';
          const on = g.isEquipped(it.u);
          return `<div class="card ${on ? 'hi' : ''}"><div class="card-icon"><img src="${iconURL('equip', r.id)}" alt=""></div>
            <div class="card-main"><div class="card-title">${escapeHtml(r.name)} <span class="tag">${r.slot.toUpperCase()}</span><span class="tag ${grade === 'S' ? 'gold' : ''}">${grade}</span></div>
            <div class="chips">${Object.entries(it.stats).map(([k, v]) => statVal(k, v)).join('')}</div></div>
            <div class="card-side">${on ? `<button class="btn small" data-act="unequip" data-u="${it.u}">Unequip</button>` : `<button class="btn small green" data-act="equipGear" data-u="${it.u}">Equip</button>`}
            <button class="btn small ${g.s.items.reforgeToken ? 'shard' : ''}" data-act="reforge" data-u="${it.u}">${g.s.items.reforgeToken ? 'Perfect' : 'Reforge ' + fmtCash(reforgeCost(r))}</button>
            <button class="btn small ghost" data-act="scrap" data-u="${it.u}">${icon('trash')}</button></div></div>`;
        }).join('')}</div>` : `<div class="empty">${icon('anvil')}Craft rings, necklaces and charms from minerals to boost your stats.</div>`}`;
    } else {
      body = `<div class="note">${icon('anvil')} Stats roll randomly between the shown ranges (grade C → S). Reforge to reroll. Only unlocked minerals are used.</div><div class="list">${RECIPES.map((r) => {
        const needs = Object.entries(r.needs).map(([m, n]) => {
          const have = g.countAvailable(m);
          const known = s.index[m];
          return `<span class="chip ${have >= n ? 'green-t' : 'red-t'}"><img src="${iconURL('mineral', m)}" style="width:16px;height:16px" alt="">${known ? escapeHtml(MINERAL[m].name) : '???'} ${Math.min(have, n)}/${n}</span>`;
        }).join('');
        const can = g.canCraft(r);
        return `<div class="card"><div class="card-icon"><img src="${iconURL('equip', r.id)}" alt=""></div>
          <div class="card-main"><div class="card-title">${escapeHtml(r.name)} <span class="tag">${r.slot.toUpperCase()}</span></div>
          <div class="chips">${Object.entries(r.stats).map(([k, v]) => statRange(k, v)).join('')}</div><div class="chips">${needs}</div></div>
          <div class="card-side"><button class="btn gold ${can ? '' : 'cant'}" data-act="craft" data-id="${r.id}">Craft ${fmtCash(r.cost)}</button></div></div>`;
      }).join('')}</div>`;
    }
    return { title: 'Crafting', icon: 'anvil', sub: sheetSub(g), tabs, body };
  },
};

PANELS.enchant = {
  requires: 'enchant',
  render(ui, e) {
    const g = ui.g, s = g.s;
    const pan = PAN[s.pan];
    const ench = ENCHANT[s.enchants[s.pan]];
    const au = s.bag.filter((i) => i.m === 'aurorite').length;
    const scrolls = s.items.enchantScroll || 0;
    const books = Object.keys(s.items).filter((id) => id.startsWith('book:') && s.items[id] > 0);
    const total = ENCHANTS.reduce((a, x) => a + x.weight, 0);
    const res = e.params.result;
    const body = `<div class="card hi"><div class="card-icon"><img src="${iconURL('pan', pan.id)}" alt=""></div>
        <div class="card-main"><div class="card-title">${escapeHtml(pan.name)}</div>
        <div class="card-sub" style="color:${ench ? tierOf(ench.tier).color : 'var(--muted)'}">${ench ? `${icon('wand')} ${ench.name}: ${ench.desc}` : 'No enchantment yet'}</div></div></div>
      <div class="enchant-stage" id="enchStage"><div class="ename" id="enchName" style="color:${res ? tierOf(ENCHANT[res].tier).color : 'var(--muted)'}">${res ? ENCHANT[res].name + '!' : 'Enchanting Altar'}</div><div class="muted" id="enchDesc">${res ? ENCHANT[res].desc : 'Each enchant replaces the current one on your equipped pan.'}</div></div>
      <div class="row" style="margin-bottom:6px">
        <button class="btn gold grow ${au ? '' : 'cant'}" data-act="enchant" data-m="aurorite"><img src="${iconURL('mineral', 'aurorite')}" style="width:22px;height:22px" alt=""> Use Aurorite (${au})</button>
        <button class="btn shard grow ${scrolls ? '' : 'cant'}" data-act="enchant" data-m="scroll">Scroll (${scrolls})</button>
      </div>
      <div class="note">${icon('info')} Find Aurorite at Crystal Caverns (Epic). Enchant Scrolls & Books are sold by the Travelling Merchant.</div>
      ${books.length ? `<div class="section-title">Enchant books</div><div class="list">${books.map((id) => `<div class="card"><div class="card-icon"><img src="${iconURL('item', id)}" alt=""></div><div class="card-main"><div class="card-title">${escapeHtml(consumableDef(id).name)} ×${s.items[id]}</div><div class="card-sub">${escapeHtml(consumableDef(id).desc)}</div></div><div class="card-side"><button class="btn green" data-act="useItem" data-id="${id}">Apply</button></div></div>`).join('')}</div>` : ''}
      <div class="section-title">Enchant odds</div>
      <div class="list">${ENCHANTS.map((x) => `<div class="row" style="padding:6px 10px;border-radius:10px;background:var(--card)"><b style="color:${tierOf(x.tier).color};width:96px">${x.name}</b><span class="muted grow" style="font-size:12.5px">${x.desc}</span><span style="font-variant-numeric:tabular-nums">${(x.weight / total * 100).toFixed(1)}%</span></div>`).join('')}</div>`;
    return { title: 'Enchanting', icon: 'wand', body };
  },
};

PANELS.sluice = {
  requires: 'sluice',
  live: true,
  render(ui) {
    const g = ui.g, s = g.s;
    const placedIds = new Set(s.placed.map((p) => p.id));
    const here = g.shore;
    const placed = s.placed.map((p) => {
      const sl = SLUICE[p.id];
      const sh = SHORE[p.shore];
      const full = p.tray.length >= sl.capacity;
      const next = full ? 0 : (sl.interval - p.acc) * 1000;
      return `<div class="card"><div class="card-icon"><img src="${iconURL('sluice', p.id)}" alt=""></div>
        <div class="card-main"><div class="card-title">${escapeHtml(sl.name)} <span class="tag">${escapeHtml(sh.name)}</span></div>
        ${progressBar(p.tray.length, sl.capacity, 'blue')}
        <div class="card-sub">${p.tray.length}/${sl.capacity} in tray · ${full ? '<b class="red-t">Tray full!</b>' : `next in ${fmtTime(next)}`}</div>
        <div class="row" style="gap:3px;flex-wrap:wrap">${p.tray.slice(-8).map((it) => `<img src="${iconURL('mineral', it.m)}" style="width:24px;height:24px" alt="">`).join('')}</div></div>
        <div class="card-side"><button class="btn gold small ${p.tray.length ? '' : 'cant'}" data-act="collect" data-u="${p.u}">Collect ${p.tray.length}</button>
        ${p.shore !== here.id ? `<button class="btn small" data-act="placeSluice" data-id="${p.id}">Move here</button>` : ''}
        <button class="btn small ghost" data-act="removeSluice" data-u="${p.u}">Pick up</button></div></div>`;
    }).join('');
    const unplaced = s.sluices.filter((id) => !placedIds.has(id)).map((id) => {
      const sl = SLUICE[id];
      const ok = sl.toughness >= here.req.toughness;
      return `<div class="card"><div class="card-icon"><img src="${iconURL('sluice', id)}" alt=""></div>
        <div class="card-main"><div class="card-title">${escapeHtml(sl.name)}</div><div class="chips">${chip('luck', sl.luck)}${chip('capacity', sl.capacity + ' tray')}${chip('speed', '1/' + sl.interval + 's')}${chip('toughness', 'T' + sl.toughness)}</div></div>
        <div class="card-side"><button class="btn green ${ok && s.placed.length < s.sluiceSlots ? '' : 'cant'}" data-act="placeSluice" data-id="${id}">Place at ${escapeHtml(here.name)}</button></div></div>`;
    }).join('');
    const body = `<div class="note">${icon('sluice')} ${s.placed.length}/${s.sluiceSlots} sluices running. They keep sifting while you're away (up to 8 hours). A sluice's toughness must match the shore.</div>
      ${placed ? `<div class="section-title">Running</div><div class="list">${placed}</div>` : ''}
      ${unplaced ? `<div class="section-title">In storage</div><div class="list">${unplaced}</div>` : ''}
      ${!s.sluices.length ? `<div class="empty">${icon('sluice')}You don't own a sluice yet.<br><br><button class="btn gold" data-act="open" data-id="shop" data-tab="sluices">Visit the Shop</button></div>` : ''}`;
    return { title: 'Sluices', icon: 'sluice', sub: sheetSub(g), body };
  },
};

PANELS.merchant = {
  live: true,
  render(ui) {
    const g = ui.g, s = g.s;
    const m = g.merchant();
    let body;
    if (!m.present) {
      body = `<div class="empty">${icon('merchant')}The Travelling Merchant is on the road.<br>Arrives in <b class="gold-t">${fmtTime(m.nextAt - g.now)}</b> and stays for 5 minutes.</div>`;
    } else {
      body = `<div class="note">${icon('clock')} Leaving in <b class="gold-t">${fmtTime(m.leavesAt - g.now)}</b>. Stock changes every visit.</div><div class="list">${m.stock.map((o, i) => {
        const left = o.qty - m.bought.filter((x) => x === i).length;
        const def = o.id === 'backpack' ? { name: "Traveller's Backpack", desc: '+15 bag slots, permanently' } : consumableDef(o.id);
        const img = o.id === 'backpack' ? '' : `<img src="${iconURL('item', o.id)}" alt="">`;
        return `<div class="card ${left <= 0 ? 'dim' : ''}"><div class="card-icon" style="font-size:30px;color:var(--gold)">${img || icon('bag')}</div>
          <div class="card-main"><div class="card-title">${escapeHtml(def.name)} <span class="tag">${left} left</span></div><div class="card-sub">${escapeHtml(def.desc)}</div></div>
          <div class="card-side">${left > 0 ? buyBtn(g, g.priceOf(o.cost), 'merchantBuy', `data-i="${i}"`) : '<span class="tag">SOLD OUT</span>'}</div></div>`;
      }).join('')}</div>`;
    }
    return { title: 'Merchant', icon: 'merchant', sub: sheetSub(g), body };
  },
};

PANELS.leaderboard = {
  defaultTab: 'server',
  render(ui, e) {
    const g = ui.g;
    const tabs = [{ id: 'server', label: 'This server' }, { id: 'global', label: 'Global' }];
    const list = g.bots ? g.bots.leaderboard(e.tab) : [];
    const meIdx = list.findIndex((x) => x.me);
    const rows = list.slice(0, e.tab === 'server' ? 20 : 50).map((p, i) => {
      const medal = i < 3 ? ['#ffd54f', '#cfd8dc', '#d7a26b'][i] : null;
      return `<div class="card ${p.me ? 'hi' : ''}" style="padding:8px 12px">
        <div style="width:30px;text-align:center;font-weight:700;color:${medal || 'var(--muted)'}">${medal ? icon('trophy') : i + 1}</div>
        <div class="card-main"><div class="card-title">${escapeHtml(p.name)}${p.me ? ' <span class="tag gold">YOU</span>' : ''}${p.rebirths ? ` <span class="tag" style="color:#fff59d">★${p.rebirths}</span>` : ''}</div><div class="card-sub">Level ${p.level}</div></div>
        <div class="gold-t" style="font-weight:700">${fmtCash(p.earned)}</div></div>`;
    }).join('');
    const online = g.bots ? g.bots.globalOnline(g.now) : { players: 0, servers: 0 };
    const body = `<div class="note">${icon('globe')} <b class="green-t">${fmtNum(online.players)}</b> prospectors online across <b>${fmtNum(online.servers)}</b> servers.</div>
      <div class="note">${icon('trophy')} Ranked by total cash earned. You are <b>#${meIdx + 1}</b> ${e.tab === 'server' ? `on Server ${g.bots?.serverId} (${g.bots?.region})` : 'globally'}.</div><div class="list">${rows}</div>`;
    return { title: 'Leaderboard', icon: 'trophy', tabs, body };
  },
};

PANELS.stats = {
  live: true,
  render(ui, e) {
    const g = ui.g, s = g.s;
    const full = g.fullStats();
    const v = full.values;
    const open = ui.openStats || new Set();
    const rows = STAT_ORDER.map((k) => {
      const m = STAT_META[k];
      const parts = full.parts[k] || [];
      const bd = parts.map((p) => `<div><span>${escapeHtml(p.src)}</span><span>${p.op === 'add' ? (m.mult ? `+${Math.round(p.v * 100)}%` : `+${fmtNum(p.v)}`) : p.op === 'pct' ? `${p.v >= 0 ? '+' : ''}${Math.round(p.v * 100)}%` : `×${(Math.round(p.v * 100) / 100)}`}</span></div>`).join('');
      return `<button class="stat-row" style="width:100%" data-act="statToggle" data-k="${k}"><span class="si" style="background:${m.color}22;color:${m.color}">${icon(m.icon)}</span><span>${m.name}</span><span class="sv">${fmtStatVal(k, v[k])}</span></button>
        <div class="breakdown ${open.has(k) ? 'open' : ''}">${bd || '<div>Base</div>'}</div>`;
    }).join('');
    const st = s.stats;
    const best = s.best;
    const life = [
      ['Pans', fmtNum(st.pans)], ['Digs', fmtNum(st.digs)], ['Perfect digs', fmtNum(st.perfectDigs)], ['Best streak', fmtNum(st.bestStreak)],
      ['Minerals found', fmtNum(st.items)], ['Total earned', fmtCash(st.earned)], ['Play time', fmtTime(st.playtime * 1000)], ['Rebirths', s.rebirths],
    ].map(([k, val]) => `<div><div class="k">${k}</div><div class="v">${val}</div></div>`).join('');
    const body = `<div class="note">${icon('info')} Tap a stat to see where it comes from. Luck also gets multiplied by dig quality, Perfect streaks and caught glints when you pan.</div>
      ${rows}
      <div class="row" style="margin:6px 0 2px"><span class="chip">${icon('shield')} Toughness ${v.toughness}</span>${full.hazard ? `<span class="chip ${full.hazard.protected ? 'green-t' : 'red-t'}">${icon('warn')} ${full.hazard.name}${full.hazard.protected ? ' (protected)' : ''}</span>` : ''}</div>
      <div class="section-title">Lifetime</div><div class="kv">${life}</div>
      ${best ? `<div class="section-title">Most valuable find</div><div class="card rar-${MINERAL[best.m].tier}"><div class="card-icon ricon"><img src="${iconURL('mineral', best.m)}" alt=""></div><div class="card-main"><div class="card-title">${itemName(best)}</div><div class="card-sub">${fmtKg(best.kg)} · worth ${fmtCash(best.value)}</div></div></div>` : ''}`;
    return { title: 'Stats', icon: 'chart', body };
  },
};

PANELS.events = {
  live: true,
  render(ui) {
    const g = ui.g;
    const nx = g.nextEvent();
    const active = g.events.map((e) => `<div class="card" style="border-color:${e.def.color}"><div class="card-icon" style="color:${e.def.color};font-size:28px">${icon(e.def.icon)}</div>
      <div class="card-main"><div class="card-title" style="color:${e.def.color}">${escapeHtml(e.def.name)}${e.def.rift ? ` @ ${escapeHtml(SHORE[e.shore]?.name || '')}` : ''}</div><div class="card-sub">${escapeHtml(e.def.desc)}</div><div class="card-sub">Started by ${escapeHtml(e.source === 'server' ? 'the server' : e.source)} · ${fmtTime(e.end - g.now)} left</div></div></div>`).join('');
    const all = EVENTS.map((e) => `<div class="card"><div class="card-icon" style="color:${e.color};font-size:26px">${icon(e.icon)}</div><div class="card-main"><div class="card-title">${escapeHtml(e.name)} ${e.mixed ? '<span class="tag red">BUFF + DEBUFF</span>' : ''}</div><div class="card-sub">${escapeHtml(e.desc)}</div></div></div>`).join('');
    const body = `${active ? `<div class="section-title">Happening now</div><div class="list">${active}</div>` : ''}
      <div class="note">${icon('clock')} A new server event can start every 6 minutes${nx ? ` — next one in <b class="gold-t">${fmtTime(nx.start - g.now)}</b>` : ''}. Meteor Fragments and tokens from the Merchant start extra events.</div>
      <div class="section-title">All events</div><div class="list">${all}</div>`;
    return { title: 'Events', icon: 'meteor', body };
  },
};

PANELS.rebirth = {
  render(ui) {
    const g = ui.g, s = g.s;
    const info = g.rebirthInfo();
    const body = `<div class="dialog"><div class="big" style="color:#fff59d">${icon('rebirth')}</div><h3>Rebirth ${s.rebirths + 1}</h3>
      <p>Start over with permanent boosts. You keep your level, Museum, Index, crafted equipment, consumables, shards and locked minerals.</p></div>
      <div class="section-title">Rewards</div>
      <div class="list">
        <div class="card"><div class="card-icon" style="color:var(--green);font-size:26px">${icon('clover')}</div><div class="card-main"><div class="card-title">×${info.next.luck} Luck (total)</div><div class="card-sub">+50% luck multiplier per rebirth</div></div></div>
        <div class="card"><div class="card-icon" style="color:var(--gold);font-size:26px">${icon('coin')}</div><div class="card-main"><div class="card-title">×${info.next.sell} Sell value (total)</div><div class="card-sub">+25% per rebirth</div></div></div>
        <div class="card"><div class="card-icon" style="color:#9bd8ff;font-size:26px">${icon('star')}</div><div class="card-main"><div class="card-title">Celestial Shore, Celestial Pan & Starfall Shovel</div><div class="card-sub">Unlocked from your first rebirth · +1 sluice slot</div></div></div>
      </div>
      <div class="section-title">Requirements</div>
      <div class="card"><div class="card-main"><div class="card-title">${fmtCash(s.cash)} / ${fmtCash(info.cost)}</div>${progressBar(s.cash, info.cost)}<div class="card-title" style="margin-top:6px">Level ${s.level} / ${info.level}</div>${progressBar(s.level, info.level)}</div></div>
      <div class="note">${icon('warn')} Resets: cash, pans, shovels, enchants, shores, sluices, outfits and unlocked minerals in your bag.</div>`;
    return { title: 'Rebirth', icon: 'rebirth', body, foot: `<button class="btn wide ${info.can ? 'gold' : 'cant'}" data-act="rebirth">Rebirth for ${fmtCash(info.cost)}</button>` };
  },
};

PANELS.settings = {
  static: true,
  render(ui) {
    const g = ui.g, s = g.s;
    const sw = (part, list) => `<div class="swatches">${list.map((c) => `<button class="swatch ${s.avatar[part] === c ? 'on' : ''}" style="background:${c}" data-act="avatar" data-part="${part}" data-v="${c}" aria-label="${part} ${c}"></button>`).join('')}</div>`;
    const hats = ['none', 'cap', 'cowboy', 'hardhat', 'beanie', 'tophat', 'bucket', 'headphones', 'bandana', 'hair', 'wizard', 'crown', 'captain', 'safari', 'halo'];
    const toggle = (key, title, desc) => `<div class="set-row"><div class="sl"><div class="st">${title}</div><div class="sd">${desc}</div></div><button class="switch ${s.settings[key] ? 'on' : ''}" data-act="toggle" data-k="${key}" aria-label="${title}"></button></div>`;
    const titles = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).map((a) => a.title);
    const body = `
      <div class="section-title">Profile</div>
      <canvas id="avatarPreview" width="240" height="300"></canvas>
      <div class="set-row"><div class="sl"><div class="st">Name</div></div><input class="text-input" id="nameInput" maxlength="20" value="${escapeHtml(s.name)}" style="max-width:190px"><button class="btn small" data-act="rename">Save</button></div>
      <div class="set-row" style="flex-direction:column;align-items:stretch"><div class="st">Skin</div>${sw('skin', SKINS.filter((c, i, a) => a.indexOf(c) === i))}<div class="st">Shirt</div>${sw('shirt', SHIRTS)}<div class="st">Pants</div>${sw('pants', PANTS)}
        <div class="st">Hat</div><div class="swatches">${hats.map((h) => `<button class="btn small ${s.avatar.hat === h ? 'gold' : ''}" data-act="avatar" data-part="hat" data-v="${h}">${h}</button>`).join('')}</div></div>
      <div class="set-row"><div class="sl"><div class="st">Title</div><div class="sd">Earn titles from achievements</div></div>
        <select class="text-input" style="max-width:170px" id="titleSel" data-act="noop">${['', ...titles].map((t) => `<option value="${escapeHtml(t)}" ${s.title === t || (!s.title && !t) ? 'selected' : ''}>${t || 'None'}</option>`).join('')}</select></div>
      <div class="section-title">Sound</div>
      <div class="set-row"><div class="sl"><div class="st">Effects volume</div></div><input type="range" min="0" max="1" step="0.05" value="${s.settings.sfx}" id="sfxRange"></div>
      ${toggle('ambient', 'Ambience', 'Water, birds and crickets')}
      <div class="section-title">Gameplay</div>
      ${toggle('haptics', 'Vibration', 'On supported devices')}
      ${toggle('chat', 'Player chat', 'Show other players\' messages')}
      ${toggle('autoLock', 'Auto-lock Legendary+', 'Protect rare finds from Sell all')}
      <div class="set-row"><div class="sl"><div class="st">Auto-sell</div><div class="sd">Sell unmodified finds instantly up to this rarity</div></div>
        <div class="seg">${[['none', 'Off'], ['common', 'C'], ['uncommon', '≤U'], ['rare', '≤R']].map(([k, l]) => `<button class="${s.settings.autoSell === k ? 'on' : ''}" data-act="setting" data-k="autoSell" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="section-title">Graphics</div>
      <div class="set-row"><div class="sl"><div class="st">Quality</div><div class="sd">Low saves battery on older phones</div></div>
        <div class="seg">${[['high', 'High'], ['low', 'Low']].map(([k, l]) => `<button class="${s.settings.quality === k ? 'on' : ''}" data-act="setting" data-k="quality" data-v="${k}">${l}</button>`).join('')}</div></div>
      ${toggle('motion', 'Screen shake & motion', 'Turn off to reduce motion')}
      <div class="section-title">Codes</div>
      <div class="set-row"><input class="text-input" id="codeInput" placeholder="Enter a code (try PANNING)" maxlength="24" style="text-transform:uppercase"><button class="btn gold small" data-act="redeem">Redeem</button></div>
      <div class="section-title">Save data</div>
      <div class="note">${icon('info')} Your progress saves automatically on this device. Export a backup code to move it to another device.</div>
      <div class="row" style="margin-bottom:8px"><button class="btn grow" data-act="exportSave">${icon('upgrade')} Export</button><button class="btn grow" data-act="importSave">Import</button></div>
      <textarea class="text-input" id="saveBox" placeholder="Backup code appears here / paste one to import"></textarea>
      <div class="row" style="margin-top:12px"><button class="btn red grow" data-act="resetSave">${icon('trash')} Reset all progress</button></div>
      <div class="note center" style="margin-top:14px">Pan! v1.0 · A fan-made prospecting game inspired by Roblox's Prospecting! · Font: Fredoka (OFL)</div>`;
    return {
      title: 'Settings', icon: 'gear', body,
      after: (sheet) => {
        const cv = sheet.querySelector('#avatarPreview');
        if (cv) drawAvatarPreview(cv, s);
        sheet.querySelector('#sfxRange')?.addEventListener('input', (ev) => {
          s.settings.sfx = Number(ev.target.value);
          ui.audio.setVolume(s.settings.sfx);
        });
        sheet.querySelector('#sfxRange')?.addEventListener('change', () => ui.audio.click());
        sheet.querySelector('#titleSel')?.addEventListener('change', (ev) => { s.title = ev.target.value || null; ui.toast('Title updated', 'good'); });
      },
    };
  },
};

function drawAvatarPreview(cv, s) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const g = ctx.createRadialGradient(120, 170, 10, 120, 170, 140);
  g.addColorStop(0, 'rgba(255,207,74,0.18)');
  g.addColorStop(1, 'rgba(255,207,74,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  drawCharacter(ctx, { x: 120, y: 280, h: 210, dir: 1, pose: 'idle', t: 0, skin: s.avatar.skin, shirt: s.avatar.shirt, pants: s.avatar.pants, hat: s.avatar.hat, tool: 'pan', toolC1: PAN[s.pan].c1, toolC2: PAN[s.pan].c2 });
}

PANELS.chat = {
  static: true,
  render(ui) {
    const g = ui.g;
    const showBots = g.s.settings.chat !== false;
    const msgs = g.chatLog.filter((m) => showBots || m.kind !== 'chat');
    return {
      title: 'Chat', icon: 'chat', sub: `<span class="muted">${(g.bots?.active.length || 0) + 1} players</span>`,
      body: `<div class="chatlog" id="chatlog">${msgs.map((m) => chatHtml(m)).join('')}</div>`,
      foot: `<div class="chat-input"><input id="chatInput" maxlength="120" placeholder="Say something…" autocomplete="off"><button class="btn gold" data-act="say">${icon('send')}</button></div>`,
      after: (sheet) => {
        const b = sheet.querySelector('.sheet-body');
        b.scrollTop = b.scrollHeight;
      },
    };
  },
};

function chatHtml(m) {
  if (m.kind === 'system') return `<div class="cmsg sys" style="${m.color ? `color:${m.color}` : ''}">${escapeHtml(m.text)}</div>`;
  if (m.kind === 'announce') return `<div class="cmsg announce" style="color:${m.color || '#ffd54f'}">★ ${escapeHtml(m.text)}</div>`;
  if (m.kind === 'event') return `<div class="cmsg event" style="color:${m.color || '#fff'}">${escapeHtml(m.text)}</div>`;
  return `<div class="cmsg"><b style="color:${m.me ? '#ffd54f' : m.color || '#c5e1a5'}">${escapeHtml(m.who)}:</b> ${escapeHtml(m.text)}</div>`;
}

PANELS.help = {
  render() {
    const step = (ic, title, text) => `<div class="card"><div class="card-icon" style="color:var(--gold);font-size:28px">${icon(ic)}</div><div class="card-main"><div class="card-title">${title}</div><div class="card-sub">${text}</div></div></div>`;
    const body = `<div class="list">
      ${step('shovel', '1. Dig', 'Hold the big button and release when the white bar is inside the <b class="gold-t">gold zone</b>. Perfect digs add more sediment, raise pan quality (= more luck & bigger finds) and build a Perfect streak.')}
      ${step('pan', '2. Pan', 'When your pan is full you walk to the water. Hold to shake out the sediment. When a glint flashes, <b>release</b> to catch it for +10% luck (up to 5).')}
      ${step('gem', '3. Find minerals', `${MINERALS.length} minerals across 8 rarities, 13 modifiers (Shiny ×1.2 … Prismatic ×15) and HUGE/COLOSSAL sizes. Value = $/kg × weight × modifier.`)}
      ${step('tag', '4. Sell & upgrade', 'Sell in your Bag (or the quick-sell button), then buy better pans (luck, capacity, shake) and shovels (dig strength/speed, toughness to reach new shores).')}
      ${step('map', '5. Explore shores', '13 shores with their own minerals. Some have hazards (debuffs) — the Outfitter sells protection.')}
      ${step('meteor', 'Events', 'Meteor Showers, Gold Rushes, Mythic Rifts, Blizzards and more roll every few minutes. Some are mixed buffs & debuffs.')}
      ${step('flask', 'Buffs', 'Potions (Shop), Totems (yours and other players\'), Museum displays, crafted rings & necklaces, enchantments, collections and rebirths all multiply your stats.')}
      ${step('museum', 'Museum', 'Display one of each mineral for permanent boosts — heavier and rarer is better.')}
      ${step('sluice', 'Sluices', 'Place a sluice on a shore and it collects minerals while you\'re away.')}
      ${step('auto', 'Auto-Prospect', `From level ${FEATURES.auto.level} the AUTO button digs and pans for you (Good quality). Manual Perfect digs are still luckier!`)}
      ${step('code', 'Controls', 'Phone: tap & hold. Keyboard: Space to dig/pan, B bag, S shop, M map, Q quests, A auto, C chat, Esc close.')}
      ${step('download', 'Install', 'iPhone/iPad: Share → Add to Home Screen. Android/desktop Chrome: Install app from the menu. Works offline.')}
    </div>`;
    return { title: 'How to play', icon: 'help', body };
  },
};

PANELS.welcome = {
  static: true,
  render(ui) {
    const g = ui.g;
    return {
      title: 'Welcome to Pan!', icon: 'star', small: true,
      body: `<div class="dialog"><div class="big" style="color:var(--gold)">${icon('pan')}</div>
        <h3>Howdy, ${escapeHtml(g.s.name)}!</h3>
        <p>Dig sediment at the deposit, pan it in the water and uncover ${MINERALS.length} minerals across 13 shores. Sell your finds, upgrade your gear and chase Mythic, Exotic and Celestial treasures.</p>
        <div class="list" style="width:100%;text-align:left">
          <div class="card"><div class="card-icon" style="color:var(--gold);font-size:26px">${icon('shovel')}</div><div class="card-main"><div class="card-title">Hold &amp; release to dig</div><div class="card-sub">Let go when the white bar is in the <b class="gold-t">gold zone</b> for a Perfect dig.</div></div></div>
          <div class="card"><div class="card-icon" style="color:#8fe3ff;font-size:26px">${icon('pan')}</div><div class="card-main"><div class="card-title">Hold to pan</div><div class="card-sub">Release when a glint flashes to catch bonus luck.</div></div></div>
        </div></div>`,
      foot: `<button class="btn gold wide" data-act="close">Let's prospect!</button>`,
    };
  },
};

PANELS.login = {
  render(ui) {
    const g = ui.g;
    const avail = g.loginAvailable();
    const ld = g.loginDay();
    const r = ld.reward;
    return {
      title: 'Daily Reward', icon: 'gift', small: true,
      body: `<div class="dialog"><div class="big" style="color:var(--gold)">${icon('gift')}</div><h3>Day ${ld.streak}</h3>
        <p>${avail ? 'Log in every day for bigger rewards. Day 7 includes a Luck Totem!' : 'Come back tomorrow for your next reward.'}</p>
        <div class="reward-list">${rewardChips(r)}</div></div>`,
      foot: avail ? `<button class="btn gold wide" data-act="claimLoginClose">Claim</button>` : `<button class="btn wide" data-act="close">Close</button>`,
    };
  },
};

PANELS.welcomeBack = {
  static: true,
  render(ui, e) {
    const { away, gained } = e.params;
    return {
      title: 'Welcome back!', icon: 'sluice', small: true,
      body: `<div class="dialog"><div class="big" style="color:#8fe3ff">${icon('sluice')}</div><h3>You were away ${fmtTime(away * 1000)}</h3>
        <p>Your sluices sifted <b class="gold-t">${gained}</b> mineral${gained === 1 ? '' : 's'} while you were gone.</p></div>`,
      foot: `<button class="btn wide" data-act="close">Later</button><button class="btn gold wide" data-act="open" data-id="sluice">Collect</button>`,
    };
  },
};

// ── actions ──────────────────────────────────────────────────────────────
PANELS.actions = {
  equipPan: (ui, d) => ui.g.equipPan(d.id),
  equipShovel: (ui, d) => ui.g.equipShovel(d.id),
  buyPan: (ui, d) => ui.g.buyPan(d.id),
  buyShovel: (ui, d) => ui.g.buyShovel(d.id),
  buyOutfit: (ui, d) => ui.g.buyOutfit(d.id),
  buySluice: (ui, d) => ui.g.buySluice(d.id),
  buyBag: (ui) => ui.g.buyBagUpgrade(),
  buyMuseumSlot: (ui) => { if (ui.g.buyMuseumSlot()) ui.audio.buy(); },
  buyRing: (ui) => { if (ui.g.buyRingSlot()) ui.audio.buy(); },
  buySluiceSlot: (ui) => { if (ui.g.buySluiceSlot()) ui.audio.buy(); },
  buyItem: (ui, d) => {
    const def = POTION[d.id] || TOTEM[d.id];
    if (def && ui.g.buyConsumable(d.id, def.cost)) ui.toast(`Bought ${def.name} (in Bag → Items)`, 'good');
  },
  useItem: (ui, d) => {
    const g = ui.g;
    if (d.id.startsWith('book:') && g.s.enchants[g.s.pan]) {
      return ui.confirm({ title: 'Replace enchant?', text: `This replaces <b>${ENCHANT[g.s.enchants[g.s.pan]].name}</b> on your ${PAN[g.s.pan].name}.`, ok: 'Apply' }).then((ok) => ok && g.useItem(d.id));
    }
    g.useItem(d.id);
    ui.queueRefresh();
  },
  travel: async (ui, d) => {
    const g = ui.g;
    const st = g.shoreStatus(d.id);
    if (!st.unlocked && !st.needs.length) {
      const ok = await ui.confirm({ title: `Unlock ${SHORE[d.id].name}?`, text: `Pay <b class="gold-t">${fmtCash(st.cost)}</b> for a permanent travel permit.`, ok: 'Unlock & travel', icon: 'map' });
      if (!ok) return;
    }
    if (g.travel(d.id)) ui.closeAll();
  },
  item: (ui, d) => ui.openSheet('item', { stack: true, params: { u: d.u } }),
  lock: (ui, d) => ui.g.toggleLock(d.u),
  sellOne: (ui, d) => { ui.g.sell([d.u]); ui.closeTop(); },
  sellAll: async (ui) => {
    const g = ui.g;
    const items = g.s.bag.filter((i) => !i.lock);
    const rare = items.filter((i) => TIER_INDEX[MINERAL[i.m].tier] >= TIER_INDEX.epic);
    if (rare.length) {
      const ok = await ui.confirm({ title: 'Sell all unlocked?', text: `Includes ${rare.length} Epic+ mineral${rare.length > 1 ? 's' : ''}. Total <b class="gold-t">${fmtCash(g.bagValue())}</b>.`, ok: 'Sell all', icon: 'tag' });
      if (!ok) return;
    }
    g.sell(items.map((i) => i.u));
  },
  sellTier: (ui, d) => {
    const max = Number(d.t);
    const r = ui.g.sellWhere((i) => TIER_INDEX[MINERAL[i.m].tier] <= max && !i.mod);
    if (!r.n) ui.toast('Nothing to sell (modified minerals are kept)', 'info');
  },
  bagSort: (ui, d) => { ui.bagSort = d.k; ui.queueRefresh(); },
  bagFilter: (ui, d) => { ui.bagFilter = d.k; ui.queueRefresh(); },
  museumQuick: (ui, d) => {
    const g = ui.g;
    const it = g.s.bag.find((i) => i.u === d.u);
    if (!it) return;
    let slot = -1;
    const dupe = g.s.museum.items.findIndex((x) => x && x.m === it.m);
    if (dupe >= 0) slot = dupe;
    else slot = g.s.museum.items.findIndex((x, i) => !x && i < g.s.museum.slots);
    if (slot < 0) { ui.toast('No free pedestal — swap one in the Museum', 'warn'); ui.openSheet('museum'); return; }
    if (g.museumPlace(slot, d.u)) { ui.toast(`${MINERAL[it.m].name} is now on display!`, 'good'); ui.closeTop(); }
  },
  museumPick: (ui, d) => ui.openSheet('museumPick', { stack: true, params: { i: d.i } }),
  museumSlot: (ui, d) => ui.openSheet('museumSlot', { stack: true, params: { i: d.i } }),
  museumPlace: (ui, d) => {
    if (ui.g.museumPlace(Number(d.i), d.u)) {
      ui.audio.buy();
      ui.closeTop();
      if (ui.stack[ui.stack.length - 1]?.id === 'museumSlot') ui.closeTop();
    }
  },
  museumRemove: (ui, d) => { if (ui.g.museumRemove(Number(d.i))) ui.closeTop(); },
  mineralInfo: (ui, d) => ui.openSheet('mineralInfo', { stack: true, params: { id: d.id } }),
  craft: (ui, d) => {
    const it = ui.g.craft(d.id);
    if (it) {
      const grade = it.q >= 0.9 ? 'S' : it.q >= 0.7 ? 'A' : it.q >= 0.45 ? 'B' : 'C';
      ui.audio.enchant();
      ui.toast(`Crafted ${RECIPE[d.id].name} (grade ${grade})!`, 'good');
    }
  },
  equipGear: (ui, d) => ui.g.equip(d.u),
  unequip: (ui, d) => ui.g.unequip(d.u),
  reforge: async (ui, d) => {
    const g = ui.g;
    const it = g.s.equipment.find((x) => x.u === d.u);
    if (!it) return;
    const token = !!g.s.items.reforgeToken;
    const ok = await ui.confirm({ title: 'Reforge?', text: token ? 'Use a Perfect Reforge Token to max out every stat.' : `Reroll the stats for <b class="gold-t">${fmtCash(reforgeCost(RECIPE[it.r]))}</b>. The new roll replaces the old one.`, ok: 'Reforge', icon: 'anvil' });
    if (ok && g.reforge(d.u, token)) { ui.audio.enchant(); ui.toast('Reforged!', 'good'); }
  },
  scrap: async (ui, d) => {
    const ok = await ui.confirm({ title: 'Scrap equipment?', text: 'It will be destroyed.', ok: 'Scrap', danger: true, icon: 'trash' });
    if (ok) ui.g.scrapEquipment(d.u);
  },
  enchant: async (ui, d) => {
    const g = ui.g;
    const cur = ENCHANT[g.s.enchants[g.s.pan]];
    if (cur) {
      const ok = await ui.confirm({ title: 'Re-enchant?', text: `Your pan has <b>${cur.name}</b>. A new random enchant will replace it.`, ok: 'Enchant', icon: 'wand' });
      if (!ok) return;
    }
    const res = g.enchantRoll(d.m);
    if (!res) return;
    const top = ui.stack[ui.stack.length - 1];
    const stage = document.getElementById('enchStage');
    const nameEl = document.getElementById('enchName');
    if (stage && nameEl) {
      stage.classList.add('rolling');
      let n = 0;
      const iv = setInterval(() => {
        const r = ENCHANTS[Math.floor(Math.random() * ENCHANTS.length)];
        nameEl.textContent = r.name;
        nameEl.style.color = tierOf(r.tier).color;
        if (++n > 14) {
          clearInterval(iv);
          stage.classList.remove('rolling');
          if (top) { top.params.result = res.id; ui.renderSheet(top, true); }
          ui.toast(`Enchanted: ${res.name} — ${res.desc}`, 'good');
          if (TIER_INDEX[res.tier] >= TIER_INDEX.legendary) ui.showBanner({ title: `${res.name.toUpperCase()}!`, color: tierOf(res.tier).color, name: 'Enchantment', sub: res.desc });
        }
      }, 80);
    }
  },
  placeSluice: (ui, d) => { if (ui.g.placeSluice(d.id, ui.g.s.shore)) ui.toast(`${SLUICE[d.id].name} placed at ${ui.g.shore.name}`, 'good'); },
  collect: (ui, d) => { const n = ui.g.collectSluice(d.u); if (n) ui.toast(`Collected ${n} minerals`, 'good'); },
  removeSluice: (ui, d) => ui.g.removeSluice(d.u),
  merchantBuy: (ui, d) => ui.g.buyMerchant(Number(d.i)),
  claimQuest: (ui, d) => { if (ui.g.claimQuest(d.id)) ui.audio.quest(); },
  claimDaily: (ui, d) => { if (ui.g.claimDaily(Number(d.i))) ui.audio.quest(); },
  claimAch: (ui, d) => { if (ui.g.claimAchievement(d.id)) ui.audio.quest(); },
  claimLogin: (ui) => { if (ui.g.claimLogin()) { ui.audio.levelUp(); ui.queueRefresh(); } },
  claimLoginClose: (ui) => { if (ui.g.claimLogin()) ui.audio.levelUp(); ui.closeTop(); },
  rebirth: async (ui) => {
    const g = ui.g;
    const info = g.rebirthInfo();
    if (!info.can) { ui.toast(`Need ${fmtCash(info.cost)} and level ${info.level}`, 'warn'); return; }
    const ok = await ui.confirm({ title: 'Rebirth now?', text: 'Your cash, gear, shores and unlocked minerals reset. Permanent boosts are applied.', ok: 'Rebirth', danger: true, icon: 'rebirth' });
    if (ok) g.rebirth();
  },
  statToggle: (ui, d) => {
    ui.openStats ||= new Set();
    if (ui.openStats.has(d.k)) ui.openStats.delete(d.k); else ui.openStats.add(d.k);
    ui.queueRefresh();
  },
  toggle: (ui, d, el) => {
    const s = ui.g.s.settings;
    s[d.k] = !s[d.k];
    el.classList.toggle('on', s[d.k]);
    if (d.k === 'ambient') ui.audio.setAmbient(s.ambient);
    if (d.k === 'motion') document.documentElement.classList.toggle('reduce-motion', !s.motion);
    if (d.k === 'chat') ui.renderChatFeed();
    ui.audio.click();
  },
  setting: (ui, d, el) => {
    const s = ui.g.s.settings;
    s[d.k] = d.v;
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    if (d.k === 'quality') ui.scene.setQuality(d.v);
    ui.audio.click();
  },
  avatar: (ui, d) => {
    const s = ui.g.s;
    s.avatar[d.part] = d.v;
    const top = ui.stack[ui.stack.length - 1];
    if (top) ui.renderSheet(top, true);
  },
  rename: (ui) => {
    const v = document.getElementById('nameInput')?.value.trim().replace(/[^\w .-]/g, '').slice(0, 20);
    if (!v || v.length < 3) { ui.toast('Name must be 3–20 letters/numbers', 'warn'); return; }
    ui.g.s.name = v;
    ui.toast(`You are now ${v}`, 'good');
  },
  redeem: (ui) => {
    const el = document.getElementById('codeInput');
    if (ui.g.redeemCode(el?.value)) { ui.audio.levelUp(); el.value = ''; }
  },
  exportSave: async (ui) => {
    const code = exportSave(ui.g.s);
    const box = document.getElementById('saveBox');
    if (box) box.value = code;
    try { await navigator.clipboard.writeText(code); ui.toast('Backup code copied to clipboard', 'good'); } catch { ui.toast('Backup code shown below — copy it somewhere safe', 'info'); }
  },
  importSave: async (ui) => {
    const box = document.getElementById('saveBox');
    const code = box?.value.trim();
    if (!code) { ui.toast('Paste a backup code into the box first', 'warn'); return; }
    try {
      const st = importSave(code);
      const ok = await ui.confirm({ title: 'Import save?', text: `Replace this device's progress with <b>${escapeHtml(st.name)}</b> (level ${st.level}, ${fmtCash(st.cash)})?`, ok: 'Import', danger: true });
      if (!ok) return;
      ui.g.resetting = true; // stop the unload auto-save from overwriting the import
      saveState(st);
      location.reload();
    } catch (e) {
      ui.toast('That code is not a valid Pan! save', 'warn');
    }
  },
  resetSave: async (ui) => {
    const ok = await ui.confirm({ title: 'Reset everything?', text: 'All progress on this device will be deleted. This cannot be undone.', ok: 'Delete progress', danger: true, icon: 'trash' });
    if (!ok) return;
    ui.g.resetting = true;
    wipeSave();
    location.reload();
  },
  say: (ui) => {
    const el = document.getElementById('chatInput');
    if (!el || !el.value.trim()) return;
    ui.g.say(el.value);
    el.value = '';
  },
  noop: () => {},
};

export { fmtPct, todayKey, scaledCash, TOKENS, MODIFIERS };
