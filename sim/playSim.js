// Wizard Graduation — playtest simulator.
//
// Runs N full-run playthroughs end-to-end with a greedy AI, then writes
// sim/report.md with aggregate balance stats. Data tables here mirror
// src/App.jsx — keep them in sync when balance numbers change. (Future
// refactor: extract data to src/data.js so both share one source.)
//
// Usage:  node sim/playSim.js [N]      (defaults to 50)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// 1. DATA — mirrored from src/App.jsx. Only the data the sim actually reads.
// =============================================================================

// --- CARDS ---
const CARDS = [
  // ---- WORD CARDS (basic / starter) ----
  { id: 'w-respect', name: 'With all due respect,', cost: 0, type: 'word', rarity: 'basic',
    stats: { wit: 1 }, tags: ['formal', 'sarcastic'] },
  { id: 'w-frankly', name: 'Frankly,', cost: 0, type: 'word', rarity: 'basic',
    stats: { chutzpah: 1 }, tags: ['dismissive', 'sarcastic'] },
  { id: 'w-erm', name: 'Erm…', cost: 0, type: 'word', rarity: 'basic',
    stats: { jnsq: 1 }, tags: ['chaotic'] },
  // ---- WORD COMMON ----
  { id: 'w-actually', name: 'Actually,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 1, chutzpah: 1 }, tags: ['sarcastic', 'dismissive'] },
  { id: 'w-look-here', name: 'Look here,', cost: 0, type: 'word', rarity: 'common',
    stats: { chutzpah: 2 }, tags: ['booming', 'threatening'] },
  { id: 'w-suppose', name: 'Suppose, hypothetically,', cost: 1, type: 'word', rarity: 'common',
    stats: { wit: 3 }, tags: ['academic', 'rhetorical'] },
  { id: 'w-mutters', name: 'Mutters dark Latin', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 2 }, tags: ['mystical', 'chaotic'] },
  { id: 'w-stares', name: 'Stares', cost: 0, type: 'word', rarity: 'common',
    stats: { chutzpah: 1, jnsq: 1 }, tags: ['threatening', 'theatrical'] },
  { id: 'w-footnote', name: 'A Lengthy Footnote', cost: 1, type: 'word', rarity: 'common',
    stats: { wit: 2, jnsq: 1 }, tags: ['academic', 'rhetorical'] },
  // ---- WORD UNCOMMON ----
  { id: 'w-rhetorical', name: 'A Rhetorical Question', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { wit: 4 }, tags: ['rhetorical', 'academic'] },
  { id: 'w-thundering', name: 'Thundering Aside', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { chutzpah: 4 }, tags: ['booming', 'formal'] },
  { id: 'w-non-sequitur', name: 'Non Sequitur', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { jnsq: 4 }, tags: ['absurd', 'chaotic'] },
  { id: 'w-dramatic-pause', name: 'Dramatic Pause', cost: 0, type: 'word', rarity: 'uncommon',
    stats: { chutzpah: 1, wit: 1, jnsq: 1 }, tags: ['theatrical', 'mystical'],
    effects: { draw: 1 } },
  { id: 'w-corner-them', name: 'Corner Them', cost: 0, type: 'word', rarity: 'common',
    stats: { chutzpah: 3 }, tags: ['threatening', 'dismissive'],
    effects: { loseHp: 2 } },

  // ---- EFFECT CARDS (basic / starter) ----
  { id: 'e-persuade', name: 'Persuade', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'wit', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic', 'formal'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-bluster', name: 'Bluster', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'chutzpah', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['booming', 'threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-bewilder', name: 'Bewilder', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'jnsq', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical', 'chaotic'], resonanceBonus: { perTag: 2 } } },
  // ---- EFFECT COMMON ----
  { id: 'e-convince', name: 'Convince', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-intimidate', name: 'Intimidate', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'chutzpah', base: 4, multiplier: 2, damageType: 'composure',
              rider: { weak: 1 }, resonatesWith: ['threatening', 'booming'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-misdirect', name: 'Misdirect', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure',
              rider: { vulnerable: 1 }, resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-strike', name: 'Strike', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'chutzpah', base: 6, multiplier: 1, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
  // ---- EFFECT UNCOMMON ----
  { id: 'e-refute', name: 'Refute', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-cutting-remark', name: 'A Cutting Remark', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-bamboozle', name: 'Bamboozle', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 2 } } },
  // ---- PHYSICAL EFFECTS ----
  { id: 'e-spark', name: 'Spark', cost: 0, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 1, damageType: 'physical',
              resonatesWith: ['chaotic'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-magic-missile', name: 'Magic Missile', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 11, multiplier: 3, damageType: 'physical',
              resonatesWith: ['mystical'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-sword-logic', name: 'Sword Logic', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'chutzpah', base: 5, multiplier: 2, damageType: 'physical',
              resonatesWith: ['threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
  // ---- EFFECT RARE ----
  { id: 'e-devastating', name: 'Devastating Truth', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'wit', base: 12, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 3 } } },
  { id: 'e-coup-de-grace', name: 'Coup de Grâce', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'chutzpah', base: 14, multiplier: 3, damageType: 'composure', exhaust: true,
              resonatesWith: ['dismissive', 'formal'], resonanceBonus: { perTag: 3 } } },
  { id: 'e-paradox', name: 'A Functional Paradox', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'jnsq', base: 6, multiplier: 4, damageType: 'composure',
              rider: { vulnerable: 2 }, resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 3 } } },
  // ---- ARCHETYPE-COMMITTING CARDS (cycle 4) ----
  { id: 'e-go-for-the-throat', name: 'Go For The Throat', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'chutzpah', base: 8, multiplier: 3, damageType: 'composure',
              loseHpOnPlay: 3,
              resonatesWith: ['threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-cantrip-roulette', name: 'Cantrip Roulette', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 6, multiplier: 2, damageType: 'composure',
              chance: { prob: 0.7, success: { enemyVulnerable: 2 }, failure: { selfWeak: 1 } },
              resonatesWith: ['absurd', 'chaotic'], resonanceBonus: { perTag: 2 } } },

  // ---- SWAY / INSULT EFFECTS — present in App; sim castSpell treats
  //      them as no-op damage so the AI doesn't crash on them. Sway/Insult
  //      mechanics aren't modeled in sim (would need softSpot + word-pool
  //      handling) but at least the card pool no longer drifts.
  { id: 'e-lavish-praise',   name: 'Lavish Praise',   cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { sway: true, swayTarget: 'wit', tactic: 'flattery',
              tacticTags: ['formal', 'academic'],
              resonatesWith: ['formal', 'rhetorical'], resonanceBonus: { perTag: 1 } } },
  { id: 'e-calmly-explain',  name: 'Calmly Explain',  cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { sway: true, swayTarget: 'chutzpah', tactic: 'logic',
              tacticTags: ['rhetorical', 'academic'],
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 1 } } },
  { id: 'e-loom-over-them',  name: 'Loom Over Them',  cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { sway: true, swayTarget: 'physical', tactic: 'threat',
              tacticTags: ['booming', 'threatening'],
              resonatesWith: ['booming', 'threatening'], resonanceBonus: { perTag: 1 } } },
  { id: 'e-mention-the-moon', name: 'Mention the Moon', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { sway: true, swayTarget: 'jnsq', tactic: 'confusion',
              tacticTags: ['chaotic', 'absurd', 'mystical'],
              resonatesWith: ['absurd', 'chaotic'], resonanceBonus: { perTag: 1 } } },
  { id: 'e-cut-them-down',   name: 'Cut Them Down',   cost: 1, type: 'effect', rarity: 'common',
    effect: { insult: true, playerComposureCost: 3, landDamage: 10, backfireDamage: 5 } },
  { id: 'e-devastate',       name: 'Devastate',       cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { insult: true, playerComposureCost: 5, landDamage: 18, backfireDamage: 9 } },

  // ---- SKILL CARDS ----
  { id: 'c-defend', name: 'Defend', cost: 1, type: 'skill', rarity: 'basic',
    effects: { block: 5 } },
  { id: 'c-mend', name: 'Mend', cost: 1, type: 'skill', rarity: 'common',
    effects: { block: 7 } },
  { id: 'c-acuity', name: 'Acuity', cost: 1, type: 'skill', rarity: 'common',
    effects: { draw: 2 } },
  { id: 'c-channel', name: 'Channel', cost: 0, type: 'skill', rarity: 'common',
    effects: { draw: 1, energy: 1, exhaust: true } },
  { id: 'c-bulwark', name: 'Bulwark', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 10 } },
  { id: 'c-meditate', name: 'Meditate', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { energy: 1, draw: 1, exhaust: true } },
  { id: 'c-warding', name: 'Warding Glyph', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { block: 4, vulnerable: 1 } },
  { id: 'c-clarity', name: 'Clarity', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { draw: 3, exhaust: true } },
  { id: 'c-aegis', name: 'Aegis', cost: 2, type: 'skill', rarity: 'rare',
    effects: { block: 16 } },
  { id: 'c-sap', name: 'Sap', cost: 1, type: 'skill', rarity: 'common',
    effects: { enemyDmgMod: -0.25 } },
  // Amplify: cost escalates by +1 per prior play this combat. See
  // effectiveCardCost() — counter lives on combat.amplifyPlays.
  { id: 'c-amplify', name: 'Amplify', cost: 1, type: 'skill', rarity: 'common',
    effects: { playerDmgMod: +0.25 } },
  { id: 'c-dispel', name: 'Dispel', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { enemyDmgMod: -0.25, playerDmgMod: +0.25, exhaust: true } },

  // ---- POWERS ----
  { id: 'p-borrowed-confidence', name: 'Borrowed Confidence', cost: 1, type: 'power', rarity: 'common',
    power: { startOfTurn: { block: 2 } } },
  { id: 'p-mildly-threatening', name: 'Mildly Threatening Demeanour', cost: 1, type: 'power', rarity: 'common',
    power: { endOfTurn: { weak: 1 } } },
  { id: 'p-strongly-worded', name: 'A Strongly Worded Letter', cost: 1, type: 'power', rarity: 'uncommon',
    power: { endOfTurn: { vulnerable: 1 } } },
  { id: 'p-inadvisable-acceleration', name: 'Inadvisable Acceleration', cost: 2, type: 'power', rarity: 'uncommon',
    power: { startOfTurn: { draw: 1 } } },
  { id: 'p-significant-pause', name: 'The Significant Pause', cost: 2, type: 'power', rarity: 'uncommon',
    power: { startOfTurn: { energy: 1 } } },
  { id: 'p-ostensible-inferno', name: 'Ostensible Inferno', cost: 2, type: 'power', rarity: 'rare',
    power: { endOfTurn: { composure: 4 } } },
  { id: 'p-octarine-squint', name: 'Octarine Squint', cost: 2, type: 'power', rarity: 'rare',
    power: { onEffectCardPlayed: { vulnerable: 1 } } },
];
const CARDS_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

