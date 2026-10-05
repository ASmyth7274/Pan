// UI controller: HUD, action button + minigames, feeds, banners and the
// sheet (panel) manager. Panels themselves live in panels.js.
import { icon } from './icons.js';
import { PANELS } from './panels.js';
import { iconURL } from '../render/icons.js';
import { fmtCash, fmtNum, fmtKg, fmtTime, fmtPct, escapeHtml, clamp, lerp, rgba } from '../util.js';
import { MINERAL } from '../data/minerals.js';
import { TIERS, TIER_INDEX, tierOf, modOf } from '../data/rarity.js';
import { POTION, TOTEM, TOKEN, consumableDef } from '../data/items.js';
import { SHORE, HAZARDS } from '../data/shores.js';
import { PAN } from '../data/gear.js';
import { NPC } from '../data/quests.js';
import { xpToNext, FEATURES, isUnlocked } from '../progression.js';
import { goalTarget, GRADES } from '../game.js';
import { baseValue } from '../loot.js';

const RING_R = 49;
const RING_C = 2 * Math.PI * RING_R;

export class UI {
  constructor(game, scene, audio) {
    this.g = game;
    this.scene = scene;
    this.audio = audio;
    this.stack = [];
    this.cashShown = game.s.cash;
    this.chipTimer = 0;
    this.refreshQueued = false;
    this.lastPhase = null;
    this.bagSort = 'value';
    this.bagFilter = 'all';
    this.build();
    this.bind();
    this.renderHud(true);
    this.renderChips();
    this.renderTracker();
    this.renderChatFeed();
    this.renderAutoBtn();
    this.el.autoBtn.classList.toggle('on', !!game.s.auto);
    this.updateDockBadges();
  }

