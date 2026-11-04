'use strict';
// Procedural vector art for every troop. Art space: 1 tile = 32px, feet at (0,0), up is -y.

const OUT = '#231d2c';
const TEAM_COLORS = [
  { main: '#3b7fe0', light: '#7cb6ff', dark: '#1f4c99', glow: '#9fd0ff' },
  { main: '#e0443c', light: '#ff8a7a', dark: '#93231f', glow: '#ffb3a8' },
];

const Art = (() => {
  // ------------------------------------------------------------------ primitives
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); }
  function lg(c, x0, y0, x1, y1, a, b) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function rg(c, x, y, r, a, b) { const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function fs(c, fill, lw = 1.3, stroke = OUT) { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } }
  function col(v, T) {
    if (v === 'T') return T.main; if (v === 'TL') return T.light; if (v === 'TD') return T.dark; return v;
  }
  function shaded(c, base) { return lg(c, -10, -30, 10, 0, shade(base, 0.25), shade(base, -0.25)); }

  // ------------------------------------------------------------------ weapons (drawn from the hand, pointing up)
  const WEAPONS = {
    sword(c, o, T) {
      rr(c, -1.6, -17, 3.2, 15, 1.2); fs(c, lg(c, -2, 0, 2, 0, '#f4f7fb', '#9aa6b4'), 1.1);
      rr(c, -4.5, -2.6, 9, 2.6, 1); fs(c, '#c9a24a', 1);
      rr(c, -1.2, 0, 2.4, 4, 1); fs(c, '#6b4428', 0.9);
    },
    sword_small(c, o, T) { c.save(); c.scale(0.75, 0.75); WEAPONS.sword(c, o, T); c.restore(); },
    greatsword(c, o, T) {
      c.beginPath(); c.moveTo(-2.4, -2); c.lineTo(-2.4, -24); c.lineTo(0, -28); c.lineTo(2.4, -24); c.lineTo(2.4, -2); c.closePath();
      fs(c, lg(c, -3, 0, 3, 0, '#e9eef5', '#7d8898'), 1.2);
      rr(c, -6, -3, 12, 3, 1.2); fs(c, o.metal || '#5a5f6a', 1);
      rr(c, -1.4, 0, 2.8, 6, 1); fs(c, '#4a3020', 0.9);
    },
    flamesword(c, o, T, P) {
      WEAPONS.sword(c, o, T);
      c.save(); c.globalCompositeOperation = 'lighter';
      const f = 0.7 + Math.sin(P.t * 18) * 0.15;
      ell(c, 0, -10, 3.5 * f, 9); c.fillStyle = 'rgba(255,170,40,0.55)'; c.fill();
      ell(c, 0, -11, 1.8, 7); c.fillStyle = 'rgba(255,240,170,0.7)'; c.fill();
      c.restore();
    },
    axe(c, o, T) {
      rr(c, -1.1, -16, 2.2, 20, 1); fs(c, '#7a5232', 1);
      c.beginPath(); c.moveTo(1, -15); c.quadraticCurveTo(9, -17, 9, -9); c.quadraticCurveTo(5, -10, 1, -8); c.closePath();
      fs(c, lg(c, 0, -16, 8, -8, '#eef2f6', '#8f9aa8'), 1.1);
    },
    greataxe(c, o, T) {
      rr(c, -1.3, -20, 2.6, 26, 1.2); fs(c, '#6e4a2c', 1.1);
      for (const s of [1, -1]) {
        c.beginPath(); c.moveTo(s * 1.2, -19); c.quadraticCurveTo(s * 12, -22, s * 11, -10); c.quadraticCurveTo(s * 6, -12, s * 1.2, -11); c.closePath();
        fs(c, lg(c, 0, -20, s * 10, -10, '#f2f5f9', '#8e99a7'), 1.1);
      }
    },
    hatchet(c, o, T) { c.save(); c.scale(0.8, 0.8); WEAPONS.axe(c, o, T); c.restore(); },
    spear(c, o, T) {
      rr(c, -0.9, -24, 1.8, 30, 0.9); fs(c, '#8a6038', 0.9);
      c.beginPath(); c.moveTo(0, -31); c.lineTo(2.6, -24); c.lineTo(0, -22.5); c.lineTo(-2.6, -24); c.closePath(); fs(c, '#dfe5ec', 1);
      if (o.tassel) { ell(c, 0, -21.5, 1.6, 2.2); fs(c, T.main, 0.8); }
    },
    lance(c, o, T) {
      c.beginPath(); c.moveTo(-3.2, 0); c.lineTo(0, -32); c.lineTo(3.2, 0); c.closePath(); fs(c, lg(c, -3, 0, 3, 0, '#f1f4f8', '#8995a5'), 1.1);
      ell(c, 0, 0.5, 4.4, 2.2); fs(c, T.main, 1);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-2.2 + i * 0.4, -6 - i * 8); c.lineTo(2.2 - i * 0.4, -10 - i * 8); c.strokeStyle = T.dark; c.lineWidth = 1.2; c.stroke(); }
    },
    bow(c, o, T, P) {
      const pull = P.atk < 0.3 ? 1 - P.atk / 0.3 : 0;
      c.beginPath(); c.moveTo(0, -13); c.quadraticCurveTo(7, 0, 0, 13); c.strokeStyle = '#7a4a24'; c.lineWidth = 2.4; c.stroke();
      c.beginPath(); c.moveTo(0, -13); c.lineTo(-pull * 4, 0); c.lineTo(0, 13); c.strokeStyle = '#eee'; c.lineWidth = 0.7; c.stroke();
      if (o.fancy) { ell(c, 3.2, 0, 1.5, 1.5); fs(c, '#ffd84a', 0.6); }
    },
    longbow(c, o, T, P) { c.save(); c.scale(1.25, 1.35); WEAPONS.bow(c, o, T, P); c.restore(); },
    crossbow(c, o, T, P) {
      c.save(); c.rotate(Math.PI / 2);
      rr(c, -2, -1.6, 14, 3.2, 1); fs(c, '#7a5030', 1);
      c.beginPath(); c.moveTo(9, -8); c.quadraticCurveTo(12, 0, 9, 8); c.strokeStyle = '#5a5f6a'; c.lineWidth = 2.2; c.stroke();
      const k = P.atk < 0.25 ? 0 : 1;
      if (k) { rr(c, 2, -0.6, 10, 1.2, 0.5); fs(c, '#d8dde3', 0.6); }
      c.restore();
    },
    sling(c, o, T, P) {
      const sp = P.atk < 0.5 ? P.atk * 20 : P.t * 3;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(sp) * 6, -6 + Math.sin(sp) * 3); c.strokeStyle = '#6b4a2a'; c.lineWidth = 1; c.stroke();
      ell(c, Math.cos(sp) * 6, -6 + Math.sin(sp) * 3, 1.8, 1.8); fs(c, '#8c8c8c', 0.8);
    },
    staff(c, o, T, P) {
      rr(c, -1, -22, 2, 28, 1); fs(c, '#6d4527', 0.9);
      const oc = o.orb || T.main;
      c.save();
      const g = c.createRadialGradient(0, -24, 0, 0, -24, 7 + Math.sin(P.t * 6) * 0.8);
      g.addColorStop(0, rgba(oc, 0.9)); g.addColorStop(1, rgba(oc, 0));
      c.fillStyle = g; ell(c, 0, -24, 8, 8); c.fill();
      ell(c, 0, -24, 3.2, 3.2); fs(c, rg(c, 0, -24, 3.2, '#ffffff', oc), 1);
      c.restore();
    },
    wand(c, o, T, P) { c.save(); c.scale(0.7, 0.7); WEAPONS.staff(c, o, T, P); c.restore(); },
    scythe(c, o, T) {
      rr(c, -1, -24, 2, 30, 1); fs(c, '#3a2a2a', 0.9);
      c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(-14, -26, -16, -14); c.quadraticCurveTo(-10, -20, 0, -20); c.closePath();
      fs(c, lg(c, -16, -20, 0, -22, '#c7d0db', '#eef3f8'), 1.1);
    },
    hammer(c, o, T) {
      rr(c, -1.2, -16, 2.4, 22, 1); fs(c, '#6d4527', 1);
      rr(c, -6, -22, 12, 7, 1.5); fs(c, lg(c, 0, -22, 0, -15, '#a8b0bb', '#5d6570'), 1.2);
    },
    mace(c, o, T) {
      rr(c, -1.3, -14, 2.6, 20, 1); fs(c, '#4a4f5a', 1);
      ell(c, 0, -18, 6, 6); fs(c, rg(c, 0, -18, 6, '#c3cad3', '#5a6370'), 1.2);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 5, -18 + Math.sin(a) * 5); c.lineTo(Math.cos(a) * 8.5, -18 + Math.sin(a) * 8.5); c.lineTo(Math.cos(a + 0.3) * 5.5, -18 + Math.sin(a + 0.3) * 5.5); c.closePath(); fs(c, '#9aa3ae', 0.8); }
    },
    dagger(c, o, T) {
      c.beginPath(); c.moveTo(0, -11); c.lineTo(1.6, -3); c.lineTo(-1.6, -3); c.closePath(); fs(c, '#e6ebf1', 0.9);
      rr(c, -3, -3.2, 6, 1.6, 0.6); fs(c, '#c9a24a', 0.7); rr(c, -0.9, -1.6, 1.8, 3, 0.6); fs(c, '#5a3a22', 0.6);
    },
    rapier(c, o, T) {
      rr(c, -0.7, -22, 1.4, 20, 0.6); fs(c, '#e6ebf1', 0.8);
      c.beginPath(); c.arc(0, -1.5, 3.4, Math.PI, 0); c.strokeStyle = '#c9a24a'; c.lineWidth = 1.4; c.stroke();
      rr(c, -0.9, -1.5, 1.8, 4, 0.6); fs(c, '#3b2a3a', 0.6);
    },
    shears(c, o, T, P) {
      const open = P.atk < 0.4 ? 0.1 : 0.45;
      for (const s of [1, -1]) {
        c.save(); c.rotate(s * open);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 2.5, -20); c.lineTo(0, -26); c.lineTo(-s * 0.8, -4); c.closePath();
        fs(c, lg(c, -3, 0, 3, -20, '#e8edf3', '#8994a3'), 1.1);
        c.restore();
      }
      ell(c, 0, 2, 3, 3); fs(c, '#c08a3a', 1);
    },
    club(c, o, T) {
      c.beginPath(); c.moveTo(-1.5, 4); c.lineTo(-3.5, -16); c.quadraticCurveTo(0, -21, 3.5, -16); c.lineTo(1.5, 4); c.closePath(); fs(c, '#8a5a32', 1.1);
    },
    bomb(c, o, T, P) {
      ell(c, 0, -4, 5, 5); fs(c, rg(c, 0, -4, 5, '#5a5a6a', '#15151c'), 1.1);
      rr(c, -1.2, -10.5, 2.4, 2.5, 0.6); fs(c, '#8a7a5a', 0.6);
      const f = Math.sin(P.t * 30) > 0 ? '#ffe36a' : '#ff8a2a';
      ell(c, 0.8, -11.8, 1.5, 1.5); c.fillStyle = f; c.fill();
    },
    pickaxe(c, o, T) {
      rr(c, -1.1, -16, 2.2, 22, 1); fs(c, '#7a5232', 1);
      c.beginPath(); c.moveTo(-9, -12); c.quadraticCurveTo(0, -20, 9, -12); c.quadraticCurveTo(0, -16.5, -9, -12); c.closePath(); fs(c, '#aeb6c0', 1.1);
    },
    torch(c, o, T, P) {
      rr(c, -1.2, -10, 2.4, 14, 1); fs(c, '#6d4527', 0.9);
      c.save(); c.globalCompositeOperation = 'lighter';
      ell(c, 0, -14, 3.5, 5 + Math.sin(P.t * 20)); c.fillStyle = 'rgba(255,150,40,0.8)'; c.fill();
      ell(c, 0, -13, 1.8, 3); c.fillStyle = 'rgba(255,240,180,0.9)'; c.fill();
      c.restore();
    },
    stonefist(c, o, T) { ell(c, 0, -1, 5, 5); fs(c, rg(c, 0, -1, 5, '#c9c2b6', '#77706a'), 1.2); },
    boulder(c, o, T) { ell(c, 0, -8, 9, 8); fs(c, rg(c, 0, -8, 9, '#b6a99a', '#6a5e52'), 1.3); ell(c, -3, -11, 2, 1.4); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill(); },
    medkit(c, o, T) {
      rr(c, -1, -14, 2, 20, 1); fs(c, '#6d4527', 0.9);
      ell(c, 0, -16, 4.2, 4.2); fs(c, rg(c, 0, -16, 4.2, '#fff6c8', '#e2b23a'), 1);
      c.beginPath(); c.moveTo(0, -18.5); c.lineTo(0, -13.5); c.moveTo(-2.5, -16); c.lineTo(2.5, -16); c.strokeStyle = '#2f9a4a'; c.lineWidth = 1.4; c.stroke();
    },
  };

  const OFFHAND = {
    shield(c, o, T) {
      ell(c, 0, 0, 6.2, 7); fs(c, lg(c, -6, -7, 6, 7, T.light, T.dark), 1.3);
      ell(c, 0, 0, 3.6, 4.2); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.stroke();
      ell(c, 0, 0, 1.6, 1.6); fs(c, '#e8c24a', 0.8);
    },
    kite(c, o, T) {
      c.beginPath(); c.moveTo(-6, -7); c.lineTo(6, -7); c.lineTo(6, 1); c.quadraticCurveTo(0, 10, -6, 1); c.closePath();
      fs(c, lg(c, -6, -7, 6, 7, T.light, T.dark), 1.3);
      c.beginPath(); c.moveTo(0, -5); c.lineTo(0, 5); c.moveTo(-4, -2); c.lineTo(4, -2); c.strokeStyle = '#f2d46a'; c.lineWidth = 1.6; c.stroke();
    },
    tower(c, o, T) {
      rr(c, -6.5, -10, 13, 18, 2.5); fs(c, lg(c, -6, -10, 6, 8, T.light, T.dark), 1.3);
      rr(c, -4, -7.5, 8, 13, 1.5); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1; c.stroke();
    },
    bone_shield(c, o, T) { ell(c, 0, 0, 5.5, 6); fs(c, lg(c, -5, -6, 5, 6, '#d7cfbf', '#8f8573'), 1.2); ell(c, 0, 0, 2.5, 2.5); fs(c, T.main, 0.8); },
    lantern(c, o, T, P) {
      rr(c, -2.5, -3, 5, 6, 1.2); fs(c, '#4a4030', 1);
      c.save(); c.globalCompositeOperation = 'lighter'; ell(c, 0, 0, 4 + Math.sin(P.t * 5) * 0.5, 4); c.fillStyle = 'rgba(255,200,90,0.5)'; c.fill(); c.restore();
    },
    hatchet(c, o, T) { WEAPONS.hatchet(c, o, T); },
    dagger(c, o, T) { WEAPONS.dagger(c, o, T); },
    stonefist(c, o, T) { WEAPONS.stonefist(c, o, T); },
    bag(c, o, T) { rr(c, -4, -3, 8, 7, 2.5); fs(c, '#8a6038', 1.1); c.beginPath(); c.moveTo(-4, -1); c.lineTo(4, -1); c.strokeStyle = '#5a3a22'; c.lineWidth = 1; c.stroke(); },
  };

  // ------------------------------------------------------------------ heads
  function eyes(c, o, P) {
    if (o.eyes === 'glow') {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) { ell(c, s * 3, -27.5, 1.9, 1.3); c.fillStyle = o.eyeColor || '#ffe36a'; c.fill(); }
      c.restore(); return;
    }
    if (o.eyes === 'sockets') { for (const s of [-1, 1]) { ell(c, s * 3, -27.5, 2.1, 2.4); c.fillStyle = '#1e1a24'; c.fill(); } return; }
    const blink = (Math.sin(P.t * 1.3 + (o.seed || 0)) > 0.985);
    for (const s of [-1, 1]) {
      if (blink) { c.beginPath(); c.moveTo(s * 3 - 1.5, -27.5); c.lineTo(s * 3 + 1.5, -27.5); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); continue; }
      ell(c, s * 3, -27.5, 1.45, 2); c.fillStyle = '#231d2c'; c.fill();
      ell(c, s * 3 + 0.5, -28.3, 0.55, 0.6); c.fillStyle = '#fff'; c.fill();
    }
    if (o.brow) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 1.4, -30.2); c.lineTo(s * 4.6, -31.4); c.strokeStyle = o.brow; c.lineWidth = 1.4; c.stroke(); } }
    if (!o.noBlush) { for (const s of [-1, 1]) { ell(c, s * 5, -24.8, 1.6, 0.9); c.fillStyle = 'rgba(255,110,110,0.28)'; c.fill(); } }
    c.beginPath();
    if (o.mouth === 'grin') { c.arc(0, -24.6, 2.2, 0.15, Math.PI - 0.15); c.fillStyle = '#5a1f22'; c.fill(); }
    else if (o.mouth === 'grim') { c.moveTo(-1.8, -23.6); c.lineTo(1.8, -23.6); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke(); }
    else { c.arc(0, -24.8, 1.4, 0.2, Math.PI - 0.2); c.strokeStyle = OUT; c.lineWidth = 0.9; c.stroke(); }
  }

  function headBase(c, o, P, back) {
    const skin = o.skin || '#f2c79b';
    if (o.ears === 'imp') {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6.5, -30); c.lineTo(s * 13, -33); c.lineTo(s * 7, -25); c.closePath(); fs(c, skin, 1.1); }
    }
    if (o.ears === 'elf') {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 7, -29); c.lineTo(s * 10.5, -31.5); c.lineTo(s * 7.5, -26); c.closePath(); fs(c, skin, 1.1); }
    }
    ell(c, 0, -27.5, 8.4, 8); fs(c, rg(c, 0, -27.5, 9, shade(skin, 0.18), shade(skin, -0.12)), 1.3);
    if (!back) eyes(c, o, P);
    if (o.beard && !back) {
      c.beginPath(); c.moveTo(-6.5, -26); c.quadraticCurveTo(-6, -17, 0, -15.5); c.quadraticCurveTo(6, -17, 6.5, -26); c.quadraticCurveTo(0, -22.5, -6.5, -26); c.closePath();
      fs(c, o.beard, 1.1);
      c.beginPath(); c.moveTo(-3.5, -24.2); c.quadraticCurveTo(0, -25.6, 3.5, -24.2); c.strokeStyle = shade(o.beard, -0.3); c.lineWidth = 1.2; c.stroke();
    }
  }

  const HEADS = {
    none() {},
    hair(c, o, T, back) {
      const h = col(o.hair || '#6b3e1e', T);
      c.beginPath(); c.moveTo(-8.6, -26); c.quadraticCurveTo(-9.5, -37, 0, -36.5); c.quadraticCurveTo(9.5, -37, 8.6, -26);
      if (!back) { c.quadraticCurveTo(5, -33, 0, -31.5); c.quadraticCurveTo(-5, -33, -8.6, -26); } else c.quadraticCurveTo(0, -18, -8.6, -26);
      c.closePath(); fs(c, lg(c, 0, -37, 0, -26, shade(h, 0.2), shade(h, -0.15)), 1.2);
      if (o.pony) { c.beginPath(); c.moveTo(5, -33); c.quadraticCurveTo(13, -30, 10, -19); c.quadraticCurveTo(8.5, -27, 4, -29); c.closePath(); fs(c, h, 1.1); }
      if (o.braids) for (const s of [-1, 1]) { rr(c, s * 8 - 1.6, -27, 3.2, 12, 1.6); fs(c, h, 1); }
      if (o.bun) { ell(c, 0, -37.5, 3.6, 3); fs(c, h, 1.1); }
      if (o.circlet) { c.beginPath(); c.moveTo(-8, -31); c.quadraticCurveTo(0, -34, 8, -31); c.strokeStyle = '#f5cd3a'; c.lineWidth = 1.8; c.stroke(); ell(c, 0, -33, 1.6, 1.6); fs(c, T.light, 0.7); }
      if (o.headband) { c.beginPath(); c.moveTo(-8.4, -30); c.quadraticCurveTo(0, -33, 8.4, -30); c.strokeStyle = T.main; c.lineWidth = 2.4; c.stroke(); }
    },
    wild(c, o, T, back) {
      const h = col(o.hair || '#e8f4ff', T);
      c.beginPath();
      for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; const rr2 = i % 2 ? 9 : 12.5; c.lineTo(Math.cos(a) * rr2, -29 + Math.sin(a) * rr2 * 0.9); }
      c.quadraticCurveTo(0, -31, -9, -29); c.closePath(); fs(c, h, 1.2);
    },
    bald(c, o, T) {
      ell(c, -3, -33, 2.6, 1.4, -0.4); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      if (o.headband) { c.beginPath(); c.moveTo(-8.4, -30); c.quadraticCurveTo(0, -33, 8.4, -30); c.strokeStyle = col(o.headband, T); c.lineWidth = 2.4; c.stroke(); }
    },
    kettle(c, o, T) {
      c.beginPath(); c.arc(0, -29, 8.8, Math.PI, 0); c.closePath(); fs(c, lg(c, 0, -38, 0, -29, '#e2e7ee', '#8a95a3'), 1.3);
      ell(c, 0, -29, 12, 2.6); fs(c, lg(c, 0, -31, 0, -27, '#d2d8e0', '#7d8796'), 1.2);
      ell(c, 0, -38, 1.8, 1.4); fs(c, T.main, 0.8);
    },
    knight(c, o, T, back) {
      c.beginPath(); c.moveTo(-8.8, -22.5); c.lineTo(-8.8, -30); c.quadraticCurveTo(-8.8, -38, 0, -38); c.quadraticCurveTo(8.8, -38, 8.8, -30); c.lineTo(8.8, -22.5); c.quadraticCurveTo(0, -20, -8.8, -22.5); c.closePath();
      fs(c, lg(c, -8, -38, 8, -22, o.metal ? shade(o.metal, 0.3) : '#e9edf3', o.metal ? shade(o.metal, -0.3) : '#7f8a99'), 1.3);
      if (!back) {
        rr(c, -6.2, -29.2, 12.4, 2.4, 1); c.fillStyle = '#1b1820'; c.fill();
        if (o.eyes === 'glow') { c.save(); c.globalCompositeOperation = 'lighter'; for (const s of [-1, 1]) { ell(c, s * 2.8, -28, 1.6, 0.9); c.fillStyle = o.eyeColor || T.glow; c.fill(); } c.restore(); }
        c.beginPath(); c.moveTo(0, -27); c.lineTo(0, -22); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke();
      }
      if (o.plume !== false) { c.beginPath(); c.moveTo(0, -38); c.quadraticCurveTo(6, -46, 11, -41); c.quadraticCurveTo(6, -42, 1.5, -36); c.closePath(); fs(c, lg(c, 0, -46, 0, -36, T.light, T.main), 1.1); }
      if (o.spikes) for (const s of [-1, 0, 1]) { c.beginPath(); c.moveTo(s * 5 - 1.5, -36.5 + Math.abs(s)); c.lineTo(s * 6, -43 + Math.abs(s) * 2); c.lineTo(s * 5 + 1.5, -36.5 + Math.abs(s)); c.closePath(); fs(c, '#c9ced6', 0.9); }
    },
    openhelm(c, o, T) {
      c.beginPath(); c.arc(0, -29, 9, Math.PI * 1.02, -0.02); c.lineTo(9, -24); c.lineTo(6.5, -24); c.lineTo(6.5, -30); c.quadraticCurveTo(0, -33, -6.5, -30); c.lineTo(-6.5, -24); c.lineTo(-9, -24); c.closePath();
      fs(c, lg(c, 0, -38, 0, -24, '#e4e9f0', '#808b9a'), 1.3);
      c.beginPath(); c.moveTo(-5, -39); c.quadraticCurveTo(0, -44, 5, -39); c.lineTo(0, -37); c.closePath(); fs(c, T.main, 1);
    },
    horned(c, o, T) {
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 7, -32); c.quadraticCurveTo(s * 14, -34, s * 13, -42); c.quadraticCurveTo(s * 10, -36, s * 5, -35); c.closePath(); fs(c, '#efe6d2', 1.1); }
      c.beginPath(); c.arc(0, -29.5, 8.9, Math.PI, 0); c.closePath(); fs(c, lg(c, 0, -38, 0, -29, '#dde3ea', '#7f8a98'), 1.3);
      rr(c, -9, -31, 18, 2.4, 1); fs(c, '#c9a24a', 1);
    },
    hood(c, o, T, back) {
      const hc = col(o.hoodColor || 'T', T);
      c.beginPath(); c.moveTo(-10, -20); c.quadraticCurveTo(-11, -38, 0, -39); c.quadraticCurveTo(11, -38, 10, -20);
      if (!back) { c.quadraticCurveTo(7, -30, 0, -32); c.quadraticCurveTo(-7, -30, -10, -20); } else c.quadraticCurveTo(0, -17, -10, -20);
      c.closePath(); fs(c, lg(c, 0, -39, 0, -20, shade(hc, 0.15), shade(hc, -0.3)), 1.3);
      if (!back && o.shadowFace) { ell(c, 0, -26.5, 6.8, 6); c.fillStyle = 'rgba(15,10,25,0.75)'; c.fill(); if (o.eyes === 'glow') { c.save(); c.globalCompositeOperation = 'lighter'; for (const s of [-1, 1]) { ell(c, s * 2.6, -27, 1.5, 1); c.fillStyle = o.eyeColor || '#ff4a4a'; c.fill(); } c.restore(); } }
      if (o.circlet) { c.beginPath(); c.moveTo(-6, -33); c.quadraticCurveTo(0, -36, 6, -33); c.strokeStyle = '#f5cd3a'; c.lineWidth = 1.6; c.stroke(); }
    },
    wizard(c, o, T) {
      const hc = col(o.hatColor || 'T', T);
      ell(c, 0, -32, 13, 3.2); fs(c, shade(hc, -0.2), 1.2);
      c.beginPath(); c.moveTo(-8, -33); c.quadraticCurveTo(-3, -44, 4, -52); c.quadraticCurveTo(3, -42, 8, -33); c.closePath(); fs(c, lg(c, -6, -50, 6, -33, shade(hc, 0.25), shade(hc, -0.15)), 1.2);
      rr(c, -8, -35.5, 16, 2.6, 1); fs(c, o.band || '#f2d46a', 0.9);
    },
    gnome(c, o, T) {
      const hc = col(o.hatColor || 'T', T);
      c.beginPath(); c.moveTo(-9, -30); c.quadraticCurveTo(-4, -50, 10, -48); c.quadraticCurveTo(2, -44, 9, -30); c.closePath(); fs(c, lg(c, 0, -48, 0, -30, shade(hc, 0.2), shade(hc, -0.2)), 1.2);
      rr(c, -9.5, -32, 19, 3, 1.4); fs(c, '#f2ede2', 1);
    },
    medcap(c, o, T) {
      rr(c, -8, -38, 16, 7, 3); fs(c, '#f4f1ea', 1.2);
      c.beginPath(); c.moveTo(0, -37); c.lineTo(0, -32); c.moveTo(-2.5, -34.5); c.lineTo(2.5, -34.5); c.strokeStyle = '#2f9a4a'; c.lineWidth = 1.6; c.stroke();
      HEADS.hair(c, Object.assign({}, o, { pony: false }), T, false);
    },
    bandana(c, o, T) {
      c.beginPath(); c.arc(0, -29, 8.6, Math.PI, 0); c.closePath(); fs(c, col(o.band || 'T', T), 1.2);
      c.beginPath(); c.moveTo(7, -31); c.lineTo(12, -34); c.lineTo(11, -28); c.closePath(); fs(c, col(o.band || 'T', T), 1);
    },
    cowl(c, o, T, back) {
      HEADS.hood(c, Object.assign({}, o, { hoodColor: '#2e2a3a' }), T, back);
      if (!back) { rr(c, -6.5, -26, 13, 4.2, 2); fs(c, T.main, 1); }
    },
    feather(c, o, T) {
      ell(c, 0, -31, 13, 3.4); fs(c, '#5a3a24', 1.2);
      c.beginPath(); c.arc(0, -32, 7.6, Math.PI, 0); c.closePath(); fs(c, '#6e4a2e', 1.2);
      rr(c, -7.6, -33.5, 15.2, 2, 0.8); fs(c, T.main, 0.6);
      c.beginPath(); c.moveTo(5, -33); c.quadraticCurveTo(13, -42, 9, -46); c.quadraticCurveTo(9, -38, 3, -34); c.closePath(); fs(c, '#f2f2f2', 1);
    },
    miner(c, o, T) {
      c.beginPath(); c.arc(0, -29.5, 9, Math.PI, 0); c.closePath(); fs(c, lg(c, 0, -38, 0, -29, '#f2c84a', '#b88a1a'), 1.3);
      ell(c, 0, -29.5, 11, 2.2); fs(c, '#b88a1a', 1);
      ell(c, 0, -34, 2.4, 2.4); fs(c, '#fff4b0', 1);
    },
    skull(c, o, T, back) {
      // skull replaces the face: draw cheek bones and teeth
      if (back) { if (o.crown) HEADS.crown(c, o, T); if (o.helm) { c.beginPath(); c.arc(0, -30, 8.8, Math.PI, 0); c.closePath(); fs(c, lg(c, 0, -38, 0, -30, '#9a8f86', '#4a423c'), 1.2); } return; }
      rr(c, -3.5, -23.4, 7, 3, 1); c.fillStyle = '#efe9dc'; c.fill();
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 1.3, -23.4); c.lineTo(i * 1.3, -20.6); c.strokeStyle = 'rgba(40,30,30,0.6)'; c.lineWidth = 0.6; c.stroke(); }
      ell(c, 0, -25, 1, 1.2); c.fillStyle = '#2a2230'; c.fill();
      if (o.crown) HEADS.crown(c, o, T);
      if (o.helm) { c.beginPath(); c.arc(0, -30, 8.8, Math.PI, 0); c.closePath(); fs(c, lg(c, 0, -38, 0, -30, '#9a8f86', '#4a423c'), 1.2); c.beginPath(); c.moveTo(-3, -38.5); c.lineTo(0, -44); c.lineTo(3, -38.5); fs(c, T.main, 1); }
    },
    crown(c, o, T) {
      c.beginPath(); c.moveTo(-7, -33); c.lineTo(-7, -39); c.lineTo(-3.5, -36); c.lineTo(0, -41); c.lineTo(3.5, -36); c.lineTo(7, -39); c.lineTo(7, -33); c.closePath();
      fs(c, lg(c, 0, -41, 0, -33, '#ffe680', '#c99a1a'), 1.1);
      ell(c, 0, -35.5, 1.3, 1.3); fs(c, T.main, 0.6);
    },
    iron(c, o, T) {
      HEADS.knight(c, Object.assign({}, o, { plume: false, eyes: 'glow', eyeColor: T.glow, metal: o.metal || '#6a707c' }), T);
      c.beginPath(); c.moveTo(-9, -32); c.lineTo(-14, -36); c.lineTo(-9, -29); c.closePath(); fs(c, '#4a505a', 1);
      c.beginPath(); c.moveTo(9, -32); c.lineTo(14, -36); c.lineTo(9, -29); c.closePath(); fs(c, '#4a505a', 1);
    },
  };

  const BACK_HAIR = ['kettle', 'openhelm', 'bandana', 'feather', 'miner', 'gnome', 'wizard', 'horned', 'medcap', 'crown', 'none'];
  // ------------------------------------------------------------------ the humanoid rig
  function humanoid(c, o, P) {
    const T = P.T;
    const s = o.size || 1, bulk = o.bulk || 1;
    c.save();
    c.scale(s, s);
    if (P.back) c.scale(-1, 1);
    const moving = P.moving;
    const ph = P.walk * Math.PI * 2;
    const step = moving ? Math.sin(ph) : 0;
    const bob = moving ? Math.abs(Math.cos(ph)) * 1.4 : Math.sin(P.t * 2.2 + (o.seed || 0)) * 0.5;
    const body = col(o.body || 'T', T), legs = col(o.legs || '#4a3b30', T), boots = col(o.boots || '#2e241e', T);
    const ghost = o.ghost;

    // cape behind (front view)
    if (o.cape && !P.back) {
      c.beginPath(); c.moveTo(-7 * bulk, -20); c.quadraticCurveTo(-10 * bulk, -6, -8 * bulk - step, -1); c.lineTo(8 * bulk - step, -1); c.quadraticCurveTo(10 * bulk, -6, 7 * bulk, -20); c.closePath();
      fs(c, lg(c, 0, -20, 0, 0, col(o.cape, T), shade(col(o.cape, T), -0.35)), 1.2);
    }
    // legs
    if (!ghost) {
      for (const sd of [-1, 1]) {
        const lift = Math.max(0, step * sd) * 2.4;
        const fw = step * sd * 1.2;
        rr(c, sd * 3.3 * bulk - 2.2 * bulk + fw * 0.3, -8 - lift, 4.4 * bulk, 7.5, 1.8); fs(c, legs, 1.1);
        rr(c, sd * 3.3 * bulk - 2.6 * bulk + fw * 0.3, -3.2 - lift, 5.2 * bulk, 3.6, 1.6); fs(c, boots, 1.1);
      }
    } else {
      c.beginPath(); c.moveTo(-6, -10); c.quadraticCurveTo(-4 + Math.sin(P.t * 4) * 2, 0, 0, 2); c.quadraticCurveTo(4 + Math.sin(P.t * 4 + 1) * 2, 0, 6, -10); c.closePath();
      fs(c, lg(c, 0, -10, 0, 2, rgba(o.ghostColor || '#a8c8ff', 0.8), rgba(o.ghostColor || '#a8c8ff', 0)), 0);
    }
    c.translate(0, -bob);

    // off-hand item behind body when facing away
    const handY = -12.5, handX = 8.6 * bulk;
    const atk = P.atk;
    // weapon angle
    let wa = o.wAngle != null ? o.wAngle : 0.35;
    if (o.ranged) wa = o.wAngle != null ? o.wAngle : 0.15;
    if (atk < 1 && !o.ranged) {
      if (atk < 0.18) wa = lerp(-1.4, 1.9, easeOut(atk / 0.18));
      else wa = lerp(1.9, o.wAngle != null ? o.wAngle : 0.35, easeInOut((atk - 0.18) / 0.82));
    }
    if (atk < 1 && o.ranged) wa -= Math.sin(Math.min(1, atk * 3) * Math.PI) * 0.25;

    // torso
    const tw = 15 * bulk, th = 15;
    c.beginPath();
    c.moveTo(-tw / 2 + 1, -21); c.quadraticCurveTo(-tw / 2 - 1.5, -12, -tw / 2 + 0.5, -5.5);
    c.quadraticCurveTo(0, -3.5, tw / 2 - 0.5, -5.5); c.quadraticCurveTo(tw / 2 + 1.5, -12, tw / 2 - 1, -21);
    c.quadraticCurveTo(0, -23.5, -tw / 2 + 1, -21); c.closePath();
    fs(c, ghost ? rgba(o.ghostColor || '#a8c8ff', 0.85) : lg(c, -tw / 2, -22, tw / 2, -4, shade(body, 0.25), shade(body, -0.25)), 1.3);
    if (o.robe) {
      c.beginPath(); c.moveTo(-tw / 2, -12); c.lineTo(-tw / 2 - 2.5, -1); c.quadraticCurveTo(0, 1, tw / 2 + 2.5, -1); c.lineTo(tw / 2, -12); c.closePath();
      fs(c, lg(c, 0, -12, 0, 0, body, shade(body, -0.35)), 1.2);
    }
    if (o.armor) {
      c.beginPath(); c.moveTo(-tw / 2 + 2, -20); c.quadraticCurveTo(0, -22, tw / 2 - 2, -20); c.lineTo(tw / 2 - 2.5, -11); c.quadraticCurveTo(0, -8.5, -tw / 2 + 2.5, -11); c.closePath();
      fs(c, lg(c, -6, -21, 6, -9, shade(col(o.armor, T), 0.35), shade(col(o.armor, T), -0.25)), 1.1);
      for (const sd of [-1, 1]) { ell(c, sd * (tw / 2 - 0.5), -19.5, 3.6 * bulk, 2.6); fs(c, lg(c, 0, -22, 0, -17, shade(col(o.armor, T), 0.3), shade(col(o.armor, T), -0.2)), 1.1); }
    }
    if (o.ribs) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-4.5, -18 + i * 3.4); c.quadraticCurveTo(0, -16 + i * 3.4, 4.5, -18 + i * 3.4); c.strokeStyle = '#2a2230'; c.lineWidth = 1; c.stroke(); } }
    if (o.belt !== false && !ghost && !o.robe) { rr(c, -tw / 2 + 0.5, -9.5, tw - 1, 2.4, 1); fs(c, o.belt || '#5a3a22', 0.9); rr(c, -1.6, -10, 3.2, 3.2, 0.8); fs(c, '#e2c45a', 0.7); }
    if (o.sash) { c.beginPath(); c.moveTo(-tw / 2 + 1, -20); c.lineTo(tw / 2 - 1, -8); c.lineTo(tw / 2 - 1, -11); c.lineTo(-tw / 2 + 1, -23); c.closePath(); c.fillStyle = col(o.sash, T); c.fill(); }
    if (o.emblem && !P.back) { ell(c, 0, -14.5, 2.6, 2.6); fs(c, col(o.emblem, T), 0.9); }
    if (o.keg && P.back) { /* keg is drawn as weapon */ }

    // cape over the back (back view), drawn before arms and head
    if (o.cape && P.back) {
      const cw = 6.2 * bulk, sw = step * 0.8;
      c.beginPath(); c.moveTo(-cw, -21); c.quadraticCurveTo(-cw - 2.5, -11, -cw - 1 + sw, -3.5 + bob * 0.5);
      c.quadraticCurveTo(0, -1.5 + bob * 0.5, cw + 1 + sw, -3.5 + bob * 0.5); c.quadraticCurveTo(cw + 2.5, -11, cw, -21); c.quadraticCurveTo(0, -23, -cw, -21); c.closePath();
      fs(c, lg(c, 0, -21, 0, -2, col(o.cape, T), shade(col(o.cape, T), -0.35)), 1.2);
      c.beginPath(); c.moveTo(-cw * 0.4, -19); c.lineTo(-cw * 0.5 + sw, -4); c.moveTo(cw * 0.4, -19); c.lineTo(cw * 0.5 + sw, -4); c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.stroke();
      if (o.capeEmblem) { ell(c, 0, -13, 2.6, 2.6); fs(c, '#f2d46a', 0.8); }
    }
    // off hand (left)
    const ox = -handX, oy = handY + (moving ? -step * 1.2 : 0);
    c.beginPath(); c.moveTo(-tw / 2 + 1.5, -19); c.quadraticCurveTo(ox - 1, -16, ox, oy); c.strokeStyle = ghost ? rgba(o.ghostColor || '#a8c8ff', 0.8) : col(o.sleeve || o.body || 'T', T); c.lineWidth = 3.6 * bulk; c.lineCap = 'round'; c.stroke();
    if (o.off) { c.save(); c.translate(ox - 1, oy + 1); OFFHAND[o.off](c, o, T, P); c.restore(); }
    else { ell(c, ox, oy, 2.5 * bulk, 2.5 * bulk); fs(c, o.glove || o.skin || '#f2c79b', 1); }

    // head
    c.save();
    if (o.headScale) { c.translate(0, -20); c.scale(o.headScale, o.headScale); c.translate(0, 20); }
    headBase(c, o, P, P.back);
    if (P.back && BACK_HAIR.includes(o.head)) {
      const hc = col(o.hair || o.beard || '#5a3a22', T);
      c.beginPath(); c.ellipse(0, -28, 8.2, 7.6, 0, 0, Math.PI * 2); fs(c, lg(c, 0, -36, 0, -20, shade(hc, 0.15), shade(hc, -0.2)), 1.2);
    }
    (HEADS[o.head] || HEADS.none)(c, o, T, P.back);
    c.restore();

    // weapon hand (right)
    const hx = handX, hy = handY + (moving ? step * 1.2 : 0);
    c.beginPath(); c.moveTo(tw / 2 - 1.5, -19); c.quadraticCurveTo(hx + 1, -16, hx, hy); c.strokeStyle = ghost ? rgba(o.ghostColor || '#a8c8ff', 0.8) : col(o.sleeve || o.body || 'T', T); c.lineWidth = 3.6 * bulk; c.lineCap = 'round'; c.stroke();
    if (o.weapon) {
      c.save(); c.translate(hx, hy); c.rotate(wa); c.scale(o.wScale || 1, o.wScale || 1);
      WEAPONS[o.weapon](c, o, T, P);
      c.restore();
    }
    ell(c, hx, hy, 2.5 * bulk, 2.5 * bulk); fs(c, o.glove || o.skin || '#f2c79b', 1);

    c.restore();
  }

  // ------------------------------------------------------------------ creatures
  function wingPair(c, span, h, flap, fill, stroke = OUT, ribs = true) {
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1); c.rotate(-flap * 0.5);
      c.beginPath(); c.moveTo(2, -2); c.quadraticCurveTo(span * 0.5, -h * 1.1, span, -h * 0.6);
      c.quadraticCurveTo(span * 0.85, -h * 0.1, span * 0.7, h * 0.1); c.quadraticCurveTo(span * 0.55, -h * 0.15, span * 0.45, h * 0.15);
      c.quadraticCurveTo(span * 0.3, -h * 0.05, 2, 2); c.closePath(); fs(c, fill, 1.2, stroke);
      if (ribs) { c.beginPath(); c.moveTo(2, -1); c.lineTo(span * 0.7, h * 0.05); c.moveTo(2, -1); c.lineTo(span * 0.45, h * 0.12); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8; c.stroke(); }
      c.restore();
    }
  }

  const CREATURES = {
    bat(c, P) {
      const T = P.T, f = Math.sin(P.t * 22 + P.seed);
      c.save(); c.translate(0, -26);
      wingPair(c, 13, 8, f, lg(c, 0, -8, 0, 6, '#5a4870', '#2b2238'));
      ell(c, 0, 0, 5, 5.5); fs(c, rg(c, 0, 0, 6, '#6b5a84', '#2f2540'), 1.2);
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2, -4); c.lineTo(s * 4.2, -8.5); c.lineTo(s * 4.6, -3); c.closePath(); fs(c, '#4a3a60', 1); }
      for (const s of [-1, 1]) { ell(c, s * 1.9, -0.6, 1.2, 1.4); c.fillStyle = T.glow; c.fill(); }
      c.beginPath(); c.moveTo(-1.2, 2.6); c.lineTo(-0.6, 4); c.lineTo(0, 2.6); c.lineTo(0.6, 4); c.lineTo(1.2, 2.6); c.fillStyle = '#fff'; c.fill();
      c.restore();
    },
    wisp(c, P) {
      const T = P.T, b = Math.sin(P.t * 4 + P.seed) * 1.5;
      c.save(); c.translate(0, -24 + b);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, rgba(T.glow, 0.7)); g.addColorStop(1, rgba(T.glow, 0)); c.fillStyle = g; ell(c, 0, 0, 14, 14); c.fill();
      c.restore();
      c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(-4, 10, 2 + Math.sin(P.t * 8) * 2, 13); c.quadraticCurveTo(3, 7, 6, 0); c.closePath(); fs(c, rgba(T.light, 0.8), 0);
      ell(c, 0, 0, 7, 7); fs(c, rg(c, 0, 0, 7, '#ffffff', T.light), 1.2, T.dark);
      for (const s of [-1, 1]) { ell(c, s * 2.4, -0.5, 1.2, 1.7); c.fillStyle = T.dark; c.fill(); }
      c.restore();
    },
    gargoyle(c, P) {
      const T = P.T, f = Math.sin(P.t * 16 + P.seed);
      c.save(); c.translate(0, -25);
      wingPair(c, 12, 7, f, lg(c, 0, -7, 0, 5, '#8e8f99', '#55565f'));
      ell(c, 0, 2, 5, 6); fs(c, rg(c, 0, 2, 6, '#a3a4ad', '#5f606a'), 1.2);
      ell(c, 0, -4, 5, 4.6); fs(c, rg(c, 0, -4, 5, '#b0b1ba', '#6a6b75'), 1.2);
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2.5, -7); c.lineTo(s * 5, -12); c.lineTo(s * 4.5, -6); c.closePath(); fs(c, '#d8d2c2', 0.9); }
      for (const s of [-1, 1]) { ell(c, s * 1.9, -4, 1.1, 1.1); c.fillStyle = T.glow; c.fill(); }
      rr(c, -3, 6.5, 6, 2, 1); fs(c, T.main, 0.8);
      c.restore();
    },
    drake(c, P, o) {
      const T = P.T, f = Math.sin(P.t * 9 + P.seed);
      const big = o && o.wyrm;
      c.save(); c.translate(0, big ? -34 : -30); if (P.back) c.scale(1, 1);
      const bodyC = big ? '#5a3a34' : '#5fa84a', bellyC = big ? '#ff8a3a' : '#e8d27a';
      // tail
      c.beginPath(); c.moveTo(-2, 6); c.quadraticCurveTo(-4 + Math.sin(P.t * 3) * 3, 16, 3, 20); c.quadraticCurveTo(0, 14, 3, 6); c.closePath(); fs(c, bodyC, 1.1);
      wingPair(c, big ? 19 : 15, big ? 11 : 9, f, lg(c, 0, -9, 0, 8, big ? '#ff9a4a' : '#8fd46a', big ? '#9a2a1a' : '#3f7a34'));
      ell(c, 0, 3, big ? 8 : 6.5, big ? 9 : 7.5); fs(c, rg(c, 0, 3, 8, shade(bodyC, 0.25), shade(bodyC, -0.2)), 1.2);
      ell(c, 0, 5, big ? 4.5 : 3.6, big ? 6 : 5); fs(c, bellyC, 0.8);
      if (big) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-5 + i * 3, -2 + i); c.lineTo(-3 + i * 3, 3 + i * 2); c.strokeStyle = 'rgba(255,140,40,0.7)'; c.lineWidth = 1.2; c.stroke(); } c.restore(); }
      // head
      ell(c, 0, -7, big ? 7 : 6, big ? 6.4 : 5.6); fs(c, rg(c, 0, -7, 7, shade(bodyC, 0.3), shade(bodyC, -0.15)), 1.2);
      ell(c, 0, -3, big ? 4.5 : 3.8, 2.6); fs(c, shade(bodyC, 0.1), 1);
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 3, -11); c.lineTo(s * 6, -16); c.lineTo(s * 5, -10); c.closePath(); fs(c, '#efe6d2', 0.9); }
      if (!P.back) for (const s of [-1, 1]) { ell(c, s * 2.6, -8, 1.4, 1.7); c.fillStyle = big ? '#ffe36a' : '#231d2c'; c.fill(); }
      rr(c, -4.5, 9.5, 9, 2.4, 1); fs(c, T.main, 0.9);
      c.restore();
    },
    hound(c, P, o) {
      const T = P.T, pup = o && o.pup, s = pup ? 0.45 : 1;
      const f = Math.sin(P.t * (pup ? 14 : 5) + P.seed);
      c.save(); c.translate(0, pup ? -24 : -40); c.scale(s, s);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 26); g.addColorStop(0, 'rgba(255,120,40,0.35)'); g.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = g; ell(c, 0, 0, 26, 26); c.fill();
      c.restore();
      wingPair(c, 24, 13, f, lg(c, 0, -12, 0, 10, '#ff8a3a', '#7a1f12'), OUT);
      ell(c, 0, 4, 14, 12); fs(c, rg(c, 0, 4, 14, '#6a3a30', '#2a1612'), 1.4);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + P.t * 0.5; c.beginPath(); c.moveTo(Math.cos(a) * 4, 4 + Math.sin(a) * 4); c.lineTo(Math.cos(a) * 11, 4 + Math.sin(a) * 9); c.strokeStyle = 'rgba(255,150,40,0.85)'; c.lineWidth = 1.6; c.stroke(); }
      c.restore();
      ell(c, 0, -8, 9, 8); fs(c, rg(c, 0, -8, 9, '#7a4436', '#2e1814'), 1.3);
      for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(s2 * 4, -14); c.lineTo(s2 * 8, -21); c.lineTo(s2 * 8, -12); c.closePath(); fs(c, '#3a1e18', 1.1); }
      ell(c, 0, -4, 5, 3.4); fs(c, '#4a2620', 1);
      for (const s2 of [-1, 1]) { ell(c, s2 * 3.4, -9, 1.8, 1.4); c.fillStyle = '#ffd24a'; c.fill(); }
      rr(c, -6, 13, 12, 3, 1.4); fs(c, T.main, 1);
      c.restore();
    },
    zeppelin(c, P) {
      const T = P.T, b = Math.sin(P.t * 2 + P.seed) * 1.2;
      c.save(); c.translate(0, -48 + b);
      ell(c, 0, 0, 17, 13); fs(c, rg(c, 0, 0, 17, T.light, T.dark), 1.5);
      for (const s of [-1, 0, 1]) { c.beginPath(); c.ellipse(0, 0, Math.abs(s) * 11 + 3, 13, 0, -Math.PI / 2, Math.PI / 2, s < 0); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.stroke(); }
      c.beginPath(); c.moveTo(-8, 11); c.lineTo(-6, 18); c.moveTo(8, 11); c.lineTo(6, 18); c.strokeStyle = '#4a3a2a'; c.lineWidth = 1.2; c.stroke();
      rr(c, -8, 17, 16, 7, 2); fs(c, lg(c, 0, 17, 0, 24, '#9a6a3a', '#5e3c1e'), 1.3);
      ell(c, 0, 26, 3.6, 3.6); fs(c, rg(c, 0, 26, 3.6, '#5a5a6a', '#15151c'), 1);
      // little pilot
      ell(c, 3, 14.5, 3, 3); fs(c, '#f2c79b', 1); rr(c, 0, 11, 6, 2.4, 1); fs(c, '#6b4a2a', 0.8);
      c.restore();
    },
    ram(c, P) {
      const T = P.T, ph = P.walk * Math.PI * 2, step = P.moving ? Math.sin(ph * 1.5) : 0;
      c.save();
      // legs
      for (const [lx, sd] of [[-7, 1], [-3, -1], [3, 1], [7, -1]]) { rr(c, lx - 1.6, -8 - Math.max(0, step * sd) * 3, 3.2, 8, 1.4); fs(c, '#4a3a2e', 1); }
      // wooly body
      c.translate(0, P.moving ? -Math.abs(Math.cos(ph * 1.5)) * 1.5 : 0);
      for (let i = 0; i < 7; i++) { ell(c, -8 + i * 2.7, -13 + Math.sin(i * 2) * 1.5, 4.6, 4.6); fs(c, '#f2eee6', 1); }
      ell(c, 0, -13, 10, 6); fs(c, lg(c, 0, -19, 0, -7, '#ffffff', '#d8d0c2'), 0);
      // head
      const hx = P.back ? -9 : 9;
      ell(c, hx, -14, 4.5, 4); fs(c, '#5a4a3e', 1.2);
      c.beginPath(); c.arc(hx - 1, -16, 4.6, Math.PI * 0.9, Math.PI * 2.3); c.strokeStyle = '#d8c6a0'; c.lineWidth = 2.6; c.stroke();
      // rider
      c.translate(-1, -15);
      humanoid(c, { size: 0.62, head: 'bandana', band: 'T', beard: '#6a3a1a', weapon: 'hammer', body: 'T', seed: 3, wAngle: 0.9 }, Object.assign({}, P, { moving: false }));
      c.restore();
    },
    sprite(c, P, o) {
      const T = P.T, b = Math.sin(P.t * 7 + P.seed) * 1.6;
      const colr = { fire: ['#ffd24a', '#ff5a1a'], ice: ['#e8fbff', '#4ab6ff'], zap: ['#fffbd0', '#5a8cff'], heal: ['#f2fff0', '#4ad06a'] }[o.el];
      c.save(); c.translate(0, -14 + b);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, rgba(colr[1], 0.6)); g.addColorStop(1, rgba(colr[1], 0)); c.fillStyle = g; ell(c, 0, 0, 12, 12); c.fill();
      for (let i = 0; i < 3; i++) { const a = P.t * 6 + i * 2.1; ell(c, Math.cos(a) * 6, Math.sin(a) * 3 + 4, 1.4, 1.4); c.fillStyle = colr[0]; c.fill(); }
      c.restore();
      c.beginPath(); c.moveTo(-5, -1); c.quadraticCurveTo(0, -13 + Math.sin(P.t * 12), 5, -1); c.closePath(); fs(c, colr[1], 1);
      ell(c, 0, 0, 5.5, 5.5); fs(c, rg(c, 0, 0, 5.5, colr[0], colr[1]), 1.1);
      for (const s of [-1, 1]) { ell(c, s * 2, -0.5, 0.9, 1.3); c.fillStyle = OUT; c.fill(); }
      rr(c, -3, 5, 6, 1.6, 0.8); fs(c, T.main, 0.6);
      c.restore();
    },
    siege_ram(c, P) {
      const T = P.T, ph = P.walk * Math.PI * 2;
      c.save();
      const facing = P.back ? -1 : 1;
      // pushers
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 7, 2);
        humanoid(c, { size: 0.7, bulk: 1.2, skin: '#e8b48a', beard: '#7a4a22', head: 'bald', headband: 'T', body: 'T', seed: s, weapon: null, off: null }, P);
        c.restore();
      }
      c.translate(0, -12 + (P.moving ? Math.sin(ph * 2) * 0.6 : 0));
      // log body
      rr(c, -5, -14, 10, 26, 5); fs(c, lg(c, -5, 0, 5, 0, '#a8743e', '#5e3c1e'), 1.4);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-5, -8 + i * 7); c.lineTo(5, -8 + i * 7); c.strokeStyle = '#4a3020'; c.lineWidth = 1.4; c.stroke(); }
      // iron head
      const hy = facing > 0 ? 12 : -14;
      ell(c, 0, hy, 6, 4.5); fs(c, rg(c, 0, hy, 6, '#c3cad3', '#5a6370'), 1.3);
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 3.5, hy, 3.5, s > 0 ? -1.5 : 1.6, s > 0 ? 1.5 : 4.7); c.strokeStyle = '#8a929e'; c.lineWidth = 2; c.stroke(); }
      rr(c, -6, -2, 12, 3, 1); fs(c, T.main, 1);
      c.restore();
    },
    boulder_brute(c, P) {
      const T = P.T, ph = P.walk * Math.PI * 2, step = P.moving ? Math.sin(ph) : 0;
      c.save(); c.scale(1.5, 1.5);
      for (const sd of [-1, 1]) { const lift = Math.max(0, step * sd) * 2; ell(c, sd * 5, -4 - lift, 4.5, 4.5); fs(c, rg(c, sd * 5, -4, 5, '#a89c8c', '#5e554a'), 1.3); }
      c.translate(0, P.moving ? -Math.abs(Math.cos(ph)) : 0);
      const sw = P.atk < 1 ? Math.sin(Math.min(1, P.atk * 2.5) * Math.PI) * 6 : 0;
      // arms
      for (const sd of [-1, 1]) { ell(c, sd * 12, -14 + (sd > 0 ? -sw : 0), 5, 6); fs(c, rg(c, sd * 12, -14, 6, '#b3a796', '#655b4f'), 1.3); }
      ell(c, 0, -17, 11, 11); fs(c, rg(c, 0, -17, 12, '#bdb1a0', '#6a6054'), 1.5);
      ell(c, -5, -24, 4.5, 3); c.fillStyle = '#6aa84a'; c.fill(); ell(c, 4, -26, 3, 2); c.fillStyle = '#7fbf5a'; c.fill();
      if (!P.back) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const s of [-1, 1]) { ell(c, s * 3.6, -18, 2, 1.3); c.fillStyle = T.glow; c.fill(); }
        c.restore();
        c.beginPath(); c.moveTo(-3, -13); c.quadraticCurveTo(0, -11.5, 3, -13); c.strokeStyle = '#3a332c'; c.lineWidth = 1.2; c.stroke();
      }
      c.beginPath(); c.moveTo(-6, -9); c.lineTo(-3, -16); c.lineTo(2, -14); c.strokeStyle = 'rgba(40,30,25,0.5)'; c.lineWidth = 1; c.stroke();
      rr(c, -8, -8.5, 16, 2.6, 1.2); fs(c, T.main, 1);
      c.restore();
    },
    thunder_engine(c, P) {
      const T = P.T, ph = P.walk * Math.PI * 2;
      c.save();
      for (const s of [-1, 1]) { ell(c, s * 10, -6, 6, 6); fs(c, rg(c, s * 10, -6, 6, '#8a6a4a', '#4a3020'), 1.3); c.beginPath(); for (let i = 0; i < 4; i++) { const a = ph + i * Math.PI / 4; c.moveTo(s * 10 + Math.cos(a) * 5, -6 + Math.sin(a) * 5); c.lineTo(s * 10 - Math.cos(a) * 5, -6 - Math.sin(a) * 5); } c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2; c.stroke(); }
      rr(c, -12, -18, 24, 12, 3); fs(c, lg(c, 0, -18, 0, -6, '#9a7a52', '#5a4228'), 1.4);
      rr(c, -11, -14, 22, 2.4, 1); fs(c, T.main, 0.8);
      // coil cannon
      const charge = P.charge || 0;
      rr(c, -5, -34, 10, 18, 3); fs(c, lg(c, -5, 0, 5, 0, '#c9ced6', '#5a6370'), 1.3);
      for (let i = 0; i < 4; i++) { rr(c, -6.5, -31 + i * 4, 13, 2, 1); fs(c, '#c08a3a', 0.8); }
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, -36, 0, 0, -36, 6 + charge * 10); g.addColorStop(0, rgba('#bfe0ff', 0.3 + charge * 0.7)); g.addColorStop(1, 'rgba(120,180,255,0)'); c.fillStyle = g; ell(c, 0, -36, 18, 18); c.fill();
      if (charge > 0.6) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, -36); let x = 0, y = -36; for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 8; y += (Math.random() - 0.5) * 8; c.lineTo(x, y); } c.strokeStyle = 'rgba(200,230,255,0.9)'; c.lineWidth = 1; c.stroke(); }
      c.restore();
      ell(c, 0, -36, 4, 4); fs(c, rg(c, 0, -36, 4, '#ffffff', '#6aa8ff'), 1.1);
      c.restore();
    },
    bone_giant(c, P) {
      const T = P.T;
      humanoid(c, { size: 1.55, bulk: 1.25, skin: '#ece5d4', body: '#ece5d4', legs: '#ddd5c2', boots: '#b8ae98', ribs: true, belt: '#5a3a22', head: 'skull', eyes: 'sockets', noBlush: true, weapon: 'club', glove: '#ece5d4', sleeve: '#ece5d4', seed: 5, keg: true }, P);
      if (!P.back) return;
      c.save(); c.translate(0, -36); rr(c, -8, -8, 16, 16, 4); fs(c, lg(c, -8, 0, 8, 0, '#9a6a3a', '#5e3c1e'), 1.3);
      for (const y of [-4, 4]) { c.beginPath(); c.moveTo(-8, y); c.lineTo(8, y); c.strokeStyle = '#4a4f5a'; c.lineWidth = 1.6; c.stroke(); }
      c.restore();
    },
  };

  // ------------------------------------------------------------------ per-unit art table
  const H = (o) => ({ kind: 'hum', o });
  const C = (fn, o) => ({ kind: 'cre', fn, o });
  const ART = {
    squire: H({ head: 'kettle', weapon: 'sword', off: 'shield', body: 'T', seed: 1 }),
    slinger: H({ head: 'hair', hair: '#c0602a', pony: true, weapon: 'sling', body: 'T', size: 0.88, ranged: true, seed: 2, legs: '#5a4a3a' }),
    rattlebone: H({ head: 'skull', eyes: 'sockets', noBlush: true, skin: '#efe9dc', body: '#efe9dc', legs: '#e2dccd', boots: '#cfc7b4', ribs: true, belt: false, weapon: 'sword_small', size: 0.72, glove: '#efe9dc', sleeve: '#efe9dc', seed: 3 }),
    imp: H({ head: 'none', ears: 'imp', skin: '#7fcf5a', body: 'T', legs: '#6aa84a', boots: '#3a5a2a', weapon: 'dagger', size: 0.72, mouth: 'grin', brow: '#2a3a1a', seed: 4 }),
    spear_imp: H({ head: 'bandana', band: 'T', ears: 'imp', skin: '#7fcf5a', body: '#6b4a2a', legs: '#6aa84a', boots: '#3a5a2a', weapon: 'spear', size: 0.72, mouth: 'grin', ranged: true, wAngle: 0.5, seed: 5 }),
    bat: C('bat'), wisp: C('wisp'), gargoyle: C('gargoyle'),
    brawler: H({ head: 'bald', headband: 'T', beard: '#7a4a22', skin: '#e8b48a', body: 'T', bulk: 1.25, weapon: null, glove: '#8a5a32', size: 1.02, brow: '#5a3a1a', mouth: 'grim', seed: 6 }),
    satchel_gnome: H({ head: 'gnome', hatColor: 'T', beard: '#f4f1ea', weapon: 'bomb', off: 'bag', body: '#6b4a2a', size: 0.78, ranged: true, wAngle: -0.3, seed: 7 }),
    cinder_sprite: C('sprite', { el: 'fire' }), frost_sprite: C('sprite', { el: 'ice' }), volt_sprite: C('sprite', { el: 'zap' }), mend_sprite: C('sprite', { el: 'heal' }),
    phalanx: H({ head: 'openhelm', weapon: 'spear', tassel: true, off: 'tower', body: 'T', armor: '#b8c0cb', seed: 8, wAngle: 0.15 }),
    arbalest: H({ head: 'feather', weapon: 'crossbow', body: 'T', armor: '#8a6a4a', ranged: true, wAngle: -0.6, seed: 9, mouth: 'grim' }),
    ram_rider: C('ram'),
    boulder_brute: C('boulder_brute'),
    flame_adept: H({ head: 'wizard', hatColor: 'T', band: '#ff9a3a', hair: '#e86a2a', beard: null, weapon: 'staff', orb: '#ff7a2a', body: 'T', robe: true, ranged: true, wAngle: 0.1, seed: 10, ears: 'elf' }),
    axe_dancer: H({ head: 'horned', hair: '#e8c86a', braids: true, weapon: 'greataxe', body: 'T', armor: '#c9ced6', size: 1.04, seed: 11, wAngle: 0.6 }),
    clockwork_cutter: H({ head: 'iron', metal: '#9a8a6a', skin: '#b8a78a', body: '#a08a62', armor: '#c08a3a', legs: '#6f6556', boots: '#4a4030', weapon: 'shears', glove: '#8a7a5a', sleeve: '#8a7a5a', seed: 12, emblem: 'T' }),
    field_medic: H({ head: 'medcap', hair: '#3a2a22', bun: true, weapon: 'medkit', off: 'bag', body: 'T', armor: '#f4f1ea', bulk: 1.1, seed: 13 }),
    siege_ram: C('siege_ram'),
    charger: H({ head: 'knight', weapon: 'lance', off: 'kite', body: 'T', armor: '#c9ced6', bulk: 1.12, size: 1.08, wAngle: 0.9, seed: 14 }),
    hatchling_drake: C('drake'),
    hex_witch: H({ head: 'wizard', hatColor: '#3a2a4a', band: 'T', hair: '#9a5ae0', skin: '#d8e8c8', weapon: 'staff', orb: '#9aff5a', body: '#3a2a4a', sash: 'T', robe: true, ranged: true, wAngle: 0.1, seed: 15 }),
    iron_colossus: H({ head: 'iron', size: 1.55, bulk: 1.3, body: '#4a505a', armor: '#6a707c', legs: '#3a3f48', boots: '#2a2e36', weapon: 'greatsword', glove: '#5a606c', sleeve: '#5a606c', seed: 16, emblem: 'T', wAngle: 0.5 }),
    zeppelin: C('zeppelin'),
    boulder_roller: H({ head: 'bald', headband: 'T', beard: '#4a3a2a', skin: '#d8a074', body: 'T', bulk: 1.35, size: 1.1, weapon: 'boulder', wAngle: -0.3, seed: 17, mouth: 'grim', brow: '#3a2a1a' }),
    reaper: H({ head: 'hood', hoodColor: '#2e2a3a', shadowFace: true, eyes: 'glow', eyeColor: '#ff5a5a', body: '#2e2a3a', sash: 'T', robe: true, weapon: 'scythe', ranged: false, seed: 18, glove: '#cfc7b4', sleeve: '#2e2a3a' }),
    shade_guard: H({ head: 'skull', helm: true, eyes: 'sockets', noBlush: true, skin: '#e6dfcf', body: '#e6dfcf', legs: '#d8d0bf', boots: '#a89c86', ribs: true, belt: false, weapon: 'spear', off: 'bone_shield', size: 0.85, glove: '#e6dfcf', sleeve: '#e6dfcf', seed: 19, wAngle: 0.15 }),
    bone_giant: C('bone_giant'),
    sapper: H({ head: 'miner', skin: '#7fcf5a', ears: 'imp', body: 'T', weapon: 'bomb', size: 0.78, mouth: 'grin', wAngle: -0.4, seed: 20 }),
    tunneler: H({ head: 'miner', beard: '#8a5a2a', body: 'T', armor: '#8a6a4a', weapon: 'pickaxe', bulk: 1.1, size: 0.95, seed: 21, wAngle: 0.6 }),
    longbow_ranger: H({ head: 'hood', hoodColor: 'T', hair: '#e8c86a', weapon: 'longbow', body: '#4a6a3a', ranged: true, wAngle: -0.05, seed: 22, ears: 'elf', cape: 'T' }),
    frost_mage: H({ head: 'wizard', hatColor: '#9ad8ff', band: 'T', beard: '#ffffff', skin: '#f2dcc8', weapon: 'staff', orb: '#7ad8ff', body: '#9ad8ff', sash: 'T', robe: true, ranged: true, wAngle: 0.1, seed: 23 }),
    storm_caller: H({ head: 'wild', hair: '#e8f4ff', weapon: 'staff', orb: '#7aa8ff', body: 'T', robe: true, ranged: true, wAngle: 0.1, seed: 24, eyes: 'glow', eyeColor: '#bfe0ff' }),
    magma_wyrm: C('drake', { wyrm: true }),
    berserker: H({ head: 'bald', beard: '#d0542a', skin: '#f0c49a', body: 'T', bulk: 1.15, weapon: 'hatchet', off: 'hatchet', mouth: 'grin', brow: '#a03a1a', seed: 25, wAngle: 0.7 }),
    thunder_engine: C('thunder_engine'),
    cinder_hound: C('hound'), cinder_pup: C('hound', { pup: true }),
    titan_knight: H({ head: 'knight', spikes: true, plume: false, metal: '#5a5f6a', size: 1.5, bulk: 1.3, body: '#3a3f48', armor: '#6a707c', legs: '#2a2e36', boots: '#1e2128', weapon: 'mace', wScale: 1.2, glove: '#4a505a', sleeve: '#4a505a', cape: 'T', seed: 26, eyes: 'glow' }),
    rogue: H({ head: 'cowl', weapon: 'dagger', off: 'dagger', body: '#3a3448', sash: 'T', size: 0.92, seed: 27, wAngle: 0.8, cape: 'T' }),
    nightshade: H({ head: 'hood', hoodColor: '#3a2a4a', hair: '#e8e0ff', weapon: 'rapier', body: '#3a2a4a', armor: 'T', cape: '#2a1e38', seed: 28, skin: '#e6d8f0', eyes: 'glow', eyeColor: '#c89aff' }),
    phantom: H({ head: 'hood', hoodColor: '#cfe0ff', shadowFace: true, eyes: 'glow', eyeColor: '#bfe8ff', ghost: true, ghostColor: '#b8d0ff', weapon: 'sword', body: '#cfe0ff', seed: 29, sleeve: '#cfe0ff' }),
    sunblade_paladin: H({ head: 'knight', metal: '#e8c24a', weapon: 'flamesword', off: 'kite', body: '#f2e6c4', armor: '#e8c24a', cape: 'T', capeEmblem: true, size: 1.12, bulk: 1.1, seed: 30, eyes: 'glow', eyeColor: '#fff2a0' }),
    huntress: H({ head: 'hood', hoodColor: '#2e3a2a', circlet: true, hair: '#2a1a1a', weapon: 'bow', fancy: true, body: '#3a4a32', sash: 'T', cape: 'T', ranged: true, wAngle: -0.05, seed: 31, ears: 'elf', size: 1.04 }),
    bone_monarch: H({ head: 'skull', crown: true, eyes: 'glow', eyeColor: '#7affd0', noBlush: true, skin: '#ece5d4', body: '#ece5d4', armor: '#5a4a6a', legs: '#ddd5c2', boots: '#5a4a6a', weapon: 'greatsword', cape: 'T', ribs: true, size: 1.22, bulk: 1.15, glove: '#ece5d4', sleeve: '#5a4a6a', seed: 32 }),
    stone_abbot: H({ head: 'bald', headband: 'T', skin: '#e0b088', body: '#e8913a', sash: 'T', robe: true, weapon: 'stonefist', off: 'stonefist', bulk: 1.2, size: 1.1, seed: 33, mouth: 'grim' }),
  };

  // ------------------------------------------------------------------ public draw
  function drawUnit(c, kind, P) {
    const a = ART[kind];
    if (!a) { ell(c, 0, -14, 8, 12); fs(c, P.T.main, 1); return; }
    if (a.kind === 'hum') humanoid(c, a.o, P);
    else CREATURES[a.fn](c, P, a.o || {});
  }

  function pose(T, extra) {
    return Object.assign({ T, t: 0, walk: 0, moving: false, atk: 1, back: false, seed: 0 }, extra || {});
  }

  return { drawUnit, pose, rr, ell, lg, rg, fs, humanoid, WEAPONS, ART, wingPair };
})();
