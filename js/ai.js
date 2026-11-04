'use strict';
// CPU opponents. Works in local coordinates where the AI's own side is the bottom (high y).

const TRAITS = {};
(function buildTraits() {
  for (const c of CARDS) {
    const t = { id: c.id, cost: c.cost, type: c.type };
    if (c.type === 'spell') {
      t.spell = c.spell; t.dmg = c.dmg || 0; t.r = c.r || 0; t.towerMul = c.towerMul || 0;
      t.small = c.cost <= 3 && t.dmg > 0 && t.dmg < 400; t.big = t.dmg >= 600;
      t.control = ['rime', 'vortex', 'snowball', 'log', 'spark'].includes(c.spell);
      t.offenseSpell = ['crate', 'haunting'].includes(c.spell);
      t.buff = c.spell === 'frenzy' || c.spell === 'mirage';
    } else {
      const u = UNITS[c.unit], n = c.count || 1;
      t.hp = (u.hp + (u.shield || 0)) * n;
      t.dps = (u.ramp ? 200 : u.dmg ? u.dmg / u.hs : 0) * n;
      if (u.kamikaze) t.dps = u.dmg * n * 1.5;
      if (u.spawner) t.dps += 80;
      t.hitsAir = u.tgt === 'all';
      t.air = !!u.air;
      t.splash = !!(u.splash || (u.kamikaze && (u.kamikaze.r > 1 || u.kamikaze.chain)) || u.roll || u.boomerang);
      t.bldTarget = u.tgt === 'bld';
      t.wincon = t.bldTarget || ['tunneler', 'siege_ballista', 'thunder_engine', 'titan_knight'].includes(c.id);
      t.tank = t.hp >= 2500;
      t.swarm = n >= 3;
      t.bld = !!u.bld;
      t.defBld = !!(u.bld && (u.dmg || u.spawner));
      t.range = u.rng || 0;
      t.ranged = (u.rng || 0) >= 3.5;
      t.fast = SPD[u.spd] >= 1.45;
      t.hero = c.rarity === 'hero';
      t.kamikaze = !!u.kamikaze;
      t.gen = !!u.generate;
      t.anywhere = !!c.anywhere;
      t.slowTank = t.tank && u.spd === 'slow';
    }
    TRAITS[c.id] = t;
  }
})();

class AIBrain {
  constructor(battle, pid, diffKey, opt = {}) {
    this.b = battle; this.pid = pid; this.p = battle.players[pid];
    this.diff = AI_DIFFS[diffKey] || AI_DIFFS.normal; this.diffKey = diffKey;
    this.rng = RNG((battle.cfg.seed || 1) * 7 + pid * 101);
    this.thinkT = 1 + this.rng() * 1.5;
    this.threatSeen = 0;
    this.lastPlay = -9;
    this.lane = this.rng() < 0.5 ? 0 : 1;
    this.saveUntil = 0;
    this.emoteCD = 10;
    this.partner = opt.partner || false;
    this.patience = 7 + this.rng() * 3; // ember threshold before committing a push
  }

  // local <-> world (own side bottom)
  ly(y) { return this.p.team === 0 ? y : AR.H - y; }
  lx(x) { return this.p.team === 0 ? x : AR.W - x; }
  wx(x) { return this.p.team === 0 ? x : AR.W - x; }
  wy(y) { return this.p.team === 0 ? y : AR.H - y; }

  update(dt) {
    const b = this.b;
    if (b.over) return;
    this.emoteCD -= dt;
    this.thinkT -= dt;
    this.abilityLogic();
    if (this.thinkT > 0) return;
    this.thinkT = this.diff.think * (0.75 + this.rng() * 0.5);
    this.decide();
  }

  hand() {
    const out = [];
    for (let s = 0; s < 4; s++) {
      const c = this.b.cardFor(this.p, s);
      if (!c) continue;
      if (c.echo && !this.p.lastCard) continue;
      out.push({ slot: s, id: c.card.id, cid: c.cid, cost: c.cost, tr: TRAITS[c.card.id], card: c.card, echo: c.echo });
    }
    return out;
  }

  enemies() {
    return this.b.ents.filter(e => !e.dead && e.team !== this.p.team && !e.tower && !e.underground);
  }
  friends() {
    return this.b.ents.filter(e => !e.dead && e.team === this.p.team && !e.tower && !e.bld);
  }

