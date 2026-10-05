// Entry point: load the save, build the world, run the game loop.
import './polyfills.js';
import { loadState } from './state.js';
import { Game } from './game.js';
import { BotManager } from './bots.js';
import { Scene } from './render/scene.js';
import { UI } from './ui/ui.js';
import { audio } from './audio.js';

async function boot() {
  const { state, fresh } = loadState();
  const game = new Game(state);
  game.bots = new BotManager(game, state.bots);
  const away = game.catchUp();

  try { await Promise.race([document.fonts.load('600 16px Fredoka'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fonts optional */ }

  const scene = new Scene(document.getElementById('world'), game);
  if (state.settings.quality === 'low') scene.setQuality('low');
  const ui = new UI(game, scene, audio);
  audio.setVolume(state.settings.sfx);
  audio.setAmbient(state.settings.ambient);
  if (!state.settings.motion) document.documentElement.classList.add('reduce-motion');
  window.__pan = { game, scene, ui };

  const online = game.bots.globalOnline();
  game.pushChat({ kind: 'system', text: `Joined Server ${game.bots.serverId} (${game.bots.region}) · ${game.bots.active.length + 1} players here · ${online.players.toLocaleString()} online`, color: '#9fa8da' });

  let last = performance.now();
  let errors = 0;
  function loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      game.update(dt);
      game.bots.update(dt);
      scene.render(dt);
      ui.frame(dt);
      audio.tickAmbient(dt, game.isNight(), game.shore.theme.cave ? 'cave' : game.shore.theme.water.type);
    } catch (e) {
      if (errors++ < 5) console.error(e);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  const loading = document.getElementById('loading');
  loading.classList.add('hide');
  setTimeout(() => loading.remove(), 600);

  // first-run / returning dialogs
  setTimeout(() => {
    if (fresh) ui.openSheet('welcome');
    else if (away.gained > 0 && away.away > 120) ui.openSheet('welcomeBack', { params: away });
    else if (game.loginAvailable()) ui.openSheet('login');
  }, 500);

  const persist = () => { if (!game.resetting) game.save(); };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { persist(); audio.suspend(); } else { audio.resume(); last = performance.now(); }
  });
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);

  // iOS: block pinch-zoom / double-tap zoom gestures on the game surface
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || !e.target.closest('.sheet-body, .tabs, #chips')) e.preventDefault();
  }, { passive: false });

  registerServiceWorker(ui);
}

function registerServiceWorker(ui) {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          ui.toast('A new version of Pan! is ready — reopen the app to update.', 'info');
        }
      });
    });
  }).catch(() => { /* offline support is optional */ });
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('.tagline').textContent = 'Something went wrong loading the game. Please reload.';
});
