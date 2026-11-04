'use strict';
// Arenas, towers, skins, chests, progression tables, AI decks, emotes and events.

const ARENAS = [
  { name: 'Training Grounds', trophies: 0, theme: 'meadow', grass: ['#7cc756', '#72bd4e'], edge: '#4d8f35', path: '#d9c38c', water: '#3fa7e0', deco: 'tree', accent: '#ffd45c' },
  { name: 'Thornwood Glade', trophies: 300, theme: 'forest', grass: ['#5fae4a', '#56a343'], edge: '#2f6b2a', path: '#c8b07a', water: '#3a9bd0', deco: 'pine', accent: '#a8e070' },
  { name: 'Sunscorch Dunes', trophies: 600, theme: 'desert', grass: ['#e3c27a', '#dab670'], edge: '#b48a45', path: '#f0dca8', water: '#38b6c8', deco: 'cactus', accent: '#ff9c3a' },
  { name: 'Bonefield Barrows', trophies: 1000, theme: 'haunted', grass: ['#6f7f5a', '#667553'], edge: '#3b4436', path: '#9c9478', water: '#4f7a8c', deco: 'grave', accent: '#b9a6ff' },
  { name: 'Frostpeak Pass', trophies: 1300, theme: 'snow', grass: ['#e6f0f7', '#d9e6ef'], edge: '#9fb5c8', path: '#c3d2de', water: '#5cb8e8', deco: 'snowpine', accent: '#8fdcff' },
  { name: 'Cinder Caldera', trophies: 1600, theme: 'volcano', grass: ['#6b5047', '#614840'], edge: '#3a2a26', path: '#8c6b55', water: '#ff6a2a', deco: 'rock', accent: '#ff7a2f', lava: true },
  { name: 'Clockwork Quarter', trophies: 2000, theme: 'city', grass: ['#b8a88a', '#ad9d80'], edge: '#6f5f48', path: '#d8c9a8', water: '#4aa0b8', deco: 'gear', accent: '#e8b84a' },
  { name: 'Jade Lagoon', trophies: 2300, theme: 'jungle', grass: ['#4fb889', '#46ac7e'], edge: '#23715a', path: '#d6c48d', water: '#2fc4c8', deco: 'palm', accent: '#4ff0b0' },
  { name: 'Skyreach Isles', trophies: 2600, theme: 'sky', grass: ['#a7d98a', '#9cd07f'], edge: '#6c9fc8', path: '#efe2b8', water: '#bfe6ff', deco: 'cloud', accent: '#ffffff' },
  { name: 'Crystal Hollow', trophies: 3000, theme: 'crystal', grass: ['#6a63a8', '#615a9c'], edge: '#352f66', path: '#9d97cf', water: '#58e0ff', deco: 'crystal', accent: '#ff7ae0' },
  { name: 'Stormspire Summit', trophies: 3500, theme: 'storm', grass: ['#56677a', '#4e5e70'], edge: '#262e3a', path: '#8592a3', water: '#7a8cff', deco: 'spire', accent: '#ffe066' },
];
function arenaFor(trophies) { let a = 0; ARENAS.forEach((ar, i) => { if (trophies >= ar.trophies) a = i; }); return a; }

// Side-tower defenders. Stats relative to the standard tower.
const DEFENDERS = {
  bow_sisters: { name: 'Bow Sisters', desc: 'The classic pair of archers. Steady damage to air and ground.', unlock: 1, hpMul: 1, dmg: 110, hs: 0.8, rng: 7.5, proj: 'arrow' },
  powder_gunner: { name: 'Powder Gunner', desc: 'A gunner with a hand cannon. Slow, heavy shots. More tower hitpoints.', unlock: 7, hpMul: 1.08, dmg: 290, hs: 2.1, rng: 7.5, proj: 'cannonball' },
  blade_juggler: { name: 'Blade Juggler', desc: 'Throws knives very fast but must reload when the 20-knife belt is empty.', unlock: 10, hpMul: 0.92, dmg: 62, hs: 0.32, rng: 7, proj: 'knife', ammo: 20, reload: 0.5 },
  tower_chaplain: { name: 'Tower Chaplain', desc: 'Weaker shots, but heals your troops near the tower every second.', unlock: 13, hpMul: 0.96, dmg: 85, hs: 0.8, rng: 7.5, proj: 'holy', heal: 40, healR: 4.5 },
};
const DEFENDER_KEYS = Object.keys(DEFENDERS);

