// Procedural icons for minerals, gear and consumables. Drawn once onto a
// canvas and cached as data URLs for the UI.
import { MINERAL } from '../data/minerals.js';
import { PAN, SHOVEL, SLUICE } from '../data/gear.js';
import { POTION, TOTEM, TOKEN, OUTFIT, RECIPE, consumableDef } from '../data/items.js';
import { mulberry32, hashStr, shade, rgba, mixHex } from '../util.js';

const SIZE = 128;
const cache = new Map();

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && !globalThis.document) return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function iconURL(kind, id, mod) {
  const key = `${kind}:${id}:${mod || ''}`;
  let url = cache.get(key);
  if (url) return url;
  const c = makeCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  try {
    drawIcon(ctx, kind, id, mod);
  } catch (e) {
    console.warn('icon failed', key, e);
  }
  url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function drawIcon(ctx, kind, id) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'mineral') drawMineral(ctx, MINERAL[id]);
  else if (kind === 'pan') drawPan(ctx, PAN[id]);
  else if (kind === 'shovel') drawShovel(ctx, SHOVEL[id]);
  else if (kind === 'sluice') drawSluice(ctx, SLUICE[id]);
  else if (kind === 'outfit') drawOutfit(ctx, OUTFIT[id]);
  else if (kind === 'equip') drawEquip(ctx, RECIPE[id]);
  else if (kind === 'item') drawConsumable(ctx, id);
  ctx.restore();
}

