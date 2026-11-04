'use strict';
// In-battle HUD drawn on the battle canvas, plus pointer/keyboard input for deploying cards.

const CARD_W = 120, CARD_H = 150, CARD_X0 = 92, CARD_GAP = 6, NEXT_X = 10, NEXT_W = 72, NEXT_H = 90;

class Hud {
  constructor(renderer, actions) {
    this.r = renderer; this.actions = actions;
    this.sel = -1; this.drag = null; this.emoteOpen = false; this.msg = null; this.t = 0;
    this.lastEmote = -9;
    this.bind();
  }

  cardRect(i) { return { x: CARD_X0 + i * (CARD_W + CARD_GAP), y: HUD_Y + 6, w: CARD_W, h: CARD_H }; }
  emoteBtn() { return { x: NEXT_X + 4, y: HUD_Y + 110, w: NEXT_W - 8, h: 44 }; }
  abilityBtn() { return { x: LW - 70, y: HUD_Y - 74, r: 34 }; }
  emoteRect(i) { const col = i % 4, row = Math.floor(i / 4); return { x: 20 + col * 92, y: HUD_Y - 200 + row * 92, w: 84, h: 84 }; }

  toLogical(ev) {
    const rect = this.r.cv.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) / rect.width * LW, y: (ev.clientY - rect.top) / rect.height * LH };
  }
  inR(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  bind() {
    const cv = this.r.cv;
    cv.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', this._mv = e => this.move(e));
    window.addEventListener('pointerup', this._up = e => this.up(e));
    window.addEventListener('pointercancel', this._cancel = () => { this.drag = null; });
    window.addEventListener('keydown', this._key = e => this.key(e));
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  unbind() {
    window.removeEventListener('pointermove', this._mv); window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._cancel); window.removeEventListener('keydown', this._key);
  }

  get S() { return this.actions.state(); }

  down(ev) {
    const S = this.S; if (!S || S.over) return;
    const p = this.toLogical(ev);
    Audio2.unlock();
    if (this.emoteOpen) {
      for (let i = 0; i < EMOTES.length; i++) if (this.inR(p, this.emoteRect(i))) { this.sendEmote(EMOTES[i].id); this.emoteOpen = false; return; }
      this.emoteOpen = false;
      if (!this.inR(p, this.emoteBtn())) return;
      return;
    }
    if (this.inR(p, this.emoteBtn())) { this.emoteOpen = true; Audio2.play('click', 0.5); return; }
    const ab = this.abilityBtn();
    if (S.me.abil && dist(p.x, p.y, ab.x, ab.y) <= ab.r + 4) { this.useAbility(); return; }
    for (let i = 0; i < 4; i++) {
      if (this.inR(p, this.cardRect(i))) {
        const h = S.me.hand[i]; if (!h) return;
        this.drag = { slot: i, card: h.card, sx: p.x, sy: p.y, moved: false, overArena: false, pid: ev.pointerId };
        this.sel = i; Audio2.play('card', 0.5);
        return;
      }
    }
    // tap-to-place with a selected card
    if (this.sel >= 0 && p.y < HUD_Y && p.y > ARENA_Y - 10) {
      const h = S.me.hand[this.sel];
      if (h) this.tryPlay(this.sel, h.card, p.x, p.y);
    }
  }

  move(ev) {
    if (!this.drag) return;
    const p = this.toLogical(ev);
    const d = this.drag;
    if (dist(p.x, p.y, d.sx, d.sy) > 8) d.moved = true;
    d.px = p.x; d.py = p.y;
    d.overArena = p.y < HUD_Y - 4 && p.y > ARENA_Y - 20;
    if (d.overArena) this.updGhost(d, p.x, p.y - (ev.pointerType === 'touch' ? 40 : 0));
  }

  updGhost(d, px, py) {
    const S = this.S;
    let [wx, wy] = Battle.prototype.snapPos(d.card, this.r.wx(px), this.r.wy(py));
    d.wx = wx; d.wy = wy;
    const h = S.me.hand[d.slot];
    d.valid = S.canPlace(h ? h.card : d.card, wx, wy);
    if (h && h.echo) d.card = h.card;
  }

  up(ev) {
    const d = this.drag; if (!d) return;
    this.drag = null;
    const p = this.toLogical(ev);
    if (d.overArena && d.moved) {
      this.updGhost(d, p.x, p.y - (ev.pointerType === 'touch' ? 40 : 0));
      this.tryPlayWorld(d.slot, d.card, d.wx, d.wy, d.valid);
    }
  }

  tryPlay(slot, card, px, py) {
    const [wx, wy] = Battle.prototype.snapPos(card, this.r.wx(px), this.r.wy(py));
    this.tryPlayWorld(slot, card, wx, wy, this.S.canPlace(card, wx, wy));
  }

  tryPlayWorld(slot, card, wx, wy, valid) {
    const S = this.S;
    const h = S.me.hand[slot];
    if (!h) return;
    if (!valid) { this.flash("Can't deploy there"); Audio2.play('error', 0.5); return; }
    if (S.me.ember + 1e-6 < h.cost) { this.flash('Not enough Ember'); Audio2.play('error', 0.5); return; }
    const res = this.actions.play(slot, wx, wy);
    if (res && res.ok === false && res.err) { this.flash(res.err); Audio2.play('error', 0.5); return; }
    this.sel = -1;
  }

  useAbility() {
    const S = this.S, a = S.me.abil;
    if (!a) return;
    if (a.cd > 0) { this.flash('Ability recharging'); return; }
    if (S.me.ember < a.cost) { this.flash('Not enough Ember'); Audio2.play('error', 0.5); return; }
    this.actions.ability();
  }

  sendEmote(id) {
    if (this.t - this.lastEmote < 2.5) return;
    this.lastEmote = this.t;
    this.actions.emote(id);
  }

  key(e) {
    const S = this.S; if (!S || S.over) return;
    if (e.key >= '1' && e.key <= '4') { this.sel = +e.key - 1; Audio2.play('card', 0.4); }
    else if (e.key === 'Escape') { this.sel = -1; this.emoteOpen = false; }
    else if (e.key === ' ' || e.key === 'q') { e.preventDefault(); this.useAbility(); }
    else if (e.key === 'e') this.emoteOpen = !this.emoteOpen;
  }

  flash(text) { this.msg = { text, t: 0 }; }

  // ------------------------------------------------------------------ drawing
  draw(S, dt) {
    this.t += dt;
    const c = this.r.c;
    this.drawTop(c, S);
    this.drawBannerCounters(c, S);
    this.drawBottom(c, S);
    if (S.me.abil) this.drawAbility(c, S);
    if (this.emoteOpen) this.drawEmotes(c);
    if (this.msg) {
      this.msg.t += dt;
      if (this.msg.t > 1.4) this.msg = null;
      else {
        const a = this.msg.t > 1 ? 1 - (this.msg.t - 1) / 0.4 : 1;
        c.save(); c.globalAlpha = a; c.textAlign = 'center'; c.font = '24px "Lilita One", sans-serif';
        c.lineWidth = 5; c.strokeStyle = OUT; c.strokeText(this.msg.text, LW / 2, HUD_Y - 24); c.fillStyle = '#ff6a5a'; c.fillText(this.msg.text, LW / 2, HUD_Y - 24);
        c.restore();
      }
    }
  }

  drawTop(c, S) {
    c.save();
    c.fillStyle = Art.lg(c, 0, 0, 0, TOPH, '#2a2236', '#171320'); c.fillRect(0, 0, LW, TOPH);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, TOPH - 2, LW, 2);
    // opponent
    lvlBadge(c, 30, 32, S.opp.lvl, false);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = '22px "Lilita One", sans-serif'; c.fillStyle = '#ff9a8a'; c.lineWidth = 4; c.strokeStyle = OUT;
    c.strokeText(S.opp.name, 46, 24); c.fillText(S.opp.name, 46, 24);
    c.font = '14px "Lilita One", sans-serif'; c.fillStyle = '#c8bcd8'; c.fillText(S.opp.sub || '', 46, 46);
    // timer
    const tl = S.timeLeft;
    const bx = LW - 130;
    rrPath(c, bx, 8, 120, 48, 10); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill();
    c.textAlign = 'center';
    c.font = '12px "Lilita One", sans-serif'; c.fillStyle = '#c8bcd8';
    c.fillText(S.phase === 'ot' ? 'Overtime' : 'Time left', bx + 60, 19);
    c.font = '28px "Lilita One", sans-serif';
    const low = tl <= 10 && !S.over;
    c.fillStyle = low && Math.sin(this.t * 10) > 0 ? '#ff6a5a' : S.phase === 'ot' ? '#ffd84a' : '#ffffff';
    c.lineWidth = 4; c.strokeText(fmtTime(tl), bx + 60, 40); c.fillText(fmtTime(tl), bx + 60, 40);
    if (S.emberPhase > 1) {
      const txt = 'x' + S.emberPhase + ' Ember';
      rrPath(c, bx - 98, 18, 88, 28, 8); c.fillStyle = S.emberPhase === 3 ? '#c21ab8' : '#8a1a9a'; c.fill();
      c.font = '16px "Lilita One", sans-serif'; c.fillStyle = '#fff'; c.fillText(txt, bx - 54, 33);
    }
    c.restore();
  }

  drawBannerCounters(c, S) {
    const x = LW - 26, mid = ARENA_Y + ARENA_H / 2;
    for (const [mine, y] of [[false, mid - 62], [true, mid + 62]]) {
      c.save(); c.translate(x, y);
      rrPath(c, -20, -26, 40, 52, 10); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
      bannerIcon(c, mine ? TEAM_COLORS[0] : TEAM_COLORS[1], 1);
      c.font = '20px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const n = mine ? S.banners[0] : S.banners[1];
      c.lineWidth = 4; c.strokeStyle = OUT; c.strokeText(n, 0, 16); c.fillStyle = '#fff'; c.fillText(n, 0, 16);
      c.restore();
    }
  }

  drawBottom(c, S) {
    c.save();
    c.fillStyle = Art.lg(c, 0, HUD_Y, 0, LH, '#3a2e48', '#1a1424'); c.fillRect(0, HUD_Y, LW, HUDH);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, HUD_Y, LW, 2);
    // next card
    c.font = '13px "Lilita One", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c8bcd8';
    c.fillText('Next', NEXT_X + NEXT_W / 2, HUD_Y + 14);
    if (S.me.next) {
      const art = WorldArt.cardArt(S.me.next, CARD_W, CARD_H);
      c.drawImage(art, NEXT_X + 4, HUD_Y + 20, NEXT_W - 8, (NEXT_W - 8) * 1.25);
    }
    // emote button
    const eb = this.emoteBtn();
    rrPath(c, eb.x, eb.y, eb.w, eb.h, 10); c.fillStyle = this.emoteOpen ? '#5a4a7a' : '#4a3c62'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    emoteFace(c, eb.x + eb.w / 2, eb.y + eb.h / 2 + 2, 14, 'happy', this.t);
    // cards
    for (let i = 0; i < 4; i++) this.drawCard(c, S, i);
    // ember bar
    const ex = CARD_X0, ey = HUD_Y + 166, ew = 4 * CARD_W + 3 * CARD_GAP, eh = 24;
    rrPath(c, ex, ey, ew, eh, 8); c.fillStyle = '#120e18'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    const em = S.me.ember;
    const seg = ew / 10;
    for (let i = 0; i < 10; i++) {
      const f = clamp(em - i, 0, 1);
      if (f <= 0) continue;
      rrPath(c, ex + i * seg + 2, ey + 3, Math.max(2, (seg - 4) * f), eh - 6, 5);
      c.fillStyle = f >= 1 ? Art.lg(c, 0, ey, 0, ey + eh, '#ff8aff', '#b01ab0') : 'rgba(230,110,230,0.55)';
      c.fill();
    }
    for (let i = 1; i < 10; i++) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(ex + i * seg - 1, ey + 3, 2, eh - 6); }
    c.save(); c.translate(ex - 30, ey + eh / 2); dropShape(c, 0, 2, 16);
    c.font = '20px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = OUT; c.strokeText(Math.floor(em), 0, 4); c.fillStyle = '#fff'; c.fillText(Math.floor(em), 0, 4);
    c.restore();
    c.restore();
  }

  drawCard(c, S, i) {
    const h = S.me.hand[i];
    const R = this.cardRect(i);
    if (!h) return;
    const dragging = this.drag && this.drag.slot === i && this.drag.overArena;
    const sel = this.sel === i;
    const lift = sel ? 12 : 0;
    c.save();
    c.translate(R.x, R.y - lift);
    if (dragging) c.globalAlpha = 0.35;
    if (sel) { rrPath(c, -3, -3, R.w + 6, R.h + 6, 12); c.fillStyle = 'rgba(255,240,160,0.9)'; c.fill(); }
    const art = WorldArt.cardArt(h.cid === 'echo' ? 'echo' : h.card.id, CARD_W, CARD_H, { asc: h.ascReady });
    c.drawImage(art, 0, 0, R.w, R.h);
    if (h.echo && S.me.lastCard) {
      const mini = WorldArt.cardArt(S.me.lastCard, CARD_W, CARD_H);
      c.globalAlpha = (dragging ? 0.35 : 1) * 0.9; c.drawImage(mini, R.w - 50, 8, 42, 52); c.globalAlpha = dragging ? 0.35 : 1;
    }
    // affordability overlay
    const em = S.me.ember;
    if (em < h.cost) {
      c.fillStyle = 'rgba(10,8,16,0.55)'; rrPath(c, 0, 0, R.w, R.h, 10); c.fill();
      const f = clamp(em / h.cost, 0, 1);
      c.save(); rrPath(c, 0, 0, R.w, R.h, 10); c.clip();
      c.fillStyle = 'rgba(232,74,232,0.18)'; c.fillRect(0, R.h * (1 - f), R.w, R.h * f); c.restore();
    }
    if (h.ascReady) {
      c.save(); c.globalCompositeOperation = 'lighter'; rrPath(c, 2, 2, R.w - 4, R.h - 4, 9);
      c.strokeStyle = 'rgba(220,140,255,' + (0.5 + Math.sin(this.t * 6) * 0.4) + ')'; c.lineWidth = 4; c.stroke(); c.restore();
    } else if (h.ascNeed) {
      for (let k = 0; k < h.ascNeed; k++) { Art.ell(c, R.w - 12 - k * 12, 12, 4.5, 4.5); c.fillStyle = k < h.ascProg ? '#d88aff' : 'rgba(0,0,0,0.5)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(); }
    }
    // cost drop
    c.save(); c.translate(18, R.h - 18); dropShape(c, 0, 0, 15);
    c.font = '19px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = OUT;
    const costTxt = h.echo && !S.me.lastCard ? '?' : String(h.cost);
    c.strokeText(costTxt, 0, 2); c.fillStyle = '#fff'; c.fillText(costTxt, 0, 2);
    c.restore();
    c.restore();
  }

  drawAbility(c, S) {
    const a = S.me.abil, B = this.abilityBtn();
    c.save(); c.translate(B.x, B.y);
    const ready = a.cd <= 0 && S.me.ember >= a.cost;
    Art.ell(c, 0, 0, B.r + 4, B.r + 4); c.fillStyle = ready ? 'rgba(255,216,74,' + (0.4 + Math.sin(this.t * 5) * 0.25) + ')' : 'rgba(0,0,0,0.35)'; c.fill();
    c.save(); Art.ell(c, 0, 0, B.r, B.r); c.clip();
    const art = WorldArt.cardArt(a.card, CARD_W, CARD_H);
    c.drawImage(art, -B.r * 1.1, -B.r * 1.4, B.r * 2.2, B.r * 2.75);
    if (a.cd > 0) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, B.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (a.cd / a.cdMax)); c.closePath(); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fill(); }
    c.restore();
    Art.ell(c, 0, 0, B.r, B.r); c.strokeStyle = '#ffd84a'; c.lineWidth = 3; c.stroke();
    c.save(); c.translate(B.r * 0.7, B.r * 0.7); dropShape(c, 0, 0, 11);
    c.font = '14px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = OUT; c.strokeText(a.cost, 0, 2); c.fillStyle = '#fff'; c.fillText(a.cost, 0, 2);
    c.restore();
    c.font = '12px "Lilita One", sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = OUT; c.strokeText(a.name, 0, -B.r - 8); c.fillStyle = '#ffe680'; c.fillText(a.name, 0, -B.r - 8);
    c.restore();
  }

  drawEmotes(c) {
    c.save();
    rrPath(c, 10, HUD_Y - 210, 378, 196, 16); c.fillStyle = 'rgba(20,16,28,0.85)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.2)'; c.lineWidth = 2; c.stroke();
    EMOTES.forEach((em, i) => {
      const R = this.emoteRect(i);
      rrPath(c, R.x, R.y, R.w, R.h, 12); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      emoteFace(c, R.x + R.w / 2, R.y + 34, 20, em.face, this.t);
      c.font = '11px "Lilita One", sans-serif'; c.textAlign = 'center'; c.fillStyle = OUT; c.fillText(em.text, R.x + R.w / 2, R.y + R.h - 9);
    });
    c.restore();
  }
}