const STARTER_DECK = [
  'w-respect', 'w-frankly', 'w-erm',
  'e-persuade', 'e-bluster', 'e-bewilder',
  'e-spark', 'e-sword-logic',
  'c-channel',
  'c-defend', 'c-defend',
];

// --- ENEMIES ---
const ENEMIES = [
  // ACT 1
  { id: 'e1-acolyte', act: 4, name: 'Lost Acolyte', composureMax: 20, hpMax: 18, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 3 },
      { kind: 'block',  value: 5, weight: 1 },
      { kind: 'attack', value: 3, weight: 2 },
    ] },
  { id: 'e1-imp', act: 4, name: 'Pact Imp', composureMax: 18, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 4, weight: 3, riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2 },
      { kind: 'vulnerable', value: 1, weight: 1 },
    ] },
  { id: 'e1-shrine-rat', act: 4, name: 'Shrine Rat Pack', composureMax: 16, hpMax: 12, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.0, physical: 2.0 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3 },
      { kind: 'block',  value: 4, weight: 1 },
      { kind: 'attack', value: 5, weight: 2 },
    ] },
  { id: 'e1-tutor', act: 4, name: 'Stern Tutor', composureMax: 32, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 2.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1 },
      { kind: 'block',  value: 7, weight: 1 },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1 },
    ] },
  { id: 'e1-thicket', act: 4, name: 'Living Thicket', composureMax: 999, hpMax: 38, tier: 'elite',
    effectiveness: { chutzpah: 0, wit: 0, jnsq: 0, physical: 1.5 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 2 },
      { kind: 'block',  value: 9, weight: 2 },
      { kind: 'vulnerable', value: 1, weight: 1 },
    ] },
  { id: 'e1-boss-thornlord', act: 4, name: 'The Thornlord', composureMax: 100, hpMax: 120, tier: 'boss',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 15, weight: 2 },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'block',  value: 16, weight: 1 },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1 },
    ] },
  // ACT 2
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver', composureMax: 22, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 6, weight: 2 },
      { kind: 'weak',   value: 1, weight: 1 },
    ] },
  { id: 'e2-silk-wraith', act: 1, name: 'Silk Wraith', composureMax: 18, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3 },
      { kind: 'block',  value: 6, weight: 1 },
      { kind: 'vulnerable', value: 1, weight: 2 },
    ] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar', composureMax: 24, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 2 },
      { kind: 'block',  value: 8, weight: 2 },
      { kind: 'attack', value: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 1 },
    ] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker', composureMax: 34, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1 },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1 },
    ] },
  { id: 'e2-silent-spinner', act: 1, name: 'The Silent Spinner', composureMax: 38, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'block',  value: 8, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 7, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 1 },
    ] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', composureMax: 68, hpMax: 999, tier: 'boss',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2 },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1 },
      { kind: 'block',  value: 10, weight: 1 },
    ] },
  // ACT 3
  { id: 'e3-geode-crab', act: 2, name: 'Geode Crab', composureMax: 999, hpMax: 22, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.6, jnsq: 0.5, physical: 1.2 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 3 },
      { kind: 'block',  value: 8, weight: 1 },
      { kind: 'attack', value: 7, weight: 1 },
    ] },
  { id: 'e3-glow-mite', act: 2, name: 'Glow Mite Swarm', composureMax: 26, hpMax: 26, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 1.5, physical: 1.5 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack-multi', value: 2, count: 4, weight: 1 },
      { kind: 'weak',   value: 1, weight: 1 },
    ] },
  { id: 'e3-crystal-beetle', act: 2, name: 'Crystal Beetle', composureMax: 999, hpMax: 22, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 0.6, jnsq: 0.6, physical: 1.2 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 3 },
      { kind: 'attack', value: 8, weight: 1 },
      { kind: 'block',  value: 5, weight: 1 },
    ] },
  { id: 'e3-quartz-sentinel', act: 2, name: 'Quartz Sentinel', composureMax: 40, hpMax: 40, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'block',  value: 10, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1 },
    ] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer', composureMax: 999, hpMax: 50, tier: 'elite',
    effectiveness: { chutzpah: 0, wit: 0, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1 },
      { kind: 'attack', value: 14, weight: 1 },
    ] },
  { id: 'e3-boss-anvil', act: 2, name: 'The Anvil-Forged', composureMax: 78, hpMax: 75, tier: 'boss',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 4, weight: 1 },
      { kind: 'block',  value: 12, weight: 1 },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1 },
    ] },
  // ACT 4
  { id: 'e4-apprentice-shade', act: 3, name: "Apprentice's Shade", composureMax: 42, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 1.0, jnsq: 0.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 10, weight: 3 },
      { kind: 'block',  value: 10, weight: 2 },
      { kind: 'attack', value: 8, weight: 2, riders: { weak: 1 } },
    ] },
  { id: 'e4-failed-initiate', act: 3, name: 'Failed Initiate', composureMax: 38, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1 },
      { kind: 'weak',   value: 2, weight: 1 },
    ] },
  { id: 'e4-mirror-past', act: 3, name: 'Mirror of the Past', composureMax: 44, hpMax: 999, tier: 'normal',
    effectiveness: { chutzpah: 0.5, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'vulnerable', value: 2, weight: 2 },
      { kind: 'block',  value: 8, weight: 1, riders: { weak: 1 } },
    ] },
  { id: 'e4-forgotten-master', act: 3, name: 'The Forgotten Master', composureMax: 55, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 0.5, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1 },
    ] },
  { id: 'e4-test-wraith', act: 3, name: 'The Test Wraith', composureMax: 50, hpMax: 999, tier: 'elite',
    effectiveness: { chutzpah: 1.0, wit: 0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, riders: { weak: 1, vulnerable: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1 },
      { kind: 'weak',   value: 2, weight: 1 },
      { kind: 'attack-multi', value: 3, count: 4, weight: 1 },
    ] },
  { id: 'e4-boss-headmasters-hat', act: 3, name: "The Headmaster's Hat", composureMax: 100, hpMax: 999, tier: 'boss',
    effectiveness: { chutzpah: 1.0, wit: 1.5, jnsq: 0.5, physical: 0 },
    behaviors: [
      { kind: 'attack', value: 14, weight: 2 },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 9, pool: 'composure', weight: 1 },
      { kind: 'vulnerable', value: 2, weight: 1 },
    ] },
];
const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// --- ACTS ---
const ACTS = [
  { id: 1, slot: 'robes', name: 'The Thread Path',    rows: 15, bossId: 'e2-boss-tapestry',       craft: 'weaving'   },
  { id: 2, slot: 'ring',  name: 'The Forge Path',     rows: 15, bossId: 'e3-boss-anvil',          craft: 'smithing'  },
  { id: 3, slot: 'hat',   name: "The Milliner's Path",rows: 15, bossId: 'e4-boss-headmasters-hat',craft: 'felting'  },
  { id: 4, slot: 'staff', name: 'The Staff Path',     rows: 15, bossId: 'e1-boss-thornlord',      craft: 'whittling' },
];

