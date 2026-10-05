// Simulated players. They join and leave the server, prospect at shores
// (visibly, when they share your shore), chat, brag about finds, react to
// yours, place totems you can stand in, and summon meteor showers.
import { NAME_PREFIX, NAME_A, NAME_B, NAME_SUFFIX, SKINS, SHIRTS, PANTS, HATS, CHAT, REPLIES, DEFAULT_REPLIES } from './data/bots.js';
import { SHORES, SHORE, SHORE_INDEX } from './data/shores.js';
import { PANS } from './data/gear.js';
import { MINERAL } from './data/minerals.js';
import { TIERS, tierOf } from './data/rarity.js';
import { TOTEM } from './data/items.js';
import { EVENT } from './data/events.js';
import { pick, rand, randInt, uid, fmtKg, clamp, weightedPick } from './util.js';

const POOL_SIZE = 48;
const PERSONALITIES = ['chatty', 'chatty', 'quiet', 'quiet', 'helper', 'newbie', 'tryhard', 'casual', 'casual'];

function makeName(r = Math.random) {
  for (let tries = 0; tries < 10; tries++) {
    const style = r();
    let n;
    if (style < 0.35) n = pick(NAME_PREFIX, r) + pick(NAME_A, r) + pick(NAME_B, r) + pick(NAME_SUFFIX, r);
    else if (style < 0.6) n = pick(NAME_A, r) + pick(NAME_B, r) + randInt(1, 9999, r);
    else if (style < 0.8) n = (pick(NAME_A, r) + '_' + pick(NAME_B, r)).toLowerCase() + (r() < 0.5 ? randInt(2008, 2016, r) : '');
    else n = pick(NAME_PREFIX, r) + pick(NAME_A, r) + pick(NAME_SUFFIX, r) + (r() < 0.4 ? randInt(10, 99, r) : '');
    if (n.length >= 4 && n.length <= 20) return n;
  }
  return 'Prospector' + randInt(100, 999, r);
}

function makeProfile(r = Math.random) {
  // tier skew: lots of mid players, a few whales
  const tier = clamp(Math.floor(Math.pow(r(), 1.25) * PANS.length), 0, PANS.length - 1);
  const panPrice = PANS[tier].price || 200;
  return {
    id: uid(),
    name: makeName(r),
    skin: pick(SKINS, r),
    shirt: pick(SHIRTS, r),
    pants: pick(PANTS, r),
    hat: pick(HATS, r),
    tier,
    level: Math.max(1, Math.round(2 + tier * 4.5 + r() * 6)),
    rebirths: tier >= 13 && r() < 0.6 ? randInt(1, 4, r) : 0,
    earned: Math.round(panPrice * (3 + r() * 20) + 500),
    personality: pick(PERSONALITIES, r),
  };
}

// Highest shore index a bot of this tier would prospect at
const maxShoreForTier = (tier) => clamp(Math.floor(tier * 0.85), 0, SHORES.length - 2);

export class BotManager {
  constructor(game, saved) {
    this.game = game;
    this.pool = Array.isArray(saved?.pool) && saved.pool.length ? saved.pool : Array.from({ length: POOL_SIZE }, () => makeProfile());
    this.active = [];
    this.totems = [];
    this.events = [];
    this.pendingSays = [];
    this.serverId = randInt(1000, 9999);
    this.region = pick(['US-East', 'US-West', 'EU-West', 'EU-Central', 'Asia', 'Oceania']);
    this.t = { chat: rand(3, 6), join: rand(25, 50), totem: rand(40, 90), fragment: rand(240, 520), find: rand(15, 35), earn: 0, move: rand(30, 60) };
    const startCount = randInt(9, 13);
    for (let i = 0; i < startCount; i++) this.join(true);
  }

  serialize() {
    return { pool: this.pool };
  }

  // Global "players online" figure: follows a daily curve plus a little noise
  globalOnline(now = Date.now()) {
    const d = new Date(now);
    const h = d.getHours() + d.getMinutes() / 60;
    const curve = 0.62 + 0.38 * Math.sin(((h - 10) / 24) * Math.PI * 2);
    const wobble = Math.sin(now / 97000) * 0.03 + Math.sin(now / 13000) * 0.01;
    const players = Math.round(41000 * (curve + wobble));
    return { players, servers: Math.ceil(players / 13.5) };
  }

