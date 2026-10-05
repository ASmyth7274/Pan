// Save state: shape, persistence and migration.
import { randInt } from './util.js';

export const SAVE_KEY = 'pan-prospecting-save';
export const SAVE_VERSION = 1;
export const MUSEUM_MAX = 12;

export function defaultState() {
  return {
    v: SAVE_VERSION,
    created: Date.now(),
    lastSeen: Date.now(),
    name: 'Prospector' + randInt(1000, 9999),
    avatar: { skin: '#f5cd30', shirt: '#e53935', pants: '#1565c0', hat: 'cowboy' },
    title: null,
    cash: 0,
    shards: 0,
    xp: 0,
    level: 1,
    rebirths: 0,
    pans: ['rusty'],
    pan: 'rusty',
    shovels: ['rusty'],
    shovel: 'rusty',
    enchants: {},
    shore: 'rubble',
    shores: ['rubble'],
    bag: [],
    bagSize: 30,
    bagUpgrades: 0,
    items: {},
    buffs: [],
    totems: [],
    outfits: [],
    museum: { slots: 3, items: Array(MUSEUM_MAX).fill(null) },
    equipment: [],
    equipped: { neck: null, charm: null, rings: [null] },
    sluices: [],
    sluiceSlots: 1,
    placed: [],
    index: {},
    stats: {
      digs: 0, perfectDigs: 0, pans: 0, items: 0, earned: 0, sold: 0, bestStreak: 0,
      modsFound: 0, huge: 0, colossal: 0, crafts: 0, enchants: 0, sluiceCollects: 0,
      totems: 0, chats: 0, playtime: 0, potions: 0,
    },
    quests: { npc: {}, daily: { day: '', list: [] } },
    achievements: {},
    login: { last: '', streak: 0 },
    codes: {},
    settings: {
      sfx: 0.7, ambient: true, haptics: true, quality: 'high', motion: true, chat: true,
      autoSell: 'none', autoLock: true,
    },
    auto: false,
    pending: { sed: 0, qsum: 0, glints: 0 },
    streak: 0,
    serverEvents: [],
    merchant: { slot: -1, bought: [] },
    best: null,
    bots: null,
    tips: {},
  };
}

// Deep-merge saved data onto defaults so new fields appear after updates.
function mergeDefaults(def, saved) {
  if (saved === undefined || saved === null) return def;
  if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
  if (typeof def === 'object' && def !== null) {
    if (typeof saved !== 'object' || Array.isArray(saved)) return def;
    const out = { ...saved };
    for (const k of Object.keys(def)) out[k] = mergeDefaults(def[k], saved[k]);
    return out;
  }
  return typeof saved === typeof def ? saved : def;
}

export function migrate(raw) {
  const s = mergeDefaults(defaultState(), raw);
  if (!Array.isArray(s.museum.items) || s.museum.items.length !== MUSEUM_MAX) {
    const items = Array(MUSEUM_MAX).fill(null);
    (s.museum.items || []).slice(0, MUSEUM_MAX).forEach((x, i) => (items[i] = x || null));
    s.museum.items = items;
  }
  if (!Array.isArray(s.equipped.rings) || s.equipped.rings.length < 1) s.equipped.rings = [null];
  s.v = SAVE_VERSION;
  return s;
}

function storage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    return ls;
  } catch {
    return null;
  }
}

export function loadState() {
  const ls = storage();
  if (!ls) return { state: defaultState(), fresh: true };
  for (const key of [SAVE_KEY, SAVE_KEY + '-backup']) {
    try {
      const txt = ls.getItem(key);
      if (!txt) continue;
      const raw = JSON.parse(txt);
      if (raw && typeof raw === 'object') return { state: migrate(raw), fresh: false };
    } catch (e) {
      console.warn('Save slot unreadable', key, e);
    }
  }
  return { state: defaultState(), fresh: true };
}

export function saveState(state) {
  const ls = storage();
  if (!ls) return false;
  try {
    state.lastSeen = Date.now();
    const txt = JSON.stringify(state);
    const prev = ls.getItem(SAVE_KEY);
    if (prev) ls.setItem(SAVE_KEY + '-backup', prev);
    ls.setItem(SAVE_KEY, txt);
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function exportSave(state) {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(code) {
  const json = decodeURIComponent(escape(atob(code.trim())));
  const raw = JSON.parse(json);
  if (!raw || typeof raw !== 'object' || !('cash' in raw)) throw new Error('Not a Pan! save');
  return migrate(raw);
}

export function wipeSave() {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(SAVE_KEY);
    ls.removeItem(SAVE_KEY + '-backup');
  } catch { /* ignore */ }
}