// ── mineral shapes ──────────────────────────────────────────────────────
function drawMineral(ctx, m) {
  if (!m) return;
  const r = mulberry32(hashStr(m.id));
  const cx = 64, cy = 66;
  if (m.glow) {
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 62);
    g.addColorStop(0, rgba(m.c1, 0.55));
    g.addColorStop(1, rgba(m.c1, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  // soft ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, 112, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const fn = SHAPES[m.shape] || SHAPES.nugget;
  fn(ctx, m, r, cx, cy);
  if (m.p === 'rainbow' || m.p === 'sparkle' || m.glow) sparkles(ctx, r, m.p === 'rainbow' ? '#ffffff' : shade(m.c1, 0.6), 3);
}

function outline(ctx, w = 3) {
  ctx.lineWidth = w;
  ctx.strokeStyle = 'rgba(20,14,30,0.55)';
  ctx.stroke();
}

function radial(ctx, m, x, y, r0, r1, light = 0.45) {
  const g = ctx.createRadialGradient(x - r1 * 0.35, y - r1 * 0.4, r0, x, y, r1);
  g.addColorStop(0, shade(m.c1, light));
  g.addColorStop(0.45, m.c1);
  g.addColorStop(1, m.c2);
  return g;
}

function blobPath(ctx, r, cx, cy, rx, ry, pts = 9, jag = 0.22) {
  ctx.beginPath();
  const verts = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const k = 1 - jag / 2 + r() * jag;
    verts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  for (let i = 0; i < pts; i++) {
    const p0 = verts[i], p1 = verts[(i + 1) % pts];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const p0 = verts[0], p1 = verts[1];
  ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  ctx.closePath();
}

function highlight(ctx, x, y, rx, ry, a = 0.7) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function sparkles(ctx, r, color, n) {
  for (let i = 0; i < n; i++) {
    const x = 22 + r() * 84, y = 18 + r() * 70, s = 4 + r() * 6;
    star4(ctx, x, y, s, color);
  }
}

function star4(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

function applyPattern(ctx, m, r, cx, cy, rx, ry) {
  const p = m.p;
  if (!p) return;
  ctx.save();
  ctx.clip();
  if (p === 'banded') {
    for (let i = -6; i < 7; i++) {
      ctx.strokeStyle = i % 2 ? rgba(shade(m.c1, 0.35), 0.55) : rgba(m.c2, 0.45);
      ctx.lineWidth = 4 + r() * 3;
      ctx.beginPath();
      ctx.ellipse(cx + 10, cy + 6, rx * (0.25 + Math.abs(i) * 0.12), ry * (0.2 + Math.abs(i) * 0.1), 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (p === 'speckle' || p === 'pitted') {
    for (let i = 0; i < 28; i++) {
      const x = cx - rx + r() * rx * 2, y = cy - ry + r() * ry * 2;
      ctx.fillStyle = p === 'pitted' ? 'rgba(0,0,0,0.28)' : r() < 0.5 ? rgba(m.c2, 0.8) : rgba(shade(m.c1, 0.6), 0.7);
      ctx.beginPath();
      ctx.arc(x, y, p === 'pitted' ? 2 + r() * 4 : 1 + r() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p === 'veins' || p === 'widman' || p === 'grain') {
    ctx.strokeStyle = p === 'grain' ? rgba(m.c2, 0.5) : rgba(shade(m.c1, 0.6), 0.6);
    ctx.lineWidth = 2;
    for (let i = 0; i < (p === 'grain' ? 9 : 6); i++) {
      ctx.beginPath();
      let x = cx - rx, y = cy - ry + r() * ry * 2;
      ctx.moveTo(x, y);
      while (x < cx + rx) {
        x += 8 + r() * 8;
        y += p === 'widman' ? (r() - 0.5) * 2 : (r() - 0.5) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (p === 'opal' || p === 'aurora' || p === 'rainbow' || p === 'galaxy') {
    const cols = p === 'aurora' ? ['#7cffcb', '#b57bff', '#6fd3ff'] : p === 'galaxy' ? ['#ff80ff', '#7c4dff', '#00e5ff', '#ffffff'] : ['#ff7eb6', '#7ee8fa', '#c3ff8a', '#ffe680', '#b28dff'];
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 18; i++) {
      const x = cx - rx + r() * rx * 2, y = cy - ry + r() * ry * 2, s = 4 + r() * 10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s);
      g.addColorStop(0, rgba(cols[i % cols.length], 0.85));
      g.addColorStop(1, rgba(cols[i % cols.length], 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
    }
    if (p === 'galaxy') for (let i = 0; i < 14; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, 1.5, 1.5); }
  } else if (p === 'striped') {
    for (let i = -8; i < 8; i++) {
      ctx.fillStyle = i % 2 ? rgba(m.c2, 0.5) : rgba(shade(m.c1, 0.4), 0.4);
      ctx.fillRect(cx - rx, cy + i * 7, rx * 2, 4);
    }
  } else if (p === 'vortex') {
    ctx.strokeStyle = rgba(m.c2, 0.75);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.2) {
      const rr = a * 2.2;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.9;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (p === 'lava') {
    ctx.strokeStyle = rgba(m.c2, 0.95);
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = cx - rx + r() * rx * 2, y = cy - ry + r() * ry * 2;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else if (p === 'insect') {
    ctx.fillStyle = 'rgba(60,30,10,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 7, 11, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4 + i * 5); ctx.lineTo(cx - 14, cy + i * 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, cy + 4 + i * 5); ctx.lineTo(cx + 14, cy + 8 + i * 8); ctx.stroke();
    }
  } else if (p === 'snow') {
    for (let i = 0; i < 10; i++) {
      const x = cx - rx + r() * rx * 2, y = cy - ry + r() * ry * 2;
      star4(ctx, x, y, 3 + r() * 3, 'rgba(255,255,255,0.85)');
    }
  } else if (p === 'moss') {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = rgba('#1e5a1e', 0.5);
      ctx.beginPath();
      ctx.arc(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, 2 + r() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p === 'scales' || p === 'leaf') {
    ctx.strokeStyle = rgba(p === 'scales' ? shade(m.c2, 0.2) : '#0b3d0b', 0.55);
    ctx.lineWidth = 2;
    for (let y = cy - ry; y < cy + ry; y += 9) {
      for (let x = cx - rx + ((y / 9) % 2) * 5; x < cx + rx; x += 10) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI);
        ctx.stroke();
      }
    }
  } else if (p === 'star') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * 16, cy - Math.sin(a) * 16);
      ctx.lineTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
      ctx.stroke();
    }
  } else if (p === 'halo') {
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = rgba(m.c2, 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.35, ry * 0.4, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (p === 'petal') {
    ctx.fillStyle = rgba(m.c2, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 4, 9, a + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p === 'key' || p === 'idol') {
    // handled by relic
  }
  ctx.restore();
}

const SHAPES = {
  nugget(ctx, m, r, cx, cy) {
    blobPath(ctx, r, cx, cy + 4, 40, 32, 10, 0.32);
    ctx.fillStyle = radial(ctx, m, cx, cy, 4, 44);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, 40, 32);
    blobPath(ctx, mulberry32(hashStr(m.id)), cx, cy + 4, 40, 32, 10, 0.32);
    outline(ctx);
    // dents
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = rgba(m.c2, 0.35);
      ctx.beginPath();
      ctx.arc(cx - 20 + r() * 40, cy - 6 + r() * 26, 3 + r() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    highlight(ctx, cx - 14, cy - 12, 14, 8);
  },
  rock(ctx, m, r, cx, cy) {
    blobPath(ctx, r, cx, cy + 4, 42, 34, 7, 0.38);
    ctx.fillStyle = radial(ctx, m, cx, cy, 4, 46, 0.3);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, 44, 36);
    blobPath(ctx, mulberry32(hashStr(m.id)), cx, cy + 4, 42, 34, 7, 0.38);
    outline(ctx);
    highlight(ctx, cx - 16, cy - 12, 12, 7, 0.45);
  },
  cube(ctx, m, r, cx, cy) {
    const s = 30;
    const top = [[cx, cy - s - 8], [cx + s, cy - s / 2 - 4], [cx, cy - 2], [cx - s, cy - s / 2 - 4]];
    const left = [[cx - s, cy - s / 2 - 4], [cx, cy - 2], [cx, cy + s + 4], [cx - s, cy + s / 2 + 4]];
    const right = [[cx + s, cy - s / 2 - 4], [cx, cy - 2], [cx, cy + s + 4], [cx + s, cy + s / 2 + 4]];
    const face = (pts, col) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      outline(ctx, 2.5);
    };
    face(top, shade(m.c1, 0.35));
    face(left, m.c1);
    face(right, shade(m.c2, 0.1));
    // striations
    ctx.strokeStyle = rgba(m.c2, 0.35);
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s / 2 - 4 + i * 16); ctx.lineTo(cx, cy - 2 + i * 16); ctx.stroke();
    }
    if (m.p === 'opal' || m.p === 'rainbow') applyPattern(ctx, m, r, cx, cy, 30, 30);
    highlight(ctx, cx - 6, cy - s / 2 - 6, 12, 5, 0.6);
  },
  crystal(ctx, m, r, cx, cy) {
    const n = 3 + Math.floor(r() * 3);
    const base = cy + 34;
    const prisms = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      prisms.push({ ang: t * 0.9 + (r() - 0.5) * 0.2, h: 50 + r() * 28 - Math.abs(t) * 26, w: 11 + r() * 6, x: cx + t * 40 });
    }
    prisms.sort((a, b) => a.h - b.h);
    // rock base
    ctx.fillStyle = shade(m.c2, -0.4);
    ctx.beginPath();
    ctx.ellipse(cx, base, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const p of prisms) prism(ctx, m, p.x, base, p.w, p.h, p.ang, r);
  },
  shard(ctx, m, r, cx, cy) {
    prism(ctx, m, cx + 6, cy + 40, 18, 86, -0.35, r);
  },
  gem(ctx, m, r, cx, cy) {
    // brilliant cut, top view-ish
    const w = 42, top = cy - 26, mid = cy - 8, bot = cy + 36;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.55, top);
    ctx.lineTo(cx + w * 0.55, top);
    ctx.lineTo(cx + w, mid);
    ctx.lineTo(cx, bot);
    ctx.lineTo(cx - w, mid);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - w, top, cx + w, bot);
    g.addColorStop(0, shade(m.c1, 0.45));
    g.addColorStop(0.5, m.c1);
    g.addColorStop(1, m.c2);
    ctx.fillStyle = g;
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, w, 34);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.55, top); ctx.lineTo(cx + w * 0.55, top); ctx.lineTo(cx + w, mid); ctx.lineTo(cx, bot); ctx.lineTo(cx - w, mid); ctx.closePath();
    outline(ctx);
    // facets
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - w, mid); ctx.lineTo(cx + w, mid);
    ctx.moveTo(cx - w * 0.55, top); ctx.lineTo(cx - w * 0.25, mid); ctx.lineTo(cx, top); ctx.lineTo(cx + w * 0.25, mid); ctx.lineTo(cx + w * 0.55, top);
    ctx.moveTo(cx - w * 0.25, mid); ctx.lineTo(cx, bot); ctx.lineTo(cx + w * 0.25, mid);
    ctx.moveTo(cx - w * 0.65, mid); ctx.lineTo(cx, bot); ctx.lineTo(cx + w * 0.65, mid);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.55, top); ctx.lineTo(cx - w * 0.1, top); ctx.lineTo(cx - w * 0.3, mid); ctx.lineTo(cx - w * 0.85, mid);
    ctx.fill();
    star4(ctx, cx + 18, top + 6, 7, 'rgba(255,255,255,0.9)');
  },
  orb(ctx, m, r, cx, cy) {
    const R = 34;
    ctx.beginPath();
    ctx.arc(cx, cy + 4, R, 0, Math.PI * 2);
    ctx.fillStyle = radial(ctx, m, cx, cy + 4, 2, R + 4, 0.55);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy + 4, R, R);
    ctx.beginPath();
    ctx.arc(cx, cy + 4, R, 0, Math.PI * 2);
    outline(ctx);
    highlight(ctx, cx - 12, cy - 10, 12, 8, 0.85);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(cx + 14, cy + 20, 5, 0, Math.PI * 2);
    ctx.fill();
  },
  shell(ctx, m, r, cx, cy) {
    const ribs = 9;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 34);
    for (let i = 0; i <= ribs; i++) {
      const a = Math.PI + (i / ribs) * Math.PI;
      const x = cx + Math.cos(a) * 44, y = cy + 8 + Math.sin(a) * 40;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, cy - 32, cx, cy + 34);
    g.addColorStop(0, shade(m.c1, 0.35));
    g.addColorStop(1, m.c2);
    ctx.fillStyle = g;
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, 44, 40);
    ctx.beginPath();
    ctx.moveTo(cx, cy + 34);
    for (let i = 0; i <= ribs; i++) {
      const a = Math.PI + (i / ribs) * Math.PI;
      ctx.lineTo(cx + Math.cos(a) * 44, cy + 8 + Math.sin(a) * 40);
    }
    ctx.closePath();
    outline(ctx);
    ctx.strokeStyle = rgba(m.c2, 0.6);
    ctx.lineWidth = 2;
    for (let i = 1; i < ribs; i++) {
      const a = Math.PI + (i / ribs) * Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, cy + 34); ctx.lineTo(cx + Math.cos(a) * 42, cy + 8 + Math.sin(a) * 38); ctx.stroke();
    }
    ctx.fillStyle = m.c2;
    ctx.fillRect(cx - 9, cy + 30, 18, 8);
    highlight(ctx, cx - 10, cy - 14, 14, 7, 0.5);
  },
  bone(ctx, m, r, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy + 4);
    ctx.rotate(-0.6);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-30, -7);
      ctx.lineTo(30, -7);
      ctx.arc(34, -10, 9, Math.PI * 1.1, Math.PI * 0.5, false);
      ctx.arc(34, 10, 9, -Math.PI * 0.5, Math.PI * 0.9, false);
      ctx.lineTo(-30, 7);
      ctx.arc(-34, 10, 9, -Math.PI * 0.1, Math.PI * 1.5, false);
      ctx.arc(-34, -10, 9, Math.PI * 0.5, Math.PI * 2.1, false);
      ctx.closePath();
    };
    path();
    const g = ctx.createLinearGradient(0, -18, 0, 18);
    g.addColorStop(0, shade(m.c1, 0.3));
    g.addColorStop(1, m.c2);
    ctx.fillStyle = g;
    ctx.fill();
    path();
    outline(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-26, -4, 50, 3);
    ctx.restore();
  },
  coin(ctx, m, r, cx, cy) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 38, 36, 0, 0, Math.PI * 2);
    ctx.fillStyle = m.c2;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 38, 36, 0, 0, Math.PI * 2);
    ctx.fillStyle = radial(ctx, m, cx, cy + 3, 2, 40, 0.5);
    ctx.fill();
    outline(ctx);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, 28, 26, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(m.c2, 0.7);
    ctx.lineWidth = 3;
    ctx.stroke();
    applyPattern(ctx, m, r, cx, cy + 3, 28, 26);
    if (!m.p) {
      ctx.fillStyle = rgba(m.c2, 0.75);
      starPath(ctx, cx, cy + 3, 15, 7, 5);
      ctx.fill();
    }
    highlight(ctx, cx - 14, cy - 12, 12, 6, 0.6);
  },
  geode(ctx, m, r, cx, cy) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 42, 36, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7d7468';
    ctx.fill();
    outline(ctx);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 32, 27, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#eae4f5';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 28, 23, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, 28);
    g.addColorStop(0, shade(m.c2, -0.3));
    g.addColorStop(0.6, m.c2);
    g.addColorStop(1, m.c1);
    ctx.fillStyle = g;
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 8 + r() * 18;
      const x = cx + Math.cos(a) * d, y = cy + 6 + Math.sin(a) * d * 0.82;
      ctx.fillStyle = r() < 0.5 ? shade(m.c1, 0.4) : m.c1;
      ctx.beginPath();
      ctx.moveTo(x, y - 5); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y);
      ctx.fill();
    }
    sparkles(ctx, r, '#ffffff', 2);
  },
  ammonite(ctx, m, r, cx, cy) {
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 38, 0, Math.PI * 2);
    ctx.fillStyle = radial(ctx, m, cx, cy + 4, 2, 40, 0.35);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy + 4, 38, 38);
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 38, 0, Math.PI * 2);
    outline(ctx);
    ctx.strokeStyle = rgba(m.c2, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.1) {
      const rr = 36 * Math.exp(-a * 0.16);
      const x = cx + Math.cos(a) * rr, y = cy + 4 + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let a = 0; a < Math.PI * 4; a += 0.35) {
      const r1 = 36 * Math.exp(-a * 0.16), r2 = 36 * Math.exp(-(a + Math.PI * 2) * 0.16);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + 4 + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + 4 + Math.sin(a) * r2);
      ctx.stroke();
    }
    highlight(ctx, cx - 14, cy - 12, 12, 7, 0.45);
  },
  star(ctx, m, r, cx, cy) {
    starPath(ctx, cx, cy + 4, 44, 19, 5);
    ctx.fillStyle = radial(ctx, m, cx, cy + 4, 2, 46, 0.5);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, 44, 44);
    starPath(ctx, cx, cy + 4, 44, 19, 5);
    outline(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx + Math.cos(a) * 40, cy + 4 + Math.sin(a) * 40); ctx.stroke();
    }
    highlight(ctx, cx - 8, cy - 8, 10, 6, 0.7);
  },
  tooth(ctx, m, r, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy - 26);
    ctx.quadraticCurveTo(cx, cy - 36, cx + 30, cy - 26);
    ctx.quadraticCurveTo(cx + 20, cy + 10, cx + 4, cy + 42);
    ctx.quadraticCurveTo(cx - 14, cy + 6, cx - 30, cy - 26);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, cy - 30, cx, cy + 40);
    g.addColorStop(0, m.c2);
    g.addColorStop(0.3, shade(m.c1, 0.2));
    g.addColorStop(1, m.c1);
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - 18); ctx.quadraticCurveTo(cx - 6, cy + 8, cx + 2, cy + 28); ctx.stroke();
  },
  drop(ctx, m, r, cx, cy) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 38);
      ctx.bezierCurveTo(cx + 12, cy - 14, cx + 36, cy + 4, cx + 30, cy + 22);
      ctx.bezierCurveTo(cx + 24, cy + 44, cx - 24, cy + 44, cx - 30, cy + 22);
      ctx.bezierCurveTo(cx - 36, cy + 4, cx - 12, cy - 14, cx, cy - 38);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = radial(ctx, m, cx, cy + 14, 2, 40, 0.45);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy + 14, 30, 30);
    path();
    outline(ctx);
    highlight(ctx, cx - 10, cy + 2, 8, 12, 0.75);
  },
  heart(ctx, m, r, cx, cy) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 38);
      ctx.bezierCurveTo(cx - 52, cy + 4, cx - 34, cy - 40, cx, cy - 16);
      ctx.bezierCurveTo(cx + 34, cy - 40, cx + 52, cy + 4, cx, cy + 38);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = radial(ctx, m, cx, cy, 2, 46, 0.5);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, 40, 36);
    path();
    outline(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 36); ctx.moveTo(cx - 30, cy - 6); ctx.lineTo(cx, cy + 10); ctx.lineTo(cx + 30, cy - 6); ctx.stroke();
    highlight(ctx, cx - 18, cy - 14, 10, 7, 0.8);
  },
  eye(ctx, m, r, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 46, cy + 4);
    ctx.quadraticCurveTo(cx, cy - 40, cx + 46, cy + 4);
    ctx.quadraticCurveTo(cx, cy + 48, cx - 46, cy + 4);
    ctx.closePath();
    ctx.fillStyle = '#f4f1e8';
    ctx.fill();
    outline(ctx);
    ctx.beginPath();
    ctx.arc(cx, cy + 4, 22, 0, Math.PI * 2);
    ctx.fillStyle = radial(ctx, m, cx, cy + 4, 2, 24, 0.5);
    ctx.fill();
    ctx.fillStyle = m.c2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 6, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    highlight(ctx, cx - 8, cy - 6, 6, 5, 0.9);
  },
  feather(ctx, m, r, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy + 4);
    ctx.rotate(0.6);
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.bezierCurveTo(26, -30, 22, 22, 0, 44);
    ctx.bezierCurveTo(-22, 22, -26, -30, 0, -48);
    const g = ctx.createLinearGradient(0, -48, 0, 44);
    g.addColorStop(0, shade(m.c1, 0.3));
    g.addColorStop(1, m.c2);
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx, 2.5);
    ctx.strokeStyle = rgba(m.c2, 0.7);
    ctx.lineWidth = 1.2;
    for (let y = -36; y < 34; y += 6) {
      ctx.beginPath(); ctx.moveTo(0, y + 4); ctx.lineTo(-16, y - 4); ctx.moveTo(0, y + 4); ctx.lineTo(16, y - 4); ctx.stroke();
    }
    ctx.strokeStyle = shade(m.c2, -0.3);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, 56); ctx.stroke();
    ctx.restore();
  },
  egg(ctx, m, r, cx, cy) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 40);
      ctx.bezierCurveTo(cx + 34, cy - 38, cx + 40, cy + 40, cx, cy + 40);
      ctx.bezierCurveTo(cx - 40, cy + 40, cx - 34, cy - 38, cx, cy - 40);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = radial(ctx, m, cx, cy + 4, 2, 46, 0.4);
    ctx.fill();
    applyPattern(ctx, m, r, cx, cy, 36, 40);
    path();
    outline(ctx);
    highlight(ctx, cx - 12, cy - 16, 9, 14, 0.6);
  },
  relic(ctx, m, r, cx, cy) {
    if (m.p === 'key') {
      ctx.save();
      ctx.translate(cx, cy + 4);
      ctx.rotate(-0.7);
      ctx.fillStyle = m.c1;
      ctx.beginPath(); ctx.arc(-24, 0, 18, 0, Math.PI * 2); ctx.fill(); outline(ctx);
      ctx.fillStyle = shade(m.c2, 0.2);
      ctx.beginPath(); ctx.arc(-24, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = m.c1;
      ctx.beginPath(); ctx.rect(-8, -6, 52, 12); ctx.fill(); outline(ctx);
      ctx.beginPath(); ctx.rect(30, 6, 8, 14); ctx.rect(18, 6, 8, 10); ctx.fill(); outline(ctx, 2);
      ctx.restore();
      highlight(ctx, cx - 30, cy - 10, 10, 6, 0.6);
      return;
    }
    if (m.p === 'idol') {
      ctx.fillStyle = radial(ctx, m, cx, cy, 2, 44, 0.45);
      ctx.beginPath();
      ctx.roundRect(cx - 22, cy - 40, 44, 34, 10);
      ctx.roundRect(cx - 28, cy - 6, 56, 32, 8);
      ctx.roundRect(cx - 34, cy + 26, 68, 12, 4);
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = shade(m.c2, -0.2);
      ctx.fillRect(cx - 12, cy - 28, 6, 6); ctx.fillRect(cx + 6, cy - 28, 6, 6);
      ctx.fillRect(cx - 8, cy - 16, 16, 4);
      highlight(ctx, cx - 10, cy - 30, 10, 6, 0.6);
      return;
    }
    ctx.beginPath();
    ctx.roundRect(cx - 32, cy - 36, 64, 76, 14);
    ctx.fillStyle = radial(ctx, m, cx, cy, 2, 50, 0.35);
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = shade(m.c1, 0.6);
    ctx.shadowColor = m.c1;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 20); ctx.lineTo(cx, cy - 6); ctx.lineTo(cx + 14, cy - 20);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 18);
    ctx.moveTo(cx - 14, cy + 22); ctx.lineTo(cx + 14, cy + 22);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (m.p === 'star') applyPattern(ctx, m, r, cx, cy, 30, 36);
    highlight(ctx, cx - 14, cy - 22, 10, 6, 0.5);
  },
  trilobite(ctx, m, r, cx, cy) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 30, 42, 0, 0, Math.PI * 2);
    ctx.fillStyle = radial(ctx, m, cx, cy + 4, 2, 44, 0.35);
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = rgba(m.c2, 0.85);
    ctx.lineWidth = 2;
    for (let y = -20; y <= 36; y += 7) {
      ctx.beginPath(); ctx.ellipse(cx, cy + y, 26 - Math.abs(y - 8) * 0.25, 3, 0, 0, Math.PI); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 34); ctx.lineTo(cx - 8, cy + 42); ctx.moveTo(cx + 8, cy - 34); ctx.lineTo(cx + 8, cy + 42); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 26, 22, 12, 0, Math.PI, 0);
    ctx.fillStyle = shade(m.c1, 0.15);
    ctx.fill();
    outline(ctx, 2);
    highlight(ctx, cx - 10, cy - 24, 8, 5, 0.5);
  },
};

