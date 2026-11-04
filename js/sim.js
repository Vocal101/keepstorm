'use strict';
// Deterministic battle simulation. Team 0 plays from the bottom (high y), team 1 from the top.

const AR = { W: 18, H: 32, RY0: 15, RY1: 17, MID: 16, BRIDGES: [3.5, 14.5], BHW: 1.1 };
const DT = 1 / 30;
const TOWER_SLOTS = [
  { team: 0, kind: 'side', lane: 0, x: 3.5, y: 25.5 }, { team: 0, kind: 'side', lane: 1, x: 14.5, y: 25.5 }, { team: 0, kind: 'keep', lane: -1, x: 9, y: 29 },
  { team: 1, kind: 'side', lane: 0, x: 3.5, y: 6.5 }, { team: 1, kind: 'side', lane: 1, x: 14.5, y: 6.5 }, { team: 1, kind: 'keep', lane: -1, x: 9, y: 3 },
];
const KEEP_POS = [{ x: 9, y: 29 }, { x: 9, y: 3 }];

class Battle {
  constructor(cfg) {
    this.cfg = cfg;
    this.rng = RNG(cfg.seed || 12345);
    this.mode = Object.assign({ dur: 180, ot: 120, startEmber: 5, emberMul: 1, sudden: false }, cfg.mode || {});
    this.t = 0; this.tick = 0; this.nid = 1;
    this.ents = []; this.projs = []; this.areas = []; this.timers = []; this.events = [];
    this.over = false; this.winner = -1; this.banners = [0, 0]; this.endReason = '';
    this.phase = 'regular';
    this.players = cfg.players.map((pc, i) => this.makePlayer(pc, i));
    this.teamTowerLvl = [0, 1].map(team => {
      const ps = this.players.filter(p => p.team === team);
      return Math.round(ps.reduce((s, p) => s + (p.towerLvl || STD_LEVEL), 0) / Math.max(1, ps.length));
    });
    this.towers = [];
    for (const s of TOWER_SLOTS) this.towers.push(this.makeTower(s));
  }

  // ---------------------------------------------------------------- setup
  makePlayer(pc, i) {
    const deck = pc.deck.slice(0, 8);
    const order = this.rng.shuffle(deck.slice());
    const p = {
      id: i, team: pc.team != null ? pc.team : i % 2, name: pc.name || 'Player', deck,
      levels: Object.assign({}, pc.levels || {}), towerLvl: pc.towerLvl || STD_LEVEL,
      defender: pc.defender || 'bow_sisters', skin: pc.skin || 'stone',
      hand: order.slice(0, 4), queue: order.slice(4), ember: this.mode.startEmber,
      lastCard: null, lastLvl: 0, heroEnt: null, heroCard: null, abilCD: 0,
      asc: {}, ascCnt: {}, emote: null, isAI: !!pc.ai,
      stats: { played: 0, spent: 0, leaked: 0, towerDmg: 0 },
    };
    (pc.asc || []).forEach(id => { if (CARD[id] && CARD[id].asc && deck.includes(id)) { p.asc[id] = true; p.ascCnt[id] = 0; } });
    for (const id of deck) if (!p.levels[id]) p.levels[id] = STD_LEVEL;
    return p;
  }

  makeTower(s) {
    const lvl = this.teamTowerLvl[s.team];
    const m = levelMul(lvl);
    const owner = this.players.find(p => p.team === s.team);
    const defKey = owner ? owner.defender : 'bow_sisters';
    const D = DEFENDERS[defKey] || DEFENDERS.bow_sisters;
    const isKeep = s.kind === 'keep';
    const hp = isKeep ? TOWER.keep.hp * m : TOWER.side.hp * m * D.hpMul;
    const e = this.baseEnt(s.team, owner ? owner.id : s.team, s.x, s.y);
    Object.assign(e, {
      kind: isKeep ? 'keep' : 'side', tower: s.kind, lane: s.lane, bld: true, hp, maxHp: hp, r: isKeep ? TOWER.keep.r : TOWER.side.r,
      mass: 999, deployT: 0, state: 'idle', active: !isKeep, lvl, skin: owner ? owner.skin : 'stone',
      defender: isKeep ? null : defKey, dmg: (isKeep ? TOWER.keep.dmg : D.dmg) * m, hs: isKeep ? TOWER.keep.hs : D.hs,
      range: isKeep ? TOWER.keep.rng : D.rng, ammo: D.ammo || 0, healT: 1, hitsAir: true,
    });
    this.ents.push(e);
    return e;
  }

  baseEnt(team, owner, x, y) {
    return {
      id: this.nid++, team, owner, x, y, px: x, py: y, hp: 1, maxHp: 1, shield: 0, maxShield: 0, dmg: 0,
      air: false, r: 0.4, mass: 1, bld: false, tower: null, dead: false, state: 'deploy', deployT: 0, deployMax: 1,
      target: null, lock: false, atkCD: 0, atkT: 9, dirX: 0, dirY: team === 0 ? -1 : 1, walkT: 0, hitFlash: 0,
      stunT: 0, freezeT: 0, slowT: 0, slowMul: 1, rageT: 0, kbT: 0, kbX: 0, kbY: 0, retargetT: 0,
      chargeAcc: 0, charging: false, rampT: 0, invisible: false, invuln: false, z: 0, born: this.t,
    };
  }

  // ---------------------------------------------------------------- spawning
  spawnUnit(owner, uid, x, y, lvl, opt = {}) {
    const def = UNITS[uid];
    const p = this.players[owner];
    const m = levelMul(lvl);
    const e = this.baseEnt(p.team, owner, x, y);
    const hpMul = (opt.asc && uid === 'brawler') ? 1.35 : 1;
    Object.assign(e, {
      kind: uid, def, lvl, hp: def.hp * m * hpMul, maxHp: def.hp * m * hpMul, shield: (def.shield || 0) * m, maxShield: (def.shield || 0) * m,
      dmg: (def.dmg || 0) * m, air: !!def.air, r: def.r, mass: def.mass || 5, bld: !!def.bld,
      spd: SPD[def.spd] || 0, range: def.rng || 0, sight: Math.max(def.sight || 5.5, (def.rng || 0) + 0.5),
      hs: def.hs || 1, load: def.load != null ? def.load : Math.min(0.5, (def.hs || 1) * 0.5),
      hitsAir: def.tgt === 'all' || (opt.asc && uid === 'bolt_thrower'),
      deployT: opt.deploy != null ? opt.deploy : (def.deploy || 1), asc: !!opt.asc, clone: !!opt.clone, card: opt.card || null,
    });
    e.deployMax = Math.max(0.01, e.deployT);
    if (opt.clone) { e.hp = 1; e.maxHp = 1; e.shield = 0; e.maxShield = 0; }
    if (def.bld) { e.decay = e.maxHp / def.life; e.state = 'idle'; }
    if (def.spawner) e.spawnT = def.spawner.first + e.deployT;
    if (def.generate) e.genT = def.generate;
    if (def.healAura) e.healT = def.healAura.every;
    if (def.hidden) { e.hiddenState = 1; }
    if (def.invis) e.lastAtk = -99;
    if (def.souls) e.souls = 0;
    if (def.combo) e.combo = 0;
    if (def.tunnel && opt.tunnel) {
      const kp = KEEP_POS[p.team];
      e.underground = { tx: x, ty: y }; e.x = kp.x; e.y = kp.y + (p.team === 0 ? -2 : 2); e.px = e.x; e.py = e.y; e.deployT = 0.6; e.deployMax = 0.6;
    }
    this.ents.push(e);
    return e;
  }

  // ---------------------------------------------------------------- player actions
  cardFor(p, slot) {
    const cid = p.hand[slot];
    if (!cid) return null;
    if (cid === 'echo') {
      if (!p.lastCard) return { card: CARD.echo, cid, cost: 99, lvl: 0, echo: true };
      const c = CARD[p.lastCard];
      return { card: c, cid, cost: c.cost + 1, lvl: Math.min(MAX_LEVEL + 1, p.lastLvl + 1), echo: true };
    }
    return { card: CARD[cid], cid, cost: CARD[cid].cost, lvl: p.levels[cid] || STD_LEVEL };
  }

  snapPos(card, x, y) {
    if (card.type === 'building') return [clamp(Math.round(x), 1, AR.W - 1), clamp(Math.round(y), 1, AR.H - 1)];
    if (card.type === 'spell') return [clamp(x, 0.5, AR.W - 0.5), clamp(y, 0.5, AR.H - 0.5)];
    return [clamp(Math.floor(x) + 0.5, 0.5, AR.W - 0.5), clamp(Math.floor(y) + 0.5, 0.5, AR.H - 0.5)];
  }