  // ── population ──────────────────────────────────────────────────────
  join(silent) {
    const used = new Set(this.active.map((b) => b.p.id));
    const cands = this.pool.filter((p) => !used.has(p.id) && p.name !== this.game.s.name);
    if (!cands.length || this.active.length >= 15) return;
    const p = pick(cands);
    const bot = {
      p,
      shore: this.chooseShore(p),
      state: 'idle', timer: rand(0.5, 3), x: rand(0.15, 0.85), tx: 0.3, depth: Math.random(), dir: 1,
      digs: 0, bubble: null, cheer: 0, joinedAt: Date.now(), walkSpeed: rand(0.16, 0.24), anim: Math.random() * 10,
    };
    this.active.push(bot);
    if (!silent) {
      this.game.pushChat({ kind: 'system', text: `${p.name} joined the game` });
      if (p.personality !== 'quiet' && Math.random() < 0.6) this.queueSay(bot, pick(CHAT.greet), rand(2, 6));
    }
  }

  leave(bot) {
    this.active = this.active.filter((b) => b !== bot);
    this.game.pushChat({ kind: 'system', text: `${bot.p.name} left the game` });
  }

  chooseShore(p) {
    const maxIdx = maxShoreForTier(p.tier);
    const playerIdx = SHORE_INDEX[this.game.s.shore] ?? 0;
    // bots like company: good chance to hang out where the player is
    if (playerIdx <= maxIdx && Math.random() < 0.45) return this.game.s.shore;
    const lo = Math.max(0, maxIdx - 3);
    return SHORES[randInt(lo, maxIdx)].id;
  }

  countAt(shoreId) {
    return this.active.filter((b) => b.shore === shoreId).length;
  }

  here() {
    return this.active.filter((b) => b.shore === this.game.s.shore);
  }

  totemsList() {
    return this.totems.map((t) => ({ id: t.id, shore: t.shore, owner: t.owner }));
  }

  onPlayerTravel(shoreId) {
    // a couple of bots tag along / are already there
    for (const b of this.active) {
      if (b.shore === shoreId) { b.x = rand(0.1, 0.9); b.state = 'idle'; b.timer = rand(0.2, 2); }
    }
  }

  // ── main update ─────────────────────────────────────────────────────
  update(dt) {
    const g = this.game;
    const now = Date.now();
    for (const k of Object.keys(this.t)) this.t[k] -= dt;

    // queued chat lines
    for (let i = this.pendingSays.length - 1; i >= 0; i--) {
      const ps = this.pendingSays[i];
      ps.delay -= dt;
      if (ps.delay <= 0) {
        this.pendingSays.splice(i, 1);
        if (this.active.includes(ps.bot)) this.say(ps.bot, ps.text);
      }
    }

    // join / leave churn
    if (this.t.join <= 0) {
      this.t.join = rand(35, 110);
      const target = 11;
      if (this.active.length > 6 && (this.active.length > target || Math.random() < 0.45)) {
        const leaving = pick(this.active.filter((b) => now - b.joinedAt > 60000) || this.active);
        if (leaving) this.leave(leaving);
      } else this.join(false);
    }

    // some bots move between shores
    if (this.t.move <= 0) {
      this.t.move = rand(25, 70);
      const b = pick(this.active);
      if (b) {
        const prev = b.shore;
        b.shore = this.chooseShore(b.p);
        if (b.shore === g.s.shore && prev !== b.shore) { b.x = Math.random() < 0.5 ? -0.05 : 1.05; b.state = 'idle'; b.timer = 0; }
      }
    }

    // ambient chat
    if (this.t.chat <= 0) {
      this.t.chat = rand(7, 16);
      if (g.s.settings.chat !== false) this.ambientChat();
    }

    // notable finds by others
    if (this.t.find <= 0) {
      this.t.find = rand(20, 55);
      this.botFind();
    }

    // totems
    for (const t of this.totems) t.left -= dt * 1000;
    const before = this.totems.length;
    this.totems = this.totems.filter((t) => t.left > 0);
    if (this.totems.length !== before) g.invalidate();
    if (this.t.totem <= 0) {
      this.t.totem = rand(70, 160);
      this.placeTotem();
    }

    // meteor fragments
    this.events = this.events.filter((e) => e.end > now);
    if (this.t.fragment <= 0) {
      this.t.fragment = rand(420, 900);
      if (!g.events.length && this.active.length) {
        const b = pick(this.active.filter((x) => x.p.tier >= 3)) || pick(this.active);
        const dur = 240000;
        this.events.push({ id: 'meteor', u: uid(), by: b.p.name, end: now + dur });
        this.queueSay(b, pick(CHAT.fragment), 0.3);
      }
    }

    // leaderboard drift
    if (this.t.earn <= 0) {
      this.t.earn = 5;
      for (const b of this.active) {
        const rate = (PANS[b.p.tier].price || 400) * 0.25; // per hour
        b.p.earned += rate * (5 / 3600) * rand(0.5, 1.5);
      }
    }

    // animate bots at the player's shore
    for (const b of this.active) if (b.shore === g.s.shore) this.animate(b, dt);
    for (const b of this.active) if (b.bubble) { b.bubble.t -= dt; if (b.bubble.t <= 0) b.bubble = null; }
  }

