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
    stats: { handler: 1 }, tags: ['dismissive', 'sarcastic'] },
  { id: 'w-erm', name: 'Erm…', cost: 0, type: 'word', rarity: 'basic',
    stats: { jnsq: 1 }, tags: ['chaotic'] },
  // ---- WORD COMMON ----
  { id: 'w-actually', name: 'Actually,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 1, handler: 1 }, tags: ['sarcastic', 'dismissive'] },
  { id: 'w-look-here', name: 'Look here,', cost: 0, type: 'word', rarity: 'common',
    stats: { handler: 2 }, tags: ['booming', 'threatening'] },
  { id: 'w-suppose', name: 'Suppose, hypothetically,', cost: 1, type: 'word', rarity: 'common',
    stats: { wit: 3 }, tags: ['academic', 'rhetorical'] },
  { id: 'w-mutters', name: 'Mutters dark Latin', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 2 }, tags: ['mystical', 'chaotic'] },
  { id: 'w-stares', name: 'Stares', cost: 0, type: 'word', rarity: 'common',
    stats: { handler: 1, jnsq: 1 }, tags: ['threatening', 'theatrical'] },
  { id: 'w-footnote', name: 'A Lengthy Footnote', cost: 1, type: 'word', rarity: 'common',
    stats: { wit: 2, jnsq: 1 }, tags: ['academic', 'rhetorical'] },
  // ---- WORD UNCOMMON ----
  { id: 'w-rhetorical', name: 'A Rhetorical Question', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { wit: 4 }, tags: ['rhetorical', 'academic'] },
  { id: 'w-thundering', name: 'Thundering Aside', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { handler: 4 }, tags: ['booming', 'formal'] },
  { id: 'w-non-sequitur', name: 'Non Sequitur', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { jnsq: 4 }, tags: ['absurd', 'chaotic'] },
  { id: 'w-dramatic-pause', name: 'Dramatic Pause', cost: 0, type: 'word', rarity: 'uncommon',
    stats: { handler: 1, wit: 1, jnsq: 1 }, tags: ['theatrical', 'mystical'],
    effects: { draw: 1 } },
  { id: 'w-corner-them', name: 'Corner Them', cost: 0, type: 'word', rarity: 'common',
    stats: { handler: 3 }, tags: ['threatening', 'dismissive'],
    effects: { loseHp: 2 } },
  // Cycle 4 batch 2: word-pool depth for wit and jnsq resonance chains.
  { id: 'w-allegedly', name: 'Allegedly,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 1 }, tags: ['rhetorical', 'sarcastic'] },
  { id: 'w-as-written', name: 'As written,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 2 }, tags: ['academic', 'formal'] },
  { id: 'w-in-conclusion', name: 'In conclusion,', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { wit: 3 }, tags: ['rhetorical', 'formal'] },
  // Cycle 6 batch 1: wit pool depth + sustain.
  { id: 'w-per-precedent', name: 'Per the precedent,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 2 }, tags: ['formal', 'rhetorical'] },
  { id: 'w-pardon-digression', name: 'Pardon the digression,', cost: 0, type: 'word', rarity: 'common',
    stats: { wit: 1 }, tags: ['rhetorical', 'academic'],
    effects: { heal: 2 } },
  { id: 'w-astrally', name: 'Astrally speaking,', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 1 }, tags: ['mystical', 'absurd'] },
  { id: 'w-three-at-once', name: 'Three things at once,', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 2 }, tags: ['chaotic', 'absurd'] },
  { id: 'w-by-moonlight', name: 'By moonlight,', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { jnsq: 3 }, tags: ['mystical', 'chaotic'] },
  { id: 'w-bruise-it-out', name: 'Bruise it out,', cost: 0, type: 'word', rarity: 'common',
    stats: { handler: 2 }, tags: ['threatening', 'dismissive'],
    effects: { heal: 2 } },
  // Cycle 4 batch 5: three new handler words (lane was 6, now 9).
  { id: 'w-point-of-fact', name: 'In point of fact,', cost: 0, type: 'word', rarity: 'common',
    stats: { handler: 1 }, tags: ['dismissive', 'formal'] },
  { id: 'w-as-policy', name: 'As a matter of policy,', cost: 0, type: 'word', rarity: 'common',
    stats: { handler: 2 }, tags: ['dismissive', 'threatening'] },
  { id: 'w-misunderstand', name: 'You misunderstand,', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { handler: 3 }, tags: ['dismissive', 'sarcastic'] },
  // Cycle 5 batch 1: three new jnsq words (lane was 6, now 9).
  { id: 'w-mind-chickens', name: 'Mind the chickens,', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 1 }, tags: ['absurd', 'chaotic'] },
  { id: 'w-third-tuesday', name: 'On the third Tuesday,', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 2 }, tags: ['chaotic', 'absurd'] },
  { id: 'w-which-case-moon', name: 'In which case, the moon,', cost: 1, type: 'word', rarity: 'uncommon',
    stats: { jnsq: 3 }, tags: ['mystical', 'absurd'] },
  // Cycle 5 batch 3: jnsq sustain word (analog to "Bruise it out").
  { id: 'w-drunk-starlight', name: 'Drunk on starlight,', cost: 0, type: 'word', rarity: 'common',
    stats: { jnsq: 1 }, tags: ['mystical', 'chaotic'],
    effects: { heal: 2 } },

  // ---- EFFECT CARDS (basic / starter) ----
  { id: 'e-persuade', name: 'Persuade', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'wit', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic', 'formal'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-bluster', name: 'Bluster', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'handler', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['booming', 'threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-bewilder', name: 'Bewilder', cost: 1, type: 'effect', rarity: 'basic',
    effect: { scaleBy: 'jnsq', base: 2, multiplier: 2, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical', 'chaotic'], resonanceBonus: { perTag: 2 } } },
  // ---- EFFECT COMMON ----
  { id: 'e-convince', name: 'Convince', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-intimidate', name: 'Intimidate', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'handler', base: 4, multiplier: 2, damageType: 'composure',
              rider: { weak: 1 }, resonatesWith: ['threatening', 'booming'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-misdirect', name: 'Misdirect', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure',
              rider: { vulnerable: 1 }, resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-strike', name: 'Strike', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'handler', base: 6, multiplier: 1, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
  // ---- EFFECT UNCOMMON ----
  { id: 'e-refute', name: 'Refute', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'wit', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-cutting-remark', name: 'A Cutting Remark', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'handler', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['dismissive', 'petty'], resonanceBonus: { perTag: 2 } } },
  // Cycle 4 batch 5: handler engine card. +1 draw after cast, modest dmg.
  { id: 'e-press-the-point', name: 'Press the Point', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'handler', base: 3, multiplier: 2, damageType: 'composure',
              drawAfterCast: 1,
              resonatesWith: ['dismissive', 'rhetorical'], resonanceBonus: { perTag: 1 } } },
  // Cycle 5 batch 1: jnsq engine card (mirror of Press the Point).
  { id: 'e-free-association', name: 'Free Association', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 3, multiplier: 2, damageType: 'composure',
              drawAfterCast: 1,
              resonatesWith: ['absurd', 'chaotic'], resonanceBonus: { perTag: 1 } } },
  // Cycle 5 batch 3: jnsq deep-stacking payoff.
  { id: 'e-bedlam-cascade', name: 'Bedlam Cascade', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['chaotic', 'absurd', 'mystical'], resonanceBonus: { perTag: 5 } } },
  // Cycle 6 batch 1: wit engine card.
  { id: 'e-footnote-cite', name: 'Footnote and Cite', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'wit', base: 3, multiplier: 2, damageType: 'composure',
              drawAfterCast: 1,
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 1 } } },
  { id: 'e-bamboozle', name: 'Bamboozle', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 2 } } },
  // Cycle 4: lane-closer cards for pure-verbal archetypes.
  { id: 'e-compounding-argument', name: 'Compounding Argument', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'wit', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic', 'formal'], resonanceBonus: { perTag: 4 } } },
  { id: 'e-genuine-threat', name: 'Genuine Threat', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 8, multiplier: 3, damageType: 'composure',
              resonatesWith: ['chaotic', 'mystical', 'absurd'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-dont-hold-back', name: 'Don\'t Hold Back', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'handler', base: 5, multiplier: 2, damageType: 'composure',
              loseHpOnPlay: 8, hpThresholdDouble: 40,
              resonatesWith: ['threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-polymath', name: 'Polymath', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'wit', base: 5, multiplier: 2, damageType: 'composure',
              sumAllStats: true,
              resonatesWith: ['formal', 'rhetorical', 'absurd', 'threatening'], resonanceBonus: { perTag: 1 } } },

  { id: 'e-non-sequitur', name: 'Non Sequitur', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 2, damageType: 'composure',
              resonatesWith: ['chaotic', 'absurd'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-calculated-risk', name: 'Calculated Risk', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 10, multiplier: 3, damageType: 'composure',
              chance: { prob: 0.6, success: { enemyVulnerable: 1 }, failure: { selfWeak: 1 } },
              resonatesWith: ['chaotic', 'mystical'], resonanceBonus: { perTag: 2 } } },
  // ---- PHYSICAL EFFECTS ----
  { id: 'e-spark', name: 'Spark', cost: 0, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 4, multiplier: 1, damageType: 'physical',
              resonatesWith: ['chaotic'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-magic-missile', name: 'Magic Missile', cost: 2, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'jnsq', base: 11, multiplier: 3, damageType: 'physical',
              resonatesWith: ['mystical'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-sword-logic', name: 'Sword Logic', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'handler', base: 5, multiplier: 2, damageType: 'physical',
              resonatesWith: ['threatening', 'dismissive'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-throw-the-book', name: 'Throw the Book', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'wit', base: 4, multiplier: 1, damageType: 'physical',
              resonatesWith: ['academic', 'formal'], resonanceBonus: { perTag: 2 } } },
  { id: 'e-flame-on', name: 'Flame On', cost: 1, type: 'effect', rarity: 'common',
    effect: { scaleBy: 'jnsq', base: 5, multiplier: 1, damageType: 'physical',
              resonatesWith: ['chaotic', 'mystical'], resonanceBonus: { perTag: 2 } } },
  // ---- EFFECT RARE ----
  { id: 'e-devastating', name: 'Devastating Truth', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'wit', base: 12, multiplier: 3, damageType: 'composure',
              resonatesWith: ['rhetorical', 'academic'], resonanceBonus: { perTag: 3 } } },
  { id: 'e-coup-de-grace', name: 'Coup de Grâce', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'handler', base: 14, multiplier: 3, damageType: 'composure', exhaust: true,
              resonatesWith: ['dismissive', 'formal'], resonanceBonus: { perTag: 3 } } },
  { id: 'e-paradox', name: 'A Functional Paradox', cost: 2, type: 'effect', rarity: 'rare',
    effect: { scaleBy: 'jnsq', base: 6, multiplier: 4, damageType: 'composure',
              rider: { vulnerable: 2 }, resonatesWith: ['absurd', 'mystical'], resonanceBonus: { perTag: 3 } } },
  // ---- ARCHETYPE-COMMITTING CARDS (cycle 4) ----
  { id: 'e-go-for-the-throat', name: 'Go For The Throat', cost: 1, type: 'effect', rarity: 'uncommon',
    effect: { scaleBy: 'handler', base: 8, multiplier: 3, damageType: 'composure',
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
    effect: { sway: true, swayTarget: 'handler', tactic: 'logic',
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
  { id: 'c-iron-stomach', name: 'Iron Stomach', cost: 1, type: 'skill', rarity: 'uncommon',
    effects: { heal: 5, boostNextHandlerCast: 0.5 } },
  { id: 'c-read-the-room', name: 'Read the Room', cost: 0, type: 'skill', rarity: 'uncommon',
    effects: { pierceNextCast: true, exhaust: true } },
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

// Mirror the App's slim starter (no jnsq, no physical). Without this,
// sim was running the old 11-card sampler and AI's reward picker
// actively avoided physical cards (because it had spark + sword-logic
// from the bad starter), masking real card-strategy data. Fix from
// cycle 2 batch 1 audit.
const STARTER_DECK = [
  'w-respect',                // wit ingredient
  'w-frankly',                // handler ingredient
  'e-persuade',               // basic wit attack
  'e-bluster',                // basic handler attack
  'c-channel',                // utility
  'c-defend', 'c-defend',     // block
];
// Same pool the player's Starting Picks screen samples — two cards
// added to the deck before the first map loads.
const STARTING_PICKS_POOL = [
  'w-frankly', 'e-strike',    // handler pair
  'w-respect', 'e-convince',  // wit pair
  'w-erm',     'e-bewilder',  // jnsq pair (the branch-out)
];

// =============================================================================
// 1b. HANDLER (Animal Summoner) ENGINE DATA — mirrors src/App.jsx ANIMALS,
//     src/cards/handler-v2.js lures, and the handler cards in src/App.jsx.
//     The live handler lane is purely lures → animals → tactics; it has NONE
//     of the old word-pool model. Animal composure damage applies RAW (the
//     game-wide effectiveness-per-stat multiplier was removed 2026-05-31,
//     App.jsx:9043), so handler attacks here are unscaled by enemy
//     effectiveness — only enemy block absorbs them.
// =============================================================================
const HANDLER_ANIMALS = {
  salmon:        { name: 'Salmon', attack: 0, duration: 3, feedKey: 'fish',
                   predatorChain: { animalId: 'bear', turnsToTrigger: 2 } },
  sparrow:       { name: 'Sparrow', attack: 5, duration: 2, feedKey: 'bird' },
  'field-mouse': { name: 'Field Mouse', attack: 2, duration: 3, feedKey: 'small-land',
                   onAttack: { draw: 1 }, onExit: { block: 3, healComp: 2 }, elite: 'mecha-mouse' },
  'mecha-mouse': { name: 'Mecha-Mouse', attack: 3, duration: 3, feedKey: 'small-land',
                   onAttack: { draw: 1 }, onExit: { block: 5, healComp: 3 } },
  rabbit:        { name: 'Rabbit', attack: 2, duration: 3, feedKey: 'small-land',
                   onAttack: { draw: 1 }, onExit: { healComp: 2 },
                   adjacentSpawn: { animalId: 'rabbit', turnsToTrigger: 2, extendSelfTurns: 2 }, elite: 'bonzai-bunaroo' },
  'bonzai-bunaroo': { name: 'Bonzai Bunaroo', attack: 3, duration: 3, feedKey: 'small-land',
                   onAttack: { draw: 1 }, onExit: { healComp: 3 },
                   adjacentSpawn: { animalId: 'bonzai-bunaroo', turnsToTrigger: 2, extendSelfTurns: 3 } },
  'young-buck':  { name: 'Young Buck', attack: 5, duration: 2, feedKey: 'small-land',
                   onExit: { damage: 6, damageType: 'composure', healHp: 1 }, elite: 'james-deer' },
  'james-deer':  { name: 'James Deer', attack: 8, duration: 2, feedKey: 'small-land',
                   onExit: { damage: 9, damageType: 'composure', healHp: 2 } },
  hawk:          { name: 'Hawk', attack: 4, duration: 3, feedKey: 'bird', onExit: { applyWeak: 1 } },
  'mouse-house': { name: 'Mouse House', attack: 8, duration: 2,
                   onAttackEffect: { applyVulnerable: 1 }, onExit: { healComp: 5 } },
  'long-hare':   { name: 'The Long Hare', attack: 8, duration: 2,
                   onAttackEffect: { applyWeak: 1 }, turnGrant: { poise: 5 }, onExit: { healComp: 5 } },
  mccloven:      { name: 'McCloven', attack: 10, duration: 2,
                   turnGrant: { block: 5 }, onExit: { healHp: 5 } },
  bear:          { name: 'Bear', attack: 9, duration: 3, feedKey: 'fish' },
};
const COMBINE_BY_SPECIES = { 'field-mouse': 'mouse-house', 'rabbit': 'long-hare', 'young-buck': 'mccloven' };

// Handler cards (lures / tactics / utility / defends). `slot:'lure'` cards
// stage into an empty tray slot and count down turnsToArrive. `slot:'tactic'`
// cards set combat.tactic. The rest are one-shot utility played from hand.
const HANDLER_CARDS = [
  { id: 'cv2-l-fish-food', name: 'Fish Food', cost: 1, type: 'lure', rarity: 'basic', feedKey: 'fish',
    summon: { animalId: 'salmon', turnsToArrive: 2 } },
  { id: 'cv2-l-birdseed', name: 'Birdseed', cost: 1, type: 'lure', rarity: 'basic', feedKey: 'bird',
    summon: { animalId: 'sparrow', turnsToArrive: 1 } },
  { id: 'cv2-l-tender-greens', name: 'Tender Greens', cost: 1, type: 'lure', rarity: 'basic', feedKey: 'small-land',
    summon: { animalIds: ['field-mouse', 'rabbit', 'young-buck'], turnsToArrive: 1, summonSet: 'tender-greens' } },
  { id: 'c-tactic-shield',  name: 'Summoned Shield',  cost: 1, type: 'tactic', rarity: 'common',   tactic: { id: 'shield' } },
  { id: 'c-tactic-rabid',   name: 'Rabid',            cost: 2, type: 'tactic', rarity: 'uncommon', tactic: { id: 'rabid' } },
  { id: 'c-tactic-youth',   name: 'Fountain of Youth',cost: 1, type: 'tactic', rarity: 'common',   tactic: { id: 'youth' } },
  { id: 'c-tactic-nurture', name: 'Nurture',          cost: 2, type: 'tactic', rarity: 'uncommon', tactic: { id: 'nurture' } },
  { id: 'c-tactic-feather', name: 'Birds of a Feather',cost: 1, type: 'tactic', rarity: 'common',  tactic: { id: 'feather', requiresExactlyOneAnimal: true } },
  { id: 'c-shoo',        name: 'Shoo!',     cost: 1, type: 'handler-util', rarity: 'basic',    util: 'shoo' },
  { id: 'c-pack-tactics',name: 'On Three!', cost: 2, type: 'handler-util', rarity: 'uncommon', util: 'onThree', exhaust: true },
  { id: 'c-just-eat-it', name: 'Just Eat It',cost: 1, type: 'handler-util', rarity: 'common',  util: 'eatNow', exhaust: true },
  { id: 'c-buffet',      name: 'Buffet',    cost: 2, type: 'handler-util', rarity: 'uncommon', util: 'buffet', exhaust: true },
  { id: 'c-treat',       name: 'Treat',     cost: 1, type: 'handler-util', rarity: 'common',   util: 'treat' },
  { id: 'c-defend-handler', name: 'Step Back', cost: 1, type: 'handler-skill', rarity: 'basic', effects: { block: 6 } },
  { id: 'c-compose',     name: 'Compose Yourself', cost: 1, type: 'handler-skill', rarity: 'basic', effects: { poise: 7, removeWeak: 1 } },
  { id: 'c-sharp-aside', name: 'Sharp Whistle', cost: 1, type: 'handler-skill', rarity: 'uncommon', effects: { compDmg: 4 } },
];
const HANDLER_CARDS_BY_ID = Object.fromEntries(HANDLER_CARDS.map(c => [c.id, c]));

// Handler opening deck (mirrors buildStarterDeckForLane('handler'), App.jsx:903).
const HANDLER_STARTER = [
  'c-defend-handler', 'c-defend-handler', 'c-compose',
  'cv2-l-tender-greens', 'cv2-l-tender-greens',
  'c-shoo', 'c-pack-tactics', 'c-buffet', 'c-tactic-shield',
];
// Cards the handler reward picker can draft. Weighted toward tactic VARIETY
// (the heuristic this whole engine exists to model) plus the off-starter lures.
const HANDLER_REWARD_POOL = [
  'cv2-l-fish-food', 'cv2-l-birdseed', 'cv2-l-tender-greens',
  'c-tactic-rabid', 'c-tactic-youth', 'c-tactic-nurture', 'c-tactic-feather', 'c-tactic-shield',
  'c-pack-tactics', 'c-just-eat-it', 'c-buffet', 'c-treat', 'c-sharp-aside',
];

// --- ENEMIES ---
const ENEMIES = [
  // ACT 1
  { id: 'e1-acolyte', act: 4, name: 'Lost Acolyte', composureMax: 20, hpMax: 18, tier: 'normal',
    effectiveness: { handler: 1.5, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 3 },
      { kind: 'block',  value: 5, weight: 1 },
      { kind: 'attack', value: 3, weight: 2 },
    ] },
  { id: 'e1-imp', act: 4, name: 'Pact Imp', composureMax: 18, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 4, weight: 3, riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 2 },
      { kind: 'vulnerable', value: 1, weight: 1 },
    ] },
  { id: 'e1-shrine-rat', act: 4, name: 'Shrine Rat Pack', composureMax: 16, hpMax: 12, tier: 'normal',
    effectiveness: { handler: 0.5, wit: 0.5, jnsq: 1.0, physical: 1.5 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3 },
      { kind: 'block',  value: 4, weight: 1 },
      { kind: 'attack', value: 5, weight: 2 },
    ] },
  { id: 'e1-tutor', act: 4, name: 'Stern Tutor', composureMax: 32, hpMax: 999, tier: 'elite',
    effectiveness: { handler: 0.5, wit: 0.5, jnsq: 2.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1 },
      { kind: 'block',  value: 7, weight: 1 },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1 },
    ] },
  { id: 'e1-thicket', act: 4, name: 'Living Thicket', composureMax: 55, hpMax: 38, tier: 'elite',
    effectiveness: { handler: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 2 },
      { kind: 'block',  value: 9, weight: 2 },
      { kind: 'vulnerable', value: 1, weight: 1 },
    ] },
  { id: 'e1-boss-thornlord', act: 4, name: 'The Thornlord', composureMax: 100, hpMax: 120, tier: 'boss',
    effectiveness: { handler: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 15, weight: 2 },
      { kind: 'attack-multi', value: 5, count: 4, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'block',  value: 16, weight: 1 },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1 },
    ] },
  // ACT 2
  { id: 'e2-hollow-weaver', act: 1, name: 'Hollow Weaver', composureMax: 22, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 6, weight: 2 },
      { kind: 'weak',   value: 1, weight: 1 },
    ] },
  { id: 'e2-silk-wraith', act: 1, name: 'Silk Wraith', composureMax: 18, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 0.7, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 3, weight: 3 },
      { kind: 'block',  value: 6, weight: 1 },
      { kind: 'vulnerable', value: 1, weight: 2 },
    ] },
  { id: 'e2-loom-familiar', act: 1, name: 'Loom Familiar', composureMax: 24, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 1.0, wit: 1.0, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 2 },
      { kind: 'block',  value: 8, weight: 2 },
      { kind: 'attack', value: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'weak',   value: 1, weight: 1 },
    ] },
  { id: 'e2-pattern-maker', act: 1, name: 'The Pattern-Maker', composureMax: 34, hpMax: 999, tier: 'elite',
    effectiveness: { handler: 1.0, wit: 1.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 8, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1 },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1 },
    ] },
  { id: 'e2-silent-spinner', act: 1, name: 'The Silent Spinner', composureMax: 38, hpMax: 999, tier: 'elite',
    effectiveness: { handler: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'block',  value: 8, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 7, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 9, weight: 1 },
    ] },
  { id: 'e2-boss-tapestry', act: 1, name: 'The Tapestry Walker', composureMax: 52, hpMax: 999, tier: 'boss',
    effectiveness: { handler: 1.0, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 10, weight: 2, riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2 },
      { kind: 'attack', value: 7, pool: 'composure', weight: 1 },
      { kind: 'block',  value: 10, weight: 1 },
    ] },
  // ACT 3
  { id: 'e3-geode-crab', act: 2, name: 'Geode Crab', composureMax: 35, hpMax: 22, tier: 'normal',
    effectiveness: { handler: 0.5, wit: 0.6, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 5, weight: 3 },
      { kind: 'block',  value: 8, weight: 1 },
      { kind: 'attack', value: 7, weight: 1 },
    ] },
  { id: 'e3-glow-mite', act: 2, name: 'Glow Mite Swarm', composureMax: 26, hpMax: 26, tier: 'normal',
    effectiveness: { handler: 0.5, wit: 0.5, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack-multi', value: 2, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack-multi', value: 2, count: 4, weight: 1 },
      { kind: 'weak',   value: 1, weight: 1 },
    ] },
  { id: 'e3-crystal-beetle', act: 2, name: 'Crystal Beetle', composureMax: 35, hpMax: 22, tier: 'normal',
    effectiveness: { handler: 0.5, wit: 0.6, jnsq: 0.6, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 6, weight: 3 },
      { kind: 'attack', value: 8, weight: 1 },
      { kind: 'block',  value: 5, weight: 1 },
    ] },
  { id: 'e3-quartz-sentinel', act: 2, name: 'Quartz Sentinel', composureMax: 40, hpMax: 40, tier: 'elite',
    effectiveness: { handler: 0.5, wit: 0.5, jnsq: 0.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 9, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'block',  value: 10, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 3, count: 3, weight: 1 },
    ] },
  { id: 'e3-vein-devourer', act: 2, name: 'Vein Devourer', composureMax: 75, hpMax: 50, tier: 'elite',
    effectiveness: { handler: 0.5, wit: 0.5, jnsq: 0.6, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 13, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 5, count: 3, weight: 1 },
      { kind: 'attack', value: 14, weight: 1 },
    ] },
  { id: 'e3-boss-anvil', act: 2, name: 'The Anvil-Forged', composureMax: 78, hpMax: 75, tier: 'boss',
    effectiveness: { handler: 0.7, wit: 1.0, jnsq: 1.5, physical: 1.0 },
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1 },
      { kind: 'block',  value: 12, weight: 1 },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1 },
    ] },
  // ACT 4
  { id: 'e4-apprentice-shade', act: 3, name: "Apprentice's Shade", composureMax: 42, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 1.5, wit: 1.0, jnsq: 0.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 10, weight: 3 },
      { kind: 'block',  value: 10, weight: 2 },
      { kind: 'attack', value: 8, weight: 2, riders: { weak: 1 } },
    ] },
  { id: 'e4-failed-initiate', act: 3, name: 'Failed Initiate', composureMax: 38, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 1.5, wit: 0.5, jnsq: 1.0, physical: 1.0 },
    behaviors: [
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 1 },
      { kind: 'weak',   value: 2, weight: 1 },
    ] },
  { id: 'e4-mirror-past', act: 3, name: 'Mirror of the Past', composureMax: 44, hpMax: 999, tier: 'normal',
    effectiveness: { handler: 0.7, wit: 1.5, jnsq: 1.0, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'vulnerable', value: 2, weight: 2 },
      { kind: 'block',  value: 8, weight: 1, riders: { weak: 1 } },
    ] },
  { id: 'e4-forgotten-master', act: 3, name: 'The Forgotten Master', composureMax: 55, hpMax: 999, tier: 'elite',
    effectiveness: { handler: 0.7, wit: 1.0, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2, riders: { vulnerable: 1 } },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 5, pool: 'composure', weight: 1 },
    ] },
  { id: 'e4-test-wraith', act: 3, name: 'The Test Wraith', composureMax: 50, hpMax: 999, tier: 'elite',
    effectiveness: { handler: 1.0, wit: 0.5, jnsq: 1.5, physical: 0.5 },
    behaviors: [
      { kind: 'attack', value: 11, weight: 2, riders: { weak: 1, vulnerable: 1 } },
      { kind: 'attack', value: 6, pool: 'composure', weight: 1 },
      { kind: 'weak',   value: 2, weight: 1 },
      { kind: 'attack-multi', value: 3, count: 4, weight: 1 },
    ] },
  { id: 'e4-boss-headmasters-hat', act: 3, name: "The Headmaster's Hat", composureMax: 88, hpMax: 999, tier: 'boss',
    effectiveness: { handler: 1.0, wit: 1.5, jnsq: 0.5, physical: 0.4 },
    behaviors: [
      { kind: 'attack', value: 12, weight: 2 },
      { kind: 'attack-multi', value: 4, count: 4, weight: 2, riders: { weak: 1 } },
      { kind: 'attack', value: 8, pool: 'composure', weight: 1 },
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
    { id: 'mat-maple',    name: 'Maple Wood',  slot: 'staff', stats: { handler: 3 } },
    { id: 'mat-rosewood', name: 'Rosewood',    slot: 'staff', stats: { handler: 4, loseHp: 3 } },
    { id: 'mat-cedar',    name: 'Cedar',       slot: 'staff', stats: { handler: 2, defense: 2 } },
    { id: 'mat-madrone',  name: 'Madrone',     slot: 'staff', stats: { handler: 3, chance: 1, jnsq: 1 } },
    { id: 'mat-hemlock',  name: 'Hemlock',     slot: 'staff', stats: { handler: 2, dot: 3 } },
  ],
  robes: [
    { id: 'mat-linen',       name: 'Linen Thread', slot: 'robes', stats: { defense: 4 } },
    { id: 'mat-wild-silk',   name: 'Wild Silk',    slot: 'robes', stats: { regen: 2, draw: 1 } },
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
const INTER_ACT_HEAL_RATIO = 0.55;
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
    const baseAtk = mult(8 + (matStats.handler || 0) * 2);
    const multAtk = mult(2 + (matStats.handler || 0));
    const resonatesWith = [];
    if ((matStats.handler || 0) >= 3) resonatesWith.push('booming');
    if ((matStats.loseHp || 0)   >= 1) resonatesWith.push('threatening');
    if ((matStats.defense || 0)  >= 1) resonatesWith.push('formal');
    if ((matStats.jnsq || 0)     >= 1) resonatesWith.push('absurd');
    if ((matStats.dot || 0)      >= 1) resonatesWith.push('threatening');
    if ((matStats.chance || 0)   >= 1) resonatesWith.push('chaotic');
    if (resonatesWith.length === 0)    resonatesWith.push('dismissive');
    const effect = {
      scaleBy: 'handler', base: baseAtk, multiplier: multAtk, damageType: 'composure',
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
    tray: { handler: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: false },
    turn: 0,
    // Per-combat stats
    fizzles: 0,
    castsAttempted: 0,
    castsResonated: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    amplifyPlays: 0,
    // Handler (Animal Summoner) combat state + metrics.
    isHandler: !!state.isHandler,
    htray: { intro: null, subject: null, target: null },
    tactic: null,            // active tactic id ('shield'|'rabid'|'youth'|'nurture'|'feather')
    youthUses: 0,            // Fountain of Youth: remaining lure plays that get +1 dur
    buffetArmed: false,      // next lure fills every empty slot
    handlerTicks: 0,
    tacticChanges: 0,
    tacticsEngaged: {},      // id -> times engaged
    tacticTurns: {},         // id -> turns active
    summons: 0,
    feeds: 0,
    shortStays: 0,
    combines: 0,
    menagerieComposure: 0,
    menagerieBlock: 0,
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
  combat.tray.handler += (stats.handler || 0);
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
  if (fx.pierceNextCast) combat.pierceNextCast = true;
  if (fx.boostNextHandlerCast) combat.boostNextHandlerCast = fx.boostNextHandlerCast;
  if (fx.block)      state.block += fx.block;
  if (fx.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * fx.vulnerable);
  if (fx.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * fx.weak);
  if (fx.energy)     state.energy += fx.energy;
  if (fx.hp)         state.hp = clamp(state.hp + fx.hp, 0, state.maxHp);
  if (fx.draw)       drawCards(state, fx.draw);
  // Cycle-4 archetype additions:
  if (fx.loseHp)         state.hp = clamp(state.hp - fx.loseHp, 0, state.maxHp);
  if (fx.selfWeak)       combat.playerDmgMult = Math.max(0.5, combat.playerDmgMult - 0.25 * fx.selfWeak);
  if (fx.removeWeak)     combat.playerDmgMult = Math.min(1.0, combat.playerDmgMult + 0.25 * fx.removeWeak);
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
  // Sway: model as a 50% chance to boost the target effectiveness by
  // +0.5 (cap 1.0). Crude approximation of the App's tactic + softSpot
  // probability math; good enough to give the reward picker meaningful
  // signal that these cards aren't dead weight.
  if (eff.sway) {
    if (Math.random() < 0.5) {
      const dim = eff.swayTarget;
      const before = combat.enemy?.effectiveness?.[dim] ?? 1;
      const after = Math.min(1.0, before + 0.5);
      if (after > before) combat.enemy.effectiveness = { ...combat.enemy.effectiveness, [dim]: after };
    }
    for (const w of combat.tray.words) {
      if (w.effects?.exhaust) state.exiled.push(w); else state.discard.push(w);
    }
    if (eff.exhaust) state.exiled.push(card); else state.discard.push(card);
    combat.tray = { handler: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: true };
    return;
  }
  // Insult: model as 60% chance to land for landDamage*0.7 (accounts
  // for soft-spot misses and partial alignment). Pay the composure
  // cost regardless (composure isn't tracked in sim, so this just
  // doesn't apply for now — flagged for cycle 3 if needed).
  if (eff.insult) {
    const landed = Math.random() < 0.6;
    if (landed) {
      const wit_mult = combat.enemy?.effectiveness?.wit ?? 1.0;
      const dmg = Math.round((eff.landDamage || 10) * 0.7 * wit_mult * combat.playerDmgMult);
      let remaining = dmg;
      if (combat.enemyBlock > 0) {
        const absorbed = Math.min(combat.enemyBlock, remaining);
        combat.enemyBlock -= absorbed; remaining -= absorbed;
      }
      combat.enemyComposure = Math.max(0, combat.enemyComposure - remaining);
      combat.totalDamageDealt += dmg;
    }
    for (const w of combat.tray.words) {
      if (w.effects?.exhaust) state.exiled.push(w); else state.discard.push(w);
    }
    if (eff.exhaust) state.exiled.push(card); else state.discard.push(card);
    combat.tray = { handler: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: true };
    return;
  }
  const stat = eff.scaleBy || 'wit';
  const trayVal = eff.sumAllStats
    ? (combat.tray.handler || 0) + (combat.tray.wit || 0) + (combat.tray.jnsq || 0)
    : (combat.tray[stat] || 0);
  let dmg = (eff.base || 0) + trayVal * (eff.multiplier || 0);
  const dmgType = eff.damageType || 'composure';
  const piercing = !!combat.pierceNextCast;
  if (piercing) combat.pierceNextCast = false;
  const eff_mult = piercing ? 1.0 : (combat.enemy?.effectiveness?.[stat] ?? 1.0);
  const phys_mult = piercing ? 1.0 : (combat.enemy?.effectiveness?.physical ?? 1.0);
  if (dmgType === 'physical') dmg = Math.round(dmg * phys_mult);
  else                        dmg = Math.round(dmg * eff_mult);
  // Don't-Hold-Back threshold doubler.
  if (eff.hpThresholdDouble && state.hp < eff.hpThresholdDouble) dmg *= 2;
  // Iron-Stomach handler boost (consumed by the next handler cast).
  if (combat.boostNextHandlerCast > 0 && stat === 'handler') {
    dmg = Math.round(dmg * (1 + combat.boostNextHandlerCast));
    combat.boostNextHandlerCast = 0;
  }
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
  combat.tray = { handler: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: true };

  // onEffectCardPlayed power triggers.
  for (const p of combat.powers) {
    const trig = p.power?.onEffectCardPlayed;
    if (!trig) continue;
    if (trig.vulnerable) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * trig.vulnerable);
    if (trig.weak)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * trig.weak);
  }

  // Cycle 4 batch 5: drawAfterCast (Press the Point engine).
  if (eff.drawAfterCast) drawCards(state, eff.drawAfterCast);
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
  if (combat.isHandler) return aiTurnHandler(state, combat);
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
    if (expectedDamage > state.block + 1) {
      const defendIdx = state.hand.findIndex(c => c.type === 'skill' && c.cost <= state.energy && c.effects?.block);
      if (defendIdx >= 0) { playSkillOrPower(state, combat, defendIdx); continue; }
    }
    // Cycle 2 batch 5 ATTEMPTED an unwinnable-fight defense pivot. It
    // turned quick deaths into slow stalls (player defends 60 turns, hits
    // safety timer, still loses) — strictly worse than swinging for damage.
    // Reverted; defense pivot stays purely turn-by-turn (block + 1 above).

    // Card-draw skills if hand small and we have energy.
    if (state.hand.length <= 2) {
      const drawIdx = state.hand.findIndex(c => c.type === 'skill' && c.cost <= state.energy && c.effects?.draw);
      if (drawIdx >= 0) { playSkillOrPower(state, combat, drawIdx); continue; }
    }

    // Cycle 3: Read the Room — pierce the next cast against a hostile
    // matchup. Trigger when enemy's best-effectiveness-to-our-deck stat
    // is ≤0.6 (we'd otherwise hit at half damage).
    if (!combat.pierceNextCast) {
      const eff = combat.enemy?.effectiveness || {};
      const bestForUs = Math.max(eff.handler ?? 1, eff.wit ?? 1, eff.jnsq ?? 1);
      if (bestForUs <= 0.6) {
        const pierceIdx = state.hand.findIndex(c => c.type === 'skill' && c.cost <= state.energy && c.effects?.pierceNextCast);
        if (pierceIdx >= 0) { playSkillOrPower(state, combat, pierceIdx); continue; }
      }
    }
    // Cycle 4 batch 3: Iron Stomach — heal + next handler cast boost.
    // Play it when we're committed to handler and the boost isn't already
    // active. The heal also helps with handler's self-damage burn.
    if (!combat.boostNextHandlerCast) {
      const allCards = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
      const handlerDeck = allCards.filter(c =>
        (c.type === 'word' && c.stats?.handler) ||
        (c.type === 'effect' && c.effect?.scaleBy === 'handler')
      ).length;
      if (handlerDeck >= 4) {
        const isIdx = state.hand.findIndex(c => c.type === 'skill' && c.cost <= state.energy && c.effects?.boostNextHandlerCast);
        if (isIdx >= 0) { playSkillOrPower(state, combat, isIdx); continue; }
      }
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
      combat.tray = { handler: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: false };
    } else {
      combat.tray = { handler: 0, wit: 0, jnsq: 0, tags: [], words: [], effectCard: null, effectFiredThisTurn: false };
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
    const previewTray = { handler: combat.tray.handler, wit: combat.tray.wit, jnsq: combat.tray.jnsq, tags: [...combat.tray.tags] };
    for (const w of wordObjs) {
      const s = w.stats || {};
      previewTray.handler += s.handler || 0;
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
    let wPoise = state.poise || 0;
    let wHp = state.hp;
    let wComp = state.composure;
    // Live game (App.jsx ~3659): Block absorbs HP/physical, Poise absorbs
    // composure — two separate pools. Handler runs carry a poise pool; for
    // them a composure attack is soaked by poise. Non-handler runs have no
    // poise, so block soaks everything (unchanged behavior).
    const compPool = combat.isHandler ? 'poise' : 'block';
    for (let i = 0; i < hits; i++) {
      let remaining = raw;
      if (defense > 0 && remaining > 0) remaining = Math.max(1, remaining - defense);
      const soakWithPoise = targetsComposure && compPool === 'poise';
      if (soakWithPoise) {
        if (wPoise > 0) { const a = Math.min(wPoise, remaining); wPoise -= a; remaining -= a; }
      } else if (wBlock > 0) {
        const a = Math.min(wBlock, remaining); wBlock -= a; remaining -= a;
      }
      if (targetsComposure) wComp = Math.max(0, wComp - remaining);
      else                  wHp   = Math.max(0, wHp   - remaining);
      combat.totalDamageTaken += remaining;
      if (wHp <= 0 || wComp <= 0) break;
    }
    state.block = wBlock;
    state.poise = wPoise;
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

// =============================================================================
// 3b. HANDLER (Animal Summoner) COMBAT ENGINE
//     Faithful port of the App.jsx end-of-turn menagerie tick + a handler AI
//     that stages lures, engages tactics (with a VARIETY preference — the
//     thing this whole engine exists to let the sim model), feeds animals on
//     their make-or-break turn, and spikes with On Three!. Animal damage is
//     RAW composure (enemy block absorbs); enemy block/poise pools as live.
// =============================================================================
function handlerDealComposure(combat, amount) {
  let remaining = amount;
  if (combat.enemyBlock > 0) { const a = Math.min(combat.enemyBlock, remaining); combat.enemyBlock -= a; remaining -= a; }
  combat.enemyComposure = Math.max(0, combat.enemyComposure - remaining);
}
function handlerDealHp(combat, amount) {
  let remaining = amount;
  if (combat.enemyBlock > 0) { const a = Math.min(combat.enemyBlock, remaining); combat.enemyBlock -= a; remaining -= a; }
  combat.enemyHp = Math.max(0, combat.enemyHp - remaining);
}
function makeAnimalSlot(animalId, youthBonus, summonSet) {
  const a = HANDLER_ANIMALS[animalId];
  return {
    kind: 'animal', animalId,
    durationRemaining: (a?.duration || 3) + (youthBonus || 0),
    predatorProgress: 0, adjacentSpawnProgress: 0, adjacentSpawned: false,
    summonSet: summonSet || null, feedReceived: false, nextAttackMult: 1,
  };
}
function resolveLureSpecies(lure, combat) {
  if (combat.tactic === 'feather') {
    const existing = ['intro', 'subject', 'target'].map(x => combat.htray[x]).find(v => v?.kind === 'animal');
    if (existing) return existing.animalId;
  }
  const s = lure.summon || lure;
  let id = (s.animalIds && s.animalIds.length) ? s.animalIds[Math.floor(Math.random() * s.animalIds.length)] : s.animalId;
  const base = HANDLER_ANIMALS[id];
  if (base?.elite && Math.random() < 0.035) id = base.elite;
  return id;
}
function handlerAnimalAttack(state, combat, slot, animal, baseMult) {
  let atk = Math.round(animal.attack * (baseMult || 1) * (slot.nextAttackMult || 1));
  slot.nextAttackMult = 1;
  const isShield = combat.tactic === 'shield';
  const isRabid  = combat.tactic === 'rabid';
  if (isRabid) atk = Math.round(atk * 1.5);
  if (isShield) {
    state.block += atk; state.poise += atk; combat.menagerieBlock += atk;
  } else {
    handlerDealComposure(combat, atk);
    combat.menagerieComposure += atk;
    combat.totalDamageDealt += atk;
    if (isRabid) state.composure = Math.max(0, state.composure - Math.max(1, Math.round(atk * 0.2)));
  }
  if (animal.onAttack?.draw) drawCards(state, animal.onAttack.draw);
  // Vulnerable on enemy → our outgoing damage up; Weak on enemy → its damage down.
  if (animal.onAttackEffect?.applyVulnerable > 0) combat.playerDmgMult = Math.min(1.5, combat.playerDmgMult + 0.25 * animal.onAttackEffect.applyVulnerable);
  if (animal.onAttackEffect?.applyWeak > 0)       combat.enemyDmgMult  = Math.max(0.5, combat.enemyDmgMult  - 0.25 * animal.onAttackEffect.applyWeak);
}
function clearHandlerSlot(next, slot, slotName) {
  if (slot.spans && slot.spans.length) { for (const s of slot.spans) next[s] = null; }
  else next[slotName] = null;
}

// Pick the best tactic card to play, biased toward VARIETY (tactics engaged
// fewest times this combat) so the sim exercises all 5 rather than camping one.
// Situational value of a tactic given the current board — IGNORING variety.
// This is "would a real player want this tactic right now?". Variety is only a
// tiebreaker (below), so tactic variety emerges from differing board states
// across combats rather than per-turn thrashing within one fight.
// isBoss: on boss tier, pre-staging the board fast is top priority.
function tacticSituationalValue(id, animals, haveLure, compPct, isBoss, canCombine) {
  switch (id) {
    // Rabid is ×1.5 damage but bleeds the PLAYER 20% composure per animal
    // attack — only worth it with composure to spare; actively harmful when low.
    case 'rabid':
      if (animals < 1) return 0;
      // On boss with animals already out, accept lower composure threshold.
      return (isBoss ? compPct > 0.4 : compPct > 0.6) ? 4 + animals + (isBoss ? 2 : 0) : 0;
    // Nurture resolves lures instantly — highest tempo value, especially vs boss.
    case 'nurture': return haveLure ? (isBoss ? 10 : 7) : 0;
    case 'youth':   return haveLure ? 5 : 1;
    // Feather forces same-species on next lure — key combine enabler when 1 animal out.
    // On boss, aggressively use feather to build toward a 3-of-a-kind combine.
    case 'feather': return animals === 1 ? (canCombine && isBoss ? 9 : isBoss ? 7 : 4) : 0;
    case 'shield':  return 0; // defense-only, gated by needDefense
    default:        return 0;
  }
}
function pickHandlerTactic(state, combat, needDefense) {
  const SLOT = ['intro', 'subject', 'target'];
  const animals = SLOT.filter(s => combat.htray[s]?.kind === 'animal').length;
  const haveLure = state.hand.some(h => h.type === 'lure');
  const compPct = state.composure / (state.composureMax || 1);
  const isBoss = combat.enemy?.tier === 'boss';
  // canCombine: board has an animal whose species supports a 3-of-a-kind combine.
  const canCombine = SLOT.some(s => {
    const sl = combat.htray[s];
    return sl?.kind === 'animal' && !!COMBINE_BY_SPECIES[sl.animalId];
  });
  // SHIELD routes every animal attack into Block+Poise, so a menagerie under
  // shield deals ZERO composure — only engage it to soak a hit we can't
  // otherwise cover (needDefense), never as a default.
  let best = -1, bestVal = -Infinity, bestId = null, bestEngaged = Infinity;
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.type !== 'tactic' || c.cost > state.energy) continue;
    const id = c.tactic.id;
    if (id === combat.tactic) continue;
    if (id === 'shield' && !needDefense) continue;
    if (c.tactic.requiresExactlyOneAnimal && animals !== 1) continue;
    const val = id === 'shield' ? 100 : tacticSituationalValue(id, animals, haveLure, compPct, isBoss, canCombine);
    if (val <= 0) continue;
    const engaged = combat.tacticsEngaged[id] || 0;
    // Higher situational value wins; ties broken toward the LESS-used tactic
    // (the variety driver, now subordinate to actually-good plays).
    if (val > bestVal || (val === bestVal && engaged < bestEngaged)) {
      bestVal = val; best = i; bestId = id; bestEngaged = engaged;
    }
  }
  if (best < 0) return -1;
  // If an offensive tactic is already active, only swap when the candidate is
  // meaningfully better for the current board (not just for variety's sake).
  // Shield we always escape once the threat passes, so don't gate swaps off it.
  if (combat.tactic && combat.tactic !== 'shield' && bestId !== 'shield') {
    const curVal = tacticSituationalValue(combat.tactic, animals, haveLure, compPct, isBoss, canCombine);
    if (bestVal <= curVal + 2) return -1;
  }
  return best;
}

function stageHandlerLure(state, combat, lure) {
  const SLOT = ['intro', 'subject', 'target'];
  const empties = SLOT.filter(s => combat.htray[s] == null);
  if (empties.length === 0) { state.discard.push(lure); return; }
  const youthBonus = (combat.tactic === 'youth' && combat.youthUses > 0) ? 1 : 0;
  const nurture = combat.tactic === 'nurture';
  const targets = combat.buffetArmed ? empties : [empties[0]];
  targets.forEach((s, idx) => {
    const withCard = idx === 0; // one card resource cycles back, even via Buffet
    if (nurture) {
      const animalId = resolveLureSpecies(lure, combat);
      combat.htray[s] = makeAnimalSlot(animalId, youthBonus, lure.summon.summonSet);
      combat.summons++;
      if (withCard) state.discard.push(lure); // consumed → cycles
    } else {
      combat.htray[s] = {
        kind: 'lure', card: withCard ? { ...lure } : null,
        animalIds: lure.summon.animalIds, animalId: lure.summon.animalId,
        summonSet: lure.summon.summonSet || null,
        turnsRemaining: lure.summon.turnsToArrive, youthBonus,
      };
    }
  });
  combat.buffetArmed = false;
  if (youthBonus) combat.youthUses = Math.max(0, combat.youthUses - 1);
}

function applyHandlerUtil(state, combat, card) {
  const SLOT = ['intro', 'subject', 'target'];
  if (card.util === 'buffet') { combat.buffetArmed = true; return; }
  if (card.util === 'onThree') {
    for (const s of SLOT) {
      const slot = combat.htray[s];
      if (slot?.kind !== 'animal') continue;
      const a = HANDLER_ANIMALS[slot.animalId];
      if (a && a.attack > 0) handlerAnimalAttack(state, combat, slot, a, 1);
    }
    return;
  }
  if (card.util === 'eatNow') {
    const s = SLOT.find(x => combat.htray[x]?.kind === 'lure');
    if (s) {
      const lure = combat.htray[s];
      const animalId = resolveLureSpecies(lure, combat);
      if (lure.card) state.discard.push({ ...lure.card });
      combat.htray[s] = makeAnimalSlot(animalId, lure.youthBonus || 0, lure.summonSet);
      combat.summons++;
    }
    return;
  }
  if (card.util === 'treat') {
    let bestS = null, bestAtk = -1;
    for (const s of SLOT) { const sl = combat.htray[s]; if (sl?.kind !== 'animal') continue; const a = HANDLER_ANIMALS[sl.animalId]; if ((a?.attack || 0) > bestAtk) { bestAtk = a.attack; bestS = s; } }
    if (bestS) combat.htray[bestS].durationRemaining += 1;
  }
  // 'shoo' intentionally unused by the AI — situational, no greedy value.
}

function playHandlerCard(state, combat, idx) {
  const card = state.hand[idx];
  state.hand.splice(idx, 1);
  state.energy -= (card.cost || 0);
  if (card.type === 'tactic') {
    if (combat.tactic !== card.tactic.id) combat.tacticChanges++;
    combat.tactic = card.tactic.id;
    combat.tacticsEngaged[card.tactic.id] = (combat.tacticsEngaged[card.tactic.id] || 0) + 1;
    if (card.tactic.id === 'youth') combat.youthUses = 3;
    state.discard.push(card); // tactic stays active by id; card cycles
    return;
  }
  if (card.type === 'lure') { stageHandlerLure(state, combat, card); return; }
  if (card.type === 'handler-skill') {
    if (card.effects?.block)   state.block += card.effects.block;
    if (card.effects?.poise)   state.poise += card.effects.poise;
    if (card.effects?.compDmg) { handlerDealComposure(combat, card.effects.compDmg); combat.totalDamageDealt += card.effects.compDmg; }
    state.discard.push(card);
    return;
  }
  if (card.type === 'handler-util') {
    applyHandlerUtil(state, combat, card);
    if (card.exhaust) state.exiled.push(card); else state.discard.push(card);
    return;
  }
  state.discard.push(card);
}

// Feed an unfed animal on its make-or-break turn (dur===2) with a matching
// lure — unlocks the final turn + onExit bonus (App.jsx feed gate).
function tryHandlerFeed(state, combat) {
  const SLOT = ['intro', 'subject', 'target'];
  for (const s of SLOT) {
    const slot = combat.htray[s];
    if (slot?.kind !== 'animal') continue;
    const a = HANDLER_ANIMALS[slot.animalId];
    if (!a?.feedKey || slot.feedReceived || slot.durationRemaining !== 2) continue;
    const li = state.hand.findIndex(c => c.type === 'lure' && c.feedKey === a.feedKey && c.cost <= state.energy);
    if (li < 0) continue;
    const lure = state.hand[li];
    state.hand.splice(li, 1);
    state.energy -= (lure.cost || 0);
    slot.feedReceived = true;
    combat.feeds++;
    state.discard.push(lure);
    return true;
  }
  return false;
}

// Pick the best lure index to play, preferring lures whose species can combine
// with animals already on the board. Returns hand index, or -1 if none playable.
// "combine-ready": board has 1 or 2 of a combine-eligible species (field-mouse/
// rabbit/young-buck) → play tender-greens (which can produce that species).
// feather tactic will lock the new animal to match the existing one.
function pickBestLure(state, combat) {
  const SLOT = ['intro', 'subject', 'target'];
  // Count existing combine-eligible species on the board.
  const boardSpeciesCounts = {};
  for (const s of SLOT) {
    const sl = combat.htray[s];
    if (sl?.kind === 'animal' && COMBINE_BY_SPECIES[sl.animalId]) {
      boardSpeciesCounts[sl.animalId] = (boardSpeciesCounts[sl.animalId] || 0) + 1;
    }
  }
  const wantCombine = Object.values(boardSpeciesCounts).some(n => n >= 1);
  // Prefer tender-greens when we want a combine (produces combineable species).
  // Prefer off-starter lures (fish-food/birdseed) for variety when tray is empty.
  let bestIdx = -1, bestPriority = -1;
  for (let i = 0; i < state.hand.length; i++) {
    const c = state.hand[i];
    if (c.type !== 'lure' || c.cost > state.energy) continue;
    let priority = 0;
    if (c.summon?.summonSet === 'tender-greens' && wantCombine) priority = 3;
    else if (c.summon?.summonSet === 'tender-greens') priority = 1;
    else priority = 2; // fish-food/birdseed add variety
    if (priority > bestPriority) { bestPriority = priority; bestIdx = i; }
  }
  return bestIdx;
}

function aiTurnHandler(state, combat) {
  combat.turn++;
  state.energy = energyPerTurnRefill(state);
  state.block = 0;
  state.poise = 0;
  drawCards(state, HAND_SIZE);

  const SLOT = ['intro', 'subject', 'target'];
  const emptyCount = () => SLOT.filter(s => combat.htray[s] == null).length;
  const animalCount = () => SLOT.filter(s => combat.htray[s]?.kind === 'animal').length;
  const isBoss = combat.enemy?.tier === 'boss';

  let safety = 30;
  while (safety-- > 0) {
    // 1. Defend if incoming exceeds the matching pool.
    const intent = combat.enemyIntent;
    const incoming = (intent?.kind === 'attack' || intent?.kind === 'attack-multi') ? intent.value * (intent.count || 1) : 0;
    if (incoming > 0) {
      const targetsComp = intent.pool === 'composure';
      const expected = adjustIncoming(state, combat, incoming);
      const pool = targetsComp ? state.poise : state.block;
      if (expected > pool + 1) {
        const di = state.hand.findIndex(c => c.type === 'handler-skill' && c.cost <= state.energy && (targetsComp ? c.effects?.poise : c.effects?.block));
        if (di >= 0) { playHandlerCard(state, combat, di); continue; }
      }
    }
    // 2. Feed an animal on its make-or-break turn.
    if (tryHandlerFeed(state, combat)) continue;
    // 3. Engage a tactic. Shield only when the hit would drop us below a
    //    meaningful HP threshold (30%) AND no skill card can cover it.
    if (state.energy >= 1) {
      let needDefense = false;
      if (incoming > 0) {
        const targetsComp = intent.pool === 'composure';
        const expected = adjustIncoming(state, combat, incoming);
        const pool = targetsComp ? state.poise : state.block;
        const haveSkill = state.hand.some(c => c.type === 'handler-skill' && c.cost <= state.energy && (targetsComp ? c.effects?.poise : c.effects?.block));
        const uncovered = Math.max(0, expected - pool);
        // Shield is a big tempo sacrifice (menagerie deals 0 comp while active),
        // so only engage it when truly at risk: uncovered hit > 30% of current HP
        // (or composure for comp-targeting attacks) AND no skill covers it.
        const damagePct = targetsComp
          ? uncovered / Math.max(1, state.composure)
          : uncovered / Math.max(1, state.hp);
        needDefense = uncovered > 0 && damagePct > 0.3 && !haveSkill;
      }
      const ti = pickHandlerTactic(state, combat, needDefense);
      if (ti >= 0) { playHandlerCard(state, combat, ti); continue; }
    }
    // 4. On boss: fast-forward a staged lure with Just Eat It to get animals
    //    on board sooner — each turn of delay vs a boss is costly.
    if (isBoss && SLOT.some(s => combat.htray[s]?.kind === 'lure')) {
      const ei = state.hand.findIndex(c => c.util === 'eatNow' && c.cost <= state.energy);
      if (ei >= 0) { playHandlerCard(state, combat, ei); continue; }
    }
    // 5. Arm Buffet before a lure when feather is active + 2 lures available
    //    (feather forces species-match, so filling 2 slots = guaranteed combine progress).
    // Also arm Buffet when 2+ slots open generally.
    const featherActive = combat.tactic === 'feather';
    const luresInHand = state.hand.filter(c => c.type === 'lure' && c.cost <= state.energy).length;
    const shouldBuffet = !combat.buffetArmed && emptyCount() >= 2 && luresInHand >= 1;
    const featherBuffetPriority = featherActive && luresInHand >= 2 && emptyCount() >= 2 && !combat.buffetArmed;
    if (featherBuffetPriority || shouldBuffet) {
      const bi = state.hand.findIndex(c => c.util === 'buffet' && c.cost <= state.energy);
      if (bi >= 0) { playHandlerCard(state, combat, bi); continue; }
    }
    // 6. Stage a lure — prefer species that build toward a 3-of-a-kind combine.
    //    Exception: if we have exactly 1 animal + feather tactic in hand + 2 lures
    //    in hand, DON'T fill the remaining 2 slots immediately — the tactic step
    //    will engage feather first (next iteration), then fill slots with forced species.
    //    This "hold-and-feather" path fires in the next loop iteration after feather.
    const animalCnt = animalCount();
    const featherInHand = state.hand.some(c => c.type === 'tactic' && c.tactic?.id === 'feather' && c.cost <= state.energy);
    const lureInHand = state.hand.filter(c => c.type === 'lure' && c.cost <= state.energy).length;
    const holdForFeather = animalCnt === 1 && featherInHand && lureInHand >= 2 && combat.tactic !== 'feather';
    if (emptyCount() > 0 && !holdForFeather) {
      const li = pickBestLure(state, combat);
      if (li >= 0) { playHandlerCard(state, combat, li); continue; }
    }
    // 7. On Three! spike — on boss use with 2+ animals (to respect exhaust cost);
    //    use with any combine-capable board on boss to spike before animals expire.
    const totalBoardAtk = SLOT.reduce((sum, s) => {
      const sl = combat.htray[s];
      if (sl?.kind !== 'animal') return sum;
      const a = HANDLER_ANIMALS[sl.animalId];
      return sum + (a?.attack || 0);
    }, 0);
    const onThreeWorthIt = isBoss ? totalBoardAtk >= 10 : animalCount() >= 2;
    if (onThreeWorthIt) {
      const oi = state.hand.findIndex(c => c.util === 'onThree' && c.cost <= state.energy);
      if (oi >= 0) { playHandlerCard(state, combat, oi); continue; }
    }
    // 8. Sharp Whistle chip with leftover energy.
    const si = state.hand.findIndex(c => c.effects?.compDmg && c.cost <= state.energy);
    if (si >= 0) { playHandlerCard(state, combat, si); continue; }
    // 9. Fallback: play a crafted effect card (e.g. staff) via verbal cast system.
    //    The handler has no word cards so it casts with 0 verbal stat — but
    //    crafted staves still deal base damage (8-14+) scaled by enemy
    //    effectiveness. Only attempt this once per turn (effectFiredThisTurn gate).
    if (!combat.tray.effectFiredThisTurn) {
      const ei = state.hand.findIndex(c => c.type === 'effect' && c.cost <= state.energy && !combat.tray.effectCard);
      if (ei >= 0) {
        stageEffect(state, combat, ei);
        if (combat.tray.effectCard) {
          castSpell(state, combat);
          // castSpell clears the tray and sends cards to discard/exiled.
        }
        continue;
      }
    }
    break;
  }

  // End of turn: menagerie acts, then the enemy.
  handlerEndOfTurnTick(state, combat);
  if (combat.tactic) combat.tacticTurns[combat.tactic] = (combat.tacticTurns[combat.tactic] || 0) + 1;

  for (const c of state.hand) state.discard.push(c);
  state.hand = [];

  if (combat.enemyComposure > 0 && combat.enemyHp > 0) {
    combat.enemyBlock = 0;
    applyIntent(state, combat, combat.enemyIntent);
    combat.enemyDmgMult  = combat.enemyDmgMult  > 1 ? Math.max(1, combat.enemyDmgMult  - 0.5) : combat.enemyDmgMult  < 1 ? Math.min(1, combat.enemyDmgMult  + 0.5) : combat.enemyDmgMult;
    combat.playerDmgMult = combat.playerDmgMult > 1 ? Math.max(1, combat.playerDmgMult - 0.5) : combat.playerDmgMult < 1 ? Math.min(1, combat.playerDmgMult + 0.5) : combat.playerDmgMult;
    combat.lastIntentKinds.push(combat.enemyIntent?.kind);
    if (combat.lastIntentKinds.length > 2) combat.lastIntentKinds.shift();
    const exclude = (combat.lastIntentKinds.length >= 2 && combat.lastIntentKinds[0] === combat.lastIntentKinds[1]) ? [combat.lastIntentKinds[0]] : [];
    combat.enemyIntent = rollIntent(combat.enemy, exclude);
  }
}

// Faithful port of the App.jsx handler end-of-turn tick (App.jsx ~9246).
function handlerEndOfTurnTick(state, combat) {
  combat.handlerTicks++;
  const SLOT = ['intro', 'subject', 'target'];
  const work = { intro: combat.htray.intro, subject: combat.htray.subject, target: combat.htray.target };

  const onExit = (animal) => {
    const fx = animal?.onExit; if (!fx) return;
    if (fx.damage > 0) {
      if (fx.damageType === 'physical') handlerDealHp(combat, fx.damage);
      else { handlerDealComposure(combat, fx.damage); combat.menagerieComposure += fx.damage; }
      combat.totalDamageDealt += fx.damage;
    }
    if (fx.block > 0)     { state.block += fx.block; combat.menagerieBlock += fx.block; }
    if (fx.applyWeak > 0) combat.enemyDmgMult = Math.max(0.5, combat.enemyDmgMult - 0.25 * fx.applyWeak);
    if (fx.healComp > 0)  state.composure = Math.min(state.composureMax, state.composure + fx.healComp);
    if (fx.healHp > 0)    state.hp = Math.min(state.maxHp, state.hp + fx.healHp);
  };

  // PRE-PASS: cannibalism (lure adjacent to same-species animal).
  for (let i = 0; i < SLOT.length; i++) {
    const lureSlot = work[SLOT[i]];
    if (!lureSlot || lureSlot.kind !== 'lure') continue;
    for (const ni of [i - 1, i + 1].filter(n => n >= 0 && n < SLOT.length)) {
      const nb = work[SLOT[ni]];
      if (!nb || nb.kind !== 'animal' || nb.animalId !== lureSlot.animalId) continue;
      if (lureSlot.card) state.discard.push({ ...lureSlot.card });
      work[SLOT[i]] = { ...nb, eatenThisTurn: true };
      work[SLOT[ni]] = null;
      break;
    }
  }
  // PRE-PASS: hawk strike (5% per field-mouse).
  for (const s of SLOT) {
    const slot = work[s];
    if (!slot || slot.kind !== 'animal' || slot.animalId !== 'field-mouse') continue;
    if (Math.random() >= 0.05) continue;
    const h = makeAnimalSlot('hawk', 0, slot.summonSet); h.eatenThisTurn = true;
    work[s] = h;
  }
  // PRE-PASS: three-of-a-kind combine.
  const first = work[SLOT[0]];
  const matched = (first?.kind === 'animal' && COMBINE_BY_SPECIES[first.animalId]) ? first.animalId : null;
  if (matched && SLOT.every(s => work[s]?.kind === 'animal' && work[s].animalId === matched)) {
    const combineId = COMBINE_BY_SPECIES[matched];
    const ca = HANDLER_ANIMALS[combineId];
    work.intro = {
      kind: 'animal', animalId: combineId, durationRemaining: ca?.duration || 2,
      predatorProgress: 0, adjacentSpawnProgress: 0, adjacentSpawned: false,
      summonSet: matched === 'field-mouse' ? 'tender-greens' : null,
      spans: ['intro', 'subject'], justCombined: true, feedReceived: true, nextAttackMult: 1,
    };
    work.subject = { kind: 'occupied', occupiedBy: 'intro' };
    work.target = null;
    combat.combines++;
  }
  // PRE-PASS: tender-greens row bonus (×1.5 next attack + +3 block/turn, once).
  const entries = SLOT.map(s => work[s]);
  const allTG = entries.every(s => s && s.kind === 'animal' && s.summonSet === 'tender-greens');
  if (allTG && !entries.every(s => s.tgFired)) {
    for (const s of SLOT) {
      const sl = work[s];
      work[s] = { ...sl, nextAttackMult: 1.5, turnGrantTemp: { block: ((sl.turnGrantTemp?.block) || 0) + 3 }, tgFired: true };
    }
  }

  // MAIN LOOP.
  const next = {};
  const isUnfed = (slot, animal) => animal?.feedKey && !slot.feedReceived;
  for (const slotName of SLOT) {
    const slot = work[slotName];
    if (!slot) { next[slotName] = null; continue; }
    if (slot.kind === 'occupied') { if (next[slotName] === undefined) next[slotName] = slot; continue; }
    if (slot.kind === 'lure') {
      const nt = slot.turnsRemaining - 1;
      if (nt <= 0) {
        const animalId = resolveLureSpecies(slot, combat);
        if (slot.card) state.discard.push({ ...slot.card });
        combat.summons++;
        next[slotName] = makeAnimalSlot(animalId, slot.youthBonus || 0, slot.summonSet);
      } else next[slotName] = { ...slot, turnsRemaining: nt };
      continue;
    }
    // animal
    const animal = HANDLER_ANIMALS[slot.animalId];
    if (!animal) { next[slotName] = null; continue; }
    if (!slot.eatenThisTurn && animal.attack > 0) handlerAnimalAttack(state, combat, slot, animal, 1);
    const grant = animal.turnGrant || slot.turnGrantTemp;
    if (grant) { if (grant.block > 0) { state.block += grant.block; combat.menagerieBlock += grant.block; } if (grant.poise > 0) state.poise += grant.poise; }

    let nextDur = slot.justCombined ? slot.durationRemaining : slot.durationRemaining - 1;
    const nextPred = (slot.predatorProgress || 0) + 1;
    const nextAdj = (slot.adjacentSpawnProgress || 0) + 1;

    // TERRITORIAL (mirror of App.jsx): the chain target only spawns if no
    // animal of that species is already on the projected board — caps the
    // Buffet + Fish-Food multi-bear burst. Blocked salmon fall through to a
    // normal tick (progress held high) and pop once the resident bear leaves.
    const chainReady = animal.predatorChain && nextPred >= animal.predatorChain.turnsToTrigger;
    const chainTargetId = animal.predatorChain && animal.predatorChain.animalId;
    const chainTargetPresent = chainReady && SLOT.some((s) => {
      if (s === slotName) return false;
      const proj = (next[s] !== undefined) ? next[s] : work[s];
      return proj && proj.kind === 'animal' && proj.animalId === chainTargetId;
    });
    if (chainReady && !chainTargetPresent) {
      next[slotName] = makeAnimalSlot(animal.predatorChain.animalId, 0, slot.summonSet);
      continue;
    }
    const si = SLOT.indexOf(slotName);
    const hasEmptyNb = [si - 1, si + 1].some(n => {
      if (n < 0 || n >= SLOT.length) return false;
      const ns = SLOT[n];
      const proj = (next[ns] !== undefined) ? next[ns] : work[ns];
      return proj == null;
    });
    if (animal.adjacentSpawn && !slot.adjacentSpawned && nextAdj >= animal.adjacentSpawn.turnsToTrigger && !isUnfed(slot, animal) && hasEmptyNb) {
      for (const n of [si - 1, si + 1]) {
        if (n < 0 || n >= SLOT.length) continue;
        const ns = SLOT[n];
        const proj = (next[ns] !== undefined) ? next[ns] : work[ns];
        if (proj == null) { const child = makeAnimalSlot(animal.adjacentSpawn.animalId, 0, slot.summonSet); child.adjacentSpawned = true; next[ns] = child; combat.summons++; }
      }
      nextDur = (slot.durationRemaining - 1) + (animal.adjacentSpawn.extendSelfTurns || 0);
      if (nextDur <= 0) { if (!isUnfed(slot, animal)) onExit(animal); clearHandlerSlot(next, slot, slotName); }
      else next[slotName] = { ...slot, durationRemaining: nextDur, predatorProgress: nextPred, adjacentSpawnProgress: 0, adjacentSpawned: true, nextAttackMult: 1 };
      continue;
    }
    if (nextDur <= 0) { if (!isUnfed(slot, animal)) onExit(animal); clearHandlerSlot(next, slot, slotName); }
    else if (nextDur === 1 && isUnfed(slot, animal)) { combat.shortStays++; clearHandlerSlot(next, slot, slotName); }
    else next[slotName] = { ...slot, durationRemaining: nextDur, predatorProgress: nextPred, adjacentSpawnProgress: nextAdj, nextAttackMult: 1, justCombined: false };
  }

  // Birds of a Feather self-exhaust at three-of-a-kind.
  if (combat.tactic === 'feather') {
    const counts = {};
    for (const s of SLOT) { const sl = next[s]; if (sl?.kind === 'animal') counts[sl.animalId] = (counts[sl.animalId] || 0) + 1; }
    if (Object.values(counts).some(n => n >= 3)) combat.tactic = null;
  }
  combat.htray = { intro: next.intro ?? null, subject: next.subject ?? null, target: next.target ?? null };
}

// Task A fix: push any still-staged lure cards back to state.discard so
// the handler deck doesn't silently shrink across combats. Transformed
// animals already recycle via state.discard inside handlerEndOfTurnTick;
// this covers only lures that were still mid-countdown when combat ended.
function flushStagedLures(state, combat) {
  if (!combat.isHandler) return;
  for (const s of ['intro', 'subject', 'target']) {
    const slot = combat.htray[s];
    if (slot?.kind === 'lure' && slot.card) {
      state.discard.push({ ...slot.card });
    }
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
    if (state.hp <= 0 || state.composure <= 0) { flushStagedLures(state, combat); return { combat, outcome: 'lost' }; }
    if (combat.enemyComposure <= 0 || combat.enemyHp <= 0) { flushStagedLures(state, combat); return { combat, outcome: 'won' }; }
    aiTurn(state, combat);
    if (combat.totalDamageDealt === prevDamageDealt) {
      zeroDamageStreak++;
      if (zeroDamageStreak >= 5) { flushStagedLures(state, combat); return { combat, outcome: 'stall' }; }
    } else {
      zeroDamageStreak = 0;
      prevDamageDealt = combat.totalDamageDealt;
    }
  }
  flushStagedLures(state, combat);
  return { combat, outcome: (state.hp <= 0 || state.composure <= 0) ? 'lost' : combat.enemyComposure <= 0 ? 'won' : 'stall' };
}

// =============================================================================
// 4. RUN SIM (path through 4 acts)
// =============================================================================

function makeRunState() {
  // Slim starter + 2 picks from STARTING_PICKS_POOL (mirrors App's
  // StartingPicksScreen). Cycle 4: randomize which lane the player
  // commits to at game start so the sim data reflects all three
  // archetype paths instead of always-jnsq. Each lane has equal
  // probability — simulates a player making a one-archetype call.
  const lanes = ['handler', 'wit', 'jnsq'];
  const pickedLane = lanes[Math.floor(Math.random() * lanes.length)];
  const isHandler = pickedLane === 'handler';

  // Handler runs use the Animal Summoner starter (lures + tactics + utility);
  // wit/jnsq use the word-pool starter + two lane picks.
  let deck;
  if (isHandler) {
    deck = HANDLER_STARTER.map(id => ({ ...HANDLER_CARDS_BY_ID[id], uid: uid() }));
  } else {
    deck = STARTER_DECK.map(id => ({ ...CARDS_BY_ID[id], uid: uid() }));
    const laneIds = STARTING_PICKS_POOL.filter(id => {
      const c = CARDS_BY_ID[id];
      if (!c) return false;
      if (c.type === 'word') return !!c.stats?.[pickedLane];
      if (c.type === 'effect') return c.effect?.scaleBy === pickedLane;
      return false;
    });
    for (const id of laneIds.slice(0, 2)) {
      const c = CARDS_BY_ID[id];
      if (c) deck.push({ ...c, uid: uid() });
    }
  }
  return {
    lane: pickedLane,
    isHandler,
    hp: STARTING_MAX_HP,
    maxHp: STARTING_MAX_HP,
    composure: STARTING_MAX_COMPOSURE,
    composureMax: STARTING_MAX_COMPOSURE,
    block: 0,
    poise: 0,
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

// Build the per-combat stat record pushed into runStats.combats. Handler
// combats carry extra menagerie/tactic telemetry; wit/jnsq fields stay null
// so the report aggregator can branch cleanly.
function combatStatRecord(act, tier, enemyId, res) {
  const c = res.combat;
  const rec = {
    act: act.id, tier, enemyId, outcome: res.outcome,
    turns: c.turn, fizzles: c.fizzles,
    castsAttempted: c.castsAttempted, castsResonated: c.castsResonated,
    damageDealt: c.totalDamageDealt, damageTaken: c.totalDamageTaken,
    isHandler: !!c.isHandler,
  };
  if (c.isHandler) {
    rec.handler = {
      ticks: c.handlerTicks,
      tacticChanges: c.tacticChanges,
      tacticsEngaged: { ...c.tacticsEngaged },
      tacticTurns: { ...c.tacticTurns },
      tacticVariety: Object.keys(c.tacticsEngaged || {}).length,
      summons: c.summons,
      feeds: c.feeds,
      shortStays: c.shortStays,
      combines: c.combines,
      menagerieComposure: c.menagerieComposure,
      menagerieBlock: c.menagerieBlock,
    };
  }
  return rec;
}

// Handler reward draft. Samples 3 distinct cards from HANDLER_REWARD_POOL and
// picks one, biased toward TACTIC VARIETY + burst tools for boss fights.
// A tactic the deck doesn't yet own is worth far more than a duplicate; among
// non-tactics, prefer On Three! (boss-burst spike) and additional tender-greens
// (more combine fodder); off-starter lures widen the menagerie.
function aiPickHandlerReward(state) {
  const owned = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
  const ownedIds = new Set(owned.map(c => c.id));
  const ownedTactics = new Set(owned.filter(c => c.type === 'tactic').map(c => c.id));
  const ownedCounts = {};
  for (const c of owned) ownedCounts[c.id] = (ownedCounts[c.id] || 0) + 1;
  const pool = shuffle(HANDLER_REWARD_POOL.slice());
  const candidates = [];
  for (const id of pool) {
    if (candidates.length >= 3) break;
    candidates.push(HANDLER_CARDS_BY_ID[id]);
  }
  // Count total lure cards owned (all lure types) to gate lure-density bonus.
  const ownedLureCount = owned.filter(c => c.type === 'lure').length;
  function score(card) {
    let s = 0;
    if (card.type === 'tactic') {
      s += ownedTactics.has(card.id) ? 3 : 14; // a NEW tactic is the prize
    } else if (card.type === 'lure') {
      s += ownedIds.has(card.id) ? 4 : 9;       // off-starter lures widen the pool
      // Extra tender-greens are combine-fodder. Below 3 total lures, any lure
      // card is top priority — lure density prevents stalls.
      if (ownedLureCount < 3) s += 8;
      else if (card.id === 'cv2-l-tender-greens' && (ownedCounts[card.id] || 0) < 3) s += 4;
    } else if (card.util === 'onThree') {
      // On Three! is the primary boss-burst tool; high value if not yet owned.
      s += ownedIds.has(card.id) ? 5 : 12;
    } else {
      s += 6;                                   // utility (Buffet, Just Eat It, …)
    }
    if (card.rarity === 'uncommon') s += 2;
    return s;
  }
  const best = candidates.reduce((b, c) => (!b || score(c) > score(b.card) ? { card: c, sc: score(c) } : b), null);
  return best ? best.card : null;
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
      runStats.combats.push(combatStatRecord(act, tier, enemyId, res));
      if (res.outcome !== 'won') return false;
      // Post-combat card reward. Handler runs draft from the Animal Summoner
      // pool (tactic-variety biased); wit/jnsq use the rarity sampler.
      if (state.isHandler) {
        const pick = aiPickHandlerReward(state);
        if (pick) state.deck.push({ ...pick, uid: uid() });
      } else {
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
          return (st.handler || 0) * 2
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
      runStats.combats.push(combatStatRecord(act, 'boss', act.bossId, res));
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
      // Cycle 3 batch 5: passive +1 to the LOWEST skill at each act seam.
      // Whittling/Felting are near-zero (~0.4/0.9) because skill nodes
      // are rare and players die before late-act crafting matters. This
      // floor surfaces the crafting content without forcing pickups.
      const skills = state.skills || {};
      let lowest = null, lowestVal = Infinity;
      for (const k of Object.keys(skills)) {
        if (skills[k] < lowestVal) { lowestVal = skills[k]; lowest = k; }
      }
      if (lowest) state.skills[lowest] = Math.min(5, (state.skills[lowest] || 0) + 1);
      // Cycle 2 batch 5: forced physical-card injection if the player
      // is about to enter Act 2 with no physical answer. Mirrors a
      // hypothetical "you can pick a free physical at the act seam"
      // structural mechanic — surfaces the pivot problem the agents
      // flagged. (App-side equivalent deferred to a real UI design.)
      const physicalCount = [...state.deck, ...state.hand, ...state.discard, ...state.exiled]
        .filter(c => c.type === 'effect' && c.effect?.damageType === 'physical').length;
      if (physicalCount === 0) {
        const physPicks = ['e-throw-the-book', 'e-flame-on', 'e-sword-logic'];
        const pickId = physPicks[Math.floor(Math.random() * physPicks.length)];
        const picked = CARDS_BY_ID[pickId];
        if (picked) state.discard.push({ ...picked, uid: uid() });
      }
    }
  }
  return true;
}

function aiPickReward(state, candidates) {
  // Smarter reward selection. Cycle 2 batch 1 audit added the
  // LANE-COMMITMENT heuristic — once the deck has ≥4 cards in a
  // dominant stat, bias new picks toward that stat's synergy. This
  // pushes the AI toward archetype commitment instead of sampler-deck.
  const allCards = [...state.deck, ...state.hand, ...state.discard, ...state.exiled];
  const counts = {};
  for (const c of allCards) counts[c.id] = (counts[c.id] || 0) + 1;
  const physicalInDeck = allCards.filter(c => c.type === 'effect' && c.effect?.damageType === 'physical').length;

  // Compute the deck's "thesis" — which stat is it leaning into?
  const statTotals = { handler: 0, wit: 0, jnsq: 0 };
  for (const c of allCards) {
    if (c.type === 'word' && c.stats) {
      statTotals.handler += c.stats.handler || 0;
      statTotals.wit      += c.stats.wit      || 0;
      statTotals.jnsq     += c.stats.jnsq     || 0;
    }
    if (c.type === 'effect' && c.effect?.scaleBy) {
      statTotals[c.effect.scaleBy] = (statTotals[c.effect.scaleBy] || 0) + 2;
    }
  }
  let dominantStat = null;
  let dominantWeight = 0;
  for (const [stat, total] of Object.entries(statTotals)) {
    if (total > dominantWeight) { dominantWeight = total; dominantStat = stat; }
  }
  // Cycle 2 batch 3: lowered commitment threshold from (≥4 AND ≥2×) to
  // (≥3 AND ≥1.5×) so the AI commits to a lane sooner. Previous threshold
  // almost never triggered before Act 2.
  const otherMax = Math.max(...Object.entries(statTotals).filter(([s]) => s !== dominantStat).map(([, v]) => v), 0);
  const isCommitted = dominantWeight >= 3 && dominantWeight >= otherMax * 1.5;

  function score(card) {
    let s = 0;
    if (card.type === 'effect') s += 10;
    else if (card.type === 'power') s += 7;
    else if (card.type === 'word')  s += 6;
    else                            s += 4;
    if (card.rarity === 'rare')     s += 6;
    if (card.rarity === 'uncommon') s += 3;
    // Physical effects when we're short on them — capped at 2 so we
    // don't crowd out wit/handler picks that matter at bosses.
    if (card.type === 'effect' && card.effect?.damageType === 'physical') {
      if (physicalInDeck < 1)      s += 12;
      else if (physicalInDeck < 2) s += 5;
      else                         s -= 2; // already covered
    }
    // LANE COMMITMENT: bias picks toward our dominant stat.
    if (isCommitted) {
      if (card.type === 'word' && card.stats?.[dominantStat])              s += 6;
      if (card.type === 'effect' && card.effect?.scaleBy === dominantStat) s += 6;
      // Penalize picks that scale by another stat — they widen the deck
      // when we want depth.
      if (card.type === 'effect' && card.effect?.scaleBy && card.effect.scaleBy !== dominantStat) s -= 3;
    }
    // Sway/Insult — modest baseline since their value is situational.
    // When physical-shortage is acute (about to enter Act 2's stone-leaning
    // enemies with no physical answer), Sway becomes the lever: it cracks
    // the immunity that walls verbal-only decks.
    if (card.effect?.sway) {
      s += 2;
      if (physicalInDeck === 0) s += 8; // Sway is the verbal-only escape valve
    }
    if (card.effect?.insult) s += 1;
    // Cycle 3: Read the Room — pierce tech. High pickup value if we're
    // committed to a single lane (we'll meet a resistant enemy eventually).
    if (card.effects?.pierceNextCast) {
      s += 4;
      if (isCommitted) s += 4; // committed decks need the pierce to handle hostile matchups
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
    lane: state.lane,
    isHandler: !!state.isHandler,
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
  // Handler-lane decks contain lure/tactic/handler-util cards — no word/effect
  // entries — so classifyDeckArchetype always returns 'sampler', burying the
  // handler's win stats. Override directly when state.isHandler is set.
  runStats.archetype = state.isHandler ? 'handler'
    : classifyDeckArchetype([...state.deck, ...state.hand, ...state.discard, ...state.exiled]);
  return runStats;
}

// Classify a deck's archetype by stat-weight + physical presence.
// Returns one of:
//   wit / handler / jnsq         — committed verbal lane (≥1.5× over runner-up)
//   physical                       — 4+ physical-damage Effects (the "punchy" build)
//   wit-physical / handler-physical / jnsq-physical — hybrid: dominant verbal + ≥3 physical
//   sampler                        — no committed lane (lane tools are too spread)
function classifyDeckArchetype(cards) {
  const stats = { handler: 0, wit: 0, jnsq: 0 };
  let physical = 0;
  for (const c of cards) {
    if (c.type === 'word' && c.stats) {
      stats.handler += c.stats.handler || 0;
      stats.wit      += c.stats.wit      || 0;
      stats.jnsq     += c.stats.jnsq     || 0;
    }
    if (c.type === 'effect' && c.effect?.scaleBy) {
      stats[c.effect.scaleBy] = (stats[c.effect.scaleBy] || 0) + 2;
    }
    if (c.type === 'effect' && c.effect?.damageType === 'physical') {
      physical++;
    }
  }
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const [topStat, topWeight] = entries[0];
  const runnerUp = entries[1]?.[1] || 0;
  // Physical-pure: lots of physical, no clear verbal lane
  if (physical >= 4 && topWeight < runnerUp * 1.5) return 'physical';
  // Hybrid: dominant verbal lane + meaningful physical access
  const isCommitted = topWeight >= 4 && topWeight >= runnerUp * 1.5;
  if (isCommitted && physical >= 3) return `${topStat}-physical`;
  if (isCommitted) return topStat;
  return 'sampler';
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

  // Per-act enemy KO loss rate (also track stalls separately for diagnostics)
  const lossByEnemyId = {};
  const stallByEnemyId = {};
  for (const c of allCombats) {
    if (c.outcome === 'lost') {
      lossByEnemyId[c.enemyId] = (lossByEnemyId[c.enemyId] || 0) + 1;
    } else if (c.outcome === 'stall') {
      stallByEnemyId[c.enemyId] = (stallByEnemyId[c.enemyId] || 0) + 1;
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

  // Lane bucketing — what archetype did each run actually become?
  const archetypeCounts = {};
  const archetypeWins   = {};
  // Per-archetype loss diagnostics (added Cycle 5 batch 2 for jnsq-pure
  // variance hunt — tells us which enemies disproportionately end each
  // lane's runs and where in the act curve each lane falls off).
  const archetypeLossByEnemy = {}; // arch -> { enemyId: count }
  const archetypeActsCleared = {}; // arch -> [cleared0, cleared1, cleared2, cleared3, cleared4]
  for (const r of results) {
    const a = r.archetype || 'sampler';
    archetypeCounts[a] = (archetypeCounts[a] || 0) + 1;
    if (r.won) archetypeWins[a] = (archetypeWins[a] || 0) + 1;
    if (!archetypeLossByEnemy[a]) archetypeLossByEnemy[a] = {};
    if (!archetypeActsCleared[a]) archetypeActsCleared[a] = [0, 0, 0, 0, 0];
    archetypeActsCleared[a][r.actsCleared || 0]++;
    // Find this run's KO combat (if any) and credit the enemy.
    for (const c of r.combats || []) {
      if (c.outcome === 'lost') {
        archetypeLossByEnemy[a][c.enemyId] = (archetypeLossByEnemy[a][c.enemyId] || 0) + 1;
      }
    }
  }

  // Skill levels at run end
  const skillMaxFreq = { whittling: 0, weaving: 0, smithing: 0, felting: 0 };
  for (const r of results) for (const [s, v] of Object.entries(r.finalSkills || {})) {
    if (v >= SKILL_MAX) skillMaxFreq[s]++;
  }
  const meanSkill = { whittling: 0, weaving: 0, smithing: 0, felting: 0 };
  for (const sk of Object.keys(meanSkill)) {
    meanSkill[sk] = mean(results.map(r => r.finalSkills?.[sk] || 0));
  }

  // Handler (Animal Summoner) telemetry — only meaningful for handler runs.
  const handlerRuns = results.filter(r => r.isHandler);
  const handlerCombats = handlerRuns.flatMap(r => r.combats.filter(c => c.isHandler && c.handler));
  let handlerAgg = null;
  if (handlerRuns.length > 0) {
    const tacticUse = {};   // tactic id -> # combats it was engaged in
    const tacticTurnsTotal = {}; // tactic id -> total uptime turns
    let varietySum = 0, ticksSum = 0, changeSum = 0;
    let summonsSum = 0, feedsSum = 0, shortStaysSum = 0, combinesSum = 0;
    let compSum = 0, blockSum = 0;
    for (const c of handlerCombats) {
      const h = c.handler;
      varietySum += h.tacticVariety;
      ticksSum += h.ticks;
      changeSum += h.tacticChanges;
      summonsSum += h.summons;
      feedsSum += h.feeds;
      shortStaysSum += h.shortStays;
      combinesSum += h.combines;
      compSum += h.menagerieComposure;
      blockSum += h.menagerieBlock;
      for (const [t, n] of Object.entries(h.tacticsEngaged || {})) {
        tacticUse[t] = (tacticUse[t] || 0) + 1;
        tacticTurnsTotal[t] = (tacticTurnsTotal[t] || 0) + (h.tacticTurns?.[t] || 0);
      }
    }
    const nc = handlerCombats.length || 1;
    handlerAgg = {
      runs: handlerRuns.length,
      wins: handlerRuns.filter(r => r.won).length,
      combats: handlerCombats.length,
      avgTacticVariety: varietySum / nc,
      avgSummonsPerCombat: summonsSum / nc,
      avgFeedsPerCombat: feedsSum / nc,
      avgShortStaysPerCombat: shortStaysSum / nc,
      avgCombinesPerCombat: combinesSum / nc,
      avgMenagerieComposurePerCombat: compSum / nc,
      avgMenagerieBlockPerCombat: blockSum / nc,
      avgTacticChangesPerCombat: changeSum / nc,
      tacticUse,
      tacticTurnsTotal,
    };
  }

  return {
    N, wins, winRate: wins / N,
    handler: handlerAgg,
    failedAt,
    bossLossByAct, bossWinByAct,
    lossByEnemyId,
    stallByEnemyId,
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
    archetypeCounts,
    archetypeWins,
    archetypeLossByEnemy,
    archetypeActsCleared,
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
  lines.push(`## Deck archetypes (lane bucketing)`);
  const ARCH_ORDER = ['wit', 'handler', 'jnsq', 'physical', 'wit-physical', 'handler-physical', 'jnsq-physical', 'sampler'];
  const counts = agg.archetypeCounts || {};
  const wins = agg.archetypeWins || {};
  const sorted = ARCH_ORDER.filter(a => counts[a]).concat(Object.keys(counts).filter(a => !ARCH_ORDER.includes(a)));
  for (const a of sorted) {
    const n = counts[a];
    const w = wins[a] || 0;
    const wr = n ? pct(w / n) : 'n/a';
    lines.push(`- **${a}**: ${n} run${n === 1 ? '' : 's'} (${pct(n / agg.N)}) · ${w} win${w === 1 ? '' : 's'} (${wr} win rate)`);
  }
  lines.push('');

  // Per-archetype loss diagnostics (Cycle 5 batch 2): for each archetype
  // with ≥15 runs, show top 3 killer enemies and act-cleared distribution.
  lines.push(`## Per-archetype loss diagnostics`);
  const lossByArch = agg.archetypeLossByEnemy || {};
  const actsByArch = agg.archetypeActsCleared || {};
  for (const a of sorted) {
    const n = counts[a];
    if (n < 15) continue;
    const enemyLosses = Object.entries(lossByArch[a] || {}).sort((x, y) => y[1] - x[1]);
    const topKillers = enemyLosses.slice(0, 3)
      .map(([id, c]) => `${id} (${c})`).join(', ') || '(no KOs)';
    const acts = actsByArch[a] || [0, 0, 0, 0, 0];
    // acts[i] = how many runs cleared exactly i acts. Total losses = n - wins.
    const lossCounts = acts.slice(0, 4); // died in act 1/2/3/4 = cleared 0/1/2/3
    const lossDist = lossCounts.map((c, i) => `a${i + 1}:${c}`).join(' · ');
    lines.push(`- **${a}** (n=${n}, ${(wins[a]||0)}W): ${topKillers} | died in ${lossDist}`);
  }
  lines.push('');

  // Handler (Animal Summoner) telemetry — tactic variety/uptime + menagerie
  // output. Only present when handler runs were sampled.
  if (agg.handler) {
    const h = agg.handler;
    lines.push(`## Handler — Animal Summoner`);
    lines.push(`- Runs: ${h.runs} (${h.wins}W, ${h.runs ? pct(h.wins / h.runs) : 'n/a'} win rate) · ${h.combats} handler combats`);
    lines.push(`- Avg tactic variety / combat: **${h.avgTacticVariety.toFixed(2)}** distinct tactics`);
    lines.push(`- Avg tactic swaps / combat: ${h.avgTacticChangesPerCombat.toFixed(2)}`);
    lines.push(`- Menagerie output / combat: **${h.avgMenagerieComposurePerCombat.toFixed(1)}** composure · ${h.avgMenagerieBlockPerCombat.toFixed(1)} block`);
    lines.push(`- Summons / combat: ${h.avgSummonsPerCombat.toFixed(2)} · Feeds: ${h.avgFeedsPerCombat.toFixed(2)} · Short-stays: ${h.avgShortStaysPerCombat.toFixed(2)} · Combines: ${h.avgCombinesPerCombat.toFixed(2)}`);
    const TACTIC_ORDER = ['shield', 'rabid', 'youth', 'nurture', 'feather'];
    const tu = h.tacticUse || {};
    const tt = h.tacticTurnsTotal || {};
    const tacticKeys = TACTIC_ORDER.filter(t => tu[t]).concat(Object.keys(tu).filter(t => !TACTIC_ORDER.includes(t)));
    lines.push(`- Tactic engagement (combats engaged · total uptime turns):`);
    if (tacticKeys.length === 0) lines.push(`  - (none engaged)`);
    for (const t of tacticKeys) {
      lines.push(`  - ${t}: ${tu[t]} combats · ${tt[t] || 0} turns`);
    }
    lines.push('');
  }

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
  lines.push(`## Stalls (5 consecutive 0-damage turns — typically handler vs high-block enemies)`);
  const stallRanked = Object.entries(agg.stallByEnemyId || {}).sort((a, b) => b[1] - a[1]);
  if (stallRanked.length === 0) lines.push(`- (no stalls)`);
  for (const [id, count] of stallRanked) {
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
if (agg.handler) {
  const h = agg.handler;
  console.log(`Handler: ${h.runs} runs, ${pct(h.runs ? h.wins / h.runs : 0)} win · tactic variety ${h.avgTacticVariety.toFixed(2)}/combat · menagerie ${h.avgMenagerieComposurePerCombat.toFixed(1)} comp/combat`);
}