// --- MATERIALS ---
const MATERIAL_TEMPLATES = {
  staff: [
    { id: 'mat-maple',    name: 'Maple Wood',  slot: 'staff', stats: { chutzpah: 3 } },
    { id: 'mat-rosewood', name: 'Rosewood',    slot: 'staff', stats: { chutzpah: 4, loseHp: 3 } },
    { id: 'mat-cedar',    name: 'Cedar',       slot: 'staff', stats: { chutzpah: 2, defense: 2 } },
    { id: 'mat-madrone',  name: 'Madrone',     slot: 'staff', stats: { chutzpah: 3, chance: 1, jnsq: 1 } },
    { id: 'mat-hemlock',  name: 'Hemlock',     slot: 'staff', stats: { chutzpah: 2, dot: 3 } },
  ],
  robes: [
    { id: 'mat-linen',       name: 'Linen Thread', slot: 'robes', stats: { defense: 4 } },
    { id: 'mat-wild-silk',   name: 'Wild Silk',    slot: 'robes', stats: { regen: 3, draw: 1 } },
    { id: 'mat-lichen',      name: 'Lichen Weave', slot: 'robes', stats: { defense: 1, regen: 1, draw: 1 } },
    { id: 'mat-wraithcloth', name: 'Wraithcloth',  slot: 'robes', stats: { draw: 3 } },
    { id: 'mat-burrgrass',   name: 'Burrgrass',    slot: 'robes', stats: { defense: 2, vuln: 1 } },
  ],
  ring: [
    { id: 'mat-iron',      name: 'Iron Ore',         slot: 'ring', stats: { defense: 2 } },
    { id: 'mat-copper',    name: 'Copper Ore',       slot: 'ring', stats: { energy: 1 } },
    { id: 'mat-silver',    name: 'Silver Ore',       slot: 'ring', stats: { draw: 2 } },
    { id: 'mat-cold-iron', name: 'Cold Iron',        slot: 'ring', stats: { weak: 1, defense: 1 } },
    { id: 'mat-mithril',   name: 'Mithril Filament', slot: 'ring', stats: { energy: 1, draw: 1 } },
  ],
  hat: [
    { id: 'mat-felt',          name: 'Felt',          slot: 'hat', stats: { block: 3 } },
    { id: 'mat-suede',         name: 'Suede',         slot: 'hat', stats: { energy: 1 } },
    { id: 'mat-tarred-canvas', name: 'Tarred Canvas', slot: 'hat', stats: { block: 2, draw: 1 } },
    { id: 'mat-brocade',       name: 'Brocade',       slot: 'hat', stats: { draw: 2 } },
    { id: 'mat-dragonwool',    name: 'Dragonwool',    slot: 'hat', stats: { vuln: 1 } },
  ],
};

const QUALITY_MULT = { rough: 0.5, fine: 1.0, master: 1.5 };
const QUALITY_LABEL = { rough: 'Rough', fine: 'Fine', master: 'Master' };
const SLOT_LABEL = { staff: 'Staff', robes: 'Robes', ring: 'Ring', hat: 'Hat' };
const SKILL_MAX = 5;
const STARTING_MAX_HP = 70;
const ENERGY_PER_TURN = 3;
const HAND_SIZE = 5;
const INTER_ACT_HEAL_RATIO = 0.40;
const STARTING_MAX_COMPOSURE = 30;

// =============================================================================
// 2. HELPERS
// =============================================================================

let _uid = 1;
function uid() { return _uid++; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickWeighted(list, weightKey = 'weight') {
  const total = list.reduce((s, x) => s + (x[weightKey] || 1), 0);
  let r = Math.random() * total;
  for (const x of list) {
    r -= (x[weightKey] || 1);
    if (r <= 0) return x;
  }
  return list[0];
}
function rollIntent(enemy, excludeKinds = []) {
  const filtered = enemy.behaviors.filter(b => !excludeKinds.includes(b.kind));
  const pool = filtered.length > 0 ? filtered : enemy.behaviors;
  return { ...pickWeighted(pool) };
}
function pickCardByRarity(rarityWeights, exclude = []) {
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

function buildCraftedEquipment({ slot, material, quality, skill }) {
  const q = QUALITY_MULT[quality] ?? 1.0;
  const matStats = material.stats || {};
  const mult = (v) => Math.max(1, Math.round((v || 0) * q));
  const qLabel = QUALITY_LABEL[quality] || 'Fine';
  const namePrefix = `${qLabel} ${material.name}`;
  const meta = { slot, materialId: material.id, quality, skill };

  if (slot === 'staff') {
    const baseAtk = mult(8 + (matStats.chutzpah || 0) * 2);
    const multAtk = mult(2 + (matStats.chutzpah || 0));
    const resonatesWith = [];
    if ((matStats.chutzpah || 0) >= 3) resonatesWith.push('booming');
    if ((matStats.loseHp || 0)   >= 1) resonatesWith.push('threatening');
    if ((matStats.defense || 0)  >= 1) resonatesWith.push('formal');
    if ((matStats.jnsq || 0)     >= 1) resonatesWith.push('absurd');
    if ((matStats.dot || 0)      >= 1) resonatesWith.push('threatening');
    if ((matStats.chance || 0)   >= 1) resonatesWith.push('chaotic');
    if (resonatesWith.length === 0)    resonatesWith.push('dismissive');
    const effect = {
      scaleBy: 'chutzpah', base: baseAtk, multiplier: multAtk, damageType: 'composure',
      resonatesWith: Array.from(new Set(resonatesWith)),
      resonanceBonus: { perTag: Math.max(2, Math.round(3 * q)) },
    };
    const rider = {};
    if ((matStats.defense || 0) > 0) rider.block = mult(matStats.defense * 2);
    if ((matStats.dot || 0)     > 0) rider.weak  = matStats.dot;
    if (Object.keys(rider).length) effect.rider = rider;
    if ((matStats.loseHp || 0) > 0)  effect.loseHpOnPlay = matStats.loseHp;
    if ((matStats.chance || 0) > 0)  effect.chance = { prob: 0.5, success: { enemyVulnerable: 2 }, failure: { selfWeak: 1 } };
    const card = {
      id: `eq-staff-${material.id}-${quality}`, name: `${namePrefix} Staff`,
      cost: 2, type: 'effect', rarity: 'rare', crafted: meta, effect,
    };
    if ((matStats.defense || 0) > 0) card.bonus = { damageReduction: Math.max(0, Math.round(matStats.defense * q / 2)) };
    return { kind: 'card', card };
  }
  if (slot === 'hat') {
    const turnBlock  = mult(matStats.block || 0);
    const turnEnergy = matStats.energy || 0;
    const turnDraw   = matStats.draw || 0;
    const turnVuln   = matStats.vuln || 0;
    const power = { startOfTurn: {} };
    if (turnBlock > 0)  power.startOfTurn.block      = turnBlock;
    if (turnEnergy > 0) power.startOfTurn.energy     = turnEnergy + (quality === 'master' ? 1 : 0);
    if (turnDraw > 0)   power.startOfTurn.draw       = turnDraw + (quality === 'master' ? 1 : 0);
    if (turnVuln > 0)   power.startOfTurn.vulnerable = turnVuln + (quality === 'master' ? 1 : 0);
    return { kind: 'card', card: {
      id: `eq-hat-${material.id}-${quality}`, name: `${namePrefix} Hat`,
      cost: 1, type: 'power', rarity: 'rare', crafted: meta, power,
    }};
  }
  if (slot === 'robes') {
    const def = Math.max(0, Math.round((matStats.defense || 0) * q / 2));
    const regen = matStats.regen || 0;
    const drawN = matStats.draw || 0;
    const vuln = matStats.vuln || 0;
    const bonus = {};
    if (def > 0)   bonus.damageReduction       = def;
    if (regen > 0) bonus.healOnCombatStart     = mult(regen * 2);
    if (drawN > 0) bonus.extraStartHand        = drawN + (quality === 'master' ? 1 : 0);
    if (vuln > 0)  bonus.startCombatVulnerable = vuln + (quality === 'master' ? 1 : 0);
    return { kind: 'equipment', equipment: {
      id: `eq-robes-${material.id}-${quality}`, name: `${namePrefix} Robes`,
      bonus, crafted: meta,
    }};
  }
  if (slot === 'ring') {
    const bonus = {};
    if ((matStats.energy || 0)  > 0) bonus.permanentEnergyBonus = matStats.energy;
    if ((matStats.draw || 0)    > 0) bonus.extraStartHand       = matStats.draw + (quality === 'master' ? 1 : 0);
    if ((matStats.defense || 0) > 0) bonus.damageReduction      = Math.max(0, Math.round((matStats.defense || 0) * q / 2));
    if ((matStats.weak || 0)    > 0) bonus.startCombatWeak      = matStats.weak + (quality === 'master' ? 1 : 0);
    if (Object.keys(bonus).length === 0) bonus.damageReduction = 1;
    return { kind: 'equipment', equipment: {
      id: `eq-ring-${material.id}-${quality}`, name: `${namePrefix} Ring`,
      bonus, crafted: meta,
    }};
  }
  return null;
}

function salvageMaterial(slot) {
  return { id: `salvage-${slot}`, name: 'Salvaged Scrap', slot, stats: { defense: 1 } };
}

// =============================================================================
// 3. COMBAT SIM
// =============================================================================

function combatStart(state, enemyId) {
  const tmpl = ENEMIES_BY_ID[enemyId];
  if (!tmpl) throw new Error(`Unknown enemy: ${enemyId}`);
  const enemy = { ...tmpl };
  const combat = {
    enemy,
    enemyComposure: enemy.composureMax,
    enemyHp: enemy.hpMax,
    enemyBlock: 0,
    enemyDmgMult: 1.0,
    playerDmgMult: 1.0,
    enemyIntent: rollIntent(enemy),
    lastIntentKinds: [],
    powers: [],
    tray: { chutzpah: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: false },
    turn: 0,
    // Per-combat stats
    fizzles: 0,
    castsAttempted: 0,
    castsResonated: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    amplifyPlays: 0,
  };
  // Equipment-driven combat-start effects.
  let startBlock = 0, healOnStart = 0, startHandBonus = 0, startEnergyBonus = 0;
  let startVuln = 0, startWeak = 0;
  for (const eq of state.equipment) {
    if (eq.bonus?.startBlock)              startBlock       += eq.bonus.startBlock;
    if (eq.bonus?.energyOnCombatStart)     startEnergyBonus += eq.bonus.energyOnCombatStart;
    if (eq.bonus?.extraStartHand)          startHandBonus   += eq.bonus.extraStartHand;
    if (eq.bonus?.healOnCombatStart)       healOnStart      += eq.bonus.healOnCombatStart;
    if (eq.bonus?.startCombatVulnerable)   startVuln        += eq.bonus.startCombatVulnerable;
    if (eq.bonus?.startCombatWeak)         startWeak        += eq.bonus.startCombatWeak;
  }
  if (healOnStart > 0) state.hp = clamp(state.hp + healOnStart, 0, state.maxHp);
  if (startVuln > 0)   combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * startVuln);
  if (startWeak > 0)   combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * startWeak);
  state.block = startBlock;
  state.energy = energyPerTurnRefill(state) + startEnergyBonus;

  // Reshuffle full deck and draw initial hand.
  const fullDeck = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
  const drawn = drawFromPiles(shuffle(fullDeck), [], HAND_SIZE + startHandBonus);
  state.deck = drawn.deck;
  state.hand = drawn.hand;
  state.discard = [];
  state.exiled = [];
  return combat;
}