  threats() {
    // enemy troops on our half or about to cross
    const list = this.enemies().filter(e => !e.bld && this.ly(e.y) > 11.5);
    const lanes = [[], []];
    for (const e of list) lanes[this.lx(e.x) < 9 ? 0 : 1].push(e);
    const val = arr => arr.reduce((s, e) => s + e.hp + e.shield + (e.dmg / (e.hs || 1)) * 4 + (this.ly(e.y) > 20 ? 300 : 0), 0);
    return { list, lanes, v: [val(lanes[0]), val(lanes[1])], total: val(list) };
  }

  play(slot, lx, ly, why) {
    const r = this.b.play(this.pid, slot, this.wx(lx), this.wy(ly));
    if (r.ok) { this.lastPlay = this.b.t; this.lastWhy = why; }
    return r.ok;
  }

  decide() {
    const b = this.b, p = this.p, D = this.diff;
    const H = this.hand();
    if (!H.length) return;
    const th = this.threats();

    // Easy bots sometimes just do something random
    if (this.rng() < D.mistake && p.ember >= 3) {
      const c = this.rng.pick(H.filter(h => h.cost <= p.ember));
      if (c && this.randomPlay(c)) return;
    }

    // 1. defend
    if (th.total > 150) {
      if (!this.threatSeen) this.threatSeen = b.t;
      if (b.t - this.threatSeen >= D.react) {
        if (this.defend(H, th)) return;
      }
    } else this.threatSeen = 0;

    // 2. finish a low tower with a spell
    if (this.rng() < D.spellIQ && this.spellFinish(H)) return;

    // 3. value spell on a juicy cluster anywhere
    if (this.rng() < D.spellIQ && this.spellValue(H, 1.6)) return;

    // 4. support our own push
    if (this.support(H)) return;

    // 5. start a push / avoid leaking
    this.offense(H, th);
  }

  randomPlay(c) {
    if (c.tr.type === 'spell') {
      const en = this.enemies();
      const t = en.length ? this.rng.pick(en) : this.b.towers.find(x => x.team !== this.p.team && !x.dead);
      if (!t) return false;
      return this.play(c.slot, this.lx(t.x), this.ly(t.y), 'random');
    }
    const lx = 2 + this.rng() * 14, ly = 18 + this.rng() * 11;
    return this.play(c.slot, lx, ly, 'random');
  }

  // ------------------------------------------------------------------ defense
  defend(H, th) {
    const p = this.p;
    const lane = th.v[0] >= th.v[1] ? 0 : 1;
    const group = th.lanes[lane].length ? th.lanes[lane] : th.list;
    if (!group.length) return false;
    const airHp = group.filter(e => e.air).reduce((s, e) => s + e.hp + e.shield, 0);
    const gndHp = group.filter(e => !e.air).reduce((s, e) => s + e.hp + e.shield, 0);
    const swarm = group.filter(e => e.maxHp < 450).length;
    const tank = group.find(e => e.maxHp >= 2000);
    const bldTargeters = group.filter(e => e.def && e.def.tgt === 'bld');
    // nearest threat to our towers
    const lead = group.reduce((a, e) => (this.ly(e.y) > this.ly(a.y) ? e : a), group[0]);
    const urgent = this.ly(lead.y) > 19;

    let best = null, bs = -1e9;
    for (const c of H) {
      const tr = c.tr;
      if (c.cost > p.ember + 0.01) continue;
      let s = 0;
      if (tr.type === 'spell') {
        if (!tr.dmg && tr.spell !== 'rime' && tr.spell !== 'vortex') continue;
        const v = this.bestSpellSpot(tr, group);
        if (!v) continue;
        s = v.value - c.cost * 140;
        if (tr.big && v.value < 800) s -= 400;
        c._spot = v;
      } else if (tr.type === 'building') {
        if (!tr.defBld) continue;
        s = 150 + (bldTargeters.length ? 500 : 0) + (tank ? 300 : 0) - c.cost * 70;
        if (airHp > gndHp && !UNITS[c.card.unit].tgt) s -= 200;
        if (airHp > 0 && UNITS[c.card.unit].tgt === 'ground') s -= airHp * 0.4;
      } else {
        const coverAir = tr.hitsAir ? airHp : 0;
        const coverable = gndHp + coverAir;
        if (coverable <= 0) continue;
        s = Math.min(tr.dps * 6, coverable) + Math.min(tr.hp, 1500) * 0.25;
        if (swarm >= 3 && tr.splash) s += 400;
        if (swarm >= 3 && !tr.splash && tr.hp > 1500 && !tr.swarm) s -= 250;
        if (tank && tr.dps > 300) s += 250;
        if (tank && tr.swarm && !tr.air) s += 200;
        if (airHp > 0 && !tr.hitsAir) s -= airHp * 0.5;
        if (tr.bldTarget) s -= 900;
        if (tr.wincon && !tr.bldTarget) s -= 100;
        if (tr.hero) s += 100;
        if (tr.gen) s -= 1000;
        s -= c.cost * 75;
      }
      if (s > bs) { bs = s; best = c; }
    }
    if (!best || bs < (urgent ? -150 : 60)) return false;
    // less skilled bots often grab whatever is affordable instead of the right counter
    if (this.rng() > (this.diff.skill != null ? this.diff.skill : 1)) {
      const alt = H.filter(c => c.cost <= this.p.ember && c.tr.type === 'troop');
      if (alt.length) best = this.rng.pick(alt);
    }
    return this.placeDefense(best, lead, group, lane);
  }

