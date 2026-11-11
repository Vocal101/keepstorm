'use strict';
// In-battle HUD drawn on the battle canvas, plus pointer/keyboard input for deploying cards.

const CARD_W = 120, CARD_H = 150, CARD_X0 = 92, CARD_GAP = 6, NEXT_X = 10, NEXT_W = 72, NEXT_H = 90;
const HOLD_INFO = 0.38;   // seconds to press and hold a card before its stats appear
const HOVER_INFO = 0.3;   // seconds a mouse must rest on a card before its stats appear

class Hud {
  constructor(renderer, actions, opts = {}) {
    this.r = renderer; this.actions = actions; this.opts = opts;
    this.sel = -1; this.drag = null; this.emoteOpen = false; this.msg = null; this.t = 0;
    this.lastEmote = -9;
    this.hover = -1; this.hoverT = 0;
    this.prevHand = null; this.slotT = [9, 9, 9, 9]; this.shakeT = [-9, -9, -9, -9];
    this.flies = [];
    this.tut = opts.tutorial ? { stage: 0, t: 0 } : null;
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
  slotAt(p) { for (let i = 0; i < 4; i++) if (this.inR(p, this.cardRect(i))) return i; return -1; }

  bind() {
    const cv = this.r.cv;
    cv.addEventListener('pointerdown', this._down = e => this.down(e));
    window.addEventListener('pointermove', this._mv = e => this.move(e));
    window.addEventListener('pointerup', this._up = e => this.up(e));
    window.addEventListener('pointercancel', this._cancel = () => { this.drag = null; });
    cv.addEventListener('pointerleave', this._leave = () => { this.hover = -1; });
    window.addEventListener('keydown', this._key = e => this.key(e));
    cv.addEventListener('contextmenu', this._ctx = e => e.preventDefault());
  }
  unbind() {
    const cv = this.r.cv;
    cv.removeEventListener('pointerdown', this._down); cv.removeEventListener('pointerleave', this._leave); cv.removeEventListener('contextmenu', this._ctx);
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
      return;
    }
    if (this.inR(p, this.emoteBtn())) { this.emoteOpen = true; Audio2.play('click', 0.5); return; }
    const ab = this.abilityBtn();
    if (S.me.abil && dist(p.x, p.y, ab.x, ab.y) <= ab.r + 4) { this.useAbility(); return; }
    const i = this.slotAt(p);
    if (i >= 0) {
      const h = S.me.hand[i]; if (!h) return;
      this.drag = { slot: i, card: h.card, sx: p.x, sy: p.y, moved: false, overArena: false, pid: ev.pointerId, downT: this.t, touch: ev.pointerType !== 'mouse', wasSel: this.sel === i };
      this.sel = i; Audio2.play('card', 0.5);
      return;
    }
    // tap-to-place with a selected card
    if (this.sel >= 0 && p.y < HUD_Y && p.y > ARENA_Y - 10) {
      const h = S.me.hand[this.sel];
      if (h) this.tryPlay(this.sel, h.card, p.x, p.y);
    }
  }

  move(ev) {
    const p = this.toLogical(ev);
    if (!this.drag) {
      if (ev.pointerType === 'mouse') {
        const i = this.slotAt(p);
        if (i !== this.hover) { this.hover = i; this.hoverT = this.t; }
      }
      return;
    }
    const d = this.drag;
    if (dist(p.x, p.y, d.sx, d.sy) > 8) { d.moved = true; this.hover = -1; }
    d.px = p.x; d.py = p.y;
    d.overArena = p.y < HUD_Y - 4 && p.y > ARENA_Y - 20;
    if (d.overArena) this.updGhost(d, p.x, p.y - (d.touch ? 40 : 0));
  }

  updGhost(d, px, py) {
    const S = this.S;
    const h = S.me.hand[d.slot];
    if (h && h.echo) d.card = h.card;
    const [wx, wy] = Battle.prototype.snapPos(d.card, this.r.wx(px), this.r.wy(py));
    d.wx = wx; d.wy = wy;
    d.valid = S.canPlace(h ? h.card : d.card, wx, wy);
  }