function prism(ctx, m, x, base, w, h, ang, r) {
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(ang);
  const tip = h * 0.22;
  // left face
  ctx.beginPath();
  ctx.moveTo(-w, 0); ctx.lineTo(-w, -h + tip); ctx.lineTo(0, -h); ctx.lineTo(0, 0); ctx.closePath();
  ctx.fillStyle = shade(m.c1, 0.25);
  ctx.fill();
  outline(ctx, 2.2);
  // right face
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.lineTo(w, -h + tip); ctx.lineTo(w, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, w, 0);
  g.addColorStop(0, m.c1);
  g.addColorStop(1, m.c2);
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, 2.2);
  if (m.p === 'aurora' || m.p === 'rainbow' || m.p === 'galaxy') {
    ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.lineTo(-w, -h + tip); ctx.lineTo(0, -h); ctx.lineTo(w, -h + tip); ctx.lineTo(w, 0); ctx.closePath();
    applyPattern(ctx, m, r, 0, -h / 2, w, h / 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(-w + 3, -h + tip + 2, 3, h - tip - 8);
  ctx.restore();
}

function starPath(ctx, cx, cy, R, r, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : R;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// ── gear ────────────────────────────────────────────────────────────────
function drawPan(ctx, p) {
  if (!p) return;
  const cx = 64, cy = 66;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, 104, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
  // rim
  ctx.beginPath();
  ctx.ellipse(cx, cy, 52, 34, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, cy - 34, 0, cy + 34);
  g.addColorStop(0, shade(p.c1, 0.4));
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx);
  // bowl
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 42, 26, 0, 0, Math.PI * 2);
  const g2 = ctx.createRadialGradient(cx, cy + 8, 2, cx, cy, 44);
  g2.addColorStop(0, shade(p.c1, -0.15));
  g2.addColorStop(1, shade(p.c2, -0.25));
  ctx.fillStyle = g2;
  ctx.fill();
  // riffles
  ctx.strokeStyle = rgba(shade(p.c1, 0.5), 0.5);
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 34 - i * 9, 20 - i * 5.5, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // gold flecks
  for (let i = 0; i < 5; i++) star4(ctx, cx - 18 + i * 9, cy + 6 + (i % 2) * 6, 3, '#ffe066');
  highlight(ctx, cx - 26, cy - 16, 18, 6, 0.55);
}