  placeDefense(c, lead, group, lane) {
    const tr = c.tr;
    const lx = this.lx(lead.x), ly = this.ly(lead.y);
    if (tr.type === 'spell') {
      const sp = c._spot;
      return this.play(c.slot, sp.x, sp.y, 'def-spell');
    }
    if (tr.type === 'building') {
      // centre pull, a little toward the threatened lane
      const bx = 9 + (lane === 0 ? -1 : 1) * (this.rng() < 0.5 ? 0 : 1);
      return this.play(c.slot, bx, 21, 'def-bld');
    }
    let x, y;
    if (tr.ranged || tr.hero && tr.range > 3) {
      x = lane === 0 ? 3.5 + (this.rng() < 0.5 ? -1 : 1.5) : 14.5 + (this.rng() < 0.5 ? 1 : -1.5);
      y = Math.max(ly + 3, 26.5);
      if (lead.air) y = Math.max(ly + 2.5, 24.5);
    } else if (tr.kamikaze) {
      x = lx; y = Math.max(17.5, ly + 2.2);
    } else if (tr.swarm || tr.splash) {
      x = lx; y = Math.max(17.5, ly + (lead.def && lead.def.tgt === 'bld' ? 1.5 : 2.5));
    } else {
      // tanky melee: drop in the path, a bit to the side so the tower helps
      x = lx + (lx < 9 ? 1 : -1) * 0.5; y = Math.max(17.5, ly + 2);
    }
    const sloppy = 1 - (this.diff.skill != null ? this.diff.skill : 1);
    x += (this.rng() - 0.5) * sloppy * 5; y += (this.rng() - 0.5) * sloppy * 4;
    y = clamp(y, 17.5, 30.5);
    x = clamp(x, 0.6, 17.4);
    return this.tryPlace(c, x, y, 'def');
  }

  tryPlace(c, x, y, why) {
    for (let i = 0; i < 6; i++) {
      const jx = x + (i ? (this.rng() - 0.5) * 2 * i * 0.5 : 0), jy = y + (i ? this.rng() * i * 0.4 : 0);
      if (this.play(c.slot, clamp(jx, 0.5, 17.5), clamp(jy, 17.2, 31.5), why)) return true;
    }
    return false;
  }

  bestSpellSpot(tr, group) {
    const b = this.b;
    const r = tr.r || 2.5;
    let best = null;
    const cands = group.concat(this.enemies().filter(e => e.bld));
    for (const e of cands) {
      // predict a little movement
      const px = e.x + (e.dirX || 0) * (e.spd || 0) * 0.6, py = e.y + (e.dirY || 0) * (e.spd || 0) * 0.6;
      let value = 0;
      for (const o of b.ents) {
        if (o.dead || o.team === this.p.team || o.underground) continue;
        const d = dist(o.x, o.y, px, py);
        if (d > r + o.r * 0.5) continue;
        if (tr.spell === 'log' && o.air) continue;
        const dmg = (tr.dmg || 0) * levelMul(STD_LEVEL);
        if (o.tower) value += dmg * (tr.towerMul || 0.3) * 0.8;
        else if (tr.spell === 'rime' || tr.spell === 'vortex') value += Math.min(o.hp, 600) * 0.6 + (o.dmg || 0) * 2;
        else value += Math.min(o.hp + o.shield, dmg) * (o.hp <= dmg ? 1.4 : 1);
      }
      if (!best || value > best.value) best = { value, x: this.lx(px), y: this.ly(py) };
    }
    if (tr.spell === 'log' && best) best.y = Math.min(best.y + 3, 31);
    return best;
  }