const TOWER_SKINS = {
  stone: { name: 'Stone Keep', price: 0, wall: '#b7b0a3', wall2: '#8f877a', roof: 'T', trim: '#6b6359', top: '#d8d1c3', style: 'stone' },
  timber: { name: 'Timber Fort', price: 150, wall: '#a97a4a', wall2: '#7d5530', roof: '#5f3b1f', trim: '#4a2c15', top: '#c99b65', style: 'wood' },
  frost: { name: 'Frost Spire', price: 250, wall: '#d6eef9', wall2: '#9fcbe3', roof: '#5fb7e8', trim: '#4f88b0', top: '#ffffff', style: 'ice' },
  magma: { name: 'Magma Citadel', price: 300, wall: '#4a3a38', wall2: '#2f2423', roof: '#ff6a2a', trim: '#ff9a3a', top: '#6b5552', style: 'magma' },
  gilded: { name: 'Gilded Palace', price: 500, wall: '#f2e6c4', wall2: '#cbb98a', roof: '#e8b830', trim: '#b8860b', top: '#fff6dc', style: 'gold' },
  jade: { name: 'Jade Pagoda', price: 350, wall: '#d9e8d2', wall2: '#a8c49c', roof: '#2fa36b', trim: '#c23b2b', top: '#f2f7ee', style: 'pagoda' },
  clockwork: { name: 'Clockwork Bastion', price: 400, wall: '#9a8f7e', wall2: '#6f6556', roof: '#c08a3a', trim: '#5a4630', top: '#b8ad9a', style: 'brass' },
  crystal: { name: 'Crystal Sanctum', price: 600, wall: '#c9c2f0', wall2: '#9890d0', roof: '#ff7ae0', trim: '#6f5fd0', top: '#eeeaff', style: 'crystal' },
};
const SKIN_KEYS = Object.keys(TOWER_SKINS);

// Base tower stats at level 11
const TOWER = {
  side: { hp: 3000, r: 1.5 },
  keep: { hp: 4800, dmg: 120, hs: 1.0, rng: 7, r: 2.0 },
};

// --- Economy ---------------------------------------------------------------------
const UPGRADE_COPIES = [2, 4, 10, 20, 50, 100, 200, 400, 800, 1000, 1500, 2500, 3500, 5000]; // index = level - 1 (common scale)
const UPGRADE_GOLD = [5, 20, 50, 150, 400, 1000, 2000, 4000, 8000, 15000, 35000, 50000, 75000, 100000]; // index = current level - 1
const UPGRADE_XP = [4, 5, 6, 10, 25, 50, 100, 200, 400, 600, 800, 1000, 1500, 2000];
function copiesNeeded(card, lvl) {
  // Same curve for every rarity, shifted so each rarity's first upgrade costs 2 copies.
  const shift = lvl - RARITY[card.rarity].start;
  const table = { common: UPGRADE_COPIES, rare: [2, 4, 10, 20, 50, 100, 200, 400, 500, 750, 1000, 1500], epic: [2, 4, 10, 20, 40, 50, 100, 200, 300], legendary: [2, 4, 6, 10, 20, 30], hero: [2, 5, 8, 20] }[card.rarity];
  return table[shift] || null;
}
const KING_XP = [20, 50, 100, 200, 400, 800, 1600, 2500, 4000, 6000, 8000, 12000, 16000, 20000];

const CHESTS = {
  oak: { name: 'Oak Chest', time: 15 * 60, gems: 3, cards: 12, gold: [20, 40], color: '#b0773f', rare: 0.1, epic: 0.01, leg: 0, shards: 0 },
  iron: { name: 'Iron Chest', time: 3 * 3600, gems: 18, cards: 30, gold: [60, 110], color: '#9aa7b3', rare: 0.25, epic: 0.04, leg: 0.002, shards: 0 },
  gold: { name: 'Golden Chest', time: 8 * 3600, gems: 48, cards: 80, gold: [180, 300], color: '#f5c242', rare: 0.6, epic: 0.12, leg: 0.01, shards: 1 },
  arcane: { name: 'Arcane Chest', time: 12 * 3600, gems: 72, cards: 160, gold: [400, 700], color: '#b86cf0', rare: 1.5, epic: 0.4, leg: 0.04, shards: 1 },
  grand: { name: 'Grand Chest', time: 12 * 3600, gems: 72, cards: 400, gold: [700, 1000], color: '#3fb6e8', rare: 2, epic: 0.3, leg: 0.02, shards: 2 },
  mythic: { name: 'Mythic Chest', time: 24 * 3600, gems: 144, cards: 600, gold: [2000, 3000], color: '#ff7a4a', rare: 4, epic: 1.2, leg: 0.2, shards: 3, guaranteeLeg: true },
  free: { name: 'Free Chest', time: 0, gems: 0, cards: 8, gold: [10, 30], color: '#7cd65a', rare: 0.1, epic: 0.01, leg: 0.001, shards: 0, free: true },
  banner: { name: 'Banner Chest', time: 0, gems: 0, cards: 40, gold: [150, 300], color: '#e8484e', rare: 0.5, epic: 0.1, leg: 0.01, shards: 1, gemsReward: [4, 10], free: true },
};
// Repeating chest cycle for victories
const CHEST_CYCLE = ['oak', 'oak', 'iron', 'oak', 'iron', 'oak', 'oak', 'gold', 'oak', 'iron', 'oak', 'oak', 'arcane', 'iron', 'oak', 'gold', 'oak', 'iron', 'oak', 'grand', 'oak', 'iron', 'oak', 'gold', 'oak', 'oak', 'iron', 'mythic'];