function drawShovel(ctx, s) {
  if (!s) return;
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-0.75);
  // handle
  ctx.fillStyle = s.c2;
  ctx.beginPath(); ctx.roundRect(-5, -60, 10, 70, 4); ctx.fill(); outline(ctx, 2.5);
  ctx.beginPath(); ctx.roundRect(-14, -66, 28, 10, 5); ctx.fill(); outline(ctx, 2.5);
  // blade
  ctx.beginPath();
  ctx.moveTo(-18, 6);
  ctx.lineTo(18, 6);
  ctx.lineTo(16, 34);
  ctx.quadraticCurveTo(0, 56, -16, 34);
  ctx.closePath();
  const g = ctx.createLinearGradient(-18, 0, 18, 40);
  g.addColorStop(0, shade(s.c1, 0.45));
  g.addColorStop(1, shade(s.c1, -0.25));
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(-12, 10, 4, 22);
  ctx.restore();
}

function drawSluice(ctx, s) {
  if (!s) return;
  ctx.save();
  ctx.translate(64, 68);
  ctx.rotate(-0.22);
  ctx.fillStyle = shade(s.c1, -0.3);
  ctx.beginPath(); ctx.moveTo(-54, -10); ctx.lineTo(54, -10); ctx.lineTo(50, 22); ctx.lineTo(-50, 22); ctx.closePath(); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(-48, -4, 96, 14);
  ctx.fillStyle = s.c1;
  for (let i = -40; i <= 40; i += 16) { ctx.fillRect(i, -6, 5, 18); }
  ctx.fillStyle = shade(s.c1, 0.2);
  ctx.fillRect(-54, -16, 108, 7);
  ctx.restore();
  star4(ctx, 46, 52, 6, '#ffe066');
  star4(ctx, 78, 62, 5, '#ffe066');
}