  inZone(team, x, y) {
    const own = team === 0 ? y >= AR.RY1 : y <= AR.RY0;
    if (own) return true;
    const enemy = 1 - team;
    const lane = x < AR.W / 2 ? 0 : 1;
    const tw = this.towers.find(t => t.team === enemy && t.tower === 'side' && t.lane === lane);
    if (tw && tw.dead) return team === 0 ? (y >= 10 && y <= AR.RY0) : (y >= AR.RY1 && y <= 22);
    return false;
  }

  canPlace(p, card, x, y) {
    if (x < 0 || x > AR.W || y < 0 || y > AR.H) return false;
    if (card.type === 'spell') return true;
    const inRiver = y > AR.RY0 && y < AR.RY1;
    if (inRiver) return false;
    for (const t of this.towers) if (!t.dead && dist(t.x, t.y, x, y) < t.r + (card.type === 'building' ? 0.9 : 0.15)) return false;
    if (card.anywhere) return true;
    if (!this.inZone(p.team, x, y)) return false;
    if (card.type === 'building') {
      if (!(p.team === 0 ? y >= AR.RY1 + 1 : y <= AR.RY0 - 1)) return false;
      for (const e of this.ents) if (!e.dead && e.bld && !e.tower && dist(e.x, e.y, x, y) < e.r + 0.95) return false;
    }
    return true;
  }

  play(pid, slot, x, y) {
    if (this.over) return { ok: false, err: 'over' };
    const p = this.players[pid];
    if (!p || slot < 0 || slot > 3) return { ok: false, err: 'bad' };
    const c = this.cardFor(p, slot);
    if (!c) return { ok: false, err: 'empty' };
    if (c.echo && !p.lastCard) return { ok: false, err: 'Nothing to echo yet' };
    if (p.ember + 1e-6 < c.cost) return { ok: false, err: 'Not enough Ember' };
    [x, y] = this.snapPos(c.card, x, y);
    if (!this.canPlace(p, c.card, x, y)) return { ok: false, err: 'Can\'t deploy there' };
    p.ember -= c.cost;
    p.stats.played++; p.stats.spent += c.cost;
    // cycle the hand
    const cid = p.hand[slot];
    p.hand[slot] = p.queue.shift();
    let isAsc = false;
    if (!c.echo && p.asc[cid]) {
      const cnt = p.ascCnt[cid] || 0;
      if (cnt >= ASC_CYCLES) { isAsc = true; p.ascCnt[cid] = 0; } else p.ascCnt[cid] = cnt + 1;
    }
    if (c.card.rarity === 'hero' && !c.echo) p.heroCard = cid; else p.queue.push(cid);
    if (!c.echo && c.card.rarity !== 'hero') { p.lastCard = cid; p.lastLvl = c.lvl; }
    this.deploy(p, c.card, c.lvl, x, y, isAsc);
    this.ev({ t: 'play', pid, card: c.card.id, x, y, team: p.team, echo: !!c.echo, asc: isAsc });
    return { ok: true, x, y };
  }

  deploy(p, card, lvl, x, y, isAsc) {
    const fwd = p.team === 0 ? -1 : 1;
    if (card.type === 'troop') {
      if (card.form === 'split') {
        const xs = [1.5, 4, 6.5, 11.5, 14, 16.5];
        xs.forEach((sx, i) => this.spawnUnit(p.id, card.unit, sx, y + (i % 2 ? 0.4 : -0.4) * fwd, lvl, { card: card.id }));
        return;
      }
      const n = card.count || 1;
      const form = FORMATIONS[n] || FORMATIONS[1];
      const spread = UNITS[card.unit].r > 0.5 ? 1.3 : 1;
      for (let i = 0; i < n; i++) {
        const [ox, oy] = form[i];
        const e = this.spawnUnit(p.id, card.unit, clamp(x + ox * spread, 0.4, AR.W - 0.4), y + oy * spread * -fwd, lvl, { asc: isAsc, card: card.id, tunnel: card.anywhere });
        if (card.rarity === 'hero') { p.heroEnt = e; e.hero = true; p.abilCD = 2; }
      }
      return;
    }
    if (card.type === 'building') {
      this.spawnUnit(p.id, card.unit, x, y, lvl, { asc: isAsc, card: card.id });
      return;
    }
    this.castSpell(p, card, lvl, x, y);
  }