  // ── DOM ─────────────────────────────────────────────────────────────
  build() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <header id="hud">
        <div class="hud-row top">
          <button class="profile glass" data-act="open" data-id="stats" aria-label="Your stats">
            <div class="lvl"><svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="17.5" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3.5"/><circle id="xpRing" cx="20" cy="20" r="17.5" fill="none" stroke="#7cf0a6" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="110" stroke-dashoffset="110"/></svg><span class="lv-num" id="lvNum">1</span></div>
            <div class="money"><span class="cash" id="cash">$0</span><span class="shards" id="shards">${icon('shard')} 0</span></div>
          </button>
          <div class="hud-right">
            <button class="pill-btn glass" data-act="open" data-id="leaderboard" data-tab="server" aria-label="Players">${icon('users')}<span id="players">1</span></button>
            <button class="pill-btn glass icon" data-act="open" data-id="settings" aria-label="Settings">${icon('gear')}</button>
          </div>
        </div>
        <div id="chips"></div>
        <button id="tracker" class="glass" data-act="tracker"></button>
      </header>
      <div id="toasts"></div>
      <div id="finds"></div>
      <div id="banner"></div>
      <div id="chatfeed" data-act="open" data-id="chat"></div>
      <div id="controls">
        <div id="sedpill" class="glass"><span>${icon('pan')}</span><div class="bar"><i id="sedBar"></i></div><span id="sedTxt">0/5</span><span class="q" id="sedQ"></span><span class="streak" id="streakTxt"></span></div>
        <div class="action-row">
          <button class="side-btn glass" id="autoBtn" data-act="auto" aria-label="Auto prospect">${icon('auto')}<span>AUTO</span></button>
          <button id="action" aria-label="Dig / Pan">
            <svg class="ring" viewBox="0 0 108 108">
              <circle cx="54" cy="54" r="${RING_R}" fill="none" stroke="rgba(10,14,30,.75)" stroke-width="9"/>
              <circle id="zGood" cx="54" cy="54" r="${RING_R}" fill="none" stroke="#4fc3f7" stroke-opacity=".55" stroke-width="7"/>
              <circle id="zGreat" cx="54" cy="54" r="${RING_R}" fill="none" stroke="#69f0ae" stroke-opacity=".8" stroke-width="7"/>
              <circle id="zPerfect" cx="54" cy="54" r="${RING_R}" fill="none" stroke="#ffd54f" stroke-width="8"/>
              <circle id="needle" cx="54" cy="54" r="${RING_R}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
              <circle id="panRing" cx="54" cy="54" r="${RING_R}" fill="none" stroke="#8fe3ff" stroke-width="6" stroke-linecap="round"/>
            </svg>
            <div class="face"><span id="actIcon">${icon('shovel')}</span><span class="lbl-main" id="actLbl">DIG</span><span class="lbl-sub" id="actSub">HOLD</span></div>
            <canvas class="panview" id="panview" width="180" height="180"></canvas>
            <div id="gradepop"></div>
          </button>
          <button class="side-btn glass" id="sellBtn" data-act="quickSell" aria-label="Sell">${icon('tag')}<span class="cnt" id="bagCnt">0/30</span></button>
        </div>
      </div>
      <nav id="dock" class="glass">
        <button class="dock-btn" data-act="open" data-id="bag">${icon('bag')}<span>Bag</span><i class="badge" id="bBag"></i></button>
        <button class="dock-btn" data-act="open" data-id="shop">${icon('shop')}<span>Shop</span><i class="badge" id="bShop"></i></button>
        <button class="dock-btn" data-act="open" data-id="map">${icon('map')}<span>Map</span><i class="badge" id="bMap"></i></button>
        <button class="dock-btn" data-act="open" data-id="quests">${icon('quests')}<span>Quests</span><i class="badge" id="bQuests"></i></button>
        <button class="dock-btn" data-act="open" data-id="more">${icon('more')}<span>More</span><i class="badge" id="bMore"></i></button>
      </nav>
      <div id="sheets"></div>`;
    const $ = (id) => document.getElementById(id);
    this.el = {
      cash: $('cash'), shards: $('shards'), lvNum: $('lvNum'), xpRing: $('xpRing'), players: $('players'),
      chips: $('chips'), tracker: $('tracker'), toasts: $('toasts'), finds: $('finds'), banner: $('banner'),
      chatfeed: $('chatfeed'),
      sedBar: $('sedBar'), sedTxt: $('sedTxt'), sedQ: $('sedQ'), streakTxt: $('streakTxt'),
      autoBtn: $('autoBtn'), action: $('action'), actIcon: $('actIcon'), actLbl: $('actLbl'), actSub: $('actSub'),
      panview: $('panview'), gradepop: $('gradepop'), sellBtn: $('sellBtn'), bagCnt: $('bagCnt'),
      zGood: $('zGood'), zGreat: $('zGreat'), zPerfect: $('zPerfect'), needle: $('needle'), panRing: $('panRing'),
      sheets: $('sheets'),
      badges: { bag: $('bBag'), shop: $('bShop'), map: $('bMap'), quests: $('bQuests'), more: $('bMore') },
    };
    this.panCtx = this.el.panview.getContext('2d');
    this.panSeed = Math.random();
  }

  bind() {
    const g = this.g;
    const app = document.getElementById('app');
    // generic click delegation
    app.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || t.id === 'action') return;
      if (t.classList.contains('backdrop') && e.target !== t) return;
      this.audio.unlock();
      this.handle(t.dataset.act, t.dataset, t, e);
    });
    // action button: hold/release
    const act = this.el.action;
    const down = (e) => {
      e.preventDefault();
      this.audio.unlock();
      if (this.stack.length) return;
      if ((g.phase === 'dig' || g.phase === 'pan') && g.bagFree() <= 0) { this.openSheet('bag'); return; }
      act.classList.add('pressed');
      try { act.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (g.s.auto) g.setAuto(false);
      g.press();
    };
    const up = () => {
      act.classList.remove('pressed');
      g.release();
    };
    act.addEventListener('pointerdown', down);
    act.addEventListener('pointerup', up);
    act.addEventListener('pointercancel', up);
    act.addEventListener('lostpointercapture', up);
    act.addEventListener('contextmenu', (e) => e.preventDefault());
    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Enter' && e.target.id === 'chatInput') this.handle('say', {});
        return;
      }
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        e.preventDefault();
        if (this.stack.length) return;
        this.audio.unlock();
        if ((g.phase === 'dig' || g.phase === 'pan') && g.bagFree() <= 0) { this.openSheet('bag'); return; }
        act.classList.add('pressed');
        g.press();
      } else if (e.key === 'Escape') this.closeTop();
      else if (!this.stack.length) {
        const map = { b: 'bag', s: 'shop', m: 'map', q: 'quests', c: 'chat' };
        if (map[e.key.toLowerCase()]) this.openSheet(map[e.key.toLowerCase()]);
        if (e.key.toLowerCase() === 'a') this.handle('auto', {});
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') { act.classList.remove('pressed'); g.release(); }
    });

    // game events
    g.on('cash', () => { this.queueRefresh(); this.updateDockBadges(); });
    g.on('shards', () => { this.renderHud(); this.queueRefresh(); });
    g.on('xp', () => this.renderHud());
    g.on('bag', () => { this.renderBagCount(); this.queueRefresh(); this.updateDockBadges(); });
    g.on('items', () => this.queueRefresh());
    g.on('gear', () => { this.queueRefresh(); this.renderChips(); });
    g.on('buffs', () => { this.renderChips(); this.queueRefresh(); });
    g.on('events', () => { this.renderChips(); this.queueRefresh(); });
    g.on('museum', () => this.queueRefresh());
    g.on('equipment', () => this.queueRefresh());
    g.on('sluice', () => { this.queueRefresh(); this.updateDockBadges(); });
    g.on('quests', () => { this.renderTracker(); this.updateDockBadges(); this.queueRefresh(); });
    g.on('merchant', () => this.queueRefresh());
    g.on('travel', () => { this.renderChips(); this.renderTracker(); this.queueRefresh(); this.toast(`Welcome to ${g.shore.name}!`, 'good'); this.audio.setScene(g.shore.theme.water.type); });
    g.on('toast', ({ text, kind }) => { this.toast(text, kind); if (kind === 'warn') this.audio.deny(); });
    g.on('chat', (m) => this.onChat(m));
    g.on('auto', (on) => this.el.autoBtn.classList.toggle('on', on));
    g.on('dig', (d) => this.onDig(d));
    g.on('digStart', () => {});
    g.on('shakeStart', () => this.audio.shake(true));
    g.on('shakeStop', () => this.audio.shake(false));
    g.on('glint', () => { this.audio.glint(); this.gradePop('GLINT! +10% luck', '#fff59d'); });
    g.on('panned', (r) => this.onPanned(r));
    g.on('levelUp', (l) => this.onLevelUp(l));
    g.on('eventStart', (e) => this.onEventStart(e));
    g.on('questReady', () => { this.audio.quest(); this.renderTracker(); });
    g.on('reward', ({ why, parts }) => { this.toast(`${why}: ${parts.join(', ')}`, 'good'); this.renderHud(); });
    g.on('bagFull', () => { this.toast('Your bag is full! Sell some minerals.', 'warn'); this.el.sellBtn.classList.add('warn'); });
    g.on('sold', ({ n, total }) => {
      this.audio.sell();
      this.toast(`Sold ${n} mineral${n > 1 ? 's' : ''} for ${fmtCash(total)}`, 'good');
      const r = this.el.sellBtn.getBoundingClientRect();
      this.scene.coinFx(r.left + r.width / 2, r.top, 14);
    });
    g.on('purchase', () => this.audio.buy());
    g.on('enchant', () => this.audio.enchant());
    g.on('discover', (it) => { this.discovered = (this.discovered || 0) + 1; void it; });
    g.on('rebirth', () => { this.closeAll(); this.showBanner({ title: 'REBORN!', color: '#fff59d', name: `Rebirth ${g.s.rebirths}`, sub: 'Permanent luck & sell boosts unlocked', img: iconURL('item', 'luckTotem') }); this.audio.levelUp(); });
  }

  // ── per-frame ───────────────────────────────────────────────────────
  frame(dt) {
    const g = this.g;
    // cash tween
    const target = g.s.cash;
    if (Math.abs(this.cashShown - target) > 0.5) {
      this.cashShown = lerp(this.cashShown, target, Math.min(1, dt * 8));
      if (Math.abs(this.cashShown - target) < Math.max(1, target * 0.001)) this.cashShown = target;
      this.el.cash.textContent = fmtCash(this.cashShown);
    }
    this.renderAction();
    this.chipTimer += dt;
    if (this.chipTimer > 0.5) {
      this.chipTimer = 0;
      this.renderChips();
      this.renderAutoBtn();
      this.el.players.textContent = String((g.bots ? g.bots.active.length : 0) + 1);
      if (this.stack.length && PANELS[this.stack[this.stack.length - 1].id]?.live) this.queueRefresh();
    }
  }

  renderHud(force) {
    const s = this.g.s;
    if (force) this.cashShown = s.cash;
    this.el.cash.textContent = fmtCash(this.cashShown);
    this.el.shards.innerHTML = `${icon('shard')} ${fmtNum(s.shards)}`;
    this.el.lvNum.textContent = s.level;
    const need = xpToNext(s.level);
    const k = clamp(s.xp / need, 0, 1);
    this.el.xpRing.setAttribute('stroke-dashoffset', String(110 * (1 - k)));
    this.renderBagCount();
  }

  renderBagCount() {
    const s = this.g.s;
    this.el.bagCnt.textContent = `${s.bag.length}/${s.bagSize}`;
    const full = s.bag.length >= s.bagSize;
    this.el.sellBtn.classList.toggle('warn', full || s.bag.length >= s.bagSize * 0.9);
  }

  setRingArc(el, from, to) {
    const a = clamp(from, 0, 1), b = clamp(to, 0, 1);
    if (b <= a) { el.setAttribute('stroke-dasharray', `0 ${RING_C}`); return; }
    el.setAttribute('stroke-dasharray', `${(b - a) * RING_C} ${RING_C}`);
    el.setAttribute('stroke-dashoffset', String(-a * RING_C));
  }

  renderAction() {
    const g = this.g;
    const el = this.el;
    const st = g.stats();
    const p = g.s.pending;
    let phase = g.phase;
    const full = (phase === 'dig' || phase === 'pan') && g.bagFree() <= 0;
    const key = full ? 'full' : phase;
    if (key !== this.lastPhase) {
      this.lastPhase = key;
      el.action.classList.toggle('pan', phase === 'pan' && !full);
      el.action.classList.toggle('walk', phase === 'walk');
      el.action.classList.toggle('full', full);
      if (full) { el.actIcon.innerHTML = icon('bag'); el.actLbl.textContent = 'FULL'; el.actSub.textContent = 'SELL ITEMS'; }
      else if (phase === 'dig') { el.actIcon.innerHTML = icon('shovel'); el.actLbl.textContent = 'DIG'; el.actSub.textContent = 'HOLD'; }
      else if (phase === 'pan') { el.actSub.textContent = 'HOLD'; }
      else { el.actIcon.innerHTML = icon('boot'); el.actLbl.textContent = '…'; el.actSub.textContent = ''; }
    }
    // sediment pill
    const fillK = clamp(p.sed / st.capacity, 0, 1);
    el.sedBar.style.width = (fillK * 100).toFixed(1) + '%';
    el.sedTxt.textContent = `${fmtNum(Math.max(0, p.sed))}/${fmtNum(st.capacity)}`;
    const q = p.total > 0 ? p.qsum / p.total : 0;
    el.sedQ.textContent = p.total > 0 ? `Q ${Math.round(q * 100)}%` : '';
    const streak = g.s.streak;
    el.streakTxt.classList.toggle('on', streak >= 2);
    if (streak >= 2) el.streakTxt.textContent = `🔥${streak}`;

    // rings
    if (phase === 'dig' && !full) {
      const z = g.dig.zone;
      const show = g.dig.charging;
      this.setRingArc(el.zGood, show ? z - 0.18 : 0, show ? z + 0.18 : 0);
      this.setRingArc(el.zGreat, show ? z - 0.1 : 0, show ? z + 0.1 : 0);
      this.setRingArc(el.zPerfect, show ? z - 0.045 : 0, show ? z + 0.045 : 0);
      this.setRingArc(el.needle, 0, show ? g.dig.needle : 0);
      this.setRingArc(el.panRing, 0, g.dig.cooldown > 0 ? 1 - g.dig.cooldown / Math.max(0.01, g.dig.swing) : 0);
      el.panRing.setAttribute('stroke', '#ffd54f');
      el.panRing.setAttribute('stroke-opacity', '0.35');
      if (show) this.audio.charge(g.dig.needle);
      el.action.classList.remove('glint');
    } else if (phase === 'pan' && !full) {
      this.setRingArc(el.zGood, 0, 0); this.setRingArc(el.zGreat, 0, 0); this.setRingArc(el.zPerfect, 0, 0); this.setRingArc(el.needle, 0, 0);
      this.setRingArc(el.panRing, 0, fillK);
      el.panRing.setAttribute('stroke', '#8fe3ff');
      el.panRing.setAttribute('stroke-opacity', '1');
      const glint = !!g.pan.glint;
      el.action.classList.toggle('glint', glint);
      el.actSub.textContent = glint ? 'RELEASE!' : g.pan.shaking ? 'SHAKING' : 'HOLD TO PAN';
      this.drawPanView();
    } else {
      for (const r of [el.zGood, el.zGreat, el.zPerfect, el.needle, el.panRing]) this.setRingArc(r, 0, 0);
      el.action.classList.remove('glint');
    }
  }

  drawPanView() {
    const g = this.g;
    const c = this.el.panview;
    const ctx = this.panCtx;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = W / 2;
    const t = this.scene.t;
    const st = g.stats();
    const p = g.s.pending;
    const fill = clamp(p.sed / st.capacity, 0, 1);
    const pan = PAN[g.s.pan] || PAN.rusty;
    const shake = g.pan.shaking ? Math.sin(t * 34) * 4 : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    // pan metal
    const mg = ctx.createRadialGradient(cx - 20, cy - 25, 10, cx, cy, R);
    mg.addColorStop(0, pan.c1);
    mg.addColorStop(1, pan.c2);
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H);
    // water
    ctx.fillStyle = 'rgba(70,170,230,0.55)';
    ctx.beginPath(); ctx.arc(cx + shake, cy, R * 0.86, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a0 = t * (g.pan.shaking ? 4 : 0.8) + i * 2.1;
      ctx.beginPath(); ctx.arc(cx + shake, cy, R * (0.45 + i * 0.13), a0, a0 + 1.1); ctx.stroke();
    }
    // sediment pile
    const sr = R * 0.72 * Math.sqrt(fill);
    if (sr > 1) {
      const sg = ctx.createRadialGradient(cx + shake - sr * 0.3, cy - sr * 0.3, 2, cx + shake, cy, sr);
      sg.addColorStop(0, '#c99a62');
      sg.addColorStop(1, '#7a5634');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx + shake, cy, sr, 0, Math.PI * 2); ctx.fill();
      let seed = Math.floor(this.panSeed * 1000);
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < 40; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * sr;
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(60,40,20,0.5)' : 'rgba(240,210,160,0.45)';
        ctx.fillRect(cx + shake + Math.cos(a) * d, cy + Math.sin(a) * d, 3, 3);
      }
    }
    // gold specks appear as sediment clears
    let seed2 = Math.floor(this.panSeed * 7777);
    const rnd2 = () => ((seed2 = (seed2 * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 7; i++) {
      const a = rnd2() * Math.PI * 2, d = R * (0.25 + rnd2() * 0.55);
      if (d < sr) continue;
      ctx.fillStyle = `rgba(255,220,120,${0.6 + 0.4 * Math.sin(t * 5 + i)})`;
      ctx.beginPath(); ctx.arc(cx + shake + Math.cos(a) * d, cy + Math.sin(a) * d, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // glint
    const gl = g.pan.glint;
    if (gl) {
      const gx = cx + (gl.x - 0.5) * R * 1.1 + shake, gy = cy + (gl.y - 0.5) * R * 1.1;
      const s = 18 + Math.sin(t * 20) * 6;
      ctx.fillStyle = '#fffbe0';
      ctx.beginPath();
      ctx.moveTo(gx, gy - s); ctx.quadraticCurveTo(gx, gy, gx + s, gy); ctx.quadraticCurveTo(gx, gy, gx, gy + s);
      ctx.quadraticCurveTo(gx, gy, gx - s, gy); ctx.quadraticCurveTo(gx, gy, gx, gy - s);
      ctx.fill();
      const gg = ctx.createRadialGradient(gx, gy, 1, gx, gy, 40);
      gg.addColorStop(0, 'rgba(255,240,150,0.8)');
      gg.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(gx - 40, gy - 40, 80, 80);
    }
    // caught glints
    for (let i = 0; i < (p.glints || 0); i++) {
      ctx.fillStyle = '#fff59d';
      ctx.beginPath(); ctx.arc(cx - 30 + i * 15, H - 46, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // rim
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, R - 3, 0, Math.PI * 2); ctx.stroke();
  }

  gradePop(text, color) {
    const el = this.el.gradepop;
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  onDig(d) {
    const g = GRADES[d.grade];
    this.audio.dig(d.grade);
    let txt = g.name;
    if (d.grade === 'perfect' && d.streak >= 2) txt += ` ×${d.streak}`;
    this.gradePop(txt, g.color);
    this.scene.digFx(d.grade);
    this.scene.floatText(`+${fmtNum(d.add)}`, g.color);
    if (d.grade === 'perfect' && this.g.s.settings.haptics && navigator.vibrate) navigator.vibrate(12);
    if (d.full) this.gradePop('PAN FULL!', '#8fe3ff');
    this.panSeed = Math.random();
  }

  onPanned(r) {
    const g = this.g;
    const items = r.items || [];
    if (!r.sluice) this.scene.findFx(items);
    let best = 0;
    for (const it of items) best = Math.max(best, TIER_INDEX[MINERAL[it.m].tier]);
    this.audio.reveal(best);
    // feed: best first, max 5
    const sorted = items.slice().sort((a, b) => baseValue(b) - baseValue(a));
    const show = sorted.slice(0, 5);
    for (const it of show) this.addFind(it, r.sold?.includes(it));
    if (sorted.length > show.length) this.addFindSummary(sorted.length - show.length);
    if (r.shards) this.toast(`+${r.shards} Meteor Shard${r.shards > 1 ? 's' : ''}!`, 'good');
    if (r.sold?.length && !r.sluice && g.s.settings.autoSell === 'none') this.toast(`Bag full — sold ${r.sold.length} extra for ${fmtCash(r.soldValue)}`, 'warn');
    const top = sorted[0];
    if (top) {
      const tIdx = TIER_INDEX[MINERAL[top.m].tier];
      const mod = modOf(top.mod);
      if (tIdx >= TIER_INDEX.legendary || top.size === 'colossal' || (mod && mod.mult >= 5)) this.bannerFor(top);
      else if (tIdx >= TIER_INDEX.epic || top.size === 'huge' || (mod && mod.mult >= 2.5) || top.isNew) {
        this.scene.floatText(top.isNew ? `NEW: ${MINERAL[top.m].name}!` : `${tierOf(MINERAL[top.m].tier).name}!`, tierOf(MINERAL[top.m].tier).color, 'pan', true);
      }
    }
    this.renderBagCount();
    this.el.sellBtn.classList.toggle('warn', g.s.bag.length >= g.s.bagSize * 0.9);
  }

  addFind(it, sold) {
    const m = MINERAL[it.m];
    const tier = tierOf(m.tier);
    const mod = modOf(it.mod);
    const d = document.createElement('div');
    d.className = `find rar-${m.tier}`;
    d.innerHTML = `<img class="ricon" src="${iconURL('mineral', it.m)}" alt="">
      <div><div class="f-name rtext">${it.isNew ? '<span class="tag gold" style="height:16px;font-size:9px;margin-right:4px">NEW</span>' : ''}${mod ? `<span style="color:${mod.color}">${mod.name}</span> ` : ''}${escapeHtml(m.name)}</div>
      <div class="f-sub">${tier.name} · ${fmtKg(it.kg)}${it.size ? ` · <b style="color:#ffb321">${it.size.toUpperCase()}</b>` : ''}${sold ? ' · sold' : ''}</div></div>
      <div class="f-val">${fmtCash(this.g.sellValue(it))}</div>`;
    this.el.finds.prepend(d);
    while (this.el.finds.children.length > 6) this.el.finds.lastChild.remove();
    setTimeout(() => d.remove(), 3700);
  }

  addFindSummary(n) {
    const d = document.createElement('div');
    d.className = 'find';
    d.innerHTML = `<div class="f-sub" style="padding:4px 6px">+${n} more in your bag</div>`;
    this.el.finds.append(d);
    setTimeout(() => d.remove(), 3700);
  }

  bannerFor(it) {
    const m = MINERAL[it.m];
    const tier = tierOf(m.tier);
    const mod = modOf(it.mod);
    let title = tier.name.toUpperCase() + '!';
    if (it.size === 'colossal') title = 'COLOSSAL!';
    if (mod && mod.mult >= 5 && TIER_INDEX[m.tier] < TIER_INDEX.legendary) title = mod.name.toUpperCase() + '!';
    this.showBanner({
      title, color: mod && mod.mult >= 5 ? mod.color : tier.color,
      name: `${mod ? mod.name + ' ' : ''}${m.name}`,
      sub: `${fmtKg(it.kg)} · ${fmtCash(this.g.sellValue(it))}`,
      img: iconURL('mineral', it.m),
    });
    if (this.g.s.settings.haptics && navigator.vibrate) navigator.vibrate([30, 40, 60]);
  }

  showBanner({ title, color, name, sub, img }) {
    const b = this.el.banner;
    b.className = '';
    b.innerHTML = `<div class="b-ray" style="background:conic-gradient(from 0deg, ${rgba(color, 0)}, ${rgba(color, 0.55)}, ${rgba(color, 0)}, ${rgba(color, 0.55)}, ${rgba(color, 0)}, ${rgba(color, 0.55)}, ${rgba(color, 0)})"></div>
      ${img ? `<img src="${img}" alt="">` : ''}
      <div class="b-tier" style="color:${color}">${escapeHtml(title)}</div>
      <div class="b-name">${escapeHtml(name || '')}</div>
      <div class="b-sub">${escapeHtml(sub || '')}</div>`;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 4000);
  }

  onLevelUp({ level, shards, unlocks }) {
    this.audio.levelUp();
    this.renderHud();
    this.showBanner({ title: `LEVEL ${level}!`, color: '#7cf0a6', name: `+${shards} Meteor Shards`, sub: unlocks.length ? `Unlocked: ${unlocks.join(', ')}` : 'Keep prospecting!' });
    if (unlocks.length) this.toast(`New feature: ${unlocks.join(', ')}! Check the More menu.`, 'good');
    this.updateDockBadges();
  }

  onEventStart(e) {
    this.audio.event();
    const where = e.def.rift ? ` at ${SHORE[e.shore]?.name}` : '';
    this.toast(`${e.def.name}${where}! ${e.def.desc}`, 'good');
    this.renderChips();
  }

  // ── chips, tracker, chat ────────────────────────────────────────────
  renderChips() {
    const g = this.g;
    const full = g.fullStats();
    const out = [];
    const now = g.now;
    for (const e of g.events) {
      const here = !e.def.rift || e.shore === g.s.shore;
      const label = e.def.rift && !here ? `${e.def.name} @ ${SHORE[e.shore]?.name}` : e.def.name;
      out.push(`<button class="chip-b event" style="color:${e.def.color}" data-act="eventInfo" data-id="${e.def.id}">${icon(e.def.icon)}<span>${escapeHtml(label)}</span><span class="t">${fmtTime(e.end - now)}</span></button>`);
    }
    const mer = g.merchant();
    if (mer.present) out.push(`<button class="chip-b event" style="color:#ffd54f" data-act="open" data-id="merchant">${icon('merchant')}<span>Merchant</span><span class="t">${fmtTime(mer.leavesAt - now)}</span></button>`);
    if (!g.events.length) {
      const nx = g.nextEvent();
      if (nx) out.push(`<span class="chip-b calm">${icon('clock')}<span>Next event</span><span class="t">${fmtTime(nx.start - now)}</span></span>`);
    }
    if (full.hazard && !full.hazard.protected) {
      out.push(`<button class="chip-b debuff" data-act="open" data-id="shop" data-tab="outfitter">${icon(full.hazard.icon || 'warn')}<span>${full.hazard.name}</span><span class="t">${full.hazard.desc}</span></button>`);
    }
    const cursed = g.s.bag.filter((i) => i.mod === 'cursed').length;
    if (cursed && !full.cleanse) out.push(`<button class="chip-b debuff" data-act="open" data-id="bag">${icon('skull')}<span>Haunted</span><span class="t">-${Math.min(50, cursed * 10)}% Luck</span></button>`);
    if (g.s.streak >= 2) out.push(`<span class="chip-b" style="color:#ff9e40">${icon('flame')}<span>Streak ×${g.s.streak}</span><span class="t">+${Math.round(Math.min(0.5, 0.03 * g.s.streak) * 100)}% luck</span></span>`);
    for (const b of g.s.buffs) {
      const def = POTION[b.id] || TOKEN[b.id];
      if (!def) continue;
      out.push(`<button class="chip-b" style="color:${def.color}" data-act="open" data-id="stats">${icon('potion')}<span>${escapeHtml(def.name.replace(' Potion', ''))}</span><span class="t">${fmtTime(b.left)}</span></button>`);
    }
    const totems = [
      ...g.s.totems.filter((t) => t.shore === g.s.shore).map((t) => ({ ...t, owner: 'You' })),
      ...(g.bots ? g.bots.totems.filter((t) => t.shore === g.s.shore) : []),
    ];
    for (const t of totems) {
      const def = TOTEM[t.id];
      out.push(`<button class="chip-b" style="color:${def.color}" data-act="open" data-id="stats">${icon('totem')}<span>${escapeHtml(def.name)}${t.owner !== 'You' ? ' · ' + escapeHtml(t.owner) : ''}</span><span class="t">${fmtTime(t.left)}</span></button>`);
    }
    const html = out.join('');
    if (html !== this.chipsHtml) {
      this.chipsHtml = html;
      this.el.chips.innerHTML = html;
    }
  }

  renderTracker() {
    const g = this.g;
    const tq = g.trackedQuest();
    const el = this.el.tracker;
    const dailyReady = g.s.quests.daily.list.some((d) => !d.claimed && d.p >= goalTarget(d.goal));
    if (!tq && !dailyReady) { el.classList.remove('show'); return; }
    if (tq) {
      const pct = Math.min(tq.p, tq.n);
      el.classList.add('show');
      el.classList.toggle('ready', tq.done);
      el.dataset.npc = tq.npc.id;
      el.innerHTML = `<span class="q-npc" style="background:${tq.npc.color}33;color:${tq.npc.color}">${icon(tq.done ? 'gift' : 'quests')}</span>
        <span class="q-text"><span class="q-title">${tq.done ? 'Quest complete! Tap to claim' : escapeHtml(tq.q.title)}</span>
        <span class="q-prog">${tq.done ? escapeHtml(tq.q.title) + ' · ' + escapeHtml(tq.npc.name) : `${escapeHtml(tq.q.text)} (${fmtNum(pct)}/${fmtNum(tq.n)})`}</span></span>`;
    } else {
      el.classList.add('show', 'ready');
      el.dataset.npc = '';
      el.innerHTML = `<span class="q-npc" style="background:#ffcf4a33;color:#ffcf4a">${icon('gift')}</span><span class="q-text"><span class="q-title">Daily quest complete!</span><span class="q-prog">Tap to claim your reward</span></span>`;
    }
  }

  onChat(m) {
    if (m.kind === 'chat' && this.g.s.settings.chat === false) return;
    this.renderChatFeed();
    const top = this.stack[this.stack.length - 1];
    if (top?.id === 'chat') {
      const log = document.getElementById('chatlog');
      if (log) {
        log.insertAdjacentHTML('beforeend', chatLine(m));
        log.parentElement.scrollTop = log.parentElement.scrollHeight;
      }
    }
  }

  renderChatFeed() {
    const showBots = this.g.s.settings.chat !== false;
    const n = window.innerWidth <= 600 && window.innerHeight > window.innerWidth ? 4 : 5;
    const msgs = this.g.chatLog.filter((m) => showBots || m.kind !== 'chat').slice(-n);
    this.el.chatfeed.innerHTML = msgs.map(chatLine).join('');
  }

  renderAutoBtn() {
    const unlocked = isUnlocked(this.g.s, 'auto');
    const key = unlocked ? 'u' : 'l';
    if (this.autoKey === key) return;
    this.autoKey = key;
    this.el.autoBtn.classList.toggle('locked', !unlocked);
    this.el.autoBtn.innerHTML = unlocked ? `${icon('auto')}<span>AUTO</span>` : `${icon('lock')}<span>AUTO</span><span class="lk">Lv ${FEATURES.auto.level}</span>`;
  }

  updateDockBadges() {
    const g = this.g;
    const b = this.el.badges;
    const set = (el, n) => { el.textContent = n > 9 ? '9+' : String(n); el.classList.toggle('show', n > 0); };
    const questN = g.activeQuests().filter((q) => q.done).length
      + g.s.quests.daily.list.filter((d) => !d.claimed && d.p >= goalTarget(d.goal)).length
      + g.claimableAchievements().length + (g.loginAvailable() ? 1 : 0);
    set(b.quests, questN);
    const np = g.nextPan();
    set(b.shop, np && !np.req && g.s.cash >= np.price ? 1 : 0);
    const sluiceFull = g.s.placed.filter((p) => p.tray.length > 0).length;
    set(b.more, sluiceFull);
    set(b.bag, 0);
    set(b.map, 0);
  }

  toast(text, kind = 'info') {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = text;
    this.el.toasts.append(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 3000);
  }

  // ── sheets ──────────────────────────────────────────────────────────
  openSheet(id, opts = {}) {
    const def = PANELS[id];
    if (!def) return;
    if (def.requires && !isUnlocked(this.g.s, def.requires)) {
      this.toast(`${FEATURES[def.requires].name} unlocks at level ${FEATURES[def.requires].level}`, 'warn');
      return;
    }
    // replace a same-level sheet rather than stacking duplicates
    if (!opts.stack) this.closeAll(true);
    this.audio.open();
    const entry = { id, tab: opts.tab || def.defaultTab || null, params: opts.params || {}, el: null, small: false };
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="backdrop" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true"></section>`;
    this.el.sheets.append(wrap);
    entry.el = wrap;
    this.stack.push(entry);
    this.renderSheet(entry);
    this.el.sheets.style.pointerEvents = 'auto';
    this.updateDockActive();
  }

  renderSheet(entry, keepScroll) {
    const def = PANELS[entry.id];
    const res = def.render(this, entry);
    if (!entry.tab && res.tabs?.length) entry.tab = res.tabs[0].id;
    const sheet = entry.el.querySelector('.sheet');
    const body = sheet.querySelector('.sheet-body');
    const scroll = keepScroll && body ? body.scrollTop : 0;
    sheet.classList.toggle('small', !!res.small);
    const tabs = res.tabs ? `<div class="tabs">${res.tabs.map((t) => `<button class="tab ${t.id === entry.tab ? 'active' : ''}" data-act="tab" data-tab="${t.id}">${t.icon ? icon(t.icon) : ''}${escapeHtml(t.label)}${t.badge ? `<i class="badge show">${t.badge}</i>` : ''}</button>`).join('')}</div>` : '';
    sheet.innerHTML = `
      <header class="sheet-head"><div class="sheet-title">${res.icon ? icon(res.icon) : ''}${escapeHtml(res.title)}</div>
        <div class="sheet-sub">${res.sub || ''}</div>
        <button class="icon-btn" data-act="close" aria-label="Close">${icon('close')}</button></header>
      ${tabs}
      <div class="sheet-body">${res.body}</div>
      ${res.foot ? `<footer class="sheet-foot">${res.foot}</footer>` : ''}`;
    if (keepScroll) sheet.querySelector('.sheet-body').scrollTop = scroll;
    res.after?.(sheet);
    entry.static = !!res.static;
  }

  queueRefresh() {
    if (this.refreshQueued || !this.stack.length) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      const top = this.stack[this.stack.length - 1];
      if (top && !top.static) this.renderSheet(top, true);
    });
  }

  closeTop() {
    const entry = this.stack.pop();
    if (!entry) return;
    this.audio.close();
    const sheet = entry.el.querySelector('.sheet');
    sheet.classList.add('closing');
    entry.el.querySelector('.backdrop').style.opacity = '0';
    setTimeout(() => entry.el.remove(), 200);
    if (!this.stack.length) this.el.sheets.style.pointerEvents = 'none';
    entry.onClose?.();
    this.updateDockActive();
  }

  closeAll(instant) {
    while (this.stack.length) {
      const e = this.stack.pop();
      if (instant) e.el.remove();
      else { e.el.querySelector('.sheet').classList.add('closing'); setTimeout(() => e.el.remove(), 200); }
      e.onClose?.();
    }
    this.el.sheets.style.pointerEvents = 'none';
    this.updateDockActive();
  }

  updateDockActive() {
    const top = this.stack[0]?.id;
    document.querySelectorAll('.dock-btn').forEach((b) => b.classList.toggle('active', b.dataset.id === top));
  }

  // simple confirm dialog stacked above everything
  confirm({ title, text, ok = 'Confirm', danger = false, icon: ic = 'info' }) {
    return new Promise((resolve) => {
      PANELS.__confirm = {
        render: () => ({
          title, icon: ic, small: true, static: true,
          body: `<div class="dialog"><p>${text}</p></div>`,
          foot: `<button class="btn grow" data-act="confirmNo">Cancel</button><button class="btn grow ${danger ? 'red' : 'gold'}" data-act="confirmYes">${escapeHtml(ok)}</button>`,
        }),
      };
      this.confirmResolve = resolve;
      this.openSheet('__confirm', { stack: true });
      const entry = this.stack[this.stack.length - 1];
      entry.onClose = () => { if (this.confirmResolve) { this.confirmResolve(false); this.confirmResolve = null; } };
    });
  }

  // ── actions ─────────────────────────────────────────────────────────
  async handle(act, d, el) {
    const g = this.g;
    const top = this.stack[this.stack.length - 1];
    switch (act) {
      case 'open': this.openSheet(d.id, { tab: d.tab, stack: !!d.stack, params: { ...d } }); break;
      case 'close': this.closeTop(); break;
      case 'tab':
        if (top) { top.tab = d.tab; this.audio.click(); this.renderSheet(top); }
        break;
      case 'confirmYes': { const r = this.confirmResolve; this.confirmResolve = null; this.closeTop(); r?.(true); break; }
      case 'confirmNo': this.closeTop(); break;
      case 'tracker': {
        const npc = el.dataset.npc;
        const tq = g.trackedQuest();
        if (npc && tq?.done) g.claimQuest(npc);
        else this.openSheet('quests', { tab: tq ? 'story' : 'daily' });
        break;
      }
      case 'auto':
        if (!isUnlocked(g.s, 'auto')) { this.toast(`Auto-Prospect unlocks at level ${FEATURES.auto.level}`, 'warn'); this.audio.deny(); break; }
        g.setAuto(!g.s.auto);
        this.toast(g.s.auto ? 'Auto-Prospect ON (Good quality digs). Manual perfect digs give more luck!' : 'Auto-Prospect OFF', 'info');
        break;
      case 'quickSell': {
        const sellable = g.s.bag.filter((i) => !i.lock);
        if (!sellable.length) { this.openSheet('bag'); break; }
        const rare = sellable.filter((i) => TIER_INDEX[MINERAL[i.m].tier] >= TIER_INDEX.epic || (i.mod && modOf(i.mod).mult >= 2.5));
        const total = sellable.reduce((a, i) => a + g.sellValue(i), 0);
        if (rare.length) {
          const ok = await this.confirm({ title: 'Sell everything?', text: `Sell ${sellable.length} unlocked minerals for <b class="gold-t">${fmtCash(total)}</b>? This includes ${rare.length} Epic+ or highly modified mineral${rare.length > 1 ? 's' : ''}. Lock items in your bag to keep them.`, ok: 'Sell all', icon: 'tag' });
          if (!ok) break;
        }
        g.sell(sellable.map((i) => i.u));
        this.el.sellBtn.classList.remove('warn');
        break;
      }
      case 'eventInfo':
        this.openSheet('events');
        break;
      default:
        if (PANELS.actions[act]) await PANELS.actions[act](this, d, el);
        else console.warn('unknown action', act);
    }
  }
}

export function chatLine(m) {
  if (m.kind === 'system') return `<div class="cmsg sys" style="${m.color ? `color:${m.color}` : ''}">${escapeHtml(m.text)}</div>`;
  if (m.kind === 'announce') return `<div class="cmsg announce" style="color:${m.color || '#ffd54f'}">★ ${escapeHtml(m.text)}</div>`;
  if (m.kind === 'event') return `<div class="cmsg event" style="color:${m.color || '#fff'}">${escapeHtml(m.text)}</div>`;
  return `<div class="cmsg"><b style="color:${m.me ? '#ffd54f' : m.color || '#c5e1a5'}">${escapeHtml(m.who)}:</b> ${escapeHtml(m.text)}</div>`;
}

export { HAZARDS, NPC, fmtPct, TIERS, consumableDef };