function flask(ctx, color, shape = 'round') {
  const cx = 64, cy = 74;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, 112, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  if (shape === 'round') {
    const off = Math.asin(10 / 32);
    ctx.arc(cx, cy, 32, -Math.PI / 2 + off, Math.PI * 1.5 - off);
    ctx.lineTo(cx - 10, cy - 46);
    ctx.lineTo(cx + 10, cy - 46);
  } else {
    ctx.moveTo(cx - 10, cy - 46); ctx.lineTo(cx + 10, cy - 46); ctx.lineTo(cx + 10, cy - 24); ctx.lineTo(cx + 34, cy + 28); ctx.lineTo(cx - 34, cy + 28); ctx.lineTo(cx - 10, cy - 24);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(220,240,255,0.35)';
  ctx.fill();
  outline(ctx);
  // liquid
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - 10, 0, cy + 34);
  g.addColorStop(0, shade(color, 0.3));
  g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(cx - 40, cy - 8, 80, 50);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy - 8, 32, 5, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx - 14 + i * 9, cy + 4 + (i % 2) * 10, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // cork
  ctx.fillStyle = '#b07a46';
  ctx.beginPath(); ctx.roundRect(cx - 12, cy - 56, 24, 12, 4); ctx.fill(); outline(ctx, 2);
  highlight(ctx, cx - 16, cy - 2, 6, 14, 0.6);
}

