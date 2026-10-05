// Procedural sound: every effect is synthesised with WebAudio so the game
// ships no audio files. iOS needs unlock() from a user gesture first.

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.ambGain = null;
    this.volume = 0.7;
    this.ambientOn = true;
    this.noiseBuf = null;
    this.shakeNode = null;
    this.ambNodes = null;
    this.birdTimer = 0;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.volume;
        this.sfxGain.connect(this.master);
        this.ambGain = this.ctx.createGain();
        this.ambGain.gain.value = this.ambientOn ? this.volume * 0.35 : 0;
        this.ambGain.connect(this.master);
        const len = this.ctx.sampleRate * 2;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02; // brown-ish
          d[i] = w * 0.5 + last * 3;
        }
        this.startAmbient();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      console.warn('audio unavailable', e);
    }
  }

  suspend() { try { this.ctx?.suspend(); } catch { /* ignore */ } }
  resume() { try { this.ctx?.resume(); } catch { /* ignore */ } }

  setVolume(v) {
    this.volume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
    if (this.ambGain) this.ambGain.gain.value = this.ambientOn ? v * 0.35 : 0;
  }
  setAmbient(on) {
    this.ambientOn = on;
    if (this.ambGain) this.ambGain.gain.value = on ? this.volume * 0.35 : 0;
  }

  get ok() { return !!this.ctx && this.ctx.state === 'running' && this.volume > 0; }

  tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, attack = 0.005, slide = 0, dest } = {}) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, at = 0, freq = 800, q = 1, type = 'lowpass', dest } = {}) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  // ── effects ─────────────────────────────────────────────────────────
  click() { this.tone(660, 0.05, { vol: 0.12, type: 'triangle' }); }
  open() { this.tone(520, 0.08, { vol: 0.12, type: 'triangle' }); this.tone(780, 0.08, { vol: 0.1, type: 'triangle', at: 0.05 }); }
  close() { this.tone(600, 0.07, { vol: 0.1, type: 'triangle', slide: 0.7 }); }
  deny() { this.tone(160, 0.18, { vol: 0.2, type: 'square', slide: 0.8 }); }

  dig(grade) {
    this.noise(0.14, { vol: 0.45, freq: 500 });
    this.tone(140, 0.12, { vol: 0.35, slide: 0.5 });
    if (grade === 'perfect') {
      this.tone(1046, 0.18, { vol: 0.16, at: 0.03 });
      this.tone(1568, 0.22, { vol: 0.12, at: 0.08 });
    } else if (grade === 'great') {
      this.tone(880, 0.14, { vol: 0.12, at: 0.03 });
    }
  }

  charge(p) {
    // subtle rising tick while holding the dig button
    if (Math.random() < 0.5) this.tone(300 + p * 500, 0.03, { vol: 0.03, type: 'triangle' });
  }

  shake(on) {
    if (!this.ok) return;
    if (on && !this.shakeNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.08);
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = 0.1;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(); lfo.start();
      this.shakeNode = { src, g, lfo };
    } else if (!on && this.shakeNode) {
      const { src, g, lfo } = this.shakeNode;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.1);
      src.stop(t + 0.12); lfo.stop(t + 0.12);
      this.shakeNode = null;
    }
  }

  glint() {
    this.tone(1760, 0.2, { vol: 0.14 });
    this.tone(2637, 0.25, { vol: 0.1, at: 0.05 });
  }

  reveal(tierIdx) {
    const base = [523, 587, 659, 784, 880, 1046, 1175, 1318];
    if (tierIdx <= 1) {
      this.tone(base[tierIdx + 2], 0.25, { vol: 0.14, type: 'triangle' });
      return;
    }
    const notes = tierIdx >= 4 ? [523, 659, 784, 1046, 1318, 1568] : [523, 659, 784, 1046].slice(0, tierIdx + 1);
    notes.forEach((f, i) => this.tone(f, 0.35, { vol: 0.14, type: 'triangle', at: i * 0.07 }));
    if (tierIdx >= 4) {
      [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.6, { vol: 0.08, at: 0.45 + i * 0.05 }));
      this.noise(0.8, { vol: 0.08, freq: 6000, type: 'highpass', at: 0.4 });
    }
  }

  sell() {
    this.tone(1318, 0.08, { vol: 0.14, type: 'square' });
    this.tone(1760, 0.18, { vol: 0.12, type: 'square', at: 0.07 });
    this.noise(0.12, { vol: 0.08, freq: 5000, type: 'highpass', at: 0.05 });
  }
  buy() {
    this.tone(659, 0.1, { vol: 0.14, type: 'triangle' });
    this.tone(988, 0.2, { vol: 0.14, type: 'triangle', at: 0.08 });
  }
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, { vol: 0.15, type: 'triangle', at: i * 0.09 }));
    this.tone(1568, 0.6, { vol: 0.1, at: 0.4 });
  }
  quest() {
    this.tone(880, 0.12, { vol: 0.13, type: 'triangle' });
    this.tone(1175, 0.25, { vol: 0.13, type: 'triangle', at: 0.1 });
  }
  event() {
    this.tone(220, 0.7, { vol: 0.12, type: 'sawtooth', attack: 0.08 });
    this.tone(277, 0.7, { vol: 0.1, type: 'sawtooth', attack: 0.08, at: 0.05 });
    this.tone(330, 0.9, { vol: 0.1, type: 'sawtooth', attack: 0.08, at: 0.1 });
  }
  enchant() {
    for (let i = 0; i < 8; i++) this.tone(600 + i * 140, 0.25, { vol: 0.07, at: i * 0.05 });
  }

  // ── ambience ────────────────────────────────────────────────────────
  startAmbient() {
    if (!this.ctx || this.ambNodes) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.value = 0.22;
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 0.15;
    lg.gain.value = 0.08;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.ambGain);
    src.start(); lfo.start();
    this.ambNodes = { src, f, g };
  }

  setScene(kind) {
    // tune the water bed per shore type
    if (!this.ambNodes) return;
    const f = { river: 900, sea: 500, lake: 400, swamp: 350, spring: 600, void: 250 }[kind] || 700;
    this.ambNodes.f.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.5);
  }

  tickAmbient(dt, night, theme) {
    if (!this.ok || !this.ambientOn) return;
    this.birdTimer -= dt;
    if (this.birdTimer > 0) return;
    this.birdTimer = 2 + Math.random() * 6;
    if (theme === 'cave' || theme === 'void') {
      this.tone(220 + Math.random() * 200, 1.2, { vol: 0.03, dest: this.ambGain, attack: 0.4 });
      return;
    }
    if (night) {
      // crickets
      for (let i = 0; i < 6; i++) this.tone(4200, 0.03, { vol: 0.015, at: i * 0.06, type: 'triangle', dest: this.ambGain });
    } else {
      const f = 2000 + Math.random() * 1500;
      this.tone(f, 0.09, { vol: 0.03, slide: 1.3, dest: this.ambGain });
      this.tone(f * 1.1, 0.07, { vol: 0.025, slide: 0.8, at: 0.12, dest: this.ambGain });
    }
  }
}

export const audio = new Audio();
