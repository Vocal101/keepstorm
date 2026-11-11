'use strict';
// Boot, main loop and the ?dev test harness.

const Game = { match: null };

(function boot() {
  const errs = [];
  window.addEventListener('error', e => errs.push(String(e.message) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => errs.push('promise: ' + e.reason));

  Save.load();
  Audio2.setVolumes(Save.d.settings.sfx, Save.d.settings.music);
  UI.init();
  document.addEventListener('pointerdown', () => { Audio2.unlock(); Audio2.playMusic(Game.match ? 'battle' : 'menu'); }, { once: true });
  $id('pauseBtn').onclick = () => UI.battleMenu();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (Game.match) {
      try { Game.match.frame(dt); } catch (e) { errs.push(e.stack); console.error(e); }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // pause the local sim when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.match && Game.match.role === 'local' && !Game.match.over) UI.battleMenu();
  });

  if (/[?&]dev\b/.test(location.search)) {
    const T = window.T = {
      errs,
      get m() { return Game.match; },
      get b() { return Game.match && Game.match.b; },
      // start a battle immediately; bot plays side 0 too when bot is set
      start(o = {}) {
        UI.closeModal();
        const rng = RNG(o.seed || 42);
        const deckA = o.deck || Save.deck().slice();
        const deckB = o.aiDeck || pickAIDeck(rng, 5).cards.slice();
        const lv = o.lvl || STD_LEVEL;
        const mk = (name, deck, ai, team) => ({ name, deck, levels: Object.fromEntries(deck.map(id => [id, lv])), towerLvl: lv, defender: o.defender || 'bow_sisters', skin: o.skin || 'stone', ai, asc: o.asc || [], team });
        const cfg = { seed: o.seed || 42, mode: o.mode, players: [mk(Save.d.name, deckA, !!o.bot, 0), mk('Dev Bot', deckB, true, 1)] };
        const ais = [{ pid: 1, diff: o.diff || 'normal' }];
        if (o.bot) ais.push({ pid: 0, diff: o.bot });
        $id('app').hidden = true; $id('battle').hidden = false;
        if (Game.match) Game.match.destroy();
        Game.match = new Match($id('battlecv'), { cfg, role: 'local', pid: 0, ais, arena: o.arena || 0, myName: Save.d.name, hud: { tutorial: !!o.tut }, opp: { name: 'Dev Bot', lvl: lv, sub: 'dev' }, onEnd: (r, m) => { T.lastResult = r; } });
        return 'started';
      },
      // simulate quickly without rendering
      run(sec) {
        const m = Game.match; if (!m || !m.b) return 'no match';
        const n = Math.round(sec / DT);
        for (let i = 0; i < n && !m.b.over; i++) {
          for (const a of m.ais) a.update(DT);
          m.b.step();
          const ev = m.b.drainEvents();
          for (const a of m.ais) for (const e of ev) a.onEvent(e);
          if (i > n - 60) m.renderer.onEvents(ev, null);
        }
        return T.status();
      },
      frames(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) if (Game.match) Game.match.frame(dt); return T.status(); },
      status() {
        const b = T.b; if (!b) return null;
        return { t: +b.t.toFixed(1), phase: b.phase, banners: b.banners, over: b.over, winner: b.winner, ents: b.ents.filter(e => !e.dead).length, ember: b.players.map(p => +p.ember.toFixed(1)), towers: b.towers.map(t => Math.ceil(t.hp)), errs: errs.length };
      },
      play(slot, x, y) { return Game.match.play(slot, x, y); },
      async snap(name = 'snap', q = 0.85) {
        const cv = $id('battle').hidden ? null : $id('battlecv');
        let blob;
        if (cv) blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
        else {
          // menus: rasterize via html is not possible, so capture a card-art collage instead
          return 'menus cannot be captured with snap(); use preview screenshot';
        }
        await fetch('/__snap/' + name, { method: 'POST', body: blob });
        return name + '.jpg';
      },
      unlockAll() { for (const c of CARDS) if (!Save.d.cards[c.id]) Save.d.cards[c.id] = { lvl: RARITY[c.rarity].start, n: 0 }; Save.d.gold += 100000; Save.d.gems += 5000; Save.d.shards += 30; Save.save(); UI.show('cards'); return Object.keys(Save.d.cards).length; },
      fresh() { Save.reset(); location.reload(); },
      menu() { if (Game.match) { Game.match.destroy(); Game.match = null; } $id('battle').hidden = true; $id('app').hidden = false; UI.show('battle'); },
      // Render a lineup of every unit for an art check
      lineup(kinds, opts = {}) {
        const cv = $id('battlecv');
        $id('app').hidden = true; $id('battle').hidden = false;
        if (Game.match) { Game.match.destroy(); Game.match = null; }
        const r = new Renderer(cv); r.setup({ team: 0, arena: opts.arena || 0 });
        const c = r.c, s = r.scale * r.dpr;
        c.setTransform(s, 0, 0, s, 0, 0);
        c.fillStyle = '#6fae55'; c.fillRect(0, 0, LW, LH);
        kinds = kinds || UNIT_KEYS;
        const cols = opts.cols || 6, cw = LW / cols, rh = opts.rh || 110;
        kinds.forEach((k, i) => {
          const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * rh + rh - 18;
          c.save(); c.translate(x, y);
          const sc = opts.scale || 1.3; c.scale(sc, sc);
          const u = UNITS[k];
          Art.ell(c, 0, 0, u.r * 32, u.r * 16); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
          if (u.bld) WorldArt.drawBuilding(c, { kind: k, atkT: 0.1, rampT: 5, hiddenState: 0, genT: 3, def: u, id: i }, TEAM_COLORS[i % 2], 0.6, { dx: 0, dy: -1 });
          else Art.drawUnit(c, k, Art.pose(TEAM_COLORS[opts.team != null ? opts.team : i % 2], { t: 0.6 + i, walk: opts.walk || 0.2, moving: !!opts.walk, atk: opts.atk != null ? opts.atk : 1, back: !!opts.back, seed: i }));
          c.restore();
          c.font = '11px sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(k, x, y + 14);
        });
        return kinds.length;
      },
    };
    console.log('Keepstorm dev harness ready: T.start(), T.run(sec), T.snap(name), T.lineup()');
  }
})();

function $id(id) { return document.getElementById(id); }