  useAbility(pid) {
    const p = this.players[pid];
    if (!p || this.over) return { ok: false };
    const h = p.heroEnt;
    if (!h || h.dead || h.deployT > 0) return { ok: false, err: 'No hero' };
    const ab = CARD[p.heroCard].ability;
    if (p.abilCD > 0) return { ok: false, err: 'Cooling down' };
    if (p.ember + 1e-6 < ab.cost) return { ok: false, err: 'Not enough Ember' };
    p.ember -= ab.cost; p.abilCD = ab.cd; p.stats.spent += ab.cost;
    const m = levelMul(h.lvl);
    if (ab.id === 'radiant_dash') { h.chain = { left: 7, t: 0, hit: new Set(), dmg: 300 * m }; h.invuln = true; }
    else if (ab.id === 'veil') { h.veilT = 3.5; }
    else if (ab.id === 'raise') {
      const n = Math.min(16, 6 + (h.souls || 0)); h.souls = 0;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; this.spawnUnit(pid, 'rattlebone', clamp(h.x + Math.cos(a) * 1.4, 0.5, 17.5), clamp(h.y + Math.sin(a) * 1.4, 0.5, 31.5), h.lvl, { deploy: 0.5 }); }
    } else if (ab.id === 'deflect') { h.deflectT = 4; }
    this.ev({ t: 'ability', pid, id: ab.id, x: h.x, y: h.y, team: p.team, eid: h.id });
    return { ok: true };
  }

  emote(pid, id) { const p = this.players[pid]; if (!p) return; this.ev({ t: 'emote', pid, id, team: p.team }); }

  // ---------------------------------------------------------------- spells
  castSpell(p, card, lvl, x, y) {
    const m = levelMul(lvl);
    const team = p.team, kp = KEEP_POS[team];
    const base = { team, owner: p.id, card: card.id, lvl, m };
    switch (card.spell) {
      case 'volley': this.launch(Object.assign({ k: 'volley', x0: kp.x, y0: kp.y, tx: x, ty: y, spd: 14, lob: true, arc: 3 }, base, { impact: () => this.areaHit(base, x, y, card.r, card.dmg * m, { towerMul: card.towerMul, air: true, fx: 'volley' }) })); break;
      case 'spark': this.later(0.2, () => this.areaHit(base, x, y, card.r, card.dmg * m, { towerMul: card.towerMul, air: true, stun: card.stun, fx: 'spark' })); this.ev({ t: 'cast', k: 'spark', x, y, r: card.r }); break;
      case 'snowball': this.launch(Object.assign({ k: 'snowball', x0: kp.x, y0: kp.y, tx: x, ty: y, spd: 15, lob: true, arc: 2 }, base, { impact: () => this.areaHit(base, x, y, card.r, card.dmg * m, { towerMul: card.towerMul, air: true, kb: card.kb, slow: card.slow, fx: 'snow' }) })); break;
      case 'meteor': this.launch(Object.assign({ k: 'meteor', x0: kp.x, y0: kp.y, tx: x, ty: y, spd: 11, lob: true, arc: 5 }, base, { impact: () => this.areaHit(base, x, y, card.r, card.dmg * m, { towerMul: card.towerMul, air: true, kb: card.kb, fx: 'meteor' }) })); break;
      case 'shell': this.launch(Object.assign({ k: 'shell', x0: kp.x, y0: kp.y, tx: x, ty: y, spd: 6.5, lob: true, arc: 6 }, base, { impact: () => this.areaHit(base, x, y, card.r, card.dmg * m, { towerMul: card.towerMul, air: true, kb: card.kb, fx: 'shell' }) })); break;
      case 'crate': this.launch(Object.assign({ k: 'crate', x0: kp.x, y0: kp.y, tx: x, ty: y, spd: 9, lob: true, arc: 4 }, base, {
        impact: () => {
          const ty = (y > AR.RY0 && y < AR.RY1) ? (team === 0 ? AR.RY0 - 0.3 : AR.RY1 + 0.3) : y;
          FORMATIONS[3].forEach(([ox, oy]) => this.spawnUnit(p.id, 'imp', clamp(x + ox, 0.4, 17.6), ty + oy, lvl, { deploy: 0.3 }));
          this.ev({ t: 'fx', k: 'crate', x, y: ty });
        },
      })); break;
      case 'rime': {
        this.areaHit(base, x, y, card.r, card.dmg * m, { towerMul: card.towerMul, air: true, freeze: card.freeze, fx: 'rime' });
        this.areas.push(Object.assign({ id: this.nid++, k: 'rime', x, y, r: card.r, t: 0, life: card.freeze }, base));
        break;
      }
      case 'frenzy': this.areas.push(Object.assign({ id: this.nid++, k: 'frenzy', x, y, r: card.r, t: 0, life: card.dur }, base)); this.ev({ t: 'cast', k: 'frenzy', x, y, r: card.r }); break;
      case 'thunder': {
        const cands = this.enemiesIn(team, x, y, card.r, { air: true }).sort((a, b) => b.hp - a.hp).slice(0, card.strikes);
        cands.forEach((t, i) => this.later(0.15 * i + 0.1, () => {
          if (t.dead) return;
          const d = card.dmg * m * (t.tower ? card.towerMul : 1);
          this.hurt(t, d, null, { spell: true, team, owner: p.id });
          this.stun(t, card.stun);
          this.ev({ t: 'fx', k: 'bolt', x: t.x, y: t.y });
        }));
        this.ev({ t: 'cast', k: 'thunder', x, y, r: card.r });
        break;
      }
      case 'blight': this.areas.push(Object.assign({ id: this.nid++, k: 'blight', x, y, r: card.r, t: 0, life: card.dur, tick: 0, dps: card.dmg * m / card.dur, towerMul: card.towerMul }, base)); break;
      case 'vortex': this.areas.push(Object.assign({ id: this.nid++, k: 'vortex', x, y, r: card.r, t: 0, life: card.dur, dps: card.dmg * m / card.dur }, base)); break;
      case 'tremor': this.areas.push(Object.assign({ id: this.nid++, k: 'tremor', x, y, r: card.r, t: 0, life: card.dur, tick: 0, pulse: card.dmg * m / 6 }, base)); break;
      case 'haunting': this.areas.push(Object.assign({ id: this.nid++, k: 'haunting', x, y, r: card.r, t: 0, life: card.dur, n: card.n, spawned: 0 }, base)); break;
      case 'mirage': {
        const list = this.ents.filter(e => !e.dead && e.team === team && !e.bld && !e.hero && !e.clone && !e.underground && dist(e.x, e.y, x, y) <= card.r + e.r);
        for (const e of list) {
          const c = this.spawnUnit(e.owner, e.kind, clamp(e.x + 0.6, 0.4, 17.6), e.y + 0.2, e.lvl, { clone: true, deploy: 0.15 });
          c.dirX = e.dirX; c.dirY = e.dirY;
        }
        this.ev({ t: 'cast', k: 'mirage', x, y, r: card.r });
        break;
      }
      case 'log': {
        const fwd = team === 0 ? -1 : 1;
        this.projs.push({ id: this.nid++, k: 'log', team, owner: p.id, x, y, px: x, py: y, dx: 0, dy: fwd, w: card.r, len: card.len, spd: 6.5, trav: 0, line: true, hit: new Set(), dmg: card.dmg * m, kb: card.kb, towerMul: card.towerMul, ground: true, hitsBld: true, z: 0 });
        break;
      }
    }
  }

  launch(o) {
    const d = dist(o.x0, o.y0, o.tx, o.ty);
    const pr = Object.assign({ id: this.nid++, x: o.x0, y: o.y0, px: o.x0, py: o.y0, t: 0, dur: Math.max(0.25, d / o.spd), z: 0 }, o);
    this.projs.push(pr);
    return pr;
  }

  later(dt, fn) { this.timers.push({ at: this.t + dt, fn }); }

  enemiesIn(team, x, y, r, opt = {}) {
    const out = [];
    for (const e of this.ents) {
      if (e.dead || e.team === team || e.underground) continue;
      if (e.hiddenState === 1 && !opt.hidden) continue;
      if (e.air && !opt.air) continue;
      if (!e.air && opt.airOnly) continue;
      if (opt.noBld && e.bld) continue;
      if (dist(e.x, e.y, x, y) <= r + e.r * 0.6) out.push(e);
    }
    return out;
  }

  areaHit(src, x, y, r, dmg, o) {
    const list = this.enemiesIn(src.team, x, y, r, { air: o.air !== false });
    for (const t of list) {
      let d = dmg;
      if (t.tower) d *= (o.towerMul != null ? o.towerMul : 1);
      this.hurt(t, d, null, { spell: true, team: src.team, owner: src.owner });
      if (o.stun) this.stun(t, o.stun);
      if (o.freeze) this.freeze(t, o.freeze);
      if (o.slow) this.slow(t, 0.65, o.slow);
      if (o.kb && !t.bld && t.mass < 10) { const dd = dist(x, y, t.x, t.y) || 1; this.knock(t, (t.x - x) / dd, (t.y - y) / dd, o.kb); }
    }
    if (o.fx) this.ev({ t: 'fx', k: o.fx, x, y, r });
  }

  // ---------------------------------------------------------------- status effects
  stun(t, d) { if (t.tower || t.dead) return; t.stunT = Math.max(t.stunT, d); this.resetWindup(t); }
  freeze(t, d) { if (t.dead) return; t.freezeT = Math.max(t.freezeT, d); this.resetWindup(t); }
  slow(t, mul, d) { if (t.tower || t.dead) return; t.slowMul = Math.min(t.slowT > 0 ? t.slowMul : 1, mul); t.slowT = Math.max(t.slowT, d); }
  resetWindup(t) { if (t.bld && !t.def) return; t.atkCD = Math.max(t.atkCD, t.load || 0.3); t.charging = false; t.chargeAcc = 0; t.rampT = 0; }
  knock(t, dx, dy, amt) {
    if (t.bld || t.mass >= 15 || t.dead || t.underground) return;
    t.kbT = 0.25; t.kbX = dx * amt / 0.25; t.kbY = dy * amt / 0.25;
    this.resetWindup(t);
  }

  hurt(t, amt, src, o = {}) {
    if (t.dead || t.invuln || t.underground || amt <= 0) return;
    if (t.deflectT > 0) {
      amt *= 0.35;
      if (o.proj && src && !src.dead && src.team !== t.team) { this.hurt(src, amt, null, {}); this.ev({ t: 'fx', k: 'deflect', x: t.x, y: t.y }); }
    }
    if (t.asc && t.kind === 'squire' && t.state === 'walk') amt *= 0.4;
    t.hitFlash = 0.12;
    if (t.tower) {
      const atk = o.owner != null ? this.players[o.owner] : (src ? this.players[src.owner] : null);
      if (atk && atk.team !== t.team) atk.stats.towerDmg += Math.min(amt, t.hp);
    }
    if (t.shield > 0) {
      t.shield -= amt;
      if (t.shield <= 0) { t.shield = 0; this.ev({ t: 'fx', k: 'shieldbreak', x: t.x, y: t.y }); }
      return;
    }
    t.hp -= amt;
    if (t.tower === 'keep' && !t.active) this.activateKeep(t.team);
    if (t.hp <= 0) this.kill(t, src);
  }

  activateKeep(team) {
    const k = this.towers.find(x => x.team === team && x.tower === 'keep');
    if (k && !k.active && !k.dead) { k.active = true; k.wakeT = 0.6; this.ev({ t: 'keepwake', team }); }
  }

  kill(t, src) {
    if (t.dead) return;
    t.dead = true; t.hp = 0; t.deathT = this.t;
    if (t.tower) { this.towerDown(t); return; }
    const def = t.def;
    this.ev({ t: 'death', kind: t.kind, x: t.x, y: t.y, team: t.team, air: t.air, bld: t.bld, clone: t.clone });
    if (!t.bld) {
      for (const e of this.ents) if (!e.dead && e.souls != null && dist(e.x, e.y, t.x, t.y) < 4.5) e.souls = Math.min(10, e.souls + 1);
    }
    const p = this.players[t.owner];
    if (t.hero && p.heroEnt === t) { p.heroEnt = null; if (p.heroCard) { p.queue.push(p.heroCard); p.heroCard = null; } }
    if (t.clone || !def) return;
    if (def.deathSpawn) {
      const n = def.deathSpawn.n;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const rr = n > 1 ? 0.7 : 0;
        const nx = clamp(t.x + Math.cos(a) * rr, 0.4, 17.6), ny = clamp(t.y + Math.sin(a) * rr, 0.4, 31.6);
        this.spawnUnit(t.owner, def.deathSpawn.u, nx, ny, t.lvl, { deploy: 0.35 });
      }
    }
    if (def.deathBomb) {
      const b = def.deathBomb, m = levelMul(t.lvl);
      this.areas.push({ id: this.nid++, k: b.ground ? 'keg' : 'dropbomb', x: t.x, y: t.y, r: b.r, t: 0, life: b.delay, team: t.team, owner: t.owner, dmg: b.dmg * m, boom: true });
    }
    if (def.deathSpell === 'frenzy_drop') this.areas.push({ id: this.nid++, k: 'frenzy', x: t.x, y: t.y, r: 3, t: 0, life: 4, team: t.team, owner: t.owner });
  }

  towerDown(t) {
    const other = 1 - t.team;
    this.ev({ t: 'towerdown', team: t.team, kind: t.tower, x: t.x, y: t.y, lane: t.lane });
    if (t.tower === 'keep') {
      this.banners[other] = 3;
      for (const tw of this.towers) if (tw.team === t.team && !tw.dead) { tw.dead = true; tw.hp = 0; this.ev({ t: 'towerdown', team: tw.team, kind: tw.tower, x: tw.x, y: tw.y, lane: tw.lane, chain: true }); }
      this.finish(other, 'keep');
    } else {
      this.banners[other] = Math.min(3, this.banners[other] + 1);
      this.activateKeep(t.team);
      if (this.phase === 'ot' || this.mode.sudden) this.finish(other, 'sudden');
    }
  }

  finish(winner, reason) {
    if (this.over) return;
    this.over = true; this.winner = winner; this.endReason = reason; this.endT = this.t;
    this.ev({ t: 'end', winner, reason, banners: this.banners.slice() });
  }

  ev(e) { e.at = this.t; this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------------------------------------------------------------- time & ember
  emberRate() {
    const md = this.mode;
    let mul = 1;
    if (this.phase === 'regular') { if (this.t >= md.dur - 60) mul = 2; }
    else mul = (this.t - md.dur) >= md.ot - 60 ? 3 : 2;
    return Math.max(mul, md.emberMul) / 2.8;
  }
  timeLeft() {
    const md = this.mode;
    return this.phase === 'regular' ? md.dur - this.t : md.dur + md.ot - this.t;
  }
  emberPhase() { const r = this.emberRate() * 2.8; return r >= 3 ? 3 : r >= 2 ? 2 : 1; }

  tiebreak() {
    const score = team => {
      const alive = this.towers.filter(t => t.team === team && !t.dead);
      return alive.length ? Math.min(...alive.map(t => t.hp / t.maxHp)) : 0;
    };
    const a = score(0), b = score(1);
    if (Math.abs(a - b) < 1e-6) { this.finish(-1, 'draw'); return; }
    const loser = a < b ? 0 : 1;
    const tw = this.towers.filter(t => t.team === loser && !t.dead).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
    this.ev({ t: 'tiebreak', loser });
    if (tw) { tw.dead = true; tw.hp = 0; this.banners[1 - loser]++; this.ev({ t: 'towerdown', team: tw.team, kind: tw.tower, x: tw.x, y: tw.y, lane: tw.lane }); }
    this.finish(1 - loser, 'tiebreak');
  }

  // ---------------------------------------------------------------- main step
  step() {
    if (this.over) { this.t += DT; this.tick++; for (const e of this.ents) { e.px = e.x; e.py = e.y; } return; }
    const dt = DT;
    this.t += dt; this.tick++;
    const md = this.mode;
    if (this.phase === 'regular' && this.t >= md.dur) {
      if (this.banners[0] !== this.banners[1]) { this.finish(this.banners[0] > this.banners[1] ? 0 : 1, 'time'); return; }
      if (md.ot > 0) { this.phase = 'ot'; this.ev({ t: 'overtime' }); }
      else { this.tiebreak(); return; }
    }
    if (this.phase === 'ot' && this.t >= md.dur + md.ot) { this.tiebreak(); return; }
    if (this.phase === 'regular' && Math.abs(this.t - (md.dur - 60)) < dt / 2 && md.emberMul < 2) this.ev({ t: 'double' });
    if (this.phase === 'ot' && Math.abs(this.t - (md.dur + md.ot - 60)) < dt / 2 && md.emberMul < 3) this.ev({ t: 'triple' });

    const rate = this.emberRate();
    for (const p of this.players) {
      const before = p.ember;
      p.ember = Math.min(10, p.ember + rate * dt);
      if (before >= 10) p.stats.leaked += rate * dt;
      if (p.abilCD > 0) p.abilCD -= dt;
    }
    // timers
    if (this.timers.length) {
      const due = this.timers.filter(x => x.at <= this.t);
      if (due.length) { this.timers = this.timers.filter(x => x.at > this.t); for (const d of due) d.fn(); }
    }
    for (const e of this.ents) { e.px = e.x; e.py = e.y; }
    const n = this.ents.length;
    for (let i = 0; i < n; i++) {
      const e = this.ents[i];
      if (e.dead) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      e.atkT += dt;
      if (e.tower) this.updTower(e, dt);
      else if (e.bld) this.updBuilding(e, dt);
      else this.updUnit(e, dt);
      if (this.over) return;
    }
    for (const pr of this.projs) this.updProj(pr, dt);
    this.projs = this.projs.filter(p => !p.done);
    for (const a of this.areas) this.updArea(a, dt);
    this.areas = this.areas.filter(a => !a.done);
    this.collide();
    // clean up the dead (keep towers for rubble)
    if (this.tick % 15 === 0) this.ents = this.ents.filter(e => !e.dead || e.tower);
  }

  // ---------------------------------------------------------------- targeting
  valid(e, t) {
    if (!t || t.dead || t.team === e.team || t.underground) return false;
    if (t.invisible || t.veilT > 0 || t.hiddenState === 1) return false;
    if (t.jumping && !e.hitsAir) return false;
    const tg = e.def ? e.def.tgt : 'all';
    if (tg === 'bld') return t.bld;
    if (t.air && !e.hitsAir) return false;
    return true;
  }

  pathDist(e, x, y) {
    if (e.air || (e.def && e.def.jumpRiver)) return dist(e.x, e.y, x, y);
    const es = e.y < AR.RY0 ? 1 : e.y > AR.RY1 ? 0 : -1;
    const gs = y < AR.RY0 ? 1 : y > AR.RY1 ? 0 : -1;
    if (es === gs || es === -1 || gs === -1) return dist(e.x, e.y, x, y);
    let best = Infinity;
    for (const b of AR.BRIDGES) {
      const d = dist(e.x, e.y, b, es === 0 ? AR.RY1 : AR.RY0) + 2 + dist(b, gs === 0 ? AR.RY1 : AR.RY0, x, y);
      if (d < best) best = d;
    }
    return best;
  }

  acquire(e) {
    let best = null, bd = Infinity;
    const tg = e.def ? e.def.tgt : 'all';
    if (tg !== 'bld') {
      for (const t of this.ents) {
        if (!this.valid(e, t)) continue;
        const d = dist(e.x, e.y, t.x, t.y) - t.r;
        if (d > e.sight) continue;
        if (d < bd) { bd = d; best = t; }
      }
      if (best) return best;
    }
    for (const t of this.ents) {
      if (!t.bld || !this.valid(e, t)) continue;
      const d = this.pathDist(e, t.x, t.y) - t.r;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  acquireInRange(e) {
    // for buildings and towers: nearest valid target within range
    let best = null, bd = Infinity;
    const minR = e.def && e.def.minRng || 0;
    for (const t of this.ents) {
      if (t.bld || !this.valid(e, t)) continue;
      const d = dist(e.x, e.y, t.x, t.y) - t.r - e.r;
      if (d > e.range || d < minR) continue;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  gap(a, b) { return dist(a.x, a.y, b.x, b.y) - a.r - b.r; }

  // ---------------------------------------------------------------- units
  updUnit(e, dt) {
    const def = e.def;
    if (e.underground) {
      const u = e.underground;
      const d = dist(e.x, e.y, u.tx, u.ty);
      const st = 3.4 * dt;
      if (d <= st) { e.x = u.tx; e.y = u.ty; e.underground = null; e.deployT = 0.6; e.deployMax = 0.6; this.ev({ t: 'fx', k: 'popup', x: e.x, y: e.y }); }
      else { e.x += (u.tx - e.x) / d * st; e.y += (u.ty - e.y) / d * st; e.dirX = (u.tx - e.x) / d; e.dirY = (u.ty - e.y) / d; }
      return;
    }
    if (e.deployT > 0) {
      e.deployT -= dt;
      if (e.deployT <= 0) this.onDeployed(e);
      return;
    }
    if (e.stunT > 0) e.stunT -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
    if (e.rageT > 0) e.rageT -= dt;
    if (e.veilT > 0) e.veilT -= dt;
    if (e.deflectT > 0) e.deflectT -= dt;
    if (e.kbT > 0) { e.kbT -= dt; e.x += e.kbX * dt; e.y += e.kbY * dt; }
    if (e.freezeT > 0) { e.freezeT -= dt; return; }
    if (e.stunT > 0) return;
    const sm = (e.slowT > 0 ? e.slowMul : 1) * (e.rageT > 0 ? 1.35 : 1);
    if (def.invis) e.invisible = (this.t - e.lastAtk) > def.invis && !e.chain;

    // hero ability: radiant dash chain
    if (e.chain) { this.updChain(e, dt); return; }
    if (e.leap) { this.updLeap(e, dt); return; }
    if (e.dashing) { this.updDash(e, dt, sm); return; }
    if (e.jumping) { this.updJump(e, dt); return; }
    if (e.jumpCD > 0) e.jumpCD -= dt;
    if (e.dashCD > 0) e.dashCD -= dt;

    if (def.spawner) {
      e.spawnT -= dt * sm;
      if (e.spawnT <= 0) {
        e.spawnT += def.spawner.every;
        this.spawnAround(e, def.spawner.u, def.spawner.n, 1.0);
      }
    }
    if (def.healAura) {
      e.healT -= dt;
      if (e.healT <= 0) {
        e.healT += def.healAura.every;
        const amt = def.healAura.amt * levelMul(e.lvl);
        for (const f of this.ents) if (!f.dead && !f.bld && f.team === e.team && dist(f.x, f.y, e.x, e.y) <= def.healAura.r) f.hp = Math.min(f.maxHp, f.hp + amt);
        this.ev({ t: 'fx', k: 'healpulse', x: e.x, y: e.y, r: def.healAura.r });
      }
    }

    // targeting
    if (e.target && !this.valid(e, e.target)) { e.target = null; e.lock = false; e.rampT = 0; }
    if (!e.lock) {
      e.retargetT -= dt;
      if (e.retargetT <= 0 || !e.target) {
        e.retargetT = 0.2;
        const nt = this.acquire(e);
        if (nt !== e.target) { e.target = nt; e.rampT = 0; e.combo = 0; e.brawlStack = 0; }
      }
    }
    const t = e.target;
    if (!t) { e.state = 'idle'; return; }
    const g = this.gap(e, t);
    const inRange = g <= e.range + (e.lock ? 0.35 : 0);
    if (inRange) {
      if (!e.lock) { e.lock = true; e.atkCD = Math.max(e.atkCD, e.load); }
      e.state = 'attack';
      const dx = t.x - e.x, dy = t.y - e.y, dd = Math.hypot(dx, dy) || 1;
      e.dirX = dx / dd; e.dirY = dy / dd;
      if (def.ramp) e.rampT += dt;
      let hs = e.hs;
      if (e.veilT > 0) hs = 0.35;
      if (e.asc && e.kind === 'brawler') hs *= Math.max(0.55, 1 - 0.12 * (e.brawlStack || 0));
      e.atkCD -= dt * sm;
      if (e.atkCD <= 0) { this.attack(e, t); e.atkCD += hs; if (e.atkCD < 0) e.atkCD = hs * 0.5; }
      e.beam = def.ramp ? t.id : 0;
    } else {
      e.lock = false; e.beam = 0;
      e.state = 'walk';
      e.atkCD = Math.max(0, e.atkCD - dt * sm);
      // dash / jump openers
      if (def.dash && !t.bld && e.dashCD <= 0 && g >= def.dash.min - 0.5 && g <= def.dash.max) { e.dashing = { tid: t.id }; e.invuln = true; this.ev({ t: 'fx', k: 'dash', x: e.x, y: e.y, eid: e.id }); return; }
      if (def.jump && !t.air && !(e.jumpCD > 0) && g >= def.jump.min && g <= def.jump.max) {
        e.jumping = { x0: e.x, y0: e.y, x1: t.x, y1: t.y, t: 0, dur: 0.9 }; return;
      }
      this.moveToward(e, t.x, t.y, dt, sm * (e.charging ? 2 : 1), t);
      if (def.charge) {
        if (!e.charging) { e.chargeAcc += e.spd * sm * dt; if (e.chargeAcc >= def.charge.dist) { e.charging = true; this.ev({ t: 'fx', k: 'charge', x: e.x, y: e.y, eid: e.id }); } }
      }
    }
  }

  onDeployed(e) {
    const def = e.def;
    if (!e.bld) e.state = 'walk';
    this.ev({ t: 'landed', kind: e.kind, x: e.x, y: e.y, team: e.team, air: e.air });
    if (def.deployHit && !e.clone) {
      const h = def.deployHit, m = levelMul(e.lvl);
      this.areaHit(e, e.x, e.y, h.r, h.dmg * m, { air: e.hitsAir, stun: h.stun, slow: h.slow, towerMul: 1, fx: e.kind === 'titan_knight' ? 'slam' : e.kind === 'storm_caller' ? 'spark' : 'frostnova' });
    }
    if (e.asc && e.kind === 'bolt_thrower') this.areaHit(e, e.x, e.y, 3, 110 * levelMul(e.lvl), { air: true, kb: 1.5, fx: 'blast' });
  }

  spawnAround(e, uid, n, rr) {
    const fwd = e.team === 0 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? Math.PI / 2 * fwd : (i / n) * Math.PI * 2 + this.rng() * 0.5;
      const r = e.bld ? e.r + 0.5 : rr;
      let nx = clamp(e.x + Math.cos(a) * (n === 1 ? 0 : r), 0.4, 17.6), ny = clamp(e.y + (n === 1 ? fwd * (e.r + 0.5) : Math.sin(a) * r), 0.4, 31.6);
      if (ny > AR.RY0 && ny < AR.RY1 && !UNITS[uid].air) ny = e.team === 0 ? AR.RY1 + 0.2 : AR.RY0 - 0.2;
      this.spawnUnit(e.owner, uid, nx, ny, e.lvl, { deploy: 0.45 });
    }
  }

  navPoint(e, gx, gy) {
    if (e.air || e.def.jumpRiver) return [gx, gy];
    const es = e.y < AR.RY0 ? 1 : e.y > AR.RY1 ? 0 : -1;
    const gs = gy < AR.RY0 ? 1 : gy > AR.RY1 ? 0 : -1;
    const nb = AR.BRIDGES.reduce((a, b) => Math.abs(b - e.x) < Math.abs(a - e.x) ? b : a);
    if (es === -1) {
      if (gs === -1) return [gx, gy];
      return [nb + clamp(gx - nb, -0.5, 0.5), gy < AR.MID ? AR.RY0 - 0.7 : AR.RY1 + 0.7];
    }
    if (gs === -1 || gs === es) return [gx, gy];
    let b = AR.BRIDGES[0], bd = Infinity;
    for (const bx of AR.BRIDGES) { const d = Math.abs(e.x - bx) + Math.abs(bx - gx); if (d < bd) { bd = d; b = bx; } }
    const bankY = es === 0 ? AR.RY1 + 0.4 : AR.RY0 - 0.4;
    if (Math.abs(e.x - b) < 0.75 && Math.abs(e.y - bankY) < 1.6) return [b, es === 0 ? AR.RY0 - 0.7 : AR.RY1 + 0.7];
    return [b, bankY];
  }

  moveToward(e, gx, gy, dt, sm, tgt) {
    let [wx, wy] = this.navPoint(e, gx, gy);
    let dx = wx - e.x, dy = wy - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) return;
    dx /= d; dy /= d;
    if (!e.air) {
      // steer around static obstacles
      for (const o of this.ents) {
        if (!o.bld || o.dead || o === tgt) continue;
        const ox = o.x - e.x, oy = o.y - e.y;
        const along = ox * dx + oy * dy;
        const R = o.r + e.r + 0.05;
        if (along <= 0 || along > R + 2.2) continue;
        const s = ox * (-dy) + oy * dx;
        const perp = Math.abs(s);
        if (perp >= R) continue;
        const w = 0.6 + (R - perp) / R * 1.6;
        const sd = s === 0 ? (e.id % 2 ? 1 : -1) : sign(s);
        // push the heading away from the obstacle along the perpendicular p = (-dy, dx)
        const ndx = dx + dy * sd * w, ndy = dy - dx * sd * w;
        const l = Math.hypot(ndx, ndy) || 1;
        dx = ndx / l; dy = ndy / l;
      }
    }
    const step = e.spd * sm * dt;
    const mv = Math.min(step, d);
    e.x += dx * mv; e.y += dy * mv;
    e.dirX = dx; e.dirY = dy;
    e.walkT += dt * sm;
  }

  attack(e, t) {
    const def = e.def;
    e.atkT = 0;
    if (def.invis) { e.lastAtk = this.t; e.invisible = false; }
    let dmg = e.dmg;
    if (e.charging && def.charge) { dmg *= def.charge.mul; e.charging = false; e.chargeAcc = 0; this.ev({ t: 'fx', k: 'chargehit', x: t.x, y: t.y }); }
    if (def.kamikaze) {
      if (def.rng > 1) { e.leap = { x0: e.x, y0: e.y, x1: t.x, y1: t.y, t: 0, dur: 0.35, tid: t.id }; e.invuln = true; return; }
      this.explode(e, t.x, t.y); return;
    }
    if (def.kamikazeBld) { this.hurt(t, dmg, e, {}); this.ev({ t: 'fx', k: 'ramhit', x: e.x, y: e.y }); this.kill(e, null); return; }
    if (def.ramp) {
      const st = e.rampT < def.rampT ? 0 : e.rampT < def.rampT * 2 ? 1 : 2;
      this.hurt(t, def.ramp[st] * levelMul(e.lvl), e, {}); return;
    }
    if (def.combo) {
      e.combo = (e.combo || 0) + 1;
      if (e.combo % def.combo === 0) {
        this.hurt(t, dmg * 2.5, e, {});
        const dd = dist(e.x, e.y, t.x, t.y) || 1;
        this.knock(t, (t.x - e.x) / dd, (t.y - e.y) / dd, 1.2);
        this.ev({ t: 'fx', k: 'palm', x: t.x, y: t.y }); return;
      }
    }
    if (e.asc && e.kind === 'slinger' && this.gap(e, t) > 4) dmg *= 1.6;
    if (e.asc && e.kind === 'brawler') e.brawlStack = (e.brawlStack || 0) + 1;
    if (e.asc && e.kind === 'rattlebone') {
      const mine = this.ents.filter(x => !x.dead && x.owner === e.owner && x.kind === 'rattlebone').length;
      if (mine < 8) this.spawnUnit(e.owner, 'rattlebone', clamp(e.x - e.dirX * 0.6, 0.4, 17.6), clamp(e.y - e.dirY * 0.6, 0.4, 31.6), e.lvl, { deploy: 0.3 });
    }
    if (def.roll) {
      const dd = dist(e.x, e.y, t.x, t.y) || 1;
      this.projs.push({ id: this.nid++, k: 'boulder', team: e.team, owner: e.owner, src: e.id, x: e.x, y: e.y, px: e.x, py: e.y, dx: (t.x - e.x) / dd, dy: (t.y - e.y) / dd, w: def.roll.w, len: def.roll.len, spd: def.roll.spd, trav: 0, line: true, hit: new Set(), dmg, kb: def.roll.kb, ground: true, hitsBld: true, towerMul: 1, z: 0 });
      return;
    }
    if (def.boomerang) {
      const dd = dist(e.x, e.y, t.x, t.y) || 1;
      this.projs.push({ id: this.nid++, k: 'scythe', team: e.team, owner: e.owner, src: e.id, x: e.x, y: e.y, px: e.x, py: e.y, dx: (t.x - e.x) / dd, dy: (t.y - e.y) / dd, w: def.boomerang.w, len: def.boomerang.len, spd: def.boomerang.spd, trav: 0, line: true, back: false, hit: new Set(), dmg, ground: false, hitsBld: true, towerMul: 1, z: 0.4 });
      return;
    }
    if (def.multi) {
      const others = this.ents.filter(o => o !== t && this.valid(e, o) && !o.bld && this.gap(e, o) <= e.range).sort((a, b) => this.gap(e, a) - this.gap(e, b));
      const tl = [t].concat(others.slice(0, def.multi - 1));
      for (const tt of tl) { this.hurt(tt, dmg, e, {}); this.stun(tt, def.stunHit); this.ev({ t: 'zap', x0: e.x, y0: e.y, x1: tt.x, y1: tt.y, air: e.air }); }
      return;
    }
    if (def.zapHit) { this.hurt(t, dmg, e, {}); this.ev({ t: 'zap', x0: e.x, y0: e.y - (e.bld ? 1 : 0), x1: t.x, y1: t.y }); return; }
    if (def.proj) {
      const pr = { id: this.nid++, k: def.proj.k, team: e.team, owner: e.owner, src: e.id, x: e.x, y: e.y, px: e.x, py: e.y, tid: t.id, tx: t.x, ty: t.y, spd: def.proj.spd, dmg,
        splash: def.splash || 0, hitsAir: e.hitsAir, slowHit: def.slowHit, stunHit: def.stunHit, towerMul: def.towerMul || 1, z: e.air ? 1.2 : 0.6, t: 0, srcAir: e.air };
      if (def.proj.lob) { pr.lob = true; pr.x0 = e.x; pr.y0 = e.y; pr.dur = Math.max(0.3, dist(e.x, e.y, t.x, t.y) / def.proj.spd); pr.arc = Math.min(5, 1 + dist(e.x, e.y, t.x, t.y) * 0.35); pr.tid = 0; }
      this.projs.push(pr);
      return;
    }
    // melee
    this.applyHit(e, t, dmg, def.splashSelf ? e.x : t.x, def.splashSelf ? e.y : t.y);
    this.ev({ t: 'melee', x: t.x, y: t.y, big: e.mass >= 15 || !!def.splash });
  }

  applyHit(e, t, dmg, cx, cy) {
    const def = e.def || {};
    const tm = def.towerMul || 1;
    if (def.splash) {
      for (const o of this.ents) {
        if (o.dead || o.team === e.team || o.underground || o.hiddenState === 1) continue;
        if (o.air && !e.hitsAir) continue;
        if (o !== t && dist(o.x, o.y, cx, cy) > def.splash + o.r * 0.5) continue;
        this.hurt(o, dmg * (o.tower ? tm : 1), e, {});
      }
    } else this.hurt(t, dmg * (t.tower ? tm : 1), e, {});
  }

  explode(e, x, y) {
    const k = e.def.kamikaze;
    const dmg = e.dmg;
    if (k.chain) {
      let cur = { x, y }; const hit = new Set();
      const pts = [{ x: e.x, y: e.y }];
      for (let i = 0; i < k.chain; i++) {
        let best = null, bd = 4;
        for (const o of this.ents) {
          if (o.dead || o.team === e.team || hit.has(o) || o.underground || o.hiddenState === 1) continue;
          const d = dist(o.x, o.y, cur.x, cur.y);
          if (d < bd) { bd = d; best = o; }
        }
        if (!best) break;
        hit.add(best); this.hurt(best, dmg * (best.tower ? 0.35 : 1), e, {}); this.stun(best, k.stun);
        pts.push({ x: best.x, y: best.y }); cur = best;
      }
      this.ev({ t: 'chain', pts });
    } else {
      this.areaHit(e, x, y, k.r, dmg, { air: true, towerMul: e.def.tgt === 'bld' ? 1 : 0.35, freeze: k.freeze, fx: k.fx });
      if (k.heal) {
        const amt = k.heal * levelMul(e.lvl);
        for (const f of this.ents) if (!f.dead && !f.bld && f.team === e.team && f !== e && dist(f.x, f.y, x, y) <= k.healR) f.hp = Math.min(f.maxHp, f.hp + amt);
      }
    }
    e.x = x; e.y = y;
    this.kill(e, null);
  }

  updLeap(e, dt) {
    const L = e.leap; L.t += dt;
    const t = this.ents.find(o => o.id === L.tid);
    if (t && !t.dead) { L.x1 = t.x; L.y1 = t.y; }
    const k = Math.min(1, L.t / L.dur);
    e.x = lerp(L.x0, L.x1, k); e.y = lerp(L.y0, L.y1, k); e.z = Math.sin(k * Math.PI) * 1.2;
    if (k >= 1) { e.leap = null; e.z = 0; e.invuln = false; this.explode(e, e.x, e.y); }
  }

  updDash(e, dt, sm) {
    const t = this.ents.find(o => o.id === e.dashing.tid);
    if (!t || t.dead) { e.dashing = null; e.invuln = false; e.dashCD = 0.8; return; }
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
    const st = 9 * dt * sm;
    if (d - e.r - t.r <= e.range + 0.1 || d <= st) {
      this.hurt(t, e.dmg * e.def.dash.mul, e, {}); e.atkT = 0; e.atkCD = e.hs;
      e.dashing = null; e.invuln = false; e.dashCD = 0.8; e.target = t; e.lock = true;
      return;
    }
    e.x += dx / d * st; e.y += dy / d * st; e.dirX = dx / d; e.dirY = dy / d;
  }

  updJump(e, dt) {
    const J = e.jumping; J.t += dt;
    const k = Math.min(1, J.t / J.dur);
    e.x = lerp(J.x0, J.x1, k); e.y = lerp(J.y0, J.y1, k); e.z = Math.sin(k * Math.PI) * 2.2;
    if (k >= 1) {
      e.jumping = null; e.z = 0; e.jumpCD = 2.5;
      const j = e.def.jump;
      this.areaHit(e, e.x, e.y, j.r, j.dmg * levelMul(e.lvl), { air: false, towerMul: 1, fx: 'slam' });
      e.atkCD = e.hs * 0.6;
    }
  }

  updChain(e, dt) {
    const C = e.chain;
    C.t -= dt;
    if (C.cur) {
      const t = C.cur;
      const k = 1 - Math.max(0, C.t) / 0.2;
      e.x = lerp(C.x0, t.x, k); e.y = lerp(C.y0, t.y, k);
      if (C.t > 0) return;
      if (!t.dead) { this.hurt(t, C.dmg, e, {}); this.ev({ t: 'fx', k: 'radiant', x: t.x, y: t.y }); }
      C.cur = null;
    }
    if (C.left <= 0) { e.chain = null; e.invuln = false; return; }
    let best = null, bd = 5.5;
    for (const o of this.ents) {
      if (o.dead || o.team === e.team || o.air || C.hit.has(o.id) || o.underground || o.hiddenState === 1) continue;
      const d = dist(o.x, o.y, e.x, e.y) - o.r;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) { e.chain = null; e.invuln = false; return; }
    C.hit.add(best.id); C.left--; C.cur = best; C.x0 = e.x; C.y0 = e.y; C.t = 0.2;
    const dd = dist(e.x, e.y, best.x, best.y) || 1; e.dirX = (best.x - e.x) / dd; e.dirY = (best.y - e.y) / dd;
    e.atkT = 0;
  }

  // ---------------------------------------------------------------- buildings
  updBuilding(e, dt) {
    const def = e.def;
    if (e.deployT > 0) { e.deployT -= dt; if (e.deployT <= 0) this.onDeployed(e); return; }
    e.hp -= e.decay * dt;
    if (e.hp <= 0) { this.kill(e, null); return; }
    if (e.stunT > 0) e.stunT -= dt;
    if (e.rageT > 0) e.rageT -= dt;
    if (e.freezeT > 0) { e.freezeT -= dt; return; }
    if (e.stunT > 0) return;
    const sm = e.rageT > 0 ? 1.35 : 1;
    if (def.spawner) {
      e.spawnT -= dt * sm;
      if (e.spawnT <= 0) { e.spawnT += def.spawner.every; this.spawnAround(e, def.spawner.u, def.spawner.n, 1); }
    }
    if (def.generate) {
      e.genT -= dt;
      if (e.genT <= 0) { e.genT += def.generate; const p = this.players[e.owner]; p.ember = Math.min(10, p.ember + 1); this.ev({ t: 'fx', k: 'ember', x: e.x, y: e.y, pid: e.owner }); }
    }
    if (!def.dmg) return;
    if (def.hidden) {
      const near = this.acquireInRange(e);
      if (e.hiddenState === 1) { if (near) { e.hiddenState = 2; e.riseT = 0.5; this.ev({ t: 'fx', k: 'rise', x: e.x, y: e.y }); } return; }
      if (e.hiddenState === 2) { e.riseT -= dt; if (e.riseT <= 0) { e.hiddenState = 0; e.atkCD = 0.3; } return; }
      if (!near && !(e.target && this.valid(e, e.target))) { e.idleT = (e.idleT || 0) + dt; if (e.idleT > 1) { e.hiddenState = 1; e.target = null; } return; }
      e.idleT = 0;
    }
    if (e.target && (!this.valid(e, e.target) || this.gap(e, e.target) > e.range + 0.3 || (def.minRng && this.gap(e, e.target) < def.minRng))) { e.target = null; e.rampT = 0; }
    if (!e.target) { e.target = this.acquireInRange(e); e.rampT = 0; if (e.target) e.atkCD = Math.max(e.atkCD, e.load); }
    const t = e.target;
    if (!t) { e.state = 'idle'; e.beam = 0; e.atkCD = Math.max(0, e.atkCD - dt); return; }
    e.state = 'attack';
    const dx = t.x - e.x, dy = t.y - e.y, dd = Math.hypot(dx, dy) || 1;
    e.dirX = dx / dd; e.dirY = dy / dd;
    if (def.ramp) { e.rampT += dt; e.beam = t.id; }
    e.atkCD -= dt * sm;
    if (e.atkCD <= 0) { this.attack(e, t); e.atkCD += e.hs; }
  }

  // ---------------------------------------------------------------- towers
  updTower(e, dt) {
    if (e.dead) return;
    if (e.freezeT > 0) { e.freezeT -= dt; return; }
    if (e.wakeT > 0) { e.wakeT -= dt; return; }
    if (!e.active) return;
    const D = e.defender ? DEFENDERS[e.defender] : null;
    if (D && D.heal) {
      e.healT -= dt;
      if (e.healT <= 0) {
        e.healT += 1;
        let any = false;
        for (const f of this.ents) if (!f.dead && !f.bld && f.team === e.team && f.hp < f.maxHp && dist(f.x, f.y, e.x, e.y) <= D.healR) { f.hp = Math.min(f.maxHp, f.hp + D.heal * levelMul(e.lvl)); any = true; }
        if (any) this.ev({ t: 'fx', k: 'healpulse', x: e.x, y: e.y, r: D.healR });
      }
    }
    if (e.target && (!this.valid(e, e.target) || this.gap(e, e.target) > e.range)) e.target = null;
    if (!e.target) { e.target = this.acquireInRange(e); if (e.target) e.atkCD = Math.max(e.atkCD, 0.3); }
    const t = e.target;
    if (D && D.ammo && !t) { e.reloadT = (e.reloadT || 0) + dt; if (e.reloadT >= D.reload) { e.reloadT = 0; e.ammo = Math.min(D.ammo, e.ammo + 1); } }
    if (!t) { e.atkCD = Math.max(0, e.atkCD - dt); return; }
    const dx = t.x - e.x, dy = t.y - e.y, dd = Math.hypot(dx, dy) || 1;
    e.dirX = dx / dd; e.dirY = dy / dd;
    e.atkCD -= dt;
    if (e.atkCD <= 0) {
      let hs = e.hs;
      if (D && D.ammo) { if (e.ammo > 0) e.ammo--; else hs = 0.9; }
      e.atkCD += hs; e.atkT = 0;
      const k = e.tower === 'keep' ? 'cannonball' : D.proj;
      this.projs.push({ id: this.nid++, k, team: e.team, owner: e.owner, src: e.id, x: e.x, y: e.y - (e.team === 0 ? 0.6 : -0.2), px: e.x, py: e.y, tid: t.id, tx: t.x, ty: t.y, spd: k === 'cannonball' ? 13 : 17, dmg: e.dmg, splash: 0, hitsAir: true, towerMul: 1, z: e.tower === 'keep' ? 2.4 : 2.0, t: 0 });
    }
  }

  // ---------------------------------------------------------------- projectiles
  updProj(pr, dt) {
    pr.px = pr.x; pr.py = pr.y;
    if (pr.line) { this.updLineProj(pr, dt); return; }
    if (pr.lob) {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      pr.x = lerp(pr.x0, pr.tx, k); pr.y = lerp(pr.y0, pr.ty, k);
      pr.z = Math.sin(k * Math.PI) * (pr.arc || 2) + (1 - k) * (pr.z0 || 0);
      if (k >= 1) {
        pr.done = true;
        if (pr.impact) pr.impact();
        else this.projImpact(pr, null);
      }
      return;
    }
    // homing
    const t = pr.tid ? this.ents.find(o => o.id === pr.tid) : null;
    if (t && !t.dead) { pr.tx = t.x; pr.ty = t.y; }
    const dx = pr.tx - pr.x, dy = pr.ty - pr.y, d = Math.hypot(dx, dy);
    const st = pr.spd * dt;
    pr.t += dt;
    pr.z = lerp(pr.z, t && t.air ? 1.2 : 0.4, Math.min(1, dt * 4));
    if (d <= st + 0.05) {
      pr.done = true;
      this.projImpact(pr, t && !t.dead ? t : null);
      return;
    }
    pr.x += dx / d * st; pr.y += dy / d * st;
  }

  projImpact(pr, t) {
    const src = this.ents.find(o => o.id === pr.src) || null;
    if (pr.splash) {
      for (const o of this.ents) {
        if (o.dead || o.team === pr.team || o.underground || o.hiddenState === 1) continue;
        if (o.air && !pr.hitsAir) continue;
        if (o !== t && dist(o.x, o.y, pr.tx, pr.ty) > pr.splash + o.r * 0.5) continue;
        this.hurt(o, pr.dmg * (o.tower ? pr.towerMul : 1), src, { proj: true, owner: pr.owner });
        if (pr.slowHit) this.slow(o, pr.slowHit.mul, pr.slowHit.t);
      }
      this.ev({ t: 'fx', k: 'splash_' + pr.k, x: pr.tx, y: pr.ty, r: pr.splash });
    } else if (t) {
      this.hurt(t, pr.dmg * (t.tower ? pr.towerMul : 1), src, { proj: true, owner: pr.owner });
      if (pr.slowHit) this.slow(t, pr.slowHit.mul, pr.slowHit.t);
      if (pr.stunHit) this.stun(t, pr.stunHit);
      this.ev({ t: 'hit', k: pr.k, x: t.x, y: t.y, air: t.air });
    }
  }

  updLineProj(pr, dt) {
    let st = pr.spd * dt;
    if (pr.k === 'scythe') {
      const src = this.ents.find(o => o.id === pr.src);
      if (pr.back) {
        if (!src || src.dead) { pr.done = true; return; }
        const dx = src.x - pr.x, dy = src.y - pr.y, d = Math.hypot(dx, dy);
        if (d < st + 0.2) { pr.done = true; return; }
        pr.dx = dx / d; pr.dy = dy / d;
      }
    }
    pr.x += pr.dx * st; pr.y += pr.dy * st; pr.trav += st;
    pr.spin = (pr.spin || 0) + dt * 14;
    for (const o of this.ents) {
      if (o.dead || o.team === pr.team || pr.hit.has(o.id) || o.underground || o.hiddenState === 1) continue;
      if (o.air && pr.ground) continue;
      if (o.bld && !pr.hitsBld) continue;
      // distance from o to the swept segment
      const ax = pr.px, ay = pr.py, bx = pr.x, by = pr.y;
      const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-6;
      const k = clamp(((o.x - ax) * vx + (o.y - ay) * vy) / l2, 0, 1);
      const dd = dist(o.x, o.y, ax + vx * k, ay + vy * k);
      if (dd > pr.w + o.r * 0.7) continue;
      pr.hit.add(o.id);
      this.hurt(o, pr.dmg * (o.tower ? (pr.towerMul || 1) : 1), null, { owner: pr.owner });
      if (pr.kb && !o.bld) this.knock(o, pr.dx, pr.dy, pr.kb);
    }
    if (pr.k === 'scythe' && !pr.back && pr.trav >= pr.len) { pr.back = true; pr.hit = new Set(); }
    else if (pr.k !== 'scythe' && pr.trav >= pr.len) pr.done = true;
    if (pr.x < -1 || pr.x > AR.W + 1 || pr.y < -1 || pr.y > AR.H + 1) pr.done = true;
  }

  // ---------------------------------------------------------------- persistent areas
  updArea(a, dt) {
    a.t += dt;
    if (a.k === 'frenzy') {
      for (const e of this.ents) if (!e.dead && e.team === a.team && !e.tower && dist(e.x, e.y, a.x, a.y) <= a.r + e.r * 0.5) e.rageT = Math.max(e.rageT, 1.2);
    } else if (a.k === 'blight') {
      a.tick += dt;
      if (a.tick >= 0.25) {
        a.tick -= 0.25;
        for (const t of this.enemiesIn(a.team, a.x, a.y, a.r, { air: true })) { this.hurt(t, a.dps * 0.25 * (t.tower ? a.towerMul : 1), null, { owner: a.owner }); this.slow(t, 0.85, 0.3); }
      }
    } else if (a.k === 'tremor') {
      a.tick += dt;
      if (a.tick >= 0.5) {
        a.tick -= 0.5;
        for (const t of this.enemiesIn(a.team, a.x, a.y, a.r, { hidden: true })) { this.hurt(t, a.pulse * (t.tower ? 1.2 : t.bld ? 3.5 : 1), null, { owner: a.owner }); this.slow(t, 0.5, 0.6); }
      }
    } else if (a.k === 'vortex') {
      for (const t of this.enemiesIn(a.team, a.x, a.y, a.r, { air: true, noBld: true })) {
        const dx = a.x - t.x, dy = a.y - t.y, d = Math.hypot(dx, dy);
        if (d > 0.3) { const pull = 3.6 / Math.max(1, t.mass / 4) * dt; t.x += dx / d * Math.min(pull, d); t.y += dy / d * Math.min(pull, d); }
        this.hurt(t, a.dps * dt, null, { owner: a.owner });
        if (t.def && t.def.charge) { t.charging = false; t.chargeAcc = 0; }
      }
    } else if (a.k === 'haunting') {
      const start = 2.2, interval = (a.life - start) / a.n;
      while (a.spawned < a.n && a.t >= start + a.spawned * interval) {
        a.spawned++;
        const ang = this.rng() * Math.PI * 2, rr = Math.sqrt(this.rng()) * a.r;
        let x = clamp(a.x + Math.cos(ang) * rr, 0.5, 17.5), y = clamp(a.y + Math.sin(ang) * rr, 0.5, 31.5);
        if (y > AR.RY0 && y < AR.RY1) y = y < AR.MID ? AR.RY0 - 0.2 : AR.RY1 + 0.2;
        this.spawnUnit(a.owner, 'rattlebone', x, y, a.lvl, { deploy: 0.5 });
      }
    }
    if (a.t >= a.life) {
      a.done = true;
      if (a.boom) this.areaHit(a, a.x, a.y, a.r, a.dmg, { air: a.k !== 'keg', towerMul: 1, fx: 'boom' });
    }
  }

  // ---------------------------------------------------------------- physics
  collide() {
    const L = this.ents.filter(e => !e.dead && !e.underground && !e.jumping && !e.leap && !e.chain && !e.dashing);
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (a.air !== b.air) continue;
        if (a.bld && b.bld) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const md = a.r + b.r;
        if (Math.abs(dx) > md || Math.abs(dy) > md) continue;
        let d = Math.hypot(dx, dy);
        if (d >= md) continue;
        let nx, ny;
        if (d < 1e-4) { nx = (a.id % 2 ? 1 : -1); ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
        const ov = (md - d);
        if (a.bld) { b.x += nx * ov; b.y += ny * ov; continue; }
        if (b.bld) { a.x -= nx * ov; a.y -= ny * ov; continue; }
        // heavier units push lighter ones; units in deploy are planted
        const ma = a.deployT > 0 ? a.mass * 3 : a.mass, mb = b.deployT > 0 ? b.mass * 3 : b.mass;
        const ta = mb / (ma + mb), tb = ma / (ma + mb);
        a.x -= nx * ov * ta * 0.8; a.y -= ny * ov * ta * 0.8;
        b.x += nx * ov * tb * 0.8; b.y += ny * ov * tb * 0.8;
      }
    }
    for (const e of L) {
      if (e.bld) continue;
      e.x = clamp(e.x, e.r * 0.6, AR.W - e.r * 0.6);
      e.y = clamp(e.y, 0.3, AR.H - 0.3);
      if (e.air || (e.def && e.def.jumpRiver)) continue;
      if (e.y > AR.RY0 && e.y < AR.RY1) {
        const b = AR.BRIDGES.reduce((p, q) => Math.abs(q - e.x) < Math.abs(p - e.x) ? q : p);
        const hw = AR.BHW - e.r * 0.4;
        if (Math.abs(e.x - b) > hw) {
          if (e.py > AR.RY0 && e.py < AR.RY1 && Math.abs(e.px - b) <= hw + 0.05) e.x = clamp(e.x, b - hw, b + hw);
          else e.y = e.py <= AR.MID ? AR.RY0 : AR.RY1;
        }
      }
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Battle, AR, DT };
