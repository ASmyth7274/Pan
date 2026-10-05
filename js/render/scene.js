// World renderer: draws the current shore (sky, parallax landscape, water,
// deposit), the player and nearby bots, particles, weather, events and
// day/night lighting. Static layers are cached per shore and screen size.
import { SHORE } from '../data/shores.js';
import { PAN, SHOVEL } from '../data/gear.js';
import { TOTEM } from '../data/items.js';
import { MINERAL } from '../data/minerals.js';
import { tierOf } from '../data/rarity.js';
import { nameColor } from '../bots.js';
import { drawCharacter, drawNameTag, drawBubble } from './character.js';
import { mulberry32, hashStr, mixHex, shade, rgba, clamp, lerp, rand, smooth } from '../util.js';

const TAU = Math.PI * 2;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export class Scene {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.t = 0;
    this.particles = [];
    this.texts = [];
    this.meteors = [];
    this.flash = 0;
    this.shake = 0;
    this.playerX = null;
    this.playerDir = -1;
    this.cheer = 0;
    this.cache = null;
    this.clouds = [];
    this.lightning = null;
    this.quality = 'high';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = q;
    this.resize();
  }

  resize() {
    const dprMax = this.quality === 'low' ? 1 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    const W = Math.max(1, window.innerWidth);
    const H = Math.max(1, window.innerHeight);
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    const landscapeShort = W > H && H < 520;
    const portrait = H > W;
    this.L = {
      stageW: Math.min(W, 980),
      groundY: Math.round(H * (landscapeShort ? 0.68 : portrait ? 0.655 : 0.63)),
      maxBots: portrait ? 5 : 9,
    };
    const L = this.L;
    L.stageX = (W - L.stageW) / 2;
    L.charH = clamp(Math.min(H * (portrait ? 0.1 : 0.108), L.stageW * 0.2), 46, 104);
    L.depthSpan = L.charH * 0.5;
    L.farY = L.groundY - L.depthSpan;
    L.horizonY = L.farY - 2;
    L.shoreTopX = L.stageX + L.stageW * 0.54;
    L.shoreBottomX = L.stageX + L.stageW * 0.44;
    L.depositX = L.stageX + Math.max(L.stageW * 0.22, L.charH * 1.45);
    L.depositY = lerp(L.farY, L.groundY, 0.4);
    L.digX = L.depositX + L.charH * 0.95;
    L.panX = L.stageX + L.stageW * 0.68;
    this.cache = null;
  }

  shoreAt(y) {
    const L = this.L;
    const t = clamp((y - L.farY) / (this.H - L.farY), 0, 1);
    return lerp(L.shoreTopX, L.shoreBottomX, t);
  }

  depthY(d) { return lerp(this.L.farY + 2, this.L.groundY, d); }
  depthScale(d) { return 0.68 + 0.32 * d; }

  // ── caching of static layers ─────────────────────────────────────────
  ensureCache() {
    const shore = this.game.shore;
    const key = `${shore.id}:${this.W}x${this.H}@${this.dpr}`;
    if (this.cache && this.cache.key === key) return;
    const far = makeCanvas(this.W * this.dpr, this.H * this.dpr);
    const ground = makeCanvas(this.W * this.dpr, this.H * this.dpr);
    const lights = [];
    const props = {};
    const fctx = far.getContext('2d');
    fctx.scale(this.dpr, this.dpr);
    drawFarLayer(fctx, this, shore, lights, props);
    const gctx = ground.getContext('2d');
    gctx.scale(this.dpr, this.dpr);
    drawGroundLayer(gctx, this, shore);
    const rng = mulberry32(hashStr(shore.id + 'stars'));
    const stars = Array.from({ length: 90 }, () => ({ x: rng(), y: rng(), s: 0.5 + rng() * 1.4, p: rng() * TAU }));
    this.cache = { key, far, ground, lights, props, stars, shore: shore.id };
    this.clouds = [];
    const cr = mulberry32(hashStr(shore.id + 'clouds'));
    if (!shore.theme.cave && !shore.theme.noSun) {
      for (let i = 0; i < 6; i++) this.clouds.push({ x: cr() * this.W, y: this.L.horizonY * (0.12 + cr() * 0.55), s: 0.6 + cr() * 0.9, v: 4 + cr() * 8, sprite: cloudSprite(cr, shore.theme.far.clouds ? '#ffffff' : '#ffffff') });
    }
  }

  // ── effects API (called from UI/game events) ─────────────────────────
  digFx(grade) {
    const L = this.L;
    const x = L.depositX + L.charH * 0.3, y = L.depositY - L.charH * 0.12;
    const col = this.game.shore.theme.deposit;
    const n = grade === 'perfect' ? 16 : 9;
    for (let i = 0; i < n; i++) {
      this.particles.push({ type: 'dirt', x, y, vx: rand(-60, 40), vy: rand(-170, -60), g: 420, life: rand(0.5, 0.9), max: 0.9, s: rand(2, 5), c: i % 3 ? col : shade(col, -0.3) });
    }
    if (grade === 'perfect') {
      for (let i = 0; i < 8; i++) this.particles.push({ type: 'spark', x: x + rand(-20, 20), y: y + rand(-20, 0), vx: rand(-30, 30), vy: rand(-80, -30), g: 0, life: 0.8, max: 0.8, s: rand(3, 6), c: '#ffe082' });
    }
  }

  floatText(text, color, where = 'deposit', big = false) {
    const L = this.L;
    const x = where === 'deposit' ? L.digX - L.charH * 0.2 : this.playerX ?? L.panX;
    const y = (where === 'deposit' ? L.depositY : this.depthY(0.85)) - L.charH * 1.45;
    this.texts.push({ text, color, x, y, life: 1.1, max: 1.1, big });
  }

  splash() {
    const L = this.L;
    const x = (this.playerX ?? L.panX) + L.charH * 0.35;
    const y = this.depthY(0.85) - L.charH * 0.2;
    for (let i = 0; i < 3; i++) this.particles.push({ type: 'drop', x: x + rand(-10, 10), y, vx: rand(-40, 40), vy: rand(-120, -50), g: 400, life: 0.6, max: 0.6, s: rand(1.5, 3), c: '#e3f6ff' });
  }

  findFx(items) {
    const L = this.L;
    const x = (this.playerX ?? L.panX) + L.charH * 0.35;
    const y = this.depthY(0.85) - L.charH * 0.3;
    let best = 0;
    for (const it of items) best = Math.max(best, ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'exotic', 'celestial'].indexOf(MINERAL[it.m].tier));
    for (const it of items) {
      const c = tierOf(MINERAL[it.m].tier).color;
      for (let i = 0; i < 5; i++) this.particles.push({ type: 'spark', x, y, vx: rand(-70, 70), vy: rand(-160, -60), g: 120, life: rand(0.8, 1.4), max: 1.4, s: rand(3, 6), c });
    }
    if (best >= 4) {
      this.cheer = 2;
      this.flash = Math.min(1, 0.25 + (best - 4) * 0.2);
      this.shake = 0.25 + (best - 4) * 0.12;
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU), v = rand(80, 260);
        this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 100, life: rand(1, 1.8), max: 1.8, s: rand(3, 7), c: tierOf(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'exotic', 'celestial'][best]).color });
      }
    }
  }

  coinFx(x, y, n = 12) {
    for (let i = 0; i < n; i++) this.particles.push({ type: 'coin', x: x ?? this.W / 2, y: y ?? this.H * 0.5, vx: rand(-120, 120), vy: rand(-260, -120), g: 520, life: rand(0.8, 1.2), max: 1.2, s: rand(4, 7), c: '#ffd54f' });
  }

  // ── main render ──────────────────────────────────────────────────────
  render(dt) {
    this.t += dt;
    this.ensureCache();
    const { ctx, W, H, L, game } = this;
    const shore = game.shore;
    const theme = shore.theme;
    const day = game.day();
    const events = game.events.map((e) => e.def.id);
    const evHere = new Set(game.events.filter((e) => !e.def.rift || e.shore === shore.id).map((e) => e.def.id));
    const forcedNight = evHere.has('aurora');
    let light = forcedNight ? Math.min(day.light, 0.15) : day.light;
    if (evHere.has('storm')) light *= 0.6;
    if (evHere.has('fog')) light *= 0.85;
    this.light = light;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let sx = 0, sy = 0;
    if (this.shake > 0 && game.s.settings.motion !== false) {
      this.shake -= dt;
      sx = rand(-3, 3) * this.shake * 4; sy = rand(-3, 3) * this.shake * 4;
      ctx.translate(sx, sy);
    }

    this.drawSky(ctx, theme, day, light, evHere);
    // far layer (cached)
    ctx.drawImage(this.cache.far, 0, 0, W, H);
    this.drawLiveProps(ctx, theme, light, evHere);
    // atmospheric tint over far layer to match time of day
    this.tintFar(ctx, theme, day, light);
    ctx.drawImage(this.cache.ground, 0, 0, W, H);
    this.drawWater(ctx, theme, day, light, evHere);
    this.drawDepositSparkle(ctx);
    this.drawTotems(ctx);
    this.drawRift(ctx, evHere);
    this.drawActors(ctx, dt, theme);
    this.updateParticles(ctx, dt, theme, light, evHere);
    this.drawWeather(ctx, dt, theme, light, evHere, events);
    this.drawLighting(ctx, theme, light, evHere);
    this.drawTexts(ctx, dt);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      this.flash = Math.max(0, this.flash - dt * 1.6);
    }
  }

  // ── sky ──────────────────────────────────────────────────────────────
  drawSky(ctx, theme, day, light, ev) {
    const { W, L } = this;
    const sky = theme.sky;
    let top = mixHex(sky.night[0], sky.day[0], light);
    let bot = mixHex(sky.night[1], sky.day[1], light);
    if (day.dusk > 0 && !theme.cave) {
      top = mixHex(top, sky.dusk[0], day.dusk * 0.8);
      bot = mixHex(bot, sky.dusk[1], day.dusk * 0.9);
    }
    if (ev.has('storm')) { top = mixHex(top, '#3a4152', 0.6); bot = mixHex(bot, '#6b7385', 0.6); }
    if (ev.has('solar')) bot = mixHex(bot, '#ffcc66', 0.35);
    if (ev.has('convergence')) { top = mixHex(top, '#3a1a6a', 0.4); bot = mixHex(bot, '#ffd6f5', 0.4); }
    if (ev.has('goldrush')) bot = mixHex(bot, '#ffe08a', 0.25);
    if (ev.has('eruption') && theme.far.volcano) bot = mixHex(bot, '#ff7043', 0.35);
    this.skyBottom = bot;
    const g = ctx.createLinearGradient(0, 0, 0, L.horizonY + 20);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, W + 20, this.H + 20);

    // stars
    const starA = theme.stars ? 0.35 + (1 - light) * 0.65 : (1 - light) * 0.9;
    if (starA > 0.02 && !theme.cave) {
      for (const s of this.cache.stars) {
        const a = starA * (0.55 + 0.45 * Math.sin(this.t * 2 + s.p));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(s.x * W, s.y * L.horizonY * 0.9, s.s, s.s);
      }
    }
    if (theme.cave) this.drawCaveCeiling(ctx, theme);

    // aurora
    if (ev.has('aurora') || ev.has('convergence') || (theme.water.ice && light < 0.4)) {
      const strength = ev.has('aurora') || ev.has('convergence') ? 1 : 0.5 * (1 - light);
      this.drawAurora(ctx, strength, ev.has('convergence'));
    }

    // sun / moon
    if (!theme.cave && !theme.noSun) {
      if (day.sunT >= 0 && day.sunT <= 1) {
        const sx = lerp(W * 0.08, W * 0.92, day.sunT);
        const sy = L.horizonY - Math.sin(day.sunT * Math.PI) * L.horizonY * 0.72 + (theme.sunLow ? L.horizonY * 0.18 : 0);
        const big = ev.has('solar') ? 1.6 : 1;
        const r = 22 * big;
        const gg = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 4);
        gg.addColorStop(0, rgba('#fff7d6', 0.9));
        gg.addColorStop(0.3, rgba(day.dusk > 0.3 ? '#ffb36b' : '#fff1b3', 0.35));
        gg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
        ctx.fillStyle = day.dusk > 0.3 ? '#ffcf8a' : '#fffbe8';
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
        this.sunX = sx;
        if (ev.has('solar')) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(this.t * 0.15);
          for (let i = 0; i < 12; i++) {
            ctx.rotate(TAU / 12);
            ctx.fillStyle = 'rgba(255,214,120,0.18)';
            ctx.beginPath(); ctx.moveTo(-6, r); ctx.lineTo(6, r); ctx.lineTo(0, r * (3 + Math.sin(this.t * 3 + i) * 0.8)); ctx.fill();
          }
          ctx.restore();
        }
      } else this.sunX = null;
      if (day.moonT >= 0 && day.moonT <= 1) {
        const mx = lerp(W * 0.1, W * 0.9, day.moonT);
        const my = L.horizonY - Math.sin(day.moonT * Math.PI) * L.horizonY * 0.7;
        const gg = ctx.createRadialGradient(mx, my, 6, mx, my, 70);
        gg.addColorStop(0, 'rgba(220,230,255,0.35)');
        gg.addColorStop(1, 'rgba(220,230,255,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(mx - 70, my - 70, 140, 140);
        ctx.fillStyle = '#eef2ff';
        ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(160,170,200,0.5)';
        ctx.beginPath(); ctx.arc(mx - 4, my - 3, 3.5, 0, TAU); ctx.arc(mx + 5, my + 4, 2.5, 0, TAU); ctx.fill();
        this.moonX = mx;
      } else this.moonX = null;
    } else if (theme.noSun) {
      // the void's dark star
      const vx = W * 0.72, vy = L.horizonY * 0.35;
      const gg = ctx.createRadialGradient(vx, vy, 10, vx, vy, 120);
      gg.addColorStop(0, 'rgba(255,111,216,0.5)');
      gg.addColorStop(0.4, 'rgba(123,44,191,0.25)');
      gg.addColorStop(1, 'rgba(60,9,108,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(vx - 120, vy - 120, 240, 240);
      ctx.fillStyle = '#05000c';
      ctx.beginPath(); ctx.arc(vx, vy, 26, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,240,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(vx, vy, 54, 12, -0.3 + Math.sin(this.t * 0.3) * 0.05, 0, TAU); ctx.stroke();
    }

    // clouds
    for (const c of this.clouds) {
      c.x += c.v * (1 / 60) * (ev.has('storm') ? 3 : 1);
      if (c.x > W + 160) c.x = -200;
      ctx.globalAlpha = 0.35 + light * 0.55;
      ctx.drawImage(c.sprite, c.x, c.y, c.sprite.width * c.s * 0.5, c.sprite.height * c.s * 0.5);
    }
    ctx.globalAlpha = 1;
    if (ev.has('storm') || ev.has('blizzard')) {
      ctx.fillStyle = ev.has('storm') ? 'rgba(40,46,60,0.35)' : 'rgba(220,235,255,0.2)';
      ctx.fillRect(0, 0, W, L.horizonY);
    }

    // meteors
    if (ev.has('meteor') || ev.has('convergence')) {
      if (Math.random() < 0.08) this.meteors.push({ x: rand(-0.1, 1) * W, y: rand(-20, L.horizonY * 0.3), vx: rand(260, 420), vy: rand(160, 260), life: rand(0.8, 1.4), c: Math.random() < 0.5 ? '#ff9ad5' : '#ffe6a8' });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.life -= 1 / 60;
      m.x += m.vx / 60; m.y += m.vy / 60;
      if (m.life <= 0 || m.y > L.horizonY) { this.meteors.splice(i, 1); continue; }
      const len = 0.18;
      const g2 = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * len, m.y - m.vy * len);
      g2.addColorStop(0, rgba(m.c, 0.95));
      g2.addColorStop(1, rgba(m.c, 0));
      ctx.strokeStyle = g2;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * len, m.y - m.vy * len); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, TAU); ctx.fill();
    }
  }

  drawCaveCeiling(ctx, theme) {
    const { W, L } = this;
    const rng = mulberry32(77);
    ctx.fillStyle = shade(theme.far.color, -0.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W + 40; x += 40) {
      const h = 30 + rng() * 60;
      ctx.lineTo(x, h * 0.5);
      ctx.lineTo(x + 20, h);
      ctx.lineTo(x + 40, h * 0.4);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
    // hanging glow crystals
    for (let i = 0; i < 9; i++) {
      const x = rng() * W, y = 30 + rng() * 40;
      const c = i % 2 ? '#7fdbff' : '#c77dff';
      const a = 0.5 + 0.3 * Math.sin(this.t * 1.5 + i);
      const gg = ctx.createRadialGradient(x, y, 1, x, y, 40);
      gg.addColorStop(0, rgba(c, a * 0.6));
      gg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gg;
      ctx.fillRect(x - 40, y - 40, 80, 80);
      ctx.fillStyle = rgba(c, 0.9);
      ctx.beginPath(); ctx.moveTo(x - 5, y - 18); ctx.lineTo(x + 5, y - 18); ctx.lineTo(x, y + 10); ctx.fill();
    }
    void L;
  }

  drawAurora(ctx, strength, rainbow) {
    const { W, L } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cols = rainbow ? ['#ff80ff', '#80d8ff', '#ccff90', '#ffe57f'] : ['#64ffda', '#69f0ae', '#b388ff'];
    for (let b = 0; b < cols.length; b++) {
      const yBase = L.horizonY * (0.18 + b * 0.09);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = yBase + Math.sin(x * 0.006 + this.t * 0.4 + b) * 24 + Math.sin(x * 0.017 + this.t * 0.7) * 10;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = W; x >= 0; x -= 16) {
        const y = yBase + 60 + Math.sin(x * 0.006 + this.t * 0.4 + b) * 24;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, yBase, 0, yBase + 70);
      g.addColorStop(0, rgba(cols[b], 0.32 * strength));
      g.addColorStop(1, rgba(cols[b], 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  tintFar(ctx, theme, day, light) {
    const { W, L } = this;
    const dark = (1 - light) * 0.38;
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(8,12,34,${dark})`;
      ctx.fillRect(0, 0, W, L.farY + 4);
    }
    if (day.dusk > 0.05 && !theme.cave) {
      ctx.fillStyle = rgba(theme.sky.dusk[1], day.dusk * 0.18);
      ctx.fillRect(0, 0, W, L.farY + 4);
    }
  }

  // ── live props (animated parts of the background) ────────────────────
  drawLiveProps(ctx, theme, light, ev) {
    const p = this.cache.props;
    const t = this.t;
    if (p.volcano) {
      const { x, y, w } = p.volcano;
      const erupt = ev.has('eruption');
      const gg = ctx.createRadialGradient(x, y, 2, x, y, w * (erupt ? 0.9 : 0.5));
      gg.addColorStop(0, `rgba(255,140,40,${erupt ? 0.8 : 0.45 + Math.sin(t * 2) * 0.1})`);
      gg.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - w, y - w, w * 2, w * 2);
      // smoke plume
      for (let i = 0; i < 6; i++) {
        const k = ((t * 0.12 + i / 6) % 1);
        const sx = x + Math.sin(k * 5 + i) * 10 + k * 40, sy = y - k * w * 1.2;
        ctx.fillStyle = `rgba(${erupt ? '70,50,50' : '90,90,100'},${0.35 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(sx, sy, 8 + k * 26, 0, TAU); ctx.fill();
      }
    }
    if (p.waterfall) {
      const { x, y, w, h } = p.waterfall;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      for (let i = 0; i < 7; i++) {
        const yy = y + ((t * 120 + i * h / 7) % h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + (i * 7) % w, yy, 2, 18);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + w / 2 + Math.sin(t * 3 + i) * w * 0.4, y + h, 6 + i * 2, 0, TAU); ctx.fill(); }
    }
    if (p.lighthouse && light < 0.6) {
      const { x, y } = p.lighthouse;
      const a = t * 0.9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dx = Math.cos(a) * 360, dy = Math.sin(a) * 30;
      const g = ctx.createLinearGradient(x, y, x + dx, y + dy);
      g.addColorStop(0, `rgba(255,240,180,${0.45 * (1 - light)})`);
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy - 30); ctx.lineTo(x + dx, y + dy + 30); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (p.boat) {
      const { x, y } = p.boat;
      const by = y + Math.sin(t * 1.4) * 2;
      ctx.fillStyle = '#5d4037';
      ctx.beginPath(); ctx.moveTo(x - 22, by); ctx.lineTo(x + 22, by); ctx.lineTo(x + 15, by + 8); ctx.lineTo(x - 15, by + 8); ctx.fill();
      ctx.fillStyle = '#fff8e1';
      ctx.beginPath(); ctx.moveTo(x, by - 34); ctx.lineTo(x, by - 2); ctx.lineTo(x + 18, by - 4); ctx.fill();
      ctx.fillStyle = '#ffccbc';
      ctx.beginPath(); ctx.moveTo(x - 2, by - 30); ctx.lineTo(x - 2, by - 3); ctx.lineTo(x - 14, by - 4); ctx.fill();
    }
    if (p.chimney) {
      const { x, y } = p.chimney;
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.2 + i / 5) % 1;
        ctx.fillStyle = `rgba(230,230,240,${0.4 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x + Math.sin(k * 6 + i) * 5 + k * 18, y - k * 60, 3 + k * 9, 0, TAU); ctx.fill();
      }
    }
    if (p.portal) {
      this.drawPortal(ctx, p.portal.x, p.portal.y, p.portal.r, '#c77dff', '#ff6fd8');
    }
  }

  drawPortal(ctx, x, y, r, c1, c2) {
    const t = this.t;
    ctx.save();
    const gg = ctx.createRadialGradient(x, y, 2, x, y, r * 2.2);
    gg.addColorStop(0, rgba(c2, 0.55));
    gg.addColorStop(1, rgba(c1, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    ctx.translate(x, y);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(t * (0.6 + i * 0.25));
      ctx.strokeStyle = rgba(i % 2 ? c1 : c2, 0.75);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (1 - i * 0.18), r * 0.6 * (1 - i * 0.18), 0, 0.2, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,0,40,0.85)';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.35, r * 0.22, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawRift(ctx, ev) {
    if (!ev.has('rift')) return;
    const { L } = this;
    this.drawPortal(ctx, L.shoreTopX + L.stageW * 0.22, L.farY - L.charH * 1.4, L.charH * 0.7, '#ff4f8b', '#b388ff');
    if (Math.random() < 0.3) {
      this.particles.push({ type: 'spark', x: L.shoreTopX + L.stageW * 0.22 + rand(-30, 30), y: L.farY - L.charH * 1.4, vx: rand(-40, 40), vy: rand(-40, 40), g: 0, life: 1, max: 1, s: rand(2, 4), c: '#ff80ab' });
    }
  }

  // ── water ────────────────────────────────────────────────────────────
  drawWater(ctx, theme, day, light, ev) {
    const { W, H, L, t } = this;
    const w = theme.water;
    const drought = ev.has('drought');
    const top = L.farY + 2 + (drought ? 6 : 0);
    const shift = drought ? L.charH * 0.25 : 0;
    const x0 = L.shoreTopX + shift, x1 = L.shoreBottomX + shift;
    this.waterTop = top;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(W + 10, top);
    ctx.lineTo(W + 10, H + 10);
    ctx.lineTo(x1, H + 10);
    ctx.closePath();
    const surf = mixHex(mixHex(w.a, this.skyBottom || w.a, 0.25), '#0a1030', (1 - light) * 0.55);
    const deep = mixHex(w.b, '#050818', (1 - light) * 0.5);
    this.waterSurf = surf;
    this.waterDeep = deep;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, surf);
    g.addColorStop(0.35, mixHex(surf, deep, 0.5));
    g.addColorStop(1, deep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();

    // reflection of the far bank, then the bright far shimmer line
    const refl = ctx.createLinearGradient(0, top, 0, top + L.charH * 0.6);
    refl.addColorStop(0, rgba(mixHex(theme.mid.color, '#0a1030', (1 - light) * 0.5), 0.45));
    refl.addColorStop(1, rgba(theme.mid.color, 0));
    ctx.fillStyle = refl;
    ctx.fillRect(x0 - 40, top, W - x0 + 60, L.charH * 0.6);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + light * 0.25})`;
    ctx.fillRect(x0, top, W - x0 + 10, 1.5);

    // sun / moon reflection column
    const refX = this.sunX ?? this.moonX;
    if (refX && refX > x0) {
      for (let i = 0; i < 14; i++) {
        const yy = top + 6 + i * 9 + (i * i) * 0.8;
        const ww = 18 + i * 3 + Math.sin(t * 3 + i) * 6;
        ctx.fillStyle = `rgba(255,245,220,${(0.28 - i * 0.017) * (this.sunX ? 1 : 0.6)})`;
        ctx.fillRect(refX - ww / 2 + Math.sin(t * 2 + i * 1.3) * 4, yy, ww, 2);
      }
    }

    // flow / shimmer strokes
    const speed = (w.type === 'river' ? 40 : 10) * (ev.has('rapids') ? 2.6 : 1);
    const rng = mulberry32(5);
    const n = this.quality === 'low' ? 18 : 34;
    for (let i = 0; i < n; i++) {
      const depthK = rng();
      const yy = top + 6 + Math.pow(depthK, 1.6) * (H - top);
      const len = 14 + depthK * 40;
      let xx = (rng() * (W + 200) + (w.type === 'river' || w.type === 'void' ? t * speed * (0.6 + depthK) : Math.sin(t * 0.8 + i) * 20)) % (W + 200) - 100;
      if (xx < this.shoreAt(yy) - 20) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + (1 - depthK) * 0.14})`;
      ctx.fillRect(xx, yy, len, 1.5 + depthK);
    }

    if (ev.has('rapids') && (w.type === 'river' || w.type === 'sea')) {
      for (let i = 0; i < 10; i++) {
        const yy = top + 10 + ((i * 37) % (H - top - 20));
        const xx = ((i * 97 + t * 160) % (W + 120)) - 60;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 15, yy - 5, xx + 30, yy); ctx.stroke();
      }
    }

    // sea waves rolling to shore
    if (w.type === 'sea') {
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.18 + i / 4) % 1);
        const yy = lerp(top + 8, H, k * 0.8);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - k)})`;
        ctx.lineWidth = 2 + k * 2;
        ctx.beginPath();
        for (let x = this.shoreAt(yy) + 10; x < W + 20; x += 20) {
          const y = yy + Math.sin(x * 0.05 + t * 2 + i) * 3;
          if (x === this.shoreAt(yy) + 10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    if (w.type === 'swamp') {
      const r2 = mulberry32(11);
      for (let i = 0; i < 9; i++) {
        const yy = top + 10 + r2() * (H - top) * 0.6;
        const xx = this.shoreAt(yy) + 20 + r2() * (W - this.shoreAt(yy));
        const s = 6 + r2() * 8;
        ctx.fillStyle = '#4c7a34';
        ctx.beginPath(); ctx.ellipse(xx + Math.sin(t * 0.5 + i) * 3, yy, s, s * 0.4, 0, 0.3, TAU - 0.1); ctx.fill();
        if (i % 3 === 0) { ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.arc(xx, yy - 2, 2.5, 0, TAU); ctx.fill(); }
      }
      if (Math.random() < 0.05) this.particles.push({ type: 'bubble', x: rand(this.shoreAt(top + 40), W), y: rand(top + 10, H * 0.85), vx: 0, vy: -10, g: 0, life: 1, max: 1, s: rand(2, 4), c: '#c8e6c9' });
    }
    if (w.ice) {
      const r3 = mulberry32(21);
      for (let i = 0; i < 6; i++) {
        const yy = top + 8 + r3() * (H - top) * 0.5;
        const xx = ((r3() * W + t * 12 * (0.5 + r3())) % (W + 80)) - 40;
        if (xx < this.shoreAt(yy)) continue;
        ctx.fillStyle = 'rgba(240,250,255,0.85)';
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 18, yy - 3); ctx.lineTo(xx + 26, yy + 3); ctx.lineTo(xx + 6, yy + 5); ctx.fill();
      }
    }
    if (w.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r4 = mulberry32(31);
      for (let i = 0; i < 7; i++) {
        const yy = top + 20 + r4() * (H - top) * 0.7;
        const xx = this.shoreAt(yy) + 30 + r4() * (W - this.shoreAt(yy));
        const a = 0.12 + 0.08 * Math.sin(t * 1.2 + i * 2);
        const gg = ctx.createRadialGradient(xx, yy, 1, xx, yy, 50);
        gg.addColorStop(0, rgba(w.a, a));
        gg.addColorStop(1, rgba(w.a, 0));
        ctx.fillStyle = gg;
        ctx.fillRect(xx - 50, yy - 50, 100, 100);
      }
      ctx.restore();
    }
    if (w.steam && Math.random() < 0.15) {
      const yy = top + rand(5, 40);
      this.particles.push({ type: 'steam', x: rand(this.shoreAt(yy), W), y: yy, vx: rand(-5, 5), vy: rand(-25, -12), g: 0, life: 2.5, max: 2.5, s: rand(8, 16), c: '#ffffff' });
    }
    ctx.restore();

    // foam along the shoreline
    ctx.strokeStyle = rgba(w.foam, 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let y = top; y <= H; y += 8) {
      const x = this.shoreAt(y) + shift + Math.sin(y * 0.08 + t * 2.2) * 3 + 2;
      if (y === top) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba(w.foam, 0.3);
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  drawDepositSparkle(ctx) {
    const { L, t } = this;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.7 + i / 3) % 1;
      if (k > 0.5) continue;
      const a = Math.sin(k * Math.PI * 2);
      const x = L.depositX + Math.sin(i * 2.3) * L.charH * 0.6;
      const y = L.depositY - L.charH * (0.15 + 0.1 * i);
      ctx.fillStyle = `rgba(255,236,150,${a})`;
      star(ctx, x, y, 3 + a * 3);
    }
  }

  drawTotems(ctx) {
    const { game, L, t } = this;
    const shore = game.s.shore;
    const list = [
      ...game.s.totems.filter((x) => x.shore === shore).map((x, i) => ({ id: x.id, x: 0.4 + i * 0.05, owner: 'You' })),
      ...(game.bots ? game.bots.totems.filter((x) => x.shore === shore).map((x) => ({ id: x.id, x: x.x ?? 0.3, owner: x.owner })) : []),
    ];
    for (const tt of list) {
      const def = TOTEM[tt.id];
      if (!def) continue;
      const x = L.stageX + L.stageW * clamp(tt.x, 0.05, 0.5);
      const y = this.depthY(0.15);
      const h = L.charH * 0.9;
      // range ring
      ctx.strokeStyle = rgba(def.color, 0.35 + 0.15 * Math.sin(t * 3));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, L.charH * 1.6, L.charH * 0.32, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba(def.color, 0.08);
      ctx.fill();
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath(); ctx.roundRect(x - h * 0.1, y - h, h * 0.2, h, 3); ctx.fill();
      ctx.fillStyle = '#5d3720';
      ctx.fillRect(x - h * 0.1, y - h * 0.6, h * 0.2, 3);
      const oy = y - h - 6 + Math.sin(t * 2) * 3;
      const gg = ctx.createRadialGradient(x, oy, 1, x, oy, h * 0.5);
      gg.addColorStop(0, rgba('#ffffff', 0.9));
      gg.addColorStop(0.3, rgba(def.color, 0.8));
      gg.addColorStop(1, rgba(def.color, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x, oy, h * 0.5, 0, TAU); ctx.fill();
    }
  }

  // ── actors ───────────────────────────────────────────────────────────
  drawActors(ctx, dt, theme) {
    const { game, L, t } = this;
    const s = game.s;
    const pan = PAN[s.pan], shovel = SHOVEL[s.shovel];
    const actors = [];

    // player position / pose
    const digX = L.digX, panX = L.panX;
    let px, pose = 'idle', dir = -1, tool = 'shovel';
    if (game.phase === 'walk' && game.walk) {
      const k = smooth(clamp(game.walk.t / game.walk.dur, 0, 1));
      const from = game.walk.to === 'water' ? digX : panX;
      const to = game.walk.to === 'water' ? panX : digX;
      px = lerp(from, to, k);
      pose = 'walk';
      dir = to > from ? 1 : -1;
      tool = 'pan';
    } else if (game.phase === 'pan') {
      px = panX;
      pose = 'pan';
      dir = 1;
      tool = 'pan';
    } else {
      px = digX;
      pose = 'dig';
      dir = -1;
    }
    if (this.cheer > 0) { this.cheer -= dt; if (game.phase !== 'walk') pose = 'cheer'; }
    this.playerX = px;
    const cap = game.stats().capacity;
    actors.push({
      me: true, depth: 0.85, x: px, pose, dir, tool,
      name: s.name, level: s.level, title: s.title,
      skin: s.avatar.skin, shirt: s.avatar.shirt, pants: s.avatar.pants, hat: s.avatar.hat,
      toolC1: tool === 'pan' ? pan.c1 : shovel.c1, toolC2: tool === 'pan' ? pan.c2 : shovel.c2,
      raise: game.dig.charging ? game.dig.needle : 0,
      swing: game.dig.cooldown > 0 ? clamp(game.dig.cooldown / Math.max(0.01, game.dig.swing), 0, 1) : 0,
      shaking: game.pan.shaking, panFill: s.pending.sed / cap, glint: !!game.pan.glint,
    });

    // bots at this shore
    if (game.bots) {
      for (const b of game.bots.here().slice(0, L.maxBots)) {
        const x = L.stageX + L.stageW * b.x;
        let bpose = 'idle', btool = 'shovel';
        if (b.state === 'toDig' || b.state === 'toWater' || b.state === 'wander') { bpose = 'walk'; btool = b.state === 'toWater' ? 'pan' : 'shovel'; }
        else if (b.state === 'dig') bpose = 'dig';
        else if (b.state === 'pan') { bpose = 'pan'; btool = 'pan'; }
        if (b.cheer > 0) bpose = 'cheer';
        const bp = b.p;
        const ppan = Object.values(PAN)[Math.min(bp.tier, Object.keys(PAN).length - 1)];
        const digCycle = bpose === 'dig' ? (b.timer % 1) : 0;
        actors.push({
          bot: b, depth: b.depth * 0.55, x, pose: bpose, dir: bpose === 'dig' ? (x < L.depositX ? 1 : -1) : b.dir, tool: btool,
          name: bp.name, level: bp.level, color: nameColor(bp),
          skin: bp.skin, shirt: bp.shirt, pants: bp.pants, hat: bp.hat,
          toolC1: btool === 'pan' ? ppan.c1 : '#9aa4b0', toolC2: btool === 'pan' ? ppan.c2 : '#6b4a2a',
          raise: 0, swing: bpose === 'dig' ? clamp(digCycle, 0, 1) : 0,
          shaking: bpose === 'pan', panFill: 0.5, t: b.anim,
        });
      }
    }
    actors.sort((a, b) => a.depth - b.depth);
    const tags = [];
    for (const a of actors) {
      const y = this.depthY(a.depth);
      const sc = this.depthScale(a.depth);
      const h = L.charH * sc;
      const inWater = a.x > this.shoreAt(y) + h * 0.15;
      const opts = {
        x: a.x, y: y + (inWater ? h * 0.1 : 0), h, dir: a.dir, pose: a.pose, t: a.t ?? t,
        skin: a.skin, shirt: a.shirt, pants: a.pants, hat: a.hat, tool: a.tool, toolC1: a.toolC1, toolC2: a.toolC2,
        raise: a.raise, swing: a.swing, shaking: a.shaking, panFill: a.panFill, glint: a.glint,
        alpha: a.me ? 1 : 0.94,
      };
      if (inWater) {
        // draw the character above the waterline normally, and faintly below it
        const wl = y - h * 0.1;
        ctx.save();
        ctx.beginPath(); ctx.rect(a.x - h * 1.5, wl - h * 3, h * 3, h * 3); ctx.clip();
        drawCharacter(ctx, opts);
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(a.x - h * 1.5, wl, h * 3, h); ctx.clip();
        drawCharacter(ctx, { ...opts, alpha: 0.22 });
        ctx.restore();
        this.ripple(ctx, a.x, wl, h);
      } else {
        drawCharacter(ctx, opts);
      }
      if (a.me && game.pan.shaking && Math.random() < 0.25) this.splash();
      const tagY = y - h * 1.08 - (a.hat && a.hat !== 'none' ? h * 0.12 : 0);
      tags.push({ a, x: a.x, y: tagY });
    }
    // draw the player's tag last and keep bot tags from piling up
    tags.sort((a, b) => (a.a.me ? 1 : 0) - (b.a.me ? 1 : 0) || b.y - a.y);
    const placed = [];
    ctx.font = '600 11px Fredoka, ui-rounded, system-ui, sans-serif';
    for (const tg of tags) {
      const a = tg.a;
      const w = ctx.measureText(a.name).width + 8;
      tg.x = clamp(tg.x, w / 2 + 4, this.W - w / 2 - 4);
      let y = tg.y;
      let ok = true;
      for (let tries = 0; tries < 3; tries++) {
        const hit = placed.find((r) => Math.abs(r.x - tg.x) < (r.w + w) / 2 && Math.abs(r.y - y) < 24);
        if (!hit) { ok = true; break; }
        ok = false;
        y = hit.y - 26;
      }
      if (!ok && !a.me) continue;
      placed.push({ x: tg.x, y, w });
      if (y !== tg.y) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tg.x, tg.y + 2); ctx.lineTo(tg.x, y + 2); ctx.stroke();
      }
      drawNameTag(ctx, tg.x, y, a.name, a.level, a.color, a.me, a.me ? a.title : null);
      const bub = a.bot?.bubble;
      if (bub) drawBubble(ctx, tg.x, y - 24, bub.text, clamp(bub.t, 0, 1));
    }
  }

  ripple(ctx, x, wl, h) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, wl, h * 0.28 + Math.sin(this.t * 4 + x) * 2, h * 0.04, 0, 0, TAU);
    ctx.stroke();
    const k = (this.t * 0.8 + x * 0.01) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - k)})`;
    ctx.beginPath();
    ctx.ellipse(x, wl, h * (0.3 + k * 0.35), h * (0.045 + k * 0.03), 0, 0, TAU);
    ctx.stroke();
  }

  // ── particles ────────────────────────────────────────────────────────
  updateParticles(ctx, dt, theme, light, ev) {
    const { W, H, L } = this;
    const ambient = theme.particles;
    const q = this.quality === 'low' ? 0.4 : 1;
    const spawn = (p) => { if (this.particles.length < 260) this.particles.push(p); };
    if (Math.random() < 0.12 * q) {
      switch (ambient) {
        case 'leaves': spawn({ type: 'leaf', x: rand(-20, W), y: -10, vx: rand(10, 30), vy: rand(18, 32), g: 0, life: 9, max: 9, s: rand(3, 5), c: Math.random() < 0.5 ? '#7cb342' : '#c0ca33', r: rand(0, TAU) }); break;
        case 'snow': spawn({ type: 'snow', x: rand(-20, W + 20), y: -10, vx: rand(-10, 10), vy: rand(20, 45), g: 0, life: 12, max: 12, s: rand(1.5, 3.5), c: '#ffffff' }); spawn({ type: 'snow', x: rand(-20, W + 20), y: -10, vx: rand(-10, 10), vy: rand(20, 45), g: 0, life: 12, max: 12, s: rand(1.5, 3), c: '#ffffff' }); break;
        case 'ash': spawn({ type: 'snow', x: rand(-20, W + 20), y: -10, vx: rand(-15, 5), vy: rand(15, 30), g: 0, life: 12, max: 12, s: rand(1.5, 3), c: Math.random() < 0.15 ? '#ff8a50' : '#8d8d8d' }); break;
        case 'sand': spawn({ type: 'dust', x: -10, y: rand(L.horizonY, H * 0.8), vx: rand(60, 120), vy: rand(-5, 5), g: 0, life: 8, max: 8, s: rand(1, 2), c: '#f3d9a4' }); break;
        case 'spores': spawn({ type: 'float', x: rand(0, W), y: rand(L.horizonY, H * 0.8), vx: rand(-6, 6), vy: rand(-12, -4), g: 0, life: 5, max: 5, s: rand(1.5, 3), c: '#c5e1a5' }); break;
        case 'motes': spawn({ type: 'float', x: rand(0, W), y: rand(L.horizonY * 0.5, H * 0.8), vx: rand(-6, 6), vy: rand(-10, -2), g: 0, life: 5, max: 5, s: rand(1, 2.5), c: theme.water.glow ? theme.water.a : '#fff8e1' }); break;
        case 'stars': spawn({ type: 'float', x: rand(0, W), y: rand(0, H * 0.7), vx: 0, vy: rand(-6, -2), g: 0, life: 3, max: 3, s: rand(1, 2.5), c: '#e1bee7' }); break;
        case 'feathers': spawn({ type: 'leaf', x: rand(-20, W), y: -10, vx: rand(5, 20), vy: rand(10, 22), g: 0, life: 12, max: 12, s: rand(3, 5), c: '#ffffff', r: rand(0, TAU) }); break;
        case 'fireflies': if (light < 0.6) spawn({ type: 'firefly', x: rand(0, W), y: rand(L.horizonY, H * 0.75), vx: rand(-8, 8), vy: rand(-8, 8), g: 0, life: 5, max: 5, s: rand(1.5, 2.5), c: '#e6ee9c' }); break;
        default: break;
      }
    }
    if (light < 0.4 && ambient !== 'fireflies' && (ambient === 'leaves' || theme.flora === 'oak') && Math.random() < 0.05 * q) {
      spawn({ type: 'firefly', x: rand(0, W), y: rand(L.horizonY, H * 0.75), vx: rand(-8, 8), vy: rand(-8, 8), g: 0, life: 5, max: 5, s: rand(1.5, 2.5), c: '#e6ee9c' });
    }
    if (ev.has('goldrush') && Math.random() < 0.45 * q) spawn({ type: Math.random() < 0.5 ? 'coin' : 'spark', x: rand(0, W), y: rand(-10, H * 0.4), vx: rand(-10, 10), vy: rand(30, 80), g: 20, life: 3, max: 3, s: rand(3, 5), c: '#ffd54f' });
    if (ev.has('blessing') && Math.random() < 0.4 * q) spawn({ type: 'spark', x: rand(0, W), y: rand(0, H * 0.6), vx: 0, vy: rand(10, 30), g: 0, life: 2, max: 2, s: rand(2, 5), c: '#fff59d' });
    if (ev.has('convergence') && Math.random() < 0.4 * q) spawn({ type: 'spark', x: rand(0, W), y: rand(0, H * 0.6), vx: rand(-10, 10), vy: rand(-10, 10), g: 0, life: 2, max: 2, s: rand(2, 5), c: ['#ff80ff', '#80d8ff', '#ccff90', '#ffe57f'][Math.floor(Math.random() * 4)] });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 20 || p.x > W + 40 || p.x < -60) { this.particles.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = clamp(p.life / p.max, 0, 1);
      switch (p.type) {
        case 'dirt':
          ctx.fillStyle = p.c;
          ctx.globalAlpha = a;
          ctx.fillRect(p.x, p.y, p.s, p.s);
          break;
        case 'drop':
          ctx.fillStyle = p.c;
          ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
          break;
        case 'spark':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.c;
          star(ctx, p.x, p.y, p.s * (0.6 + a * 0.4));
          break;
        case 'coin':
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffca28';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * Math.abs(Math.sin(p.life * 12)), p.s, 0, 0, TAU); ctx.fill();
          break;
        case 'leaf':
          p.r += dt * 2;
          p.x += Math.sin(p.life * 2) * 0.4;
          ctx.globalAlpha = Math.min(1, a * 3) * 0.85;
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'snow': case 'dust':
          p.x += Math.sin(p.life * 1.5 + p.s) * 0.3;
          ctx.globalAlpha = Math.min(1, a * 3) * 0.85;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
          break;
        case 'float': case 'bubble':
          ctx.globalAlpha = Math.sin(a * Math.PI) * 0.8;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
          break;
        case 'firefly': {
          const fa = Math.sin(a * Math.PI) * (0.5 + 0.5 * Math.sin(this.t * 8 + p.x));
          ctx.globalAlpha = fa;
          const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 4);
          gg.addColorStop(0, p.c);
          gg.addColorStop(1, rgba(p.c, 0));
          ctx.fillStyle = gg;
          ctx.fillRect(p.x - p.s * 4, p.y - p.s * 4, p.s * 8, p.s * 8);
          break;
        }
        case 'steam':
          p.s += dt * 6;
          ctx.globalAlpha = Math.sin(a * Math.PI) * 0.25;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
          break;
        default: break;
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── weather & events ─────────────────────────────────────────────────
  drawWeather(ctx, dt, theme, light, ev) {
    const { W, H, t } = this;
    const q = this.quality === 'low' ? 0.5 : 1;
    if (ev.has('storm')) {
      ctx.strokeStyle = 'rgba(200,215,240,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const n = Math.floor(70 * q);
      for (let i = 0; i < n; i++) {
        const x = ((i * 73.3 + t * 600) % (W + 100)) - 50;
        const y = ((i * 131.7 + t * 900) % (H + 100)) - 50;
        ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 18);
      }
      ctx.stroke();
      if (!this.lightning && Math.random() < 0.006) {
        this.lightning = { life: 0.35, x: rand(W * 0.1, W * 0.9) };
        this.flash = 0.6;
      }
      if (this.lightning) {
        const lt = this.lightning;
        lt.life -= dt;
        ctx.strokeStyle = `rgba(255,255,240,${lt.life * 2.5})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let x = lt.x, y = 0;
        ctx.moveTo(x, y);
        const r = mulberry32(Math.floor(lt.x));
        while (y < this.L.horizonY) { x += (r() - 0.5) * 40; y += 20 + r() * 20; ctx.lineTo(x, y); }
        ctx.stroke();
        if (lt.life <= 0) this.lightning = null;
      }
    }
    if (ev.has('blizzard')) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const n = Math.floor((theme.water.ice ? 120 : 50) * q);
      for (let i = 0; i < n; i++) {
        const x = ((i * 53.7 + t * 260) % (W + 100)) - 50;
        const y = ((i * 97.1 + t * 120 + Math.sin(i) * 30) % (H + 60)) - 30;
        ctx.fillRect(x, y, 2.2, 2.2);
      }
      ctx.fillStyle = 'rgba(230,240,255,0.18)';
      ctx.fillRect(0, 0, W, H);
    }
    if (ev.has('eruption')) {
      ctx.fillStyle = 'rgba(120,40,20,0.08)';
      ctx.fillRect(0, 0, W, H);
      if (Math.random() < 0.2 * q) this.particles.push({ type: 'snow', x: rand(0, W), y: -10, vx: rand(-15, 5), vy: rand(20, 40), g: 0, life: 10, max: 10, s: rand(1.5, 3), c: Math.random() < 0.3 ? '#ff7043' : '#757575' });
    }
    if (ev.has('fog') || theme.fog) {
      const strength = ev.has('fog') ? 1 : 0.45;
      for (let i = 0; i < 3; i++) {
        const y = this.L.horizonY - 20 + i * 50;
        const x = ((t * (8 + i * 4)) % (W + 400)) - 400;
        const g = ctx.createLinearGradient(0, y - 40, 0, y + 60);
        const c = theme.fog || '#cfd8dc';
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.5, rgba(c, 0.22 * strength));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, y - 40, W + 400, 100);
        ctx.fillRect(x - W - 400, y - 40, W + 400, 100);
      }
    }
    if (ev.has('drought')) {
      ctx.fillStyle = 'rgba(255,200,120,0.08)';
      ctx.fillRect(0, 0, W, H);
    }
    if (ev.has('goldrush')) {
      const gv = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.75);
      gv.addColorStop(0, 'rgba(255,214,90,0)');
      gv.addColorStop(1, `rgba(255,196,60,${0.22 + 0.06 * Math.sin(t * 2)})`);
      ctx.fillStyle = gv;
      ctx.fillRect(0, 0, W, H);
    }
    if (ev.has('blessing') || ev.has('convergence')) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = W * (0.15 + i * 0.18) + Math.sin(t * 0.3 + i) * 20;
        const g = ctx.createLinearGradient(x, 0, x + 60, H * 0.7);
        g.addColorStop(0, rgba(ev.has('convergence') ? '#e1bee7' : '#fff59d', 0.18));
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 140, H * 0.7); ctx.lineTo(x + 40, H * 0.7); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawLighting(ctx, theme, light, ev) {
    const { W, H, L } = this;
    const dark = (1 - light) * (theme.cave ? 0.18 : 0.3);
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(6,10,30,${dark})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // lantern around the player
      const px = this.playerX ?? L.digX, py = this.depthY(0.85) - L.charH * 0.6;
      const lg = ctx.createRadialGradient(px, py, 4, px, py, L.charH * 2.4);
      lg.addColorStop(0, `rgba(255,190,110,${0.28 * (1 - light)})`);
      lg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(px - L.charH * 2.4, py - L.charH * 2.4, L.charH * 4.8, L.charH * 4.8);
      for (const l of this.cache.lights) {
        const a = (1 - light) * l.a * (0.85 + 0.15 * Math.sin(this.t * 3 + l.x));
        const g = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r);
        g.addColorStop(0, rgba(l.c, a));
        g.addColorStop(1, rgba(l.c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.restore();
    }
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    void ev;
  }

  drawTexts(ctx, dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i];
      tx.life -= dt;
      if (tx.life <= 0) { this.texts.splice(i, 1); continue; }
      const k = 1 - tx.life / tx.max;
      const y = tx.y - k * 40;
      ctx.globalAlpha = clamp(tx.life / tx.max * 2, 0, 1);
      ctx.font = `700 ${tx.big ? 22 : 16}px Fredoka, ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      const sc = k < 0.15 ? 0.6 + k * 2.7 : 1;
      ctx.save();
      ctx.translate(tx.x, y);
      ctx.scale(sc, sc);
      ctx.strokeText(tx.text, 0, 0);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function star(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

function cloudSprite(r, color) {
  const c = makeCanvas(300, 120);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 50 + r() * 200, y = 55 + r() * 30, rad = 22 + r() * 30;
    const g = ctx.createRadialGradient(x, y - rad * 0.3, rad * 0.2, x, y, rad);
    g.addColorStop(0, rgba(color, 0.95));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  return c;
}

// ── static layer painters ──────────────────────────────────────────────
function ridge(ctx, rng, W, baseY, height, rough, color, step = 24) {
  const pts = [];
  const p1 = rng() * 10, p2 = rng() * 10, p3 = rng() * 10;
  const f1 = (Math.PI * 2) / Math.max(320, W * 0.7), f2 = f1 * 2.3, f3 = f1 * 5.1;
  for (let x = -step; x <= W + step; x += step) {
    let k = 0.55 + 0.24 * Math.sin(x * f1 + p1) + 0.13 * Math.sin(x * f2 + p2) + 0.08 * Math.sin(x * f3 + p3);
    k += (rng() - 0.5) * rough * 0.35;
    const h = height * clamp(k, 0.12, 1);
    pts.push([x, baseY - h]);
  }
  ctx.beginPath();
  ctx.moveTo(-step, baseY + 2);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(W + step, baseY + 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  return pts;
}

function smoothRidge(ctx, rng, W, baseY, height, freq, color) {
  const ph = rng() * 10, ph2 = rng() * 10;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 2);
  for (let x = 0; x <= W; x += 8) {
    const y = baseY - height * (0.55 + 0.3 * Math.sin(x * freq + ph) + 0.15 * Math.sin(x * freq * 2.7 + ph2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, baseY + 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawFarLayer(ctx, scene, shore, lights, props) {
  const { W, H, L } = scene;
  const th = shore.theme;
  const rng = mulberry32(hashStr(shore.id + 'far'));
  const base = L.horizonY;
  const haze = th.sky.day[1];
  const farCol = mixHex(th.far.color, haze, 0.35);

  // mountains / far features
  if (th.far.cliffs) {
    ctx.fillStyle = mixHex(th.far.color, haze, 0.2);
    ctx.beginPath();
    ctx.moveTo(0, base + 2);
    ctx.lineTo(0, base - H * 0.24);
    ctx.lineTo(W * 0.22, base - H * 0.22);
    ctx.lineTo(W * 0.3, base - H * 0.12);
    ctx.lineTo(W * 0.42, base - H * 0.1);
    ctx.lineTo(W * 0.46, base + 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,130,100,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, base - H * 0.04 * i); ctx.lineTo(W * (0.42 - i * 0.03), base - H * 0.035 * i); ctx.stroke(); }
    ridge(ctx, rng, W, base, H * 0.05, 0.3, farCol);
  } else if (th.far.mesa) {
    for (let i = 0; i < 4; i++) {
      const x = W * (0.05 + i * 0.27 + rng() * 0.05), w = W * (0.12 + rng() * 0.1), h = H * (0.06 + rng() * 0.06);
      ctx.fillStyle = mixHex(th.far.color, haze, 0.25 + i * 0.08);
      ctx.beginPath(); ctx.moveTo(x - w * 0.2, base + 2); ctx.lineTo(x, base - h); ctx.lineTo(x + w, base - h); ctx.lineTo(x + w * 1.2, base + 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,50,30,0.15)';
      ctx.fillRect(x, base - h + h * 0.3, w, 3);
    }
  } else if (th.far.islands) {
    for (let i = 0; i < 3; i++) {
      const x = W * (0.55 + i * 0.15), w = W * (0.06 + rng() * 0.06), h = H * (0.015 + rng() * 0.02);
      ctx.fillStyle = farCol;
      ctx.beginPath(); ctx.ellipse(x, base, w, h, 0, Math.PI, 0); ctx.fill();
    }
    ridge(ctx, rng, W * 0.5, base, H * 0.06, 0.3, farCol);
  } else if (th.far.floating) {
    for (let i = 0; i < 6; i++) {
      const x = rng() * W, y = base - H * (0.08 + rng() * 0.22), w = 30 + rng() * 60;
      ctx.fillStyle = mixHex(th.far.color, '#000000', 0.2);
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.2, y + w * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = mixHex(th.ground.top, haze, 0.3);
      ctx.fillRect(x - w, y - 4, w * 2, 5);
      lights.push({ x, y: y + w * 0.4, r: w * 0.9, c: '#c77dff', a: 0.25 });
    }
    ridge(ctx, rng, W, base, H * th.far.height * 0.6, th.far.rough, farCol, 18);
  } else if (th.far.clouds) {
    for (let i = 0; i < 14; i++) {
      const x = rng() * W, r = 30 + rng() * 50;
      ctx.fillStyle = mixHex('#ffffff', haze, 0.2 + rng() * 0.2);
      ctx.beginPath(); ctx.arc(x, base - r * 0.3, r, 0, TAU); ctx.fill();
    }
  } else {
    const pts = ridge(ctx, rng, W, base, H * th.far.height, th.far.rough, farCol, th.far.rough > 0.5 ? 20 : 30);
    if (th.far.snow) {
      ctx.fillStyle = mixHex('#ffffff', haze, 0.15);
      const maxH = Math.min(...pts.map((p) => p[1]));
      for (const [x, y] of pts) {
        if (y < maxH + H * th.far.height * 0.22 && rng() < 0.85) {
          ctx.beginPath(); ctx.moveTo(x - 14, y + 14); ctx.lineTo(x, y); ctx.lineTo(x + 14, y + 14); ctx.lineTo(x + 5, y + 10); ctx.lineTo(x - 4, y + 13); ctx.fill();
        }
      }
    }
    // second, nearer ridge
    ridge(ctx, rng, W, base, H * th.far.height * 0.55, th.far.rough * 0.8, mixHex(th.far.color, haze, 0.15), 26);
  }
  if (th.far.volcano) {
    const x = W * 0.72, w = Math.min(W * 0.3, 260), h = H * 0.22;
    ctx.fillStyle = mixHex('#3b1f1f', haze, 0.2);
    ctx.beginPath(); ctx.moveTo(x - w, base + 2); ctx.lineTo(x - w * 0.16, base - h); ctx.lineTo(x + w * 0.16, base - h); ctx.lineTo(x + w, base + 2); ctx.fill();
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.moveTo(x - w * 0.12, base - h); ctx.lineTo(x - w * 0.05, base - h * 0.6); ctx.lineTo(x, base - h * 0.75); ctx.lineTo(x + w * 0.04, base - h * 0.45); ctx.lineTo(x + w * 0.12, base - h); ctx.fill();
    props.volcano = { x, y: base - h, w: w * 0.6 };
    lights.push({ x, y: base - h, r: w * 0.6, c: '#ff7043', a: 0.5 });
  }
  if (th.far.crater) {
    ctx.fillStyle = mixHex(th.far.color, '#000000', 0.25);
    ctx.beginPath(); ctx.ellipse(W * 0.5, base + 6, W * 0.45, H * 0.06, 0, Math.PI, 0); ctx.fill();
  }

  // mid layer
  const midBase = L.farY - 2;
  const midCol = mixHex(th.mid.color, haze, 0.12);
  switch (th.mid.type) {
    case 'hills': smoothRidge(ctx, rng, W, midBase, H * 0.07, 0.008, midCol); break;
    case 'dunes': smoothRidge(ctx, rng, W, midBase, H * 0.06, 0.006, midCol); smoothRidge(ctx, rng, W, midBase, H * 0.035, 0.011, shade(midCol, 0.08)); break;
    case 'cliffs': smoothRidge(ctx, rng, W, midBase, H * 0.05, 0.01, midCol); break;
    case 'jungle':
      for (let i = 0; i < 26; i++) {
        const x = rng() * W, r = 20 + rng() * 34;
        ctx.fillStyle = mixHex(th.mid.color, i % 2 ? '#0b3d1e' : '#2e7d32', 0.3);
        ctx.beginPath(); ctx.arc(x, midBase - r * 0.4, r, 0, TAU); ctx.fill();
      }
      break;
    case 'crystals':
      for (let i = 0; i < 14; i++) {
        const x = rng() * W, h = 30 + rng() * 80, w = 8 + rng() * 14;
        const c = i % 2 ? '#7fdbff' : '#b388ff';
        ctx.fillStyle = mixHex(c, th.mid.color, 0.55);
        ctx.beginPath(); ctx.moveTo(x - w, midBase); ctx.lineTo(x - w * 0.6, midBase - h); ctx.lineTo(x, midBase - h - w); ctx.lineTo(x + w * 0.6, midBase - h); ctx.lineTo(x + w, midBase); ctx.fill();
        lights.push({ x, y: midBase - h * 0.6, r: 50, c, a: 0.35 });
      }
      break;
    case 'rocks':
      ridge(ctx, rng, W, midBase, H * 0.06, 0.8, midCol, 16);
      break;
    case 'spires':
      for (let i = 0; i < 10; i++) {
        const x = rng() * W, h = 50 + rng() * 90, w = 5 + rng() * 8;
        ctx.fillStyle = midCol;
        ctx.beginPath(); ctx.moveTo(x - w, midBase); ctx.quadraticCurveTo(x + w * 2, midBase - h * 0.5, x, midBase - h); ctx.quadraticCurveTo(x + w * 0.5, midBase - h * 0.5, x + w, midBase); ctx.fill();
        lights.push({ x, y: midBase - h, r: 30, c: '#ff6fd8', a: 0.4 });
      }
      smoothRidge(ctx, rng, W, midBase, H * 0.03, 0.01, midCol);
      break;
    case 'clouds':
      for (let i = 0; i < 18; i++) {
        const x = rng() * W, r = 18 + rng() * 26;
        ctx.fillStyle = mixHex('#ffffff', th.mid.color, 0.3);
        ctx.beginPath(); ctx.arc(x, midBase - r * 0.2, r, 0, TAU); ctx.fill();
      }
      break;
    default: break;
  }

  // props
  for (const p of th.props || []) drawProp(ctx, scene, p, th, rng, lights, props, midBase);

  // background trees on the land side
  const flora = th.flora;
  const treeCount = Math.round(W / 70);
  for (let i = 0; i < treeCount; i++) {
    const x = (i / treeCount) * W + rng() * 30;
    if (x > L.shoreTopX - 10 && th.water.type !== 'sea' && rng() < 0.75) continue;
    const s = 0.7 + rng() * 0.6;
    drawFlora(ctx, flora, x, midBase + 2, L.charH * 1.2 * s, th, rng, lights);
  }
}

function drawProp(ctx, scene, p, th, rng, lights, props, base) {
  const { W, H, L } = scene;
  const ch = L.charH;
  switch (p) {
    case 'mill': {
      const x = Math.max(L.shoreTopX + ch * 1.2, W * 0.8), y = base;
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 9, y - ch * 1.3); ctx.lineTo(x + 9, y - ch * 1.3); ctx.lineTo(x + 14, y); ctx.fill();
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath(); ctx.moveTo(x - 12, y - ch * 1.3); ctx.lineTo(x, y - ch * 1.55); ctx.lineTo(x + 12, y - ch * 1.3); ctx.fill();
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.moveTo(x, y - ch * 1.35); ctx.lineTo(x + Math.cos(a) * ch * 0.7, y - ch * 1.35 + Math.sin(a) * ch * 0.7); ctx.stroke(); }
      lights.push({ x, y: y - ch * 0.8, r: 26, c: '#ffcc80', a: 0.6 });
      break;
    }
    case 'town': {
      let x = L.shoreTopX + ch * 0.6;
      const cols = ['#ef9a9a', '#90caf9', '#ffe082', '#a5d6a7', '#ce93d8', '#ffab91'];
      for (let i = 0; i < 6 && x < W - 20; i++) {
        const w = ch * (0.55 + rng() * 0.35), h = ch * (0.45 + rng() * 0.4);
        ctx.fillStyle = mixHex(cols[i % cols.length], th.sky.day[1], 0.25);
        ctx.fillRect(x, base - h, w, h);
        ctx.fillStyle = mixHex('#8d4a3a', th.sky.day[1], 0.2);
        ctx.beginPath(); ctx.moveTo(x - 4, base - h); ctx.lineTo(x + w / 2, base - h - ch * 0.3); ctx.lineTo(x + w + 4, base - h); ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(x + w * 0.2, base - h * 0.7, w * 0.18, h * 0.2);
        ctx.fillRect(x + w * 0.6, base - h * 0.7, w * 0.18, h * 0.2);
        lights.push({ x: x + w / 2, y: base - h * 0.6, r: w, c: '#ffcc80', a: 0.55 });
        if (i === 2) {
          ctx.fillStyle = mixHex('#eeeeee', th.sky.day[1], 0.2);
          ctx.fillRect(x + w + 2, base - ch * 1.25, ch * 0.3, ch * 1.25);
          ctx.beginPath(); ctx.moveTo(x + w, base - ch * 1.25); ctx.lineTo(x + w + 2 + ch * 0.15, base - ch * 1.65); ctx.lineTo(x + w + 4 + ch * 0.3, base - ch * 1.25); ctx.fillStyle = '#8d4a3a'; ctx.fill();
          x += ch * 0.35;
        }
        x += w + 6;
      }
      break;
    }
    case 'boat':
      props.boat = { x: W * 0.82, y: base - 6 };
      break;
    case 'shack': {
      const x = L.shoreTopX + (W - L.shoreTopX) * 0.45, y = base;
      ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 3;
      for (const dx of [-ch * 0.4, ch * 0.4]) { ctx.beginPath(); ctx.moveTo(x + dx, y + 6); ctx.lineTo(x + dx, y - ch * 0.4); ctx.stroke(); }
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x - ch * 0.5, y - ch * 0.95, ch, ch * 0.55);
      ctx.fillStyle = '#4e342e';
      ctx.beginPath(); ctx.moveTo(x - ch * 0.6, y - ch * 0.95); ctx.lineTo(x, y - ch * 1.3); ctx.lineTo(x + ch * 0.6, y - ch * 0.95); ctx.fill();
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(x - ch * 0.15, y - ch * 0.8, ch * 0.2, ch * 0.2);
      lights.push({ x, y: y - ch * 0.7, r: ch, c: '#ffd54f', a: 0.6 });
      break;
    }
    case 'pyramid': {
      for (const [fx, s] of [[0.7, 1], [0.86, 0.7]]) {
        const x = W * fx, h = ch * 1.6 * s;
        ctx.fillStyle = mixHex('#e0b070', th.sky.day[1], 0.3);
        ctx.beginPath(); ctx.moveTo(x - h, base); ctx.lineTo(x, base - h); ctx.lineTo(x + h, base); ctx.fill();
        ctx.fillStyle = mixHex('#c58f4a', th.sky.day[1], 0.3);
        ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x + h, base); ctx.lineTo(x + h * 0.3, base); ctx.fill();
      }
      break;
    }
    case 'cabin': {
      const x = W * 0.1, y = base;
      ctx.fillStyle = '#795548'; ctx.fillRect(x - ch * 0.5, y - ch * 0.55, ch, ch * 0.55);
      ctx.fillStyle = '#eceff1';
      ctx.beginPath(); ctx.moveTo(x - ch * 0.62, y - ch * 0.55); ctx.lineTo(x, y - ch * 0.95); ctx.lineTo(x + ch * 0.62, y - ch * 0.55); ctx.fill();
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x + ch * 0.2, y - ch * 1.0, ch * 0.14, ch * 0.3);
      ctx.fillStyle = '#ffcc80'; ctx.fillRect(x - ch * 0.25, y - ch * 0.4, ch * 0.2, ch * 0.18);
      props.chimney = { x: x + ch * 0.27, y: y - ch * 1.02 };
      lights.push({ x: x - ch * 0.15, y: y - ch * 0.3, r: ch * 0.9, c: '#ffb74d', a: 0.6 });
      break;
    }
    case 'lava': {
      const x = W * 0.6;
      ctx.fillStyle = '#ff6d00';
      ctx.beginPath(); ctx.moveTo(x, base - H * 0.12); ctx.quadraticCurveTo(x + 10, base - H * 0.06, x + 4, base); ctx.lineTo(x + 12, base); ctx.quadraticCurveTo(x + 18, base - H * 0.06, x + 8, base - H * 0.12); ctx.fill();
      lights.push({ x: x + 6, y: base - H * 0.06, r: 70, c: '#ff6d00', a: 0.55 });
      break;
    }
    case 'lighthouse': {
      const x = W * 0.86, y = base + 2, h = ch * 2.1;
      ctx.fillStyle = '#8d8d8d';
      ctx.beginPath(); ctx.ellipse(x, y, ch * 0.7, ch * 0.18, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.moveTo(x - ch * 0.28, y - ch * 0.1); ctx.lineTo(x - ch * 0.18, y - h); ctx.lineTo(x + ch * 0.18, y - h); ctx.lineTo(x + ch * 0.28, y - ch * 0.1); ctx.fill();
      ctx.fillStyle = '#e53935';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - ch * 0.26 + i * 1.5, y - ch * (0.5 + i * 0.55), ch * 0.52 - i * 3, ch * 0.2);
      ctx.fillStyle = '#ffeb3b'; ctx.fillRect(x - ch * 0.16, y - h - ch * 0.22, ch * 0.32, ch * 0.22);
      ctx.fillStyle = '#424242';
      ctx.beginPath(); ctx.moveTo(x - ch * 0.22, y - h - ch * 0.22); ctx.lineTo(x, y - h - ch * 0.45); ctx.lineTo(x + ch * 0.22, y - h - ch * 0.22); ctx.fill();
      props.lighthouse = { x, y: y - h - ch * 0.11 };
      lights.push({ x, y: y - h - ch * 0.11, r: ch * 1.1, c: '#fff59d', a: 0.9 });
      break;
    }
    case 'temple': {
      const x = W * 0.16, y = base;
      for (let i = 0; i < 4; i++) {
        const w = ch * (1.6 - i * 0.32), h = ch * 0.28;
        ctx.fillStyle = mixHex('#8d9b6a', th.sky.day[1], 0.25 + i * 0.03);
        ctx.fillRect(x - w / 2, y - h * (i + 1), w, h);
        ctx.fillStyle = 'rgba(40,70,30,0.35)';
        ctx.fillRect(x - w / 2, y - h * (i + 1), w, 3);
      }
      ctx.fillStyle = '#2f3b22'; ctx.fillRect(x - ch * 0.1, y - ch * 1.12 - ch * 0.2, ch * 0.2, ch * 0.2);
      lights.push({ x, y: y - ch * 1.2, r: ch * 0.6, c: '#c6ff00', a: 0.4 });
      break;
    }
    case 'waterfall': {
      const x = W * 0.8, w = ch * 0.5, top = base - H * 0.14;
      ctx.fillStyle = '#546e4a';
      ctx.fillRect(x - w * 0.9, top - 10, w * 2.8, H * 0.14 + 10);
      ctx.fillStyle = mixHex(th.water.a, '#ffffff', 0.35);
      ctx.fillRect(x, top, w, H * 0.14);
      props.waterfall = { x, y: top, w, h: H * 0.14 };
      break;
    }
    case 'crater':
      for (let i = 0; i < 5; i++) lights.push({ x: W * (0.2 + i * 0.15), y: base - 6, r: 40, c: '#b388ff', a: 0.4 });
      break;
    case 'rift':
      props.portal = { x: W * 0.78, y: base - H * 0.18, r: Math.min(70, W * 0.08) };
      break;
    case 'pillars': {
      for (let i = 0; i < 4; i++) {
        const x = W * (0.6 + i * 0.1), h = ch * (1.4 + (i % 2) * 0.4);
        ctx.fillStyle = mixHex('#ffffff', th.sky.day[1], 0.25);
        ctx.fillRect(x - ch * 0.12, base - h, ch * 0.24, h);
        ctx.fillRect(x - ch * 0.18, base - h - 5, ch * 0.36, 6);
        ctx.fillStyle = 'rgba(200,200,230,0.4)';
        ctx.fillRect(x - ch * 0.05, base - h, 3, h);
      }
      break;
    }
    default: break;
  }
}

function drawFlora(ctx, type, x, y, h, th, rng, lights) {
  const dark = shade(th.mid.color, -0.25);
  switch (type) {
    case 'pine': case 'snowpine': {
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(x - h * 0.04, y - h * 0.25, h * 0.08, h * 0.25);
      for (let i = 0; i < 3; i++) {
        const w = h * (0.38 - i * 0.09), yy = y - h * (0.18 + i * 0.25);
        ctx.fillStyle = shade(type === 'snowpine' ? '#2e5e4e' : '#2e7d32', -i * 0.05);
        ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - h * 0.38); ctx.lineTo(x + w, yy); ctx.fill();
        if (type === 'snowpine') { ctx.fillStyle = '#f5fbff'; ctx.beginPath(); ctx.moveTo(x - w * 0.5, yy - h * 0.19); ctx.lineTo(x, yy - h * 0.38); ctx.lineTo(x + w * 0.5, yy - h * 0.19); ctx.fill(); }
      }
      break;
    }
    case 'oak': {
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x - h * 0.05, y - h * 0.45, h * 0.1, h * 0.45);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = shade('#43a047', -0.05 * i);
        ctx.beginPath(); ctx.arc(x + (i - 1.5) * h * 0.12, y - h * (0.6 + (i % 2) * 0.12), h * 0.22, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'palm': {
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = h * 0.06;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * 0.15, y - h * 0.5, x + h * 0.05, y - h * 0.95); ctx.stroke();
      ctx.strokeStyle = '#388e3c'; ctx.lineWidth = h * 0.05;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55;
        ctx.beginPath(); ctx.moveTo(x + h * 0.05, y - h * 0.95);
        ctx.quadraticCurveTo(x + h * 0.05 + Math.cos(a) * h * 0.3, y - h * 0.95 + Math.sin(a) * h * 0.3 - h * 0.08, x + h * 0.05 + Math.cos(a) * h * 0.45, y - h * 0.95 + Math.sin(a) * h * 0.35 + h * 0.12);
        ctx.stroke();
      }
      break;
    }
    case 'deadtree': {
      ctx.strokeStyle = '#3e2f26'; ctx.lineWidth = h * 0.07;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.03, y - h * 0.8); ctx.stroke();
      ctx.lineWidth = h * 0.035;
      for (let i = 0; i < 4; i++) {
        const yy = y - h * (0.35 + i * 0.12), s = i % 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(x + h * 0.02, yy); ctx.quadraticCurveTo(x + s * h * 0.15, yy - h * 0.05, x + s * h * 0.25, yy - h * 0.18); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(120,150,100,0.5)';
      ctx.fillRect(x - h * 0.1, y - h * 0.5, h * 0.03, h * 0.18);
      break;
    }
    case 'cactus': {
      ctx.fillStyle = '#558b2f';
      ctx.beginPath(); ctx.roundRect(x - h * 0.07, y - h * 0.75, h * 0.14, h * 0.75, h * 0.07); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x - h * 0.24, y - h * 0.5, h * 0.1, h * 0.25, h * 0.05); ctx.fill();
      ctx.fillRect(x - h * 0.2, y - h * 0.3, h * 0.15, h * 0.08);
      ctx.beginPath(); ctx.roundRect(x + h * 0.14, y - h * 0.62, h * 0.1, h * 0.28, h * 0.05); ctx.fill();
      ctx.fillRect(x + h * 0.05, y - h * 0.4, h * 0.15, h * 0.08);
      break;
    }
    case 'crystal': {
      const c = rng() < 0.5 ? '#7fdbff' : '#ce93d8';
      for (let i = 0; i < 3; i++) {
        const xx = x + (i - 1) * h * 0.1, hh = h * (0.4 + rng() * 0.4);
        ctx.fillStyle = shade(c, -0.1 * i);
        ctx.beginPath(); ctx.moveTo(xx - h * 0.05, y); ctx.lineTo(xx - h * 0.04, y - hh); ctx.lineTo(xx, y - hh - h * 0.08); ctx.lineTo(xx + h * 0.04, y - hh); ctx.lineTo(xx + h * 0.05, y); ctx.fill();
      }
      lights.push({ x, y: y - h * 0.4, r: h * 0.7, c, a: 0.45 });
      break;
    }
    case 'lavarock': {
      ctx.fillStyle = '#2b2020';
      ctx.beginPath(); ctx.moveTo(x - h * 0.3, y); ctx.lineTo(x - h * 0.15, y - h * 0.35); ctx.lineTo(x + h * 0.1, y - h * 0.45); ctx.lineTo(x + h * 0.3, y); ctx.fill();
      ctx.strokeStyle = '#ff6d00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - h * 0.1, y - h * 0.1); ctx.lineTo(x, y - h * 0.3); ctx.lineTo(x + h * 0.1, y - h * 0.2); ctx.stroke();
      lights.push({ x, y: y - h * 0.2, r: h * 0.5, c: '#ff6d00', a: 0.5 });
      break;
    }
    case 'jungle': {
      ctx.fillStyle = '#2e7d32';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * h * 0.2, y - h * 0.3 + Math.sin(a) * h * 0.2, h * 0.22, h * 0.08, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath(); ctx.arc(x, y - h * 0.3, h * 0.12, 0, TAU); ctx.fill();
      break;
    }
    case 'voidspire': {
      ctx.fillStyle = '#4a148c';
      ctx.beginPath(); ctx.moveTo(x - h * 0.08, y); ctx.quadraticCurveTo(x + h * 0.1, y - h * 0.5, x - h * 0.02, y - h); ctx.quadraticCurveTo(x + h * 0.02, y - h * 0.5, x + h * 0.08, y); ctx.fill();
      lights.push({ x, y: y - h, r: h * 0.3, c: '#ea80fc', a: 0.6 });
      break;
    }
    case 'cloudtree': {
      ctx.fillStyle = '#e8eaf6';
      ctx.fillRect(x - h * 0.03, y - h * 0.5, h * 0.06, h * 0.5);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (i - 1) * h * 0.14, y - h * (0.6 + (i % 2) * 0.1), h * 0.17, 0, TAU); ctx.fill(); }
      lights.push({ x, y: y - h * 0.6, r: h * 0.4, c: '#fff59d', a: 0.3 });
      break;
    }
    case 'grass': default: {
      ctx.fillStyle = dark;
      for (let i = 0; i < 6; i++) {
        const xx = x + (i - 3) * 4;
        ctx.beginPath(); ctx.moveTo(xx - 2, y); ctx.lineTo(xx + (rng() - 0.5) * 6, y - h * (0.2 + rng() * 0.2)); ctx.lineTo(xx + 2, y); ctx.fill();
      }
      break;
    }
  }
}

function drawGroundLayer(ctx, scene, shore) {
  const { W, H, L } = scene;
  const th = shore.theme;
  const g = th.ground;
  const rng = mulberry32(hashStr(shore.id + 'ground'));
  const top = L.farY - 4;
  // land polygon (left of the shoreline)
  ctx.beginPath();
  ctx.moveTo(-10, top);
  ctx.lineTo(L.shoreTopX + 4, top);
  ctx.lineTo(L.shoreBottomX + 4, H + 10);
  ctx.lineTo(-10, H + 10);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, top, 0, H);
  grad.addColorStop(0, g.top);
  grad.addColorStop(0.12, mixHex(g.top, g.body, 0.5));
  grad.addColorStop(0.45, g.body);
  grad.addColorStop(1, g.dark);
  ctx.fillStyle = grad;
  ctx.fill();

  // walkable band (lighter)
  ctx.save();
  ctx.clip();
  const band = ctx.createLinearGradient(0, top, 0, L.groundY + 10);
  band.addColorStop(0, mixHex(g.top, '#ffffff', 0.08));
  band.addColorStop(1, mixHex(g.top, g.body, 0.35));
  ctx.fillStyle = band;
  ctx.fillRect(-10, top, W + 20, L.groundY + 10 - top);
  // soil strata below
  ctx.strokeStyle = rgba(g.dark, 0.35);
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const yy = L.groundY + 26 + i * 34;
    ctx.beginPath();
    for (let x = -10; x < W; x += 30) ctx.lineTo(x, yy + Math.sin(x * 0.02 + i) * 5);
    ctx.stroke();
  }
  // pebbles & texture
  for (let i = 0; i < 160; i++) {
    const x = rng() * W, y = top + 6 + rng() * (H - top);
    if (x > scene.shoreAt(y)) continue;
    const s = 1 + rng() * 3;
    ctx.fillStyle = rng() < 0.5 ? rgba(g.dark, 0.35) : rgba('#ffffff', 0.12);
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.4, s, 0, 0, TAU); ctx.fill();
  }
  // wet sand near the shore
  ctx.fillStyle = rgba(g.dark, 0.25);
  ctx.beginPath();
  ctx.moveTo(L.shoreTopX - L.charH * 0.35, top);
  ctx.lineTo(L.shoreTopX + 4, top);
  ctx.lineTo(L.shoreBottomX + 4, H + 10);
  ctx.lineTo(L.shoreBottomX - L.charH * 0.6, H + 10);
  ctx.fill();
  ctx.restore();

  // grass / top edge
  ctx.fillStyle = g.top;
  ctx.fillRect(-10, top - 2, L.shoreTopX + 14, 5);
  if (th.flora !== 'cactus' && th.water.type !== 'sea' && !th.cave && th.ground.top !== '#ffffff') {
    ctx.fillStyle = shade(g.top, -0.12);
    for (let x = -6; x < L.shoreTopX - 6; x += 6) {
      const hh = 3 + rng() * 6;
      ctx.beginPath(); ctx.moveTo(x, top + 2); ctx.lineTo(x + 2 + rng() * 2, top - hh); ctx.lineTo(x + 5, top + 2); ctx.fill();
    }
  }

  // deposit mound
  const dx = L.depositX, dy = L.depositY;
  const w = L.charH * 1.15, h = L.charH * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(dx, dy + 3, w * 1.05, h * 0.25, 0, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dx - w, dy);
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const x = dx - w + k * w * 2;
    const y = dy - Math.sin(k * Math.PI) * h * (0.85 + rng() * 0.2);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, dy - h, 0, dy);
  dg.addColorStop(0, shade(th.deposit, 0.18));
  dg.addColorStop(1, shade(th.deposit, -0.2));
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 26; i++) {
    const x = dx - w * 0.8 + rng() * w * 1.6, y = dy - rng() * h * 0.7;
    ctx.fillStyle = rng() < 0.3 ? 'rgba(255,230,140,0.7)' : rgba(shade(th.deposit, -0.35), 0.7);
    ctx.beginPath(); ctx.arc(x, y, 1 + rng() * 2.5, 0, TAU); ctx.fill();
  }
  // sign
  const sx = Math.max(L.charH * 0.45, dx - w * 0.75), sy = dy - h * 0.2;
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(sx - 2, sy - L.charH * 0.75, 4, L.charH * 0.75);
  ctx.fillStyle = '#a1887f';
  ctx.beginPath(); ctx.roundRect(sx - L.charH * 0.42, sy - L.charH * 0.9, L.charH * 0.84, L.charH * 0.26, 4); ctx.fill();
  ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#3e2723';
  ctx.font = `700 ${Math.max(8, L.charH * 0.15)}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DEPOSIT', sx, sy - L.charH * 0.77);
}