function drawConsumable(ctx, id) {
  const def = consumableDef(id);
  if (!def) return;
  if (POTION[id]) return flask(ctx, def.color, id.endsWith('3') || id === 'clarity' ? 'cone' : 'round');
  if (TOTEM[id]) return drawTotem(ctx, def.color);
  if (id.startsWith('book:')) return drawBook(ctx, '#7e57c2');
  if (id === 'enchantScroll') return drawScroll(ctx);
  if (id === 'luckyClover') return drawClover(ctx);
  if (id === 'reforgeToken') return drawToken(ctx, def.color, 'hammer');
  if (TOKEN[id]) return drawToken(ctx, def.color, id);
}

function drawTotem(ctx, color) {
  const cx = 64;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, 114, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
  const wood = '#8d5a33';
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.roundRect(cx - 16, 40, 32, 72, 6); ctx.fill(); outline(ctx);
  ctx.fillStyle = shade(wood, -0.25);
  ctx.fillRect(cx - 16, 62, 32, 5);
  ctx.fillRect(cx - 16, 86, 32, 5);
  ctx.fillStyle = '#2b1a10';
  ctx.fillRect(cx - 9, 50, 6, 6); ctx.fillRect(cx + 3, 50, 6, 6);
  ctx.fillRect(cx - 7, 74, 14, 4);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(cx - 30, 44); ctx.lineTo(cx - 16, 52); ctx.lineTo(cx - 16, 44); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 30, 44); ctx.lineTo(cx + 16, 52); ctx.lineTo(cx + 16, 44); ctx.fill();
  const g = ctx.createRadialGradient(cx, 26, 2, cx, 26, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, color);
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, 26, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, 26, 13, 0, Math.PI * 2); ctx.fill(); outline(ctx, 2);
  highlight(ctx, cx - 4, 21, 5, 4, 0.9);
}

