'use strict';
// Battle controller: runs a local/hosted simulation or mirrors a remote host, and feeds the renderer + HUD.

const SNAP_HZ = 15;
const FLAG = { air: 1, bld: 2, dead: 4, stun: 8, freeze: 16, slow: 32, rage: 64, invis: 128, clone: 256, asc: 512, charging: 1024, hero: 2048, under: 4096, deflect: 8192, veil: 16384, flash: 32768, active: 65536, hid1: 131072, hid2: 262144, chain: 524288 };

function entFlags(e) {
  let f = 0;
  if (e.air) f |= FLAG.air; if (e.bld) f |= FLAG.bld; if (e.dead) f |= FLAG.dead; if (e.stunT > 0) f |= FLAG.stun;
  if (e.freezeT > 0) f |= FLAG.freeze; if (e.slowT > 0) f |= FLAG.slow; if (e.rageT > 0) f |= FLAG.rage; if (e.invisible) f |= FLAG.invis;
  if (e.clone) f |= FLAG.clone; if (e.asc) f |= FLAG.asc; if (e.charging) f |= FLAG.charging; if (e.hero) f |= FLAG.hero;
  if (e.underground) f |= FLAG.under; if (e.deflectT > 0) f |= FLAG.deflect; if (e.veilT > 0) f |= FLAG.veil; if (e.hitFlash > 0) f |= FLAG.flash;
  if (e.active) f |= FLAG.active; if (e.hiddenState === 1) f |= FLAG.hid1; if (e.hiddenState === 2) f |= FLAG.hid2; if (e.chain || e.dashing) f |= FLAG.chain;
  return f;
}

function chargeFrac(e) {
  if (e.kind !== 'thunder_engine' || e.state !== 'attack') return 0;
  return clamp(1 - e.atkCD / (e.hs || 4), 0, 1);
}

function encodeSnap(b, pid, evs) {
  const r = v => Math.round(v * 100);
  const e = [];
  for (const x of b.ents) {
    if (x.dead && !x.tower) continue;
    const ki = x.tower ? (x.tower === 'keep' ? -2 : -1) : UNITS[x.kind].idx;
    const extra = x.kind === 'thunder_engine' ? r(chargeFrac(x)) : x.souls != null ? x.souls : x.genT != null ? r(x.genT) : x.ammo != null ? x.ammo : x.riseT != null ? r(Math.max(0, x.riseT)) : 0;
    e.push([x.id, ki, x.team, x.owner, r(x.x), r(x.y), Math.ceil(x.hp), Math.ceil(x.maxHp), Math.ceil(x.shield || 0), Math.ceil(x.maxShield || 0), entFlags(x),
      Math.round(Math.atan2(x.dirY, x.dirX) * 40), x.state === 'walk' ? 1 : x.state === 'attack' ? 2 : 0, x.lvl || 1, Math.min(999, r(x.atkT)), r(x.z || 0),
      r(Math.max(0, x.deployT || 0)), r(x.deployMax || 1), Math.round((x.rampT || 0) * 10), x.beam || 0, extra]);
  }
  const p = b.projs.map(x => [x.id, x.k, x.team, r(x.x), r(x.y), r(x.z || 0), r(x.dx || 0), r(x.dy || 0), r(x.w || 0), x.lob ? 1 : 0]);
  const a = b.areas.map(x => [x.id, x.k, x.team, r(x.x), r(x.y), r(x.r), r(x.t), r(x.life)]);
  const me = b.players[pid];
  const hand = me.hand.map((cid, i) => { const c = b.cardFor(me, i); return c ? [cid, c.card.id, c.cost] : null; });
  return {
    t: 's', tk: b.tick, tm: Math.round(b.t * 100), tl: Math.round(b.timeLeft() * 100), ph: b.phase, em: b.emberPhase(), bn: b.banners, ov: b.over ? 1 : 0, w: b.winner, rs: b.endReason,
    e, p, a, ev: evs,
    me: { h: hand, n: me.queue[0], e: Math.round(me.ember * 100), ac: Math.round(me.abilCD * 100), hc: me.heroCard, ha: me.heroEnt && !me.heroEnt.dead && me.heroEnt.deployT <= 0 ? 1 : 0, ac2: me.ascCnt, as: Object.keys(me.asc), lc: me.lastCard },
    st: b.players.map(q => q.stats),
  };
}

