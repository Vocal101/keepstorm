'use strict';
// Player profile, progression and economy. Stored in localStorage.

const STARTER_DECK = ['squire', 'twin_slingers', 'rattlebones', 'imp_pack', 'arbalest', 'boulder_brute', 'meteor', 'ember_volley'];
const ASC_SHARD_COST = 6;

const Save = (() => {
  const KEY = 'keepstorm_save_v1';
  let D = null;

  function defaults() {
    const cards = {};
    for (const id of STARTER_DECK) cards[id] = { lvl: RARITY[CARD[id].rarity].start, n: 0 };
    const now = Date.now();
    return {
      v: 1, name: 'Keeper' + Math.floor(100 + Math.random() * 900), created: now,
      gold: 600, gems: 120, trophies: 0, best: 0, xp: 0, lvl: 1,
      cards, decks: [STARTER_DECK.slice(), STARTER_DECK.slice(), STARTER_DECK.slice(), STARTER_DECK.slice(), STARTER_DECK.slice()], deckIdx: 0,
      ascUnlocked: [], shards: 0,
      defenders: ['bow_sisters'], defender: 'bow_sisters', skins: ['stone'], skin: 'stone',
      chests: [{ type: 'oak', unlockAt: 0, unlocking: false }, null, null, null], chestCycle: 0,
      freeChestAt: now, freeChests: 2, bannerCount: 0, bannerDay: dayKey(now), bannerClaimed: false,
      shop: null, stats: { wins: 0, losses: 0, draws: 0, three: 0, played: 0, online: 0, onlineWins: 0, eventWins: 0 },
      log: [], road: [], settings: { sfx: 0.8, music: 0.45, name: true }, seenHelp: false, eventWins: {},
    };
  }
  function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) D = Object.assign(defaults(), JSON.parse(raw)); } catch (e) { D = null; }
    if (!D) D = defaults();
    // sanity: drop unknown cards, fix decks
    for (const id of Object.keys(D.cards)) if (!CARD[id]) delete D.cards[id];
    D.decks = D.decks.map(d => fixDeck(d));
    if (!DEFENDERS[D.defender]) D.defender = 'bow_sisters';
    if (!TOWER_SKINS[D.skin]) D.skin = 'stone';
    tickFreeChest();
    return D;
  }
  function fixDeck(d) {
    const out = [];
    for (const id of d || []) if (D.cards[id] && !out.includes(id)) out.push(id);
    for (const id of STARTER_DECK.concat(Object.keys(D.cards))) { if (out.length >= 8) break; if (!out.includes(id) && D.cards[id]) out.push(id); }
    // only one hero
    let hero = false;
    return out.filter(id => { if (CARD[id].rarity === 'hero') { if (hero) return false; hero = true; } return true; }).slice(0, 8);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* quota */ } }
  function reset() { D = defaults(); save(); }

  // ---------------------------------------------------------------- derived
  const arena = () => arenaFor(D.trophies);
  const deck = () => D.decks[D.deckIdx];
  const kingXpNeed = () => KING_XP[D.lvl - 1] || null;
  function avgDeckLevel(dk) { dk = dk || deck(); return dk.reduce((s, id) => s + (D.cards[id] ? D.cards[id].lvl : 1), 0) / dk.length; }
  function ascInDeck(dk) { dk = dk || deck(); return dk.filter((id, i) => i < 2 && D.ascUnlocked.includes(id) && CARD[id].asc); }

  function profile() {
    const dk = deck();
    return { name: D.name, lvl: D.lvl, deck: dk.slice(), asc: ascInDeck(dk), defender: D.defender, skin: D.skin };
  }
  function levelsFor(dk) { const o = {}; for (const id of dk) o[id] = D.cards[id] ? D.cards[id].lvl : 1; return o; }

  // ---------------------------------------------------------------- cards
  function addCards(id, n) {
    const isNew = !D.cards[id];
    if (isNew) D.cards[id] = { lvl: RARITY[CARD[id].rarity].start, n: Math.max(0, n - 1) };
    else D.cards[id].n += n;
    return isNew;
  }
  function upgradeInfo(id) {
    const c = D.cards[id]; if (!c) return null;
    const card = CARD[id];
    if (c.lvl >= MAX_LEVEL) return { max: true };
    const need = copiesNeeded(card, c.lvl);
    const gold = UPGRADE_GOLD[c.lvl - 1];
    if (need == null) return { max: true };
    return { need, gold, have: c.n, ready: c.n >= need, afford: D.gold >= gold, xp: UPGRADE_XP[c.lvl - 1] };
  }
  function upgrade(id) {
    const u = upgradeInfo(id);
    if (!u || u.max || !u.ready || !u.afford) return false;
    const c = D.cards[id];
    c.n -= u.need; D.gold -= u.gold; c.lvl++;
    addXp(u.xp);
    save();
    return true;
  }
  function addXp(n) {
    D.xp += n;
    let leveled = false;
    while (kingXpNeed() && D.xp >= kingXpNeed()) { D.xp -= kingXpNeed(); D.lvl++; leveled = true; D.gems += 20; }
    return leveled;
  }

  // ---------------------------------------------------------------- chests
  function cardPool(rarity, ar) {
    return CARDS.filter(c => c.rarity === rarity && c.arena <= ar);
  }
  function openChest(type, ar) {
    const C = CHESTS[type];
    if (ar == null) ar = arena();
    const scale = 1 + ar * 0.18;
    const rng = RNG(Date.now() ^ (Math.random() * 1e9));
    const rewards = [];
    const gold = Math.round(rng.int(C.gold[0], C.gold[1]) * (1 + ar * 0.2));
    rewards.push({ type: 'gold', n: gold });
    let total = Math.round(C.cards * scale);
    const pick = (r, n) => {
      const pool = cardPool(r, ar);
      if (!pool.length || n <= 0) return 0;
      const c = rng.pick(pool);
      rewards.push({ type: 'card', id: c.id, n, rarity: r });
      return n;
    };
    const roll = v => Math.floor(v) + (rng() < v - Math.floor(v) ? 1 : 0);
    let leg = roll(C.leg * scale); if (C.guaranteeLeg) leg = Math.max(1, leg);
    let hero = ar >= 6 && rng() < (C.leg * 0.5 + (type === 'mythic' ? 0.1 : 0)) ? 1 : 0;
    let epic = roll(C.epic * scale), rare = roll(C.rare * scale * 3);
    for (let i = 0; i < leg; i++) total -= pick('legendary', 1);
    for (let i = 0; i < hero; i++) total -= pick('hero', 1);
    if (epic > 0) { const stacks = Math.min(epic, 2); for (let i = 0; i < stacks; i++) total -= pick('epic', Math.ceil(epic / stacks)); }
    if (rare > 0) { const stacks = Math.min(3, Math.max(1, Math.ceil(rare / 6))); for (let i = 0; i < stacks; i++) total -= pick('rare', Math.ceil(rare / stacks)); }
    total = Math.max(total, 4);
    const stacks = Math.min(4, Math.max(2, Math.ceil(total / 25)));
    for (let i = 0; i < stacks; i++) pick('common', Math.ceil(total / stacks));
    if (C.shards) { const s = rng() < 0.5 ? C.shards : Math.max(1, C.shards - 1); rewards.push({ type: 'shard', n: s }); }
    if (C.gemsReward) rewards.push({ type: 'gems', n: rng.int(C.gemsReward[0], C.gemsReward[1]) });
    // merge duplicate card stacks, sort commons first like a reveal
    const merged = [];
    for (const r of rewards) {
      if (r.type === 'card') { const m = merged.find(x => x.type === 'card' && x.id === r.id); if (m) { m.n += r.n; continue; } }
      merged.push(Object.assign({}, r));
    }
    const order = { gold: 0, gems: 1, shard: 2, card: 3 };
    merged.sort((a, b) => (order[a.type] - order[b.type]) || (a.type === 'card' ? RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) : 0));
    // apply
    for (const r of merged) {
      if (r.type === 'gold') D.gold += r.n;
      else if (r.type === 'gems') D.gems += r.n;
      else if (r.type === 'shard') D.shards += r.n;
      else if (r.type === 'card') r.isNew = addCards(r.id, r.n);
    }
    save();
    return merged;
  }
  function chestSlotFree() { return D.chests.findIndex(c => !c); }
  function awardChest() {
    const slot = chestSlotFree();
    if (slot < 0) return null;
    const type = CHEST_CYCLE[D.chestCycle % CHEST_CYCLE.length];
    D.chestCycle++;
    D.chests[slot] = { type, unlockAt: 0, unlocking: false, arena: arena() };
    return type;
  }
  function startUnlock(i) {
    const ch = D.chests[i]; if (!ch || ch.unlocking) return false;
    if (D.chests.some(c => c && c.unlocking && c.unlockAt > Date.now())) return false;
    ch.unlocking = true; ch.unlockAt = Date.now() + CHESTS[ch.type].time * 1000;
    save(); return true;
  }
  function chestGemCost(ch) {
    const left = ch.unlocking ? Math.max(0, ch.unlockAt - Date.now()) / 1000 : CHESTS[ch.type].time;
    return Math.max(1, Math.ceil(left / 600));
  }
  function chestReady(ch) { return ch && (CHESTS[ch.type].time === 0 || (ch.unlocking && Date.now() >= ch.unlockAt)); }
  function openSlot(i, useGems) {
    const ch = D.chests[i]; if (!ch) return null;
    if (!chestReady(ch)) {
      if (!useGems) return null;
      const cost = chestGemCost(ch);
      if (D.gems < cost) return null;
      D.gems -= cost;
    }
    D.chests[i] = null;
    return { type: ch.type, rewards: openChest(ch.type, ch.arena != null ? Math.max(ch.arena, 0) : arena()) };
  }
  const FREE_EVERY = 4 * 3600 * 1000;
  function tickFreeChest() {
    const now = Date.now();
    while (D.freeChests < 2 && now >= D.freeChestAt + FREE_EVERY) { D.freeChests++; D.freeChestAt += FREE_EVERY; }
    if (D.freeChests >= 2) D.freeChestAt = now;
    const dk = dayKey(now);
    if (D.bannerDay !== dk) { D.bannerDay = dk; D.bannerCount = 0; D.bannerClaimed = false; }
  }
  function freeChestIn() { tickFreeChest(); return D.freeChests > 0 ? 0 : Math.max(0, D.freeChestAt + FREE_EVERY - Date.now()) / 1000; }
  function openFree() {
    tickFreeChest(); if (D.freeChests <= 0) return null;
    if (D.freeChests === 2) D.freeChestAt = Date.now();
    D.freeChests--; return { type: 'free', rewards: openChest('free') };
  }
  function openBannerChest() {
    tickFreeChest(); if (D.bannerCount < 10 || D.bannerClaimed) return null;
    D.bannerClaimed = true; return { type: 'banner', rewards: openChest('banner') };
  }

  // ---------------------------------------------------------------- shop
  function shop() {
    const dk = dayKey(Date.now());
    if (!D.shop || D.shop.day !== dk) {
      const rng = RNG(Date.now() & 0xffffff);
      const ar = arena();
      const offers = [];
      const add = (rarity, n, price) => {
        const pool = cardPool(rarity, ar).filter(c => !offers.some(o => o.id === c.id));
        if (pool.length) offers.push({ id: rng.pick(pool).id, n, price, bought: false });
      };
      add('common', 10, 100); add('common', 20, 200); add('rare', 3, 300); add('rare', 5, 500); add('epic', 1, 1000);
      if (rng() < 0.35) add('legendary', 1, 20000); else add('common', 40, 400);
      D.shop = { day: dk, offers, freeGift: false };
      save();
    }
    return D.shop;
  }
  function buyOffer(i) {
    const s = shop(), o = s.offers[i];
    if (!o || o.bought || D.gold < o.price) return null;
    D.gold -= o.price; o.bought = true;
    const isNew = addCards(o.id, o.n);
    save(); return { id: o.id, n: o.n, isNew };
  }

  // ---------------------------------------------------------------- results
  function recordBattle(r) {
    // r: { mode, win, draw, myBanners, oppBanners, oppName, oppDeck, myDeck, trophyDelta, online, event }
    D.stats.played++;
    if (r.draw) D.stats.draws++; else if (r.win) D.stats.wins++; else D.stats.losses++;
    if (r.win && r.myBanners >= 3) D.stats.three++;
    if (r.online) { D.stats.online++; if (r.win) D.stats.onlineWins++; }
    D.log.unshift(Object.assign({ at: Date.now() }, r));
    D.log = D.log.slice(0, 30);
    save();
  }
  function ladderReward(win, draw, myBanners, oppTrophies) {
    const out = { trophies: 0, gold: 0, chest: null, banners: myBanners, xp: 0, newArena: false };
    const before = arena();
    if (win) {
      out.trophies = clamp(30 + Math.round((oppTrophies - D.trophies) / 12), 24, 36);
      out.gold = 15 + before * 6;
      out.chest = awardChest();
      out.xp = 8;
    } else if (!draw) {
      const floorT = ARENAS[before].trophies;
      out.trophies = -Math.min(clamp(28 + Math.round((D.trophies - oppTrophies) / 12), 20, 34), Math.max(0, D.trophies - floorT));
    }
    D.trophies = Math.max(0, D.trophies + out.trophies);
    D.best = Math.max(D.best, D.trophies);
    D.gold += out.gold;
    tickFreeChest();
    if (!D.bannerClaimed) D.bannerCount = Math.min(10, D.bannerCount + myBanners);
    if (out.xp) addXp(out.xp);
    out.newArena = arena() > before;
    save();
    return out;
  }

  // trophy road
  function roadState(i) { const r = TROPHY_ROAD[i]; return D.road.includes(i) ? 'claimed' : D.best >= r.t ? 'ready' : 'locked'; }
  function claimRoad(i) {
    if (roadState(i) !== 'ready') return null;
    const r = TROPHY_ROAD[i];
    D.road.push(i);
    let res = { reward: r };
    if (r.gold) D.gold += r.gold;
    if (r.gems) D.gems += r.gems;
    if (r.shards) D.shards += r.shards;
    if (r.defender && !D.defenders.includes(r.defender)) D.defenders.push(r.defender);
    if (r.skin && !D.skins.includes(r.skin)) D.skins.push(r.skin);
    if (r.chest) res.chest = { type: r.chest, rewards: openChest(r.chest) };
    save();
    return res;
  }

  function unlockAsc(id) {
    if (!CARD[id].asc || D.ascUnlocked.includes(id) || D.shards < ASC_SHARD_COST || !D.cards[id]) return false;
    D.shards -= ASC_SHARD_COST; D.ascUnlocked.push(id); save(); return true;
  }

  return {
    load, save, reset, get d() { return D; }, arena, deck, kingXpNeed, avgDeckLevel, profile, levelsFor, ascInDeck, fixDeck,
    upgradeInfo, upgrade, addCards, addXp, openChest, awardChest, startUnlock, chestGemCost, chestReady, openSlot, freeChestIn, openFree, openBannerChest, tickFreeChest,
    shop, buyOffer, recordBattle, ladderReward, roadState, claimRoad, unlockAsc, dayKey,
  };
})();
