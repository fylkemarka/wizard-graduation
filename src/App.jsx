// Wizard Graduation — STS-inspired single-player roguelike deckbuilder.
//
// MVP3: Acts 1-4 chained into a full graduation run with per-slot
// equipment tiers (basic / fine / master). Single-file App.jsx for
// fast iteration; will split when systems stabilize.
//
// Sections:
//   1. DATA — cards, enemies, equipment, events, acts
//   2. HELPERS — shuffle, clamp, uid, intent rolls, map generator
//   3. App component — run state, stage flow, combat + map + reward UIs
//   4. Sub-screens

import { useState } from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// 1. DATA
// =============================================================================

// Effect dispatcher keys recognized by playCard / applyEnemyIntent / events:
//   attack / block / draw / vulnerable / weak / energy / exhaust    (card)
//   heal / maxHp / loseHp / gainCommonCard / gainUncommonCard /
//   gainRareCard                                                    (event)
// Equipment-bonus keys read at the right hooks (start-of-combat, etc.):
//   strikeBonus            — +N damage on any Strike-named card
//   startBlock             — +N Block at start of every combat
//   energyOnCombatStart    — +N energy on turn 1 of each combat (one-shot)
//   permanentEnergyBonus   — +N energy refilled EVERY turn (perm)
//   maxHp                  — +N max HP (applied once at install)
//   healOnCombatStart      — +N HP at start of every combat
//   extraStartHand         — +N to the turn-1 draw (per combat)
const CARDS = [
  // ---- BASIC ----
  { id: 'c-strike', name: 'Strike', cost: 1, type: 'attack', rarity: 'basic',
    effects: { attack: 6 }, desc: 'Deal 6 damage.' },
  { id: 'c-defend', name: 'Defend', cost: 1, type: 'skill', rarity: 'basic',
    effects: { block: 5 }, desc: 'Gain 5 Block.' },
  { id: 'c-spark', name: 'Spark', cost: 0, type: 'attack', rarity: 'basic',
    effects: { attack: 3 }, desc: 'Deal 3 damage. (Free)' },
  // ---- COMMON ----
  { id: 'c-arc-bolt', name: 'Arc Bolt', cost: 1, type: 'attack', rarity: 'common',
    effects: { attack: 4, weak: 1 }, desc: 'Deal 4 damage. Apply 1 Weak.' },
  { id: 'c-hex-lance', name: 'Hex Lance', cost: 2, type: 'attack', rarity: 'common',
    effects: { attack: 9 }, desc: 'Deal 9 damage.' },
  { id: 'c-mend', name: 'Mend', cost: 1, type: 'skill', rarity: 'common',
    effects: { block: 7 }, desc: 'Gain 7 Block.' },
  { id: 'c-acuity', name: 'Acuity', cost: 1, type: 'skill', rarity: 'common',
    effects: { draw: 2 }, desc: 'Draw 2 cards.' },
  { id: 'c-piercing', name: 'Piercing', cost: 1, type: 'attack', rarity: 'common',
    effects: { attack: 5, vulnerable: 1 }, desc: 'Deal 5 damage. Apply 1 Vulnerable.' },
  { id: 'c-channel', name: 'Channel', cost: 0, type: 'skill', rarity: 'common',
    effects: { draw: 1, energy: 1, exhaust: true }, desc: '+1 Energy. Draw 1. Exhaust.' },
  // ---- UNCOMMON ----
  { id: 'c-fireball', name: 'Fireball', cost: 2, type: 'attack', rarity: 'uncommon',
    effects: { attack: 14 }, desc: 'Deal 14 damage.' },
  { id: 'c-bulwark', name: 'Bulwark', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 10 }, desc: 'Gain 10 Block.' },
  { id: 'c-meditate', name: 'Meditate', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { energy: 1, draw: 1, exhaust: true }, desc: 'Gain 1 Energy. Draw 1. Exhaust.' },
  { id: 'c-warding', name: 'Warding Glyph', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 4, vulnerable: 1 }, desc: 'Gain 4 Block. Apply 1 Vulnerable.' },
  { id: 'c-thunder', name: 'Thunderbolt', cost: 1, type: 'attack', rarity: 'uncommon',
    effects: { attack: 6, weak: 2 }, desc: 'Deal 6 damage. Apply 2 Weak.' },
  { id: 'c-clarity', name: 'Clarity', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { draw: 3, exhaust: true }, desc: 'Draw 3 cards. Exhaust.' },
  // ---- RARE ----
  { id: 'c-arcane-pulse', name: 'Arcane Pulse', cost: 2, type: 'attack', rarity: 'rare',
    effects: { attack: 12, weak: 2 }, desc: 'Deal 12 damage. Apply 2 Weak.' },
  { id: 'c-immolate', name: 'Immolate', cost: 2, type: 'attack', rarity: 'rare',
    effects: { attack: 18, exhaust: true }, desc: 'Deal 18 damage. Exhaust.' },
  { id: 'c-aegis', name: 'Aegis', cost: 2, type: 'skill', rarity: 'rare',
    effects: { block: 16 }, desc: 'Gain 16 Block.' },
  { id: 'c-judgment', name: 'Judgment', cost: 2, type: 'attack', rarity: 'rare',
    effects: { attack: 10, vulnerable: 2 }, desc: 'Deal 10 damage. Apply 2 Vulnerable.' },
];
const CARDS_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

const STARTER_DECK = [
  'c-strike', 'c-strike', 'c-strike', 'c-strike',
  'c-defend', 'c-defend', 'c-defend',
  'c-spark', 'c-spark',
];