// ---------------------------------------------------------------- state sources
class LocalSource {
  constructor(b, pid) { this.b = b; this.pid = pid; this.byId = new Map(); }
  state(alpha) {
    const b = this.b, p = b.players[this.pid];
    this.byId.clear();
    for (const e of b.ents) {
      e.rx = lerp(e.px, e.x, alpha); e.ry = lerp(e.py, e.y, alpha);
      e.chargeFrac = chargeFrac(e);
      this.byId.set(e.id, e);
    }
    for (const pr of b.projs) { pr.rx = lerp(pr.px, pr.x, alpha); pr.ry = lerp(pr.py, pr.y, alpha); pr.ox = pr.px; pr.oy = pr.py; }
    const hand = p.hand.map((cid, i) => {
      const c = b.cardFor(p, i); if (!c) return null;
      return { cid, card: c.card, cost: c.cost, echo: !!c.echo, ascNeed: p.asc[cid] ? ASC_CYCLES : 0, ascProg: p.ascCnt[cid] || 0, ascReady: !!p.asc[cid] && (p.ascCnt[cid] || 0) >= ASC_CYCLES };
    });
    let abil = null;
    if (p.heroEnt && !p.heroEnt.dead && p.heroEnt.deployT <= 0 && p.heroCard) {
      const ab = CARD[p.heroCard].ability;
      abil = { card: p.heroCard, cost: ab.cost, cd: Math.max(0, p.abilCD), cdMax: ab.cd, name: ab.name };
    }
    return {
      ents: b.ents, byId: this.byId, projs: b.projs, areas: b.areas,
      t: b.t, timeLeft: b.timeLeft(), phase: b.phase, emberPhase: b.emberPhase(), over: b.over,
      banners: p.team === 0 ? b.banners : [b.banners[1], b.banners[0]], myTeam: p.team,
      me: { hand, next: p.queue[0], ember: p.ember, lastCard: p.lastCard, abil },
      canPlace: (card, x, y) => b.canPlace(p, card, x, y),
    };
  }
}

