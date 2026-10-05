// Headless smoke test of the game rules: runs a scripted session and
// exercises most actions. `node tools/smoke.mjs`
import { defaultState } from '../js/state.js';
import { Game } from '../js/game.js';
import { BotManager } from '../js/bots.js';
import { fmtCash } from '../js/util.js';

const s = defaultState();
const g = new Game(s);
g.bots = new BotManager(g, null);
const errors = [];
g.on('*', (ev, p) => { if (ev === 'toast' && p.kind === 'warn') console.log('  [toast]', p.text); });

function step(seconds, fn) {
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    fn?.();
    g.update(dt);
    g.bots.update(dt);
  }
}

// play: dig with perfect timing, then pan with glint catching
function playCycle() {
  let guard = 0;
  while (g.phase !== 'pan' && guard++ < 2000) {
    if (g.phase === 'dig' && !g.dig.charging && g.dig.cooldown <= 0) g.press();
    if (g.dig.charging && Math.abs(g.dig.needle - g.dig.zone) < 0.03) g.release();
    step(1 / 30);
  }
  guard = 0;
  while (g.phase === 'pan' && guard++ < 5000) {
    if (!g.pan.shaking) g.press();
    if (g.pan.glint && g.pan.glint.t < 0.5) { g.release(); g.press(); }
    step(1 / 30);
  }
  step(1);
}

for (let i = 0; i < 25; i++) {
  playCycle();
  if (g.bagFree() < 5) g.sellWhere(() => true);
}
g.sellWhere(() => true);
console.log('after 25 pans: cash', fmtCash(s.cash), 'lvl', s.level, 'items found', s.stats.items, 'perfect', s.stats.perfectDigs);
console.log('quest:', g.trackedQuest()?.q.title, g.trackedQuest()?.p, '/', g.trackedQuest()?.n);

s.cash += 5e6; s.shards += 500;
g.buyPan('plastic'); g.buyShovel('iron');
for (const q of ['pete', 'pete', 'pete', 'pete', 'pete', 'pete']) g.claimQuest(q);
g.travel('fortune');
console.log('shore', s.shore, 'pan', s.pan, 'shovel', s.shovel);
s.level = 20; g.addXp(1);
g.buyConsumable('luck1', { cash: 25000 }); g.useItem('luck1');
g.buyConsumable('luckTotem', { shards: 40 }); g.useItem('luckTotem');
g.s.items.meteorFragment = 1; g.useItem('meteorFragment');
step(1);
console.log('events', g.events.map((e) => e.def.name), 'luck', g.stats().luck.toFixed(2));
for (let i = 0; i < 10; i++) playCycle();
const first = s.bag[0];
if (first) console.log('museum place', g.museumPlace(0, first.u), 'luck now', g.stats().luck.toFixed(2));
g.buySluice('wooden'); g.placeSluice('wooden', 'rubble');
s.placed[0].last -= 3600 * 1000; g.tickSluices(true);
console.log('sluice tray', s.placed[0].tray.length, 'collect', g.collectSluice(s.placed[0].u));
s.bag.push({ u: 'x1', m: 'copper', kg: 0.2, lock: false }, { u: 'x2', m: 'copper', kg: 0.2, lock: false }, { u: 'x3', m: 'copper', kg: 0.2, lock: false }, { u: 'x4', m: 'copper', kg: 0.2, lock: false }, { u: 'x5', m: 'copper', kg: 0.2, lock: false }, { u: 'x6', m: 'copper', kg: 0.2, lock: false });
const eq = g.craft('copperband');
console.log('crafted', eq?.r, eq && Object.entries(eq.stats).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(','), 'equipped', g.isEquipped(eq?.u));
s.bag.push({ u: 'au', m: 'aurorite', kg: 0.1, lock: false });
const ench = g.enchantRoll('aurorite');
console.log('enchant', ench?.name, 'luck', g.stats().luck.toFixed(2));
console.log('daily', s.quests.daily.list.map((d) => `${d.title} ${d.p}/${d.goal.n}`).join(' | '));
console.log('merchant', JSON.stringify(g.merchant().stock));
console.log('claimable achievements', g.claimableAchievements().map((a) => a.title).join(', '));
console.log('login', JSON.stringify(g.loginDay()), g.claimLogin());
console.log('code', g.redeemCode('panning'), s.shards);
s.cash = 1e12; s.level = 45;
console.log('rebirth', g.rebirth(), 'rebirths', s.rebirths, 'luck', g.stats().luck.toFixed(2));
console.log('leaderboard top3', g.bots.leaderboard('global').slice(0, 3).map((x) => `${x.name}:${fmtCash(x.earned)}`).join(' '));
console.log('chat sample:\n  ' + g.chatLog.slice(-12).map((m) => `${m.kind}${m.who ? ' ' + m.who : ''}: ${m.text}`).join('\n  '));
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'SMOKE OK');