function energyPerTurnRefill(state) {
  return ENERGY_PER_TURN
    + state.equipment.reduce((s, eq) => s + (eq.bonus?.permanentEnergyBonus || 0), 0);
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

function previewCastDamage(state, combat, effectCard) {
  const eff = effectCard.effect || {};
  let base = eff.base || 0;
  const stat = eff.scaleBy || 'wit';
  const trayVal = combat.tray[stat] || 0;
  const rawSpell = base + trayVal * (eff.multiplier || 0);
  const dmgType = eff.damageType || 'composure';
  const eff_mult = combat.enemy?.effectiveness?.[stat] ?? 1.0;
  const phys_mult = combat.enemy?.effectiveness?.physical ?? 1.0;
  let dmg = rawSpell;
  if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
  else                        dmg = Math.round(dmg * eff_mult);
  const rWith = eff.resonatesWith || [];
  const perTag = eff.resonanceBonus?.perTag || 0;
  const matchedTags = (combat.tray.tags || []).filter(t => rWith.includes(t));
  const resonanceBonus = matchedTags.length * perTag;
  if (resonanceBonus > 0) dmg += resonanceBonus;
  dmg = Math.round(dmg * combat.playerDmgMult);
  return { dmg, dmgType, resonanceBonus, matchedCount: matchedTags.length };
}

function stageWord(state, combat, handIdx) {
  const card = state.hand[handIdx];
  state.energy -= card.cost;
  const stats = card.stats || {};
  combat.tray.chutzpah += (stats.chutzpah || 0);
  combat.tray.wit      += (stats.wit      || 0);
  combat.tray.jnsq     += (stats.jnsq     || 0);
  combat.tray.tags = [...combat.tray.tags, ...(card.tags || [])];
  combat.tray.words = [...combat.tray.words, card];
  // On-play side-effects (e.g., Dramatic Pause's draw).
  applySideEffects(state, combat, card.effects || {});
  state.hand.splice(handIdx, 1);
}

function stageEffect(state, combat, handIdx) {
  const card = state.hand[handIdx];
  state.energy -= card.cost;
  combat.tray.effectCard = card;
  state.hand.splice(handIdx, 1);
}

function applySideEffects(state, combat, fx) {
  if (fx.block)      state.block += fx.block;
  if (fx.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * fx.vulnerable);
  if (fx.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * fx.weak);
  if (fx.energy)     state.energy += fx.energy;
  if (fx.hp)         state.hp = clamp(state.hp + fx.hp, 0, state.maxHp);
  if (fx.draw)       drawCards(state, fx.draw);
  // Cycle-4 archetype additions:
  if (fx.loseHp)         state.hp = clamp(state.hp - fx.loseHp, 0, state.maxHp);
  if (fx.selfWeak)       combat.playerDmgMult = Math.max(0.5, combat.playerDmgMult - 0.25 * fx.selfWeak);
  if (fx.enemyVulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * fx.enemyVulnerable);
  // Direct multiplier ops (Sap / Amplify / Dispel + future modifier cards).
  if (fx.enemyDmgMod)  combat.enemyDmgMult  = Math.max(0.5, Math.min(1.5, combat.enemyDmgMult  + fx.enemyDmgMod));
  if (fx.playerDmgMod) combat.playerDmgMult = Math.max(0.5, Math.min(1.5, combat.playerDmgMult + fx.playerDmgMod));
}

function applyChance(state, combat, chanceBlock) {
  if (!chanceBlock) return;
  const roll = Math.random();
  const fired = roll < (chanceBlock.prob ?? 0.5) ? chanceBlock.success : chanceBlock.failure;
  if (fired) applySideEffects(state, combat, fired);
}

function drawCards(state, n) {
  let wDeck = [...state.deck];
  let wDiscard = [...state.discard];
  for (let i = 0; i < n; i++) {
    if (wDeck.length === 0) {
      if (wDiscard.length === 0) break;
      wDeck = shuffle(wDiscard); wDiscard = [];
    }
    state.hand.push({ ...wDeck.shift(), uid: uid() });
  }
  state.deck = wDeck;
  state.discard = wDiscard;
}

function castSpell(state, combat) {
  combat.castsAttempted++;
  const card = combat.tray.effectCard;
  const eff = card.effect || {};
  // Sway / Insult cards: sim doesn't model the negotiation or word-pick
  // mechanics. Treat as no-damage and just discharge the tray so the AI
  // can keep playing. Insults at least pay their composure cost.
  if (eff.sway || eff.insult) {
    if (eff.insult && eff.playerComposureCost) {
      // composure isn't tracked in sim state; effectively a no-op.
    }
    for (const w of combat.tray.words) {
      if (w.effects?.exhaust) state.exiled.push(w); else state.discard.push(w);
    }
    if (eff.exhaust) state.exiled.push(card); else state.discard.push(card);
    combat.tray = { chutzpah: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: true };
    return;
  }
  const stat = eff.scaleBy || 'wit';
  let dmg = (eff.base || 0) + (combat.tray[stat] || 0) * (eff.multiplier || 0);
  const dmgType = eff.damageType || 'composure';
  const eff_mult = combat.enemy?.effectiveness?.[stat] ?? 1.0;
  const phys_mult = combat.enemy?.effectiveness?.physical ?? 1.0;
  if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
  else                        dmg = Math.round(dmg * eff_mult);
  const rWith = eff.resonatesWith || [];
  const perTag = eff.resonanceBonus?.perTag || 0;
  const matchedTags = (combat.tray.tags || []).filter(t => rWith.includes(t));
  const resonanceBonus = matchedTags.length * perTag;
  if (resonanceBonus > 0) { dmg += resonanceBonus; combat.castsResonated++; }
  dmg = Math.round(dmg * combat.playerDmgMult);

  // Apply damage with enemy block absorbing first.
  let remaining = dmg;
  if (combat.enemyBlock > 0) {
    const absorbed = Math.min(combat.enemyBlock, remaining);
    combat.enemyBlock -= absorbed; remaining -= absorbed;
  }
  if (dmgType === 'physical') {
    combat.enemyHp = Math.max(0, combat.enemyHp - remaining);
  } else {
    combat.enemyComposure = Math.max(0, combat.enemyComposure - remaining);
  }
  combat.totalDamageDealt += dmg;

  // Riders.
  const rider = eff.rider || {};
  if (rider.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * rider.weak);
  if (rider.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * rider.vulnerable);
  if (rider.block)      state.block += rider.block;
  if (rider.draw)       drawCards(state, rider.draw);
  // Cycle-4 archetype-card payloads.
  if (eff.loseHpOnPlay)  state.hp = clamp(state.hp - eff.loseHpOnPlay, 0, state.maxHp);
  if (eff.chance)        applyChance(state, combat, eff.chance);

  // Discard staged cards (skipping exhausts).
  for (const w of combat.tray.words) {
    if (w.effects?.exhaust) state.exiled.push(w); else state.discard.push(w);
  }
  if (eff.exhaust) state.exiled.push(card); else state.discard.push(card);

  // Clear tray.
  combat.tray = { chutzpah: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: true };

  // onEffectCardPlayed power triggers.
  for (const p of combat.powers) {
    const trig = p.power?.onEffectCardPlayed;
    if (!trig) continue;
    if (trig.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * trig.vulnerable);
    if (trig.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * trig.weak);
  }
}

function effectiveCardCost(card, combat) {
  if (card.id === 'c-amplify') return (card.cost || 0) + (combat?.amplifyPlays || 0);
  return card.cost || 0;
}

function playSkillOrPower(state, combat, handIdx) {
  const card = state.hand[handIdx];
  state.energy -= effectiveCardCost(card, combat);
  if (card.id === 'c-amplify') combat.amplifyPlays++;
  if (card.type === 'power') {
    combat.powers.push(card);
    state.hand.splice(handIdx, 1);
    return;
  }
  // Skill card
  applySideEffects(state, combat, card.effects || {});
  state.hand.splice(handIdx, 1);
  if (card.effects?.exhaust) state.exiled.push(card);
  else                       state.discard.push(card);
}

// ---------- AI ----------
function aiTurn(state, combat) {
  combat.turn++;
  // Refill energy + draw.
  state.energy = energyPerTurnRefill(state);
  state.block = 0;
  // startOfTurn power triggers
  for (const p of combat.powers) {
    const trig = p.power?.startOfTurn;
    if (!trig) continue;
    if (trig.block)  state.block += trig.block;
    if (trig.energy) state.energy += trig.energy;
    if (trig.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * trig.vulnerable);
    if (trig.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * trig.weak);
    if (trig.draw)       drawCards(state, trig.draw);
  }
  drawCards(state, HAND_SIZE);

  // === Action loop ===
  // 1. Play any Powers in hand (one per loop iteration).
  // 2. If we expect significant incoming damage, play Defend.
  // 3. Pick best Effect and stage matching Words + Effect, then CAST.
  // 4. Repeat until out of energy or no good plays.
  let safety = 30;
  while (safety-- > 0) {
    // Powers first.
    const powerIdx = state.hand.findIndex(c => c.type === 'power' && c.cost <= state.energy);
    if (powerIdx >= 0) { playSkillOrPower(state, combat, powerIdx); continue; }

    // Defend logic: if enemy intent is an attack and block insufficient, play Defend.
    const intent = combat.enemyIntent;
    const incoming = (intent?.kind === 'attack' || intent?.kind === 'attack-multi')
      ? intent.value * (intent.count || 1)
      : 0;
    const expectedDamage = adjustIncoming(state, combat, incoming);
    if (expectedDamage > state.block + 3) {
      const defendIdx = state.hand.findIndex(c => c.type === 'skill' && c.cost <= state.energy && c.effects?.block);
      if (defendIdx >= 0) { playSkillOrPower(state, combat, defendIdx); continue; }
    }

    // Card-draw skills if hand small and we have energy.
    if (state.hand.length <= 2) {
      const drawIdx = state.hand.findIndex(c => c.type === 'skill' && c.cost <= state.energy && c.effects?.draw);
      if (drawIdx >= 0) { playSkillOrPower(state, combat, drawIdx); continue; }
    }

    // Try a cast.
    const cast = pickCast(state, combat);
    if (!cast) break;
    // Stage all chosen words first (in best order for resonance).
    for (const wIdx of cast.wordIndices) stageWord(state, combat, /* fresh idx */ findCardIdx(state.hand, cast.wordObjs.shift()));
    // Re-find the effect's hand index now that words are removed.
    const effIdx = state.hand.findIndex(c => c.uid === cast.effectCard.uid);
    if (effIdx < 0) break;
    stageEffect(state, combat, effIdx);
    castSpell(state, combat);
    if (combat.enemyComposure <= 0 || combat.enemyHp <= 0) break;
  }

  // End of turn: enemy intent + powers
  if (combat.enemyComposure > 0 && combat.enemyHp > 0) {
    // Fizzle check
    if (combat.tray.words.length > 0 && !combat.tray.effectFiredThisTurn) {
      combat.fizzles++;
      // staged words go to discard
      for (const w of combat.tray.words) state.discard.push(w);
      combat.tray = { chutzpah: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: false };
    } else {
      combat.tray = { chutzpah: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: false };
    }
    // endOfTurn power triggers
    for (const p of combat.powers) {
      const trig = p.power?.endOfTurn;
      if (!trig) continue;
      if (trig.composure) {
        const eff_mult = combat.enemy?.effectiveness?.wit ?? 1.0;
        let dmg = Math.round(trig.composure * eff_mult);
        const absorbed = Math.min(combat.enemyBlock, dmg);
        combat.enemyBlock -= absorbed; dmg -= absorbed;
        combat.enemyComposure = Math.max(0, combat.enemyComposure - dmg);
        combat.totalDamageDealt += dmg;
      }
      if (trig.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * trig.vulnerable);
      if (trig.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * trig.weak);
    }
    // Enemy block fades before its new intent fires — same rule as
    // player block. Otherwise a Block intent stacks indefinitely.
    combat.enemyBlock = 0;
    // Enemy intent
    if (combat.enemyComposure > 0 && combat.enemyHp > 0) {
      applyIntent(state, combat, combat.enemyIntent);
    }
    // Decay debuffs
    // Multiplier drift: shift toward 1.0 by 0.25 per turn.
    combat.enemyDmgMult  = combat.enemyDmgMult  > 1 ? Math.max(1, combat.enemyDmgMult  - 0.5) : combat.enemyDmgMult  < 1 ? Math.min(1, combat.enemyDmgMult  + 0.5) : combat.enemyDmgMult;
    combat.playerDmgMult = combat.playerDmgMult > 1 ? Math.max(1, combat.playerDmgMult - 0.5) : combat.playerDmgMult < 1 ? Math.min(1, combat.playerDmgMult + 0.5) : combat.playerDmgMult;
    // Discard hand
    for (const c of state.hand) state.discard.push(c);
    state.hand = [];
    // Anti-repetition: track last 2 kinds fired, exclude that kind on the
    // next roll if both match (mirrors App.jsx — see endTurn).
    const justFiredKind = combat.enemyIntent?.kind;
    if (justFiredKind) combat.lastIntentKinds = [...combat.lastIntentKinds, justFiredKind].slice(-2);
    const exclude = (combat.lastIntentKinds.length === 2 && combat.lastIntentKinds[0] === combat.lastIntentKinds[1])
      ? [combat.lastIntentKinds[0]] : [];
    combat.enemyIntent = rollIntent(combat.enemy, exclude);
  }
}

function adjustIncoming(state, combat, raw) {
  if (raw === 0) return 0;
  let r = raw;
  r = Math.round(r * combat.enemyDmgMult);
  return r;
}

function findCardIdx(hand, card) {
  return hand.findIndex(c => c.uid === card.uid);
}

// Choose the best cast for this turn: which effect to cast, with which
// words (in order). Greedy: pick effect with highest predicted damage
// after staging affordable words, prioritizing resonance matches and
// stat scaling.
function pickCast(state, combat) {
  const effects = state.hand.filter(c => c.type === 'effect' && c.cost <= state.energy);
  if (effects.length === 0) return null;

  let best = null;
  for (const effCard of effects) {
    // Try staging words in priority order: resonance-matching first,
    // then highest-stat-of-scaleBy.
    const eff = effCard.effect || {};
    const stat = eff.scaleBy || 'wit';
    const resonates = new Set(eff.resonatesWith || []);
    // Affordability after staging the effect itself.
    let remainingEnergy = state.energy - effCard.cost;
    if (remainingEnergy < 0) continue;

    // Build a candidate ordered list of words to stage.
    const wordCandidates = state.hand.filter(c => c.type === 'word' && c.cost <= remainingEnergy);
    // Score each: resonance match value + stat value.
    function wordScore(w) {
      const tagMatches = (w.tags || []).filter(t => resonates.has(t)).length;
      const statVal = (w.stats || {})[stat] || 0;
      return tagMatches * 3 + statVal * 2 - (w.cost || 0) * 1.5;
    }
    const ranked = [...wordCandidates].sort((a, b) => wordScore(b) - wordScore(a));
    const wordObjs = [];
    let energyLeft = remainingEnergy;
    for (const w of ranked) {
      if (w.cost > energyLeft) continue;
      // Only stage words with positive score or that contribute to the scaling stat.
      if (wordScore(w) < 0 && (w.stats?.[stat] || 0) === 0) continue;
      wordObjs.push(w);
      energyLeft -= (w.cost || 0);
    }

    // Simulate the predicted damage with these words staged.
    const previewTray = { chutzpah: combat.tray.chutzpah, wit: combat.tray.wit, jnsq: combat.tray.jnsq, tags: [...combat.tray.tags] };
    for (const w of wordObjs) {
      const s = w.stats || {};
      previewTray.chutzpah += s.chutzpah || 0;
      previewTray.wit      += s.wit      || 0;
      previewTray.jnsq     += s.jnsq     || 0;
      previewTray.tags     = [...previewTray.tags, ...(w.tags || [])];
    }
    const fakeCombat = { ...combat, tray: previewTray };
    const preview = previewCastDamage(state, fakeCombat, effCard);
    if (!best || preview.dmg > best.dmg) {
      best = { effectCard: effCard, wordObjs, wordIndices: wordObjs.map(w => findCardIdx(state.hand, w)), dmg: preview.dmg, dmgType: preview.dmgType };
    }
  }
  // If best damage is 0 (e.g., immune enemy + no physical option), return null to end turn.
  if (!best || best.dmg <= 0) return null;
  return best;
}

function applyIntent(state, combat, intent) {
  if (!intent) return;
  if (intent.kind === 'attack' || intent.kind === 'attack-multi') {
    const hits = intent.kind === 'attack-multi' ? (intent.count || 1) : 1;
    const targetsComposure = intent.pool === 'composure';
    let raw = intent.value;
    let raw0 = raw; raw = Math.round(raw0 * combat.enemyDmgMult);
    const defense = Math.min(2, state.equipment.reduce((s, eq) => s + (eq.bonus?.damageReduction || 0), 0));
    let wBlock = state.block;
    let wHp = state.hp;
    let wComp = state.composure;
    for (let i = 0; i < hits; i++) {
      let remaining = raw;
      if (defense > 0 && remaining > 0) remaining = Math.max(1, remaining - defense);
      if (wBlock > 0) {
        const absorbed = Math.min(wBlock, remaining);
        wBlock -= absorbed; remaining -= absorbed;
      }
      if (targetsComposure) wComp = Math.max(0, wComp - remaining);
      else                  wHp   = Math.max(0, wHp   - remaining);
      combat.totalDamageTaken += remaining;
      if (wHp <= 0 || wComp <= 0) break;
    }
    state.block = wBlock;
    state.hp = wHp;
    state.composure = wComp;
  } else if (intent.kind === 'block') {
    combat.enemyBlock += intent.value;
  } else if (intent.kind === 'vulnerable') {
    combat.enemyDmgMult  = Math.min(1.5, combat.enemyDmgMult  + 0.25 * intent.value);
  } else if (intent.kind === 'weak') {
    combat.playerDmgMult = Math.max(0.5, combat.playerDmgMult - 0.25 * intent.value);
  }
  if (intent.riders) {
    const r = intent.riders;
    if (r.weak)       combat.playerDmgMult = Math.max(0.5, combat.playerDmgMult - 0.25 * r.weak);
    if (r.vulnerable) combat.enemyDmgMult  = Math.min(1.5, combat.enemyDmgMult  + 0.25 * r.vulnerable);
    if (r.block)      combat.enemyBlock += r.block;
  }
}

// Run a single combat to completion. Stall detection: if the player
// goes 5 consecutive turns without dealing any damage to the enemy,
// the combat is unwinnable (no answer to a verbal-immune enemy, etc.)
// and we abort as a loss. This keeps the sim from inflating turn
// counts with hopeless defend-loops.
function simCombat(state, enemyId) {
  const combat = combatStart(state, enemyId);
  let safety = 60;
  let prevDamageDealt = 0;
  let zeroDamageStreak = 0;
  while (safety-- > 0) {
    if (state.hp <= 0 || state.composure <= 0) return { combat, outcome: 'lost' };
    if (combat.enemyComposure <= 0 || combat.enemyHp <= 0) return { combat, outcome: 'won' };
    aiTurn(state, combat);
    if (combat.totalDamageDealt === prevDamageDealt) {
      zeroDamageStreak++;
      if (zeroDamageStreak >= 5) return { combat, outcome: 'stall' };
    } else {
      zeroDamageStreak = 0;
      prevDamageDealt = combat.totalDamageDealt;
    }
  }
  return { combat, outcome: (state.hp <= 0 || state.composure <= 0) ? 'lost' : combat.enemyComposure <= 0 ? 'won' : 'stall' };
}

// =============================================================================
// 4. RUN SIM (path through 4 acts)
// =============================================================================

function makeRunState() {
  const deck = STARTER_DECK.map(id => ({ ...CARDS_BY_ID[id], uid: uid() }));
  return {
    hp: STARTING_MAX_HP,
    maxHp: STARTING_MAX_HP,
    composure: STARTING_MAX_COMPOSURE,
    composureMax: STARTING_MAX_COMPOSURE,
    block: 0,
    energy: ENERGY_PER_TURN,
    deck: shuffle(deck),
    hand: [],
    discard: [],
    exiled: [],
    equipment: [],
    powers: [],
    inventory: { staff: [], robes: [], ring: [], hat: [] },
    skills: { whittling: 0, weaving: 0, smithing: 0, felting: 0 },
    relics: [],
  };
}

// Simulate one path through an act. We don't simulate the actual map
// nodes — we synthesize a typical path that matches the C2 distribution:
// ~9 combats, ~1 elite, ~2 events, ~2 rests, 3 materials, 2 skill events,
// plus a boss at the end.
function simAct(state, act, runStats) {
  const slot = act.slot;
  const craft = act.craft;
  const skillsRemaining = ACTS.filter(a => ACTS.indexOf(a) >= ACTS.indexOf(act)).map(a => a.craft);

  // Sequence ≈ 15 nodes:
  //  3 combat, 1 material, 2 combat, 1 skill, 1 combat, 1 material, 1 rest,
  //  1 combat, 1 skill, 1 material, 1 combat, 1 elite, 1 combat, 1 boss
  // 15-node act path mirroring a typical map traversal:
  // 6 combats + 1 elite + 1 boss = 8 fights, 2 rests, 3 materials,
  // 2 skill events, 1 boss = 15 nodes total. This matches the
  // distribution generateActMap actually produces; the previous
  // sim sequence ran 10+ combats per act which over-attritioned the
  // player relative to real play.
  const sequence = [
    'combat','combat',
    'material',
    'rest',
    'combat',
    'skill',
    'combat',
    'material',
    'rest',
    'combat',
    'skill',
    'material',
    'combat',
    'elite',
    'boss',
  ];

  for (const step of sequence) {
    if (state.hp <= 0 || state.composure <= 0) return false;
    if (step === 'combat' || step === 'elite') {
      const tier = step === 'combat' ? 'normal' : 'elite';
      const pool = ENEMIES.filter(e => e.act === act.id && e.tier === tier);
      if (pool.length === 0) continue;
      const enemyId = pool[Math.floor(Math.random() * pool.length)].id;
      const res = simCombat(state, enemyId);
      runStats.combats.push({ act: act.id, tier, enemyId, outcome: res.outcome, turns: res.combat.turn, fizzles: res.combat.fizzles, castsAttempted: res.combat.castsAttempted, castsResonated: res.combat.castsResonated, damageDealt: res.combat.totalDamageDealt, damageTaken: res.combat.totalDamageTaken });
      if (res.outcome !== 'won') return false;
      // Post-combat card reward (greedy pick: best damaging effect, or block skill if low HP)
      const weights = tier === 'elite' ? { common: 2, uncommon: 3, rare: 1 } : { common: 4, uncommon: 1 };
      const candidates = [];
      for (let i = 0; i < 3; i++) {
        const c = pickCardByRarity(weights, candidates.map(x => x.id));
        if (c) candidates.push(c);
      }
      if (candidates.length > 0) {
        const pick = aiPickReward(state, candidates);
        if (pick) state.deck.push({ ...pick, uid: uid() });
      }
    } else if (step === 'rest') {
      // Heal 30%
      const amt = Math.floor(state.maxHp * 0.3);
      state.hp = clamp(state.hp + amt, 0, state.maxHp);
    } else if (step === 'material') {
      const pool = MATERIAL_TEMPLATES[slot] || [];
      const shuffled = shuffle(pool);
      const choices = shuffled.slice(0, Math.min(3, shuffled.length));
      // Slot-aware scoring: each slot's mechanic values certain stats
      // very differently. Per-turn ticks (energy, draw) scale across a
      // run and beat raw defense over time; raw defense matters most
      // when it's the only output (robes).
      const scoreMaterial = (m) => {
        const st = m.stats || {};
        if (slot === 'ring') {
          return (st.energy || 0) * 5
               + (st.draw   || 0) * 3
               + (st.weak   || 0) * 3
               + (st.defense || 0) * 0.5;
        }
        if (slot === 'robes') {
          return (st.defense || 0) * 1.5
               + (st.regen   || 0) * 1.5
               + (st.draw    || 0) * 2
               + (st.vuln    || 0) * 3;
        }
        if (slot === 'hat') {
          return (st.block   || 0) * 1.5
               + (st.energy  || 0) * 5
               + (st.draw    || 0) * 3
               + (st.vuln    || 0) * 3;
        }
        if (slot === 'staff') {
          return (st.chutzpah || 0) * 2
               + (st.loseHp   || 0) * -0.5   // small penalty (cost)
               + (st.defense  || 0) * 1
               + (st.dot      || 0) * 1.5
               + (st.chance   || 0) * 1
               + (st.jnsq     || 0) * 0.5;
        }
        return Object.values(st).reduce((s, v) => s + v, 0);
      };
      const chosen = choices.reduce((best, m) => {
        const score = scoreMaterial(m);
        return !best || score > best.score ? { mat: m, score } : best;
      }, null);
      if (chosen) {
        state.inventory[slot].push(chosen.mat);
        runStats.materialsGathered.push({ act: act.id, slot, materialId: chosen.mat.id });
      }
    } else if (step === 'skill') {
      // +2 to the most relevant skill (current act's craft, capped at SKILL_MAX).
      const target = craft;
      if (state.skills[target] < SKILL_MAX) {
        state.skills[target] = Math.min(SKILL_MAX, state.skills[target] + 2);
        runStats.skillBumps.push({ act: act.id, skill: target, value: 2 });
      } else if (skillsRemaining.length > 1) {
        // Bump a future skill if current is maxed.
        const futureSkill = skillsRemaining[1];
        if (state.skills[futureSkill] < SKILL_MAX) {
          state.skills[futureSkill] = Math.min(SKILL_MAX, state.skills[futureSkill] + 2);
          runStats.skillBumps.push({ act: act.id, skill: futureSkill, value: 2 });
        }
      }
    } else if (step === 'boss') {
      const res = simCombat(state, act.bossId);
      runStats.combats.push({ act: act.id, tier: 'boss', enemyId: act.bossId, outcome: res.outcome, turns: res.combat.turn, fizzles: res.combat.fizzles, castsAttempted: res.combat.castsAttempted, castsResonated: res.combat.castsResonated, damageDealt: res.combat.totalDamageDealt, damageTaken: res.combat.totalDamageTaken });
      if (res.outcome !== 'won') return false;
      // CRAFTING: pick best material from inventory, simulate gauge based on skill.
      const skillLevel = state.skills[craft] || 0;
      const gathered = state.inventory[slot] || [];
      const materials = gathered.length > 0 ? gathered : [salvageMaterial(slot)];
      const salvaged = gathered.length === 0;
      // Pick best material — highest sum-of-stats.
      const material = materials.reduce((best, m) => {
        const score = Object.values(m.stats || {}).reduce((s, v) => s + v, 0);
        return !best || score > best.score ? { m, score } : best;
      }, null).m;
      // Roll gauge based on skill: master zone 12-37% of width, fine 36-76%.
      const masterRadius = 0.06 + skillLevel * 0.025;
      const fineRadius   = 0.18 + skillLevel * 0.04;
      // A "press-stop" attempt is roughly uniform over the gauge but biased
      // slightly toward the middle (player tries to time it). Use a normal
      // approximation centered at 0.5 with stddev that tightens with skill.
      const stddev = 0.20 - skillLevel * 0.025;
      let pos = 0.5 + (gaussRand() * stddev);
      if (pos < 0) pos = 0; if (pos > 1) pos = 1;
      const offset = Math.abs(pos - 0.5);
      const quality = salvaged ? 'rough'
        : offset <= masterRadius ? 'master'
        : offset <= fineRadius   ? 'fine'
        :                          'rough';
      const built = buildCraftedEquipment({ slot, material, quality, skill: skillLevel });
      runStats.crafted.push({ act: act.id, slot, materialId: material.id, quality, skill: skillLevel, salvaged });
      if (built) {
        if (built.kind === 'card') {
          state.deck.push({ ...built.card, uid: uid() });
        } else if (built.kind === 'equipment') {
          state.equipment.push(built.equipment);
          if (built.equipment.bonus?.maxHp) { state.maxHp += built.equipment.bonus.maxHp; state.hp += built.equipment.bonus.maxHp; }
        }
      }
      // Boss relic (random rare): track as bookkeeping (not used by sim).
      runStats.relicsClaimed++;
      // Inter-act heal (both pools).
      state.hp        = clamp(state.hp        + Math.floor(state.maxHp        * INTER_ACT_HEAL_RATIO), 0, state.maxHp);
      state.composure = clamp(state.composure + Math.floor(state.composureMax * INTER_ACT_HEAL_RATIO), 0, state.composureMax);
    }
  }
  return true;
}

function aiPickReward(state, candidates) {
  // Smarter reward selection:
  // 1. Effects > Powers > Words > Skills baseline
  // 2. Physical effects are critical past act 1 (verbal-immune enemies).
  //    Heavy weight if player has < 2 physical in deck.
  // 3. Rarity bumps the score, but doesn't dominate.
  // 4. Diminishing returns on 3rd+ copy of same card.
  const allCards = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
  const counts = {};
  for (const c of allCards) counts[c.id] = (counts[c.id] || 0) + 1;
  const physicalInDeck = allCards.filter(c => c.type === 'effect' && c.effect?.damageType === 'physical').length;

  function score(card) {
    let s = 0;
    if (card.type === 'effect') s += 10;
    else if (card.type === 'power') s += 7;
    else if (card.type === 'word')  s += 6;
    else                            s += 4;
    if (card.rarity === 'rare')     s += 6;
    if (card.rarity === 'uncommon') s += 3;
    // Physical effects when we're short on them — capped at 2 so we
    // don't crowd out wit/chutzpah picks that matter at bosses.
    if (card.type === 'effect' && card.effect?.damageType === 'physical') {
      if (physicalInDeck < 1)      s += 12;
      else if (physicalInDeck < 2) s += 5;
      else                         s -= 2; // already covered
    }
    // Avoid stacking copies.
    const owned = counts[card.id] || 0;
    if (owned >= 2) s -= 5;
    if (owned >= 3) s -= 12;
    return s;
  }

  let best = null, bestScore = -Infinity;
  for (const c of candidates) {
    const s = score(c);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return best;
}

function gaussRand() {
  // Box-Muller, returns ~N(0,1)
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function simRun() {
  const state = makeRunState();
  const runStats = {
    won: false,
    actsCleared: 0,
    combats: [],
    materialsGathered: [],
    skillBumps: [],
    crafted: [],
    relicsClaimed: 0,
    finalHp: 0,
    finalMaxHp: 0,
    finalDeckSize: 0,
    failedAt: null,
  };
  for (const act of ACTS) {
    const ok = simAct(state, act, runStats);
    if (!ok) {
      runStats.failedAt = act.id;
      break;
    }
    runStats.actsCleared++;
  }
  runStats.won = runStats.actsCleared === ACTS.length;
  runStats.finalHp = state.hp;
  runStats.finalMaxHp = state.maxHp;
  runStats.finalDeckSize = state.deck.length + state.hand.length + state.discard.length + state.exiled.length;
  runStats.finalSkills = { ...state.skills };
  runStats.finalEquipment = state.equipment.map(e => e.id);
  return runStats;
}

// =============================================================================
// 5. AGGREGATION + REPORT
// =============================================================================

function aggregate(results) {
  const N = results.length;
  const wins = results.filter(r => r.won).length;
  const failedAt = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of results) if (r.failedAt) failedAt[r.failedAt] = (failedAt[r.failedAt] || 0) + 1;

  // Combat stats
  const allCombats = results.flatMap(r => r.combats);
  const byTier = { normal: [], elite: [], boss: [] };
  for (const c of allCombats) (byTier[c.tier] || (byTier[c.tier] = [])).push(c);

  // Boss death breakdown by act
  const bossLossByAct = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const bossWinByAct  = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const c of allCombats) {
    if (c.tier !== 'boss') continue;
    if (c.outcome === 'won') bossWinByAct[c.act]++;
    else                     bossLossByAct[c.act]++;
  }

  // Per-act enemy KO loss rate
  const lossByEnemyId = {};
  for (const c of allCombats) {
    if (c.outcome === 'lost') {
      lossByEnemyId[c.enemyId] = (lossByEnemyId[c.enemyId] || 0) + 1;
    }
  }

  // Cast stats
  const totalCasts = allCombats.reduce((s, c) => s + c.castsAttempted, 0);
  const totalResonated = allCombats.reduce((s, c) => s + c.castsResonated, 0);
  const totalFizzles = allCombats.reduce((s, c) => s + c.fizzles, 0);
  const totalTurns = allCombats.reduce((s, c) => s + c.turns, 0);

  // Per-tier turn averages
  const avgTurnsByTier = {};
  for (const [tier, arr] of Object.entries(byTier)) {
    avgTurnsByTier[tier] = arr.length ? mean(arr.map(c => c.turns)) : 0;
  }

  // Material picks
  const materialFreq = {};
  for (const r of results) {
    for (const m of r.materialsGathered) {
      materialFreq[m.materialId] = (materialFreq[m.materialId] || 0) + 1;
    }
  }

  // Craft quality distribution per slot
  const qualityBySlot = { staff: { rough: 0, fine: 0, master: 0 }, robes: { rough: 0, fine: 0, master: 0 }, ring: { rough: 0, fine: 0, master: 0 }, hat: { rough: 0, fine: 0, master: 0 } };
  let salvagedCount = 0;
  for (const r of results) {
    for (const c of r.crafted) {
      qualityBySlot[c.slot][c.quality]++;
      if (c.salvaged) salvagedCount++;
    }
  }

  // HP at end of run (winners only)
  const winnerFinalHpPct = results.filter(r => r.won).map(r => r.finalHp / r.finalMaxHp);

  // Skill levels at run end
  const skillMaxFreq = { whittling: 0, weaving: 0, smithing: 0, felting: 0 };
  for (const r of results) for (const [s, v] of Object.entries(r.finalSkills || {})) {
    if (v >= SKILL_MAX) skillMaxFreq[s]++;
  }
  const meanSkill = { whittling: 0, weaving: 0, smithing: 0, felting: 0 };
  for (const sk of Object.keys(meanSkill)) {
    meanSkill[sk] = mean(results.map(r => r.finalSkills?.[sk] || 0));
  }

  return {
    N, wins, winRate: wins / N,
    failedAt,
    bossLossByAct, bossWinByAct,
    lossByEnemyId,
    totalCasts, totalResonated, resonateRate: totalCasts ? totalResonated / totalCasts : 0,
    totalFizzles, fizzleRate: totalCasts > 0 ? totalFizzles / (totalCasts + totalFizzles) : 0,
    avgTurnsByTier,
    avgTurnsAll: allCombats.length ? mean(allCombats.map(c => c.turns)) : 0,
    materialFreq,
    qualityBySlot,
    salvagedCount,
    winnerFinalHpPct: winnerFinalHpPct.length ? mean(winnerFinalHpPct) : 0,
    skillMaxFreq,
    meanSkill,
    finalDeckSizeMean: mean(results.map(r => r.finalDeckSize)),
  };
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }

function buildReport(agg) {
  const lines = [];
  lines.push(`# Wizard Graduation — Playtest Report`);
  lines.push('');
  lines.push(`N = **${agg.N}** runs simulated with a greedy AI (prioritises high-damage casts, defends when intent threatens KO, picks rare/uncommon rewards).`);
  lines.push('');
  lines.push(`## Win rate`);
  lines.push(`- **${agg.wins} wins / ${agg.N}** = **${pct(agg.winRate)}**`);
  lines.push(`- Failures by act: act 1: ${agg.failedAt[1]} · act 2: ${agg.failedAt[2]} · act 3: ${agg.failedAt[3]} · act 4: ${agg.failedAt[4]}`);
  lines.push('');
  lines.push(`## Boss outcomes`);
  for (const id of [1,2,3,4]) {
    const w = agg.bossWinByAct[id] || 0;
    const l = agg.bossLossByAct[id] || 0;
    const tot = w + l;
    const wr = tot ? pct(w / tot) : 'n/a';
    lines.push(`- Act ${id}: ${w}W / ${l}L (${wr}, n=${tot})`);
  }
  lines.push('');
  lines.push(`## Combat pacing`);
  lines.push(`- Avg turns / combat (all tiers): **${agg.avgTurnsAll.toFixed(2)}**`);
  for (const t of ['normal','elite','boss']) {
    lines.push(`  - ${t}: ${agg.avgTurnsByTier[t]?.toFixed(2) || '0'}`);
  }
  lines.push('');
  lines.push(`## Cast / resonance / fizzle`);
  lines.push(`- Total casts: ${agg.totalCasts}`);
  lines.push(`- Resonance triggered: ${agg.totalResonated} (**${pct(agg.resonateRate)}** of casts)`);
  lines.push(`- Spells fizzled (staged but never CAST): ${agg.totalFizzles}`);
  lines.push(`- Fizzle rate: ${pct(agg.fizzleRate)}`);
  lines.push('');
  lines.push(`## Material picks (sorted by frequency)`);
  const matRanked = Object.entries(agg.materialFreq).sort((a, b) => b[1] - a[1]);
  for (const [id, count] of matRanked) {
    lines.push(`- ${id}: ${count}`);
  }
  lines.push('');
  lines.push(`## Craft quality by slot`);
  for (const slot of ['staff','robes','ring','hat']) {
    const q = agg.qualityBySlot[slot];
    const tot = q.rough + q.fine + q.master;
    lines.push(`- ${slot}: Master ${q.master} (${tot ? pct(q.master/tot) : '0%'}) · Fine ${q.fine} (${tot ? pct(q.fine/tot) : '0%'}) · Rough ${q.rough} (${tot ? pct(q.rough/tot) : '0%'})`);
  }
  lines.push(`- Salvaged-Scrap fallbacks: ${agg.salvagedCount}`);
  lines.push('');
  lines.push(`## Skill levels at run end`);
  for (const sk of ['whittling','weaving','smithing','felting']) {
    lines.push(`- ${sk}: mean ${agg.meanSkill[sk].toFixed(2)} (max-cap reached in ${agg.skillMaxFreq[sk]} runs)`);
  }
  lines.push('');
  lines.push(`## Winners`);
  lines.push(`- Final HP %: ${pct(agg.winnerFinalHpPct)} of max (mean)`);
  lines.push(`- Final deck size (mean across all runs): ${agg.finalDeckSizeMean.toFixed(2)} cards`);
  lines.push('');
  lines.push(`## Enemies that killed the player`);
  const lossRanked = Object.entries(agg.lossByEnemyId).sort((a, b) => b[1] - a[1]);
  if (lossRanked.length === 0) lines.push(`- (no KOs — sim is well-behaved or AI too cautious)`);
  for (const [id, count] of lossRanked) {
    lines.push(`- ${id}: ${count}`);
  }
  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// 6. DRIVER
// =============================================================================

const N = parseInt(process.argv[2] || '50', 10);
console.log(`Running ${N} playtests…`);
const results = [];
for (let i = 0; i < N; i++) {
  results.push(simRun());
  if ((i + 1) % 10 === 0) console.log(`  …${i + 1} done`);
}
const agg = aggregate(results);
const report = buildReport(agg);
const outPath = path.join(__dirname, 'report.md');
fs.writeFileSync(outPath, report);
console.log(`\nWrote ${outPath}`);
console.log(`Win rate: ${pct(agg.winRate)}`);
console.log(`Avg turns / combat: ${agg.avgTurnsAll.toFixed(2)}`);
console.log(`Resonance hit rate: ${pct(agg.resonateRate)}`);
console.log(`Fizzle rate: ${pct(agg.fizzleRate)}`);