const TROPHY_ROAD = [
  { t: 50, gold: 100 }, { t: 100, chest: 'iron' }, { t: 150, gems: 20 }, { t: 200, gold: 250 }, { t: 300, chest: 'gold' },
  { t: 400, gems: 30 }, { t: 500, shards: 2 }, { t: 600, chest: 'arcane' }, { t: 750, gold: 500 }, { t: 900, defender: 'powder_gunner' },
  { t: 1000, chest: 'grand' }, { t: 1150, gems: 50 }, { t: 1300, skin: 'frost' }, { t: 1450, gold: 1000 }, { t: 1600, chest: 'mythic' },
  { t: 1800, shards: 3 }, { t: 2000, defender: 'blade_juggler' }, { t: 2150, gems: 80 }, { t: 2300, chest: 'grand' }, { t: 2450, gold: 2000 },
  { t: 2600, skin: 'gilded' }, { t: 2800, defender: 'tower_chaplain' }, { t: 3000, chest: 'mythic' }, { t: 3250, gems: 150 }, { t: 3500, chest: 'mythic' },
  { t: 4000, gold: 5000 }, { t: 4500, skin: 'crystal' }, { t: 5000, chest: 'mythic' },
];

// --- AI ----------------------------------------------------------------------------
const AI_DIFFS = {
  easy: { name: 'Recruit', react: 2.0, think: 1.3, mistake: 0.4, skill: 0.3, spellIQ: 0.15, levelOff: -2, color: '#7cd65a' },
  normal: { name: 'Knight', react: 1.2, think: 0.9, mistake: 0.18, skill: 0.6, spellIQ: 0.45, levelOff: -1, color: '#4aa8ff' },
  hard: { name: 'Warlord', react: 0.5, think: 0.4, mistake: 0.03, skill: 0.88, spellIQ: 0.85, levelOff: 0, color: '#ff9a3a' },
  expert: { name: 'Sovereign', react: 0.3, think: 0.25, mistake: 0, skill: 1, spellIQ: 1, levelOff: 1, color: '#ff4a6a' },
};
const AI_DIFF_KEYS = ['easy', 'normal', 'hard', 'expert'];