  // Visible behaviour loop: walk → dig ×N → walk → pan → (cheer) → repeat
  animate(b, dt) {
    b.anim += dt;
    b.timer -= dt;
    if (b.cheer > 0) b.cheer -= dt;
    switch (b.state) {
      case 'idle':
        if (b.timer <= 0) {
          if (Math.random() < 0.85) { b.state = 'toDig'; b.tx = rand(0.08, 0.4); }
          else { b.state = 'wander'; b.tx = rand(0.1, 0.9); }
        }
        break;
      case 'wander': case 'toDig': case 'toWater': {
        const d = b.tx - b.x;
        b.dir = d >= 0 ? 1 : -1;
        const step = b.walkSpeed * dt;
        if (Math.abs(d) <= step) {
          b.x = b.tx;
          if (b.state === 'toDig') { b.state = 'dig'; b.digs = randInt(3, 8); b.timer = rand(0.7, 1.1); b.dir = 1; }
          else if (b.state === 'toWater') { b.state = 'pan'; b.timer = rand(4, 9); b.dir = 1; }
          else { b.state = 'idle'; b.timer = rand(1, 4); }
        } else b.x += Math.sign(d) * step;
        break;
      }
      case 'dig':
        if (b.timer <= 0) {
          b.digs--;
          b.timer = rand(0.7, 1.2);
          if (b.digs <= 0) { b.state = 'toWater'; b.tx = rand(0.62, 0.9); }
        }
        break;
      case 'pan':
        if (b.timer <= 0) {
          if (Math.random() < 0.08) { b.cheer = 1.6; }
          if (Math.random() < 0.15) { b.state = 'idle'; b.timer = rand(1, 5); }
          else { b.state = 'toDig'; b.tx = rand(0.08, 0.4); }
        }
        break;
      default:
        b.state = 'idle';
    }
  }

  // ── chat ────────────────────────────────────────────────────────────
  say(bot, text) {
    const g = this.game;
    text = this.fill(text, bot);
    g.pushChat({ kind: 'chat', who: bot.p.name, text, color: nameColor(bot.p) });
    if (bot.shore === g.s.shore) bot.bubble = { text, t: 4 };
  }

  queueSay(bot, text, delay) {
    this.pendingSays.push({ bot, text, delay });
  }

  fill(text, bot) {
    const g = this.game;
    const shore = SHORE[bot.shore] || SHORES[0];
    const ev = g.events[0]?.def;
    // brag/trade about something worth bragging about
    const tierList = ['rare', 'epic', 'legendary'].flatMap((t) => shore.pools[t] || []);
    const m = MINERAL[pick(tierList.length ? tierList : shore.pools.common).id];
    return text
      .replace(/\{player\}/g, g.s.name)
      .replace(/\{mineral\}/g, m.name.toLowerCase())
      .replace(/\{shore\}/g, shore.name.toLowerCase())
      .replace(/\{event\}/g, ev ? ev.name.toLowerCase() : 'event')
      .replace(/\{totem\}/g, 'luck totem');
  }

  ambientChat() {
    if (!this.active.length) return;
    const g = this.game;
    const bot = pick(this.active);
    const pers = bot.p.personality;
    if (pers === 'quiet' && Math.random() < 0.7) return;
    let cat;
    if (g.events.length && Math.random() < 0.25) cat = 'event';
    else if (pers === 'newbie') cat = Math.random() < 0.6 ? 'newbie' : 'random';
    else if (pers === 'helper') cat = Math.random() < 0.6 ? 'tip' : 'random';
    else if (pers === 'tryhard') cat = pick(['brag', 'complain', 'tip', 'trade']);
    else cat = pick(['random', 'random', 'complain', 'brag', 'tip', 'trade', 'newbie']);
    this.say(bot, pick(CHAT[cat]));
    // helpers sometimes answer newbie questions
    if (cat === 'newbie' && Math.random() < 0.6) {
      const helper = pick(this.active.filter((b) => b !== bot && b.p.personality !== 'quiet'));
      if (helper) this.queueSay(helper, pick(CHAT.tip), rand(2, 5));
    }
  }

