'use strict';
// Menus, meta screens and battle launching.

const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tab = 'battle', swapCard = null, deckView = 0;
  const imgCache = new Map();

  function cardImg(id, opts = {}) {
    const key = id + (opts.asc ? ':a' : '');
    if (!imgCache.has(key)) imgCache.set(key, WorldArt.cardArt(id, 120, 150, opts).toDataURL());
    return imgCache.get(key);
  }

  const ICONS = {
    shop: '<svg viewBox="0 0 24 24"><path d="M4 9h16l-1.5 11h-13z" fill="#f2c84a" stroke="#231d2c" stroke-width="1.6"/><path d="M8 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="#231d2c" stroke-width="1.8"/></svg>',
    cards: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="11" height="15" rx="2" fill="#7cb6ff" stroke="#231d2c" stroke-width="1.6" transform="rotate(-10 8 12)"/><rect x="9" y="4" width="11" height="15" rx="2" fill="#ffb24a" stroke="#231d2c" stroke-width="1.6" transform="rotate(8 14 12)"/></svg>',
    battle: '<svg viewBox="0 0 24 24"><path d="M5 19 17 7l2-4-4 2L3 17z" fill="#e8edf3" stroke="#231d2c" stroke-width="1.5"/><path d="M19 19 7 7 5 3l4 2 12 12z" fill="#e8edf3" stroke="#231d2c" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="#f2c84a" stroke="#231d2c"/></svg>',
    online: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#5fd0a8" stroke="#231d2c" stroke-width="1.6"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="#231d2c" stroke-width="1.3"/></svg>',
    events: '<svg viewBox="0 0 24 24"><path d="M12 2l2.8 6 6.4.6-4.9 4.3 1.5 6.4L12 16l-5.8 3.3 1.5-6.4L2.8 8.6 9.2 8z" fill="#ffd84a" stroke="#231d2c" stroke-width="1.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="#ffd84a" stroke="#231d2c" stroke-width="1.5"/><path d="M7 5H3c0 4 2 5 4 5M17 5h4c0 4-2 5-4 5" fill="none" stroke="#231d2c" stroke-width="1.5"/><path d="M10 13h4v4h3v3H7v-3h3z" fill="#e8a820" stroke="#231d2c" stroke-width="1.4"/></svg>',
    gold: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="9" fill="#ffd84a" stroke="#231d2c" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="5.5" ry="5.5" fill="none" stroke="#c89a1a" stroke-width="1.6"/></svg>',
    gem: '<svg viewBox="0 0 24 24"><path d="M6 4h12l4 6-10 11L2 10z" fill="#5fe08a" stroke="#231d2c" stroke-width="1.6"/><path d="M2 10h20M9 4l3 17 3-17" fill="none" stroke="#2a8a4a" stroke-width="1.1"/></svg>',
    shard: '<svg viewBox="0 0 24 24"><path d="M12 2 19 10 12 22 5 10z" fill="#d88aff" stroke="#231d2c" stroke-width="1.6"/><path d="M12 2v20M5 10h14" stroke="#9a3ac8" stroke-width="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path d="M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z" fill="#e84ae8" stroke="#231d2c" stroke-width="1.6"/></svg>',
  };
  const icon = (n, cls = 'ic') => `<span class="${cls}">${ICONS[n]}</span>`;

  // ---------------------------------------------------------------- shell
  function init() {
    const app = $('#app');
    app.innerHTML = `
      <header id="topbar">
        <button class="who" id="btnProfile"><span class="kl" id="tbLvl">1</span><span class="nm"><b id="tbName"></b><i class="xpbar"><i id="tbXp"></i></i></span></button>
        <div class="res"><span class="pill">${icon('gold')}<b id="tbGold">0</b></span><span class="pill">${icon('gem')}<b id="tbGems">0</b></span></div>
        <button class="gearbtn" id="btnSettings" aria-label="Settings">${ICONS.gear}</button>
      </header>
      <main id="pages"></main>
      <nav id="tabs">
        ${['shop', 'cards', 'battle', 'online', 'events'].map(t => `<button data-tab="${t}" class="tab">${icon(t, 'ti')}<span>${{ shop: 'Shop', cards: 'Cards', battle: 'Battle', online: 'Online', events: 'Events' }[t]}</span><i class="badge" hidden></i></button>`).join('')}
      </nav>`;
    $$('#tabs .tab').forEach(b => b.onclick = () => { Audio2.unlock(); Audio2.play('click'); show(b.dataset.tab); });
    $('#btnProfile').onclick = () => { Audio2.unlock(); profileModal(); };
    $('#btnSettings').onclick = () => { Audio2.unlock(); settingsModal(); };
    show('battle');
    setInterval(() => { if (!$('#app').hidden) { refreshTop(); if (tab === 'battle') updateTimers(); } }, 1000);
    document.addEventListener('pointerdown', () => Audio2.unlock(), { once: true });
    if (!Save.d.seenHelp) setTimeout(() => helpModal(true), 400);
  }

  function refreshTop() {
    const D = Save.d;
    $('#tbLvl').textContent = D.lvl; $('#tbName').textContent = D.name;
    $('#tbGold').textContent = fmtNum(D.gold); $('#tbGems').textContent = fmtNum(D.gems);
    const need = Save.kingXpNeed();
    $('#tbXp').style.width = need ? Math.min(100, D.xp / need * 100) + '%' : '100%';
    // badges
    const up = Object.keys(D.cards).filter(id => { const u = Save.upgradeInfo(id); return u && u.ready && u.afford; }).length;
    setBadge('cards', up);
    const ready = D.chests.filter(c => Save.chestReady(c)).length + (Save.freeChestIn() === 0 ? 1 : 0) + (D.bannerCount >= 10 && !D.bannerClaimed ? 1 : 0) + TROPHY_ROAD.filter((r, i) => Save.roadState(i) === 'ready').length;
    setBadge('battle', ready);
    const s = Save.shop(); setBadge('shop', s.freeGift ? 0 : 1);
  }
  function setBadge(t, n) { const b = $(`#tabs [data-tab="${t}"] .badge`); if (!b) return; b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }

  function show(t) {
    tab = t;
    $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    const P = $('#pages');
    P.innerHTML = '';
    P.className = 'page-' + t;
    ({ battle: pageBattle, cards: pageCards, shop: pageShop, online: pageOnline, events: pageEvents })[t](P);
    refreshTop();
    P.scrollTop = 0;
  }

  // ---------------------------------------------------------------- battle page
  function arenaPreview(cv, ai) {
    const c = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 340, Hh = cv.clientHeight || 220;
    cv.width = W * dpr; cv.height = Hh * dpr;
    c.scale(dpr, dpr);
    // show a cropped, angled slice of the arena with towers
    const s = W / (AR.W * 32);
    c.save(); c.scale(s, s); c.translate(0, -0.6 * 32);
    WorldArt.drawArena(c, ai, 99 + ai);
    const T0 = TEAM_COLORS[0], T1 = TEAM_COLORS[1];
    const view = { back: false, dx: 0, dy: 1 };
    for (const st of TOWER_SLOTS) {
      if (st.y > 24) continue;
      const tw = { id: st.x * 7 + st.y, x: st.x, y: st.y, skin: Save.d.skin, defender: 'bow_sisters', atkT: 9, active: false, tower: st.kind };
      c.save(); c.translate(st.x * 32, st.y * 32 + (st.kind === 'keep' ? 30 : 20));
      if (st.kind === 'keep') WorldArt.drawKeep(c, tw, T1, 0.5, view); else WorldArt.drawSideTower(c, tw, T1, 0.5, view);
      c.restore();
    }
    c.restore();
    const g = c.createLinearGradient(0, Hh * 0.6, 0, Hh); g.addColorStop(0, 'rgba(20,16,30,0)'); g.addColorStop(1, 'rgba(20,16,30,0.85)');
    c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  }

  function chestCanvas(type, size = 64, open = false) {
    const cv = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.translate(size / 2, size * 0.62); c.scale(size / 64, size / 64);
    const col = CHESTS[type].color;
    Art.ell(c, 0, 20, 26, 6); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    Art.rr(c, -24, -8, 48, 28, 5); Art.fs(c, Art.lg(c, 0, -8, 0, 20, shade(col, 0.15), shade(col, -0.35)), 2);
    for (const x of [-16, 16]) { Art.rr(c, x - 3, -8, 6, 28, 1.5); Art.fs(c, '#f2d46a', 1.2); }
    c.save(); if (open) { c.translate(0, -8); c.rotate(-0.5); c.translate(0, 8); }
    c.beginPath(); c.moveTo(-25, -8); c.quadraticCurveTo(-25, -28, 0, -29); c.quadraticCurveTo(25, -28, 25, -8); c.closePath(); Art.fs(c, Art.lg(c, 0, -29, 0, -8, shade(col, 0.35), shade(col, -0.1)), 2);
    for (const x of [-16, 16]) { c.beginPath(); c.moveTo(x - 3, -8); c.lineTo(x - 3, -25 + Math.abs(x) * 0.2); c.lineTo(x + 3, -25 + Math.abs(x) * 0.2); c.lineTo(x + 3, -8); c.closePath(); Art.fs(c, '#f2d46a', 1.2); }
    c.restore();
    Art.rr(c, -6, -12, 12, 12, 3); Art.fs(c, '#ffe680', 1.4); Art.ell(c, 0, -6, 2, 2.4); c.fillStyle = '#231d2c'; c.fill();
    if (open) { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(0, -10, 0, 0, -10, 40); g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = g; Art.ell(c, 0, -10, 40, 40); c.fill(); }
    return cv;
  }

  function pageBattle(P) {
    const D = Save.d, ai = Save.arena(), A = ARENAS[ai], next = ARENAS[ai + 1];
    const el = h(`<div class="battlepage">
      <div class="arenacard"><canvas class="arenacv"></canvas>
        <div class="arenainfo"><small>Arena ${ai + 1}</small><h2>${esc(A.name)}</h2></div>
      </div>
      <div class="trophyrow">${icon('trophy')}<b>${D.trophies}</b><div class="tbar"><i style="width:${next ? clamp((D.trophies - A.trophies) / (next.trophies - A.trophies) * 100, 0, 100) : 100}%"></i></div><small>${next ? next.trophies + ' for ' + esc(next.name) : 'Top arena'}</small></div>
      <div class="playrow">
        <button class="btn big gold" id="btnBattle">Battle</button>
        <button class="btn sq" id="btnRoad">${icon('trophy')}<span>Road</span></button>
      </div>
      <div class="deckprev">
        <div class="dphead"><b>Battle deck</b><span class="dptabs">${D.decks.map((d, i) => `<button class="dpt ${i === D.deckIdx ? 'on' : ''}" data-dk="${i}">${i + 1}</button>`).join('')}</span><span class="avg">${icon('drop')} ${(Save.deck().reduce((s2, id) => s2 + CARD[id].cost, 0) / 8).toFixed(1)}</span></div>
        <div class="dpcards">${Save.deck().map(id => `<figure><img src="${cardImg(id)}" alt=""><figcaption>${esc(CARD[id].name)}</figcaption></figure>`).join('')}</div>
      </div>
      <div class="freerow">
        <button class="mini-chest" id="btnFree"></button>
        <button class="mini-chest" id="btnBanner"></button>
      </div>
      <div class="chests" id="chests"></div>
    </div>`);
    P.appendChild(el);
    requestAnimationFrame(() => arenaPreview($('.arenacv', el), ai));
    $('#btnBattle', el).onclick = () => { Audio2.play('click'); startLadder(); };
    $('#btnRoad', el).onclick = () => roadModal();
    $$('[data-dk]', el).forEach(b => b.onclick = e => { e.stopPropagation(); D.deckIdx = +b.dataset.dk; Save.save(); Audio2.play('click'); show('battle'); });
    $('.dpcards', el).onclick = () => { Audio2.play('click'); show('cards'); };
    renderChests();
  }

  function renderChests() {
    const box = $('#chests'); if (!box) return;
    const D = Save.d;
    box.innerHTML = '';
    D.chests.forEach((ch, i) => {
      const b = h(`<button class="chestslot ${ch ? 'full' : 'empty'}"></button>`);
      if (!ch) { b.innerHTML = '<span class="emptytxt">Chest slot</span>'; box.appendChild(b); return; }
      b.appendChild(chestCanvas(ch.type, 58));
      const lab = h(`<span class="chestlab"><b>${CHESTS[ch.type].name}</b><i class="ctime" data-i="${i}"></i></span>`);
      b.appendChild(lab);
      b.onclick = () => chestSlotClick(i);
      box.appendChild(b);
    });
    updateTimers();
  }

  function updateTimers() {
    const D = Save.d;
    $$('.ctime').forEach(el => {
      const ch = D.chests[+el.dataset.i]; if (!ch) return;
      if (Save.chestReady(ch)) { el.textContent = 'Open!'; el.className = 'ctime ready'; el.closest('.chestslot').classList.add('ready'); }
      else if (ch.unlocking) el.textContent = fmtDur((ch.unlockAt - Date.now()) / 1000);
      else el.textContent = 'Tap to unlock · ' + fmtDur(CHESTS[ch.type].time);
    });
    const fb = $('#btnFree'), bb = $('#btnBanner');
    if (fb) {
      const t = Save.freeChestIn();
      fb.innerHTML = ''; fb.appendChild(chestCanvas('free', 40));
      fb.appendChild(h(`<span><b>Free Chest${D.freeChests > 1 ? ' x' + D.freeChests : ''}</b><i>${t === 0 ? 'Open!' : fmtDur(t)}</i></span>`));
      fb.classList.toggle('ready', t === 0);
      fb.onclick = () => { const r = Save.openFree(); if (r) chestOpen(r); else toast('Next free chest in ' + fmtDur(Save.freeChestIn())); };
    }
    if (bb) {
      bb.innerHTML = ''; bb.appendChild(chestCanvas('banner', 40));
      const done = D.bannerClaimed;
      bb.appendChild(h(`<span><b>Banner Chest</b><i>${done ? 'Come back tomorrow' : D.bannerCount + ' / 10 banners'}</i></span>`));
      bb.classList.toggle('ready', D.bannerCount >= 10 && !done);
      bb.onclick = () => { const r = Save.openBannerChest(); if (r) chestOpen(r); else toast(done ? 'Already claimed today' : 'Win banners by destroying towers'); };
    }
  }

  function chestSlotClick(i) {
    const D = Save.d, ch = D.chests[i];
    if (!ch) return;
    if (Save.chestReady(ch)) { chestOpen(Save.openSlot(i, false)); renderChests(); return; }
    const busy = D.chests.some(c => c && c.unlocking && c !== ch && !Save.chestReady(c));
    const cost = Save.chestGemCost(ch);
    const m = modal(`<div class="chestinfo">
      <div class="cimg"></div><h2>${CHESTS[ch.type].name}</h2>
      <p>Arena ${(ch.arena || 0) + 1} · about ${Math.round(CHESTS[ch.type].cards * (1 + (ch.arena || 0) * 0.18))} cards</p>
      <div class="row">
        ${ch.unlocking ? '' : `<button class="btn ${busy ? 'grey' : 'blue'}" data-a="unlock">${busy ? 'Another chest is unlocking' : 'Start unlock · ' + fmtDur(CHESTS[ch.type].time)}</button>`}
        <button class="btn green" data-a="gems">Open now · ${cost} ${icon('gem')}</button>
      </div></div>`);
    $('.cimg', m).appendChild(chestCanvas(ch.type, 110));
    $$('[data-a]', m).forEach(b => b.onclick = () => {
      if (b.dataset.a === 'unlock') { if (!busy && Save.startUnlock(i)) { closeModal(); renderChests(); Audio2.play('click'); } }
      else { const r = Save.openSlot(i, true); if (r) { closeModal(); chestOpen(r); renderChests(); } else toast('Not enough gems'); }
    });
  }

  // chest opening sequence
  function chestOpen(res) {
    if (!res) return;
    const ov = h(`<div class="chestopen"><div class="co-stage"></div><div class="co-hint">Tap to continue</div></div>`);
    document.body.appendChild(ov);
    const stage = $('.co-stage', ov);
    const items = res.rewards.slice();
    let i = -1;
    stage.appendChild(chestCanvas(res.type, 180));
    stage.appendChild(h(`<h2>${CHESTS[res.type].name}</h2>`));
    Audio2.play('chest');
    const next = () => {
      i++;
      if (i >= items.length) { summary(); return; }
      const r = items[i];
      stage.innerHTML = '';
      const left = items.length - i - 1;
      if (r.type === 'card') {
        const c = CARD[r.id], R = RARITY[c.rarity];
        stage.appendChild(h(`<div class="reveal ${c.rarity}"><div class="rglow" style="--g:${R.color}"></div><img src="${cardImg(r.id)}"><div class="rcount">x${r.n}</div>${r.isNew ? '<div class="newtag">NEW!</div>' : ''}<h2 style="color:${R.color}">${esc(c.name)}</h2><small>${R.name}</small></div>`));
        Audio2.play(c.rarity === 'common' ? 'reveal' : 'epic');
      } else {
        const lab = r.type === 'gold' ? 'Gold' : r.type === 'gems' ? 'Gems' : 'Ascension Shards';
        stage.appendChild(h(`<div class="reveal res">${icon(r.type === 'gold' ? 'gold' : r.type === 'gems' ? 'gem' : 'shard', 'bigic')}<div class="rcount">+${fmtNum(r.n)}</div><h2>${lab}</h2></div>`));
        Audio2.play('coin');
      }
      stage.appendChild(h(`<div class="left">${left} left</div>`));
    };
    const summary = () => {
      stage.innerHTML = `<h2>Rewards</h2><div class="sumgrid">${items.map(r => r.type === 'card' ? `<div class="sumc"><img src="${cardImg(r.id)}"><b>x${r.n}</b>${r.isNew ? '<i>NEW</i>' : ''}</div>` : `<div class="sumc res">${icon(r.type === 'gold' ? 'gold' : r.type === 'gems' ? 'gem' : 'shard', 'bigic')}<b>+${fmtNum(r.n)}</b></div>`).join('')}</div>`;
      $('.co-hint', ov).textContent = 'Tap to close';
      ov.onclick = () => { ov.remove(); refreshTop(); if (tab === 'battle') renderChests(); if (tab === 'cards') show('cards'); };
    };
    ov.onclick = next;
  }

  // ---------------------------------------------------------------- cards page
  const statRows = cardStatRows;

  function pageCards(P) {
    const D = Save.d;
    const dk = D.decks[D.deckIdx];
    const avg = (dk.reduce((s, id) => s + CARD[id].cost, 0) / dk.length).toFixed(1);
    const found = Object.keys(D.cards).length;
    const el = h(`<div class="cardspage">
      <div class="decktabs">${D.decks.map((d, i) => `<button class="dt ${i === D.deckIdx ? 'on' : ''}" data-i="${i}">${i + 1}</button>`).join('')}<span class="avg">${icon('drop')} Avg ${avg}</span></div>
      ${swapCard ? `<div class="swapbar">Tap a card in your deck to swap in <b>${esc(CARD[swapCard].name)}</b> <button class="btn small grey" id="cancelSwap">Cancel</button></div>` : ''}
      <div class="deckgrid ${swapCard ? 'swapping' : ''}">${dk.map((id, i) => cardTile(id, { deck: true, slot: i })).join('')}</div>
      <div class="ascnote">${icon('shard')} The first two deck slots can hold Ascended cards. Shards: <b>${D.shards}</b></div>
      <div class="towerrow">
        <div><h3>Tower defender</h3><div class="chips">${DEFENDER_KEYS.map(k => `<button class="chip ${D.defender === k ? 'on' : ''} ${D.defenders.includes(k) ? '' : 'locked'}" data-def="${k}">${esc(DEFENDERS[k].name)}</button>`).join('')}</div><p class="tiny" id="defDesc">${esc(DEFENDERS[D.defender].desc)}</p></div>
        <div><h3>Tower skin</h3><div class="chips">${SKIN_KEYS.filter(k => D.skins.includes(k)).map(k => `<button class="chip ${D.skin === k ? 'on' : ''}" data-skin="${k}">${esc(TOWER_SKINS[k].name)}</button>`).join('')}</div><p class="tiny">More skins in the Shop and on the Trophy Road.</p></div>
      </div>
      <h3 class="colh">Collection <small>${found} / ${CARDS.length} found</small></h3>
      <div class="sortrow"><button class="chip ${deckView === 0 ? 'on' : ''}" data-sort="0">By rarity</button><button class="chip ${deckView === 1 ? 'on' : ''}" data-sort="1">By cost</button><button class="chip ${deckView === 2 ? 'on' : ''}" data-sort="2">By arena</button></div>
      <div class="collgrid">${sortedCollection().filter(c => D.cards[c.id] && !dk.includes(c.id)).map(c => cardTile(c.id, {})).join('')}</div>
      <h3 class="colh">Not found yet</h3>
      <div class="collgrid locked">${sortedCollection().filter(c => !D.cards[c.id]).map(c => `<div class="ctile lockedc"><img src="${cardImg(c.id)}"><span class="unl">Arena ${c.arena + 1}</span><span class="cname">${esc(c.name)}</span></div>`).join('')}</div>
    </div>`);
    P.appendChild(el);
    $$('.dt', el).forEach(b => b.onclick = () => { D.deckIdx = +b.dataset.i; Save.save(); show('cards'); });
    $$('[data-sort]', el).forEach(b => b.onclick = () => { deckView = +b.dataset.sort; show('cards'); });
    const cs = $('#cancelSwap', el); if (cs) cs.onclick = () => { swapCard = null; show('cards'); };
    $$('[data-def]', el).forEach(b => b.onclick = () => {
      const k = b.dataset.def;
      if (!D.defenders.includes(k)) { toast(DEFENDERS[k].name + ' unlocks on the Trophy Road'); return; }
      D.defender = k; Save.save(); show('cards');
    });
    $$('[data-skin]', el).forEach(b => b.onclick = () => { D.skin = b.dataset.skin; Save.save(); show('cards'); });
    $$('.ctile[data-id]', el).forEach(t => t.onclick = () => {
      const id = t.dataset.id;
      if (swapCard && t.dataset.slot != null) { doSwap(+t.dataset.slot); return; }
      cardModal(id);
    });
  }
  function sortedCollection() {
    const list = CARDS.slice();
    if (deckView === 0) list.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.cost - b.cost);
    else if (deckView === 1) list.sort((a, b) => a.cost - b.cost || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    else list.sort((a, b) => a.arena - b.arena || a.cost - b.cost);
    return list;
  }
  function cardTile(id, o) {
    const D = Save.d, c = CARD[id], own = D.cards[id];
    const u = Save.upgradeInfo(id);
    const asc = o.deck && o.slot < 2 && D.ascUnlocked.includes(id);
    const prog = u && !u.max ? clamp(u.have / u.need, 0, 1) : 1;
    return `<div class="ctile ${c.rarity} ${o.deck ? 'indeck' : ''} ${asc ? 'asc' : ''}" data-id="${id}" ${o.deck ? `data-slot="${o.slot}"` : ''}>
      <img src="${cardImg(id, { asc })}" alt="${esc(c.name)}">
      <span class="lv">Lvl ${own ? own.lvl : 1}</span>
      <span class="cname">${esc(c.name)}</span>
      ${asc ? '<span class="asctag">Ascended</span>' : ''}
      <div class="cp ${u && u.ready ? 'ready' : ''}"><i style="width:${prog * 100}%"></i><b>${u && u.max ? 'MAX' : u ? (u.ready ? 'Upgrade!' : u.have + '/' + u.need) : ''}</b></div>
    </div>`;
  }

  function doSwap(slot) {
    const D = Save.d, dk = D.decks[D.deckIdx];
    const id = swapCard; swapCard = null;
    if (dk.includes(id)) { show('cards'); return; }
    const isHero = CARD[id].rarity === 'hero';
    const otherHero = dk.findIndex((x, i) => i !== slot && CARD[x].rarity === 'hero');
    if (isHero && otherHero >= 0) { toast('Only one Hero per deck'); show('cards'); return; }
    dk[slot] = id; Save.save(); Audio2.play('card'); show('cards');
  }

  function cardModal(id) {
    const D = Save.d, c = CARD[id], own = D.cards[id], R = RARITY[c.rarity];
    const lvl = own ? own.lvl : R.start;
    const u = Save.upgradeInfo(id);
    const dk = D.decks[D.deckIdx];
    const inDeck = dk.includes(id);
    const rows = statRows(c, lvl);
    const nextRows = u && !u.max ? statRows(c, lvl + 1) : null;
    const m = modal(`<div class="cardinfo">
      <div class="cihead"><img src="${cardImg(id)}"><div><small style="color:${R.color}">${R.name} ${c.type}</small><h2>${esc(c.name)}</h2><div class="cost">${icon('drop')} ${c.id === 'echo' ? 'Last card +1' : c.cost} Ember</div><div class="lvlpill">Level ${lvl}</div></div></div>
      <p class="desc">${esc(c.desc)}</p>
      ${c.ability ? `<p class="abil"><b>${esc(c.ability.name)}</b> (${c.ability.cost} Ember, ${c.ability.cd}s cooldown): ${esc(c.ability.desc)}</p>` : ''}
      ${c.asc ? `<p class="abil ascp">${icon('shard')} ${esc(c.ascDesc)} ${D.ascUnlocked.includes(id) ? '<b>Unlocked.</b> Put it in deck slot 1 or 2.' : ''}</p>` : ''}
      <table class="stats">${rows.map((r, i) => `<tr><td>${r[0]}</td><td>${r[1]}${nextRows && nextRows[i] && nextRows[i][1] !== r[1] ? ` <span class="up">→ ${nextRows[i][1]}</span>` : ''}</td></tr>`).join('')}</table>
      <div class="row">
        ${own && !inDeck ? '<button class="btn blue" data-a="use">Use</button>' : ''}
        ${own && u && !u.max ? `<button class="btn ${u.ready && u.afford ? 'green' : 'grey'}" data-a="up">Upgrade · ${fmtNum(u.gold)} ${icon('gold')}</button>` : ''}
        ${own && c.asc && !D.ascUnlocked.includes(id) ? `<button class="btn ${D.shards >= ASC_SHARD_COST ? 'purple' : 'grey'}" data-a="asc">Ascend · ${ASC_SHARD_COST} ${icon('shard')}</button>` : ''}
      </div>
      ${own && u && !u.max ? `<p class="tiny">Copies: ${u.have} / ${u.need}</p>` : ''}
    </div>`);
    $$('[data-a]', m).forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'use') { closeModal(); swapCard = id; show('cards'); }
      else if (a === 'up') {
        if (!u.ready) { toast('Need ' + (u.need - u.have) + ' more copies'); return; }
        if (!u.afford) { toast('Not enough gold'); return; }
        Save.upgrade(id); Audio2.play('upgrade'); closeModal(); upgradeCelebrate(id); show('cards');
      } else if (a === 'asc') {
        if (Save.unlockAsc(id)) { Audio2.play('epic'); closeModal(); toast(c.name + ' can now Ascend!'); show('cards'); } else toast('Need ' + ASC_SHARD_COST + ' Ascension Shards');
      }
    });
  }

  function upgradeCelebrate(id) {
    const c = CARD[id];
    const ov = h(`<div class="celebrate"><img src="${cardImg(id)}"><h2>${esc(c.name)}</h2><div class="lvlpill big">Level ${Save.d.cards[id].lvl}</div></div>`);
    document.body.appendChild(ov);
    setTimeout(() => ov.classList.add('out'), 1300);
    setTimeout(() => ov.remove(), 1700);
    refreshTop();
  }

  // ---------------------------------------------------------------- shop
  function pageShop(P) {
    const D = Save.d, S = Save.shop();
    const gemChests = [['gold', 80], ['arcane', 180], ['grand', 250], ['mythic', 500]];
    const goldPacks = [[1000, 60], [5000, 250], [20000, 900]];
    const el = h(`<div class="shoppage">
      <h3>Daily gift</h3>
      <button class="offer gift ${S.freeGift ? 'done' : ''}" id="gift">${icon('gold', 'bigic')}<b>${S.freeGift ? 'Claimed' : '+100 Gold'}</b><span>${S.freeGift ? 'Back tomorrow' : 'Free'}</span></button>
      <h3>Daily deals <small>refresh every day</small></h3>
      <div class="offers">${S.offers.map((o, i) => `<button class="offer ${o.bought ? 'done' : ''}" data-o="${i}"><img src="${cardImg(o.id)}"><b>x${o.n}</b><span>${o.bought ? 'Bought' : fmtNum(o.price) + ' ' + icon('gold')}</span></button>`).join('')}</div>
      <h3>Chests</h3>
      <div class="offers">${gemChests.map(([t, p]) => `<button class="offer chesto" data-c="${t}" data-p="${p}"><span class="cv"></span><b>${CHESTS[t].name}</b><span>${p} ${icon('gem')}</span></button>`).join('')}</div>
      <h3>Gold</h3>
      <div class="offers">${goldPacks.map(([g, p]) => `<button class="offer" data-g="${g}" data-p="${p}">${icon('gold', 'bigic')}<b>${fmtNum(g)}</b><span>${p} ${icon('gem')}</span></button>`).join('')}</div>
      <h3>Tower skins</h3>
      <div class="offers">${SKIN_KEYS.filter(k => k !== 'stone').map(k => `<button class="offer skin ${D.skins.includes(k) ? 'done' : ''}" data-s="${k}"><span class="cv"></span><b>${esc(TOWER_SKINS[k].name)}</b><span>${D.skins.includes(k) ? (D.skin === k ? 'Equipped' : 'Owned · tap to equip') : TOWER_SKINS[k].price + ' ' + icon('gem')}</span></button>`).join('')}</div>
      <p class="tiny center">Keepstorm has no real-money purchases. Earn gems from the Trophy Road, Banner Chests and level-ups.</p>
    </div>`);
    P.appendChild(el);
    $$('[data-c] .cv', el).forEach(s => s.appendChild(chestCanvas(s.parentElement.dataset.c, 70)));
    $$('[data-s] .cv', el).forEach(s => s.appendChild(skinCanvas(s.parentElement.dataset.s, 70)));
    $('#gift', el).onclick = () => { if (S.freeGift) return; S.freeGift = true; D.gold += 100; Save.save(); Audio2.play('coin'); show('shop'); };
    $$('[data-o]', el).forEach(b => b.onclick = () => {
      const o = S.offers[+b.dataset.o]; if (o.bought) return;
      if (D.gold < o.price) { toast('Not enough gold'); return; }
      const c = CARD[o.id];
      confirmModal(`Buy ${o.n} x ${c.name} for ${fmtNum(o.price)} gold?`, () => { const r = Save.buyOffer(+b.dataset.o); if (r) { Audio2.play('coin'); toast((r.isNew ? 'New card! ' : '') + c.name + ' x' + r.n); show('shop'); } });
    });
    $$('[data-c]', el).forEach(b => b.onclick = () => {
      const p = +b.dataset.p; if (D.gems < p) { toast('Not enough gems'); return; }
      confirmModal(`Open a ${CHESTS[b.dataset.c].name} for ${p} gems?`, () => { D.gems -= p; Save.save(); chestOpen({ type: b.dataset.c, rewards: Save.openChest(b.dataset.c) }); show('shop'); });
    });
    $$('[data-g]', el).forEach(b => b.onclick = () => {
      const p = +b.dataset.p; if (D.gems < p) { toast('Not enough gems'); return; }
      confirmModal(`Trade ${p} gems for ${fmtNum(+b.dataset.g)} gold?`, () => { D.gems -= p; D.gold += +b.dataset.g; Save.save(); Audio2.play('coin'); show('shop'); });
    });
    $$('[data-s]', el).forEach(b => b.onclick = () => {
      const k = b.dataset.s, sk = TOWER_SKINS[k];
      if (D.skins.includes(k)) { D.skin = k; Save.save(); toast(sk.name + ' equipped'); show('shop'); return; }
      if (D.gems < sk.price) { toast('Not enough gems'); return; }
      confirmModal(`Buy ${sk.name} for ${sk.price} gems?`, () => { D.gems -= sk.price; D.skins.push(k); D.skin = k; Save.save(); Audio2.play('upgrade'); show('shop'); });
    });
  }
  function skinCanvas(k, size) {
    const cv = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
    const c = cv.getContext('2d'); c.scale(dpr, dpr); c.translate(size / 2, size * 0.92); c.scale(size / 120, size / 120);
    WorldArt.drawSideTower(c, { id: 3, x: 1, skin: k, defender: 'bow_sisters', atkT: 9 }, TEAM_COLORS[0], 0.3, { back: false });
    return cv;
  }

  // ---------------------------------------------------------------- online page
  function pageOnline(P) {
    const D = Save.d;
    const el = h(`<div class="onlinepage">
      <div class="panel"><h3>Your name</h3><div class="row"><input id="nameIn" maxlength="16" value="${esc(D.name)}"><button class="btn small blue" id="saveName">Save</button></div></div>
      <div class="panel"><h3>Quick Match</h3><p class="tiny">Find another player who is searching right now. Both decks play at tournament level ${STD_LEVEL}.</p><button class="btn big green" id="qm">Find opponent</button></div>
      <div class="panel"><h3>Friendly battle</h3><p class="tiny">Create a room and share the code with a friend, or enter their code.</p>
        <div class="row"><button class="btn blue" id="hostBtn">Create room</button></div>
        <div class="row"><input id="codeIn" maxlength="5" placeholder="CODE" autocapitalize="characters"><button class="btn green" id="joinBtn">Join</button></div>
      </div>
      <div class="panel stat"><h3>Online record</h3><p>${D.stats.onlineWins} wins in ${D.stats.online} online battles</p></div>
    </div>`);
    P.appendChild(el);
    $('#saveName', el).onclick = () => { const v = $('#nameIn', el).value.trim().slice(0, 16); if (v) { D.name = v; Save.save(); refreshTop(); toast('Name saved'); } };
    $('#qm', el).onclick = () => onlineQuick();
    $('#hostBtn', el).onclick = () => onlineHost();
    $('#joinBtn', el).onclick = () => { const code = $('#codeIn', el).value.trim(); if (code.length < 4) { toast('Enter the 5-letter code'); return; } onlineJoin(code); };
  }

  function onlineStartCfg(guest) {
    const me = Save.profile();
    const seed = (Math.random() * 1e9) | 0;
    const mk = p => ({ name: p.name, deck: p.deck, asc: p.asc, defender: p.defender, skin: p.skin, towerLvl: STD_LEVEL, lvl: p.lvl, levels: Object.fromEntries(p.deck.map(id => [id, STD_LEVEL])) });
    return { seed, arena: Save.arena(), players: [mk(me), mk(guest)] };
  }
  function waitingModal(title, body, onCancel) {
    const m = modal(`<div class="waiting"><h2>${title}</h2><div class="spinner"></div><p class="wbody">${body}</p><button class="btn grey" data-a="cancel">Cancel</button></div>`, { noClose: true });
    $('[data-a=cancel]', m).onclick = () => { onCancel(); closeModal(); };
    return m;
  }
  function onlineHost() {
    const m = waitingModal('Friendly battle', 'Creating a room...', () => Net.close());
    Net.host(Save.profile(), {
      onGuest: guest => { const cfg = onlineStartCfg(guest); return cfg; },
      onStarted: cfg => { closeModal(); startOnline(cfg, 'host'); },
      onError: msg => { $('.wbody', m).textContent = msg; },
    }, (err, code) => {
      if (err) { $('.wbody', m).textContent = err; return; }
      $('.wbody', m).innerHTML = `Share this code with your friend:<div class="bigcode">${code}</div>Waiting for them to join...`;
    });
  }
  function onlineJoin(code) {
    const m = waitingModal('Joining...', 'Connecting to room ' + esc(code.toUpperCase()) + '...', () => Net.close());
    Net.join(code, Save.profile(), (err, cfg) => {
      if (err) { $('.wbody', m).textContent = err === 'unavailable' ? 'No room with that code.' : err === 'timeout' ? 'The room did not answer. Check the code.' : err === 'busy' ? 'That room is already in a battle.' : err; return; }
      closeModal(); startOnline(cfg, 'client');
    });
  }
  function onlineQuick() {
    const m = waitingModal('Quick Match', 'Connecting...', () => Net.cancelQuick());
    Net.quickMatch(Save.profile(), {
      onStatus: t => { const b = $('.wbody', m); if (b) b.textContent = t; },
      onGuest: g => onlineStartCfg(g),
      onStart: (cfg, role) => { closeModal(); startOnline(cfg, role); },
      onFail: msg => { const b = $('.wbody', m); if (b) b.textContent = msg; },
    });
  }

  // ---------------------------------------------------------------- events page
  function pageEvents(P) {
    const D = Save.d;
    const el = h(`<div class="eventspage">
      <div class="panel"><h3>Training Camp</h3><p class="tiny">Practice against the CPU at tournament level. No trophies at stake.</p>
        <div class="diffs">${AI_DIFF_KEYS.map(k => `<button class="diff" data-d="${k}" style="--c:${AI_DIFFS[k].color}"><b>${k[0].toUpperCase() + k.slice(1)}</b><small>${AI_DIFFS[k].name}</small></button>`).join('')}</div>
        <label class="tiny">Opponent deck <select id="aiDeck"><option value="-1">Random</option>${AI_DECKS.map((d, i) => `<option value="${i}">${esc(d.name)}</option>`).join('')}</select></label>
      </div>
      <h3>Challenges</h3>
      <div class="evlist">${EVENTS.map(ev => `<div class="evcard"><div><b>${esc(ev.name)}</b><p>${esc(ev.desc)}</p><small>Wins: ${D.eventWins[ev.id] || 0} · Win reward ${ev.reward.gold} ${icon('gold')}</small></div><button class="btn green" data-ev="${ev.id}">Play</button></div>`).join('')}</div>
    </div>`);
    P.appendChild(el);
    $$('[data-d]', el).forEach(b => b.onclick = () => startTraining(b.dataset.d, +$('#aiDeck', el).value));
    $$('[data-ev]', el).forEach(b => b.onclick = () => startEvent(EVENTS.find(e => e.id === b.dataset.ev)));
  }

  // ---------------------------------------------------------------- launching battles
  function aiPlayer(name, deck, lvl, towerLvl, rng, extra = {}) {
    const levels = {};
    for (const id of deck) levels[id] = clamp(Math.max(RARITY[CARD[id].rarity].start, Math.round(lvl)), 1, MAX_LEVEL);
    const defs = DEFENDER_KEYS.filter(k => DEFENDERS[k].unlock <= towerLvl);
    return Object.assign({ name, deck, levels, towerLvl: clamp(Math.round(towerLvl), 1, MAX_LEVEL), defender: rng.pick(defs.length ? defs : ['bow_sisters']), skin: rng.pick(SKIN_KEYS), ai: true }, extra);
  }
  function myPlayer(std, deckOverride) {
    const D = Save.d, dk = deckOverride || Save.deck();
    const levels = std ? Object.fromEntries(dk.map(id => [id, STD_LEVEL])) : Save.levelsFor(dk);
    return { name: D.name, deck: dk.slice(), levels, towerLvl: std ? STD_LEVEL : D.lvl, defender: D.defender, skin: D.skin, asc: Save.ascInDeck(dk) };
  }

  function startLadder() {
    const D = Save.d, ar = Save.arena();
    const rng = RNG(Date.now() & 0xffffffff);
    const pool = ar <= 0 ? ['easy', 'easy', 'normal'] : ar <= 2 ? ['easy', 'normal', 'normal'] : ar <= 4 ? ['normal', 'normal', 'hard'] : ar <= 7 ? ['normal', 'hard', 'hard', 'expert'] : ['hard', 'expert', 'expert'];
    const diff = rng.pick(pool);
    const maxTier = Math.min(5, Math.floor(ar / 2) + (ar > 0 ? 1 : 0));
    const deck = pickAIDeck(rng, maxTier).cards.slice();
    const lvl = Save.avgDeckLevel() + AI_DIFFS[diff].levelOff * 0.5 + (rng() - 0.5);
    const oppLvl = clamp(D.lvl + rng.int(-1, 1), 1, 15);
    const name = rng.pick(AI_NAMES);
    const oppTrophies = Math.max(0, D.trophies + rng.int(-40, 40));
    const cfg = { seed: rng.int(1, 1e9), players: [myPlayer(false), aiPlayer(name, deck, lvl, oppLvl, rng)] };
    launch({
      cfg, role: 'local', pid: 0, ais: [{ pid: 1, diff }], arena: ar, label: 'Ladder',
      opp: { name, lvl: oppLvl, sub: oppTrophies + ' trophies' },
      vs: { oppName: name, oppLvl, oppTrophies, oppDeck: deck },
      onResult: (res, m) => {
        const rw = Save.ladderReward(res.win, res.draw, res.myBanners, oppTrophies);
        Save.recordBattle({ mode: 'Ladder', win: res.win, draw: res.draw, myBanners: res.myBanners, oppBanners: res.oppBanners, oppName: name, oppDeck: deck, myDeck: Save.deck().slice(), trophyDelta: rw.trophies });
        return rw;
      },
    });
  }

  function startTraining(diff, deckIdx) {
    const rng = RNG(Date.now() & 0xffffffff);
    const deck = (deckIdx >= 0 ? AI_DECKS[deckIdx] : rng.pick(AI_DECKS)).cards.slice();
    const name = AI_DIFFS[diff].name + ' Bot';
    const cfg = { seed: rng.int(1, 1e9), players: [myPlayer(true), aiPlayer(name, deck, STD_LEVEL, STD_LEVEL, rng)] };
    launch({
      cfg, role: 'local', pid: 0, ais: [{ pid: 1, diff }], arena: Save.arena(), label: 'Training',
      opp: { name, lvl: STD_LEVEL, sub: 'Training · ' + diff }, vs: { oppName: name, oppLvl: STD_LEVEL, oppDeck: deck },
      onResult: res => { Save.recordBattle({ mode: 'Training (' + diff + ')', win: res.win, draw: res.draw, myBanners: res.myBanners, oppBanners: res.oppBanners, oppName: name, oppDeck: deck, myDeck: Save.deck().slice(), trophyDelta: 0 }); return {}; },
    });
  }

  function randomDeck(rng) {
    const out = []; let hero = false;
    while (out.length < 8) {
      const c = rng.pick(CARDS);
      if (out.includes(c.id) || c.id === 'echo' && out.length === 0) continue;
      if (c.rarity === 'hero') { if (hero) continue; hero = true; }
      out.push(c.id);
    }
    return out;
  }

  function startEvent(ev) {
    const rng = RNG(Date.now() & 0xffffffff);
    const diff = rng.pick(['normal', 'hard', 'hard']);
    const name = rng.pick(AI_NAMES);
    const go = (myDeck, aiDeck) => {
      const mode = Object.assign({}, ev.mode); delete mode.draft; delete mode.mirror; delete mode.chaos; delete mode.duo;
      let cfg, ais, opp, myName;
      if (ev.mode.duo) {
        const ally = rng.pick(AI_NAMES.filter(n => n !== name)), name2 = rng.pick(AI_NAMES.filter(n => n !== name && n !== ally));
        cfg = { seed: rng.int(1, 1e9), mode, players: [Object.assign(myPlayer(true, myDeck), { team: 0 }), aiPlayer(name, pickAIDeck(rng, 5).cards.slice(), STD_LEVEL, STD_LEVEL, rng, { team: 1 }), aiPlayer(ally, pickAIDeck(rng, 5).cards.slice(), STD_LEVEL, STD_LEVEL, rng, { team: 0 }), aiPlayer(name2, pickAIDeck(rng, 5).cards.slice(), STD_LEVEL, STD_LEVEL, rng, { team: 1 })] };
        ais = [{ pid: 1, diff }, { pid: 2, diff: 'hard', partner: true }, { pid: 3, diff }];
        opp = { name: name + ' & ' + name2, lvl: STD_LEVEL, sub: 'Your ally: ' + ally };
        myName = Save.d.name + ' & ' + ally;
      } else {
        cfg = { seed: rng.int(1, 1e9), mode, players: [myPlayer(true, myDeck), aiPlayer(name, aiDeck, STD_LEVEL, STD_LEVEL, rng)] };
        ais = [{ pid: 1, diff }];
        opp = { name, lvl: STD_LEVEL, sub: ev.name };
      }
      launch({
        cfg, role: 'local', pid: 0, ais, arena: rng.int(0, ARENAS.length - 1), label: ev.name, opp, myName, vs: { oppName: opp.name, oppLvl: STD_LEVEL, oppDeck: aiDeck || cfg.players[1].deck },
        onResult: res => {
          const D = Save.d; let gold = 0;
          if (res.win) { gold = ev.reward.gold; D.gold += gold; D.eventWins[ev.id] = (D.eventWins[ev.id] || 0) + 1; D.stats.eventWins++; Save.save(); }
          Save.recordBattle({ mode: ev.name, win: res.win, draw: res.draw, myBanners: res.myBanners, oppBanners: res.oppBanners, oppName: opp.name, oppDeck: cfg.players[1].deck, myDeck: myDeck || Save.deck().slice(), trophyDelta: 0 });
          return { gold };
        },
      });
    };
    if (ev.mode.draft) { draftModal(rng, go); return; }
    if (ev.mode.mirror) { go(Save.deck().slice(), Save.deck().slice()); return; }
    if (ev.mode.chaos) { go(randomDeck(rng), randomDeck(rng)); return; }
    if (ev.mode.duo) { go(Save.deck().slice(), null); return; }
    go(Save.deck().slice(), pickAIDeck(rng, 5).cards.slice());
  }

  function draftModal(rng, go) {
    const mine = [], theirs = [];
    let heroTaken = [false, false];
    const pool = CARDS.filter(c => c.id !== 'echo');
    const pickPair = () => {
      const avail = pool.filter(c => !mine.includes(c.id) && !theirs.includes(c.id));
      const a = rng.pick(avail); let b = rng.pick(avail); let guard = 0;
      while ((b === a || (a.rarity === 'hero' && b.rarity === 'hero')) && guard++ < 30) b = rng.pick(avail);
      return [a, b];
    };
    const m = modal(`<div class="draft"><h2>Draft Duel</h2><p class="tiny">Pick one. Your opponent gets the other. <b class="dcount"></b></p><div class="dpair"></div><div class="dmine"></div></div>`, { noClose: true });
    const round = () => {
      if (mine.length >= 8) { closeModal(); go(mine, theirs); return; }
      let [a, b] = pickPair();
      // keep one hero per side
      if (a.rarity === 'hero' && heroTaken[0] && heroTaken[1]) [a, b] = pickPair();
      $('.dcount', m).textContent = (mine.length + 1) + ' / 8';
      const pair = $('.dpair', m); pair.innerHTML = '';
      for (const [c, o] of [[a, b], [b, a]]) {
        const btn = h(`<button class="dpick"><img src="${cardImg(c.id)}"><b>${esc(c.name)}</b></button>`);
        btn.onclick = () => {
          if (c.rarity === 'hero' && heroTaken[0]) { toast('You already have a Hero'); return; }
          mine.push(c.id); if (c.rarity === 'hero') heroTaken[0] = true;
          if (o.rarity === 'hero' && heroTaken[1]) { const alt = pool.find(x => x.rarity !== 'hero' && !mine.includes(x.id) && !theirs.includes(x.id)); theirs.push(alt.id); }
          else { theirs.push(o.id); if (o.rarity === 'hero') heroTaken[1] = true; }
          Audio2.play('card');
          $('.dmine', m).innerHTML = mine.map(id => `<img src="${cardImg(id)}">`).join('');
          round();
        };
        pair.appendChild(btn);
      }
    };
    round();
  }

  function startOnline(cfg, role) {
    const pid = role === 'host' ? 0 : 1;
    const oppP = cfg.players[1 - pid];
    const towerInfo = cfg.players.map(p => ({ skin: p.skin, defender: p.defender }));
    launch({
      cfg, role, pid, ais: [], arena: cfg.arena || 0, label: 'Online', team: pid, remotePid: 1, towerInfo,
      opp: { name: oppP.name, lvl: oppP.lvl || 1, sub: 'Online battle' }, vs: { oppName: oppP.name, oppLvl: oppP.lvl || 1, oppDeck: oppP.deck, online: true },
      onResult: res => {
        Save.recordBattle({ mode: 'Online', online: true, win: res.win, draw: res.draw, myBanners: res.myBanners, oppBanners: res.oppBanners, oppName: oppP.name, oppDeck: oppP.deck, myDeck: cfg.players[pid].deck, trophyDelta: 0, reason: res.reason });
        setTimeout(() => Net.close(), 500);
        return {};
      },
    });
  }

  // ---------------------------------------------------------------- the battle screen
  let current = null;
  function launch(o) {
    closeModal();
    const app = $('#app'), bs = $('#battle');
    const vs = h(`<div class="vs">
      <div class="vsside top"><div class="vsname">${esc(o.vs.oppName)}</div><div class="vssub">Level ${o.vs.oppLvl}${o.vs.oppTrophies != null ? ' · ' + o.vs.oppTrophies + ' trophies' : ''}</div></div>
      <div class="vsmid">VS</div>
      <div class="vsside bot"><div class="vsname">${esc(Save.d.name)}</div><div class="vssub">Level ${Save.d.lvl}${o.label === 'Ladder' ? ' · ' + Save.d.trophies + ' trophies' : ''}</div><div class="vsdeck">${o.cfg.players[o.pid].deck.map(id => `<img src="${cardImg(id)}">`).join('')}</div></div>
      <div class="vsmode">${esc(o.label)}</div>
    </div>`);
    document.body.appendChild(vs);
    Audio2.play('horn');
    Audio2.playMusic('battle');
    setTimeout(() => {
      app.hidden = true; bs.hidden = false;
      const cv = $('#battlecv');
      const st = Save.d.settings;
      const opts = Object.assign({}, o, {
        myName: o.myName || Save.d.name,
        hud: { names: st.cardNames !== false, stats: st.cardStats !== false, tutorial: o.label === 'Ladder' && Save.d.stats.played === 0 },
        onEnd: (res, m) => { m.destroy(); current = null; Game.match = null; showResult(o, res); },
      });
      if (o.role === 'client') { opts.team = 1; }
      const match = new Match(cv, opts);
      current = match; Game.match = match;
      if (o.role !== 'local') {
        Net.onMsg = d => match.onNet(1, d);
        Net.onClose = msg => match.connectionLost(msg);
      }
      vs.classList.add('out');
      setTimeout(() => vs.remove(), 500);
    }, 1800);
  }

  function battleMenu() {
    if (!current) return;
    const local = current.role === 'local';
    if (local) current.paused = true;
    const m = modal(`<div class="bmenu"><h2>${local ? 'Paused' : 'Battle menu'}</h2>
      <label>Sound <input type="range" min="0" max="1" step="0.05" id="sfxR" value="${Save.d.settings.sfx}"></label>
      <label>Music <input type="range" min="0" max="1" step="0.05" id="musR" value="${Save.d.settings.music}"></label>
      ${document.fullscreenEnabled ? `<div class="row"><button class="btn blue small" data-a="fs">${document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'}</button></div>` : ''}
      <div class="row"><button class="btn green" data-a="resume">Resume</button><button class="btn red" data-a="quit">Surrender</button></div></div>`, { onClose: () => { if (current) current.paused = false; } });
    $('#sfxR', m).oninput = e => { Save.d.settings.sfx = +e.target.value; Audio2.setVolumes(Save.d.settings.sfx, Save.d.settings.music); Save.save(); };
    $('#musR', m).oninput = e => { Save.d.settings.music = +e.target.value; Audio2.setVolumes(Save.d.settings.sfx, Save.d.settings.music); Save.save(); };
    $$('[data-a]', m).forEach(b => b.onclick = () => {
      if (b.dataset.a === 'fs') toggleFullscreen();
      if (b.dataset.a === 'quit') { if (current) { current.paused = false; current.surrender(); } }
      closeModal();
      if (current) current.paused = false;
    });
  }

  function showResult(o, res) {
    const extra = o.onResult ? (o.onResult(res) || {}) : {};
    Audio2.stopMusic();
    Audio2.play(res.win ? 'win' : res.draw ? 'click' : 'lose');
    const title = res.draw ? 'Draw' : res.win ? 'Victory!' : 'Defeat';
    const reasonTxt = { disconnect: 'Opponent disconnected', surrender: res.win ? 'Opponent surrendered' : 'You surrendered', tiebreak: 'Decided by tower health', keep: '', time: '', sudden: '' }[res.reason] || '';
    const bannersHtml = (n, mine) => [0, 1, 2].map(i => `<span class="bn ${i < n ? 'on' : ''} ${mine ? 'mine' : 'opp'}" style="animation-delay:${0.35 + i * 0.28 + (mine ? 0.9 : 0)}s"></span>`).join('');
    const el = h(`<div class="result ${res.win ? 'win' : res.draw ? 'draw' : 'lose'}">
      <div class="rtitle">${title}</div>
      ${reasonTxt ? `<div class="rreason">${reasonTxt}</div>` : ''}
      <div class="rrow opp"><div class="rname"><small>Opponent</small>${esc(o.vs.oppName)}</div><div class="rbn">${bannersHtml(res.oppBanners, false)}</div></div>
      <div class="rrow me ${res.win ? 'winner' : ''}"><div class="rname"><small>You</small>${esc(o.myName || Save.d.name)}</div><div class="rbn">${bannersHtml(res.myBanners, true)}</div></div>
      <div class="rewards">
        ${extra.trophies != null ? `<div class="rw">${icon('trophy')}<b class="countup" data-to="${extra.trophies}">0</b><small>${Save.d.trophies} total</small></div>` : ''}
        ${extra.gold ? `<div class="rw">${icon('gold')}<b>+${extra.gold}</b></div>` : ''}
        ${extra.chest ? `<div class="rw chestw"><span class="cv"></span><b>${CHESTS[extra.chest].name}</b></div>` : ''}
        ${extra.trophies != null && res.win && !extra.chest ? '<div class="rw"><small>Chest slots full</small></div>' : ''}
      </div>
      ${extra.newArena ? `<div class="newarena">New arena unlocked: <b>${esc(ARENAS[Save.arena()].name)}</b></div>` : ''}
      ${res.stats ? `<div class="rstats">Cards played ${res.stats.played} · Ember spent ${Math.round(res.stats.spent)} · Ember wasted ${res.stats.leaked.toFixed(1)}</div>` : ''}
      <button class="btn big gold" id="resOk">OK</button>
    </div>`);
    const bs = $('#battle');
    bs.appendChild(el);
    if (extra.chest) $('.chestw .cv', el).appendChild(chestCanvas(extra.chest, 64));
    $$('.countup', el).forEach(b => {
      const to = +b.dataset.to;
      let t0 = 0;
      const step = now => { if (!t0) t0 = now; const k = clamp((now - t0) / 700, 0, 1); b.textContent = (to >= 0 ? '+' : '') + Math.round(to * k); if (k < 1) requestAnimationFrame(step); else if (to) Audio2.play('coin', 0.6); };
      setTimeout(() => requestAnimationFrame(step), 1500);
    });
    $('#resOk', el).onclick = () => {
      el.remove(); bs.hidden = true; $('#app').hidden = false;
      Audio2.playMusic('menu');
      show(tab === 'cards' ? 'cards' : tab);
      if (extra.newArena) setTimeout(() => toast('Welcome to ' + ARENAS[Save.arena()].name + '! New cards can drop from chests.'), 300);
    };
  }

  function toggleFullscreen() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not allowed here */ }
  }

  // ---------------------------------------------------------------- modals
  function modal(html, opt = {}) {
    closeModal();
    const ov = h(`<div class="modal"><div class="mbox">${opt.noClose ? '' : '<button class="mclose" aria-label="Close">×</button>'}${html}</div></div>`);
    document.body.appendChild(ov);
    ov._onClose = opt.onClose;
    if (!opt.noClose) {
      $('.mclose', ov).onclick = () => closeModal();
      ov.addEventListener('pointerdown', e => { if (e.target === ov) closeModal(); });
    }
    return ov;
  }
  function closeModal() { const m = $('.modal'); if (m) { const f = m._onClose; m.remove(); if (f) f(); } }
  function confirmModal(text, yes) {
    const m = modal(`<div class="confirm"><p>${esc(text)}</p><div class="row"><button class="btn grey" data-a="no">Cancel</button><button class="btn green" data-a="yes">Yes</button></div></div>`);
    $('[data-a=no]', m).onclick = closeModal;
    $('[data-a=yes]', m).onclick = () => { closeModal(); yes(); };
  }
  let toastT = null;
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = h('<div id="toast"></div>'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function roadModal() {
    const D = Save.d;
    const m = modal(`<div class="road"><h2>${icon('trophy')} Trophy Road</h2><p class="tiny">Best: ${D.best} trophies</p><div class="roadlist">${TROPHY_ROAD.map((r, i) => {
      const st = Save.roadState(i);
      const lab = r.gold ? fmtNum(r.gold) + ' Gold' : r.gems ? r.gems + ' Gems' : r.chest ? CHESTS[r.chest].name : r.shards ? r.shards + ' Ascension Shards' : r.defender ? 'Defender: ' + DEFENDERS[r.defender].name : r.skin ? 'Skin: ' + TOWER_SKINS[r.skin].name : '';
      return `<div class="rstep ${st}"><span class="rt">${icon('trophy', 'mini')}${r.t}</span><span class="rl">${lab}</span>${st === 'ready' ? `<button class="btn small green" data-r="${i}">Claim</button>` : st === 'claimed' ? '<span class="ok">✓</span>' : ''}</div>`;
    }).join('')}</div><h3>Arenas</h3><div class="arenalist">${ARENAS.map((a, i) => `<div class="astep ${D.best >= a.trophies ? 'got' : ''}"><b>${i + 1}. ${esc(a.name)}</b><small>${a.trophies}+ trophies · unlocks ${CARDS.filter(c => c.arena === i).length} cards</small></div>`).join('')}</div></div>`);
    $$('[data-r]', m).forEach(b => b.onclick = () => {
      const r = Save.claimRoad(+b.dataset.r); if (!r) return;
      closeModal(); Audio2.play('upgrade');
      if (r.chest) chestOpen(r.chest); else toast('Claimed!');
      refreshTop(); if (tab === 'battle') show('battle');
    });
  }

  function profileModal() {
    const D = Save.d, S = D.stats;
    const need = Save.kingXpNeed();
    const m = modal(`<div class="profile"><div class="phead"><span class="kl big">${D.lvl}</span><div><h2>${esc(D.name)}</h2><div class="xpline">${need ? D.xp + ' / ' + need + ' XP to level ' + (D.lvl + 1) : 'Max level'}</div></div></div>
      <div class="pstats">
        <div><b>${D.trophies}</b><small>Trophies</small></div><div><b>${D.best}</b><small>Best</small></div><div><b>${S.wins}</b><small>Wins</small></div><div><b>${S.three}</b><small>Three-banner wins</small></div>
        <div><b>${S.losses}</b><small>Losses</small></div><div><b>${S.played}</b><small>Battles</small></div><div><b>${Object.keys(D.cards).length}/${CARDS.length}</b><small>Cards found</small></div><div><b>${S.onlineWins}</b><small>Online wins</small></div>
      </div>
      <h3>Battle log</h3>
      <div class="blog">${D.log.length ? D.log.map(l => `<div class="bl ${l.draw ? 'draw' : l.win ? 'win' : 'lose'}"><div class="blh"><b>${l.draw ? 'Draw' : l.win ? 'Victory' : 'Defeat'}</b> <span>${esc(l.mode)}</span> <span class="blb">${l.myBanners}-${l.oppBanners}</span> ${l.trophyDelta ? `<span class="bltr">${l.trophyDelta > 0 ? '+' : ''}${l.trophyDelta} ${icon('trophy', 'mini')}</span>` : ''}<small>${timeAgo(l.at)}</small></div><div class="bld"><span>vs ${esc(l.oppName)}</span><div class="bldeck">${(l.oppDeck || []).map(id => CARD[id] ? `<img src="${cardImg(id)}">` : '').join('')}</div></div></div>`).join('') : '<p class="tiny">No battles yet.</p>'}</div>
    </div>`);
    void m;
  }
  function timeAgo(t) { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; }

  function settingsModal() {
    const D = Save.d;
    const m = modal(`<div class="settings"><h2>Settings</h2>
      <label>Sound effects <input type="range" min="0" max="1" step="0.05" id="sfxR" value="${D.settings.sfx}"></label>
      <label>Music <input type="range" min="0" max="1" step="0.05" id="musR" value="${D.settings.music}"></label>
      <label class="tog">Card names in battle <input type="checkbox" id="optNames" ${D.settings.cardNames !== false ? 'checked' : ''}></label>
      <label class="tog">Card stats on hover / hold <input type="checkbox" id="optStats" ${D.settings.cardStats !== false ? 'checked' : ''}></label>
      ${document.fullscreenEnabled ? '<div class="row"><button class="btn blue small" data-a="fs">Toggle fullscreen</button></div>' : ''}
      <div class="row"><button class="btn blue" data-a="help">How to play</button></div>
      <div class="row"><button class="btn red small" data-a="reset">Reset progress</button></div>
      <p class="tiny">Keepstorm v${KS_VERSION} · progress is saved in this browser.</p></div>`);
    $('#sfxR', m).oninput = e => { D.settings.sfx = +e.target.value; Audio2.setVolumes(D.settings.sfx, D.settings.music); Save.save(); };
    $('#musR', m).oninput = e => { D.settings.music = +e.target.value; Audio2.setVolumes(D.settings.sfx, D.settings.music); Save.save(); };
    $('#optNames', m).onchange = e => { D.settings.cardNames = e.target.checked; Save.save(); };
    $('#optStats', m).onchange = e => { D.settings.cardStats = e.target.checked; Save.save(); };
    const fsb = $('[data-a=fs]', m); if (fsb) fsb.onclick = () => toggleFullscreen();
    $('[data-a=help]', m).onclick = () => helpModal();
    $('[data-a=reset]', m).onclick = () => confirmModal('Erase all progress, cards and trophies? This cannot be undone.', () => { Save.reset(); show('battle'); toast('Progress reset'); });
  }

  function helpModal(first) {
    const m = modal(`<div class="help"><h2>How to play</h2>
      <ol>
        <li><b>Destroy towers.</b> Each enemy side tower you knock down wins a banner. Destroy the Keep in the middle and you win instantly with three banners.</li>
        <li><b>Spend Ember.</b> Ember refills over time (up to 10). Drag a card from your hand onto your side of the arena to deploy it.</li>
        <li><b>Cycle your deck.</b> You hold 4 of your 8 cards. Every card you play goes to the back and the next card comes in.</li>
        <li><b>Pick your fights.</b> Some troops only hit the ground, some fly, some only attack buildings. Counter what your opponent plays.</li>
        <li><b>Win the clock.</b> The last minute gives double Ember. If banners are tied after 3 minutes, Overtime starts and the first tower to fall wins.</li>
        <li><b>Heroes</b> have an ability button that appears while they are on the field. <b>Ascended</b> cards in the first two deck slots get a stronger version every third play.</li>
      </ol>
      <p class="tiny">Keys: 1-4 pick a card, then click the arena. Space uses a hero ability, E opens emotes, Esc cancels.</p>
      <button class="btn big gold" data-a="ok">${first ? "Let's go!" : 'Got it'}</button></div>`);
    $('[data-a=ok]', m).onclick = () => { Save.d.seenHelp = true; Save.save(); closeModal(); };
    if (first) { Save.d.seenHelp = true; Save.save(); }
  }

  return { init, show, refreshTop, toast, battleMenu, startLadder, startTraining, startEvent, startOnline, modal, closeModal, cardImg, chestOpen, get current() { return current; } };
})();