function drawBook(ctx, color) {
  const cx = 64, cy = 66;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#efe6d2';
  ctx.beginPath(); ctx.roundRect(-36, -40, 72, 84, 6); ctx.fill(); outline(ctx);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-40, -44, 72, 84, 8); ctx.fill(); outline(ctx);
  ctx.fillStyle = shade(color, -0.3);
  ctx.fillRect(-40, -44, 10, 84);
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(-2, -2, 16, 0, Math.PI * 2); ctx.stroke();
  star4(ctx, -2, -2, 10, '#ffe082');
  ctx.restore();
  sparkles(ctx, mulberry32(7), '#e1bee7', 3);
}

function drawScroll(ctx) {
  const cx = 64, cy = 64;
  ctx.fillStyle = '#f3e5c0';
  ctx.beginPath(); ctx.roundRect(cx - 34, cy - 30, 68, 60, 4); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#d7b98a';
  ctx.beginPath(); ctx.roundRect(cx - 42, cy - 38, 84, 14, 7); ctx.fill(); outline(ctx, 2.5);
  ctx.beginPath(); ctx.roundRect(cx - 42, cy + 24, 84, 14, 7); ctx.fill(); outline(ctx, 2.5);
  ctx.strokeStyle = '#7e57c2';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 24, cy - 14 + i * 10); ctx.lineTo(cx + 24 - (i % 2) * 10, cy - 14 + i * 10); ctx.stroke(); }
  sparkles(ctx, mulberry32(9), '#b388ff', 3);
}

function drawClover(ctx) {
  const cx = 64, cy = 60;
  ctx.fillStyle = '#2e7d32';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(-24, -6, -10, -26, 0, -10);
    ctx.bezierCurveTo(10, -26, 24, -6, 0, 12);
    ctx.fillStyle = i % 2 ? '#43a047' : '#66bb6a';
    ctx.fill();
    outline(ctx, 2);
    ctx.restore();
  }
  ctx.strokeStyle = '#2e7d32';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + 6, cy + 30, cx + 18, cy + 46); ctx.stroke();
  sparkles(ctx, mulberry32(3), '#ccff90', 3);
}

function drawToken(ctx, color, kind) {
  const cx = 64, cy = 64;
  ctx.beginPath(); ctx.arc(cx, cy + 4, 40, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, -0.35); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - 12, cy - 14, 2, cx, cy, 42);
  g.addColorStop(0, shade(color, 0.5));
  g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.fill(); outline(ctx);
  ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(40,20,60,0.75)';
  ctx.strokeStyle = 'rgba(40,20,60,0.75)';
  ctx.lineWidth = 5;
  if (kind === 'meteorFragment') {
    ctx.beginPath(); ctx.arc(cx + 6, cy + 6, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 2, cy - 2); ctx.lineTo(cx - 20, cy - 20); ctx.moveTo(cx + 4, cy - 6); ctx.lineTo(cx - 8, cy - 22); ctx.moveTo(cx - 6, cy + 4); ctx.lineTo(cx - 22, cy - 8); ctx.stroke();
  } else if (kind === 'rapidsToken') {
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - 20, cy + i * 11); ctx.quadraticCurveTo(cx - 10, cy + i * 11 - 8, cx, cy + i * 11); ctx.quadraticCurveTo(cx + 10, cy + i * 11 + 8, cx + 20, cy + i * 11); ctx.stroke(); }
  } else if (kind === 'solarToken') {
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); ctx.stroke(); }
  } else if (kind === 'riftToken') {
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) { const rr = a * 1.5; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (!a) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  } else if (kind === 'hammer') {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.7);
    ctx.fillRect(-4, -6, 8, 30); ctx.fillRect(-16, -18, 32, 14);
    ctx.restore();
  } else {
    starPath(ctx, cx, cy, 18, 8, 5); ctx.fill();
  }
  highlight(ctx, cx - 14, cy - 16, 12, 6, 0.6);
}

