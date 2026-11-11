'use strict';
// Arena backgrounds, towers, buildings, projectiles, spell icons and card portraits.

const WorldArt = (() => {
  const { rr, ell, lg, rg, fs } = Art;
  const TS = 32; // art px per tile

  // ------------------------------------------------------------------ arena background
  function drawArena(c, arenaIdx, seed) {
    const A = ARENAS[arenaIdx] || ARENAS[0];
    const W = AR.W * TS, H = AR.H * TS;
    const rng = RNG(seed || 77);
    // checker grass
    for (let y = 0; y < AR.H; y++) for (let x = 0; x < AR.W; x++) {
      c.fillStyle = (x + y) % 2 ? A.grass[0] : A.grass[1];
      c.fillRect(x * TS, y * TS, TS, TS);
    }
    // soft noise blotches
    for (let i = 0; i < 260; i++) {
      const x = rng() * W, y = rng() * H, r = 4 + rng() * 14;
      c.fillStyle = rgba(rng() < 0.5 ? shade(A.grass[0], 0.12) : shade(A.grass[1], -0.1), 0.25);
      ell(c, x, y, r, r * 0.7); c.fill();
    }
    // paths: lane paths from bridges to towers
    c.save();
    c.strokeStyle = rgba(A.path, 0.55); c.lineCap = 'round'; c.lineWidth = TS * 1.6;
    for (const bx of AR.BRIDGES) {
      c.beginPath(); c.moveTo(bx * TS, 25.5 * TS); c.lineTo(bx * TS, 17 * TS); c.stroke();
      c.beginPath(); c.moveTo(bx * TS, 6.5 * TS); c.lineTo(bx * TS, 15 * TS); c.stroke();
    }
    c.lineWidth = TS * 1.2;
    c.beginPath(); c.moveTo(3.5 * TS, 26 * TS); c.quadraticCurveTo(9 * TS, 26 * TS, 9 * TS, 29 * TS); c.quadraticCurveTo(9 * TS, 26 * TS, 14.5 * TS, 26 * TS); c.stroke();
    c.beginPath(); c.moveTo(3.5 * TS, 6 * TS); c.quadraticCurveTo(9 * TS, 6 * TS, 9 * TS, 3 * TS); c.quadraticCurveTo(9 * TS, 6 * TS, 14.5 * TS, 6 * TS); c.stroke();
    c.restore();
    // tower platforms
    for (const s of TOWER_SLOTS) {
      const r = (s.kind === 'keep' ? 2.4 : 1.9) * TS;
      rr(c, s.x * TS - r, s.y * TS - r, r * 2, r * 2, 8);
      c.fillStyle = rgba(shade(A.path, -0.2), 0.8); c.fill();
      rr(c, s.x * TS - r + 4, s.y * TS - r + 4, r * 2 - 8, r * 2 - 8, 6);
      c.fillStyle = rgba(A.path, 0.9); c.fill();
      c.strokeStyle = rgba('#000000', 0.12); c.lineWidth = 2; c.stroke();
    }
    // river
    const ry0 = AR.RY0 * TS, ry1 = AR.RY1 * TS;
    c.fillStyle = shade(A.edge, -0.15); c.fillRect(0, ry0 - 5, W, ry1 - ry0 + 10);
    const wg = lg(c, 0, ry0, 0, ry1, shade(A.water, 0.15), shade(A.water, -0.2));
    c.fillStyle = wg; c.fillRect(0, ry0, W, ry1 - ry0);
    // banks
    for (const [y, d] of [[ry0, -1], [ry1, 1]]) {
      c.fillStyle = shade(A.edge, 0.05);
      for (let x = 0; x < W; x += 12) { ell(c, x + 6, y + d * 2, 7 + rng() * 3, 4); c.fill(); }
    }
    // bridges
    for (const bx of AR.BRIDGES) {
      const x0 = (bx - AR.BHW - 0.25) * TS, w = (AR.BHW * 2 + 0.5) * TS;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 + 4, ry0 - 6, w, ry1 - ry0 + 16);
      rr(c, x0, ry0 - 10, w, ry1 - ry0 + 20, 4); fs(c, lg(c, x0, 0, x0 + w, 0, '#b88a56', '#8a6038'), 2, '#4a3020');
      for (let y = ry0 - 6; y < ry1 + 8; y += 8) { c.beginPath(); c.moveTo(x0 + 2, y); c.lineTo(x0 + w - 2, y); c.strokeStyle = 'rgba(60,35,20,0.45)'; c.lineWidth = 1.5; c.stroke(); }
      for (const sx of [x0 - 1, x0 + w - 5]) { rr(c, sx, ry0 - 12, 6, ry1 - ry0 + 24, 3); fs(c, '#6e4a2c', 1.5, '#3a2414'); }
    }
    // edge decorations
    for (let i = 0; i < 26; i++) {
      const side = i % 2, y = 1 + rng() * (AR.H - 2);
      if (y > AR.RY0 - 1 && y < AR.RY1 + 1) continue;
      const x = side ? W - 6 - rng() * 10 : 6 + rng() * 10;
      drawDeco(c, A, x, y * TS, rng);
    }
    // vignette
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.18)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }

  function drawDeco(c, A, x, y, rng) {
    const s = 0.7 + rng() * 0.5;
    c.save(); c.translate(x, y); c.scale(s, s);
    ell(c, 0, 2, 10, 4); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill();
    switch (A.deco) {
      case 'tree': case 'palm':
        rr(c, -2, -8, 4, 10, 1.5); fs(c, '#6b4428', 1);
        ell(c, 0, -14, 10, 9); fs(c, rg(c, 0, -14, 10, A.deco === 'palm' ? '#6ae0a0' : '#8fd46a', A.deco === 'palm' ? '#1f8a5a' : '#3f8a34'), 1.2); break;
      case 'pine': case 'snowpine':
        rr(c, -2, -6, 4, 8, 1.5); fs(c, '#5a3a22', 1);
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-10 + i * 2, -4 - i * 7); c.lineTo(0, -16 - i * 7); c.lineTo(10 - i * 2, -4 - i * 7); c.closePath(); fs(c, A.deco === 'snowpine' ? (i === 2 ? '#ffffff' : '#4f8a6a') : '#2f7a3a', 1.1); }
        break;
      case 'cactus':
        rr(c, -3, -18, 6, 20, 3); fs(c, '#4a9a4a', 1.1); rr(c, 3, -12, 6, 3, 1.5); fs(c, '#4a9a4a', 1); rr(c, 6, -16, 3, 6, 1.5); fs(c, '#4a9a4a', 1); break;
      case 'grave':
        rr(c, -6, -14, 12, 16, 5); fs(c, '#8a8a92', 1.2); c.beginPath(); c.moveTo(0, -11); c.lineTo(0, -3); c.moveTo(-3, -8); c.lineTo(3, -8); c.strokeStyle = '#4a4a52'; c.lineWidth = 1.4; c.stroke(); break;
      case 'rock': case 'spire':
        c.beginPath(); c.moveTo(-9, 2); c.lineTo(-6, -10); c.lineTo(1, -16); c.lineTo(8, -8); c.lineTo(9, 2); c.closePath(); fs(c, lg(c, 0, -16, 0, 2, '#8a7a72', '#3a302c'), 1.2);
        if (A.lava) { c.beginPath(); c.moveTo(-3, -8); c.lineTo(0, -2); c.lineTo(3, -9); c.strokeStyle = '#ff7a2a'; c.lineWidth = 1.4; c.stroke(); }
        break;
      case 'gear':
        c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 9 : 11; c.lineTo(Math.cos(a) * r, -8 + Math.sin(a) * r); } c.closePath(); fs(c, '#c08a3a', 1.2);
        ell(c, 0, -8, 3.5, 3.5); fs(c, '#5a4630', 1); break;
      case 'cloud':
        for (const [dx, dy, r] of [[-6, -6, 6], [0, -10, 8], [7, -6, 6]]) { ell(c, dx, dy, r, r * 0.8); fs(c, '#ffffff', 0); }
        break;
      case 'crystal':
        for (const [dx, h, col] of [[-4, 14, '#ff7ae0'], [2, 20, '#58e0ff'], [7, 11, '#b8a8ff']]) { c.beginPath(); c.moveTo(dx - 3, 2); c.lineTo(dx, -h); c.lineTo(dx + 3, 2); c.closePath(); fs(c, lg(c, dx, -h, dx, 2, '#ffffff', col), 1); }
        break;
    }
    c.restore();
  }

  function drawWater(c, A, t) {
    // animated shimmer over the river (drawn each frame, cheap)
    const ry0 = AR.RY0 * TS, ry1 = AR.RY1 * TS, W = AR.W * TS;
    c.save();
    c.globalAlpha = A.lava ? 0.5 : 0.35;
    c.strokeStyle = A.lava ? '#ffd27a' : '#ffffff'; c.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const y = ry0 + 8 + (i % 3) * 18, off = (t * 22 + i * 61) % (W + 60) - 30;
      c.beginPath(); c.moveTo(off, y); c.quadraticCurveTo(off + 10, y - 3, off + 20, y); c.stroke();
    }
    c.restore();
  }

  // ------------------------------------------------------------------ towers
  function skinStyle(key, T) {
    const s = TOWER_SKINS[key] || TOWER_SKINS.stone;
    return Object.assign({}, s, { roof: s.roof === 'T' ? T.main : s.roof });
  }

  function bricks(c, x, y, w, h, colA, colB, style) {
    c.save(); rr(c, x, y, w, h, 4); c.clip();
    c.fillStyle = lg(c, x, y, x + w, y + h, colA, colB); c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1;
    if (style === 'wood') {
      for (let xx = x + 8; xx < x + w; xx += 9) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); }
    } else if (style === 'ice' || style === 'crystal') {
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + (i * 13) % w, y); c.lineTo(x + ((i * 13) % w) + 8, y + h); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke(); }
    } else {
      for (let yy = y + 7, row = 0; yy < y + h; yy += 7, row++) {
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke();
        for (let xx = x + (row % 2 ? 5 : 10); xx < x + w; xx += 11) { c.beginPath(); c.moveTo(xx, yy - 7); c.lineTo(xx, yy); c.stroke(); }
      }
      if (style === 'magma') { c.strokeStyle = 'rgba(255,120,40,0.8)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + w * 0.3, y); c.lineTo(x + w * 0.4, y + h * 0.5); c.lineTo(x + w * 0.25, y + h); c.stroke(); }
      if (style === 'brass') { c.fillStyle = '#5a4630'; for (let xx = x + 5; xx < x + w; xx += 10) { ell(c, xx, y + 4, 1.3, 1.3); c.fill(); ell(c, xx, y + h - 4, 1.3, 1.3); c.fill(); } }
    }
    c.restore();
    rr(c, x, y, w, h, 4); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
  }

  function crenels(c, x, y, w, S) {
    const n = Math.max(3, Math.round(w / 12));
    const cw = w / (n * 2 - 1);
    for (let i = 0; i < n; i++) { rr(c, x + i * cw * 2, y - 6, cw, 8, 1.5); fs(c, S.top, 1.2); }
  }

  function drawSideTower(c, tw, T, t, view, part) {
    const S = skinStyle(tw.skin, T);
    const w = 70, h = 52;
    c.save();
    if (part !== 'top') {
    // shadow
    ell(c, 0, 4, 48, 18); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    // base
    bricks(c, -w / 2, -h, w, h, S.wall, S.wall2, S.style);
    // gate
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(-9, -14); c.arc(0, -14, 9, Math.PI, 0); c.lineTo(9, 0); c.closePath(); fs(c, '#3a2a1e', 1.4);
    c.beginPath(); for (let i = -6; i <= 6; i += 4) { c.moveTo(i, -20); c.lineTo(i, 0); } c.strokeStyle = '#6b6b70'; c.lineWidth = 1.2; c.stroke();
    // top platform
    rr(c, -w / 2 - 5, -h - 10, w + 10, 12, 3); fs(c, lg(c, 0, -h - 10, 0, -h + 2, S.top, S.wall2), 1.5);
    if (S.style === 'pagoda') {
      c.beginPath(); c.moveTo(-w / 2 - 12, -h - 2); c.quadraticCurveTo(0, -h - 14, w / 2 + 12, -h - 2); c.lineTo(w / 2 + 4, -h - 8); c.quadraticCurveTo(0, -h - 18, -w / 2 - 4, -h - 8); c.closePath(); fs(c, S.roof, 1.4);
    } else crenels(c, -w / 2 - 5, -h - 10, w + 10, S);
    if (S.style === 'crystal') { for (const [dx, hh] of [[-w / 2, 18], [w / 2 - 4, 14]]) { c.beginPath(); c.moveTo(dx - 3, -h - 4); c.lineTo(dx + 2, -h - 4 - hh); c.lineTo(dx + 7, -h - 4); c.closePath(); fs(c, lg(c, 0, -h - 20, 0, -h, '#ffffff', '#ff7ae0'), 1); } }
    }
    if (part === 'base') { c.restore(); return; }
    // banner
    c.save(); c.translate(w / 2 - 2, -h - 14);
    rr(c, -1.2, -26, 2.4, 28, 1); fs(c, '#5a3a22', 1);
    const wave = Math.sin(t * 3 + tw.x) * 2;
    c.beginPath(); c.moveTo(1, -25); c.quadraticCurveTo(10, -25 + wave, 16, -22); c.lineTo(16, -12); c.quadraticCurveTo(10, -14 + wave, 1, -14); c.closePath(); fs(c, T.main, 1.1);
    c.restore();
    // defender
    c.translate(0, -h - 8);
    drawDefender(c, tw, T, t, view);
    c.restore();
  }

  function drawDefender(c, tw, T, t, view) {
    const atk = Math.min(1, tw.atkT / 0.35);
    const back = view.back;
    const D = tw.defender;
    const P = Art.pose(T, { t, atk, back, seed: tw.id });
    if (D === 'bow_sisters') {
      for (const s of [-1, 1]) { c.save(); c.translate(s * 13, 0); Art.humanoid(c, { head: 'hair', hair: s < 0 ? '#c0602a' : '#e8c86a', pony: true, weapon: 'bow', body: 'T', ranged: true, wAngle: -0.05, size: 0.78, seed: s + tw.id }, Object.assign({}, P, { atk: s < 0 ? atk : Math.min(1, atk + 0.4) })); c.restore(); }
    } else if (D === 'powder_gunner') {
      Art.humanoid(c, { head: 'feather', beard: '#5a3a22', weapon: 'crossbow', body: 'T', armor: '#6a707c', ranged: true, wAngle: -0.6, size: 0.95, bulk: 1.15, seed: tw.id }, P);
    } else if (D === 'blade_juggler') {
      Art.humanoid(c, { head: 'cowl', weapon: 'dagger', off: 'dagger', body: '#3a3448', sash: 'T', size: 0.9, seed: tw.id, wAngle: 0.8 }, P);
      // ammo pips
      const D2 = DEFENDERS.blade_juggler;
      const frac = (tw.ammo || 0) / D2.ammo;
      rr(c, -12, 8, 24, 3, 1.5); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill();
      rr(c, -12, 8, 24 * frac, 3, 1.5); c.fillStyle = '#e8e8f0'; c.fill();
    } else if (D === 'tower_chaplain') {
      Art.humanoid(c, { head: 'hood', hoodColor: '#f2ede2', hair: '#8a6a4a', weapon: 'staff', orb: '#ffe680', body: '#f2ede2', sash: 'T', robe: true, ranged: true, wAngle: 0.1, size: 0.92, seed: tw.id }, P);
    }
  }

  function drawKeep(c, tw, T, t, view, part) {
    const S = skinStyle(tw.skin, T);
    const w = 100, h = 60;
    c.save();
    if (part !== 'top') {
    ell(c, 0, 4, 66, 22); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    // corner turrets
    for (const s of [-1, 1]) {
      bricks(c, s * (w / 2) - 13, -h - 8, 26, h + 8, S.wall, S.wall2, S.style);
      if (S.style === 'pagoda') { c.beginPath(); c.moveTo(s * w / 2 - 18, -h - 8); c.quadraticCurveTo(s * w / 2, -h - 22, s * w / 2 + 18, -h - 8); c.closePath(); fs(c, S.roof, 1.3); }
      else { c.beginPath(); c.moveTo(s * w / 2 - 16, -h - 8); c.lineTo(s * w / 2, -h - 34); c.lineTo(s * w / 2 + 16, -h - 8); c.closePath(); fs(c, lg(c, 0, -h - 34, 0, -h - 8, shade(S.roof, 0.2), shade(S.roof, -0.25)), 1.4); }
    }
    bricks(c, -w / 2 + 8, -h, w - 16, h, S.wall, S.wall2, S.style);
    // gate
    c.beginPath(); c.moveTo(-13, 0); c.lineTo(-13, -18); c.arc(0, -18, 13, Math.PI, 0); c.lineTo(13, 0); c.closePath(); fs(c, '#3a2a1e', 1.5);
    c.beginPath(); for (let i = -9; i <= 9; i += 4.5) { c.moveTo(i, -27); c.lineTo(i, 0); } c.strokeStyle = '#6b6b70'; c.lineWidth = 1.4; c.stroke();
    // emblem
    ell(c, 0, -h + 16, 9, 9); fs(c, rg(c, 0, -h + 16, 9, T.light, T.dark), 1.4);
    c.beginPath(); c.moveTo(-5, -h + 18); c.lineTo(-5, -h + 12); c.lineTo(-2.5, -h + 15); c.lineTo(0, -h + 10); c.lineTo(2.5, -h + 15); c.lineTo(5, -h + 12); c.lineTo(5, -h + 18); c.closePath(); fs(c, '#ffd84a', 1);
    // top deck
    rr(c, -w / 2 + 4, -h - 10, w - 8, 12, 3); fs(c, lg(c, 0, -h - 10, 0, -h + 2, S.top, S.wall2), 1.5);
    crenels(c, -w / 2 + 4, -h - 10, w - 8, S);
    }
    if (part === 'base') { c.restore(); return; }
    // keeper with cannon
    c.translate(0, -h - 6);
    const active = tw.active;
    const ang = Math.atan2(view.dy, view.dx);
    // cannon
    c.save(); c.rotate(active ? ang + Math.PI / 2 : 0);
    const rec = tw.atkT < 0.2 ? (1 - tw.atkT / 0.2) * 4 : 0;
    rr(c, -5, -22 + rec, 10, 22, 4); fs(c, lg(c, -5, 0, 5, 0, '#6a707c', '#2a2e36'), 1.4);
    ell(c, 0, -22 + rec, 5.5, 2.6); fs(c, '#1a1c22', 1);
    c.restore();
    ell(c, 0, 2, 9, 6); fs(c, '#5a3a22', 1.3);
    // keeper (sleeps while inactive)
    c.save(); c.translate(-16, 6);
    Art.humanoid(c, { head: 'crown', beard: '#e8e0d0', body: 'T', cape: 'T', weapon: null, size: 0.82, bulk: 1.15, seed: tw.id, noBlush: false }, Art.pose(T, { t, back: view.back }));
    c.restore();
    if (!active) {
      c.font = 'bold 14px "Lilita One", sans-serif'; c.fillStyle = '#ffffff'; c.strokeStyle = OUT; c.lineWidth = 3;
      const zz = (t * 0.8) % 1;
      c.globalAlpha = 1 - zz; c.strokeText('z', -6 + zz * 8, -30 - zz * 16); c.fillText('z', -6 + zz * 8, -30 - zz * 16); c.globalAlpha = 1;
    }
    c.restore();
  }

  function drawRubble(c, tw, T, big) {
    const s = big ? 1.4 : 1;
    c.save(); c.scale(s, s);
    ell(c, 0, 2, 40, 14); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    const rng = RNG(tw.id * 13);
    for (let i = 0; i < 14; i++) {
      const x = (rng() - 0.5) * 60, y = -rng() * 18, r = 5 + rng() * 7;
      c.beginPath(); c.moveTo(x - r, y + 3); c.lineTo(x - r * 0.4, y - r); c.lineTo(x + r * 0.7, y - r * 0.6); c.lineTo(x + r, y + 3); c.closePath();
      fs(c, rng() < 0.5 ? '#9a9286' : '#7a7266', 1.1);
    }
    rr(c, 14, -30, 2.4, 30, 1); fs(c, '#5a3a22', 1);
    c.beginPath(); c.moveTo(16, -29); c.lineTo(28, -24); c.lineTo(16, -20); c.closePath(); fs(c, shade(T.main, -0.3), 1);
    c.restore();
  }

  // ------------------------------------------------------------------ buildings
  function drawBuilding(c, e, T, t, view) {
    const atk = Math.min(1, e.atkT / 0.3);
    const ang = Math.atan2(view.dy, view.dx);
    const k = e.kind;
    c.save();
    ell(c, 0, 3, 30, 12); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    if (k === 'bolt_thrower' || k === 'siege_ballista') {
      const big = k === 'siege_ballista';
      rr(c, -22, -16, 44, 18, 5); fs(c, lg(c, 0, -16, 0, 2, '#9a7a52', '#5a4228'), 1.5);
      if (big) { for (const s of [-1, 1]) { ell(c, s * 16, -2, 6, 6); fs(c, '#4a3020', 1.2); } }
      c.translate(0, -18);
      c.save(); c.rotate(ang + Math.PI / 2);
      const L = big ? 34 : 26;
      rr(c, -3.5, -L, 7, L + 6, 2); fs(c, '#7a5232', 1.3);
      c.beginPath(); c.moveTo(-L * 0.6, -L * 0.55); c.quadraticCurveTo(0, -L * 0.95, L * 0.6, -L * 0.55); c.strokeStyle = '#4a505a'; c.lineWidth = big ? 4 : 3; c.stroke();
      if (atk > 0.5) { rr(c, -1.2, -L - 4, 2.4, L, 1); fs(c, '#d8dde3', 0.8); }
      c.restore();
      ell(c, 0, 0, 7, 7); fs(c, rg(c, 0, 0, 7, T.light, T.dark), 1.2);
    } else if (k === 'lob_kiln') {
      c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(-24, -26, 0, -32); c.quadraticCurveTo(24, -26, 22, 0); c.closePath(); fs(c, lg(c, -20, -30, 20, 0, '#c87a4a', '#7a3a1e'), 1.6);
      ell(c, 0, -30, 10, 4); fs(c, '#3a1a10', 1.3);
      c.save(); c.globalCompositeOperation = 'lighter'; ell(c, 0, -30, 8, 3); c.fillStyle = `rgba(255,${120 + Math.sin(t * 5) * 40 | 0},40,0.8)`; c.fill(); c.restore();
      rr(c, -8, -10, 16, 8, 3); fs(c, '#2a1a10', 1.2);
      rr(c, -18, -18, 36, 3, 1.5); fs(c, T.main, 0.9);
    } else if (k === 'crypt') {
      rr(c, -20, -30, 40, 32, 4); fs(c, lg(c, 0, -30, 0, 2, '#8a8a96', '#4a4a56'), 1.5);
      c.beginPath(); c.moveTo(-24, -28); c.lineTo(0, -44); c.lineTo(24, -28); c.closePath(); fs(c, '#5a5a66', 1.4);
      c.beginPath(); c.moveTo(-8, 0); c.lineTo(-8, -14); c.arc(0, -14, 8, Math.PI, 0); c.lineTo(8, 0); c.closePath(); fs(c, '#1a1620', 1.3);
      c.save(); c.globalCompositeOperation = 'lighter'; for (const s of [-1, 1]) { ell(c, s * 3, -12, 1.5, 1.2); c.fillStyle = '#9affc0'; c.fill(); } c.restore();
      rr(c, -3, -40, 6, 5, 1); fs(c, T.main, 1);
    } else if (k === 'ember_forge') {
      rr(c, -20, -24, 40, 26, 6); fs(c, lg(c, 0, -24, 0, 2, '#7a6a62', '#3a302c'), 1.5);
      rr(c, -6, -44, 12, 22, 2); fs(c, '#5a4a44', 1.3);
      c.save(); c.globalCompositeOperation = 'lighter';
      ell(c, 0, -14, 10, 7); c.fillStyle = `rgba(255,${140 + Math.sin(t * 7) * 50 | 0},40,0.85)`; c.fill();
      for (let i = 0; i < 3; i++) { const p = (t * 0.6 + i / 3) % 1; ell(c, Math.sin(i * 4 + t) * 3, -46 - p * 14, 3 - p * 2, 3 - p * 2); c.fillStyle = `rgba(255,170,60,${1 - p})`; c.fill(); }
      c.restore();
      rr(c, -20, -4, 40, 3, 1.5); fs(c, T.main, 0.9);
    } else if (k === 'imp_burrow') {
      c.beginPath(); c.moveTo(-24, 2); c.quadraticCurveTo(-20, -30, 0, -32); c.quadraticCurveTo(20, -30, 24, 2); c.closePath(); fs(c, lg(c, 0, -32, 0, 2, '#9a7a4a', '#5a4228'), 1.6);
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-20 + i * 10, -18 - (i % 2) * 6); c.lineTo(-14 + i * 10, -30 + (i % 2) * 4); c.strokeStyle = '#c8b070'; c.lineWidth = 2; c.stroke(); }
      ell(c, 0, -6, 9, 8); fs(c, '#1e1610', 1.3);
      c.save(); c.globalCompositeOperation = 'lighter'; for (const s of [-1, 1]) { ell(c, s * 3, -7, 1.5, 1.2); c.fillStyle = '#ffe36a'; c.fill(); } c.restore();
      c.beginPath(); c.moveTo(0, -32); c.lineTo(0, -48); c.strokeStyle = '#5a3a22'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(0, -48); c.lineTo(12, -44); c.lineTo(0, -40); c.closePath(); fs(c, T.main, 1);
    } else if (k === 'searing_beacon') {
      c.beginPath(); c.moveTo(-18, 0); c.lineTo(-10, -40); c.lineTo(10, -40); c.lineTo(18, 0); c.closePath(); fs(c, lg(c, -16, 0, 16, 0, '#6a5a72', '#2e2636'), 1.6);
      rr(c, -14, -44, 28, 6, 2); fs(c, T.main, 1.2);
      const stage = e.rampT < 2 ? 0 : e.rampT < 4 ? 1 : 2;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, -52, 0, 0, -52, 14 + stage * 4); g.addColorStop(0, 'rgba(255,220,120,0.95)'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; ell(c, 0, -52, 18 + stage * 4, 18 + stage * 4); c.fill();
      c.restore();
      c.beginPath(); c.moveTo(-6, -46); c.lineTo(0, -60); c.lineTo(6, -46); c.closePath(); fs(c, lg(c, 0, -60, 0, -46, '#fff2c0', '#ff7a2a'), 1.1);
    } else if (k === 'storm_pylon') {
      const rise = e.hiddenState === 1 ? 0 : e.hiddenState === 2 ? 1 - Math.max(0, e.riseT) / 0.5 : 1;
      ell(c, 0, 0, 22, 9); fs(c, '#4a3a2a', 1.4);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; ell(c, Math.cos(a) * 20, Math.sin(a) * 8, 4, 2.5); fs(c, '#6a5a48', 0.8); }
      if (rise > 0) {
        c.save(); c.beginPath(); c.rect(-30, -80, 60, 80); c.clip();
        c.translate(0, (1 - rise) * 50);
        rr(c, -7, -44, 14, 44, 3); fs(c, lg(c, -7, 0, 7, 0, '#c9ced6', '#5a6370'), 1.4);
        for (let i = 0; i < 5; i++) { rr(c, -10, -40 + i * 8, 20, 3, 1.5); fs(c, '#c08a3a', 0.9); }
        ell(c, 0, -48, 7, 7); fs(c, rg(c, 0, -48, 7, '#ffffff', '#6aa8ff'), 1.2);
        rr(c, -7, -6, 14, 3, 1); fs(c, T.main, 0.8);
        c.restore();
      }
    } else if (k === 'ember_well') {
      ell(c, 0, -8, 20, 10); fs(c, lg(c, 0, -18, 0, 2, '#a8a094', '#5e584e'), 1.5);
      ell(c, 0, -12, 14, 6); fs(c, '#2a1e18', 1.2);
      c.save(); c.globalCompositeOperation = 'lighter'; ell(c, 0, -12, 12, 5); c.fillStyle = `rgba(255,${110 + Math.sin(t * 3) * 30 | 0},60,0.8)`; c.fill(); c.restore();
      for (const s of [-1, 1]) { rr(c, s * 16 - 2, -40, 4, 30, 1.5); fs(c, '#6b4428', 1.2); }
      rr(c, -20, -42, 40, 5, 2); fs(c, '#7a5232', 1.2);
      const bob = Math.sin(t * 2) * 4;
      c.beginPath(); c.moveTo(0, -38); c.lineTo(0, -26 + bob); c.strokeStyle = '#8a8a8a'; c.lineWidth = 1; c.stroke();
      ell(c, 0, -22 + bob, 5, 4.5); fs(c, rg(c, 0, -22 + bob, 5, '#ffb0ff', '#c23ac2'), 1.1);
      rr(c, -20, -44, 40, 2.5, 1); fs(c, T.main, 0.8);
      const pr = 1 - (e.genT || 0) / (e.def.generate || 8.5);
      rr(c, -14, 6, 28, 3.5, 1.5); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill();
      rr(c, -14, 6, 28 * pr, 3.5, 1.5); c.fillStyle = '#e84ae8'; c.fill();
    }
    c.restore();
  }

  // ------------------------------------------------------------------ projectiles
  function drawProj(c, pr, T, ang, t) {
    const k = pr.k;
    c.save(); c.rotate(ang);
    switch (k) {
      case 'arrow': case 'bolt':
        rr(c, -9, -0.8, 16, 1.6, 0.8); fs(c, '#8a6038', 0.6);
        c.beginPath(); c.moveTo(10, 0); c.lineTo(6, -2.4); c.lineTo(6, 2.4); c.closePath(); fs(c, '#dfe5ec', 0.6);
        c.beginPath(); c.moveTo(-9, 0); c.lineTo(-12, -2.6); c.lineTo(-7, 0); c.lineTo(-12, 2.6); c.closePath(); fs(c, T.main, 0.4); break;
      case 'spear': rr(c, -10, -0.8, 18, 1.6, 0.8); fs(c, '#8a6038', 0.6); c.beginPath(); c.moveTo(12, 0); c.lineTo(7, -2.6); c.lineTo(7, 2.6); c.closePath(); fs(c, '#dfe5ec', 0.6); break;
      case 'knife': c.beginPath(); c.moveTo(7, 0); c.lineTo(-2, -2); c.lineTo(-2, 2); c.closePath(); fs(c, '#eef2f7', 0.6); rr(c, -6, -1, 4, 2, 0.6); fs(c, '#4a3a2a', 0.4); break;
      case 'stone': case 'pebble': ell(c, 0, 0, 3, 3); fs(c, rg(c, 0, 0, 3, '#b8b8b8', '#5a5a5a'), 0.8); break;
      case 'cannonball': case 'bomb': ell(c, 0, 0, 5, 5); fs(c, rg(c, 0, 0, 5, '#6a6a7a', '#15151c'), 1); break;
      case 'kilnshot': ell(c, 0, 0, 7, 7); fs(c, rg(c, 0, 0, 7, '#ffd27a', '#c84a1a'), 1.2); break;
      case 'fireball': case 'flame': case 'ember': {
        c.globalCompositeOperation = 'lighter';
        const r = k === 'flame' ? 6 : k === 'ember' ? 4 : 7;
        for (let i = 0; i < 4; i++) { ell(c, -i * r * 0.6, 0, r * (1 - i * 0.2), r * (1 - i * 0.25)); c.fillStyle = `rgba(255,${150 - i * 30},40,${0.8 - i * 0.18})`; c.fill(); }
        ell(c, 0, 0, r * 0.45, r * 0.45); c.fillStyle = 'rgba(255,250,200,0.95)'; c.fill(); break;
      }
      case 'wisp': case 'holy': case 'hex': case 'frost': {
        c.globalCompositeOperation = 'lighter';
        const cc = k === 'wisp' ? T.glow : k === 'holy' ? '#ffe680' : k === 'hex' ? '#9aff5a' : '#9ae6ff';
        ell(c, 0, 0, 8, 8); c.fillStyle = rgba(cc, 0.35); c.fill(); ell(c, 0, 0, 4, 4); c.fillStyle = rgba('#ffffff', 0.9); c.fill();
        if (k === 'frost') { for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); c.fillRect(0, -0.6, 7, 1.2); } }
        break;
      }
      case 'volley': {
        for (let i = 0; i < 9; i++) { c.save(); c.translate((i % 3 - 1) * 9, (Math.floor(i / 3) - 1) * 7); rr(c, -7, -0.6, 12, 1.2, 0.6); fs(c, '#8a6038', 0); c.beginPath(); c.moveTo(7, 0); c.lineTo(4, -1.8); c.lineTo(4, 1.8); c.closePath(); c.fillStyle = '#ffb24a'; c.fill(); c.restore(); }
        break;
      }
      case 'thunder': c.globalCompositeOperation = 'lighter'; ell(c, 0, 0, 14, 6); c.fillStyle = 'rgba(140,190,255,0.6)'; c.fill(); ell(c, 0, 0, 7, 3.5); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill(); break;
      case 'meteor': {
        c.globalCompositeOperation = 'source-over';
        c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { ell(c, -i * 7, 0, 11 - i * 1.6, 9 - i * 1.4); c.fillStyle = `rgba(255,${160 - i * 25},40,${0.7 - i * 0.12})`; c.fill(); } c.restore();
        ell(c, 0, 0, 9, 9); fs(c, rg(c, 0, 0, 9, '#8a6a5a', '#3a2620'), 1.2); break;
      }
      case 'shell': rr(c, -12, -6, 22, 12, 6); fs(c, lg(c, 0, -6, 0, 6, '#9aa3ae', '#3a3f48'), 1.3); c.beginPath(); c.moveTo(-12, -6); c.lineTo(-18, -9); c.lineTo(-18, 9); c.lineTo(-12, 6); c.closePath(); fs(c, T.main, 1); break;
      case 'snowball': ell(c, 0, 0, 9, 9); fs(c, rg(c, 0, 0, 9, '#ffffff', '#b8dcf0'), 1.2); break;
      case 'crate': c.rotate(t * 8); rr(c, -9, -9, 18, 18, 2); fs(c, lg(c, -9, -9, 9, 9, '#c89a5a', '#7a5232'), 1.3); c.beginPath(); c.moveTo(-9, -9); c.lineTo(9, 9); c.moveTo(9, -9); c.lineTo(-9, 9); c.strokeStyle = '#5a3a22'; c.lineWidth = 1.6; c.stroke(); break;
      case 'boulder': c.rotate(t * 10); ell(c, 0, 0, 11, 11); fs(c, rg(c, 0, 0, 11, '#b6a99a', '#5e554a'), 1.4); c.beginPath(); c.moveTo(-6, -3); c.lineTo(2, 5); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.2; c.stroke(); break;
      case 'scythe': c.rotate(t * 16); Art.WEAPONS.scythe(c, {}, T); break;
      case 'log': {
        c.rotate(-ang);
        const w = pr.w * 2 * TS;
        rr(c, -w / 2, -10, w, 20, 10); fs(c, lg(c, 0, -10, 0, 10, '#b8844a', '#5e3c1e'), 1.6);
        for (let i = 0; i < 6; i++) { const x = -w / 2 + 8 + i * (w - 16) / 5, ph = (t * 40 + i * 3) % 20 - 10; c.beginPath(); c.moveTo(x, ph); c.lineTo(x + 3, ph > 0 ? ph - 4 : ph + 4); c.strokeStyle = '#3a2414'; c.lineWidth = 1.6; c.stroke(); }
        for (const s of [-1, 1]) { ell(c, s * w / 2, 0, 5, 10); fs(c, '#d8b07a', 1.3); }
        break;
      }
      default: ell(c, 0, 0, 3, 3); fs(c, '#fff', 0.6);
    }
    c.restore();
  }

  // ------------------------------------------------------------------ spell icons (card art)
  function spellIcon(c, id, s, t = 0) {
    const T = TEAM_COLORS[0];
    c.save(); c.scale(s, s);
    switch (id) {
      case 'ember_volley': for (let i = 0; i < 7; i++) { c.save(); c.translate(-18 + i * 6, -10 + (i % 3) * 8); c.rotate(1.1); rr(c, -14, -1, 22, 2, 1); fs(c, '#8a6038', 0.8); c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -3.5); c.lineTo(5, 3.5); c.closePath(); fs(c, '#ffb24a', 0.8); c.restore(); } break;
      case 'spark': for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-6 + i * 6, -26); c.lineTo(-12 + i * 6, -4); c.lineTo(-4 + i * 6, -6); c.lineTo(-10 + i * 6, 18); c.strokeStyle = i === 1 ? '#ffffff' : '#9ad0ff'; c.lineWidth = i === 1 ? 4 : 2.5; c.stroke(); } break;
      case 'snowball': ell(c, 0, 0, 22, 22); fs(c, rg(c, 0, 0, 22, '#ffffff', '#a8d4f0'), 2); ell(c, -7, -7, 6, 4); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill(); break;
      case 'meteor': drawProj(c, { k: 'meteor' }, T, -2.2, t); c.scale(1.6, 1.6); break;
      case 'siege_shell': c.scale(1.6, 1.6); drawProj(c, { k: 'shell' }, T, -1.2, t); break;
      case 'rime': for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3); rr(c, -2.5, -26, 5, 26, 2); fs(c, lg(c, 0, -26, 0, 0, '#ffffff', '#6ac8ff'), 1.2); c.beginPath(); c.moveTo(0, -16); c.lineTo(-7, -22); c.moveTo(0, -16); c.lineTo(7, -22); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke(); c.restore(); } break;
      case 'frenzy': ell(c, 0, 0, 22, 22); fs(c, rg(c, 0, 0, 22, '#ff9aff', '#8a1a9a'), 2); c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 3; c.strokeText('»', 0, 0); c.fillText('»', 0, 0); break;
      case 'thunderstrike': ell(c, 0, -14, 24, 10); fs(c, '#4a4a6a', 1.6); for (const dx of [-10, 0, 10]) { c.beginPath(); c.moveTo(dx, -8); c.lineTo(dx - 5, 6); c.lineTo(dx + 2, 6); c.lineTo(dx - 3, 22); c.strokeStyle = '#fff6a0'; c.lineWidth = 3; c.stroke(); } break;
      case 'blight_cloud': for (const [dx, dy, r] of [[-10, 0, 12], [8, -4, 14], [0, 8, 12]]) { ell(c, dx, dy, r, r * 0.8); fs(c, rgba('#8ad04a', 0.9), 1.4); } for (let i = 0; i < 4; i++) { ell(c, -12 + i * 8, 4 + (i % 2) * 6, 2.5, 2.5); c.fillStyle = '#d8ff8a'; c.fill(); } break;
      case 'vortex': for (let i = 0; i < 5; i++) { ell(c, 0, -16 + i * 8, 20 - i * 3.5, 5); c.strokeStyle = i % 2 ? '#d8e8f0' : '#9ab8c8'; c.lineWidth = 3; c.stroke(); } break;
      case 'mirage': for (const [dx, a] of [[-8, 0.4], [8, 1]]) { c.save(); c.globalAlpha = a; c.translate(dx, 20); Art.humanoid(c, { head: 'kettle', weapon: 'sword', off: 'shield', body: 'T', seed: 1 }, Art.pose(dx < 0 ? { main: '#7ad8ff', light: '#c8f0ff', dark: '#3a8ab0', glow: '#fff' } : T, { t })); c.restore(); } break;
      case 'imp_crate': drawProj(c, { k: 'crate' }, T, 0, 0); c.save(); c.translate(0, -8); c.scale(0.6, 0.6); Art.humanoid(c, Art.ART.imp.o, Art.pose(T, { t })); c.restore(); break;
      case 'tremor': c.beginPath(); c.moveTo(-24, 6); c.lineTo(-10, 0); c.lineTo(-4, 10); c.lineTo(6, -2); c.lineTo(12, 8); c.lineTo(24, 2); c.strokeStyle = '#3a2414'; c.lineWidth = 4; c.stroke(); for (const dx of [-14, 2, 16]) { c.beginPath(); c.moveTo(dx, -6); c.lineTo(dx + 6, -18); c.lineTo(dx + 10, -4); c.closePath(); fs(c, '#9a8a72', 1.2); } break;
      case 'echo': for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 8 + i * 7, -1, 1); c.strokeStyle = rgba('#d8c8ff', 1 - i * 0.25); c.lineWidth = 3; c.stroke(); c.beginPath(); c.arc(0, 0, 8 + i * 7, Math.PI - 1, Math.PI + 1); c.stroke(); } ell(c, 0, 0, 5, 5); fs(c, '#ffffff', 1); break;
      case 'timber_roll': c.rotate(-0.3); rr(c, -24, -9, 48, 18, 9); fs(c, lg(c, 0, -9, 0, 9, '#b8844a', '#5e3c1e'), 1.6); for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-16 + i * 8, -9); c.lineTo(-13 + i * 8, -14); c.strokeStyle = '#5a5f6a'; c.lineWidth = 2; c.stroke(); } ell(c, 24, 0, 5, 9); fs(c, '#d8b07a', 1.3); break;
      case 'haunting': for (let i = 0; i < 3; i++) { c.save(); c.translate(-12 + i * 12, 16 - (i % 2) * 6); c.scale(0.55, 0.55); Art.humanoid(c, Art.ART.rattlebone.o, Art.pose(T, { t })); c.restore(); } for (let i = 0; i < 3; i++) { ell(c, -14 + i * 14, 18, 8, 3); c.fillStyle = 'rgba(60,40,30,0.6)'; c.fill(); } break;
    }
    c.restore();
  }

  // ------------------------------------------------------------------ card portraits
  const cache = new Map();
  function cardArt(cardId, w = 120, h = 150, opts = {}) {
    const key = cardId + ':' + w + 'x' + h + (opts.asc ? ':a' : '');
    if (cache.has(key)) return cache.get(key);
    const card = CARD[cardId];
    const cv = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const R = RARITY[card.rarity];
    // background
    const bgTop = card.type === 'spell' ? '#3a4a7a' : card.type === 'building' ? '#5a4a3a' : '#3f6a9a';
    rr(c, 0, 0, w, h, 10); c.fillStyle = lg(c, 0, 0, 0, h, shade(bgTop, 0.25), shade(bgTop, -0.45)); c.fill();
    c.save(); rr(c, 0, 0, w, h, 10); c.clip();
    const g = c.createRadialGradient(w / 2, h * 0.5, 5, w / 2, h * 0.5, w * 0.8); g.addColorStop(0, rgba(R.glow, 0.45)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { c.save(); c.translate(w / 2, h * 0.55); c.rotate(i / 6 * Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.04)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-12, -h); c.lineTo(12, -h); c.closePath(); c.fill(); c.restore(); }
    // art
    c.save();
    const T = TEAM_COLORS[0];
    const P = Art.pose(T, { t: 0.4, atk: 1 });
    if (card.type === 'spell') { c.translate(w / 2, h * 0.5); spellIcon(c, card.id, w / 80, 0); }
    else if (card.type === 'building') { c.translate(w / 2, h * 0.78); c.scale(w / 80, w / 80); drawBuilding(c, { kind: card.unit, atkT: 9, rampT: 5, hiddenState: 0, genT: 4, def: UNITS[card.unit], id: 1 }, T, 0.4, { dx: 0, dy: -1 }); }
    else {
      const u = UNITS[card.unit];
      const n = Math.min(card.count || 1, 3);
      const big = ['iron_colossus', 'titan_knight', 'bone_giant', 'boulder_brute', 'cinder_hound', 'zeppelin', 'magma_wyrm'].includes(card.unit);
      let sc = w / (big ? 92 : 58);
      if (u.air) sc *= 0.95;
      const baseY = h * (u.air ? (big ? 0.95 : 0.86) : 0.86);
      if (n === 1 || card.form === 'split') { c.translate(w / 2, baseY); c.scale(sc, sc); Art.drawUnit(c, card.unit, P); }
      else {
        const offs = n === 2 ? [[-16, 0], [16, 0]] : [[-20, 4], [20, 4], [0, -6]];
        const ss = sc * (n === 2 ? 0.82 : 0.72);
        offs.sort((a, b) => a[1] - b[1]).forEach(([ox, oy], i) => { c.save(); c.translate(w / 2 + ox * w / 100, baseY + oy); c.scale(ss, ss); Art.drawUnit(c, card.unit, Object.assign({}, P, { seed: i })); c.restore(); });
      }
    }
    c.restore();
    c.restore();
    // frame
    rr(c, 1.5, 1.5, w - 3, h - 3, 9); c.lineWidth = 3; c.strokeStyle = R.color; c.stroke();
    if (card.rarity === 'legendary' || card.rarity === 'hero') { rr(c, 4.5, 4.5, w - 9, h - 9, 7); c.lineWidth = 1.2; c.strokeStyle = rgba(R.glow, 0.8); c.stroke(); }
    if (opts.asc) { rr(c, 1.5, 1.5, w - 3, h - 3, 9); c.lineWidth = 4; c.strokeStyle = '#d88aff'; c.stroke(); }
    cache.set(key, cv);
    return cv;
  }

  return { drawArena, drawWater, drawSideTower, drawKeep, drawRubble, drawBuilding, drawProj, spellIcon, cardArt, TS };
})();