// Enemies. `act` filters which act they appear in. `tier` ∈ normal / elite / boss.
// behaviors[*]: { kind, value, weight, telegraph, count? }
const ENEMIES = [
  // ===== ACT 1 — The Staff Path =====
  { id: 'e1-acolyte', act: 1, name: 'Lost Acolyte', maxHp: 20, tier: 'normal', behaviors: [
      { kind: 'attack', value: 5, weight: 3, telegraph: '⚔ 5' },
      { kind: 'block',  value: 5, weight: 1, telegraph: '🛡 5' },
    ] },
  { id: 'e1-imp', act: 1, name: 'Pact Imp', maxHp: 18, tier: 'normal', behaviors: [
      { kind: 'attack', value: 4, weight: 3, telegraph: '⚔ 4' },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '🌀 Weak 1' },
    ] },
  { id: 'e1-shrine-rat', act: 1, name: 'Shrine Rat Pack', maxHp: 16, tier: 'normal', behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3, telegraph: '⚔ 2×3' },
      { kind: 'block',  value: 4, weight: 1, telegraph: '🛡 4' },
    ] },
  { id: 'e1-tutor', act: 1, name: 'Stern Tutor', maxHp: 32, tier: 'elite', behaviors: [
      { kind: 'attack', value: 8, weight: 3, telegraph: '⚔ 8' },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 7, weight: 1, telegraph: '🛡 7' },
    ] },
  { id: 'e1-thicket', act: 1, name: 'Living Thicket', maxHp: 38, tier: 'elite', behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 9, weight: 2, telegraph: '🛡 9' },
      { kind: 'vulnerable', value: 1, weight: 1, telegraph: '🌀 Vuln' },
    ] },
  { id: 'e1-boss-thornlord', act: 1, name: 'The Thornlord', maxHp: 60, tier: 'boss', behaviors: [
      { kind: 'attack', value: 11, weight: 2, telegraph: '⚔ 11' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 2, telegraph: '⚔ 4×3' },
      { kind: 'block',  value: 12, weight: 1, telegraph: '🛡 12' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
    ] },

  // ===== ACT 2 — The Thread Path =====
  { id: 'e2-hollow-weaver', act: 2, name: 'Hollow Weaver', maxHp: 28, tier: 'normal', behaviors: [
      { kind: 'attack', value: 7, weight: 3, telegraph: '⚔ 7' },
      { kind: 'weak',   value: 1, weight: 2, telegraph: '🌀 Weak 1' },
    ] },
  { id: 'e2-silk-wraith', act: 2, name: 'Silk Wraith', maxHp: 22, tier: 'normal', behaviors: [
      { kind: 'attack-multi', value: 3, count: 3, weight: 3, telegraph: '⚔ 3×3' },
      { kind: 'block',  value: 6, weight: 1, telegraph: '🛡 6' },
    ] },
  { id: 'e2-loom-familiar', act: 2, name: 'Loom Familiar', maxHp: 30, tier: 'normal', behaviors: [
      { kind: 'attack', value: 6, weight: 2, telegraph: '⚔ 6' },
      { kind: 'block',  value: 8, weight: 2, telegraph: '🛡 8' },
    ] },
  { id: 'e2-pattern-maker', act: 2, name: 'The Pattern-Maker', maxHp: 44, tier: 'elite', behaviors: [
      { kind: 'attack', value: 10, weight: 2, telegraph: '⚔ 10' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 1, telegraph: '⚔ 4×3' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
    ] },
  { id: 'e2-silent-spinner', act: 2, name: 'The Silent Spinner', maxHp: 50, tier: 'elite', behaviors: [
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12' },
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'weak',   value: 2, weight: 1, telegraph: '🌀 Weak 2' },
    ] },
  { id: 'e2-boss-tapestry', act: 2, name: 'The Tapestry Walker', maxHp: 80, tier: 'boss', behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, telegraph: '⚔ 4×4' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
      { kind: 'block',  value: 15, weight: 1, telegraph: '🛡 15' },
    ] },

  // ===== ACT 3 — The Stone Path =====
  { id: 'e3-geode-crab', act: 3, name: 'Geode Crab', maxHp: 36, tier: 'normal', behaviors: [
      { kind: 'attack', value: 9, weight: 2, telegraph: '⚔ 9' },
      { kind: 'block',  value: 12, weight: 2, telegraph: '🛡 12' },
    ] },
  { id: 'e3-glow-mite', act: 3, name: 'Glow Mite Swarm', maxHp: 26, tier: 'normal', behaviors: [
      { kind: 'attack-multi', value: 3, count: 4, weight: 3, telegraph: '⚔ 3×4' },
      { kind: 'weak',   value: 1, weight: 1, telegraph: '🌀 Weak 1' },
    ] },
  { id: 'e3-crystal-beetle', act: 3, name: 'Crystal Beetle', maxHp: 34, tier: 'normal', behaviors: [
      { kind: 'attack', value: 8, weight: 3, telegraph: '⚔ 8' },
      { kind: 'attack', value: 14, weight: 1, telegraph: '⚔ 14' },
    ] },
  { id: 'e3-quartz-sentinel', act: 3, name: 'Quartz Sentinel', maxHp: 56, tier: 'elite', behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12' },
      { kind: 'block',  value: 15, weight: 2, telegraph: '🛡 15' },
      { kind: 'attack-multi', value: 4, count: 3, weight: 1, telegraph: '⚔ 4×3' },
    ] },
  { id: 'e3-vein-devourer', act: 3, name: 'Vein Devourer', maxHp: 62, tier: 'elite', behaviors: [
      { kind: 'attack', value: 13, weight: 3, telegraph: '⚔ 13' },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1, telegraph: '⚔ 5×3' },
      { kind: 'vulnerable', value: 2, weight: 1, telegraph: '🌀 Vuln 2' },
    ] },
  { id: 'e3-boss-geode', act: 3, name: 'The Awakened Geode', maxHp: 100, tier: 'boss', behaviors: [
      { kind: 'attack', value: 13, weight: 2, telegraph: '⚔ 13' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4' },
      { kind: 'block',  value: 18, weight: 1, telegraph: '🛡 18' },
      { kind: 'vulnerable', value: 3, weight: 1, telegraph: '🌀 Vuln 3' },
    ] },

  // ===== ACT 4 — The Forge Path =====
  { id: 'e4-apprentice-shade', act: 4, name: "Apprentice's Shade", maxHp: 42, tier: 'normal', behaviors: [
      { kind: 'attack', value: 10, weight: 3, telegraph: '⚔ 10' },
      { kind: 'block',  value: 10, weight: 2, telegraph: '🛡 10' },
    ] },
  { id: 'e4-failed-initiate', act: 4, name: 'Failed Initiate', maxHp: 38, tier: 'normal', behaviors: [
      { kind: 'attack-multi', value: 4, count: 4, weight: 3, telegraph: '⚔ 4×4' },
      { kind: 'weak',   value: 2, weight: 1, telegraph: '🌀 Weak 2' },
    ] },
  { id: 'e4-mirror-past', act: 4, name: 'Mirror of the Past', maxHp: 44, tier: 'normal', behaviors: [
      { kind: 'attack', value: 12, weight: 2, telegraph: '⚔ 12' },
      { kind: 'vulnerable', value: 2, weight: 2, telegraph: '🌀 Vuln 2' },
      { kind: 'block',  value: 8, weight: 1, telegraph: '🛡 8' },
    ] },
  { id: 'e4-forgotten-master', act: 4, name: 'The Forgotten Master', maxHp: 70, tier: 'elite', behaviors: [
      { kind: 'attack', value: 15, weight: 2, telegraph: '⚔ 15' },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, telegraph: '⚔ 5×4' },
      { kind: 'block',  value: 16, weight: 1, telegraph: '🛡 16' },
    ] },
  { id: 'e4-test-wraith', act: 4, name: 'The Test Wraith', maxHp: 64, tier: 'elite', behaviors: [
      { kind: 'attack', value: 14, weight: 2, telegraph: '⚔ 14' },
      { kind: 'vulnerable', value: 3, weight: 1, telegraph: '🌀 Vuln 3' },
      { kind: 'weak',   value: 3, weight: 1, telegraph: '🌀 Weak 3' },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1, telegraph: '⚔ 4×4' },
    ] },
  { id: 'e4-boss-headmaster', act: 4, name: "The Headmaster's Shadow", maxHp: 130, tier: 'boss', behaviors: [
      { kind: 'attack', value: 16, weight: 2, telegraph: '⚔ 16' },
      { kind: 'attack-multi', value: 5, count: 5, weight: 2, telegraph: '⚔ 5×5' },
      { kind: 'block',  value: 20, weight: 1, telegraph: '🛡 20' },
      { kind: 'vulnerable', value: 3, weight: 1, telegraph: '🌀 Vuln 3' },
    ] },
];
const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// Equipment per slot with full tier ladders. `bonus` keys are read by the
// combat loop at appropriate hooks (start-of-combat, damage calc, etc.).
const EQUIPMENT = {
  staff: {
    basic:  { id: 'eq-staff-basic',  name: 'Apprentice Staff',  bonus: { strikeBonus: 1 }, desc: '+1 damage on Strike.' },
    fine:   { id: 'eq-staff-fine',   name: 'Journeyman Staff',  bonus: { strikeBonus: 2 }, desc: '+2 damage on Strike.' },
    master: { id: 'eq-staff-master', name: 'Master Staff',      bonus: { strikeBonus: 4 }, desc: '+4 damage on Strike.' },
  },
  robes: {
    basic:  { id: 'eq-robes-basic',  name: 'Apprentice Robes',  bonus: { startBlock: 3 }, desc: 'Gain 3 Block at the start of every combat.' },
    fine:   { id: 'eq-robes-fine',   name: 'Woven Robes',       bonus: { startBlock: 6 }, desc: 'Gain 6 Block at the start of every combat.' },
    master: { id: 'eq-robes-master', name: 'Master Robes',      bonus: { startBlock: 10 }, desc: 'Gain 10 Block at the start of every combat.' },
  },
  gem: {
    basic:  { id: 'eq-gem-basic',    name: 'Rough Gem',         bonus: { maxHp: 8 }, desc: '+8 max HP.' },
    fine:   { id: 'eq-gem-fine',     name: 'Cut Gem',           bonus: { maxHp: 15 }, desc: '+15 max HP.' },
    master: { id: 'eq-gem-master',   name: 'Master Gem',        bonus: { maxHp: 20, healOnCombatStart: 3 }, desc: '+20 max HP. Heal 3 HP at start of every combat.' },
  },
  ring: {
    basic:  { id: 'eq-ring-basic',   name: 'Apprentice Ring',   bonus: { extraStartHand: 1 }, desc: 'Draw 1 extra card on turn 1.' },
    fine:   { id: 'eq-ring-fine',    name: 'Journeyman Ring',   bonus: { energyOnCombatStart: 1 }, desc: '+1 Energy on turn 1 of every combat.' },
    master: { id: 'eq-ring-master',  name: 'Master Ring',       bonus: { permanentEnergyBonus: 1 }, desc: '+1 Energy every turn (permanent).' },
  },
};