function drawOutfit(ctx, o) {
  if (!o) return;
  const cx = 64, cy = 66, c = o.color;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx, 112, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
  const body = (path) => { ctx.beginPath(); path(); ctx.fillStyle = c; ctx.fill(); outline(ctx); };
  switch (o.id) {
    case 'gasmask':
      body(() => ctx.roundRect(cx - 30, cy - 30, 60, 56, 22));
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(cx - 13, cy - 8, 10, 0, Math.PI * 2); ctx.arc(cx + 13, cy - 8, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath(); ctx.arc(cx, cy + 22, 14, 0, Math.PI * 2); ctx.fill(); outline(ctx, 2);
      break;
    case 'sunhat':
      ctx.beginPath(); ctx.ellipse(cx, cy + 14, 56, 16, 0, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); outline(ctx);
      body(() => { ctx.ellipse(cx, cy, 28, 26, 0, Math.PI, 0); ctx.lineTo(cx + 28, cy + 12); ctx.lineTo(cx - 28, cy + 12); });
      ctx.fillStyle = '#e53935'; ctx.fillRect(cx - 28, cy + 2, 56, 7);
      break;
    case 'thermalgloves':
      for (const dx of [-18, 18]) {
        ctx.save(); ctx.translate(cx + dx, cy); ctx.rotate(dx < 0 ? -0.2 : 0.2);
        ctx.beginPath(); ctx.roundRect(-16, -26, 32, 50, 12); ctx.fillStyle = c; ctx.fill(); outline(ctx);
        ctx.beginPath(); ctx.roundRect(dx < 0 ? 10 : -22, -10, 12, 22, 6); ctx.fill(); outline(ctx, 2);
        ctx.fillStyle = '#fff'; ctx.fillRect(-16, 14, 32, 8);
        ctx.restore();
      }
      break;
    case 'heatsuit':
      body(() => ctx.roundRect(cx - 28, cy - 34, 56, 70, 14));
      ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.roundRect(cx - 18, cy - 26, 36, 22, 8); ctx.fill(); outline(ctx, 2);
      ctx.fillStyle = '#ffeb3b'; ctx.fillRect(cx - 28, cy + 10, 56, 6);
      break;
    case 'bugspray':
      body(() => ctx.roundRect(cx - 18, cy - 24, 36, 62, 8));
      ctx.fillStyle = '#eceff1'; ctx.fillRect(cx - 10, cy - 36, 20, 12);
      ctx.fillStyle = '#33691e'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✕', cx, cy + 16);
      break;
    case 'radsuit':
      body(() => ctx.roundRect(cx - 30, cy - 34, 60, 70, 16));
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(cx, cy + 2, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i / 3) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.arc(cx, cy + 2, 12, a - 0.5, a + 0.5); ctx.fill(); }
      break;
    case 'voidlantern':
      ctx.fillStyle = '#37474f'; ctx.fillRect(cx - 22, cy - 38, 44, 8); ctx.fillRect(cx - 22, cy + 26, 44, 8);
      ctx.beginPath(); ctx.arc(cx, cy - 46, 8, Math.PI, 0); ctx.strokeStyle = '#37474f'; ctx.lineWidth = 4; ctx.stroke();
      { const g = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy - 4, 30); g.addColorStop(0, '#fff'); g.addColorStop(0.4, c); g.addColorStop(1, rgba(c, 0.2)); ctx.fillStyle = g; }
      ctx.beginPath(); ctx.roundRect(cx - 18, cy - 30, 36, 56, 6); ctx.fill(); outline(ctx);
      break;
    case 'visor':
      ctx.beginPath(); ctx.ellipse(cx, cy, 50, 22, 0, 0, Math.PI * 2);
      { const g = ctx.createLinearGradient(cx - 50, cy, cx + 50, cy); g.addColorStop(0, '#263238'); g.addColorStop(0.5, c); g.addColorStop(1, '#263238'); ctx.fillStyle = g; }
      ctx.fill(); outline(ctx);
      highlight(ctx, cx - 20, cy - 8, 16, 5, 0.7);
      break;
    default:
      body(() => ctx.arc(cx, cy, 34, 0, Math.PI * 2));
  }
}

function drawEquip(ctx, r) {
  if (!r) return;
  const gemColor = { copperband: '#e2803e', goldring: '#ffd447', silverchain: '#e3e8ef', gardenglove: '#8bc34a', amethystpend: '#b57bff', titaniumring: '#bcc7d3', rubyring: '#ef1a66', pearlneck: '#fffaf2', horseshoe: '#9e9e9e', sapphirering: '#2f61ff', moonring: '#eef4ff', scarabcharm: '#ffb000', frostpendant: '#a6ecff', dragonfang: '#f4e9d4', fossilcharm: '#cfa982', jungleband: '#86ff1a', starring: '#fff59d', voidring: '#7b2cbf', halo: '#fff3b0' }[r.id] || '#ffd447';
  const cx = 64, cy = 64;
  if (r.slot === 'ring') {
    ctx.beginPath(); ctx.ellipse(cx, cy + 12, 34, 30, 0, 0, Math.PI * 2); ctx.ellipse(cx, cy + 12, 24, 20, 0, 0, Math.PI * 2, true);
    const metal = r.id === 'copperband' ? '#c87533' : r.id === 'voidring' ? '#3c096c' : '#e0c060';
    const g = ctx.createLinearGradient(0, cy - 20, 0, cy + 44); g.addColorStop(0, shade(metal, 0.4)); g.addColorStop(1, shade(metal, -0.3));
    ctx.fillStyle = g; ctx.fill('evenodd'); outline(ctx, 2.5);
    gemSmall(ctx, cx, cy - 18, 15, gemColor);
  } else if (r.slot === 'neck') {
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy - 20, 40, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.setLineDash([2, 5]); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    gemSmall(ctx, cx, cy + 26, 20, gemColor);
  } else {
    ctx.beginPath(); ctx.roundRect(cx - 30, cy - 30, 60, 64, 18);
    const g = ctx.createLinearGradient(0, cy - 30, 0, cy + 34); g.addColorStop(0, shade(gemColor, 0.3)); g.addColorStop(1, shade(gemColor, -0.35));
    ctx.fillStyle = g; ctx.fill(); outline(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy + 2, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#5d4037'; ctx.fillRect(cx - 3, cy - 44, 6, 16);
    highlight(ctx, cx - 12, cy - 16, 10, 6, 0.6);
  }
}

function gemSmall(ctx, x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s, y - s * 0.2); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y - s * 0.2); ctx.closePath();
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
  g.addColorStop(0, shade(color, 0.5)); g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g; ctx.fill(); outline(ctx, 2.5);
  star4(ctx, x - s * 0.3, y - s * 0.35, s * 0.35, 'rgba(255,255,255,0.9)');
}

export function mineralColor(id) {
  const m = MINERAL[id];
  return m ? mixHex(m.c1, m.c2, 0.3) : '#ccc';
}
