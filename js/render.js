'use strict';
// Battle renderer. Draws a "view state" that comes either from the local sim or from network snapshots.

const LW = 600, TOPH = 64, HEAD = 44, ARENA_Y = TOPH + HEAD, ARENA_X = 12, TSZ = 32;
const ARENA_H = AR.H * TSZ, HUD_Y = ARENA_Y + ARENA_H, HUDH = 200, LH = HUD_Y + HUDH;

class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.flip = false; this.viewerTeam = 0; this.arena = 0;
    this.parts = []; this.fxLines = []; this.banners = []; this.bubbles = []; this.shake = 0; this.t = 0;
    this.bg = null; this.bgKey = '';
    this.resize();
  }

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / LW, vh / LH);
    this.scale = s;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.cv.style.width = Math.floor(LW * s) + 'px';
    this.cv.style.height = Math.floor(LH * s) + 'px';
    this.cv.width = Math.floor(LW * s * dpr); this.cv.height = Math.floor(LH * s * dpr);
    this.bgKey = '';
  }

  setup(opts) {
    this.viewerTeam = opts.team || 0; this.flip = this.viewerTeam === 1; this.arena = opts.arena || 0;
    this.parts = []; this.fxLines = []; this.banners = []; this.bubbles = []; this.bgKey = '';
    this.deathMarks = [];
  }

  // world tile -> logical screen px
  sx(x) { return ARENA_X + (this.flip ? AR.W - x : x) * TSZ; }
  sy(y) { return ARENA_Y + (this.flip ? AR.H - y : y) * TSZ; }
  // logical px -> world tile
  wx(px) { const x = (px - ARENA_X) / TSZ; return this.flip ? AR.W - x : x; }
  wy(py) { const y = (py - ARENA_Y) / TSZ; return this.flip ? AR.H - y : y; }
  teamCol(team) { return TEAM_COLORS[team === this.viewerTeam ? 0 : 1]; }

  buildBg() {
    const key = this.arena + ':' + this.cv.width + ':' + this.flip;
    if (this.bgKey === key) return;
    this.bgKey = key;
    const s = this.scale * this.dpr;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(AR.W * TSZ * s); cv.height = Math.ceil(AR.H * TSZ * s);
    const c = cv.getContext('2d');
    c.scale(s, s);
    if (this.flip) { c.translate(AR.W * TSZ, AR.H * TSZ); c.rotate(Math.PI); }
    WorldArt.drawArena(c, this.arena, 99 + this.arena);
    this.bg = cv;
  }

  // ------------------------------------------------------------------ events -> fx
  onEvents(evs, audio) {
    for (const e of evs) this.onEvent(e, audio);
  }

  onEvent(e, A) {
    const sfx = (n, v) => A && A.play(n, v);
    switch (e.t) {
      case 'play': this.ring(e.x, e.y, 1.2, '#ffffff', 0.4); sfx('deploy'); break;
      case 'landed': this.dust(e.x, e.y, e.air ? 3 : 7); if (!e.air) sfx('land', 0.4); break;
      case 'hit': this.sparks(e.x, e.y, e.k === 'cannonball' ? '#ffd27a' : '#ffffff', 4, e.air ? 1.2 : 0.5); sfx(e.k === 'cannonball' || e.k === 'bomb' ? 'thud' : 'hit', 0.35); break;
      case 'melee': this.sparks(e.x, e.y, '#fff6d0', 5, 0.6); sfx(e.big ? 'thud' : 'slash', 0.4); break;
      case 'zap': this.bolt(e.x0, e.y0 - (e.air ? 1.2 : 0.6), e.x1, e.y1 - 0.5, '#bfe0ff', 0.18); sfx('zap', 0.4); break;
      case 'chain': for (let i = 0; i < e.pts.length - 1; i++) this.bolt(e.pts[i].x, e.pts[i].y - 0.5, e.pts[i + 1].x, e.pts[i + 1].y - 0.5, '#d8ecff', 0.3); sfx('zap', 0.7); break;
      case 'death': this.death(e); sfx(e.bld ? 'crumble' : 'poof', e.bld ? 0.7 : 0.3); break;
      case 'towerdown': this.towerBoom(e); sfx('towerdown', 1); break;
      case 'keepwake': sfx('horn', 0.7); break;
      case 'ability': this.ring(e.x, e.y, 2.5, '#ffe680', 0.5); this.sparks(e.x, e.y, '#ffe680', 18, 1); sfx('ability', 0.8); break;
      case 'cast': this.castFx(e); break;
      case 'fx': this.fx(e, sfx); break;
      case 'double': this.banner('Double Ember!', '#e84ae8'); sfx('horn', 0.8); break;
      case 'triple': this.banner('Triple Ember!', '#ff4ad0'); sfx('horn', 0.8); break;
      case 'overtime': this.banner('Overtime!', '#ffd84a', 'First tower wins'); sfx('horn', 1); break;
      case 'tiebreak': this.banner('Tiebreaker', '#ffd84a', 'Weakest tower falls'); break;
      case 'emote': this.bubbles.push({ team: e.team, pid: e.pid, id: e.id, t: 0 }); sfx('pop', 0.6); break;
    }
  }

  fx(e, sfx) {
    const k = e.k;
    if (k.startsWith('splash_')) {
      const kk = k.slice(7);
      const col = kk === 'frost' ? '#bfeaff' : kk === 'hex' ? '#b8ff7a' : kk === 'volley' ? '#ffb24a' : kk === 'kilnshot' ? '#ff9a4a' : kk === 'thunder' ? '#d8ecff' : '#ffb24a';
      this.ring(e.x, e.y, e.r || 1.5, col, 0.35); this.sparks(e.x, e.y, col, 10, 0.4);
      if (kk === 'thunder') { this.flash = 0.2; sfx('boom', 1); } else sfx(kk === 'frost' ? 'ice' : 'boom', 0.45);
      if (kk !== 'frost' && kk !== 'hex') this.smoke(e.x, e.y, 4);
      return;
    }
    switch (k) {
      case 'volley': this.ring(e.x, e.y, e.r, '#ffb24a', 0.3); for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, r = Math.random() * e.r; this.sparks(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, '#ffd27a', 1, 0.2); } sfx('arrows', 0.8); break;
      case 'spark': this.flash = 0.12; for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, r = Math.random() * (e.r || 2); this.bolt(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r - 6, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, '#d8ecff', 0.25); } this.ring(e.x, e.y, e.r || 2.5, '#bfe0ff', 0.3); sfx('zap', 1); break;
      case 'snow': this.ring(e.x, e.y, e.r, '#ffffff', 0.4); this.sparks(e.x, e.y, '#ffffff', 22, 1); sfx('thud', 0.7); break;
      case 'meteor': case 'shell': case 'boom': case 'fire': case 'blast': case 'ramhit':
        this.ring(e.x, e.y, e.r || 1.5, '#ffb24a', 0.4); this.explosion(e.x, e.y, (e.r || 1.5) * (k === 'shell' ? 1.3 : 1)); this.shake = Math.max(this.shake, k === 'shell' ? 10 : k === 'meteor' ? 6 : 3); sfx(k === 'shell' || k === 'meteor' ? 'bigboom' : 'boom', 0.8); break;
      case 'ice': case 'rime': case 'frostnova': this.ring(e.x, e.y, e.r || 2, '#bfeaff', 0.5); this.sparks(e.x, e.y, '#e8fbff', 20, 1); sfx('ice', 0.8); break;
      case 'heal': case 'healpulse': this.ring(e.x, e.y, e.r || 2, '#7aff9a', 0.5); for (let i = 0; i < 6; i++) this.parts.push({ x: e.x + (Math.random() - 0.5) * 2, y: e.y + (Math.random() - 0.5) * 2, z: 0.3, vx: 0, vy: 0, vz: 1.5, life: 0.8, max: 0.8, col: '#7aff9a', size: 3, kind: 'plus' }); if (k === 'heal') sfx('heal', 0.6); break;
      case 'slam': this.ring(e.x, e.y, e.r || 2.2, '#e8d8b0', 0.4); this.dust(e.x, e.y, 16); this.shake = Math.max(this.shake, 7); sfx('bigboom', 0.7); break;
      case 'bolt': this.flash = 0.18; this.bolt(e.x, e.y - 9, e.x, e.y - 0.3, '#ffffff', 0.35, 3); this.ring(e.x, e.y, 1.2, '#d8ecff', 0.3); sfx('thunder', 1); break;
      case 'popup': this.dust(e.x, e.y, 10); sfx('dig', 0.6); break;
      case 'rise': this.dust(e.x, e.y, 8); sfx('dig', 0.5); break;
      case 'charge': sfx('charge', 0.5); break;
      case 'chargehit': this.ring(e.x, e.y, 1.2, '#ffffff', 0.3); this.sparks(e.x, e.y, '#ffe680', 10, 0.6); sfx('thud', 0.9); break;
      case 'palm': this.ring(e.x, e.y, 1, '#e8d8b0', 0.3); sfx('thud', 0.7); break;
      case 'radiant': this.sparks(e.x, e.y, '#ffe680', 10, 0.6); this.ring(e.x, e.y, 1, '#ffe680', 0.25); sfx('slash', 0.6); break;
      case 'deflect': this.sparks(e.x, e.y, '#ffffff', 6, 0.8); sfx('clang', 0.5); break;
      case 'shieldbreak': this.sparks(e.x, e.y, '#c9ced6', 8, 0.6); sfx('clang', 0.6); break;
      case 'ember': this.parts.push({ x: e.x, y: e.y, z: 1.2, vx: 0, vy: 0, vz: 1.6, life: 1.1, max: 1.1, col: '#e84ae8', size: 6, kind: 'drop' }); if (e.pid === this.viewerPid) sfx('ember', 0.6); break;
      case 'crate': this.dust(e.x, e.y, 8); this.sparks(e.x, e.y, '#c89a5a', 10, 0.5); sfx('crate', 0.7); break;
      case 'dash': sfx('whoosh', 0.6); break;
      case 'zap': sfx('zap', 0.8); break;
    }
  }

  castFx(e) {
    if (e.k === 'thunder') this.flash = 0.1;
    if (e.k === 'frenzy') this.ring(e.x, e.y, e.r, '#e84ae8', 0.5);
    if (e.k === 'mirage') { this.ring(e.x, e.y, e.r, '#7ad8ff', 0.5); this.sparks(e.x, e.y, '#bff0ff', 16, 1); }
  }

  ring(x, y, r, col, life) { this.parts.push({ kind: 'ring', x, y, r, col, life, max: life, z: 0 }); }
  sparks(x, y, col, n, z = 0.5) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 1.5 + Math.random() * 3; this.parts.push({ kind: 'spark', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: Math.random() * 3, life: 0.35 + Math.random() * 0.25, max: 0.6, col, size: 2 + Math.random() * 2 }); }
  }
  dust(x, y, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 0.6 + Math.random() * 1.4; this.parts.push({ kind: 'smoke', x: x + Math.cos(a) * 0.3, y: y + Math.sin(a) * 0.2, z: 0.1, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: 0.3, life: 0.6 + Math.random() * 0.3, max: 0.9, col: '#d8ccb0', size: 6 + Math.random() * 6 }); }
  }
  smoke(x, y, n) {
    for (let i = 0; i < n; i++) this.parts.push({ kind: 'smoke', x: x + (Math.random() - 0.5), y: y + (Math.random() - 0.5) * 0.6, z: 0.4, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.3, vz: 0.8, life: 1, max: 1, col: '#6a6460', size: 8 + Math.random() * 8 });
  }
  explosion(x, y, r) {
    this.parts.push({ kind: 'flash', x, y, z: 0.3, r: r * 1.2, life: 0.22, max: 0.22 });
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, s = Math.random() * 3 * r; this.parts.push({ kind: 'fire', x, y, z: 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 1 + Math.random() * 2, life: 0.4 + Math.random() * 0.3, max: 0.7, size: 7 + Math.random() * 9 * r }); }
    this.smoke(x, y, 5);
  }
  bolt(x0, y0, x1, y1, col, life, w = 2) {
    const pts = [[x0, y0]]; const n = 6;
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([lerp(x0, x1, k) + (Math.random() - 0.5) * 0.6, lerp(y0, y1, k) + (Math.random() - 0.5) * 0.4]); }
    pts.push([x1, y1]);
    this.fxLines.push({ pts, col, life, max: life, w });
  }
  death(e) {
    if (e.bld) { this.explosion(e.x, e.y, 1.2); for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.parts.push({ kind: 'debris', x: e.x, y: e.y, z: 0.5, vx: Math.cos(a) * 3, vy: Math.sin(a) * 2, vz: 3 + Math.random() * 3, life: 1, max: 1, col: '#8a7a6a', size: 4 + Math.random() * 4, rot: Math.random() * 6 }); } return; }
    const col = e.clone ? '#9ae6ff' : '#ffffff';
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28, s = 0.8 + Math.random(); this.parts.push({ kind: 'smoke', x: e.x, y: e.y, z: e.air ? 1.2 : 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: 0.6, life: 0.5, max: 0.5, col, size: 7 }); }
    if (!e.air && !e.clone) this.deathMarks.push({ x: e.x, y: e.y, t: 0, team: e.team });
    if (!e.clone) this.parts.push({ kind: 'soul', x: e.x, y: e.y, z: e.air ? 1.2 : 0.5, vx: 0, vy: 0, vz: 1.2, life: 1, max: 1, col: this.teamCol(e.team).light });
  }
  towerBoom(e) {
    this.explosion(e.x, e.y, 2.2); this.shake = Math.max(this.shake, 14);
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28; this.parts.push({ kind: 'debris', x: e.x, y: e.y, z: 1.5, vx: Math.cos(a) * 4, vy: Math.sin(a) * 3, vz: 3 + Math.random() * 5, life: 1.4, max: 1.4, col: Math.random() < 0.5 ? '#a89c8c' : '#7a6e60', size: 5 + Math.random() * 6, rot: Math.random() * 6 }); }
    if (!e.chain) {
      const mine = e.team === this.viewerTeam;
      this.parts.push({ kind: 'bannerfly', x: e.x, y: e.y, z: 2, life: 1.4, max: 1.4, team: 1 - e.team, mine: !mine });
    }
  }
  banner(text, col, sub) { this.banners.push({ text, col, sub, t: 0, life: 2.4 }); }

  // ------------------------------------------------------------------ main draw
  draw(S, ui, dt) {
    this.t += dt;
    const c = this.c;
    const s = this.scale * this.dpr;
    c.setTransform(s, 0, 0, s, 0, 0);
    c.imageSmoothingEnabled = true;
    this.buildBg();
    const A = ARENAS[this.arena] || ARENAS[0];
    // backdrop
    c.fillStyle = lgColor(c, 0, 0, 0, LH, shade(A.edge, -0.35), shade(A.edge, -0.6));
    c.fillRect(0, 0, LW, LH);
    // shake
    let shx = 0, shy = 0;
    if (this.shake > 0) { shx = (Math.random() - 0.5) * this.shake; shy = (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 40); }
    c.save(); c.translate(shx, shy);
    // arena border
    rrPath(c, ARENA_X - 8, ARENA_Y - HEAD + 4, AR.W * TSZ + 16, ARENA_H + HEAD - 4, 14);
    c.fillStyle = shade(A.edge, -0.1); c.fill();
    c.fillStyle = shade(A.edge, 0.05); c.fillRect(ARENA_X, ARENA_Y - HEAD + 10, AR.W * TSZ, HEAD - 10);
    c.drawImage(this.bg, ARENA_X, ARENA_Y, AR.W * TSZ, ARENA_H);
    c.save(); c.translate(ARENA_X, ARENA_Y);
    if (this.flip) { c.translate(AR.W * TSZ, ARENA_H); c.rotate(Math.PI); }
    WorldArt.drawWater(c, A, this.t);
    c.restore();
    // death marks
    for (const m of this.deathMarks) {
      m.t += dt;
      const a = Math.max(0, 1 - m.t / 4) * 0.35;
      if (a <= 0) continue;
      c.fillStyle = 'rgba(40,30,30,' + a + ')';
      Art.ell(c, this.sx(m.x), this.sy(m.y), 8, 3.5); c.fill();
    }
    this.deathMarks = this.deathMarks.filter(m => m.t < 4);

    if (ui && ui.drag) this.drawPlacement(ui.drag, S);
    this.drawAreas(S.areas);

    // entities
    const ground = [], air = [];
    for (const e of S.ents) {
      if (e.dead && !e.tower) continue;
      (e.air || e.z > 0.5 ? air : ground).push(e);
    }
    for (const e of ground) this.drawShadow(e);
    ground.sort((a, b) => this.sy(a.ry) - this.sy(b.ry));
    for (const e of ground) this.drawEnt(e, S);
    this.drawBeams(S);
    for (const e of air) this.drawShadow(e);
    air.sort((a, b) => this.sy(a.ry) - this.sy(b.ry));
    for (const e of air) this.drawEnt(e, S);
    for (const p of S.projs) this.drawProj(p);
    this.drawParts(dt);
    this.drawLines(dt);
    for (const e of S.ents) this.drawBars(e, S);
    if (ui && ui.drag) this.drawGhost(ui.drag, S);
    this.drawBubbles(S, dt);
    c.restore();

    if (this.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (this.flash * 2.2) + ')'; c.fillRect(0, 0, LW, LH); this.flash -= dt; }
    this.drawBanners(dt);
  }

  drawShadow(e) {
    const c = this.c;
    if (e.underground) return;
    const r = e.tower ? (e.tower === 'keep' ? 0 : 0) : e.r * TSZ * (e.bld ? 0 : 1);
    if (!r) return;
    const x = this.sx(e.rx), y = this.sy(e.ry);
    const col = this.teamCol(e.team);
    c.save();
    c.globalAlpha = e.invisible ? 0.25 : 1;
    if (!e.air) {
      Art.ell(c, x, y, r * 1.05, r * 0.5); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
      Art.ell(c, x, y, r * 1.05, r * 0.5); c.strokeStyle = rgba(col.main, 0.55); c.lineWidth = 1.6; c.stroke();
    } else {
      Art.ell(c, x, y + 4, r * 0.9, r * 0.4); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fill();
    }
    if (e.hero) { Art.ell(c, x, y, r * 1.35, r * 0.65); c.strokeStyle = 'rgba(255,216,74,0.8)'; c.lineWidth = 2; c.stroke(); }
    if (e.asc) { Art.ell(c, x, y, r * 1.3, r * 0.62); c.fillStyle = 'rgba(200,120,255,0.3)'; c.fill(); }
    if (e.rageT > 0) { Art.ell(c, x, y, r * 1.4, r * 0.7); c.fillStyle = 'rgba(232,74,232,0.35)'; c.fill(); }
    c.restore();
  }

  drawEnt(e, S) {
    const c = this.c;
    const x = this.sx(e.rx), y = this.sy(e.ry);
    const T = this.teamCol(e.team);
    if (e.tower) {
      c.save(); c.translate(x, y + (e.tower === 'keep' ? 30 : 20));
      const view = { back: this.flip ? e.team === 0 : e.team === 1, dx: this.flip ? -e.dirX : e.dirX, dy: this.flip ? -e.dirY : e.dirY };
      if (e.dead) WorldArt.drawRubble(c, e, T, e.tower === 'keep');
      else if (e.tower === 'keep') WorldArt.drawKeep(c, e, T, this.t, view);
      else WorldArt.drawSideTower(c, e, T, this.t, view);
      c.restore();
      return;
    }
    if (e.underground) {
      c.save(); c.translate(x, y);
      Art.ell(c, 0, 0, 10, 5); c.fillStyle = '#6a5038'; c.fill(); Art.ell(c, 0, -2, 7, 4); c.fillStyle = '#8a6a4a'; c.fill();
      if (Math.random() < 0.3) this.parts.push({ kind: 'smoke', x: e.rx, y: e.ry, z: 0, vx: 0, vy: 0, vz: 0.2, life: 0.5, max: 0.5, col: '#8a6a4a', size: 5 });
      c.restore(); return;
    }
    const sdx = this.flip ? -e.dirX : e.dirX, sdy = this.flip ? -e.dirY : e.dirY;
    const back = sdy < -0.15;
    const flipX = sdx < -0.12;
    c.save();
    c.translate(x, y - (e.z || 0) * TSZ);
    let alpha = 1;
    if (e.invisible || e.veilT > 0) alpha = e.team === this.viewerTeam ? 0.4 : 0.12;
    if (e.deployT > 0) {
      const k = e.deployT / (e.deployMax || 1);
      alpha *= 1 - k * 0.55;
      if (!e.bld) c.translate(0, -k * k * 40);
    }
    if (e.clone) alpha *= 0.8;
    c.globalAlpha = alpha;
    if (e.hitFlash > 0) c.filter = 'brightness(1.9)';
    else if (e.freezeT > 0) c.filter = 'saturate(0.3) brightness(1.25) hue-rotate(180deg)';
    else if (e.clone) c.filter = 'hue-rotate(160deg) saturate(1.6) brightness(1.2)';
    if (e.bld) {
      const view = { dx: sdx, dy: sdy };
      WorldArt.drawBuilding(c, e, T, this.t, view);
    } else {
      if (flipX) c.scale(-1, 1);
      const moving = e.state === 'walk' && !(e.stunT > 0) && !(e.freezeT > 0);
      const atk = Math.min(1, (e.atkT || 9) / 0.38);
      const P = { T, t: this.t + e.id * 0.37, walk: e.walkT * 1.6, moving, atk, back, seed: e.id, charge: e.chargeFrac || 0 };
      if (e.chain || e.dashing) c.globalAlpha = alpha * 0.85;
      Art.drawUnit(c, e.kind, P);
    }
    c.filter = 'none';
    c.globalAlpha = 1;
    // status overlays
    if (e.freezeT > 0) {
      c.save(); c.globalAlpha = 0.55; Art.ell(c, 0, -14, e.r * TSZ * 1.1, 18); c.fillStyle = 'rgba(190,235,255,0.6)'; c.fill(); c.strokeStyle = '#e8fbff'; c.lineWidth = 1.5; c.stroke(); c.restore();
    }
    if (e.stunT > 0 && !(e.freezeT > 0)) {
      for (let i = 0; i < 3; i++) { const a = this.t * 6 + i * 2.1; star(c, Math.cos(a) * 8, -40 + Math.sin(a) * 3, 3, '#ffe36a'); }
    }
    if (e.slowT > 0 && !(e.freezeT > 0)) { c.fillStyle = 'rgba(160,220,255,0.9)'; c.font = 'bold 10px sans-serif'; c.fillText('❄', 6, -38); }
    if (e.deflectT > 0) { c.save(); Art.ell(c, 0, -18, 18, 22); c.strokeStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(this.t * 10) * 0.3) + ')'; c.lineWidth = 2.5; c.stroke(); c.restore(); }
    if (e.charging) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-10 + i * 6, 2); c.lineTo(-14 + i * 6, 10); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.stroke(); } }
    c.restore();
    // deploy timer
    if (e.deployT > 0 && e.team === this.viewerTeam && !e.bld) {
      const k = e.deployT / (e.deployMax || 1);
      c.save(); c.translate(x, y);
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.closePath(); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      c.restore();
    }
  }

  drawBeams(S) {
    const c = this.c;
    for (const e of S.ents) {
      if (!e.beam || e.dead) continue;
      const t = S.byId.get(e.beam);
      if (!t || t.dead) continue;
      const stage = e.rampT < 2 ? 0 : e.rampT < 4 ? 1 : 2;
      const x0 = this.sx(e.rx), y0 = this.sy(e.ry) - (e.bld ? 54 : e.air ? 34 + 4 : 20), x1 = this.sx(t.rx), y1 = this.sy(t.ry) - (t.air ? 36 : 14);
      c.save(); c.globalCompositeOperation = 'lighter';
      const w = [3, 6, 10][stage];
      c.strokeStyle = 'rgba(255,120,30,0.5)'; c.lineWidth = w + 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = 'rgba(255,240,180,0.9)'; c.lineWidth = w * 0.45; c.stroke();
      c.restore();
    }
  }

  drawProj(p) {
    const c = this.c;
    const x = this.sx(p.rx), y = this.sy(p.ry) - (p.z || 0) * TSZ;
    const dx = (p.rx - (p.ox != null ? p.ox : p.rx)), dy = (p.ry - (p.oy != null ? p.oy : p.ry));
    let ang = p.ang != null ? p.ang : Math.atan2(this.flip ? -dy : dy, this.flip ? -dx : dx);
    if (p.lob || p.line) { /* lobbed things face their travel */ }
    // shadow
    if ((p.z || 0) > 0.2 && p.k !== 'log') { Art.ell(c, x, this.sy(p.ry), 5, 2.4); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill(); }
    c.save(); c.translate(x, y);
    if (p.k === 'log' || p.k === 'boulder') ang = Math.atan2(this.flip ? -p.dy : p.dy, this.flip ? -p.dx : p.dx);
    WorldArt.drawProj(c, p, this.teamCol(p.team), p.k === 'log' ? 0 : ang, this.t);
    c.restore();
    if (p.k === 'meteor' || p.k === 'fireball' || p.k === 'shell') if (Math.random() < 0.6) this.parts.push({ kind: 'smoke', x: p.rx, y: p.ry, z: p.z || 0, vx: 0, vy: 0, vz: 0.2, life: 0.5, max: 0.5, col: '#5a504a', size: 6 });
  }

  drawAreas(areas) {
    const c = this.c;
    for (const a of areas) {
      const x = this.sx(a.x), y = this.sy(a.y), r = a.r * TSZ;
      const k = a.t / a.life;
      c.save();
      switch (a.k) {
        case 'frenzy': {
          const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(232,74,232,0.05)'); g.addColorStop(1, 'rgba(232,74,232,0.35)');
          Art.ell(c, x, y, r, r * 0.85); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,160,255,0.7)'; c.lineWidth = 2; c.stroke();
          for (let i = 0; i < 5; i++) { const aa = this.t * 1.5 + i * 1.26; const px = x + Math.cos(aa) * r * 0.7, py = y + Math.sin(aa) * r * 0.6 - ((this.t * 30 + i * 20) % 30); c.fillStyle = 'rgba(255,170,255,0.7)'; Art.ell(c, px, py, 2.5, 2.5); c.fill(); }
          break;
        }
        case 'rime': Art.ell(c, x, y, r, r * 0.85); c.fillStyle = 'rgba(200,240,255,' + (0.35 * (1 - k) + 0.1) + ')'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.stroke(); break;
        case 'blight': {
          for (let i = 0; i < 9; i++) { const aa = i * 0.7 + this.t * 0.4, rr2 = (i % 3) / 3 * r * 0.7; Art.ell(c, x + Math.cos(aa) * rr2, y + Math.sin(aa) * rr2 * 0.8, r * 0.45, r * 0.32); c.fillStyle = 'rgba(120,190,60,0.18)'; c.fill(); }
          Art.ell(c, x, y, r, r * 0.85); c.strokeStyle = 'rgba(160,230,90,0.6)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
          break;
        }
        case 'tremor': {
          Art.ell(c, x, y, r, r * 0.85); c.fillStyle = 'rgba(90,60,30,0.2)'; c.fill();
          c.strokeStyle = 'rgba(50,30,15,0.6)'; c.lineWidth = 2;
          for (let i = 0; i < 6; i++) { const aa = i * 1.05; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(aa) * r * 0.5, y + Math.sin(aa) * r * 0.4 + 3); c.lineTo(x + Math.cos(aa + 0.2) * r * 0.9, y + Math.sin(aa + 0.2) * r * 0.75); c.stroke(); }
          if (Math.random() < 0.3) this.dust(this.wx(x + (Math.random() - 0.5) * r * 1.6), this.wy(y + (Math.random() - 0.5) * r * 1.2), 1);
          break;
        }
        case 'vortex': {
          c.translate(x, y);
          for (let i = 0; i < 4; i++) { c.save(); c.rotate(-this.t * 6 + i * Math.PI / 2); c.beginPath(); c.arc(0, 0, r * (0.3 + i * 0.18), 0, Math.PI * 1.2); c.strokeStyle = 'rgba(220,235,245,' + (0.6 - i * 0.1) + ')'; c.lineWidth = 3; c.stroke(); c.restore(); }
          break;
        }
        case 'haunting': {
          Art.ell(c, x, y, r, r * 0.85); c.fillStyle = 'rgba(40,20,60,0.25)'; c.fill(); c.strokeStyle = 'rgba(160,120,220,0.5)'; c.lineWidth = 2; c.stroke();
          for (let i = 0; i < 4; i++) { const aa = this.t * 0.6 + i * 1.6; Art.ell(c, x + Math.cos(aa) * r * 0.6, y + Math.sin(aa) * r * 0.5, 14, 6); c.fillStyle = 'rgba(180,160,220,0.15)'; c.fill(); }
          break;
        }
        case 'keg': case 'dropbomb': {
          const blink = Math.sin(this.t * (10 + k * 30)) > 0;
          if (a.k === 'dropbomb') { const z = (1 - k) * 2 * TSZ; Art.ell(c, x, y, 6, 3); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill(); c.translate(x, y - z); WorldArt.drawProj(c, { k: 'bomb' }, this.teamCol(a.team), 0, this.t); }
          else { c.translate(x, y); Art.rr(c, -8, -14, 16, 16, 4); Art.fs(c, '#7a5232', 1.3); Art.ell(c, 0, -16, 3, 3); c.fillStyle = blink ? '#ff4a2a' : '#ffe36a'; c.fill(); Art.ell(c, 0, 0, r, r * 0.8); c.strokeStyle = 'rgba(255,80,40,' + (0.3 + k * 0.5) + ')'; c.lineWidth = 2; c.setLineDash([5, 5]); c.stroke(); c.setLineDash([]); }
          break;
        }
      }
      c.restore();
    }
  }

  drawParts(dt) {
    const c = this.c;
    const keep = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      keep.push(p);
      const k = 1 - p.life / p.max;
      if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.kind === 'debris' || p.kind === 'spark') { p.vz -= 12 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } } else { p.vx *= 0.94; p.vy *= 0.94; } }
      const x = this.sx(p.x), y = this.sy(p.y) - p.z * TSZ;
      c.save();
      switch (p.kind) {
        case 'ring': Art.ell(c, x, this.sy(p.y), p.r * TSZ * (0.4 + k * 0.7), p.r * TSZ * 0.8 * (0.4 + k * 0.7)); c.strokeStyle = rgba(p.col, 1 - k); c.lineWidth = 4 * (1 - k) + 1; c.stroke(); break;
        case 'spark': c.globalCompositeOperation = 'lighter'; Art.ell(c, x, y, p.size * (1 - k * 0.5), p.size * (1 - k * 0.5)); c.fillStyle = rgba(p.col, 1 - k); c.fill(); break;
        case 'smoke': Art.ell(c, x, y, p.size * (0.6 + k), p.size * (0.5 + k * 0.8)); c.fillStyle = rgba(p.col, 0.45 * (1 - k)); c.fill(); break;
        case 'fire': { c.globalCompositeOperation = 'lighter'; const s2 = p.size * (1 - k * 0.6); Art.ell(c, x, y, s2, s2); c.fillStyle = `rgba(255,${Math.floor(200 - k * 150)},${Math.floor(80 - k * 60)},${0.85 * (1 - k)})`; c.fill(); break; }
        case 'flash': { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, p.r * TSZ); g.addColorStop(0, `rgba(255,250,220,${1 - k})`); g.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = g; Art.ell(c, x, y, p.r * TSZ, p.r * TSZ * 0.8); c.fill(); break; }
        case 'debris': c.translate(x, y); c.rotate((p.rot || 0) + k * 8); c.fillStyle = p.col; c.globalAlpha = Math.min(1, p.life * 2); c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); break;
        case 'plus': c.fillStyle = rgba(p.col, 1 - k); c.fillRect(x - 1, y - 4, 2, 8); c.fillRect(x - 4, y - 1, 8, 2); break;
        case 'soul': c.globalCompositeOperation = 'lighter'; Art.ell(c, x, y, 4, 5); c.fillStyle = rgba(p.col, 0.6 * (1 - k)); c.fill(); break;
        case 'drop': c.translate(x, y); c.globalAlpha = 1 - k; dropShape(c, 0, 0, p.size); break;
        case 'bannerfly': {
          // a banner flies from the destroyed tower toward the score display
          const tx = LW - 30, ty = p.mine ? ARENA_Y + ARENA_H / 2 + 60 : ARENA_Y + ARENA_H / 2 - 60;
          const ek = easeInOut(Math.min(1, k * 1.3));
          const bx = lerp(this.sx(p.x), tx, ek), by = lerp(this.sy(p.y) - 60, ty, ek) - Math.sin(ek * Math.PI) * 80;
          c.translate(bx, by); c.scale(1.6 - ek * 0.6, 1.6 - ek * 0.6);
          bannerIcon(c, p.mine ? TEAM_COLORS[0] : TEAM_COLORS[1]);
          break;
        }
      }
      c.restore();
    }
    this.parts = keep.length > 900 ? keep.slice(-900) : keep;
  }

  drawLines(dt) {
    const c = this.c;
    this.fxLines = this.fxLines.filter(l => (l.life -= dt) > 0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const l of this.fxLines) {
      const a = l.life / l.max;
      c.beginPath(); l.pts.forEach(([x, y], i) => i ? c.lineTo(this.sx(x), this.sy(y)) : c.moveTo(this.sx(x), this.sy(y)));
      c.strokeStyle = rgba(l.col, 0.4 * a); c.lineWidth = l.w * 3; c.stroke();
      c.strokeStyle = rgba('#ffffff', a); c.lineWidth = l.w; c.stroke();
    }
    c.restore();
  }

  drawBars(e, S) {
    if (e.dead || e.underground) return;
    const c = this.c;
    const mine = e.team === this.viewerTeam;
    if ((e.invisible || e.veilT > 0) && !mine) return;
    const x = this.sx(e.rx), y = this.sy(e.ry) - (e.z || 0) * TSZ;
    if (e.tower) {
      const w = e.tower === 'keep' ? 74 : 58;
      const yy = y + (e.tower === 'keep' ? -112 : -82);
      hpBar(c, x - w / 2, yy, w, 9, e.hp / e.maxHp, mine, Math.ceil(e.hp));
      lvlBadge(c, x - w / 2 - 9, yy + 4.5, e.lvl, mine);
      return;
    }
    const damaged = e.hp < e.maxHp - 0.5 || (e.maxShield && e.shield < e.maxShield);
    if (!damaged && !e.bld && !mine) return;
    const h = e.bld ? 56 : e.air ? 52 : (e.r > 0.6 ? 58 : e.r > 0.45 ? 44 : 34);
    const w = clamp(e.r * 46, 18, 42);
    const yy = y - h;
    if (!damaged && !e.bld) { lvlBadge(c, x - w / 2 - 3, yy + 2, e.lvl, mine, true); return; }
    hpBar(c, x - w / 2, yy, w, 5, e.hp / e.maxHp, mine);
    if (e.maxShield && e.shield > 0) { c.fillStyle = '#e8edf3'; c.fillRect(x - w / 2, yy - 4, w * e.shield / e.maxShield, 3); }
    lvlBadge(c, x - w / 2 - 3, yy + 2.5, e.lvl, mine, true);
    if (e.kind === 'bone_monarch' && e.souls) { c.fillStyle = '#7affd0'; c.font = 'bold 9px sans-serif'; c.fillText('✦' + e.souls, x + w / 2 + 2, yy + 5); }
  }

  drawBubbles(S, dt) {
    const c = this.c;
    this.bubbles = this.bubbles.filter(b => (b.t += dt) < 2.6);
    for (const b of this.bubbles) {
      const mine = b.team === this.viewerTeam;
      const em = EMOTES.find(x => x.id === b.id) || EMOTES[0];
      const x = mine ? 140 : LW - 160, y = mine ? HUD_Y - 70 : ARENA_Y + 40;
      const k = Math.min(1, b.t * 6), fade = b.t > 2.2 ? 1 - (b.t - 2.2) / 0.4 : 1;
      c.save(); c.globalAlpha = fade; c.translate(x, y); c.scale(k, k);
      rrPath(c, -64, -34, 128, 68, 16); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.moveTo(mine ? -30 : 30, mine ? 32 : -32); c.lineTo(mine ? -46 : 46, mine ? 50 : -50); c.lineTo(mine ? -12 : 12, mine ? 32 : -32); c.closePath(); c.fill();
      emoteFace(c, -34, 0, 20, em.face, this.t);
      c.fillStyle = OUT; c.font = '17px "Lilita One", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      wrapText(c, em.text, -8, 0, 66, 18);
      c.restore();
    }
  }

  drawBanners(dt) {
    const c = this.c;
    this.banners = this.banners.filter(b => (b.t += dt) < b.life);
    const b = this.banners[0];
    if (!b) return;
    const k = b.t < 0.3 ? easeOut(b.t / 0.3) : b.t > b.life - 0.4 ? (b.life - b.t) / 0.4 : 1;
    c.save(); c.globalAlpha = k;
    const y = ARENA_Y + ARENA_H / 2;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, y - 46, LW, b.sub ? 92 : 76);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '46px "Lilita One", sans-serif'; c.lineWidth = 7; c.strokeStyle = OUT; c.strokeText(b.text, LW / 2, y - (b.sub ? 10 : -4)); c.fillStyle = b.col; c.fillText(b.text, LW / 2, y - (b.sub ? 10 : -4));
    if (b.sub) { c.font = '22px "Lilita One", sans-serif'; c.lineWidth = 4; c.strokeText(b.sub, LW / 2, y + 28); c.fillStyle = '#fff'; c.fillText(b.sub, LW / 2, y + 28); }
    c.restore();
  }

  // ------------------------------------------------------------------ placement UI
  drawPlacement(drag, S) {
    const c = this.c;
    const card = drag.card;
    if (!card || card.type === 'spell' || card.anywhere || !drag.overArena) return;
    c.save();
    c.fillStyle = 'rgba(220,40,40,0.22)';
    for (let ty = 0; ty < AR.H; ty++) for (let tx = 0; tx < AR.W; tx++) {
      const wx = tx + 0.5, wy = ty + 0.5;
      if (!S.canPlace(card, wx, wy)) c.fillRect(this.sx(this.flip ? wx + 0.5 : wx - 0.5), this.sy(this.flip ? wy + 0.5 : wy - 0.5), TSZ, TSZ);
    }
    c.restore();
  }

  drawGhost(drag, S) {
    if (!drag.overArena || !drag.card) return;
    const c = this.c;
    const card = drag.card;
    const x = this.sx(drag.wx), y = this.sy(drag.wy);
    const ok = drag.valid;
    const T = TEAM_COLORS[0];
    c.save();
    if (card.type === 'spell') {
      const r = (card.r || 1) * TSZ;
      Art.ell(c, x, y, r, r * 0.85); c.fillStyle = ok ? 'rgba(255,255,255,0.18)' : 'rgba(255,60,60,0.2)'; c.fill();
      c.strokeStyle = ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.9)'; c.lineWidth = 2.5; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
      if (card.spell === 'log') { const len = card.len * TSZ * (this.flip ? -1 : 1) * (S.myTeam === 0 ? 1 : -1); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x - r, y - len, r * 2, len); }
    } else {
      c.globalAlpha = 0.65;
      if (!ok) c.filter = 'grayscale(1) brightness(0.8)';
      if (card.type === 'building') {
        c.fillStyle = ok ? 'rgba(255,255,255,0.2)' : 'rgba(255,60,60,0.25)'; c.fillRect(x - TSZ, y - TSZ, TSZ * 2, TSZ * 2);
        c.translate(x, y); WorldArt.drawBuilding(c, { kind: card.unit, atkT: 9, rampT: 0, hiddenState: 0, genT: 8, def: UNITS[card.unit], id: 1 }, T, this.t, { dx: 0, dy: -1 });
      } else {
        const n = card.form === 'split' ? 0 : (card.count || 1);
        const form = FORMATIONS[n] || [];
        const spread = UNITS[card.unit].r > 0.5 ? 1.3 : 1;
        const pts = card.form === 'split' ? [1.5, 4, 6.5, 11.5, 14, 16.5].map((sx2, i) => [this.sx(sx2), y + (i % 2 ? 0.4 : -0.4) * TSZ]) : form.map(([ox, oy]) => [x + ox * spread * TSZ, y + oy * spread * TSZ]);
        pts.sort((a, b) => a[1] - b[1]);
        for (const [px, py] of pts) {
          c.save(); c.translate(px, py);
          Art.ell(c, 0, 0, UNITS[card.unit].r * TSZ, UNITS[card.unit].r * TSZ * 0.5); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
          Art.drawUnit(c, card.unit, Art.pose(T, { t: this.t, back: true }));
          c.restore();
        }
      }
      c.filter = 'none';
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- small helpers shared with the HUD
function rrPath(c, x, y, w, h, r) { Art.rr(c, x, y, w, h, r); }
function lgColor(c, x0, y0, x1, y1, a, b) { return Art.lg(c, x0, y0, x1, y1, a, b); }
function star(c, x, y, r, col) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
}
function hpBar(c, x, y, w, h, frac, mine, num) {
  frac = clamp(frac, 0, 1);
  rrPath(c, x - 1, y - 1, w + 2, h + 2, 3); c.fillStyle = 'rgba(20,16,28,0.85)'; c.fill();
  if (frac > 0) { rrPath(c, x, y, Math.max(2, w * frac), h, 2.5); c.fillStyle = mine ? Art.lg(c, 0, y, 0, y + h, '#8fd0ff', '#2f7de1') : Art.lg(c, 0, y, 0, y + h, '#ff9a8a', '#d6342c'); c.fill(); }
  if (num != null) {
    c.font = '11px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3; c.strokeStyle = OUT; c.strokeText(fmtNum(num), x + w / 2, y + h / 2 + 0.5); c.fillStyle = '#fff'; c.fillText(fmtNum(num), x + w / 2, y + h / 2 + 0.5);
  }
}
function lvlBadge(c, x, y, lvl, mine, small) {
  const r = small ? 5 : 8;
  Art.ell(c, x, y, r, r); c.fillStyle = mine ? '#2f7de1' : '#d6342c'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
  c.font = (small ? 8 : 11) + 'px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(String(lvl || 1), x, y + 0.5);
}
function dropShape(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y - s * 1.2); c.bezierCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.9, y + s * 0.8, x, y + s * 0.8); c.bezierCurveTo(x - s * 0.9, y + s * 0.8, x - s * 0.9, y - s * 0.2, x, y - s * 1.2); c.closePath();
  c.fillStyle = Art.lg(c, x, y - s, x, y + s, '#ffb0ff', '#b81ab8'); c.fill(); c.strokeStyle = OUT; c.lineWidth = Math.max(1, s * 0.15); c.stroke();
  Art.ell(c, x - s * 0.3, y - s * 0.1, s * 0.18, s * 0.28); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
}
function bannerIcon(c, T, s = 1) {
  c.save(); c.scale(s, s);
  c.beginPath(); c.moveTo(-10, -14); c.lineTo(10, -14); c.lineTo(10, 10); c.lineTo(0, 4); c.lineTo(-10, 10); c.closePath();
  c.fillStyle = Art.lg(c, 0, -14, 0, 10, T.light, T.dark); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  star(c, 0, -4, 5, '#ffe36a');
  c.restore();
}
function wrapText(c, text, x, y, maxW, lh) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => c.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
}
function emoteFace(c, x, y, r, face, t) {
  c.save(); c.translate(x, y);
  // the mascot: a round little keep-knight with a helmet visor
  Art.ell(c, 0, 0, r, r); c.fillStyle = Art.rg(c, 0, 0, r, '#ffe0b8', '#e8a870'); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(0, -2, r * 1.02, Math.PI * 1.05, -0.05 * Math.PI); c.closePath(); c.fillStyle = Art.lg(c, 0, -r, 0, 0, '#dfe5ec', '#8a95a3'); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-3, -r - 2); c.quadraticCurveTo(4, -r - 12, 10, -r - 6); c.quadraticCurveTo(4, -r - 6, 2, -r + 1); c.closePath(); c.fillStyle = '#3b7fe0'; c.fill(); c.stroke();
  const eye = (ex, kind) => {
    if (kind === 'closed') { c.beginPath(); c.arc(ex, 3, 3, Math.PI, 0); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); return; }
    if (kind === 'x') { c.beginPath(); c.moveTo(ex - 2.5, 0.5); c.lineTo(ex + 2.5, 5.5); c.moveTo(ex + 2.5, 0.5); c.lineTo(ex - 2.5, 5.5); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); return; }
    Art.ell(c, ex, 3, kind === 'big' ? 3.4 : 2.4, kind === 'big' ? 4 : 3); c.fillStyle = OUT; c.fill(); Art.ell(c, ex + 0.8, 2, 0.9, 0.9); c.fillStyle = '#fff'; c.fill();
  };
  const mouth = (kind) => {
    c.beginPath();
    if (kind === 'smile') { c.arc(0, 8, 5, 0.2, Math.PI - 0.2); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    else if (kind === 'open') { Art.ell(c, 0, 10, 4, 4.5); c.fillStyle = '#7a2a2a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); }
    else if (kind === 'laugh') { c.arc(0, 8, 6, 0, Math.PI); c.closePath(); c.fillStyle = '#7a2a2a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); }
    else if (kind === 'frown') { c.arc(0, 13, 5, Math.PI + 0.3, -0.3); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    else if (kind === 'wavy') { c.moveTo(-5, 10); c.quadraticCurveTo(-2.5, 7, 0, 10); c.quadraticCurveTo(2.5, 13, 5, 10); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
  };
  switch (face) {
    case 'happy': eye(-6, 'closed'); eye(6, 'closed'); mouth('smile'); break;
    case 'thumbs': eye(-6); eye(6); mouth('smile'); c.save(); c.translate(r * 0.9, 6); Art.rr(c, -4, -4, 8, 9, 3); c.fillStyle = '#ffe0b8'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); Art.rr(c, -1.5, -11, 4, 8, 2); c.fill(); c.stroke(); c.restore(); break;
    case 'wow': eye(-6, 'big'); eye(6, 'big'); mouth('open'); break;
    case 'oops': eye(-6); eye(6, 'closed'); mouth('wavy'); Art.ell(c, r * 0.75, -4, 2.5, 3.5); c.fillStyle = '#7ad8ff'; c.fill(); break;
    case 'laugh': eye(-6, 'closed'); eye(6, 'closed'); mouth('laugh'); if (Math.sin(t * 20) > 0) c.translate(0, -1); break;
    case 'cry': eye(-6, 'closed'); eye(6, 'closed'); mouth('frown'); for (const s of [-1, 1]) { Art.ell(c, s * 7, 9 + (t * 20 % 8), 1.8, 2.6); c.fillStyle = '#7ad8ff'; c.fill(); } break;
    case 'angry': eye(-6); eye(6); mouth('frown'); c.beginPath(); c.moveTo(-10, -3); c.lineTo(-3, 0); c.moveTo(10, -3); c.lineTo(3, 0); c.strokeStyle = OUT; c.lineWidth = 2.4; c.stroke(); c.fillStyle = 'rgba(255,60,60,0.3)'; Art.ell(c, 0, 4, r * 0.8, r * 0.5); c.fill(); break;
  }
  c.restore();
}