class RemoteSource {
  constructor(pid, team) {
    this.pid = pid; this.team = team; this.map = new Map(); this.projMap = new Map(); this.areas = []; this.byId = new Map();
    this.last = null; this.at = 0; this.interval = 1000 / SNAP_HZ; this.me = { hand: [], next: null, ember: 0, lastCard: null, abil: null };
    this.towers = [];
  }
  apply(s) {
    const now = performance.now();
    if (this.at) this.interval = clamp(lerp(this.interval, now - this.at, 0.3), 30, 250);
    this.at = now;
    const seen = new Set();
    for (const a of s.e) {
      const [id, ki, team, owner, x, y, hp, maxHp, sh, msh, fl, ang, st, lvl, atkT, z, dep, depMax, ramp, beam, extra] = a;
      let e = this.map.get(id);
      const X = x / 100, Y = y / 100;
      if (!e) {
        e = { id, x0: X, y0: Y, x: X, y: Y, walkT: Math.random() * 3, r: 0.5 };
        if (ki < 0) { e.tower = ki === -2 ? 'keep' : 'side'; e.kind = e.tower; e.r = ki === -2 ? TOWER.keep.r : TOWER.side.r; e.lane = ki === -2 ? -1 : (X < 9 ? 0 : 1); }
        else { e.kind = UNIT_KEYS[ki]; e.def = UNITS[e.kind]; e.r = e.def.r; }
        this.map.set(id, e);
      }
      e.x0 = e.x; e.y0 = e.y; e.x = X; e.y = Y;
      Object.assign(e, { team, owner, hp, maxHp, shield: sh, maxShield: msh, lvl, z: z / 100, deployT: dep / 100, deployMax: depMax / 100, rampT: ramp / 10, beam });
      e.atkT = atkT / 100;
      e.dirX = Math.cos(ang / 40); e.dirY = Math.sin(ang / 40);
      e.state = st === 1 ? 'walk' : st === 2 ? 'attack' : 'idle';
      e.air = !!(fl & FLAG.air); e.bld = !!(fl & FLAG.bld); e.dead = !!(fl & FLAG.dead);
      e.stunT = fl & FLAG.stun ? 1 : 0; e.freezeT = fl & FLAG.freeze ? 1 : 0; e.slowT = fl & FLAG.slow ? 1 : 0; e.rageT = fl & FLAG.rage ? 1 : 0;
      e.invisible = !!(fl & FLAG.invis); e.clone = !!(fl & FLAG.clone); e.asc = !!(fl & FLAG.asc); e.charging = !!(fl & FLAG.charging); e.hero = !!(fl & FLAG.hero);
      e.underground = fl & FLAG.under ? {} : null; e.deflectT = fl & FLAG.deflect ? 1 : 0; e.veilT = fl & FLAG.veil ? 1 : 0; e.hitFlash = fl & FLAG.flash ? 0.1 : 0;
      e.active = !!(fl & FLAG.active); e.hiddenState = fl & FLAG.hid1 ? 1 : fl & FLAG.hid2 ? 2 : 0; e.chain = fl & FLAG.chain ? 1 : 0;
      if (e.kind === 'thunder_engine') e.chargeFrac = extra / 100;
      else if (e.kind === 'bone_monarch') e.souls = extra;
      else if (e.kind === 'ember_well') e.genT = extra / 100;
      else if (e.tower === 'side') e.ammo = extra;
      else if (e.kind === 'storm_pylon') e.riseT = extra / 100;
      if (e.tower) { const T = this.towerInfo && this.towerInfo[team]; if (T) { e.skin = T.skin; e.defender = e.tower === 'keep' ? null : T.defender; } }
      seen.add(id);
    }
    for (const id of [...this.map.keys()]) if (!seen.has(id)) this.map.delete(id);
    const pseen = new Set();
    for (const a of s.p) {
      const [id, k, team, x, y, z, dx, dy, w, lob] = a;
      let p = this.projMap.get(id);
      if (!p) { p = { id, k, team, x: x / 100, y: y / 100, x0: x / 100, y0: y / 100 }; this.projMap.set(id, p); }
      p.x0 = p.x; p.y0 = p.y; p.x = x / 100; p.y = y / 100; p.z = z / 100; p.dx = dx / 100; p.dy = dy / 100; p.w = w / 100; p.lob = !!lob; p.line = p.k === 'log' || p.k === 'boulder' || p.k === 'scythe';
      pseen.add(id);
    }
    for (const id of [...this.projMap.keys()]) if (!pseen.has(id)) this.projMap.delete(id);
    this.areas = s.a.map(([id, k, team, x, y, r, t, life]) => ({ id, k, team, x: x / 100, y: y / 100, r: r / 100, t: t / 100, life: life / 100 }));
    this.timeLeft = s.tl / 100; this.phase = s.ph; this.emberPhase = s.em; this.over = !!s.ov; this.winner = s.w; this.reason = s.rs;
    this.bn = s.bn; this.stats = s.st;
    const m = s.me;
    this.meRaw = m;
    this.me = {
      hand: m.h.map(h => h ? { cid: h[0], card: CARD[h[1]], cost: h[2], echo: h[0] === 'echo', ascNeed: m.as.includes(h[0]) ? ASC_CYCLES : 0, ascProg: (m.ac2 || {})[h[0]] || 0, ascReady: m.as.includes(h[0]) && ((m.ac2 || {})[h[0]] || 0) >= ASC_CYCLES } : null),
      next: m.n, ember: m.e / 100, lastCard: m.lc,
      abil: m.ha && m.hc ? { card: m.hc, cost: CARD[m.hc].ability.cost, cd: m.ac / 100, cdMax: CARD[m.hc].ability.cd, name: CARD[m.hc].ability.name } : null,
    };
    this.emberAt = now;
  }
  state(dt) {
    const now = performance.now();
    const a = clamp((now - this.at) / this.interval, 0, 1.15);
    const ents = [...this.map.values()];
    this.byId.clear();
    for (const e of ents) {
      e.rx = lerp(e.x0, e.x, a); e.ry = lerp(e.y0, e.y, a);
      e.atkT = (e.atkT || 0) + dt;
      if (e.state === 'walk') e.walkT += dt;
      this.byId.set(e.id, e);
    }
    const projs = [...this.projMap.values()];
    for (const p of projs) { p.rx = lerp(p.x0, p.x, a); p.ry = lerp(p.y0, p.y, a); p.ox = p.x0; p.oy = p.y0; }
    // ember keeps flowing between snapshots so the bar looks smooth
    const rate = (this.emberPhase || 1) / 2.8;
    const ember = Math.min(10, this.me.ember + rate * (now - (this.emberAt || now)) / 1000);
    const banners = this.team === 0 ? this.bn || [0, 0] : [(this.bn || [0, 0])[1], (this.bn || [0, 0])[0]];
    this.towers = ents.filter(e => e.tower);
    const proxy = { towers: this.towers, ents, inZone: Battle.prototype.inZone };
    const me = Object.assign({}, this.me, { ember });
    return {
      ents, byId: this.byId, projs, areas: this.areas, timeLeft: this.timeLeft || 0, phase: this.phase || 'regular', emberPhase: this.emberPhase || 1, over: this.over,
      banners, myTeam: this.team, me,
      canPlace: (card, x, y) => Battle.prototype.canPlace.call(proxy, { team: this.team }, card, x, y),
    };
  }
}

