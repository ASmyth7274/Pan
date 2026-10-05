// Economy simulation: plays a greedy "decent player" through the game and
// prints when each upgrade is reached. Used to tune prices and values.
//   node tools/sim.mjs [hours] [skill 0..1] [seed]
import { defaultState } from '../js/state.js';
import { computeStats } from '../js/stats.js';
import { rollPan, baseValue, itemXp } from '../js/loot.js';
import { PANS, SHOVELS } from '../js/data/gear.js';
import { SHORES } from '../js/data/shores.js';
import { xpToNext } from '../js/progression.js';
import { mulberry32, fmtCash, fmtNum } from '../js/util.js';

const HOURS = Number(process.argv[2] || 30);
const SKILL = Number(process.argv[3] || 0.75);
const rng = mulberry32(Number(process.argv[4] || 7));
const EVENT_LUCK = 1.25; // average boost from events/totems/potions over time

const s = defaultState();
let t = 0; // seconds
const log = [];
const mark = (what) => log.push([t, what, s.cash]);

function stats() {
  return computeStats({ state: s, shoreId: s.shore, events: [], botTotems: [], playersHere: 0 }).values;
}

function gradeRoll() {
  // returns [quality, sediment mult]
  const x = rng();
  if (x < SKILL * 0.6) return [1, 1.25];
  if (x < SKILL * 0.6 + 0.25) return [0.85, 1.1];
  if (x < 0.95) return [0.7, 1];
  return [0.55, 0.85];
}

let streak = 0;
let lastPrint = 0;
let earnedHour = 0;
while (t < HOURS * 3600) {
  const st = stats();
  // dig
  let sed = 0, qsum = 0;
  while (sed < st.capacity) {
    const [q, m] = gradeRoll();
    const add = Math.min(st.digStrength * m, st.capacity - sed);
    sed += add; qsum += add * q;
    streak = q === 1 ? streak + 1 : q >= 0.85 ? streak : 0;
    t += 0.55 / st.digSpeed + 0.75;
  }
  t += 1.2; // walking
  const panTime = st.capacity / (st.shakeStrength * st.shakeSpeed * 5);
  const glints = Math.floor(panTime / 2) * (SKILL > 0.5 ? 0.6 : 0.3);
  t += panTime + glints * 0.3 + 0.8;
  const res = rollPan({
    stats: { ...st, luck: st.luck * EVENT_LUCK }, shore: SHORES.find((x) => x.id === s.shore), fill: 1,
    quality: qsum / sed, glints: Math.round(glints), streak, isNight: rng() < 0.35, extra: {}, rng,
  });
  for (const it of res.items) {
    s.cash += baseValue(it) * st.sellBoost;
    earnedHour += baseValue(it) * st.sellBoost;
    s.xp += itemXp(it);
  }
  s.xp += 5;
  s.shards += res.shards;
  while (s.xp >= xpToNext(s.level)) { s.xp -= xpToNext(s.level); s.level++; }

  // purchases (greedy): pan, shovel, shore
  let bought = true;
  while (bought) {
    bought = false;
    const nextPan = PANS.find((p) => !s.pans.includes(p.id) && !p.req);
    const nextShovel = SHOVELS.find((p) => !s.shovels.includes(p.id) && !p.req);
    const nextShore = SHORES.find((x) => !s.shores.includes(x.id) && !x.req.rebirths);
    const tough = SHOVELS.find((x) => x.id === s.shovel).toughness;
    const opts = [];
    if (nextPan) opts.push(['pan', nextPan.price, nextPan]);
    if (nextShovel) opts.push(['shovel', nextShovel.price, nextShovel]);
    if (nextShore && nextShore.req.toughness <= tough && nextShore.req.level <= s.level) opts.push(['shore', nextShore.req.cost, nextShore]);
    opts.sort((a, b) => a[1] - b[1]);
    for (const [kind, price, obj] of opts) {
      if (s.cash >= price) {
        s.cash -= price;
        if (kind === 'pan') { s.pans.push(obj.id); s.pan = obj.id; }
        if (kind === 'shovel') { s.shovels.push(obj.id); s.shovel = obj.id; }
        if (kind === 'shore') { s.shores.push(obj.id); s.shore = obj.id; }
        mark(`${kind}: ${obj.name} (${fmtCash(price)}) lv${s.level} [rate ${fmtCash(earnedHour / Math.max(1, (t - lastPrint)) * 3600)}/h]`);
        bought = true;
        break;
      }
    }
  }
  if (t - lastPrint > 3600) {
    lastPrint = t;
    const st2 = stats();
    log.push([t, `-- hour ${Math.round(t / 3600)}: earned/h ${fmtCash(earnedHour)} cash ${fmtCash(s.cash)} lv ${s.level} luck ${st2.luck.toFixed(1)} cap ${st2.capacity} @${s.shore}`, s.cash]);
    earnedHour = 0;
  }
}

const fmtT = (sec) => `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`;
for (const [tt, what] of log) console.log(fmtT(tt).padStart(7), what);
console.log('final level', s.level, 'shards', s.shards, 'cash', fmtNum(s.cash));