const AI_DECKS = [
  { name: 'Training Mix', tier: 0, cards: ['squire', 'twin_slingers', 'rattlebones', 'imp_pack', 'arbalest', 'boulder_brute', 'meteor', 'ember_volley'] },
  { name: 'Brute Force', tier: 0, cards: ['boulder_brute', 'flame_adept', 'hatchling_drake', 'gloom_bats', 'squire', 'arbalest', 'meteor', 'ember_volley'] },
  { name: 'Ram Cycle', tier: 1, cards: ['ram_rider', 'twin_slingers', 'rattlebones', 'cinder_sprite', 'bolt_thrower', 'spark', 'meteor', 'axe_dancer'] },
  { name: 'Imp Bait', tier: 1, cards: ['imp_crate', 'imp_pack', 'spear_imps', 'gloom_bats', 'imp_burrow', 'clockwork_cutter', 'ember_volley', 'spark'] },
  { name: 'Colossus Wall', tier: 1, cards: ['iron_colossus', 'charger', 'hex_witch', 'wisps', 'rattlebones', 'flame_adept', 'ember_volley', 'meteor'] },
  { name: 'Sky Raid', tier: 2, cards: ['zeppelin', 'hatchling_drake', 'gargoyle_flock', 'gloom_bats', 'frenzy', 'ember_volley', 'arbalest', 'squire'] },
  { name: 'Grave Shadows', tier: 2, cards: ['haunting', 'nightshade', 'shade_guards', 'crypt', 'blight_cloud', 'spark', 'reaper', 'boulder_brute'] },
  { name: 'Siege Line', tier: 3, cards: ['siege_ballista', 'squire', 'arbalest', 'rattlebones', 'cinder_sprite', 'bolt_thrower', 'ember_volley', 'timber_roll'] },
  { name: 'Frost Control', tier: 3, cards: ['tunneler', 'frost_mage', 'rime', 'boulder_roller', 'cinder_sprite', 'crypt', 'timber_roll', 'meteor'] },
  { name: 'Ember Hound', tier: 4, cards: ['cinder_hound', 'zeppelin', 'magma_wyrm', 'gargoyle_flock', 'imp_pack', 'searing_beacon', 'spark', 'blight_cloud'] },
  { name: 'Titan Bridge', tier: 4, cards: ['titan_knight', 'rogue', 'phantom', 'berserker', 'storm_caller', 'cinder_sprite', 'timber_roll', 'meteor'] },
  { name: 'Ember Well Beatdown', tier: 4, cards: ['ember_well', 'iron_colossus', 'thunder_engine', 'storm_caller', 'frost_mage', 'phalanx', 'thunderstrike', 'vortex'] },
  { name: 'Paladin Rush', tier: 5, cards: ['sunblade_paladin', 'ram_rider', 'storm_caller', 'volt_sprite', 'frost_sprite', 'storm_pylon', 'timber_roll', 'meteor'] },
  { name: 'Monarch Swarm', tier: 5, cards: ['bone_monarch', 'sapper_duo', 'imp_crate', 'mend_sprite', 'gloom_bats', 'ember_forge', 'tremor', 'snowball'] },
  { name: 'Huntress Control', tier: 5, cards: ['huntress', 'boulder_brute', 'field_medic', 'longbow_ranger', 'echo', 'lob_kiln', 'siege_shell', 'ember_volley'] },
  { name: 'Abbot Brawl', tier: 5, cards: ['stone_abbot', 'siege_ram', 'brawlers', 'mirage', 'wisps', 'imp_pack', 'vortex', 'meteor'] },
];

const AI_NAMES = ['Brannoc', 'Lady Wren', 'Thistle', 'Gorran', 'Mira Vale', 'Pell', 'Oskar the Bold', 'Juniper', 'Rook', 'Sable', 'Kestrel', 'Dunmore', 'Ivy Ash', 'Torvin', 'Marigold', 'Fennick', 'Halvard', 'Quill', 'Bramble', 'Seren', 'Captain Dusk', 'Nimbus', 'Ottoline', 'Grimsby', 'Larkspur', 'Wystan', 'Hollis', 'Elspeth', 'Corvin', 'Tamsin'];

const EMOTES = [
  { id: 'gg', text: 'Good game!', face: 'happy' },
  { id: 'wp', text: 'Well played!', face: 'thumbs' },
  { id: 'wow', text: 'Wow!', face: 'wow' },
  { id: 'thanks', text: 'Thanks!', face: 'happy' },
  { id: 'oops', text: 'Oops', face: 'oops' },
  { id: 'laugh', text: 'Ha ha ha!', face: 'laugh' },
  { id: 'cry', text: 'Noooo...', face: 'cry' },
  { id: 'grr', text: 'Grrr!', face: 'angry' },
];

const EVENTS = [
  { id: 'draft', name: 'Draft Duel', desc: 'Pick one card from each pair. Your opponent gets the one you leave behind.', mode: { draft: true }, reward: { gold: 120 } },
  { id: 'triple', name: 'Triple Ember', desc: 'Ember flows three times as fast from the very start.', mode: { emberMul: 3 }, reward: { gold: 100 } },
  { id: 'sudden', name: 'Sudden Death', desc: 'Double Ember the whole match. The first tower to fall decides it.', mode: { emberMul: 2, sudden: true, dur: 180, ot: 0 }, reward: { gold: 100 } },
  { id: 'mirror', name: 'Mirror Match', desc: 'Both players fight with exactly the same deck: yours.', mode: { mirror: true }, reward: { gold: 100 } },
  { id: 'chaos', name: 'Chaos Decks', desc: 'Both players get a random deck from the whole card pool. Everything at tournament level.', mode: { chaos: true }, reward: { gold: 120 } },
  { id: 'rush', name: 'Ember Rush', desc: 'Start with a full Ember bar and double Ember from the start.', mode: { startEmber: 10, emberMul: 2 }, reward: { gold: 100 } },
  { id: 'duo', name: '2v2 Skirmish', desc: 'Team up with an AI ally against two AI opponents. Each player has their own deck and Ember.', mode: { duo: true }, reward: { gold: 150 } },
];

if (typeof module !== 'undefined') module.exports = { ARENAS, DEFENDERS, TOWER_SKINS, AI_DECKS };