// ---------------------------------------------------------------- match
class Match {
  // opts: { role: 'local'|'host'|'client', cfg, pid, ais: [{pid, diff}], arena, opp: {name, lvl, sub}, me: {...}, onEnd(result), towerInfo }
  constructor(canvas, opts) {
    this.opts = opts; this.role = opts.role; this.pid = opts.pid || 0;
    this.renderer = new Renderer(canvas);
    this.acc = 0; this.over = false; this.endTimer = 0; this.paused = false;
    this.pending = [];
    if (this.role !== 'client') {
      this.b = new Battle(opts.cfg);
      this.team = this.b.players[this.pid].team;
      this.src = new LocalSource(this.b, this.pid);
      this.ais = (opts.ais || []).map(a => new AIBrain(this.b, a.pid, a.diff, { partner: a.partner }));
      this.netEvents = [];
      this.snapT = 0;
    } else {
      this.team = opts.team;
      this.src = new RemoteSource(this.pid, this.team);
      this.src.towerInfo = opts.towerInfo;
    }
    this.renderer.setup({ team: this.team, arena: opts.arena || 0 });
    this.renderer.viewerPid = this.pid;
    this.lastState = null;
    this.hud = new Hud(this.renderer, {
      state: () => this.lastState,
      play: (slot, x, y) => this.play(slot, x, y),
      ability: () => this.ability(),
      emote: id => this.emote(id),
    });
    this.onResize = () => this.renderer.resize();
    window.addEventListener('resize', this.onResize);
    this.startT = performance.now();
  }

  destroy() {
    this.hud.unbind();
    window.removeEventListener('resize', this.onResize);
    this.dead = true;
  }

  play(slot, x, y) {
    if (this.role === 'client') {
      Net.toHost({ t: 'play', slot, x, y });
      this.renderer.ring(x, y, 1.1, '#ffffff', 0.35);
      Audio2.play('deploy', 0.6);
      return { ok: true };
    }
    return this.b.play(this.pid, slot, x, y);
  }
  ability() { if (this.role === 'client') Net.toHost({ t: 'ab' }); else this.b.useAbility(this.pid); }
  emote(id) { if (this.role === 'client') Net.toHost({ t: 'emote', id }); else this.b.emote(this.pid, id); }
  surrender() {
    if (this.role === 'client') { Net.toHost({ t: 'quit' }); this.finishLocal(1 - this.team, 'surrender'); if (this.result) this.result.oppBanners = 3; return; }
    if (!this.b.over) { const other = 1 - this.team; this.b.banners[other] = 3; this.b.finish(other, 'surrender'); }
  }