// Events. `effects` keys handled by resolveEventChoice.
const EVENTS = [
  {
    id: 'ev-old-tome',
    title: 'An Old Tome',
    flavor: 'A leather-bound book sits open on a rock. The page reads: "BORROWED — return by the equinox."',
    choices: [
      { label: 'Read it. (gain a random Common card)', effects: { gainCommonCard: 1 } },
      { label: 'Tear the page out. (+4 HP, feel cool)', effects: { heal: 4 } },
      { label: 'Walk on by.', effects: {} },
    ],
  },
  {
    id: 'ev-spring',
    title: 'Quiet Spring',
    flavor: 'A small spring bubbles between two stones. The water is cold and clear.',
    choices: [
      { label: 'Drink deeply. (+8 HP)', effects: { heal: 8 } },
      { label: 'Fill a flask. (+4 HP, +1 max HP)', effects: { heal: 4, maxHp: 1 } },
      { label: 'Leave it for the next traveler.', effects: {} },
    ],
  },
  {
    id: 'ev-stranger',
    title: 'The Stranger',
    flavor: 'A figure in grey waits at a fork in the path. They offer a card from their satchel.',
    choices: [
      { label: 'Accept. (gain a random Uncommon card)', effects: { gainUncommonCard: 1 } },
      { label: 'Bargain. (-5 HP, gain a random Rare card)', effects: { loseHp: 5, gainRareCard: 1 } },
      { label: 'Refuse politely.', effects: {} },
    ],
  },
  {
    id: 'ev-shrine',
    title: 'Roadside Shrine',
    flavor: 'A weathered stone shrine to no god you recognize. A small bowl invites an offering.',
    choices: [
      { label: 'Pray sincerely. (heal 5)', effects: { heal: 5 } },
      { label: 'Curse it. (+2 max HP, -3 HP now)', effects: { maxHp: 2, loseHp: 3 } },
      { label: 'Ignore it.', effects: {} },
    ],
  },
  {
    id: 'ev-snake',
    title: 'Coiled Adder',
    flavor: 'A small green snake watches you pass. Its eyes are bright, deliberate.',
    choices: [
      { label: 'Pick it up. (-4 HP, gain a Rare card)', effects: { loseHp: 4, gainRareCard: 1 } },
      { label: 'Toss it food. (heal 3)', effects: { heal: 3 } },
      { label: 'Step around it.', effects: {} },
    ],
  },
  {
    id: 'ev-mirror',
    title: 'A Shard of Mirror',
    flavor: 'A piece of broken mirror, propped against a stump. You see yourself, harder around the eyes.',
    choices: [
      { label: 'Study it. (gain an Uncommon card)', effects: { gainUncommonCard: 1 } },
      { label: 'Break it further. (+5 max HP, -2 HP)', effects: { maxHp: 5, loseHp: 2 } },
      { label: 'Leave the shard.', effects: {} },
    ],
  },
  {
    id: 'ev-pilgrim',
    title: 'Pilgrim on the Path',
    flavor: 'An old pilgrim shares half a meal with you. "Eat," they say. "The path is longer than you think."',
    choices: [
      { label: 'Eat with gratitude. (+10 HP)', effects: { heal: 10 } },
      { label: 'Trade words instead. (gain a Common card)', effects: { gainCommonCard: 1 } },
      { label: 'Continue alone.', effects: {} },
    ],
  },
  {
    id: 'ev-vow',
    title: 'A Vow Offered',
    flavor: 'A stone altar carved with a single line: "STRENGTH FOR STILLNESS."',
    choices: [
      { label: 'Take the vow. (-6 HP, +1 max HP, gain a Rare card)', effects: { loseHp: 6, maxHp: 1, gainRareCard: 1 } },
      { label: 'Decline. (gain an Uncommon card)', effects: { gainUncommonCard: 1 } },
      { label: 'Walk away.', effects: {} },
    ],
  },
];

// Acts — each is one slot of equipment, with escalating difficulty.
const ACTS = [
  { id: 1, slot: 'staff', name: 'The Staff Path',
    flavor: 'You set out to claim your staff. The further you push, the better the wood.',
    rows: 7, width: 4,
    bossId: 'e1-boss-thornlord',
  },
  { id: 2, slot: 'robes', name: 'The Thread Path',
    flavor: 'Threads, looms, and the things that walk between them. The right robes find the right wearer.',
    rows: 8, width: 4,
    bossId: 'e2-boss-tapestry',
  },
  { id: 3, slot: 'gem',   name: 'The Stone Path',
    flavor: 'The deep places remember every footstep. The gem you carry out is the gem that wanted out.',
    rows: 8, width: 4,
    bossId: 'e3-boss-geode',
  },
  { id: 4, slot: 'ring',  name: 'The Forge Path',
    flavor: 'Your final ring waits beyond a mentor you have not yet met. The school will know if you return without it.',
    rows: 9, width: 4,
    bossId: 'e4-boss-headmaster',
  },
];

const SLOT_LABEL = { staff: 'Staff', robes: 'Robes', gem: 'Gem', ring: 'Ring' };

// =============================================================================
// 2. HELPERS
// =============================================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
let _uid = 0;
const uid = () => `u${++_uid}`;

function rollIntent(enemy) {
  const total = enemy.behaviors.reduce((s, b) => s + (b.weight || 1), 0);
  let roll = Math.random() * total;
  for (const b of enemy.behaviors) {
    roll -= (b.weight || 1);
    if (roll <= 0) return { ...b };
  }
  return { ...enemy.behaviors[0] };
}

function buildStartingDeck() {
  return shuffle(STARTER_DECK.map(id => ({ ...CARDS_BY_ID[id], uid: uid() })));
}