  onPlayerChat(text) {
    const lower = text.toLowerCase();
    const named = this.active.find((b) => lower.includes(b.p.name.toLowerCase()));
    const count = named ? 1 : Math.random() < 0.75 ? (Math.random() < 0.3 ? 2 : 1) : 0;
    const used = new Set();
    for (let i = 0; i < count; i++) {
      const bot = i === 0 && named ? named : pick(this.active.filter((b) => !used.has(b) && b.p.personality !== 'quiet'));
      if (!bot) break;
      used.add(bot);
      const rule = REPLIES.find((r) => r.re.test(text));
      const line = rule ? pick(rule.lines) : pick(DEFAULT_REPLIES);
      this.queueSay(bot, line, rand(1.2, 3.5) + i * rand(1, 2.5));
    }
  }

  reactToFind(tierIdx) {
    const n = tierIdx >= 5 ? randInt(2, 4) : randInt(0, 2);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const bot = pick(this.active.filter((b) => !used.has(b)));
      if (!bot) break;
      used.add(bot);
      this.queueSay(bot, pick(CHAT.react), rand(1, 4) + i);
    }
  }

  botFind() {
    const g = this.game;
    if (!this.active.length) return;
    const bot = pick(this.active);
    const shore = SHORE[bot.shore];
    // rarity roll scaled by the bot's gear tier
    const t = bot.p.tier / (PANS.length - 1);
    const roll = Math.random();
    let tier = 'epic';
    if (roll < 0.004 + t * 0.01 && shore.pools.exotic) tier = 'exotic';
    else if (roll < 0.04 + t * 0.06) tier = 'mythic';
    else if (roll < 0.35 + t * 0.2) tier = 'legendary';
    const list = shore.pools[tier] || shore.pools.legendary || shore.pools.epic;
    const m = MINERAL[weightedPick(list, (e) => e.w).id];
    const kg = m.kg * Math.exp((Math.random() - 0.3) * 1.2) * (1 + t);
    const td = tierOf(m.tier);
    if (td.id === 'epic') {
      if (Math.random() < 0.5) this.say(bot, pick(CHAT.brag).replace('{mineral}', m.name.toLowerCase()));
      return;
    }
    g.pushChat({ kind: 'announce', text: `${bot.p.name} found a ${td.name} ${m.name} (${fmtKg(kg)})!`, color: td.color });
    if (bot.shore === g.s.shore) bot.cheer = 2;
    if (Math.random() < 0.5) this.queueSay(bot, pick(['LETS GOOO', 'YESSS', 'omg', 'finally!!', '😱', 'no way']), rand(0.8, 2));
    if (Math.random() < 0.5) {
      const other = pick(this.active.filter((b) => b !== bot));
      if (other) this.queueSay(other, pick(['gg', 'ggs', 'lucky', 'W', 'congrats', 'nice!']), rand(2, 5));
    }
  }

  placeTotem() {
    const g = this.game;
    const cands = this.active.filter((b) => b.p.tier >= 2);
    if (!cands.length) return;
    const bot = pick(cands);
    const id = weightedPick(['luckTotem', 'strengthTotem', 'friendTotem', 'midasTotem', 'mutationTotem', 'giantTotem'], (x) => ({ luckTotem: 4, strengthTotem: 2, friendTotem: 2, midasTotem: 1, mutationTotem: 1, giantTotem: 1 })[x]);
    if (this.totems.some((t) => t.shore === bot.shore && t.id === id)) return;
    const def = TOTEM[id];
    this.totems.push({ id, shore: bot.shore, owner: bot.p.name, left: 300000, u: uid(), x: bot.shore === g.s.shore ? clamp(bot.x, 0.1, 0.5) : rand(0.12, 0.45) });
    g.invalidate();
    const shoreName = SHORE[bot.shore].name;
    g.pushChat({ kind: 'system', text: `${bot.p.name} placed a ${def.name} at ${shoreName}`, color: def.color });
    if (Math.random() < 0.6) this.queueSay(bot, pick(CHAT.totem).replace('{totem}', def.name.toLowerCase()), rand(1, 3));
  }

  // ── leaderboard ─────────────────────────────────────────────────────
  leaderboard(scope) {
    const g = this.game;
    const me = { name: g.s.name, earned: g.s.stats.earned, level: g.s.level, me: true, rebirths: g.s.rebirths };
    const list = (scope === 'server' ? this.active.map((b) => b.p) : this.pool)
      .map((p) => ({ name: p.name, earned: p.earned, level: p.level, rebirths: p.rebirths, shirt: p.shirt }));
    list.push(me);
    list.sort((a, b) => b.earned - a.earned);
    return list;
  }
}

export function nameColor(p) {
  if (p.rebirths >= 3) return '#ff80ab';
  if (p.rebirths >= 1) return '#fff59d';
  if (p.level >= 45) return '#b388ff';
  if (p.level >= 25) return '#80d8ff';
  return '#c5e1a5';
}

export { EVENT, TIERS };