  // network host: handle a client's message
  onNet(pid, d) {
    if (this.role === 'host' && this.b) {
      const cp = this.opts.remotePid;
      if (d.t === 'play') this.b.play(cp, d.slot | 0, +d.x, +d.y);
      else if (d.t === 'ab') this.b.useAbility(cp);
      else if (d.t === 'emote') this.b.emote(cp, String(d.id));
      else if (d.t === 'quit' || d.t === 'left') {
        if (!this.b.over) { const myTeam = this.team; this.b.banners[myTeam] = 3; this.b.finish(myTeam, d.t === 'quit' ? 'surrender' : 'disconnect'); }
      }
    } else if (this.role === 'client') {
      if (d.t === 's') {
        this.src.apply(d);
        if (d.ev && d.ev.length) { this.renderer.onEvents(d.ev, Audio2); }
        if (d.ov && !this.over) { this.over = true; this.endTimer = 0; this.result = this.buildResult(d.w, d.rs, d.bn, d.st); }
      }
    }
  }

  connectionLost(msg) {
    if (this.over) return;
    if (this.role === 'host') this.onNet(0, { t: 'left' });
    else this.finishLocal(this.team, 'disconnect', msg);
  }

  finishLocal(winner, reason) {
    if (this.over) return;
    this.over = true; this.endTimer = 1.5;
    const bn = this.src.bn || [0, 0];
    this.result = this.buildResult(winner, reason, bn, this.src.stats);
  }

  buildResult(winner, reason, banners, stats) {
    const myTeam = this.team;
    return {
      win: winner === myTeam, draw: winner === -1, reason,
      myBanners: banners[myTeam], oppBanners: banners[1 - myTeam],
      stats: stats ? stats[this.pid] : null,
      duration: this.b ? this.b.t : (performance.now() - this.startT) / 1000,
    };
  }

  frame(dt) {
    if (this.dead) return;
    dt = Math.min(dt, 0.1);
    let alpha = 1;
    if (this.role !== 'client') {
      if (!this.paused) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= DT && steps < 8) {
          for (const a of this.ais) a.update(DT);
          this.b.step();
          this.acc -= DT; steps++;
          const evs = this.b.drainEvents();
          if (evs.length) {
            for (const a of this.ais) for (const e of evs) a.onEvent(e);
            this.renderer.onEvents(evs, Audio2);
            if (this.role === 'host') for (const e of evs) this.netEvents.push(e);
          }
        }
        if (steps === 8) this.acc = 0;
        alpha = clamp(this.acc / DT, 0, 1);
      }
      if (this.role === 'host') {
        this.snapT += dt;
        if (this.snapT >= 1 / SNAP_HZ || this.b.over) {
          this.snapT = 0;
          Net.send(encodeSnap(this.b, this.opts.remotePid, this.netEvents));
          this.netEvents = [];
        }
      }
      if (this.b.over && !this.over) { this.over = true; this.endTimer = 0; this.result = this.buildResult(this.b.winner, this.b.endReason, this.b.banners, this.b.players.map(p => p.stats)); }
    }
    const S = this.role === 'client' ? this.src.state(dt) : this.src.state(alpha);
    const mine = this.role === 'client' ? null : this.b.players[this.pid];
    S.opp = this.opts.opp || { name: 'Opponent', lvl: 1 };
    this.lastState = S;
    if (mine) S.me.ember = mine.ember;
    this.renderer.alwaysBars = false;
    this.renderer.draw(S, this.hud, dt);
    this.hud.draw(S, dt);
    if (this.over) {
      this.endTimer += dt;
      if (this.endTimer > 3 && !this.ended) { this.ended = true; if (this.opts.onEnd) this.opts.onEnd(this.result, this); }
    }
  }
}