function pickCardByRarity(rarityWeights = { common: 4, uncommon: 1 }, exclude = []) {
  const pool = CARDS.filter(c => rarityWeights[c.rarity] && !exclude.includes(c.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((s, c) => s + rarityWeights[c.rarity], 0);
  let r = Math.random() * total;
  for (const c of pool) {
    r -= rarityWeights[c.rarity];
    if (r <= 0) return c;
  }
  return pool[0];
}

// STS-style branching DAG generator. See MVP2 commit message for full
// rationale; behavior unchanged. Forge tier names use the act's slot now.
function generateActMap(rows, width) {
  const nodes = [];
  const rng = Math.random;
  const startCount = 2 + Math.floor(rng() * 2);
  for (let c = 0; c < startCount; c++) {
    nodes.push({ id: `n-0-${c}`, row: 0, col: c, type: 'start',
      x: spacedX(c, startCount, width), y: rowY(0, rows) });
  }
  for (let r = 1; r < rows - 1; r++) {
    const w = 2 + Math.floor(rng() * 2);
    for (let c = 0; c < w; c++) {
      nodes.push({ id: `n-${r}-${c}`, row: r, col: c,
        type: pickNodeType(r, rows),
        x: spacedX(c, w, width), y: rowY(r, rows) });
    }
  }
  const bossRow = rows - 1;
  nodes.push({ id: `n-${bossRow}-0`, row: bossRow, col: 0, type: 'boss',
    x: spacedX(0, 1, width), y: rowY(bossRow, rows) });

  const byRow = {};
  for (const n of nodes) (byRow[n.row] = byRow[n.row] || []).push(n);
  const edges = {};
  for (let r = 0; r < rows - 1; r++) {
    const cur = byRow[r] || [];
    const next = byRow[r + 1] || [];
    for (const a of cur) {
      const sorted = [...next].sort((x, y) => Math.abs(x.col - a.col) - Math.abs(y.col - a.col));
      const links = sorted.slice(0, 1 + Math.floor(rng() * 2));
      edges[a.id] = links.map(n => n.id);
    }
  }
  for (let r = 1; r < rows; r++) {
    const cur = byRow[r] || [];
    for (const n of cur) {
      const hasIn = Object.values(edges).some(arr => arr.includes(n.id));
      if (!hasIn) {
        const prev = byRow[r - 1] || [];
        const closest = prev.sort((a, b) => Math.abs(a.col - n.col) - Math.abs(b.col - n.col))[0];
        if (closest) edges[closest.id] = [...(edges[closest.id] || []), n.id];
      }
    }
  }
  return { nodes, edges };

  function pickNodeType(r, rows) {
    // Two forge nodes per act: at rows/3 (basic) and 2*rows/3 (fine).
    if (r === Math.floor(rows / 3))       return 'forge-basic';
    if (r === Math.floor((2 * rows) / 3)) return 'forge-fine';
    const roll = rng();
    if (roll < 0.58) return 'combat';
    if (roll < 0.78) return 'event';
    if (roll < 0.92) return 'rest';
    return 'elite';
  }
  function spacedX(c, w, totalCols) {
    if (w === 1) return totalCols / 2;
    const pad = 0.5;
    return pad + (c * (totalCols - 1)) / (w - 1);
  }
  function rowY(r, totalRows) { return totalRows - 1 - r; }
}

// =============================================================================
// 3. App
// =============================================================================

const STARTING_MAX_HP = 70;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 5;
// Heal a fraction of max HP between acts (STS-style act transition heal).
const INTER_ACT_HEAL_RATIO = 0.25;

export default function App() {
  // Stage flow:
  //   menu → map → (combat / event / rest / forge / reward) → map →
  //   act-cleared → map (next act) → ... → graduation / defeat
  const [stage, setStage] = useState('menu');

  // Run-wide player state
  const [maxHp, setMaxHp] = useState(STARTING_MAX_HP);
  const [hp, setHp] = useState(STARTING_MAX_HP);
  const [block, setBlock] = useState(0);
  const [energy, setEnergy] = useState(ENERGY_PER_TURN);
  const [deck, setDeck] = useState([]);
  const [hand, setHand] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [exiled, setExiled] = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Act + map state
  const [currentActIdx, setCurrentActIdx] = useState(0);
  const [map, setMap] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [clearedNodes, setClearedNodes] = useState([]);

  // Combat state
  const [enemy, setEnemy] = useState(null);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyBlock, setEnemyBlock] = useState(0);
  const [enemyIntent, setEnemyIntent] = useState(null);
  const [enemyVulnerable, setEnemyVulnerable] = useState(0);
  const [enemyWeak, setEnemyWeak] = useState(0);

  // Reward / event / forge / rest state
  const [rewardChoices, setRewardChoices] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [forgeChoice, setForgeChoice] = useState(null);
  const [restNode, setRestNode] = useState(null);

  // Log
  const [log, setLog] = useState([]);
  const pushLog = (s) => setLog(prev => [...prev.slice(-20), s]);

  const currentAct = ACTS[currentActIdx];

  // Energy refill per turn — base + any permanentEnergyBonus equipment.
  const energyPerTurnRefill = () => {
    return ENERGY_PER_TURN + equipment.reduce((s, eq) => s + (eq.bonus?.permanentEnergyBonus || 0), 0);
  };

  // ---------- RUN LIFECYCLE ----------
  function startRun() {
    const startDeck = buildStartingDeck();
    setMaxHp(STARTING_MAX_HP);
    setHp(STARTING_MAX_HP);
    setBlock(0);
    setEnergy(ENERGY_PER_TURN);
    setDeck(startDeck);
    setHand([]);
    setDiscard([]);
    setExiled([]);
    setEquipment([]);
    setClearedNodes([]);
    setLog([]);
    setCurrentActIdx(0);
    setMap(generateActMap(ACTS[0].rows, ACTS[0].width));
    setCurrentNodeId(null);
    setStage('map');
    pushLog(`🌅 ${ACTS[0].name} begins.`);
  }

  function advanceToNextAct() {
    const nextIdx = currentActIdx + 1;
    if (nextIdx >= ACTS.length) {
      setStage('graduation');
      return;
    }
    // Heal a fraction of max HP between acts.
    const healAmount = Math.floor(maxHp * INTER_ACT_HEAL_RATIO);
    setHp(h => clamp(h + healAmount, 0, maxHp));
    pushLog(`🌄 Between acts: +${healAmount} HP.`);
    setCurrentActIdx(nextIdx);
    const nextAct = ACTS[nextIdx];
    setMap(generateActMap(nextAct.rows, nextAct.width));
    setCurrentNodeId(null);
    setClearedNodes([]);
    pushLog(`🌅 ${nextAct.name} begins.`);
    setStage('map');
  }

  // ---------- MAP NAVIGATION ----------
  function reachableFromCurrent() {
    if (!map) return [];
    if (!currentNodeId) return map.nodes.filter(n => n.row === 0).map(n => n.id);
    return map.edges[currentNodeId] || [];
  }

  function pickNode(nodeId) {
    const node = map.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!reachableFromCurrent().includes(nodeId)) {
      pushLog('That trail is not connected from here.');
      return;
    }
    setCurrentNodeId(nodeId);
    resolveNodeEnter(node);
  }

  function resolveNodeEnter(node) {
    if (node.type === 'start') {
      pushLog(`You set out at ${nodeLabel(node)}.`);
      return;
    }
    if (node.type === 'combat')        return enterFight(pickActEnemyId('normal'));
    if (node.type === 'elite')         return enterFight(pickActEnemyId('elite'));
    if (node.type === 'rest')          { setRestNode(node); setStage('rest'); return; }
    if (node.type === 'event')         {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      setActiveEvent(ev); setStage('event'); return;
    }
    if (node.type === 'forge-basic')   { setForgeChoice({ tier: 'basic' }); setStage('forge'); return; }
    if (node.type === 'forge-fine')    { setForgeChoice({ tier: 'fine' });  setStage('forge'); return; }
    if (node.type === 'boss')          return enterFight(currentAct.bossId);
  }

  function pickActEnemyId(tier) {
    const pool = ENEMIES.filter(e => e.act === currentAct.id && e.tier === tier);
    if (pool.length === 0) return ENEMIES[0].id; // fallback
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function markCurrentNodeCleared() {
    if (currentNodeId && !clearedNodes.includes(currentNodeId)) {
      setClearedNodes(prev => [...prev, currentNodeId]);
    }
  }

  function returnToMap() {
    markCurrentNodeCleared();
    setStage('map');
  }

  // ---------- COMBAT ----------
  function enterFight(enemyId) {
    const tmpl = ENEMIES_BY_ID[enemyId];
    if (!tmpl) return;
    const e = { ...tmpl };
    setEnemy(e);
    setEnemyHp(e.maxHp);
    setEnemyBlock(0);
    setEnemyVulnerable(0);
    setEnemyWeak(0);
    setEnemyIntent(rollIntent(e));

    // Apply start-of-combat equipment effects.
    let startBlockTotal = 0;
    let startEnergyBonus = 0;
    let startHandBonus = 0;
    let healOnStart = 0;
    for (const eq of equipment) {
      if (eq.bonus?.startBlock)          startBlockTotal      += eq.bonus.startBlock;
      if (eq.bonus?.energyOnCombatStart) startEnergyBonus     += eq.bonus.energyOnCombatStart;
      if (eq.bonus?.extraStartHand)      startHandBonus       += eq.bonus.extraStartHand;
      if (eq.bonus?.healOnCombatStart)   healOnStart          += eq.bonus.healOnCombatStart;
    }
    if (healOnStart > 0) {
      setHp(h => clamp(h + healOnStart, 0, maxHp));
      pushLog(`💚 ${healOnStart} HP (Gem).`);
    }
    setBlock(startBlockTotal);
    setEnergy(energyPerTurnRefill() + startEnergyBonus);

    const fullDeck = [...deck, ...hand, ...discard];
    const drawn = drawFromPiles(shuffle(fullDeck), [], HAND_SIZE + startHandBonus);
    setDeck(drawn.deck);
    setHand(drawn.hand);
    setDiscard([]);
    setStage('combat');
    pushLog(`⚔ ${e.name} (HP ${e.maxHp})${e.tier === 'elite' ? ' — elite' : e.tier === 'boss' ? ' — BOSS' : ''}`);
  }

  function drawFromPiles(deckIn, discardIn, n, handIn = []) {
    let deck = [...deckIn];
    let discard = [...discardIn];
    const hand = [...handIn];
    for (let i = 0; i < n; i++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = shuffle(discard); discard = [];
      }
      const c = deck.shift();
      hand.push({ ...c, uid: uid() });
    }
    return { deck, discard, hand };
  }

  function strikeBonusTotal() {
    return equipment.reduce((s, eq) => s + (eq.bonus?.strikeBonus || 0), 0);
  }

  function playCard(handIdx) {
    if (stage !== 'combat') return;
    const card = hand[handIdx];
    if (!card) return;
    if (card.cost > energy) { pushLog(`Not enough energy for ${card.name}.`); return; }
    const fx = card.effects || {};
    setEnergy(e => e - card.cost);
    const logBits = [card.name];

    if (fx.attack) {
      let base = fx.attack;
      if (card.name === 'Strike') base += strikeBonusTotal();
      const damage = computeAttackDamage(base);
      const after = applyDamageToEnemy(damage);
      logBits.push(`⚔ ${damage} → ${after} HP`);
    }
    if (fx.block) {
      setBlock(b => b + fx.block);
      logBits.push(`🛡 +${fx.block}`);
    }
    if (fx.vulnerable) {
      setEnemyVulnerable(v => v + fx.vulnerable);
      logBits.push(`🌀 +${fx.vulnerable} Vuln`);
    }
    if (fx.weak) {
      setEnemyWeak(w => w + fx.weak);
      logBits.push(`🌀 +${fx.weak} Weak`);
    }
    if (fx.energy) {
      setEnergy(e => e + fx.energy);
      logBits.push(`+${fx.energy} Energy`);
    }
    if (fx.draw) {
      drawCards(fx.draw);
      logBits.push(`+${fx.draw} draw`);
    }

    setHand(h => h.filter((_, i) => i !== handIdx));
    if (fx.exhaust) setExiled(ex => [...ex, card]);
    else setDiscard(d => [...d, card]);
    pushLog(logBits.join(' · '));
  }

  function drawCards(n) {
    setTimeout(() => {
      setDeck(d => {
        let deckNext = d;
        let discardNext = null;
        setDiscard(disc => {
          setHand(h => {
            const r = drawFromPiles(deckNext, disc, n, h);
            deckNext = r.deck;
            discardNext = r.discard;
            return r.hand;
          });
          return discardNext ?? disc;
        });
        return deckNext;
      });
    }, 0);
  }

  function computeAttackDamage(base) {
    let dmg = base;
    if (enemyVulnerable > 0) dmg = Math.ceil(dmg * 1.5);
    return dmg;
  }

  function applyDamageToEnemy(damage) {
    let remaining = damage;
    let newBlock = enemyBlock;
    let newHp = enemyHp;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed; remaining -= absorbed;
    }
    newHp = Math.max(0, newHp - remaining);
    setEnemyBlock(newBlock);
    setEnemyHp(newHp);
    if (newHp <= 0) setTimeout(() => onEnemyDefeated(), 200);
    return newHp;
  }

  function endTurn() {
    if (stage !== 'combat') return;
    if (enemyIntent) applyEnemyIntent(enemyIntent);
    if (hp <= 0) return;
    setEnemyVulnerable(v => Math.max(0, v - 1));
    setEnemyWeak(w => Math.max(0, w - 1));
    setDiscard(d => [...d, ...hand]);
    setHand([]);
    setBlock(0);
    setEnergy(energyPerTurnRefill());
    setTimeout(() => {
      setDeck(d => {
        let result;
        setDiscard(disc => {
          result = drawFromPiles(d, disc, HAND_SIZE);
          return result.discard;
        });
        setHand(result.hand);
        return result.deck;
      });
    }, 0);
    if (enemy) setEnemyIntent(rollIntent(enemy));
  }

  function applyEnemyIntent(intent) {
    const e = enemy;
    if (!e) return;
    if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
      const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
      let raw = intent.value;
      if (enemyWeak > 0) raw = Math.floor(raw * 0.75);
      for (let i = 0; i < hits; i++) applyDamageToPlayer(raw);
      pushLog(`👹 ${e.name}: ${intent.telegraph} → ${raw * hits} raw`);
    } else if (intent.kind === 'block') {
      setEnemyBlock(b => b + intent.value);
      pushLog(`👹 ${e.name}: 🛡 +${intent.value}`);
    } else if (intent.kind === 'vulnerable' || intent.kind === 'weak') {
      // Player-debuffs not yet implemented; flavored log only.
      pushLog(`👹 ${e.name}: ${intent.telegraph}`);
    }
  }

  function applyDamageToPlayer(damage) {
    let remaining = damage;
    let newBlock = block;
    let newHp = hp;
    if (newBlock > 0) {
      const absorbed = Math.min(newBlock, remaining);
      newBlock -= absorbed; remaining -= absorbed;
    }
    newHp = Math.max(0, newHp - remaining);
    setBlock(newBlock); setHp(newHp);
    if (newHp <= 0) setTimeout(() => setStage('defeat'), 200);
  }

  function onEnemyDefeated() {
    if (!enemy) return;
    pushLog(`✓ ${enemy.name} defeated.`);
    const isBoss = enemy.tier === 'boss';
    if (isBoss) {
      // Boss kill → grant Master tier for this act's slot.
      const slot = currentAct.slot;
      const master = EQUIPMENT[slot]?.master;
      if (master && !equipment.find(eq => eq.id === master.id)) {
        const next = [...equipment, master];
        setEquipment(next);
        applyEquipmentMaxHp(master);
        pushLog(`👑 Master ${SLOT_LABEL[slot]} claimed: ${master.name}.`);
      }
      setDeck(d => [...d, ...hand, ...discard, ...exiled]);
      setHand([]); setDiscard([]); setExiled([]);
      setStage('act-cleared');
      return;
    }
    const weights = enemy.tier === 'elite'
      ? { common: 2, uncommon: 3, rare: 1 }
      : { common: 4, uncommon: 1 };
    const choices = [];
    const used = [];
    while (choices.length < 3) {
      const pick = pickCardByRarity(weights, used);
      if (!pick) break;
      choices.push(pick); used.push(pick.id);
    }
    setRewardChoices(choices);
    setStage('reward');
  }

  function applyEquipmentMaxHp(eq) {
    if (eq.bonus?.maxHp) {
      setMaxHp(m => m + eq.bonus.maxHp);
      setHp(h => h + eq.bonus.maxHp);
    }
  }

  function pickReward(cardOrSkip) {
    if (cardOrSkip) {
      setDeck(d => [...d, ...hand, ...discard, ...exiled, { ...cardOrSkip, uid: uid() }]);
      pushLog(`+ ${cardOrSkip.name} added to deck.`);
    } else {
      setDeck(d => [...d, ...hand, ...discard, ...exiled]);
      pushLog(`Skipped reward.`);
    }
    setHand([]); setDiscard([]); setExiled([]);
    setRewardChoices([]);
    returnToMap();
  }

  // ---------- EVENT / REST / FORGE ----------
  function resolveEventChoice(choice) {
    const fx = choice.effects || {};
    const logBits = [`📜 ${activeEvent.title}: ${choice.label}`];
    if (fx.heal) {
      setHp(h => clamp(h + fx.heal, 0, maxHp));
      logBits.push(`+${fx.heal} HP`);
    }
    if (fx.loseHp) {
      setHp(h => clamp(h - fx.loseHp, 0, maxHp));
      logBits.push(`-${fx.loseHp} HP`);
    }
    if (fx.maxHp) {
      setMaxHp(m => m + fx.maxHp);
      setHp(h => h + fx.maxHp);
      logBits.push(`+${fx.maxHp} max HP`);
    }
    if (fx.gainCommonCard) {
      const c = pickCardByRarity({ common: 1 });
      if (c) { setDeck(d => [...d, { ...c, uid: uid() }]); logBits.push(`+ ${c.name}`); }
    }
    if (fx.gainUncommonCard) {
      const c = pickCardByRarity({ uncommon: 1 });
      if (c) { setDeck(d => [...d, { ...c, uid: uid() }]); logBits.push(`+ ${c.name}`); }
    }
    if (fx.gainRareCard) {
      const c = pickCardByRarity({ rare: 1 });
      if (c) { setDeck(d => [...d, { ...c, uid: uid() }]); logBits.push(`+ ${c.name}`); }
    }
    pushLog(logBits.join(' · '));
    setActiveEvent(null);
    returnToMap();
  }

  function resolveRestChoice(kind) {
    if (kind === 'heal') {
      const amount = Math.floor(maxHp * 0.3);
      setHp(h => clamp(h + amount, 0, maxHp));
      pushLog(`🛏 Rest: +${amount} HP.`);
    } else if (kind === 'reflect') {
      setMaxHp(m => m + 3);
      setHp(h => h + 3);
      pushLog(`🛏 Reflect: +3 max HP.`);
    }
    setRestNode(null);
    returnToMap();
  }

  function claimForge(accept) {
    if (accept && forgeChoice) {
      const slot = currentAct.slot;
      const piece = EQUIPMENT[slot]?.[forgeChoice.tier];
      if (piece) {
        const alreadyHasSlot = equipment.find(eq => eq.id.startsWith(`eq-${slot}-`));
        if (!alreadyHasSlot) {
          const next = [...equipment, piece];
          setEquipment(next);
          applyEquipmentMaxHp(piece);
          pushLog(`🛠 Forged: ${piece.name}.`);
        }
      }
    } else {
      pushLog(`Passed on the forge — pushing deeper.`);
    }
    setForgeChoice(null);
    returnToMap();
  }

  // ---------- RENDER ----------
  if (stage === 'menu')       return <MenuScreen onStart={startRun} />;
  if (stage === 'defeat')     return <EndScreen win={false} onRetry={startRun} />;
  if (stage === 'graduation') return <GraduationScreen equipment={equipment} onRetry={startRun} />;

  if (stage === 'act-cleared') {
    return <ActClearedScreen act={currentAct} equipment={equipment}
      isFinalAct={currentActIdx === ACTS.length - 1}
      onContinue={() => {
        if (currentActIdx === ACTS.length - 1) setStage('graduation');
        else advanceToNextAct();
      }} />;
  }
  if (stage === 'reward') return <RewardScreen choices={rewardChoices} onPick={pickReward} />;
  if (stage === 'event')  return <EventScreen event={activeEvent} onChoose={resolveEventChoice} />;
  if (stage === 'rest')   return <RestScreen onChoose={resolveRestChoice} />;
  if (stage === 'forge')  {
    const slot = currentAct.slot;
    const piece = EQUIPMENT[slot]?.[forgeChoice?.tier];
    return <ForgeScreen
      tier={forgeChoice?.tier} slot={slot} piece={piece}
      alreadyHas={!!equipment.find(eq => eq.id.startsWith(`eq-${slot}-`))}
      onChoose={claimForge} />;
  }
  if (stage === 'map') {
    return <MapScreen
      map={map} act={currentAct} actIdx={currentActIdx} totalActs={ACTS.length}
      currentNodeId={currentNodeId} clearedNodes={clearedNodes}
      reachable={reachableFromCurrent()}
      player={{ hp, maxHp, equipment, deckSize: deck.length }}
      onPick={pickNode} log={log} />;
  }

  // Combat
  return <CombatScreen
    enemy={enemy} enemyHp={enemyHp} enemyBlock={enemyBlock} enemyIntent={enemyIntent}
    enemyVulnerable={enemyVulnerable} enemyWeak={enemyWeak}
    hp={hp} maxHp={maxHp} block={block} energy={energy} hand={hand}
    deck={deck} discard={discard}
    energyMax={energyPerTurnRefill()}
    equipment={equipment}
    onPlayCard={playCard} onEndTurn={endTurn}
    log={log}
  />;
}