  spellValue(H, mult) {
    const p = this.p;
    for (const c of H) {
      const tr = c.tr;
      if (tr.type !== 'spell' || !tr.dmg || c.cost > p.ember) continue;
      const en = this.enemies();
      if (!en.length) continue;
      const v = this.bestSpellSpot(tr, en);
      if (v && v.value >= c.cost * 160 * mult) return this.play(c.slot, v.x, v.y, 'value-spell');
    }
    return false;
  }

  spellFinish(H) {
    const p = this.p;
    const towers = this.b.towers.filter(t => t.team !== p.team && !t.dead);
    for (const c of H) {
      const tr = c.tr;
      if (tr.type !== 'spell' || !tr.dmg || c.cost > p.ember) continue;
      const lvl = p.levels[c.id] || STD_LEVEL;
      const dmg = tr.dmg * levelMul(lvl) * (tr.towerMul || 0.3) * (tr.spell === 'thunder' ? 1 : 1);
      for (const t of towers) if (t.hp <= dmg * 0.98) return this.play(c.slot, this.lx(t.x), this.ly(t.y), 'finish');
    }
    return false;
  }

  // ------------------------------------------------------------------ offense
  support(H) {
    const p = this.p;
    const fr = this.friends().filter(e => e.def && (e.maxHp >= 1500 || e.def.tgt === 'bld') && this.ly(e.y) < 24 && this.ly(e.y) > 8);
    if (!fr.length) return false;
    const lead = fr.reduce((a, e) => (this.ly(e.y) < this.ly(a.y) ? e : a), fr[0]);
    const near = this.friends().filter(e => dist(e.x, e.y, lead.x, lead.y) < 4 && e !== lead).length;
    if (near >= 2 || p.ember < 4) return false;
    let best = null, bs = -1e9;
    for (const c of H) {
      const tr = c.tr;
      if (c.cost > p.ember - 0.5 || tr.type !== 'troop' || tr.tank || tr.gen) continue;
      let s = tr.dps * 2 + (tr.splash ? 250 : 0) + (tr.hitsAir ? 100 : 0) - c.cost * 60;
      if (tr.bldTarget) s += lead.def.tgt === 'bld' ? -200 : 150;
      if (s > bs) { bs = s; best = c; }
    }
    // buff spells on a big push
    for (const c of H) if (c.tr.buff && c.cost <= p.ember && near >= 1 && this.ly(lead.y) < 12 && this.rng() < 0.5) return this.play(c.slot, this.lx(lead.x), this.ly(lead.y) - 1, 'buff');
    if (!best) return false;
    const lx = this.lx(lead.x), ly = this.ly(lead.y);
    const y = clamp(ly + (best.tr.ranged ? 2.5 : 1.2), 17.5, 31);
    return this.tryPlace(best, clamp(lx, 0.6, 17.4), y, 'support');
  }

  pushLane() {
    const en = this.b.towers.filter(t => t.team !== this.p.team && t.tower === 'side');
    const alive = en.filter(t => !t.dead);
    if (alive.length === 1) return this.lx(alive[0].x) < 9 ? 0 : 1;
    if (alive.length === 2) {
      const [a, b] = alive;
      if (Math.abs(a.hp - b.hp) > 300) return this.lx((a.hp < b.hp ? a : b).x) < 9 ? 0 : 1;
    }
    return this.lane;
  }

