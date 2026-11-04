'use strict';
// Synthesized sound effects and a small procedural music sequencer (no audio files needed).

const Audio2 = (() => {
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let sfxVol = 0.8, musVol = 0.45, music = null, unlocked = false;
  const lastPlay = {};

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.gain.value = musVol * 0.5; musBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); unlocked = true; if (pendingMusic) { const m = pendingMusic; pendingMusic = null; playMusic(m); } }

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f0, f1, dur, vol, t = 0, bus = sfxBus) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, now); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    env(g, now, 0.005, vol, dur); o.connect(g); g.connect(bus); o.start(now); o.stop(now + dur + 0.05);
  }
  function noise(dur, vol, fType, f0, f1, t = 0, q = 1) {
    const now = ctx.currentTime + t;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = fType; f.Q.value = q; f.frequency.setValueAtTime(f0, now); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
    const g = ctx.createGain(); env(g, now, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(now, Math.random() * 0.5); s.stop(now + dur + 0.05);
  }

  const SFX = {
    deploy: v => { tone('sine', 300, 700, 0.12, 0.25 * v); noise(0.1, 0.15 * v, 'highpass', 3000, 6000); },
    land: v => noise(0.15, 0.3 * v, 'lowpass', 600, 150),
    hit: v => noise(0.06, 0.3 * v, 'bandpass', 2500, 1200, 0, 2),
    slash: v => { noise(0.09, 0.35 * v, 'bandpass', 3500, 1500, 0, 1.5); tone('triangle', 900, 400, 0.06, 0.08 * v); },
    thud: v => { tone('sine', 140, 50, 0.18, 0.5 * v); noise(0.12, 0.25 * v, 'lowpass', 900, 200); },
    zap: v => { tone('sawtooth', 1400, 300, 0.12, 0.12 * v); noise(0.1, 0.18 * v, 'highpass', 4000, 2000); },
    poof: v => noise(0.18, 0.2 * v, 'bandpass', 1200, 400, 0, 0.8),
    crumble: v => { noise(0.5, 0.4 * v, 'lowpass', 800, 100); tone('sine', 90, 40, 0.4, 0.3 * v); },
    towerdown: v => { noise(1.2, 0.7 * v, 'lowpass', 1200, 60); tone('sine', 80, 30, 1, 0.6 * v); tone('square', 220, 110, 0.5, 0.08 * v, 0.1); },
    horn: v => { [0, 0.18].forEach((t, i) => { tone('sawtooth', i ? 392 : 294, i ? 392 : 294, 0.35, 0.12 * v, t); tone('square', i ? 196 : 147, i ? 196 : 147, 0.35, 0.05 * v, t); }); },
    ability: v => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.18, 0.15 * v, i * 0.05)); },
    boom: v => { noise(0.35, 0.5 * v, 'lowpass', 1500, 120); tone('sine', 120, 40, 0.3, 0.4 * v); },
    bigboom: v => { noise(0.8, 0.8 * v, 'lowpass', 2000, 60); tone('sine', 100, 25, 0.7, 0.7 * v); },
    ice: v => { [1800, 2400, 3100].forEach((f, i) => tone('sine', f, f * 0.8, 0.25, 0.08 * v, i * 0.03)); noise(0.2, 0.15 * v, 'highpass', 5000, 3000); },
    arrows: v => { for (let i = 0; i < 6; i++) noise(0.05, 0.15 * v, 'bandpass', 3000 + Math.random() * 2000, 2000, i * 0.04, 3); },
    heal: v => { [660, 880, 1100].forEach((f, i) => tone('sine', f, f, 0.2, 0.1 * v, i * 0.06)); },
    thunder: v => { noise(0.9, 0.7 * v, 'lowpass', 3000, 80); tone('sawtooth', 200, 40, 0.5, 0.15 * v); },
    dig: v => noise(0.25, 0.3 * v, 'lowpass', 700, 200),
    charge: v => tone('sawtooth', 200, 600, 0.3, 0.08 * v),
    clang: v => { tone('square', 1200, 1100, 0.15, 0.08 * v); tone('sine', 2400, 2300, 0.2, 0.08 * v); },
    ember: v => { tone('sine', 900, 1400, 0.12, 0.15 * v); },
    crate: v => { noise(0.2, 0.35 * v, 'bandpass', 900, 400); tone('square', 300, 150, 0.1, 0.06 * v); },
    whoosh: v => noise(0.25, 0.25 * v, 'bandpass', 800, 3000, 0, 1),
    pop: v => tone('sine', 500, 1100, 0.08, 0.25 * v),
    click: v => tone('triangle', 900, 700, 0.05, 0.18 * v),
    card: v => noise(0.05, 0.18 * v, 'highpass', 3000, 5000),
    error: v => { tone('square', 200, 180, 0.12, 0.07 * v); tone('square', 150, 140, 0.15, 0.07 * v, 0.1); },
    win: v => { [523, 659, 784, 1046, 1318].forEach((f, i) => { tone('triangle', f, f, 0.3, 0.18 * v, i * 0.12); tone('sine', f / 2, f / 2, 0.3, 0.1 * v, i * 0.12); }); },
    lose: v => { [440, 392, 349, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.4, 0.15 * v, i * 0.18)); },
    chest: v => { noise(0.3, 0.3 * v, 'lowpass', 1500, 400); [392, 523, 659].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12 * v, 0.15 + i * 0.07)); },
    reveal: v => { tone('sine', 700, 1400, 0.18, 0.18 * v); noise(0.15, 0.1 * v, 'highpass', 4000, 6000); },
    epic: v => { [523, 784, 1046, 1568].forEach((f, i) => tone('sawtooth', f, f, 0.35, 0.06 * v, i * 0.08)); [262, 392].forEach(f => tone('sine', f, f, 0.8, 0.15 * v)); },
    upgrade: v => { [392, 494, 587, 784, 988].forEach((f, i) => tone('triangle', f, f, 0.2, 0.15 * v, i * 0.07)); },
    coin: v => { tone('square', 1200, 1200, 0.05, 0.06 * v); tone('square', 1600, 1600, 0.1, 0.06 * v, 0.05); },
    tick: v => tone('sine', 1000, 1000, 0.04, 0.15 * v),
  };

  function play(name, v = 1) {
    if (!ctx || !unlocked || sfxVol <= 0) return;
    const now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < 45) return;
    lastPlay[name] = now;
    const fn = SFX[name]; if (fn) try { fn(v); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- music
  let pendingMusic = null;
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const SONGS = {
    menu: { bpm: 104, prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], mel: [76, 74, 72, 74, 76, 79, 76, 74, 72, 69, 72, 74, 72, 71, 72, -1], lead: 'triangle' },
    battle: { bpm: 132, prog: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], mel: [74, -1, 77, 76, 74, 72, 74, -1, 69, 72, 74, 76, 77, 76, 74, 72], lead: 'square' },
    overtime: { bpm: 150, prog: [[50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52]], mel: [74, 77, 81, 77, 74, 76, 77, 79, 81, 79, 77, 76, 74, 72, 73, 74], lead: 'square' },
  };
  function playMusic(name) {
    if (!ctx || !unlocked) { pendingMusic = name; return; }
    if (music && music.name === name) return;
    stopMusic();
    const S = SONGS[name]; if (!S) return;
    const m = { name, step: 0, next: ctx.currentTime + 0.1, timer: null };
    const stepDur = 60 / S.bpm / 2;
    const schedule = () => {
      while (m.next < ctx.currentTime + 0.25) {
        const st = m.step, bar = Math.floor(st / 8) % S.prog.length, chord = S.prog[bar];
        const t = m.next - ctx.currentTime;
        if (st % 8 === 0) chord.forEach(n => tone('triangle', N(n), N(n), stepDur * 7.5, 0.035, t, musBus));
        if (st % 2 === 0) tone('sine', N(chord[0] - 12), N(chord[0] - 12), stepDur * 1.6, 0.11, t, musBus);
        if (name !== 'menu' && st % 4 === 2) { const now = ctx.currentTime + t; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); env(g, now, 0.002, 0.04, 0.05); s.connect(f); f.connect(g); g.connect(musBus); s.start(now); s.stop(now + 0.1); }
        if (name !== 'menu' && st % 8 === 0) tone('sine', 110, 40, 0.15, 0.18, t, musBus);
        const mn = S.mel[st % S.mel.length];
        if (mn > 0 && Math.floor(st / 16) % 2 === 1) tone(S.lead, N(mn), N(mn), stepDur * 0.9, S.lead === 'square' ? 0.018 : 0.04, t, musBus);
        m.step++; m.next += stepDur;
      }
    };
    m.timer = setInterval(schedule, 60); schedule();
    music = m;
  }
  function stopMusic() { if (music) { clearInterval(music.timer); music = null; } }

  function setVolumes(s, mu) {
    sfxVol = s; musVol = mu;
    if (sfxBus) sfxBus.gain.value = s;
    if (musBus) musBus.gain.value = mu * 0.5;
  }

  return { play, unlock, playMusic, stopMusic, setVolumes, init };
})();
