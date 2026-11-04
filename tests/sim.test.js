'use strict';
// node tests/sim.test.js [matches]  — headless simulation checks
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console, Math, Date, Set, Map, JSON, Object, Array, Number, String, Infinity, NaN, isFinite, parseInt });
for (const f of ['util.js', 'data_cards.js', 'data_meta.js', 'sim.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext(code, ctx);
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };

// 1. every card can be played and simulated without throwing
run(`
var cardErrs = [];
for (const c of CARDS) {
  try {
    const deck = [c.id].concat(['squire','twin_slingers','rattlebones','imp_pack','arbalest','boulder_brute','meteor','ember_volley'].filter(x => x !== c.id)).slice(0, 8);
    const b = new Battle({ seed: 5, players: [{ name: 'A', deck, asc: deck }, { name: 'B', deck: ['squire','twin_slingers','rattlebones','imp_pack','arbalest','boulder_brute','meteor','ember_volley'] }] });
    const p = b.players[0];
    // put the card in hand slot 0
    const i = p.hand.indexOf(c.id); if (i < 0) { p.queue.splice(p.queue.indexOf(c.id), 1); p.queue.unshift(p.hand[0]); p.hand[0] = c.id; }
    p.ember = 10; p.lastCard = 'squire'; p.lastLvl = 11;
    const slot = p.hand.indexOf(c.id);
    const tx = c.type === 'spell' && c.id !== 'echo' ? 9 : 4.5, ty = c.type === 'spell' && c.id !== 'echo' ? 8 : 20.5;
    const r = b.play(0, slot, tx, ty);
    if (!r.ok) throw new Error('play failed: ' + r.err);
    // enemy troops to fight
    b.spawnUnit(1, 'squire', 4.5, 14, 11, { deploy: 0 }); b.spawnUnit(1, 'bat', 5, 13, 11, { deploy: 0 });
    for (let k = 0; k < 30 * 25; k++) b.step();
    if (c.rarity === 'hero') { for (let k = 0; k < 4; k++) { p.ember = 10; p.abilCD = 0; } }
  } catch (e) { cardErrs.push(c.id + ': ' + e.stack.split('\\n').slice(0,3).join(' | ')); }
}
`);
const cardErrs = run('cardErrs');
ok(cardErrs.length === 0, 'cards: ' + cardErrs.join('\n'));
console.log('cards ok:', run('CARDS.length') - cardErrs.length, '/', run('CARDS.length'));

// 2. hero abilities
run(`
var abErr = [];
for (const h of CARDS.filter(c => c.rarity === 'hero')) {
  const deck = [h.id, 'squire','twin_slingers','rattlebones','imp_pack','arbalest','meteor','ember_volley'];
  const b = new Battle({ seed: 9, players: [{ name: 'A', deck }, { name: 'B', deck: ['squire','twin_slingers','rattlebones','imp_pack','arbalest','boulder_brute','meteor','ember_volley'] }] });
  const p = b.players[0];
  const i = p.hand.indexOf(h.id); if (i < 0) { p.queue.splice(p.queue.indexOf(h.id), 1); p.queue.unshift(p.hand[0]); p.hand[0] = h.id; }
  p.ember = 10;
  const r = b.play(0, p.hand.indexOf(h.id), 4.5, 18.5);
  if (!r.ok) { abErr.push(h.id + ' play ' + r.err); continue; }
  for (let k = 0; k < 45; k++) b.step();
  for (let k = 0; k < 5; k++) b.spawnUnit(1, 'rattlebone', 4 + k * 0.5, 15.8, 11, { deploy: 0 });
  b.spawnUnit(1, 'squire', 5, 16, 11, { deploy: 0 });
  for (let k = 0; k < 20; k++) b.step();
  p.ember = 10; p.abilCD = 0;
  const a = b.useAbility(0);
  if (!a.ok) abErr.push(h.id + ' ability ' + a.err);
  for (let k = 0; k < 300; k++) b.step();
  if (p.heroCard && p.hand.includes(h.id)) abErr.push(h.id + ' hero card still in hand while alive');
}
`);
ok(run('abErr.length') === 0, 'abilities: ' + run('abErr.join("; ")'));

// 3. full AI vs AI matches
const N = +process.argv[2] || 24;
run(`
var results = []; var matchErrs = [];
function match(seed, d0, d1, k0, k1, mode) {
  const rng = RNG(seed);
  const deckA = AI_DECKS[seed % AI_DECKS.length], deckB = AI_DECKS[(seed * 7 + 3) % AI_DECKS.length];
  const b = new Battle({ seed, mode, players: [{ name: 'A', deck: deckA.cards, ai: true, asc: deckA.cards }, { name: 'B', deck: deckB.cards, ai: true }] });
  const ais = [new AIBrain(b, 0, k0), new AIBrain(b, 1, k1)];
  let steps = 0;
  while (!b.over && steps < 30 * 400) {
    for (const a of ais) a.update(DT);
    b.step(); steps++;
    const ev = b.drainEvents();
    for (const e of ev) for (const a of ais) a.onEvent(e);
    for (const e of b.ents) if (!e.dead && (!isFinite(e.x) || !isFinite(e.y) || isNaN(e.hp))) throw new Error('NaN entity ' + e.kind);
  }
  return { winner: b.winner, t: b.t, banners: b.banners, reason: b.endReason, decks: [deckA.name, deckB.name], played: b.players.map(p => p.stats.played), leaked: b.players.map(p => p.stats.leaked.toFixed(1)), maxEnts: 0 };
}
`);
const diffs = ['easy', 'normal', 'hard', 'expert'];
const t0 = Date.now();
const tally = {};
for (let i = 0; i < N; i++) {
  const k0 = diffs[i % 4], k1 = diffs[(i + 1 + Math.floor(i / 4)) % 4];
  try {
    const r = run(`match(${i + 1}, 0, 0, '${k0}', '${k1}', ${i % 6 === 5 ? '{ emberMul: 3 }' : 'undefined'})`);
    const key = k0 + ' vs ' + k1;
    tally[key] = tally[key] || [0, 0, 0];
    tally[key][r.winner === 0 ? 0 : r.winner === 1 ? 1 : 2]++;
    console.log(`#${i + 1} ${k0} (${r.decks[0]}) vs ${k1} (${r.decks[1]}): winner ${r.winner} banners ${r.banners} ${r.reason} @${r.t.toFixed(0)}s played ${r.played} leaked ${r.leaked}`);
    ok(r.played[0] > 5 && r.played[1] > 5, 'AI barely played in match ' + (i + 1));
  } catch (e) { fails++; console.log('MATCH ERROR', i + 1, e.stack); }
}
console.log('tally', JSON.stringify(tally));
console.log('time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(fails ? fails + ' FAILURES' : 'ALL OK');
process.exit(fails ? 1 : 0);