  up(ev) {
    const d = this.drag; if (!d) return;
    this.drag = null;
    const p = this.toLogical(ev);
    if (d.overArena && d.moved) {
      this.updGhost(d, p.x, p.y - (d.touch ? 40 : 0));
      this.tryPlayWorld(d.slot, d.card, d.wx, d.wy, d.valid);
    } else if (!d.moved && !d.inspect && d.wasSel && this.t - d.downT < HOLD_INFO) {
      this.sel = -1; // tapping a selected card again deselects it
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
    if (!valid) { this.flash("Can't deploy there"); this.shakeT[slot] = this.t; Audio2.play('error', 0.5); return; }
    if (S.me.ember + 1e-6 < h.cost) { this.flash('Not enough Ember'); this.shakeT[slot] = this.t; Audio2.play('error', 0.5); return; }
    const res = this.actions.play(slot, wx, wy);
    if (res && res.ok === false && res.err) { this.flash(res.err); this.shakeT[slot] = this.t; Audio2.play('error', 0.5); return; }
    const R = this.cardRect(slot);
    this.flies.push({ id: h.cid === 'echo' ? 'echo' : h.card.id, x0: R.x + R.w / 2, y0: R.y + R.h / 2, x1: this.r.sx(wx), y1: this.r.sy(wy), t: 0 });
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* ignore */ }
    if (this.tut && this.tut.stage === 0) { this.tut.stage = 1; this.tut.t = 0; }
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
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key >= '1' && e.key <= '4') { this.sel = +e.key - 1; Audio2.play('card', 0.4); }
    else if (e.key === 'Escape') { this.sel = -1; this.emoteOpen = false; }
    else if (e.key === ' ' || e.key === 'q') { e.preventDefault(); this.useAbility(); }
    else if (e.key === 'e') this.emoteOpen = !this.emoteOpen;
  }

  flash(text) { this.msg = { text, t: 0 }; }

  // which card's stats should be shown right now (-1 for none)
  infoSlot() {
    const d = this.drag;
    if (d) {
      if (!d.moved && this.t - d.downT >= HOLD_INFO) { d.inspect = true; return d.slot; }
      return -1;
    }
    if (this.hover >= 0 && this.t - this.hoverT >= HOVER_INFO) return this.hover;
    return -1;
  }

  // ------------------------------------------------------------------ drawing
  draw(S, dt) {
    this.t += dt;
    const c = this.r.c;
    this.trackHand(S, dt);
    this.drawTop(c, S);
    this.drawBannerCounters(c, S);
    this.drawCountdown(c, S);
    this.drawBottom(c, S);
    if (S.me.abil) this.drawAbility(c, S);
    this.drawFlies(c, dt);
    if (this.tut) this.drawTutorial(c, S, dt);
    if (this.emoteOpen) this.drawEmotes(c);
    const info = this.infoSlot();
    if (info >= 0 && S.me.hand[info] && this.opts.stats !== false) this.drawInfo(c, S, info);
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

  trackHand(S, dt) {
    for (let i = 0; i < 4; i++) this.slotT[i] = Math.min(9, this.slotT[i] + dt);
    const ids = S.me.hand.map(h => h ? h.cid : null);
    if (this.prevHand) for (let i = 0; i < 4; i++) if (ids[i] !== this.prevHand[i]) this.slotT[i] = 0;
    this.prevHand = ids;
  }

  drawTop(c, S) {
    c.save();
    c.fillStyle = Art.lg(c, 0, 0, 0, TOPH, '#2a2236', '#171320'); c.fillRect(0, 0, LW, TOPH);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, TOPH - 2, LW, 2);
    // opponent name plate
    rrPath(c, 50, 8, 290, 48, 12); c.fillStyle = 'rgba(214,52,44,0.22)'; c.fill(); c.strokeStyle = 'rgba(255,138,122,0.35)'; c.lineWidth = 1.5; c.stroke();
    lvlBadge(c, 32, 32, S.opp.lvl, false);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = '23px "Lilita One", sans-serif'; c.lineWidth = 4; c.strokeStyle = OUT;
    const nm = fitText(c, S.opp.name, 270, 23, '"Lilita One", sans-serif');
    c.strokeText(nm, 62, 24); c.fillStyle = '#ffb0a4'; c.fillText(nm, 62, 24);
    c.font = '14px "Lilita One", sans-serif'; c.fillStyle = '#d8cce8'; c.fillText(S.opp.sub || '', 62, 45);
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
    c.restore();
    if (S.emberPhase > 1) {
      // multiplier tag hangs under the timer so it never covers names
      c.save();
      const pulse = 1 + Math.sin(this.t * 4) * 0.04;
      c.translate(bx + 60, TOPH + 14); c.scale(pulse, pulse);
      rrPath(c, -44, -12, 88, 24, 8); c.fillStyle = S.emberPhase === 3 ? '#c21ab8' : '#8a1a9a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
      c.font = '15px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('x' + S.emberPhase + ' Ember', 0, 1);
      c.restore();
    }
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

  drawCountdown(c, S) {
    if (S.over) return;
    const tl = S.timeLeft;
    if (tl > 10 || tl <= 0) return;
    const n = Math.ceil(tl), f = tl - Math.floor(tl);
    const k = 1 - f; // 0 at the start of each second
    c.save();
    c.globalAlpha = 0.55 * (1 - k * 0.8);
    c.translate(LW / 2, ARENA_Y + ARENA_H / 2);
    const sc = 1.3 - k * 0.3;
    c.scale(sc, sc);
    c.font = '120px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = OUT; c.strokeText(n, 0, 0); c.fillStyle = n <= 3 ? '#ff6a5a' : '#ffffff'; c.fillText(n, 0, 0);
    c.restore();
    if (this.lastCount !== n) { this.lastCount = n; if (n <= 5) Audio2.play('tick', 0.7); }
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
    const em = S.me.ember;
    if (em >= 9.99) { rrPath(c, ex - 3, ey - 3, ew + 6, eh + 6, 10); c.fillStyle = 'rgba(255,140,255,' + (0.25 + Math.sin(this.t * 6) * 0.2) + ')'; c.fill(); }
    rrPath(c, ex, ey, ew, eh, 8); c.fillStyle = '#120e18'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    const seg = ew / 10;
    for (let i = 0; i < 10; i++) {
      const f = clamp(em - i, 0, 1);
      if (f <= 0) continue;
      rrPath(c, ex + i * seg + 2, ey + 3, Math.max(2, (seg - 4) * f), eh - 6, 5);
      c.fillStyle = f >= 1 ? Art.lg(c, 0, ey, 0, ey + eh, '#ff8aff', '#b01ab0') : 'rgba(230,110,230,0.55)';
      c.fill();
    }
    for (let i = 1; i < 10; i++) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(ex + i * seg - 1, ey + 3, 2, eh - 6); }
    if (S.emberPhase > 1) { c.font = '13px "Lilita One", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = OUT; c.strokeText('x' + S.emberPhase, ex + ew - 6, ey + eh / 2 + 1); c.fillStyle = '#ffe0ff'; c.fillText('x' + S.emberPhase, ex + ew - 6, ey + eh / 2 + 1); }
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
    const hov = this.hover === i && !this.drag;
    const lift = sel ? 12 : hov ? 5 : 0;
    // slide in from the "Next" slot when a new card arrives
    const st = this.slotT[i];
    const k = clamp(st / 0.22, 0, 1), e = easeOut(k);
    let x = R.x, y = R.y - lift, sc = 1;
    if (k < 1) { x = lerp(NEXT_X + 4, R.x, e); y = lerp(HUD_Y + 20, R.y, e); sc = lerp((NEXT_W - 8) / CARD_W, 1, e); }
    const sh = this.t - this.shakeT[i];
    if (sh < 0.3) x += Math.sin(sh * 60) * 6 * (1 - sh / 0.3);
    c.save();
    c.translate(x, y); c.scale(sc, sc);
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
      for (let k2 = 0; k2 < h.ascNeed; k2++) { Art.ell(c, R.w - 12 - k2 * 12, 12, 4.5, 4.5); c.fillStyle = k2 < h.ascProg ? '#d88aff' : 'rgba(0,0,0,0.5)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(); }
    }
    // name ribbon
    if (this.opts.names !== false) {
      const label = h.echo ? 'Echo' + (S.me.lastCard ? ': ' + CARD[S.me.lastCard].name : '') : h.card.name;
      c.save(); rrPath(c, 0, 0, R.w, R.h, 10); c.clip();
      c.fillStyle = 'rgba(12,8,20,0.72)'; c.fillRect(0, R.h - 30, R.w, 30);
      c.restore();
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const txt = fitText(c, label, R.w - 40, 14, '"Lilita One", sans-serif');
      c.lineWidth = 3; c.strokeStyle = OUT; c.strokeText(txt, 34, R.h - 14); c.fillStyle = RARITY[CARD[h.echo && S.me.lastCard ? S.me.lastCard : h.card.id].rarity].glow; c.fillText(txt, 34, R.h - 14);
    }
    // cost drop
    c.save(); c.translate(18, R.h - 18); dropShape(c, 0, 0, 15);
    c.font = '19px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = OUT;
    const costTxt = h.echo && !S.me.lastCard ? '?' : String(h.cost);
    c.strokeText(costTxt, 0, 2); c.fillStyle = '#fff'; c.fillText(costTxt, 0, 2);
    c.restore();
    c.restore();
  }

  // Stats panel shown while hovering a card (mouse) or pressing and holding it (touch).
  drawInfo(c, S, slot) {
    const h = S.me.hand[slot];
    const card = h.card, R = RARITY[card.rarity];
    const lvl = h.lvl || STD_LEVEL;
    const rows = cardStatRows(card, lvl).slice(0, 10);
    const W = 360, pad = 14;
    c.save();
    c.font = '13px Rubik, sans-serif';
    const desc = wrapLines(c, card.desc, W - pad * 2).slice(0, 3);
    let extra = [];
    if (card.ability) extra = wrapLines(c, card.ability.name + ' (' + card.ability.cost + ' Ember): ' + card.ability.desc, W - pad * 2).slice(0, 2);
    else if (h.ascReady && card.ascDesc) extra = wrapLines(c, card.ascDesc, W - pad * 2).slice(0, 2);
    // lay stat rows out two per line; long values get a full line of their own
    const colW = (W - pad * 2) / 2;
    c.font = '14px "Lilita One", sans-serif';
    const cells = []; let line = 0, col = 0;
    for (const r of rows) {
      const wide = c.measureText(String(r[1])).width > colW * 0.55;
      if (wide) { if (col) { line++; col = 0; } cells.push({ r, line, col: 0, full: true }); line++; }
      else { cells.push({ r, line, col, full: false }); if (col) { line++; col = 0; } else col = 1; }
    }
    const lines = line + (col ? 1 : 0);
    const rowsH = lines * 22;
    const H = 62 + desc.length * 17 + (extra.length ? extra.length * 16 + 8 : 0) + 10 + rowsH + 10;
    const CR = this.cardRect(slot);
    const x = clamp(CR.x + CR.w / 2 - W / 2, 6, LW - W - 6), y = HUD_Y - H - 16;
    // panel
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
    rrPath(c, x, y, W, H, 14); c.fillStyle = 'rgba(28,20,40,0.96)'; c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = R.color; c.lineWidth = 2.5; c.stroke();
    // pointer to the card
    const px = clamp(CR.x + CR.w / 2, x + 20, x + W - 20);
    c.beginPath(); c.moveTo(px - 10, y + H - 1); c.lineTo(px, y + H + 12); c.lineTo(px + 10, y + H - 1); c.closePath(); c.fillStyle = 'rgba(28,20,40,0.96)'; c.fill();
    c.beginPath(); c.moveTo(px - 10, y + H); c.lineTo(px, y + H + 12); c.lineTo(px + 10, y + H); c.strokeStyle = R.color; c.stroke();
    // header
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = '24px "Lilita One", sans-serif'; c.lineWidth = 4; c.strokeStyle = OUT;
    const nm = fitText(c, card.name, W - pad * 2 - 50, 24, '"Lilita One", sans-serif');
    c.strokeText(nm, x + pad, y + 30); c.fillStyle = R.glow; c.fillText(nm, x + pad, y + 30);
    c.font = '13px "Lilita One", sans-serif'; c.fillStyle = R.color;
    const typeName = card.type === 'troop' ? (UNITS[card.unit] && UNITS[card.unit].air ? 'Flying troop' : 'Troop') : card.type === 'building' ? 'Building' : 'Spell';
    c.fillText('Level ' + lvl + '  ·  ' + R.name + ' ' + typeName + (card.count > 1 ? '  ·  x' + card.count : ''), x + pad, y + 50);
    c.save(); c.translate(x + W - 30, y + 30); dropShape(c, 0, 0, 16);
    c.font = '19px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = OUT; c.strokeText(h.cost, 0, 3); c.fillStyle = '#fff'; c.fillText(h.cost, 0, 3);
    c.restore();
    // description
    let yy = y + 72;
    c.font = '13px Rubik, sans-serif'; c.fillStyle = '#e4dcf0';
    for (const l of desc) { c.fillText(l, x + pad, yy); yy += 17; }
    if (extra.length) { yy += 4; c.fillStyle = card.ability ? '#ffe680' : '#e0b0ff'; for (const l of extra) { c.fillText(l, x + pad, yy); yy += 16; } yy += 4; }
    // stats grid
    yy += 6;
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + pad, yy - 4, W - pad * 2, 1);
    for (const cell of cells) {
      const r = cell.r, cx = x + pad + cell.col * colW, cy = yy + 14 + cell.line * 22, cw = cell.full ? colW * 2 : colW;
      c.font = '12px Rubik, sans-serif'; c.fillStyle = '#a99cc0'; c.textAlign = 'left'; c.fillText(r[0], cx, cy);
      c.font = '14px "Lilita One", sans-serif'; c.fillStyle = '#ffffff'; c.textAlign = 'right';
      c.fillText(fitText(c, String(r[1]), cw - 100, 14, '"Lilita One", sans-serif'), cx + cw - 10, cy);
    }
    c.restore();
  }

  drawFlies(c, dt) {
    this.flies = this.flies.filter(f => (f.t += dt) < 0.24);
    for (const f of this.flies) {
      const k = easeOut(f.t / 0.24);
      const art = WorldArt.cardArt(f.id, CARD_W, CARD_H);
      const sc = lerp(1, 0.22, k);
      c.save(); c.globalAlpha = 1 - k * 0.7;
      c.translate(lerp(f.x0, f.x1, k), lerp(f.y0, f.y1, k)); c.scale(sc, sc);
      c.drawImage(art, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
      c.restore();
    }
  }

  drawTutorial(c, S, dt) {
    const T = this.tut;
    T.t += dt;
    if (T.stage >= 2 || S.over) return;
    c.save();
    if (T.stage === 0) {
      // a pointing hand sweeps from the first card to the player's side of the arena
      const R = this.cardRect(0);
      const k = easeInOut((T.t % 1.6) / 1.6);
      const x0 = R.x + R.w / 2, y0 = R.y + R.h / 2, x1 = this.r.sx(4.5), y1 = this.r.sy(this.r.flip ? 10.5 : 21.5);
      const hx = lerp(x0, x1, k), hy = lerp(y0, y1, k);
      c.globalAlpha = Math.min(1, T.t * 2) * (k > 0.92 ? 1 - (k - 0.92) / 0.08 : 1);
      Art.ell(c, x1, y1, 26, 14); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.setLineDash([6, 5]); c.lineWidth = 2.5; c.stroke(); c.setLineDash([]);
      pointerHand(c, hx, hy);
      c.globalAlpha = 1;
      tipBox(c, LW / 2, ARENA_Y + ARENA_H * 0.62, 'Drag a card onto your side of the arena!');
    } else if (T.stage === 1) {
      const a = T.t < 0.3 ? T.t / 0.3 : T.t > 4 ? Math.max(0, 1 - (T.t - 4) / 0.5) : 1;
      if (T.t > 4.5) { T.stage = 2; c.restore(); return; }
      c.globalAlpha = a;
      tipBox(c, LW / 2, ARENA_Y + ARENA_H * 0.62, 'Knock down enemy towers to win banners!');
    }
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
    c.font = '13px "Lilita One", sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = OUT; c.strokeText(a.name, 0, -B.r - 8); c.fillStyle = '#ffe680'; c.fillText(a.name, 0, -B.r - 8);
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

// shrink a label's font until it fits the width; returns the (possibly shortened) text with the font set on c
function fitText(c, text, maxW, size, family) {
  let s = size;
  c.font = s + 'px ' + family;
  while (s > 9 && c.measureText(text).width > maxW) { s -= 1; c.font = s + 'px ' + family; }
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 2 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function wrapLines(c, text, maxW) {
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function tipBox(c, x, y, text) {
  c.save();
  c.font = '19px "Lilita One", sans-serif';
  const w = Math.min(LW - 40, c.measureText(text).width + 36);
  rrPath(c, x - w / 2, y - 22, w, 44, 14); c.fillStyle = 'rgba(20,14,32,0.88)'; c.fill(); c.strokeStyle = '#ffd84a'; c.lineWidth = 2.5; c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(text, x, y + 1);
  c.restore();
}
function pointerHand(c, x, y) {
  c.save(); c.translate(x, y); c.rotate(-0.35);
  Art.rr(c, -9, -2, 18, 22, 7); c.fillStyle = '#ffe0c0'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
  Art.rr(c, -4, -22, 8, 24, 4); c.fillStyle = '#ffe0c0'; c.fill(); c.stroke();
  Art.rr(c, -10, 16, 20, 9, 3); c.fillStyle = '#4a7ad0'; c.fill(); c.stroke();
  c.restore();
}