  offense(H, th) {
    const p = this.p, b = this.b;
    const lane = this.pushLane();
    const laneX = lane === 0 ? 3.5 : 14.5;
    const enemyEmber = b.players.filter(q => q.team !== p.team).reduce((s, q) => Math.max(s, q.ember), 0);
    const leaking = p.ember >= 9.6;
    const threshold = this.diffKey === 'easy' ? 5 + this.rng() * 4 : this.patience;
    const late = b.emberPhase() >= 2;
    if (p.ember < threshold && !leaking && !(late && p.ember >= 5)) return false;

    // Pick a card for the push
    let best = null, bs = -1e9;
    for (const c of H) {
      const tr = c.tr;
      if (c.cost > p.ember) continue;
      let s = 0;
      if (tr.type === 'spell') {
        if (tr.offenseSpell) s = 260 - c.cost * 30;
        else if (tr.spell === 'log' || tr.spell === 'volley' || tr.spell === 'spark') s = -200;
        else continue;
      } else if (tr.gen) s = th.total < 100 && p.ember >= 6.5 && !late ? 420 : -500;
      else if (tr.wincon) s = 400 + (tr.slowTank ? (p.ember >= 9 ? 100 : -150) : 0);
      else if (tr.tank) s = p.ember >= 8.5 ? 300 : 60;
      else if (tr.type === 'building') s = tr.defBld && UNITS[c.card.unit].spawner ? 160 : -300;
      else s = 120 + (tr.hero ? 120 : 0) - c.cost * 20 + (tr.fast ? 60 : 0);
      s += this.rng() * 80;
      if (s > bs) { bs = s; best = c; }
    }
    if (!best || bs < (leaking ? -400 : 100)) {
      if (!leaking) return false;
      best = H.filter(c => c.cost <= p.ember && c.tr.type !== 'spell').sort((a, b2) => a.cost - b2.cost)[0];
      if (!best) return false;
    }
    const tr = best.tr;
    if (tr.type === 'spell') {
      const tw = b.towers.find(t => t.team !== p.team && !t.dead && t.tower === 'side' && (this.lx(t.x) < 9 ? 0 : 1) === lane) || b.towers.find(t => t.team !== p.team && !t.dead);
      if (!tw) return false;
      return this.play(best.slot, this.lx(tw.x), this.ly(tw.y) + (best.id === 'imp_crate' ? 0.5 : 0), 'push-spell');
    }
    if (tr.anywhere) {
      const tw = b.towers.find(t => t.team !== p.team && !t.dead && t.tower === 'side' && (this.lx(t.x) < 9 ? 0 : 1) === lane) || b.towers.find(t => t.team !== p.team && !t.dead);
      return this.play(best.slot, this.lx(tw.x) + (this.rng() < 0.5 ? -0.6 : 0.6), this.ly(tw.y) - 2.2, 'tunnel');
    }
    if (tr.gen) return this.tryPlace(best, lane === 0 ? 6 : 12, 29.5, 'gen');
    if (best.id === 'siege_ballista') return this.tryPlace(best, laneX + (lane === 0 ? 1.5 : -1.5), 18.5, 'siege');
    if (tr.type === 'building') return this.tryPlace(best, 9 + (lane ? 2 : -2), 22, 'bld');
    if (tr.slowTank && p.ember < 9.8 && !late) return this.tryPlace(best, lane === 0 ? 2.5 : 15.5, 30.5, 'tank-back');
    if (tr.air && tr.bldTarget) return this.tryPlace(best, laneX, 18, 'air-bridge');
    if (tr.bldTarget || tr.fast) return this.tryPlace(best, laneX, 17.5, 'bridge');
    if (tr.ranged) return this.tryPlace(best, laneX + (lane ? -1 : 1), 24, 'ranged-back');
    return this.tryPlace(best, laneX, 19, 'push');
  }

  // ------------------------------------------------------------------ heroes & emotes
  abilityLogic() {
    const p = this.p, b = this.b;
    const h = p.heroEnt;
    if (!h || h.dead || h.deployT > 0 || p.abilCD > 0) return;
    const ab = CARD[p.heroCard].ability;
    if (p.ember < ab.cost + (this.diffKey === 'easy' ? 3 : 0)) return;
    if (this.rng() > 0.15 + this.diff.spellIQ * 0.3) return;
    const near = this.enemies().filter(e => !e.air && dist(e.x, e.y, h.x, h.y) < 5.5);
    let go = false;
    if (ab.id === 'radiant_dash') go = near.length >= 2 || (near.length >= 1 && h.hp < h.maxHp * 0.5);
    else if (ab.id === 'veil') go = (h.target && h.lock) || h.hp < h.maxHp * 0.6;
    else if (ab.id === 'raise') go = (h.souls || 0) >= 4 || near.length >= 3;
    else if (ab.id === 'deflect') go = h.hp < h.maxHp * 0.8 && near.length >= 1;
    if (go) b.useAbility(this.pid);
  }

  onEvent(ev) {
    if (this.emoteCD > 0 || this.partner) return;
    if (ev.t === 'towerdown' && !ev.chain && this.rng() < 0.5) {
      this.emoteCD = 15;
      const mine = ev.team === this.p.team;
      this.b.emote(this.pid, mine ? this.rng.pick(['cry', 'grr', 'oops']) : this.rng.pick(['laugh', 'wow', 'thanks']));
    }
  }
}

function pickAIDeck(rng, maxTier, minTier = 0) {
  const pool = AI_DECKS.filter(d => d.tier <= maxTier && d.tier >= minTier);
  return rng.pick(pool.length ? pool : AI_DECKS);
}

if (typeof module !== 'undefined') module.exports = { AIBrain, TRAITS, pickAIDeck };