// =============================================================================
// 4. SUB-SCREENS
// =============================================================================

function MenuScreen({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="font-display text-6xl text-gold-300 tracking-widest text-center">Wizard Graduation</h1>
      <p className="font-quill text-parchment-200 italic max-w-xl text-center">
        The school has taught you what it can. To graduate, you must walk the
        Path of Mastery — gather your staff, robes, gem, and ring, each from
        a trial worthier than the last.
      </p>
      <button onClick={onStart} className="btn btn-gold text-lg px-8 py-3">Begin the Path</button>
      <p className="text-xs text-parchment-400">MVP 3 — 4 acts, escalating difficulty, full equipment ladder.</p>
    </div>
  );
}

function MapScreen({ map, act, actIdx, totalActs, currentNodeId, clearedNodes, reachable, player, onPick, log }) {
  if (!map || !act) return null;
  const W = 600, H = 480, padding = 40;
  const rows = act.rows;
  const cols = act.width;
  const xScale = (x) => padding + (x * (W - 2 * padding)) / cols;
  const yScale = (y) => padding + (y * (H - 2 * padding)) / (rows - 1);

  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      <div className="flex justify-between items-center parchment-card px-4 py-2">
        <div>
          <h1 className="font-display text-xl text-gold-300">{act.name}</h1>
          <div className="text-[10px] uppercase text-parchment-400 tracking-widest">Act {actIdx + 1} of {totalActs} · prize: master {SLOT_LABEL[act.slot]}</div>
        </div>
        <div className="text-xs flex gap-4">
          <span>❤️ {player.hp} / {player.maxHp}</span>
          <span>📜 {player.deckSize} cards</span>
          <span>⚜ {player.equipment.length} equipment</span>
        </div>
      </div>

      <div className="parchment-card p-4 flex flex-col items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl">
          {Object.entries(map.edges).map(([fromId, tos]) => {
            const from = map.nodes.find(n => n.id === fromId);
            return tos.map(toId => {
              const to = map.nodes.find(n => n.id === toId);
              if (!from || !to) return null;
              const cleared = clearedNodes.includes(fromId) && clearedNodes.includes(toId);
              const onCurrentPath = currentNodeId === fromId;
              return (
                <line key={`${fromId}->${toId}`}
                  x1={xScale(from.x)} y1={yScale(from.y)}
                  x2={xScale(to.x)} y2={yScale(to.y)}
                  stroke={cleared ? '#5d7e3f' : onCurrentPath ? '#c79d44' : '#3d3325'}
                  strokeWidth={onCurrentPath ? 3 : 1.5}
                  strokeDasharray={cleared ? '6,3' : '0'} />
              );
            });
          })}
          {map.nodes.map(n => {
            const isCurrent = n.id === currentNodeId;
            const isCleared = clearedNodes.includes(n.id);
            const isReachable = reachable.includes(n.id);
            const fill = nodeColor(n.type, isCleared, isCurrent);
            const stroke = isReachable ? '#dbb45f' : isCurrent ? '#c79d44' : '#5a4d3a';
            const strokeWidth = isReachable ? 3 : isCurrent ? 2.5 : 1.5;
            return (
              <g key={n.id}
                style={{ cursor: isReachable ? 'pointer' : 'default' }}
                onClick={() => isReachable && onPick(n.id)}>
                <circle cx={xScale(n.x)} cy={yScale(n.y)} r={n.type === 'boss' ? 26 : 18}
                  fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                  opacity={isCleared ? 0.55 : 1} />
                <text x={xScale(n.x)} y={yScale(n.y) + 5} textAnchor="middle"
                  className="select-none" fill="#f7eed3"
                  fontSize={n.type === 'boss' ? 18 : 14}>
                  {nodeGlyph(n.type)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-3 text-xs text-parchment-300 flex gap-3 flex-wrap justify-center">
          <Legend glyph="⚔" label="Combat" />
          <Legend glyph="☠" label="Elite" />
          <Legend glyph="🛏" label="Rest" />
          <Legend glyph="📜" label="Event" />
          <Legend glyph="🛠" label="Forge" />
          <Legend glyph="👑" label="Boss" />
          <Legend glyph="·" label="Start" />
        </div>
        {!currentNodeId && (
          <div className="mt-2 text-sm text-gold-300 italic">Pick a starting trail.</div>
        )}
      </div>

      {player.equipment.length > 0 && (
        <div className="parchment-card p-3 text-xs flex gap-3 flex-wrap">
          <span className="uppercase text-parchment-300">Equipment:</span>
          {player.equipment.map(eq => (
            <span key={eq.id} className="text-gold-300">⚜ {eq.name}</span>
          ))}
        </div>
      )}

      <div className="parchment-card p-3 max-h-32 overflow-y-auto text-xs font-quill text-parchment-200 space-y-0.5">
        {log.slice(-10).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}
function nodeColor(type, isCleared, isCurrent) {
  if (isCurrent) return '#c79d44';
  if (isCleared) return '#2f481e';
  if (type === 'boss') return '#7b1f15';
  if (type === 'elite') return '#a8412f';
  if (type === 'rest') return '#43622c';
  if (type === 'event') return '#523a8b';
  if (type === 'forge-basic' || type === 'forge-fine') return '#a98032';
  if (type === 'start') return '#3d3325';
  return '#2b2418';
}
function nodeGlyph(type) {
  return {
    combat: '⚔', elite: '☠', rest: '🛏', event: '📜',
    boss: '👑', start: '·', 'forge-basic': '🛠', 'forge-fine': '🛠',
  }[type] || '?';
}
function nodeLabel(n) {
  return ({
    combat: 'a combat tile', elite: 'an elite tile', rest: 'a rest tile',
    event: 'an event', start: 'the trailhead',
    'forge-basic': 'the forge', 'forge-fine': 'the deeper forge', boss: 'the boss'
  }[n.type]) || 'a tile';
}
function Legend({ glyph, label }) {
  return <span><span className="mr-1">{glyph}</span>{label}</span>;
}

function CombatScreen({ enemy, enemyHp, enemyBlock, enemyIntent, enemyVulnerable, enemyWeak,
                       hp, maxHp, block, energy, energyMax, hand, deck, discard,
                       equipment, onPlayCard, onEndTurn, log }) {
  return (
    <div className="min-h-screen flex flex-col p-4 gap-3 max-w-6xl mx-auto">
      <div className="parchment-card-strong p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-display text-2xl text-ember-300">{enemy?.name}</div>
            <div className="text-xs text-parchment-300 italic">
              {enemy?.tier === 'boss' ? 'Boss' : enemy?.tier === 'elite' ? 'Elite' : 'Enemy'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono text-ember-400">{enemyHp} <span className="text-sm text-parchment-300">/ {enemy?.maxHp}</span></div>
            <div className="text-sm">🛡 {enemyBlock}</div>
          </div>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="px-3 py-2 bg-ember-900 bg-opacity-60 rounded border border-ember-700">
            <div className="text-[10px] uppercase text-ember-300 tracking-widest">Intent</div>
            <div className="text-lg text-parchment-50">{enemyIntent?.telegraph || '...'}</div>
          </div>
          {enemyVulnerable > 0 && <span className="px-2 py-1 bg-iris-700 text-parchment-50 rounded text-xs">🌀 Vuln {enemyVulnerable}</span>}
          {enemyWeak > 0 && <span className="px-2 py-1 bg-iris-700 text-parchment-50 rounded text-xs">🌀 Weak {enemyWeak}</span>}
        </div>
      </div>

      <div className="parchment-card p-3 flex justify-between items-center">
        <div className="flex gap-4 items-center flex-wrap">
          <div>
            <div className="text-[10px] uppercase text-parchment-300">HP</div>
            <div className="text-xl font-mono text-moss-300">{hp} <span className="text-xs text-parchment-300">/ {maxHp}</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-parchment-300">Block</div>
            <div className="text-xl font-mono text-iris-300">🛡 {block}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-parchment-300">Energy</div>
            <div className="text-xl font-mono text-gold-300">⚡ {energy} / {energyMax}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-parchment-300">Deck</div>
            <div className="text-sm font-mono text-parchment-200">{deck.length} ▸ {discard.length}</div>
          </div>
          {equipment.length > 0 && (
            <div className="text-[10px] flex gap-2 flex-wrap ml-2">
              {equipment.map(eq => (
                <span key={eq.id} className="text-gold-300" title={eq.desc}>⚜ {eq.name}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={onEndTurn} className="btn btn-ember">End Turn</button>
      </div>

      <div className="flex gap-2 flex-wrap min-h-[160px] items-center justify-center">
        {hand.map((card, i) => {
          const playable = card.cost <= energy;
          return (
            <motion.button key={card.uid}
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={() => onPlayCard(i)} disabled={!playable}
              className={`w-36 h-48 rounded-lg border-2 p-2 text-left flex flex-col gap-1 shadow-lg transition-all ${
                playable
                  ? 'bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl cursor-pointer'
                  : 'bg-ink-600 text-parchment-400 border-ink-500 opacity-50 cursor-not-allowed'
              }`}>
              <div className="flex justify-between items-center">
                <div className="font-display text-sm">{card.name}</div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm ${playable ? 'bg-gold-500 text-ink-800' : 'bg-ink-500 text-parchment-300'}`}>
                  {card.cost}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">{card.type}</div>
              <div className="text-xs flex-1 font-quill">{card.desc}</div>
              {card.effects?.exhaust && <div className="text-[10px] italic text-ember-700">Exhaust</div>}
            </motion.button>
          );
        })}
      </div>

      <div className="parchment-card p-3 max-h-32 overflow-y-auto text-xs font-quill text-parchment-200 space-y-0.5">
        {log.slice(-10).map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

function RewardScreen({ choices, onPick }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-3xl mx-auto">
      <h2 className="font-display text-3xl text-gold-300">Card Reward</h2>
      <p className="text-sm text-parchment-300 italic">Choose one to add to your deck — or skip.</p>
      <div className="flex gap-4 flex-wrap justify-center">
        {choices.map((card, i) => (
          <button key={i} onClick={() => onPick(card)}
            className="w-44 h-60 rounded-lg border-2 p-3 text-left flex flex-col gap-2 shadow-lg bg-parchment-50 text-ink-800 border-gold-500 hover:scale-105 hover:shadow-2xl transition">
            <div className="flex justify-between items-center">
              <div className="font-display text-base">{card.name}</div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold bg-gold-500 text-ink-800">{card.cost}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">{card.type} · {card.rarity}</div>
            <div className="text-xs flex-1 font-quill">{card.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={() => onPick(null)} className="btn btn-ink mt-4">Skip</button>
    </div>
  );
}

function EventScreen({ event, onChoose }) {
  if (!event) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto">
      <h2 className="font-display text-3xl text-iris-300">{event.title}</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">"{event.flavor}"</p>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {event.choices.map((c, i) => (
          <button key={i} onClick={() => onChoose(c)}
            className="btn bg-ink-600 hover:bg-ink-500 text-parchment-100 text-left">{c.label}</button>
        ))}
      </div>
    </div>
  );
}

function RestScreen({ onChoose }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-3xl text-moss-300">A Rest Site</h2>
      <p className="font-quill italic text-parchment-200 text-center">A small campfire, a flat rock. The path will still be there in the morning.</p>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={() => onChoose('heal')} className="btn btn-moss">Sleep — heal 30% max HP</button>
        <button onClick={() => onChoose('reflect')} className="btn btn-iris">Reflect — +3 max HP (permanent this run)</button>
      </div>
    </div>
  );
}

function ForgeScreen({ tier, slot, piece, alreadyHas, onChoose }) {
  if (!piece) return null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto">
      <h2 className="font-display text-3xl text-gold-300">A Roadside Forge</h2>
      <p className="font-quill italic text-parchment-200 text-center">
        Fires already kindled. You could claim a {tier} {SLOT_LABEL[slot]} here — or push deeper for better.
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="font-display text-xl text-gold-300">{piece.name}</div>
        <div className="text-xs uppercase text-parchment-300">{tier} {SLOT_LABEL[slot]}</div>
        <div className="text-sm mt-2">{piece.desc}</div>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={() => onChoose(true)} disabled={alreadyHas}
          className={`btn ${alreadyHas ? 'btn-ink opacity-60 cursor-not-allowed' : 'btn-gold'}`}>
          {alreadyHas ? `You already wield a ${SLOT_LABEL[slot]}` : `Forge the ${piece.name}`}
        </button>
        <button onClick={() => onChoose(false)} className="btn btn-ink">
          Push deeper (skip this forge)
        </button>
      </div>
    </div>
  );
}

function ActClearedScreen({ act, equipment, isFinalAct, onContinue }) {
  const claimed = equipment[equipment.length - 1];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-xl mx-auto">
      <h2 className="font-display text-5xl text-moss-300">{act.name} — Cleared</h2>
      <p className="font-quill italic text-parchment-300 text-center">
        {act.flavor}
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="text-xs uppercase text-parchment-300 mb-1">Equipment earned this act</div>
        <div className="text-gold-300 font-display text-lg">⚜ {claimed?.name}</div>
        <div className="text-sm font-quill text-parchment-200">{claimed?.desc}</div>
      </div>
      <button onClick={onContinue} className="btn btn-gold text-lg px-8 py-3">
        {isFinalAct ? 'See your Graduation' : `Continue to ${ACTS[ACTS.findIndex(a => a.id === act.id) + 1]?.name || 'the next path'}`}
      </button>
    </div>
  );
}

function GraduationScreen({ equipment, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto">
      <h2 className="font-display text-6xl text-gold-300 tracking-widest text-center">Graduation Achieved</h2>
      <p className="font-quill italic text-parchment-200 text-center max-w-xl">
        You return to the school, hands full of trophies. The robes settle on
        your shoulders. The staff knows your weight. The gem warms in your
        pocket. The ring sits cold against your knuckle. You have graduated.
      </p>
      <div className="parchment-card-strong p-4 w-full">
        <div className="text-xs uppercase text-parchment-300 mb-2 tracking-widest">Final Loadout</div>
        <ul className="text-sm font-quill space-y-1">
          {equipment.map(eq => (
            <li key={eq.id}>
              <span className="text-gold-300">⚜ {eq.name}</span>
              <span className="text-parchment-300 ml-2">— {eq.desc}</span>
            </li>
          ))}
        </ul>
      </div>
      <button onClick={onRetry} className="btn btn-gold text-lg px-8 py-3">Walk the Path Again</button>
    </div>
  );
}

function EndScreen({ win, onRetry }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h2 className={`font-display text-5xl ${win ? 'text-moss-300' : 'text-ember-400'}`}>
        {win ? 'Graduation Achieved' : 'The Path Ends Here'}
      </h2>
      <p className="font-quill italic text-parchment-300 max-w-xl text-center">
        {win ? 'You return to the school, hands full of trophies.' : 'Your story ends in failure — for now. The school will receive another apprentice tomorrow.'}
      </p>
      <button onClick={onRetry} className="btn btn-gold text-lg px-8 py-3">
        {win ? 'Walk the Path Again' : 'Try Again'}
      </button>
    </div>
  );
}
