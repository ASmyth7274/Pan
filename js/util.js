// Shared helpers: math, RNG, formatting. No DOM access here so the
// simulation tools in /tools can import it under Node.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Deterministic PRNG (mulberry32). Used for schedules that must agree
// across reloads (events, merchant stock, bot names).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rand = (a = 0, b = 1, r = Math.random) => a + (b - a) * r();
export const randInt = (a, b, r = Math.random) => Math.floor(a + (b - a + 1) * r());
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export function gaussian(r = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function weightedPick(items, weightOf, r = Math.random) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items[0];
  let x = r() * total;
  for (const it of items) {
    x -= Math.max(0, weightOf(it));
    if (x <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let uidCounter = 0;
export function uid() {
  uidCounter = (uidCounter + 1) % 1e6;
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) + uidCounter.toString(36);
}

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// 1234 -> "1.23K", 15 -> "15"
export function fmtNum(n, digits = 3) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  n = Math.abs(n);
  if (n < 1000) {
    let s = n < 10 && n % 1 !== 0 ? n.toFixed(n < 1 ? 2 : 1) : Math.floor(n).toString();
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return (neg ? '-' : '') + s;
  }
  let i = 0;
  while (n >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000;
    i++;
  }
  const dec = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  let s = n.toFixed(Math.min(dec, digits - 1));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return (neg ? '-' : '') + s + SUFFIXES[i];
}

export const fmtCash = (n) => '$' + fmtNum(Math.abs(n) < 1000 ? Math.floor(n) : n);

export function fmtKg(kg) {
  if (kg >= 100) return kg.toFixed(0) + 'kg';
  if (kg >= 10) return kg.toFixed(1) + 'kg';
  if (kg >= 1) return kg.toFixed(2) + 'kg';
  return kg.toFixed(3) + 'kg';
}

export function fmtTime(ms) {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function fmtPct(x, digits = 0) {
  return (x * 100).toFixed(digits).replace(/\.0+$/, '') + '%';
}

export function fmtOdds(p) {
  if (p <= 0) return '—';
  const inv = 1 / p;
  if (inv < 1.05) return '1 in 1';
  return '1 in ' + fmtNum(inv, 3);
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Colour helpers for procedural art
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
export function shade(hex, amt) {
  return amt >= 0 ? mixHex(hex, '#ffffff', amt) : mixHex(hex, '#000000', -amt);
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) {
    if (!this._h.has(ev)) this._h.set(ev, new Set());
    this._h.get(ev).add(fn);
    return () => this._h.get(ev)?.delete(fn);
  }
  emit(ev, payload) {
    const hs = this._h.get(ev);
    if (hs) for (const fn of hs) {
      try { fn(payload); } catch (e) { console.error('handler error', ev, e); }
    }
    const all = this._h.get('*');
    if (all) for (const fn of all) {
      try { fn(ev, payload); } catch (e) { console.error(e); }
    }
  }
}
